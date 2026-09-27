import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { SF_KIT, SF_KIT_IDS, type SfKitId } from '../src/opus-bay/data/assets';
import type { LoadedModel } from '../src/opus-bay/world/models';
import { CITY_STYLES } from '../src/opus-bay/world/recipes/city';
import { KIT_SLOTS, KIT_SWAP, KitSwap, type KitModels, type L0Source, kitChoices, kitFit, lotFrame } from '../src/opus-bay/world/sf/kitSwap';
import { type L0BuildingView, type L0Buildings, type L0Hidden, setRangeHidden } from '../src/opus-bay/world/sf/l0index';

/**
 * Lane D2, D2-08: the near-player house-kit swap (world/sf/kitSwap.ts) against a fake L0 source (the streamer's day-0
 * L0 building API) and fake decoded models: cap, radius, hysteresis, fades, hide / restore round trip, cell drop.
 */

const style = (s: (typeof CITY_STYLES)[number]) => CITY_STYLES.indexOf(s);

/** A lot: front along its short edge (frontYaw = yaw), w across the front, d deep, wall H. */
function lot(k: number, x: number, z: number, o: Partial<L0BuildingView> & { w?: number; d?: number } = {}): L0BuildingView {
  const w = o.w ?? 4.2, d = o.d ?? 2.8, H = o.H ?? 4.8;
  return {
    k, osmId: 1000 + k, indexStart: k * 6, indexCount: 6, cx: x, cz: z, hx: w / 2, hz: d / 2, yaw: 0.3, frontYaw: 0.3, hasFront: true,
    baseY: 2, H, wall: [0.8, 0.6, 0.7], slope: 0.2, style: style('victorian'), roof: 0, flags: 0, ...o,
  };
}

/** The streamer's L0 API over lots in cells (one index range of 2 triangles per lot, real setRangeHidden). */
class FakeL0 implements L0Source {
  quality = 'high';
  cells = new Map<number, { lots: L0BuildingView[]; geo: THREE.BufferGeometry; b: L0Buildings; hidden: L0Hidden }>();
  private listeners = new Set<(cell: number) => void>();
  hideCalls = 0;
  add(cell: number, lots: L0BuildingView[]) {
    const n = lots.length, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 4 * 3), 3));
    const idx = new Uint16Array(n * 6);
    for (let i = 0; i < n; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const ranges = new Uint32Array(n * 2);
    lots.forEach((_, i) => { ranges[i * 2] = i * 6; ranges[i * 2 + 1] = 6; });
    this.cells.set(cell, { lots: lots.map((l, i) => ({ ...l, k: i })), geo, b: { count: n, osmId: new Float64Array(n), ranges, data: new Float32Array(n * 16) }, hidden: new Map() });
  }
  forEachL0Building(x: number, z: number, r: number, fn: (cell: number, k: number, b: L0BuildingView) => void) {
    for (const [cell, c] of this.cells) for (const l of c.lots) if (Math.hypot(l.cx - x, l.cz - z) <= r) fn(cell, l.k, l);
  }
  setL0BuildingHidden(cell: number, k: number, hidden: boolean) {
    this.hideCalls++;
    const c = this.cells.get(cell);
    return !!c && setRangeHidden(c.geo, c.b, k, hidden, c.hidden);
  }
  onL0Drop(fn: (cell: number) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  drop(cell: number) { for (const fn of this.listeners) fn(cell); this.cells.delete(cell); }
  hiddenCount() { let n = 0; for (const c of this.cells.values()) n += c.hidden.size; return n; }
}

class FakeModels implements KitModels {
  retained = new Map<string, number>();
  cache = new Map<string, LoadedModel>();
  ready = true;
  peek(id: string): LoadedModel | null {
    if (!this.ready || !(id in SF_KIT)) return null;
    let m = this.cache.get(id);
    if (!m) {
      const a = SF_KIT[id as SfKitId], g = new THREE.BoxGeometry(a.size[0], a.size[1], a.size[2]).translate(0, a.size[1] / 2, 0);
      g.computeBoundingBox(); g.computeBoundingSphere();
      m = { id, asset: a, geometry: g, map: null, mask: null, triangles: a.triangles };
      this.cache.set(id, m);
    }
    return m;
  }
  retain(id: string) { this.retained.set(id, (this.retained.get(id) ?? 0) + 1); }
  release(id: string) { this.retained.set(id, (this.retained.get(id) ?? 0) - 1); }
  held() { return [...this.retained.values()].reduce((a, b) => a + b, 0); }
}

/** Run the swap for `secs` at 60 fps from time t0 (returns the end time). */
function run(k: KitSwap, fx: number, fz: number, t0: number, secs: number, camH = 5) {
  let t = t0;
  for (let i = 0; i < Math.round(secs * 60); i++) { t += 1 / 60; k.update(fx, fz, t, camH); }
  return t;
}

test('kitFit: style, facade ±25 %, free depth, slope ≤ 0.8, street edge; kit faces the street at the lot, tinted with its wall', () => {
  const ok = kitFit(lot(0, 10, 20))!;
  assert.ok(ok, 'a victorian lot 4.2 × 2.8 × 4.8 takes a kit house');
  assert.ok(kitChoices('victorian').includes(ok.id));
  assert.deepEqual([ok.x, ok.y, ok.z, ok.yaw], [10, 2, 20, 0.3]);
  assert.deepEqual(ok.tint, [0.8, 0.6, 0.7]);
  const [kw, kh, kd] = SF_KIT[ok.id].size;
  assert.ok(Math.abs(ok.sx - (4.2 / kw) * KIT_SWAP.grow) < 1e-9 && Math.abs(ok.sy - (4.8 + KIT_SWAP.roof) / kh) < 1e-9 && Math.abs(ok.sz - (2.8 / kd) * KIT_SWAP.grow) < 1e-9);
  // the street edge along the long side: the facade is the box's long extent
  assert.deepEqual(lotFrame({ hx: 1.4, hz: 2.1, yaw: 0, frontYaw: Math.PI / 2, hasFront: true }), { w: 4.2, d: 2.8 });
  assert.deepEqual(lotFrame({ hx: 2.1, hz: 1.4, yaw: 0, frontYaw: Math.PI, hasFront: true }), { w: 4.2, d: 2.8 });
  assert.equal(lotFrame({ hx: 2.1, hz: 1.4, yaw: 0, frontYaw: 0.7, hasFront: true }), null, 'a skewed street edge');
  assert.equal(kitFit(lot(0, 0, 0, { hasFront: false })), null, 'no street edge');
  assert.equal(kitFit(lot(0, 0, 0, { slope: 0.81 })), null, 'too steep for a flat kit base');
  assert.ok(kitFit(lot(0, 0, 0, { slope: 0.8 })));
  assert.equal(kitFit(lot(0, 0, 0, { style: style('office') })), null, 'no kit for offices');
  assert.equal(kitFit(lot(0, 0, 0, { w: 2.2 })), null, 'too narrow a facade (−48 %)');
  assert.equal(kitFit(lot(0, 0, 0, { w: 7.5 })), null, 'too wide a facade');
  assert.equal(kitFit(lot(0, 0, 0, { d: 0.8 })), null, 'too shallow (depth < 0.3 × the facade scale)');
  assert.equal(kitFit(lot(0, 0, 0, { d: 12 })), null, 'too deep');
  // every style the kit covers finds a house on a lot shaped like its own facade
  for (const id of SF_KIT_IDS) {
    const [kw, kh, kd] = SF_KIT[id].size;
    for (const st of SF_KIT[id].styles) {
      const f = kitFit(lot(1, 0, 0, { style: style(st), w: kw, H: kh - KIT_SWAP.roof, d: kd * 0.5 }));
      assert.ok(f && kitChoices(st).includes(f.id), `${st} (${id})`);
    }
  }
});

test('KitSwap: ≤ 12 houses within 40 u (8 at mid, none at low), ≤ 6 models, ≤ 35k triangles, no shadows, warmed program', () => {
  const src = new FakeL0(), models = new FakeModels();
  // 60 lots of every kit style on a ring of 5–35 u, and 10 more at 42–47 u (never join: beyond rIn)
  const styles = ['victorian', 'edwardian', 'marina', 'sunset', 'chinatown', 'brick', 'deco', 'residential', 'industrial'] as const;
  const lots: L0BuildingView[] = [];
  for (let i = 0; i < 60; i++) {
    const st = styles[i % styles.length], id = kitChoices(st)[0], [kw, kh, kd] = SF_KIT[id].size;
    const a = i * 2.4, r = 5 + (i % 30);
    lots.push(lot(i, Math.cos(a) * r, Math.sin(a) * r, { style: style(st), w: kw * 0.9, H: kh * 0.9 - KIT_SWAP.roof, d: kd * 0.4 }));
  }
  for (let i = 0; i < 10; i++) lots.push(lot(60 + i, 42 + i * 0.5, 0));
  src.add(1, lots.slice(0, 35));
  src.add(2, lots.slice(35));
  const k = new KitSwap(src, models);
  run(k, 0, 0, 0, 3);
  let c = k.counts();
  assert.equal(c.on, KIT_SWAP.max.high);
  assert.ok(c.models.length <= KIT_SWAP.maxModels, `${c.models.length} models`);
  assert.ok(c.triangles <= KIT_SWAP.maxTris && c.draws === c.models.length, `${c.triangles} tris, ${c.draws} draws`);
  assert.equal(c.hidden, 12);
  assert.equal(src.hiddenCount(), 12, 'their toy houses hidden');
  const near = new Set(lots.filter(l => Math.hypot(l.cx, l.cz) <= KIT_SWAP.rIn).map(l => l.osmId));
  for (const e of k.list()) {
    const l = src.cells.get(e.cell)!.lots[e.k];
    assert.ok(near.has(l.osmId), 'only lots within rIn join');
  }
  for (const m of k.group.children as THREE.InstancedMesh[]) {
    assert.ok(m.isInstancedMesh && !m.castShadow && m.receiveShadow, `${m.name}: instanced, no shadows`);
    assert.equal((m.material as THREE.Material).customProgramCacheKey(), 'ob-model-inst', 'the warmed program');
    assert.equal(m.visible, m.count > 0);
  }
  // quality mid: 8 (the extra ones fade out after the dwell), low: none
  src.quality = 'mid';
  let t = run(k, 0, 0, 3, 2.5);
  assert.equal(k.counts().on, 8);
  src.quality = 'low';
  t = run(k, 0, 0, t, 2.5);
  c = k.counts();
  assert.equal(c.on + c.fading, 0, 'low quality: every toy house back');
  assert.equal(src.hiddenCount(), 0);
  // a high camera switches it off too
  src.quality = 'high';
  t = run(k, 0, 0, t, 3);
  assert.equal(k.counts().on, 12);
  run(k, 0, 0, t, 2.5, KIT_SWAP.camH + 1);
  assert.equal(k.counts().on + k.counts().fading, 0);
  k.dispose();
  assert.equal(models.held(), 0, 'every retained model released');
});

test('KitSwap hysteresis: join after 1.5 s within 40 u, fade in 0.3 s then hide; hold to 48 u; leave after 1.5 s, restore first, fade out', () => {
  const src = new FakeL0(), models = new FakeModels();
  src.add(7, [lot(0, 30, 0), lot(1, 39, 0), lot(2, 41, 0)]);
  const before = Uint16Array.from(src.cells.get(7)!.geo.getIndex()!.array as Uint16Array);
  const k = new KitSwap(src, models);
  // at the origin: lots at 30 and 39 u are candidates, 41 u is not
  let t = run(k, 0, 0, 0, 1.2);
  assert.equal(k.list().length, 0, 'nothing before the dwell');
  t = run(k, 0, 0, t, 0.45);
  const joined = k.list();
  assert.equal(joined.length, 2);
  assert.ok(joined.every(e => e.phase === 'in' && !e.hidden), 'fading in, the toy house still drawn under it');
  t = run(k, 0, 0, t, 0.35);
  assert.ok(k.list().every(e => e.phase === 'on' && e.hidden), 'faded in: toy houses hidden');
  assert.equal(src.hiddenCount(), 2);
  // walk 8 u away: the 39 u lot is at 47 u (< rOut 48) and stays; the 41 u lot never joins (49 u)
  t = run(k, -8, 0, t, 3);
  assert.equal(k.list().length, 2, 'held within rOut');
  // 2 u further: the far one is out of rOut; it stays for the dwell, then the toy house comes back and the kit fades
  t = run(k, -10, 0, t, 1.3);
  assert.equal(k.list().filter(e => e.phase === 'on').length, 2, 'a change of mind holds for 1.5 s');
  t = run(k, -10, 0, t, 0.35);
  const leaving = k.list().find(e => e.k === 1)!;
  assert.ok(leaving.phase === 'out' && !leaving.hidden, 'restored first, then fading out');
  t = run(k, -10, 0, t, 0.35);
  assert.deepEqual(k.list().map(e => e.k), [0]);
  assert.equal(src.hiddenCount(), 1);
  // back: it rejoins only after a new dwell
  t = run(k, 0, 0, t, 1.0);
  assert.equal(k.list().length, 1);
  t = run(k, 0, 0, t, 1.0);
  assert.equal(k.list().length, 2);
  // teardown restores the index buffer exactly (hide / restore round trip)
  run(k, 0, 0, t, 0.5);
  k.dispose();
  assert.equal(src.hiddenCount(), 0);
  assert.deepEqual(Uint16Array.from(src.cells.get(7)!.geo.getIndex()!.array as Uint16Array), before, 'index ranges restored byte for byte');
});

test('KitSwap: a dropped L0 cell releases its swaps at once; models load before anything joins; instances pack', () => {
  const src = new FakeL0(), models = new FakeModels();
  models.ready = false;
  src.add(3, [lot(0, 5, 0), lot(1, 10, 0), lot(2, 15, 0)]);
  src.add(4, [lot(0, -5, 0), lot(1, -10, 0)]);
  const k = new KitSwap(src, models);
  let t = run(k, 0, 0, 0, 3);
  assert.equal(k.list().length, 0, 'waiting for the GLB');
  assert.ok(models.held() > 0, 'the model was asked for');
  models.ready = true;
  t = run(k, 0, 0, t, 1);
  assert.equal(k.counts().on, 5);
  const meshes = () => k.group.children as THREE.InstancedMesh[];
  const total = () => meshes().reduce((n, m) => n + m.count, 0);
  const n0 = total();
  const calls = src.hideCalls;
  src.drop(3);
  const c = k.counts();
  assert.equal(c.on, 2, 'cell 3 swaps gone at once');
  assert.equal(src.hideCalls, calls, 'no restore into a mesh that is going away');
  assert.equal(total(), n0 - 3, 'instances packed');
  // the survivors still carry their own matrices after the pack
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  const xs: number[] = [];
  for (const mesh of meshes()) for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); xs.push(Math.round(p.setFromMatrixPosition(m).x)); }
  assert.deepEqual(xs.sort((a, b) => a - b), [-10, -5]);
  run(k, 0, 0, t, 1);
  assert.equal(k.counts().on, 2);
  k.dispose();
});

test('KitSwap fills only the frame\'s room: the view stays ≤ 400k − margin with the kit (the frame minus its own triangles)', () => {
  const src = new FakeL0(), models = new FakeModels();
  src.add(1, Array.from({ length: 20 }, (_, i) => lot(i, Math.cos(i) * (5 + i), Math.sin(i) * (5 + i))));
  let city = 330_000;
  const k = new KitSwap(src, models, { frameTriangles: () => city + k.counts().triangles });
  let t = run(k, 0, 0, 0, 3);
  assert.equal(k.counts().on, 12, 'a light view: the full dozen');
  assert.ok(city + k.counts().triangles <= KIT_SWAP.frameBudget);
  // the city alone grows to 390k: the kit shrinks to what fits (the farthest leave after the dwell)
  city = 390_000;
  t = run(k, 0, 0, t, 5);
  const c = k.counts();
  assert.ok(c.on + c.fading >= 1 && city + c.triangles <= KIT_SWAP.frameBudget - KIT_SWAP.frameMargin, `${c.on} on: ${city + c.triangles}`);
  // already over budget without the kit: every toy house comes back
  city = 421_000;
  t = run(k, 0, 0, t, 5);
  assert.equal(k.counts().on + k.counts().fading, 0);
  assert.equal(src.hiddenCount(), 0);
  // unknown frame (no renderer yet): no frame limit
  const k2 = new KitSwap(src, models, { frameTriangles: () => null });
  run(k2, 0, 0, t, 3);
  assert.equal(k2.counts().on, 12);
  k.dispose();
  k2.dispose();
});

test('D2-review: a street of one kit model never draws more instances than its mesh has slots (a house leaving while the next joins)', () => {
  // the Sunset: every lot takes sunset-doelger (18 candidates within 40 u at (-199, 1518) in the city), the player walks
  const src = new FakeL0(), models = new FakeModels();
  const [kw, kh, kd] = SF_KIT['sunset-doelger'].size;
  src.add(1, Array.from({ length: 80 }, (_, i) => lot(i, -160 + i * 4, 6, { style: style('sunset'), w: kw * 0.95, H: kh * 0.95 - KIT_SWAP.roof, d: kd * 0.4 })));
  let grabbed = 0;
  const k = new KitSwap(src, models, { onRender: () => { grabbed++; } });
  let t = 0, worst = 0, over = 0, maxOn = 0;
  for (let i = 0; i < 60 * 60; i++) {
    t += 1 / 60;
    k.update(-120 + t * 3.5, 0, t, 5);
    for (const m of k.group.children as THREE.InstancedMesh[]) {
      worst = Math.max(worst, m.count);
      if (m.count > m.instanceMatrix.count || m.count * 4 > (m.geometry.getAttribute('aObInst') as THREE.InstancedBufferAttribute).array.length) over++;
    }
    maxOn = Math.max(maxOn, k.counts().on);
  }
  assert.deepEqual(k.counts().models, ['sunset-doelger']);
  assert.equal(maxOn, KIT_SWAP.max.high, 'the full dozen of one model');
  assert.ok(worst > KIT_SWAP.max.high, `a leaving house and a joining one overlap (worst ${worst} instances)`);
  assert.equal(over, 0, `mesh.count past the instance buffers on ${over} frames (worst ${worst}, ${KIT_SLOTS} slots)`);
  // the kit meshes hand the renderer to sites.ts (the frame budget before any landmark lod 0 is drawn)
  const mesh = k.group.children[0] as THREE.InstancedMesh;
  mesh.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), new THREE.Camera(), mesh.geometry, mesh.material as THREE.Material, null);
  assert.equal(grabbed, 1);
  k.dispose();
  assert.equal(src.hiddenCount(), 0);
});
