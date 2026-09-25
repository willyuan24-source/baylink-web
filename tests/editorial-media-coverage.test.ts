import assert from 'node:assert/strict';
import test from 'node:test';
import { auditMediaCoverage } from '../scripts/audit-media-coverage';
import newPhotos from '../src/data/content-coverage-media.json';
import { loadLocale, translateText } from '../src/i18n/locale';
import { isApprovedEventContextPhoto } from '../src/data/event-image-usage';

test('every published guide, event, offer, opening and place has a valid local image and responsive files', () => {
  const report = auditMediaCoverage();
  assert.deepEqual(report.issues, []);
  for (const catalog of Object.values(report.summary)) {
    assert.ok(catalog.total > 0);
    assert.equal(catalog.missing, 0);
    assert.equal(catalog.photos + catalog.illustrations + catalog.posters, catalog.total);
  }
});

test('new event photos retain reusable provenance and distinguish archival or thematic images from current events', () => {
  for (const photo of newPhotos) {
    assert.match(photo.creditUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(photo.credit, /CC BY|CC0|Public domain/);
    assert.match(photo.caption, /资料/);
    assert.match(photo.caption, /不是|不代表|不表示/);
    if ('licenseUrl' in photo) assert.match(photo.licenseUrl, /^https:\/\/creativecommons\.org\//);
  }
});

test('new photo descriptions, captions and credits are translated on English pages', async () => {
  await loadLocale('en');
  for (const photo of newPhotos) {
    for (const value of [photo.alt, photo.caption, photo.credit]) {
      assert.doesNotMatch(translateText(value, 'en'), /[\u3400-\u9fff]/, `${photo.key}: ${value}`);
    }
  }
});

test('context-photo approvals do not permit different venues, real event photos or official posters to be borrowed', () => {
  assert.equal(isApprovedEventContextPhoto('region-omca', 'oakland-omca-friday-finale-2026'), true);
  assert.equal(isApprovedEventContextPhoto('region-omca', 'sf-ybg-dance-day-2026'), false);
  assert.equal(isApprovedEventContextPhoto('event-opera', 'sf-ybg-dance-day-2026'), false);
  assert.equal(isApprovedEventContextPhoto('event-portola', 'sf-ybg-dance-day-2026'), false);
  assert.equal(isApprovedEventContextPhoto('toString', 'sf-ybg-dance-day-2026'), false);
});
