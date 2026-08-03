#!/usr/bin/env node
// Rewrites PNGs without their alpha channel.
//
//   node tools/strip-png-alpha.mjs <file...>
//
// The App Store puts it plainly: "Images can't include alpha channels or
// transparencies", and Play wants 24-bit no-alpha for everything except the app
// icon. Simulator and emulator captures are RGBA, so something has to convert
// them, and that something runs on a CI runner where the only guaranteed tools
// are the ones already in the repository.
//
// Hence zlib, which ships inside Node, rather than a native image library. The
// scope is deliberately narrow: 8-bit non-interlaced images, which is what
// every capture path here produces. Anything else is refused rather than
// guessed at.
//
// Two rules this holds itself to, because it overwrites artwork in place:
//
//   * A pixel that is genuinely translucent is an error, never a silent
//     composite. Dropping alpha from such an image changes how it looks, and a
//     store asset that quietly changes appearance in CI is worse than a failed
//     build. The same goes for a tRNS chunk, which makes a colour transparent
//     without an alpha channel.
//   * The replacement is staged beside the original, decoded again to prove it
//     is readable, and only then renamed over it. An interrupted or malformed
//     write leaves the original intact.

import { readFileSync, writeFileSync, renameSync, unlinkSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// Changing the colour type is a change to a critical chunk, so the PNG spec
// says an ancillary chunk that is not marked safe-to-copy must be dropped.
// An allowlist rather than a denylist: it also covers chunks nobody has
// thought about, including the APNG control chunks, which would otherwise
// describe frames in a channel layout that no longer exists.
const KEEP = new Set(['pHYs', 'tEXt', 'zTXt', 'iTXt', 'tIME', 'sRGB', 'gAMA', 'cHRM', 'iCCP'])

const crcTable = new Int32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}

function crc32(buffer) {
  let c = -1
  for (let i = 0; i < buffer.length; i += 1) c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

/** Every chunk, with its length and checksum verified rather than assumed. */
function chunks(bytes) {
  const list = []
  let offset = 8

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error(`truncated chunk header at byte ${offset}`)
    const length = bytes.readUInt32BE(offset)
    if (length > 0x7fffffff) throw new Error(`chunk at byte ${offset} declares an illegal length`)
    const end = offset + 12 + length
    if (end > bytes.length) {
      throw new Error(`chunk at byte ${offset} runs past the end of the file`)
    }

    const type = bytes.toString('latin1', offset + 4, offset + 8)
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error(`chunk at byte ${offset} has a bogus type`)

    const declared = bytes.readUInt32BE(end - 4)
    const actual = crc32(bytes.subarray(offset + 4, end - 4))
    if (declared !== actual) throw new Error(`the ${type} chunk fails its checksum`)

    list.push({ type, data: bytes.subarray(offset + 8, end - 4) })
    offset = end
    if (type === 'IEND') break
  }

  if (list.length === 0 || list[0].type !== 'IHDR') throw new Error('does not start with IHDR')
  if (list[list.length - 1].type !== 'IEND') throw new Error('does not end with IEND')
  if (!list.some((chunk) => chunk.type === 'IDAT')) throw new Error('has no IDAT')
  return list
}

function encodeChunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
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

/** Reverses the per-row filter, leaving raw samples. */
function unfilter(raw, width, height, bpp) {
  const stride = width * bpp
  if (raw.length !== (stride + 1) * height) {
    throw new Error(
      `the image data is ${raw.length} bytes, but ${width}x${height} needs ${(stride + 1) * height}`
    )
  }

  const out = Buffer.alloc(stride * height)
  let position = 0

  for (let y = 0; y < height; y += 1) {
    const filter = raw[position]
    position += 1
    const line = raw.subarray(position, position + stride)
    position += stride
    const target = y * stride
    const above = target - stride

    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[target + x - bpp] : 0
      const b = y > 0 ? out[above + x] : 0
      const c = y > 0 && x >= bpp ? out[above + x - bpp] : 0
      let value = line[x]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) value += paeth(a, b, c)
      else if (filter !== 0) throw new Error(`unknown row filter ${filter}`)
      out[target + x] = value & 0xff
    }
  }
  return out
}

/** Filters each row with whichever of the five options compresses best. */
function refilter(samples, width, height, bpp) {
  const stride = width * bpp
  const out = Buffer.alloc((stride + 1) * height)
  const candidate = Buffer.alloc(stride)
  let position = 0

  for (let y = 0; y < height; y += 1) {
    const target = y * stride
    const above = target - stride
    let best = null
    let bestScore = Infinity
    let bestFilter = 0

    for (let filter = 0; filter <= 4; filter += 1) {
      let score = 0
      for (let x = 0; x < stride; x += 1) {
        const a = x >= bpp ? samples[target + x - bpp] : 0
        const b = y > 0 ? samples[above + x] : 0
        const c = y > 0 && x >= bpp ? samples[above + x - bpp] : 0
        const value = samples[target + x]
        let filtered = value
        if (filter === 1) filtered = value - a
        else if (filter === 2) filtered = value - b
        else if (filter === 3) filtered = value - ((a + b) >> 1)
        else if (filter === 4) filtered = value - paeth(a, b, c)
        filtered &= 0xff
        candidate[x] = filtered
        // The usual heuristic: treat each byte as signed and prefer the row
        // whose residuals sit closest to zero.
        score += filtered < 128 ? filtered : 256 - filtered
      }
      if (score < bestScore) {
        bestScore = score
        bestFilter = filter
        best = Buffer.from(candidate)
      }
    }

    out[position] = bestFilter
    position += 1
    best.copy(out, position)
    position += stride
  }
  return out
}

function header(parts) {
  const data = parts[0].data
  if (data.length !== 13) throw new Error('IHDR is not 13 bytes')
  return {
    width: data.readUInt32BE(0),
    height: data.readUInt32BE(4),
    depth: data[8],
    colourType: data[9],
    interlace: data[12],
    data,
  }
}

function convert(bytes) {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG')

  const parts = chunks(bytes)
  const ihdr = header(parts)
  const { width, height, depth, colourType, interlace } = ihdr

  if (colourType !== 4 && colourType !== 6) {
    // tRNS carries transparency without an alpha channel, so "no alpha channel"
    // is not the same as "opaque". Removing it is only safe after proving the
    // transparent colour is unused, which is not this tool's job.
    if (parts.some((chunk) => chunk.type === 'tRNS')) {
      throw new Error(
        'carries a tRNS chunk, so it is transparent without an alpha channel; ' +
          'flatten it deliberately instead'
      )
    }
    return null
  }

  if (depth !== 8) throw new Error(`bit depth ${depth} is not supported, only 8`)
  if (interlace !== 0) throw new Error('interlaced PNGs are not supported')

  const bpp = colourType === 6 ? 4 : 2
  const samples = unfilter(
    inflateSync(
      Buffer.concat(parts.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data))
    ),
    width,
    height,
    bpp
  )

  const keep = bpp - 1
  const opaque = Buffer.alloc((samples.length / bpp) * keep)
  let translucent = 0
  for (let i = 0, o = 0; i < samples.length; i += bpp, o += keep) {
    if (samples[i + keep] !== 0xff) translucent += 1
    for (let c = 0; c < keep; c += 1) opaque[o + c] = samples[i + c]
  }
  if (translucent > 0) {
    throw new Error(
      `${translucent} of ${width * height} pixels are translucent, so dropping ` +
        'alpha would change how this image looks; composite it deliberately instead'
    )
  }

  const newHeader = Buffer.from(ihdr.data)
  newHeader[9] = colourType === 6 ? 2 : 0

  return {
    width,
    height,
    samples: opaque,
    bytes: Buffer.concat([
      SIGNATURE,
      encodeChunk('IHDR', newHeader),
      ...parts
        .filter((chunk) => KEEP.has(chunk.type))
        .map((chunk) => encodeChunk(chunk.type, chunk.data)),
      encodeChunk('IDAT', deflateSync(refilter(opaque, width, height, keep), { level: 9 })),
      encodeChunk('IEND', Buffer.alloc(0)),
    ]),
  }
}

/** Reads the result back the same way any decoder would, before installing it. */
function proveReadable(bytes, expected) {
  const parts = chunks(bytes)
  const ihdr = header(parts)
  if (ihdr.width !== expected.width || ihdr.height !== expected.height) {
    throw new Error('the rewritten image has different dimensions')
  }
  if (ihdr.colourType === 4 || ihdr.colourType === 6) {
    throw new Error('the rewritten image still has an alpha channel')
  }
  const bpp = ihdr.colourType === 2 ? 3 : 1
  const samples = unfilter(
    inflateSync(
      Buffer.concat(parts.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data))
    ),
    ihdr.width,
    ihdr.height,
    bpp
  )
  if (!samples.equals(expected.samples)) {
    throw new Error('the rewritten image does not decode back to the same pixels')
  }
}

export function stripFile(file) {
  const before = readFileSync(file)
  const result = convert(before)
  if (result === null) return { skipped: true }

  proveReadable(result.bytes, result)

  // Staged in the same directory so the rename is atomic on the same
  // filesystem: the original is never a partially written file.
  const staging = `${file}.strip-${process.pid}.tmp`
  try {
    writeFileSync(staging, result.bytes)
    renameSync(staging, file)
  } catch (error) {
    try {
      unlinkSync(staging)
    } catch {
      // Nothing to clean up.
    }
    throw error
  }

  return { skipped: false, before: before.length, after: result.bytes.length }
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href

if (isEntryPoint) {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('usage: node tools/strip-png-alpha.mjs <file...>')
    process.exit(2)
  }

  let failed = false
  for (const file of files) {
    try {
      const result = stripFile(file)
      if (result.skipped) {
        console.log(`  no alpha  ${file}`)
      } else {
        const delta = result.after - result.before
        const sign = delta >= 0 ? '+' : '-'
        console.log(
          `  stripped  ${file}  ${(result.before / 1024).toFixed(0)} KB -> ` +
            `${(result.after / 1024).toFixed(0)} KB (${sign}${(Math.abs(delta) / 1024).toFixed(0)} KB)`
        )
      }
    } catch (error) {
      console.error(`  FAILED    ${file}: ${error.message}`)
      failed = true
    }
  }
  if (failed) process.exit(1)
}
