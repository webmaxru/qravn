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

/** @type {Array<{from: string, to: string, width: number, height?: number}>} */
const targets = [
  // Web app manifest.
  { from: 'app-icon.svg', to: join(webPublic, 'icon-192.png'), width: 192 },
  { from: 'app-icon.svg', to: join(webPublic, 'icon-512.png'), width: 512 },
  { from: 'app-icon-maskable.svg', to: join(webPublic, 'maskable-512.png'), width: 512 },
  // iOS rounds this itself, so it takes the square full-bleed artwork.
  { from: 'app-icon-maskable.svg', to: join(webPublic, 'apple-touch-icon.png'), width: 180 },
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

for (const { from, to, width, height } of targets) {
  const svg = await readFile(join(brand, from))
  const png = await sharp(svg, { density: 600 })
    .resize(width, height ?? width, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(to, png)
  console.log(`${from} -> ${relative(root, to).replaceAll('\\', '/')} (${width}x${height ?? width})`)
}
