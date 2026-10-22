// Image ladder release check (plan D8, quality.md §2.1), run after `npm run build` in release:build / release:hosting.
//   1. Every manifest image and rung exists, matches its recorded size and bytes, and the original is the one the
//      ladder was generated from (else: npm run images:variants).
//   2. Byte budgets: 800w ≤ 90 KB and 1200w ≤ 150 KB, except files listed in scripts/data/image-budget-exceptions.json
//      (a listed file that now fits, or no longer exists, must leave the list).
//   3. The runtime table (image-ladder.json) encodes exactly what the manifest records.
//   4. No stray rung: every public/guides/**/*-800.webp and *-1200.webp is a manifest variant (or itself a registered
//      source), so rungs of removed images cannot pile up in the repository.
//   5. With dist/: every image a built page references (src or srcset) exists, and the images the homepage requests
//      without scrolling at 390 px / DPR 3 (non-lazy <img>) stay within 450 KB. A page that shows an image the manifest
//      did not mark as shown is a warning only (its srcset is the plain -small + original pair until the next
//      `npm run images:variants`), never a failure.
//   6. Home entry tiles (UI9-IMAGES DECISIONS 27): each of the eight tiles' 480 w files is at most 15 KB, or the eight
//      together at most 120 KB; every tile photo (and spare) is registered as subject 'tile' with coverOk false and sits in
//      no card pool (category, venue or AI table), so a tile never repeats a card's picture.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXCEPTIONS_PATH, HOME_FIRST_VIEW_BUDGET, HOME_TILE_BUDGET, HOME_TILE_RECORDS_PATH, HOME_TILES_PATH, IMAGE_BUDGETS, LADDER_PATH, MANIFEST_PATH, webpSize } from './image-budgets.mjs';

const problems = [];
const warnings = [];
const publicFile = src => join('public', src);
const readPublic = src => (existsSync(publicFile(src)) ? readFileSync(publicFile(src)) : undefined);
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const ladder = JSON.parse(readFileSync(LADDER_PATH, 'utf8'));
const exceptions = new Map(JSON.parse(readFileSync(EXCEPTIONS_PATH, 'utf8')).map(entry => [entry.file, entry]));
const budgetFor = rung => (rung === 800 ? IMAGE_BUDGETS.medium : rung === 1200 ? IMAGE_BUDGETS.large : Infinity);

let rungs = 0;
let rungBytes = 0;
for (const [src, image] of Object.entries(manifest.images)) {
  const original = readPublic(src);
  if (!original) { problems.push(`${src}: missing original`); continue; }
  if (createHash('sha1').update(original).digest('hex').slice(0, 16) !== image.sha1) problems.push(`${src}: the original changed after the ladder was generated; run npm run images:variants`);
  const size = webpSize(original, src);
  if (size.width !== image.width || size.height !== image.height) problems.push(`${src}: ${size.width}×${size.height}, manifest says ${image.width}×${image.height}`);
  for (const variant of image.variants) {
    const data = readPublic(variant.file);
    if (!data) { problems.push(`${variant.file}: missing ${variant.rung}w variant`); continue; }
    const actual = webpSize(data, variant.file);
    if (actual.width !== variant.width || actual.height !== variant.height || data.length !== variant.bytes) problems.push(`${variant.file}: does not match the manifest; run npm run images:variants`);
    if (variant.width > image.width) problems.push(`${variant.file}: upscaled beyond the original`);
    if (Math.abs(variant.height - image.height * variant.width / image.width) > 1) problems.push(`${variant.file}: aspect ratio differs from the original (cropped?)`);
    if (variant.rung === 480) continue;
    rungs += 1;
    rungBytes += data.length;
    const over = data.length > budgetFor(variant.rung);
    if (over && !exceptions.has(variant.file)) problems.push(`${variant.file}: ${data.length} B is over the ${variant.rung}w budget (${budgetFor(variant.rung)} B); list it with a reason in ${EXCEPTIONS_PATH} or fix the source`);
    if (!over && exceptions.has(variant.file)) problems.push(`${variant.file}: now within budget; remove it from ${EXCEPTIONS_PATH}`);
  }
  for (const candidate of image.srcset) {
    const file = candidate.split(' ')[0];
    if (!existsSync(publicFile(file))) problems.push(`${src}: srcset names a missing file ${file}`);
  }
}
for (const file of exceptions.keys()) {
  if (!Object.values(manifest.images).some(image => image.variants.some(variant => variant.file === file))) problems.push(`${file}: listed in ${EXCEPTIONS_PATH} but not a ladder variant any more`);
}

// The compact runtime table must say what the manifest says, in the registry's sorted order.
const registry = Object.entries(manifest.images).filter(([, image]) => image.scope === 'registry').map(([src]) => src).sort();
const code = image => `${image.lqip.slice(1)}${(image.variants.some(variant => variant.rung === 800) ? 1 : 0) + (image.variants.some(variant => variant.rung === 1200) ? 2 : 0)}`;
if (ladder.hash !== manifest.registryHash || ladder.count !== registry.length || ladder.count !== manifest.registryCount) problems.push('image-ladder.json was not generated from image-manifest.json; run npm run images:variants');
else if (ladder.codes !== registry.map(src => code(manifest.images[src])).join('')) problems.push('image-ladder.json codes differ from the manifest; run npm run images:variants');
for (const [src, image] of Object.entries(manifest.images)) if (image.scope === 'extra' && ladder.extra[src] !== code(image)) problems.push(`${src}: image-ladder.json extra entry differs from the manifest`);

// Stray rungs: a -800/-1200 file that no manifest variant names (the generator deletes the ones it made; this catches the rest).
const ladderFiles = new Set(Object.entries(manifest.images).flatMap(([src, image]) => [src, ...image.variants.map(variant => variant.file)]));
const strays = [];
const findStrays = (directory, url) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) { findStrays(join(directory, entry.name), `${url}/${entry.name}`); continue; }
    if (/-(800|1200)\.webp$/.test(entry.name) && !ladderFiles.has(`${url}/${entry.name}`)) strays.push(`${url}/${entry.name}`);
  }
};
findStrays(publicFile('guides'), '/guides');
for (const src of strays.sort()) problems.push(`${src}: a -800/-1200 file that is not a ladder variant; delete it (npm run images:variants removes the rungs it made), or rename an original that only looks like a rung`);

// Built pages: referenced files exist; the homepage's eager images fit the first-view budget at DPR 3.
let pages = 0;
let references = 0;
let homeFirstView;
const unmarked = new Set();
if (existsSync('dist/index.html')) {
  const seen = new Set();
  const candidatesOf = tag => {
    const attribute = name => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
    const srcset = attribute('srcset') ?? attribute('srcSet');
    const list = srcset ? srcset.split(',').map(entry => entry.trim().split(/\s+/)).map(([url, width]) => ({ url, width: Number.parseInt(width, 10) })) : [];
    const src = attribute('src');
    return { src, list, sizes: attribute('sizes'), lazy: attribute('loading') === 'lazy' };
  };
  const walk = directory => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!name.endsWith('.html')) continue;
      pages += 1;
      for (const [tag] of readFileSync(path, 'utf8').matchAll(/<img\b[^>]*>/g)) {
        const { src, list } = candidatesOf(tag);
        for (const url of [src, ...list.map(candidate => candidate.url)]) {
          if (!url || !url.startsWith('/guides/') || seen.has(url)) continue;
          seen.add(url);
          references += 1;
          if (!existsSync(publicFile(url))) problems.push(`${path}: references missing ${url}`);
          const image = manifest.images[url];
          if (image?.scope === 'registry' && !image.published && image.bytes > IMAGE_BUDGETS.medium && image.width > 480) unmarked.add(url);
        }
      }
    }
  };
  walk('dist');

  // `sizes` at a 390 px viewport: (max-width|min-width: Npx) conditions; px, vw and calc() lengths.
  const VIEWPORT = 390;
  const DPR = 3;
  const length = value => {
    const expression = value.replace(/calc\(/g, '(').replace(/([\d.]+)vw/g, (_m, n) => `${(Number(n) * VIEWPORT) / 100}`).replace(/([\d.]+)px/g, '$1');
    if (!/^[\d+\-*/(). ]+$/.test(expression)) throw new Error(`Unsupported sizes length: ${value}`);
    return Function(`"use strict"; return (${expression});`)();
  };
  const slotWidth = sizes => {
    for (const entry of (sizes || '100vw').split(/,(?![^(]*\))/).map(part => part.trim())) {
      const match = /^\((max|min)-width:\s*([\d.]+)px\)\s*(.+)$/.exec(entry);
      if (!match) return length(entry);
      const [, bound, limit, value] = match;
      if (bound === 'max' ? VIEWPORT <= Number(limit) : VIEWPORT >= Number(limit)) return length(value);
    }
    return VIEWPORT;
  };
  homeFirstView = { bytes: 0, images: [] };
  for (const [tag] of readFileSync('dist/index.html', 'utf8').matchAll(/<img\b[^>]*>/g)) {
    const { src, list, sizes, lazy } = candidatesOf(tag);
    if (lazy || !src?.startsWith('/')) continue;
    const slot = slotWidth(sizes);
    const sorted = list.filter(candidate => candidate.width > 0).sort((a, b) => a.width - b.width);
    const chosen = sorted.find(candidate => candidate.width / slot >= DPR) ?? sorted.at(-1) ?? { url: src };
    const bytes = readPublic(chosen.url)?.length ?? 0;
    homeFirstView.bytes += bytes;
    homeFirstView.images.push(`${chosen.url} ${(bytes / 1000).toFixed(1)} KB`);
  }
  if (homeFirstView.bytes > HOME_FIRST_VIEW_BUDGET) problems.push(`homepage eager images at DPR ${DPR}: ${homeFirstView.bytes} B > ${HOME_FIRST_VIEW_BUDGET} B (${homeFirstView.images.join(', ')})`);
}

// 6. The home's entry tiles.
const tileRecords = new Map(JSON.parse(readFileSync(HOME_TILE_RECORDS_PATH, 'utf8')).map(record => [record.key, record]));
const tiles = Object.entries(JSON.parse(readFileSync(HOME_TILES_PATH, 'utf8')));
const cardPools = ['src/data/category-photos.json', 'src/data/venue-photos.json', 'src/data/ai-cover-approvals.json'].map(file => readFileSync(file, 'utf8')).join('\n');
const tileFiles = [];
if (tiles.length !== 8) problems.push(`${HOME_TILES_PATH}: ${tiles.length} tiles, the home has 8 entries`);
for (const [tile, { key, spares = [] }] of tiles) {
  for (const photo of [key, ...spares]) {
    const record = tileRecords.get(photo);
    if (!record) { problems.push(`home tile ${tile}: ${photo} is not registered in ${HOME_TILE_RECORDS_PATH}`); continue; }
    if (record.subject !== 'tile' || record.coverOk !== false) problems.push(`${photo}: a tile photo is registered as subject 'tile' with coverOk false`);
    if (cardPools.includes(`"${photo}"`)) problems.push(`${photo}: a tile photo is in a card pool (category, venue or AI table)`);
  }
  const record = tileRecords.get(key);
  if (!record) continue;
  // The 480 w file the manifest lists, else the one images:variants writes next to the original (never the original).
  const small = manifest.images[record.src]?.variants.find(variant => variant.rung === 480);
  const smallFile = small?.file ?? record.src.replace(/\.webp$/, '-small.webp');
  const bytes = small?.bytes ?? readPublic(smallFile)?.length;
  if (bytes === undefined) { problems.push(`home tile ${tile}: no 480 w file for ${record.src}`); continue; }
  tileFiles.push({ tile, file: smallFile, bytes });
}
const tileBytes = tileFiles.reduce((sum, entry) => sum + entry.bytes, 0);
const bigTiles = tileFiles.filter(entry => entry.bytes > HOME_TILE_BUDGET.each);
if (bigTiles.length && tileBytes > HOME_TILE_BUDGET.total) problems.push(`home tiles: ${bigTiles.map(entry => `${entry.file} ${entry.bytes} B`).join(', ')} over ${HOME_TILE_BUDGET.each} B each, and the eight are ${tileBytes} B > ${HOME_TILE_BUDGET.total} B`);

if (unmarked.size) {
  const sample = [...unmarked].sort().slice(0, 6).join(', ');
  warnings.push(`${unmarked.size} images shown on built pages have no 800/1200 rungs yet because the manifest predates that use (${sample}${unmarked.size > 6 ? ', …' : ''}); they render with the plain -small + original srcset. Run npm run images:variants to save those bytes.`);
}
for (const warning of warnings) console.warn(`Image check warning: ${warning}`);

if (problems.length) {
  console.error(`Image check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Images verified: ${Object.keys(manifest.images).length} sources, ${rungs} 800/1200 variants (${(rungBytes / 1e6).toFixed(1)} MB), ${exceptions.size} listed budget exceptions`
  + `; home tiles 480 w: ${(tileBytes / 1000).toFixed(1)} KB for ${tileFiles.length}, largest ${(Math.max(0, ...tileFiles.map(entry => entry.bytes)) / 1000).toFixed(1)} KB`
  + (pages ? `; ${references} image files referenced by ${pages} built pages exist; homepage eager images at DPR 3: ${(homeFirstView.bytes / 1000).toFixed(1)} KB (${homeFirstView.images.join(', ') || 'none'})` : '; no dist/ to check built pages against') + '.');
