// Image ladder release check (plan D8, quality.md §2.1), run after `npm run build` in release:build / release:hosting.
//   1. Every manifest image and rung exists, matches its recorded size and bytes, and the original is the one the
//      ladder was generated from (else: npm run images:variants).
//   2. Byte budgets: 800w ≤ 90 KB and 1200w ≤ 150 KB, except files listed in scripts/data/image-budget-exceptions.json
//      (a listed file that now fits, or no longer exists, must leave the list).
//   3. The runtime table (image-ladder.json) encodes exactly what the manifest records.
//   4. With dist/: every image a built page references (src or srcset) exists, and the images the homepage requests
//      without scrolling at 390 px / DPR 3 (non-lazy <img>) stay within 450 KB.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXCEPTIONS_PATH, HOME_FIRST_VIEW_BUDGET, IMAGE_BUDGETS, LADDER_PATH, MANIFEST_PATH, webpSize } from './image-budgets.mjs';

const problems = [];
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

// Built pages: referenced files exist; the homepage's eager images fit the first-view budget at DPR 3.
let pages = 0;
let references = 0;
let homeFirstView;
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

if (problems.length) {
  console.error(`Image check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Images verified: ${Object.keys(manifest.images).length} sources, ${rungs} 800/1200 variants (${(rungBytes / 1e6).toFixed(1)} MB), ${exceptions.size} listed budget exceptions`
  + (pages ? `; ${references} image files referenced by ${pages} built pages exist; homepage eager images at DPR 3: ${(homeFirstView.bytes / 1000).toFixed(1)} KB (${homeFirstView.images.join(', ') || 'none'})` : '; no dist/ to check built pages against') + '.');
