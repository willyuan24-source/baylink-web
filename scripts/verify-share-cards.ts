import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia } from '../src/data/guide-media';
import { loadLocale, translateText } from '../src/i18n/locale';
import { getBayAreaToday } from '../src/lib/monthly';
import { guideShare, shareCardPath } from '../src/lib/editorial-share';
import { discoveryCardModel, guideCardModel, hubCardModel, HUB_CARD_NAMES, HUB_PATHS, promoPhoto, type CardLocale } from '../src/lib/share-card-model';
import { simplifiedOnlyCharacters } from './i18n-html-check.mjs';
import { hubCardData } from './share-card-data';
import { hubCardPath } from '../src/lib/hub-cards';
import { SITE_URL } from '../src/lib/seo';
import { languagePath, type SiteLanguage } from '../src/lib/language-path';

/**
 * Every share card (per item and per hub) exists in all three languages at 1200 × 630, and its QR — decoded
 * independently from the pixels — opens the page in the card's own language. What the cards say is in that language too:
 * the English cards' text has no Chinese and the 繁體 cards' no Simplified-only character (the models the generator draws,
 * built again here with the same translation).
 */
const LOCALES: SiteLanguage[] = ['zh-Hans', 'zh-Hant', 'en'];
const file = (path: string, locale: SiteLanguage) => `public${locale === 'zh-Hans' ? path : path.replace(/^\/share-cards\//, `/share-cards/${locale}/`)}`;
const cards = [
  ...[...localDiscoveries.map(discoveryShare), ...guides.map(guideShare)].map(item => ({ image: shareCardPath(item), path: item.path })),
  ...HUB_CARD_NAMES.map(name => ({ image: hubCardPath(name), path: HUB_PATHS[name] })),
];
let checked = 0;
for (const card of cards) for (const locale of LOCALES) {
  const png = PNG.sync.read(await readFile(file(card.image, locale)));
  assert.equal(png.width, 1200, `${card.image} ${locale}`);
  assert.equal(png.height, 630, `${card.image} ${locale}`);
  // the QR sits in the bottom-right corner of every layout: decode that region only (a ninth of the pixels)
  const [x0, y0, width, height] = [900, 380, 300, 250];
  const region = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) region.set(png.data.subarray(((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + width) * 4), y * width * 4);
  const decoded = jsQR(region, width, height, { inversionAttempts: 'dontInvert' });
  assert.equal(decoded?.data, `${SITE_URL}${languagePath(card.path, locale)}?from=card`, `QR on ${file(card.image, locale)}`);
  checked++;
}
await Promise.all([loadLocale('en'), loadLocale('zh-Hant')]);
const require = createRequire(import.meta.url);
const simplifiedOnly = simplifiedOnlyCharacters(require('opencc-js/dict/STCharacters').default, require('opencc-js/dict/TSCharacters').default);
const today = getBayAreaToday();
/** Every string a model draws (the palette tone and the photo data are not text). */
const texts = (model: object): string[] => Object.entries(model).flatMap(([key, value]) => key === 'tone' || key === 'photo' ? []
  : typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(item => typeof item === 'string' ? [item] : item && typeof item === 'object' ? texts(item) : []) : []);
const wrongLanguage: string[] = [];
let models = 0;
for (const locale of ['en', 'zh-Hant'] as CardLocale[]) {
  const tr = (text: string) => translateText(text, locale);
  const check = (where: string, model: object) => {
    models++;
    for (const text of texts(model)) {
      const wrong = locale === 'en' ? /[㐀-鿿]/.test(text) : [...text].some(character => simplifiedOnly.has(character));
      if (wrong) wrongLanguage.push(`${locale} ${where}: ${text}`);
    }
  };
  for (const item of localDiscoveries) {
    const imageKey = item.kind === 'event' ? item.event.imageKey : item.kind === 'offer' ? item.offer.imageKey : item.shop.imageKey;
    check(shareCardPath(discoveryShare(item)), discoveryCardModel(item, locale, today, tr, promoPhoto(GUIDE_IMAGES[imageKey])));
  }
  for (const guide of guides) check(shareCardPath(guideShare(guide)), guideCardModel(guide, locale, tr, promoPhoto(getGuideMedia(guide).cover), today));
  const data = hubCardData(locale, tr, today);
  for (const name of HUB_CARD_NAMES) check(`hub ${name}`, hubCardModel(name, locale, tr, data));
}
assert.deepEqual(wrongLanguage.slice(0, 20), [], `${wrongLanguage.length} card texts in the wrong language`);
console.log(`Verified ${checked} share and hub cards (${cards.length} × 3 languages): 1200 × 630, every QR independently decoded to the page in the card's language, and the text of all ${models} English and 繁體 cards in their language.`);
