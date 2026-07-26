import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { WasmSafetyEngine } from './wasmSafetyEngine';

interface GoldenVector {
  id: string;
  payload: string;
  expectedVerdict: string;
  expectedFindings?: string[];
  mustNotContain?: string[];
  notes?: string;
}

const goldenFiles = [
  'deceptive-urls.json',
  'identity-attacks.json',
  'structure-schemes-redirect.json',
  'payloads.json',
  'norwegian-benign.json',
  'robustness.json',
];

function repoFile(pathFromRoot: string): string {
  return resolve(process.cwd(), '..', '..', pathFromRoot);
}

function fixedNowMs(): number {
  const source = readFileSync(repoFile('core/crates/safety-core/tests/conformance.rs'), 'utf8');
  const match = source.match(/const FIXED_NOW_MS: u64 = ([\d_]+);/);
  if (!match) throw new Error('Could not find FIXED_NOW_MS in Rust conformance test');
  return Number(match[1].replaceAll('_', ''));
}

function loadVectors(): GoldenVector[] {
  return goldenFiles.flatMap((file) => {
    const text = readFileSync(repoFile(`test-vectors/golden/${file}`), 'utf8');
    return JSON.parse(text) as GoldenVector[];
  });
}

describe('WASM shared golden conformance', () => {
  beforeAll(() => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = input instanceof URL ? input : typeof input === 'string' ? new URL(input) : null;
      if (url?.protocol === 'file:' && url.pathname.endsWith('.wasm')) {
        return new Response(readFileSync(fileURLToPath(url)), {
          headers: { 'Content-Type': 'application/wasm' },
        });
      }
      return originalFetch(input, init);
    };
  });

  it('matches the Rust core golden vectors', async () => {
    const engine = await WasmSafetyEngine.load();
    const nowMs = fixedNowMs();
    const failures: string[] = [];
    const vectors = loadVectors();

    for (const vector of vectors) {
      const result = engine.assess({ payload: vector.payload, nowMs });
      const actualCodes = new Set([
        ...result.findings.map((finding) => finding.code),
        ...result.limitations.map((limitation) => limitation.code),
      ]);
      const missing = (vector.expectedFindings ?? []).filter((code) => !actualCodes.has(code));
      const forbiddenPresent = (vector.mustNotContain ?? []).filter((code) => actualCodes.has(code));

      if (result.verdict !== vector.expectedVerdict || missing.length || forbiddenPresent.length) {
        failures.push(
          [
            `id: ${vector.id}`,
            `payload: ${JSON.stringify(vector.payload)}`,
            `notes: ${vector.notes ?? ''}`,
            `verdict expected=${JSON.stringify(vector.expectedVerdict)} actual=${JSON.stringify(result.verdict)}`,
            `expected codes missing=${JSON.stringify(missing)}`,
            `forbidden codes present=${JSON.stringify(forbiddenPresent)}`,
            `actual codes=${JSON.stringify([...actualCodes].sort())}`,
          ].join('\n'),
        );
      }
    }

    expect(vectors.length).toBeGreaterThanOrEqual(103);
    expect(failures, `${failures.length} shared golden vector(s) failed:\n\n${failures.join('\n---\n')}`).toEqual([]);
  });
});
