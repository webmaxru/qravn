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
  const [notice, setNotice] = useState('');
  const blocked = isOpenBlocked(assessment.recommendedActions);
  const canCopy = assessment.recommendedActions.includes('copy');
  const isOpenableUrl = Boolean(assessment.url && isUrlOpenable(assessment.rawPayload));
  const canOpen = !blocked && isOpenableUrl && assessment.recommendedActions.includes('open_allowed');
  const needsConfirmation =
    !blocked && isOpenableUrl && assessment.recommendedActions.includes('open_with_confirmation');
  const canPrepareOpen = canOpen || needsConfirmation;

  const host = assessment.url?.host ?? '';
  const blockedNote = td('ui.open_blocked', locale);

  async function copyLink(fallbackFromShare = false) {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(assessment.rawPayload);
      setNotice(t(fallbackFromShare ? 'ui.share_fallback' : 'ui.link_copied', locale));
    } catch {
      setNotice(t('ui.copy_failed', locale));
    }
  }

  async function shareLink() {
    if (!navigator.share) {
      await copyLink(true);
      return;
    }
    try {
      await navigator.share({ url: assessment.rawPayload });
      setNotice('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNotice(t('ui.share_failed', locale));
    }
  }

  return (
    <section className="panel actions" aria-labelledby="actions-heading">
      <h2 id="actions-heading">{t('ui.actions', locale)}</h2>
      {blocked ? (
        <p className="blocked-note">
          {blockedNote.title}. {blockedNote.detail}
        </p>
      ) : null}
      <div className="action-primary">
        {canPrepareOpen && !confirmed ? (
          <button
            type="button"
            className={needsConfirmation ? 'secondary-danger' : 'primary-action'}
            onClick={() => setConfirmed(true)}
          >
            {t('ui.open_link', locale)}
          </button>
        ) : null}
        {canPrepareOpen && confirmed ? (
          <a
            className={`open-link ${needsConfirmation ? 'open-link--warning' : 'primary-action'}`}
            href={assessment.rawPayload}
            target="_blank"
            rel="noopener noreferrer"
          >
            {textForCode('ui.open_new_tab', { host }, locale).title}
          </a>
        ) : null}
      </div>
      <div className="action-links">
        {canCopy ? (
          <button type="button" className="action-link" onClick={() => void copyLink()}>
            {t(assessment.url ? 'ui.copy_link' : 'ui.copy', locale)}
          </button>
        ) : null}
        {assessment.url ? (
          <button type="button" className="action-link" onClick={() => void shareLink()}>
            {t('ui.share_link', locale)}
          </button>
        ) : null}
      </div>
      {notice ? <p className="action-notice" role="status">{notice}</p> : null}
    </section>
  );
}
