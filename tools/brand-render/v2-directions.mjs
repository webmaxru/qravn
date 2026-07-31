#!/usr/bin/env node
// Renders three candidate colour directions for brand v2 into brand/v2/.
//
// v1 is ink on paper with no colour anywhere. v2 introduces colour to carry a
// sense of security. Nothing here overwrites a v1 asset: this script only
// writes under brand/v2/ so the directions can be compared before one is
// chosen and promoted into brand/ proper.
//
//   npm --prefix tools/brand-render install
//   node tools/brand-render/v2-directions.mjs
//
// Two colours are deliberately unavailable to every direction:
//   - green, because it reads as "safe", which is the one verdict this app
//     refuses to give (Theme.kt makes the same argument about a green tick);
//   - red and amber, because Theme.kt reserves them for "known malicious" and
//     "suspicious", and a brand mark in those colours would read as a permanent
//     verdict.
//
// Violet, on the other hand, is used on purpose. Theme.kt already assigns
// violet-blue to "insufficient evidence" — the unknown. The empty fourth corner
// of the mark means exactly that, so where a direction colours the corner, it
// is speaking the app's own vocabulary rather than decorating.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outRoot = join(root, 'brand', 'v2')

const MONO = "Consolas, 'SF Mono', Menlo, 'DejaVu Sans Mono', 'Liberation Mono', monospace"

/**
 * Each direction names the world it is borrowed from, because a palette with a
 * source is arguable and a palette without one is just a preference.
 */
const directions = [
  {
    id: 'a-stempel',
    name: 'A · Stempel',
    world: 'The stamped and counter-signed document. Norwegian officialdom, ink pad, paper form.',
    ground: '#E9EDE6',
    mark: '#2E2A6B',
    accent: '#8B84D9',
    word: '#1A1830',
    muted: '#5A5878',
  },
  {
    id: 'b-uv',
    name: 'B · UV',
    world: 'A banknote under a blacklight. The security thread only shows when you check.',
    ground: '#0B1E29',
    mark: '#E8F6F7',
    accent: '#7A5CFF',
    word: '#E8F6F7',
    muted: '#7FA6AE',
  },
  {
    // The only direction where colour does not carry the meaning: signage never
    // uses a third hue for nuance, it uses shape. Solid finders, dashed corner.
    id: 'c-skilt',
    name: 'C · Skilt',
    world: 'Norwegian public signage. Two flat colours, legible to everyone, official without shouting.',
    ground: '#0B4F9E',
    mark: '#FFFFFF',
    accent: '#FFFFFF',
    word: '#FFFFFF',
    muted: '#B9D6F2',
  },
]

// Three finder patterns on a 15x15 unit grid. The fourth corner is empty: that
// absence is the whole idea of the mark, so in v2 it is where the accent goes.
const FINDERS = `
    <path d="M0,0 H7 V7 H0 Z M1,1 H6 V6 H1 Z M2,2 H5 V5 H2 Z" />
    <path d="M8,0 H15 V7 H8 Z M9,1 H14 V6 H9 Z M10,2 H13 V5 H10 Z" />
    <path d="M0,8 H7 V15 H0 Z M1,9 H6 V14 H1 Z M2,10 H5 V13 H2 Z" />`

/** The unread corner: dashed, never solid, because it is the part you cannot know yet. */
const ghost = (accent) =>
  `<rect x="8.4" y="8.4" width="6.2" height="6.2" fill="none" stroke="${accent}"
        stroke-width="0.82" stroke-dasharray="1.45 1.13" />`

const icon = (d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"
     role="img" aria-label="qrrrgh">
  <title>qrrrgh</title>
  <rect width="512" height="512" fill="${d.ground}" />
  <g transform="translate(116 116) scale(18.6667)" fill="${d.mark}" fill-rule="evenodd">${FINDERS}
  </g>
  <g transform="translate(116 116) scale(18.6667)">
    ${ghost(d.accent)}
  </g>
</svg>
`

const feature = (d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="1024" height="500"
     role="img" aria-label="qrrrgh, read the link before your camera app opens it">
  <title>qrrrgh</title>
  <rect width="1024" height="500" fill="${d.ground}" />
  <g transform="translate(95 154) scale(12.8)" fill="${d.mark}" fill-rule="evenodd">${FINDERS}
  </g>
  <g transform="translate(95 154) scale(12.8)">
    ${ghost(d.accent)}
  </g>
  <text x="383" y="232" fill="${d.word}" font-family="${MONO}" font-size="94" letter-spacing="-2">qrrrgh</text>
  <text x="383" y="286" fill="${d.muted}" font-family="${MONO}" font-size="25">a camera app is built to open the link</text>
  <text x="386" y="322" fill="${d.accent}" font-family="${MONO}" font-size="25">this one reads it to you first</text>
</svg>
`

const rendered = []

for (const d of directions) {
  const dir = join(outRoot, d.id)
  await mkdir(dir, { recursive: true })

  const iconSvg = icon(d)
  const featureSvg = feature(d)
  await writeFile(join(dir, 'app-icon-maskable.svg'), iconSvg)
  await writeFile(join(dir, 'feature-graphic.svg'), featureSvg)

  const iconPng = await sharp(Buffer.from(iconSvg), { density: 600 })
    .resize(512, 512, { fit: 'fill' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()
  const featurePng = await sharp(Buffer.from(featureSvg), { density: 600 })
    .resize(1024, 500, { fit: 'fill' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()

  await writeFile(join(dir, 'icon-512.png'), iconPng)
  await writeFile(join(dir, 'feature-graphic.png'), featurePng)
  rendered.push({ d, iconPng, featurePng })
  console.log(`${d.id} -> ${relative(root, dir).replaceAll('\\', '/')}`)
}

// One sheet, because three directions are only judgeable side by side —
// and at the size the icon is actually seen, not at 512.
const ROW_H = 500
const SHEET_W = 1160
const sheetH = ROW_H * directions.length + 48

const labels = rendered
  .map(({ d }, i) => {
    const y = 40 + i * ROW_H
    // Unique only: C·Skilt's mark and accent are the same white on purpose,
    // and a duplicated swatch reads as a mistake rather than a decision.
    const palette = [...new Set([d.ground, d.mark, d.accent, d.muted])]
    const swatches = palette
      .map((c, j) => `<rect x="${40 + j * 46}" y="${y + 390}" width="38" height="38" rx="4" fill="${c}" stroke="#00000022" />`)
      .join('\n    ')
    return `<text x="40" y="${y - 12}" fill="#111315" font-family="${MONO}" font-size="26">${d.name}</text>
    <text x="${40 + 190}" y="${y - 12}" fill="#5B6165" font-family="${MONO}" font-size="17">${d.world}</text>
    <text x="${40 + 300}" y="${y + 300}" fill="#8A9095" font-family="${MONO}" font-size="13">launcher sizes</text>
    ${swatches}
    <text x="40" y="${y + 452}" fill="#5B6165" font-family="${MONO}" font-size="15">${palette.join('  ')}</text>`
  })
  .join('\n  ')

const overlay = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${sheetH}">
  ${labels}
</svg>`,
)

const composites = [{ input: overlay, top: 0, left: 0 }]
for (const [i, { iconPng, featurePng }] of rendered.entries()) {
  const y = 40 + i * ROW_H
  composites.push({
    input: await sharp(iconPng).resize(256, 256).toBuffer(),
    top: y,
    left: 40,
  })
  // The dashed corner has to survive a home screen, so judge it there too.
  for (const [j, size] of [96, 72, 48].entries()) {
    composites.push({
      input: await sharp(iconPng).resize(size, size).toBuffer(),
      top: y + 276,
      left: 40 + [0, 112, 200][j],
    })
  }
  composites.push({
    input: await sharp(featurePng).resize(778, 380).toBuffer(),
    top: y,
    left: 330,
  })
}

// Hairlines go on last: a light-ground direction like A would otherwise
// disappear into the sheet and look larger than it is.
const outlines = rendered
  .map((_, i) => {
    const y = 40 + i * ROW_H
    const tiles = [
      [40, y, 256],
      ...[96, 72, 48].map((s, j) => [40 + [0, 112, 200][j], y + 276, s]),
      [330, y, 778, 380],
    ]
    return tiles
      .map(([x, ty, w, h]) => `<rect x="${x - 0.5}" y="${ty - 0.5}" width="${w + 1}" height="${(h ?? w) + 1}" fill="none" stroke="#0000001f" />`)
      .join('\n  ')
  })
  .join('\n  ')

composites.push({
  input: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${sheetH}">
  ${outlines}
</svg>`,
  ),
  top: 0,
  left: 0,
})

await sharp({
  create: { width: SHEET_W, height: sheetH, channels: 3, background: '#FAFAF8' },
})
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(join(outRoot, 'comparison.png'))

console.log(`comparison sheet -> brand/v2/comparison.png (${SHEET_W}x${sheetH})`)
