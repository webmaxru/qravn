#!/usr/bin/env node
// Renders brand/STORE-ASSETS.md from brand/store-assets.json.
//
//   node tools/gen-store-assets-doc.mjs            rewrite the document
//   node tools/gen-store-assets-doc.mjs --check    fail if it is out of date
//
// The document is generated rather than written because the last time this list
// lived only in someone's head, the Microsoft Store poster art was missed
// entirely and only turned up when the submission form asked for it. A prose
// list drifts from the checkers the moment either one changes; a generated one
// cannot, and --check in CI is what makes that true.
//
// The registry is the thing to edit. This file only decides how it reads.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')

const REGISTRY = 'brand/store-assets.json'
const registry = JSON.parse(readFileSync(join(root, REGISTRY), 'utf8'))

const MB = 1024 * 1024

const STATUSES = ['required', 'recommended', 'optional', 'n/a']
const KINDS = ['copy', 'url', 'email', 'choice']

// The registry is hand-edited, and a malformed slot would otherwise surface as
// a TypeError deep inside whichever checker read it first. Everything here is a
// shape rule, not a judgement about what the stores want.
function validate() {
  const problems = []
  const fault = (where, message) => problems.push(`${where}: ${message}`)

  for (const store of registry.stores) {
    for (const key of ['id', 'name', 'console', 'listing']) {
      if (!store[key]) fault(store.id ?? '(unnamed store)', `has no ${key}`)
    }
    if (!Array.isArray(store.locales) || store.locales.length === 0) {
      fault(store.id, 'has no locales')
    }

    for (const slot of [...store.images, ...store.text]) {
      const where = `${store.id} · ${slot.slot ?? '(unnamed slot)'}`
      if (!slot.slot) fault(where, 'has no name')
      if (!STATUSES.includes(slot.status)) fault(where, `status "${slot.status}" is not a status`)
      if (typeof slot.provided !== 'boolean') fault(where, 'provided is not true or false')
      if (slot.status === 'n/a' && slot.provided) fault(where, 'is n/a yet marked provided')
    }

    for (const image of store.images) {
      const where = `${store.id} · ${image.slot}`
      if (!image.dir) {
        // Nothing measures it, so anything that looks measurable is a slot
        // somebody half-wired and will assume is being checked.
        for (const key of ['files', 'size', 'count', 'maxBytes', 'alpha', 'format']) {
          if (image[key] !== undefined) fault(where, `has ${key} but no dir, so nothing reads it`)
        }
        if (image.provided) fault(where, 'is marked provided but names no directory')
        continue
      }
      if (!image.maxBytes) fault(where, 'has no maxBytes')
      if (!['allowed', 'forbidden'].includes(image.alpha))
        fault(where, `alpha "${image.alpha}" is not allowed or forbidden`)
      if (image.format !== undefined && image.format !== '24-bit')
        fault(where, `format "${image.format}" is not a format this checks`)
      if (image.format === '24-bit' && image.alpha !== 'forbidden')
        fault(where, '24-bit rules out an alpha channel, so alpha should be forbidden')

      if (image.files) {
        if (image.size || image.count) fault(where, 'has both a fixed file list and size/count')
        if (!Array.isArray(image.files) || image.files.length === 0)
          fault(where, 'has an empty file list')
        else
          for (const entry of image.files) {
            if (!Array.isArray(entry) || entry.length !== 3)
              fault(where, `file entry ${JSON.stringify(entry)} is not [name, width, height]`)
          }
      } else if (!image.size || !image.count) {
        fault(where, 'has a dir but neither a file list nor a size and count')
      }
    }

    for (const slot of store.text) {
      const where = `${store.id} · ${slot.slot}`
      if (!KINDS.includes(slot.kind)) fault(where, `kind "${slot.kind}" is not a kind`)
      if (slot.kind !== 'copy' && slot.max !== undefined)
        fault(where, 'has a character limit but is not copy')
      if (slot.unit && slot.maxUnits === undefined)
        fault(where, `counts ${slot.unit}s but sets no limit on how many`)
      if (slot.maxUnits !== undefined && !slot.unit)
        fault(where, 'limits a number of units without saying what a unit is')
    }
  }

  if (problems.length > 0) {
    console.log(`${REGISTRY} is malformed:`)
    for (const line of problems) console.log(`  - ${line}`)
    process.exit(1)
  }
}

validate()

const MARK = {
  required: '**Required**',
  recommended: 'Recommended',
  optional: 'Optional',
  'n/a': 'Not applicable',
}

const escape = (s) => String(s).replace(/\|/g, '\\|')

function state(slot) {
  if (slot.status === 'n/a') return 'n/a'
  return slot.provided ? 'yes' : 'no'
}

function spec(image) {
  const sizes = image.files
    ? [...new Set(image.files.map(([, w, h]) => `${w}×${h}`))]
    : image.size
      ? [`${image.size[0]}×${image.size[1]}`]
      : []
  const parts = []
  if (sizes.length > 0) parts.push(sizes.join(', '))
  else if (image.spec) parts.push(image.spec)
  if (image.count) parts.push(`${image.count[0]}–${image.count[1]} files`)
  if (image.format === '24-bit') parts.push('24-bit')
  if (image.alpha === 'forbidden') parts.push('no alpha')
  if (image.maxBytes) parts.push(`≤ ${Math.round(image.maxBytes / MB)} MB`)
  return parts.join(' · ') || '—'
}

function textSpec(slot) {
  if (slot.kind === 'url') return 'URL'
  if (slot.kind === 'email') return 'Email address'
  if (slot.kind === 'choice') return 'form answer'
  const parts = []
  if (slot.max !== undefined) {
    parts.push(
      slot.unit === 'item'
        ? `${slot.max} chars × ${slot.maxUnits} items`
        : slot.unit === 'line'
          ? `${slot.max} chars × ${slot.maxUnits} lines`
          : `${slot.max} chars`
    )
  }
  if (slot.maxWords !== undefined) parts.push(`${slot.maxWords} words total`)
  return parts.join(' · ') || 'free text'
}

/** One line per slot name: a slot split across locales says the same thing twice. */
function notes(slots) {
  const seen = new Map()
  for (const slot of slots) {
    if (slot.note && !seen.has(slot.slot)) seen.set(slot.slot, slot.note)
  }
  return seen
}

const lines = []
const w = (line = '') => lines.push(line)

w('<!-- Generated by tools/gen-store-assets-doc.mjs. Edit brand/store-assets.json instead. -->')
w()
w('# Store assets')
w()
w('Every slot the three stores offer — images and text, required and optional,')
w('including the ones this product deliberately leaves empty and the ones it can')
w('never need.')
w()
w('It exists because a store listing is a form with a few dozen fields and no')
w("store tells you what you forgot. The Microsoft Store poster art was missed")
w('exactly that way, and the omission stayed invisible until someone read the')
w('upload page a second time. Regenerating an asset set from this list cannot')
w('repeat that.')
w()
w(`Generated from \`${REGISTRY}\`, which is where a new slot goes first.`)
w()
w('| Status | Meaning |')
w('|---|---|')
w('| **Required** | The store will not publish without it. |')
w('| Recommended | Accepted without it, but a surface degrades. |')
w('| Optional | Accepted without it, nothing degrades. |')
w('| Not applicable | Offered by the store, impossible for this product. |')
w()
w('"Have it" is whether this repository currently fills the slot. Character')
w('limits are what the console enforces, and pixel sizes are what it validates')
w('at upload — none of the three stores resizes anything for you.')
w()

// A submission is blocked by exactly one thing: a required slot with nothing in
// it. That belongs at the top, not buried in a per-store table.
const outstanding = []
for (const store of registry.stores) {
  for (const slot of [...store.images, ...store.text]) {
    if (slot.status === 'required' && !slot.provided) {
      outstanding.push({
        store: store.name,
        slot: slot.locale ? `${slot.slot} (${slot.locale})` : slot.slot,
        note: slot.note,
      })
    }
  }
}

w('## Outstanding')
w()
if (outstanding.length === 0) {
  w('Nothing required is missing.')
} else {
  w('Required by a store, and not yet produced.')
  w()
  w('| Store | Slot | Why it is not here yet |')
  w('|---|---|---|')
  for (const item of outstanding) {
    w(`| ${escape(item.store)} | ${escape(item.slot)} | ${escape(item.note ?? '—')} |`)
  }
}
w()

w('## At a glance')
w()
w('| Store | Console | Locales | Images | Text fields | Outstanding |')
w('|---|---|---|---|---|---|')
for (const store of registry.stores) {
  const all = [...store.images, ...store.text]
  const missing = all.filter((slot) => slot.status === 'required' && !slot.provided).length
  w(
    `| ${escape(store.name)} | ${escape(store.console)} | ${escape(store.locales.join(', '))} ` +
      `| ${store.images.filter((i) => i.status !== 'n/a').length} ` +
      `| ${store.text.filter((t) => t.status !== 'n/a').length} ` +
      `| ${missing === 0 ? '—' : missing} |`
  )
}
w()

for (const store of registry.stores) {
  w('---')
  w()
  w(`## ${store.name}`)
  w()
  w(`| | |`)
  w('|---|---|')
  w(`| Console | ${escape(store.console)} |`)
  w(`| Listing copy | \`${store.listing}\` |`)
  if (store.readme) w(`| Asset notes | \`${store.readme}\` |`)
  w(`| Locales | ${escape(store.locales.join(', '))} |`)
  if (store.note) {
    w()
    w(store.note)
  }
  w()

  w('### Images')
  w()
  w('| Slot | Status | Have it | Spec | Where it lives |')
  w('|---|---|---|---|---|')
  for (const image of store.images) {
    const where = image.dir ? `\`${image.dir}\`` : '—'
    const name = image.locale ? `${image.slot} (${image.locale})` : image.slot
    w(
      `| ${escape(name)} | ${MARK[image.status]} | ${state(image)} | ${escape(spec(image))} ` +
        `| ${where} |`
    )
  }
  w()
  for (const [slot, note] of notes(store.images)) w(`- **${slot}** — ${note}`)
  w()

  w('### Text and form fields')
  w()
  w('| Field | Status | Have it | Limit |')
  w('|---|---|---|---|')
  for (const slot of store.text) {
    w(
      `| ${escape(slot.slot)} | ${MARK[slot.status]} | ${state(slot)} ` +
        `| ${escape(textSpec(slot))} |`
    )
  }
  w()
  for (const [slot, note] of notes(store.text)) w(`- **${slot}** — ${note}`)
  w()
}

w('---')
w()
w('## Keeping this true')
w()
w(`- \`${REGISTRY}\` is the source. This document is generated from it.`)
w('- `node tools/gen-store-assets-doc.mjs` rewrites this file.')
w('- `node tools/gen-store-assets-doc.mjs --check` fails when the two disagree, and runs in CI.')
w('- `node tools/check-store-images.mjs` measures every image slot that has files against its row above.')
w('- `node tools/check-store-listings.mjs` measures every character-limited text field and cross-checks it against the registry.')
w()
w('The URL, email and form-answer rows are not machine-checked — no store')
w('publishes a schema for them. They are here so the form gets filled in')
w('completely, and the listing files hold the answers to copy across.')
w()
w('Adding a slot means adding it to the registry first. The checkers and this')
w('document follow from that, which is the point: a slot that is not in the')
w('registry is a slot nobody is going to remember at submission time.')
w()

const rendered = lines.join('\n')
const target = join(root, registry.document)

if (check) {
  let current = null
  try {
    current = readFileSync(target, 'utf8').replace(/\r\n/g, '\n')
  } catch {
    console.log(`${registry.document} does not exist. Run: node tools/gen-store-assets-doc.mjs`)
    process.exit(1)
  }
  if (current !== rendered) {
    console.log(
      `${registry.document} is out of date with ${REGISTRY}.\n` +
        'Run: node tools/gen-store-assets-doc.mjs'
    )
    process.exit(1)
  }
  console.log(`${registry.document} is up to date with ${REGISTRY}.`)
} else {
  writeFileSync(target, rendered)
  const images = registry.stores.flatMap((s) => s.images).length
  const text = registry.stores.flatMap((s) => s.text).length
  console.log(
    `Wrote ${registry.document}: ${registry.stores.length} stores, ` +
      `${images} image slots, ${text} text fields, ${outstanding.length} outstanding.`
  )
}
