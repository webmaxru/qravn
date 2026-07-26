//! Analysis of a redirect chain that was expanded by isolated server
//! infrastructure and passed IN to the core.
//!
//! The core never performs the fetch itself: checking a hostile QR code must
//! never tell the destination that anyone looked at it. Everything reaching
//! this module is attacker-controlled — the resolver faithfully reports what a
//! malicious server said. URLs may be empty, unparseable, enormous, or carry
//! credentials and control characters; the chain may be empty despite the
//! contract; `finalUrl` may be present or absent inconsistently with the
//! outcome. Nothing here indexes without checking, and nothing here panics: a
//! malformed resolution degrades to a limitation, never a crash.

use crate::detect;
use crate::rules::RulePackage;
use crate::types::{
    params, Finding, FindingSubject, Limitation, RedirectAnalysis, RedirectMechanism,
    RedirectOutcome, RedirectResolution, UrlBreakdown,
};
use crate::unicode_guard;
use crate::url_policy::{self, ParsedUrl};
use std::collections::BTreeSet;

/// Hop budget shared with the isolated resolver: the scanned URL may be followed
/// through at most this many consecutive redirects. A chain that needs more is
/// reported by the resolver with `RedirectOutcome::MaxHops`, which this core
/// turns into `redirect.excessive_hops` and, therefore, a `Suspicious` verdict.
///
/// This is the single source of truth for the number 5. The resolver service
/// MUST match it: `safety_core::MAX_REDIRECT_HOPS`.
pub const MAX_REDIRECT_HOPS: usize = 5;

/// Two or more intermediate redirects is where a chain stops looking ordinary.
/// A single redirect (`hopCount == 1`) is normal for link shorteners, so it is
/// not reported on its own.
const MULTIPLE_HOPS_THRESHOLD: usize = 2;

/// Passing through this many known shortening services in one chain is rare in
/// legitimate links and deliberately hides the destination.
const CHAINED_SHORTENERS_THRESHOLD: usize = 2;

/// Facts extracted once per hop URL, so the rest of the analysis never re-parses.
struct HopInfo {
    scheme: String,
    host: String,
    registrable_domain: Option<String>,
    via: Option<RedirectMechanism>,
}

/// What `analyze` produces: the structured analysis for `Assessment.redirect`,
/// plus any findings and limitations to fold into the assessment.
pub struct RedirectOutput {
    pub analysis: RedirectAnalysis,
    pub findings: Vec<Finding>,
    pub limitations: Vec<Limitation>,
}

/// Analyse a supplied redirect resolution for the scanned URL.
///
/// * `scanned_domain` — registrable domain of the scanned URL, for the
///   cross-domain check (the "from" side).
/// * `scanned_is_shortener` — whether the scanned URL matched a known shortener;
///   used to suppress the otherwise-expected cross-domain finding.
/// * `scanned_findings` — findings already produced for the scanned URL, so
///   identical findings on the final URL are not duplicated.
pub fn analyze(
    resolution: &RedirectResolution,
    scanned_domain: Option<&str>,
    scanned_is_shortener: bool,
    scanned_findings: &[Finding],
    rules: &RulePackage,
) -> RedirectOutput {
    let mut findings = Vec::new();
    let mut limitations = Vec::new();

    // hopCount follows the contract: number of hops after the scanned URL, i.e.
    // chain.len() - 1. `saturating_sub` guards the empty (hostile) chain that
    // the contract says cannot happen but a malicious server might induce.
    let hop_count = resolution.chain.len().saturating_sub(1);

    // Ordered facts for every non-empty hop URL. Empty/garbage hop URLs carry no
    // host to reason about and are skipped here; they still count toward
    // hopCount, which is defined purely by chain length.
    let mut infos: Vec<HopInfo> = Vec::new();
    for hop in &resolution.chain {
        let url_str = hop.url.trim();
        if url_str.is_empty() {
            continue;
        }
        infos.push(hop_info(url_str, hop.via));
    }

    // Furthest URL the resolver reached: `finalUrl` when present, else the last
    // non-empty hop. Appended to the sequence only when it differs from the last
    // hop, so an inconsistent `finalUrl` still participates in the analysis.
    let last_hop_url = resolution
        .chain
        .iter()
        .rev()
        .map(|hop| hop.url.trim())
        .find(|url| !url.is_empty());
    let destination_str = resolution
        .final_url
        .as_deref()
        .map(str::trim)
        .filter(|url| !url.is_empty())
        .or(last_hop_url);
    if let Some(dest) = destination_str {
        if last_hop_url != Some(dest) {
            infos.push(hop_info(dest, None));
        }
    }

    // domainsTraversed: registrable domain per hop (host as a fallback when a hop
    // has no registrable domain, e.g. an IP literal), in order, with consecutive
    // duplicates collapsed.
    let mut domains_traversed: Vec<String> = Vec::new();
    for info in &infos {
        if let Some(key) = domain_key(info) {
            if domains_traversed.last() != Some(&key) {
                domains_traversed.push(key);
            }
        }
    }

    // Parse the destination once, for the cross-domain check and — when the
    // outcome is a clean resolution — the detailed final-URL analysis.
    let destination_parsed = destination_str.and_then(parse_navigable);
    let destination_domain = destination_parsed
        .as_ref()
        .and_then(|parsed| parsed.breakdown.registrable_domain.clone());

    // crossedRegistrableDomain: the destination is a different registrable domain
    // than the scan. Only asserted when both domains are actually known.
    let crossed_registrable_domain = match (scanned_domain, destination_domain.as_deref()) {
        (Some(from), Some(to)) => from != to,
        _ => false,
    };

    // downgradedToHttp: an https hop is immediately followed by an http hop.
    let mut downgraded_host: Option<String> = None;
    for pair in infos.windows(2) {
        if pair[0].scheme == "https" && pair[1].scheme == "http" {
            downgraded_host = Some(pair[1].host.clone());
            break;
        }
    }
    let downgraded_to_http = downgraded_host.is_some();

    // ---- Chain-level findings --------------------------------------------

    // redirect.cross_domain (medium). Suppressed when the scanned URL is a known
    // shortener: pointing at another domain is a shortener's entire purpose, so
    // reporting it there would flag every resolved shortener. The boolean above
    // still records the crossing as raw data for the client.
    if crossed_registrable_domain && !scanned_is_shortener {
        if let (Some(from), Some(to)) = (scanned_domain, destination_domain.as_deref()) {
            findings.push(Finding::new(
                "redirect.cross_domain",
                params(&[("fromDomain", from.to_owned()), ("toDomain", to.to_owned())]),
            ));
        }
    }

    // Hop-count findings. A chain the resolver stopped for exceeding the budget
    // (MaxHops), or one longer than the budget, is "excessive" (medium, and in
    // the verdict allowlist so it forces Suspicious on its own — this is the
    // user's stated requirement). Shorter chains with two or more hops are merely
    // "multiple" (low). Excessive supersedes multiple.
    let excessive_hops =
        matches!(resolution.outcome, RedirectOutcome::MaxHops) || hop_count > MAX_REDIRECT_HOPS;
    if excessive_hops {
        findings.push(Finding::new(
            "redirect.excessive_hops",
            params(&[("hopCount", hop_count.to_string())]),
        ));
    } else if hop_count >= MULTIPLE_HOPS_THRESHOLD {
        findings.push(Finding::new(
            "redirect.multiple_hops",
            params(&[("hopCount", hop_count.to_string())]),
        ));
    }

    // redirect.downgrade_to_http (high — forces Suspicious on its own).
    if let Some(host) = &downgraded_host {
        findings.push(Finding::new(
            "redirect.downgrade_to_http",
            params(&[("host", host.clone())]),
        ));
    }

    // redirect.chained_shorteners (medium): two or more shortener hosts in the
    // chain. Reuses the shortener list that also drives url.shortener.
    let shortener_count = infos
        .iter()
        .filter(|info| is_shortener(&info.host, rules))
        .count();
    if shortener_count >= CHAINED_SHORTENERS_THRESHOLD {
        findings.push(Finding::new(
            "redirect.chained_shorteners",
            params(&[("count", shortener_count.to_string())]),
        ));
    }

    // redirect.loop (low): the resolver reported a loop, or a host repeats.
    if let Some(host) = loop_host(&infos, resolution.outcome) {
        findings.push(Finding::new("redirect.loop", params(&[("host", host)])));
    }

    // redirect.meta_refresh (low): a hop handed off via an HTML meta refresh.
    let mut meta_hosts = BTreeSet::new();
    for info in &infos {
        if matches!(info.via, Some(RedirectMechanism::HtmlMetaRefresh))
            && !info.host.is_empty()
            && meta_hosts.insert(info.host.clone())
        {
            findings.push(Finding::new(
                "redirect.meta_refresh",
                params(&[("host", info.host.clone())]),
            ));
        }
    }

    // ---- Detailed final-URL analysis -------------------------------------
    // Only for a clean resolution: rerun every URL detector against the final
    // URL, so a shortener that lands on e.g. https://dnb.no@evil.example/login is
    // surfaced. Findings carry subject=Final; any that exactly duplicate a
    // scanned finding are dropped. Partial outcomes deliberately skip this — we
    // did not reach a trustworthy final URL, and a limitation says so.
    let mut final_url_breakdown: Option<UrlBreakdown> = None;
    if matches!(resolution.outcome, RedirectOutcome::Resolved) {
        if let (Some(dest), Some(parsed)) = (destination_str, destination_parsed.as_ref()) {
            if !parsed.breakdown.host.is_empty() {
                let unicode = unicode_guard::analyze_payload(dest);
                let (final_findings, _final_limitations) = detect::detect_url(
                    parsed,
                    dest,
                    rules,
                    unicode.has_bidi_controls,
                    unicode.has_control_or_invisible,
                );
                for finding in final_findings {
                    if is_duplicate_of_scanned(&finding, scanned_findings) {
                        continue;
                    }
                    findings.push(finding.with_subject(FindingSubject::Final));
                }
                final_url_breakdown = Some(parsed.breakdown.clone());
            }
        }
    }

    // ---- Limitations ------------------------------------------------------
    match resolution.outcome {
        RedirectOutcome::Timeout | RedirectOutcome::NetworkError | RedirectOutcome::Blocked => {
            limitations.push(Limitation::new(
                "limitation.redirect_resolution_failed",
                params(&[("reason", outcome_reason(resolution.outcome).to_owned())]),
            ));
        }
        RedirectOutcome::MaxHops | RedirectOutcome::Loop => {
            limitations.push(Limitation::new(
                "limitation.redirect_partial",
                params(&[("hopCount", hop_count.to_string())]),
            ));
        }
        RedirectOutcome::Resolved => {
            // A "resolved" outcome that yields no usable final URL is
            // inconsistent (hostile). Degrade to a partial limitation rather than
            // claim a destination we could not parse.
            if final_url_breakdown.is_none() {
                limitations.push(Limitation::new(
                    "limitation.redirect_partial",
                    params(&[("hopCount", hop_count.to_string())]),
                ));
            }
        }
    }

    let analysis = RedirectAnalysis {
        hop_count,
        outcome: resolution.outcome,
        final_url: final_url_breakdown,
        domains_traversed,
        crossed_registrable_domain,
        downgraded_to_http,
    };

    RedirectOutput {
        analysis,
        findings,
        limitations,
    }
}

fn hop_info(url_str: &str, via: Option<RedirectMechanism>) -> HopInfo {
    match parse_navigable(url_str) {
        Some(parsed) => HopInfo {
            scheme: parsed.breakdown.scheme,
            host: parsed.breakdown.host,
            registrable_domain: parsed.breakdown.registrable_domain,
            via,
        },
        None => HopInfo {
            scheme: scheme_of(url_str),
            host: String::new(),
            registrable_domain: None,
            via,
        },
    }
}

/// Parse a hop or destination URL, returning `Some` only when the URL crate
/// actually parsed it (not the dangerous-fallback path). Hostile garbage yields
/// `None`, which callers treat as "no host to reason about".
fn parse_navigable(url_str: &str) -> Option<ParsedUrl> {
    match url_policy::parse_url(url_str) {
        Some(parsed) if !parsed.parse_failed => Some(parsed),
        _ => None,
    }
}

fn scheme_of(url_str: &str) -> String {
    url_str
        .split_once(':')
        .map(|(scheme, _)| scheme.to_ascii_lowercase())
        .unwrap_or_default()
}

fn domain_key(info: &HopInfo) -> Option<String> {
    if let Some(domain) = &info.registrable_domain {
        if !domain.is_empty() {
            return Some(domain.clone());
        }
    }
    (!info.host.is_empty()).then(|| info.host.clone())
}

fn is_shortener(host: &str, rules: &RulePackage) -> bool {
    !host.is_empty() && rules.shortener_hosts.iter().any(|known| known == host)
}

/// The host at which the chain first revisits a host it already saw, or — when
/// the resolver reported a loop but the hosts were unparseable — the last known
/// host (empty string as a final fallback, so the loop is still reported).
fn loop_host(infos: &[HopInfo], outcome: RedirectOutcome) -> Option<String> {
    let mut seen = BTreeSet::new();
    for info in infos {
        if info.host.is_empty() {
            continue;
        }
        if !seen.insert(info.host.clone()) {
            return Some(info.host.clone());
        }
    }
    if matches!(outcome, RedirectOutcome::Loop) {
        return Some(
            infos
                .iter()
                .rev()
                .map(|info| info.host.clone())
                .find(|host| !host.is_empty())
                .unwrap_or_default(),
        );
    }
    None
}

fn outcome_reason(outcome: RedirectOutcome) -> &'static str {
    match outcome {
        RedirectOutcome::Timeout => "timeout",
        RedirectOutcome::NetworkError => "network_error",
        RedirectOutcome::Blocked => "blocked",
        _ => "unknown",
    }
}

fn is_duplicate_of_scanned(finding: &Finding, scanned: &[Finding]) -> bool {
    scanned
        .iter()
        .any(|existing| existing.code == finding.code && existing.params == finding.params)
}
