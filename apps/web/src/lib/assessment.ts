import type { Finding, Severity } from '../contracts/assessment';
import { severityRank } from '../engine/catalog';

export function sortFindingsBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => severityRank[b.severity] - severityRank[a.severity] || a.code.localeCompare(b.code),
  );
}

export function highestSeverity(findings: Finding[]): Severity | undefined {
  return sortFindingsBySeverity(findings)[0]?.severity;
}

export function isOpenBlocked(actions: string[]): boolean {
  return actions.includes('open_blocked');
}

export function isUrlOpenable(rawPayload: string): boolean {
  try {
    const parsed = new URL(rawPayload);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
