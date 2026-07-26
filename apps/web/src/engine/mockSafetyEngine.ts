import {
  SCHEMA_VERSION,
  type Assessment,
  type AssessInput,
  type Finding,
  type FindingSubject,
  type Limitation,
  type PayloadKind,
  type RecommendedAction,
  type RedirectAnalysis,
  type RedirectHop,
  type RedirectOutcome,
  type RedirectResolution,
  type Severity,
  type UrlBreakdown,
  type Verdict,
} from '../contracts/assessment';
import { normaliseLocale, textForCode, verdictText } from './catalog';
import type { SafetyEngine } from './types';

const codeSeverities: Record<string, Severity> = {
  'url.credentials_in_authority': 'high',
  'url.ip_literal_host': 'medium',
  'url.punycode_host': 'medium',
  'url.brand_in_subdomain': 'high',
  'url.brand_in_path': 'medium',
  'url.hyphenated_brand_domain': 'high',
  'url.insecure_scheme': 'medium',
  'url.javascript_scheme': 'critical',
  'url.data_scheme': 'critical',
  'url.shortener': 'medium',
  'url.known_malicious': 'critical',
  // Redirect-chain findings. Severities mirror core `severity_for_code`.
  'redirect.downgrade_to_http': 'high',
  'redirect.cross_domain': 'medium',
  'redirect.excessive_hops': 'medium',
  'redirect.chained_shorteners': 'medium',
  'redirect.multiple_hops': 'low',
  'redirect.loop': 'low',
  'redirect.meta_refresh': 'low',
  'payload.not_a_url': 'info',
  'payload.empty': 'info',
};

// Shared with core `MAX_REDIRECT_HOPS`: the scanned URL may be followed through
// at most this many consecutive redirects before the chain is "excessive".
const MAX_REDIRECT_HOPS = 5;
const MULTIPLE_HOPS_THRESHOLD = 2;
const CHAINED_SHORTENERS_THRESHOLD = 2;

const shorteners = new Map([
  ['bit.ly', 'bit.ly'],
  ['tinyurl.com', 'TinyURL'],
  ['t.co', 't.co'],
  ['goo.gl', 'goo.gl'],
  ['ow.ly', 'ow.ly'],
]);

const norwegianBrands = ['dnb', 'vipps', 'bankid', 'altinn', 'posten', 'digipost'];
const brandOwnedDomains = new Set(['dnb.no', 'vipps.no', 'bankid.no', 'altinn.no', 'posten.no', 'digipost.no']);

function neutralizeControls(value: string): string {
  return value.replace(
    // eslint-disable-next-line no-control-regex -- deliberately matches C0/C1 controls to neutralize them
    /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function finding(code: string, params: Record<string, string>, locale: string): Finding {
  const severity = codeSeverities[code] ?? 'info';
  const text = textForCode(code, params, normaliseLocale(locale));
  return { code, severity, params, ...text };
}

function parsePayload(payload: string): { url?: URL; kind: PayloadKind } {
  const trimmed = payload.trim();
  if (!trimmed) return { kind: 'empty' };
  try {
    const url = new URL(trimmed);
    return { url, kind: url.protocol === 'http:' || url.protocol === 'https:' ? 'url' : 'deeplink' };
  } catch {
    if (/^[\w.-]+\.[a-z]{2,}([/?#:]|$)/i.test(trimmed)) {
      try {
        return { url: new URL(`https://${trimmed}`), kind: 'url' };
      } catch {
        return { kind: 'text' };
      }
    }
    return { kind: 'text' };
  }
}

function getRegistrableDomain(host: string): { registrableDomain?: string; publicSuffix?: string; subdomains: string[] } {
  if (/^\[[^\]]+\]$/.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { subdomains: [] };
  const labels = host.toLowerCase().split('.').filter(Boolean);
  if (labels.length < 2) return { subdomains: [] };
  const publicSuffix = labels.at(-1);
  const registrableDomain = labels.slice(-2).join('.');
  return { registrableDomain, publicSuffix, subdomains: labels.slice(0, -2) };
}

function isIpLiteral(host: string): boolean {
  return /^\[[0-9a-f:.]+\]$/i.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function breakdown(url: URL): UrlBreakdown {
  const host = url.hostname;
  const domainParts = getRegistrableDomain(host);
  return {
    scheme: url.protocol.replace(':', ''),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    hasPassword: Boolean(url.password),
    host,
    unicodeHost: host.includes('xn--') ? host : undefined,
    port: url.port ? Number(url.port) : undefined,
    path: url.pathname,
    query: url.search ? url.search.slice(1) : undefined,
    fragment: url.hash ? url.hash.slice(1) : undefined,
    ...domainParts,
    isIpLiteral: isIpLiteral(host),
    hasCredentials: Boolean(url.username || url.password),
    hasPunycode: host.includes('xn--'),
    isMixedScript: false,
    scripts: host ? ['Latin'] : [],
  };
}

function verdictFor(findings: Finding[], kind: PayloadKind): Verdict {
  if (findings.some((item) => item.severity === 'critical')) return 'known_malicious';
  if (findings.some((item) => item.severity === 'high' || item.severity === 'medium')) return 'suspicious';
  if (kind !== 'url') return 'insufficient_evidence';
  return 'no_known_threat_found';
}

function limitationFor(code: string, params: Record<string, string>, locale: string): Limitation {
  return { code, params, text: textForCode(code, params, normaliseLocale(locale)).detail };
}

function isShortenerHost(host: string): boolean {
  return shorteners.has(host.toLowerCase());
}

/** Run every URL detector against `url`. Reused for the scanned URL and, during
 * redirect analysis, the final destination. Returns findings only (no cue). */
function detectUrlFindings(url: URL, urlBreakdown: UrlBreakdown, locale: string): Finding[] {
  const out: Finding[] = [];
  const host = urlBreakdown.host.toLowerCase();
  const registrableDomain = urlBreakdown.registrableDomain ?? host;

  if (url.protocol === 'javascript:') out.push(finding('url.javascript_scheme', {}, locale));
  if (url.protocol === 'data:') out.push(finding('url.data_scheme', {}, locale));
  if (url.protocol === 'http:') out.push(finding('url.insecure_scheme', {}, locale));
  if (urlBreakdown.hasCredentials) {
    out.push(finding('url.credentials_in_authority', { username: urlBreakdown.username ?? '', host: urlBreakdown.host }, locale));
  }
  if (urlBreakdown.isIpLiteral) out.push(finding('url.ip_literal_host', { host: urlBreakdown.host }, locale));
  if (urlBreakdown.hasPunycode) {
    out.push(
      finding('url.punycode_host', { punycodeHost: urlBreakdown.host, unicodeHost: urlBreakdown.unicodeHost ?? urlBreakdown.host }, locale),
    );
  }
  if (isShortenerHost(host)) out.push(finding('url.shortener', { service: shorteners.get(host) ?? host }, locale));

  const subdomainText = urlBreakdown.subdomains.join('.');
  const pathText = decodeURIComponent(url.pathname).toLowerCase();
  for (const brand of norwegianBrands) {
    const ownsDomain = brandOwnedDomains.has(registrableDomain);
    if (!ownsDomain && subdomainText.split(/[.-]/).includes(brand)) {
      out.push(finding('url.brand_in_subdomain', { brand, registrableDomain }, locale));
    }
    if (!ownsDomain && registrableDomain.includes(`${brand}-`)) {
      out.push(finding('url.hyphenated_brand_domain', { brand, registrableDomain }, locale));
    }
    if (!ownsDomain && pathText.includes(brand)) out.push(finding('url.brand_in_path', { brand }, locale));
  }

  if (host === 'dnb-secure-login.example' || host === 'vipps-verification.example') {
    out.push(finding('url.known_malicious', { ruleId: 'mock-norway-brand-impersonation' }, locale));
  }
  return out;
}

interface HopInfo {
  scheme: string;
  host: string;
  registrableDomain?: string;
  via?: RedirectHop['via'];
}

function parseHop(urlStr: string, via?: RedirectHop['via']): HopInfo {
  try {
    const u = new URL(urlStr);
    const host = u.hostname;
    const { registrableDomain } = getRegistrableDomain(host);
    return { scheme: u.protocol.replace(':', ''), host, registrableDomain, via };
  } catch {
    const idx = urlStr.indexOf(':');
    return { scheme: idx > 0 ? urlStr.slice(0, idx).toLowerCase() : '', host: '', via };
  }
}

function domainKeyOf(info: HopInfo): string | undefined {
  if (info.registrableDomain) return info.registrableDomain;
  return info.host || undefined;
}

function detectLoopHost(infos: HopInfo[], outcome: RedirectOutcome): string | undefined {
  const seen = new Set<string>();
  for (const info of infos) {
    if (!info.host) continue;
    if (seen.has(info.host)) return info.host;
    seen.add(info.host);
  }
  if (outcome === 'loop') {
    for (let i = infos.length - 1; i >= 0; i -= 1) {
      if (infos[i]!.host) return infos[i]!.host;
    }
    return '';
  }
  return undefined;
}

function isDuplicateOfScanned(candidate: Finding, scanned: Finding[]): boolean {
  return scanned.some(
    (existing) => existing.code === candidate.code && JSON.stringify(existing.params) === JSON.stringify(candidate.params),
  );
}

interface RedirectOutput {
  analysis: RedirectAnalysis;
  findings: Finding[];
  limitations: Limitation[];
}

/**
 * Development mirror of core `redirect::analyze`. The real WebAssembly core is
 * authoritative (and is what the e2e suite exercises); this keeps online mode
 * coherent when the mock is used because the wasm build is absent.
 */
function analyzeRedirect(
  resolution: RedirectResolution,
  scannedDomain: string | undefined,
  scannedIsShortener: boolean,
  scannedFindings: Finding[],
  locale: string,
): RedirectOutput {
  const findings: Finding[] = [];
  const limitations: Limitation[] = [];
  const outcome = resolution.outcome;
  const hopCount = Math.max(resolution.chain.length - 1, 0);

  const infos: HopInfo[] = [];
  for (const hop of resolution.chain) {
    const urlStr = (hop.url ?? '').trim();
    if (!urlStr) continue;
    infos.push(parseHop(urlStr, hop.via));
  }

  const lastHopUrl = [...resolution.chain]
    .reverse()
    .map((hop) => (hop.url ?? '').trim())
    .find((url) => url.length > 0);
  const finalTrimmed = resolution.finalUrl?.trim();
  const destinationStr = finalTrimmed && finalTrimmed.length > 0 ? finalTrimmed : lastHopUrl;
  if (destinationStr && destinationStr !== lastHopUrl) {
    infos.push(parseHop(destinationStr, undefined));
  }

  const domainsTraversed: string[] = [];
  for (const info of infos) {
    const key = domainKeyOf(info);
    if (key && domainsTraversed[domainsTraversed.length - 1] !== key) domainsTraversed.push(key);
  }

  let destinationUrl: URL | undefined;
  if (destinationStr) {
    try {
      destinationUrl = new URL(destinationStr);
    } catch {
      destinationUrl = undefined;
    }
  }
  const destinationBreakdown = destinationUrl ? breakdown(destinationUrl) : undefined;
  const destinationDomain = destinationBreakdown?.registrableDomain;

  const crossedRegistrableDomain = Boolean(scannedDomain && destinationDomain && scannedDomain !== destinationDomain);

  let downgradedHost: string | undefined;
  for (let i = 0; i + 1 < infos.length; i += 1) {
    if (infos[i]!.scheme === 'https' && infos[i + 1]!.scheme === 'http') {
      downgradedHost = infos[i + 1]!.host;
      break;
    }
  }
  const downgradedToHttp = downgradedHost !== undefined;

  // Pointing at another domain is a shortener's whole purpose, so suppress the
  // cross-domain finding there while still recording the crossing as raw data.
  if (crossedRegistrableDomain && !scannedIsShortener && scannedDomain && destinationDomain) {
    findings.push(finding('redirect.cross_domain', { fromDomain: scannedDomain, toDomain: destinationDomain }, locale));
  }

  const excessiveHops = outcome === 'max_hops' || hopCount > MAX_REDIRECT_HOPS;
  if (excessiveHops) {
    findings.push(finding('redirect.excessive_hops', { hopCount: String(hopCount) }, locale));
  } else if (hopCount >= MULTIPLE_HOPS_THRESHOLD) {
    findings.push(finding('redirect.multiple_hops', { hopCount: String(hopCount) }, locale));
  }

  if (downgradedHost !== undefined) {
    findings.push(finding('redirect.downgrade_to_http', { host: downgradedHost }, locale));
  }

  const shortenerCount = infos.filter((info) => isShortenerHost(info.host)).length;
  if (shortenerCount >= CHAINED_SHORTENERS_THRESHOLD) {
    findings.push(finding('redirect.chained_shorteners', { count: String(shortenerCount) }, locale));
  }

  const loopHost = detectLoopHost(infos, outcome);
  if (loopHost !== undefined) {
    findings.push(finding('redirect.loop', { host: loopHost }, locale));
  }

  const metaHosts = new Set<string>();
  for (const info of infos) {
    if (info.via === 'html_meta_refresh' && info.host && !metaHosts.has(info.host)) {
      metaHosts.add(info.host);
      findings.push(finding('redirect.meta_refresh', { host: info.host }, locale));
    }
  }

  // Detailed final-URL analysis for a clean resolution only: rerun every URL
  // detector against the destination so a shortener that lands on e.g.
  // https://dnb.no@evil.example/login is surfaced with subject "final".
  let finalUrlBreakdown: UrlBreakdown | undefined;
  if (outcome === 'resolved' && destinationUrl && destinationBreakdown && destinationBreakdown.host) {
    for (const raw of detectUrlFindings(destinationUrl, destinationBreakdown, locale)) {
      if (isDuplicateOfScanned(raw, scannedFindings)) continue;
      findings.push({ ...raw, subject: 'final' as FindingSubject });
    }
    finalUrlBreakdown = destinationBreakdown;
  }

  if (outcome === 'timeout' || outcome === 'network_error' || outcome === 'blocked') {
    limitations.push(limitationFor('limitation.redirect_resolution_failed', { reason: outcome }, locale));
  } else if (outcome === 'max_hops' || outcome === 'loop') {
    limitations.push(limitationFor('limitation.redirect_partial', { hopCount: String(hopCount) }, locale));
  } else if (outcome === 'resolved' && !finalUrlBreakdown) {
    limitations.push(limitationFor('limitation.redirect_partial', { hopCount: String(hopCount) }, locale));
  }

  return {
    analysis: {
      hopCount,
      outcome,
      finalUrl: finalUrlBreakdown,
      domainsTraversed,
      crossedRegistrableDomain,
      downgradedToHttp,
    },
    findings,
    limitations,
  };
}

function actionsFor(verdict: Verdict, findings: Finding[], url?: URL): RecommendedAction[] {
  const actions: RecommendedAction[] = ['copy', 'report'];
  const blocked =
    verdict === 'known_malicious' ||
    findings.some((item) => item.code === 'url.javascript_scheme' || item.code === 'url.data_scheme');
  if (findings.some((item) => item.code === 'url.shortener')) actions.unshift('expand_redirect_online');
  if (blocked) return ['open_blocked', ...actions];
  if (url && (url.protocol === 'https:' || url.protocol === 'http:')) actions.unshift('open_with_confirmation');
  return actions;
}

/** Development-only stand-in until core\bindings\wasm\pkg is produced. */
export class MockSafetyEngine implements SafetyEngine {
  version(): string {
    return 'mock-dev-0.1.0';
  }

  assess(input: AssessInput): Assessment {
    const locale = normaliseLocale(input.locale);
    const rawPayload = input.payload;
    const displayPayload = neutralizeControls(rawPayload);
    const { url, kind } = parsePayload(rawPayload);
    const findings: Finding[] = [];
    const limitations: Limitation[] = [
      limitationFor('limitation.offline_no_reputation', {}, locale),
    ];
    let urlBreakdown: UrlBreakdown | undefined;
    let scannedIsShortener = false;

    if (kind === 'empty') {
      findings.push(finding('payload.empty', {}, locale));
    } else if (!url) {
      findings.push(finding('payload.not_a_url', {}, locale));
    } else {
      urlBreakdown = breakdown(url);
      findings.push(...detectUrlFindings(url, urlBreakdown, locale));
      scannedIsShortener = isShortenerHost(urlBreakdown.host);
      // Offline cue: a shortener hides its destination. Emitting this is what
      // lets the UI offer explicit online expansion. Removed below once the
      // chain has actually been expanded.
      if (scannedIsShortener) {
        limitations.push(limitationFor('limitation.redirect_not_expanded', { service: urlBreakdown.host }, locale));
      }
    }

    // Redirect-chain analysis. Runs only when isolated infrastructure supplied a
    // resolution for a URL payload; absent, behaviour is exactly offline.
    let redirect: RedirectAnalysis | undefined;
    if (input.redirectResolution && url && kind === 'url' && urlBreakdown) {
      const output = analyzeRedirect(
        input.redirectResolution,
        urlBreakdown.registrableDomain,
        scannedIsShortener,
        findings,
        locale,
      );
      // The chain WAS expanded, so the offline "not expanded" cue no longer holds.
      const cueIndex = limitations.findIndex((l) => l.code === 'limitation.redirect_not_expanded');
      if (cueIndex >= 0) limitations.splice(cueIndex, 1);
      findings.push(...output.findings);
      limitations.push(...output.limitations);
      redirect = output.analysis;
    }

    const verdict = verdictFor(findings, kind);
    return {
      schemaVersion: SCHEMA_VERSION,
      payloadKind: kind,
      rawPayload,
      displayPayload,
      url: urlBreakdown,
      redirect,
      findings,
      limitations,
      verdict,
      confidence: findings.some((item) => item.severity === 'critical') ? 0.95 : findings.length > 0 ? 0.76 : 0.62,
      recommendedActions: actionsFor(verdict, findings, url),
      summary: verdictText(verdict, locale).detail,
      engineVersion: this.version(),
      rulesVersion: 'mock-dev-rules',
      locale,
      evaluatedAtMs: input.nowMs,
    };
  }
}
