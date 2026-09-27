import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Every file the asset registry lists exists under public/ (lane H2b, H2b-11: nothing checked this before). A listed
 * file that is missing would 404 in the game (a chirp instead of a voice line, a missing texture) or break a preload.
 */

const { ASSETS, listAssetUrls } = await import('../src/opus-bay/data/assets');

const publicFile = (url: string) => path.resolve(import.meta.dirname, '../public', url.replace(/^\//, ''));

test('asset files: every listAssetUrls() file exists and is not empty', () => {
  const urls = listAssetUrls();
  assert.ok(urls.length > 100, `${urls.length} urls`);
  const missing = urls.filter(u => !u.startsWith('/opus-bay/') || !fs.existsSync(publicFile(u)) || fs.statSync(publicFile(u)).size === 0);
  assert.deepEqual(missing, []);
});

test('asset files: the voice clip each id plays in this runtime is a listed file', () => {
  const urls = new Set(listAssetUrls());
  for (const [id, url] of Object.entries(ASSETS.voice)) assert.ok(urls.has(url), `voice ${id} ${url}`);
});
