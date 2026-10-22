import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { getCover } from '../src/lib/cover';
import { HOME_TILE_BUDGET } from '../scripts/image-budgets.mjs';

/**
 * UI9-IMG-B1b2: the photos under the home's eight entry tiles (UI9-IMAGES DECISIONS 27), approved by the owner in chat on
 * 2026-10-21 16:51 PT (「圖片都過，沒問題」). A tile photo is a navigation image: registered like a stock photo, never a
 * card's cover, never in a card pool, with what HomeImageCredits needs to list it.
 */
const read = <T>(file: string) => JSON.parse(readFileSync(file, 'utf8')) as T;
const tiles = read<Record<string, { key: string; spares: string[] }>>('src/data/home-tile-photos.json');
const records = read<{ key: string; src: string }[]>('src/data/home-tile-stock-photos.json');
const english = read<Record<string, string>>('src/data/home-tile-stock-photos-en.json');
const downloads = read<Record<string, { pageUrl: string; sha256: string; license: string; approval: string; tile: string }>>('scripts/data/home-tile-photos-downloads.json');
const photos = Object.values(tiles).flatMap(({ key, spares }) => [key, ...spares]);

test('the eight home entries each have one tile photo, in the order the home lists them, and the spares are registered', () => {
  assert.deepEqual(Object.keys(tiles), ['today', 'free', 'kids', 'seniors', 'rainy-day', 'no-car', 'new-shops', 'calendar']);
  assert.equal(photos.length, 18, 'the owner approved 18 tile photos: 8 shown and 10 spares');
  assert.equal(new Set(photos).size, photos.length, 'a photo serves one tile');
  assert.deepEqual(records.map(record => record.key).sort(), [...photos].sort(), 'every registered tile photo is a tile\'s photo or spare');
  for (const [tile, { key, spares }] of Object.entries(tiles)) {
    for (const photo of [key, ...spares]) {
      assert.ok(photo.startsWith(`tile-${tile}-`), `${photo} belongs to ${tile}`);
      assert.equal(downloads[photo]?.tile, tile, `${photo}: download record`);
      assert.match(downloads[photo].approval, /圖片都過，沒問題/);
      assert.match(downloads[photo].sha256, /^[0-9a-f]{64}$/);
    }
  }
});

test('a tile photo is a navigation image: subject tile, never a cover, credited and translated for the image credits', () => {
  for (const photo of photos) {
    const image = GUIDE_IMAGES[photo];
    assert.ok(image, photo);
    assert.equal(image.kind, 'photo');
    assert.equal(image.subject, 'tile');
    assert.equal(image.coverOk, false, `${photo}: never a card's cover`);
    assert.ok(typeof image.rights === 'object' && image.rights.basis === 'stock' && image.rights.promoAllowed === true, photo);
    assert.equal(typeof image.rights === 'object' && new URL(image.rights.evidenceUrl!).protocol, 'https:');
    assert.equal(image.creditUrl, typeof image.rights === 'object' ? image.rights.evidenceUrl : undefined);
    assert.equal(image.licenseUrl, 'https://unsplash.com/license');
    assert.equal(downloads[photo].license, 'Unsplash License');
    // No 示意图 badge on a tile (DECISIONS 27), and nothing that reads as official or as the listed place.
    assert.match(image.credit, /^入口配图 · 摄影 .+ \/ Unsplash$/);
    assert.doesNotMatch(`${image.credit} ${image.alt}`, /官方|示意图/);
    for (const text of [image.alt, image.caption, image.credit]) assert.ok(english[text]?.trim(), `${photo}: English for "${text}"`);
    // Cards refuse it: the ladder skips a coverOk false photo for the next candidate.
    const cover = getCover({ kind: 'event', id: 'x-tile', imageKey: photo }, { images: GUIDE_IMAGES, today: '2026-10-21' });
    assert.deepEqual([cover.tier, cover.tier === 'type' && cover.reason], ['type', 'cover-not-ok'], photo);
  }
});

test('no card pool and no record uses a tile photo, so a tile never repeats a card\'s picture', () => {
  const pools = ['src/data/category-photos.json', 'src/data/venue-photos.json', 'src/data/ai-cover-approvals.json'].map(file => readFileSync(file, 'utf8')).join('\n');
  const own = new Set([...MONTHLY_EVENTS, ...currentFreebies, ...currentOpenings, ...guides].map(record => record.imageKey));
  for (const photo of photos) {
    assert.equal(pools.includes(`"${photo}"`), false, `${photo} is in a card pool`);
    assert.equal(own.has(photo), false, `${photo} is a record's own image`);
  }
});

test('each shown tile\'s 480 w file is within 15 KB (DECISIONS 27; verify:images also allows 120 KB for the eight)', () => {
  let total = 0;
  for (const [tile, { key }] of Object.entries(tiles)) {
    const small = GUIDE_IMAGES[key].src.replace(/\.webp$/, '-small.webp');
    const bytes = statSync(`public${small}`).size;
    total += bytes;
    assert.ok(bytes <= HOME_TILE_BUDGET.each, `${tile}: ${small} is ${bytes} B`);
  }
  assert.ok(total <= HOME_TILE_BUDGET.total, `${total} B`);
});
