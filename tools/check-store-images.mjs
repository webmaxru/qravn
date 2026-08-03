#!/usr/bin/env node
// Checks every committed store image against the slot it is uploaded into.
//
//   node tools/check-store-images.mjs
//   node tools/check-store-images.mjs --require-complete
//
// Three stores, three sets of rules, and every one of them rejects an upload
// that is one pixel off. The slots live in brand/store-assets.json so that this
// check, brand/STORE-ASSETS.md and the store READMEs cannot disagree about what
// the full list is; this file only knows how to measure them.
//
// The two rules worth naming, because both have cost real submissions:
//
//   * The App Store marketing icon must have no alpha channel. iOS applies its
//     own corner mask; a transparent pixel shows as a black one.
//   * Play allows alpha on the app icon and nowhere else. The feature graphic
//     and every screenshot must be 24-bit with no transparency.
//
// No image library. A PNG's IHDR is the first chunk of the file and carries
// everything checked here, so reading it directly keeps a native dependency out
// of a script whose whole job is to look at file headers.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const requireComplete = process.argv.includes('--require-complete')

const MB = 1024 * 1024

const registry = JSON.parse(readFileSync(join(root, 'brand/store-assets.json'), 'utf8'))

// A slot backed by files is measurable. The rest of the registry — the slots
// this product does not fill, and the ones no form even offers it — is
// documented in brand/STORE-ASSETS.md and counted at the end of this run, so
// the output says how much of the list is not being measured here.
const slots = []
let documentedOnly = 0
for (const store of registry.stores) {
  for (const image of store.images) {
    if (image.dir) slots.push({ ...image, store: store.name })
    else documentedOnly += 1
  }
}

/** Alpha can arrive as a channel or as a tRNS chunk; both count as transparency. */
function readPng(file) {
  const bytes = readFileSync(file)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    return { error: 'not a PNG' }
  }
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') {
    return { error: 'PNG does not start with IHDR' }
  }

  const depth = bytes[24]
  const colourType = bytes[25]
  let hasAlpha = colourType === 4 || colourType === 6

  // tRNS is legal for greyscale, truecolour and indexed images alike, and each
  // spelling means the same thing to a store: the image is not fully opaque.
  if (!hasAlpha) {
    let offset = 8
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset)
      const type = bytes.toString('latin1', offset + 4, offset + 8)
      if (type === 'tRNS') {
        hasAlpha = true
        break
      }
      if (type === 'IDAT' || type === 'IEND') break
      offset += 12 + length
    }
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    depth,
    colourType,
    hasAlpha,
    bytes: bytes.length,
  }
}

const failures = []
const pending = []
let checked = 0

const label = (slot) =>
  `${slot.store} · ${slot.slot}${slot.locale ? ` · ${slot.locale}` : ''}`

function checkFile(slot, name, expectedWidth, expectedHeight) {
  const relativePath = `${slot.dir}/${name}`
  const absolute = join(root, slot.dir, name)
  const named = `${label(slot)} · ${name}`

  if (!existsSync(absolute)) {
    failures.push(`${named}: missing`)
    return
  }

  const png = readPng(absolute)
  if (png.error) {
    failures.push(`${named}: ${png.error}`)
    return
  }

  checked += 1
  const problems = []
  if (png.width !== expectedWidth || png.height !== expectedHeight) {
    problems.push(`is ${png.width}x${png.height}, wanted ${expectedWidth}x${expectedHeight}`)
  }
  if (png.bytes > slot.maxBytes) {
    problems.push(`is ${(png.bytes / MB).toFixed(1)} MB, over the ${slot.maxBytes / MB} MB limit`)
  }
  if (slot.alpha === 'forbidden' && png.hasAlpha) {
    problems.push('has an alpha channel or a tRNS chunk, which this slot rejects')
  }
  // "24-bit PNG" is Play's wording, and it rules out an indexed palette and
  // 16-bit samples as well as alpha.
  if (slot.format === '24-bit' && (png.colourType !== 2 || png.depth !== 8)) {
    problems.push(
      `is colour type ${png.colourType} at ${png.depth} bits, but this slot needs 24-bit ` +
        'truecolour (colour type 2, 8 bits)'
    )
  }

  const size = `${String(png.width).padStart(4)}x${String(png.height).padEnd(4)}`
  const weight = `${(png.bytes / 1024).toFixed(0).padStart(6)} KB`
  if (problems.length === 0) {
    console.log(`  ok    ${size} ${weight}  ${relativePath}`)
  } else {
    console.log(`  FAIL  ${size} ${weight}  ${relativePath}`)
    for (const problem of problems) failures.push(`${named}: ${problem}`)
  }
}

for (const slot of slots) {
  const directory = join(root, slot.dir)
  console.log(`\n${label(slot)}`)

  // "Pending" is only honest for a slot the registry already admits is empty.
  // If it claims the files are here, their absence is a failure however CI is
  // invoked — otherwise a deleted screenshot set reads as work in progress.
  const missing = !existsSync(directory) || !statSync(directory).isDirectory()
  if (missing) {
    const message = `${label(slot)}: ${slot.dir} does not exist`
    if (slot.provided) failures.push(`${message}, but the registry says it is provided`)
    else pending.push(message)
    console.log(slot.provided ? '  FAIL, the directory is gone' : '  pending, no directory yet')
    continue
  }

  if (slot.files) {
    for (const entry of slot.files) {
      const [name, width, height] = entry
      checkFile(slot, name, width, height)
    }
    continue
  }

  const names = readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort()

  if (names.length === 0) {
    const message = `${label(slot)}: ${slot.dir} holds no screenshots`
    if (slot.provided) failures.push(`${message}, but the registry says it is provided`)
    else pending.push(message)
    console.log(slot.provided ? '  FAIL, the screenshots are gone' : '  pending, none captured yet')
    continue
  }

  if (!slot.provided) {
    failures.push(
      `${label(slot)}: ${slot.dir} holds ${names.length} files, but the registry ` +
        'still says this slot is not provided; set provided to true'
    )
  }

  const [min, max] = slot.count
  if (names.length < min || names.length > max) {
    failures.push(`${label(slot)}: has ${names.length} files, the store takes ${min} to ${max}`)
  }
  for (const name of names) checkFile(slot, name, slot.size[0], slot.size[1])
}

console.log(
  `\n${checked} images checked across ${registry.stores.length} stores. ` +
    `${documentedOnly} further image slots carry no files; ${registry.document} ` +
    `says which are optional and which cannot apply.`
)

if (pending.length > 0) {
  console.log('\nPending:')
  for (const line of pending) console.log(`  - ${line}`)
  if (requireComplete) {
    console.log('\n--require-complete was passed, so a pending slot is a failure.')
  } else {
    console.log(
      '\n  These are produced on macOS by apps/ios/scripts/capture-store-screenshots.sh.'
    )
  }
}

if (failures.length > 0) {
  console.log('\nFailures:')
  for (const line of failures) console.log(`  - ${line}`)
}

if (failures.length > 0 || (requireComplete && pending.length > 0)) {
  process.exit(1)
}
