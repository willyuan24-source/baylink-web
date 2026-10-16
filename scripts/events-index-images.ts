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
  'coverOk', 'lqip', 'rights', 'ownShot', 'shotAt', 'photoDate', 'scene3d',
];

/**
 * A registry image as the index carries it: without the dropped fields, and with a structured rights record cut to what
 * the cover resolver reads (cover.ts rightsBasisOf: the basis; promoAllowed for share surfaces).
 */
export const listingImage = (image: GuideImage): IndexImage => {
  const slim = Object.fromEntries(Object.entries(image).filter(([field]) => !INDEX_IMAGE_DROPPED_FIELDS.includes(field))) as IndexImage;
  if (typeof slim.rights === 'object' && slim.rights) {
    const { basis, promoAllowed } = slim.rights;
    slim.rights = { basis, ...(promoAllowed !== undefined ? { promoAllowed } : {}) };
  }
  return slim;
};

/**
 * The whole registry as listings read it. scripts/generate-events-index.ts reads images only through this map, so every
 * image record it writes is slim, whichever file the record lands in (the route's events-index.json, or any file the
 * index is later split into).
 */
export const LISTING_IMAGES: Record<string, IndexImage> = Object.fromEntries(Object.entries(GUIDE_IMAGES)
  .map(([key, image]) => [key, listingImage(image)]));
