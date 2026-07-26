#![forbid(unsafe_code)]

use safety_core::{
    AssessInput, Assessment, EngineConfig, Limitation, PayloadKind, RecommendedAction,
    SafetyEngine as CoreSafetyEngine, Verdict, ENGINE_VERSION,
};
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SafetyEngine {
    inner: CoreSafetyEngine,
}

#[wasm_bindgen]
impl SafetyEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(config_json: &str) -> Result<SafetyEngine, JsValue> {
        #[cfg(debug_assertions)]
        console_error_panic_hook::set_once();

        let config: EngineConfig = serde_json::from_str(config_json)
            .map_err(|err| JsValue::from_str(&format!("invalid EngineConfig JSON: {err}")))?;
        Ok(Self {
            inner: CoreSafetyEngine::new(config),
        })
    }

    pub fn assess(&self, input_json: &str) -> String {
        let input = serde_json::from_str::<AssessInput>(input_json);
        let assessment = match input {
            Ok(input) => self.inner.assess(input),
            Err(_) => malformed_input_assessment(input_json),
        };
        serde_json::to_string(&assessment).unwrap_or_else(|_| "{}".to_owned())
    }

    pub fn version(&self) -> String {
        self.inner.version()
    }
}

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
    fn malformed_input_json_returns_cautious_assessment() {
        let engine = SafetyEngine::new("{}").expect("valid config");
        let output = engine.assess("{not json");
        let assessment: Assessment = serde_json::from_str(&output).expect("assessment JSON");

        assert!(assessment
            .limitations
            .iter()
            .any(|limitation| limitation.code == "limitation.payload_not_understood"));
        assert_ne!(assessment.verdict, Verdict::NoKnownThreatFound);
        assert!(!assessment
            .recommended_actions
            .contains(&RecommendedAction::OpenAllowed));
        assert!(!assessment
            .recommended_actions
            .contains(&RecommendedAction::OpenWithConfirmation));
    }
}
