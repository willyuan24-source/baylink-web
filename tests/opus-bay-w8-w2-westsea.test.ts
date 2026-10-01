import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { projectCity } from '../src/opus-bay/core/geo';
import { WEST_LINES, WEST_SPOTS, SPOT_HYSTERESIS, atSpot, westLinesDue, westVisits, type WestVisits } from '../src/opus-bay/world/sf/westLines';
import {
  BREAKS, CORMORANTS, CORMORANT_Y, CYCLE_LEN, FOAM_IN, OB_SHORE, SEAL_BOULDERS, SEAL_ROCKS_CENTRE, SEAL_ROCK_OUTLINES, SEA_LIONS, SEA_LION_Y, SEA_Y, SURFERS,
  SURFERS_FROM, SURF_NIGHT_MAX, STATIC_COUNT, WEST_SEA_CAPACITY, type InstanceSink, paintWestSea, poseRocks, poseWestSea, rockTop, seaPoint, surfState,
} from '../src/opus-bay/world/sf/westSeaPose';
import { WEST_RANGE, buildWestSea, rockBall, westSeaDist2 } from '../src/opus-bay/world/sf/westSea';

/**
 * Wave 8 · lane W2 · Ocean Beach's toy surfers and Seal Rocks (world/sf/westSea.ts, westSeaPose.ts, westLines.ts):
 * one InstancedMesh in city mode, positions from OpenStreetMap, BAYBAY's fixed lines.
 */

class Sink implements InstanceSink {
  readonly mats = new Map<number, THREE.Matrix4>();
  readonly cols = new Map<number, THREE.Color>();
  setMatrixAt(i: number, m: THREE.Matrix4) { this.mats.set(i, m.clone()); }
  setColorAt(i: number, c: THREE.Color) { this.cols.set(i, c.clone()); }
}

test('W8-W2 west sea: every instance painted once, posed within capacity, the surfers out by day only', () => {
  const s = new Sink();
  paintWestSea(s);
  assert.equal(s.cols.size, WEST_SEA_CAPACITY, 'every instance has a colour');
  for (const i of s.cols.keys()) assert.ok(i >= 0 && i < WEST_SEA_CAPACITY);
  poseRocks(s);
  assert.equal(s.mats.size, STATIC_COUNT);
  for (const t of [0, 7.3, 19.9, 23.5, 31, 1234.5]) {
    const day = new Sink(), night = new Sink();
    assert.equal(poseWestSea(day, t, 0), WEST_SEA_CAPACITY, `day count at t ${t}`);
    assert.equal(poseWestSea(night, t, 1), SURFERS_FROM, `night count at t ${t}`);
    assert.equal(poseWestSea(new Sink(), t, SURF_NIGHT_MAX + 0.01), SURFERS_FROM, 'dusk: the surfers have gone home');
    for (const [i, m] of day.mats) {
      assert.ok(i >= STATIC_COUNT && i < WEST_SEA_CAPACITY, `index ${i}`);
      for (const e of m.elements) assert.ok(Number.isFinite(e), `instance ${i} finite at t ${t}`);
    }
    assert.equal(day.mats.size, WEST_SEA_CAPACITY - STATIC_COUNT, 'every moving instance written');
  }
  // one draw call: one InstancedMesh on the toy unit ball, count 0 until its first frame
  const mesh = buildWestSea();
  assert.equal(mesh.count, 0);
  assert.equal(mesh.instanceMatrix.count, WEST_SEA_CAPACITY);
  assert.ok(mesh.geometry.getAttribute('position').count / 3 <= 80, 'an 80-face ball');
  assert.ok(WEST_SEA_CAPACITY * 80 <= 15_000, `${WEST_SEA_CAPACITY * 80} triangles at most`);
  mesh.geometry.dispose();
});

test('W8-W2 west sea: the rock ball keeps its poles (the summits are where rockTop says) and stays closed', () => {
  const g = rockBall(), p = g.getAttribute('position');
  let top = -1, bottom = 1;
  for (let i = 0; i < p.count; i++) { top = Math.max(top, p.getY(i)); bottom = Math.min(bottom, p.getY(i)); }
  assert.ok(Math.abs(top - 0.5) < 1e-6 && Math.abs(bottom + 0.5) < 1e-6, 'the poles stay at ± 0.5');
  // the copies of a vertex move together (no cracks): every position appears an even number of times… at least twice
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`; seen.set(k, (seen.get(k) ?? 0) + 1); }
  for (const [k, n] of seen) assert.ok(n >= 4, `vertex ${k} shared by ${n} faces`);
  g.dispose();
});

test('W8-W2 Seal Rocks: the stacks on the two OSM islets, the birds on the white tops, the sea lions on the ledges', () => {
  // OSM ways 969197372 / 969197373 ("Seal Rocks", place=islet) in the project's snapshot: the outlines' centres
  const centre = (o: readonly { x: number; z: number }[]) => ({ x: o.reduce((a, p) => a + p.x, 0) / o.length, z: o.reduce((a, p) => a + p.z, 0) / o.length });
  const [inshore, big] = SEAL_ROCK_OUTLINES.map(centre);
  // the stacks' tallest crag stands on each islet (within 1.5 u of its outline's centre)
  const tallestNear = (c: { x: number; z: number }) => Math.max(...SEAL_BOULDERS.filter(b => Math.hypot(b.x - c.x, b.z - c.z) < 1.8).map(b => b.top));
  assert.ok(tallestNear(big) > 5 && tallestNear(big) < 7, `big stack ${tallestNear(big)}`);
  assert.ok(tallestNear(inshore) > 3 && tallestNear(inshore) < 4.5, `inshore islet ${tallestNear(inshore)}`);
  // Seal Rocks off the Cliff House: ≈ 37.7785, −122.5142 (the terrace) → the rocks lie 20–40 u out to sea
  const cliff = projectCity(37.7785, -122.5142);
  const d = Math.hypot(SEAL_ROCKS_CENTRE.x - cliff.x, SEAL_ROCKS_CENTRE.z - cliff.z);
  assert.ok(d > 15 && d < 45, `the rocks ${d.toFixed(1)} u from the Cliff House`);
  // the birds stand high on the tops (white guano), the sea lions low on the ledges just over the sea
  for (const y of CORMORANT_Y) assert.ok(y > 2.2, `a cormorant at ${y.toFixed(2)}`);
  for (const [k, y] of SEA_LION_Y.entries()) assert.ok(y > SEA_Y && y < 1.3, `sea lion ${k} at ${y.toFixed(2)}`);
  // …and on near-flat rock (on a steep face the jittered facets would leave them floating or sunk)
  const slope = (x: number, z: number) => { const e = 0.15, h = (a: number, b: number) => rockTop(a, b) ?? -9; return Math.max(Math.abs(h(x + e, z) - h(x - e, z)), Math.abs(h(x, z + e) - h(x, z - e))) / (2 * e); };
  for (const c of CORMORANTS) assert.ok(slope(c.x, c.z) < 0.9, `a cormorant on a ${slope(c.x, c.z).toFixed(2)} slope`);
  for (const l of SEA_LIONS) assert.ok(slope(l[0], l[1]) < 0.9, `a sea lion on a ${slope(l[0], l[1]).toFixed(2)} slope`);
  assert.equal(rockTop(SEAL_ROCKS_CENTRE.x + 40, SEAL_ROCKS_CENTRE.z), null, 'open water beside the rocks');
  // no two birds side by side at the same height (two dark dots on a white top read as eyes)
  for (let a = 0; a < CORMORANTS.length; a++) for (let b = a + 1; b < CORMORANTS.length; b++) {
    const dd = Math.hypot(CORMORANTS[a].x - CORMORANTS[b].x, CORMORANTS[a].z - CORMORANTS[b].z);
    assert.ok(dd > 0.3, `birds ${a} and ${b} ${dd.toFixed(2)} apart`);
  }
  assert.ok(SEA_LIONS.length >= 5 && CORMORANTS.length >= 8);
});

test('W8-W2 surfers: the cycle is continuous (no pop at the wrap) and stays out beyond the wash', () => {
  for (const f of SURFERS) {
    const a = surfState(f, CYCLE_LEN - f.phase - 1e-6), b = surfState(f, CYCLE_LEN - f.phase + 1e-6);
    assert.ok(Math.abs(a.d - b.d) < 1e-3 && Math.abs(a.ds - b.ds) < 1e-3, 'continuous at the wrap');
    let minD = Infinity;
    for (let t = 0; t < CYCLE_LEN; t += 0.1) {
      const s = surfState(f, t);
      minD = Math.min(minD, s.d);
      const s2 = surfState(f, t + 0.1);
      assert.ok(Math.abs(s2.d - s.d) < 0.6 && Math.abs(s2.ds - s.ds) < 0.6, `no jump at t ${t.toFixed(1)}`);
    }
    assert.ok(minD >= FOAM_IN, `a surfer rides in to ${minD.toFixed(2)} u (the wash ends at ${FOAM_IN})`);
  }
  // the surf cycle writes into the caller's object (no allocation per frame)
  const out = { ds: 0, d: 0, vs: 0, vd: 0, pose: 'sit' as const };
  assert.equal(surfState(SURFERS[0], 3, out as never), out);
});

test('W8-W2 surfers and the break are over the published sea, the beach behind them is land', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { isLand, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const p of OB_SHORE) await sf.attachAround(city, p.x, p.z, 24, lms);
  await sf.attachAround(city, SEAL_ROCKS_CENTRE.x, SEAL_ROCKS_CENTRE.z, 24, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    for (const f of SURFERS) {
      for (const d of [f.d, f.d - 7.5, f.d + 1]) {
        const p = seaPoint(f.s, d);
        assert.ok(isWater(p.x, p.z), `surfer at s ${f.s}, ${d} u out: water`);
      }
    }
    for (const [s0, len] of BREAKS) for (let a = -len / 2; a <= len / 2; a += 2) {
      const w = seaPoint(s0 + a, FOAM_IN), l = seaPoint(s0 + a, -4);
      assert.ok(isWater(w.x, w.z), `the wash at s ${(s0 + a).toFixed(0)} is water`);
      assert.ok(isLand(l.x, l.z), `the sand behind it at s ${(s0 + a).toFixed(0)} is land`);
    }
    // the rocks stand in open water on the published map (it has no land there)
    assert.ok(isWater(SEAL_ROCKS_CENTRE.x, SEAL_ROCKS_CENTRE.z));
  } finally {
    setCityTerrain(null);
  }
});

test('W8-W2 BAYBAY\'s west-side lines: fixed zh + en, on foot, by day at the surf, once each', () => {
  const lines = Object.values(WEST_LINES);
  assert.equal(new Set(lines.map(l => l.id)).size, lines.length, 'distinct ids');
  for (const l of lines) {
    assert.ok([...l.text.zh].length <= 45 && l.text.zh.length > 4, `zh ≤ 45: ${l.text.zh}`);
    assert.ok(!/[{}$%]/.test(l.text.zh + l.text.en), `no template: ${l.id}`);
    assert.ok(!/[㐀-鿿]/.test(l.text.en), `English has no Han characters: ${l.id}`);
  }
  const kelly = WEST_SPOTS.find(s => s.id === 'kelly')!, seal = WEST_SPOTS.find(s => s.id === 'seal')!;
  const visits: WestVisits = new Map(), said = new Set<string>();
  const due = (x: number, z: number, night: number, onFoot = true) => { westVisits(x, z, night, visits, said, onFoot); return westLinesDue(visits, said, WEST_SPOTS).map(l => l.id); };
  // not out walking (on a ride, driving, gliding: westSea passes false), then on foot
  assert.deepEqual(due(kelly.at.x, kelly.at.z, 0, false), []);
  assert.deepEqual(due(kelly.at.x, kelly.at.z, 0), [kelly.lines[0].id]);
  // (W8-W2-review, P3) not said yet (held behind a card): still due at the next check, the visit keeps its line
  assert.deepEqual(due(kelly.at.x, kelly.at.z, 0), [kelly.lines[0].id]);
  said.add(kelly.lines[0].id);
  // said: nothing more this visit; out past the hysteresis and back in: the next line
  assert.deepEqual(due(kelly.at.x, kelly.at.z, 0), []);
  assert.deepEqual(due(kelly.at.x + kelly.r + SPOT_HYSTERESIS - 1, kelly.at.z, 0), [], 'inside the hysteresis band');
  assert.ok(atSpot(kelly, kelly.at.x + kelly.r + SPOT_HYSTERESIS - 1, kelly.at.z) && !atSpot(kelly, kelly.at.x + 400, kelly.at.z));
  assert.deepEqual(due(kelly.at.x + 400, kelly.at.z, 0), [], 'left');
  assert.deepEqual(due(kelly.at.x, kelly.at.z, 0), [kelly.lines[1].id]);
  // (P3) a line the pacer dropped unsaid comes again on the next visit (it counts as said only when she says it)
  assert.deepEqual(due(kelly.at.x + 400, kelly.at.z, 0), []);
  assert.deepEqual(due(kelly.at.x, kelly.at.z, 0), [kelly.lines[1].id]);
  // at night the surf spots are quiet (no surfers), Seal Rocks still speaks
  const v2: WestVisits = new Map();
  westVisits(kelly.at.x, kelly.at.z, 1, v2, new Set(), true);
  assert.deepEqual(westLinesDue(v2, new Set(), WEST_SPOTS), []);
  westVisits(seal.at.x, seal.at.z, 1, v2, new Set(), true);
  assert.deepEqual(westLinesDue(v2, new Set(), WEST_SPOTS).map(l => l.id), [seal.lines[0].id]);
  // the spots sit inside the mesh's draw range (she never talks about something not drawn)
  for (const s of WEST_SPOTS) assert.ok(westSeaDist2(s.at.x, s.at.z) + s.r * s.r < WEST_RANGE * WEST_RANGE);
});
