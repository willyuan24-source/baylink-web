import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import officialEventMedia from '../src/data/official-event-media.json';
import officialEventDownloads from '../scripts/data/official-event-media-downloads.json';
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
// Fields that document the image; pages and the home catalog do not need them.
const DOWNLOAD_ONLY = ['eventId', 'artwork'] as const;
// The download record (original URL, retrieval time, SHA-256) lives in scripts/data/official-event-media-downloads.json:
// the registry ships in the site's JavaScript with the image registry, the download record is not (CNT-MEDIA-2).
const DOWNLOAD_RECORD = ['originalUrl', 'retrievedAt', 'sha256'] as const;
const downloads = officialEventDownloads as Record<string, { originalUrl: string; retrievedAt: string; sha256: string }>;
const download = (record: OfficialRecord) => downloads[record.key];

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
const imageManifest = JSON.parse(readFileSync(new URL('../src/data/generated/image-manifest.json', import.meta.url), 'utf8')) as { images: Record<string, { srcset: string[] }> };

// The 2026-10-14 batch (owner approval 10-14 21:15 PT of the CNT-SUPPLY and CNT-SUPPLY-2 image-candidates lists): 14 of the
// 38 approved files were used after looking at each one (CNT-MEDIA-2 PR lists every file and why the others were skipped).
const BATCH_1014 = new Set([
  'sjpl-almaden-sounds-of-south-asia-2026', 'pleasanton-hometown-holiday-2026', 'pacl-rinconada-tai-chi-2026',
  'berkeley-downtown-saturday-farmers-market-2026', 'fremont-irvington-farmers-market-2026',
  'chsa-lily-qi-book-talk-nov8-2026', 'chsa-taiwanese-chinese-roots-seminar-2026',
  'acl-castro-valley-ohlone-tapestries-2026', 'acl-san-lorenzo-diwali-diya-2026', 'acl-cherryland-chinese-storytimes-oct24-2026',
  'opl-main-family-storytime-2026', 'opl-piedmont-ave-mug-swap-dec12-2026', 'sccl-gilroy-big-book-sale-dec12-2026', 'fopal-book-sale-dec-2026',
]);
// Approved rows that were downloaded and looked at but not used: machine-made looking art, stock-style pictures, third-party
// art or press photos, a child's face up close, logos (the Veterans Day parade file is the chapter's logo share card), files
// too small for the 480 rung.
const SKIPPED_1014 = [
  'sfpl-chinatown-creative-saturdays-fall-2026', 'sfpl-chinatown-creative-saturdays-late-nov-2026', 'sfpl-chinese-book-club-nov14-2026',
  'sjpl-joyce-ellington-halloween-2026', 'sjpl-berryessa-halloween-party-2026', 'sjpl-berryessa-diwali-2026', 'sv-turkey-trot-2026',
  'acl-castro-valley-military-records-2026', 'petaluma-vintage-market-nov15-2026', 'sjpl-alum-rock-basic-english-2026',
  'sjpl-calabazas-chinese-tea-hour-nov21-2026', 'sfpl-glen-park-saturday-playtimes-dec-2026', 'sfpl-potrero-pinecone-owls-dec12-2026',
  'sfpl-main-asl-story-hour-dec12-2026', 'pacl-mitchell-park-family-storytime-2026', 'scl-healdsburg-muffin-man-puppets-nov21-2026',
  'scl-guerneville-mock-caldecott-nov21-2026', 'scl-roseland-global-goodies-nov21-2026', 'scl-windsor-gingerbread-houses-dec5-2026',
  'scl-sonoma-valley-gingerbread-dec13-2026', 'marin-point-reyes-kids-swap-dec5-2026', 'marin-corte-madera-read-to-dog-dec13-2026',
  'sfpl-main-california-xiangqi-invitational-nov28-2026', 'sfpl-bernal-family-game-night-nov28-2026',
  'sjpl-east-carnegie-fratello-marionettes-dec13-2026', 'sj-veterans-day-parade-2026',
];
// The 2026-10-15 batch (owner approval 10-15 18:45 PT of five rows of the 10/24–25 and 10/31–11/1 image-candidates list):
// all five used after looking at each one (CNT-MEDIA-3). One photo; the Pumpkins After Dark photo carries the event name
// edge to edge, so it is shown whole like a graphic; two posters; SF Opera's season illustration as key art.
const BATCH_1015 = new Map([
  ['pleasanton-pumpkins-after-dark-2026', 'graphic'], ['r2-vallejo-wonder-sundays-2026', 'poster'],
  ['r2-vallejo-wonder-deep-dive-2026', 'poster'], ['november-north-sonoma-harvest-market-2026', 'photo'], ['sf-opera-manon-2026', 'key-art'],
]);
// CNT-MEDIA-4's rows of the 2026-10-16 batch (owner approval in chat 10-16 of three rows of
// gpt/out-1016c/image-candidates-nov-dec.md). Two photos ship, after looking at each one. They replace a 2015 venue photo that is
// too old for a cover (both Fort Mason events). The third, Healdsburg's salsa-sales.jpg, shows a stallholder's face close up, so it
// waits for the owner's answer. Neither photo is dated on its page, so each caption says it does not show a listed session.
// Other lanes add their own 10-16 rows (CNT-WEEKEND-1107: two), so this map checks only these event ids; the total below counts
// every 10-16 download.
const MEDIA_4_1016 = new Map([['nov2026-fort-mason-farmers-market', 'photo'], ['nov2026-arion-press-public-tours', 'photo']]);

test('the official event image registry keeps one complete, owner-approved record per image', () => {
  assert.deepEqual(Object.keys(downloads), officialEventMedia.map(record => record.key), 'one download record per image, in registry order');
  const batch1008 = officialEventMedia.filter(record => download(record).retrievedAt.startsWith('2026-10-08'));
  const batch1014 = officialEventMedia.filter(record => download(record).retrievedAt.startsWith('2026-10-14'));
  assert.equal(batch1008.length, 43, 'the 2026-10-08 batch ships 43 of the 54 approved items (10 refused downloads, 1 kept a newer photo)');
  assert.deepEqual([batch1008.filter(record => record.kind === 'photo').length, batch1008.filter(record => record.kind === 'poster').length], [21, 22], '21 photos, 22 posters / key art / collages / graphics');
  assert.deepEqual(new Set(batch1014.map(record => record.eventId)), BATCH_1014, 'the 2026-10-14 batch is exactly the 14 images used');
  assert.deepEqual([batch1014.filter(record => record.kind === 'photo').length, batch1014.filter(record => record.kind === 'poster').length], [5, 9], '5 photos, 9 posters / flyers / graphics');
  const batch1015 = officialEventMedia.filter(record => download(record).retrievedAt.startsWith('2026-10-15'));
  assert.deepEqual(new Map(batch1015.map(record => [record.eventId, record.artwork])), BATCH_1015, 'the 2026-10-15 batch is exactly the 5 approved images');
  const batch1016 = officialEventMedia.filter(record => download(record).retrievedAt.startsWith('2026-10-16'));
  const media4 = batch1016.filter(record => MEDIA_4_1016.has(record.eventId));
  assert.deepEqual(new Map(media4.map(record => [record.eventId, record.artwork])), MEDIA_4_1016, 'CNT-MEDIA-4 ships exactly its 2 photos');
  for (const record of media4) assert.match(record.caption, /拍摄日期未注明[，；]/, `${record.key}: undated, never a listed session`);
  // The Fort Mason market photo sits under /wp-content/uploads/2015/09/, so its caption gives the year it was already online.
  assert.match(media4.find(record => record.eventId === 'nov2026-fort-mason-farmers-market')!.caption, /2015 年就已上传到官网/);
  assert.equal(officialEventMedia.some(record => record.eventId === 'november-north-healdsburg-market-2026'), false, 'Healdsburg waits for the owner');
  assert.equal(officialEventMedia.length, batch1008.length + batch1014.length + batch1015.length + batch1016.length);
  // SF Opera names no illustrator for its season artwork; the Cory Weaver credit on the same page is for production photos.
  assert.equal(officialEventMedia.find(record => record.eventId === 'sf-opera-manon-2026')?.credit, 'SF Opera 官方主视觉');
  assert.match(officialEventMedia.find(record => record.eventId === 'november-north-sonoma-harvest-market-2026')!.credit, /摄影 Melania Mahoney$/);
  for (const id of SKIPPED_1014) assert.equal(officialEventMedia.some(record => record.eventId === id), false, `${id} was looked at and not used`);
  assert.equal(new Set(officialEventMedia.map(record => record.key)).size, officialEventMedia.length);
  assert.equal(new Set(officialEventMedia.map(record => record.eventId)).size, officialEventMedia.length, 'one image per event');
  assert.equal(new Set(officialEventMedia.map(record => record.src)).size, officialEventMedia.length);
  assert.equal(new Set(officialEventMedia.map(record => download(record).sha256)).size, officialEventMedia.length, 'no file was downloaded twice');
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
    for (const field of DOWNLOAD_RECORD) assert.equal(Object.hasOwn(record, field), false, `${record.key}: ${field} belongs in the download record, not the bundled registry`);
    assert.match(new URL(download(record).originalUrl).protocol, /^https?:$/);
    assert.match(download(record).retrievedAt, /^2026-10-(08|14|15|16)T\d{2}:\d{2}:\d{2}-07:00$/);
    assert.match(download(record).sha256, /^[0-9a-f]{64}$/);
    // Main rendition: 1280 wide or the original width when smaller (never upscaled); small: 480 wide. The record names
    // no srcset: pages get the D8 image ladder built from src and width (scripts/codemods/registry-srcset.mjs).
    assert.ok(record.width <= 1280 && record.width > 480, record.key);
    assert.deepEqual(webpSize(record.src), { width: record.width, height: record.height }, record.key);
    assert.equal(Object.hasOwn(record, 'srcSet'), false, `${record.key}: no hand-written srcset`);
    const small = record.src.replace(/\.webp$/, '-small.webp');
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
    for (const field of ['src', 'width', 'height', 'alt', 'caption', 'credit', 'creditUrl', 'fullFrame', 'focal', 'rights'] as const) {
      assert.deepEqual((image as Record<string, unknown>)[field], (record as Record<string, unknown>)[field], `${record.key}: ${field}`);
    }
    // Pages get the D8 ladder for the same file, starting at the 480 w small file downloaded with it.
    assert.equal(image.srcSet, imageManifest.images[record.src].srcset.join(', '), `${record.key}: srcSet from the image manifest`);
    assert.ok(image.srcSet!.startsWith(`${record.src.replace(/\.webp$/, '-small.webp')} 480w,`), `${record.key}: the 480w rung is the downloaded small file`);
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
