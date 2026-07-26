import { forwardRef } from 'react';
import type { Assessment, RedirectResolution } from '../contracts/assessment';
import type { Locale } from '../engine/catalog';
import { scannedFindings } from '../lib/assessment';
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
}

const OFFLINE_ONLY: OnlineExpansion = { available: false, state: 'idle', onExpand: () => {} };

export const ResultPanel = forwardRef<HTMLDivElement, ResultPanelProps>(function ResultPanel(
  { assessment, locale, redirectResolution = null, online = OFFLINE_ONLY },
  ref,
) {
  // Findings about the final destination are rendered by RedirectPanel, kept
  // visually separate from findings about the scanned URL. Conflating them would
  // make the UI lie about which URL a claim is really about.
  const scanned = scannedFindings(assessment.findings);

  return (
    <div className="result-stack" aria-live="polite" aria-atomic="false" tabIndex={-1} ref={ref} data-testid="result-region">
      <VerdictBanner verdict={assessment.verdict} summary={assessment.summary} locale={locale} />
      <section className="panel" aria-labelledby="payload-heading">
        <h2 id="payload-heading">Payload text</h2>
        <p className="payload-display">{assessment.displayPayload}</p>
        <details>
          <summary>Show raw payload as inert text</summary>
          <pre>{assessment.rawPayload}</pre>
        </details>
      </section>
      {assessment.url ? <UrlBreakdownView url={assessment.url} /> : null}
      <RedirectPanel assessment={assessment} resolution={redirectResolution} locale={locale} online={online} />
      <FindingsList findings={scanned} locale={locale} />
      <LimitationsList limitations={assessment.limitations} />
      <Actions assessment={assessment} />
    </div>
  );
});
