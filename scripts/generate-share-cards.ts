import { readFile } from 'node:fs/promises';
import QRCode from 'qrcode';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia, type GuideImage } from '../src/data/guide-media';
import { loadLocale, translateText } from '../src/i18n/locale';
import { guideShare, shareCardPath } from '../src/lib/editorial-share';
import { renderHubCardSvg, renderShareCardSvg } from '../src/lib/share-card-svg';
import { discoveryCardModel, guideCardModel, hubCardModel, HUB_CARD_NAMES, HUB_PATHS, promoPhoto, type CardLocale } from '../src/lib/share-card-model';
import { hubCardPath } from '../src/lib/hub-cards';
import { SITE_URL } from '../src/lib/seo';
import { languagePath } from '../src/lib/language-path';
import { getBayAreaToday } from '../src/lib/monthly';
import { createGlyphOutliner, createRasterPool } from './card-glyphs';
import { hubCardData } from './share-card-data';

/**
 * Share cards v2 (I18N-SEO-05) and hub cards (I18N-SEO-03), 1200 × 630, one per language: zh-Hans at the original
 * /share-cards/<kind>-<id>.png (links already shared keep working), zh-Hant and English under /share-cards/zh-Hant/ and
 * /share-cards/en/. Each card's QR opens the page in the card's language. A cover photo appears only when its rights
 * allow promotion (share-card-model.ts promoPhoto); otherwise the listing's TypeCover facts fill the cover.
 */
const LOCALES: CardLocale[] = ['zh-Hans', 'zh-Hant', 'en'];
await Promise.all([loadLocale('en'), loadLocale('zh-Hant')]);
const tr = (locale: CardLocale) => (text: string) => locale === 'zh-Hans' ? text : translateText(text, locale);
const today = getBayAreaToday();
const outline = await createGlyphOutliner();
const pool = createRasterPool();
const logo = `data:image/png;base64,${(await readFile('public/brand/baylink-app-icon.png')).toString('base64')}`;
const filePath = (path: string, locale: CardLocale) => `public${locale === 'zh-Hans' ? path : path.replace(/^\/share-cards\//, `/share-cards/${locale}/`)}`;
const qrFor = (url: string) => {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  let path = '';
  for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) if (qr.modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`;
  return { path, size: qr.modules.size };
};
const photoData = new Map<string, Promise<string | undefined>>();
/** A promotion-cleared photo as a JPEG data URI for the cover (resvg reads JPEG; the registry stores WebP). */
const photoFor = (image: GuideImage | undefined) => {
  const photo = promoPhoto(image);
  if (!photo) return Promise.resolve(undefined);
  if (!photoData.has(photo.src)) photoData.set(photo.src, import('sharp').then(({ default: sharp }) => sharp(`public${photo.src}`).resize(940, 1260, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer())
    .then(buffer => `data:image/jpeg;base64,${buffer.toString('base64')}`).catch(() => undefined));
  return photoData.get(photo.src)!;
};

const tasks = new Set<Promise<number>>();
let cards = 0, bytes = 0;
const queue = async (svg: string, out: string) => {
  const task = pool.run({ svg, out }).then(size => { bytes += size; cards++; return size; });
  tasks.add(task);
  task.finally(() => tasks.delete(task)).catch(() => {});
  if (tasks.size >= pool.size * 3) await Promise.race(tasks);
};

for (const item of localDiscoveries) {
  const share = discoveryShare(item);
  const imageKey = item.kind === 'event' ? item.event.imageKey : item.kind === 'offer' ? item.offer.imageKey : item.shop.imageKey;
  const image = GUIDE_IMAGES[imageKey];
  const photo = await photoFor(image);
  for (const locale of LOCALES) {
    const model = discoveryCardModel(item, locale, today, tr(locale), photo ? image : undefined);
    const { draw, finish } = outline();
    const svg = renderShareCardSvg({ ...model, photo }, qrFor(`${SITE_URL}${languagePath(share.path, locale)}?from=card`), logo, draw);
    await queue(finish(svg), filePath(shareCardPath(share), locale));
  }
}
for (const guide of guides) {
  const share = guideShare(guide);
  const image = getGuideMedia(guide).cover;
  const photo = await photoFor(image);
  for (const locale of LOCALES) {
    const model = guideCardModel(guide, locale, tr(locale), photo ? image : undefined, today);
    const { draw, finish } = outline();
    const svg = renderShareCardSvg({ ...model, photo }, qrFor(`${SITE_URL}${languagePath(share.path, locale)}?from=card`), logo, draw);
    await queue(finish(svg), filePath(shareCardPath(share), locale));
  }
}

// Hub cards: this weekend's picks (the home page's and the weekly card's), the guide topics, the tools.
for (const locale of LOCALES) {
  const t = tr(locale), data = hubCardData(locale, t, today);
  for (const name of HUB_CARD_NAMES) {
    const model = hubCardModel(name, locale, t, data);
    const { draw, finish } = outline();
    const svg = renderHubCardSvg(model, qrFor(`${SITE_URL}${languagePath(HUB_PATHS[name], locale)}?from=card`), logo, draw);
    await queue(finish(svg), filePath(hubCardPath(name), locale));
  }
}
await Promise.all(tasks);
await pool.close();
console.log(`Generated ${cards} BAYLINK share and hub cards in three languages (${(bytes / 1048576).toFixed(1)} MiB) with direct-link QR codes.`);
