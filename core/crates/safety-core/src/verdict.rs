use crate::types::{Finding, RecommendedAction, Severity, Verdict};

#[derive(Debug, Clone)]
pub struct VerdictResult {
    pub verdict: Verdict,
    pub confidence: f32,
    pub actions: Vec<RecommendedAction>,
}

pub fn decide(payload_unknown: bool, findings: &[Finding]) -> VerdictResult {
    let has_known_malicious = findings.iter().any(|f| f.code == "url.known_malicious");
    let has_critical = findings.iter().any(|f| f.severity == Severity::Critical);
    let high_count = findings
        .iter()
        .filter(|f| f.severity == Severity::High)
        .count();
    let medium_count = findings
        .iter()
        .filter(|f| f.severity == Severity::Medium)
        .count();
    let verdict = if has_known_malicious || has_critical {
        Verdict::KnownMalicious
    } else if findings.iter().any(|f| is_suspicious_code(&f.code))
        || high_count > 0
        || medium_count >= 2
    {
        Verdict::Suspicious
    } else if payload_unknown || findings.iter().any(|f| is_insufficient_code(&f.code)) {
        Verdict::InsufficientEvidence
    } else {
        Verdict::NoKnownThreatFound
    };
    let confidence = match verdict {
        Verdict::KnownMalicious => 0.95,
        Verdict::Suspicious => 0.82,
        Verdict::InsufficientEvidence => 0.45,
        Verdict::NoKnownThreatFound => 0.72,
    };
    let actions = recommended_actions(&verdict, findings);
    VerdictResult {
        verdict,
        confidence,
        actions,
    }
}

fn is_suspicious_code(code: &str) -> bool {
    matches!(
        code,
        "url.credentials_in_authority"
            | "url.ip_literal_host"
            | "url.non_standard_port"
            | "url.mixed_script_host"
            | "url.confusable_host"
            | "url.bidi_control_characters"
            | "url.control_characters"
            | "url.excessive_subdomains"
            | "url.brand_in_subdomain"
            | "url.brand_in_path"
            | "url.hyphenated_brand_domain"
            | "url.nested_url_in_query"
            | "url.open_redirect_parameter"
            | "url.encoded_characters_in_host"
            | "url.excessive_length"
            | "url.insecure_scheme"
            | "url.file_scheme"
            | "url.unknown_scheme"
            | "url.suspicious_tld"
            | "url.no_registrable_domain"
            | "payload.wifi_open_network"
            | "payload.wifi_hidden_network"
            | "payload.sms_message"
            | "payload.premium_rate_number"
            | "payload.crypto_address"
            | "payload.app_deep_link"
    )
}

fn is_insufficient_code(code: &str) -> bool {
    matches!(
        code,
        "url.shortener"
            | "payload.not_a_url"
            | "payload.empty"
            | "payload.binary_content"
            | "payload.wifi_network"
            | "payload.email_address"
            | "payload.phone_number"
            | "payload.geo_location"
            | "payload.contact_card"
            | "payload.calendar_event"
    )
}

fn recommended_actions(verdict: &Verdict, findings: &[Finding]) -> Vec<RecommendedAction> {
    let mut actions = Vec::new();
    match verdict {
        Verdict::KnownMalicious => actions.push(RecommendedAction::OpenBlocked),
        Verdict::Suspicious => actions.push(RecommendedAction::OpenWithConfirmation),
        Verdict::InsufficientEvidence | Verdict::NoKnownThreatFound => {
            actions.push(RecommendedAction::OpenAllowed);
        }
    }
    if findings.iter().any(|f| f.code == "url.shortener") {
        actions.push(RecommendedAction::ExpandRedirectOnline);
    }
    actions.push(RecommendedAction::Copy);
    actions.push(RecommendedAction::ScanAgain);
    if matches!(verdict, Verdict::KnownMalicious | Verdict::Suspicious) {
        actions.push(RecommendedAction::Report);
    }
    actions
}
