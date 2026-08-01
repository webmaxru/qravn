import { useState } from 'react';
import type { Assessment } from '../contracts/assessment';
import { textForCode, type Locale } from '../engine/catalog';
import { isOpenBlocked, isUrlOpenable } from '../lib/assessment';
import { t, td } from '../lib/uiText';

interface ActionsProps {
  assessment: Assessment;
  locale: Locale;
}

export function Actions({ assessment, locale }: ActionsProps) {
  const [confirmed, setConfirmed] = useState(false);
  const blocked = isOpenBlocked(assessment.recommendedActions);
  const canCopy = assessment.recommendedActions.includes('copy');
  const canPrepareOpen =
    !blocked &&
    assessment.url &&
    isUrlOpenable(assessment.rawPayload) &&
    assessment.recommendedActions.some((action) => action === 'open_allowed' || action === 'open_with_confirmation');

  const host = assessment.url?.host ?? '';
  const blockedNote = td('ui.open_blocked', locale);

  return (
    <section className="panel actions" aria-labelledby="actions-heading">
      <h2 id="actions-heading">{t('ui.actions', locale)}</h2>
      {blocked ? (
        <p className="blocked-note">
          {blockedNote.title}. {blockedNote.detail}
        </p>
      ) : null}
      <div className="action-row">
        {canCopy ? (
          <button type="button" onClick={() => void navigator.clipboard?.writeText(assessment.rawPayload)}>
            {t('ui.copy', locale)}
          </button>
        ) : null}
        {canPrepareOpen && !confirmed ? (
          <button type="button" className="secondary-danger" onClick={() => setConfirmed(true)}>
            {textForCode('ui.open_anyway', { host }, locale).title}
          </button>
        ) : null}
        {canPrepareOpen && confirmed ? (
          <a className="open-link" href={assessment.rawPayload} target="_blank" rel="noopener noreferrer">
            {textForCode('ui.open_new_tab', { host }, locale).title}
          </a>
        ) : null}
      </div>
    </section>
  );
}
