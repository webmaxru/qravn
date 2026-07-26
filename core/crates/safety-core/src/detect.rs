use crate::rules::{fold_token, RulePackage};
use crate::types::{params, Finding, Limitation, UrlBreakdown};
use crate::unicode_guard;
use crate::url_policy::ParsedUrl;
use std::collections::BTreeMap;

const OPEN_REDIRECT_PARAMS: &[&str] = &[
    "url",
    "next",
    "redirect",
    "return",
    "returnurl",
    "dest",
    "continue",
    "to",
];
const STANDARD_PORTS: &[(&str, u16)] = &[("http", 80), ("https", 443)];

pub fn detect_url(
    parsed: &ParsedUrl,
    raw_payload: &str,
    rules: &RulePackage,
    bidi: bool,
    controls: bool,
) -> (Vec<Finding>, Vec<Limitation>) {
    let url = &parsed.breakdown;
    let mut findings = Vec::new();
    let mut limitations = Vec::new();

    if url.has_credentials {
        findings.push(Finding::new(
            "url.credentials_in_authority",
            params(&[
                ("username", url.username.clone().unwrap_or_default()),
                ("host", url.host.clone()),
            ]),
        ));
    }
    if url.is_ip_literal {
        findings.push(Finding::new(
            "url.ip_literal_host",
            params(&[("host", url.host.clone())]),
        ));
    }
    if let Some(port) = url.port {
        if !STANDARD_PORTS
            .iter()
            .any(|(scheme, expected)| url.scheme == *scheme && port == *expected)
        {
            findings.push(Finding::new(
                "url.non_standard_port",
                params(&[("port", port.to_string())]),
            ));
        }
    }
    if url.has_punycode {
        findings.push(Finding::new(
            "url.punycode_host",
            params(&[
                ("punycodeHost", url.host.clone()),
                ("unicodeHost", url.unicode_host.clone().unwrap_or_default()),
            ]),
        ));
    }
    if url.is_mixed_script {
        findings.push(Finding::new(
            "url.mixed_script_host",
            params(&[
                ("host", display_host(url)),
                ("scripts", url.scripts.join(", ")),
            ]),
        ));
    }
    if is_confusable_host(url, raw_payload, rules) {
        findings.push(Finding::new(
            "url.confusable_host",
            params(&[
                ("host", display_host(url)),
                ("skeleton", unicode_guard::skeleton(&display_host(url))),
            ]),
        ));
    }
    if bidi {
        findings.push(Finding::new("url.bidi_control_characters", BTreeMap::new()));
    }
    if controls {
        findings.push(Finding::new("url.control_characters", BTreeMap::new()));
    }
    if url.subdomains.len() > 4 {
        findings.push(Finding::new(
            "url.excessive_subdomains",
            params(&[("count", url.subdomains.len().to_string())]),
        ));
    }
    detect_brand_impersonation(url, rules, &mut findings);
    detect_query_signals(url, &mut findings);

    if parsed.encoded_host {
        findings.push(Finding::new(
            "url.encoded_characters_in_host",
            BTreeMap::new(),
        ));
    }
    if raw_payload.chars().count() > 512 {
        findings.push(Finding::new(
            "url.excessive_length",
            params(&[("length", raw_payload.chars().count().to_string())]),
        ));
    }
    match url.scheme.as_str() {
        "http" => findings.push(Finding::new("url.insecure_scheme", BTreeMap::new())),
        "https" => {}
        "javascript" => findings.push(Finding::new("url.javascript_scheme", BTreeMap::new())),
        "data" => findings.push(Finding::new("url.data_scheme", BTreeMap::new())),
        "file" => findings.push(Finding::new("url.file_scheme", BTreeMap::new())),
        scheme if !scheme.is_empty() => findings.push(Finding::new(
            "url.unknown_scheme",
            params(&[("scheme", scheme.to_owned())]),
        )),
        _ => {}
    }

    if rules.shortener_hosts.iter().any(|host| host == &url.host) {
        findings.push(Finding::new(
            "url.shortener",
            params(&[("service", url.host.clone())]),
        ));
        limitations.push(Limitation::new(
            "limitation.redirect_not_expanded",
            params(&[("service", url.host.clone())]),
        ));
    }
    if let Some(suffix) = &url.public_suffix {
        if rules.suspicious_tlds.iter().any(|tld| tld == suffix) {
            findings.push(Finding::new(
                "url.suspicious_tld",
                params(&[("tld", suffix.clone())]),
            ));
        }
    }
    if let Some(rule_id) = known_malicious_rule_id(url, raw_payload, rules) {
        findings.push(Finding::new(
            "url.known_malicious",
            params(&[("ruleId", rule_id)]),
        ));
    }
    if url.registrable_domain.is_none() && !url.host.is_empty() {
        findings.push(Finding::new(
            "url.no_registrable_domain",
            params(&[("host", url.host.clone())]),
        ));
        limitations.push(Limitation::new(
            "limitation.no_public_suffix_match",
            params(&[("host", url.host.clone())]),
        ));
    }
    if parsed.parse_failed {
        findings.push(Finding::new("payload.not_a_url", BTreeMap::new()));
        limitations.push(Limitation::new(
            "limitation.payload_not_understood",
            BTreeMap::new(),
        ));
    }
    limitations.push(Limitation::new(
        "limitation.offline_no_reputation",
        BTreeMap::new(),
    ));
    limitations.push(Limitation::new(
        "limitation.classifier_unavailable",
        BTreeMap::new(),
    ));
    (dedup_findings(findings), dedup_limitations(limitations))
}

fn detect_brand_impersonation(
    url: &UrlBreakdown,
    rules: &RulePackage,
    findings: &mut Vec<Finding>,
) {
    let Some(registrable) = &url.registrable_domain else {
        return;
    };
    let domain_label = registrable.split('.').next().unwrap_or_default();
    if let Some(brand) = rules.brand_for_text(&url.subdomains.join(".")) {
        if !rules.is_allowed_brand_domain(brand, registrable) {
            findings.push(Finding::new(
                "url.brand_in_subdomain",
                params(&[
                    ("brand", brand.name.clone()),
                    ("registrableDomain", registrable.clone()),
                ]),
            ));
        }
    }
    if let Some(brand) = rules.brand_for_text(&url.path) {
        if !rules.is_allowed_brand_domain(brand, registrable) {
            findings.push(Finding::new(
                "url.brand_in_path",
                params(&[("brand", brand.name.clone())]),
            ));
        }
    }
    if let Some(brand) = rules.brand_for_text(domain_label) {
        let brand_token = fold_token(&brand.name);
        if domain_label.contains('-')
            && !rules.is_allowed_brand_domain(brand, registrable)
            && fold_token(domain_label).contains(&brand_token)
        {
            findings.push(Finding::new(
                "url.hyphenated_brand_domain",
                params(&[
                    ("brand", brand.name.clone()),
                    ("registrableDomain", registrable.clone()),
                ]),
            ));
        }
    }
}

fn detect_query_signals(url: &UrlBreakdown, findings: &mut Vec<Finding>) {
    detect_path_redirect_style(url, findings);
    let Some(query) = &url.query else {
        return;
    };
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        let key_lower = key.to_ascii_lowercase();
        if OPEN_REDIRECT_PARAMS.iter().any(|name| *name == key_lower) {
            findings.push(Finding::new(
                "url.open_redirect_parameter",
                params(&[("parameter", key.to_owned())]),
            ));
        }
        let decoded = percent_decode_minimal(value);
        if decoded.contains("http://") || decoded.contains("https://") {
            let nested_host = nested_host(&decoded).unwrap_or_default();
            findings.push(Finding::new(
                "url.nested_url_in_query",
                params(&[("nestedHost", nested_host)]),
            ));
        }
    }
}

fn detect_path_redirect_style(url: &UrlBreakdown, findings: &mut Vec<Finding>) {
    let path = &url.path;
    let lower = path.to_ascii_lowercase();
    for name in OPEN_REDIRECT_PARAMS {
        let marker = format!("/{name}=");
        if lower.contains(&marker) {
            findings.push(Finding::new(
                "url.open_redirect_parameter",
                params(&[("parameter", (*name).to_owned())]),
            ));
            if path.contains("http://") || path.contains("https://") {
                findings.push(Finding::new(
                    "url.nested_url_in_query",
                    params(&[("nestedHost", nested_host(path).unwrap_or_default())]),
                ));
            }
        }
    }
}

fn percent_decode_minimal(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let bytes = value.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(a), Some(b)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push(char::from(a * 16 + b));
                i += 3;
                continue;
            }
        }
        out.push(char::from(bytes[i]));
        i += 1;
    }
    out
}

fn hex(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn nested_host(value: &str) -> Option<String> {
    let start = value.find("http://").or_else(|| value.find("https://"))?;
    let rest = &value[start..];
    let authority = rest.split_once("://")?.1.split(['/', '?', '#']).next()?;
    Some(authority.rsplit('@').next().unwrap_or(authority).to_owned())
}

fn known_malicious_rule_id(
    url: &UrlBreakdown,
    raw_payload: &str,
    rules: &RulePackage,
) -> Option<String> {
    let payload = raw_payload.to_ascii_lowercase();
    rules.known_malicious.iter().find_map(|rule| {
        let host_match = rule.host.as_ref().is_some_and(|host| host == &url.host);
        let contains_match = rule
            .contains
            .as_ref()
            .is_some_and(|needle| payload.contains(&needle.to_ascii_lowercase()));
        (host_match || contains_match).then(|| rule.id.clone())
    })
}

fn is_confusable_host(url: &UrlBreakdown, raw_payload: &str, rules: &RulePackage) -> bool {
    let host = display_host(url);
    let raw_host = raw_authority_host(raw_payload).unwrap_or_else(|| host.clone());
    let skeleton = unicode_guard::skeleton(&host);
    let raw_compact: String = raw_host
        .chars()
        .filter(|ch| !unicode_guard::is_control_or_invisible(*ch))
        .collect();
    let raw_skeleton = unicode_guard::skeleton(&raw_compact);
    let brand_match = rules.brands.iter().any(|brand| {
        let brand_skeleton = unicode_guard::skeleton(&fold_token(&brand.name));
        (skeleton.contains(&brand_skeleton) || raw_skeleton.contains(&brand_skeleton))
            && url
                .registrable_domain
                .as_ref()
                .is_none_or(|domain| !rules.is_allowed_brand_domain(brand, domain))
    });
    if brand_match && (url.has_punycode || url.is_mixed_script || raw_host != host) {
        return true;
    }
    raw_host
        .chars()
        .any(|ch| !ch.is_ascii() && !matches!(ch, 'æ' | 'ø' | 'å' | 'Æ' | 'Ø' | 'Å'))
        && raw_skeleton != raw_host.to_lowercase()
}

fn raw_authority_host(raw_payload: &str) -> Option<String> {
    let rest = raw_payload.split_once("://")?.1;
    let authority = rest.split(['/', '?', '#']).next().unwrap_or_default();
    Some(authority.rsplit('@').next().unwrap_or(authority).to_owned())
}

fn display_host(url: &UrlBreakdown) -> String {
    url.unicode_host.clone().unwrap_or_else(|| url.host.clone())
}

fn dedup_findings(mut findings: Vec<Finding>) -> Vec<Finding> {
    let mut seen = std::collections::BTreeSet::new();
    findings.retain(|f| seen.insert((f.code.clone(), format!("{:?}", f.params))));
    findings
}

fn dedup_limitations(mut limitations: Vec<Limitation>) -> Vec<Limitation> {
    let mut seen = std::collections::BTreeSet::new();
    limitations.retain(|l| seen.insert((l.code.clone(), format!("{:?}", l.params))));
    limitations
}
