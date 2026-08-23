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
  'url.possible_shortener': {
    title: 'Possible shortened link',
    detail:
      'The domain and short code look like a redirecting link, but this service is not in the known shortener list. The final destination is not visible until redirect expansion is checked. Observed value: {host}.',
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

// UI chrome for explicit online (redirect-expansion) mode.
//
// This English copy is a last-resort fallback only. The real strings live in
// localization/{nb,nn,en}.json and are spread over this map in
// embeddedCatalogs, so a Norwegian user sees Norwegian. tools/validate-l10n.mjs
// lists every one of these codes, so the build fails if a locale is missing
// one - an English string reaching a Bokmal or Nynorsk user is a defect in an
// app aimed at Norway, not a cosmetic gap.
const uiTexts: Catalog = {
  'online.expand_heading': {
    title: 'Check where this link ends up',
    detail: '',
  },
  'online.disclosure': {
    title: 'Before you continue',
    detail:
      'This link is sent to our own server, which follows it for you. This device does not open or contact the link.',
  },
  'online.expand_button': {
    title: 'See where this link goes',
    detail: '',
  },
  'online.resolving': {
    title: 'Checking where it goes…',
    detail: 'This device is not contacting the link.',
  },
  'online.section_heading': {
    title: 'Where this link leads',
    detail: '',
  },
  'online.path_label': {
    title: 'Path it followed',
    detail: '',
  },
  'online.final_findings_heading': {
    title: 'Warnings about the final destination',
    detail: '',
  },
  'online.final_badge': {
    title: 'Final destination',
    detail: '',
  },
  'online.outcome_resolved': {
    title: 'Followed to the final destination',
    detail:
      'We followed the redirects for you. This does not mean the destination is safe — read the findings below.',
  },
  'online.outcome_max_hops': {
    title: 'Stopped: too many redirects',
    detail:
      'This link was judged untrusted because it kept redirecting past the safe limit of 5 hops.',
  },
  'online.outcome_incomplete': {
    title: 'Could not finish expanding this link',
    detail: 'Your device still did not contact the link. See what could not be determined below.',
  },
  'online.error': {
    title: 'The link could not be checked',
    detail:
      'Something went wrong on our side. This device did not contact the link. You can try again.',
  },
  'online.retry_button': {
    title: 'Try again',
    detail: '',
  },
  'ui.offline_redirect_limitation': {
    title: 'Redirects cannot be followed in offline mode',
    detail: 'The final destination may be unknown unless you turn off offline mode and choose redirect expansion.',
  },
  'ui.possible_redirect_warning': {
    title: 'Possibly a redirect',
    detail:
      'This may send you to a different final destination. That does not mean the link is safe or unsafe by itself.',
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
  en: { ...findingTexts, ...verdictTexts, ...uiTexts, ...externalCatalog('en') },
  nb: { ...findingTexts, ...verdictTexts, ...uiTexts, ...nbOverrides, ...externalCatalog('nb') },
  nn: { ...findingTexts, ...verdictTexts, ...uiTexts, ...nnOverrides, ...externalCatalog('nn') },
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
