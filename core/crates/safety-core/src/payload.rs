use crate::rules::RulePackage;
use crate::types::{params, Finding, PayloadKind};

#[derive(Debug, Clone, Default)]
pub struct PayloadAnalysis {
    pub kind: Option<PayloadKind>,
    pub findings: Vec<Finding>,
    pub url_candidate: bool,
}

pub fn classify(raw: &str, rules: &RulePackage) -> PayloadAnalysis {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return PayloadAnalysis {
            kind: Some(PayloadKind::Empty),
            findings: vec![Finding::new("payload.empty", params(&[]))],
            url_candidate: false,
        };
    }
    let upper = trimmed.to_ascii_uppercase();
    let lower = trimmed.to_ascii_lowercase();
    if upper.starts_with("WIFI:") {
        return wifi(trimmed);
    }
    if lower.starts_with("mailto:") {
        let address = trimmed
            .get(7..)
            .unwrap_or_default()
            .split('?')
            .next()
            .unwrap_or_default();
        return info(
            PayloadKind::Email,
            "payload.email_address",
            &[("address", address)],
        );
    }
    if lower.starts_with("tel:") {
        let number = trimmed.get(4..).unwrap_or_default();
        let mut result = info(
            PayloadKind::Phone,
            "payload.phone_number",
            &[("number", number)],
        );
        add_premium(number, rules, &mut result);
        return result;
    }
    if lower.starts_with("sms:") || lower.starts_with("smsto:") {
        let number = trimmed
            .split_once(':')
            .map(|(_, rest)| rest.split(['?', ':']).next().unwrap_or_default())
            .unwrap_or_default();
        let mut result = info(
            PayloadKind::Sms,
            "payload.sms_message",
            &[("number", number)],
        );
        add_premium(number, rules, &mut result);
        return result;
    }
    if lower.starts_with("geo:") {
        let coords = trimmed
            .get(4..)
            .unwrap_or_default()
            .split('?')
            .next()
            .unwrap_or_default();
        let mut parts = coords.split(',');
        return info(
            PayloadKind::Geo,
            "payload.geo_location",
            &[
                ("latitude", parts.next().unwrap_or_default()),
                ("longitude", parts.next().unwrap_or_default()),
            ],
        );
    }
    if upper.starts_with("BEGIN:VCARD") {
        let name = line_value(trimmed, "FN:").unwrap_or_default();
        return info(
            PayloadKind::Contact,
            "payload.contact_card",
            &[("name", &name)],
        );
    }
    if upper.starts_with("BEGIN:VEVENT") {
        let summary = line_value(trimmed, "SUMMARY:").unwrap_or_default();
        return info(
            PayloadKind::Calendar,
            "payload.calendar_event",
            &[("summary", &summary)],
        );
    }
    if lower.starts_with("bitcoin:") || lower.starts_with("ethereum:") {
        let currency = trimmed
            .split_once(':')
            .map(|(scheme, _)| scheme)
            .unwrap_or_default();
        return info(
            PayloadKind::Crypto,
            "payload.crypto_address",
            &[("currency", currency)],
        );
    }
    if lower.starts_with("otpauth://") {
        let issuer = query_param(trimmed, "issuer").unwrap_or_else(|| {
            trimmed
                .split('/')
                .next_back()
                .unwrap_or_default()
                .split(':')
                .next()
                .unwrap_or_default()
                .to_owned()
        });
        return info(
            PayloadKind::Otp,
            "payload.otp_secret",
            &[("issuer", &issuer)],
        );
    }

    if is_bare_email(trimmed) {
        return info(
            PayloadKind::Email,
            "payload.email_address",
            &[("address", trimmed)],
        );
    }
    if (trimmed.contains('\0') || trimmed.chars().filter(|ch| ch.is_control()).count() > 4)
        && !has_scheme(trimmed)
        && !looks_like_url_without_scheme(trimmed)
    {
        return PayloadAnalysis {
            kind: Some(PayloadKind::Binary),
            findings: vec![Finding::new("payload.binary_content", params(&[]))],
            url_candidate: false,
        };
    }

    if has_scheme(trimmed) {
        let scheme = trimmed
            .split_once(':')
            .map(|(s, _)| s)
            .unwrap_or_default()
            .to_ascii_lowercase();
        if matches!(
            scheme.as_str(),
            "http" | "https" | "javascript" | "data" | "file"
        ) {
            return PayloadAnalysis {
                kind: Some(PayloadKind::Url),
                findings: Vec::new(),
                url_candidate: true,
            };
        }
        return PayloadAnalysis {
            kind: Some(PayloadKind::Deeplink),
            findings: vec![Finding::new(
                "payload.app_deep_link",
                params(&[("scheme", scheme)]),
            )],
            url_candidate: true,
        };
    }

    if looks_like_url_without_scheme(trimmed) {
        return PayloadAnalysis {
            kind: Some(PayloadKind::Url),
            findings: Vec::new(),
            url_candidate: true,
        };
    }

    PayloadAnalysis {
        kind: Some(PayloadKind::Text),
        findings: vec![Finding::new("payload.not_a_url", params(&[]))],
        url_candidate: false,
    }
}

fn wifi(trimmed: &str) -> PayloadAnalysis {
    let ssid = wifi_field(trimmed, "S").unwrap_or_default();
    let security = wifi_field(trimmed, "T").unwrap_or_else(|| "nopass".to_owned());
    let hidden = wifi_field(trimmed, "H")
        .map(|v| matches!(v.to_ascii_lowercase().as_str(), "true" | "1" | "yes"))
        .unwrap_or(false);
    let mut findings = vec![Finding::new(
        "payload.wifi_network",
        params(&[("ssid", ssid.clone()), ("security", security.clone())]),
    )];
    if security.eq_ignore_ascii_case("nopass") || security.is_empty() {
        findings.push(Finding::new(
            "payload.wifi_open_network",
            params(&[("ssid", ssid.clone())]),
        ));
    }
    if hidden {
        findings.push(Finding::new(
            "payload.wifi_hidden_network",
            params(&[("ssid", ssid)]),
        ));
    }
    PayloadAnalysis {
        kind: Some(PayloadKind::Wifi),
        findings,
        url_candidate: false,
    }
}

fn add_premium(number: &str, rules: &RulePackage, analysis: &mut PayloadAnalysis) {
    let normalized: String = number.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if rules
        .premium_rate_prefixes
        .iter()
        .any(|prefix| normalized.starts_with(prefix))
    {
        analysis.findings.push(Finding::new(
            "payload.premium_rate_number",
            params(&[("number", number.to_owned())]),
        ));
    }
}

fn info(kind: PayloadKind, code: &str, raw_params: &[(&str, &str)]) -> PayloadAnalysis {
    PayloadAnalysis {
        kind: Some(kind),
        findings: vec![Finding::new(
            code,
            raw_params
                .iter()
                .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
                .collect(),
        )],
        url_candidate: false,
    }
}

fn is_bare_email(value: &str) -> bool {
    if has_scheme(value) {
        return false;
    }
    let Some((local, domain)) = value.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && domain.contains('.')
        && !domain.contains(char::is_whitespace)
        && !local.contains(char::is_whitespace)
}

fn has_scheme(value: &str) -> bool {
    let Some((scheme, _)) = value.split_once(':') else {
        return false;
    };
    let mut chars = scheme.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_alphabetic()
        && chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
}

fn looks_like_url_without_scheme(value: &str) -> bool {
    let first = value.split(['/', '?', '#']).next().unwrap_or_default();
    first.contains('.') && !first.contains(char::is_whitespace)
}

fn wifi_field(value: &str, key: &str) -> Option<String> {
    value
        .trim_start_matches(|ch: char| {
            ch.eq_ignore_ascii_case(&'W') || ch == 'I' || ch == 'F' || ch == ':'
        })
        .split(';')
        .find_map(|segment| {
            let (k, v) = segment.split_once(':')?;
            if k.eq_ignore_ascii_case(key) {
                Some(v.replace("\\;", ";").replace("\\:", ":"))
            } else {
                None
            }
        })
}

fn line_value(value: &str, prefix: &str) -> Option<String> {
    value.lines().find_map(|line| {
        if line.to_ascii_uppercase().starts_with(prefix) {
            line.split_once(':').map(|(_, v)| v.to_owned())
        } else {
            None
        }
    })
}

fn query_param(value: &str, key: &str) -> Option<String> {
    let query = value.split_once('?')?.1;
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        if k.eq_ignore_ascii_case(key) {
            Some(v.to_owned())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_wifi_open_network() {
        let analysis = classify("WIFI:T:nopass;S:FreeWifi;;", &RulePackage::bundled());
        assert_eq!(analysis.kind, Some(PayloadKind::Wifi));
        assert!(analysis
            .findings
            .iter()
            .any(|f| f.code == "payload.wifi_open_network"));
    }

    #[test]
    fn classifies_otp_as_critical_payload() {
        let analysis = classify(
            "otpauth://totp/Example:user?secret=ABC&issuer=Example",
            &RulePackage::bundled(),
        );
        assert_eq!(analysis.kind, Some(PayloadKind::Otp));
        assert_eq!(analysis.findings[0].code, "payload.otp_secret");
    }
}
