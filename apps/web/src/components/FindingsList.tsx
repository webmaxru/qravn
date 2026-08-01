import type { Finding } from '../contracts/assessment';
import { localizeFinding, severityLabels, type Locale } from '../engine/catalog';
import { sortFindingsBySeverity } from '../lib/assessment';
import { t } from '../lib/uiText';

interface FindingItemsProps {
  findings: Finding[];
  locale: Locale;
  /** Optional per-item badge, e.g. to mark findings about the final destination. */
  subjectBadge?: string;
}

/**
 * The bare list of findings, sorted by severity. Extracted so both the scanned
 * findings and the final-destination findings render identically while living
 * under their own, visually distinct sections.
 */
export function FindingItems({ findings, locale, subjectBadge }: FindingItemsProps) {
  const sorted = sortFindingsBySeverity(findings).map((item) => localizeFinding(item, locale));
  return (
    <ul className="finding-list">
      {sorted.map((finding) => (
        <li key={`${finding.code}-${finding.detail}`} className={`finding finding--${finding.severity}`}>
          <span className="severity-badge">{severityLabels[locale][finding.severity]}</span>
          <div>
            {subjectBadge ? <span className="subject-badge subject-badge--final">{subjectBadge}</span> : null}
            <h3>{finding.title || finding.code}</h3>
            {finding.detail ? <p>{finding.detail}</p> : null}
            {/* The contract code is traceability, not a message. It stays on
                screen so a support conversation can name the exact rule, but at
                a size that keeps it out of the reading path. */}
            <code className="finding-code">{finding.code}</code>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface FindingsListProps {
  findings: Finding[];
  locale: Locale;
}

export function FindingsList({ findings, locale }: FindingsListProps) {
  // A clear result has nothing to list. An empty "what we found" panel is one
  // more thing to read past on the screen people see most often, so it is not
  // rendered at all rather than filled with a sentence saying nothing happened.
  if (!findings.length) return null;
  return (
    <section className="panel" aria-labelledby="findings-heading">
      <h2 id="findings-heading">{t('ui.what_we_found', locale)}</h2>
      <FindingItems findings={findings} locale={locale} />
    </section>
  );
}
