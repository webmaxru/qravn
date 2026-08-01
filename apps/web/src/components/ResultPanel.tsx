import { forwardRef } from 'react';
import type { Assessment, RedirectResolution } from '../contracts/assessment';
import { textForCode, type Locale } from '../engine/catalog';
import { hasRedirectCue, scannedFindings } from '../lib/assessment';
import { Actions } from './Actions';
import { FindingsList } from './FindingsList';
import { LimitationsList } from './LimitationsList';
import { RedirectPanel, type OnlineExpansion } from './RedirectPanel';
import { UrlBreakdownView } from './UrlBreakdownView';
import { VerdictBanner } from './VerdictBanner';

interface ResultPanelProps {
  assessment: Assessment;
  locale: Locale;
  /** Raw resolution from the resolver, kept for rendering the individual hops. */
  redirectResolution?: RedirectResolution | null;
  /** Online expansion wiring. Absent means the feature is unavailable. */
  online?: OnlineExpansion;
  /** Strict local-only mode; used to surface redirect limitations next to results. */
  offlineMode?: boolean;
}

const OFFLINE_ONLY: OnlineExpansion = { available: false, state: 'idle', onExpand: () => {} };

export const ResultPanel = forwardRef<HTMLDivElement, ResultPanelProps>(function ResultPanel(
  { assessment, locale, redirectResolution = null, online = OFFLINE_ONLY, offlineMode = false },
  ref,
) {
  // Findings about the final destination are rendered by RedirectPanel, kept
  // visually separate from findings about the scanned URL. Conflating them would
  // make the UI lie about which URL a claim is really about.
  const scanned = scannedFindings(assessment.findings);
  const redirectCue = hasRedirectCue(assessment);
  const redirectWarning = textForCode('ui.possible_redirect_warning', {}, locale);
  const offlineLimitation = textForCode('ui.offline_redirect_limitation', {}, locale);

  // The exact text of the code is evidence, not the answer. When there is an
  // address to show, "where does this go" comes first and the raw text moves to
  // the bottom. When there is no address, the text is all there is, so it leads.
  const payloadPanel = (
    <section className="panel payload" aria-labelledby="payload-heading">
      <h2 id="payload-heading">{textForCode('ui.payload_heading', {}, locale).title}</h2>
      <p className="payload-display">{assessment.displayPayload}</p>
      <details>
        <summary>{textForCode('ui.raw_payload', {}, locale).title}</summary>
        <pre>{assessment.rawPayload}</pre>
      </details>
    </section>
  );

  return (
    <div className="result-stack" aria-live="polite" aria-atomic="false" tabIndex={-1} ref={ref} data-testid="result-region">
      <VerdictBanner verdict={assessment.verdict} summary={assessment.summary} locale={locale} />
      {redirectCue ? (
        <section
          className="panel possible-redirect-warning"
          role="status"
          aria-labelledby="possible-redirect-warning-heading"
        >
          <h2 id="possible-redirect-warning-heading">{redirectWarning.title}</h2>
          {redirectWarning.detail ? <p>{redirectWarning.detail}</p> : null}
        </section>
      ) : null}
      {offlineMode && redirectCue ? (
        <section className="panel offline-limitation" role="note" aria-labelledby="result-offline-limitation-heading">
          <h2 id="result-offline-limitation-heading">{offlineLimitation.title}</h2>
          {offlineLimitation.detail ? <p>{offlineLimitation.detail}</p> : null}
        </section>
      ) : null}
      {assessment.url ? <UrlBreakdownView url={assessment.url} locale={locale} /> : payloadPanel}
      <RedirectPanel assessment={assessment} resolution={redirectResolution} locale={locale} online={online} />
      <FindingsList findings={scanned} locale={locale} />
      {assessment.limitations.length ? (
        <LimitationsList limitations={assessment.limitations} locale={locale} />
      ) : null}
      <Actions assessment={assessment} locale={locale} />
      {assessment.url ? payloadPanel : null}
    </div>
  );
});
