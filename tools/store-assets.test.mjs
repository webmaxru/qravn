// Regression tests for the three tools driven by brand/store-assets.json:
// check-store-images.mjs, check-store-listings.mjs and gen-store-assets-doc.mjs.
//
//   node --test tools/
//
// Each tool resolves everything from its own location, so a test builds a
// throwaway tree — a copy of the tool, a small registry, a listing and a few
// header-only PNGs — and runs it there. Nothing here touches the real registry.
//
// Every case is a single mutation of one known-good fixture, and that fixture
// is itself asserted to pass first. Without that, a mutation could "fail
// correctly" for a reason nobody intended.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'

const tools = dirname(fileURLToPath(import.meta.url))

const IMAGES = 'check-store-images.mjs'
const LISTINGS = 'check-store-listings.mjs'
const DOC = 'gen-store-assets-doc.mjs'

const F = '```'

/**
 * A PNG with a real header and an empty image. The image checker reads IHDR and
 * scans for tRNS; it never decodes pixels, so this is everything it looks at.
 */
function png(width, height, colourType = 2, { trns = false, padTo = 0 } = {}) {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'latin1')
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 0)
    return Buffer.concat([head, data, tail])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = colourType

  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr)]
  if (trns) parts.push(chunk('tRNS', Buffer.from([0, 0, 0, 0, 0, 0])))
  // Padding buys a file big enough to test a maxBytes limit without inventing
  // a real image; tEXt is ignored by everything under test.
  if (padTo > 0) parts.push(chunk('tEXt', Buffer.concat([Buffer.from('Comment\0'), Buffer.alloc(padTo, 0x20)])))
  parts.push(chunk('IDAT', deflateSync(Buffer.alloc(0))), chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(parts)
}

/** The known-good fixture every case below mutates exactly one thing in. */
function fixture() {
  const registry = {
    document: 'brand/STORE-ASSETS.md',
    stores: [
      {
        id: 'test-store',
        name: 'Test Store',
        console: 'Test Console',
        listing: 'listing.md',
        readme: 'brand/README.md',
        locales: ['en-US'],
        images: [
          {
            slot: 'App icon',
            status: 'required',
            provided: true,
            dir: 'brand/icon',
            files: [['icon.png', 64, 64]],
            maxBytes: 1048576,
            alpha: 'forbidden',
            format: '24-bit',
          },
          {
            slot: 'Screenshots',
            status: 'required',
            provided: true,
            dir: 'brand/shots',
            size: [100, 200],
            count: [1, 3],
            maxBytes: 1048576,
            alpha: 'allowed',
          },
          { slot: 'Trailer poster', status: 'optional', provided: false },
        ],
        text: [
          { slot: 'Name', status: 'required', provided: true, kind: 'copy', max: 30 },
          {
            slot: 'Search terms',
            status: 'optional',
            provided: true,
            kind: 'copy',
            max: 30,
            unit: 'item',
            maxUnits: 3,
          },
          { slot: 'Support URL', status: 'required', provided: true, kind: 'url' },
        ],
      },
    ],
  }

  const listing = [
    '# Test listing',
    '',
    '## en-US',
    '',
    '### Name (30 max)',
    '',
    F,
    'QRavn',
    F,
    '',
    '5 characters.',
    '',
    '### Search terms (30 max, up to 3 items)',
    '',
    F,
    'qr scanner',
    F,
    '',
    F,
    'svindel sjekk',
    F,
    '',
  ].join('\n')

  return {
    registry,
    files: {
      'listing.md': listing,
      'brand/icon/icon.png': png(64, 64),
      'brand/shots/one.png': png(100, 200),
      'brand/shots/two.png': png(100, 200),
    },
  }
}

/** Writes a tree and returns a runner bound to it. */
function sandbox(state) {
  const dir = mkdtempSync(join(tmpdir(), 'qravn-store-'))
  mkdirSync(join(dir, 'tools'))
  for (const tool of [IMAGES, LISTINGS, DOC]) {
    copyFileSync(join(tools, tool), join(dir, 'tools', tool))
  }

  const write = (rel, body) => {
    const target = join(dir, rel)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }

  write('brand/store-assets.json', JSON.stringify(state.registry, null, 2))
  for (const [rel, body] of Object.entries(state.files)) write(rel, body)

  return {
    dir,
    write,
    run(tool, ...args) {
      const result = spawnSync(process.execPath, [join(dir, 'tools', tool), ...args], {
        encoding: 'utf8',
      })
      return { status: result.status, output: `${result.stdout}${result.stderr}` }
    },
    dispose() {
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

function withFixture(change, run) {
  const state = fixture()
  if (change) change(state)
  const box = sandbox(state)
  try {
    return run(box)
  } finally {
    box.dispose()
  }
}

const image = (state, slot) => state.registry.stores[0].images.find((i) => i.slot === slot)
const text = (state, slot) => state.registry.stores[0].text.find((t) => t.slot === slot)

test('the fixture passes all three tools, so a failure below means the mutation', () => {
  withFixture(null, (box) => {
    for (const tool of [IMAGES, LISTINGS]) {
      const { status, output } = box.run(tool)
      assert.equal(status, 0, `${tool} rejected the known-good fixture:\n${output}`)
    }
    const generated = box.run(DOC)
    assert.equal(generated.status, 0, generated.output)
    const checked = box.run(DOC, '--check')
    assert.equal(checked.status, 0, `the doc it just wrote is already stale:\n${checked.output}`)
  })
})

// --- check-store-images.mjs -------------------------------------------------

const imageCases = [
  {
    name: 'an image of the wrong size',
    change: (s) => {
      s.files['brand/icon/icon.png'] = png(65, 64)
    },
    expect: /65x64, wanted 64x64/,
  },
  {
    name: 'more screenshots than the slot takes',
    change: (s) => {
      for (const n of ['three', 'four']) s.files[`brand/shots/${n}.png`] = png(100, 200)
    },
    expect: /has 4 files, the store takes 1 to 3/,
  },
  {
    name: 'an alpha channel in a slot that forbids one',
    change: (s) => {
      s.files['brand/icon/icon.png'] = png(64, 64, 6)
    },
    expect: /alpha channel or a tRNS chunk/,
  },
  {
    name: 'transparency smuggled in as a tRNS chunk',
    change: (s) => {
      s.files['brand/icon/icon.png'] = png(64, 64, 2, { trns: true })
    },
    expect: /alpha channel or a tRNS chunk/,
  },
  {
    name: 'a greyscale image where the store demands 24-bit truecolour',
    change: (s) => {
      // No alpha, so only the 24-bit rule can catch this one.
      s.files['brand/icon/icon.png'] = png(64, 64, 0)
    },
    expect: /colour type 0 at 8 bits, but this slot needs 24-bit/,
  },
  {
    name: 'a file over the slot size limit',
    change: (s) => {
      image(s, 'App icon').maxBytes = 512
      s.files['brand/icon/icon.png'] = png(64, 64, 2, { padTo: 2048 })
    },
    expect: /over the .* MB limit/,
  },
  {
    name: 'a directory the registry claims is filled but is not there',
    change: (s) => {
      delete s.files['brand/shots/one.png']
      delete s.files['brand/shots/two.png']
    },
    expect: /does not exist, but the registry says it is provided/,
  },
  {
    name: 'files present in a slot the registry still calls empty',
    change: (s) => {
      image(s, 'Screenshots').provided = false
    },
    expect: /still says this slot is not provided/,
  },
  {
    name: 'a missing file from a fixed file list',
    change: (s) => {
      delete s.files['brand/icon/icon.png']
      s.files['brand/icon/other.png'] = png(64, 64)
    },
    expect: /icon\.png: missing/,
  },
]

for (const { name, change, expect } of imageCases) {
  test(`the image check rejects ${name}`, () => {
    withFixture(change, (box) => {
      const { status, output } = box.run(IMAGES)
      assert.equal(status, 1, `expected a failure, got:\n${output}`)
      assert.match(output, expect)
    })
  })
}

test('an empty slot the registry admits is empty is pending, not a failure', () => {
  const change = (s) => {
    delete s.files['brand/shots/one.png']
    delete s.files['brand/shots/two.png']
    image(s, 'Screenshots').provided = false
  }
  withFixture(change, (box) => {
    const relaxed = box.run(IMAGES)
    assert.equal(relaxed.status, 0, relaxed.output)
    assert.match(relaxed.output, /Pending:/)

    // The capture scripts pass this, and there it has to be a failure.
    const strict = box.run(IMAGES, '--require-complete')
    assert.equal(strict.status, 1, strict.output)
  })
})

// --- check-store-listings.mjs -----------------------------------------------

const listingCases = [
  {
    name: 'a heading whose character limit is not the registry\'s',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace('Name (30 max)', 'Name (40 max)')
    },
    expect: /allows 40 characters, the registry says 30/,
  },
  {
    name: 'a heading whose item count is not the registry\'s',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace('up to 3 items', 'up to 5 items')
    },
    expect: /allows 5 units, the registry says 3/,
  },
  {
    name: 'a field counted in lines where the registry counts items',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace(
        '### Search terms (30 max, up to 3 items)',
        '### Search terms (30 max per line, up to 3 lines)'
      )
    },
    expect: /counts lines, the registry counts items/,
  },
  {
    name: 'a word budget the registry does not have',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace(
        'up to 3 items)',
        'up to 3 items, 9 words total)'
      )
    },
    expect: /allows 9 words, the registry says undefined/,
  },
  {
    name: 'a field in the listing that no registry slot names',
    change: (s) => {
      s.files['listing.md'] += ['', '### Subtitle (30 max)', '', F, 'Sjekk QR-koden', F, ''].join(
        '\n'
      )
    },
    expect: /"Subtitle" is not in brand\/store-assets\.json/,
  },
  {
    name: 'a filled field the registry says is not provided',
    change: (s) => {
      text(s, 'Name').provided = false
    },
    expect: /"Name" is filled in but brand\/store-assets\.json says it is not/,
  },
  {
    name: 'a registry slot with no section in the listing',
    change: (s) => {
      s.registry.stores[0].text.push({
        slot: 'Promotional text',
        status: 'optional',
        provided: true,
        kind: 'copy',
        max: 170,
      })
    },
    expect: /en-US has no measured "Promotional text" section/,
  },
  {
    name: 'a locale heading the registry does not list',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace('## en-US', '## de-DE')
    },
    expect: /"## de-DE" is not one of the registry's locales/,
  },
  {
    name: 'an empty fenced block',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace('QRavn', '')
    },
    expect: /the fenced block is empty/,
  },
  {
    name: 'copy that is over the limit',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace('QRavn', 'Q'.repeat(31))
    },
    expect: /31 characters, limit is 30/,
  },
  {
    name: 'a stated character count that is not the real one',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace('5 characters.', '9 characters.')
    },
    expect: /file says 9 characters, actually 5/,
  },
  {
    name: 'more items than the heading allows',
    change: (s) => {
      s.files['listing.md'] += ['', F, 'falske nettsteder', F, '', F, 'lenkesjekk', F, ''].join('\n')
    },
    expect: /4 items, limit is 3/,
  },
  {
    name: 'a search term made only of words the listing already shows',
    change: (s) => {
      s.files['listing.md'] = s.files['listing.md'].replace('qr scanner', 'QRavn')
    },
    expect: /is only words already in the listing/,
  },
]

for (const { name, change, expect } of listingCases) {
  test(`the listing check rejects ${name}`, () => {
    withFixture(change, (box) => {
      const { status, output } = box.run(LISTINGS)
      assert.equal(status, 1, `expected a failure, got:\n${output}`)
      assert.match(output, expect)
    })
  })
}

// --- gen-store-assets-doc.mjs -----------------------------------------------

const shapeCases = [
  {
    name: 'a status that is not one of the four',
    change: (s) => {
      image(s, 'App icon').status = 'nice to have'
    },
    expect: /status "nice to have" is not a status/,
  },
  {
    name: 'provided left as something other than true or false',
    change: (s) => {
      text(s, 'Name').provided = 'yes'
    },
    expect: /provided is not true or false/,
  },
  {
    name: 'a slot that is both impossible and provided',
    change: (s) => {
      const slot = image(s, 'Trailer poster')
      slot.status = 'n/a'
      slot.provided = true
    },
    expect: /is n\/a yet marked provided/,
  },
  {
    name: 'a half-wired slot that looks measurable but names no directory',
    change: (s) => {
      image(s, 'Trailer poster').size = [1920, 1080]
    },
    expect: /has size but no dir, so nothing reads it/,
  },
  {
    name: 'a slot with both a fixed file list and a size',
    change: (s) => {
      image(s, 'App icon').size = [64, 64]
    },
    expect: /has both a fixed file list and size\/count/,
  },
  {
    name: 'a 24-bit slot that still permits alpha',
    change: (s) => {
      image(s, 'App icon').alpha = 'allowed'
    },
    expect: /24-bit rules out an alpha channel/,
  },
  {
    name: 'a directory with neither a file list nor a size and count',
    change: (s) => {
      delete image(s, 'Screenshots').size
    },
    expect: /neither a file list nor a size and count/,
  },
  {
    name: 'an image slot with no size limit',
    change: (s) => {
      delete image(s, 'App icon').maxBytes
    },
    expect: /has no maxBytes/,
  },
  {
    name: 'an alpha rule that is neither allowed nor forbidden',
    change: (s) => {
      image(s, 'Screenshots').alpha = 'sometimes'
    },
    expect: /alpha "sometimes" is not allowed or forbidden/,
  },
  {
    name: 'a text slot whose kind is not a kind',
    change: (s) => {
      text(s, 'Support URL').kind = 'link'
    },
    expect: /kind "link" is not a kind/,
  },
  {
    name: 'a character limit on a field that is not copy',
    change: (s) => {
      text(s, 'Support URL').max = 200
    },
    expect: /has a character limit but is not copy/,
  },
  {
    name: 'a unit with no limit on how many',
    change: (s) => {
      delete text(s, 'Search terms').maxUnits
    },
    expect: /counts items but sets no limit on how many/,
  },
  {
    name: 'a limit on units without saying what a unit is',
    change: (s) => {
      delete text(s, 'Search terms').unit
    },
    expect: /limits a number of units without saying what a unit is/,
  },
  {
    name: 'a store with no locales',
    change: (s) => {
      s.registry.stores[0].locales = []
    },
    expect: /has no locales/,
  },
  {
    name: 'a store with no listing file',
    change: (s) => {
      delete s.registry.stores[0].listing
    },
    expect: /has no listing/,
  },
  {
    name: 'a slot with no name',
    change: (s) => {
      delete image(s, 'App icon').slot
    },
    expect: /has no name/,
  },
]

for (const { name, change, expect } of shapeCases) {
  test(`the generator refuses ${name}`, () => {
    withFixture(change, (box) => {
      const { status, output } = box.run(DOC)
      assert.equal(status, 1, `expected a failure, got:\n${output}`)
      assert.match(output, expect)
    })
  })
}

test('--check fails once the registry has moved on from the document', () => {
  withFixture(null, (box) => {
    assert.equal(box.run(DOC).status, 0)
    assert.equal(box.run(DOC, '--check').status, 0)

    box.write('brand/STORE-ASSETS.md', 'Some older version of the document.\n')
    const stale = box.run(DOC, '--check')
    assert.equal(stale.status, 1, stale.output)
  })
})

test('--check fails when the document was never generated at all', () => {
  withFixture(null, (box) => {
    const missing = box.run(DOC, '--check')
    assert.equal(missing.status, 1, missing.output)
  })
})

test('the generated document names every slot in the registry', () => {
  withFixture(null, (box) => {
    assert.equal(box.run(DOC).status, 0)
    const doc = readFileSync(join(box.dir, 'brand/STORE-ASSETS.md'), 'utf8')

    for (const slot of [...fixture().registry.stores[0].images, ...fixture().registry.stores[0].text]) {
      assert.ok(doc.includes(slot.slot), `the document never mentions "${slot.slot}"`)
    }
  })
})
