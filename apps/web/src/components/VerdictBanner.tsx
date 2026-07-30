import type { Verdict } from '../contracts/assessment';
import { verdictText, type Locale } from '../engine/catalog';

/**
 * "No known threat found" gets an empty ring rather than a tick, and matches
 * the Android drawable ic_verdict_clear. A tick reads as "approved", which is
 * a promise this app is never in a position to make: it can only report that
 * it looked and found nothing. The emptiness is the message.
 */
const verdictIcons: Record<Verdict, string> = {
  known_malicious: '⛔',
  suspicious: '⚠️',
  insufficient_evidence: '？',
  no_known_threat_found: '◯',
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
