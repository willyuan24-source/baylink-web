/**
 * Rasterizes share cards for scripts/generate-share-cards.ts (and the weekly cards): an outlined SVG in, a palette PNG
 * out. The SVGs carry glyph outlines, so resvg never needs a font; sharp's palette quantization keeps a flat
 * typographic card about a third of its RGBA size (three languages of 900 cards stay near the old one-language total).
 */
import { parentPort } from 'node:worker_threads';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
// sharp (a pinned devDependency) shrinks the PNG; without it the card is written as resvg drew it.
const sharp = await import('sharp').then(module => module.default, () => undefined);

/**
 * The IDAT's zlib level (HOTFIX-BUILD-TIME, 10-22). Level 9 spent ~40 ms of every card's ~175 ms on a fast Mac (level 4:
 * ~7 ms) for 2.5% fewer bytes over all 3,348 cards; level 3 would cost 4.5%. The pixels do not depend on it.
 */
export const DEFLATE_LEVEL = 4;

const chunk = (type, data) => {
  const length = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, 'latin1'), data]), check = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  check.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, check]);
};
const channels = colour => [colour >>> 24, (colour >>> 16) & 255, (colour >>> 8) & 255, colour & 255];
/** An RGBA colour as the 32-bit number indexedPng keys on ("#FAF6EF" → 0xFAF6EFFF). */
export const rgbaKey = hex => (parseInt(hex.slice(1, 7), 16) * 256 + 255) >>> 0;

/**
 * Every pixel's palette index (HOTFIX-BUILD-TIME: one map scan of the pixels where there were two). The scan
 * numbers the colours in first-seen order and counts them; a run of one colour (the paper, a flat panel) skips the map.
 * The palette is then the colours in first-seen order, or past 256 colours the merged colours in the order the pixels
 * first show them, exactly as indexing the merged pixels one by one would number them.
 */
function indexPixels(data, width, height, keep) {
  const seen = new Map(), colours = [], counts = [], first = new Uint32Array(width * height);
  let last = -1, entry = 0;
  for (let at = 0, pixel = 0; at < data.length; at += 4, pixel++) {
    const colour = data.readUInt32BE(at);
    if (colour !== last) {
      entry = seen.get(colour);
      if (entry === undefined) { entry = colours.length; seen.set(colour, entry); colours.push(colour); counts.push(0); }
      last = colour;
    }
    counts[entry]++;
    first[pixel] = entry;
  }
  let palette = colours, remap;
  if (colours.length > 256) {
    // the rarest colours (never `keep`) join their nearest kept colour, the same way on every machine
    const rarest = colours.map((colour, index) => [colour, counts[index]]).filter(([colour]) => colour !== keep).sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, colours.length - 256).map(([colour]) => colour);
    const kept = colours.filter(colour => !rarest.includes(colour));
    const merged = new Map();
    for (const colour of rarest) {
      const [r, g, b, a] = channels(colour);
      let best = kept[0], distance = Infinity;
      for (const other of kept) {
        const [r2, g2, b2, a2] = channels(other), d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2 + (a - a2) ** 2;
        if (d < distance) { best = other; distance = d; }
      }
      merged.set(colour, best);
    }
    const final = new Map();
    palette = [];
    remap = new Uint8Array(colours.length);
    colours.forEach((colour, index) => {
      const drawn = merged.get(colour) ?? colour;
      let at = final.get(drawn);
      if (at === undefined) { at = palette.length; final.set(drawn, at); palette.push(drawn); }
      remap[index] = at;
    });
  }
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0, pixel = 0, out = 0; y < height; y++) {
    rows[out++] = 0; // filter: none (the usual choice for a palette image)
    if (remap) for (let x = 0; x < width; x++) rows[out++] = remap[first[pixel++]];
    else for (let x = 0; x < width; x++) rows[out++] = first[pixel++];
  }
  return { palette, rows };
}

/**
 * RGBA pixels → an 8-bit indexed PNG, colour for colour (no second quantization, so nothing moves). Only past 256
 * colours do the rarest ones (never `keep`) join their nearest kept colour, the same way on every machine. (The
 * quantizer fills its 8-bit palette, so with the exact paper a card can come to 257: then the rarest colour joins its nearest.)
 */
export function indexedPng(data, width, height, keep) {
  const { palette, rows } = indexPixels(data, width, height, keep);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 3; // 8-bit, indexed
  const alpha = palette.map(colour => colour & 255), translucent = alpha.findLastIndex(value => value !== 255) + 1;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('PLTE', Buffer.from(palette.flatMap(colour => channels(colour).slice(0, 3)))),
    ...translucent ? [chunk('tRNS', Buffer.from(alpha.slice(0, translucent)))] : [],
    chunk('IDAT', deflateSync(rows, { level: DEFLATE_LEVEL })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Every pixel fully opaque (resvg's pixels are premultiplied, so only then are they the PNG's own colours). */
const opaque = pixels => {
  for (let at = 3; at < pixels.length; at += 4) if (pixels[at] !== 255) return false;
  return true;
};

/**
 * The card as a palette PNG. The palette quantizer (libimagequant, in sharp) dithers, and its palette and dither come
 * out differently on another machine (arm64 and x86-64 round its float maths differently): beside a bright photo band
 * it borrows the photo's near-white colours to dither the paper under the band, more or less of it and in other colours
 * on a Linux runner (CI 10-22: a 繁體 guide card's paper under its band stopped reading as paper). So every pixel the
 * drawing paints `paper` (the cards' paper token, CARD_INK.paper) stays exactly that paper: the type area never carries
 * the photo's dither, and the paper under the band is the same on every machine.
 * An opaque card (every card: each is drawn on its paper) goes to the quantizer as resvg's raw pixels — the very RGBA a
 * PNG round trip decodes to, without encoding and decoding 1200 × 630 pixels first (HOTFIX-BUILD-TIME).
 */
export async function cardPng({ svg, paper }) {
  const rendered = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
  if (!sharp) return rendered.asPng();
  const { width, height, pixels: drawn } = rendered;
  const input = opaque(drawn) ? sharp(drawn, { raw: { width, height, channels: 4 } }) : sharp(rendered.asPng());
  const quantized = await input.png({ palette: true, colors: 192, effort: 4, compressionLevel: paper ? 0 : 9 }).toBuffer();
  if (!paper) return quantized;
  const { data, info } = await sharp(quantized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const key = rgbaKey(paper);
  for (let at = 0; at < drawn.length; at += 4) if (drawn.readUInt32BE(at) === key) data.writeUInt32BE(key, at);
  return indexedPng(data, info.width, info.height, key);
}

export async function rasterize({ svg, out, paper }) {
  const small = await cardPng({ svg, paper });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, small);
  return small.length;
}

if (parentPort) parentPort.on('message', async job => {
  try { parentPort.postMessage({ id: job.id, bytes: await rasterize(job) }); } catch (error) { parentPort.postMessage({ id: job.id, error: String(error?.stack || error) }); }
});
