import type { Finding } from '../contracts/assessment';
import { localizeFinding, severityLabels, type Locale } from '../engine/catalog';
import { sortFindingsBySeverity } from '../lib/assessment';

interface FindingsListProps {
  findings: Finding[];
  locale: Locale;
}

export function FindingsList({ findings, locale }: FindingsListProps) {
  const sorted = sortFindingsBySeverity(findings).map((item) => localizeFinding(item, locale));
  return (
    <section className="panel" aria-labelledby="findings-heading">
      <h2 id="findings-heading">Evidence findings</h2>
      {sorted.length ? (
        <ul className="finding-list">
          {sorted.map((finding) => (
            <li key={`${finding.code}-${finding.detail}`} className={`finding finding--${finding.severity}`}>
              <span className="severity-badge">{severityLabels[locale][finding.severity]}</span>
              <div>
                <h3>{finding.title || finding.code}</h3>
                {finding.detail ? <p>{finding.detail}</p> : null}
                <code>{finding.code}</code>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No local findings were produced.</p>
      )}
    </section>
  );
}
