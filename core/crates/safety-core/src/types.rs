use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    KnownMalicious,
    Suspicious,
    InsufficientEvidence,
    NoKnownThreatFound,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PayloadKind {
    Url,
    Text,
    Wifi,
    Email,
    Phone,
    Sms,
    Geo,
    Contact,
    Calendar,
    Crypto,
    Otp,
    Deeplink,
    Empty,
    Binary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecommendedAction {
    OpenAllowed,
    OpenWithConfirmation,
    OpenBlocked,
    Copy,
    ExpandRedirectOnline,
    ScanAgain,
    Report,
}

/// Which URL a finding describes. Absent is equivalent to `Scanned`. Findings
/// about a resolved redirect destination carry `Final`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FindingSubject {
    Scanned,
    Final,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub code: String,
    pub severity: Severity,
    pub params: BTreeMap<String, String>,
    pub title: String,
    pub detail: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<FindingSubject>,
}

impl Finding {
    pub fn new(code: &str, params: BTreeMap<String, String>) -> Self {
        Self {
            code: code.to_owned(),
            severity: severity_for_code(code),
            params,
            title: String::new(),
            detail: String::new(),
            subject: None,
        }
    }

    pub fn with_subject(mut self, subject: FindingSubject) -> Self {
        self.subject = Some(subject);
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Limitation {
    pub code: String,
    pub params: BTreeMap<String, String>,
    pub text: String,
}

impl Limitation {
    pub fn new(code: &str, params: BTreeMap<String, String>) -> Self {
        Self {
            code: code.to_owned(),
            params,
            text: String::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UrlBreakdown {
    pub scheme: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    pub has_password: bool,
    pub host: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unicode_host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registrable_domain: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_suffix: Option<String>,
    pub subdomains: Vec<String>,
    pub is_ip_literal: bool,
    pub has_credentials: bool,
    pub has_punycode: bool,
    pub is_mixed_script: bool,
    pub scripts: Vec<String>,
}

/// How a hop handed control to the next URL. Deserialized from hostile resolver
/// output, so any value other than the two known mechanisms folds into
/// `Unknown` instead of failing the whole assessment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RedirectMechanism {
    HttpStatus,
    HtmlMetaRefresh,
    #[serde(other)]
    Unknown,
}

/// One observed hop of a redirect chain. Every field is attacker-controlled and
/// must be validated before use; `url` may be empty, unparseable, or enormous.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedirectHop {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub status: Option<i64>,
    #[serde(default)]
    pub via: Option<RedirectMechanism>,
}

/// Why a resolution stopped. Anything other than `Resolved` is partial.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RedirectOutcome {
    Resolved,
    MaxHops,
    Timeout,
    NetworkError,
    Blocked,
    Loop,
}

/// Result of expanding a redirecting URL on isolated server infrastructure,
/// passed IN to the core. The core never performs this fetch and treats every
/// field here as hostile.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedirectResolution {
    #[serde(default)]
    pub chain: Vec<RedirectHop>,
    #[serde(default)]
    pub final_url: Option<String>,
    pub outcome: RedirectOutcome,
    #[serde(default)]
    pub elapsed_ms: Option<i64>,
    #[serde(default)]
    pub resolver: Option<String>,
}

/// Core's analysis of a supplied redirect chain. Present only when one was given.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedirectAnalysis {
    pub hop_count: usize,
    pub outcome: RedirectOutcome,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub final_url: Option<UrlBreakdown>,
    pub domains_traversed: Vec<String>,
    pub crossed_registrable_domain: bool,
    pub downgraded_to_http: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Assessment {
    pub schema_version: u32,
    pub payload_kind: PayloadKind,
    pub raw_payload: String,
    pub display_payload: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<UrlBreakdown>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub redirect: Option<RedirectAnalysis>,
    pub findings: Vec<Finding>,
    pub limitations: Vec<Limitation>,
    pub verdict: Verdict,
    pub confidence: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub classifier_score: Option<f32>,
    pub recommended_actions: Vec<RecommendedAction>,
    pub summary: String,
    pub engine_version: String,
    pub rules_version: String,
    pub locale: String,
    pub evaluated_at_ms: u64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineConfig {
    #[serde(default)]
    pub rules: Option<serde_json::Value>,
    #[serde(default)]
    pub catalogs: BTreeMap<String, BTreeMap<String, CatalogEntry>>,
    #[serde(default)]
    pub locale: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub title: String,
    pub detail: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessInput {
    pub payload: String,
    pub now_ms: u64,
    #[serde(default)]
    pub locale: Option<String>,
    #[serde(default)]
    pub redirect_resolution: Option<RedirectResolution>,
}

pub fn severity_for_code(code: &str) -> Severity {
    match code {
        "url.credentials_in_authority"
        | "url.mixed_script_host"
        | "url.confusable_host"
        | "url.bidi_control_characters"
        | "url.control_characters"
        | "url.brand_in_subdomain"
        | "url.hyphenated_brand_domain"
        | "url.file_scheme"
        | "redirect.downgrade_to_http"
        | "payload.premium_rate_number"
        | "payload.crypto_address" => Severity::High,
        "url.known_malicious"
        | "url.javascript_scheme"
        | "url.data_scheme"
        | "payload.otp_secret" => Severity::Critical,
        "url.ip_literal_host"
        | "url.punycode_host"
        | "url.brand_in_path"
        | "url.nested_url_in_query"
        | "url.open_redirect_parameter"
        | "url.encoded_characters_in_host"
        | "url.insecure_scheme"
        | "url.unknown_scheme"
        | "url.shortener"
        | "url.no_registrable_domain"
        | "redirect.cross_domain"
        | "redirect.excessive_hops"
        | "redirect.chained_shorteners"
        | "payload.binary_content"
        | "payload.wifi_open_network"
        | "payload.sms_message"
        | "payload.app_deep_link" => Severity::Medium,
        "url.non_standard_port"
        | "url.possible_shortener"
        | "url.excessive_subdomains"
        | "url.suspicious_tld"
        | "redirect.multiple_hops"
        | "redirect.loop"
        | "redirect.meta_refresh"
        | "payload.wifi_hidden_network" => Severity::Low,
        _ => Severity::Info,
    }
}

pub fn params(items: &[(&str, String)]) -> BTreeMap<String, String> {
    items
        .iter()
        .map(|(k, v)| ((*k).to_owned(), v.clone()))
        .collect()
}
