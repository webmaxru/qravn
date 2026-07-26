import type { Assessment, RedirectOutcome, RedirectResolution } from '../contracts/assessment';
import { textForCode, type Locale } from '../engine/catalog';
import { finalFindings, hasRedirectCue, neutralizeForDisplay } from '../lib/assessment';
import { FindingItems } from './FindingsList';
import './RedirectPanel.css';

export type ExpansionState = 'idle' | 'resolving' | 'error';

export interface OnlineExpansion {
  /** Whether the resolver is configured. When false, expansion is not offered. */
  available: boolean;
  state: ExpansionState;
  onExpand: () => void;
}

interface RedirectPanelProps {
  assessment: Assessment;
  /** The raw resolution, kept so the individual hops can be shown. */
  resolution: RedirectResolution | null;
  locale: Locale;
  online: OnlineExpansion;
}

/** Map the six resolver outcomes onto the three ways we frame the result. */
function outcomeFraming(outcome: RedirectOutcome): { key: string; kind: 'resolved' | 'untrusted' | 'incomplete' } {
  switch (outcome) {
    case 'resolved':
      return { key: 'online.outcome_resolved', kind: 'resolved' };
    case 'max_hops':
      // The user's stated rule: past 5 redirects, stop and treat as untrusted.
      return { key: 'online.outcome_max_hops', kind: 'untrusted' };
    default:
      // timeout | network_error | blocked | loop — never reassuring; the precise
      // reason is carried by the localized limitation in the limitations panel.
      return { key: 'online.outcome_incomplete', kind: 'incomplete' };
  }
}

/**
 * Renders explicit online (redirect-expansion) mode:
 *   * the per-check opt-in with its privacy disclosure, when the offline check
 *     flagged a shortener and a resolver is configured; or
 *   * the expanded result — final destination, the path it took, why it was
 *     judged, and any findings about the destination (kept visually separate
 *     from findings about the scanned link).
 * Renders nothing when neither applies, so offline behaviour is unchanged.
 */
export function RedirectPanel({ assessment, resolution, locale, online }: RedirectPanelProps) {
  const redirect = assessment.redirect;

  if (redirect) {
    const framing = outcomeFraming(redirect.outcome);
    const outcomeText = textForCode(framing.key, {}, locale);
    const destinationLabel = textForCode('ui.real_destination', {}, locale).title;
    const sectionTitle = textForCode('online.section_heading', {}, locale).title;
    const pathTitle = textForCode('online.path_label', {}, locale).title;
    const finalWarnings = finalFindings(assessment.findings);
    const finalBadge = textForCode('online.final_badge', {}, locale).title;
    const finalHeading = textForCode('online.final_findings_heading', {}, locale).title;
    const hops = resolution?.chain ?? [];

    return (
      <>
        <section className="panel redirect-result" aria-labelledby="redirect-heading">
          <h2 id="redirect-heading">{sectionTitle}</h2>

          <div className={`redirect-outcome redirect-outcome--${framing.kind}`}>
            <strong>{outcomeText.title}</strong>
            {outcomeText.detail ? <p>{outcomeText.detail}</p> : null}
          </div>

          {redirect.finalUrl ? (
            <div className="destination-host redirect-final-host">
              <p className="eyebrow">{destinationLabel}</p>
              <p className="redirect-final-host__value">{neutralizeForDisplay(redirect.finalUrl.host)}</p>
              {redirect.finalUrl.registrableDomain ? (
                <p className="redirect-final-host__domain">{neutralizeForDisplay(redirect.finalUrl.registrableDomain)}</p>
              ) : null}
            </div>
          ) : null}

          {redirect.domainsTraversed.length ? (
            <div className="redirect-path">
              <p className="eyebrow" id="redirect-path-label">{pathTitle}</p>
              <ol className="hop-chain" aria-labelledby="redirect-path-label">
                {redirect.domainsTraversed.map((domain, index) => (
                  <li key={`${domain}-${index}`}>{neutralizeForDisplay(domain)}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {hops.length ? (
            <details className="redirect-hops">
              <summary>Show each step</summary>
              <ol>
                {hops.map((hop, index) => (
                  <li key={`hop-${index}`}>
                    <code>{neutralizeForDisplay(hop.url) || '(empty)'}</code>
                    {typeof hop.status === 'number' ? <span className="hop-status"> · {hop.status}</span> : null}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </section>

        {finalWarnings.length ? (
          <section className="panel redirect-final-findings" aria-labelledby="redirect-final-heading">
            <h2 id="redirect-final-heading">{finalHeading}</h2>
            <FindingItems findings={finalWarnings} locale={locale} subjectBadge={finalBadge} />
          </section>
        ) : null}
      </>
    );
  }

  // No expansion yet: offer the opt-in only when the offline check flagged a
  // shortener AND a resolver is configured. Otherwise render nothing (the
  // offline `limitation.redirect_not_expanded` still explains the situation).
  if (!hasRedirectCue(assessment) || !online.available) return null;

  const heading = textForCode('online.expand_heading', {}, locale).title;
  const disclosure = textForCode('online.disclosure', {}, locale);
  const buttonLabel = textForCode('online.expand_button', {}, locale).title;
  const resolving = textForCode('online.resolving', {}, locale);
  const errorText = textForCode('online.error', {}, locale);
  const retryLabel = textForCode('online.retry_button', {}, locale).title;
  const isResolving = online.state === 'resolving';

  return (
    <section className="panel redirect-optin" aria-labelledby="redirect-optin-heading">
      <h2 id="redirect-optin-heading">{heading}</h2>
      <div className="redirect-disclosure" role="note">
        <strong>{disclosure.title}</strong>
        <p>{disclosure.detail}</p>
      </div>

      {online.state === 'error' ? (
        <div className="redirect-error">
          <p><strong>{errorText.title}</strong></p>
          {errorText.detail ? <p>{errorText.detail}</p> : null}
          <button type="button" className="secondary-danger" onClick={online.onExpand}>
            {retryLabel}
          </button>
        </div>
      ) : (
        <div className="redirect-optin-actions">
          <button type="button" className="primary-action" onClick={online.onExpand} disabled={isResolving}>
            {buttonLabel}
          </button>
          {isResolving ? (
            <p className="redirect-resolving">
              <strong>{resolving.title}</strong> {resolving.detail}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
