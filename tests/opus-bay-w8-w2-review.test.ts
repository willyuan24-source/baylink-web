import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { Bilingual } from '../src/opus-bay/core/types';
import { LinePacer } from '../src/opus-bay/game/linePacer';
import { HERON_SPOT, LAKE_LINES, LAKE_SPOTS, SPOT_HYSTERESIS, WEST_LINES, WEST_SPOTS } from '../src/opus-bay/world/sf/westLines';
import { attachWestInstanced, type WestSayHooks } from '../src/opus-bay/world/sf/westToy';
import { lakeDist2 } from '../src/opus-bay/world/sf/westLake';
import { BOAT, BOATS, BOATS_FROM, BOATS_NIGHT_MAX, BOAT_PARTS, HERON, LAKE_CAPACITY, LAKE_CENTRE, poseLake } from '../src/opus-bay/world/sf/westLakePose';
import {
  CORMORANTS, CORMORANT_Y, SEA_LIONS, SEA_LION_Y, SEAL_BOULDERS, SURFERS, SURFERS_FROM, SURFER_PARTS, SURF_NIGHT_MAX, WEST_SEA_CAPACITY, boulderMatrix, poseWestSea,
  type InstanceSink,
} from '../src/opus-bay/world/sf/westSeaPose';
import { rockBall, westSeaDist2 } from '../src/opus-bay/world/sf/westSea';

/**
 * Wave 8 · lane W2 · the Ultra review's fixes (sf-w8-W2.md "Review (Ultra)"): BAYBAY's place lines never play somewhere
 * else (P1), count as said only when said (P3), every spot entered gets its line and a fast travel ends the visits (C3),
 * the heron line where the heron can be seen (C2); St Ignatius's lod-2 towers (C4); no boat pivoting on the spot (C7);
 * the surfers and the boats leave one by one at dusk (P4); the cormorants stand on the drawn rock (C1).
 */

class Sink implements InstanceSink {
  readonly mats = new Map<number, THREE.Matrix4>();
  setMatrixAt(i: number, m: THREE.Matrix4) { this.mats.set(i, m.clone()); }
  setColorAt() {}
}

test('W8-W2-review pacer: a waiting line that is no longer valid is dropped; onSay rides with the said line', () => {
  const p = new LinePacer();
  let here = true, saidN = 0;
  const a: Bilingual = { zh: '甲', en: 'a' }, b: Bilingual = { zh: '乙', en: 'b' };
  assert.ok(p.offer({ text: a }, 0));
  assert.ok(p.offer({ text: b, ttl: 25, valid: () => here, onSay: () => { saidN++; } }, 0));
  assert.equal(p.step(0)?.text.zh, '甲');
  here = false; // the player fast-travelled away while 甲 was being said
  assert.equal(p.step(10), null, 'dropped, not said somewhere else');
  assert.equal(p.pending(), 0);
  here = true;
  assert.ok(p.offer({ text: b, ttl: 25, valid: () => here, onSay: () => { saidN++; } }, 20));
  const s = p.step(20);
  assert.equal(s?.text.zh, '乙');
  s?.onSay?.();
  assert.equal(saidN, 1);
});

/** a west system with a fake BAYBAY: every offer recorded (the pacer's dedupe left out), the player and camera moved by hand */
function rig() {
  const offers: { text: Bilingual; hooks: WestSayHooks }[] = [];
  const pl = { x: 0, z: 0, afoot: true };
  const sys = attachWestInstanced({
    name: 'test-lake',
    build: () => new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 1),
    dist2: lakeDist2,
    range: 200,
    pose: () => 0,
    spots: LAKE_SPOTS,
  }, (text, hooks) => { offers.push({ text, hooks }); return true; }, () => pl);
  const cam = new THREE.PerspectiveCamera();
  let t = 0;
  const step = (x: number, z: number, camX = x, camZ = z) => { pl.x = x; pl.z = z; cam.position.set(camX, 30, camZ); t += 0.25; sys.update!(0.25, t, cam, 0); };
  return { offers, pl, step, sys };
}

test('W8-W2-review lines: kept offered while the visit lasts, said once, dropped when the player leaves (P1, P3)', () => {
  const r = rig();
  const lake = LAKE_SPOTS[0];
  r.step(lake.at.x, lake.at.z);
  assert.equal(r.offers.length, 1);
  assert.equal(r.offers[0].text.en, LAKE_LINES.boats.text.en);
  r.step(lake.at.x, lake.at.z);
  assert.equal(r.offers.length, 2, 'offered again (the pacer extends the waiting copy) while BAYBAY is busy');
  const h = r.offers[0].hooks;
  assert.ok(h.valid());
  // the player teleports / fast-travels 430 u away while the line waits: the pacer drops it
  r.pl.x = -730; r.pl.z = 1290;
  assert.equal(h.valid(), false, 'P1: no Seal Rocks / lake line over another place');
  r.pl.x = lake.at.x; r.pl.z = lake.at.z;
  h.onSay();
  const n = r.offers.length;
  r.step(lake.at.x, lake.at.z);
  assert.equal(r.offers.length, n, 'said: not offered again this session');
  r.sys.dispose?.();
});

test('W8-W2-review lines: two spots entered in one check both get their line; a camera far away ends every visit (C3)', () => {
  const r = rig();
  const house = LAKE_SPOTS.find(s => s.id === 'boathouse')!;
  // inside both the lake spot (r 48) and the boathouse spot (r 14) in one check: on the line through both centres, 47.8 u out
  const dl = Math.hypot(house.at.x - LAKE_CENTRE.x, house.at.z - LAKE_CENTRE.z);
  const x = LAKE_CENTRE.x + ((house.at.x - LAKE_CENTRE.x) / dl) * 47.8, z = LAKE_CENTRE.z + ((house.at.z - LAKE_CENTRE.z) / dl) * 47.8;
  assert.ok(Math.hypot(x - house.at.x, z - house.at.z) < house.r);
  r.step(x, z);
  assert.deepEqual(r.offers.map(o => o.text.en).sort(), [LAKE_LINES.boats.text.en, LAKE_LINES.since.text.en].sort(), 'the 1893 line is not lost');
  // the boats line said; the player fast-travels away (camera > range): the visits end; back at the boathouse: its line again
  r.offers.find(o => o.text.en === LAKE_LINES.boats.text.en)!.hooks.onSay();
  r.step(2000, 2000);
  r.offers.length = 0;
  r.step(house.at.x, house.at.z);
  assert.deepEqual(r.offers.map(o => o.text.en), [LAKE_LINES.since.text.en]);
  r.sys.dispose?.();
});

test('W8-W2-review the heron line: its own spot, the heron in sight from all of it (C2)', async () => {
  const heron = LAKE_SPOTS.find(s => s.lines.includes(LAKE_LINES.heron))!;
  assert.equal(heron.id, 'heron');
  assert.ok(!LAKE_SPOTS.find(s => s.id === 'lake')!.lines.includes(LAKE_LINES.heron), 'not on the whole lake circle');
  const d = Math.hypot(HERON_SPOT.x - HERON.x, HERON_SPOT.z - HERON.z);
  assert.ok(d + heron.r + SPOT_HYSTERESIS < 35, `the heron ${d.toFixed(1)} u away (within ${(d + heron.r + SPOT_HYSTERESIS).toFixed(0)} u from any point she may say it)`);
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { heightAt, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  await sf.attachAround(city, LAKE_CENTRE.x, LAKE_CENTRE.z, 70, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    let blocked = 0, n = 0;
    for (let a = 0; a < 360; a += 20) for (const rr of [0, heron.r / 2, heron.r]) {
      const x = HERON_SPOT.x + Math.cos((a * Math.PI) / 180) * rr, z = HERON_SPOT.z + Math.sin((a * Math.PI) / 180) * rr;
      if (isWater(x, z)) continue;
      n++;
      const ey = heightAt(x, z) + 1.6, hy = HERON.y + 1.5;
      let worst = -Infinity;
      for (let k = 1; k < 100; k++) { const f = k / 100; worst = Math.max(worst, heightAt(x + (HERON.x - x) * f, z + (HERON.z - z) * f) - (ey + (hy - ey) * f)); }
      if (worst > 0) blocked++;
    }
    assert.ok(n > 20 && blocked <= n * 0.1, `${blocked} of ${n} points in the heron spot have the hill in the way`);
  } finally {
    setCityTerrain(null);
  }
});

test('W8-W2-review spots: inside the draw ranges', () => {
  for (const s of LAKE_SPOTS) assert.ok(Math.sqrt(lakeDist2(s.at.x, s.at.z)) + s.r < 200);
  for (const s of WEST_SPOTS) assert.ok(westSeaDist2(s.at.x, s.at.z) + s.r * s.r < 420 * 420);
  assert.ok(Object.values(WEST_LINES).length === 5);
});

test('W8-W2-review St Ignatius lod 2: each tower narrows upward to its lead cap (no hourglass pinch under it) (C4)', async () => {
  const { stIgnatius } = await import('../src/opus-bay/world/sf/landmarks/st-ignatius');
  const { buildLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
  const g = buildLandmark(stIgnatius, 2);
  const geo = g.index ? g.toNonIndexed() : g;
  const p = geo.getAttribute('position');
  const towers = [-1.75, 2.45], TZ = 4.05;
  // the half-width of the solid round a tower's axis at height y: the triangles crossing the plane y (local frame)
  const halfWidth = (tx: number, y: number) => {
    let w = 0;
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let i = 0; i < p.count; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(p, i + k);
      for (let k = 0; k < 3; k++) {
        const a = v[k], b = v[(k + 1) % 3];
        if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) continue;
        const f = (y - a.y) / (b.y - a.y), x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
        if (Math.abs(x - tx) < 1.2 && Math.abs(z - TZ) < 1.2) w = Math.max(w, Math.max(Math.abs(x - tx), Math.abs(z - TZ)));
      }
    }
    return w;
  };
  // from the top of the shaft upward (the shaft's top: the highest y where the half-width is the shaft's 0.95)
  let checked = 0;
  for (const tx of towers) {
    let y = 0;
    for (let yy = 0; yy < 30; yy += 0.1) if (halfWidth(tx, yy) > 0.9) y = yy;
    let prev = halfWidth(tx, y + 0.05);
    for (let yy = y + 0.15; yy < y + 8; yy += 0.05) {
      const w = halfWidth(tx, yy);
      if (w === 0) break;
      assert.ok(w <= prev + 0.02, `tower at x ${tx}: the half-width grows from ${prev.toFixed(2)} to ${w.toFixed(2)} at y ${yy.toFixed(2)} (a cap balanced on a spike)`);
      prev = w;
      checked++;
    }
  }
  assert.ok(checked > 40, `${checked} heights checked`);
  g.dispose();
});

test('W8-W2-review lake: no boat pivots on the spot (its circle at least its own length across) (C7)', () => {
  for (const [k, b] of BOATS.entries()) assert.ok(2 * b.r >= BOAT[b.kind].len * 1.6, `boat ${k}: a ${BOAT[b.kind].len} u ${b.kind} boat on a circle ${(2 * b.r).toFixed(1)} u across`);
  assert.equal(BOAT_PARTS, 8);
});

/** the instances of a block written with a non-zero scale (visible) */
function shown(s: Sink, from: number, to: number) {
  // (the column's length: Matrix4.decompose reports a degenerate matrix's scale as 1)
  let n = 0;
  for (let i = from; i < to; i++) { const e = s.mats.get(i)?.elements; if (e && Math.hypot(e[0], e[1], e[2]) > 1e-4) n++; }
  return n;
}

test('W8-W2-review dusk: the surfers and the boats go in one by one, never all in one frame (P4)', () => {
  for (const [label, pose, from, cap, max, per] of [
    ['surfers', poseWestSea, SURFERS_FROM, WEST_SEA_CAPACITY, SURF_NIGHT_MAX, SURFER_PARTS],
    ['boats', poseLake, BOATS_FROM, LAKE_CAPACITY, BOATS_NIGHT_MAX, BOAT_PARTS],
  ] as const) {
    const total = (cap - from) / per;
    let prev = Infinity, gone = 0;
    for (let night = 0; night <= max + 0.02; night += 0.0025) {
      const s = new Sink();
      const count = pose(s, 100, night);
      const n = count > from ? shown(s, from, Math.min(count, cap)) : 0;
      if (prev !== Infinity) assert.ok(prev - n <= per * 1, `${label}: ${prev - n} instances vanish at night ${night.toFixed(4)}`);
      prev = n;
      if (night > max) gone++;
    }
    assert.ok(gone > 0 && prev === 0, `${label}: all in by ${max}`);
    assert.equal(pose(new Sink(), 100, 0), cap, `${label}: all out by day`);
    assert.ok(total >= 9);
  }
  assert.equal(SURFERS.length, 11);
});

test('W8-W2-review Seal Rocks: the cormorants stand on the drawn (faceted) rock, the sea lions rest on it (C1)', () => {
  const g = rockBall(), mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes = SEAL_BOULDERS.map(b => { const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.matrix.copy(boulderMatrix(b)); m.matrixWorld.copy(m.matrix); return m; });
  const rc = new THREE.Raycaster();
  const top = (x: number, z: number) => { rc.set(new THREE.Vector3(x, 60, z), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObjects(meshes, false); return h.length ? h[0].point.y : null; };
  CORMORANTS.forEach((c, k) => {
    const m = top(c.x, c.z);
    assert.ok(m !== null, `bird ${k} over rock`);
    // the bird's body (0.38 u tall, centred 0.15 u over its y) reaches down to its feet at y − 0.04
    const feet = CORMORANT_Y[k] - 0.04;
    assert.ok(feet - m! <= 0.03 && m! - feet <= 0.12, `bird ${k}: feet ${feet.toFixed(2)} over the drawn rock ${m!.toFixed(2)}`);
  });
  SEA_LIONS.forEach((l, k) => {
    const m = top(l[0], l[1]);
    assert.ok(m !== null && Math.abs(SEA_LION_Y[k] - m) < 0.12, `sea lion ${k} at ${SEA_LION_Y[k].toFixed(2)} vs the drawn ledge ${m?.toFixed(2)}`);
  });
  g.dispose();
});
