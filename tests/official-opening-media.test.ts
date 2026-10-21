import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import officialOpeningMedia from '../src/data/official-opening-media.json';
import openingDownloads from '../scripts/data/official-opening-media-downloads.json';
import guidePhotos from '../src/data/guide-photos-2026-10-19.json';
import guidePhotoDownloads from '../scripts/data/guide-photos-2026-10-19-downloads.json';
import overlay from '../src/data/media-rights-overlay.json';
import { GUIDE_EXTRA_INLINE, GUIDE_IMAGES, getGuideMedia } from '../src/data/guide-media';
import { guides } from '../src/data/guides';
import { currentOpenings } from '../src/data/local-discoveries';
import { getCover } from '../src/lib/cover';
import { getImageProvenance } from '../src/lib/image-provenance';
import { getListingImage } from '../src/lib/offer-media';
import { loadLocale, translateEditorial, translateText } from '../src/i18n/locale';

// CNT-MEDIA-5 (owner approval in chat 2026-10-19 of the default-checked rows of gpt/out-1020's image review page): 23 new shops
// get their own images, labelled 官方图 with a link to the page that shows them. A brand's product image says so (产品图 or
// 陈列宣传图) and never claims to be the shop, its opening day or its stock. The orange-flagged rows are not used.
type OpeningRecord = (typeof officialOpeningMedia)[number];
const downloads = openingDownloads as Record<string, { originalUrl: string; retrievedAt: string; contentType: string; bytes: number; sha256: string; publisher: string; sourceUrl: string }>;
const ARTWORK = new Set(['photo', 'product', 'graphic']);
const PRODUCT = new Set([
  'eriks-delicafe-san-ramon-relocation', 'thirdlove-valley-fair', 'anya-gifting-larkspur', 'margaux-larkspur', 'pittsburg-nekter-opening-2026',
  'raising-canes-jefferson-sf', 'vivaia-valley-fair', 'berkeley-cere-tea-opening-2026',
]);
// Not used, as the owner decided: a third-party brand's product photo (The Passdoor) and four rows whose HEAD failed.
const REJECTED_OPENINGS = ['passdoor-santa-rosa-opening-2026', 'hey-yogurt-san-mateo', 'yutori-palo-alto-restaurant', 'oakland-55-coffee-pop-up-2026'];
const imageManifest = JSON.parse(readFileSync(new URL('../src/data/generated/image-manifest.json', import.meta.url), 'utf8')) as { images: Record<string, { srcset: string[] }> };
const eventsIndex = JSON.parse(readFileSync(new URL('../src/data/generated/events-index.json', import.meta.url), 'utf8')) as {
  openings: { id: string; imageKey?: string }[]; images: Record<string, { src: string }>;
};

const webpSize = (src: string) => {
  const data = readFileSync(new URL(`../public${src}`, import.meta.url));
  assert.equal(data.toString('ascii', 0, 4), 'RIFF', src);
  assert.equal(data.toString('ascii', 8, 12), 'WEBP', src);
  assert.equal(data.readUInt32LE(4) + 8, data.length, `${src} must be a complete WebP file`);
  const kind = data.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  assert.equal(kind, 'VP8 ', src);
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
};

test('the official new-shop images keep one complete, owner-approved record each', () => {
  assert.equal(officialOpeningMedia.length, 23, '23 new shops');
  assert.deepEqual(Object.keys(downloads), officialOpeningMedia.map(record => record.key), 'one download record per image, in registry order');
  assert.equal(new Set(officialOpeningMedia.map(record => record.openingId)).size, 23, 'one image per shop');
  assert.equal(new Set(officialOpeningMedia.map(record => downloads[record.key].sha256)).size, 23, 'no file was downloaded twice');
  for (const id of REJECTED_OPENINGS) assert.equal(officialOpeningMedia.some(record => record.openingId === id), false, `${id}: the owner did not approve its image`);
  assert.deepEqual(new Set(officialOpeningMedia.filter(record => record.artwork === 'product').map(record => record.openingId)), PRODUCT);
  for (const record of officialOpeningMedia as OpeningRecord[]) {
    assert.equal(record.key, `official-opening-${record.openingId}`);
    assert.ok(ARTWORK.has(record.artwork), record.key);
    assert.equal(record.kind, record.artwork === 'graphic' ? 'poster' : 'photo', `${record.key}: ${record.artwork}`);
    if (record.kind === 'photo') {
      assert.equal(record.fullFrame, undefined, record.key);
      assert.ok(Array.isArray(record.focal) && record.focal.length === 2 && record.focal.every(value => value >= 0 && value <= 100), record.key);
    } else {
      assert.equal(record.fullFrame, true, `${record.key}: a graphic stays whole`);
      assert.equal(record.focal, undefined, record.key);
    }
    assert.match(record.credit, /官方/, `${record.key}: the credit says 官方 so the label reads 官方图`);
    assert.doesNotMatch(record.credit, /\bAI\b|原创插图/);
    assert.match(record.caption, /不是|不代表|不能确认|以.*为准/, `${record.key}: the caption says what the image is not`);
    if (record.artwork === 'product') {
      assert.match(record.caption, /产品图|陈列宣传图/, `${record.key}: named as the brand's product image`);
      assert.match(record.caption, /(不是|不能确认是)[^；。]*(门店|新址|店|这家店的)实景/, `${record.key}: never the shop itself`);
      assert.match(record.credit, /官方产品图|官方商户页图片/, record.key);
    }
    assert.doesNotMatch(record.caption, /开业当天|首日/, `${record.key}: no opening-day claim`);
    assert.deepEqual(record.rights, { basis: 'promo-editorial', evidenceUrl: record.creditUrl, scope: 'coverage of the same shop only' });
    assert.equal(new URL(record.creditUrl).protocol, 'https:');
    const download = downloads[record.key];
    assert.equal(download.sourceUrl, record.creditUrl);
    assert.match(new URL(download.originalUrl).protocol, /^https:$/);
    assert.match(download.retrievedAt, /^2026-10-19T\d{2}:\d{2}:\d{2}-07:00$/);
    assert.match(download.sha256, /^[0-9a-f]{64}$/);
    assert.match(download.contentType, /^image\//);
    // Main rendition: at most 1280 wide (800 for a portrait), never upscaled; the rungs come from the image ladder.
    assert.ok(record.width <= (record.height > record.width ? 800 : 1280) && record.width >= 480, record.key);
    assert.deepEqual(webpSize(record.src), { width: record.width, height: record.height }, record.key);
    assert.equal((overlay as Record<string, { coverOk?: boolean }>)[record.key]?.coverOk, true, `${record.key}: reviewed for covers`);
  }
});

test('each shop resolves to its own image on cards, the events index and the detail page, labelled 官方图', () => {
  for (const record of officialOpeningMedia as OpeningRecord[]) {
    const shop = currentOpenings.find(item => item.id === record.openingId);
    assert.ok(shop, `${record.openingId} is a published opening`);
    assert.equal(shop.imageKey, record.key, record.openingId);
    const image = getListingImage(record.key)!;
    assert.ok(image, record.key);
    for (const field of ['src', 'width', 'height', 'alt', 'caption', 'credit', 'creditUrl', 'fullFrame', 'focal', 'rights'] as const) {
      assert.deepEqual((image as Record<string, unknown>)[field], (record as Record<string, unknown>)[field], `${record.key}: ${field}`);
    }
    assert.equal(Object.hasOwn(image, 'openingId'), false, 'the opening id stays in the source record');
    assert.equal(image.srcSet, imageManifest.images[record.src].srcset.join(', '), `${record.key}: srcSet from the image manifest`);
    const cover = getCover({ kind: 'opening', id: shop.id, imageKey: shop.imageKey }, { images: GUIDE_IMAGES, today: '2026-10-20' });
    assert.equal(cover.tier, 'official', record.key);
    assert.deepEqual(cover.tier !== 'type' && cover.label, { zh: '官方图', en: 'Official image' }, record.key);
    assert.equal(cover.tier !== 'type' && cover.fit, record.kind === 'poster' ? 'contain' : 'cover', record.key);
    const indexed = eventsIndex.openings.find(item => item.id === record.openingId);
    assert.equal(indexed?.imageKey, record.key, `${record.openingId}: the openings list reads the same key`);
    assert.equal(eventsIndex.images[record.key]?.src, record.src, `${record.key}: in the events index`);
  }
});

test('new-shop image text is complete in English and Traditional Chinese', async () => {
  await loadLocale('en');
  for (const record of officialOpeningMedia) {
    const translated = translateEditorial({ image: GUIDE_IMAGES[record.key] }, 'en').image;
    assert.doesNotMatch(JSON.stringify([translated.alt, translated.caption, translated.credit]), /\p{Script=Han}/u, record.key);
    assert.match(translated.credit, /official/i, record.key);
    if (record.artwork === 'product') assert.match(translated.caption, /^(Product image|Brand merchandise image|Shoe display image)/, record.key);
    assert.equal(getImageProvenance(translated, true), 'Official image');
  }
  await loadLocale('zh-Hant');
  for (const record of officialOpeningMedia) assert.equal(translateText(getImageProvenance(GUIDE_IMAGES[record.key]), 'zh-Hant'), '官方圖', record.key);
});

// Three guide photos of the same approval: two agencies' own photos and Carol M. Highsmith's public-domain photo of HHS.
const PHOTO = {
  sfmta: 'official-sfmta-kirkland-yard-2023',
  sfpl: 'official-sfpl-main-library-skylight',
  hhs: 'loc-highsmith-hhs-humphrey-building-2012',
} as const;

test('the three guide photos sit where their guides talk about the place, with honest labels', () => {
  assert.deepEqual(guidePhotos.map(record => record.key).sort(), Object.values(PHOTO).sort());
  assert.deepEqual(Object.keys(guidePhotoDownloads), guidePhotos.map(record => record.key));
  const bySlug = (slug: string) => getGuideMedia(guides.find(guide => guide.slug === slug)!);
  // SFPL's own photo is the library starter guide's cover; SFMTA's stands in the senior transit guide's Muni step (heading 3).
  assert.equal(bySlug('bay-area-library-starter-guide').cover, GUIDE_IMAGES[PHOTO.sfpl]);
  assert.deepEqual(GUIDE_EXTRA_INLINE['bay-area-senior-transit-clipper-discounts-guide'], [[1, 'commons-clipper-embarcadero'], [3, PHOTO.sfmta]]);
  // The public-domain photo replaces the CC BY-SA photo of the same building in the Medicare guide's step 2, never both.
  assert.deepEqual(GUIDE_EXTRA_INLINE['bay-area-medicare-hicap-medi-cal-guide'], [[2, PHOTO.hhs], [3, 'commons-dhcs-sacramento']]);
  const medicare = bySlug('bay-area-medicare-hicap-medi-cal-guide').inline.map(item => item.image);
  assert.ok(medicare.includes(GUIDE_IMAGES[PHOTO.hhs]) && !medicare.includes(GUIDE_IMAGES['commons-hhs-washington-dc']));
  for (const key of [PHOTO.sfmta, PHOTO.sfpl]) {
    const image = GUIDE_IMAGES[key];
    assert.equal(getImageProvenance(image), '官方图', key);
    assert.equal(typeof image.rights === 'object' && image.rights.basis, 'promo-editorial');
    assert.equal((overlay as Record<string, { coverOk?: boolean }>)[key]?.coverOk, true);
  }
  assert.match(GUIDE_IMAGES[PHOTO.sfmta].caption, /2023 年拍摄.*不是 Clipper 办理点，也不是长者专车/);
  assert.match(GUIDE_IMAGES[PHOTO.sfpl].credit, /摄影 Jason Doiy$/);
  // HHS: public domain because the photographer stipulated it (the GPT rights note), never "a federal employee's work";
  // 示意图, an archive photo dated 2012, and vetoed as a cover.
  const hhs = GUIDE_IMAGES[PHOTO.hhs];
  assert.ok(hhs.caption.startsWith('示意图：') && hhs.alt.startsWith('示意图：'));
  assert.match(hhs.caption, /不是湾区的咨询地点，也不是 HICAP 办公室/);
  assert.equal(hhs.credit, 'Carol M. Highsmith 摄 / 美国国会图书馆（highsm.25147）· 公共领域（摄影师本人声明） · 已缩放压缩，按版面裁切');
  assert.doesNotMatch(JSON.stringify(hhs), /联邦雇员|federal employee|17 U\.?S\.?C/i);
  assert.equal(typeof hhs.rights === 'object' && hhs.rights.basis, 'public-domain');
  assert.equal(getImageProvenance(hhs), '资料图 · 2012');
  assert.equal(hhs.coverOk, false);
  assert.equal(getCover({ kind: 'guide', id: 'any', imageKey: PHOTO.hhs }, { images: GUIDE_IMAGES, today: '2026-10-20' }).tier, 'type');
  assert.deepEqual(guides.filter(guide => getGuideMedia(guide).cover.src === hhs.src).map(guide => guide.slug), []);
  for (const record of guidePhotos) {
    assert.deepEqual(webpSize(record.src), { width: record.width, height: record.height }, record.key);
    assert.match((guidePhotoDownloads as Record<string, { retrievedAt: string; sha256: string }>)[record.key].retrievedAt, /^2026-10-19T\d{2}:\d{2}:\d{2}-07:00$/);
  }
});

test('the guide photos read fully in English', async () => {
  await loadLocale('en');
  for (const key of Object.values(PHOTO)) {
    const translated = translateEditorial({ image: GUIDE_IMAGES[key] }, 'en').image;
    assert.doesNotMatch(JSON.stringify([translated.alt, translated.caption, translated.credit]), /\p{Script=Han}/u, key);
  }
  assert.match(translateEditorial({ image: GUIDE_IMAGES[PHOTO.hhs] }, 'en').image.credit, /^Photo: Carol M\. Highsmith, Library of Congress, highsm\.25147 \(public domain, as stipulated by the photographer\)/);
  assert.match(translateEditorial({ image: GUIDE_IMAGES[PHOTO.hhs] }, 'en').image.caption, /^Illustrative photo: /);
});
