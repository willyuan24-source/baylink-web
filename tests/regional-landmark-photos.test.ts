import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assets from '../src/data/regional-landmark-photo-assets.json';
import { getRegionalLandmarkPhoto } from '../src/features/little-bay/regional-landmark-photos';
import { REGIONAL_WORLDS } from '../src/features/little-bay/regional-world';
import { loadLocale } from '../src/i18n/locale';

const readImage = (src: string) => {
  assert.match(src, /^\/guides\/[a-z0-9/.-]+\.webp$/);
  assert.equal(src.includes('..'), false);
  return readFileSync(new URL(`../public${src}`, import.meta.url));
};

function dimensions(data: Buffer, src: string) {
  assert.equal(data.toString('ascii', 0, 4), 'RIFF', src);
  assert.equal(data.toString('ascii', 8, 12), 'WEBP', src);
  assert.equal(data.readUInt32LE(4) + 8, data.length, `${src}: complete WebP container`);
  const kind = data.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  if (kind === 'VP8L') {
    assert.equal(data[20], 0x2f, src);
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  assert.equal(kind, 'VP8 ', `${src}: supported WebP header`);
  assert.deepEqual([...data.subarray(23, 26)], [0x9d, 0x01, 0x2a], src);
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
}

test('all 36 regional landmarks have their own registered photograph without cross-region fallbacks', () => {
  const keys = Object.values(REGIONAL_WORLDS).flatMap(world => world.places.map(place => `${world.id}:${place.id}`));
  assert.equal(keys.length, 36);
  assert.deepEqual(assets.map(photo => photo.key).sort(), keys.sort());
  assert.equal(new Set(assets.map(photo => photo.src)).size, keys.length);
  for (const world of Object.values(REGIONAL_WORLDS)) {
    for (const place of world.places) assert.equal(getRegionalLandmarkPhoto(world.id, place.id, 'en')?.kind, 'photo');
  }
  for (const [region, id] of [['peninsula', 'berkeley'], ['east-bay', 'stanford'], ['sf', 'berkeley'], ['south-bay', 'missing']]) {
    assert.equal(getRegionalLandmarkPhoto(region, id, 'en'), undefined);
  }
});

test('regional photos keep complete bilingual descriptions, archive dates and reusable licensing', async () => {
  await loadLocale('zh-Hant');
  for (const photo of assets) {
    const [region, id] = photo.key.split(':');
    const en = getRegionalLandmarkPhoto(region, id, 'en')!;
    const zh = getRegionalLandmarkPhoto(region, id, 'zh-Hans')!;
    const traditional = getRegionalLandmarkPhoto(region, id, 'zh-Hant')!;
    for (const value of [en.alt, en.caption, en.credit]) {
      assert.ok(value.length > 5, photo.key);
      assert.doesNotMatch(value, /[\u3400-\u9fff]/, photo.key);
    }
    assert.match(zh.caption, /20\d\d 年资料照片/, photo.key);
    assert.match(traditional.caption, /20\d\d 年資料照片/, photo.key);
    assert.match(en.caption, /Archive photograph, 20\d\d/, photo.key);
    assert.equal(en.src, zh.src);
    assert.match(photo.credit, /CC BY|CC0|Public domain/, photo.key);
    assert.match(photo.creditUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, photo.key);
    assert.match(photo.licenseUrl, /^https:\/\/(creativecommons\.org\/(licenses|publicdomain)\/|commons\.wikimedia\.org\/wiki\/File:.*#Licensing$)/, photo.key);
    assert.match(photo.originalUrl, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//, photo.key);
    assert.match(photo.captured, /20\d\d/, photo.key);
    assert.match(photo.reviewed, /^\d{4}-\d{2}-\d{2}$/, photo.key);
  }
  for (const key of ['peninsula:stanford', 'east-bay:berkeley']) {
    const photo = assets.find(item => item.key === key)!;
    assert.match(photo.captionEn, /Access to campus buildings and teaching areas is subject to university rules/);
  }
  for (const key of ['south-bay:apple-visitor', 'south-bay:google-visitor']) {
    assert.match(assets.find(item => item.key === key)!.captionEn, /office (areas|spaces)/);
  }
});

test('all full-size and mobile files are complete, match their intrinsic dimensions and contain distinct images', () => {
  const hashes = new Set<string>();
  for (const photo of assets) {
    const candidates = photo.srcSet.split(',').map(candidate => candidate.trim().split(' '));
    assert.equal(candidates.length, 2, photo.key);
    assert.ok(candidates.some(([src]) => src === photo.src), photo.key);
    for (const [src, width] of candidates) {
      const data = readImage(src);
      const size = dimensions(data, src);
      assert.equal(size.width, Number.parseInt(width), src);
      if (src === photo.src) {
        assert.deepEqual(size, { width: photo.width, height: photo.height }, src);
        assert.ok(size.width >= 1000, `${src}: enough detail for the landmark panel`);
        hashes.add(createHash('sha256').update(data).digest('hex'));
      } else {
        assert.equal(size.width, 480, src);
        assert.ok(Math.abs(size.height / size.width - photo.height / photo.width) < 0.003, src);
      }
    }
  }
  assert.equal(hashes.size, assets.length, 'different places must not silently share one picture');
});
