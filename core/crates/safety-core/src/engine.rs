use crate::detect;
use crate::explain;
use crate::payload;
use crate::redirect;
use crate::rules::RulePackage;
use crate::types::{AssessInput, Assessment, EngineConfig, Limitation, PayloadKind};
use crate::unicode_guard;
use crate::url_policy;
use crate::verdict;
use crate::ENGINE_VERSION;

#[derive(Debug, Clone)]
pub struct SafetyEngine {
    config: EngineConfig,
    rules: RulePackage,
    startup_limitations: Vec<Limitation>,
}

impl SafetyEngine {
    pub fn new(config: EngineConfig) -> Self {
        let (rules, startup_limitations) = RulePackage::from_config(config.rules.clone());
        Self {
            config,
            rules,
            startup_limitations,
        }
    }

    pub fn assess(&self, input: AssessInput) -> Assessment {
        let unicode = unicode_guard::analyze_payload(&input.payload);
        let mut payload_analysis = payload::classify(&input.payload, &self.rules);
        let mut limitations = self.startup_limitations.clone();
        limitations.extend(self.rules.freshness_limitations(input.now_ms));
        let mut url = None;

        if payload_analysis.url_candidate {
            if let Some(parsed) = url_policy::parse_url(&input.payload) {
                let (url_findings, url_limitations) = detect::detect_url(
                    &parsed,
                    &input.payload,
                    &self.rules,
                    unicode.has_bidi_controls,
                    unicode.has_control_or_invisible,
                );
                payload_analysis.findings.extend(url_findings);
                limitations.extend(url_limitations);
                url = Some(parsed.breakdown);
                payload_analysis.kind = Some(PayloadKind::Url);
            } else {
                limitations.push(Limitation::new(
                    "limitation.payload_not_understood",
                    std::collections::BTreeMap::new(),
                ));
            }
        }

        // Redirect-chain analysis. Runs only when the host supplied a resolution
        // (produced by isolated infrastructure) for a URL payload. Absent, the
        // engine behaves exactly as it does offline.
        let mut redirect = None;
        if let Some(resolution) = input.redirect_resolution.as_ref() {
            if payload_analysis.url_candidate {
                let scanned_domain = url
                    .as_ref()
                    .and_then(|breakdown| breakdown.registrable_domain.clone());
                let scanned_is_shortener = payload_analysis
                    .findings
                    .iter()
                    .any(|finding| finding.code == "url.shortener");
                let output = redirect::analyze(
                    resolution,
                    scanned_domain.as_deref(),
                    scanned_is_shortener,
                    &payload_analysis.findings,
                    &self.rules,
                );
                // The chain WAS expanded online, so the offline "not expanded"
                // limitation emitted for a scanned shortener no longer applies.
                limitations.retain(|l| l.code != "limitation.redirect_not_expanded");
                payload_analysis.findings.extend(output.findings);
                limitations.extend(output.limitations);
                redirect = Some(output.analysis);
            }
        }

        let payload_kind = payload_analysis.kind.unwrap_or(PayloadKind::Text);
        let payload_unknown = matches!(
            payload_kind,
            PayloadKind::Text | PayloadKind::Empty | PayloadKind::Binary
        ) && !payload_analysis.url_candidate;
        let verdict_result = verdict::decide(payload_unknown, &payload_analysis.findings);
        let locale = input
            .locale
            .or_else(|| self.config.locale.clone())
            .unwrap_or_else(|| "en".to_owned());
        let mut assessment = Assessment {
            schema_version: 1,
            payload_kind,
            raw_payload: input.payload,
            display_payload: unicode.display,
            url,
            redirect,
            findings: payload_analysis.findings,
            limitations: dedup_limitations(limitations),
            verdict: verdict_result.verdict,
            confidence: verdict_result.confidence,
            classifier_score: None,
            recommended_actions: verdict_result.actions,
            summary: String::new(),
            engine_version: ENGINE_VERSION.to_owned(),
            rules_version: self.rules.version.clone(),
            locale,
            evaluated_at_ms: input.now_ms,
        };
        explain::apply_explanations(&mut assessment, &self.config);
        assessment
    }

    pub fn version(&self) -> String {
        ENGINE_VERSION.to_owned()
    }
}

fn dedup_limitations(mut limitations: Vec<Limitation>) -> Vec<Limitation> {
    let mut seen = std::collections::BTreeSet::new();
    limitations.retain(|l| seen.insert((l.code.clone(), format!("{:?}", l.params))));
    limitations
}
