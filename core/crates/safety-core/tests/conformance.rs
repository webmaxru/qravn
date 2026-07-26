use safety_core::{AssessInput, EngineConfig, RedirectResolution, SafetyEngine};
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

// Fixed clock: 2026-07-12T00:00:00Z. Keeps rule freshness deterministic.
const FIXED_NOW_MS: u64 = 1_784_332_800_000;
const GOLDEN_FILES: &[&str] = &[
    "deceptive-urls.json",
    "identity-attacks.json",
    "structure-schemes-redirect.json",
    "payloads.json",
    "norwegian-benign.json",
    "robustness.json",
    "redirect-chains.json",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GoldenVector {
    id: String,
    payload: String,
    expected_verdict: String,
    #[serde(default)]
    expected_findings: Vec<String>,
    #[serde(default)]
    must_not_contain: Vec<String>,
    notes: Option<String>,
    #[serde(default)]
    redirect_resolution: Option<RedirectResolution>,
}

#[test]
fn shared_golden_corpus_conforms() {
    let vectors = load_vectors();
    assert!(
        vectors.len() >= 118,
        "expected at least 118 shared golden vectors, got {}",
        vectors.len()
    );

    let registry = load_registry();
    let engine = SafetyEngine::new(EngineConfig::default());
    let mut failures = Vec::new();

    for vector in vectors {
        let result = engine.assess(AssessInput {
            payload: vector.payload.clone(),
            now_ms: FIXED_NOW_MS,
            locale: None,
            redirect_resolution: vector.redirect_resolution.clone(),
        });
        let actual_verdict = serde_json::to_value(&result.verdict)
            .ok()
            .and_then(|v| v.as_str().map(str::to_owned))
            .unwrap_or_else(|| "<unserializable>".to_owned());
        let actual_codes = result_codes(&result);
        let produced_finding_codes: BTreeSet<String> =
            result.findings.iter().map(|f| f.code.clone()).collect();
        let expected: BTreeSet<String> = vector.expected_findings.iter().cloned().collect();
        let forbidden: BTreeSet<String> = vector.must_not_contain.iter().cloned().collect();
        let missing: BTreeSet<String> = expected.difference(&actual_codes).cloned().collect();
        let forbidden_present: BTreeSet<String> =
            forbidden.intersection(&actual_codes).cloned().collect();
        let unknown_produced: BTreeSet<String> = actual_codes
            .iter()
            .filter(|code| !registry.contains(*code))
            .cloned()
            .collect();
        let unknown_findings: BTreeSet<String> = produced_finding_codes
            .iter()
            .filter(|code| !registry.contains(*code))
            .cloned()
            .collect();

        if actual_verdict != vector.expected_verdict
            || !missing.is_empty()
            || !forbidden_present.is_empty()
            || !unknown_produced.is_empty()
            || !unknown_findings.is_empty()
        {
            failures.push(format!(
                "id: {id}\npayload: {payload:?}\nnotes: {notes}\nverdict expected={expected_verdict:?} actual={actual_verdict:?}\nexpected codes missing={missing:?}\nforbidden codes present={forbidden_present:?}\nactual codes={actual_codes:?}\nunknown produced codes={unknown_produced:?}\n",
                id = vector.id,
                payload = vector.payload,
                notes = vector.notes.as_deref().unwrap_or(""),
                expected_verdict = vector.expected_verdict,
                actual_verdict = actual_verdict,
                missing = missing,
                forbidden_present = forbidden_present,
                actual_codes = actual_codes,
                unknown_produced = unknown_produced,
            ));
        }
    }

    if !failures.is_empty() {
        panic!(
            "{} shared golden vector(s) failed:\n\n{}",
            failures.len(),
            failures.join("\n---\n")
        );
    }
}

fn load_vectors() -> Vec<GoldenVector> {
    let dir = repo_root().join("test-vectors").join("golden");
    let mut vectors = Vec::new();
    for file in GOLDEN_FILES {
        let path = dir.join(file);
        let text = std::fs::read_to_string(&path)
            .unwrap_or_else(|err| panic!("failed to read {}: {err}", path.display()));
        let mut loaded: Vec<GoldenVector> = serde_json::from_str(&text)
            .unwrap_or_else(|err| panic!("failed to parse {}: {err}", path.display()));
        vectors.append(&mut loaded);
    }
    vectors
}

fn load_registry() -> BTreeSet<String> {
    let path = repo_root()
        .join("contracts")
        .join("v1")
        .join("finding-codes.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("failed to read {}: {err}", path.display()));
    let json: Value = serde_json::from_str(&text)
        .unwrap_or_else(|err| panic!("failed to parse {}: {err}", path.display()));
    let mut codes = BTreeSet::new();
    for section in ["findings", "limitations"] {
        let object = json[section]
            .as_object()
            .unwrap_or_else(|| panic!("registry section {section} is not an object"));
        codes.extend(object.keys().cloned());
    }
    codes
}

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .components()
        .collect()
}

fn result_codes(result: &safety_core::Assessment) -> BTreeSet<String> {
    result
        .findings
        .iter()
        .map(|finding| finding.code.clone())
        .chain(
            result
                .limitations
                .iter()
                .map(|limitation| limitation.code.clone()),
        )
        .collect()
}
