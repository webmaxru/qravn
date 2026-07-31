//! JNI surface for the Android client.
//!
//! Mirrors `core/bindings/wasm`: the boundary is JSON strings, exactly as
//! `contracts/v1/assessment.d.ts` specifies, so the seam stays stable across
//! wasm-bindgen, JNI, and any future binding technology.
//!
//! This crate performs no I/O, no networking, and reads no system clock. The
//! host passes `nowMs` in.
//!
//! Engines are addressed by an opaque `long` handle into a process-local
//! registry rather than by a raw pointer, so a Kotlin-side bug can leak an
//! engine but can never produce a use-after-free. The crate contains no
//! `unsafe` blocks; the only allowances are the `no_mangle` attributes the JNI
//! symbol table requires.
#![deny(unsafe_code)]

use jni::objects::{JClass, JString};
use jni::sys::{jlong, jstring};
use jni::JNIEnv;
use safety_core::{
    AssessInput, Assessment, EngineConfig, Limitation, PayloadKind, RecommendedAction,
    SafetyEngine, Verdict, ENGINE_VERSION,
};
use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

type Registry = Mutex<HashMap<i64, Arc<SafetyEngine>>>;

fn registry() -> &'static Registry {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn next_handle() -> i64 {
    static NEXT: AtomicI64 = AtomicI64::new(1);
    NEXT.fetch_add(1, Ordering::Relaxed)
}

fn engine(handle: jlong) -> Option<Arc<SafetyEngine>> {
    registry()
        .lock()
        .ok()
        .and_then(|engines| engines.get(&handle).cloned())
}

/// Constructs an engine from an `EngineConfig` JSON document and returns an
/// opaque handle. Kotlin must call `nativeDestroy` exactly once.
#[allow(unsafe_code, reason = "JNI requires an unmangled symbol name")]
#[no_mangle]
pub extern "system" fn Java_no_qravn_safety_NativeSafetyEngine_nativeCreate(
    mut env: JNIEnv,
    _class: JClass,
    config_json: JString,
) -> jlong {
    let config_json = read_string(&mut env, &config_json).unwrap_or_else(|| "{}".to_owned());
    let config: EngineConfig = serde_json::from_str(&config_json).unwrap_or_default();
    let handle = next_handle();
    match registry().lock() {
        Ok(mut engines) => {
            engines.insert(handle, Arc::new(SafetyEngine::new(config)));
            handle
        }
        Err(_) => 0,
    }
}

#[allow(unsafe_code, reason = "JNI requires an unmangled symbol name")]
#[no_mangle]
pub extern "system" fn Java_no_qravn_safety_NativeSafetyEngine_nativeDestroy(
    _env: JNIEnv,
    _class: JClass,
    handle: jlong,
) {
    if let Ok(mut engines) = registry().lock() {
        engines.remove(&handle);
    }
}

/// Takes an `AssessInput` JSON document, returns an `Assessment` JSON document.
#[allow(unsafe_code, reason = "JNI requires an unmangled symbol name")]
#[no_mangle]
pub extern "system" fn Java_no_qravn_safety_NativeSafetyEngine_nativeAssess(
    mut env: JNIEnv,
    _class: JClass,
    handle: jlong,
    input_json: JString,
) -> jstring {
    let raw = read_string(&mut env, &input_json).unwrap_or_default();
    let assessment = match (engine(handle), serde_json::from_str::<AssessInput>(&raw)) {
        (Some(engine), Ok(input)) => engine.assess(input),
        _ => malformed_input_assessment(&raw),
    };
    let json = serde_json::to_string(&assessment).unwrap_or_else(|_| "{}".to_owned());
    to_jstring(&mut env, &json)
}

#[allow(unsafe_code, reason = "JNI requires an unmangled symbol name")]
#[no_mangle]
pub extern "system" fn Java_no_qravn_safety_NativeSafetyEngine_nativeVersion(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    to_jstring(&mut env, ENGINE_VERSION)
}

fn read_string(env: &mut JNIEnv, value: &JString) -> Option<String> {
    if value.is_null() {
        return None;
    }
    env.get_string(value).ok().map(|java| java.into())
}

fn to_jstring(env: &mut JNIEnv, value: &str) -> jstring {
    match env.new_string(value) {
        Ok(java) => java.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

/// The same cautious fallback the wasm binding uses: input the binding could
/// not parse must never look like a clean result.
fn malformed_input_assessment(input_json: &str) -> Assessment {
    Assessment {
        schema_version: 1,
        payload_kind: PayloadKind::Text,
        raw_payload: input_json.to_owned(),
        display_payload: safety_core::unicode_guard::analyze_payload(input_json).display,
        url: None,
        redirect: None,
        findings: Vec::new(),
        limitations: vec![Limitation::new(
            "limitation.payload_not_understood",
            BTreeMap::new(),
        )],
        verdict: Verdict::InsufficientEvidence,
        confidence: 0.0,
        classifier_score: None,
        recommended_actions: vec![RecommendedAction::Copy, RecommendedAction::ScanAgain],
        summary: String::new(),
        engine_version: ENGINE_VERSION.to_owned(),
        rules_version: String::new(),
        locale: "en".to_owned(),
        evaluated_at_ms: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malformed_input_is_never_a_clean_verdict() {
        let assessment = malformed_input_assessment("{not json");
        assert_eq!(assessment.verdict, Verdict::InsufficientEvidence);
        assert!(assessment
            .limitations
            .iter()
            .any(|limitation| limitation.code == "limitation.payload_not_understood"));
        assert!(!assessment
            .recommended_actions
            .contains(&RecommendedAction::OpenAllowed));
        assert!(!assessment
            .recommended_actions
            .contains(&RecommendedAction::OpenWithConfirmation));
    }

    #[test]
    fn handles_are_unique_and_removable() {
        let first = next_handle();
        let second = next_handle();
        assert_ne!(first, second);

        registry()
            .lock()
            .expect("registry")
            .insert(first, Arc::new(SafetyEngine::new(EngineConfig::default())));
        assert!(engine(first).is_some());

        registry().lock().expect("registry").remove(&first);
        assert!(engine(first).is_none());
    }
}
