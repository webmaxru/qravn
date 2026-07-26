import type { Verdict } from '../contracts/assessment';
import { verdictText, type Locale } from '../engine/catalog';

const verdictIcons: Record<Verdict, string> = {
  known_malicious: '⛔',
  suspicious: '⚠️',
  insufficient_evidence: '？',
  no_known_threat_found: '✓',
};

interface VerdictBannerProps {
  verdict: Verdict;
  summary: string;
  locale: Locale;
}

export function VerdictBanner({ verdict, summary, locale }: VerdictBannerProps) {
  const text = verdictText(verdict, locale);
  return (
    <section className={`verdict verdict--${verdict}`} aria-labelledby="verdict-heading" role="status">
      <span className="verdict__icon" aria-hidden="true">{verdictIcons[verdict]}</span>
      <div>
        <p className="eyebrow">Verdict</p>
        <h2 id="verdict-heading">{text.title}</h2>
        <p>{summary || text.detail}</p>
      </div>
    </section>
  );
}
