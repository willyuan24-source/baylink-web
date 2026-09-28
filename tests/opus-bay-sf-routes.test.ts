import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { ATTRACTIONS } from '../src/opus-bay/data/sf/attractions';
import { sfLandmarkInfo } from '../src/opus-bay/data/sf/landmarks';
import { ROUTE_PATHS } from '../src/opus-bay/data/sf/routePaths';
import { SITE_ARRIVALS } from '../src/opus-bay/data/sf/siteArrivals';
import { ROUTE_GAP_MAX, SF_ROUTES, routeGaps, routePointAt, sfRoute } from '../src/opus-bay/data/sf/routes';
import { DISTRICT } from '../src/opus-bay/data/district';
import { sfLandmarkAnchor } from '../src/opus-bay/world/sf/landmarks/context';
import { GGB } from '../src/opus-bay/world/sf/landmarks/golden-gate-bridge';
import { SF_LANDMARKS, landmarkToWorld, sfLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { buildRoutePath } from '../scripts/opus-sf/assets/routes-build';
import { W4_SITES } from '../src/opus-bay/world/sf/landmarks/w4sites';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Lane D2, D2-11: the three finished routes (data/sf/routes.ts + the generated walks in data/sf/routePaths.ts).
 * Gate G5: a named place at least every 225 u of walking; BAYLINK ids that exist; a T1 / T2 landmark on screen in
 * ≥ 90 % of the samples (here projected with a follow camera looking along the walk, occlusion ignored — the plan's
 * automated check; scripts/opus-sf/routes-qa.mjs measures the same in the app, D2-14).
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const json = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const PLACES = new Map<string, { x: number; z: number }>((json('public/opus-bay/sf/v1/places.json').places as { id: string; x: number; z: number }[]).map(p => [p.id, p]));

test('D2-11: three routes, unique stop ids, every stop a real place: places.json rows, lane P attractions, SF landmarks', () => {
  assert.deepEqual(SF_ROUTES.map(r => r.id), ['r1', 'r2', 'r3']);
  const ids = SF_ROUTES.flatMap(r => r.stops.map(s => s.id));
  assert.equal(new Set(ids).size, ids.length, 'unique stop ids');
  const attractions = new Map(ATTRACTIONS.map(a => [a.id, a]));
  for (const r of SF_ROUTES) {
    assert.equal(sfRoute(r.id), r);
    assert.ok(r.stops.length >= 5, `${r.id} stops`);
    assert.ok(r.name.zh && r.name.en && r.blurb.zh && r.blurb.en, r.id);
    for (const s of r.stops) {
      assert.ok(s.id.startsWith(`${r.id}-`), s.id);
      assert.ok(s.name.zh && s.name.en && s.line.zh && s.line.en, `${s.id} text`);
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z), s.id);
      assert.ok(s.placeId || s.attraction, `${s.id}: a places.json row or an attraction`);
      if (s.placeId) assert.ok(PLACES.has(s.placeId), `${s.id}: places.json has ${s.placeId}`);
      if (s.attraction) assert.ok(attractions.has(s.attraction), `${s.id}: attraction ${s.attraction}`);
      if (s.landmark) assert.ok(sfLandmark(s.landmark), `${s.id}: landmark ${s.landmark}`);
    }
    // every route ends and starts at a landmark or a place, and holds at least two T1 / T2 landmarks or heroes
    assert.notEqual(r.stops[0].kind, 'filler');
    assert.notEqual(r.stops[r.stops.length - 1].kind, 'filler');
    assert.ok(r.stops.filter(s => s.kind === 'landmark' || s.landmark).length >= 2, `${r.id} landmarks`);
  }
});

/**
 * Landmark stops that stand beside their landmark's arrival instead of on it (W5-L, the mid-wave checkpoint's CP-8): the
 * arrival is boxed in, and a stop is where the walk pauses. Fort Point's arrival is the slot between the bridge deck's
 * edge and the bluff (lane C's verify D12 keeps it under the deck's line; Requests); its stop is Marine Drive's end loop
 * in front of the fort's landward wall. tests/opus-bay-w5-landmarks.test.ts judges every stop with the walk sweep's pushes.
 */
const BESIDE_ARRIVAL: Record<string, number> = { 'r2-fort-point': 10 };

test('D2-11: landmark stops stand at the landmark\'s arrival (sfLandmarkAnchor), place stops on their places.json point', () => {
  for (const r of SF_ROUTES) for (const s of r.stops) {
    if (s.kind === 'landmark' && s.landmark) {
      const a = sfLandmarkAnchor(s.landmark)!, max = BESIDE_ARRIVAL[s.id] ?? 0.02;
      assert.ok(Math.hypot(a.x - s.x, a.z - s.z) < max, `${s.id} at ${s.landmark}'s arrival (${a.x.toFixed(2)}, ${a.z.toFixed(2)})`);
    } else if (s.placeId) {
      // its places.json point, or the walk's spot beside a big place (the Polo Field's stands)
      const p = PLACES.get(s.placeId)!;
      assert.ok(Math.hypot(p.x - s.x, p.z - s.z) < 20, `${s.id} by ${s.placeId}`);
    } else {
      // its trip end: lane L's site arrival (data/sf/siteArrivals.ts, which lane N wires into the attraction) where the
      // attraction has one, else the attraction's own arrival
      const a = ATTRACTIONS.find(q => q.id === s.attraction)!, w = SITE_ARRIVALS[a.id] ?? a.arrival ?? a;
      assert.ok(Math.hypot(w.x - s.x, w.z - s.z) < 0.02, `${s.id} at attraction ${s.attraction}'s trip end (${w.x}, ${w.z})`);
    }
  }
});

test('D2-11: BAYLINK — every route\'s planner places and guides exist in /planner-catalog.json and /baybay-guides.json', () => {
  const cat = json('public/planner-catalog.json'), guides = json('public/baybay-guides.json');
  const placeIds = new Set(((Array.isArray(cat.places) ? cat.places : Object.values(cat.places ?? cat)) as { id?: string; slug?: string }[]).map(p => p.id ?? p.slug));
  const slugs = new Set(((Array.isArray(guides.guides) ? guides.guides : Array.isArray(guides) ? guides : Object.values(guides.guides ?? guides)) as { slug?: string; id?: string }[]).map(g => g.slug ?? g.id));
  for (const r of SF_ROUTES) {
    assert.ok(r.planner.length >= 1 && r.guides.length >= 1, r.id);
    for (const id of r.planner) assert.ok(placeIds.has(id), `${r.id}: planner place ${id}`);
    for (const g of r.guides) {
      assert.ok(slugs.has(g), `${r.id}: guide ${g}`);
      assert.ok(!/-(january|february|march|april|may|june|july|august|september|october|november|december)-|-20\d\d$/.test(g), `${r.id}: ${g} is tied to one month (stale later)`);
    }
  }
});

test('D2-11: the walks are the walk graph\'s A* routes (fresh), start and end at their stops, gaps ≤ 225 u', async () => {
  const ix = await sfDisk().graphIndex();
  for (const r of SF_ROUTES) {
    const built = await buildRoutePath(r, ix);
    assert.deepEqual(ROUTE_PATHS[r.id], built, `${r.id}: routePaths.ts is stale (re-run scripts/opus-sf/assets/routes-build.ts)`);
    const p = ROUTE_PATHS[r.id];
    assert.equal(p.stopAt.length, r.stops.length);
    // each stop's walk-graph node (where its leg starts / ends) lies within 12 u of the stop
    for (const [i, s] of r.stops.entries()) {
      const q = routePointAt(r.id, p.stopAt[i])!;
      assert.ok(Math.hypot(q.x - s.x, q.z - s.z) < 12, `${s.id}: the walk passes ${Math.hypot(q.x - s.x, q.z - s.z).toFixed(1)} u from it`);
    }
    const gaps = routeGaps(r.id);
    assert.ok(Math.max(...gaps) <= ROUTE_GAP_MAX, `${r.id} gaps ${gaps.join(' / ')}`);
    assert.ok(gaps.every(g => g > 0), `${r.id} stops in walking order`);
  }
  // lengths within 25 % of the plan's (R1 327 u, R2 916 u, R3 1,208 u; the fillers add a little)
  const plan = { r1: 327, r2: 916, r3: 1208 } as const;
  for (const [id, L] of Object.entries(plan)) {
    const got = ROUTE_PATHS[id].length;
    assert.ok(got > L * 0.9 && got < L * 1.25, `${id} ${got} u vs the plan's ${L}`);
  }
});

/** T1 / T2 landmarks (their height from the info records) and the district heroes that stand over R1 */
function viewTargets() {
  const out: { id: string; x: number; z: number; r: number; h: number; far: number }[] = [];
  for (const l of SF_LANDMARKS) {
    if (l.tier === 3) continue;
    if (l.id === 'golden-gate-bridge') {
      // the bridge is 420 u long: its two towers and the deck every 40 u
      for (const x of [-GGB.TOWER, GGB.TOWER]) { const p = landmarkToWorld(l, { x, z: 0 }); out.push({ id: l.id, x: p.x, z: p.z, r: 3, h: GGB.TOP, far: 1000 }); }
      for (let x = GGB.END_S; x <= GGB.END_N; x += 40) { const p = landmarkToWorld(l, { x, z: 0 }); out.push({ id: l.id, x: p.x, z: p.z, r: 3, h: GGB.DECK + 1, far: 520 }); }
      continue;
    }
    const h = sfLandmarkInfo(l.id)?.height.u ?? 6;
    const e = l.exclude, r = 'r' in e ? e.r : Math.max(...e.poly.map(p => Math.hypot(p.x - l.x, p.z - l.z)));
    out.push({ id: l.id, x: l.x, z: l.z, r: Math.min(r, 40), h: Math.max(4, h), far: l.tier === 1 ? 1000 : 520 });
  }
  // the hand-made district's heroes in city mode (heights over their ground, like routes-qa.mjs): Coit Tower on Telegraph
  // Hill (summit plaza ≈ 16 u + the tower), the Transamerica Pyramid, Salesforce Tower, the Ferry Building's clock tower
  const H: Record<string, number> = { 'coit-tower': 26, transamerica: 33, 'salesforce-tower': 45, 'ferry-building': 13 };
  for (const d of DISTRICT.landmarks) if (H[d.kind]) out.push({ id: d.id, x: d.position.x, z: d.position.z, r: 3, h: H[d.kind], far: 1000 });
  return out;
}

/** fraction of a route's 25 u samples with one of `targets` on screen (the follow camera looks along the walk) */
function onScreen(id: 'r1' | 'r2' | 'r3', targets: ReturnType<typeof viewTargets>) {
  const cam = new THREE.PerspectiveCamera(55, 16 / 10, 0.5, 2000), v = new THREE.Vector3();
  const L = ROUTE_PATHS[id].length, misses: number[] = [];
  let n = 0;
  for (let s = 0; s <= L; s += 25) {
    const p = routePointAt(id, s)!, dx = Math.sin(p.heading), dz = Math.cos(p.heading);
    cam.position.set(p.x - dx * 7, 4.5, p.z - dz * 7);
    cam.lookAt(p.x + dx * 10, 1.5, p.z + dz * 10);
    cam.updateMatrixWorld();
    const any = targets.some(t => {
      if (Math.hypot(t.x - cam.position.x, t.z - cam.position.z) > t.far) return false;
      for (const [ox, oz] of [[0, 0], [t.r, 0], [-t.r, 0], [0, t.r], [0, -t.r]]) for (const y of [0.5, t.h * 0.5, t.h]) {
        v.set(t.x + ox, y, t.z + oz).project(cam);
        if (v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) return true;
      }
      return false;
    });
    n++;
    if (!any) misses.push(s);
  }
  return { share: (n - misses.length) / n, misses };
}

test('D2-11: a T1 / T2 landmark on screen in ≥ 90 % of the 25 u samples (R3 once the wave-4 park sites are in the city)', () => {
  const today = viewTargets();
  for (const id of ['r1', 'r2'] as const) {
    const r = onScreen(id, today);
    assert.ok(r.share >= 0.9, `${id}: a landmark on screen at ${(r.share * 100).toFixed(0)} % (misses at ${r.misses.join(', ')} u)`);
  }
  // R3 crosses Golden Gate Park westward, away from the de Young and Sutro Tower: today ≈ 65 %; with lane L's wave-4
  // park sites (Cal Academy, the Tea Garden, the bison, the Beach Chalet, the Murphy Windmill…, integrated after wave 3)
  // it passes the gate
  const r3 = onScreen('r3', today);
  assert.ok(r3.share >= 0.6, `r3 today: ${(r3.share * 100).toFixed(0)} %`);
  const w4 = W4_SITES.map(s => ({ id: s.id, x: s.x, z: s.z, r: 6, h: Math.max(4, s.w4.height.u), far: 520 }));
  const later = onScreen('r3', [...today, ...w4]);
  assert.ok(later.share >= 0.9, `r3 with lane L's sites: ${(later.share * 100).toFixed(0)} % (misses at ${later.misses.join(', ')} u)`);
});
