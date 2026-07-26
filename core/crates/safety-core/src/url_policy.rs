use crate::psl;
use crate::types::UrlBreakdown;
use crate::unicode_guard;
use idna::domain_to_unicode;
use url::{Host, Url};

#[derive(Debug, Clone)]
pub struct ParsedUrl {
    pub breakdown: UrlBreakdown,
    pub normalized_input: String,
    pub parse_failed: bool,
    pub encoded_host: bool,
}

pub fn parse_url(raw: &str) -> Option<ParsedUrl> {
    let trimmed = raw.trim();
    let normalized_input = if has_scheme(trimmed) {
        trimmed.to_owned()
    } else if looks_like_url_without_scheme(trimmed) {
        format!("https://{trimmed}")
    } else {
        return None;
    };

    let parsed = Url::parse(&normalized_input);
    match parsed {
        Ok(url) => Some(from_url(url, normalized_input, false)),
        Err(_) => Some(fallback_dangerous(trimmed, normalized_input)),
    }
}

fn from_url(url: Url, normalized_input: String, parse_failed: bool) -> ParsedUrl {
    let scheme = url.scheme().to_ascii_lowercase();
    let username = (!url.username().is_empty()).then(|| url.username().to_owned());
    let has_password = url.password().is_some();
    let has_credentials = username.is_some() || has_password;
    let raw_host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let is_ip_literal = matches!(url.host(), Some(Host::Ipv4(_)) | Some(Host::Ipv6(_)));
    let has_punycode = raw_host.split('.').any(|label| label.starts_with("xn--"));
    let unicode_host = if has_punycode {
        let (decoded, errors) = domain_to_unicode(&raw_host);
        (errors.is_ok() && decoded != raw_host).then_some(decoded)
    } else {
        None
    };
    let display_host = unicode_host.as_deref().unwrap_or(&raw_host);
    let scripts = unicode_guard::scripts_for(display_host);
    let is_mixed_script = scripts.len() > 1;
    let domain = psl::resolve(&raw_host, is_ip_literal);
    let encoded_host = host_looks_encoded(&normalized_input);
    ParsedUrl {
        breakdown: UrlBreakdown {
            scheme,
            username,
            has_password,
            host: raw_host,
            unicode_host,
            port: url.port(),
            path: url.path().to_owned(),
            query: url.query().map(str::to_owned),
            fragment: url.fragment().map(str::to_owned),
            registrable_domain: domain.registrable_domain,
            public_suffix: domain.public_suffix,
            subdomains: domain.subdomains,
            is_ip_literal,
            has_credentials,
            has_punycode,
            is_mixed_script,
            scripts,
        },
        normalized_input,
        parse_failed,
        encoded_host,
    }
}

fn fallback_dangerous(raw: &str, normalized_input: String) -> ParsedUrl {
    let scheme = raw
        .split_once(':')
        .map(|(s, _)| s.to_ascii_lowercase())
        .unwrap_or_default();
    let encoded_host = host_looks_encoded(&normalized_input);
    ParsedUrl {
        breakdown: UrlBreakdown {
            scheme,
            path: raw.to_owned(),
            ..UrlBreakdown::default()
        },
        normalized_input,
        parse_failed: true,
        encoded_host,
    }
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

fn host_looks_encoded(input: &str) -> bool {
    let authority = input
        .split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(input)
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default();
    authority.contains('%') || authority.contains('\\')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authority_host_ignores_username() {
        let parsed = parse_url("https://trusted.no@evil.example/login").expect("url");
        assert_eq!(parsed.breakdown.host, "evil.example");
        assert_eq!(parsed.breakdown.username.as_deref(), Some("trusted.no"));
        assert!(parsed.breakdown.has_credentials);
    }

    #[test]
    fn decodes_punycode_for_display() {
        let parsed = parse_url("https://xn--blbr-roah.no/").expect("url");
        assert!(parsed.breakdown.has_punycode);
        assert_eq!(parsed.breakdown.unicode_host.as_deref(), Some("blåbær.no"));
    }
}
