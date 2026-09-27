import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { type GroundRaster, type LandmarkWalkInput, createCityTerrain, groundRaster, landmarkWalkInputs, rasterHeight } from '../src/opus-bay/core/sfTerrain';
import { canStand, pointInPolygon, setCityTerrain } from '../src/opus-bay/core/terrain';
import type { Vec2 } from '../src/opus-bay/core/types';
import { findPath } from '../src/opus-bay/actors/nav';
import { ATTRACTION_FLAG_H } from '../src/opus-bay/data/sf/attractionTypes';
import { EXTRA_PLACES, PLACE_REANCHORS } from '../src/opus-bay/data/sf/extraPlaces';
import { DISTRICT } from '../src/opus-bay/data/district';
import { NO_NAME, ROAD_CLASSES } from '../src/opus-bay/world/sf/format';
import { SF_LANDMARKS, TIER_TRIANGLES, type SfLandmark, buildLandmark, buildLandmarkAnimated, landmarkToWorld, sfLandmark, worldToLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { LIFT, LIFT_STRIPE, type W4Site, polyArea, siteGround } from '../src/opus-bay/world/sf/landmarks/siteKit';
import { SITE_TERRAIN } from '../src/opus-bay/world/sf/landmarks/siteTerrain';
import { HERO_FLAGS, LANDMARK_FLAGS, W4_SITES, flagHeight, siteFlagTop, w4Site, w4SiteOf } from '../src/opus-bay/world/sf/landmarks/w4sites';
import { sfDisk } from './opus-bay-sf-disk';

// Wave-4 landmark sites (lane L, plan §2.2 / §5.4): the new site modules built in node against the published city
// (public/opus-bay/sf/v1). They are not registered yet (integration phase), so everything here uses them directly.

const sf = sfDisk();
const attractions = (JSON.parse(readFileSync(new URL('../docs/opus-bay/sf-w4-attractions.json', import.meta.url), 'utf8')) as { attractions: { id: string; x: number; z: number; placeId: string | null; treatment: string; mapRank: number }[] }).attractions;
const places = (JSON.parse(readFileSync(new URL('../public/opus-bay/sf/v1/places.json', import.meta.url), 'utf8')) as { places: { id: string; x: number; z: number }[] }).places;
const placeById = new Map(places.map(p => [p.id, p]));
const attractionById = new Map(attractions.map(a => [a.id, a]));

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

/** is local point p within m of one of the site's polygon blockers (its buildings)? */
const nearBlocker = (s: W4Site, p: Vec2, m: number) => (s.walk?.blockers ?? []).some(b => 'poly' in b && (inPoly(p, b.poly) || b.poly.some((a, k) => distToSeg(p, a, b.poly[(k + 1) % b.poly.length]) < m)));

const rasters = new Map<string, GroundRaster | null>();
async function walked(x: number, z: number): Promise<number> {
  const cx = Math.floor(x / 128), cz = Math.floor(z / 128), k = `${cx}_${cz}`;
  if (!rasters.has(k)) { const c = await sf.chunk(cx, cz); rasters.set(k, c ? groundRaster(c) : null); }
  const r = rasters.get(k);
  assert.ok(r, `chunk ${k}`);
  return rasterHeight(r, x, z);
}

/** what world/sf/sites.ts walkInputs() sends for a wave-4 site after the integration (numeric base, sink 0) */
const walkInput = (s: W4Site): LandmarkWalkInput => ({
  id: s.id, x: s.x, z: s.z, yaw: s.yaw, base: s.base, baseY: s.base, exclude: { poly: exPoly(s) }, sink: 0,
  walk: s.walk ? JSON.parse(JSON.stringify(s.walk)) : undefined,
});

test('registry: ids, tiers, numeric bases from the baked terrain, metadata, attractions and placeIds', () => {
  assert.ok(W4_SITES.length >= 1);
  const ids = W4_SITES.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of W4_SITES) {
    assert.match(s.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.equal(sfLandmark(s.id), undefined, `${s.id} is not an existing landmark id`);
    assert.ok([1, 2, 3].includes(s.tier), s.id);
    assert.equal(w4Site(s.id), s);
    const t = SITE_TERRAIN[s.id];
    assert.ok(t, `${s.id} has baked terrain (scripts/opus-sf/sites-terrain.mts)`);
    assert.equal(s.base, t.base, `${s.id} stands on its baked base`);
    const m = s.w4;
    // a shared setting (the Music Concourse bowl) models no attraction of its own and names an existing place row
    assert.ok(m.placeId && (m.attractions.length || placeById.has(m.placeId)), s.id);
    for (const a of m.attractions) {
      const rec = attractionById.get(a);
      assert.ok(rec, `${s.id}: attraction ${a} is in sf-w4-attractions.json`);
      assert.equal(w4SiteOf(a)?.id === s.id || W4_SITES.some(o => o.id !== s.id && o.w4.attractions.includes(a)), true);
      const d = Math.hypot(rec.x - s.x, rec.z - s.z);
      assert.ok(d < 70, `${s.id}: ${a} is ${d.toFixed(0)} u from the site`);
    }
    // the place row: an existing places.json row (with lane P's wave-4 re-anchor) near the site, or one of lane P's new
    // extraPlaces rows (ids = the attraction ids), also near it
    const row = placeById.get(m.placeId), extra = EXTRA_PLACES.find(e => e.id === m.placeId), re = PLACE_REANCHORS[m.placeId];
    assert.ok(row || extra, `${s.id}: place ${m.placeId} is a places.json row or a lane-P extra row`);
    const px = re?.x ?? (row ?? extra)!.x, pz = re?.z ?? (row ?? extra)!.z;
    const ar = landmarkToWorld(s, m.arrival);
    assert.ok(Math.min(Math.hypot(px - s.x, pz - s.z), Math.hypot(px - ar.x, pz - ar.z)) < 45, `${s.id}: place ${m.placeId} near the site`);
    if (extra) assert.ok(m.attractions.includes(m.placeId) || W4_SITES.some(o => o.w4.attractions.includes(m.placeId)), `${s.id}: ${m.placeId} is modelled`);
    assert.ok(Number.isFinite(m.height.u) && m.height.u > 0, s.id);
    if (m.lod0R !== undefined) assert.ok(m.lod0R >= 120 && m.lod0R <= 520, s.id);
    assert.ok(m.photo.distance > 0 && Math.abs(m.photo.elevation) < 1.5 && m.photo.target.every(Number.isFinite), s.id);
  }
});

test('budgets: lod 0 within the tier (or diet) cap, lod 2 ≤ 10 % of it, small ground, at most 3 draw parts', () => {
  for (const s of W4_SITES) {
    const g0 = buildLandmark(s, 0, s.base), g2 = buildLandmark(s, 2, s.base);
    const t0 = triCount(g0), t2 = triCount(g2);
    const cap = s.w4.budget ?? (s.swap ? 6000 : TIER_TRIANGLES[s.tier]);
    assert.ok(t0 > 0 && t2 > 0, s.id);
    assert.ok(t0 <= cap, `${s.id} lod0 ${t0} ≤ ${cap}`);
    assert.ok(t2 <= t0 * 0.1 + 1e-9, `${s.id} lod2 ${t2} ≤ 10 % of ${t0}`);
    let gt = 0;
    for (const q of s.ground ?? []) gt += Math.max(0, q.poly.length - 2);
    assert.ok(gt <= 900, `${s.id} ground ${gt} triangles`);
    const parts = 1 + (s.ground?.length ? 1 : 0) + (buildLandmarkAnimated(s) ? 1 : 0);
    assert.ok(parts <= 3, s.id);
    for (const g of [g0, g2]) {
      const p = g.getAttribute('position').array as Float32Array;
      for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), `${s.id} finite positions`);
    }
    console.log(`  ${s.id.padEnd(24)} T${s.tier} lod0 ${t0} / ${cap}  lod2 ${t2}  ground ${gt}  lod0R ${s.w4.lod0R ?? '-'}`);
  }
});

test('exclusions: contain the origin and every toy vertex, never overlap another landmark, site or the hero slab', () => {
  const others = SF_LANDMARKS.map(l => ({ id: l.id, poly: exPoly(l) }));
  for (const s of W4_SITES) {
    const ex = exPoly(s);
    // the origin is inside the footprint, except a street-corner site whose origin is the crossing (it says so)
    assert.ok(inPoly({ x: s.x, z: s.z }, ex) || /origin at the crossing/.test(s.w4.notes ?? ''), `${s.id} exclude contains the origin`);
    for (const o of others) assert.ok(!polysOverlap(ex, o.poly), `${s.id} overlaps ${o.id}`);
    for (const o of W4_SITES) if (o !== s) assert.ok(!polysOverlap(ex, exPoly(o)), `${s.id} overlaps ${o.id}`);
    assert.ok(!polysOverlap(ex, DISTRICT.slab), `${s.id} overlaps the hero slab`);
    // the model stays inside its footprint (+0.8 u: eaves, canopies, lamp heads)
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

test('terrain: the baked grid and base match the published rasters (re-run scripts/opus-sf/sites-terrain.mts)', async () => {
  for (const s of W4_SITES) {
    const t = SITE_TERRAIN[s.id], g = siteGround(s.id);
    // base = the lowest walked ground inside the exclusion
    const ex = exPoly(s), xs = ex.map(p => p.x), zs = ex.map(p => p.z);
    let lo = Infinity;
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.5) for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) if (inPoly({ x, z }, ex)) lo = Math.min(lo, await walked(x, z));
    for (const p of ex) lo = Math.min(lo, await walked(p.x, p.z));
    assert.equal(t.base, Math.floor(lo * 100) / 100, `${s.id} base`);
    for (let k = 0; k < t.h.length; k += 7) {
      const i = k % t.cols, j = Math.floor(k / t.cols);
      let hi = -Infinity;
      const pool = Math.min(0.5, t.step / 4);
      for (let dv = -pool; dv <= pool + 1e-9; dv += 0.25) for (let du = -pool; du <= pool + 1e-9; du += 0.25) {
        const w = landmarkToWorld(s, { x: t.x0 + i * t.step + du, z: t.z0 + j * t.step + dv });
        hi = Math.max(hi, await walked(w.x, w.z));
      }
      assert.ok(Math.abs(t.h[k] / 100 - (hi - t.base)) < 0.011, `${s.id} grid (${i}, ${j})`);
    }
    // every ground polygon is draped: vertices just above the walked ground (plazas LIFT, crosswalk stripes over the asphalt)
    for (const q of s.ground ?? []) {
      assert.ok(q.ys && q.ys.length === q.poly.length, `${s.id} ground has per-vertex heights`);
      assert.ok(![1, 8, 9].includes(q.pattern), `${s.id} ground uses an angle pattern`);
      const lift = q.lift ?? (q.color === '#f4efe2' ? LIFT_STRIPE : LIFT);
      for (let i = 0; i < q.poly.length; i++) {
        const w = landmarkToWorld(s, q.poly[i]);
        const d = q.ys![i] - ((await walked(w.x, w.z)) - s.base);
        // never under the ground; at most a kerb over it, except against a wall (the ground rises onto building pads there)
        const wall = nearBlocker(s, q.poly[i], 1.1);
        assert.ok(d > lift - 0.08 && (wall || d < lift + 0.3), `${s.id} ground vertex (${q.poly[i].x.toFixed(1)}, ${q.poly[i].z.toFixed(1)}) ${d.toFixed(3)} over the ground`);
      }
      // the centre of each piece does not sink under the ground (the slope between the corners)
      const c = { x: q.poly.reduce((a, p) => a + p.x, 0) / q.poly.length, z: q.poly.reduce((a, p) => a + p.z, 0) / q.poly.length };
      const w = landmarkToWorld(s, c), ym = q.ys!.reduce((a, y) => a + y, 0) / q.ys!.length;
      assert.ok(ym - ((await walked(w.x, w.z)) - s.base) > -0.02, `${s.id} ground centre (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) sinks ${(ym - ((await walked(w.x, w.z)) - s.base)).toFixed(3)}`);
    }
    assert.ok(Math.abs(g.at(0, 0) - ((await walked(s.x, s.z)) - s.base)) < 0.3, `${s.id} lookup at the origin`);
  }
});

test('walk data: valid blockers; arrivals clear, standable and reachable from the walking graph; walk-around ring ≥ 75 %', async () => {
  const lms = [...landmarkWalkInputs(SF_LANDMARKS), ...W4_SITES.map(walkInput)];
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const ix = await sf.graphIndex();
  const main = ix.mainComponent();
  for (const s of W4_SITES) {
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
      // walk-around ring: just outside the site's blockers, most of the way around is open ground
      let rmax = 0;
      for (const b of s.walk?.blockers ?? []) for (const p of 'poly' in b ? b.poly : [{ x: b.x, z: b.z }]) rmax = Math.max(rmax, Math.hypot(p.x, p.z) + ('r' in b ? b.r : 0));
      let open = 0, land = 0;
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2, q = landmarkToWorld(s, { x: Math.sin(a) * (rmax + 3), z: Math.cos(a) * (rmax + 3) });
        if (city.surfaceCode(q.x, q.z) === 0 && !canStand(q.x, q.z, 0.3)) continue; // water / off the map
        land++;
        if (canStand(q.x, q.z, 0.4)) open++;
      }
      const f = land ? open / land : 0;
      console.log(`  ${s.id.padEnd(24)} arrival ok · ring r ${(rmax + 3).toFixed(1)} u: ${(f * 100).toFixed(0)} % open`);
      const min = s.w4.ringMin ?? 0.75;
      if (min < 0.75) assert.ok(min >= 0.6 && /ring/i.test(s.w4.notes ?? ''), `${s.id} explains its lower ring`);
      assert.ok(f >= min, `${s.id} walk-around ring ${(f * 100).toFixed(0)} % ≥ ${(min * 100).toFixed(0)} %`);
    } finally { setCityTerrain(null); }
  }
});

test('streets: every street the exclusion cuts is continued by the site ground, and the ones it passes keep their width', async () => {
  const KEEP = new Set(['primary', 'secondary', 'tertiary', 'residential', 'pedestrian', 'tram', 'rail', 'trunk']);
  for (const s of W4_SITES) {
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
              // a street that stays the city's keeps its whole width: the exclusion never clips its ribbon
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

test('flags (plan §4.2): every site, landmark and T1 hero has a pole 28–70 u; the landmark table matches the models', () => {
  for (const s of W4_SITES) {
    const f = siteFlagTop(s.id);
    assert.ok(f, s.id);
    assert.ok(f.h >= ATTRACTION_FLAG_H.min && f.h <= ATTRACTION_FLAG_H.max, `${s.id} flag ${f.h}`);
    // an attraction or place id answers with its primary record (the first that models it)
    for (const a of s.w4.attractions) if (w4SiteOf(a) === s) assert.deepEqual(siteFlagTop(a), f, a);
    if (w4SiteOf(s.w4.placeId) === s) assert.deepEqual(siteFlagTop(s.w4.placeId), f);
    // over the site: the pole foot inside the exclusion, the top over the model's skyline
    assert.ok(inPoly(f, exPoly(s)), `${s.id} flag foot inside the site`);
    const g = buildLandmark(s, 0, 0);
    g.computeBoundingBox();
    const top = g.boundingBox!.max.y;
    assert.ok(f.h >= top + 8 || f.h === 30 || f.h === ATTRACTION_FLAG_H.max, `${s.id} flag ${f.h} over the skyline ${top.toFixed(1)}`);
  }
  for (const l of SF_LANDMARKS) {
    const f = LANDMARK_FLAGS[l.id];
    assert.ok(f, `${l.id} has a flag`);
    const g = buildLandmark(l, 0, 0), pos = g.getAttribute('position');
    let hi = -Infinity;
    for (let i = 0; i < pos.count; i++) hi = Math.max(hi, pos.getY(i));
    const want = l.id === 'golden-gate-bridge' ? 50.2 : flagHeight(hi);
    assert.ok(Math.abs(f.h - want) < 0.6, `${l.id}: flag ${f.h} vs ${want.toFixed(2)} (top ${hi.toFixed(2)})`);
    const w = siteFlagTop(l.id)!;
    assert.ok(w.h >= 28 && w.h <= 70 && Math.hypot(w.x - l.x, w.z - l.z) < (l.id === 'golden-gate-bridge' ? 95 : 25), l.id);
  }
  for (const [id, f] of Object.entries(HERO_FLAGS)) assert.deepEqual(siteFlagTop(id), f, id);
  // place-id aliases of the existing landmarks (D2-12) answer too
  assert.deepEqual(siteFlagTop('ggb-south-tower'), siteFlagTop('golden-gate-bridge'));
  assert.deepEqual(siteFlagTop('de-young'), siteFlagTop('de-young-tower'));
  assert.equal(siteFlagTop('no-such-place'), null);
});

test('settings: plazas ≥ 30 u², lamps light the night, no text or logo parts, AI slots for lane V', () => {
  for (const s of W4_SITES) {
    const plaza = (s.plaza ?? []).reduce((a, p) => a + polyArea(p.poly), 0);
    assert.ok(plaza >= 30, `${s.id} plaza ${plaza.toFixed(0)} u²`);
    for (const l of s.lights ?? []) assert.ok([l.x, l.y, l.z, l.size].every(Number.isFinite) && /^#[0-9a-f]{6}$/i.test(l.color), s.id);
    // declarative records only: no materials, textures or labels (every surface is the shared TOY / GROUND)
    for (const k of Object.keys(s)) assert.ok(!/material|texture|label|sign|logo/i.test(k), `${s.id}.${k}`);
    for (const p of s.swap?.parts ?? []) assert.ok(!/logo|sign|text/i.test(p.model), `${s.id}: ${p.model}`);
    if (s.w4.aiSlot) assert.match(s.w4.aiSlot.model, /^w4-[a-z0-9-]+$/, s.id);
  }
});
