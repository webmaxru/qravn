#!/usr/bin/env node
// A store rejects an over-length field at upload time, after you have already
// filled in every other form. This checks the listings before they get there.
//
// It reads every `### <field> (<limit>)` section of each listing file, measures
// the fenced block(s) under it, and compares against both the stated limit and
// the character count written beneath the fence, so a stale count is an error
// rather than a comment nobody re-checked.
//
// It then cross-checks what it found against brand/store-assets.json, which is
// the list of every field each store asks for. Measuring only the fields that
// happen to be written down cannot catch the field nobody wrote down, and a
// forgotten slot is discovered at submission time otherwise.
//
// Three heading forms, because the stores count different things:
//
//   ### Short description (80 max)                     one block of 80
//   ### Product features (200 max, up to 20 items)     20 blocks of 200
//   ### Search terms (30 max per line, up to 7 lines, 21 words total)
//                                                      one block, 7 lines of 30
//
// A field named "Search terms" is additionally checked against the rest of its
// own listing: the store already indexes the name and description, so a term
// made only of words that appear there buys nothing.
//
//   node tools/check-store-listings.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const REGISTRY = 'brand/store-assets.json'
const registry = JSON.parse(await readFile(join(root, REGISTRY), 'utf8'))
const files = registry.stores.map((store) => store.listing)

// A store counts what a person sees, and an emoji or a Norwegian å is one
// character to them regardless of how many UTF-16 code units it takes.
const length = (s) => [...s.trim()].length

// Partner Center caps the *individual words* across all search terms, not just
// the terms. Hyphenated compounds are split, which is the conservative reading:
// if the store counts "qr-kode" as one word we are simply under budget.
const words = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)

const limitPattern =
  /^### (.+?) \((\d+) max(?: per (line))?(?:, up to (\d+) (?:items|lines))?(?:, (\d+) words total)?\)\s*$/
// Written as "329 characters." under the fence; spaces so a four-digit count
// stays readable are tolerated and stripped before comparing.
const statedPattern = /^([\d\u00a0 ]*\d) characters\.\s*$/

/** Every `## locale` → `### field (limit)` → fenced block in one listing file. */
function parse(md) {
  const fields = []
  let locale = 'listing'
  let field = null
  let fence = null

  for (const line of md.split('\n')) {
    if (fence !== null) {
      if (line.startsWith('```')) {
        if (field) field.blocks.push(fence.join('\n'))
        fence = null
      } else {
        fence.push(line)
      }
      continue
    }

    if (line.startsWith('```')) {
      fence = []
      continue
    }

    const heading = /^## (.+?)\s*$/.exec(line)
    if (heading) {
      locale = heading[1]
      field = null
      continue
    }

    if (line.startsWith('### ')) {
      const m = limitPattern.exec(line)
      // A heading without a limit ends the previous field rather than letting
      // it silently collect the next section's fenced blocks.
      field = null
      if (m) {
        const [, name, max, perLine, maxUnits, maxWords] = m
        field = {
          locale,
          name,
          max: Number(max),
          unit: perLine ? 'line' : maxUnits === undefined ? 'field' : 'item',
          maxUnits: maxUnits === undefined ? undefined : Number(maxUnits),
          maxWords: maxWords === undefined ? undefined : Number(maxWords),
          blocks: [],
          stated: undefined,
        }
        fields.push(field)
      }
      continue
    }

    if (field && field.blocks.length > 0) {
      const stated = statedPattern.exec(line)
      if (stated) field.stated = Number(stated[1].replace(/[\u00a0 ]/g, ''))
    }
  }

  return fields
}

const rows = []
let failed = 0

for (const rel of files) {
  const fields = parse((await readFile(join(root, rel), 'utf8')).replace(/\r\n/g, '\n'))

  if (fields.length === 0) {
    console.error(`No "### field (n max)" sections found in ${rel}.`)
    process.exit(1)
  }

  for (const field of fields) {
    const problems = []

    if (field.blocks.length === 0) {
      problems.push('no fenced block under the heading')
      rows.push({ file: rel, field, label: `${field.locale} / ${field.name}`, count: '—', problems })
      failed += 1
      continue
    }

    // What gets measured, and what "one of them" means when it is over.
    const units =
      field.unit === 'item'
        ? field.blocks
        : field.unit === 'line'
          ? field.blocks[0].split('\n').filter((l) => l.trim() !== '')
          : [field.blocks[0]]

    if (field.unit === 'field' && field.blocks.length > 1)
      problems.push(`${field.blocks.length} fenced blocks under a single-value field`)

    if (field.maxUnits !== undefined && units.length > field.maxUnits)
      problems.push(`${units.length} ${field.unit}s, limit is ${field.maxUnits}`)

    // An empty fence is a field nobody has written. Without this the length
    // checks below have nothing to measure and quietly pass.
    if (units.length === 0 || units.every((unit) => unit.trim() === '')) {
      problems.push('the fenced block is empty')
      rows.push({ file: rel, field, label: `${field.locale} / ${field.name}`, count: '—', problems })
      failed += 1
      continue
    }

    const lengths = units.map(length)
    const longest = Math.max(...lengths)
    for (const [i, n] of lengths.entries())
      if (n > field.max)
        problems.push(
          field.unit === 'field'
            ? `${n} characters, limit is ${field.max}`
            : `${field.unit} ${i + 1} is ${n} characters, limit is ${field.max}`,
        )

    if (field.unit === 'field' && field.stated !== undefined && field.stated !== longest)
      problems.push(`file says ${field.stated} characters, actually ${longest}`)

    const wordCount = units.flatMap(words).length
    if (field.maxWords !== undefined && wordCount > field.maxWords)
      problems.push(`${wordCount} words in total, limit is ${field.maxWords}`)

    // A search term built only from words the listing already shows is spent
    // for nothing: the store indexes the name and description regardless, so
    // the slot should have gone to vocabulary a customer might type instead.
    if (field.name.startsWith('Search terms')) {
      const indexed = new Set(
        fields
          .filter((other) => other.locale === field.locale && other !== field)
          .flatMap((other) => other.blocks.flatMap(words)),
      )
      for (const [i, unit] of units.entries()) {
        const used = words(unit)
        if (used.length > 0 && used.every((word) => indexed.has(word)))
          problems.push(`term ${i + 1} ("${unit.trim()}") is only words already in the listing`)
      }
    }

    rows.push({
      file: rel,
      field,
      label: `${field.locale} / ${field.name}`,
      count:
        field.unit === 'field'
          ? `${longest} / ${field.max}`
          : `${units.length} ${field.unit}s, longest ${longest} / ${field.max}` +
            (field.maxWords === undefined ? '' : `, ${wordCount} / ${field.maxWords} words`),
      problems,
    })
    if (problems.length > 0) failed += 1
  }
}

// Both directions, because each catches a different mistake. A registry slot
// with no heading is a field nobody has written yet; a heading with no registry
// slot means the list the next person works from is already incomplete.
const drift = []

for (const store of registry.stores) {
  const parsed = rows.filter((row) => row.file === store.listing)
  const documented = new Map(store.text.map((slot) => [slot.slot, slot]))

  for (const slot of store.text) {
    if (slot.kind !== 'copy' || !slot.provided || slot.max === undefined) continue
    for (const locale of store.locales) {
      const found = parsed.find(
        (row) => row.field.locale === locale && row.field.name === slot.slot,
      )
      if (!found) {
        drift.push(`${store.listing}: ${locale} has no measured "${slot.slot}" section`)
        continue
      }
      const f = found.field
      for (const [name, mine, theirs] of [
        ['characters', f.max, slot.max],
        ['units', f.maxUnits, slot.maxUnits],
        ['words', f.maxWords, slot.maxWords],
      ]) {
        if (mine !== theirs)
          drift.push(
            `${store.listing}: ${locale} / ${slot.slot} allows ${mine} ${name}, ` +
              `the registry says ${theirs}`,
          )
      }
      // "20 items" and "20 lines" are different limits that both read as 20.
      if ((slot.unit ?? 'field') !== f.unit)
        drift.push(
          `${store.listing}: ${locale} / ${slot.slot} counts ${f.unit}s, ` +
            `the registry counts ${slot.unit ?? 'field'}s`,
        )
    }
  }

  for (const row of parsed) {
    const slot = documented.get(row.field.name)
    if (!slot) {
      drift.push(`${store.listing}: "${row.field.name}" is not in ${REGISTRY}`)
    } else if (!slot.provided) {
      drift.push(`${store.listing}: "${row.field.name}" is filled in but ${REGISTRY} says it is not`)
    }
    if (!store.locales.includes(row.field.locale))
      drift.push(
        `${store.listing}: "## ${row.field.locale}" is not one of the registry's locales ` +
          `(${store.locales.join(', ')})`,
      )
  }
}

const width = Math.max(...rows.map((r) => r.label.length))
let shown = null
for (const row of rows) {
  if (row.file !== shown) {
    console.log(`${shown ? '\n' : ''}${row.file}`)
    shown = row.file
  }
  console.log(`  ${row.problems.length === 0 ? 'ok  ' : 'FAIL'} ${row.label.padEnd(width)}  ${row.count}`)
  for (const p of row.problems) console.log(`       - ${p}`)
}

if (drift.length > 0) {
  console.log(`\nOut of step with ${REGISTRY}:`)
  // A field-level disagreement is found once per locale; say it once.
  for (const line of [...new Set(drift)]) console.log(`  - ${line}`)
}

if (failed > 0 || drift.length > 0) {
  // The per-field reasons are already printed under the field they belong to,
  // so this is a count rather than a second list — and it goes to stdout so it
  // cannot be reordered away from the rows it summarizes.
  const parts = []
  if (failed > 0) parts.push(`${failed} field(s) over limit or misstated`)
  if (drift.length > 0)
    parts.push(`${new Set(drift).size} disagreement(s) with ${REGISTRY}`)
  console.log(`\n${parts.join(', ')}.`)
  process.exit(1)
}

const copy = registry.stores.flatMap((s) => s.text.filter((t) => t.kind === 'copy'))
console.log(
  `\n${rows.length} fields within limits, and in step with ${REGISTRY}` +
    ` (${copy.length} copy fields documented across ${registry.stores.length} stores,` +
    ` ${copy.filter((t) => !t.provided).length} of them deliberately left empty).`
)
