import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoverPage, distinctNeighbourTones, getCover, resolveCovers, rightsBasisOf, type CoverAsset, type CoverItem } from '../src/lib/cover';
import { getImageProvenance } from '../src/lib/image-provenance';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';

const today = '2026-10-08';
const asset = (overrides: Partial<CoverAsset>): CoverAsset => ({
  src: `/guides/test/${Math.random().toString(36).slice(2)}.webp`, alt: 'alt', caption: '2024 年资料照片', credit: 'Example · CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', kind: 'photo', width: 1200, height: 800, ...overrides,
});
const images: Record<string, CoverAsset> = {
  ai: asset({ kind: 'illustration', credit: 'BAYLINK · AI 原创插图', caption: '情境插图' }),
  recent: asset({ caption: 'Fleet Week 航展，2024 年资料照片。' }),
  old: asset({ caption: '2013 年资料照片' }),
  undated: asset({ caption: '场馆外观' }),
  vetoed: asset({ caption: '2025 年照片', coverOk: false }),
  poster: asset({ kind: 'poster', credit: 'Organiser · 官方海报', caption: '2026 年官方海报', width: 800, height: 1200 }),
  official: asset({ credit: 'Brand · 官方宣传图', caption: '官方宣传图', licenseUrl: undefined }),
  pressKit: asset({ credit: 'Organiser', caption: 'Festival crowd', licenseUrl: undefined, rights: { basis: 'press-kit' } }),
  own: asset({ credit: 'BAYLINK', caption: '现场', ownShot: true, shotAt: '2026-10-04', licenseUrl: undefined }),
  postcard: asset({ kind: 'illustration', credit: 'BAYLINK 3D 旧金山', caption: '3D 明信片', licenseUrl: undefined }),
  venue: asset({ caption: '场馆外观，2022 年资料照片' }),
  venueOld: asset({ caption: '场馆外观，2009 年资料照片' }),
  theme: asset({ caption: '主题资料照片，2023 年摄' }),
};
const contextPhotos = {
  venue: { purpose: 'venue' as const, eventIds: ['e-venue'] },
  venueOld: { purpose: 'venue' as const, eventIds: ['e-venue'] },
  theme: { purpose: 'theme' as const, eventIds: ['e-theme'] },
};
const ctx = { images, today, contextPhotos };
const event = (id: string, imageKey?: string): CoverItem => ({ kind: 'event', id, imageKey });

test('the honesty ladder: official → dated photo → approved venue → 3D postcard → TypeCover', () => {
  assert.equal(getCover(event('e1', 'poster'), ctx).tier, 'official');
  assert.equal(getCover(event('e1', 'pressKit'), ctx).tier, 'official', 'a recorded press-kit basis is official');
  assert.equal(getCover(event('e1', 'recent'), ctx).tier, 'photo');
  assert.equal(getCover(event('e-venue', 'venue'), ctx).tier, 'venue');
  assert.equal(getCover({ kind: 'place', id: 'p1', postcardKey: 'postcard' }, ctx).tier, 'scene3d');
  assert.equal(getCover({ kind: 'place', id: 'p1', imageKey: 'old', postcardKey: 'postcard' }, ctx).tier, 'photo', 'a place keeps its real photo of any age');
  assert.equal(getCover(event('e1'), ctx).tier, 'type');
});

test('AI illustrations and theme photos never cover a factual item', () => {
  for (const kind of ['event', 'offer', 'opening', 'place', 'guide', 'bulletin'] as const) {
    const cover = getCover({ kind, id: 'x', imageKey: 'ai' }, ctx);
    assert.equal(cover.tier, 'type', kind);
    assert.equal(cover.tier === 'type' && cover.reason, 'ai-illustration');
  }
  const theme = getCover(event('e-theme', 'theme'), ctx);
  assert.equal(theme.tier === 'type' && theme.reason, 'theme-photo');
  const reuse = getCover(event('someone-else', 'venue'), ctx);
  assert.equal(reuse.tier === 'type' && reuse.reason, 'unapproved-reuse', 'a venue photo serves only its reviewed events');
  assert.equal(getCover({ kind: 'event', id: 'e1', postcardKey: 'postcard' }, ctx).tier, 'type', '3D postcards are for SF places only');
});

test('event photos must be dated within 8 years and not vetoed; offers and openings need their own images', () => {
  const reason = (item: CoverItem) => { const cover = getCover(item, ctx); return cover.tier === 'type' ? cover.reason : cover.tier; };
  assert.equal(reason(event('e1', 'old')), 'too-old');
  assert.equal(reason(event('e-venue', 'venueOld')), 'too-old');
  assert.equal(reason(event('e1', 'undated')), 'undated');
  assert.equal(reason(event('e1', 'vetoed')), 'cover-not-ok');
  assert.equal(reason(event('e1', 'missing')), 'missing-image');
  assert.equal(reason({ kind: 'offer', id: 'o1', imageKey: 'recent' }), 'not-allowed-for-kind');
  assert.equal(reason({ kind: 'offer', id: 'o1', imageKey: 'official' }), 'official');
  assert.equal(reason({ kind: 'opening', id: 's1', imageKey: 'recent' }), 'not-allowed-for-kind');
  assert.equal(reason({ kind: 'opening', id: 's1', imageKey: 'own' }), 'photo');
});

test('labels come only from getImageProvenance, and posters are letterboxed, never cropped', () => {
  for (const key of ['poster', 'official', 'recent', 'own', 'venue'] as const) {
    const item = key === 'venue' ? event('e-venue', key) : { kind: 'opening' as const, id: 'o', imageKey: key };
    const cover = getCover(key === 'recent' ? event('e1', key) : item, ctx);
    assert.notEqual(cover.tier, 'type', key);
    if (cover.tier === 'type') continue;
    assert.equal(cover.label.zh, getImageProvenance(images[key], false, today));
    assert.equal(cover.label.en, getImageProvenance(images[key], true, today));
  }
  const poster = getCover(event('e1', 'poster'), ctx);
  assert.equal(poster.tier !== 'type' && poster.fit, 'contain');
  const own = getCover({ kind: 'opening', id: 'o', imageKey: 'own' }, ctx);
  assert.equal(own.tier !== 'type' && own.label.zh, 'BAYLINK 实拍 · 10/4');
  const postcard = getCover({ kind: 'place', id: 'p', postcardKey: 'postcard' }, ctx);
  assert.deepEqual(postcard.tier !== 'type' && postcard.label, { zh: '3D 场景插图', en: '3D scene illustration' });
  const type = getCover(event('e1'), ctx);
  assert.deepEqual(type.label, { zh: 'BAYLINK 信息卡', en: 'Info card' });
  assert.deepEqual(getCover(event('e1', 'recent'), ctx).tier !== 'type' && getCover(event('e1', 'recent'), ctx).focal, [50, 40]);
});

test('the same image appears once per page; the second item falls back to a TypeCover', () => {
  const shared = { ...images, twin: { ...images.recent } };
  const covers = resolveCovers([event('a', 'recent'), event('b', 'twin'), event('c', 'recent')], { ...ctx, images: shared });
  assert.deepEqual(covers.map(cover => cover.tier === 'type' ? cover.reason : cover.tier), ['photo', 'duplicate', 'duplicate'], 'same file under another key is still a duplicate');
  const page = createCoverPage();
  assert.equal(getCover(event('a', 'recent'), { ...ctx, page }).tier, 'photo');
  assert.equal(getCover(event('a', 'recent'), { ...ctx, page }).tier, 'photo', 're-rendering the same item keeps its claim');
  assert.equal(getCover(event('b', 'recent'), { ...ctx, page }).tier, 'type');
  assert.equal(getCover(event('b', 'recent'), { ...ctx, images: (key: string) => images[key] }).tier, 'photo', 'no page: no de-duplication; a lookup function works too');
});

test('adjacent TypeCovers never share a colour; labels are untouched', () => {
  assert.deepEqual(distinctNeighbourTones(['family', 'family', 'family', null, 'family']), ['family', 'food', 'family', null, 'family']);
  assert.deepEqual(distinctNeighbourTones(['culture', 'seniors', 'seniors']), ['culture', 'seniors', 'culture']);
  assert.deepEqual(distinctNeighbourTones(['outdoors', 'outdoors']), ['outdoors', 'free']);
});

test('rights basis reads today’s registry fields', () => {
  assert.equal(rightsBasisOf(images.ai), 'ai');
  assert.equal(rightsBasisOf(images.poster), 'official');
  assert.equal(rightsBasisOf(images.recent), 'cc');
  assert.equal(rightsBasisOf(images.own), 'owner');
  assert.equal(rightsBasisOf(GUIDE_IMAGES['dvids-blue-angels-sffw-2024']), 'public-domain');
});

test('the live catalog: no AI or theme photo on any event, offer or opening; Fleet Week keeps its DVIDS photo', () => {
  const live = MONTHLY_EVENTS.filter(item => item.endDate >= today);
  const covers = resolveCovers(live.map(item => ({ kind: 'event' as const, id: item.id, imageKey: item.imageKey })), { images: GUIDE_IMAGES, today });
  const vocabulary = /^(官方图|照片|资料图|BAYLINK 实拍|BAYLINK 信息卡|3D 场景插图)( · \d{4}(\/\d{1,2}\/\d{1,2})?| · \d{1,2}\/\d{1,2})?$/;
  covers.forEach((cover, index) => {
    if (cover.tier !== 'type') assert.notEqual(cover.image.kind, 'illustration', live[index].id);
    assert.match(cover.label.zh, vocabulary, live[index].id);
  });
  const sources = covers.flatMap(cover => cover.tier === 'type' ? [] : [cover.image.src]);
  assert.equal(new Set(sources).size, sources.length, 'one page, no repeated file');
  const fleetWeek = live.find(item => item.imageKey === 'dvids-blue-angels-sffw-2024');
  assert.ok(fleetWeek, 'the Fleet Week event is live');
  const cover = getCover({ kind: 'event', id: fleetWeek.id, imageKey: fleetWeek.imageKey }, { images: GUIDE_IMAGES, today });
  assert.equal(cover.tier, 'photo');
  assert.equal(cover.label.zh, '资料图 · 2024');
  for (const offer of currentFreebies) {
    const resolved = getCover({ kind: 'offer', id: offer.id, imageKey: offer.imageKey }, { images: GUIDE_IMAGES, today });
    if (resolved.tier !== 'type') assert.equal(resolved.tier, 'official', offer.id);
  }
  for (const opening of currentOpenings) {
    const resolved = getCover({ kind: 'opening', id: opening.id, imageKey: opening.imageKey }, { images: GUIDE_IMAGES, today });
    if (resolved.tier !== 'type') assert.notEqual(resolved.image.kind, 'illustration', opening.id);
  }
});
