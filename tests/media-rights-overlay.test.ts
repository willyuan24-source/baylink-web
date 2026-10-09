import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import overlay from '../src/data/media-rights-overlay.json';
import federalPublicDomainMedia from '../src/data/federal-pd-media.json';
import officialEventMedia from '../src/data/official-event-media.json';
import { GUIDE_IMAGES, applyMediaRightsOverlay, type GuideImage } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { getCover } from '../src/lib/cover';
import { getImageProvenance } from '../src/lib/image-provenance';
import { mediaFactErrors, mediaRightsReview } from '../scripts/audit-media-coverage';
import legacyMediaKeys from '../scripts/data/media-rights-baseline.json';

const ALLOWED = new Set(['coverOk', 'focal', 'shotAt', 'ownShot', 'rights']);
const RIGHTS_FIELDS = new Set(['basis', 'evidenceUrl', 'grantedAt', 'scope', 'promoAllowed']);
const entries = Object.entries(overlay) as [string, Record<string, unknown>][];
const FLEET_WEEK = 'san-francisco-fleet-week-2026';
const PHOTO = 'dvids-blue-angels-sffw-2024';

test('every overlay entry names a registered image and uses only the reviewed media fields', () => {
  assert.ok(entries.length > 0);
  for (const [key, entry] of entries) {
    assert.ok(Object.hasOwn(GUIDE_IMAGES, key), `${key} is a registered image key`);
    for (const field of Object.keys(entry)) assert.ok(ALLOWED.has(field), `${key}: ${field} is not an overlay field`);
    if (entry.rights) for (const field of Object.keys(entry.rights)) assert.ok(RIGHTS_FIELDS.has(field), `${key}: rights.${field}`);
    assert.deepEqual(mediaFactErrors(key, GUIDE_IMAGES[key]), [], key);
  }
});

test('the overlay is applied last: registered images carry its facts and no later map can undo them', () => {
  for (const [key, entry] of entries) {
    for (const [field, value] of Object.entries(entry)) assert.deepEqual((GUIDE_IMAGES[key] as Record<string, unknown>)[field], value, `${key}: ${field}`);
  }
  // The overlay call is the final write to the registry in guide-media.ts.
  const source = readFileSync(new URL('../src/data/guide-media.ts', import.meta.url), 'utf8');
  const call = source.indexOf('applyMediaRightsOverlay(GUIDE_IMAGES');
  assert.ok(call > 0);
  const after = source.slice(call + 1);
  assert.doesNotMatch(after, /GUIDE_IMAGES\[[^\]]+\]\s*(?:\.\w+\s*)?=(?!=)|Object\.assign\(GUIDE_IMAGES|GUIDE_IMAGES\[[^\]]+\]\s*\?\?=/, 'nothing writes GUIDE_IMAGES after the overlay');
});

test('the Fleet Week public-domain photo gains a structured record without becoming an official image', () => {
  const image = GUIDE_IMAGES[PHOTO];
  const record = federalPublicDomainMedia.find(item => item.key === PHOTO)!;
  assert.ok(typeof image.rights === 'object');
  assert.equal(image.rights.basis, 'public-domain');
  assert.equal(image.rights.evidenceUrl, record.licenseUrl, 'the evidence is the DVIDS copyright page the record already cites');
  assert.equal(image.rights.promoAllowed, false, 'the record says editorial event listings only, not ads or promotion');
  assert.match(record.rights, /not ads or promotion/);
  assert.equal(getImageProvenance(image), '资料图 · 2024', 'still an archive photo, never 官方图');
  const event = MONTHLY_EVENTS.find(item => item.id === FLEET_WEEK)!;
  const cover = getCover({ kind: 'event', id: FLEET_WEEK, imageKey: event.imageKey }, { images: GUIDE_IMAGES, today: '2026-10-09' });
  assert.equal(cover.tier, 'photo');
  assert.deepEqual(cover.tier !== 'type' && cover.label, { zh: '资料图 · 2024', en: 'Archive photo · 2024' });
});

test('CNT-MEDIA official event images keep their own rights records under the overlay', () => {
  for (const record of officialEventMedia) {
    const image = GUIDE_IMAGES[record.key];
    if (Object.hasOwn(overlay, record.key)) continue;
    assert.deepEqual(image.rights, record.rights, record.key);
    assert.equal(getImageProvenance(image), '官方图', record.key);
  }
});

test('overlay facts drive the cover resolver: a veto, a focal point, an own shot and a recorded permission', () => {
  const base = (overrides: Partial<GuideImage>): GuideImage => ({
    src: `/guides/test/${Math.random().toString(36).slice(2)}.webp`, alt: 'alt', caption: '2025 年照片', credit: 'Example · CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', kind: 'photo', width: 1200, height: 800, ...overrides,
  });
  const images: Record<string, GuideImage> = { veto: base({}), focus: base({}), mine: base({ credit: 'BAYLINK', caption: '现场', licenseUrl: undefined }), granted: base({ credit: 'Venue', caption: 'Hall', licenseUrl: undefined }), poster: base({ kind: 'poster', credit: 'Organiser · 官方海报' }) };
  applyMediaRightsOverlay(images, {
    veto: { coverOk: false },
    focus: { focal: [30, 70] },
    mine: { ownShot: true, shotAt: '2026-10-04', rights: { basis: 'owner' } },
    granted: { rights: { basis: 'permission', evidenceUrl: 'https://example.org/permission', grantedAt: '2026-10-08', scope: 'same-venue coverage', promoAllowed: false } },
    missing: { coverOk: false },
  });
  assert.equal(Object.hasOwn(images, 'missing'), false, 'an unknown key adds nothing');
  const ctx = { images, today: '2026-10-09' };
  const vetoed = getCover({ kind: 'place', id: 'p', imageKey: 'veto' }, ctx);
  assert.equal(vetoed.tier === 'type' && vetoed.reason, 'cover-not-ok');
  const focused = getCover({ kind: 'place', id: 'p2', imageKey: 'focus' }, ctx);
  assert.deepEqual(focused.tier !== 'type' && focused.focal, [30, 70]);
  assert.equal(getImageProvenance(images.mine, false, '2026-10-09'), 'BAYLINK 实拍 · 10/4');
  const granted = getCover({ kind: 'event', id: 'e', imageKey: 'granted' }, ctx);
  assert.equal(granted.tier, 'official', 'a recorded permission is the official tier');
  assert.deepEqual(mediaFactErrors('poster', { ...images.poster, focal: [50, 50] }), ['poster: posters and full-frame art are letterboxed, never cropped, so they take no focal point']);
});

test('the media audit warns about older images and blocks new ones without structured rights and coverOk', () => {
  const legacy = new Set(legacyMediaKeys);
  assert.ok(legacy.has(PHOTO) && legacy.size >= 300, 'the baseline lists the registry as of WEB-IMAGES');
  const review = mediaRightsReview({
    old: { kind: 'photo', rights: 'CC BY 4.0 as stated on the source page' },
    fresh: { kind: 'photo', rights: 'CC BY 4.0 as stated on the source page' },
    reviewed: { kind: 'photo', coverOk: true, rights: { basis: 'cc', evidenceUrl: 'https://creativecommons.org/licenses/by/4.0/' } },
    owned: { kind: 'photo', coverOk: true, ownShot: true, shotAt: '2026-10-04', rights: { basis: 'owner' } },
    badBasis: { kind: 'photo', coverOk: true, rights: { basis: 'scraped' as never, evidenceUrl: 'https://example.org' } },
    insecure: { kind: 'photo', coverOk: true, rights: { basis: 'press-kit', evidenceUrl: 'http://example.org/press' } },
    undatedShot: { kind: 'photo', coverOk: true, ownShot: true, rights: { basis: 'owner' } },
  }, new Set(['old']));
  assert.deepEqual(review.warnings, ['1 older images have prose rights only (e.g. old)', '1 older images have no coverOk review (e.g. old)']);
  assert.ok(review.issues.some(issue => issue.startsWith('fresh: a new image needs a structured rights record and coverOk')));
  assert.ok(review.issues.some(issue => issue.startsWith('badBasis: rights.basis must be one of')));
  assert.ok(review.issues.some(issue => issue === 'insecure: rights.evidenceUrl must be an https link'));
  assert.ok(review.issues.some(issue => issue === 'undatedShot: an own shot needs its shotAt capture date'));
  assert.equal(review.issues.some(issue => /^(old|reviewed|owned):/.test(issue)), false);
});
