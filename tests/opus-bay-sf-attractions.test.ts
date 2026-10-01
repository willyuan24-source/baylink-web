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
const { ATTRACTIONS, ATTRACTION_INDEX, AttractionIndex, FLAG_TOPS, T1_IDS, attractionGlyph, attractionColor, attractionShort, byMapPriority, flagFor, nearStops, placeTier, withNearStops,
  LANDMARK_ARRIVALS, BADGE_ALSO_COVERS, coveredPlaceIds, ARRIVAL_OVERRIDES, ARRIVAL_PLACES, tripDestination, siteArrivalFor, SITE_ARRIVAL_IDS } = await import('../src/opus-bay/data/sf/attractions');
const { ATTRACTION_CATS, ATTRACTION_CAT_STYLE, ATTRACTION_AREAS, ATTRACTION_FLAG_H, ATTRACTION_GLYPHS, ATTRACTION_TREATMENTS } = await import('../src/opus-bay/data/sf/attractionTypes');
const { EXTRA_PLACES, EXTRA_PLACE_SNAPS, PLACE_NAME_FIXES, PLACE_REANCHORS, PLACE_KIND_FIXES, PLACE_HIDDEN, applyW4Places, extraRow, attractionArrivals, RUNTIME_PLACES, ARRIVAL_PLACE_ROWS, siteArrivalRows, overrideArrivalRows } = await import('../src/opus-bay/data/sf/extraPlaces');
const { SF_PLACE_KINDS_W4 } = await import('../src/opus-bay/world/sf/format');
const { MAP_FRAME } = await import('../src/opus-bay/data/mapPaper');
const { SF_LANDMARK_INFO } = await import('../src/opus-bay/data/sf/landmarks');

type Json = { attractions: { id: string; zh: string; en: string; mapRank: number; treatment: string; priority: number; site: string; x: number; z: number; arrival: { x: number; z: number }; placeId: string | null; inHeroSlab: boolean; sources: string[] }[] };
const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/opus-bay/sf-w4-attractions.json'), 'utf8')) as Json;
const sf = sfDisk();
const places = JSON.parse(fs.readFileSync(path.join(sf.base, 'places.json'), 'utf8')) as import('../src/opus-bay/world/sf/format').PlacesFile;
const placeIds = new Set(places.places.map(p => p.id));
const photos = new Set((JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sf-landmark-photo-assets.json'), 'utf8')) as { id: string }[]).map(p => p.id));
/**
 * Lane T's wave-4 lines (sf-loop, N, M): from transit.json once lane T publishes them there (its integration step 1),
 * else from the early-phase transit-w4.json.
 */
function w4TransitLines(): import('../src/opus-bay/world/sf/format').TransitLine[] {
  const main = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit.json'), 'utf8')) as { lines: import('../src/opus-bay/world/sf/format').TransitLine[] };
  const inMain = main.lines.filter(l => l.kind === 'bus' || l.kind === 'light-rail');
  if (inMain.length) return inMain;
  return (JSON.parse(fs.readFileSync(path.join(sf.base, 'transit-w4.json'), 'utf8')) as { lines: import('../src/opus-bay/world/sf/format').TransitLine[] }).lines;
}

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
    // the existing landmarks arrive at the landmark's walkable anchor (LANDMARK_ARRIVALS, review fix); the scouting's
    // point is a sanity bound there, the exact spot everywhere else, except the arrivals moved on purpose (ARRIVAL_OVERRIDES)
    const moved = ARRIVAL_OVERRIDES[j.id];
    // (W5-N5) lane L's site arrivals (data/sf/siteArrivals.ts: the trip end out of a blocker / a driven lane / onto the
    // graph; McLaren's La Grande about 100 u from the scouting's point)
    const site = siteArrivalFor(j.id);
    if (moved) { assert.deepEqual({ x: arr.x, z: arr.z }, { x: moved.x, z: moved.z }, `${j.id} moved arrival`); assert.ok(Math.hypot(arr.x - j.arrival.x, arr.z - j.arrival.z) <= 70, `${j.id} moved arrival far from the scouting's`); }
    else if (a.landmarkId) assert.ok(Math.hypot(arr.x - j.arrival.x, arr.z - j.arrival.z) <= 20, `${j.id} landmark arrival far from the scouting's`);
    else if (site) { assert.deepEqual(a.arrival, { x: site.x, z: site.z, heading: site.heading }, `${j.id} site arrival`); assert.ok(Math.hypot(arr.x - j.arrival.x, arr.z - j.arrival.z) <= 120, `${j.id} site arrival far from the scouting's`); }
    else assert.ok(Math.hypot(arr.x - j.arrival.x, arr.z - j.arrival.z) <= 0.55, `${j.id} arrival`);
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

test('attractions: every arrival is walkable (≤ 25 u from the main walking graph) or has an off-walk reason; every T1 / T2 has a flag 28–70 u', async () => {
  const gi = await sf.graphIndex();
  const main = gi.mainComponent();
  const offWalk: string[] = [];
  for (const a of ATTRACTIONS) {
    if (a.rank === 3) {
      assert.equal(a.flag, undefined, `${a.id}: T3 has no flag`);
      const arr3 = a.arrival ?? { x: a.x, z: a.z };
      // T3 trips end there too (跟 BAYBAY 去 works for every attraction)
      assert.ok(gi.nearestNode(arr3.x, arr3.z, 25, i => gi.component(i) === main) >= 0 || a.hero, `${a.id}: T3 arrival (${arr3.x}, ${arr3.z}) is not walkable`);
      continue;
    }
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
  assert.equal(rows.length, places.places.length - PLACE_HIDDEN.size + RUNTIME_PLACES.length);
  assert.equal(RUNTIME_PLACES.length, EXTRA_PLACES.length + 2, 'the 47 extras + the two named arrival places');
  const by = new Map(rows.map(r => [r.id, r]));
  assert.equal(by.has('sutro-baths'), false);
  for (const [id, name] of Object.entries(PLACE_NAME_FIXES)) { assert.ok(placeIds.has(id), `name fix for a missing row ${id}`); assert.deepEqual(by.get(id)!.name, name); }
  assert.equal(by.get('ggb-deck-mid')!.name.zh, '金门大桥');
  assert.equal(by.get('osm-w32776540')!.name.en, 'Sutro Baths ruins');
  assert.ok(!/缆车/.test(by.get('cable-car-powell-market')!.name.zh) && !/缆车/.test(by.get('cable-car-museum')!.name.zh), 'glossary: 叮当车');
  for (const [id, re] of Object.entries(PLACE_REANCHORS)) {
    const r = by.get(id)!;
    assert.deepEqual({ x: r.arrival!.x, z: r.arrival!.z }, re.arrival);
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
  const { poiKindW4, sameName, nameWords, candidateSkip, stableMerge, W4_OSM_ADDS, W4_OSM_ZH } = await import('../scripts/opus-sf/lib/placesW4');
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
  // every reviewed addition has a Chinese name (OSM has none: the zh UI would show the long English one)
  for (const k of Object.keys(W4_OSM_ADDS)) assert.match(W4_OSM_ZH[k] ?? '', /[一-鿿]/, k);
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

test('places.json (published, wave 4): lib/places.ts poiKind takes the wave-4 kinds, only reviewed new rows; the 6 reviewed campuses are in with zh names, the zoo row is kind zoo, every older row keeps its index', async () => {
  const { poiKind, takesPoi } = await import('../scripts/opus-sf/lib/places');
  const { W4_OSM_ADDS, W4_OSM_ZH } = await import('../scripts/opus-sf/lib/placesW4');
  assert.equal(poiKind({ amenity: 'university' }), 'campus');
  assert.equal(poiKind({ shop: 'mall', tourism: 'attraction' }), 'shopping', 'the wave-4 rule first');
  assert.equal(poiKind({ tourism: 'zoo' }), 'zoo');
  assert.equal(poiKind({ tourism: 'viewpoint' }), 'viewpoint');
  assert.equal(poiKind({ amenity: 'bank' }), null);
  assert.equal(takesPoi({ tourism: 'zoo' }, 'way/1'), true, 'a POI the wave-2 rules took keeps its row');
  assert.equal(takesPoi({ amenity: 'university' }, 'way/1'), false, 'an unreviewed campus is not added');
  assert.equal(takesPoi({ amenity: 'university' }, 'way/301548804'), true);
  // the published file: v1's 1,027 rows first (the chunks reference them by index), then the reviewed additions
  assert.equal(places.places.length, 1033);
  const added = places.places.slice(1027);
  assert.deepEqual(added.map(p => `${p.osmType}/${p.osmId}`).sort(), Object.keys(W4_OSM_ADDS).filter(k => k !== 'way/392375234').sort());
  for (const p of added) {
    assert.equal(p.kind, 'campus', p.id);
    assert.equal(p.name.zh, W4_OSM_ZH[`${p.osmType}/${p.osmId}`], p.id);
    assert.ok(p.graphNode >= 0, `${p.id} on the walking graph`);
    assert.ok(p.sourceUrl.startsWith('https://www.openstreetmap.org/'), p.id);
  }
  assert.equal(places.places.find(p => p.id === 'osm-w1501253434')!.kind, 'zoo');
  // the one reviewed campus the build does not add (CCSF North Beach / Chinatown, 808 Kearny St): the build's duplicate
  // rule drops it for the Chinatown neighbourhood row within 40 u (osm-n3639535348: its name is in the campus's); the
  // sidecar reports it (places-diff.json `skipped`)
  assert.ok(!places.places.some(p => p.osmId === 392375234));
  assert.ok(places.places.some(p => p.id === 'osm-n3639535348'));
});

test('search: every alias finds its attraction; the plan\'s queries rank as asked (大学 / 石镇 / SFSU / UCSF / N 线 / muni)', async () => {
  const { prepareSearch, rankSearch, groupHits, attractionEntries, lineEntries, stationEntries, placeEntries, SEARCH_SUGGESTIONS, normalizeSearch } = await import('../src/opus-bay/data/sf/placeSearch');
  const { LINE_STYLES, mapStations } = await import('../src/opus-bay/ui/mapLines');
  const w4 = { lines: w4TransitLines() };
  const stations = mapStations(w4.lines);
  const rows = applyW4Places(places);
  const covered = new Set(ATTRACTIONS.map(a => a.placeId ?? a.id));
  const ix = prepareSearch([...attractionEntries(ATTRACTIONS), ...lineEntries(Object.values(LINE_STYLES)), ...stationEntries(stations), ...placeEntries(rows, covered)]);
  const ids = (q: string, n = 5) => rankSearch(ix, q, n).map(h => h.entry.id);
  // per keystroke: the best of 5 batches (the suite runs files in parallel on a shared machine: wall-clock noise)
  let perQuery = Infinity;
  for (let b = 0; b < 5; b++) {
    const t0 = performance.now();
    for (let k = 0; k < 10; k++) rankSearch(ix, k % 2 ? '金门' : 'stones');
    perQuery = Math.min(perQuery, (performance.now() - t0) / 10);
  }
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

test('attractions: the 24 landmark attractions arrive at the landmark\'s walkable anchor (LANDMARK_ARRIVALS = sfLandmarkAnchor)', async () => {
  const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  const withLm = ATTRACTIONS.filter(a => a.landmarkId);
  assert.equal(withLm.length, 24);
  assert.deepEqual(Object.keys(LANDMARK_ARRIVALS).sort(), withLm.map(a => a.landmarkId!).sort(), 'one arrival per landmark attraction');
  const stale: string[] = [];
  for (const a of withLm) {
    const anc = sfLandmarkAnchor(a.landmarkId!);
    assert.ok(anc, `${a.landmarkId} has no anchor`);
    const want = LANDMARK_ARRIVALS[a.landmarkId!];
    // the attraction arrives there unless its arrival was moved on purpose (ARRIVAL_OVERRIDES: the bridge)
    if (!ARRIVAL_OVERRIDES[a.id]) assert.deepEqual(a.arrival, want);
    const arr = want;
    if (Math.hypot(arr.x - anc.x, arr.z - anc.z) > 0.05 || Math.abs((arr.heading ?? 0) - anc.heading) > 0.002)
      stale.push(`  '${a.landmarkId}': { x: ${+anc.x.toFixed(2)}, z: ${+anc.z.toFixed(2)}, heading: ${+anc.heading.toFixed(3)} },`);
  }
  assert.equal(stale.length, 0, `a landmark anchor moved: update LANDMARK_ARRIVALS in data/sf/attractions.ts:\n${stale.join('\n')}`);
  // the Golden Gate Bridge's badge stays on the south tower; the trip and the arrival moment end at the Welcome Center
  const ggb = ATTRACTION_INDEX.get('golden-gate-bridge')!;
  assert.ok(Math.hypot(ggb.arrival!.x - ggb.x, ggb.arrival!.z - ggb.z) > 90);
  assert.deepEqual({ x: ggb.arrival!.x, z: ggb.arrival!.z }, { x: ARRIVAL_OVERRIDES['golden-gate-bridge'].x, z: ARRIVAL_OVERRIDES['golden-gate-bridge'].z });
});

test('attractions × place index: a trip to the place an attraction speaks for ends inside its arrival radius (the integration\'s index)', async () => {
  const { buildPlaceIndex, landmarkInputsFrom, poiInputs } = await import('../src/opus-bay/data/sf/places');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  const { sfLandmarkInfo } = await import('../src/opus-bay/data/sf/landmarks');
  const rows = applyW4Places(places);
  const ix = buildPlaceIndex({ places: rows as typeof places.places }, landmarkInputsFrom(SF_LANDMARKS, sfLandmarkInfo, sfLandmarkAnchor), poiInputs());
  const rowById = new Map(rows.map(r => [r.id, r]));
  // the integration's buildPlaceIndex (lane P2 correction): arrival = the wave-4 row's arrival when it has one (every
  // landmark row carries its attraction's: the landmark anchor for 23, the Welcome Center for the bridge), else the
  // landmark anchor, else the anchor
  const placeArrival = (id: string) => { const p = ix.get(id)!; return rowById.get(id)!.arrival ?? (p.landmark ? p.arrival : { x: p.x, z: p.z }); };
  // the 23 landmark rows the override does not touch: the row's arrival IS the landmark anchor (the rule changes nothing there)
  for (const a of ATTRACTIONS) if (a.landmarkId && !ARRIVAL_OVERRIDES[a.id]) { const p = ix.get(a.placeId!)!, r = rowById.get(a.placeId!)!.arrival!; assert.ok(Math.hypot(p.arrival.x - r.x, p.arrival.z - r.z) <= 0.05, a.id); }
  const arrivals = attractionArrivals();
  let checked = 0;
  for (const a of ATTRACTIONS) {
    const pid = a.placeId ?? a.id;
    const p = ix.get(pid);
    assert.ok(p, `${a.id}: place ${pid} is not in the index`);
    // the matcher picks exactly the landmark rows the attractions name
    if (a.landmarkId) assert.equal(ix.landmark(a.landmarkId)?.id, pid, `${a.id}: the landmark matcher picks another row`);
    if (ATTRACTION_INDEX.primary(pid) !== a) continue;
    const want = a.arrival ?? { x: a.x, z: a.z }, got = placeArrival(pid);
    assert.ok(Math.hypot(want.x - got.x, want.z - got.z) <= 1, `${a.id}: the place's trips end ${Math.hypot(want.x - got.x, want.z - got.z).toFixed(1)} u from the attraction's arrival`);
    assert.deepEqual(arrivals[pid] && { x: arrivals[pid].x, z: arrivals[pid].z }, { x: want.x, z: want.z });
    checked++;
  }
  assert.ok(checked >= 150, `${checked} primary attractions checked`);
  // the re-anchors agree with the attractions they serve
  for (const [id, re] of Object.entries(PLACE_REANCHORS)) { const a = ATTRACTION_INDEX.primary(id)!; assert.deepEqual(re.arrival, { x: a.arrival!.x, z: a.arrival!.z }, id); }
  // extra rows: the attraction's arrival too (≤ 1 u: the scouting rounded them separately); a site arrival (W5-N5)
  // replaces the extra's own at runtime (applyW4Places: siteArrivalRows)
  const siteRows = siteArrivalRows(), movedRows = new Set([...siteRows, ...overrideArrivalRows()]);
  // (part c: a moved trip end — ARRIVAL_OVERRIDES — replaces an extra row's own the same way)
  for (const e of EXTRA_PLACES) {
    const a = ATTRACTION_INDEX.get(e.id)!, w = a.arrival ?? { x: a.x, z: a.z };
    if (movedRows.has(e.id)) { const r = rowById.get(e.id)!; assert.deepEqual({ x: r.arrival!.x, z: r.arrival!.z }, { x: w.x, z: w.z }, `${e.id} runtime row at the site arrival`); continue; }
    assert.ok(Math.hypot(w.x - e.arrival.x, w.z - e.arrival.z) <= 1, e.id);
  }
  assert.equal(siteRows.size, SITE_ARRIVAL_IDS.length - 1, 'every site arrival names a primary attraction but Japan Center (the Peace Pagoda row speaks for it)');
});

test('attractions: no second dot under a badge — the south-tower row is covered; no other uncovered curated row within 2 u of an attraction', () => {
  const covered = coveredPlaceIds();
  for (const ids of Object.values(BADGE_ALSO_COVERS)) for (const id of ids) { assert.ok(placeIds.has(id), id); assert.ok(covered.has(id), id); }
  assert.ok(covered.has('ggb-south-tower') && covered.has('ggb-deck-mid'));
  const rows = applyW4Places(places);
  for (const r of rows) {
    if (covered.has(r.id) || !r.curated) continue;
    for (const a of ATTRACTIONS) assert.ok(Math.hypot(r.x - a.x, r.z - a.z) > 2, `${r.id} sits under the ${a.id} badge: add it to BADGE_ALSO_COVERS`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Lane P2 (wave 4, early phase part 2): the open place items of lane P's and lane G's early reviews
// ---------------------------------------------------------------------------------------------------------------------

test('P2: moved arrivals are walkable and their place rows end travel there; the Botanical Garden row stands at its main gate (lane L2)', async () => {
  const gi = await sf.graphIndex();
  const main = gi.mainComponent();
  const rows = applyW4Places(places);
  const by = new Map(rows.map(r => [r.id, r]));
  assert.ok(Object.keys(ARRIVAL_OVERRIDES).length >= 1);
  for (const [id, o] of Object.entries(ARRIVAL_OVERRIDES)) {
    const a = ATTRACTION_INDEX.get(id)!;
    assert.ok(a, id);
    assert.deepEqual(a.arrival, { x: o.x, z: o.z, ...(o.heading !== undefined ? { heading: o.heading } : {}) }, `${id}: the override is the arrival`);
    // (wave 5: Lombard's graph runs down the crooked block's lane; the top's sidewalk, where its trip now ends, is ≤ 6 u off it)
    // (wave 8, W8-W1: the O'Brien's promenade by Pier 35 has no graph node within 3 u — the nodes beside it run under
    // the Embarcadero roadway, not standable — so its end is 9.8 u from the nearest standable node, which the static
    // sweep's nav path reaches it from; a waiver, recorded in docs/opus-bay/sf-w8-W1.md part b)
    const graphR = id === 'lombard-crooked' ? 6 : id === 'ss-jeremiah-obrien' ? 10 : 3;
    assert.ok(gi.nearestNode(o.x, o.z, graphR, i => gi.component(i) === main) >= 0, `${id}: moved arrival within ${graphR} u of the main walking graph`);
    const row = by.get(a.placeId!)!;
    assert.deepEqual({ x: row.arrival!.x, z: row.arrival!.z }, { x: o.x, z: o.z }, `${id}: its place row ends travel there`);
    assert.equal(row.arrival!.heading, o.heading, `${id}: and faces the same way`);
    assert.ok(o.why.length > 10, id);
  }
  // the San Francisco Botanical Garden: row anchor + arrival at OSM node 7838369891 (entrance=main), badge at the centre
  const { projectCity } = await import('../src/opus-bay/core/geo');
  const gate = projectCity(37.767047, -122.4667863);
  const bg = by.get('osm-w120480164')!;
  assert.ok(Math.hypot(gate.x - bg.x, gate.z - bg.z) < 0.5, `row at the gate (${bg.x}, ${bg.z})`);
  assert.ok(Math.hypot(gate.x - bg.arrival!.x, gate.z - bg.arrival!.z) < 0.5);
  const garden = ATTRACTION_INDEX.get('sf-botanical-garden')!;
  assert.equal(garden.placeId, 'osm-w120480164');
  assert.ok(Math.hypot(garden.x - bg.x, garden.z - bg.z) > 50, 'the badge stays at the garden centre (the JSON point)');
  assert.ok(Math.hypot(garden.arrival!.x - gate.x, garden.arrival!.z - gate.z) < 0.5, 'the attraction arrives at the gate');
});

test('P2: Clement St is 克莱门街 (企李街 is Clay St in Chinatown) in the list, the extra row, the JSON and the plan', () => {
  const a = ATTRACTION_INDEX.get('clement-street')!;
  assert.match(a.name.zh, /^克莱门街/);
  assert.equal(a.short!.zh, '克莱门街');
  assert.ok(a.aliases!.includes('克莱门街'));
  for (const x of ATTRACTIONS) assert.ok(![x.name.zh, x.short?.zh ?? '', ...(x.aliases ?? [])].some(s => s.includes('企李')), `${x.id} says 企李街`);
  assert.deepEqual(EXTRA_PLACES.find(e => e.id === 'clement-street')!.name, a.name);
  assert.equal(J.attractions.find(j => j.id === 'clement-street')!.zh, a.name.zh);
  assert.ok(!fs.readFileSync(path.join(ROOT, 'docs/opus-bay/sf-w4-plan.md'), 'utf8').includes('企李街'), 'plan §2.4 row 59');
});

test('P2: the Golden Gate Bridge arrives at the Welcome Center, the loop stop "金门大桥 · 游客中心" serves it and lane G\'s planner offers the loop (review G O1)', async () => {
  const { planTrips } = await import('../src/opus-bay/game/tripPlan');
  const { transitTripLine } = await import('../src/opus-bay/game/tripProviders');
  const w4 = { lines: w4TransitLines() };
  const ggb = ATTRACTION_INDEX.get('golden-gate-bridge')!;
  const arr = ggb.arrival!;
  const loop = w4.lines.find(l => l.id === 'sf-loop')!;
  const stop = loop.stops.find(s => s.id === 'loop-golden-gate-bridge')!;
  assert.ok(Math.hypot(stop.x - arr.x, stop.z - arr.z) <= 30, `the loop stop is ${Math.hypot(stop.x - arr.x, stop.z - arr.z).toFixed(1)} u away`);
  assert.equal(stop.name.zh, '金门大桥 · 游客中心');
  const wc = places.places.find(p => p.id === 'osm-w164569681')!;
  assert.equal(wc.name.en, 'Welcome Center');
  assert.ok(Math.hypot(wc.x - arr.x, wc.z - arr.z) <= 3, 'at the OSM Welcome Center');
  // facing the south tower (the badge)
  const face = Math.atan2(ggb.x - arr.x, ggb.z - arr.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(face - arr.heading!), Math.cos(face - arr.heading!))) < 0.1, 'faces the south tower');
  // the place row the bridge speaks for (ggb-deck-mid) ends travel there
  const row = applyW4Places(places).find(r => r.id === 'ggb-deck-mid')!;
  assert.deepEqual(row.arrival, arr);
  // lane G's planner, from the Ferry Building with the published lines: a loop option alighting at the bridge stop
  const lines = () => w4.lines.map(transitTripLine);
  const from = { x: 133, z: 10 };
  const opts = planTrips(from, tripDestination(ggb), { lines });
  const ride = opts.find(o => o.mode === 'line' && o.legs.some(l => l.via === 'line' && l.line === 'sf-loop'));
  assert.ok(ride, `no loop option: ${opts.map(o => o.mode).join(', ')}`);
  const leg = ride.legs.find(l => l.via === 'line')!;
  assert.equal(leg.via === 'line' && leg.alight, 'loop-golden-gate-bridge');
  // the old destination (mid-span) had none: the reason for the move
  const mid = places.places.find(p => p.id === 'ggb-deck-mid')!;
  assert.ok(!planTrips(from, { placeId: 'ggb-deck-mid', x: mid.x, z: mid.z }, { lines }).some(o => o.mode === 'line' && o.legs.some(l => l.via === 'line' && l.line === 'sf-loop')));
});

test('P2: Corona Heights arrives at its summit (the panorama point), not at the Randall Museum door (review G O3)', async () => {
  const { projectCity } = await import('../src/opus-bay/core/geo');
  const a = ATTRACTION_INDEX.get('corona-heights-randall-museum')!;
  assert.equal(a.panorama, true);
  const summit = projectCity(37.76465, -122.43914), museum = projectCity(37.76439, -122.43813);
  assert.ok(Math.hypot(a.arrival!.x - summit.x, a.arrival!.z - summit.z) <= 8, 'at the summit');
  assert.ok(Math.hypot(a.arrival!.x - museum.x, a.arrival!.z - museum.z) >= 12, 'away from the museum door');
  // the highest walkable ground around: no main-graph node within 25 u stands higher than 0.5 u above the arrival's
  const gi = await sf.graphIndex();
  const main = gi.mainComponent();
  const node = gi.nearestNode(a.arrival!.x, a.arrival!.z, 3, i => gi.component(i) === main);
  assert.ok(node >= 0);
  const y0 = gi.graph.xyz[3 * node + 1];
  gi.forNodesNear(a.arrival!.x, a.arrival!.z, 25, i => { if (gi.component(i) === main) assert.ok(gi.graph.xyz[3 * i + 1] <= y0 + 0.5, `node ${i} is higher than the summit arrival`); });
  // the curated hill row it decorates arrives there too (the panorama fires where 跟 BAYBAY 去 ends)
  const row = applyW4Places(places).find(r => r.id === a.placeId)!;
  assert.deepEqual(row.arrival, a.arrival);
});

test('P2: the islands\' trips end at named places of their own (恶魔岛渡轮码头 · 33 号码头, 14 号码头), with the district POIs merged (review G O2)', async () => {
  const { planTrips } = await import('../src/opus-bay/game/tripPlan');
  const { buildPlaceIndex, landmarkInputsFrom, poiInputs } = await import('../src/opus-bay/data/sf/places');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  const { sfLandmarkInfo } = await import('../src/opus-bay/data/sf/landmarks');
  assert.deepEqual(Object.keys(ARRIVAL_PLACES).sort(), ['alcatraz', 'treasure-island']);
  const rows = applyW4Places(places);
  const by = new Map(rows.map(r => [r.id, r]));
  for (const [id, spot] of Object.entries(ARRIVAL_PLACES)) {
    const a = ATTRACTION_INDEX.get(id)!;
    assert.ok(a.offWalk, `${id} is off-walk`);
    assert.ok(!placeIds.has(spot.id) && !ATTRACTION_INDEX.get(spot.id), `${spot.id} is a new id`);
    assert.deepEqual({ x: a.arrival!.x, z: a.arrival!.z }, { x: spot.x, z: spot.z }, `${id}: the attraction arrives at its named place`);
    const d = tripDestination(a);
    assert.deepEqual(d, { placeId: spot.id, x: spot.x, z: spot.z, name: spot.name, attraction: id, short: spot.short });
    const row = by.get(spot.id)!;
    assert.ok(row && row.extra && row.curated && row.hero, `${spot.id} row`);
    assert.deepEqual(row.name, spot.name);
    assert.ok(EXTRA_PLACE_SNAPS[spot.id], `${spot.id} snapped by the sidecar`);
    assert.ok(ARRIVAL_PLACE_ROWS.some(r => r.id === spot.id));
    assert.match(spot.sourceUrl, /^https:\/\//);
  }
  assert.equal(ARRIVAL_PLACES.alcatraz.name.zh, '恶魔岛渡轮码头 · 33 号码头');
  // the district POIs (telescope, bark, the Alcatraz booking guide) merge into the new rows
  const ix = buildPlaceIndex({ places: rows as typeof places.places }, landmarkInputsFrom(SF_LANDMARKS, sfLandmarkInfo, sfLandmarkAnchor), poiInputs());
  assert.equal(ix.get('alcatraz-landing')!.poi, 'pier33');
  assert.equal(ix.get('pier-14')!.poi, 'pier14');
  assert.equal(ix.get('alcatraz-landing')!.walkable, true);
  // lane G's planner: the walk row names the pier, not the island
  const walk = planTrips({ x: 133, z: 10 }, tripDestination(ATTRACTION_INDEX.get('alcatraz')!)).find(o => o.mode === 'walk')!;
  assert.equal(walk.legs[walk.legs.length - 1].label!.zh, '步行到恶魔岛渡轮码头 · 33 号码头');
  assert.ok(!/步行到恶魔岛(?!渡轮)/.test(JSON.stringify(walk)));
  // every other attraction: its own place at its arrival, under its own name
  const twin = ATTRACTION_INDEX.get('twin-peaks')!;
  assert.deepEqual(tripDestination(twin), { placeId: 'twin-peaks', x: twin.arrival!.x, z: twin.arrival!.z, name: twin.name, attraction: 'twin-peaks', short: twin.short });
  const noArr = ATTRACTIONS.find(a => !a.arrival)!;
  assert.deepEqual([tripDestination(noArr).x, tripDestination(noArr).z], [noArr.x, noArr.z]);
});

test('P2: search — a multi-word query scores as word start when its words start a name\'s words in order; a transfer station answers its other stops\' names', async () => {
  const { prepareSearch, rankSearch, attractionEntries, lineEntries, stationEntries, placeEntries } = await import('../src/opus-bay/data/sf/placeSearch');
  const { LINE_STYLES, mapStations, mapLinesFrom } = await import('../src/opus-bay/ui/mapLines');
  const { buildTransit } = await import('../src/opus-bay/data/transit');
  type TFile = import('../src/opus-bay/data/transit').TransitFileJson;
  const w1 = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit.json'), 'utf8')) as TFile;
  const w4 = { lines: w4TransitLines() };
  const stations = mapStations(mapLinesFrom(buildTransit(w1), w1.lines.find(l => l.id === 'f-line')!, w4.lines));
  const ix = prepareSearch([...attractionEntries(ATTRACTIONS), ...lineEntries(Object.values(LINE_STYLES)), ...stationEntries(stations), ...placeEntries(applyW4Places(places), coveredPlaceIds())]);
  const hit = (q: string, id: string) => rankSearch(ix, q, 60).find(x => x.entry.id === id);
  // consecutive words: was a substring (3), now a word start (2)
  assert.equal(hit('gate bri', 'golden-gate-bridge')?.match, 'word');
  assert.equal(rankSearch(ix, 'gate bri', 1)[0].entry.id, 'golden-gate-bridge');
  assert.equal(hit('ladies post', 'alamo-square-painted-ladies')?.match, 'word');
  assert.equal(hit('baths ruins', 'sutro-baths')?.match, 'word');
  // a query that is also a name's or an alias's beginning keeps the better prefix score
  assert.equal(hit('painted lad', 'alamo-square-painted-ladies')?.match, 'prefix');
  // words skipped between: no substring existed, now found
  assert.equal(rankSearch(ix, 'golden bridge', 1)[0].entry.id, 'golden-gate-bridge');
  assert.equal(hit('golden bridge', 'golden-gate-bridge')!.match, 'word');
  assert.equal(hit('college ocean', 'ccsf-ocean-campus')?.match, 'word');
  // order matters (the second word must come later in the name)
  assert.equal(hit('bridge golden', 'golden-gate-bridge'), undefined);
  // single words: unchanged
  assert.equal(hit('gate', 'golden-gate-bridge')?.match, 'word');
  assert.equal(hit('金门大桥', 'golden-gate-bridge')?.match, 'exact');
  // stations: the F-line stop merged into the Castro transfer station finds it by its own name, word by word
  assert.equal(stations.find(s => s.ids.includes('f-line-44'))!.id, 'muni-castro');
  assert.ok(hit('17th castro', 'muni-castro'), 'the F stop name');
  assert.equal(hit('17th castro', 'muni-castro')!.match, 'word');
  assert.ok(hit('卡斯特罗', 'muni-castro'), 'the loop stop name');
  assert.equal(hit('buchanan st', 'f-line-36')?.match, 'word');
  // per keystroke stays cheap with the phrase lists
  let per = Infinity;
  for (let b = 0; b < 5; b++) { const t0 = performance.now(); for (let k = 0; k < 10; k++) rankSearch(ix, k % 2 ? 'golden gate br' : 'market st'); per = Math.min(per, (performance.now() - t0) / 10); }
  assert.ok(per < 25, `${per.toFixed(1)} ms per keystroke`);
});

// ---------------------------------------------------------------------------------------------------------------------
// Review 2 of lane P2 (W4-P-review): the piers' short names (lane C's request), zh names of the decorated rows
// ---------------------------------------------------------------------------------------------------------------------

test('review 2: the island piers have short names for the phone pill (the request of lane C) — "下一站 33 号码头", never the island', async () => {
  const { tripPillText } = await import('../src/opus-bay/ui/guideText');
  const { freeLeadTrip } = await import('../src/opus-bay/game/trips');
  const cjk = (t: string) => [...t].filter(c => /[㐀-鿿]/.test(c)).length;
  for (const [id, spot] of Object.entries(ARRIVAL_PLACES)) {
    const a = ATTRACTION_INDEX.get(id)!;
    assert.ok(spot.short.zh && spot.short.en, id);
    assert.ok(cjk(spot.short.zh) <= 5 && spot.short.en.length <= 14, `${id}: short ${spot.short.zh} / ${spot.short.en}`);
    assert.ok(!spot.short.zh.includes(a.short!.zh), `${id}: the pier's short never names the island (${a.short!.zh})`);
    const d = tripDestination(a);
    assert.deepEqual(d.short, spot.short);
    // lane G's pill on a phone, as the integration passes it (destination: d.name, short: d.short)
    const trip = freeLeadTrip({ x: d.x + 200, z: d.z }, { x: d.x, z: d.z, place: d.placeId, name: d.name }, 0);
    const title = tripPillText(trip, 240, { compact: true, destination: d.name, short: d.short }).title.zh;
    assert.equal(title, `下一站 ${spot.short.zh}`);
    assert.ok(!title.includes('…'), 'fits the phone pill whole');
  }
  assert.equal(ARRIVAL_PLACES.alcatraz.short.zh, '33 号码头');
  // every other attraction passes its own short (or none)
  for (const a of ATTRACTIONS) if (!ARRIVAL_PLACES[a.id]) assert.deepEqual(tripDestination(a).short, a.short, a.id);
});

test('review 2: a place row an attraction speaks for shows its zh name (the discovery toast, the lists), not the OSM English copied as zh', async () => {
  const { attractionZhNames } = await import('../src/opus-bay/data/sf/extraPlaces');
  const han = /[㐀-鿿]/;
  const rows = applyW4Places(places);
  const by = new Map(rows.map(r => [r.id, r]));
  const src = new Map(places.places.map(p => [p.id, p]));
  let fixed = 0;
  for (const a of ATTRACTIONS) {
    const id = a.placeId ?? a.id;
    if (ATTRACTION_INDEX.primary(id) !== a) continue;
    const row = by.get(id)!, was = src.get(id);
    assert.ok(han.test(row.name.zh), `${a.id}: row ${id} zh "${row.name.zh}"`);
    if (was && !han.test(was.name.zh) && !PLACE_NAME_FIXES[id]) {
      fixed++;
      assert.deepEqual(row.name, { zh: a.name.zh, en: was.name.en }, `${id}: the attraction's zh, the row's own English`);
    }
    // a row that already had a Chinese name keeps it (or its PLACE_NAME_FIXES entry)
    if (was && han.test(was.name.zh) && !PLACE_NAME_FIXES[id]) assert.deepEqual(row.name, was.name, id);
  }
  assert.ok(fixed >= 45, `${fixed} rows named`);
  // the Botanical Garden's gate row (lane P2): 旧金山植物园
  assert.equal(by.get('osm-w120480164')!.name.zh, '旧金山植物园');
  assert.equal(by.get('osm-w120480164')!.name.en, 'San Francisco Botanical Garden');
  // rows no attraction speaks for keep their names; non-primary attractions do not rename a row
  const zh = attractionZhNames();
  for (const r of rows) if (!zh[r.id] && !PLACE_NAME_FIXES[r.id] && src.has(r.id)) assert.deepEqual(r.name, src.get(r.id)!.name, r.id);
  assert.equal(zh['japantown-peace-pagoda'], ATTRACTION_INDEX.primary('japantown-peace-pagoda')!.name.zh);
  // the input is not mutated
  assert.ok(!han.test(places.places.find(p => p.id === 'osm-w120480164')!.name.zh));
});
