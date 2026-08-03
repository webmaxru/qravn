#!/usr/bin/env node
/**
 * Microsoft Store logo and hero art sources.
 *
 * These are written as SVG files into brand/microsoft-store/ and rasterised by
 * tools/brand-render/render.mjs, so the vectors stay editable and the Store
 * always gets PNG. Run this whenever the artwork changes:
 *
 *   node tools/store-shots/write-store-art.mjs
 *   npm --prefix tools/brand-render run render
 *
 * Three constraints from the Store, and how each is met:
 *
 *   Store display logos (300, 150, 71) are drawn by the Store on both light and
 *   dark listing surfaces with no mask of its own, so the logo is a filled
 *   square rather than a rounded tile with transparent corners.
 *
 *   Super hero art and featured promotional square art must NOT carry the
 *   product's title. Neither does — the mark carries them, which is what the
 *   mark is for. That also makes every hero asset language-neutral, so the
 *   Norwegian and English listings can share one set.
 *
 *   Xbox branded key art and titled hero art must carry the title inside the
 *   top three quarters, because the Store may lay its own text over the bottom
 *   quarter. Both keep everything above that line, with the bottom quarter left
 *   as empty ground.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'brand', 'microsoft-store')

const GROUND = '#0C1519'
const BONE = '#F1EDE6'
const FROST = '#86B2C0'

/** The mark, on a 7x7 grid. See brand/mark.svg for what it is and why. */
const MARK = 'M0,0 H7 V5.5 H6 V1 H1 V6 H5.5 V7 H0 Z M2,2 H5 V5 H2 Z'

/** The wordmark face, matching brand/lockup.svg. */
const MONO = "Consolas, 'SF Mono', Menlo, 'DejaVu Sans Mono', 'Liberation Mono', monospace"

/** Place the mark `size` wide with its top-left corner at (x, y). */
function mark(x, y, size, fill = BONE) {
  const scale = size / 7
  return `  <path transform="translate(${x} ${y}) scale(${scale})" fill="${fill}" fill-rule="evenodd"\n        d="${MARK}" />`
}

/**
 * The viewfinder: three corners, never a fourth.
 *
 * The same open corner the mark has, for the reason apps/web/src/App.css gives
 * for drawing it that way in the app — a closed box would say the loop
 * completes, and this product never closes it by opening anything for you.
 */
function brackets(cx, cy, box, arm, weight) {
  const half = box / 2
  const left = cx - half
  const right = cx + half
  const top = cy - half
  const bottom = cy + half
  const d = [
    `M${left},${top + arm} V${top} H${left + arm}`,
    `M${right - arm},${top} H${right} V${top + arm}`,
    `M${left},${bottom - arm} V${bottom} H${left + arm}`,
  ].join(' ')
  return `  <path d="${d}" fill="none" stroke="${FROST}" stroke-width="${weight}" />`
}

function svg({ width, height, label, note, body }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`,
    `     role="img" aria-label="${label}">`,
    '  <title>QRavn</title>',
    '  <!--',
    ...note.map((line) => `    ${line}`),
    '  -->',
    `  <rect width="${width}" height="${height}" fill="${GROUND}" />`,
    body,
    '</svg>',
    '',
  ].join('\n')
}

const files = {
  'store-logo.svg': svg({
    width: 512,
    height: 512,
    label: 'QRavn',
    note: [
      'Store display logo. Rendered to 300, 150 and 71.',
      '',
      'Square and full bleed, unlike brand/app-icon.svg. The Store draws this',
      'on both light and dark listing surfaces and applies no mask of its own,',
      'so a rounded tile with transparent corners would sit on whatever colour',
      'the page happened to be. A filled square reads the same on both.',
      '',
      "The mark keeps the app icon's proportions - 322 wide on a 512 field,",
      'inset 95 - which still resolves at 71px, where the mark lands on 45.',
    ],
    body: mark(95, 95, 322),
  }),

  'poster-art.svg': svg({
    width: 720,
    height: 1080,
    label: 'QRavn',
    note: [
      'Poster art. Rendered at 720x1080 and 1440x2160.',
      '',
      'Partner Center labels this slot 9:16, but the two sizes it asks for are',
      '720x1080 and 1440x2160, which are 2:3. The pixel dimensions are what is',
      'validated at upload, so this is drawn 2:3 and the ratio label ignored.',
      '',
      'A logo, not a banner: the Store uses this as the main logo for Windows',
      '10/11 customers and requires it for Xbox. So it carries the name, unlike',
      'super-hero.svg, over which the Store lays a title of its own.',
    ],
    body: [
      brackets(360, 430, 560, 96, 5),
      mark(230, 300, 260),
      `  <text x="360" y="860" fill="${BONE}" text-anchor="middle"`,
      `        font-family="${MONO}"`,
      '        font-size="104" letter-spacing="-2">QRavn</text>',
      `  <rect x="278" y="904" width="164" height="3" fill="${FROST}" />`,
    ].join('\n'),
  }),

  'box-art.svg': svg({
    width: 1080,
    height: 1080,
    label: 'QRavn',
    note: [
      'Box art, 1:1. Rendered at 1080x1080 and 2160x2160.',
      '',
      'Also a logo, so it carries the name too. That is the whole difference',
      'between this and xbox-featured-promotional-square.svg, which is the same',
      '1080x1080 but is required to carry no title at all.',
      '',
      'The Store falls back to this as the main logo when poster art is',
      'missing, so it uses the same vertical lockup poster-art.svg does.',
    ],
    body: [
      brackets(540, 430, 600, 104, 5),
      mark(400, 290, 280),
      `  <text x="540" y="880" fill="${BONE}" text-anchor="middle"`,
      `        font-family="${MONO}"`,
      '        font-size="112" letter-spacing="-2">QRavn</text>',
      `  <rect x="452" y="927" width="176" height="3" fill="${FROST}" />`,
    ].join('\n'),
  }),

  'super-hero.svg': svg({
    width: 1920,
    height: 1080,
    label: 'QRavn',
    note: [
      'Super hero art, 16:9. Rendered at 1920x1080 and 3840x2160.',
      '',
      'No title, because the Store lays the product title over this image and',
      'forbids a second one. No tagline either, which keeps the asset',
      'language-neutral: the Norwegian and English listings share it.',
      '',
      'The composition sits right of centre. The Store overlays the title,',
      'publisher and buttons on the left of this band, so that side is left as',
      'ground rather than filled and then covered.',
    ],
    body: [brackets(1330, 540, 860, 150, 5), mark(1140, 350, 380)].join('\n'),
  }),

  'xbox-featured-promotional-square.svg': svg({
    width: 1080,
    height: 1080,
    label: 'QRavn',
    note: [
      'Featured promotional square art, 1:1.',
      '',
      'No title, per the Store requirement. Centred rather than offset: this',
      'one is used as a tile, so it has no reserved edge.',
    ],
    body: [brackets(540, 540, 780, 136, 5), mark(360, 360, 360)].join('\n'),
  }),

  'xbox-branded-key-art.svg': svg({
    width: 584,
    height: 800,
    label: 'QRavn',
    note: [
      'Branded key art, 584x800.',
      '',
      'The title is required, and must sit inside the top three quarters -',
      'above y=600 - because the Store may lay its own text over the bottom',
      'quarter. Everything drawn here ends at y=533.',
    ],
    body: [
      mark(192, 170, 200),
      `  <text x="292" y="490" fill="${BONE}" text-anchor="middle"`,
      `        font-family="${MONO}"`,
      '        font-size="96" letter-spacing="-2">QRavn</text>',
      `  <rect x="217" y="530" width="150" height="3" fill="${FROST}" />`,
    ].join('\n'),
  }),

  'xbox-titled-hero-art.svg': svg({
    width: 1920,
    height: 1080,
    label: 'QRavn',
    note: [
      'Titled hero art, 16:9.',
      '',
      'The title is required and must sit inside the top three quarters -',
      'above y=810. The lockup runs from y=350 to y=632.',
      '',
      'Horizontal lockup, mark then clear space then wordmark, matching',
      'brand/lockup.svg. Monospace, one weight, one colour: QRavn is a name,',
      'and the mark is already doing the talking. The frost rule spans the',
      'whole lockup rather than sitting under one half of it.',
    ],
    body: [
      mark(580, 360, 220),
      `  <text x="890" y="470" fill="${BONE}" dominant-baseline="central"`,
      `        font-family="${MONO}"`,
      '        font-size="168" letter-spacing="-4">QRavn</text>',
      `  <rect x="580" y="628" width="752" height="4" fill="${FROST}" />`,
    ].join('\n'),
  }),
}

await mkdir(out, { recursive: true })
for (const [name, contents] of Object.entries(files)) {
  const path = join(out, name)
  await writeFile(path, contents, 'utf8')
  console.log(relative(root, path).replaceAll('\\', '/'))
}
