import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { SCENE3D_POSTCARDS } from '../src/data/scene3d-postcards';
import {
  LARGE_WIDTH, MEDIUM_WIDTH, SMALL_WIDTH, encodeLadderEntry, ladderSrcSet, registryHash, registrySources, variantPath,
  type LadderEntry,
} from '../src/data/image-ladder';
import { publishedImageSources } from './audit-media-coverage';
import { IMAGE_BUDGETS, LOCALIZED_SERVICE_SUFFIXES, MANIFEST_PATH, LADDER_PATH, webpSize } from './image-budgets.mjs';

/**
 * D8 image ladder (npm run images:variants). For every registered image (GUIDE_IMAGES), the localized public-service
 * illustrations and the 3D postcards:
 *   - a dominant colour (`sharp.stats().dominant`, quantised to `#rgb`) for the placeholder;
 *   - 480 w: the existing `-small.webp` (made only when missing).
 * For images a page shows today (scripts/audit-media-coverage.ts `publishedImageSources`) and the postcards, also:
 *   - 1200 w: `-1200.webp` when the original is over the 1200 budget (150 KB): 1200 wide, or the original width when
 *     narrower; the original then leaves the srcset (it stays the `src`, for share cards and old links);
 *   - 800 w: `-800.webp` when the original is over the 800 budget (90 KB) and wider than 800, unless the 1200 rung
 *     already fits the 800 budget.
 * Resize and re-encode only: never upscaled, never cropped, no colour or content edits, no AI. Each rung takes the first
 * quality step that fits its budget; one that cannot fit at the lowest step keeps that encode and must be listed in
 * scripts/data/image-budget-exceptions.json. Unchanged originals are skipped (sha1 + settings in the manifest), so the
 * script is cheap to re-run after a rebase. `--dry-run` encodes in memory and prints what it would add.
 */

const DRY_RUN = process.argv.includes('--dry-run');
// Posters and other full-frame artwork carry small type, so they stop at a higher quality and take a listed exception instead.
const SETTINGS = { version: 1, qualities: { photo: [64, 58, 52, 46, 40], poster: [72, 64, 58, 52] }, effort: 6, smallQuality: 72 } as const;
const settingsKey = JSON.stringify(SETTINGS);

type Variant = { rung: 480 | 800 | 1200; file: string; width: number; height: number; bytes: number; quality?: number; overBudget?: boolean };
type ManifestImage = {
  width: number; height: number; bytes: number; sha1: string; lqip: string;
  /** registry: GUIDE_IMAGES; extra: localized service illustrations and 3D postcards (keyed by path at runtime). */
  scope: 'registry' | 'extra';
  /** Shown on a page today, so it gets the 800/1200 rungs its bytes call for. */
  published: boolean;
  /** Posters keep a higher quality floor for their lettering. */
  artwork: 'photo' | 'poster';
  variants: Variant[];
  srcset: string[];
};
type Manifest = { version: number; settings: string; registryHash: string; registryCount: number; images: Record<string, ManifestImage> };

const publicPath = (src: string) => `public${src}`;
const exists = (file: string) => existsSync(publicPath(file));
const sha1 = (bytes: Buffer) => createHash('sha1').update(bytes).digest('hex').slice(0, 16);
const quantise = (channel: number) => Math.round(channel / 17).toString(16);

async function readManifest(): Promise<Manifest | undefined> {
  try { return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Manifest; } catch { return undefined; }
}

/** The first quality step whose encode fits `budget`; the lowest step when none does (flagged over budget). */
async function encodeWithin(source: Buffer, width: number, budget: number, artwork: 'photo' | 'poster') {
  let last: { data: Buffer; quality: number } | undefined;
  for (const quality of SETTINGS.qualities[artwork]) {
    const data = await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality, effort: SETTINGS.effort }).toBuffer();
    last = { data, quality };
    if (data.length <= budget) return { ...last, overBudget: false };
  }
  return { ...last!, overBudget: true };
}

async function write(file: string, data: Buffer) {
  if (DRY_RUN) return;
  await mkdir(dirname(publicPath(file)), { recursive: true });
  await writeFile(publicPath(file), data);
}

const added = { bytes: 0, files: [] as string[] };

const posterSources = new Set(Object.values(GUIDE_IMAGES).filter(image => image.kind === 'poster').map(image => image.src));

async function processImage(src: string, scope: ManifestImage['scope'], published: boolean, previous: ManifestImage | undefined): Promise<ManifestImage> {
  if (!src.endsWith('.webp')) throw new Error(`${src}: the ladder covers WebP originals only`);
  const original = await readFile(publicPath(src));
  const digest = sha1(original);
  const artwork = posterSources.has(src) ? 'poster' : 'photo';
  if (previous && previous.sha1 === digest && previous.published === published && previous.artwork === artwork && previous.variants.every(variant => exists(variant.file))) return { ...previous, scope };

  const { width, height } = webpSize(original, src);
  const variants: Variant[] = [];
  if (width > SMALL_WIDTH) {
    const file = variantPath(src, 'small');
    let data = exists(file) ? await readFile(publicPath(file)) : undefined;
    if (!data) {
      data = await sharp(original).resize({ width: SMALL_WIDTH }).webp({ quality: SETTINGS.smallQuality, effort: SETTINGS.effort }).toBuffer();
      await write(file, data);
      added.bytes += data.length; added.files.push(file);
    }
    variants.push({ rung: 480, file, ...webpSize(data, file), bytes: data.length });
  }
  const rung = async (target: 800 | 1200, budget: number) => {
    const file = variantPath(src, target);
    const encoded = await encodeWithin(original, Math.min(target, width), budget, artwork);
    await write(file, encoded.data);
    added.bytes += encoded.data.length; added.files.push(file);
    variants.push({ rung: target, file, ...webpSize(encoded.data, file), bytes: encoded.data.length, quality: encoded.quality, ...(encoded.overBudget ? { overBudget: true } : {}) });
    return variants[variants.length - 1];
  };
  if (published) {
    const large = original.length > IMAGE_BUDGETS.large ? await rung(LARGE_WIDTH, IMAGE_BUDGETS.large) : undefined;
    // A 1200 that already fits the 800 budget serves the 800 slot too; a second file would only grow the repository.
    if (width > MEDIUM_WIDTH && original.length > IMAGE_BUDGETS.medium && !(large && large.bytes <= IMAGE_BUDGETS.medium)) await rung(MEDIUM_WIDTH, IMAGE_BUDGETS.medium);
    variants.sort((a, b) => a.rung - b.rung);
  }

  const { dominant } = await sharp(original).stats();
  const lqip = `#${quantise(dominant.r)}${quantise(dominant.g)}${quantise(dominant.b)}`;
  const entry: LadderEntry = { lqip, medium: variants.some(variant => variant.rung === 800), large: variants.some(variant => variant.rung === 1200) };
  return { width, height, bytes: original.length, sha1: digest, lqip, scope, published, artwork, variants, srcset: ladderSrcSet(src, width, entry).split(', ') };
}

const manifestEntry = (image: ManifestImage): LadderEntry => ({
  lqip: image.lqip, medium: image.variants.some(variant => variant.rung === 800), large: image.variants.some(variant => variant.rung === 1200),
});

// The 3D postcards enter the editorial tree as byte-for-byte copies (RC-16): public/opus-bay/** is reference-only.
for (const postcard of SCENE3D_POSTCARDS) {
  if (!postcard.source.startsWith('/opus-bay/postcards/') || !postcard.src.startsWith('/guides/3d/')) throw new Error(`${postcard.key}: postcards copy from /opus-bay/postcards/ into /guides/3d/`);
  if (exists(postcard.src)) {
    const [copy, source] = await Promise.all([readFile(publicPath(postcard.src)), readFile(publicPath(postcard.source))]);
    if (!copy.equals(source)) throw new Error(`${postcard.src} differs from its source ${postcard.source}; delete the copy to refresh it`);
  } else if (!DRY_RUN) {
    await mkdir(dirname(publicPath(postcard.src)), { recursive: true });
    await copyFile(publicPath(postcard.source), publicPath(postcard.src));
  }
}

const registry = registrySources(Object.values(GUIDE_IMAGES));
const published = publishedImageSources();
const localized = registry.filter(src => src.startsWith('/guides/public-services/'))
  .flatMap(src => LOCALIZED_SERVICE_SUFFIXES.map(suffix => ({ src: src.replace(/\.webp$/, `${suffix}.webp`), published: published.has(src) })))
  .filter(({ src }) => exists(src));
const postcards = SCENE3D_POSTCARDS.filter(postcard => exists(postcard.src)).map(postcard => ({ src: postcard.src, published: true }));
const extra = [...localized, ...postcards].sort((a, b) => (a.src < b.src ? -1 : 1));

const stored = await readManifest();
const previous = stored?.settings === settingsKey ? stored.images : {};
const images: Record<string, ManifestImage> = {};
const queue = [
  ...registry.map(src => ({ src, scope: 'registry' as const, published: published.has(src) })),
  ...extra.map(item => ({ ...item, scope: 'extra' as const })),
];
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < queue.length) {
    const { src, scope, published: shown } = queue[next++];
    images[src] = await processImage(src, scope, shown, previous[src]);
  }
}));

// A rung the policy no longer produces (a smaller original, an image no page shows any more) is removed, never left stale.
const removed: string[] = [];
for (const [src, image] of Object.entries(images)) {
  for (const target of [MEDIUM_WIDTH, LARGE_WIDTH] as const) {
    const file = variantPath(src, target);
    if (exists(file) && !image.variants.some(variant => variant.file === file)) {
      removed.push(file);
      if (!DRY_RUN) await unlink(publicPath(file));
    }
  }
}

const sorted = Object.fromEntries(Object.keys(images).sort().map(src => [src, images[src]]));
const manifest: Manifest = { version: 1, settings: settingsKey, registryHash: registryHash(registry), registryCount: registry.length, images: sorted };
const ladder = {
  hash: registryHash(registry),
  count: registry.length,
  codes: registry.map(src => encodeLadderEntry(manifestEntry(images[src]))).join(''),
  extra: Object.fromEntries(extra.map(({ src }) => [src, encodeLadderEntry(manifestEntry(images[src]))])),
};
if (!DRY_RUN) {
  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 1)}\n`);
  await writeFile(LADDER_PATH, `${JSON.stringify(ladder)}\n`);
}

const rungs = Object.values(sorted).flatMap(image => image.variants.filter(variant => variant.rung !== 480));
const over = Object.entries(sorted).flatMap(([src, image]) => image.variants.filter(variant => variant.overBudget).map(variant => `${src} ${variant.rung}w ${variant.bytes} B`));
console.log(`${DRY_RUN ? '[dry run] ' : ''}Image ladder: ${registry.length} registered (${registry.filter(src => published.has(src)).length} shown on pages) + ${extra.length} extra sources; `
  + `${rungs.length} 800/1200 variants, ${(rungs.reduce((sum, variant) => sum + variant.bytes, 0) / 1e6).toFixed(1)} MB in all; `
  + `this run wrote ${added.files.length} files (${(added.bytes / 1e6).toFixed(1)} MB) and removed ${removed.length}.`);
if (over.length) console.log(`Over budget at the lowest quality step (list them in scripts/data/image-budget-exceptions.json):\n  ${over.join('\n  ')}`);
