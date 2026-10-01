import assert from 'node:assert/strict';
import test from 'node:test';
import { buildingH } from '../src/opus-bay/core/geo';
import { createCityTerrain } from '../src/opus-bay/core/sfTerrain';
import { canStand, heightAt, setCityTerrain } from '../src/opus-bay/core/terrain';
import { ATTRACTION_INDEX } from '../src/opus-bay/data/sf/attractions';
import { CT_BLOCKERS, CT_EXCLUDE_LOTS, CT_EXCLUDES, CT_GATE, CT_GROUND, CT_LOTS, type CtLotId, chinatownCluster, ctPoint } from '../src/opus-bay/world/sf/cornersChinatown';
import { demSample } from '../src/opus-bay/world/sf/format';
import { SF_SITES, buildLandmark, sfLandmark, triangleBudget } from '../src/opus-bay/world/sf/landmarks/index';
import { SETTING_DATA } from '../src/opus-bay/world/sf/landmarks/settingData';
import { CitySites } from '../src/opus-bay/world/sf/sites';
import { TypedBatch } from '../src/opus-bay/world/typedBatch';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Wave 8 · lane W1 · Chinatown's pagoda cluster (world/sf/cornersChinatown.ts, drawn by the Dragon Gate's site): Sing
 * Chong, Sing Fat, Old St. Mary's and the Chinese Telephone Exchange replace the published city's boxes on their lots
 * (the gate's `excludeMore`), inside the gate's own meshes (no new draw call), on the measured ground, solid in city mode.
 */

type P = { x: number; z: number };
function inPoly(x: number, z: number, p: readonly P[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}
const gate = sfLandmark('dragon-gate')!;
/** Grant Ave frame (along, across) → WORLD */
function W(along: number, across: number): P {
  const p = ctPoint(along, across), c = Math.cos(gate.yaw), s = Math.sin(gate.yaw);
  return { x: gate.x + p.x * c + p.z * s, z: gate.z - p.x * s + p.z * c };
}
const tris = (b: TypedBatch) => b.toArrays().indexCount / 3;

test('W8-W1 the cluster rides on the Dragon Gate: its frame, its budget (no new mesh), its far silhouette', () => {
  assert.deepEqual([CT_GATE.x, CT_GATE.z, CT_GATE.yaw], [gate.x, gate.z, gate.yaw], 'the gate\'s frame');
  // Grant & California (OSM: the intersection the four corner buildings stand round) lies on the frame's along 26.4
  const gc = W(26.43, 0);
  assert.ok(Math.hypot(gc.x - 59.05, gc.z - 158.75) < 0.1, `Grant & California at ${gc.x.toFixed(2)}, ${gc.z.toFixed(2)}`);
  const base = SETTING_DATA['dragon-gate'].base;
  const b0 = new TypedBatch(8192), b2 = new TypedBatch(1024);
  chinatownCluster(b0, 0, base);
  chinatownCluster(b2, 2, base);
  const t0 = tris(b0), t2 = tris(b2);
  assert.ok(t0 > 1500 && t0 <= 2600, `cluster lod 0: ${t0} triangles`);
  assert.ok(t2 <= 200, `cluster lod 2: ${t2} triangles`);
  // the whole gate (procedural and the AI remainder) within its budget; lod 2 ≤ 10 % of lod 0
  const g0 = buildLandmark(gate, 0), g2 = buildLandmark(gate, 2);
  const n0 = g0.getIndex()!.count / 3, n2 = g2.getIndex()!.count / 3;
  assert.ok(n0 <= triangleBudget(gate), `gate lod 0 ${n0} ≤ ${triangleBudget(gate)}`);
  assert.ok(n2 <= n0 * 0.1, `gate lod 2 ${n2} ≤ 10 % of ${n0}`);
  const r = new TypedBatch(8192);
  gate.swap!.build(r);
  assert.ok(tris(r) > t0, 'the AI remainder carries the cluster');
  // the gate's procedural mesh keeps the city's dither (only the AI gate fades as one)
  assert.equal(gate.fade?.procedural, false);
  // every vertex of the cluster stands on its lots (+ the eaves' and roofs' overhang)
  const a = b0.toArrays();
  for (let i = 0; i < a.vertexCount; i++) {
    const lx = a.position[i * 3], lz = a.position[i * 3 + 2];
    const c = Math.cos(gate.yaw), s = Math.sin(gate.yaw), x = gate.x + lx * c + lz * s, z = gate.z - lx * s + lz * c;
    const near = CT_EXCLUDES.some(p => inPoly(x, z, p) || p.some((q, k) => {
      const e = p[(k + 1) % p.length], dx = e.x - q.x, dz = e.z - q.z, L = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - q.x) * dx + (z - q.z) * dz) / L));
      return Math.hypot(x - q.x - dx * t, z - q.z - dz * t) < 0.75;
    }));
    assert.ok(near, `vertex ${i} at ${x.toFixed(2)}, ${z.toFixed(2)} off the lots`);
  }
});

test('W8-W1 heights: Old St. Mary\'s tower ≈ 27 m (H = 3.2 + 0.155 h), the towers over their roofs, Sing Fat\'s the tallest', () => {
  const base = SETTING_DATA['dragon-gate'].base;
  const top = (fn: (b: TypedBatch) => void, lot: CtLotId) => {
    const b = new TypedBatch(8192);
    fn(b);
    const a = b.toArrays(), L = CT_LOTS[lot];
    let y = -Infinity;
    for (let i = 0; i < a.vertexCount; i++) {
      const lx = a.position[i * 3], lz = a.position[i * 3 + 2];
      // back to Grant Ave's frame: across = (lx + 0.07)·cos T − (lz + 2)·sin T … (ctPoint inverted)
      const T = Math.atan(0.0478), X = lx + 0.07, Z = lz + 2, along = -(X * Math.sin(T) + Z * Math.cos(T)), across = X * Math.cos(T) - Z * Math.sin(T);
      if (across >= L.a0 - 0.05 && across <= L.a1 + 0.05 && along >= L.l0 - 0.05 && along <= L.l1 + 0.05) y = Math.max(y, a.position[i * 3 + 1]);
    }
    return y + base;
  };
  const all = (b: TypedBatch) => chinatownCluster(b, 0, base);
  const tower = top(all, 'st-marys-tower') - CT_GROUND['st-marys-tower'].ref;
  assert.ok(Math.abs(tower - buildingH(27)) < 0.3, `Old St. Mary's tower ${tower.toFixed(2)} u over its door vs ${buildingH(27).toFixed(2)}`);
  const sc = top(all, 'sing-chong') - CT_GROUND['sing-chong'].ref, sf = top(all, 'sing-fat') - CT_GROUND['sing-fat'].ref;
  assert.ok(sc > buildingH(16) + 1.5 && sf > sc, `Sing Chong ${sc.toFixed(2)}, Sing Fat ${sf.toFixed(2)}`);
  const ex = top(all, 'exchange') - CT_GROUND.exchange.ref;
  assert.ok(ex > 4 && ex < 5.2, `the exchange's three tiers ${ex.toFixed(2)} u`);
});

test('W8-W1 exclusions: exactly the five merged city boxes go (render, far and collision), as rows after the sites\'', async () => {
  const sf = sfDisk();
  const ch = (await sf.chunk(0, 1))!, bb = ch.buildings;
  const hit: number[] = [];
  for (let i = 0; i < bb.count; i++) {
    let cx = 0, cz = 0;
    const n = bb.vStart[i + 1] - bb.vStart[i];
    for (let k = bb.vStart[i]; k < bb.vStart[i + 1]; k++) { cx += bb.xz[2 * k]; cz += bb.xz[2 * k + 1]; }
    if (CT_EXCLUDES.some(p => inPoly(cx / n, cz / n, p))) hit.push(bb.osmId[i]);
  }
  assert.deepEqual(hit.sort(), [256080511, 260208813, 260519113, 260520154, 260520161].sort(), 'the merged boxes of the four corners and the exchange');
  const far = await sf.far(), pr = far.prisms;
  for (let i = 0; i < pr.count; i++) {
    let cx = 0, cz = 0;
    const a = pr.vStart[i], b = pr.vStart[i + 1];
    for (let k = a; k < b; k++) { cx += pr.xz[k * 2]; cz += pr.xz[k * 2 + 1]; }
    assert.ok(!CT_EXCLUDES.some(p => inPoly(cx / (b - a), cz / (b - a), p)), `far prism ${i} kept`);
  }
  const sites = new CitySites();
  try {
    const ex = sites.excludes(), walk = sites.walkInputs();
    assert.deepEqual(ex.slice(0, SF_SITES.length).map(e => e.id), SF_SITES.map(l => l.id));
    const more = ex.slice(SF_SITES.length);
    assert.deepEqual(more.map(e => e.id), CT_EXCLUDES.map((_, k) => `dragon-gate+${k}`));
    for (const [k, e] of more.entries()) {
      assert.equal(e.sink, 0);
      assert.equal(e.base, undefined, 'no base of its own');
      assert.deepEqual(e.poly, CT_EXCLUDES[k]);
    }
    assert.deepEqual(walk.slice(0, SF_SITES.length).map(w => w.id), SF_SITES.map(l => l.id));
    assert.deepEqual(walk.slice(SF_SITES.length).map(w => w.id), more.map(e => e.id));
    assert.ok(walk.slice(SF_SITES.length).every(w => !w.walk && w.base === 0 && 'poly' in w.exclude!), 'collision drops the same boxes');
  } finally { sites.dispose(); }
  // the lots are the published city's footprints, squared to Grant Ave (street fronts at across ±1.8)
  for (const [a0, a1] of CT_EXCLUDE_LOTS) assert.ok(a1 <= -1.8 || a0 >= 1.75, 'off Grant Ave');
});

test('W8-W1 in city mode: the ground is the measured one, the buildings are solid, the streets round them walkable', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= globalThis;
  const sf = sfDisk(), far = await sf.far();
  const sites = new CitySites(), lms = sites.walkInputs();
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
  sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  await sf.attachAround(city, 45, 150, 60, lms);
  try {
    for (const [id, L] of Object.entries(CT_LOTS) as [CtLotId, (typeof CT_LOTS)[CtLotId]][]) {
      let lo = Infinity;
      for (let a = L.a0; a <= L.a1 + 1e-9; a += 0.25) for (let l = L.l0; l <= L.l1 + 1e-9; l += 0.25) { const p = W(l, a); lo = Math.min(lo, heightAt(p.x, p.z)); }
      for (const [a, l] of [[L.a0, L.l0], [L.a1, L.l0], [L.a0, L.l1], [L.a1, L.l1]]) { const p = W(l, a); lo = Math.min(lo, heightAt(p.x, p.z)); }
      const r = W(L.ref[1], L.ref[0]);
      assert.ok(Math.abs(Math.floor(lo * 100) / 100 - CT_GROUND[id].lo) < 0.02, `${id}: lo ${lo.toFixed(3)} vs ${CT_GROUND[id].lo}`);
      assert.ok(Math.abs(heightAt(r.x, r.z) - CT_GROUND[id].ref) < 0.02, `${id}: ref ${heightAt(r.x, r.z).toFixed(3)} vs ${CT_GROUND[id].ref}`);
      // solid: the middle and points 0.3 u inside each corner
      const m = W((L.l0 + L.l1) / 2, (L.a0 + L.a1) / 2);
      assert.ok(!canStand(m.x, m.z, 0.2), `${id} solid in the middle`);
      for (const [a, l] of [[L.a0 + 0.3, L.l0 + 0.3], [L.a1 - 0.3, L.l1 - 0.3]]) { const p = W(l, a); assert.ok(!canStand(p.x, p.z, 0.2), `${id} solid at ${a}, ${l}`); }
    }
    // the sidewalks: Grant Ave's both sides past the four corners and the exchange, California St's in front of the
    // tower's door, Washington St's in front of the exchange
    const walkable: [number, number][] = [[29.5, -1.3], [31.5, -1.3], [22.5, -1.3], [30.5, 1.2], [33.5, 1.2], [27.9, 3.3], [24.6, -3.5], [67.1, 2.5], [65.2, 1.25]];
    for (const [l, a] of walkable) { const p = W(l, a); assert.ok(canStand(p.x, p.z, 0.4), `walkable at along ${l}, across ${a} (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`); }
    // the attractions of the cluster end where a walker stands
    for (const id of ['old-st-marys-cathedral', 'sing-chong-sing-fat-buildings', 'chinese-telephone-exchange']) {
      const a = ATTRACTION_INDEX.get(id)!, e = a.arrival ?? { x: a.x, z: a.z };
      assert.ok(canStand(e.x, e.z, 0.4), `${id}: its trip end ${e.x}, ${e.z} standable`);
    }
    assert.equal(CT_BLOCKERS.length, Object.keys(CT_LOTS).length);
  } finally { setCityTerrain(null); sites.dispose(); }
});
