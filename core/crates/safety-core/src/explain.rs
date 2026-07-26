use crate::types::{Assessment, CatalogEntry, EngineConfig, Finding, Limitation, Verdict};
use std::collections::BTreeMap;

pub fn apply_explanations(assessment: &mut Assessment, config: &EngineConfig) {
    let locale = assessment.locale.clone();
    for finding in &mut assessment.findings {
        render_finding(finding, config, &locale);
    }
    for limitation in &mut assessment.limitations {
        limitation.text = render_limitation(limitation, config, &locale);
    }
    assessment.summary = render_summary(&assessment.verdict, config, &locale);
}

fn render_finding(finding: &mut Finding, config: &EngineConfig, locale: &str) {
    if let Some(entry) = lookup(config, locale, &finding.code) {
        finding.title = interpolate(&entry.title, &finding.params);
        finding.detail = interpolate(&entry.detail, &finding.params);
    }
    finding.params = finding
        .params
        .iter()
        .map(|(key, value)| (key.clone(), sanitize_param(value)))
        .collect();
}

fn render_limitation(limitation: &Limitation, config: &EngineConfig, locale: &str) -> String {
    lookup(config, locale, &limitation.code)
        .map(|entry| interpolate(&entry.detail, &limitation.params))
        .unwrap_or_default()
}

fn render_summary(verdict: &Verdict, config: &EngineConfig, locale: &str) -> String {
    let key = match verdict {
        Verdict::KnownMalicious => "verdict.known_malicious",
        Verdict::Suspicious => "verdict.suspicious",
        Verdict::InsufficientEvidence => "verdict.insufficient_evidence",
        Verdict::NoKnownThreatFound => "verdict.no_known_threat_found",
    };
    lookup(config, locale, key)
        .map(|entry| interpolate(&entry.title, &BTreeMap::new()))
        .unwrap_or_default()
}

fn lookup<'a>(config: &'a EngineConfig, locale: &str, code: &str) -> Option<&'a CatalogEntry> {
    config
        .catalogs
        .get(locale)
        .and_then(|catalog| catalog.get(code))
        .or_else(|| {
            config
                .catalogs
                .get("en")
                .and_then(|catalog| catalog.get(code))
        })
}

fn interpolate(template: &str, params: &BTreeMap<String, String>) -> String {
    let mut out = String::with_capacity(template.len());
    let mut chars = template.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '{' {
            let mut key = String::new();
            let mut closed = false;
            while let Some(next) = chars.peek().copied() {
                chars.next();
                if next == '}' {
                    closed = true;
                    break;
                }
                if key.len() < 64 {
                    key.push(next);
                }
            }
            if closed {
                out.push_str(&sanitize_param(
                    params.get(&key).map(String::as_str).unwrap_or_default(),
                ));
            } else {
                out.push('{');
                out.push_str(&key);
            }
        } else {
            out.push(ch);
        }
    }
    out
}

fn sanitize_param(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars().take(120) {
        if ch.is_control() || matches!(ch, '<' | '>' | '&' | '"' | '\'') {
            out.push('\u{FFFD}');
        } else {
            out.push(ch);
        }
    }
    if value.chars().count() > 120 {
        out.push('…');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpolation_sanitizes_attacker_params() {
        let params = BTreeMap::from([("host".to_owned(), "<script>\0".to_owned())]);
        assert_eq!(interpolate("Host {host}", &params), "Host �script��");
    }
}
