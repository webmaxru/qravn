import type { Assessment, Finding, Severity } from '../contracts/assessment';
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

/** Findings about the scanned URL (the default when `subject` is absent). */
export function scannedFindings(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.subject !== 'final');
}

/** Findings about the expanded final destination. */
export function finalFindings(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.subject === 'final');
}

/**
 * The offline cue that this link looks like it redirects: the core emits
 * `limitation.redirect_not_expanded` for a known shortener and removes it once
 * the chain has actually been expanded online.
 */
export function hasRedirectCue(assessment: Assessment): boolean {
  return assessment.limitations.some((limitation) => limitation.code === 'limitation.redirect_not_expanded');
}

/**
 * Neutralize a hostile hop/destination URL for display. Every string in a
 * resolved chain is attacker-controlled, so escape C0/C1 controls and the
 * bidi/invisible characters that could reorder or hide what is shown. React
 * already prevents markup injection; this defends against visual spoofing.
 */
export function neutralizeForDisplay(value: string): string {
  return value.replace(
    // eslint-disable-next-line no-control-regex -- deliberately matches C0/C1 controls to neutralize them
    /[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

