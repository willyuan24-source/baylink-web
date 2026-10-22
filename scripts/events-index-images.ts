import { GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import type { IndexImage } from '../src/features/events/events-index-types';
import { LISTING_DROPPED_FIELDS, captionSignal, slimListingImage } from '../src/lib/listing-image';

/** Registry fields no listing reads (src/lib/listing-image.ts, shared with the detail records since UI9-IMG-A1b). */
export const INDEX_IMAGE_DROPPED_FIELDS: readonly string[] = LISTING_DROPPED_FIELDS;

/**
 * The fields listings read (src/lib/cover.ts, getImageProvenance, <CoverImage>), the only ones an index image may carry.
 * tests/events-index-images.test.ts fails on any other field, so a new registry field goes either here (a listing reads it)
 * or into INDEX_IMAGE_DROPPED_FIELDS.
 */
export const INDEX_IMAGE_FIELDS: readonly string[] = [
  'src', 'srcSet', 'width', 'height', 'alt', 'caption', 'credit', 'creditUrl', 'licenseUrl', 'kind', 'fullFrame', 'focal',
  'coverOk', 'lqip', 'rights', 'ownShot', 'shotAt', 'photoDate', 'scene3d', 'subject', 'aiCoverApproved',
];

/** A caption's signal and a registry image as listings read it: src/lib/listing-image.ts (the detail records use them too). */
export { captionSignal };
export const listingImage = (image: GuideImage): IndexImage => slimListingImage(image) as IndexImage;

/**
 * The whole registry as listings read it. scripts/generate-events-index.ts reads images only through this map, so every
 * image record it writes is slim, whichever file the record lands in (the route's events-index.json, or any file the
 * index is later split into).
 */
export const LISTING_IMAGES: Record<string, IndexImage> = Object.fromEntries(Object.entries(GUIDE_IMAGES)
  .map(([key, image]) => [key, listingImage(image)]));
