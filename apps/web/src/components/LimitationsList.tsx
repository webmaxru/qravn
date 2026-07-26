import type { Limitation } from '../contracts/assessment';

interface LimitationsListProps {
  limitations: Limitation[];
}

export function LimitationsList({ limitations }: LimitationsListProps) {
  return (
    <section className="panel limitations" aria-labelledby="limitations-heading">
      <h2 id="limitations-heading">What this check could not determine</h2>
      <ul>
        {limitations.map((limitation) => (
          <li key={limitation.code}>{limitation.text || limitation.code}</li>
        ))}
      </ul>
    </section>
  );
}
