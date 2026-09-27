import * as THREE from 'three';
import { GROUND, TOY } from '../materials';
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
 * Both use the shared TOY / GROUND materials; flags match world/warmup.ts (pools: receiveShadow off, tiles: on) so no
 * program is compiled while walking.
 */

export interface PoolItem { toy: PoolArrays | null; ground: PoolArrays | null }

export interface PoolStats { kind: 'batched' | 'tile'; items: number; visible: number; toyVertices: number; groundVertices: number; toyCapacity: number; groundCapacity: number; drawObjects: number; rebuilds: number; /** triangles of the items switched on (before frustum culling) */ triangles: number }

export interface CellPool {
  readonly group: THREE.Group;
  /** static = never removed (exact slot); dynamic items get a reusable size-class slot */
  add(id: number, item: PoolItem, dynamic: boolean, visible?: boolean): void;
  remove(id: number): void;
  has(id: number): boolean;
  setVisible(id: number, visible: boolean): void;
  /** triangles of one item (0 when absent) */
  trianglesOf(id: number): number;
  /** per frame (tile rebuilds) */
  update(): void;
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
    this.mesh.frustumCulled = false; // per-instance culling (perObjectFrustumCulled) still runs
    this.mesh.receiveShadow = false;
    this.mesh.castShadow = false;
    this.mesh.sortObjects = false;
  }

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

export class BatchedPool implements CellPool {
  readonly group = new THREE.Group();
  private toy: Sub;
  private ground: Sub;
  private items = new Map<number, { toy: Slot | null; ground: Slot | null; visible: boolean }>();

  constructor(opts: { toyVerts: number; groundVerts: number; instances: number }) {
    this.group.name = 'city-pools';
    this.toy = new Sub(TOY, 'city-pool-toy', opts.toyVerts, 1.6, opts.instances);
    this.ground = new Sub(GROUND, 'city-pool-ground', opts.groundVerts, 3.2, opts.instances);
    this.group.add(this.ground.mesh, this.toy.mesh);
  }

  add(id: number, item: PoolItem, dynamic: boolean, visible = true) {
    if (this.items.has(id)) this.remove(id);
    const rec = { toy: item.toy ? this.toy.add(item.toy, dynamic) : null, ground: item.ground ? this.ground.add(item.ground, dynamic) : null, visible: true };
    this.items.set(id, rec);
    if (!visible) this.setVisible(id, false);
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
    if (r.toy) this.toy.mesh.setVisibleAt(r.toy.inst, visible);
    if (r.ground) this.ground.mesh.setVisibleAt(r.ground.inst, visible);
  }
  trianglesOf(id: number) { const r = this.items.get(id); return r ? (r.toy?.tris ?? 0) + (r.ground?.tris ?? 0) : 0; }
  update() {}
  stats(): PoolStats {
    let visible = 0, triangles = 0;
    for (const r of this.items.values()) if (r.visible) { visible++; triangles += (r.toy?.tris ?? 0) + (r.ground?.tris ?? 0); }
    return { kind: 'batched', items: this.items.size, visible, toyVertices: this.toy.liveVerts, groundVertices: this.ground.liveVerts, toyCapacity: this.toy.capacity, groundCapacity: this.ground.capacity, drawObjects: 2, rebuilds: 0, triangles };
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

interface TileRec { key: number; ids: Set<number>; toy: THREE.Mesh; ground: THREE.Mesh; dirty: boolean }

function merge(parts: PoolArrays[]): THREE.BufferGeometry | null {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.vertexCount; ni += p.indexCount; }
  if (!nv) return null;
  const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 4), col = new Uint8Array(nv * 3), inf = new Float32Array(nv * 4);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  let v = 0, i = 0;
  for (const p of parts) {
    pos.set(p.position.subarray(0, p.vertexCount * 3), v * 3);
    nor.set(p.normal.subarray(0, p.vertexCount * 4), v * 4);
    col.set(p.color.subarray(0, p.vertexCount * 3), v * 3);
    inf.set(p.info.subarray(0, p.vertexCount * 4), v * 4);
    for (let k = 0; k < p.indexCount; k++) idx[i + k] = p.index[k] + v;
    for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], p.bounds[k]); box[k + 3] = Math.max(box[k + 3], p.bounds[k + 3]); }
    v += p.vertexCount; i += p.indexCount;
  }
  return poolGeometry({ vertexCount: nv, indexCount: ni, position: pos, normal: nor, color: col, info: inf, index: idx, bounds: box });
}

export class TilePool implements CellPool {
  readonly group = new THREE.Group();
  private items = new Map<number, { item: PoolItem; tile: number; visible: boolean }>();
  private tiles = new Map<number, TileRec>();
  private rebuilds = 0;

  constructor() { this.group.name = 'city-tiles'; }

  private tileOf(item: PoolItem) {
    const b = (item.toy ?? item.ground)!.bounds;
    const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
    return (Math.floor(cx / TILE) + 64) * 256 + (Math.floor(cz / TILE) + 64);
  }
  private tile(key: number): TileRec {
    let t = this.tiles.get(key);
    if (!t) {
      const mk = (mat: THREE.Material, name: string) => {
        const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
        m.name = name; m.matrixAutoUpdate = false; m.receiveShadow = true; m.visible = false;
        return m;
      };
      t = { key, ids: new Set(), toy: mk(TOY, `city-tile-toy#${key}`), ground: mk(GROUND, `city-tile-ground#${key}`), dirty: false };
      this.group.add(t.ground, t.toy);
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
  update() {
    for (const t of this.tiles.values()) {
      if (!t.dirty) continue;
      t.dirty = false;
      const toys: PoolArrays[] = [], grounds: PoolArrays[] = [];
      for (const id of t.ids) {
        const r = this.items.get(id)!;
        if (!r.visible) continue;
        if (r.item.toy) toys.push(r.item.toy);
        if (r.item.ground) grounds.push(r.item.ground);
      }
      for (const [mesh, parts] of [[t.toy, toys], [t.ground, grounds]] as const) {
        mesh.geometry.dispose();
        const g = merge(parts);
        mesh.geometry = g ?? new THREE.BufferGeometry();
        mesh.visible = !!g;
      }
      this.rebuilds++;
      break; // ≤ 1 tile per frame
    }
  }
  stats(): PoolStats {
    let visible = 0, tv = 0, gv = 0, triangles = 0;
    for (const r of this.items.values()) if (r.visible) { visible++; tv += r.item.toy?.vertexCount ?? 0; gv += r.item.ground?.vertexCount ?? 0; triangles += ((r.item.toy?.indexCount ?? 0) + (r.item.ground?.indexCount ?? 0)) / 3; }
    let draw = 0;
    for (const t of this.tiles.values()) draw += (t.toy.visible ? 1 : 0) + (t.ground.visible ? 1 : 0);
    return { kind: 'tile', items: this.items.size, visible, toyVertices: tv, groundVertices: gv, toyCapacity: 0, groundCapacity: 0, drawObjects: draw, rebuilds: this.rebuilds, triangles };
  }
  dispose() {
    for (const t of this.tiles.values()) { t.toy.geometry.dispose(); t.ground.geometry.dispose(); }
    this.tiles.clear();
    this.items.clear();
  }
}

/** Multi-draw decides the pool (three draws a BatchedMesh item by item without it). `?pool=tile` forces the fallback. */
export function createCellPool(renderer: THREE.WebGLRenderer, opts: { toyVerts: number; groundVerts: number; instances: number }, force?: 'batched' | 'tile'): CellPool {
  const multi = renderer.extensions.has('WEBGL_multi_draw');
  return (force ?? (multi ? 'batched' : 'tile')) === 'batched' ? new BatchedPool(opts) : new TilePool();
}
