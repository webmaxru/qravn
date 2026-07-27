//! Integration tests for redirect-chain analysis in the safety core.
//!
//! Golden vectors for this behaviour are added separately (the shared corpus is
//! checked in both directions), so all coverage lives here as Rust tests.

use safety_core::{
    AssessInput, Assessment, EngineConfig, FindingSubject, RedirectHop, RedirectMechanism,
    RedirectOutcome, RedirectResolution, SafetyEngine, Verdict, MAX_REDIRECT_HOPS,
};
use std::collections::BTreeSet;

const NOW_MS: u64 = 1_784_332_800_000; // 2026-07-12T00:00:00Z

fn engine() -> SafetyEngine {
    SafetyEngine::new(EngineConfig::default())
}

fn hop(url: &str) -> RedirectHop {
    RedirectHop {
        url: url.to_owned(),
        status: Some(301),
        via: Some(RedirectMechanism::HttpStatus),
    }
}

fn hop_via(url: &str, via: RedirectMechanism) -> RedirectHop {
    RedirectHop {
        url: url.to_owned(),
        status: Some(200),
        via: Some(via),
    }
}

fn resolution(
    chain: Vec<RedirectHop>,
    outcome: RedirectOutcome,
    final_url: Option<&str>,
) -> RedirectResolution {
    RedirectResolution {
        chain,
        final_url: final_url.map(str::to_owned),
        outcome,
        elapsed_ms: Some(12),
        resolver: Some("test-resolver/1".to_owned()),
    }
}

fn assess_with(payload: &str, resolution: RedirectResolution) -> Assessment {
    engine().assess(AssessInput {
        payload: payload.to_owned(),
        now_ms: NOW_MS,
        locale: None,
        redirect_resolution: Some(resolution),
    })
}

fn assess_plain(payload: &str) -> Assessment {
    engine().assess(AssessInput {
        payload: payload.to_owned(),
        now_ms: NOW_MS,
        locale: None,
        redirect_resolution: None,
    })
}

fn codes(a: &Assessment) -> BTreeSet<String> {
    a.findings.iter().map(|f| f.code.clone()).collect()
}

fn has_finding(a: &Assessment, code: &str) -> bool {
    a.findings.iter().any(|f| f.code == code)
}

fn has_limitation(a: &Assessment, code: &str) -> bool {
    a.limitations.iter().any(|l| l.code == code)
}

/// Build a resolved linear chain across the given hosts (each an https URL).
/// Host 0 is the scanned URL. hopCount == hosts.len() - 1.
fn resolved_chain(hosts: &[&str]) -> RedirectResolution {
    let chain: Vec<RedirectHop> = hosts
        .iter()
        .map(|h| hop(&format!("https://{h}/")))
        .collect();
    let final_url = format!("https://{}/", hosts.last().copied().unwrap_or_default());
    resolution(chain, RedirectOutcome::Resolved, Some(&final_url))
}

// ---------------------------------------------------------------------------
// Baseline: absent resolution is byte-identical to offline behaviour.
// ---------------------------------------------------------------------------

#[test]
fn absent_resolution_leaves_no_redirect_analysis() {
    let a = assess_plain("https://example.com/");
    assert!(a.redirect.is_none());
    assert!(!has_finding(&a, "redirect.multiple_hops"));
}

#[test]
fn offline_shortener_still_reports_not_expanded() {
    // Regression guard for the suppression logic: without a resolution the
    // offline limitation must still fire exactly as before.
    let a = assess_plain("https://bit.ly/abc");
    assert!(has_finding(&a, "url.shortener"));
    assert!(has_limitation(&a, "limitation.redirect_not_expanded"));
    assert!(a.redirect.is_none());
}

#[test]
fn offline_possible_shortener_reports_not_expanded_and_can_be_expanded() {
    let a = assess_plain("https://q7.no/A1b2C3/");
    assert_eq!(a.verdict, Verdict::InsufficientEvidence);
    assert!(has_finding(&a, "url.possible_shortener"));
    assert!(!has_finding(&a, "url.shortener"));
    assert!(has_limitation(&a, "limitation.redirect_not_expanded"));
    assert!(a
        .limitations
        .iter()
        .any(|l| l.code == "limitation.redirect_not_expanded"
            && l.params
                .get("service")
                .is_some_and(|service| service == "q7.no")));
    assert!(a
        .recommended_actions
        .iter()
        .any(|action| matches!(action, safety_core::RecommendedAction::ExpandRedirectOnline)));
}

#[test]
fn possible_shortener_heuristic_rejects_near_misses() {
    let cases = [
        ("known shortener", "https://bit.ly/A1b2C3"),
        ("brand domain", "https://dnb.no/A1b2C3"),
        ("bare domain", "https://q7.no/"),
        ("subdomain", "https://www.q7.no/A1b2C3"),
        ("long path", "https://q7.no/this-is-a-normal-long-path-123"),
        ("multi segment", "https://q7.no/A1b2/C3d4"),
        ("path without digit", "https://q7.no/AbCdEf"),
        ("path with dot", "https://q7.no/A1b2.c3"),
        ("query", "https://q7.no/A1b2C3?utm=1"),
        ("fragment", "https://q7.no/A1b2C3#target"),
        ("hyphenated domain stem", "https://q-7.no/A1b2C3"),
        ("long domain stem", "https://abcdef.no/A1b2C3"),
        ("multi-label registrable domain", "https://q7.co.uk/A1b2C3"),
        ("words separated by slashes", "https://q7.no/login/side1"),
    ];

    for (name, payload) in cases {
        let a = assess_plain(payload);
        assert!(
            !has_finding(&a, "url.possible_shortener"),
            "{name} unexpectedly matched possible shortener"
        );
        if !has_finding(&a, "url.shortener") {
            assert!(
                !has_limitation(&a, "limitation.redirect_not_expanded"),
                "{name} unexpectedly emitted redirect_not_expanded"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Redirect expansion is offered for every unexpanded http(s) URL.
// ---------------------------------------------------------------------------

fn offers_expansion(a: &Assessment) -> bool {
    a.recommended_actions
        .iter()
        .any(|action| matches!(action, safety_core::RecommendedAction::ExpandRedirectOnline))
}

#[test]
fn aka_ms_is_a_known_shortener() {
    // aka.ms uses readable word slugs with no digits, so the opaque-code
    // heuristic can never catch it. Without the registry entry the destination
    // stays hidden while the result reads as "no known threat found".
    for payload in ["https://aka.ms/learn-azure", "aka.ms/learn-azure"] {
        let a = assess_plain(payload);
        assert!(
            has_finding(&a, "url.shortener"),
            "{payload} missed registry"
        );
        assert!(!has_finding(&a, "url.possible_shortener"));
        assert!(has_limitation(&a, "limitation.redirect_not_expanded"));
        assert_eq!(a.verdict, Verdict::InsufficientEvidence, "{payload}");
        assert!(offers_expansion(&a), "{payload} offered no expansion");
    }
}

#[test]
fn expansion_is_offered_for_any_unexpanded_http_url() {
    // Any URL can redirect, so the option must not depend on a shortener cue.
    // These hosts must stay free of redirect *warnings* while remaining
    // checkable on request.
    for payload in [
        "https://example.com/page",
        "https://vg.no/sport",
        "https://nrk.no/nyheter",
        "http://example.com/",
    ] {
        let a = assess_plain(payload);
        assert!(offers_expansion(&a), "{payload} offered no expansion");
        assert!(
            !has_finding(&a, "url.possible_shortener"),
            "{payload} raised a false redirect warning"
        );
        assert!(
            !has_limitation(&a, "limitation.redirect_not_expanded"),
            "{payload} raised a false redirect limitation"
        );
    }
}

#[test]
fn expansion_is_not_offered_for_non_http_payloads() {
    for payload in ["not a url at all", "mailto:someone@example.com"] {
        let a = assess_plain(payload);
        assert!(
            !offers_expansion(&a),
            "{payload} should not offer redirect expansion"
        );
    }
}

// ---------------------------------------------------------------------------
// Hop budget: the user's stated requirement.
// ---------------------------------------------------------------------------

#[test]
fn max_redirect_hops_constant_is_five() {
    assert_eq!(MAX_REDIRECT_HOPS, 5);
}

#[test]
fn exactly_five_hops_is_within_budget() {
    // scanned + 5 hops = 6 entries, hopCount == 5.
    let res = resolved_chain(&[
        "s0.example",
        "s1.example",
        "s2.example",
        "s3.example",
        "s4.example",
        "s5.example",
    ]);
    let a = assess_with("https://s0.example/", res);
    let redirect = a.redirect.as_ref().expect("redirect analysis present");
    assert_eq!(redirect.hop_count, 5);
    assert!(!has_finding(&a, "redirect.excessive_hops"));
    assert!(has_finding(&a, "redirect.multiple_hops"));
    // Nothing hostile here, so the hop count alone must not force Suspicious.
    assert_eq!(a.verdict, Verdict::NoKnownThreatFound);
}

#[test]
fn six_hops_is_excessive_and_suspicious() {
    // scanned + 6 hops = 7 entries, hopCount == 6.
    let res = resolved_chain(&[
        "s0.example",
        "s1.example",
        "s2.example",
        "s3.example",
        "s4.example",
        "s5.example",
        "s6.example",
    ]);
    let a = assess_with("https://s0.example/", res);
    let redirect = a.redirect.as_ref().expect("redirect analysis present");
    assert_eq!(redirect.hop_count, 6);
    assert!(has_finding(&a, "redirect.excessive_hops"));
    assert!(!has_finding(&a, "redirect.multiple_hops"));
    assert_eq!(a.verdict, Verdict::Suspicious);
}

#[test]
fn max_hops_outcome_is_untrusted() {
    // The user's requirement: "Track until 5 consecutive redirects. If there is
    // more — stop and resolve link as untrusted, citing too many redirects."
    let chain: Vec<RedirectHop> = (0..=5)
        .map(|i| hop(&format!("https://s{i}.example/")))
        .collect();
    let res = resolution(chain, RedirectOutcome::MaxHops, None);
    let a = assess_with("https://s0.example/", res);

    assert_eq!(a.verdict, Verdict::Suspicious);
    assert!(has_finding(&a, "redirect.excessive_hops"));
    assert!(has_limitation(&a, "limitation.redirect_partial"));
    // A partial resolution never claims a final URL.
    assert!(a.redirect.as_ref().unwrap().final_url.is_none());
}

#[test]
fn single_hop_is_not_multiple() {
    // A lone redirect (e.g. a shortener) is normal and must not be flagged.
    let res = resolution(
        vec![hop("https://a.example/"), hop("https://b.example/")],
        RedirectOutcome::Resolved,
        Some("https://b.example/"),
    );
    let a = assess_with("https://a.example/", res);
    assert_eq!(a.redirect.as_ref().unwrap().hop_count, 1);
    assert!(!has_finding(&a, "redirect.multiple_hops"));
    assert!(!has_finding(&a, "redirect.excessive_hops"));
}

// ---------------------------------------------------------------------------
// Transport downgrade.
// ---------------------------------------------------------------------------

#[test]
fn https_to_http_downgrade_is_high_and_suspicious() {
    let res = resolution(
        vec![hop("https://a.example/"), hop("http://b.example/")],
        RedirectOutcome::Resolved,
        Some("http://b.example/"),
    );
    let a = assess_with("https://a.example/", res);
    assert!(has_finding(&a, "redirect.downgrade_to_http"));
    assert!(a.redirect.as_ref().unwrap().downgraded_to_http);
    assert_eq!(a.verdict, Verdict::Suspicious);
}

#[test]
fn all_https_chain_has_no_downgrade() {
    let res = resolved_chain(&["a.example", "b.example"]);
    let a = assess_with("https://a.example/", res);
    assert!(!has_finding(&a, "redirect.downgrade_to_http"));
    assert!(!a.redirect.as_ref().unwrap().downgraded_to_http);
}

// ---------------------------------------------------------------------------
// Cross-domain and shortener suppression.
// ---------------------------------------------------------------------------

#[test]
fn non_shortener_cross_domain_is_reported() {
    let res = resolution(
        vec![hop("https://a.example/"), hop("https://b.example/")],
        RedirectOutcome::Resolved,
        Some("https://b.example/"),
    );
    let a = assess_with("https://a.example/", res);
    assert!(has_finding(&a, "redirect.cross_domain"));
    let redirect = a.redirect.as_ref().unwrap();
    assert!(redirect.crossed_registrable_domain);
    assert_eq!(redirect.domains_traversed, vec!["a.example", "b.example"]);
}

#[test]
fn shortener_cross_domain_is_suppressed_but_recorded() {
    // A shortener pointing at another domain is expected; the finding is
    // suppressed, but the boolean still records the crossing as raw data.
    let res = resolution(
        vec![hop("https://bit.ly/x"), hop("https://legit.example/")],
        RedirectOutcome::Resolved,
        Some("https://legit.example/"),
    );
    let a = assess_with("https://bit.ly/x", res);
    assert!(!has_finding(&a, "redirect.cross_domain"));
    assert!(a.redirect.as_ref().unwrap().crossed_registrable_domain);
    assert!(has_finding(&a, "url.shortener"));
    // It WAS expanded, so the offline limitation must be gone.
    assert!(!has_limitation(&a, "limitation.redirect_not_expanded"));
    assert_eq!(a.verdict, Verdict::InsufficientEvidence);
}

#[test]
fn domains_traversed_collapses_consecutive_duplicates() {
    let res = resolution(
        vec![
            hop("https://x.example/1"),
            hop("https://x.example/2"),
            hop("https://y.example/"),
            hop("https://y.example/again"),
            hop("https://z.example/"),
        ],
        RedirectOutcome::Resolved,
        Some("https://z.example/"),
    );
    let a = assess_with("https://x.example/1", res);
    assert_eq!(
        a.redirect.as_ref().unwrap().domains_traversed,
        vec!["x.example", "y.example", "z.example"]
    );
}

// ---------------------------------------------------------------------------
// Chained shorteners.
// ---------------------------------------------------------------------------

#[test]
fn chained_shorteners_are_flagged() {
    let res = resolution(
        vec![
            hop("https://bit.ly/x"),
            hop("https://tinyurl.com/y"),
            hop("https://final.example/"),
        ],
        RedirectOutcome::Resolved,
        Some("https://final.example/"),
    );
    let a = assess_with("https://bit.ly/x", res);
    assert!(has_finding(&a, "redirect.chained_shorteners"));
    assert_eq!(a.verdict, Verdict::Suspicious);
}

// ---------------------------------------------------------------------------
// Loop and meta refresh.
// ---------------------------------------------------------------------------

#[test]
fn loop_outcome_reports_loop_and_partial() {
    let res = resolution(
        vec![
            hop("https://a.example/"),
            hop("https://b.example/"),
            hop("https://a.example/"),
        ],
        RedirectOutcome::Loop,
        None,
    );
    let a = assess_with("https://a.example/", res);
    assert!(has_finding(&a, "redirect.loop"));
    assert!(has_limitation(&a, "limitation.redirect_partial"));
    // Not resolved, so no final-URL breakdown.
    assert!(a.redirect.as_ref().unwrap().final_url.is_none());
}

#[test]
fn meta_refresh_hop_is_flagged() {
    let res = resolution(
        vec![
            hop_via("https://start.example/", RedirectMechanism::HtmlMetaRefresh),
            hop("https://end.example/"),
        ],
        RedirectOutcome::Resolved,
        Some("https://end.example/"),
    );
    let a = assess_with("https://start.example/", res);
    assert!(has_finding(&a, "redirect.meta_refresh"));
    let meta = a
        .findings
        .iter()
        .find(|f| f.code == "redirect.meta_refresh")
        .unwrap();
    assert_eq!(
        meta.params.get("host").map(String::as_str),
        Some("start.example")
    );
}

// ---------------------------------------------------------------------------
// The payoff: analysing the final URL with the existing detectors.
// ---------------------------------------------------------------------------

#[test]
fn final_url_credentials_are_surfaced_with_subject() {
    // A bland bit.ly link that lands on a credential-stuffed authority.
    let res = resolution(
        vec![
            hop("https://bit.ly/x"),
            hop("https://dnb.no@evil.example/login"),
        ],
        RedirectOutcome::Resolved,
        Some("https://dnb.no@evil.example/login"),
    );
    let a = assess_with("https://bit.ly/x", res);

    let credentials = a
        .findings
        .iter()
        .find(|f| f.code == "url.credentials_in_authority")
        .expect("final-url credentials finding present");
    assert_eq!(credentials.subject, Some(FindingSubject::Final));
    assert_eq!(a.verdict, Verdict::Suspicious);

    // The final-URL breakdown is attached for a resolved chain.
    let redirect = a.redirect.as_ref().unwrap();
    let final_url = redirect.final_url.as_ref().expect("final url breakdown");
    assert_eq!(final_url.host, "evil.example");
    assert_eq!(final_url.username.as_deref(), Some("dnb.no"));
}

#[test]
fn scanned_findings_keep_no_subject() {
    let res = resolved_chain(&["a.example", "b.example"]);
    let a = assess_with("http://a.example/", res);
    let insecure = a
        .findings
        .iter()
        .find(|f| f.code == "url.insecure_scheme")
        .expect("scanned insecure scheme");
    assert_eq!(insecure.subject, None);
}

#[test]
fn identical_findings_on_both_urls_are_not_duplicated() {
    // Scanned and final are both http (identical insecure_scheme, empty params):
    // the final duplicate is dropped, but a genuinely new final finding is kept.
    let res = resolution(
        vec![hop("http://bit.ly/x"), hop("http://evil.example:8080/")],
        RedirectOutcome::Resolved,
        Some("http://evil.example:8080/"),
    );
    let a = assess_with("http://bit.ly/x", res);

    let insecure_count = a
        .findings
        .iter()
        .filter(|f| f.code == "url.insecure_scheme")
        .count();
    assert_eq!(
        insecure_count, 1,
        "duplicate insecure_scheme must be dropped"
    );

    let port = a
        .findings
        .iter()
        .find(|f| f.code == "url.non_standard_port")
        .expect("final non-standard port finding kept");
    assert_eq!(port.subject, Some(FindingSubject::Final));
}

#[test]
fn partial_outcomes_do_not_analyse_final_url() {
    // A blocked resolution reached a dangerous last hop, but we did not truly
    // arrive there, so no subject=Final findings and no final breakdown.
    let res = resolution(
        vec![
            hop("https://a.example/"),
            hop("https://dnb.no@evil.example/login"),
        ],
        RedirectOutcome::Blocked,
        None,
    );
    let a = assess_with("https://a.example/", res);
    assert!(!has_finding(&a, "url.credentials_in_authority"));
    assert!(a.redirect.as_ref().unwrap().final_url.is_none());
    assert!(has_limitation(&a, "limitation.redirect_resolution_failed"));
}

// ---------------------------------------------------------------------------
// Failure outcomes map to the right limitation reason.
// ---------------------------------------------------------------------------

#[test]
fn failure_outcomes_report_reason() {
    for (outcome, reason) in [
        (RedirectOutcome::Timeout, "timeout"),
        (RedirectOutcome::NetworkError, "network_error"),
        (RedirectOutcome::Blocked, "blocked"),
    ] {
        let res = resolution(vec![hop("https://a.example/")], outcome, None);
        let a = assess_with("https://a.example/", res);
        let limitation = a
            .limitations
            .iter()
            .find(|l| l.code == "limitation.redirect_resolution_failed")
            .unwrap_or_else(|| panic!("resolution_failed missing for {outcome:?}"));
        assert_eq!(
            limitation.params.get("reason").map(String::as_str),
            Some(reason)
        );
    }
}

// ---------------------------------------------------------------------------
// Hostile / malformed input must degrade, never panic.
// ---------------------------------------------------------------------------

#[test]
fn empty_chain_resolved_degrades_to_partial() {
    let res = resolution(Vec::new(), RedirectOutcome::Resolved, None);
    let a = assess_with("https://a.example/", res);
    let redirect = a.redirect.as_ref().expect("redirect present");
    assert_eq!(redirect.hop_count, 0);
    assert!(redirect.final_url.is_none());
    assert!(has_limitation(&a, "limitation.redirect_partial"));
}

#[test]
fn resolved_without_final_url_degrades_to_partial() {
    // outcome says resolved but finalUrl is unparseable garbage and no hop can
    // stand in for it — degrade to partial rather than invent a destination.
    let res = resolution(
        vec![hop("https://a.example/")],
        RedirectOutcome::Resolved,
        Some("::not a url::"),
    );
    let a = assess_with("https://a.example/", res);
    assert!(a.redirect.as_ref().unwrap().final_url.is_none());
    assert!(has_limitation(&a, "limitation.redirect_partial"));
}

#[test]
fn hostile_urls_never_panic() {
    let huge = format!("https://{}.example/", "a".repeat(20_000));
    let hostile_chains = [
        vec![hop(""), hop("not a url at all"), hop("https://a.example/")],
        vec![hop("javascript:alert(1)"), hop("data:text/html,<script>")],
        vec![
            hop("https://\u{202E}\u{2066}evil.example/\u{200B}"),
            hop("https://a:b@c@d@e.example/"),
        ],
        vec![hop(&huge), hop("http://192.168.1.1:99999/")],
        vec![hop("https://пример.example/\0\0\0")],
    ];
    let outcomes = [
        RedirectOutcome::Resolved,
        RedirectOutcome::MaxHops,
        RedirectOutcome::Loop,
        RedirectOutcome::Timeout,
        RedirectOutcome::NetworkError,
        RedirectOutcome::Blocked,
    ];
    for chain in hostile_chains {
        for outcome in outcomes {
            let res = resolution(chain.clone(), outcome, Some("https://\u{202E}x@y.example/"));
            let payload = "https://scanned.example/".to_owned();
            let result = std::panic::catch_unwind(|| {
                engine().assess(AssessInput {
                    payload,
                    now_ms: NOW_MS,
                    locale: None,
                    redirect_resolution: Some(res),
                })
            });
            assert!(
                result.is_ok(),
                "assess panicked on hostile chain / {outcome:?}"
            );
        }
    }
}

#[test]
fn resolution_on_non_url_payload_is_ignored() {
    // A resolution supplied for a wifi QR is nonsensical; it must not apply.
    let res = resolved_chain(&["a.example", "b.example"]);
    let a = assess_with("WIFI:T:nopass;S:FreeWifi;;", res);
    assert!(a.redirect.is_none());
    assert!(codes(&a).iter().all(|c| !c.starts_with("redirect.")));
}

// ---------------------------------------------------------------------------
// Wire format: JSON in, JSON out (the WASM boundary path).
// ---------------------------------------------------------------------------

#[test]
fn deserializes_camel_case_resolution_from_json() {
    let input_json = r#"{
        "payload": "https://bit.ly/x",
        "nowMs": 1784332800000,
        "redirectResolution": {
            "chain": [
                {"url": "https://bit.ly/x", "status": 301, "via": "http_status"},
                {"url": "https://dnb.no@evil.example/login", "via": "teleport"}
            ],
            "finalUrl": "https://dnb.no@evil.example/login",
            "outcome": "resolved",
            "elapsedMs": 42,
            "resolver": "isolated-resolver/1.2.3"
        }
    }"#;
    let input: AssessInput = serde_json::from_str(input_json).expect("valid AssessInput JSON");
    let a = engine().assess(input);

    // "teleport" is an unknown mechanism and must fold to Unknown, not fail.
    assert!(has_finding(&a, "url.credentials_in_authority"));
    assert_eq!(a.verdict, Verdict::Suspicious);
    assert!(a.redirect.is_some());
}

#[test]
fn serializes_redirect_analysis_in_camel_case() {
    let res = resolution(
        vec![hop("https://a.example/"), hop("http://b.example/")],
        RedirectOutcome::Resolved,
        Some("http://b.example/"),
    );
    let a = assess_with("https://a.example/", res);
    let json: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&a).unwrap()).unwrap();

    let redirect = &json["redirect"];
    assert!(redirect["hopCount"].is_number());
    assert_eq!(redirect["outcome"], "resolved");
    assert!(redirect["domainsTraversed"].is_array());
    assert_eq!(redirect["crossedRegistrableDomain"], true);
    assert_eq!(redirect["downgradedToHttp"], true);
    assert!(redirect["finalUrl"].is_object());

    // The final-URL finding serializes its subject as "final".
    let has_final_subject = json["findings"]
        .as_array()
        .unwrap()
        .iter()
        .any(|f| f["subject"] == "final");
    assert!(has_final_subject);
}

#[test]
fn offline_assessment_omits_redirect_key() {
    // Absent resolution must not add a `redirect` key to the wire output.
    let a = assess_plain("https://example.com/");
    let json: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&a).unwrap()).unwrap();
    assert!(json.get("redirect").is_none());
    // And scanned findings must not carry a subject key.
    let a2 = assess_plain("http://example.com/");
    let json2: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&a2).unwrap()).unwrap();
    for finding in json2["findings"].as_array().unwrap() {
        assert!(finding.get("subject").is_none());
    }
}
