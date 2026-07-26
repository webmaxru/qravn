use crate::psl_data;
use crate::types::Limitation;
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomainParts {
    pub registrable_domain: Option<String>,
    pub public_suffix: Option<String>,
    pub subdomains: Vec<String>,
    pub limitation: Option<Limitation>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RuleMatch<'a> {
    rule: &'a str,
    suffix_labels: usize,
}

pub fn resolve(host: &str, is_ip_literal: bool) -> DomainParts {
    let host = host.trim_end_matches('.').to_lowercase();
    let labels: Vec<&str> = host.split('.').filter(|part| !part.is_empty()).collect();
    if host.is_empty() || is_ip_literal || labels.len() < 2 {
        return no_match(&host);
    }

    let suffix_labels = public_suffix_label_count(&host, &labels);
    if labels.len() <= suffix_labels {
        return no_match(&host);
    }

    let suffix_start = labels.len().saturating_sub(suffix_labels);
    let registrable_start = suffix_start.saturating_sub(1);
    DomainParts {
        registrable_domain: Some(labels[registrable_start..].join(".")),
        public_suffix: Some(labels[suffix_start..].join(".")),
        subdomains: labels[..registrable_start]
            .iter()
            .map(|s| (*s).to_owned())
            .collect(),
        limitation: None,
    }
}

fn public_suffix_label_count(host: &str, labels: &[&str]) -> usize {
    if let Some(exception) = best_exception(host) {
        return exception.suffix_labels.saturating_sub(1).max(1);
    }

    let exact = best_exact(host);
    let wildcard = best_wildcard(labels);
    match (exact, wildcard) {
        (Some(exact), Some(wildcard)) => {
            if wildcard.suffix_labels >= exact.suffix_labels {
                wildcard.suffix_labels
            } else {
                exact.suffix_labels
            }
        }
        (Some(exact), None) => exact.suffix_labels,
        (None, Some(wildcard)) => wildcard.suffix_labels,
        (None, None) => 1,
    }
}

fn best_exception(host: &str) -> Option<RuleMatch<'static>> {
    best_matching_rule(host, psl_data::EXCEPTION_RULES)
}

fn best_exact(host: &str) -> Option<RuleMatch<'static>> {
    best_matching_rule(host, psl_data::EXACT_RULES)
}

fn best_matching_rule(host: &str, rules: &'static [&'static str]) -> Option<RuleMatch<'static>> {
    rules
        .iter()
        .filter(|rule| host == **rule || host.ends_with(&format!(".{rule}")))
        .map(|rule| RuleMatch {
            rule,
            suffix_labels: label_count(rule),
        })
        .max_by(|a, b| {
            a.suffix_labels
                .cmp(&b.suffix_labels)
                .then_with(|| a.rule.len().cmp(&b.rule.len()))
        })
}

fn best_wildcard(labels: &[&str]) -> Option<RuleMatch<'static>> {
    psl_data::WILDCARD_RULES
        .iter()
        .filter_map(|rule| {
            let rule_labels = label_count(rule);
            if labels.len() > rule_labels && labels[labels.len() - rule_labels..].join(".") == *rule
            {
                Some(RuleMatch {
                    rule,
                    suffix_labels: rule_labels + 1,
                })
            } else {
                None
            }
        })
        .max_by(|a, b| {
            a.suffix_labels
                .cmp(&b.suffix_labels)
                .then_with(|| a.rule.len().cmp(&b.rule.len()))
        })
}

fn label_count(rule: &str) -> usize {
    rule.split('.').filter(|label| !label.is_empty()).count()
}

fn no_match(host: &str) -> DomainParts {
    DomainParts {
        registrable_domain: None,
        public_suffix: None,
        subdomains: Vec::new(),
        limitation: Some(Limitation::new(
            "limitation.no_public_suffix_match",
            BTreeMap::from([("host".to_owned(), host.to_owned())]),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_norwegian_multi_label_suffix() {
        let parts = resolve("a.priv.no", false);
        assert_eq!(parts.public_suffix.as_deref(), Some("priv.no"));
        assert_eq!(parts.registrable_domain.as_deref(), Some("a.priv.no"));
        assert!(parts.limitation.is_none());
    }

    #[test]
    fn resolves_plain_no_domain() {
        let parts = resolve("example.no", false);
        assert_eq!(parts.public_suffix.as_deref(), Some("no"));
        assert_eq!(parts.registrable_domain.as_deref(), Some("example.no"));
        assert!(parts.limitation.is_none());
    }

    #[test]
    fn resolves_compact_suffixes() {
        let parts = resolve("www.example.co.uk", false);
        assert_eq!(parts.public_suffix.as_deref(), Some("co.uk"));
        assert_eq!(parts.registrable_domain.as_deref(), Some("example.co.uk"));
        assert_eq!(parts.subdomains, vec!["www"]);
    }

    #[test]
    fn default_rule_resolves_unlisted_single_label_tld_without_limitation() {
        let parts = resolve("shop.example.nl", false);
        assert_eq!(parts.public_suffix.as_deref(), Some("nl"));
        assert_eq!(parts.registrable_domain.as_deref(), Some("example.nl"));
        assert_eq!(parts.subdomains, vec!["shop"]);
        assert!(parts.limitation.is_none());
    }

    #[test]
    fn single_label_host_is_limited() {
        let parts = resolve("localhost", false);
        assert!(parts.registrable_domain.is_none());
        assert_eq!(
            parts.limitation.as_ref().map(|l| l.code.as_str()),
            Some("limitation.no_public_suffix_match")
        );
    }
}
