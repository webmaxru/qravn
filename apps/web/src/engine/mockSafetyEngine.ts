import {
  SCHEMA_VERSION,
  type Assessment,
  type AssessInput,
  type Finding,
  type PayloadKind,
  type RecommendedAction,
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
  'payload.not_a_url': 'info',
  'payload.empty': 'info',
};

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

function actionsFor(verdict: Verdict, findings: Finding[], url?: URL): RecommendedAction[] {
  const actions: RecommendedAction[] = ['copy', 'report'];
  const blocked =
    verdict === 'known_malicious' ||
    findings.some((item) => item.code === 'url.javascript_scheme' || item.code === 'url.data_scheme');
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
    let urlBreakdown: UrlBreakdown | undefined;

    if (kind === 'empty') {
      findings.push(finding('payload.empty', {}, locale));
    } else if (!url) {
      findings.push(finding('payload.not_a_url', {}, locale));
    } else {
      urlBreakdown = breakdown(url);
      const host = urlBreakdown.host.toLowerCase();
      const registrableDomain = urlBreakdown.registrableDomain ?? host;

      if (url.protocol === 'javascript:') findings.push(finding('url.javascript_scheme', {}, locale));
      if (url.protocol === 'data:') findings.push(finding('url.data_scheme', {}, locale));
      if (url.protocol === 'http:') findings.push(finding('url.insecure_scheme', {}, locale));
      if (urlBreakdown.hasCredentials) {
        findings.push(finding('url.credentials_in_authority', { username: urlBreakdown.username ?? '', host: urlBreakdown.host }, locale));
      }
      if (urlBreakdown.isIpLiteral) findings.push(finding('url.ip_literal_host', { host: urlBreakdown.host }, locale));
      if (urlBreakdown.hasPunycode) {
        findings.push(
          finding('url.punycode_host', { punycodeHost: urlBreakdown.host, unicodeHost: urlBreakdown.unicodeHost ?? urlBreakdown.host }, locale),
        );
      }
      if (shorteners.has(host)) findings.push(finding('url.shortener', { service: shorteners.get(host) ?? host }, locale));

      const subdomainText = urlBreakdown.subdomains.join('.');
      const pathText = decodeURIComponent(url.pathname).toLowerCase();
      for (const brand of norwegianBrands) {
        const ownsDomain = brandOwnedDomains.has(registrableDomain);
        if (!ownsDomain && subdomainText.split(/[.-]/).includes(brand)) {
          findings.push(finding('url.brand_in_subdomain', { brand, registrableDomain }, locale));
        }
        if (!ownsDomain && registrableDomain.includes(`${brand}-`)) {
          findings.push(finding('url.hyphenated_brand_domain', { brand, registrableDomain }, locale));
        }
        if (!ownsDomain && pathText.includes(brand)) findings.push(finding('url.brand_in_path', { brand }, locale));
      }

      if (host === 'dnb-secure-login.example' || host === 'vipps-verification.example') {
        findings.push(finding('url.known_malicious', { ruleId: 'mock-norway-brand-impersonation' }, locale));
      }
    }

    const verdict = verdictFor(findings, kind);
    return {
      schemaVersion: SCHEMA_VERSION,
      payloadKind: kind,
      rawPayload,
      displayPayload,
      url: urlBreakdown,
      findings,
      limitations: [
        {
          code: 'limitation.offline_no_reputation',
          params: {},
          text:
            locale === 'en'
              ? 'This browser-only check did not contact reputation services or expand redirects.'
              : 'Denne lokale sjekken kontaktet ikke omdømmetjenester eller fulgte videresendinger.',
        },
      ],
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
