import registry from '../../../contracts/v1/finding-codes.json';

type Registry = {
  findings: Record<string, { severity?: string }>;
  limitations: Record<string, unknown>;
};

const { findings, limitations } = registry as Registry;

const codes = Object.entries(findings);

/**
 * Everything the engine can recognise and name. Quoted in the marketing copy,
 * so it is counted from the contract rather than typed into a sentence: a code
 * added to the registry moves the number on every surface at once, and the
 * claim cannot go stale.
 */
export const CHECK_COUNT = codes.length;

/**
 * The subset that is an actual warning. `info` findings describe what a code
 * turned out to be — a phone number, a calendar event — and are not signs of
 * anything wrong, so they must not be counted when the copy says "warning".
 */
export const WARNING_COUNT = codes.filter(([, v]) => v.severity !== 'info').length;

/** What the engine admits it could not determine. */
export const LIMITATION_COUNT = Object.keys(limitations).length;
