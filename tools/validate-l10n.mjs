#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.cwd();
const errors = [];
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const registry = readJson(join(root, 'contracts', 'v1', 'finding-codes.json'));
const findings = registry.findings ?? {};
const limitations = registry.limitations ?? {};
const registryCodes = new Set([...Object.keys(findings), ...Object.keys(limitations)]);
const verdictCodes = ['verdict.known_malicious','verdict.suspicious','verdict.insufficient_evidence','verdict.no_known_threat_found'];
const uiCodes = ['ui.check','ui.paste_placeholder','ui.result','ui.findings','ui.limitations','ui.what_we_found','ui.open_anyway','ui.open_blocked','ui.copy','ui.scan_again','ui.about','ui.privacy_note','ui.language','ui.raw_payload','ui.real_destination'];
const allowedCatalogCodes = new Set([...registryCodes, ...verdictCodes, ...uiCodes]);
const declaredParams = new Map();
for (const [code, meta] of Object.entries(findings)) declaredParams.set(code, new Set(meta.params ?? []));
for (const [code, meta] of Object.entries(limitations)) declaredParams.set(code, new Set(meta.params ?? []));
for (const code of [...verdictCodes, ...uiCodes]) declaredParams.set(code, new Set());
const placeholderPattern = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

for (const locale of ['nb', 'nn', 'en']) {
  let catalog;
  const file = join(root, 'localization', `${locale}.json`);
  try { catalog = readJson(file); } catch (error) { errors.push(`${locale}: cannot read ${file}: ${error.message}`); continue; }
  for (const code of allowedCatalogCodes) if (!(code in catalog)) errors.push(`${locale}: missing catalog entry ${code}`);
  for (const [code, value] of Object.entries(catalog)) {
    if (!allowedCatalogCodes.has(code)) { errors.push(`${locale}: unexpected catalog entry ${code}`); continue; }
    if (!value || typeof value.title !== 'string' || typeof value.detail !== 'string') { errors.push(`${locale}: ${code} must have string title and detail`); continue; }
    const allowed = declaredParams.get(code) ?? new Set();
    const seen = new Set();
    for (const field of ['title', 'detail']) {
      for (const match of value[field].matchAll(placeholderPattern)) {
        const name = match[1];
        seen.add(name);
        if (!allowed.has(name)) errors.push(`${locale}: ${code} uses unknown placeholder {${name}} in ${field}`);
      }
    }
    if (registryCodes.has(code)) {
      for (const name of allowed) if (!seen.has(name)) errors.push(`${locale}: ${code} does not use declared placeholder {${name}}`);
    } else if (seen.size > 0) {
      errors.push(`${locale}: ${code} must not use placeholders`);
    }
  }
}

const validVerdicts = new Set(['known_malicious', 'suspicious', 'insufficient_evidence', 'no_known_threat_found']);
const ids = new Set();
let vectorCount = 0;
const byFile = new Map();
function validateVectorFile(path) {
  let data;
  try { data = readJson(path); } catch (error) { errors.push(`${path}: invalid JSON: ${error.message}`); return; }
  if (!Array.isArray(data)) { errors.push(`${path}: expected a JSON array`); return; }
  byFile.set(path, data.length);
  for (const [index, vector] of data.entries()) {
    const label = `${path}[${index}]`;
    vectorCount += 1;
    if (!vector || typeof vector !== 'object') { errors.push(`${label}: vector must be an object`); continue; }
    if (typeof vector.id !== 'string' || vector.id.length === 0) errors.push(`${label}: missing stable id`);
    else if (ids.has(vector.id)) errors.push(`${label}: duplicate id ${vector.id}`);
    else ids.add(vector.id);
    if (typeof vector.payload !== 'string') errors.push(`${label}: payload must be a string`);
    if (!validVerdicts.has(vector.expectedVerdict)) errors.push(`${label}: invalid expectedVerdict ${vector.expectedVerdict}`);
    if (typeof vector.notes !== 'string' || vector.notes.trim().length === 0) errors.push(`${label}: missing notes`);
    for (const field of ['expectedFindings', 'mustNotContain']) {
      if (vector[field] === undefined) continue;
      if (!Array.isArray(vector[field])) { errors.push(`${label}: ${field} must be an array when present`); continue; }
      for (const code of vector[field]) if (!registryCodes.has(code)) errors.push(`${label}: ${field} references unknown code ${code}`);
    }
  }
}
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.isFile() && extname(entry.name) === '.json') validateVectorFile(path);
  }
}
visit(join(root, 'test-vectors', 'golden'));
if (errors.length) {
  console.error(`validate-l10n failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`validate-l10n passed: 3 locales × ${allowedCatalogCodes.size} catalog entries; ${vectorCount} golden vectors across ${byFile.size} files.`);
