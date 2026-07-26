use safety_core::{AssessInput, EngineConfig, SafetyEngine};
use serde_json::Value;
use std::collections::BTreeSet;

const NOW_MS: u64 = 1_784_332_800_000; // 2026-07-12T00:00:00Z

fn assess(payload: &str) -> safety_core::Assessment {
    SafetyEngine::new(EngineConfig::default()).assess(AssessInput {
        payload: payload.to_owned(),
        now_ms: NOW_MS,
        locale: None,
        redirect_resolution: None,
    })
}

fn codes(result: &safety_core::Assessment) -> BTreeSet<String> {
    result.findings.iter().map(|f| f.code.clone()).collect()
}

#[test]
fn golden_payload_table_has_expected_verdicts_and_findings() {
    let cases: Vec<(&str, &str, &[&str])> = vec![
        (
            "https://trusted.no@evil.example/login",
            "suspicious",
            &["url.credentials_in_authority"],
        ),
        (
            "https://xn--pypal-4ve.com/",
            "suspicious",
            &[
                "url.punycode_host",
                "url.mixed_script_host",
                "url.confusable_host",
            ],
        ),
        (
            "http://192.168.1.1:8080/admin",
            "suspicious",
            &[
                "url.ip_literal_host",
                "url.non_standard_port",
                "url.insecure_scheme",
                "url.no_registrable_domain",
            ],
        ),
        (
            "javascript:alert(1)",
            "known_malicious",
            &["url.javascript_scheme"],
        ),
        (
            "data:text/html;base64,PGgxPkhlbGxvPC9oMT4=",
            "known_malicious",
            &["url.data_scheme"],
        ),
        (
            "https://bit.ly/abc",
            "insufficient_evidence",
            &["url.shortener"],
        ),
        (
            "https://dnb.no.secure-login.example/",
            "suspicious",
            &["url.brand_in_subdomain"],
        ),
        (
            "https://dnb-sikker.example/",
            "suspicious",
            &["url.hyphenated_brand_domain"],
        ),
        (
            "WIFI:T:nopass;S:FreeWifi;;",
            "suspicious",
            &["payload.wifi_network", "payload.wifi_open_network"],
        ),
        (
            "otpauth://totp/Example:user?secret=ABC",
            "known_malicious",
            &["payload.otp_secret"],
        ),
        (
            "https://blåbær.no/",
            "no_known_threat_found",
            &["url.punycode_host"],
        ),
        (
            "https://example.com/?url=https://evil.example",
            "suspicious",
            &["url.open_redirect_parameter", "url.nested_url_in_query"],
        ),
        ("https://example.com/", "no_known_threat_found", &[]),
        (
            "http://example.com/",
            "suspicious",
            &["url.insecure_scheme"],
        ),
        (
            "https://a.b.c.d.e.example.com/",
            "suspicious",
            &["url.excessive_subdomains"],
        ),
        (
            "https://example.zip/",
            "suspicious",
            &["url.suspicious_tld"],
        ),
        (
            "https://malicious.example/",
            "known_malicious",
            &["url.known_malicious"],
        ),
        (
            "https://example.com/DNB/login",
            "suspicious",
            &["url.brand_in_path"],
        ),
        (
            "https://evil.example/?next=/home",
            "suspicious",
            &["url.open_redirect_parameter"],
        ),
        (
            "https://evil.example/?next=https%3A%2F%2Fbad.example",
            "suspicious",
            &["url.open_redirect_parameter", "url.nested_url_in_query"],
        ),
        (
            "https://%65xample.com/",
            "suspicious",
            &["url.encoded_characters_in_host"],
        ),
        (
            "https://раypal.com/",
            "suspicious",
            &[
                "url.punycode_host",
                "url.mixed_script_host",
                "url.confusable_host",
            ],
        ),
        (
            "https://example.unknownsuffix/",
            "no_known_threat_found",
            &[],
        ),
        (
            "http://192.168.1.1/",
            "suspicious",
            &[
                "url.ip_literal_host",
                "url.insecure_scheme",
                "url.no_registrable_domain",
            ],
        ),
        (
            "tel:82012345",
            "suspicious",
            &["payload.phone_number", "payload.premium_rate_number"],
        ),
        (
            "smsto:82012345:Hi",
            "suspicious",
            &["payload.sms_message", "payload.premium_rate_number"],
        ),
        (
            "mailto:user@example.com",
            "insufficient_evidence",
            &["payload.email_address"],
        ),
        (
            "geo:59.9139,10.7522",
            "insufficient_evidence",
            &["payload.geo_location"],
        ),
        (
            "bitcoin:bc1qexample",
            "suspicious",
            &["payload.crypto_address"],
        ),
        (
            "file:///C:/Windows/win.ini",
            "suspicious",
            &["url.file_scheme"],
        ),
        (
            "ftp://example.com/file",
            "suspicious",
            &["payload.app_deep_link", "url.unknown_scheme"],
        ),
        (
            "hello world",
            "insufficient_evidence",
            &["payload.not_a_url"],
        ),
        ("", "insufficient_evidence", &["payload.empty"]),
        (
            "abc\0def",
            "insufficient_evidence",
            &["payload.binary_content"],
        ),
        (
            "https://example.com/\u{202E}gnp.exe",
            "suspicious",
            &["url.bidi_control_characters"],
        ),
        (
            "https://example.com/\u{200B}",
            "suspicious",
            &["url.control_characters"],
        ),
        (
            "https://example.com:444/",
            "suspicious",
            &["url.non_standard_port"],
        ),
        (
            "https://user:pass@example.com/",
            "suspicious",
            &["url.credentials_in_authority"],
        ),
        (
            "http://bit.ly/abc",
            "suspicious",
            &["url.insecure_scheme", "url.shortener"],
        ),
        (
            "BEGIN:VCARD\nFN:Ola Nordmann\nEND:VCARD",
            "insufficient_evidence",
            &["payload.contact_card"],
        ),
        (
            "BEGIN:VEVENT\nSUMMARY:Meeting\nEND:VEVENT",
            "insufficient_evidence",
            &["payload.calendar_event"],
        ),
    ];

    assert!(cases.len() >= 40);
    for (payload, expected_verdict, expected_codes) in cases {
        let result = assess(payload);
        let verdict = serde_json::to_value(&result.verdict).expect("verdict JSON");
        assert_eq!(
            verdict,
            Value::String(expected_verdict.to_owned()),
            "payload {payload}"
        );
        let expected: BTreeSet<String> = expected_codes
            .iter()
            .map(|code| (*code).to_owned())
            .collect();
        assert_eq!(codes(&result), expected, "payload {payload}");
    }
}

#[test]
fn authority_host_is_not_userinfo() {
    let result = assess("https://trusted.no@evil.example/login");
    let url = result.url.expect("url breakdown");
    assert_eq!(url.host, "evil.example");
    assert_eq!(url.username.as_deref(), Some("trusted.no"));
    assert!(url.has_credentials);
}

#[test]
fn emitted_codes_exist_in_frozen_registry() {
    let registry_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .join("contracts")
        .join("v1")
        .join("finding-codes.json");
    let registry_text = std::fs::read_to_string(registry_path).expect("registry");
    let registry: Value = serde_json::from_str(&registry_text).expect("registry JSON");
    let findings = registry["findings"].as_object().expect("findings map");
    let limitations = registry["limitations"]
        .as_object()
        .expect("limitations map");

    let samples = [
        "https://trusted.no@evil.example/login",
        "https://xn--pypal-4ve.com/",
        "http://192.168.1.1:8080/admin",
        "javascript:alert(1)",
        "data:text/html;base64,AA==",
        "https://bit.ly/abc",
        "https://dnb.no.secure-login.example/",
        "https://dnb-sikker.example/",
        "WIFI:T:nopass;S:FreeWifi;H:true;;",
        "mailto:user@example.com",
        "tel:82012345",
        "smsto:82012345:Hi",
        "geo:59,10",
        "BEGIN:VCARD\nFN:Ola\nEND:VCARD",
        "BEGIN:VEVENT\nSUMMARY:Møte\nEND:VEVENT",
        "bitcoin:abc",
        "otpauth://totp/Example:user?secret=ABC",
        "vipps://pay",
        "abc\0def",
        "https://example.unknownsuffix/",
    ];
    for sample in samples {
        let result = assess(sample);
        for finding in result.findings {
            assert!(
                findings.contains_key(&finding.code),
                "missing finding code {}",
                finding.code
            );
        }
        for limitation in result.limitations {
            assert!(
                limitations.contains_key(&limitation.code),
                "missing limitation code {}",
                limitation.code
            );
        }
    }
}

#[test]
fn adversarial_strings_never_panic() {
    let engine = SafetyEngine::new(EngineConfig::default());
    let mut seed = 0xC0FFEE_u64;
    for len in 0..256usize {
        let mut bytes = Vec::with_capacity(len);
        for _ in 0..len {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            bytes.push((seed >> 32) as u8);
        }
        let payload = String::from_utf8_lossy(&bytes).into_owned();
        let result = std::panic::catch_unwind(|| {
            engine.assess(AssessInput {
                payload,
                now_ms: NOW_MS,
                locale: None,
                redirect_resolution: None,
            })
        });
        assert!(result.is_ok());
    }

    let hostile = [
        "https://example.com/".repeat(200),
        "http://a@b@c@d.example/".to_owned(),
        "https://example.com/?url=".repeat(100),
        "\u{202E}\u{2066}\u{200B}\0".repeat(100),
    ];
    for payload in hostile {
        let result = std::panic::catch_unwind(|| {
            engine.assess(AssessInput {
                payload,
                now_ms: NOW_MS,
                locale: None,
                redirect_resolution: None,
            })
        });
        assert!(result.is_ok());
    }
}
