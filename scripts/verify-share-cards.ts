import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia } from '../src/data/guide-media';
import { loadLocale, translateText } from '../src/i18n/locale';
import { getBayAreaToday } from '../src/lib/monthly';
import { guideShare, shareCardPath } from '../src/lib/editorial-share';
import { cardPhoto, discoveryCardModel, guideCardModel, hubCardModel, HUB_CARD_NAMES, HUB_PATHS, OFFICIAL_IMAGE_ON_OWN_EVENT_CARD, promoPhoto, sharePicture, type CardLocale } from '../src/lib/share-card-model';
import { CARD_INK, DEFAULT_TAGLINE } from '../src/lib/share-card-svg';
import type { GuideImage } from '../src/data/guide-media';
import { simplifiedOnlyCharacters } from './i18n-html-check.mjs';
import { hubCardData } from './share-card-data';
import { hubCardPath } from '../src/lib/hub-cards';
import { SITE_URL } from '../src/lib/seo';
import { languagePath, type SiteLanguage } from '../src/lib/language-path';

/**
 * Every share card (per item and per hub) exists in all three languages at 1200 × 630, and its QR — decoded
 * independently from the pixels — opens the page in the card's own language. What the cards say is in that language too:
 * the English cards' text has no Chinese and the 繁體 cards' no Simplified-only character (the models the generator draws,
 * built again here with the same translation), and the Chinese cards carry the Chinese tagline (H45).
 * H45 / UI9-IMAGES DECISIONS 21: every listing card fronts a picture it may carry (sharePicture: own, else its venue's or a
 * ③ stock picture that promotion allows; never AI art) in the top band in all three languages, read from the pixels; only
 * the hub cards keep their brand panel.
 */
const MIN_PHOTO_CARDS = OFFICIAL_IMAGE_ON_OWN_EVENT_CARD ? 10 : 0;
const LOCALES: SiteLanguage[] = ['zh-Hans', 'zh-Hant', 'en'];
const file = (path: string, locale: SiteLanguage) => `public${locale === 'zh-Hans' ? path : path.replace(/^\/share-cards\//, `/share-cards/${locale}/`)}`;
const today = getBayAreaToday();
const exists = async (image: GuideImage | undefined) => image ? access(`public${image.src}`).then(() => image, () => undefined) : undefined;
const recordOf = (item: typeof localDiscoveries[number]) => item.kind === 'event' ? item.event : item.kind === 'offer' ? item.offer : item.shop;
const listingCards = [
  ...await Promise.all(localDiscoveries.map(async item => ({ share: discoveryShare(item), photo: await exists(sharePicture(item.kind, recordOf(item), cardPhoto(item, GUIDE_IMAGES[recordOf(item).imageKey], today), GUIDE_IMAGES)) }))),
  ...await Promise.all(guides.map(async guide => ({ share: guideShare(guide), photo: await exists(sharePicture('guide', { id: guide.slug, title: guide.title, category: guide.category }, promoPhoto(getGuideMedia(guide).cover), GUIDE_IMAGES)) }))),
];
// UI9-IMG-A1b (DECISIONS 21): no listing card is an information card — every one fronts a picture it may carry.
assert.deepEqual(listingCards.filter(card => !card.photo).map(card => card.share.path), [], 'every listing share card fronts a picture');
const cards = listingCards.map(({ share, photo }) => ({ image: shareCardPath(share), path: share.path, photo: Boolean(photo) }))
  .concat(HUB_CARD_NAMES.map(name => ({ image: hubCardPath(name), path: HUB_PATHS[name], photo: false })));
/**
 * Read from the pixels: a photo card is paper from edge to edge just under its band (y 350–365), where a card without a picture (none since UI9-IMG-A1b) had its coloured panel beside the paper (at most ~61% paper; a hub card its
 * brand panel), and its band (y 90–260) is a picture, not a few flat colours: text cards measured at most 131 distinct
 * colours there, the 57 photo bands 209–256 (10-14). Every such panel was 16+ levels from the paper.
 */
// UI9-IMG-A1b: with a picture on every listing card the 192-colour palette serves far more photos: a dark ③ cinema picture
// draws its band in 127–149 colours, still far from a text card's flat colours; the band threshold follows (10-22). The
// paper is the cards' own paper token (CARD_INK.paper), which the rasterizer keeps exact through the palette
// (share-card-worker.mjs cardPng): the palette's dither of a bright photo no longer reaches the paper on any machine (CI
// 10-22), so the paper under every photo band reads as paper again (≥ 95%).
const PAPER = CARD_INK.paper.slice(1).match(/../g)!.map(hex => parseInt(hex, 16)), PAPER_TOLERANCE = 10, PHOTO_BAND_COLOURS = 100, PHOTO_PAPER_SHARE = .95;
const paperShare = (png: PNG) => {
  let paper = 0, all = 0;
  for (let y = 350; y < 366; y++) for (let x = 0; x < 1200; x++, all++) {
    const at = (y * png.width + x) * 4;
    if (PAPER.every((value, channel) => Math.abs(png.data[at + channel] - value) <= PAPER_TOLERANCE)) paper++;
  }
  return paper / all;
};
const bandColours = (png: PNG) => {
  const colours = new Set<number>();
  for (let y = 90; y < 260; y += 2) for (let x = 0; x < 1200; x += 2) colours.add(png.data.readUInt32BE((y * png.width + x) * 4));
  return colours.size;
};
const photoCard = (png: PNG) => paperShare(png) >= PHOTO_PAPER_SHARE && bandColours(png) >= PHOTO_BAND_COLOURS;
const wrongBand: string[] = [];
let checked = 0;
for (const card of cards) for (const locale of LOCALES) {
  const png = PNG.sync.read(await readFile(file(card.image, locale)));
  assert.equal(png.width, 1200, `${card.image} ${locale}`);
  assert.equal(png.height, 630, `${card.image} ${locale}`);
  if (photoCard(png) !== card.photo) wrongBand.push(`${file(card.image, locale)}: ${card.photo ? 'expected the photo band' : 'expected a card without a picture'}`);
  // the QR sits in the bottom-right corner of every layout: decode that region only (a ninth of the pixels)
  const [x0, y0, width, height] = [900, 380, 300, 250];
  const region = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) region.set(png.data.subarray(((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + width) * 4), y * width * 4);
  const decoded = jsQR(region, width, height, { inversionAttempts: 'dontInvert' });
  assert.equal(decoded?.data, `${SITE_URL}${languagePath(card.path, locale)}?from=card`, `QR on ${file(card.image, locale)}`);
  checked++;
}
const photoCards = cards.filter(card => card.photo).length;
assert.deepEqual(wrongBand.slice(0, 20), [], `${wrongBand.length} cards with or without a photo against their rights`);
assert.ok(photoCards >= MIN_PHOTO_CARDS, `${photoCards} listings carry a photo on their card; expected at least ${MIN_PHOTO_CARDS}`);
await Promise.all([loadLocale('en'), loadLocale('zh-Hant')]);
const require = createRequire(import.meta.url);
const simplifiedOnly = simplifiedOnlyCharacters(require('opencc-js/dict/STCharacters').default, require('opencc-js/dict/TSCharacters').default);
/** Every string a model draws (the palette tone and the photo data are not text). */
const texts = (model: object): string[] => Object.entries(model).flatMap(([key, value]) => key === 'tone' || key === 'photo' ? []
  : typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(item => typeof item === 'string' ? [item] : item && typeof item === 'object' ? texts(item) : []) : []);
const wrongLanguage: string[] = [];
let models = 0;
const wrongTagline: string[] = [];
for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as CardLocale[]) {
  const tr = (text: string) => locale === 'zh-Hans' ? text : translateText(text, locale);
  const check = (where: string, model: object & { tagline?: string }) => {
    models++;
    // H45: the brand line speaks the card's language: the Chinese tagline on 简体 and 繁體 cards
    if (locale !== 'en' && (!model.tagline || model.tagline === DEFAULT_TAGLINE || !/[㐀-鿿]/.test(model.tagline))) wrongTagline.push(`${locale} ${where}: ${model.tagline}`);
    if (locale === 'zh-Hans') return;
    for (const text of texts(model)) {
      const wrong = locale === 'en' ? /[㐀-鿿]/.test(text) : [...text].some(character => simplifiedOnly.has(character));
      if (wrong) wrongLanguage.push(`${locale} ${where}: ${text}`);
    }
  };
  for (const item of localDiscoveries) check(shareCardPath(discoveryShare(item)), discoveryCardModel(item, locale, today, tr, sharePicture(item.kind, recordOf(item), cardPhoto(item, GUIDE_IMAGES[recordOf(item).imageKey], today), GUIDE_IMAGES)));
  for (const guide of guides) check(shareCardPath(guideShare(guide)), guideCardModel(guide, locale, tr, sharePicture('guide', { id: guide.slug, title: guide.title, category: guide.category }, promoPhoto(getGuideMedia(guide).cover), GUIDE_IMAGES), today));
  const data = hubCardData(locale, tr, today);
  for (const name of HUB_CARD_NAMES) check(`hub ${name}`, hubCardModel(name, locale, tr, data));
}
assert.deepEqual(wrongLanguage.slice(0, 20), [], `${wrongLanguage.length} card texts in the wrong language`);
assert.deepEqual(wrongTagline.slice(0, 20), [], `${wrongTagline.length} Chinese cards without the Chinese tagline`);
console.log(`Verified ${checked} share and hub cards (${cards.length} × 3 languages): 1200 × 630, every QR independently decoded to the page in the card's language, ${photoCards} listings with their photo band in all three languages (no information card) and the hub cards with their brand panel, the text of all ${models} cards in their language and the Chinese tagline on the Chinese ones.`);
