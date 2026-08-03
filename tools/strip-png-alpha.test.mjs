// Regression tests for tools/strip-png-alpha.mjs.
//
//   node --test tools/
//
// The PNGs are built here rather than committed, so a case like "a second IDAT
// chunk" or "a bad checksum" can be constructed exactly. The encoder and
// decoder below are deliberately separate from the tool's: if both had the same
// misreading of the spec, a shared implementation would agree with itself and
// prove nothing. The checksums come from node:zlib, which is a third one again.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateSync, inflateSync } from 'node:zlib'

import { stripFile } from './strip-png-alpha.mjs'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const SAMPLES = { 0: 1, 2: 3, 4: 2, 6: 4 }

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 0)
  return Buffer.concat([head, data, tail])
}

const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

function applyFilter(samples, width, height, bpp, filter) {
  const stride = width * bpp
  const out = Buffer.alloc((stride + 1) * height)
  let position = 0
  for (let y = 0; y < height; y += 1) {
    out[position] = filter
    position += 1
    for (let x = 0; x < stride; x += 1) {
      const i = y * stride + x
      const a = x >= bpp ? samples[i - bpp] : 0
      const b = y > 0 ? samples[i - stride] : 0
      const c = y > 0 && x >= bpp ? samples[i - stride - bpp] : 0
      const value = samples[i]
      let filtered = value
      if (filter === 1) filtered = value - a
      else if (filter === 2) filtered = value - b
      else if (filter === 3) filtered = value - ((a + b) >> 1)
      else if (filter === 4) filtered = value - paeth(a, b, c)
      out[position] = filtered & 0xff
      position += 1
    }
  }
  return out
}

function unapplyFilter(raw, width, height, bpp) {
  const stride = width * bpp
  const out = Buffer.alloc(stride * height)
  let position = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[position]
    position += 1
    for (let x = 0; x < stride; x += 1) {
      const i = y * stride + x
      const a = x >= bpp ? out[i - bpp] : 0
      const b = y > 0 ? out[i - stride] : 0
      const c = y > 0 && x >= bpp ? out[i - stride - bpp] : 0
      let value = raw[position]
      position += 1
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) value += paeth(a, b, c)
      out[i] = value & 0xff
    }
  }
  return out
}

function png({
  width,
  height,
  colourType,
  samples,
  depth = 8,
  filter = 0,
  interlace = 0,
  idatParts = 1,
  before = [],
  after = [],
}) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = depth
  ihdr[9] = colourType
  ihdr[12] = interlace

  const bpp = SAMPLES[colourType] * (depth / 8)
  const body = deflateSync(applyFilter(samples, width, height, bpp, filter))
  const step = Math.ceil(body.length / idatParts)
  const idat = []
  for (let at = 0; at < body.length; at += step) {
    idat.push(chunk('IDAT', body.subarray(at, at + step)))
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    ...before.map(([type, data]) => chunk(type, data)),
    ...idat,
    ...after.map(([type, data]) => chunk(type, data)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Reads back only what these tests assert on. */
function decode(bytes) {
  assert.ok(bytes.subarray(0, 8).equals(SIGNATURE), 'lost the PNG signature')
  const found = []
  let offset = 8
  let ihdr = null
  const idat = []
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString('latin1', offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    const declared = bytes.readUInt32BE(offset + 8 + length)
    assert.equal(
      declared,
      crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])),
      `${type} has a bad checksum`
    )
    if (type === 'IHDR') ihdr = data
    if (type === 'IDAT') idat.push(data)
    found.push(type)
    offset += 12 + length
    if (type === 'IEND') break
  }

  const colourType = ihdr[9]
  const width = ihdr.readUInt32BE(0)
  const height = ihdr.readUInt32BE(4)
  return {
    width,
    height,
    depth: ihdr[8],
    colourType,
    chunks: found,
    samples: unapplyFilter(
      inflateSync(Buffer.concat(idat)),
      width,
      height,
      SAMPLES[colourType] * (ihdr[8] / 8)
    ),
  }
}

/** A deterministic gradient, so every row differs and each filter does work. */
function pixels(width, height, channels) {
  const out = Buffer.alloc(width * height * channels)
  let at = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < channels - 1; c += 1) out[at + c] = (x * 7 + y * 13 + c * 29) & 0xff
      out[at + channels - 1] = 0xff
      at += channels
    }
  }
  return out
}

/**
 * Deterministic noise. A smooth gradient is too well behaved to exercise the
 * Paeth predictor's tie-break, so a broken one still round-trips; neighbouring
 * bytes with no relationship hit that branch constantly.
 */
function noise(width, height, channels) {
  const out = Buffer.alloc(width * height * channels)
  let seed = 0x2545f491
  let at = 0
  for (let i = 0; i < width * height; i += 1) {
    for (let c = 0; c < channels - 1; c += 1) {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      out[at + c] = seed & 0xff
    }
    out[at + channels - 1] = 0xff
    at += channels
  }
  return out
}

const dropAlpha = (samples, channels) => {
  const keep = channels - 1
  const out = Buffer.alloc((samples.length / channels) * keep)
  for (let i = 0, o = 0; i < samples.length; i += channels, o += keep) {
    samples.copy(out, o, i, i + keep)
  }
  return out
}

function withFile(bytes, run) {
  const dir = mkdtempSync(join(tmpdir(), 'qravn-png-'))
  const file = join(dir, 'image.png')
  writeFileSync(file, bytes)
  try {
    return run(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

for (const filter of [0, 1, 2, 3, 4]) {
  for (const [shape, make] of [
    ['a gradient', pixels],
    ['noise', noise],
  ]) {
    test(`${shape} in RGBA survives row filter ${filter} with its colours intact`, () => {
      const width = 33
      const height = 17
      const samples = make(width, height, 4)
      withFile(png({ width, height, colourType: 6, samples, filter }), (file) => {
        const result = stripFile(file)
        assert.equal(result.skipped, false)

        const out = decode(readFileSync(file))
        assert.equal(out.colourType, 2, 'should become truecolour')
        assert.equal(out.depth, 8)
        assert.equal(out.width, width)
        assert.equal(out.height, height)
        assert.deepEqual(out.samples, dropAlpha(samples, 4), 'RGB samples changed')
      })
    })
  }
}

test('greyscale with alpha becomes plain greyscale', () => {
  const samples = pixels(6, 5, 2)
  withFile(png({ width: 6, height: 5, colourType: 4, samples }), (file) => {
    stripFile(file)
    const out = decode(readFileSync(file))
    assert.equal(out.colourType, 0)
    assert.deepEqual(out.samples, dropAlpha(samples, 2))
  })
})

test('image data split across several IDAT chunks is reassembled', () => {
  const samples = pixels(20, 20, 4)
  withFile(png({ width: 20, height: 20, colourType: 6, samples, idatParts: 4 }), (file) => {
    stripFile(file)
    const out = decode(readFileSync(file))
    assert.deepEqual(out.samples, dropAlpha(samples, 4))
  })
})

test('a translucent pixel is refused and the file is left alone', () => {
  const samples = pixels(4, 4, 4)
  samples[3 + 4 * 5] = 0x80
  const bytes = png({ width: 4, height: 4, colourType: 6, samples })
  withFile(bytes, (file) => {
    assert.throws(() => stripFile(file), /translucent/)
    assert.deepEqual(readFileSync(file), bytes, 'the original was modified')
  })
})

test('a tRNS chunk is refused rather than silently dropped', () => {
  // Truecolour with no alpha channel, but one colour declared transparent.
  const samples = pixels(4, 4, 3)
  const bytes = png({
    width: 4,
    height: 4,
    colourType: 2,
    samples,
    before: [['tRNS', Buffer.from([0, 0, 0, 0, 0, 0])]],
  })
  withFile(bytes, (file) => {
    assert.throws(() => stripFile(file), /tRNS/)
    assert.deepEqual(readFileSync(file), bytes)
  })
})

test('an image with no alpha at all is left byte-identical', () => {
  const bytes = png({ width: 4, height: 4, colourType: 2, samples: pixels(4, 4, 3) })
  withFile(bytes, (file) => {
    assert.equal(stripFile(file).skipped, true)
    assert.deepEqual(readFileSync(file), bytes)
  })
})

test('stripping twice changes nothing the second time', () => {
  withFile(png({ width: 8, height: 8, colourType: 6, samples: pixels(8, 8, 4) }), (file) => {
    stripFile(file)
    const once = readFileSync(file)
    assert.equal(stripFile(file).skipped, true)
    assert.deepEqual(readFileSync(file), once)
  })
})

test('chunks unsafe to copy are dropped and safe ones are kept', () => {
  const bytes = png({
    width: 4,
    height: 4,
    colourType: 6,
    samples: pixels(4, 4, 4),
    // sBIT describes four channels and would be wrong for three; pHYs is
    // unaffected by the change and is marked safe to copy.
    before: [
      ['sBIT', Buffer.from([8, 8, 8, 8])],
      ['pHYs', Buffer.from([0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1])],
    ],
  })
  withFile(bytes, (file) => {
    stripFile(file)
    const out = decode(readFileSync(file))
    assert.ok(!out.chunks.includes('sBIT'), 'sBIT describes a channel count that no longer exists')
    assert.ok(out.chunks.includes('pHYs'), 'pHYs should survive')
  })
})

test('a corrupted checksum is refused and the file is left alone', () => {
  const bytes = png({ width: 8, height: 8, colourType: 6, samples: pixels(8, 8, 4) })
  bytes[bytes.indexOf(Buffer.from('IDAT', 'latin1')) + 8] ^= 0xff
  withFile(bytes, (file) => {
    assert.throws(() => stripFile(file), /fails its checksum/)
    assert.deepEqual(readFileSync(file), bytes, 'the original was modified')
  })
})

test('a garbled chunk type is refused rather than walked past', () => {
  const bytes = png({ width: 4, height: 4, colourType: 6, samples: pixels(4, 4, 4) })
  bytes[bytes.length - 5] = 0x00
  withFile(bytes, (file) => {
    assert.throws(() => stripFile(file), /bogus type/)
    assert.deepEqual(readFileSync(file), bytes)
  })
})

test('a truncated file is refused', () => {
  const bytes = png({ width: 8, height: 8, colourType: 6, samples: pixels(8, 8, 4) })
  withFile(bytes.subarray(0, bytes.length - 20), (file) => {
    assert.throws(() => stripFile(file), /runs past the end|truncated/)
  })
})

test('16-bit and interlaced images are refused rather than guessed at', () => {
  const deep = png({
    width: 2,
    height: 2,
    colourType: 6,
    depth: 16,
    samples: Buffer.alloc(2 * 2 * 8, 0xff),
  })
  withFile(deep, (file) => assert.throws(() => stripFile(file), /bit depth 16/))

  const woven = png({
    width: 4,
    height: 4,
    colourType: 6,
    samples: pixels(4, 4, 4),
    interlace: 1,
  })
  withFile(woven, (file) => assert.throws(() => stripFile(file), /interlaced/))
})

test('a file that is not a PNG is refused', () => {
  withFile(Buffer.from('nowhere near a PNG'), (file) => {
    assert.throws(() => stripFile(file), /not a PNG/)
  })
})

test('no temporary file is left behind by a refusal', () => {
  const samples = pixels(4, 4, 4)
  samples[3] = 0x10
  const dir = mkdtempSync(join(tmpdir(), 'qravn-png-'))
  const file = join(dir, 'image.png')
  writeFileSync(file, png({ width: 4, height: 4, colourType: 6, samples }))
  assert.throws(() => stripFile(file))
  assert.deepEqual(readdirSync(dir), ['image.png'])
  rmSync(dir, { recursive: true, force: true })
})
