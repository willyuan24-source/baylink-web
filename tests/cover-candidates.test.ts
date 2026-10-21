import assert from 'node:assert/strict';
import test from 'node:test';
import { COVER_TABLES, coverCandidates, idSpot, venuesFor, type CoverTables } from '../src/lib/cover-candidates';
import { AI_COVER_APPROVALS, GUIDE_IMAGES } from '../src/data/guide-media';
import { coverItemFor } from '../src/lib/cover';
import { isPhotoCategoryId } from '../src/lib/photo-category';

// UI9-IMAGES A0: the candidate order (DECISIONS 22) and the three reviewed tables the B and C lanes fill.
const tables: CoverTables = {
  venues: [{ id: 'cupertino-library', name: 'Cupertino Library', match: ['Cupertino 图书馆'], records: ['offer:o-lib'], exclude: ['event:e-skip'], imageKeys: ['venue-a', 'venue-b'], approvedAt: '2026-10-21', ownerQuote: '可以' }],
  categories: { storytime: ['s1', 's2', 's3'] },
  ai: [{ key: 'ai-1', for: ['category:storytime'] }, { key: 'ai-2', for: ['event:e1'] }],
};
const story = { id: 'e1', title: 'Cupertino 图书馆周六亲子故事时间', venue: 'Cupertino 图书馆 101 室', category: 'family', imageKey: 'own' };

test('① own → ② venue → ③ category, rotated by id → ④ approved AI', () => {
  const keys = coverCandidates('event', story, tables);
  assert.deepEqual(keys.slice(0, 3), ['own', 'venue-a', 'venue-b']);
  assert.deepEqual([...keys.slice(3, 6)].sort(), ['s1', 's2', 's3']);
  assert.equal(keys[3], ['s1', 's2', 's3'][idSpot('e1', 3)], 'the pool starts at a spot fixed by the id');
  assert.deepEqual(keys.slice(6), ['ai-1', 'ai-2']);
  assert.deepEqual(coverCandidates('event', { ...story, imageKey: undefined }, tables)[0], 'venue-a');
  assert.deepEqual(venuesFor('event', { ...story, id: 'e-skip' }, tables.venues), [], 'exclude wins over a match');
  assert.deepEqual(venuesFor('offer', { id: 'o-lib', title: '图书证福利' }, tables.venues).map(v => v.id), ['cupertino-library'], 'records add what the words miss');
});

test('with today’s empty tables every record keeps exactly its own image (A0 changes no page)', () => {
  assert.deepEqual(coverCandidates('event', story), ['own']);
  assert.deepEqual(coverCandidates('offer', { id: 'o', brand: 'IKEA', title: '会员咖啡' }), []);
  assert.deepEqual(coverItemFor('event', { id: 'e', imageKey: 'k' }), { kind: 'event', id: 'e', imageKey: 'k' });
  assert.deepEqual(coverItemFor('event', { id: 'e', imageKey: 'face' }, { imageKey: undefined }), { kind: 'event', id: 'e', imageKey: undefined },
    'an explicit undefined (the close-up-face rule) is kept, never replaced by the record’s own image');
  assert.deepEqual(coverItemFor('event', { id: 'e', imageKey: 'face', imageKeys: ['face', 'v', 's'] }, { imageKey: undefined }),
    { kind: 'event', id: 'e', imageKey: undefined, imageKeys: ['v', 's'] }, 'the lead’s face rule drops the own image from the candidates too');
});

test('the reviewed tables are well formed and point at registered pictures of the right kind', () => {
  for (const venue of COVER_TABLES.venues) {
    assert.ok(venue.id && venue.name && venue.match.length && venue.ownerQuote && /^\d{4}-\d{2}-\d{2}$/.test(venue.approvedAt), venue.id);
    for (const key of venue.imageKeys) assert.equal(GUIDE_IMAGES[key]?.subject, 'venue', `${venue.id}: ${key}`);
  }
  for (const [category, keys] of Object.entries(COVER_TABLES.categories)) {
    assert.ok(isPhotoCategoryId(category), category);
    for (const key of keys ?? []) {
      const image = GUIDE_IMAGES[key];
      assert.equal(image?.subject, 'category', key);
      assert.ok(image.kind === 'illustration' ? image.aiCoverApproved : typeof image.rights === 'object' && image.rights.basis === 'stock', key);
    }
  }
  for (const approval of AI_COVER_APPROVALS) {
    assert.equal(GUIDE_IMAGES[approval.key]?.kind, 'illustration', approval.key);
    assert.ok(approval.ownerQuote && /^\d{4}-\d{2}-\d{2}$/.test(approval.approvedAt), approval.key);
  }
  const approved = new Set(AI_COVER_APPROVALS.map(approval => approval.key));
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) {
    if (image.aiCoverApproved) assert.ok(approved.has(key), `${key}: aiCoverApproved comes only from ai-cover-approvals.json`);
    if (typeof image.rights === 'object' && image.rights.basis === 'stock') {
      assert.ok(image.kind === 'photo' && image.credit && /^https:\/\//.test(image.rights.evidenceUrl ?? ''), `${key}: a stock photo names its photographer and page`);
    }
  }
});

test('a guide record (id = slug) gets the pool of its slug-derived category, and an AI approval for that category', () => {
  const guideTables: CoverTables = { venues: [], categories: { transit: ['T1'], 'guide-documents': ['D1'] }, ai: [{ key: 'ai-t', for: ['category:transit'] }] };
  assert.deepEqual(coverCandidates('guide', { id: 'bart-october-access-parking-update-2026' }, guideTables), ['T1', 'ai-t']);
  assert.deepEqual(coverCandidates('guide', { id: 'some-new-guide', category: 'service' }, guideTables), ['D1'], 'then the guide category');
});
