/**
 * Rasterizes share cards for scripts/generate-share-cards.ts (and the weekly cards): an outlined SVG in, a palette PNG
 * out. The SVGs carry glyph outlines, so resvg never needs a font; sharp's palette quantization keeps a flat
 * typographic card about a third of its RGBA size (three languages of 900 cards stay near the old one-language total).
 */
import { parentPort } from 'node:worker_threads';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
// sharp (a pinned devDependency) shrinks the PNG; without it the card is written as resvg drew it.
const sharp = await import('sharp').then(module => module.default, () => undefined);

export async function rasterize({ svg, out }) {
  const png = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
  const small = sharp ? await sharp(png).png({ palette: true, colors: 192, effort: 4, compressionLevel: 9 }).toBuffer() : png;
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, small);
  return small.length;
}

if (parentPort) parentPort.on('message', async job => {
  try { parentPort.postMessage({ id: job.id, bytes: await rasterize(job) }); } catch (error) { parentPort.postMessage({ id: job.id, error: String(error?.stack || error) }); }
});
