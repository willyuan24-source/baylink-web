import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { guideShare, shareCardPath } from '../src/lib/editorial-share';
import { HUB_CARD_NAMES, HUB_PATHS } from '../src/lib/share-card-model';
import { hubCardPath } from '../src/lib/hub-cards';
import { SITE_URL } from '../src/lib/seo';
import { languagePath, type SiteLanguage } from '../src/lib/language-path';

/**
 * Every share card (per item and per hub) exists in all three languages at 1200 × 630, and its QR — decoded
 * independently from the pixels — opens the page in the card's own language.
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
console.log(`Verified ${checked} share and hub cards (${cards.length} × 3 languages): 1200 × 630, and every QR independently decoded to the page in the card's language.`);
