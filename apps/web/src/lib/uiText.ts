import { normaliseLocale, textForCode, type Locale } from '../engine/catalog';

/**
 * The locales the web app offers. The catalogs and the Android app still carry
 * Nynorsk, but a two-way choice is the whole point of the control: a switcher
 * with three options costs more attention than it returns on a phone.
 * A Nynorsk browser gets Bokmål chrome rather than English.
 */
export const OFFERED_LOCALES = ['nb', 'en'] as const;
export type OfferedLocale = (typeof OFFERED_LOCALES)[number];

/** What the user sees. "NO" reads as a country, which is what people look for. */
export const localeLabels: Record<OfferedLocale, string> = { nb: 'NO', en: 'EN' };

const LOCALE_STORAGE_KEY = 'qravn.locale';

/**
 * Norwegian first. The app is for people in Norway, so a Norwegian browser must
 * not have to find a control to be understood — defaulting to English would put
 * a language barrier in front of the one screen that has to work in two seconds.
 */
export function detectLocale(): OfferedLocale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'nb' || stored === 'en') return stored;
  } catch {
    // Private mode and blocked storage both land here; fall through to sniffing.
  }
  const tags = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of tags) {
    const primary = (tag ?? '').toLowerCase().split('-')[0];
    if (primary === 'no' || primary === 'nb' || primary === 'nn') return 'nb';
    if (primary === 'en') return 'en';
  }
  return 'en';
}

export function storeLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normaliseLocale(locale));
  } catch {
    // Remembering the choice is a convenience, not a requirement.
  }
}

/** Title-only lookup, which is what almost every piece of chrome needs. */
export function t(code: string, locale: Locale): string {
  return textForCode(code, {}, locale).title;
}

/** Title and detail together, for the few places that show both. */
export function td(code: string, locale: Locale): { title: string; detail: string } {
  return textForCode(code, {}, locale);
}
