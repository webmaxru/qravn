import { BrandMark } from './BrandMark';
import { localeLabels, OFFERED_LOCALES, t } from '../lib/uiText';
import type { Locale } from '../engine/catalog';

interface AppBarProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

/**
 * One bar, one job: say what this is, and let a Norwegian reader switch in one
 * tap. The previous control was a bordered radio card holding three options and
 * their full language names, which took roughly a fifth of the first screen on a
 * phone — space the scan target needs far more than a language does.
 */
export function AppBar({ locale, onLocaleChange }: AppBarProps) {
  const active = locale === 'en' ? 'en' : 'nb';

  return (
    <header className="app-bar">
      <p className="brand-lockup">
        <BrandMark />
        <span className="brand-wordmark">QRavn</span>
      </p>
      <div className="lang-toggle" role="group" aria-label={t('ui.language', locale)}>
        {OFFERED_LOCALES.map((option) => (
          <button
            key={option}
            type="button"
            className="lang-toggle__option"
            aria-pressed={active === option}
            lang={option}
            onClick={() => onLocaleChange(option)}
          >
            {localeLabels[option]}
          </button>
        ))}
      </div>
    </header>
  );
}
