import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import type { Obstacle } from '../src/opus-bay/actors/controller';
import { collectObstacles } from '../src/opus-bay/actors/view';
import { groundRaster, rasterHeight } from '../src/opus-bay/core/sfTerrain';
import type { Vec2 } from '../src/opus-bay/core/types';
import { DISTRICT } from '../src/opus-bay/data/district';
import { COIN_CACHES } from '../src/opus-bay/economy/coinSpots';
import { __setBayNowForTests } from '../src/opus-bay/game/bayNow';
import { TOY } from '../src/opus-bay/world/materials';
import { __resetCrowdSpotsForTests, crowdPins } from '../src/opus-bay/world/sf/crowdSpots';
import { demSample } from '../src/opus-bay/world/sf/format';
import { signsMaterial } from '../src/opus-bay/world/sf/signsAtlas';
import { CORNER_BUDGET, CORNER_CULL, type CornerDef, activeWindows, buildCornerMeshes, cornerGroundWorld, cornerState, cornerToWorld, signKnown } from '../src/opus-bay/world/sf/landmarks/cornerKit';
import { CORNER_GROUND } from '../src/opus-bay/world/sf/landmarks/cornerGround';
import { CORNERS } from '../src/opus-bay/world/sf/landmarks/corners';
import { type SfLandmark, sfLandmark, worldToLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import type { SiteHooks } from '../src/opus-bay/world/sf/sites';
import { sfDisk } from './opus-bay-sf-disk';

// Wave 5 · lane L · the signature corners (W5-L4 corners 1–4, W5-L5 corners 5–8, W5-L6 Chinatown; plan §3.6 / §4.8
// "w5-corners"): each ≤ 2.5k triangles and ≤ 2 draw calls, in the outer city only (Chinatown within lane V's published
// downtown headroom), no text meshes, its coin cache standable, its crowd spots on its site's plaza; the Bay-time windows
// switch the ambient.

type Site = SfLandmark & SiteHooks;
const siteOf = (c: CornerDef) => sfLandmark(c.site) as Site;
const baseOf = (s: SfLandmark) => (typeof s.base === 'number' ? s.base : 0);
/** every window alone, none and all of them together */
function windowSets(c: CornerDef): Set<string>[] {
  const ids = Object.keys(c.windows ?? {});
  return [new Set<string>(), new Set(ids), ...ids.map(id => new Set([id]))];
}
const pip = (p: Vec2, poly: readonly Vec2[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside; }
  return inside;
};

test('W5-L4 / L5 / L6: the corners are the plan\'s, in order, each on its site (same frame) and mounted through it', () => {
  assert.equal(CORNERS.length, 9, 'the eight corners of the plan\'s table, then Chinatown (W5-L6)');
  CORNERS.forEach((c, i) => {
    assert.equal(c.order, i + 1, `${c.id} is row ${i + 1} of the plan's table`);
    const s = siteOf(c);
    assert.ok(s, `${c.id}: its site ${c.site} is registered`);
    assert.deepEqual(c.frame, { x: s.x, z: s.z, yaw: s.yaw }, `${c.id}: the frame is its site's`);
    assert.equal(typeof s.mount, 'function', `${c.id}: ${c.site} mounts the corner`);
    assert.ok(c.name.zh && c.name.en && c.ambient.zh && c.ambient.en);
    assert.ok([...c.ambient.zh].length <= 45, `${c.id}: the ambient line is short`);
  });
  assert.equal(new Set(CORNERS.map(c => c.id)).size, CORNERS.length);
});

test('W5-L4 / L5: every corner stays within 2 draw calls and 2.5k triangles in every window, with plaques of the atlas and no text meshes', () => {
  for (const c of CORNERS) {
    const s = siteOf(c);
    for (const on of windowSets(c)) {
      const m = buildCornerMeshes(c, baseOf(s), on);
      const meshes = [m.toy, m.signs].filter((x): x is THREE.Mesh => !!x);
      assert.ok(meshes.length <= CORNER_BUDGET.calls, `${c.id} [${[...on]}]: ${meshes.length} meshes`);
      assert.ok(m.triangles <= CORNER_BUDGET.triangles, `${c.id} [${[...on]}]: ${m.triangles} triangles`);
      const tris = meshes.reduce((n, x) => n + (x.geometry.getIndex()?.count ?? 0) / 3, 0);
      assert.equal(tris, m.triangles);
      // the two kinds: the sites' own TOY program, the signs atlas (warmed as 'v-signs'); neither casts a shadow
      if (m.toy) { assert.equal(m.toy.material, TOY); assert.equal(m.toy.castShadow, false); assert.equal(m.toy.receiveShadow, true); }
      if (m.signs) { assert.equal(m.signs.material, signsMaterial()); assert.equal(m.signs.castShadow, false); assert.equal(m.signs.receiveShadow, true); }
      assert.ok(m.plaques >= 2, `${c.id}: ${m.plaques} plaques`);
      for (const p of c.signs({ at: () => 0 }, on)) assert.ok(signKnown(p.id), `${c.id}: unknown plaque ${p.id}`);
      for (const x of meshes) x.geometry.dispose();
    }
  }
});

/**
 * W5-L6: the downtown gate spots a corner may reach, with lane V's published headroom there (sf-w5-V.md part a, "The
 * downtown headroom" after the levers, per view at quality high: Chinatown ≈ 50k, Union Square ≈ 45k, Powell & Market
 * ≈ 15k, Grace / Nob Hill ≈ 60k, the Financial District ≈ 90k, calls ≥ 25; part b's gate: 37 calls and 128k of headroom
 * at Chinatown). A corner is ≤ 2 calls and ≤ 2.5k triangles; the Ferry gate (≤ 1 call, ≤ 2k) is never reached.
 */
const DOWNTOWN_OK: Record<string, readonly string[]> = { chinatown: ['chinatown', 'union-square', 'grace-nob-hill', 'powell-market', 'fidi'] };

test('W5-L4 / L5 / L6: the corners are in the outer city — none reaches a downtown gate spot but Chinatown\'s (lane V\'s published headroom)', () => {
  const spots = (JSON.parse(readFileSync(new URL('../scripts/opus-sf/qa/perf/w5-spots.json', import.meta.url), 'utf8')) as { spots: { id: string; go?: { x?: number; z?: number; anchor?: string } }[] }).spots;
  const at = (id: string): Vec2 => {
    const g = spots.find(s => s.id === id)!.go!;
    if (g.anchor) { const a = (DISTRICT.anchors as unknown as Record<string, Vec2>)[g.anchor]; return { x: a.x, z: a.z }; }
    return { x: g.x!, z: g.z! };
  };
  const DOWNTOWN = ['ferry-gate', 'chinatown', 'union-square', 'grace-nob-hill', 'powell-market', 'fidi'];
  for (const c of CORNERS) {
    const [x0, z0, x1, z1] = c.box;
    const pts = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }].map(p => cornerToWorld(c, p));
    for (const d of DOWNTOWN) {
      const p = at(d), near = Math.min(...pts.map(q => Math.hypot(q.x - p.x, q.z - p.z)));
      // the corner's meshes are drawn within CORNER_CULL of the camera (measured at the corner's middle)
      if (DOWNTOWN_OK[c.id]?.includes(d)) continue;
      assert.ok(near > CORNER_CULL + 20, `${c.id}: ${near.toFixed(0)} u from the ${d} gate spot`);
    }
    assert.ok(!DOWNTOWN_OK[c.id]?.includes('ferry-gate'), `${c.id}: never the Ferry gate`);
  }
});

test('W5-L4 / L5: mounting builds the LOD, the Bay-time windows switch the crowd groups, unmounting clears everything', () => {
  try {
    for (const c of CORNERS) {
      const s = siteOf(c);
      for (const hhmm of ['08:30', '12:30', '16:00', '22:30']) {
        __setBayNowForTests(`2026-10-03T${hhmm}`);
        __resetCrowdSpotsForTests();
        const g = new THREE.Group();
        const off = s.mount!(g, baseOf(s)) as () => void;
        const st = cornerState().get(c.id)!;
        assert.ok(st, `${c.id}: mounted`);
        const lod = g.children.find(o => (o as THREE.LOD).isLOD) as THREE.LOD;
        assert.ok(lod && lod.levels.length === 2 && lod.levels[1].distance === CORNER_CULL, `${c.id}: one LOD culled at ${CORNER_CULL} u`);
        // (W5-L6) the LOD measures from the corner's middle, the meshes stay in the site's frame
        assert.deepEqual([lod.position.x, lod.position.z], [(c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2], `${c.id}: the LOD stands at the corner's middle`);
        const near = lod.levels[0].object;
        assert.deepEqual([near.position.x + lod.position.x, near.position.z + lod.position.z], [0, 0], `${c.id}: the meshes keep the site's frame`);
        // only plain meshes of the two materials under it: no text meshes, no sprites
        lod.traverse(o => { if (o !== lod && !(o instanceof THREE.Group) && o.type !== 'Object3D') { assert.ok((o as THREE.Mesh).isMesh, `${c.id}: ${o.type}`); assert.ok([TOY, signsMaterial()].includes((o as THREE.Mesh).material as THREE.Material)); } });
        const [h, m] = hhmm.split(':').map(Number);
        const want = activeWindows(c, { hour: h, minute: m, weekday: 6 });
        assert.deepEqual([...st.active].sort(), [...want].sort());
        const keys = new Set(crowdPins().map(p => p.key));
        for (const cr of c.crowds ?? []) assert.equal(keys.has(`corner:${c.id}:${cr.key}`), !cr.when || want.has(cr.when), `${c.id} ${hhmm}: crowd ${cr.key}`);
        off();
        assert.equal(cornerState().get(c.id), undefined);
        assert.equal(g.children.length, 0, `${c.id}: the LOD is removed`);
        assert.equal(crowdPins().filter(p => p.key.startsWith(`corner:${c.id}:`)).length, 0, `${c.id}: the crowd groups are removed`);
      }
    }
  } finally { __setBayNowForTests(null); __resetCrowdSpotsForTests(); }
});

/** a Bay minute inside window `w` (on a day it runs: 2026-10-04 is a Sunday) */
const inWindow = (w: { days?: readonly number[]; from: number }) => {
  const d = w.days?.[0] ?? 6, m = w.from + 1;
  return `2026-10-${String(4 + d).padStart(2, '0')}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

test('W5-L4 / L5: soft obstacles stand only in their window', () => {
  try {
    for (const c of CORNERS) {
      if (!c.soft?.length) continue;
      const s = siteOf(c);
      for (const spec of ['2026-10-05T03:00', ...Object.values(c.windows ?? {}).map(inWindow)]) {
        __setBayNowForTests(spec);
        const g = new THREE.Group();
        const off = s.mount!(g, baseOf(s)) as () => void;
        const on = cornerState().get(c.id)!.active;
        for (const so of c.soft) {
          const p = cornerToWorld(c, so), out: Obstacle[] = [];
          collectObstacles(out, p.x, p.z, 0.5);
          const hit = out.some(o => Math.hypot(o.x - p.x, o.z - p.z) < 0.01);
          assert.equal(hit, !so.when || on.has(so.when), `${c.id} ${spec}: soft obstacle at (${so.x}, ${so.z})`);
        }
        off();
      }
    }
  } finally { __setBayNowForTests(null); __resetCrowdSpotsForTests(); }
});

// ---------------------------------------------------------------------------
// against the real walk data (the game's rasters with every site's walk inputs)
// ---------------------------------------------------------------------------

const sf = sfDisk();
type Terrain = typeof import('../src/opus-bay/core/terrain');
let worldP: Promise<{ T: Terrain; attach: (x: number, z: number, r: number) => Promise<unknown> }> | null = null;
function world() {
  return (worldP ??= (async () => {
    const { createCityTerrain } = await import('../src/opus-bay/core/sfTerrain');
    const { CitySites } = await import('../src/opus-bay/world/sf/sites');
    const T = await import('../src/opus-bay/core/terrain');
    const far = await sf.far(), sites = new CitySites(), lms = sites.walkInputs();
    const city = createCityTerrain(sf.manifest, { landmarks: lms });
    city.setFar(far);
    sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
    sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
    T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
    return { T, attach: (x: number, z: number, r: number) => sf.attachAround(city, x, z, r, lms) };
  })());
}
const inSiteBlocker = (l: SfLandmark, w: Vec2, pad = 0) => { const p = worldToLandmark(l, w); return (l.walk?.blockers ?? []).some(b => ('poly' in b ? pip(p, b.poly) : Math.hypot(p.x - b.x, p.z - b.z) < b.r + pad)); };

test('W5-L4 / L5: the crowd spots stand on the site\'s plaza, on ground a walker stands on, off the roadway; the coin cache is standable', async () => {
  const w = await world();
  const bad: string[] = [];
  try {
    for (const c of CORNERS) {
      const s = siteOf(c);
      const o = cornerToWorld(c, { x: (c.box[0] + c.box[2]) / 2, z: (c.box[1] + c.box[3]) / 2 });
      await w.attach(o.x, o.z, 40);
      __resetCrowdSpotsForTests();
      // every group of every window at once (the lanes of all of them apply)
      for (const on of [new Set(Object.keys(c.windows ?? {}))]) {
        const { addCrowdSpots } = await import('../src/opus-bay/world/sf/crowdSpots');
        for (const cr of c.crowds ?? []) {
          if (cr.when && !on.has(cr.when)) continue;
          const W = (p: Vec2) => cornerToWorld(c, p);
          const lane = cr.lane ? (() => { const a = W({ x: cr.lane!.ax, z: cr.lane!.az }), b = W({ x: cr.lane!.bx, z: cr.lane!.bz }); return { ax: a.x, az: a.z, bx: b.x, bz: b.z }; })() : undefined;
          addCrowdSpots(`corner:${c.id}:${cr.key}`, cr.spots.map(p => ({ ...W(p), r: p.r })), { face: cr.face ? W(cr.face) : undefined, count: cr.count, lane });
        }
      }
      // (a corner's own standing strips, `plazaOwn`: its crowd only, not the site's sightseers)
      const plaza = [...(s.plaza ?? []).map(p => p.poly), ...(c.plazaOwn ? (c.plaza ?? []).map(p => [...p]) : [])];
      for (const p of crowdPins()) {
        const l = worldToLandmark(s, p);
        if (!plaza.some(poly => pip(l, poly))) bad.push(`${p.id}: local (${l.x.toFixed(2)}, ${l.z.toFixed(2)}) is not on ${s.id}'s plaza`);
        if (!w.T.canStand(p.x, p.z, 0.22)) bad.push(`${p.id}: nobody can stand at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
        if (w.T.surfaceAt(p.x, p.z) === 'road') bad.push(`${p.id}: on the roadway`);
        if (inSiteBlocker(s, p)) bad.push(`${p.id}: inside a blocker of ${s.id}`);
      }
      for (const poly of c.plaza ?? []) assert.ok(plaza.includes(poly as Vec2[]) || plaza.some(q => JSON.stringify(q) === JSON.stringify(poly)), `${c.id}: its plaza additions are in ${s.id}'s plaza`);
      if (c.plazaOwn) for (const poly of c.plaza ?? []) assert.ok(!(s.plaza ?? []).some(q => JSON.stringify(q.poly) === JSON.stringify(poly)), `${c.id}: its own strips stay out of ${s.id}'s sightseer plaza`);
      if (c.cache) {
        const k = COIN_CACHES.find(q => q.id === c.cache);
        assert.ok(k, `${c.id}: lane E's cache ${c.cache}`);
        await w.attach(k.x, k.z, 20);
        if (!w.T.canStand(k.x, k.z, 0.3)) bad.push(`${c.id}: the cache ${c.cache} is not standable`);
        if (inSiteBlocker(s, k, 0.3)) bad.push(`${c.id}: the cache ${c.cache} is inside a blocker of ${s.id}`);
        for (const so of c.soft ?? []) { const q = cornerToWorld(c, so); if (Math.hypot(q.x - k.x, q.z - k.z) < so.r + 0.4) bad.push(`${c.id}: the cache is under a soft obstacle`); }
      }
    }
  } finally { __resetCrowdSpotsForTests(); w.T.setCityTerrain(null); worldP = null; }
  assert.deepEqual(bad, []);
});

test('W5-L-review: no corner crowd pin stands where travel puts the player — ≥ ARRIVAL_CLEAR from its site\'s arrival and from the trip end of every attraction the site models (the W4-IL15 rule of the sites\' sightseers)', async () => {
  const { ARRIVAL_CLEAR, sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  const { ATTRACTIONS, tripDestination } = await import('../src/opus-bay/data/sf/attractions');
  const bad: string[] = [];
  let pins = 0;
  for (const c of CORNERS) {
    const s = siteOf(c) as Site & { w4?: { attractions?: readonly string[] } };
    const ends: { id: string; x: number; z: number }[] = [];
    const a = sfLandmarkAnchor(s.id);
    if (a) ends.push({ id: `${s.id}'s arrival`, x: a.x, z: a.z });
    for (const t of ATTRACTIONS) if (t.landmarkId === s.id || s.w4?.attractions?.includes(t.id)) { const d = tripDestination(t); ends.push({ id: `${t.id}'s trip end`, x: d.x, z: d.z }); }
    assert.ok(ends.length, `${c.id}: ${s.id} has an arrival`);
    for (const cr of c.crowds ?? []) for (const sp of cr.spots) {
      pins++;
      const w = cornerToWorld(c, sp);
      for (const e of ends) {
        const d = Math.hypot(w.x - e.x, w.z - e.z);
        if (d < ARRIVAL_CLEAR) bad.push(`${c.id} ${cr.key} (${cr.when ?? 'always'}) at local (${sp.x}, ${sp.z}): ${d.toFixed(2)} u from ${e.id}`);
      }
    }
  }
  assert.ok(pins >= 20, `${pins} pins checked`);
  assert.deepEqual(bad, []);
});

test('W5-L4 / L5: landmarks/cornerGround.ts is the published walked ground (re-measured)', async () => {
  const rasters = new Map<string, ReturnType<typeof groundRaster> | null>();
  const walked = async (x: number, z: number) => {
    const k = `${Math.floor(x / 128)}_${Math.floor(z / 128)}`;
    if (!rasters.has(k)) { const ch = await sf.chunk(Math.floor(x / 128), Math.floor(z / 128)); rasters.set(k, ch ? groundRaster(ch) : null); }
    return rasterHeight(rasters.get(k)!, x, z);
  };
  for (const c of CORNERS) {
    const g = CORNER_GROUND[c.id];
    if (c.ground) continue;
    assert.ok(g, `${c.id}: baked (scripts/opus-sf/corners-ground.mts)`);
    assert.deepEqual([g.x0, g.z0], [c.box[0], c.box[1]], `${c.id}: the grid starts at the box`);
    assert.ok(g.x0 + (g.cols - 1) * g.step >= c.box[2] && g.z0 + (g.rows - 1) * g.step >= c.box[3], `${c.id}: the grid covers the box`);
    for (let j = 0; j < g.rows; j += 3) for (let i = 0; i < g.cols; i += 3) {
      let hi = -Infinity;
      for (let dv = -0.25; dv <= 0.25 + 1e-9; dv += 0.25) for (let du = -0.25; du <= 0.25 + 1e-9; du += 0.25) {
        const p = cornerToWorld(c, { x: g.x0 + i * g.step + du, z: g.z0 + j * g.step + dv });
        hi = Math.max(hi, await walked(p.x, p.z));
      }
      const y = cornerGroundWorld(c.id, g.x0 + i * g.step, g.z0 + j * g.step);
      assert.ok(Math.abs(y - hi) <= 0.011, `${c.id} (${i}, ${j}): ${y} vs ${hi.toFixed(3)} (re-run the baker)`);
    }
  }
});
