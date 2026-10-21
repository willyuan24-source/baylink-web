import { GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import type { IndexImage } from '../src/features/events/events-index-types';

/**
 * Registry fields no listing reads: who captured or reviewed a photo, its download record, archive ids, and Little Bay's
 * own English strings. The events index (/events, /calendar) leaves them out so each image costs those routes as little
 * as possible; they stay in the registry.
 */
export const INDEX_IMAGE_DROPPED_FIELDS: readonly string[] = [
  'originalUrl', 'retrievedAt', 'captured', 'reviewed', 'changes', 'provenance', 'dvidsImageId', 'virin', 'sourceAssetKey',
  'altEn', 'captionEn', 'creditEn',
];

/**
 * The fields listings read (src/lib/cover.ts, getImageProvenance, <CoverImage>), the only ones an index image may carry.
 * tests/events-index-images.test.ts fails on any other field, so a new registry field goes either here (a listing reads it)
 * or into INDEX_IMAGE_DROPPED_FIELDS.
 */
export const INDEX_IMAGE_FIELDS: readonly string[] = [
  'src', 'srcSet', 'width', 'height', 'alt', 'caption', 'credit', 'creditUrl', 'licenseUrl', 'kind', 'fullFrame', 'focal',
  'coverOk', 'lqip', 'rights', 'ownShot', 'shotAt', 'photoDate', 'scene3d', 'subject', 'aiCoverApproved',
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
 * A registry image as the index carries it: without the dropped fields, with a structured rights record cut to what
 * the cover resolver reads (cover.ts rightsBasisOf: the basis; promoAllowed for share surfaces), and the caption's signal.
 */
export const listingImage = (image: GuideImage): IndexImage => {
  const slim = Object.fromEntries(Object.entries(image).filter(([field]) => !INDEX_IMAGE_DROPPED_FIELDS.includes(field))) as IndexImage;
  if (typeof slim.rights === 'object' && slim.rights) {
    const { basis, promoAllowed } = slim.rights;
    slim.rights = { basis, ...(promoAllowed !== undefined ? { promoAllowed } : {}) };
  }
  if (typeof slim.caption === 'string') slim.caption = captionSignal(slim.caption);
  return slim;
};

/**
 * The whole registry as listings read it. scripts/generate-events-index.ts reads images only through this map, so every
 * image record it writes is slim, whichever file the record lands in (the route's events-index.json, or any file the
 * index is later split into).
 */
export const LISTING_IMAGES: Record<string, IndexImage> = Object.fromEntries(Object.entries(GUIDE_IMAGES)
  .map(([key, image]) => [key, listingImage(image)]));
