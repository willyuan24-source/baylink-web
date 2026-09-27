import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { type GroundRaster, type LandmarkWalkInput, createCityTerrain, groundRaster, landmarkWalkInputs, rasterHeight } from '../src/opus-bay/core/sfTerrain';
import { canStand, heightAt, pointInPolygon, setCityTerrain } from '../src/opus-bay/core/terrain';
import type { Vec2 } from '../src/opus-bay/core/types';
import { findPath } from '../src/opus-bay/actors/nav';
import { ATTRACTION_FLAG_H } from '../src/opus-bay/data/sf/attractionTypes';
import { EXTRA_PLACES, PLACE_REANCHORS } from '../src/opus-bay/data/sf/extraPlaces';
import { DISTRICT } from '../src/opus-bay/data/district';
import { NO_NAME, ROAD_CLASSES } from '../src/opus-bay/world/sf/format';
import { landmarkSink } from '../src/opus-bay/world/sf/sites';
import { SF_LANDMARKS, TIER_TRIANGLES, type SfLandmark, buildLandmark, buildLandmarkAnimated, landmarkToWorld, sfLandmark, worldToLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { LIFT, LIFT_STRIPE, type W4Site, polyArea } from '../src/opus-bay/world/sf/landmarks/siteKit';
import { site3Ground } from '../src/opus-bay/world/sf/landmarks/siteKit3';
import { SITE_TERRAIN } from '../src/opus-bay/world/sf/landmarks/siteTerrain';
import { SITE_TERRAIN3 } from '../src/opus-bay/world/sf/landmarks/siteTerrain3';
import { W4_SITES } from '../src/opus-bay/world/sf/landmarks/w4list';
import { W4_SITES_T3 } from '../src/opus-bay/world/sf/landmarks/w4list3';
import { measureTops } from '../scripts/opus-sf/assets/topsMeasure';
import { sfDisk } from './opus-bay-sf-disk';

// Wave-4 TIER-3 sites (lane L3, W4-L9: plan §2.4 "Priority 4"): the small settings built in node against the published
// city, with the same checks as lane L's tests/opus-bay-sf-sites-w4.test.ts (budgets with ground and moving parts,
// baked terrain, draped ground, reachable arrivals, walk-around ring, street continuity, flags, settings) plus the
// tier-3 rules: every record is tier 3 (≤ 800 triangles all in), models only priority-4 attractions, and never meets an
// existing landmark, one of lane L's sites (w4list.ts, lane L2 appends to it) or the hero slab.

const sf = sfDisk();
type AttractionRow = { id: string; x: number; z: number; placeId: string | null; treatment: string; mapRank: number; priority: number };
const attractions = (JSON.parse(readFileSync(new URL('../docs/opus-bay/sf-w4-attractions.json', import.meta.url), 'utf8')) as { attractions: AttractionRow[] }).attractions;
const places = (JSON.parse(readFileSync(new URL('../public/opus-bay/sf/v1/places.json', import.meta.url), 'utf8')) as { places: { id: string; x: number; z: number }[] }).places;
const placeById = new Map(places.map(p => [p.id, p]));
const attractionById = new Map(attractions.map(a => [a.id, a]));
const T3 = W4_SITES_T3;

const triCount = (g: THREE.BufferGeometry) => (g.getIndex()?.count ?? g.getAttribute('position').count) / 3;
const inPoly = (p: Vec2, poly: Vec2[]) => pointInPolygon(p, poly);
const exPoly = (l: SfLandmark): Vec2[] => ('poly' in l.exclude ? l.exclude.poly : Array.from({ length: 32 }, (_, k) => ({ x: l.x + Math.cos((k / 32) * Math.PI * 2) * (l.exclude as { r: number }).r, z: l.z + Math.sin((k / 32) * Math.PI * 2) * (l.exclude as { r: number }).r })));
const segsCross = (a: Vec2, b: Vec2, c: Vec2, d: Vec2) => {
  const o = (p: Vec2, q: Vec2, r: Vec2) => Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};
const polysOverlap = (A: Vec2[], B: Vec2[]) => A.some(p => inPoly(p, B)) || B.some(p => inPoly(p, A)) || A.some((p, i) => B.some((q, j) => segsCross(p, A[(i + 1) % A.length], q, B[(j + 1) % B.length])));
const distToSeg = (p: Vec2, a: Vec2, b: Vec2) => {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};
const nearBlocker = (s: W4Site, p: Vec2, m: number) => (s.walk?.blockers ?? []).some(b => 'poly' in b && (inPoly(p, b.poly) || b.poly.some((a, k) => distToSeg(p, a, b.poly[(k + 1) % b.poly.length]) < m)));

const rasters = new Map<string, GroundRaster | null>();
async function walked(x: number, z: number): Promise<number> {
  const cx = Math.floor(x / 128), cz = Math.floor(z / 128), k = `${cx}_${cz}`;
  if (!rasters.has(k)) { const c = await sf.chunk(cx, cz); rasters.set(k, c ? groundRaster(c) : null); }
  const r = rasters.get(k);
  assert.ok(r, `chunk ${k}`);
  return rasterHeight(r, x, z);
}

/** what world/sf/sites.ts walkInputs() sends for a wave-4 site after the registration (numeric base, its landmarkSink) */
const walkInput = (s: W4Site): LandmarkWalkInput => ({
  id: s.id, x: s.x, z: s.z, yaw: s.yaw, base: s.base, baseY: s.base, exclude: { poly: exPoly(s) }, sink: landmarkSink(s),
  walk: s.walk ? JSON.parse(JSON.stringify(s.walk)) : undefined,
});
const groundTris = (s: W4Site) => (s.ground ?? []).reduce((a, q) => a + Math.max(0, q.poly.length - 2), 0);
/** the plan §4.2 flag pole in world coordinates (w4sites.ts siteFlagTop does the same once the list is merged) */
const flagWorld = (s: W4Site) => { const w = landmarkToWorld(s, s.w4.flag); return { x: +w.x.toFixed(2), z: +w.z.toFixed(2), h: s.w4.flag.h }; };

test('registry: tier-3 ids, numeric bases from the baked terrain, priority-4 attractions, placeIds near the site', () => {
  assert.ok(T3.length >= 1);
  const ids = T3.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const laneL = new Set(W4_SITES.map(s => s.id)), laneLAttr = new Set(W4_SITES.flatMap(s => s.w4.attractions));
  for (const s of T3) {
    assert.match(s.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.equal(sfLandmark(s.id), undefined, `${s.id} is not an existing landmark id`);
    assert.ok(!laneL.has(s.id), `${s.id} is not one of lane L's sites`);
    assert.equal(s.tier, 3, `${s.id} is a tier-3 site`);
    const t = SITE_TERRAIN3[s.id];
    assert.ok(t, `${s.id} has baked terrain (scripts/opus-sf/sites3-terrain.mts)`);
    assert.ok(!SITE_TERRAIN[s.id], `${s.id} is baked in siteTerrain3.ts only`);
    assert.equal(s.base, t.base, `${s.id} stands on its baked base`);
    const m = s.w4;
    assert.ok(m.attractions.length >= 1, `${s.id} models an attraction`);
    for (const a of m.attractions) {
      const rec = attractionById.get(a);
      assert.ok(rec, `${s.id}: attraction ${a} is in sf-w4-attractions.json`);
      assert.equal(rec.priority, 4, `${s.id}: ${a} is a priority-4 attraction`);
      assert.ok(!laneLAttr.has(a), `${s.id}: ${a} is not modelled by one of lane L's sites`);
      assert.ok(T3.filter(o => o.w4.attractions.includes(a)).length === 1, `${a} has one tier-3 record`);
      const d = Math.hypot(rec.x - s.x, rec.z - s.z);
      assert.ok(d < 70, `${s.id}: ${a} is ${d.toFixed(0)} u from the site`);
    }
    const row = placeById.get(m.placeId), extra = EXTRA_PLACES.find(e => e.id === m.placeId), re = PLACE_REANCHORS[m.placeId];
    assert.ok(row || extra, `${s.id}: place ${m.placeId} is a places.json row or a lane-P extra row`);
    const rec0 = attractionById.get(m.attractions[0])!;
    assert.equal(m.placeId, rec0.placeId ?? rec0.id, `${s.id}: the place row is the attraction's (sf-w4-attractions.json placeId, or its id for a new row)`);
    const px = re?.x ?? (row ?? extra)!.x, pz = re?.z ?? (row ?? extra)!.z;
    const ar = landmarkToWorld(s, m.arrival);
    assert.ok(Math.min(Math.hypot(px - s.x, pz - s.z), Math.hypot(px - ar.x, pz - ar.z)) < 45, `${s.id}: place ${m.placeId} near the site`);
    assert.ok(Number.isFinite(m.height.u) && m.height.u > 0, s.id);
    if (m.lod0R !== undefined) assert.ok(m.lod0R >= 120 && m.lod0R <= 520, s.id);
    assert.ok(m.photo.distance > 0 && Math.abs(m.photo.elevation) < 1.5 && m.photo.target.every(Number.isFinite), s.id);
    assert.equal(m.aiSlot, undefined, `${s.id}: tier-3 settings are procedural`);
  }
});

test('budgets: lod 0 (model + draped ground + animate part) ≤ 800 triangles, lod 2 ≤ 10 % of the model, at most 3 draw parts', () => {
  for (const s of T3) {
    const g0 = buildLandmark(s, 0, s.base), g2 = buildLandmark(s, 2, s.base), ga = buildLandmarkAnimated(s);
    const t0 = triCount(g0), t2 = triCount(g2), ta = ga ? triCount(ga) : 0, gt = groundTris(s);
    const cap = s.w4.budget ?? TIER_TRIANGLES[3];
    assert.ok(t0 > 0 && t2 > 0, s.id);
    assert.ok(t0 + gt + ta <= cap, `${s.id} lod0 ${t0} + ground ${gt} + animate ${ta} = ${t0 + gt + ta} ≤ ${cap}`);
    assert.ok(t2 <= t0 * 0.1 + 1e-9, `${s.id} lod2 ${t2} ≤ 10 % of ${t0}`);
    assert.ok(gt <= 400, `${s.id} ground ${gt} triangles`);
    const parts = 1 + (s.ground?.length ? 1 : 0) + (ga ? 1 : 0);
    assert.ok(parts <= 3, s.id);
    for (const g of [g0, g2]) {
      const p = g.getAttribute('position').array as Float32Array;
      for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), `${s.id} finite positions`);
    }
    console.log(`  ${s.id.padEnd(30)} lod0 ${t0} + ground ${gt} + animate ${ta} = ${t0 + gt + ta} / ${cap}  lod2 ${t2}  lod0R ${s.w4.lod0R ?? '-'}`);
  }
});

test('exclusions: contain the origin and every toy vertex, never overlap a landmark, a lane-L site, another tier-3 site or the hero slab', () => {
  const others = [...SF_LANDMARKS, ...W4_SITES].map(l => ({ id: l.id, poly: exPoly(l) }));
  for (const s of T3) {
    const ex = exPoly(s);
    assert.ok(inPoly({ x: s.x, z: s.z }, ex) || /origin at the crossing/.test(s.w4.notes ?? ''), `${s.id} exclude contains the origin`);
    for (const o of others) assert.ok(!polysOverlap(ex, o.poly), `${s.id} overlaps ${o.id}`);
    for (const o of T3) if (o !== s) assert.ok(!polysOverlap(ex, exPoly(o)), `${s.id} overlaps ${o.id}`);
    assert.ok(!polysOverlap(ex, DISTRICT.slab), `${s.id} overlaps the hero slab`);
    const local = ex.map(p => worldToLandmark(s, p));
    const pos = buildLandmark(s, 0, s.base).getAttribute('position');
    let out = 0, worst = 0;
    for (let i = 0; i < pos.count; i++) {
      const p = { x: pos.getX(i), z: pos.getZ(i) };
      if (inPoly(p, local)) continue;
      const d = Math.min(...local.map((a, k) => distToSeg(p, a, local[(k + 1) % local.length])));
      worst = Math.max(worst, d);
      if (d > 0.8) out++;
    }
    assert.equal(out, 0, `${s.id}: ${out} toy vertices outside the exclusion (worst ${worst.toFixed(2)} u)`);
  }
});

test('terrain: the baked grid and base match the published rasters (re-run scripts/opus-sf/sites3-terrain.mts)', async () => {
  for (const s of T3) {
    const t = SITE_TERRAIN3[s.id], g = site3Ground(s.id);
    const ex = exPoly(s), xs = ex.map(p => p.x), zs = ex.map(p => p.z);
    let lo = Infinity;
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.5) for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) if (inPoly({ x, z }, ex)) lo = Math.min(lo, await walked(x, z));
    for (const p of ex) lo = Math.min(lo, await walked(p.x, p.z));
    assert.equal(t.base, Math.floor(lo * 100) / 100, `${s.id} base`);
    for (let k = 0; k < t.h.length; k += 5) {
      const i = k % t.cols, j = Math.floor(k / t.cols);
      let hi = -Infinity;
      const pool = Math.min(0.5, t.step / 4);
      for (let dv = -pool; dv <= pool + 1e-9; dv += 0.25) for (let du = -pool; du <= pool + 1e-9; du += 0.25) {
        const w = landmarkToWorld(s, { x: t.x0 + i * t.step + du, z: t.z0 + j * t.step + dv });
        hi = Math.max(hi, await walked(w.x, w.z));
      }
      assert.ok(Math.abs(t.h[k] / 100 - (hi - t.base)) < 0.011, `${s.id} grid (${i}, ${j})`);
    }
    for (const q of s.ground ?? []) {
      assert.ok(q.ys && q.ys.length === q.poly.length, `${s.id} ground has per-vertex heights`);
      assert.ok(![1, 8, 9].includes(q.pattern), `${s.id} ground uses an angle pattern`);
      const lift = q.lift ?? (q.color === '#f4efe2' ? LIFT_STRIPE : LIFT);
      for (let i = 0; i < q.poly.length; i++) {
        const w = landmarkToWorld(s, q.poly[i]);
        const d = q.ys![i] - ((await walked(w.x, w.z)) - s.base);
        const wall = nearBlocker(s, q.poly[i], 1.1);
        assert.ok(d > lift - 0.08 && (wall || d < lift + 0.3), `${s.id} ground vertex (${q.poly[i].x.toFixed(1)}, ${q.poly[i].z.toFixed(1)}) ${d.toFixed(3)} over the ground`);
      }
      const c = { x: q.poly.reduce((a, p) => a + p.x, 0) / q.poly.length, z: q.poly.reduce((a, p) => a + p.z, 0) / q.poly.length };
      const w = landmarkToWorld(s, c), ym = q.ys!.reduce((a, y) => a + y, 0) / q.ys!.length;
      assert.ok(ym - ((await walked(w.x, w.z)) - s.base) > -0.02, `${s.id} ground centre (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) sinks ${(ym - ((await walked(w.x, w.z)) - s.base)).toFixed(3)}`);
    }
    assert.ok(Math.abs(g.at(0, 0) - ((await walked(s.x, s.z)) - s.base)) < 0.3, `${s.id} lookup at the origin`);
  }
});

test('walk data: valid blockers; arrivals clear, standable and reachable from the walking graph; walk-around ring ≥ 75 %', async () => {
  const lms = [...landmarkWalkInputs(SF_LANDMARKS), ...W4_SITES.map(walkInput), ...T3.map(walkInput)];
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const ix = await sf.graphIndex();
  const main = ix.mainComponent();
  for (const s of T3) {
    for (const b of s.walk?.blockers ?? []) {
      if ('poly' in b) assert.ok(b.poly.length >= 3 && b.poly.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)), s.id);
      else assert.ok(b.r > 0, s.id);
    }
    const blocked = (p: Vec2) => (s.walk?.blockers ?? []).some(b => ('poly' in b ? inPoly(p, b.poly) : Math.hypot(p.x - b.x, p.z - b.z) < b.r + 0.3));
    const ar = s.w4.arrival;
    assert.ok(!blocked(ar), `${s.id} arrival is clear of its blockers`);
    assert.ok(Math.hypot(ar.x, ar.z) < 45, `${s.id} arrival within reach of the site`);
    await sf.attachAround(city, s.x, s.z, 110, lms);
    setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
    try {
      const w = landmarkToWorld(s, ar);
      assert.ok(canStand(w.x, w.z, 0.4), `${s.id} arrival (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) is standable`);
      const n = ix.nearestNode(w.x, w.z, 40, i => ix.component(i) === main);
      assert.ok(n >= 0, `${s.id} a street of the main walking network within 40 u`);
      const path = findPath({ x: ix.x(n), z: ix.z(n) }, w, 8);
      assert.ok(path && path.points.length >= 1, `${s.id} a path from the walking graph node to the arrival`);
      let rmax = 0;
      for (const b of s.walk?.blockers ?? []) for (const p of 'poly' in b ? b.poly : [{ x: b.x, z: b.z }]) rmax = Math.max(rmax, Math.hypot(p.x, p.z) + ('r' in b ? b.r : 0));
      let open = 0, land = 0;
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2, q = landmarkToWorld(s, { x: Math.sin(a) * (rmax + 3), z: Math.cos(a) * (rmax + 3) });
        if (city.surfaceCode(q.x, q.z) === 0 && !canStand(q.x, q.z, 0.3)) continue;
        land++;
        if (canStand(q.x, q.z, 0.4)) open++;
      }
      const f = land ? open / land : 0;
      console.log(`  ${s.id.padEnd(30)} arrival ok · ring r ${(rmax + 3).toFixed(1)} u: ${(f * 100).toFixed(0)} % open`);
      const min = s.w4.ringMin ?? 0.75;
      if (min < 0.75) assert.ok(min >= 0.6 && /ring/i.test(s.w4.notes ?? ''), `${s.id} explains its lower ring`);
      assert.ok(f >= min, `${s.id} walk-around ring ${(f * 100).toFixed(0)} % ≥ ${(min * 100).toFixed(0)} %`);
      const over: number[] = [];
      for (const q of s.ground ?? []) {
        const c = { x: q.poly.reduce((a, p) => a + p.x, 0) / q.poly.length, z: q.poly.reduce((a, p) => a + p.z, 0) / q.poly.length };
        const cw = landmarkToWorld(s, c), walk = heightAt(cw.x, cw.z);
        if (!q.ys || !Number.isFinite(walk) || !canStand(cw.x, cw.z, 0.3)) continue;
        over.push(s.base + q.ys.reduce((a, y) => a + y, 0) / q.ys.length - walk - (q.lift ?? LIFT));
      }
      if (over.length) {
        const mean = over.reduce((a, d) => a + d, 0) / over.length, worst = Math.max(...over);
        assert.ok(mean <= 0.15 && worst <= 0.5, `${s.id} draped ground over the walk height beyond its lift: mean ${mean.toFixed(3)}, worst ${worst.toFixed(3)} u (${over.length} pieces)`);
      }
    } finally { setCityTerrain(null); }
  }
});

test('integration safety: the tier-3 list is cycle-free, the sites keep an unsunk ground, the tops generator measures them', () => {
  const dir = new URL('../src/opus-bay/world/sf/landmarks/', import.meta.url);
  const FORBIDDEN = new Set(['./index', './w4sites', './context', '../sites']);
  const seen = new Set<string>(), queue = ['w4list3'];
  while (queue.length) {
    const name = queue.pop()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const src = readFileSync(new URL(`${name}.ts`, dir), 'utf8');
    for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)';/gms)) {
      const [, typeOnly, from] = m;
      if (typeOnly) continue;
      assert.ok(!FORBIDDEN.has(from), `${name}.ts imports ${from} at runtime (only \`import type\` may reach the registry)`);
      if (from.startsWith('./')) queue.push(from.slice(2));
    }
  }
  assert.ok(seen.has('siteKit3') && seen.has('siteTerrain3') && seen.size >= T3.length + 3, `the graph reaches the kit and every site module (${seen.size})`);
  for (const s of T3) {
    assert.equal(landmarkSink(s), 0, s.id);
    const t = measureTops(s, new Map());
    assert.equal(t.blockers.length, s.walk?.blockers.length ?? 0, s.id);
    assert.equal(t.tall.length, s.tall?.length ?? 0, s.id);
    for (const v of [...t.blockers, ...t.tall]) assert.ok(Number.isFinite(v) && v > 0 && v < 30, `${s.id} measured top ${v}`);
  }
});

test('streets: every street the exclusion cuts is continued by the site ground, and the ones it passes keep their width', async () => {
  const KEEP = new Set(['primary', 'secondary', 'tertiary', 'residential', 'pedestrian', 'tram', 'rail', 'trunk']);
  for (const s of T3) {
    const ex = exPoly(s), xs = ex.map(p => p.x), zs = ex.map(p => p.z);
    const cover = (s.ground ?? []).map(q => q.poly.map(p => landmarkToWorld(s, p)));
    let inside = 0, covered = 0;
    const seen = new Set<string>(), clipped: string[] = [];
    for (let cz = Math.floor(Math.min(...zs) / 128); cz <= Math.floor(Math.max(...zs) / 128); cz++) for (let cx = Math.floor(Math.min(...xs) / 128); cx <= Math.floor(Math.max(...xs) / 128); cx++) {
      const c = await sf.chunk(cx, cz);
      if (!c) continue;
      const rd = c.roads;
      for (let i = 0; i < rd.count; i++) {
        if (!KEEP.has(ROAD_CLASSES[rd.cls[i]])) continue;
        for (let k = rd.pStart[i]; k + 1 < rd.pStart[i + 1]; k++) {
          const a = { x: rd.xyz[k * 3], z: rd.xyz[k * 3 + 2] }, b = { x: rd.xyz[k * 3 + 3], z: rd.xyz[k * 3 + 5] };
          const L = Math.hypot(b.x - a.x, b.z - a.z);
          for (let t = 0; t <= L; t += 1) {
            const p = { x: a.x + ((b.x - a.x) * t) / (L || 1), z: a.z + ((b.z - a.z) * t) / (L || 1) };
            const key = `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (!inPoly(p, ex)) {
              const d = Math.min(...ex.map((q, j) => distToSeg(p, q, ex[(j + 1) % ex.length])));
              if (d < rd.width[i] / 2 - 0.35 && !cover.some(q => inPoly(p, q))) clipped.push(`${ROAD_CLASSES[rd.cls[i]]} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) ${d.toFixed(2)} u from the edge (half width ${(rd.width[i] / 2).toFixed(1)})`);
              continue;
            }
            inside++;
            if (cover.some(q => inPoly(p, q))) covered++;
            else console.log(`  ${s.id}: ${ROAD_CLASSES[rd.cls[i]]} ${rd.nameIdx[i] === NO_NAME ? '' : '(named)'} uncovered at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
          }
        }
      }
    }
    assert.ok(inside === 0 || covered / inside >= 0.9, `${s.id}: ${covered} / ${inside} street samples inside the exclusion covered`);
    assert.ok(clipped.length <= 2, `${s.id}: the exclusion clips city streets: ${clipped.slice(0, 6).join('; ')}`);
  }
});

test('flags (plan §4.2) and settings: poles 28–70 u over the site, plazas ≥ 30 u², lamps light the night, no text or logo parts', () => {
  for (const s of T3) {
    const f = flagWorld(s);
    assert.ok(f.h >= ATTRACTION_FLAG_H.min && f.h <= ATTRACTION_FLAG_H.max, `${s.id} flag ${f.h}`);
    assert.ok(inPoly(f, exPoly(s)), `${s.id} flag foot inside the site`);
    const g = buildLandmark(s, 0, 0);
    g.computeBoundingBox();
    const top = g.boundingBox!.max.y;
    assert.ok(f.h >= top + 8 || f.h === 30 || f.h === ATTRACTION_FLAG_H.max, `${s.id} flag ${f.h} over the skyline ${top.toFixed(1)}`);
    const plaza = (s.plaza ?? []).reduce((a, p) => a + polyArea(p.poly), 0);
    assert.ok(plaza >= 30, `${s.id} plaza ${plaza.toFixed(0)} u²`);
    for (const l of s.lights ?? []) assert.ok([l.x, l.y, l.z, l.size].every(Number.isFinite) && /^#[0-9a-f]{6}$/i.test(l.color), s.id);
    for (const k of Object.keys(s)) assert.ok(!/material|texture|label|sign|logo/i.test(k), `${s.id}.${k}`);
    assert.equal(s.swap, undefined, s.id);
  }
});
