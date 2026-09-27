import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Lane P (wave 4, W4-P2 / W4-P3): the attraction list (data/sf/attractions.ts) against its source
 * docs/opus-bay/sf-w4-attractions.json and the published city; the extra place rows and the place fixes
 * (data/sf/extraPlaces.ts); the sidecar's pure delta (scripts/opus-sf/lib/placesW4.ts).
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const { ATTRACTIONS, ATTRACTION_INDEX, AttractionIndex, FLAG_TOPS, T1_IDS, attractionGlyph, attractionColor, attractionShort, byMapPriority, flagFor, nearStops, placeTier, withNearStops } =
  await import('../src/opus-bay/data/sf/attractions');
const { ATTRACTION_CATS, ATTRACTION_CAT_STYLE, ATTRACTION_AREAS, ATTRACTION_FLAG_H, ATTRACTION_GLYPHS, ATTRACTION_TREATMENTS } = await import('../src/opus-bay/data/sf/attractionTypes');
const { EXTRA_PLACES, EXTRA_PLACE_SNAPS, PLACE_NAME_FIXES, PLACE_REANCHORS, PLACE_KIND_FIXES, PLACE_HIDDEN, applyW4Places, extraRow } = await import('../src/opus-bay/data/sf/extraPlaces');
const { SF_PLACE_KINDS_W4 } = await import('../src/opus-bay/world/sf/format');
const { MAP_FRAME } = await import('../src/opus-bay/data/mapPaper');
const { SF_LANDMARK_INFO } = await import('../src/opus-bay/data/sf/landmarks');

type Json = { attractions: { id: string; zh: string; en: string; mapRank: number; treatment: string; priority: number; site: string; x: number; z: number; arrival: { x: number; z: number }; placeId: string | null; inHeroSlab: boolean; sources: string[] }[] };
const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/opus-bay/sf-w4-attractions.json'), 'utf8')) as Json;
const sf = sfDisk();
const places = JSON.parse(fs.readFileSync(path.join(sf.base, 'places.json'), 'utf8')) as import('../src/opus-bay/world/sf/format').PlacesFile;
const placeIds = new Set(places.places.map(p => p.id));
const photos = new Set((JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sf-landmark-photo-assets.json'), 'utf8')) as { id: string }[]).map(p => p.id));

/** zh label width in CJK cells: a CJK / full-width character is 1, anything else ½ (plan: short ≤ 5 CJK / 14 Latin). */
const cjkWidth = (s: string) => [...s].reduce((w, ch) => w + (/[⺀-鿿＀-￯]/.test(ch) ? 1 : 0.5), 0);

const T1_PLAN = ['golden-gate-bridge', 'alcatraz', 'fishermans-wharf', 'ferry-building-marketplace', 'coit-tower', 'chinatown-dragon-gate', 'lombard-crooked',
  'palace-of-fine-arts', 'golden-gate-park', 'alamo-square-painted-ladies', 'twin-peaks', 'city-hall', 'union-square', 'sutro-baths', 'sf-state-university',
  'stonestown-galleria'];

test('attractions: ids unique, 16 T1 exactly as the plan lists them, ≈ 45 T2, the rest T3', () => {
  const ids = ATTRACTIONS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  assert.equal(ATTRACTIONS.length, 158);
  assert.deepEqual([...T1_IDS].sort(), [...T1_PLAN].sort());
  const t2 = ATTRACTIONS.filter(a => a.rank === 2).length;
  assert.ok(t2 >= 40 && t2 <= 55, `T2 ${t2}`);
  assert.equal(ATTRACTIONS.filter(a => a.rank === 3).length, ATTRACTIONS.length - 16 - t2);
  // sorted by map priority, the Golden Gate Bridge first
  assert.equal(ATTRACTIONS[0].id, 'golden-gate-bridge');
  for (let i = 1; i < ATTRACTIONS.length; i++) assert.ok(byMapPriority(ATTRACTIONS[i - 1], ATTRACTIONS[i]) < 0, `order at ${ATTRACTIONS[i].id}`);
});

test('attractions: every JSON attraction is here with its names, position, map rank, treatment, priority and site', () => {
  for (const j of J.attractions) {
    const a = ATTRACTION_INDEX.get(j.id);
    assert.ok(a, `missing ${j.id}`);
    assert.deepEqual(a.name, { zh: j.zh, en: j.en }, `${j.id} name`);
    assert.ok(Math.abs(a.x - j.x) <= 0.051 && Math.abs(a.z - j.z) <= 0.051, `${j.id} position`);
    assert.equal(a.rank, j.mapRank, `${j.id} rank`);
    assert.equal(a.treatment, j.treatment, `${j.id} treatment`);
    assert.equal(a.priority, j.priority, `${j.id} priority`);
    const hero = j.inHeroSlab || j.site === 'hero' || j.site === 'hero-seam';
    assert.equal(!!a.hero, hero, `${j.id} hero`);
    if (!hero && j.site) assert.equal(a.siteId, j.site, `${j.id} site`);
    const arr = a.arrival ?? { x: a.x, z: a.z };
    assert.ok(Math.hypot(arr.x - j.arrival.x, arr.z - j.arrival.z) <= 0.55, `${j.id} arrival`);
  }
  // the 24 non-JSON rows are the existing landmarks and famous curated places, at their places.json rows
  const extra = ATTRACTIONS.filter(a => !J.attractions.some(j => j.id === a.id));
  assert.equal(extra.length, 24);
  for (const a of extra) {
    // the Golden Gate Bridge's badge stands on its south tower (the landmark's place row is the mid-span one)
    const p = places.places.find(q => q.id === (a.id === 'golden-gate-bridge' ? 'ggb-south-tower' : a.placeId));
    assert.ok(p, `${a.id} place ${a.placeId}`);
    assert.ok(Math.abs(p.x - a.x) <= 0.051 && Math.abs(p.z - a.z) <= 0.051, `${a.id} at its place`);
  }
});

test('attractions: cats, glyphs, areas, treatments, photo keys and landmark ids are valid; short names fit the map', () => {
  const lmIds = new Set(SF_LANDMARK_INFO.map(l => l.id));
  for (const a of ATTRACTIONS) {
    assert.ok((ATTRACTION_CATS as readonly string[]).includes(a.cat), `${a.id} cat`);
    assert.ok((ATTRACTION_GLYPHS as readonly string[]).includes(attractionGlyph(a)), `${a.id} glyph`);
    assert.match(attractionColor(a), /^#[0-9a-f]{6}$/);
    assert.ok(a.area && a.area in ATTRACTION_AREAS, `${a.id} area`);
    if (a.treatment) assert.ok((ATTRACTION_TREATMENTS as readonly string[]).includes(a.treatment), `${a.id} treatment`);
    if (a.photoKey) assert.ok(photos.has(a.photoKey), `${a.id} photo ${a.photoKey}`);
    if (a.landmarkId) assert.ok(lmIds.has(a.landmarkId), `${a.id} landmark ${a.landmarkId}`);
    assert.ok(a.fame !== undefined && a.fame >= 0 && a.fame <= 100, `${a.id} fame`);
    const s = attractionShort(a);
    assert.ok(cjkWidth(s.zh) <= 5, `${a.id} short zh "${s.zh}" is ${cjkWidth(s.zh)} wide`);
    assert.ok(s.en.length <= 14, `${a.id} short en "${s.en}"`);
    if (a.visitNote) { assert.ok(cjkWidth(a.visitNote.zh) <= 18, `${a.id} visitNote zh too long`); assert.ok(a.visitNote.en.length <= 60, `${a.id} visitNote en`); }
    if (a.officialUrl) assert.match(a.officialUrl, /^https:\/\//);
    for (const w of a.aliases ?? []) assert.ok(w.trim().length > 0 && w.length <= 30, `${a.id} alias "${w}"`);
    // no card-only brand rule breaks: a quiet place never gets a panorama moment
    assert.ok(!(a.quiet && a.panorama), a.id);
  }
  // the six panorama viewpoints of plan §4.2
  assert.deepEqual(ATTRACTIONS.filter(a => a.panorama).map(a => a.id).sort(),
    ['bernal-heights-park', 'coit-tower', 'corona-heights-randall-museum', 'de-young-tower', 'grand-view-park', 'twin-peaks']);
  // every category has at least one attraction (the filter chips never come up empty)
  for (const c of ATTRACTION_CATS) assert.ok(ATTRACTIONS.some(a => a.cat === c), `no ${c}`);
  assert.equal(ATTRACTION_CAT_STYLE.campus.glyph, 'GraduationCap');
});

test('attractions: every attraction stands inside the world frame; all but the islands inside the SF land frame (x −900…1100, z −100…1860)', () => {
  const islands = new Set(['alcatraz', 'treasure-island']);
  for (const a of ATTRACTIONS) {
    for (const [x, z, what] of [[a.x, a.z, 'anchor'], [a.arrival?.x ?? a.x, a.arrival?.z ?? a.z, 'arrival'], [a.flag?.x ?? a.x, a.flag?.z ?? a.z, 'flag']] as const) {
      assert.ok(x >= MAP_FRAME.minX && x <= MAP_FRAME.maxX && z >= MAP_FRAME.minZ && z <= MAP_FRAME.maxZ, `${a.id} ${what} outside MAP_FRAME`);
      if (!islands.has(a.id) || what === 'arrival') assert.ok(x >= -900 && x <= 1100 && z >= -100 && z <= 1860, `${a.id} ${what} outside the SF land frame (${x}, ${z})`);
    }
  }
});

test('attractions: every T1 / T2 has a walkable arrival (≤ 25 u from the main walking graph) or an off-walk reason, and a flag 28–70 u', async () => {
  const gi = await sf.graphIndex();
  const main = gi.mainComponent();
  const offWalk: string[] = [];
  for (const a of ATTRACTIONS) {
    if (a.rank === 3) { assert.equal(a.flag, undefined, `${a.id}: T3 has no flag`); continue; }
    assert.ok(a.flag, `${a.id} flag`);
    assert.ok(a.flag.h >= ATTRACTION_FLAG_H.min && a.flag.h <= ATTRACTION_FLAG_H.max, `${a.id} flag h ${a.flag.h}`);
    assert.ok(Math.hypot(a.flag.x - a.x, a.flag.z - a.z) <= 120, `${a.id} flag foot far from the anchor`);
    if (a.offWalk) { offWalk.push(a.id); assert.ok(a.arrival, `${a.id}: an off-walk attraction still says where the trip ends`); }
    const arr = a.arrival ?? { x: a.x, z: a.z };
    const hero = !!a.hero;
    const node = gi.nearestNode(arr.x, arr.z, 25, i => gi.component(i) === main);
    assert.ok(node >= 0 || hero || a.offWalk, `${a.id}: arrival (${arr.x}, ${arr.z}) is not walkable`);
  }
  assert.deepEqual(offWalk.sort(), ['alcatraz', 'treasure-island']);
  // placeholders are clamped, the Golden Gate Bridge flies over its south tower
  assert.equal(flagFor({ id: 'x', x: 0, z: 0, rank: 1 }, { x: { h: 200 } })!.h, 70);
  assert.equal(flagFor({ id: 'x', x: 0, z: 0, rank: 2 }, {})!.h, 30);
  assert.equal(flagFor({ id: 'x', x: 0, z: 0, rank: 3 }, {}), undefined);
  assert.deepEqual(ATTRACTION_INDEX.get('golden-gate-bridge')!.flag, { x: FLAG_TOPS['golden-gate-bridge'].x, z: FLAG_TOPS['golden-gate-bridge'].z, h: 50 });
});

test('attractions: the owner\'s campuses, Stonestown and Stern Grove exist; places resolve; one primary attraction per place', () => {
  for (const id of ['sf-state-university', 'stonestown-galleria', 'ucsf-parnassus', 'ucsf-mission-bay', 'university-of-san-francisco', 'ccsf-ocean-campus', 'stern-grove']) assert.ok(ATTRACTION_INDEX.get(id), id);
  assert.ok(ATTRACTION_INDEX.byCat('campus').length >= 9, 'campus rows');
  const extraIds = new Set(EXTRA_PLACES.map(e => e.id));
  for (const a of ATTRACTIONS) {
    assert.ok(a.placeId, `${a.id} placeId`);
    assert.ok(placeIds.has(a.placeId) || extraIds.has(a.placeId), `${a.id}: place ${a.placeId} is neither published nor extra`);
    assert.ok(!PLACE_HIDDEN.has(a.placeId), `${a.id} decorates a hidden row`);
  }
  // the landmark rows the runtime matcher uses (and whose names extraPlaces fixes)
  assert.equal(ATTRACTION_INDEX.get('sutro-baths')!.placeId, 'osm-w32776540');
  assert.equal(ATTRACTION_INDEX.get('golden-gate-bridge')!.placeId, 'ggb-deck-mid');
  // shared places: the more important attraction speaks for the place on the map
  assert.equal(ATTRACTION_INDEX.primary('japantown-peace-pagoda')!.id, 'japantown-peace-pagoda');
  assert.deepEqual(ATTRACTION_INDEX.ofPlace('japantown-peace-pagoda').map(a => a.id), ['japantown-peace-pagoda', 'japan-center']);
  assert.equal(placeTier({ id: 'ggb-deck-mid' }), 1);
  assert.equal(placeTier({ id: 'oracle-park', curated: true }), 2);
  assert.equal(placeTier({ id: 'russian-hill', curated: true }), 3);
  assert.equal(placeTier({ id: 'osm-n1' }), 4);
  const tiny = new AttractionIndex([{ id: 'a', name: { zh: '甲', en: 'A' }, cat: 'park', rank: 3, x: 0, z: 0 }]);
  assert.equal(placeTier({ id: 'a' }, tiny), 3);
});

test('attractions: nearStops measures each line\'s nearest stop within 200 u, nearest first', () => {
  const lines = [
    { id: 'n', stops: [{ id: 'n1', x: 0, z: 150 }, { id: 'n2', x: 0, z: 90 }] },
    { id: 'm', stops: [{ id: 'm1', x: 30, z: 40 }] },
    { id: 'far', stops: [{ id: 'f1', x: 500, z: 0 }] },
  ];
  assert.deepEqual(nearStops({ x: 0, z: 0 }, lines), [{ line: 'm', stop: 'm1', d: 50 }, { line: 'n', stop: 'n2', d: 90 }]);
  assert.deepEqual(nearStops({ x: 100, z: 100, arrival: { x: 0, z: 0 } }, lines, 60), [{ line: 'm', stop: 'm1', d: 50 }]);
  const sfsu = ATTRACTION_INDEX.get('sf-state-university')!;
  const withNear = withNearStops([ATTRACTIONS[0], sfsu], [{ id: 'x', stops: [{ id: 's', x: sfsu.x, z: sfsu.z + 10 }] }]);
  assert.equal(withNear[0].near, undefined);
  assert.deepEqual(withNear[1].near, [{ line: 'x', stop: 's', d: 10 }]);
  // on the published lines (the cable cars and the F-line today): Union Square is a short walk from the Powell cables
  const transit = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit.json'), 'utf8')) as { lines: { id: string; stops: { id: string; x: number; z: number }[] }[] };
  const near = nearStops(ATTRACTION_INDEX.get('union-square')!, transit.lines);
  assert.ok(near.some(s => s.line.startsWith('powell') && s.d <= 60), JSON.stringify(near));
});

test('extra places: 47 new rows, unique, not published, snapped and walkable; kinds known', () => {
  assert.equal(EXTRA_PLACES.length, 47);
  const ids = EXTRA_PLACES.map(e => e.id);
  assert.equal(new Set(ids).size, 47);
  const kinds = new Set<string>([...SF_PLACE_KINDS_W4, 'landmark', 'bridge', 'island', 'skyscraper', 'park', 'museum', 'waterfront', 'transit', 'street', 'plaza', 'civic',
    'stadium', 'historic', 'neighbourhood', 'garden', 'beach', 'trail', 'hill', 'tower', 'water', 'attraction', 'viewpoint', 'peak']);
  const newIds = new Set(J.attractions.filter(j => !j.placeId).map(j => j.id));
  for (const e of EXTRA_PLACES) {
    assert.ok(!placeIds.has(e.id), `${e.id} is already published`);
    assert.ok(newIds.has(e.id), `${e.id} is not a NEW row of the JSON`);
    assert.ok(kinds.has(e.kind), `${e.id} kind ${e.kind}`);
    assert.match(e.sourceUrl, /^https?:\/\//);
    const snap = EXTRA_PLACE_SNAPS[e.id];
    assert.ok(snap, `${e.id} snap`);
    assert.ok(snap.graphNode >= 0, `${e.id} off the walking graph`);
    assert.ok(Math.hypot(e.arrival.x - e.x, e.arrival.z - e.z) <= 30, `${e.id} arrival far from the anchor`);
    const a = ATTRACTION_INDEX.get(e.id)!;
    assert.deepEqual(e.name, a.name, `${e.id}: map name = card name`);
    assert.equal(a.placeId, e.id);
  }
  assert.equal(newIds.size, 47);
  assert.equal(EXTRA_PLACES.filter(e => e.kind === 'campus').length, 9);
  assert.deepEqual(EXTRA_PLACES.filter(e => e.kind === 'shopping').map(e => e.id), ['stonestown-galleria']);
});

test('extra places: applyW4Places hides, renames, re-anchors, re-kinds and appends (pure)', async () => {
  const before = JSON.stringify(places.places.slice(0, 50));
  const rows = applyW4Places(places);
  assert.equal(JSON.stringify(places.places.slice(0, 50)), before, 'input untouched');
  assert.equal(rows.length, places.places.length - PLACE_HIDDEN.size + EXTRA_PLACES.length);
  const by = new Map(rows.map(r => [r.id, r]));
  assert.equal(by.has('sutro-baths'), false);
  for (const [id, name] of Object.entries(PLACE_NAME_FIXES)) { assert.ok(placeIds.has(id), `name fix for a missing row ${id}`); assert.deepEqual(by.get(id)!.name, name); }
  assert.equal(by.get('ggb-deck-mid')!.name.zh, '金门大桥');
  assert.equal(by.get('osm-w32776540')!.name.en, 'Sutro Baths ruins');
  assert.ok(!/缆车/.test(by.get('cable-car-powell-market')!.name.zh) && !/缆车/.test(by.get('cable-car-museum')!.name.zh), 'glossary: 叮当车');
  for (const [id, re] of Object.entries(PLACE_REANCHORS)) {
    const r = by.get(id)!;
    assert.deepEqual(r.arrival, re.arrival);
    if (re.x !== undefined) assert.equal(r.x, re.x);
  }
  for (const [id, kind] of Object.entries(PLACE_KIND_FIXES)) assert.equal(by.get(id)!.kind, kind);
  const sfsu = by.get('sf-state-university')!;
  assert.equal(sfsu.kind, 'campus');
  assert.equal(sfsu.extra, true);
  assert.equal(sfsu.curated, true);
  assert.ok(sfsu.graphNode >= 0);
  // the re-anchored Lands End and Lake Merced arrivals are walkable
  const gi = await sf.graphIndex();
  for (const id of Object.keys(PLACE_REANCHORS)) { const a = by.get(id)!.arrival!; assert.ok(gi.nearestNode(a.x, a.z, 25) >= 0, `${id} arrival`); }
  // extraRow without a snap is honest: off the graph until the sidecar has run
  assert.equal(extraRow(EXTRA_PLACES[0]).graphNode, -1);
  // an extra whose id is taken is skipped, a hidden set is honoured
  const clash = applyW4Places({ places: [places.places[0]] }, { extras: [{ ...EXTRA_PLACES[0], id: places.places[0].id }], hidden: new Set() });
  assert.equal(clash.length, 1);
});

test('places sidecar lib: wave-4 OSM kinds, name matching, reviewed additions, stable merge keeps every index', async () => {
  const { poiKindW4, sameName, nameWords, candidateSkip, stableMerge, W4_OSM_ADDS } = await import('../scripts/opus-sf/lib/placesW4');
  assert.equal(poiKindW4({ amenity: 'university' }), 'campus');
  assert.equal(poiKindW4({ amenity: 'college' }), 'campus');
  assert.equal(poiKindW4({ shop: 'mall' }), 'shopping');
  assert.equal(poiKindW4({ tourism: 'zoo' }), 'zoo');
  assert.equal(poiKindW4({ tourism: 'museum' }), null);
  assert.deepEqual(nameWords('City College of San Francisco (CCSF) Ocean Campus'), ['city', 'college', 'ccsf', 'ocean']);
  assert.ok(sameName('City College of San Francisco (CCSF) Ocean Campus', 'City College of San Francisco · Ocean Campus'));
  assert.ok(!sameName('City College of San Francisco Mission Campus', 'City College of San Francisco · Ocean Campus'));
  assert.ok(!sameName('Greenhouse', 'Greenhouse'), 'one-word names never match');
  const extras = [{ id: 'sfsu', name: { en: 'San Francisco State University' }, osm: ['way/1'] }];
  assert.match(candidateSkip({ key: 'way/9', name: 'X Y' }, extras, [])!, /reviewed/);
  assert.equal(candidateSkip({ key: 'way/1', name: 'Anything' }, extras, [], null), 'is extra sfsu');
  assert.match(candidateSkip({ key: 'way/2', name: 'San Francisco State University' }, extras, [], null)!, /same name as extra/);
  assert.match(candidateSkip({ key: 'way/3', name: 'Golden Gate University' }, extras, [{ name: 'Golden Gate University' }], null)!, /same name as/);
  assert.equal(candidateSkip({ key: 'way/301548804', name: 'Golden Gate University' }, extras, []), null);
  assert.ok(Object.keys(W4_OSM_ADDS).every(k => /^(node|way|relation)\/\d+$/.test(k)));
  // stable merge: indices, geometry and sources of published rows never move; kinds may; additions append
  const pub = places.places.slice(0, 5);
  const rebuilt = pub.map((p, i) => ({ ...p, x: p.x + (i === 2 ? 1 : 0) })).reverse();
  const add = { ...pub[0], id: 'osm-w999', osmId: 999 };
  const { places: out, diff } = stableMerge(pub, rebuilt, [add], r => (r.id === pub[1].id ? 'campus' : r.kind));
  assert.deepEqual(out.map(p => p.id), [...pub.map(p => p.id), 'osm-w999']);
  assert.equal(out[2].x, pub[2].x, 'published geometry kept');
  assert.deepEqual(diff.drift.map(d => `${d.id}.${d.field}`), [`${pub[2].id}.x`]);
  assert.deepEqual(diff.kindChanges, [{ id: pub[1].id, from: pub[1].kind, to: 'campus' }]);
  assert.deepEqual(diff.added, ['osm-w999']);
  assert.deepEqual(stableMerge(pub, pub.slice(1), []).diff.lost, [pub[0].id]);
  assert.throws(() => stableMerge(pub, pub, [pub[0]]), /not new/);
});

test('search: every alias finds its attraction; the plan\'s queries rank as asked (大学 / 石镇 / SFSU / UCSF / N 线 / muni)', async () => {
  const { prepareSearch, rankSearch, groupHits, attractionEntries, lineEntries, stationEntries, placeEntries, SEARCH_SUGGESTIONS, normalizeSearch } = await import('../src/opus-bay/data/sf/placeSearch');
  const { LINE_STYLES, mapStations } = await import('../src/opus-bay/ui/mapLines');
  const w4 = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit-w4.json'), 'utf8')) as { lines: import('../src/opus-bay/world/sf/format').TransitLine[] };
  const stations = mapStations(w4.lines);
  const rows = applyW4Places(places);
  const covered = new Set(ATTRACTIONS.map(a => a.placeId ?? a.id));
  const ix = prepareSearch([...attractionEntries(ATTRACTIONS), ...lineEntries(Object.values(LINE_STYLES)), ...stationEntries(stations), ...placeEntries(rows, covered)]);
  const ids = (q: string, n = 5) => rankSearch(ix, q, n).map(h => h.entry.id);
  const t0 = performance.now();
  for (let k = 0; k < 20; k++) rankSearch(ix, k % 2 ? '金门' : 'stones');
  const perQuery = (performance.now() - t0) / 20;
  assert.ok(perQuery < 25, `${perQuery.toFixed(1)} ms per keystroke`);
  for (const a of ATTRACTIONS) for (const w of a.aliases ?? []) assert.ok(ids(w, 80).includes(a.id), `alias "${w}" does not find ${a.id}`);
  for (const a of ATTRACTIONS) assert.ok(ids(a.name.zh, 3).includes(a.id), `zh name finds ${a.id}`);
  // 大学: ≥ 4 campuses, SF State first
  const uni = rankSearch(ix, '大学', 12);
  assert.equal(uni[0].entry.id, 'sf-state-university');
  assert.ok(uni.filter(h => h.entry.cat === 'campus').length >= 4);
  assert.equal(rankSearch(ix, 'university', 3)[0].entry.id, 'sf-state-university');
  for (const q of ['石镇', '石头城', 'Stonestown', 'stonestown galleria', '商场']) assert.equal(ids(q)[0], 'stonestown-galleria', q);
  for (const q of ['SF State', 'SFSU', '州大', '旧金山州立', 'sf state']) assert.equal(ids(q)[0], 'sf-state-university', q);
  assert.deepEqual(ids('UCSF', 2).sort(), ['ucsf-mission-bay', 'ucsf-parnassus']);
  assert.deepEqual(ids('加大旧金山', 2).sort(), ['ucsf-mission-bay', 'ucsf-parnassus']);
  for (const q of ['N 线', 'N线', 'n judah']) assert.equal(ids(q)[0], 'n-judah', q);
  for (const q of ['muni', '地铁', '轻轨']) assert.deepEqual(ids(q, 2).sort(), ['m-ocean-view', 'n-judah'], q);
  assert.equal(ids('观光巴士')[0], 'sf-loop');
  assert.equal(ids('金门大桥')[0], 'golden-gate-bridge');
  assert.deepEqual(ids('叮当车', 3).sort(), ['california', 'powell-hyde', 'powell-mason'], 'the cable lines answer 叮当车 first');
  assert.ok(ids('叮当车', 6).includes('cable-car-powell-market') && ids('叮当车', 6).includes('cable-car-museum'));
  assert.ok(ids('卡斯特罗站', 3).includes('muni-castro'));
  assert.ok(ids('Embarcadero', 5).includes('muni-embarcadero'));
  // groups in the order 景点 / 车站 / 线路 / 地点
  const g = groupHits(rankSearch(ix, 'castro', 30)).map(x => x.group);
  assert.deepEqual(g, [...g].sort((a, b) => ['attraction', 'station', 'line', 'place'].indexOf(a) - ['attraction', 'station', 'line', 'place'].indexOf(b)));
  assert.ok(g.includes('attraction') && g.includes('station'));
  // every suggestion finds something, empty queries find nothing
  for (const s of SEARCH_SUGGESTIONS) { assert.ok(rankSearch(ix, s.zh, 1).length === 1, s.zh); assert.ok(rankSearch(ix, s.en, 1).length === 1, s.en); }
  assert.deepEqual(rankSearch(ix, '  '), []);
  assert.equal(normalizeSearch('Fisherman’s Wharf'), 'fishermanswharf');
  // hidden rows are not searchable, the fixed names are
  assert.ok(!ids('Main pool house', 30).includes('osm-w32776540'));
  assert.equal(ids('苏特罗浴场', 1)[0], 'sutro-baths');
});

test('attractions: withSiteFlags takes lane L\'s poles (by id, then place id), clamps them, leaves T3 alone', async () => {
  const { withSiteFlags } = await import('../src/opus-bay/data/sf/attractions');
  const tops: Record<string, { x: number; z: number; h: number }> = { 'sf-state-university': { x: 1, z: 2, h: 44 }, 'ggb-deck-mid': { x: 3, z: 4, h: 99 }, 'bison-paddock': { x: 0, z: 0, h: 40 } };
  const out = withSiteFlags(ATTRACTIONS, ref => tops[ref] ?? null);
  const by = new Map(out.map(a => [a.id, a]));
  assert.deepEqual(by.get('sf-state-university')!.flag, { x: 1, z: 2, h: 44 });
  assert.deepEqual(by.get('golden-gate-bridge')!.flag, { x: 3, z: 4, h: 70 }, 'by place id, clamped');
  assert.equal(by.get('bison-paddock')!.flag, undefined, 'T3 has no flag');
  assert.deepEqual(by.get('alcatraz')!.flag, ATTRACTION_INDEX.get('alcatraz')!.flag, 'no pole: the placeholder stays');
  // lane L's real function answers for the sites it has built (world/sf/landmarks/w4sites.ts)
  const { siteFlagTop } = await import('../src/opus-bay/world/sf/landmarks/w4sites');
  const real = withSiteFlags(ATTRACTIONS, siteFlagTop);
  for (const a of real) if (a.flag) assert.ok(a.flag.h >= 28 && a.flag.h <= 70, a.id);
  assert.ok(real.filter(a => a.flag && JSON.stringify(a.flag) !== JSON.stringify(ATTRACTION_INDEX.get(a.id)!.flag)).length >= 2, 'L already answers for some attractions');
});
