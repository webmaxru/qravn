#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const LOCALES = ['nb', 'nn', 'en'];

function notice(message) {
  console.log(`::notice::${message}`);
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const options = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') {
      const next = argv[i + 1];
      if (!next) {
        fail('Missing value after --root.');
        process.exit(1);
      }
      options.root = path.resolve(next);
      i += 1;
    } else {
      fail(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }
  return options;
}

function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${error.message}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${file}: ${error.message}`);
  }
}

function collectCodes(registry) {
  const findings = registry.findings && typeof registry.findings === 'object' ? registry.findings : {};
  const limitations = registry.limitations && typeof registry.limitations === 'object' ? registry.limitations : {};
  const codes = [...Object.keys(findings), ...Object.keys(limitations)];
  const unique = new Set(codes);

  if (codes.length === 0) {
    throw new Error('contracts/v1/finding-codes.json contains no finding or limitation codes.');
  }
  if (unique.size !== codes.length) {
    throw new Error('contracts/v1/finding-codes.json contains duplicate codes.');
  }

  return [...unique].sort();
}

function containsCode(value, code) {
  if (Array.isArray(value)) {
    return value.some((item) => item === code || containsCode(item, code));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, child]) => key === code || containsCode(child, code));
  }
  return false;
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const registryPath = path.join(root, 'contracts', 'v1', 'finding-codes.json');
  if (!fs.existsSync(registryPath)) {
    notice('contracts/v1/finding-codes.json is not present yet; skipping contract localization check.');
    return;
  }

  let codes;
  try {
    codes = collectCodes(readJson(registryPath));
  } catch (error) {
    fail(error.message);
    return;
  }

  const missingCatalogs = LOCALES
    .map((locale) => path.join(root, 'localization', `${locale}.json`))
    .filter((file) => !fs.existsSync(file));

  if (missingCatalogs.length > 0) {
    notice(`Skipping localization coverage check because catalog files are not present yet: ${missingCatalogs.map((file) => path.relative(root, file)).join(', ')}`);
    return;
  }

  let failed = false;
  for (const locale of LOCALES) {
    const file = path.join(root, 'localization', `${locale}.json`);
    let catalog;
    try {
      catalog = readJson(file);
    } catch (error) {
      fail(error.message);
      failed = true;
      continue;
    }

    const missingCodes = codes.filter((code) => !containsCode(catalog, code));
    if (missingCodes.length > 0) {
      fail(`${path.relative(root, file)} is missing ${missingCodes.length} code(s): ${missingCodes.join(', ')}`);
      failed = true;
    }
  }

  if (!failed) {
    console.log(`Contract localization check passed for ${codes.length} code(s).`);
  }
}

main();
