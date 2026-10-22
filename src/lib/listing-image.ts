import type { GuideImage } from '../data/guide-media';

/**
 * Registry fields no listing reads: who captured or reviewed a photo, its download record, archive ids, and Little Bay's
 * own English strings. The listing data (the events index, the boards, the guide index, the detail records) leaves them
 * out so each image costs those routes as little as possible; they stay in the registry.
 */
export const LISTING_DROPPED_FIELDS: readonly string[] = [
  'originalUrl', 'retrievedAt', 'captured', 'reviewed', 'changes', 'provenance', 'dvidsImageId', 'virin', 'sourceAssetKey',
  'altEn', 'captionEn', 'creditEn',
];

/**
 * What a listing reads from a caption, and nothing more: no list page prints a caption (the detail page has its own
 * record). The capture year is the caption's first year (cover.ts captureYear, the badge's year), an official photo's
 * edition is "2025 往届" as written (image-provenance.ts), and an archive word makes it 资料图. The index carries this
 * signal instead of the sentence (UI-9 A+B engineering review: the 43 official images' captions were about 5 KiB gzip of
 * /events and /calendar); tests/events-index-images.test.ts pins that every listing cover resolves to the same tier,
 * badge and year as with the full caption.
 */
export function captionSignal(caption: string): string {
  const year = caption.match(/(?:19|20)\d{2}/)?.[0];
  const edition = caption.match(/(?:19|20)\d{2} ?年?往[届屆]/)?.[0];
  // "2025 往届" already begins with the first year when they are the same year.
  const parts = [year && !edition?.startsWith(year) ? year : undefined, edition].filter((part): part is string => !!part);
  const archive = /资料|往届|archive|historical/i;
  if (archive.test(caption) && !archive.test(parts.join(' '))) parts.push('资料');
  // A brand's product image is badged 官方图 · 产品图 (cover.ts tierLabelOf, UI9-IMAGES DECISIONS 23).
  if (/产品图|商品陈列/.test(caption)) parts.push('产品图');
  return parts.join(' ');
}

/**
 * A registry image as listing data carries it: without the dropped fields, with a structured rights record cut to what the
 * cover resolver reads (cover.ts rightsBasisOf: the basis; promoAllowed for share surfaces), and the caption's signal —
 * or the whole caption (`caption: 'keep'`) where the page prints it (a detail hero, PageCredits HeroCaption).
 */
export function slimListingImage<T extends GuideImage>(image: T, caption: 'signal' | 'keep' = 'signal'): T {
  const slim = Object.fromEntries(Object.entries(image).filter(([field]) => !LISTING_DROPPED_FIELDS.includes(field))) as T;
  if (typeof slim.rights === 'object' && slim.rights) {
    const { basis, promoAllowed } = slim.rights;
    slim.rights = { basis, ...(promoAllowed !== undefined ? { promoAllowed } : {}) } as T['rights'];
  }
  if (caption === 'signal' && typeof slim.caption === 'string') slim.caption = captionSignal(slim.caption);
  return slim;
}
