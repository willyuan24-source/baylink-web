import * as THREE from 'three';
import { GROUND, GROUND_BATCH, TOY, TOY_BATCH } from '../materials';
import { freezeStatic } from '../builder';
import type { PoolArrays } from './mesh';

/**
 * The L1 / L2 pools (plan §5.5): every middle / far cell (and far landmark silhouette) is one item made of a TOY part
 * and a GROUND part. Two implementations behind one interface:
 *
 * - `BatchedPool` (WEBGL_multi_draw present): two THREE.BatchedMesh — one draw call each for the whole middle and far
 *   city. Items live in size-class slots (×1.25 steps) so streaming never fragments the buffers: a freed slot is
 *   hidden and reused by the next item of its class (setGeometryAt, partial upload of that range). Static items
 *   (far cells) get exact slots at boot. Visibility is setVisibleAt — free.
 * - `TilePool` (no multi-draw: three would issue one draw per item): items are merged per 512 u tile into one TOY and
 *   one GROUND mesh; a tile whose item set changed is rebuilt (≤ 1 per frame), ≈ 15 land tiles → ≤ 30 draw calls.
 *
 * Both cull per item against the camera frustum in `update(camera)` (wave 3, P2 / P3; one sphere test per item, skipped
 * while the view and the items stand still): the batched pool switches items off with setVisibleAt (three's own
 * per-instance culling, perObjectFrustumCulled, re-reads every instance matrix and bounding sphere each frame: it is
 * off), the tile pool keeps each tile's full index and draws a compacted copy of the items in view (an index-only
 * upload, the same draw calls), so both paths draw the same triangles.
 *
 * Materials (wave 3, P2): the batched pool draws with TOY_BATCH / GROUND_BATCH (BatchedMesh only), the tiles with
 * TOY / GROUND (plain Mesh, like the L0 cells): one material instance per object kind, the same programs. Flags match
 * world/warmup.ts (pools: receiveShadow off, tiles: on) so no program is compiled while walking.
 */

export interface PoolItem {
  toy: PoolArrays | null;
  ground: PoolArrays | null;
  /** tile pool: merge into this bin instead of the item's 512 u tile (the satellite boards: a few big bins, ≤ 2 calls each) */
  bin?: number;
}

export interface PoolStats {
  kind: 'batched' | 'tile'; items: number; visible: number; toyVertices: number; groundVertices: number; toyCapacity: number; groundCapacity: number; drawObjects: number; rebuilds: number;
  /** triangles of the items switched on (before frustum culling) */
  triangles: number;
  /** items switched on and inside the camera frustum at the last cull */
  inView: number;
}

export interface CellPool {
  readonly group: THREE.Group;
  /** static = never removed (exact slot); dynamic items get a reusable size-class slot */
  add(id: number, item: PoolItem, dynamic: boolean, visible?: boolean): void;
  remove(id: number): void;
  has(id: number): boolean;
  setVisible(id: number, visible: boolean): void;
  /** triangles of one item (0 when absent) */
  trianglesOf(id: number): number;
  /** tier cross-fade value of an item (materials.ts TIER_FADE_FRAG: 1 = solid); false when this pool cannot fade (tiles) */
  setFade(id: number, value: number): boolean;
  /** per frame: tile rebuilds and the per-item frustum cull against `camera` (without a camera nothing is culled), items
   *  wholly deeper than `maxDepth` out too (hazeCullDepth) */
  update(camera?: THREE.Camera, maxDepth?: number): void;
  stats(): PoolStats;
  dispose(): void;
}

/** BufferGeometry over pool arrays (no copies): position f32×3, normal i8×4 (read as vec3), colour u8×3, aInfo f32×4. */
export function poolGeometry(a: PoolArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 4, true));
  g.setAttribute('color', new THREE.BufferAttribute(a.color, 3, true));
  g.setAttribute('aInfo', new THREE.BufferAttribute(a.info, 4));
  g.setIndex(new THREE.BufferAttribute(a.index, 1));
  const b = a.bounds;
  g.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return g;
}

// ---------------------------------------------------------------------------
// per-item culling
// ---------------------------------------------------------------------------

/**
 * The camera frustum for per-item culling. `from(camera)` refreshes it and returns false while the view-projection
 * matrix is exactly the one of the last call (a camera standing still: nothing to re-test). The camera's
 * matrixWorldInverse must be current (the streamer reads the camera direction first, which updates it).
 */
export class ViewCull {
  readonly frustum = new THREE.Frustum();
  valid = false;
  /** the haze cull (hazeCullDepth): spheres wholly deeper than this view depth are out; Infinity = off */
  maxDepth = Infinity;
  private m = new THREE.Matrix4();
  private last = new Float64Array(16);
  private eye = new THREE.Vector3();
  private fwd = new THREE.Vector3();

  /** Take the camera's frustum (and the haze depth); false when neither changed since the last call (nothing to re-test). */
  from(camera: THREE.Camera, maxDepth = Infinity): boolean {
    const e = this.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
    let same = this.valid && maxDepth === this.maxDepth;
    for (let i = 0; i < 16; i++) if (e[i] !== this.last[i]) { same = false; this.last[i] = e[i]; }
    if (same) return false;
    this.frustum.setFromProjectionMatrix(this.m);
    this.maxDepth = maxDepth;
    const w = camera.matrixWorld.elements;
    this.eye.set(w[12], w[13], w[14]);
    this.fwd.set(-w[8], -w[9], -w[10]).normalize();
    this.valid = true;
    return true;
  }

  /** Sphere (cx, cy, cz, r at s[o…o+3], world space) inside or touching the frustum and not wholly past maxDepth; true while no frustum is known. */
  test(s: ArrayLike<number>, o = 0): boolean {
    if (!this.valid) return true;
    const x = s[o], y = s[o + 1], z = s[o + 2], r = s[o + 3];
    if (r < 0) return false;
    for (const p of this.frustum.planes) if (p.normal.x * x + p.normal.y * y + p.normal.z * z + p.constant < -r) return false;
    if (this.maxDepth < Infinity && (x - this.eye.x) * this.fwd.x + (y - this.eye.y) * this.fwd.y + (z - this.eye.z) * this.fwd.z - r > this.maxDepth) return false;
    return true;
  }
}

/**
 * The haze cull (wave 3, the budget after the satellite boards): three's FogExp2 hides a fragment at view depth d by
 * 1 − exp(−(ρ·d)²), so a pool item wholly deeper than √(−ln(1 − fog)) / ρ is ≥ `fog` haze and is not drawn. At walking
 * height that is 1,750 u at golden hour (ρ 0.0012), 950 u in the morning, 1,150 u at night: the far city cells and
 * the Marin / East Bay boards behind the skyline; high up (Twin Peaks, a glide) the city thins its haze and nothing is
 * cut. Quantised to `step` u so a drifting density re-tests the items rarely; Infinity past the far plane.
 */
export const HAZE_CULL = { fog: 0.985, step: 50 } as const;
export function hazeCullDepth(density: number, far = Infinity): number {
  if (!(density > 0)) return Infinity;
  const d = Math.ceil(Math.sqrt(-Math.log(1 - HAZE_CULL.fog)) / density / HAZE_CULL.step) * HAZE_CULL.step;
  return d >= far ? Infinity : d;
}

/** Bounding sphere (cx, cy, cz, r) around the bounds of some pool arrays, written at out[o…o+3] (r = −1: empty). */
export function boundsSphere(parts: readonly (PoolArrays | null)[], out: Float32Array, o = 0) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const a of parts) {
    if (!a || !a.vertexCount) continue;
    const b = a.bounds;
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); z0 = Math.min(z0, b[2]);
    x1 = Math.max(x1, b[3]); y1 = Math.max(y1, b[4]); z1 = Math.max(z1, b[5]);
  }
  if (!(x1 >= x0)) { out[o] = out[o + 1] = out[o + 2] = 0; out[o + 3] = -1; return; }
  out[o] = (x0 + x1) / 2; out[o + 1] = (y0 + y1) / 2; out[o + 2] = (z0 + z1) / 2;
  out[o + 3] = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2;
}

// ---------------------------------------------------------------------------
// BatchedMesh pool
// ---------------------------------------------------------------------------

const CLASS0 = 256, GROW = 1.25;
/** vertex capacity of size class c */
export const classVerts = (c: number) => Math.ceil(CLASS0 * GROW ** c);
/** smallest class with ≥ v vertices and ≥ i indices (indices reserved at `ratio` per vertex) */
export function sizeClass(v: number, i: number, ratio: number): number {
  let c = 0;
  while (classVerts(c) < v || Math.ceil(classVerts(c) * ratio) < i) c++;
  return c;
}

interface Slot { geo: number; inst: number; cls: number; verts: number; tris: number }
const _fade = new THREE.Vector4();

class Sub {
  readonly mesh: THREE.BatchedMesh;
  private free = new Map<number, Slot[]>();
  private usedV = 0;
  private usedI = 0;
  private maxV: number;
  private maxI: number;
  private maxInst: number;
  live = 0;
  liveVerts = 0;
  readonly ratio: number;

  constructor(material: THREE.Material, name: string, maxV: number, ratio: number, maxInst: number) {
    this.ratio = ratio;
    this.maxV = maxV;
    this.maxI = Math.ceil(maxV * ratio);
    this.maxInst = maxInst;
    this.mesh = new THREE.BatchedMesh(maxInst, this.maxV, this.maxI, material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    // the pool culls per item itself (setVisibleAt, see BatchedPool.update); with three's per-instance culling and
    // sorting off, onBeforeRender only rebuilds the draw list on a frame whose visibility changed
    this.mesh.perObjectFrustumCulled = false;
    this.mesh.sortObjects = false;
    this.mesh.receiveShadow = false;
    this.mesh.castShadow = false;
    // pool items are in world space (identity instance matrices): the mesh never moves
    freezeStatic(this.mesh);
    // the tier cross-fade (C2-10) rides on the batching colour's alpha: the colour texture exists from the start, so the
    // pool compiles one program variant (USE_BATCHING_COLOR, warmed up) and never switches
    const m = this.mesh as unknown as { _colorsTexture: THREE.DataTexture | null; _initColorsTexture(): void };
    if (!m._colorsTexture) m._initColorsTexture();
  }

  /** the item's colour: white, alpha = the fade value (1 = solid) */
  fade(s: Slot, value: number) { this.mesh.setColorAt(s.inst, _fade.set(1, 1, 1, value)); }

  get capacity() { return this.maxV; }

  private ensure(v: number, i: number) {
    if (this.usedV + v > this.maxV || this.usedI + i > this.maxI) {
      const nv = Math.max(Math.ceil(this.maxV * 1.5), this.usedV + v + 1024), ni = Math.max(Math.ceil(this.maxI * 1.5), this.usedI + i + 2048);
      this.mesh.setGeometrySize(nv, ni);
      this.maxV = nv; this.maxI = ni;
    }
    if (this.mesh.instanceCount + 1 > this.maxInst) {
      this.maxInst = Math.ceil(this.maxInst * 1.5);
      this.mesh.setInstanceCount(this.maxInst);
    }
  }

  add(a: PoolArrays, dynamic: boolean): Slot {
    const geo = poolGeometry(a);
    if (!dynamic) {
      this.ensure(a.vertexCount, a.indexCount);
      const id = this.mesh.addGeometry(geo);
      this.usedV += a.vertexCount; this.usedI += a.indexCount;
      const slot = { geo: id, inst: this.mesh.addInstance(id), cls: -1, verts: a.vertexCount, tris: a.indexCount / 3 };
      this.live++; this.liveVerts += a.vertexCount;
      return slot;
    }
    const cls = sizeClass(a.vertexCount, a.indexCount, this.ratio);
    const reuse = this.free.get(cls)?.pop();
    if (reuse) {
      this.mesh.setGeometryAt(reuse.geo, geo);
      this.mesh.setVisibleAt(reuse.inst, true);
      this.fade(reuse, 1);
      reuse.verts = a.vertexCount;
      reuse.tris = a.indexCount / 3;
      this.live++; this.liveVerts += a.vertexCount;
      return reuse;
    }
    const rv = classVerts(cls), ri = Math.ceil(rv * this.ratio);
    this.ensure(rv, ri);
    const id = this.mesh.addGeometry(geo, rv, ri);
    this.usedV += rv; this.usedI += ri;
    this.live++; this.liveVerts += a.vertexCount;
    return { geo: id, inst: this.mesh.addInstance(id), cls, verts: a.vertexCount, tris: a.indexCount / 3 };
  }

  release(s: Slot) {
    this.mesh.setVisibleAt(s.inst, false);
    this.live--; this.liveVerts -= s.verts;
    if (s.cls < 0) return; // static slots are never reused
    let l = this.free.get(s.cls);
    if (!l) { l = []; this.free.set(s.cls, l); }
    l.push(s);
  }
}

interface BatchedRec { toy: Slot | null; ground: Slot | null; visible: boolean; inView: boolean; on: boolean; sphere: Float32Array }

export class BatchedPool implements CellPool {
  readonly group = new THREE.Group();
  private toy: Sub;
  private ground: Sub;
  private items = new Map<number, BatchedRec>();
  private cull = new ViewCull();
  /** an item arrived or was switched on since the last cull: re-test even when the view stood still */
  private dirty = true;
  private inView = 0;

  constructor(opts: { toyVerts: number; groundVerts: number; instances: number }) {
    this.group.name = 'city-pools';
    freezeStatic(this.group);
    this.toy = new Sub(TOY_BATCH, 'city-pool-toy', opts.toyVerts, 1.6, opts.instances);
    this.ground = new Sub(GROUND_BATCH, 'city-pool-ground', opts.groundVerts, 3.2, opts.instances);
    this.group.add(this.ground.mesh, this.toy.mesh);
  }

  /** instance visibility = switched on and in view; setVisibleAt only on a change (it re-lists the draws) */
  private apply(r: BatchedRec) {
    const on = r.visible && r.inView;
    if (on === r.on) return;
    r.on = on;
    if (r.toy) this.toy.mesh.setVisibleAt(r.toy.inst, on);
    if (r.ground) this.ground.mesh.setVisibleAt(r.ground.inst, on);
  }

  add(id: number, item: PoolItem, dynamic: boolean, visible = true) {
    if (this.items.has(id)) this.remove(id);
    const sphere = new Float32Array(4);
    boundsSphere([item.toy, item.ground], sphere);
    // Sub.add leaves the slot's instance visible (on = true); apply() settles it
    const rec: BatchedRec = { toy: item.toy ? this.toy.add(item.toy, dynamic) : null, ground: item.ground ? this.ground.add(item.ground, dynamic) : null, visible, inView: this.cull.test(sphere), on: true, sphere };
    this.items.set(id, rec);
    this.apply(rec);
    this.dirty = true;
  }
  remove(id: number) {
    const r = this.items.get(id);
    if (!r) return;
    if (r.toy) this.toy.release(r.toy);
    if (r.ground) this.ground.release(r.ground);
    this.items.delete(id);
  }
  has(id: number) { return this.items.has(id); }
  setVisible(id: number, visible: boolean) {
    const r = this.items.get(id);
    if (!r || r.visible === visible) return;
    r.visible = visible;
    // tested against the last frustum at once (a caller after this frame's cull never shows an item out of view)
    if (visible) { r.inView = this.cull.test(r.sphere); this.dirty = true; }
    this.apply(r);
  }
  trianglesOf(id: number) { const r = this.items.get(id); return r ? (r.toy?.tris ?? 0) + (r.ground?.tris ?? 0) : 0; }
  setFade(id: number, value: number) {
    const r = this.items.get(id);
    if (!r) return true;
    if (r.toy) this.toy.fade(r.toy, value);
    if (r.ground) this.ground.fade(r.ground, value);
    return true;
  }
  update(camera?: THREE.Camera, maxDepth = Infinity) {
    if (!camera) return;
    if (!this.cull.from(camera, maxDepth) && !this.dirty) return;
    this.dirty = false;
    let n = 0;
    for (const r of this.items.values()) {
      if (!r.visible) continue;
      r.inView = this.cull.test(r.sphere);
      if (r.inView) n++;
      this.apply(r);
    }
    this.inView = n;
  }
  stats(): PoolStats {
    let visible = 0, triangles = 0;
    for (const r of this.items.values()) if (r.visible) { visible++; triangles += (r.toy?.tris ?? 0) + (r.ground?.tris ?? 0); }
    return { kind: 'batched', items: this.items.size, visible, toyVertices: this.toy.liveVerts, groundVertices: this.ground.liveVerts, toyCapacity: this.toy.capacity, groundCapacity: this.ground.capacity, drawObjects: 2, rebuilds: 0, triangles, inView: this.inView };
  }
  dispose() {
    this.toy.mesh.dispose();
    this.ground.mesh.dispose();
    this.items.clear();
  }
}

// ---------------------------------------------------------------------------
// tile fallback (no WEBGL_multi_draw)
// ---------------------------------------------------------------------------

const TILE = 512;

/**
 * One merged mesh of a tile (its TOY or its GROUND part) with per-item culling: `full` is the complete merged index,
 * `ranges` holds per item (in merge order) its index start, index count and bounding sphere; the geometry's own index
 * holds the compacted index of the items in view, drawn with setDrawRange (index-only partial upload).
 */
interface TilePart { mesh: THREE.Mesh; full: Uint16Array | Uint32Array | null; ranges: Float32Array; n: number; mask: Uint8Array; drawn: number }

interface TileRec { key: number; ids: Set<number>; toy: TilePart; ground: TilePart; dirty: boolean }

/** Merge pool arrays into one geometry; `ranges` gets, per part, index start / count and its bounding sphere (6 floats). */
export function mergePoolArrays(parts: PoolArrays[]): { geometry: THREE.BufferGeometry; index: Uint16Array | Uint32Array; ranges: Float32Array } | null {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.vertexCount; ni += p.indexCount; }
  if (!nv) return null;
  const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 4), col = new Uint8Array(nv * 3), inf = new Float32Array(nv * 4);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  const ranges = new Float32Array(parts.length * 6);
  let v = 0, i = 0;
  parts.forEach((p, k) => {
    pos.set(p.position.subarray(0, p.vertexCount * 3), v * 3);
    nor.set(p.normal.subarray(0, p.vertexCount * 4), v * 4);
    col.set(p.color.subarray(0, p.vertexCount * 3), v * 3);
    inf.set(p.info.subarray(0, p.vertexCount * 4), v * 4);
    for (let q = 0; q < p.indexCount; q++) idx[i + q] = p.index[q] + v;
    for (let q = 0; q < 3; q++) { box[q] = Math.min(box[q], p.bounds[q]); box[q + 3] = Math.max(box[q + 3], p.bounds[q + 3]); }
    ranges[k * 6] = i;
    ranges[k * 6 + 1] = p.indexCount;
    boundsSphere([p], ranges, k * 6 + 2);
    v += p.vertexCount; i += p.indexCount;
  });
  const geometry = poolGeometry({ vertexCount: nv, indexCount: ni, position: pos, normal: nor, color: col, info: inf, index: idx.slice(), bounds: box });
  geometry.getIndex()!.setUsage(THREE.DynamicDrawUsage);
  return { geometry, index: idx, ranges };
}

/** Re-test a tile part's items against the view; on a change, compact the drawn index (true when it changed). */
export function cullTilePart(part: Pick<TilePart, 'mesh' | 'full' | 'ranges' | 'n' | 'mask' | 'drawn'>, test: (s: Float32Array, o: number) => boolean): boolean {
  if (!part.full) return false;
  let changed = false;
  for (let k = 0; k < part.n; k++) {
    const vis = test(part.ranges, k * 6 + 2) ? 1 : 0;
    if (vis !== part.mask[k]) { part.mask[k] = vis; changed = true; }
  }
  if (!changed) return false;
  const attr = part.mesh.geometry.getIndex()!;
  const dst = attr.array as Uint16Array | Uint32Array;
  let n = 0;
  for (let k = 0; k < part.n; k++) {
    if (!part.mask[k]) continue;
    const s = part.ranges[k * 6], c = part.ranges[k * 6 + 1];
    dst.set(part.full.subarray(s, s + c), n);
    n += c;
  }
  part.drawn = n;
  part.mesh.geometry.setDrawRange(0, n);
  attr.clearUpdateRanges();
  if (n) attr.addUpdateRange(0, n);
  attr.needsUpdate = true;
  part.mesh.visible = n > 0;
  return true;
}

export class TilePool implements CellPool {
  readonly group = new THREE.Group();
  private items = new Map<number, { item: PoolItem; tile: number; visible: boolean }>();
  private tiles = new Map<number, TileRec>();
  private rebuilds = 0;
  private cull = new ViewCull();

  constructor() {
    this.group.name = 'city-tiles';
    freezeStatic(this.group);
  }

  private tileOf(item: PoolItem) {
    if (item.bin !== undefined) return 1_000_000 + item.bin;
    const b = (item.toy ?? item.ground)!.bounds;
    const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
    return (Math.floor(cx / TILE) + 64) * 256 + (Math.floor(cz / TILE) + 64);
  }
  private tile(key: number): TileRec {
    let t = this.tiles.get(key);
    if (!t) {
      const mk = (mat: THREE.Material, name: string): TilePart => {
        const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
        m.name = name; freezeStatic(m); m.receiveShadow = true; m.visible = false;
        return { mesh: m, full: null, ranges: new Float32Array(0), n: 0, mask: new Uint8Array(0), drawn: 0 };
      };
      t = { key, ids: new Set(), toy: mk(TOY, `city-tile-toy#${key}`), ground: mk(GROUND, `city-tile-ground#${key}`), dirty: false };
      this.group.add(t.ground.mesh, t.toy.mesh);
      this.tiles.set(key, t);
    }
    return t;
  }
  add(id: number, item: PoolItem, _dynamic: boolean, visible = true) {
    if (!item.toy && !item.ground) return;
    if (this.items.has(id)) this.remove(id);
    const key = this.tileOf(item);
    this.items.set(id, { item, tile: key, visible });
    const t = this.tile(key);
    t.ids.add(id);
    if (visible) t.dirty = true;
  }
  remove(id: number) {
    const r = this.items.get(id);
    if (!r) return;
    this.items.delete(id);
    const t = this.tiles.get(r.tile)!;
    t.ids.delete(id);
    if (r.visible) t.dirty = true;
  }
  has(id: number) { return this.items.has(id); }
  setVisible(id: number, visible: boolean) {
    const r = this.items.get(id);
    if (!r || r.visible === visible) return;
    r.visible = visible;
    this.tiles.get(r.tile)!.dirty = true;
  }
  trianglesOf(id: number) { const r = this.items.get(id); return r ? ((r.item.toy?.indexCount ?? 0) + (r.item.ground?.indexCount ?? 0)) / 3 : 0; }
  /** merged tiles cannot fade one item (tiers switch at once on the no-multi-draw path) */
  setFade() { return false; }

  private rebuild(t: TileRec) {
    const toys: PoolArrays[] = [], grounds: PoolArrays[] = [];
    for (const id of t.ids) {
      const r = this.items.get(id)!;
      if (!r.visible) continue;
      if (r.item.toy) toys.push(r.item.toy);
      if (r.item.ground) grounds.push(r.item.ground);
    }
    for (const [part, arrays] of [[t.toy, toys], [t.ground, grounds]] as const) {
      part.mesh.geometry.dispose();
      const m = mergePoolArrays(arrays);
      part.mesh.geometry = m?.geometry ?? new THREE.BufferGeometry();
      part.mesh.visible = !!m;
      part.full = m?.index ?? null;
      part.ranges = m?.ranges ?? new Float32Array(0);
      part.n = arrays.length;
      part.mask = new Uint8Array(arrays.length).fill(1);
      part.drawn = m?.index.length ?? 0;
    }
    this.rebuilds++;
  }

  update(camera?: THREE.Camera, maxDepth = Infinity) {
    let rebuilt: TileRec | null = null;
    for (const t of this.tiles.values()) {
      if (!t.dirty) continue;
      t.dirty = false;
      this.rebuild(t);
      rebuilt = t;
      break; // ≤ 1 tile per frame
    }
    if (!camera) return;
    const test = (s: Float32Array, o: number) => this.cull.test(s, o);
    if (this.cull.from(camera, maxDepth)) {
      for (const t of this.tiles.values()) { cullTilePart(t.toy, test); cullTilePart(t.ground, test); }
    } else if (rebuilt) {
      cullTilePart(rebuilt.toy, test);
      cullTilePart(rebuilt.ground, test);
    }
  }
  stats(): PoolStats {
    let visible = 0, tv = 0, gv = 0, triangles = 0;
    for (const r of this.items.values()) if (r.visible) { visible++; tv += r.item.toy?.vertexCount ?? 0; gv += r.item.ground?.vertexCount ?? 0; triangles += ((r.item.toy?.indexCount ?? 0) + (r.item.ground?.indexCount ?? 0)) / 3; }
    let draw = 0, inView = 0;
    for (const t of this.tiles.values()) {
      draw += (t.toy.mesh.visible ? 1 : 0) + (t.ground.mesh.visible ? 1 : 0);
      for (let k = 0; k < t.toy.n; k++) inView += t.toy.mask[k];
    }
    return { kind: 'tile', items: this.items.size, visible, toyVertices: tv, groundVertices: gv, toyCapacity: 0, groundCapacity: 0, drawObjects: draw, rebuilds: this.rebuilds, triangles, inView };
  }
  dispose() {
    for (const t of this.tiles.values()) { t.toy.mesh.geometry.dispose(); t.ground.mesh.geometry.dispose(); }
    this.tiles.clear();
    this.items.clear();
  }
}

/** Multi-draw decides the pool (three draws a BatchedMesh item by item without it). `?pool=tile` forces the fallback. */
export function createCellPool(renderer: THREE.WebGLRenderer, opts: { toyVerts: number; groundVerts: number; instances: number }, force?: 'batched' | 'tile'): CellPool {
  const multi = renderer.extensions.has('WEBGL_multi_draw');
  return (force ?? (multi ? 'batched' : 'tile')) === 'batched' ? new BatchedPool(opts) : new TilePool();
}
