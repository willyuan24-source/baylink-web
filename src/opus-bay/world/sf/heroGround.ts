import * as THREE from 'three';
import { shade } from '../builder';
import { CityBatch, type PoolArrays, buildGround } from './mesh';

/**
 * The hero district's ground seen from afar (lane C2-5, plan §5.1 "hero far"): the hand-made ground (≈ 47k triangles
 * in 8 chunks of 150 u: streets, curbs, sidewalks, plazas, lawns, piers) resampled into a 4 u height-and-colour grid
 * written like the city's own L1 ground (marching-squares coast, a short lip) — one item of the city ground pool,
 * so it costs no draw call of its own. The stream swaps it in with the hero's L1 boxes (focus > 300 u from the slab).
 *
 * Sampling: every up-facing triangle (normal y ≥ 0.35) of the source meshes goes into a 4 u bucket grid; a point
 * takes the topmost triangle over it (height + barycentric vertex colour). A grid vertex averages the colour of
 * 2 × 2 samples over its 4 u footprint (streets, sidewalks and lawns blend instead of aliasing) and takes the
 * height of its centre. Points with nothing above y −0.6 (the sea bed under the hero water) are not ground.
 */

export interface HeroGroundOptions {
  /** region to resample (world xz); triangles whose centroid is outside are ignored (Angel Island, far backdrop) */
  box: { x0: number; z0: number; x1: number; z1: number };
  /** grid step (u), default 4 */
  step?: number;
  /** cell size of the written grid (u), default 64 (the city's cell) */
  cell?: number;
}

const MIN_UP = 0.35;
const IDENTITY = new THREE.Matrix4();
const SEA = -0.6;

/** Topmost-surface sampler over the up-facing triangles of some meshes (world space = geometry space). */
export class TopSampler {
  private tri: Float32Array; // per triangle: 3 × (x, y, z, r, g, b)
  private n = 0;
  private buckets = new Map<number, number[]>();
  private readonly b: number;
  private readonly box: HeroGroundOptions['box'];
  constructor(box: HeroGroundOptions['box'], bucket = 4, capacity = 65536) {
    this.b = bucket;
    this.box = box;
    this.tri = new Float32Array(capacity * 18);
  }

  /** Add the up-facing triangles of a mesh whose centroid is inside the box; yields every `slice` source triangles. */
  *feed(m: THREE.Mesh, slice = 6000): Generator<void, void> {
    const box = this.box, bucket = this.b;
    m.updateWorldMatrix(true, false);
    const g = m.geometry, pos = g.getAttribute('position'), col = g.getAttribute('color'), idx = g.getIndex();
    const P = pos.array, Cl = col?.array, I = idx?.array;
    const plain = m.matrixWorld.equals(IDENTITY) && pos.itemSize === 3 && !(pos as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute;
    const count = (idx?.count ?? pos.count) / 3;
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const ids = [0, 0, 0];
    for (let t = 0; t < count; t++) {
      if (t % slice === slice - 1) yield;
      for (let k = 0; k < 3; k++) {
        const id = I ? I[t * 3 + k] : t * 3 + k;
        ids[k] = id;
        if (plain) v[k].set(P[id * 3], P[id * 3 + 1], P[id * 3 + 2]);
        else v[k].fromBufferAttribute(pos, id).applyMatrix4(m.matrixWorld);
      }
      const cx = (v[0].x + v[1].x + v[2].x) / 3, cz = (v[0].z + v[1].z + v[2].z) / 3;
      if (cx < box.x0 || cx > box.x1 || cz < box.z0 || cz > box.z1) continue;
      const e1x = v[1].x - v[0].x, e1y = v[1].y - v[0].y, e1z = v[1].z - v[0].z;
      const e2x = v[2].x - v[0].x, e2y = v[2].y - v[0].y, e2z = v[2].z - v[0].z;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-9 || Math.abs(ny) / len < MIN_UP) continue;
      if ((this.n + 1) * 18 > this.tri.length) { const tri = new Float32Array(this.tri.length * 2); tri.set(this.tri); this.tri = tri; }
      const o = this.n * 18;
      for (let k = 0; k < 3; k++) {
        const q = o + k * 6, id = ids[k], cs = col ? col.itemSize : 3;
        this.tri[q] = v[k].x; this.tri[q + 1] = v[k].y; this.tri[q + 2] = v[k].z;
        this.tri[q + 3] = Cl ? Cl[id * cs] : 0.5; this.tri[q + 4] = Cl ? Cl[id * cs + 1] : 0.5; this.tri[q + 5] = Cl ? Cl[id * cs + 2] : 0.5;
      }
      const i0 = Math.floor(Math.min(v[0].x, v[1].x, v[2].x) / bucket), i1 = Math.floor(Math.max(v[0].x, v[1].x, v[2].x) / bucket);
      const j0 = Math.floor(Math.min(v[0].z, v[1].z, v[2].z) / bucket), j1 = Math.floor(Math.max(v[0].z, v[1].z, v[2].z) / bucket);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const key = (i + 32768) * 65536 + (j + 32768);
        let list = this.buckets.get(key);
        if (!list) this.buckets.set(key, (list = []));
        list.push(this.n);
      }
      this.n++;
    }
  }

  /** Synchronous: a sampler over all the meshes. */
  static of(meshes: readonly THREE.Mesh[], box: HeroGroundOptions['box'], bucket = 4): TopSampler {
    const s = new TopSampler(box, bucket);
    for (const m of meshes) { const it = s.feed(m, Infinity); while (!it.next().done) { /* drain */ } }
    return s;
  }

  get triangles() { return this.n; }

  /** Topmost surface at (x, z): height and colour into `out`; false when there is none. */
  sample(x: number, z: number, out: { y: number; r: number; g: number; b: number }): boolean {
    const list = this.buckets.get((Math.floor(x / this.b) + 32768) * 65536 + (Math.floor(z / this.b) + 32768));
    if (!list) return false;
    let best = -Infinity;
    const T = this.tri;
    for (const t of list) {
      const o = t * 18;
      const ax = T[o], az = T[o + 2], bx = T[o + 6], bz = T[o + 8], cx = T[o + 12], cz = T[o + 14];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;
      const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
      const w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const y = w0 * T[o + 1] + w1 * T[o + 7] + w2 * T[o + 13];
      if (y <= best) continue;
      best = y;
      out.y = y;
      out.r = w0 * T[o + 3] + w1 * T[o + 9] + w2 * T[o + 15];
      out.g = w0 * T[o + 4] + w1 * T[o + 10] + w2 * T[o + 16];
      out.b = w0 * T[o + 5] + w1 * T[o + 11] + w2 * T[o + 17];
    }
    return best > -Infinity;
  }
}

/**
 * Resample the hero ground meshes into city-pool ground arrays (null when nothing is inside the box), as a job that
 * yields every few thousand source triangles and after every 64 u cell (the stream runs it in ≈ 2 ms frame slices;
 * ≈ 0.3–0.7 s of work in all on SwiftShader-class CPUs, so never in one frame).
 */
export function* heroGroundJob(meshes: readonly THREE.Mesh[], o: HeroGroundOptions): Generator<void, PoolArrays | null> {
  const step = o.step ?? 4, cell = o.cell ?? 64;
  const S = new TopSampler(o.box, step);
  for (const m of meshes) yield* S.feed(m);
  if (!S.triangles) return null;
  const hit = { y: 0, r: 0, g: 0, b: 0 };
  // the last query is asked again right away (sdf, then height of the same grid vertex): remember it
  let lx = NaN, lz = NaN, lok = false;
  const last = { y: 0, r: 0, g: 0, b: 0 };
  const ground = (x: number, z: number) => {
    if (x === lx && z === lz) { Object.assign(hit, last); return lok; }
    lx = x; lz = z;
    lok = S.sample(x, z, hit) && hit.y > SEA;
    Object.assign(last, hit);
    return lok;
  };
  // off the ground (a crossing just outside the outline, a normal probe): the nearest ground height within a step,
  // so the land-side slab cut keeps its height instead of dropping to the sea
  const heightNear = (x: number, z: number) => {
    if (ground(x, z)) return hit.y;
    for (const d of [step / 2, step]) for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (ground(x + i * d, z + j * d)) return hit.y;
    return 0;
  };
  const col = new THREE.Color();
  const b = new CityBatch(16384);
  const x0 = Math.floor(o.box.x0 / cell) * cell, z0 = Math.floor(o.box.z0 / cell) * cell;
  for (let cz = z0; cz < o.box.z1; cz += cell) {
    for (let cx = x0; cx < o.box.x1; cx += cell) {
      buildGround(b, {
        x0: cx, z0: cz, size: cell, step,
        sdf: (x, z) => (ground(x, z) ? 1 : -1),
        height: (x, z) => heightNear(x, z),
        paint: (x, z) => {
          let r = 0, g = 0, bl = 0, n = 0;
          for (let j = -1; j <= 1; j += 2) for (let i = -1; i <= 1; i += 2) {
            if (!ground(x + i * step / 4, z + j * step / 4)) continue;
            r += hit.r; g += hit.g; bl += hit.b; n++;
          }
          if (n) col.setRGB(r / n, g / n, bl / n); else col.setRGB(0.5, 0.5, 0.48);
          return { color: col, pattern: 0 };
        },
        lip: 0.8,
        lipColor: (x, z) => shade(ground(x, z) ? col.setRGB(hit.r, hit.g, hit.b) : col.setRGB(0.55, 0.53, 0.5), 0.7),
        skirt: 0,
      });
      yield;
    }
  }
  return b.toPool();
}

/** The whole job at once (tests, tools). */
export function heroGroundProxy(meshes: readonly THREE.Mesh[], o: HeroGroundOptions): PoolArrays | null {
  const it = heroGroundJob(meshes, o);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
