import { forwardRef } from 'react';
import type { Assessment } from '../contracts/assessment';
import type { Locale } from '../engine/catalog';
import { Actions } from './Actions';
import { FindingsList } from './FindingsList';
import { LimitationsList } from './LimitationsList';
import { UrlBreakdownView } from './UrlBreakdownView';
import { VerdictBanner } from './VerdictBanner';

interface ResultPanelProps {
  assessment: Assessment;
  locale: Locale;
}

export const ResultPanel = forwardRef<HTMLDivElement, ResultPanelProps>(function ResultPanel({ assessment, locale }, ref) {
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
      <FindingsList findings={assessment.findings} locale={locale} />
      <LimitationsList limitations={assessment.limitations} />
      <Actions assessment={assessment} />
    </div>
  );
});
