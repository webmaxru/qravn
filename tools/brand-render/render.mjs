#!/usr/bin/env node
// Renders the committed PNG brand assets from the SVG sources in brand/.
//
// The SVGs in brand/ are the source of truth. PNGs are committed because the
// Play Console and the web app manifest need raster files, and because we do
// not want an image toolchain in the normal build. Run this only when a brand
// SVG changes:
//
//   npm --prefix tools/brand-render install
//   npm --prefix tools/brand-render run render
//
// sharp lives here and is not a dependency of any shipped app.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const brand = join(root, 'brand')
const webPublic = join(root, 'apps', 'web', 'public')

/** @type {Array<{from: string, to: string, width: number, height?: number, opaque?: string}>} */
const targets = [
  // Web app manifest.
  { from: 'app-icon.svg', to: join(webPublic, 'icon-192.png'), width: 192 },
  { from: 'app-icon.svg', to: join(webPublic, 'icon-512.png'), width: 512 },
  { from: 'app-icon-maskable.svg', to: join(webPublic, 'maskable-512.png'), width: 512 },
  // iOS rounds this itself, so it takes the square full-bleed artwork. It is
  // also flattened: iOS does not composite the alpha channel, it renders
  // transparency as black, so the icon must not carry one at all.
  {
    from: 'app-icon-maskable.svg',
    to: join(webPublic, 'apple-touch-icon.png'),
    width: 180,
    opaque: '#0C1519',
  },
  // Link preview card.
  { from: 'og.svg', to: join(webPublic, 'og.png'), width: 1200, height: 630 },
  // Play Console. The store icon must be square and full bleed; Play rounds it.
  { from: 'app-icon-maskable.svg', to: join(brand, 'play', 'icon-512.png'), width: 512 },
  {
    from: 'play/feature-graphic.svg',
    to: join(brand, 'play', 'feature-graphic.png'),
    width: 1024,
    height: 500,
  },
]

await mkdir(webPublic, { recursive: true })
await mkdir(join(brand, 'play'), { recursive: true })

for (const { from, to, width, height, opaque } of targets) {
  const svg = await readFile(join(brand, from))
  let pipeline = sharp(svg, { density: 600 }).resize(width, height ?? width, { fit: 'fill' })
  if (opaque) pipeline = pipeline.flatten({ background: opaque })
  const png = await pipeline.png({ compressionLevel: 9 }).toBuffer()
  await writeFile(to, png)
  console.log(`${from} -> ${relative(root, to).replaceAll('\\', '/')} (${width}x${height ?? width})`)
}

/**
 * favicon.ico, for the browsers and crawlers that still ask for it by name at
 * the site root regardless of what the markup says.
 *
 * An .ico is a container, and every browser that matters has read PNG-in-ICO
 * since Vista. Writing the 22-byte-per-image container here is less code than
 * a dependency, and keeps the brand toolchain to one library.
 */
async function writeIco(sources, to) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(sources.length, 4)

  const directory = Buffer.alloc(16 * sources.length)
  let offset = header.length + directory.length

  sources.forEach(({ size, png }, i) => {
    const at = i * 16
    // 256 would be written as 0; every size here is smaller, so a plain byte.
    directory.writeUInt8(size, at)
    directory.writeUInt8(size, at + 1)
    directory.writeUInt8(0, at + 2) // palette size, 0 for truecolour
    directory.writeUInt8(0, at + 3) // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(png.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += png.length
  })

  await writeFile(to, Buffer.concat([header, directory, ...sources.map((s) => s.png)]))
}

const icoSvg = await readFile(join(brand, 'app-icon.svg'))
const icoSizes = [16, 32, 48]
const icoSources = await Promise.all(
  icoSizes.map(async (size) => ({
    size,
    png: await sharp(icoSvg, { density: 600 })
      .resize(size, size, { fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  })),
)
const icoPath = join(webPublic, 'favicon.ico')
await writeIco(icoSources, icoPath)
console.log(
  `app-icon.svg -> ${relative(root, icoPath).replaceAll('\\', '/')} (${icoSizes.join('/')})`,
)
