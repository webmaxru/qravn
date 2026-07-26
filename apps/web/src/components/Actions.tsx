import { useState } from 'react';
import type { Assessment } from '../contracts/assessment';
import { isOpenBlocked, isUrlOpenable } from '../lib/assessment';

interface ActionsProps {
  assessment: Assessment;
}

export function Actions({ assessment }: ActionsProps) {
  const [confirmed, setConfirmed] = useState(false);
  const blocked = isOpenBlocked(assessment.recommendedActions);
  const canCopy = assessment.recommendedActions.includes('copy');
  const canPrepareOpen =
    !blocked &&
    assessment.url &&
    isUrlOpenable(assessment.rawPayload) &&
    assessment.recommendedActions.some((action) => action === 'open_allowed' || action === 'open_with_confirmation');

  return (
    <section className="panel actions" aria-labelledby="actions-heading">
      <h2 id="actions-heading">Actions</h2>
      {blocked ? <p className="blocked-note">Opening is blocked by this verdict.</p> : null}
      <div className="action-row">
        {canCopy ? <button type="button" onClick={() => void navigator.clipboard?.writeText(assessment.rawPayload)}>Copy payload</button> : null}
        {canPrepareOpen && !confirmed ? (
          <button type="button" className="secondary-danger" onClick={() => setConfirmed(true)}>
            I understand — prepare opening {assessment.url?.host}
          </button>
        ) : null}
        {canPrepareOpen && confirmed ? (
          <a className="open-link" href={assessment.rawPayload} target="_blank" rel="noopener noreferrer">
            Open {assessment.url?.host} in a new tab
          </a>
        ) : null}
      </div>
    </section>
  );
}
