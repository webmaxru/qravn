#!/usr/bin/env node
// Renders the App Store icon from the canonical brand geometry.
//
//   node tools/gen-ios-appicon.mjs
//
// The icon is generated rather than hand-exported so it cannot drift from
// brand/app-icon.svg, and so a reviewer can see the geometry in a diff instead
// of being asked to trust a binary. It is committed, because Xcode needs the
// PNG as a source asset.
//
// Three things the App Store requires that the SVG deliberately does not have:
// no alpha channel, no rounded corners (iOS applies its own mask, and a baked
// corner shows as a dark seam inside it), and exactly 1024x1024.
//
// No image library: at 1024 every edge in the mark lands on a whole pixel
// (92 units per module, and the only fractional coordinate is .5), so the
// render is exact and antialiasing would only blur it. Writing the PNG by hand
// is a few dozen lines and keeps the repository free of a native dependency
// that exists to draw one square.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'apps/ios/Sources/QravnApp/Resources/Assets.xcassets/AppIcon.appiconset')

const SIZE = 1024

// brand/app-icon.svg: night petrol ground, bone mark.
const GROUND = [0x0c, 0x15, 0x19]
const INK = [0xf1, 0xed, 0xe6]

// The mark is 322 wide inset 95 on a 512 field; doubled for 1024 that is a
// 7-module field at 92 units per module, inset 190. See brand/mark.svg.
const MODULE = 92
const INSET = 190

// One QR finder pattern with the ring left open at the bottom right, plus the
// solid centre. Even-odd, exactly as the SVG declares it.
const SUBPATHS = [
  [
    [0, 0], [7, 0], [7, 5.5], [6, 5.5], [6, 1],
    [1, 1], [1, 6], [5.5, 6], [5.5, 7], [0, 7],
  ],
  [[2, 2], [5, 2], [5, 5], [2, 5]],
]

/** Edges in device pixels, as [x, y0, y1] verticals — the mark is rectilinear,
 *  so a horizontal edge can never be crossed by a horizontal ray. */
const edges = []
for (const points of SUBPATHS) {
  for (const [i, [x0, y0]] of points.entries()) {
    const [x1, y1] = points[(i + 1) % points.length]
    if (x0 !== x1) continue
    edges.push([
      INSET + x0 * MODULE,
      INSET + Math.min(y0, y1) * MODULE,
      INSET + Math.max(y0, y1) * MODULE,
    ])
  }
}

/** Even-odd fill: odd number of crossings to the right means inside. */
function isInk(px, py) {
  let crossings = 0
  for (const [x, yTop, yBottom] of edges) {
    if (x > px && py >= yTop && py < yBottom) crossings += 1
  }
  return (crossings & 1) === 1
}

// Truecolour, 8 bits, no alpha. Each row is prefixed with a filter byte: rows
// identical to the one above use Up, which makes them a run of zeros and lets
// deflate collapse the large flat areas almost entirely.
const stride = SIZE * 3
const raw = Buffer.alloc(SIZE * (stride + 1))
let previous = null
for (let y = 0; y < SIZE; y += 1) {
  const row = Buffer.alloc(stride)
  const py = y + 0.5
  for (let x = 0; x < SIZE; x += 1) {
    const [r, g, b] = isInk(x + 0.5, py) ? INK : GROUND
    row[x * 3] = r
    row[x * 3 + 1] = g
    row[x * 3 + 2] = b
  }
  const offset = y * (stride + 1)
  if (previous && row.equals(previous)) {
    raw[offset] = 2
  } else {
    raw[offset] = 0
    row.copy(raw, offset + 1)
  }
  previous = row
}

const crcTable = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 2 // colour type: truecolour, no alpha
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'AppIcon-1024.png'), png)
console.log(`Wrote AppIcon-1024.png (${SIZE}x${SIZE}, ${png.length} bytes)`)
