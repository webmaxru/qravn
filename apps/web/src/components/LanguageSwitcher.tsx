import { languageNames, type Locale } from '../engine/catalog';

interface LanguageSwitcherProps {
  locale: Locale;
  onChange: (locale: Locale) => void;
}

export function LanguageSwitcher({ locale, onChange }: LanguageSwitcherProps) {
  return (
    <fieldset className="language-switcher" aria-label="Language">
      <legend>Language</legend>
      {(['nb', 'nn', 'en'] as const).map((option) => (
        <label key={option}>
          <input
            type="radio"
            name="locale"
            value={option}
            checked={locale === option}
            onChange={() => onChange(option)}
          />
          <span>{option.toUpperCase()}</span>
          <small>{languageNames[option]}</small>
        </label>
      ))}
    </fieldset>
  );
}
