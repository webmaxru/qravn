//! C ABI surface for the iOS client.
//!
//! Mirrors `core/bindings/android`: the boundary is JSON strings, exactly as
//! `contracts/v1/assessment.d.ts` specifies, so the seam stays stable across
//! wasm-bindgen, JNI, the C ABI, and any future binding technology.
//!
//! This crate performs no I/O, no networking, and reads no system clock. The
//! host passes `nowMs` in.
//!
//! Engines are addressed by an opaque `int64_t` handle into a process-local
//! registry rather than by a raw pointer, so a Swift-side bug can leak an
//! engine but can never produce a use-after-free. The only `unsafe` in the
//! crate is the unavoidable reading and releasing of caller-owned C strings.
#![deny(unsafe_code)]

use safety_core::{
    AssessInput, Assessment, EngineConfig, Limitation, PayloadKind, RecommendedAction,
    SafetyEngine, Verdict, ENGINE_VERSION,
};
use std::collections::{BTreeMap, HashMap};
use std::ffi::{c_char, CStr, CString};
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

fn engine(handle: i64) -> Option<Arc<SafetyEngine>> {
    registry()
        .lock()
        .ok()
        .and_then(|engines| engines.get(&handle).cloned())
}

/// Constructs an engine from an `EngineConfig` JSON document and returns an
/// opaque handle. Swift must call `qravn_safety_engine_destroy` exactly once.
///
/// # Safety
///
/// `config_json` must be null or a NUL-terminated buffer that stays valid for
/// the duration of the call.
#[allow(unsafe_code, reason = "the C ABI requires an unmangled symbol name")]
#[no_mangle]
pub unsafe extern "C" fn qravn_safety_engine_create(config_json: *const c_char) -> i64 {
    let config_json = read_c_string(config_json).unwrap_or_else(|| "{}".to_owned());
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

#[allow(unsafe_code, reason = "the C ABI requires an unmangled symbol name")]
#[no_mangle]
pub extern "C" fn qravn_safety_engine_destroy(handle: i64) {
    if let Ok(mut engines) = registry().lock() {
        engines.remove(&handle);
    }
}

/// Takes an `AssessInput` JSON document, returns an `Assessment` JSON document.
///
/// # Safety
///
/// `input_json` must be null or a NUL-terminated buffer that stays valid for
/// the duration of the call. The returned string must be released with
/// [`qravn_safety_string_free`].
#[allow(unsafe_code, reason = "the C ABI requires an unmangled symbol name")]
#[no_mangle]
pub unsafe extern "C" fn qravn_safety_engine_assess(
    handle: i64,
    input_json: *const c_char,
) -> *mut c_char {
    let raw = read_c_string(input_json).unwrap_or_default();
    let assessment = match (engine(handle), serde_json::from_str::<AssessInput>(&raw)) {
        (Some(engine), Ok(input)) => engine.assess(input),
        _ => malformed_input_assessment(&raw),
    };
    let json = serde_json::to_string(&assessment).unwrap_or_else(|_| "{}".to_owned());
    to_c_string(&json)
}

#[allow(unsafe_code, reason = "the C ABI requires an unmangled symbol name")]
#[no_mangle]
pub extern "C" fn qravn_safety_engine_version() -> *mut c_char {
    to_c_string(ENGINE_VERSION)
}

/// Releases a string handed out by this library.
///
/// # Safety
///
/// `value` must be null or a pointer this library returned and that has not
/// already been released.
#[allow(unsafe_code, reason = "the C ABI requires an unmangled symbol name")]
#[no_mangle]
pub unsafe extern "C" fn qravn_safety_string_free(value: *mut c_char) {
    if value.is_null() {
        return;
    }
    // SAFETY: every non-null pointer this library returns came from
    // `CString::into_raw`, and the header documents that the caller must pass
    // each one back exactly once.
    drop(unsafe { CString::from_raw(value) });
}

#[allow(unsafe_code, reason = "borrowing a caller-owned C string requires it")]
fn read_c_string(value: *const c_char) -> Option<String> {
    if value.is_null() {
        return None;
    }
    // SAFETY: the header requires a NUL-terminated buffer that stays valid and
    // unmodified for the duration of the call.
    let borrowed = unsafe { CStr::from_ptr(value) };
    borrowed.to_str().ok().map(str::to_owned)
}

/// Interior NUL bytes cannot occur here: serde_json escapes them as `\u0000`
/// inside string literals, so the encoded document is always NUL-free.
fn to_c_string(value: &str) -> *mut c_char {
    CString::new(value)
        .map(CString::into_raw)
        .unwrap_or(std::ptr::null_mut())
}

/// The same cautious fallback the wasm and JNI bindings use: input the binding
/// could not parse must never look like a clean result.
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
#[allow(unsafe_code, reason = "exercising a C ABI requires raw pointers")]
mod tests {
    use super::*;

    /// Calls the exported symbols the way Swift does, so the test covers the
    /// real boundary rather than the Rust helpers behind it.
    fn assess_via_abi(handle: i64, input_json: &str) -> String {
        let input = CString::new(input_json).expect("input");
        // SAFETY: `input` outlives the call, and the returned pointer is freed
        // exactly once below.
        let raw = unsafe { qravn_safety_engine_assess(handle, input.as_ptr()) };
        assert!(!raw.is_null(), "assess returned no document");
        // SAFETY: `raw` is a live, NUL-terminated pointer this crate produced.
        let json = unsafe { CStr::from_ptr(raw) }
            .to_str()
            .expect("utf-8")
            .to_owned();
        // SAFETY: `raw` came from this library and is released once.
        unsafe { qravn_safety_string_free(raw) };
        json
    }

    fn create_engine() -> i64 {
        let config = CString::new("{}").expect("config");
        // SAFETY: `config` outlives the call.
        let handle = unsafe { qravn_safety_engine_create(config.as_ptr()) };
        assert_ne!(handle, 0, "engine was not created");
        handle
    }

    #[test]
    fn round_trips_an_assessment_across_the_abi() {
        let handle = create_engine();
        let json = assess_via_abi(handle, r#"{"payload":"https://example.com/","nowMs":1}"#);
        let assessment: Assessment = serde_json::from_str(&json).expect("assessment");

        assert_eq!(assessment.raw_payload, "https://example.com/");
        assert_eq!(assessment.payload_kind, PayloadKind::Url);
        assert_eq!(assessment.schema_version, 1);

        qravn_safety_engine_destroy(handle);
    }

    #[test]
    fn an_unknown_handle_is_inert_rather_than_dangerous() {
        let json = assess_via_abi(i64::MAX, r#"{"payload":"https://example.com/","nowMs":1}"#);
        let assessment: Assessment = serde_json::from_str(&json).expect("assessment");

        assert_eq!(assessment.verdict, Verdict::InsufficientEvidence);
        assert!(!assessment
            .recommended_actions
            .contains(&RecommendedAction::OpenAllowed));
    }

    #[test]
    fn a_destroyed_handle_stops_assessing() {
        let handle = create_engine();
        qravn_safety_engine_destroy(handle);

        let json = assess_via_abi(handle, r#"{"payload":"https://example.com/","nowMs":1}"#);
        let assessment: Assessment = serde_json::from_str(&json).expect("assessment");
        assert_eq!(assessment.verdict, Verdict::InsufficientEvidence);
    }

    #[test]
    fn reports_the_engine_version() {
        let raw = qravn_safety_engine_version();
        assert!(!raw.is_null());
        // SAFETY: `raw` is a live, NUL-terminated pointer this crate produced.
        let version = unsafe { CStr::from_ptr(raw) }.to_str().expect("utf-8");
        assert_eq!(version, ENGINE_VERSION);
        assert!(!version.is_empty());
        // SAFETY: `raw` came from this library and is released once.
        unsafe { qravn_safety_string_free(raw) };
    }

    #[test]
    fn a_null_pointer_never_creates_a_broken_engine() {
        // SAFETY: a null config is explicitly permitted by the header.
        let handle = unsafe { qravn_safety_engine_create(std::ptr::null()) };
        assert_ne!(handle, 0, "a null config must fall back to the default");
        qravn_safety_engine_destroy(handle);
    }

    #[test]
    fn freeing_a_null_string_is_a_no_op() {
        // SAFETY: a null pointer is explicitly permitted by the header.
        unsafe { qravn_safety_string_free(std::ptr::null_mut()) };
    }

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
