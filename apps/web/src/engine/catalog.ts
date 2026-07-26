import type { Finding, Severity, Verdict } from '../contracts/assessment';

export type Locale = 'nb' | 'nn' | 'en';
export type Catalog = Record<string, { title: string; detail: string }>;
export type Catalogs = Record<Locale, Catalog>;

const findingTexts: Catalog = {
  'url.credentials_in_authority': {
    title: 'Credentials before @ hide the real destination',
    detail: 'The text before @ is login information, not the website. The browser goes to {host}.',
  },
  'url.ip_literal_host': {
    title: 'IP address used instead of a domain',
    detail: 'The host is the numeric address {host}, which is harder to recognise than a normal domain.',
  },
  'url.punycode_host': {
    title: 'Internationalised domain uses Punycode',
    detail: '{punycodeHost} may display differently as {unicodeHost}. Attackers use this to imitate brands.',
  },
  'url.brand_in_subdomain': {
    title: 'Brand name is only in a subdomain',
    detail: '{brand} appears before the real registered domain {registrableDomain}.',
  },
  'url.brand_in_path': {
    title: 'Brand name appears in the path',
    detail: 'The path mentions {brand}, but paths do not identify who owns the website.',
  },
  'url.hyphenated_brand_domain': {
    title: 'Domain appears to imitate a Norwegian brand',
    detail: '{registrableDomain} combines a known brand with extra words.',
  },
  'url.insecure_scheme': {
    title: 'Uses HTTP, not HTTPS',
    detail: 'HTTP does not protect the contents or destination from network tampering.',
  },
  'url.javascript_scheme': {
    title: 'JavaScript payload',
    detail: 'This payload could run script if opened and should not be opened from a QR code.',
  },
  'url.data_scheme': {
    title: 'Data URL payload',
    detail: 'Data URLs embed content directly and can hide what will be shown or executed.',
  },
  'url.shortener': {
    title: 'Shortened link',
    detail: '{service} hides the final destination. This local check does not expand redirects.',
  },
  'url.known_malicious': {
    title: 'Known malicious test rule matched',
    detail: 'The development rule {ruleId} matched this payload.',
  },
  'payload.not_a_url': {
    title: 'Not a web URL',
    detail: 'The payload was rendered as text only. This checker could not identify it as a normal URL.',
  },
  'payload.empty': {
    title: 'No payload entered',
    detail: 'Paste the text from a QR code or a suspicious link before checking.',
  },
};

const verdictTexts: Catalog = {
  'verdict.known_malicious': {
    title: 'Known malicious',
    detail: 'Evidence matched a high-confidence malicious pattern. Do not open this destination.',
  },
  'verdict.suspicious': {
    title: 'Suspicious',
    detail: 'This payload has warning signs. Review the evidence before doing anything else.',
  },
  'verdict.insufficient_evidence': {
    title: 'Insufficient evidence',
    detail: 'This local check could not determine enough to make a stronger verdict.',
  },
  'verdict.no_known_threat_found': {
    title: 'No known threat found',
    detail: 'No local rule found a known threat. This is not a guarantee that the destination is safe.',
  },
};

const nbOverrides: Catalog = {
  'verdict.known_malicious': { title: 'Kjent skadelig', detail: 'Bevis matcher et skadelig mønster. Ikke åpne målet.' },
  'verdict.suspicious': { title: 'Mistenkelig', detail: 'Denne teksten har faresignaler. Les bevisene før du gjør noe mer.' },
  'verdict.insufficient_evidence': { title: 'Ikke nok bevis', detail: 'Den lokale sjekken kan ikke avgjøre nok til en sterkere vurdering.' },
  'verdict.no_known_threat_found': { title: 'Ingen kjent trussel funnet', detail: 'Ingen lokal regel fant en kjent trussel. Dette er ingen garanti for trygghet.' },
  'payload.not_a_url': { title: 'Ikke en nettadresse', detail: 'Innholdet vises bare som tekst. Sjekken gjenkjente ikke en vanlig URL.' },
};

const nnOverrides: Catalog = {
  'verdict.known_malicious': { title: 'Kjent skadeleg', detail: 'Bevis passar eit skadeleg mønster. Ikkje opne målet.' },
  'verdict.suspicious': { title: 'Mistenkjeleg', detail: 'Denne teksten har faresignal. Les bevisa før du gjer noko meir.' },
  'verdict.insufficient_evidence': { title: 'Ikkje nok bevis', detail: 'Den lokale sjekken kan ikkje avgjere nok til ei sterkare vurdering.' },
  'verdict.no_known_threat_found': { title: 'Ingen kjend trussel funnen', detail: 'Ingen lokal regel fann ein kjend trussel. Dette er ingen garanti for tryggleik.' },
  'payload.not_a_url': { title: 'Ikkje ei nettadresse', detail: 'Innhaldet blir berre vist som tekst. Sjekken kjende ikkje att ein vanleg URL.' },
};

const externalCatalogModules = import.meta.glob('../../../../localization/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Catalog>;

function externalCatalog(locale: Locale): Catalog {
  const match = Object.entries(externalCatalogModules).find(([path]) => path.endsWith(`${locale}.json`));
  return match?.[1] ?? {};
}

export const embeddedCatalogs: Catalogs = {
  en: { ...findingTexts, ...verdictTexts, ...externalCatalog('en') },
  nb: { ...findingTexts, ...verdictTexts, ...nbOverrides, ...externalCatalog('nb') },
  nn: { ...findingTexts, ...verdictTexts, ...nnOverrides, ...externalCatalog('nn') },
};

export const languageNames: Record<Locale, string> = {
  nb: 'Bokmål',
  nn: 'Nynorsk',
  en: 'English',
};

export const severityRank: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export const severityLabels: Record<Locale, Record<Severity, string>> = {
  en: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' },
  nb: { critical: 'Kritisk', high: 'Høy', medium: 'Middels', low: 'Lav', info: 'Info' },
  nn: { critical: 'Kritisk', high: 'Høg', medium: 'Middels', low: 'Låg', info: 'Info' },
};

export function normaliseLocale(locale?: string): Locale {
  return locale === 'nb' || locale === 'nn' ? locale : 'en';
}

export function interpolate(template: string, params: Record<string, string>): string {
  return template.replaceAll(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => params[key] ?? '');
}

export function textForCode(code: string, params: Record<string, string>, locale: Locale): { title: string; detail: string } {
  const entry = embeddedCatalogs[locale][code] ?? embeddedCatalogs.en[code];
  if (!entry) return { title: code, detail: '' };
  return {
    title: interpolate(entry.title, params),
    detail: interpolate(entry.detail, params),
  };
}

export function localizeFinding(finding: Finding, locale: Locale): Finding {
  const fallback = textForCode(finding.code, finding.params, locale);
  return {
    ...finding,
    title: finding.title || fallback.title,
    detail: finding.detail || fallback.detail,
  };
}

export function verdictText(verdict: Verdict, locale: Locale): { title: string; detail: string } {
  return textForCode(`verdict.${verdict}`, {}, locale);
}
