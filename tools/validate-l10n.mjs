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
const uiCodes = [
  // Chrome the task surface itself is built from.
  'ui.tagline','ui.reassurance','ui.scan_target','ui.scan_start','ui.scan_stop','ui.scan_starting',
  'ui.scan_aim','ui.choose_photo','ui.reading_image','ui.no_code_found',
  'ui.camera_denied','ui.camera_missing','ui.camera_problem',
  'ui.paste_toggle','ui.paste_label','ui.paste_placeholder','ui.check',
  // Result chrome.
  'ui.result','ui.what_we_found','ui.limitations','ui.actions','ui.open_anyway','ui.open_blocked',
  'ui.open_link','ui.open_new_tab','ui.copy','ui.copy_link','ui.copy_failed','ui.share_link',
  'ui.share_fallback','ui.share_failed','ui.link_copied','ui.scan_again','ui.raw_payload','ui.real_destination',
  'ui.payload_heading','ui.breakdown_heading','ui.credential_note',
  'ui.field_scheme','ui.field_host','ui.field_domain','ui.field_subdomains','ui.field_path',
  'ui.field_query','ui.field_none',
  // Secondary surfaces, kept off the primary path.
  'ui.settings','ui.follow_links','ui.how_heading','ui.how_address','ui.how_content','ui.how_redirect',
  'ui.about','ui.privacy_note','ui.language','ui.engine_error',
  'ui.offline_redirect_limitation','ui.possible_redirect_warning',
];
// UI chrome for explicit online (redirect-expansion) mode. Listed here so the
// gate fails if any locale is missing one: the app targets Norway, so an
// English string silently falling through to a Bokmal/Nynorsk user is a defect,
// not a cosmetic gap.
const onlineCodes = ['online.expand_heading','online.disclosure','online.expand_button','online.resolving','online.section_heading','online.path_label','online.final_findings_heading','online.final_badge','online.outcome_resolved','online.outcome_max_hops','online.outcome_incomplete','online.error','online.retry_button'];
const allowedCatalogCodes = new Set([...registryCodes, ...verdictCodes, ...uiCodes, ...onlineCodes]);
const declaredParams = new Map();
for (const [code, meta] of Object.entries(findings)) declaredParams.set(code, new Set(meta.params ?? []));
for (const [code, meta] of Object.entries(limitations)) declaredParams.set(code, new Set(meta.params ?? []));
// A UI string may interpolate only what it declares here. The rule the gate
// exists to keep is "no undeclared placeholder", not "no placeholder": the two
// controls that open a destination have to name that destination, and leaving
// them in English for a Norwegian reader is exactly the defect this file is
// meant to catch.
const uiParams = { 'ui.open_anyway': ['host'], 'ui.open_new_tab': ['host'] };
for (const code of [...verdictCodes, ...uiCodes, ...onlineCodes]) declaredParams.set(code, new Set(uiParams[code] ?? []));
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
    if (allowed.size > 0) {
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
