/**
 * Generates the web application's copy of the shared assessment contract.
 *
 * The contract in contracts/v1/assessment.d.ts is the seam between the Rust
 * core and every client surface. The web app previously kept a hand-written
 * copy, which had already drifted: it was missing the redirect types entirely.
 * A silently stale contract is the worst kind of drift, because the compiler
 * happily accepts the old shape and the mismatch only appears at runtime.
 *
 * Usage:
 *   node tools/sync-contract.mjs           rewrite the generated file
 *   node tools/sync-contract.mjs --check   fail if the file is out of date
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'contracts/v1/assessment.d.ts';
const TARGET = 'apps/web/src/contracts/assessment.ts';

const header = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Generated from ${SOURCE} by tools/sync-contract.mjs.
 * Change the contract there, then run: node tools/sync-contract.mjs
 */

`;

const source = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
const expected = header + source.replace(/^\/\*\*[\s\S]*?\*\/\n\n/, '');

const check = process.argv.includes('--check');

let current = null;
try {
  current = readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');
} catch {
  current = null;
}

if (current === expected) {
  console.log(`sync-contract: ${TARGET} is up to date.`);
  process.exit(0);
}

if (check) {
  console.error(
    `::error::${TARGET} is out of date with ${SOURCE}. Run: node tools/sync-contract.mjs`,
  );
  process.exit(1);
}

writeFileSync(TARGET, expected, 'utf8');
console.log(`sync-contract: regenerated ${TARGET} from ${SOURCE}.`);
