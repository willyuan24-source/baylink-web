import { readFile } from 'node:fs/promises';
import QRCode from 'qrcode';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia, type GuideImage } from '../src/data/guide-media';
import { enableUsEnglishTimes, loadLocale, translateText } from '../src/i18n/locale';
import { guideShare, shareCardPath } from '../src/lib/editorial-share';
import { PHOTO_BAND, renderHubCardSvg, renderShareCardSvg } from '../src/lib/share-card-svg';
import { cardPhoto, discoveryCardModel, guideCardModel, hubCardModel, HUB_CARD_NAMES, HUB_PATHS, promoPhoto, sharePicture, type CardLocale } from '../src/lib/share-card-model';
import type { CoverAsset } from '../src/lib/cover';
import { hubCardPath } from '../src/lib/hub-cards';
import { SITE_URL } from '../src/lib/seo';
import { languagePath } from '../src/lib/language-path';
import { getBayAreaToday } from '../src/lib/monthly';
import { availableParallelism } from 'node:os';
import { createGlyphOutliner, createRasterPool } from './card-glyphs';
import { hubCardData } from './share-card-data';

/**
 * Share cards v2 (I18N-SEO-05) and hub cards (I18N-SEO-03), 1200 × 630, one per language: zh-Hans at the original
 * /share-cards/<kind>-<id>.png (links already shared keep working), zh-Hant and English under /share-cards/zh-Hant/ and
 * /share-cards/en/. Each card's QR opens the page in the card's language. Every listing card fronts a picture the card
 * may carry (share-card-model.ts sharePicture: its own (cardPhoto / promoPhoto), else its venue's or a ③ stock picture that
 * promotion allows; never AI art), as a band across the top 55% (H45; UI9-IMAGES DECISIONS 21).
 */
const LOCALES: CardLocale[] = ['zh-Hans', 'zh-Hant', 'en'];
const started = performance.now();
// H41: English cards are the site's English, with US-style times and dates (as i18n/metadata.ts switches the site on)
await enableUsEnglishTimes();
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
const clamp = (value: number, max: number) => Math.min(Math.max(0, value), max);
/**
 * The photo band as a JPEG data URI (resvg reads JPEG; the registry stores WebP), cut as the site cuts the image: a
 * photo fills the band around its focal point; a poster or full-frame artwork is shown whole on a blurred copy of itself.
 */
const photoFor = (image: GuideImage | undefined) => {
  if (!image) return Promise.resolve(undefined);
  if (!photoData.has(image.src)) photoData.set(image.src, import('sharp').then(async ({ default: sharp }) => {
    const file = `public${image.src}`, { width, height } = PHOTO_BAND, asset = image as CoverAsset;
    let band: Buffer;
    if (image.kind === 'poster' || image.fullFrame) {
      const backdrop = await sharp(file).resize(width, height, { fit: 'cover' }).blur(28).modulate({ brightness: .78 }).toBuffer();
      const whole = await sharp(file).resize(width, height, { fit: 'inside' }).toBuffer();
      band = await sharp(backdrop).composite([{ input: whole, gravity: 'centre' }]).jpeg({ quality: 82 }).toBuffer();
    } else {
      const meta = await sharp(file).metadata();
      const scale = Math.max(width / (meta.width || width), height / (meta.height || height));
      const scaledWidth = Math.max(width, Math.round((meta.width || width) * scale)), scaledHeight = Math.max(height, Math.round((meta.height || height) * scale));
      const [focalX, focalY] = asset.focal ?? [50, 40];
      band = await sharp(file).resize(scaledWidth, scaledHeight).extract({
        left: clamp(Math.round(scaledWidth * focalX / 100 - width / 2), scaledWidth - width),
        top: clamp(Math.round(scaledHeight * focalY / 100 - height / 2), scaledHeight - height), width, height,
      }).jpeg({ quality: 82 }).toBuffer();
    }
    return `data:image/jpeg;base64,${band.toString('base64')}`;
  }).catch(error => { console.warn(`Share card photo ${image.src} not drawn: ${String(error)}`); return undefined; }));
  return photoData.get(image.src)!;
};

const tasks = new Set<Promise<number>>();
let cards = 0, bytes = 0, photoCards = 0;
const queue = async (svg: string, out: string) => {
  const task = pool.run({ svg, out }).then(size => { bytes += size; cards++; return size; });
  tasks.add(task);
  task.finally(() => tasks.delete(task)).catch(() => {});
  if (tasks.size >= pool.size * 3) await Promise.race(tasks);
};

for (const item of localDiscoveries) {
  const share = discoveryShare(item);
  const record = item.kind === 'event' ? item.event : item.kind === 'offer' ? item.offer : item.shop;
  // UI9-IMG-A1b: every card fronts a picture (sharePicture: own → venue → ③ stock, promotion-cleared, never AI).
  const image = sharePicture(item.kind, record, cardPhoto(item, GUIDE_IMAGES[record.imageKey], today), GUIDE_IMAGES);
  const photo = await photoFor(image);
  if (photo) photoCards++;
  for (const locale of LOCALES) {
    const model = discoveryCardModel(item, locale, today, tr(locale), photo ? image : undefined);
    const { draw, finish } = outline();
    const svg = renderShareCardSvg({ ...model, photo }, qrFor(`${SITE_URL}${languagePath(share.path, locale)}?from=card`), logo, draw);
    await queue(finish(svg), filePath(shareCardPath(share), locale));
  }
}
for (const guide of guides) {
  const share = guideShare(guide);
  const image = sharePicture('guide', { id: guide.slug, title: guide.title, category: guide.category }, promoPhoto(getGuideMedia(guide).cover), GUIDE_IMAGES);
  const photo = await photoFor(image);
  if (photo) photoCards++;
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
// The time and the pool size go into the build log, so a slow build machine shows what it ran with (HOTFIX-BUILD-TIME).
console.log(`Generated ${cards} BAYLINK share and hub cards in three languages (${(bytes / 1048576).toFixed(1)} MiB) with direct-link QR codes; ${photoCards} listings carry a photo. ${((performance.now() - started) / 1000).toFixed(0)} s on ${pool.size} rasterizing workers (${availableParallelism()} cores).`);
