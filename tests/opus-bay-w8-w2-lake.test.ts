import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { LAKE_LINES, LAKE_SPOTS, westLinesDue, westVisits, type WestVisits } from '../src/opus-bay/world/sf/westLines';
import { LAKE_RANGE, buildLake, lakeDist2 } from '../src/opus-bay/world/sf/westLake';
import {
  BOAT, BOATS, BOATS_FROM, BOATS_NIGHT_MAX, BOAT_PARTS, DUCKS, HERON, LAKE_CAPACITY, LAKE_CENTRE, LAKE_Y, MOORED, type Boat, boatAt, paintLake, poseLake,
} from '../src/opus-bay/world/sf/westLakePose';
import type { InstanceSink } from '../src/opus-bay/world/sf/westSeaPose';

/**
 * Wave 8 · lane W2 · part b: Blue Heron Lake's toy boats, ducks and heron (world/sf/westLake.ts, westLakePose.ts): one
 * InstancedMesh in city mode, every boat on the published lake's water, BAYBAY's fixed lines.
 */

class Sink implements InstanceSink {
  readonly mats = new Map<number, THREE.Matrix4>();
  readonly cols = new Map<number, THREE.Color>();
  setMatrixAt(i: number, m: THREE.Matrix4) { this.mats.set(i, m.clone()); }
  setColorAt(i: number, c: THREE.Color) { this.cols.set(i, c.clone()); }
}

test('W8-W2 lake: every instance painted, the boats out by day only, one small mesh', () => {
  const s = new Sink();
  paintLake(s);
  assert.equal(s.cols.size, LAKE_CAPACITY);
  for (const t of [0, 3.3, 47, 600.5]) {
    const day = new Sink(), night = new Sink();
    assert.equal(poseLake(day, t, 0), LAKE_CAPACITY, `day count at t ${t}`);
    assert.equal(poseLake(night, t, 1), BOATS_FROM, `night count at t ${t}`);
    assert.equal(poseLake(new Sink(), t, BOATS_NIGHT_MAX + 0.01), BOATS_FROM, 'dusk: the boats are back');
    assert.equal(day.mats.size, LAKE_CAPACITY, 'every instance written by day');
    for (const [i, m] of day.mats) for (const e of m.elements) assert.ok(Number.isFinite(e), `instance ${i} at t ${t}`);
  }
  const mesh = buildLake();
  assert.equal(mesh.count, 0);
  assert.ok(LAKE_CAPACITY * 80 <= 10_000, `${LAKE_CAPACITY * 80} triangles at most`);
  mesh.geometry.dispose();
  assert.ok(BOATS.length >= 8 && BOATS.filter(b => b.kind === 'row').length >= 3 && BOATS.filter(b => b.kind === 'pedal').length >= 4);
});

test('W8-W2 lake: two boats sharing a basin stay apart, every boat keeps moving', () => {
  const at = (b: Boat, t: number) => boatAt(b, t, { x: 0, z: 0, yaw: 0 });
  for (let a = 0; a < BOATS.length; a++) for (let b = a + 1; b < BOATS.length; b++) {
    let min = Infinity;
    for (let t = 0; t < 400; t += 0.5) { const p = at(BOATS[a], t), q = at(BOATS[b], t); min = Math.min(min, Math.hypot(p.x - q.x, p.z - q.z)); }
    assert.ok(min > 2.2, `boats ${a} and ${b} come within ${min.toFixed(2)} u`);
  }
  for (const b of BOATS) {
    const p = at(b, 0), q = at(b, 1);
    const v = Math.hypot(q.x - p.x, q.z - p.z);
    assert.ok(v > 0.1 && v < 0.6, `a boat moves ${v.toFixed(2)} u / s`);
    // the heading is the direction of travel
    const yaw = Math.atan2(q.x - p.x, q.z - p.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw))) < 0.5, 'bow first');
  }
});

test('W8-W2 lake: the boats, the ducks and the moored boats are on the published lake\'s water; the heron on its shore', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { heightAt, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { AREA_CLASSES, AREA_FLAG, demSample } = await import('../src/opus-bay/world/sf/format');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  const far = await sf.far();
  city.setFar(far);
  await sf.attachAround(city, LAKE_CENTRE.x, LAKE_CENTRE.z, 60, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    /** the hull's outline grown by `margin` (u) is water all round */
    const hullOnWater = (x: number, z: number, yaw: number, kind: 'pedal' | 'row', margin: number) => {
      const d = BOAT[kind], fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, l = Math.cos(a) * (d.len / 2 + margin), w = Math.sin(a) * (d.beam / 2 + margin);
        if (!isWater(x + fx * l + fz * w, z + fz * l - fx * w)) return false;
      }
      return isWater(x, z);
    };
    for (const [k, b] of BOATS.entries()) {
      for (let t = 0; t < (2 * Math.PI * b.r) / Math.abs(b.v); t += 0.5) {
        const p = boatAt(b, t);
        assert.ok(hullOnWater(p.x, p.z, p.yaw, b.kind, 0.3), `boat ${k} touches the bank at t ${t.toFixed(1)} (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
      }
    }
    for (const [k, m] of MOORED.entries()) assert.ok(hullOnWater(m[0], m[1], m[2], m[3], 0.05), `moored boat ${k} on the water`);
    for (const [k, d] of DUCKS.entries()) for (let a = 0; a < Math.PI * 2; a += 0.3) assert.ok(isWater(d[0] + Math.cos(a) * (d[2] + 0.3), d[1] + Math.sin(a) * (d[2] + 0.3)), `duck ${k}`);
    // the heron stands on the island's ground, facing the water ≤ 3 u in front of it
    assert.ok(!isWater(HERON.x, HERON.z), 'the heron on land');
    assert.ok(Math.abs(heightAt(HERON.x, HERON.z) - HERON.y) < 0.2, `the heron's ground ${heightAt(HERON.x, HERON.z).toFixed(2)} vs ${HERON.y}`);
    let wet = false;
    for (let d = 0.5; d <= 3; d += 0.25) wet ||= isWater(HERON.x + Math.sin(HERON.heading) * d, HERON.z + Math.cos(HERON.heading) * d);
    assert.ok(wet, 'water in front of the heron');
    // LAKE_Y is the drawn lake surface: world/sf/far.ts's rule (the lowest shore point of the far ring less 0.2)
    const ar = far.areas, W = AREA_CLASSES.indexOf('water');
    let level = NaN;
    for (let i = 0; i < ar.count; i++) {
      if (ar.cls[i] !== W || (ar.flags[i] & AREA_FLAG.hole)) continue;
      const i0 = ar.pStart[i], i1 = ar.pStart[i + 1];
      let cx = 0, cz = 0, lo = Infinity;
      for (let p = i0; p < i1; p++) { cx += ar.xz[p * 2]; cz += ar.xz[p * 2 + 1]; lo = Math.min(lo, demSample(far.dem, ar.xz[p * 2], ar.xz[p * 2 + 1])); }
      if (Math.hypot(cx / (i1 - i0) - LAKE_CENTRE.x, cz / (i1 - i0) - LAKE_CENTRE.z) < 30) level = lo - 0.2;
    }
    assert.ok(Math.abs(level - LAKE_Y) < 0.02, `the lake's surface ${level.toFixed(3)} vs LAKE_Y ${LAKE_Y}`);
  } finally {
    setCityTerrain(null);
  }
});

test('W8-W2 lake: BAYBAY\'s lake lines are fixed zh + en, by day at the lake, the boathouse line any time', () => {
  for (const l of Object.values(LAKE_LINES)) {
    assert.ok([...l.text.zh].length <= 45, `zh ≤ 45: ${l.text.zh}`);
    assert.ok(!/[{}$%]/.test(l.text.zh + l.text.en) && !/[㐀-鿿]/.test(l.text.en), l.id);
  }
  const lake = LAKE_SPOTS.find(s => s.id === 'lake')!, house = LAKE_SPOTS.find(s => s.id === 'boathouse')!;
  const due = (x: number, z: number, night: number) => { const v: WestVisits = new Map(); westVisits(x, z, night, v, new Set(), true, LAKE_SPOTS); return westLinesDue(v, new Set(), LAKE_SPOTS).map(l => l.id); };
  assert.deepEqual(due(lake.at.x, lake.at.z, 0), [LAKE_LINES.boats.id]);
  assert.deepEqual(due(house.at.x, house.at.z, 1), [LAKE_LINES.since.id], 'the boathouse at night');
  assert.deepEqual(due(lake.at.x, lake.at.z, 1), [], 'no boats at night: quiet');
  for (const s of LAKE_SPOTS) assert.ok(Math.sqrt(lakeDist2(s.at.x, s.at.z)) + s.r < LAKE_RANGE, 'spots inside the draw range');
  assert.equal(BOAT_PARTS, 8);
});

test('W8-W2 the Blue Heron Lake Boathouse: a plain site on the OSM lot that drops the generic house, T3 budget, its landing at the water', async () => {
  const { blueHeronBoathouse: l, BOATHOUSE_BASE } = await import('../src/opus-bay/world/sf/westBoathouse');
  const { SF_SITES, buildLandmark, sfLandmark, triangleBudget } = await import('../src/opus-bay/world/sf/landmarks/index');
  assert.equal(sfLandmark('blue-heron-boathouse'), l);
  assert.ok(SF_SITES.includes(l));
  // OSM way 120479803's outline (world x, z; the project's snapshot) lies inside the exclusion: the city's box goes
  const OSM: [number, number][] = [[-308.21, 1024.93], [-307.26, 1025.92], [-304.86, 1023.62], [-305.02, 1023.45], [-304.51, 1022.97], [-305.3, 1022.15]];
  const poly = 'poly' in l.exclude ? l.exclude.poly : [];
  const inPoly = (x: number, z: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; } return c; };
  for (const [x, z] of OSM) assert.ok(inPoly(x, z), `OSM corner (${x}, ${z}) inside the exclusion`);
  // the moored boats lie outside it (on the water), within 3.5 u of the lodge
  for (const m of MOORED) { assert.ok(!inPoly(m[0], m[1])); assert.ok(Math.hypot(m[0] - l.x, m[1] - l.z) < 3.5); }
  const geo = (lod: 0 | 2) => { const g = buildLandmark(l, lod); const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3; g.computeBoundingBox(); return { g, n }; };
  const lod0 = geo(0), lod2 = geo(2);
  assert.ok(lod0.n <= triangleBudget(l), `${lod0.n} triangles (T3 ${triangleBudget(l)})`);
  assert.ok(lod2.n <= lod0.n * 0.15, `lod 2 ${lod2.n} triangles`);
  // the landing reaches the lake's surface (local y LAKE_Y − base), the roof stays a low lodge's
  const bb = lod0.g.boundingBox!;
  assert.ok(Math.abs(bb.min.y - (LAKE_Y - BOATHOUSE_BASE - 0.6)) < 0.5, `the landing's posts reach ${bb.min.y.toFixed(2)}`);
  assert.ok(bb.max.y > 2.2 && bb.max.y < 3.0, `the ridge at ${bb.max.y.toFixed(2)}`);
  lod0.g.dispose(); lod2.g.dispose();
});
