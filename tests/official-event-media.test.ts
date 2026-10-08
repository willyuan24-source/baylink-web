import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import officialEventMedia from '../src/data/official-event-media.json';
import octnovExtraImages from '../src/data/octnov-2026-extra-image-updates.json';
import { OCTNOV_EVENT_MEDIA_UPDATES } from '../src/data/octnov-2026-event-photo-aliases';
import { EVENT_CONTEXT_PHOTOS } from '../src/data/event-image-usage';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { OFFICIAL_EVENT_IMAGE_UPDATES, VERIFIED_EVENT_PLACE_MEDIA_UPDATES, VERIFIED_PLACE_PHOTO_ALIASES } from '../src/data/verified-place-media-updates';
import { loadLocale, translateEditorial, translateText } from '../src/i18n/locale';
import { getImageProvenance } from '../src/lib/image-provenance';
import { getListingImage } from '../src/lib/offer-media';

type OfficialRecord = (typeof officialEventMedia)[number];
const ARTWORK = new Set(['photo', 'poster', 'key-art', 'collage', 'graphic']);
// Fields that document the download; pages and the home catalog do not need them.
const DOWNLOAD_ONLY = ['eventId', 'artwork', 'originalUrl', 'retrievedAt', 'sha256'] as const;

// Read the WebP container size without decoding (same rule as tests/guide-journal.test.tsx).
const webpSize = (src: string) => {
  assert.match(src, /^\/guides\/official-events\/[a-z0-9-]+\.webp$/);
  const data = readFileSync(new URL(`../public${src}`, import.meta.url));
  assert.equal(data.toString('ascii', 0, 4), 'RIFF', src);
  assert.equal(data.toString('ascii', 8, 12), 'WEBP', src);
  assert.equal(data.readUInt32LE(4) + 8, data.length, `${src} must be a complete WebP file`);
  const kind = data.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  if (kind === 'VP8L') {
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  assert.equal(kind, 'VP8 ', src);
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
};

const event = (record: OfficialRecord) => MONTHLY_EVENTS.find(item => item.id === record.eventId);

test('the official event image registry keeps one complete, owner-approved record per image', () => {
  assert.equal(officialEventMedia.length, 43, 'the 2026-10-08 batch ships 43 of the 54 approved items (10 refused downloads, 1 kept a newer photo)');
  assert.deepEqual([officialEventMedia.filter(record => record.kind === 'photo').length, officialEventMedia.filter(record => record.kind === 'poster').length], [21, 22], '21 photos, 22 posters / key art / collages / graphics');
  assert.equal(new Set(officialEventMedia.map(record => record.key)).size, officialEventMedia.length);
  assert.equal(new Set(officialEventMedia.map(record => record.eventId)).size, officialEventMedia.length, 'one image per event');
  assert.equal(new Set(officialEventMedia.map(record => record.src)).size, officialEventMedia.length);
  assert.equal(new Set(officialEventMedia.map(record => record.sha256)).size, officialEventMedia.length, 'no file was downloaded twice');
  for (const record of officialEventMedia) {
    assert.equal(record.key, `official-${record.eventId}`);
    assert.doesNotMatch(record.credit, /\bAI\b|原创插图/, `${record.key}: the credit names the organiser, not BAYLINK's own AI art`);
    assert.ok(ARTWORK.has(record.artwork), record.key);
    // Never an AI illustration kind. Artwork is 'poster' so outing covers and pickers never call it a photo.
    assert.equal(record.kind, record.artwork === 'photo' ? 'photo' : 'poster', `${record.key}: ${record.artwork} is kind ${record.kind}`);
    // Posters, key art, collages and graphics are never cropped (D25); photos carry a crop focus.
    if (record.artwork === 'photo') {
      assert.equal(record.fullFrame, undefined, record.key);
      assert.ok(Array.isArray(record.focal) && record.focal.length === 2 && record.focal.every(value => value >= 0 && value <= 100), record.key);
    } else {
      assert.equal(record.fullFrame, true, `${record.key}: ${record.artwork} stays whole`);
      assert.equal(record.focal, undefined, record.key);
    }
    assert.match(record.credit, /官方/, `${record.key}: the credit says 官方 so the label reads 官方图`);
    assert.match(record.caption, /官方宣传图|活动官方照片/, record.key);
    assert.match(record.caption, /以.*为准|不是|不代表/, `${record.key}: the caption makes no promise about the 2026 event`);
    assert.equal(new URL(record.creditUrl).protocol, 'https:', `${record.key}: links the official event page`);
    assert.ok(['promo-editorial', 'press-kit'].includes(record.rights.basis), record.key);
    assert.equal(new URL(record.rights.evidenceUrl).protocol, 'https:', record.key);
    assert.equal(record.rights.scope, 'same-event coverage only');
    assert.match(new URL(record.originalUrl).protocol, /^https?:$/);
    assert.match(record.retrievedAt, /^2026-10-08T\d{2}:\d{2}:\d{2}-07:00$/);
    assert.match(record.sha256, /^[0-9a-f]{64}$/);
    // Main rendition: 1280 wide or the original width when smaller (never upscaled); small: 480 wide.
    assert.ok(record.width <= 1280 && record.width > 480, record.key);
    assert.deepEqual(webpSize(record.src), { width: record.width, height: record.height }, record.key);
    const small = record.src.replace(/\.webp$/, '-small.webp');
    assert.equal(record.srcSet, `${small} 480w, ${record.src} ${record.width}w`);
    const smallSize = webpSize(small);
    assert.equal(smallSize.width, 480);
    assert.ok(Math.abs(smallSize.height - record.height * 480 / record.width) <= 1, small);
  }
});

test('every event in the set resolves to its official image, labelled 官方图, on listings, planner and detail pages', () => {
  for (const record of officialEventMedia) {
    const listed = event(record);
    assert.ok(listed, `${record.eventId} is a published event`);
    assert.equal(listed.imageKey, record.key, record.eventId);
    assert.equal(PLANNER_EVENTS.find(item => item.id === record.eventId)?.imageKey, record.key, `${record.eventId}: planner and Little Bay read the same image`);
    const image = getListingImage(record.key);
    assert.ok(image, `${record.key}: cards and the detail page resolve it`);
    assert.equal(image.kind, record.kind, `${record.key}: pages read the registry kind`);
    assert.equal(getImageProvenance(image), '官方图');
    assert.equal(getImageProvenance(image, true), 'Official image');
    for (const field of ['src', 'srcSet', 'width', 'height', 'alt', 'caption', 'credit', 'creditUrl', 'fullFrame', 'focal', 'rights'] as const) {
      assert.deepEqual((image as Record<string, unknown>)[field], (record as Record<string, unknown>)[field], `${record.key}: ${field}`);
    }
    for (const field of DOWNLOAD_ONLY) assert.equal(Object.hasOwn(image, field), false, `${record.key}: ${field} stays in the source record`);
  }
});

test('later image maps cannot silently replace an official event image', () => {
  for (const record of officialEventMedia) {
    assert.equal(OFFICIAL_EVENT_IMAGE_UPDATES[record.eventId]?.imageKey, record.key);
    assert.equal(VERIFIED_EVENT_PLACE_MEDIA_UPDATES[record.eventId]?.imageKey, record.key);
    // monthly-edition applies these two after the verified map, so an entry there would win.
    assert.equal(Object.hasOwn(OCTNOV_EVENT_MEDIA_UPDATES, record.eventId), false, `${record.eventId} must not be in OCTNOV_EVENT_MEDIA_UPDATES`);
    assert.equal(Object.hasOwn(octnovExtraImages, record.eventId), false, `${record.eventId} must not be in octnov-2026-extra-image-updates.json`);
    // An event photo of its own is not a venue or theme alias, and no alias still claims the event.
    assert.equal(Object.hasOwn(EVENT_CONTEXT_PHOTOS, record.key), false);
    assert.equal(Object.hasOwn(VERIFIED_PLACE_PHOTO_ALIASES, record.key), false);
    for (const [key, usage] of Object.entries(EVENT_CONTEXT_PHOTOS)) assert.equal(usage.eventIds.includes(record.eventId), false, `${key} still lists ${record.eventId}`);
  }
});

test('a newer real photo of the same event is kept instead of an older official one', () => {
  // The Half Moon Bay press-kit photo (2022, 800 px) was approved but the 2025 parade photo is newer and larger.
  assert.equal(MONTHLY_EVENTS.find(item => item.id === 'half-moon-bay-pumpkin-festival-2026')?.imageKey, 'fresh-pumpkin-parade');
  assert.equal(officialEventMedia.some(record => record.eventId === 'half-moon-bay-pumpkin-festival-2026'), false);
});

test('official image text is complete in English, in the scoped dictionaries and in Traditional Chinese', async () => {
  await loadLocale('en');
  const discovery = JSON.parse(readFileSync(new URL('../src/data/generated/english-scopes/discovery.json', import.meta.url), 'utf8')) as Record<string, string>;
  const ui = JSON.parse(readFileSync(new URL('../src/data/generated/english-scopes/ui.json', import.meta.url), 'utf8')) as Record<string, string>;
  for (const record of officialEventMedia) {
    const image = GUIDE_IMAGES[record.key];
    const translated = translateEditorial({ image }, 'en');
    assert.doesNotMatch(JSON.stringify([translated.image.alt, translated.image.caption, translated.image.credit]), /\p{Script=Han}/u, record.key);
    assert.match(translated.image.credit, /official/i, record.key);
    assert.equal(getImageProvenance(translated.image, true), 'Official image');
    for (const text of [image.alt, image.caption, image.credit]) assert.equal({ ...ui, ...discovery }[text], translateText(text, 'en'), `${record.key}: ${text}`);
  }
  await loadLocale('zh-Hant');
  for (const record of officialEventMedia) {
    const image = GUIDE_IMAGES[record.key];
    assert.equal(translateText(getImageProvenance(image), 'zh-Hant'), '官方圖');
    assert.match(translateText(image.caption, 'zh-Hant'), /官方宣傳圖|活動官方照片/, record.key);
  }
});
