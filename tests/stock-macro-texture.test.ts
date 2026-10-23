import assert from 'node:assert/strict';
import test from 'node:test';
import tags from '../src/data/stock-macro-texture.json';
import categoryPhotos from '../src/data/category-photos.json';
import { GUIDE_IMAGES } from '../src/data/guide-media';

/**
 * UI9-R2-DATA (round-2 cold review R2-05, B P15): the close-up and texture ③ pictures, tagged so hero-size slots can skip
 * them when their category has a scene picture. The tags name stock pictures only and leave every pool a scene to lead with
 * wherever the pool has one.
 */
const keys = (tags as { keys: Record<string, { kind: string; what?: string }> }).keys;
const pools = (categoryPhotos as { categories: Record<string, string[]> }).categories;

test('each tag names a registered ③ stock picture, as a texture or a close-up', () => {
  assert.ok(Object.keys(keys).length > 0);
  for (const [key, tag] of Object.entries(keys)) {
    const image = GUIDE_IMAGES[key];
    assert.ok(image, `${key} is registered`);
    assert.equal(image.subject, 'category', `${key}: a ③ stock picture`);
    assert.ok(tag.kind === 'texture' || tag.kind === 'macro', `${key}: ${tag.kind}`);
    // `what` is a reviewer's note only (a copy of the alt on 2026-10-23); it may drift from the alt and may be left out.
    if (tag.what !== undefined) assert.ok(typeof tag.what === 'string' && tag.what.length > 0, `${key}: what`);
  }
});

test('the pictures the round-2 judges named are tagged: candy corn, chalk, soil hands and book stacks', () => {
  for (const key of ['stock-halloween-4', 'stock-kids-craft-5', 'stock-green-volunteer-1', 'stock-book-sale-1', 'stock-book-sale-3', 'stock-book-sale-4']) {
    assert.ok(Object.hasOwn(keys, key), key);
  }
});

test('the seasonal and busiest pools keep scene pictures to lead with', () => {
  for (const category of ['halloween', 'kids-craft', 'library', 'storytime', 'dia-de-muertos', 'diwali', 'winter-holidays', 'pumpkin-harvest']) {
    const scenes = (pools[category] ?? []).filter(key => !Object.hasOwn(keys, key));
    assert.ok(scenes.length >= 2, `${category}: ${scenes.length} scene pictures`);
  }
});
