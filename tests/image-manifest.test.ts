import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { GUIDE_IMAGES, getGuideMedia } from '../src/data/guide-media';
import { guides } from '../src/data/guides';
import {
  decodeLadderEntry, encodeLadderEntry, ladderSrcSet, readLadder, registryHash, registrySources, variantPath, type LadderTable,
} from '../src/data/image-ladder';
import { SCENE3D_POSTCARDS, SCENE3D_POSTCARD_FOR, SCENE3D_POSTCARD_IMAGES } from '../src/data/scene3d-postcards';
import { ATTRACTIONS } from '../src/data/attractions';
import { MONTHLY_PLACES } from '../src/data/monthly-edition';
import { getCover } from '../src/lib/cover';
import { getImageProvenance } from '../src/lib/image-provenance';
import { setLocale } from '../src/i18n/locale';
import { publishedImageSources } from '../scripts/audit-media-coverage';
import { IMAGE_BUDGETS, webpSize } from '../scripts/image-budgets.mjs';

type Variant = { rung: 480 | 800 | 1200; file: string; width: number; height: number; bytes: number };
type ManifestImage = { width: number; height: number; bytes: number; lqip: string; scope: 'registry' | 'extra'; published: boolean; artwork: 'photo' | 'poster'; variants: Variant[]; srcset: string[] };
const manifest = JSON.parse(readFileSync(new URL('../src/data/generated/image-manifest.json', import.meta.url), 'utf8')) as { registryHash: string; registryCount: number; images: Record<string, ManifestImage> };
const ladder = JSON.parse(readFileSync(new URL('../src/data/generated/image-ladder.json', import.meta.url), 'utf8')) as LadderTable;
const exceptions = JSON.parse(readFileSync(new URL('../scripts/data/image-budget-exceptions.json', import.meta.url), 'utf8')) as { file: string; reason: string }[];
const file = (src: string) => readFileSync(new URL(`../public${src}`, import.meta.url));
const rung = (image: ManifestImage, width: 800 | 1200) => image.variants.find(variant => variant.rung === width);

test('the generated ladder table belongs to today’s image registry, so every page gets the 480/800/1200 srcset', () => {
  const sources = registrySources(Object.values(GUIDE_IMAGES));
  assert.equal(ladder.hash, registryHash(sources), 'run npm run images:variants after adding or replacing an image');
  assert.equal(ladder.count, sources.length);
  assert.equal(manifest.registryHash, ladder.hash);
  const entries = readLadder(sources);
  assert.equal(entries.size, sources.length, 'a fresh table covers every registered source');
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) {
    const record = manifest.images[image.src];
    assert.ok(record, `${key}: ${image.src} is in the manifest`);
    assert.equal(image.srcSet, record.srcset.join(', '), `${key}: srcset comes from the manifest`);
    assert.equal(image.lqip, record.lqip, `${key}: placeholder colour`);
    assert.match(image.lqip!, /^#[0-9a-f]{3}$/);
    assert.deepEqual({ width: record.width, height: record.height }, { width: image.width, height: image.height }, key);
  }
});

test('every rung exists, is a resize of its original (never upscaled or reframed) and stays within its byte budget', () => {
  const excepted = new Map(exceptions.map(entry => [entry.file, entry.reason]));
  for (const [src, image] of Object.entries(manifest.images)) {
    assert.deepEqual(webpSize(file(src), src), { width: image.width, height: image.height }, src);
    for (const variant of image.variants) {
      const data = file(variant.file);
      assert.deepEqual(webpSize(data, variant.file), { width: variant.width, height: variant.height }, variant.file);
      assert.equal(data.length, variant.bytes, variant.file);
      assert.ok(variant.width <= image.width, `${variant.file} is never wider than its original`);
      assert.ok(Math.abs(variant.height - image.height * variant.width / image.width) <= 1, `${variant.file} keeps the original framing`);
      assert.equal(variant.file, variantPath(src, variant.rung === 480 ? 'small' : variant.rung));
      if (variant.rung === 480) continue;
      const budget = variant.rung === 800 ? IMAGE_BUDGETS.medium : IMAGE_BUDGETS.large;
      if (data.length > budget) assert.ok(excepted.get(variant.file)?.trim(), `${variant.file}: ${data.length} B over budget without a listed reason`);
      else assert.equal(excepted.has(variant.file), false, `${variant.file} fits its budget; drop it from the exception list`);
    }
    for (const candidate of image.srcset) assert.ok(existsSync(new URL(`../public${candidate.split(' ')[0]}`, import.meta.url)), candidate);
  }
  assert.ok(exceptions.length <= 25, 'budget exceptions stay a short, reviewed list');
});

test('rungs follow the bytes: pages that show an image get 800/1200 files only where the original is over budget', () => {
  const published = publishedImageSources();
  for (const [src, image] of Object.entries(manifest.images)) {
    if (image.scope === 'registry') assert.equal(image.published, published.has(src), `${src}: published flag`);
    const medium = rung(image, 800);
    const large = rung(image, 1200);
    if (!image.published) {
      assert.equal(medium ?? large, undefined, `${src}: no page shows it, so no extra files`);
      continue;
    }
    assert.equal(!!large, image.bytes > IMAGE_BUDGETS.large, `${src}: a 1200 rung exactly when the original is over 150 KB`);
    if (large) assert.equal(large.width, Math.min(1200, image.width), src);
    const needsMedium = image.width > 800 && image.bytes > IMAGE_BUDGETS.medium && !(large && large.bytes <= IMAGE_BUDGETS.medium);
    assert.equal(!!medium, needsMedium, `${src}: an 800 rung exactly when the 800 slot would otherwise exceed 90 KB`);
    if (medium) assert.equal(medium.width, 800, src);
    // The largest candidate a page can request is the 1200 rung, or the original while it is within budget.
    const top = image.srcset.at(-1)!.split(' ')[0];
    assert.equal(top, large ? large.file : src, src);
  }
});

test('the srcset builder never names a rung that is not there and falls back as a whole when the table is stale', () => {
  assert.equal(ladderSrcSet('/guides/a/x.webp', 330, { medium: true, large: true }), '/guides/a/x.webp 330w', 'at most 480 wide: its own only candidate');
  assert.equal(ladderSrcSet('/guides/a/x.webp', 1280, { medium: false, large: false }), '/guides/a/x-small.webp 480w, /guides/a/x.webp 1280w');
  assert.equal(ladderSrcSet('/guides/a/x.webp', 1280, { medium: true, large: true }), '/guides/a/x-small.webp 480w, /guides/a/x-800.webp 800w, /guides/a/x-1200.webp 1200w');
  assert.equal(ladderSrcSet('/guides/a/x.webp', 1080, { medium: false, large: true }), '/guides/a/x-small.webp 480w, /guides/a/x-1200.webp 1080w', 'a narrower original keeps its own width');
  assert.equal(ladderSrcSet('/guides/a/x.webp', 700, { medium: true, large: false }), '/guides/a/x-small.webp 480w, /guides/a/x.webp 700w', 'no 800 rung for a 700 px original');
  for (const entry of [{ lqip: '#abc', medium: true, large: false }, { lqip: '#012', medium: false, large: true }, { lqip: '#fff', medium: true, large: true }]) {
    assert.deepEqual(decodeLadderEntry(encodeLadderEntry(entry)), entry);
  }
  const sources = ['/guides/a/x.webp', '/guides/b/y.webp'];
  const table: LadderTable = { hash: registryHash(sources), count: 2, codes: 'abc3fff0', extra: {} };
  assert.equal(readLadder(sources, table).get('/guides/a/x.webp')?.large, true);
  assert.equal(readLadder([...sources, '/guides/c/z.webp'], table).size, 0, 'an added image invalidates the whole table');
  assert.equal(readLadder(['/guides/a/x.webp', '/guides/b/renamed.webp'], table).size, 0, 'a renamed image invalidates it too');
});

test('media records name no srcset of their own: the ladder, or its stale-table fallback, builds every one', () => {
  // Hand-written srcsets were ignored once the ladder existed and cost every page that loads the registry 2–4 KB gzip.
  const registry = readFileSync(new URL('../src/data/guide-media.ts', import.meta.url), 'utf8');
  const files = [...registry.matchAll(/from '\.\/([\w-]+\.json)'/g)].map(match => match[1]);
  assert.ok(files.length >= 30, 'the registry still imports its media JSON files');
  for (const name of files) {
    assert.doesNotMatch(readFileSync(new URL(`../src/data/${name}`, import.meta.url), 'utf8'), /"srcSet"\s*:/, `${name}: run node scripts/codemods/registry-srcset.mjs`);
  }
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) assert.ok(image.srcSet, `${key}: every registered image has a srcset`);
});

test('localized public-service illustrations keep their own files in every locale', async () => {
  const guide = guides.find(item => getGuideMedia(item).cover.src.startsWith('/guides/public-services/'))!;
  assert.ok(guide, 'a guide uses a public-service illustration');
  for (const locale of ['en', 'zh-Hant'] as const) {
    await setLocale(locale, false);
    const cover = getGuideMedia(guide).cover;
    assert.match(cover.src, locale === 'en' ? /-en\.webp$/ : /-hant\.webp$/);
    assert.equal(cover.srcSet, manifest.images[cover.src].srcset.join(', '));
    for (const candidate of cover.srcSet!.split(', ')) assert.ok(existsSync(new URL(`../public${candidate.split(' ')[0]}`, import.meta.url)), candidate);
  }
  await setLocale('zh-Hans', false);
});

test('the 3D postcards are byte-for-byte copies in /guides/3d, labelled 3D 场景插图 and used only for SF places', () => {
  assert.ok(SCENE3D_POSTCARDS.length >= 6 && SCENE3D_POSTCARDS.length <= 12, 'a small chosen set');
  const knownPlaces = new Set([...ATTRACTIONS.map(item => item.id), ...MONTHLY_PLACES.map(place => place.id), ...guides.map(guide => guide.slug)]);
  for (const postcard of SCENE3D_POSTCARDS) {
    assert.match(postcard.src, /^\/guides\/3d\/[a-z0-9-]+\.webp$/);
    assert.match(postcard.source, /^\/opus-bay\/postcards\/sf-[a-z0-9-]+-1200\.webp$|^\/opus-bay\/postcards\/(ferry-building-dawn|sea-lions)-1200\.webp$/);
    assert.ok(file(postcard.src).equals(file(postcard.source)), `${postcard.src} is an unmodified copy`);
    assert.equal(postcard.scene3d, true);
    assert.equal(postcard.kind, 'illustration');
    assert.equal(getImageProvenance(postcard), '3D 场景插图');
    assert.equal(getImageProvenance(postcard, true), '3D scene illustration');
    assert.match(postcard.caption, /AI 生成/);
    assert.match(postcard.caption, /不是实景照片/);
    assert.match(postcard.credit, /AI/);
    assert.match(postcard.en.caption, /AI-generated/);
    assert.doesNotMatch(`${postcard.en.alt} ${postcard.en.caption} ${postcard.en.credit} ${postcard.subject.en}`, /\p{Script=Han}/u);
    assert.equal(postcard.srcSet, manifest.images[postcard.src].srcset.join(', '));
    assert.equal(postcard.lqip, manifest.images[postcard.src].lqip);
    for (const place of postcard.places) assert.ok(knownPlaces.has(place), `${postcard.key}: ${place} is an existing attraction, place or guide`);
  }
  const images = (key: string) => GUIDE_IMAGES[key] ?? SCENE3D_POSTCARD_IMAGES[key];
  const placeCover = getCover({ kind: 'place', id: 'palace', postcardKey: SCENE3D_POSTCARD_FOR.palace }, { images, today: '2026-10-09' });
  assert.equal(placeCover.tier, 'scene3d');
  assert.equal(getCover({ kind: 'event', id: 'e', postcardKey: SCENE3D_POSTCARD_FOR.palace }, { images, today: '2026-10-09' }).tier, 'type', 'never on an event');
  // public/opus-bay/** stays reference-only: no ladder files are written next to the originals.
  const opusPostcards = readdirSync(new URL('../public/opus-bay/postcards/', import.meta.url));
  assert.deepEqual(opusPostcards.filter(name => /-(small|800)\.webp$/.test(name)), []);
});

test('the slim home catalog carries the same ladder srcset and placeholder for its images', () => {
  const home = JSON.parse(readFileSync(new URL('../src/data/generated/home-catalog.json', import.meta.url), 'utf8')) as { images: Record<string, { src: string; srcSet: string; lqip?: string }> };
  for (const [key, image] of Object.entries(home.images)) {
    assert.equal(image.srcSet, GUIDE_IMAGES[key].srcSet, key);
    assert.equal(image.lqip, GUIDE_IMAGES[key].lqip, key);
  }
});

test('editorial images under /guides are WebP; the old PNG guide posters are gone', () => {
  for (const guide of guides) if (guide.cover) assert.match(guide.cover, /\.webp$/, guide.slug);
  assert.equal(existsSync(new URL('../public/guides/san-francisco-guide.png', import.meta.url)), false);
  assert.equal(existsSync(new URL('../public/guides/san-jose-guide.png', import.meta.url)), false);
});
