#!/usr/bin/env node
// Play rejects an over-length field at upload time, after you have already
// filled in every other form. This checks the listing before it gets there.
//
// It reads every `### <field> (<n> max)` section of apps/android/play-listing.md,
// measures the fenced block under it, and compares against both the stated limit
// and the character count written beneath the fence, so a stale count is an
// error rather than a comment nobody re-checked.
//
//   node tools/check-play-listing.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const file = join(root, 'apps', 'android', 'play-listing.md')
const md = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n')

// Play counts what a person sees, and an emoji or a Norwegian å is one
// character to them regardless of how many UTF-16 code units it takes.
const length = (s) => [...s.trim()].length

const pattern =
  /^### (.+?) \((\d+) max\)\s*\n+```\n([\s\S]*?)\n```(?:\s*\n(\d+) characters\.)?/gm

const failures = []
const rows = []

// The same field name appears once per locale, so walk locale by locale.
const sections = md.split(/^## /m)
for (const section of sections.slice(1)) {
  const name = section.split('\n', 1)[0].trim()
  pattern.lastIndex = 0
  for (const m of section.matchAll(pattern)) {
    const [, field, maxRaw, body, statedRaw] = m
    const max = Number(maxRaw)
    const actual = length(body)
    const stated = statedRaw === undefined ? undefined : Number(statedRaw)

    const over = actual > max
    const misstated = stated !== undefined && stated !== actual
    rows.push({ locale: name, field, actual, max, over, misstated, stated })

    if (over) failures.push(`${name} / ${field}: ${actual} characters, limit is ${max}`)
    if (misstated)
      failures.push(`${name} / ${field}: file says ${stated} characters, actually ${actual}`)
  }
}

if (rows.length === 0) {
  console.error(`No "### field (n max)" sections found in ${relative(root, file)}.`)
  process.exit(1)
}

const width = Math.max(...rows.map((r) => r.locale.length + r.field.length + 3))
for (const r of rows) {
  const label = `${r.locale} / ${r.field}`.padEnd(width)
  const mark = r.over || r.misstated ? 'FAIL' : 'ok  '
  console.log(`${mark} ${label} ${String(r.actual).padStart(4)} / ${r.max}`)
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`\n${rows.length} fields within limits.`)
