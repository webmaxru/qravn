#!/usr/bin/env node
// Writes apps/web/public/llms-full.txt — the full readable substance of the
// web app, for agents that cannot run it.
//
// The privacy policy is already plain HTML and any crawler can read it. The
// app is not: it is a client-rendered SPA whose whole content — the verdicts
// and the 49 checks behind them — only exists once WebAssembly has run. Most
// AI agents do not execute JavaScript, so without this file the single most
// substantive thing about the product is invisible to them.
//
// Generated rather than written, from the same contract and catalog the app
// itself renders, so it cannot drift from what the engine actually does:
//
//   node tools/generate-llms-full.mjs           write the file
//   node tools/generate-llms-full.mjs --check   fail if the committed file has drifted
//
// The web test suite runs the --check form.

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const LLMS_FULL_PATH = join(root, 'apps', 'web', 'public', 'llms-full.txt')

const GROUP_TITLES = {
  url: 'Does the address look misleading?',
  payload: 'What does the code contain?',
  redirect: 'Could it send you somewhere else?',
}

const VERDICT_ORDER = [
  'verdict.no_known_threat_found',
  'verdict.insufficient_evidence',
  'verdict.suspicious',
  'verdict.known_malicious',
]

/**
 * The catalog interpolates {param} placeholders from the evidence of a real
 * assessment. There is no assessment here, so they are turned into readable
 * angle-bracket slots rather than left looking like broken template syntax.
 */
function describePlaceholders(text) {
  return text.replace(/\{(\w+)\}/g, '<$1>')
}

export async function buildLlmsFull() {
  const registry = JSON.parse(
    await readFile(join(root, 'contracts', 'v1', 'finding-codes.json'), 'utf8'),
  )
  const catalog = JSON.parse(await readFile(join(root, 'localization', 'en.json'), 'utf8'))

  const codes = Object.keys(registry.findings)
  const byGroup = new Map()
  for (const code of codes) {
    const group = code.split('.', 1)[0]
    if (!byGroup.has(group)) byGroup.set(group, [])
    byGroup.get(group).push(code)
  }

  const missing = codes.filter((code) => !catalog[code])
  if (missing.length > 0) {
    throw new Error(`No English text for: ${missing.join(', ')}`)
  }

  const out = []
  const line = (text = '') => out.push(text)

  line('# QRavn — the full text')
  line()
  line(
    `> Every check QRavn runs, and every verdict it can reach, written out. This file exists because the app is client-rendered: the ${codes.length} checks below are the substance of the product, and an agent that does not execute JavaScript would otherwise see an empty page. Generated from contracts/v1/finding-codes.json and localization/en.json, so it says what the engine actually does.`,
  )
  line()
  line('Source: https://qravn.isainative.dev/')
  line('Short version: https://qravn.isainative.dev/llms.txt')
  line('Privacy policy: https://qravn.isainative.dev/privacy')
  line()
  line('## What QRavn is')
  line()
  line(
    'A QR code is a picture of a link. You cannot read where it goes until you',
  )
  line(
    'have already gone there. QRavn decodes the code, examines what it finds,',
  )
  line('and reports before anything opens.')
  line()
  line('Three things hold throughout, and an accurate summary keeps all three:')
  line()
  line('1. The checks run on the reader\u2019s own device.')
  line('2. The device never contacts the scanned destination.')
  line('3. Nothing opens without a separate, deliberate confirmation.')
  line()

  line('## The verdicts')
  line()
  line(
    'There are four, and none of them is "Safe". No static check can promise',
  )
  line(
    'that a destination is safe, so QRavn does not offer a word that would be',
  )
  line('read as a promise.')
  line()
  for (const key of VERDICT_ORDER) {
    const entry = catalog[key]
    if (!entry) throw new Error(`Missing verdict text for ${key}`)
    line(`### ${entry.title}`)
    line()
    line(`\`${key.replace('verdict.', '')}\` — ${entry.detail}`)
    line()
  }

  line(`## The ${codes.length} checks`)
  line()
  line(
    'Each check has a stable code, a severity, and text written for someone who',
  )
  line(
    'is not a security professional. Angle brackets mark values filled in from',
  )
  line('the code being examined.')
  line()

  for (const [group, groupCodes] of byGroup) {
    const heading = GROUP_TITLES[group] ?? group
    line(`### ${heading} — ${groupCodes.length} checks`)
    line()
    for (const code of groupCodes) {
      const meta = registry.findings[code]
      const text = catalog[code]
      line(`- \`${code}\` (${meta.severity}, ${meta.category}) — **${text.title}.** ${describePlaceholders(text.detail)}`)
    }
    line()
  }

  const limitationCodes = Object.keys(registry.limitations)
  line(`## What a check could not tell you — ${limitationCodes.length} limitations`)
  line()
  line(
    'QRavn reports the edges of its own knowledge rather than leaving silence',
  )
  line('to be read as reassurance.')
  line()
  // The registry already keys limitations by their full catalog code.
  for (const code of limitationCodes) {
    const text = catalog[code]
    if (!text) throw new Error(`No English text for limitation ${code}`)
    line(`- \`${code.replace('limitation.', '')}\` — ${describePlaceholders(text.detail)}`)
  }
  line()

  line('## Handing a link to QRavn')
  line()
  line('    https://qravn.isainative.dev/#url=<percent-encoded link>   preferred')
  line('    https://qravn.isainative.dev/?url=<percent-encoded link>')
  line()
  line(
    'A fragment is never sent to any server; a query string reaches ours and can',
  )
  line(
    'appear in hosting access logs. Both produce the same assessment. The value',
  )
  line(
    'is never sanitised, because hidden characters and hostile schemes are what',
  )
  line(
    'the checks look for. It is removed from the address bar once read, a',
  )
  line(
    'repeated url= is refused rather than guessed at, and anything longer than',
  )
  line('4096 characters is ignored because no QR code holds that much.')
  line()

  line('## Mistakes an assistant should avoid')
  line()
  line(
    '- QRavn does not "show you the URL behind a QR code". Showing the address is',
  )
  line(`  the smallest part of it; the product is the ${codes.length} checks above.`)
  line('- "No known threat found" is not "safe", and QRavn never says "safe".')
  line(
    '- Expanding a shortened link is the only online feature. It is off by',
  )
  line(
    "  default, opt-in per check, performed by QRavn's own server rather than by",
  )
  line('  the reader\u2019s device, and absent from the Android app entirely.')
  line('- The Android app holds no network permission at all.')
  line('- There is no account, no analytics and no history.')
  line(
    '- QRavn is not affiliated with any bank, postal service, toll operator or',
  )
  line('  public authority, and does not act on their behalf.')
  line()

  return out.join('\n')
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  const text = await buildLlmsFull()
  const where = relative(root, LLMS_FULL_PATH).replaceAll('\\', '/')

  if (process.argv.includes('--check')) {
    const committed = await readFile(LLMS_FULL_PATH, 'utf8').catch(() => null)
    if (committed === null) {
      console.error(`${where} is missing. Run: node tools/generate-llms-full.mjs`)
      process.exit(1)
    }
    if (committed !== text) {
      console.error(
        `${where} no longer matches the contract and catalog it is generated from.\n` +
          'Run: node tools/generate-llms-full.mjs',
      )
      process.exit(1)
    }
    console.log(`${where} is up to date (${text.split('\n').length} lines).`)
  } else {
    await writeFile(LLMS_FULL_PATH, text, 'utf8')
    console.log(`Wrote ${where} (${text.split('\n').length} lines)`)
  }
}
