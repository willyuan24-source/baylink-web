import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Lane G1 (G1-1 / G1-2 / G1-4 / G1-9): places.json → the place index (landmarks, POI merges, walkable, search), CS-8
 * landmark areas, discovery at 12 u, the HUD street name with hysteresis.
 */

// --- headless canvas stub (world modules create label atlases at import) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { buildPlaceIndex, landmarkInputsFrom, poiInputs } = await import('../src/opus-bay/data/sf/places');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
const { sfLandmarkInfo } = await import('../src/opus-bay/data/sf/landmarks');
const { LANDMARK_AREAS, landmarkAreaAt, farZoneIndexAt, zoneLabelAnchor } = await import('../src/opus-bay/data/cityZones');
const { newlyDiscovered, StampThrottle, DISCOVER_R } = await import('../src/opus-bay/game/discovery');
const { namedRoadsNear, chooseStreet } = await import('../src/opus-bay/game/streets');

const sf = sfDisk();
const file = JSON.parse(fs.readFileSync(path.join(sf.base, 'places.json'), 'utf8')) as import('../src/opus-bay/world/sf/format').PlacesFile;
const lms = landmarkInputsFrom(SF_LANDMARKS, sfLandmarkInfo, sfLandmarkAnchor);
const ix = buildPlaceIndex(file, lms, poiInputs());
const far = await sf.far();

test('places: all 24 landmarks resolve to a place, arriving at the landmark anchor', () => {
  assert.equal(lms.length, SF_LANDMARKS.length);
  assert.equal(SF_LANDMARKS.length, 24);
  const seen = new Set<string>();
  for (const l of SF_LANDMARKS) {
    const p = ix.landmark(l.id);
    assert.ok(p, `landmark ${l.id}`);
    assert.ok(!seen.has(p.id), `${l.id} shares ${p.id}`);
    seen.add(p.id);
    const a = sfLandmarkAnchor(l.id)!;
    assert.deepEqual(p.arrival, a, `${l.id} arrival`);
    assert.ok(Math.hypot(p.x - l.x, p.z - l.z) <= 40, `${l.id} matched ${p.id} too far away`);
    assert.equal(p.walkable, true);
  }
  // the 7 registry ids that differ from places.json ids still map (dragon-gate → chinatown-dragon-gate …)
  assert.equal(ix.landmark('dragon-gate')?.id, 'chinatown-dragon-gate');
  assert.equal(ix.landmark('painted-ladies')?.id, 'alamo-square-painted-ladies');
});

test('places: walkable is false for exactly the 37 places off the walking graph; hero places merge with their POI', () => {
  const off = ix.list.filter(p => !p.walkable);
  assert.equal(off.length, 37);
  const src = new Map(file.places.map(p => [p.id, p]));
  for (const p of off) assert.equal(src.get(p.id)?.graphNode, -1, p.id);
  assert.equal(ix.list.length, file.places.length, 'no synthetic places needed today');
  assert.equal(ix.get('ferry-building')?.poi, 'ferry-building');
  assert.equal(ix.get('coit-tower')?.poi, 'coit-tower');
  assert.equal(ix.get('pier-39')?.poi, undefined, 'PIER 39 is not the carousel');
  for (const p of ix.list) if (p.poi) assert.ok(p.hero, `${p.id} merged but not hero`);
});

test('places: near() by bucket matches a brute-force scan; search finds zh and en', () => {
  for (const [x, z, r] of [[132, 19, 30], [-500, 900, 90], [240, 700, 64], [0, 0, 5]] as const) {
    const brute = ix.list.filter(p => Math.hypot(p.x - x, p.z - z) < r).map(p => p.id).sort();
    assert.deepEqual(ix.near(x, z, r).map(p => p.id).sort(), brute);
  }
  assert.equal(ix.search('唐人街')[0]?.id, 'chinatown-dragon-gate');
  assert.equal(ix.search('coit')[0]?.id, 'coit-tower');
  assert.ok(ix.search('golden gate').slice(0, 3).some(p => p.landmark === 'golden-gate-bridge'));
  assert.ok(ix.search('dolores').slice(0, 2).every(p => p.curated));
  assert.deepEqual(ix.search('   '), []);
});

test('discovery: 11.9 u finds a place, 12.1 u does not; the stamp toast waits 4 s and tells finds together', () => {
  const p = ix.get('city-hall')!;
  const found = (d: number) => newlyDiscovered(ix, { x: p.x + d, z: p.z }, () => false).some(q => q.id === p.id);
  assert.equal(DISCOVER_R, 12);
  assert.equal(found(11.9), true);
  assert.equal(found(12.1), false);
  assert.equal(newlyDiscovered(ix, { x: p.x, z: p.z }, id => id === p.id).some(q => q.id === p.id), false, 'known places stay quiet');
  const st = new StampThrottle(4000);
  st.push(p);
  assert.equal(st.take(1000).length, 1);
  st.push(p); st.push(p);
  assert.equal(st.take(3000).length, 0, 'inside the gap');
  assert.equal(st.take(5000).length, 2, 'told together');
});

test('CS-8: landmark areas sit on their places.json anchors and win over the neighbourhood', () => {
  const at = (id: string) => file.places.find(p => p.id === id)!;
  const want: Record<string, string[]> = { chinatown: ['chinatown-dragon-gate'], 'civic-center': ['city-hall'], 'dolores-park': ['dolores-park'], 'alamo-square': ['alamo-square-painted-ladies'], 'twin-peaks': ['sutro-tower', 'twin-peaks'] };
  for (const [id, places] of Object.entries(want)) {
    const areas = LANDMARK_AREAS.filter(a => a.id === id);
    assert.equal(areas.length, places.length, id);
    places.forEach((pid, i) => { const p = at(pid); assert.ok(Math.hypot(areas[i].x - p.x, areas[i].z - p.z) < 1, `${id} @ ${pid}`); });
  }
  assert.equal(landmarkAreaAt(82, 176)?.id, 'chinatown');
  assert.equal(landmarkAreaAt(95, 420)?.name.zh, '市政中心');
  assert.equal(landmarkAreaAt(500, 500), null);
  // the DataSF neighbourhood under a point, and a label anchor inside the Mission
  const mission = far.zones.findIndex(z => z.id === 'mission');
  assert.ok(mission >= 0);
  const a = zoneLabelAnchor(far.zones[mission])!;
  assert.equal(farZoneIndexAt(far, a.x, a.z), mission);
  assert.equal(farZoneIndexAt(far, -5000, 0), -1);
});

test('street names: nearest named centreline within 6 u; 1.5 u hysteresis', () => {
  // Market Street runs past the Powell & Market turntable
  const pm = file.places.find(p => p.id === 'cable-car-powell-market')!;
  const hits = namedRoadsNear(far.lines, far.names, pm.x, pm.z, 40);
  assert.ok(hits.some(h => /Market/.test(h.name)), hits.map(h => h.name).join(', '));
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i].d >= hits[i - 1].d);
  assert.equal(namedRoadsNear(far.lines, far.names, -3000, -3000).length, 0);
  assert.equal(chooseStreet(null, [{ name: 'A', d: 2 }, { name: 'B', d: 3 }]), 'A');
  assert.equal(chooseStreet('B', [{ name: 'A', d: 2 }, { name: 'B', d: 3 }]), 'B', 'within 1.5 u: keep');
  assert.equal(chooseStreet('B', [{ name: 'A', d: 1 }, { name: 'B', d: 3 }]), 'A', '2 u nearer: switch');
  assert.equal(chooseStreet('B', []), null);
});

test('G1-11 足迹: counts landmarks / sights / places / neighbourhoods / rides from the real index; newest finds first', async () => {
  const { footprintsSummary } = await import('../src/opus-bay/ui/footprintsData');
  const empty = footprintsSummary(ix, [], 0, far.zones.length, {}, () => null);
  assert.equal(empty.landmarks.total, 24);
  assert.equal(empty.landmarks.found, 0);
  assert.ok(empty.sights.total >= 40, `${empty.sights.total} curated places beside the landmarks`);
  assert.equal(empty.zones.total, far.zones.length);
  assert.deepEqual([empty.places, empty.ridesTotal, empty.recent.length], [0, 0, 0]);
  const lm = ix.list.filter(p => p.landmark).slice(0, 3).map(p => p.id);
  const sight = ix.list.find(p => p.curated && !p.landmark)!.id;
  const osm = ix.list.find(p => !p.curated && !p.landmark)!.id;
  const found = [...lm, sight, osm, 'gone-from-the-index'];
  const s = footprintsSummary(ix, found, 5, far.zones.length, { 'powell-hyde': 2, 'california': 1, 'x': 0 }, id => (id === 'powell-hyde' ? { zh: '鲍威尔-海德线', en: 'Powell–Hyde' } : null));
  assert.deepEqual([s.landmarks.found, s.sights.found, s.places, s.zones.visited], [3, 1, 5, 5]);
  assert.deepEqual(s.recent.map(p => p.id), [osm, sight, lm[2], lm[1], lm[0]], 'newest first; unknown ids skipped');
  assert.deepEqual(s.rides.map(r => [r.lineId, r.count]), [['powell-hyde', 2], ['california', 1]]);
  assert.equal(s.rides[1].name.en, 'california', 'a line without a name shows its id');
  assert.equal(s.ridesTotal, 3);
  assert.equal(footprintsSummary(ix, found, 99, 41, {}, () => null).zones.visited, 41, 'never more than all');
});
