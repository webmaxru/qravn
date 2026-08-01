#!/usr/bin/env node
// The listing, the store copy and the in-app strings all quote how many checks
// the engine runs. That number is a claim about a security product, so it has
// to come from the registry rather than from memory: adding a finding code
// without updating the copy would leave every surface understating the engine,
// and removing one would leave them all lying.
//
// This reads the count from contracts/v1/finding-codes.json and fails if any
// surface quotes a different one.
//
//   node tools/check-claimed-checks.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const registry = JSON.parse(
  await readFile(join(root, 'contracts', 'v1', 'finding-codes.json'), 'utf8'),
)
const codes = Object.keys(registry.findings)
const expected = codes.length

// The copy also quotes the split — so many checks on the address, so many on
// the payload, so many on the redirect chain. Those come from the code prefix,
// and they are validated too, so a finding added to one group cannot silently
// leave the breakdown adding up to something other than the total.
const groups = new Map()
for (const code of codes) {
  const group = code.split('.', 1)[0]
  groups.set(group, (groups.get(group) ?? 0) + 1)
}

const permitted = new Map([[expected, 'total']])
for (const [group, n] of groups) {
  if (permitted.has(n)) permitted.set(n, `${permitted.get(n)} / ${group}`)
  else permitted.set(n, group)
}

const groupTotal = [...groups.values()].reduce((a, b) => a + b, 0)
if (groupTotal !== expected) {
  console.error(`Group counts sum to ${groupTotal} but there are ${expected} codes.`)
  process.exit(1)
}

// Surfaces that state the number as a literal. The web app derives it from the
// contract at build time, so it is deliberately not listed here.
const surfaces = [
  'apps/android/play-listing.md',
  'apps/android/app/src/main/res/values/strings.xml',
  'apps/android/app/src/main/res/values-nb/strings.xml',
  'apps/android/app/src/main/res/values-nn/strings.xml',
  'README.md',
]

// "49 checks", "49 sjekker"/"de 49 sjekkene" (bokmål), "49 sjekkar"/"dei 49
// sjekkane" (nynorsk). The definite forms matter: the copy uses them whenever
// it refers back to the set, and an unguarded claim is the one that rots.
const claim =
  /\b(\d+)\s+(checks|sjekker|sjekkene|sjekkar|sjekkane|kontroller|kontrollar)\b/gi

const failures = []
let found = 0
let sawTotal = false

for (const rel of surfaces) {
  let text
  try {
    text = await readFile(join(root, rel), 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      failures.push(`${rel}: listed as a surface but missing`)
      continue
    }
    throw err
  }

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  lines.forEach((line, i) => {
    claim.lastIndex = 0
    for (const m of line.matchAll(claim)) {
      found += 1
      const n = Number(m[1])
      const where = `${rel}:${i + 1}`
      if (!permitted.has(n)) {
        const legend = [...permitted].map(([v, name]) => `${v} (${name})`).join(', ')
        failures.push(`${where}: claims ${n} ${m[2]}, registry allows ${legend}`)
        console.log(`FAIL ${where}  "${m[0]}"`)
      } else {
        console.log(`ok   ${where}  "${m[0]}" — ${permitted.get(n)}`)
        if (n === expected) sawTotal = true
      }
    }
  })
}

console.log(
  `\nRegistry defines ${expected} finding codes: ` +
    [...groups].map(([g, n]) => `${n} ${g}`).join(', ') +
    '.',
)

if (!sawTotal) {
  console.error(
    `No surface quotes the total of ${expected}. The copy is meant to lead with it, ` +
      'so this is almost certainly a regression rather than a deliberate removal.',
  )
  process.exit(1)
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`${found} claim(s) agree with the registry.`)
