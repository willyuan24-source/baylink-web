import assert from 'node:assert/strict';
import test from 'node:test';
import categoryStockPhotos from '../src/data/category-stock-photos.json';
import homeTileStockPhotos from '../src/data/home-tile-stock-photos.json';
import { GUIDE_IMAGES } from '../src/data/guide-media';

/**
 * UI9-R2-DATA (N21): every picture a card may crop carries a focal point. focal is the CSS object-position [x%, y%] the
 * covers draw (CoverImage, MoodCircles), set by eye on 2026-10-23 so the subject sits in the 1:1 and 2:1 frames; a photo
 * without one is cropped at the default [50, 40]. Posters and full-frame art are letterboxed and take none.
 */
const coverEligible = Object.entries(GUIDE_IMAGES)
  .filter(([, image]) => image.kind === 'photo' && !image.fullFrame && image.coverOk !== false && !image.scene3d);

test('at least 90% of the cover-eligible photos have a focal point (N21; 100% on 2026-10-23)', () => {
  const withFocal = coverEligible.filter(([, image]) => image.focal);
  assert.ok(withFocal.length / coverEligible.length >= 0.9, `${withFocal.length} of ${coverEligible.length}`);
});

test('every ③ stock picture and every home tile photo is registered with its focal point', () => {
  for (const { key } of [...categoryStockPhotos, ...homeTileStockPhotos]) {
    const focal = GUIDE_IMAGES[key]?.focal;
    assert.ok(focal && focal.length === 2 && focal.every(value => Number.isInteger(value) && value >= 0 && value <= 100), `${key}: ${JSON.stringify(focal)}`);
  }
});

test('posters and full-frame art never take a focal point', () => {
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) {
    if (image.kind === 'poster' || image.fullFrame) assert.equal(image.focal, undefined, key);
  }
});
