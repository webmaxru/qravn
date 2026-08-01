import type { Limitation } from '../contracts/assessment';
import { textForCode, type Locale } from '../engine/catalog';
import { t } from '../lib/uiText';

interface LimitationsListProps {
  limitations: Limitation[];
  locale: Locale;
}

export function LimitationsList({ limitations, locale }: LimitationsListProps) {
  return (
    <section className="panel limitations" aria-labelledby="limitations-heading">
      <h2 id="limitations-heading">{t('ui.limitations', locale)}</h2>
      <ul>
        {limitations.map((limitation) => {
          // The core leaves `text` empty whenever it has no localized string of
          // its own, which put bare contract codes like
          // "limitation.offline_no_reputation" in front of the reader. The
          // catalog has a translated sentence for every registry code, so fall
          // back to that rather than to the code.
          const fallback = textForCode(limitation.code, limitation.params, locale);
          return (
            <li key={limitation.code}>
              <strong>{fallback.title}</strong>
              {limitation.text ? <p>{limitation.text}</p> : fallback.detail ? <p>{fallback.detail}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
