import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COVER_TABLES, coverCandidates, idSpot, type CoverTables } from '../src/lib/cover-candidates';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import pinFile from '../src/data/record-photo-pins.json';

// UI9-IMG-B2 (review 10-23): record pins and drops (src/data/record-photo-pins.json). A pin with a typo, the wrong kind or a
// renamed record does nothing at all, so the data is held against the live catalogs here.
const tables: CoverTables = {
  venues: [{ id: 'cupertino-library', name: 'Cupertino Library', match: ['Cupertino 图书馆'], imageKeys: ['venue-a'], approvedAt: '2026-10-23', ownerQuote: 'test' }],
  categories: { storytime: ['s1', 's2', 's3', 's4'] },
  ai: [{ key: 'ai-1', for: ['category:storytime'] }],
  pins: { 'event:e1': ['pin-1', 'pin-2', 's3'] },
  drops: { 'event:e1': ['s4'], 'event:e2': ['s1'] },
};
const story = { id: 'e1', title: 'Cupertino 图书馆周六亲子故事时间', venue: 'Cupertino 图书馆 101 室', category: 'family', imageKey: 'own' };

test('① own → ② venue → pinned ③ → the rotated pool less its drops → ④', () => {
  const keys = coverCandidates('event', story, tables);
  assert.deepEqual(keys.slice(0, 5), ['own', 'venue-a', 'pin-1', 'pin-2', 's3'], 'pins come after ① and ②, in their order');
  assert.deepEqual(keys.slice(5, 7).sort(), ['s1', 's2'], 'then the pool, each key once, without the dropped s4');
  assert.deepEqual(keys.slice(7), ['ai-1']);
  assert.ok(!keys.includes('s4'), 'a dropped pool picture never shows on that record');
  // The pool's rotation starts on the pool less the drops.
  const other = coverCandidates('event', { ...story, id: 'e2', imageKey: undefined }, tables);
  assert.deepEqual(other.slice(0, 1), ['venue-a']);
  assert.equal(other[1], ['s2', 's3', 's4'][idSpot('e2', 3)]);
  assert.ok(!other.includes('s1') && !other.includes('pin-1'), 'drops and pins belong to their own record only');
});

test('pinned pictures do not count against the route\'s stock cap, and a pin-only picture never enters a pool', () => {
  const capped = coverCandidates('event', story, { ...tables, pins: { 'event:e1': ['pin-1', 'pin-2'] } }, { stock: 1 });
  assert.deepEqual(capped.slice(0, 4), ['own', 'venue-a', 'pin-1', 'pin-2']);
  assert.equal(capped.length, 5, 'both pins plus one pool picture, and no ④ on a capped list');
  assert.ok(['s1', 's2', 's3'].includes(capped[4]));
  const pools = new Set(Object.values(COVER_TABLES.categories).flat());
  for (const key of ['stock-lantern-1', 'stock-campus-open-day-1', 'stock-muni-1', 'stock-muni-2', 'stock-dumplings-1', 'stock-dumplings-2']) {
    assert.ok(!pools.has(key), `${key}: pin-only, in no shared pool`);
    assert.ok(Object.values(pinFile.pins).some(keys => keys.includes(key)), `${key}: pinned to a record`);
  }
});

type Listed = { id: string; title?: string; category?: string; imageKey?: string; imageKeys?: string[] };
const read = <T>(file: string) => JSON.parse(readFileSync(`src/data/generated/${file}`, 'utf8')) as T;
const index = read<{ events: Listed[] }>('events-index.json');
const later = read<{ events: Listed[] }>('events-later.json');
const boards = read<{ offers: Listed[]; openings: Listed[] }>('events-boards.json');
const guides = read<{ guides: (Listed & { slug: string })[] }>('guides-index.json').guides;
const live: Record<string, Map<string, Listed>> = {
  event: new Map([...later.events, ...index.events].map(event => [event.id, event])),
  offer: new Map(boards.offers.map(offer => [offer.id, offer])),
  opening: new Map(boards.openings.map(opening => [opening.id, opening])),
  guide: new Map(guides.map(guide => [guide.slug, { ...guide, id: guide.slug }])),
};
const recordOf = (ref: string) => {
  const [kind, id] = ref.split(/:(.*)/s);
  return { kind, record: live[kind]?.get(id) };
};

test('every pin and drop names a live record and a registered stock picture; every pin reaches the catalogs', () => {
  const tables = pinFile as { pins: Record<string, string[]>; drops: Record<string, string[]> };
  assert.ok(Object.keys(tables.pins).length >= 17 && Object.keys(tables.drops).length >= 4);
  for (const [ref, keys] of [...Object.entries(tables.pins), ...Object.entries(tables.drops)]) {
    const { kind, record } = recordOf(ref);
    assert.ok(record, `${ref}: a live ${kind} record`);
    assert.ok(keys.length && new Set(keys).size === keys.length, `${ref}: keys listed once`);
    for (const key of keys) assert.equal(GUIDE_IMAGES[key]?.rights?.basis, 'stock', `${ref}: ${key} is a registered stock (③) picture`);
  }
  for (const [ref, keys] of Object.entries(tables.pins)) {
    const { kind, record } = recordOf(ref);
    if (kind === 'guide') continue;
    assert.ok(record!.imageKeys?.includes(keys[0]), `${ref}: the catalog ships its first pinned picture`);
  }
  for (const [ref, keys] of Object.entries(tables.drops)) {
    const { kind, record } = recordOf(ref);
    if (kind === 'guide') continue;
    for (const key of keys) assert.ok(!record!.imageKeys?.includes(key), `${ref}: ${key} is dropped from its pictures`);
  }
});

test('/guides (#68 live check): the Medicare guide shows pills, the dental guide the dental chair, never each other\'s', () => {
  const candidates = (slug: string) => {
    const guide = live.guide.get(slug)!;
    return coverCandidates('guide', { id: slug, title: guide.title, category: guide.category });
  };
  const medicare = candidates('bay-area-medicare-hicap-medi-cal-guide');
  const dental = candidates('bay-area-dental-care-insurance-low-cost-guide');
  assert.equal(medicare[0], 'stock-guide-health-3');
  assert.equal(dental[0], 'stock-guide-health-2');
  assert.ok(!medicare.includes('stock-guide-health-2'), 'no dental chair on the Medicare guide');
  assert.ok(!dental.includes('stock-guide-health-3'), 'no pills on the dental guide');
  for (const [slug, key] of [['bay-area-medicare-hicap-medi-cal-guide', 'stock-guide-health-3'], ['bay-area-dental-care-insurance-low-cost-guide', 'stock-guide-health-2']]) {
    const cover = (live.guide.get(slug) as unknown as { covers: Record<string, { src: string }> }).covers['zh-Hans'];
    assert.ok(cover.src.endsWith(`/${key}.webp`), `${slug}: its built cover is ${key}`);
  }
});
