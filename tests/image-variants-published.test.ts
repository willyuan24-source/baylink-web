import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { publishedImageSources } from '../scripts/audit-media-coverage';
import { MANIFEST_PATH } from '../scripts/image-budgets.mjs';
import { COVER_TABLES } from '../src/lib/cover-candidates';
import { GUIDE_IMAGES } from '../src/data/guide-media';

/**
 * UI9-IMG-A1b follow-up 5: a picture a page can show has its 800/1200 rungs. The route catalogs ship each listing's
 * candidates (① own, ② venue, ③ its category's pool, ④ approved AI), so a pool picture shown only on /events or /calendar
 * is published too; npm run images:variants then writes the rungs its bytes call for (tests/image-manifest.test.ts checks
 * which). image-manifest.test.ts only notes a stale flag; here it fails, so a new pool picture cannot ship as a bare original.
 */
type ManifestImage = { scope: 'registry' | 'extra'; published: boolean };
const manifest = JSON.parse(readFileSync(new URL(`../${MANIFEST_PATH}`, import.meta.url), 'utf8')) as { images: Record<string, ManifestImage> };

test('every picture a page can show is marked published in the image manifest (run npm run images:variants)', () => {
  const published = publishedImageSources();
  // A published source with no manifest entry at all is missing too (npm run images:variants has never seen it).
  const missing = [...published].filter(src => !manifest.images[src] || (manifest.images[src].scope === 'registry' && !manifest.images[src].published));
  assert.deepEqual(missing, [], `${missing.length} published pictures lack their 800/1200 rungs`);
});

test('every ③ pool picture counts as published', () => {
  const published = publishedImageSources();
  const pool = Object.values(COVER_TABLES.categories).flatMap(keys => keys ?? []);
  assert.ok(pool.length > 100);
  for (const key of pool) {
    const src = GUIDE_IMAGES[key]?.src;
    assert.ok(src, `${key} is a registered picture`);
    assert.ok(published.has(src), `${key} is a card picture`);
  }
});
