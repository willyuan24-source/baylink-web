import * as THREE from 'three';
import { type Info, shade } from '../builder';
import { TypedBatch, type TypedBatchArrays } from '../typedBatch';

/**
 * Worker-safe mesh helpers for the streamed city (three core math only, no DOM):
 *
 * - `CityBatch`: TypedBatch with a public triangle writer and `toPool()` — the compact rgb form the BatchedMesh
 *   pools copy with typed-array `set()` (a 3-of-4 interleaved colour would be copied one component at a time).
 * - `buildGround()`: a regular height grid per cell whose outline follows a signed distance field by marching
 *   squares (crisp coasts, lakes and the hero-slab cut at any grid step), a vertical lip along that outline and a
 *   skirt along the cell border (hides cracks against a neighbour drawn at another tier).
 * - `clipPolyline()` / `clipOutside()` / `ribbon()`: streets as flat ribbons following their centreline heights.
 */

/** = materials.ts GROUND_CITY (aInfo.w of streamed city ground; kept local so the worker never loads the materials) */
export const GROUND_CITY = 1;

/** Pool geometry (see pools.ts): like TypedBatchArrays but colour is rgb (3 B / vertex). */
export interface PoolArrays {
  vertexCount: number;
  indexCount: number;
  position: Float32Array;
  normal: Int8Array;
  color: Uint8Array;
  info: Float32Array;
  index: Uint16Array | Uint32Array;
  bounds: Float32Array;
}

export function poolTransferables(a: PoolArrays | null | undefined): ArrayBuffer[] {
  if (!a) return [];
  return [a.position.buffer, a.normal.buffer, a.color.buffer, a.info.buffer, a.index.buffer, a.bounds.buffer] as ArrayBuffer[];
}

export class CityBatch extends TypedBatch {
  /**
   * Keeps ribbon edges out of shapes the city must not draw in (the hero slab, landmark footprints): a street whose
   * centreline stops at the slab edge would otherwise lay half its width over the hero's own ground. Called with each
   * ribbon edge vertex; writes the (possibly moved) point into `out`.
   */
  clampXZ: ((x: number, z: number, out: { x: number; z: number }) => void) | null = null;
  /** Raw triangle (vertex indices as returned by vert()). */
  face(a: number, b: number, c: number) { this.index3(a, b, c); }
  /** Triangle facing +y whatever the order of a, b, c. */
  up(a: number, b: number, c: number) {
    const ax = this.px(a), az = this.pz(a), bx = this.px(b), bz = this.pz(b), cx = this.px(c), cz = this.pz(c);
    const cy = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (cy > 0) this.index3(a, b, c); else this.index3(a, c, b);
  }
  /** null when nothing was written */
  arrays(): TypedBatchArrays | null { return this.vertexCount ? this.toArrays() : null; }
  /** compact rgb copy for the pools (null when empty) */
  toPool(): PoolArrays | null {
    if (!this.vertexCount) return null;
    const a = this.toArrays();
    const n = a.vertexCount, rgb = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) { rgb[i * 3] = a.color[i * 4]; rgb[i * 3 + 1] = a.color[i * 4 + 1]; rgb[i * 3 + 2] = a.color[i * 4 + 2]; }
    return { vertexCount: n, indexCount: a.indexCount, position: a.position, normal: a.normal, color: rgb, info: a.info, index: a.index, bounds: a.bounds };
  }
}

// ---------------------------------------------------------------------------
// ground
// ---------------------------------------------------------------------------

export interface GroundPaint { color: THREE.Color; pattern: number }

export interface GroundSpec {
  /** min corner and edge length of the cell (u) */
  x0: number;
  z0: number;
  size: number;
  /** grid step (u) */
  step: number;
  /** + where there is ground (land outside the hero slab and outside sea / lakes), − elsewhere */
  sdf(x: number, z: number): number;
  height(x: number, z: number): number;
  paint(x: number, z: number, h: number, slope: number): GroundPaint;
  /** depth of the vertical edge along the outline (coasts, lakes, the slab cut) */
  lip: number;
  lipColor(x: number, z: number, h: number): THREE.Color;
  /** depth of the cell-border skirt */
  skirt: number;
  /** extra lift (u) on every vertex (far tiers sit a hair higher than the sea) */
  lift?: number;
}

const _n = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();

/** Vertical quad from the (x0,y0,z0)–(x1,y1,z1) top edge down by `depth`, facing (nx, nz). */
function wall(b: CityBatch, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, depth: number, nx: number, nz: number, top: THREE.Color, info: Info) {
  _n.set(nx, 0, nz).normalize();
  b.quad(_a.set(x0, y0, z0), _b.set(x1, y1, z1), _c.set(x1, y1 - depth, z1), _d.set(x0, y0 - depth, z0), _n, [top, top, shade(top, 0.62), shade(top, 0.62)], info);
}

/** Ground for one cell (see GroundSpec). Returns the number of ground vertices written. */
export function buildGround(b: CityBatch, s: GroundSpec): number {
  const n = Math.round(s.size / s.step), N = n + 1, step = s.step, lift = s.lift ?? 0;
  const S = new Float32Array(N * N), H = new Float32Array(N * N), V = new Int32Array(N * N).fill(-1);
  let any = false;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = s.x0 + i * step, z = s.z0 + j * step, k = j * N + i;
    S[k] = s.sdf(x, z);
    if (S[k] > -step * 1.5) { H[k] = s.height(x, z); any = true; }
  }
  if (!any) return 0;
  const e = Math.min(step * 0.5, 1);
  const vx0 = b.vertexCount;
  const vertexAt = (x: number, z: number, h: number) => {
    const dx = (s.height(x + e, z) - s.height(x - e, z)) / (2 * e), dz = (s.height(x, z + e) - s.height(x, z - e)) / (2 * e);
    _n.set(-dx, 1, -dz).normalize();
    const p = s.paint(x, z, h, Math.hypot(dx, dz));
    return b.vert(x, h + lift, z, _n.x, _n.y, _n.z, p.color, [p.pattern, 0, 0, GROUND_CITY]);
  };
  const grid = (i: number, j: number) => {
    const k = j * N + i;
    if (V[k] < 0) V[k] = vertexAt(s.x0 + i * step, s.z0 + j * step, H[k]);
    return V[k];
  };
  // corners in order around the square: (i,j) (i+1,j) (i+1,j+1) (i,j+1)
  const CI = [0, 1, 1, 0], CJ = [0, 0, 1, 1];
  const lipInfo: Info = [0, 0, 0, GROUND_CITY];
  type P = { v: number; x: number; z: number; h: number; cross: boolean };
  const piece: P[] = [];
  const emit = (pts: P[]) => {
    for (let k = 1; k + 1 < pts.length; k++) b.up(pts[0].v, pts[k].v, pts[k + 1].v);
    // contour segments (consecutive crossings) get a vertical lip facing away from the piece
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p.x; cz += p.z; }
    cx /= pts.length; cz /= pts.length;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[(k + 1) % pts.length];
      if (!p.cross || !q.cross || s.lip <= 0) continue;
      let nx = -(q.z - p.z), nz = q.x - p.x;
      if (nx * ((p.x + q.x) / 2 - cx) + nz * ((p.z + q.z) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
      wall(b, p.x, p.h + lift, p.z, q.x, q.h + lift, q.z, s.lip, nx, nz, s.lipColor((p.x + q.x) / 2, (p.z + q.z) / 2, p.h), lipInfo);
    }
  };
  const crossing = (i0: number, j0: number, i1: number, j1: number): P => {
    const s0 = S[j0 * N + i0], s1 = S[j1 * N + i1];
    const t = Math.min(1, Math.max(0, s0 / (s0 - s1)));
    const x = s.x0 + (i0 + (i1 - i0) * t) * step, z = s.z0 + (j0 + (j1 - j0) * t) * step;
    const h = s.height(x, z);
    return { v: vertexAt(x, z, h), x, z, h, cross: true };
  };
  const cornerP = (i: number, j: number): P => ({ v: grid(i, j), x: s.x0 + i * step, z: s.z0 + j * step, h: H[j * N + i], cross: false });
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const s0 = S[j * N + i], s1 = S[j * N + i + 1], s2 = S[(j + 1) * N + i + 1], s3 = S[(j + 1) * N + i];
    const m = (s0 > 0 ? 1 : 0) | (s1 > 0 ? 2 : 0) | (s2 > 0 ? 4 : 0) | (s3 > 0 ? 8 : 0);
    if (m === 0) continue;
    if (m === 15) {
      const a = grid(i, j), bb = grid(i + 1, j), c = grid(i + 1, j + 1), d = grid(i, j + 1);
      b.up(a, bb, c);
      b.up(a, c, d);
      continue;
    }
    const sv = [s0, s1, s2, s3];
    const saddle = m === 5 || m === 10;
    if (saddle && (s0 + s1 + s2 + s3) / 4 <= 0) {
      // two separate corner triangles
      for (let k = 0; k < 4; k++) {
        if (sv[k] <= 0) continue;
        const kp = (k + 3) % 4, kn = (k + 1) % 4;
        emit([
          crossing(i + CI[kp], j + CJ[kp], i + CI[k], j + CJ[k]),
          cornerP(i + CI[k], j + CJ[k]),
          crossing(i + CI[k], j + CJ[k], i + CI[kn], j + CJ[kn]),
        ]);
      }
      continue;
    }
    piece.length = 0;
    for (let k = 0; k < 4; k++) {
      const kn = (k + 1) % 4;
      if (sv[k] > 0) piece.push(cornerP(i + CI[k], j + CJ[k]));
      if ((sv[k] > 0) !== (sv[kn] > 0)) piece.push(crossing(i + CI[k], j + CJ[k], i + CI[kn], j + CJ[kn]));
    }
    // start the fan on a corner so crossing pairs stay adjacent in order
    emit(piece.slice());
  }
  // cell-border skirt (outward), on the ground part of each border segment
  if (s.skirt > 0) {
    const sides: [number, number, number, number, number, number][] = [
      // i0, j0, di, dj, nx, nz
      [0, 0, 1, 0, 0, -1], [n, 0, 0, 1, 1, 0], [n, n, -1, 0, 0, 1], [0, n, 0, -1, -1, 0],
    ];
    for (const [i0, j0, di, dj, nx, nz] of sides) {
      for (let k = 0; k < n; k++) {
        const ia = i0 + di * k, ja = j0 + dj * k, ib = ia + di, jb = ja + dj;
        const sa = S[ja * N + ia], sb = S[jb * N + ib];
        if (sa <= 0 && sb <= 0) continue;
        const A = sa > 0 ? cornerP(ia, ja) : crossing(ib, jb, ia, ja);
        const B = sb > 0 ? cornerP(ib, jb) : crossing(ia, ja, ib, jb);
        const col = s.paint(A.x, A.z, A.h, 0).color;
        wall(b, A.x, A.h + lift, A.z, B.x, B.h + lift, B.z, s.skirt, nx, nz, shade(col, 0.9), lipInfo);
      }
    }
  }
  return b.vertexCount - vx0;
}

// ---------------------------------------------------------------------------
// polylines
// ---------------------------------------------------------------------------

const _cl = { x: 0, z: 0 };

/** A polyline as flat x, y, z triples. */
export type Line3 = number[];

/** Clip an x, y, z polyline to the square [x0, x1] × [z0, z1] (Liang–Barsky per segment); returns the pieces. */
export function clipPolyline(p: ArrayLike<number>, i0: number, i1: number, x0: number, z0: number, x1: number, z1: number): Line3[] {
  const out: Line3[] = [];
  let cur: Line3 | null = null;
  for (let k = i0; k + 1 < i1; k++) {
    const ax = p[k * 3], ay = p[k * 3 + 1], az = p[k * 3 + 2], bx = p[k * 3 + 3], by = p[k * 3 + 4], bz = p[k * 3 + 5];
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    const clip = (pp: number, q: number) => {
      if (pp === 0) return q >= 0;
      const r = q / pp;
      if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (!(clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az)) || t1 - t0 < 1e-6) { cur = null; continue; }
    const px0 = ax + dx * t0, py0 = ay + (by - ay) * t0, pz0 = az + dz * t0;
    const px1 = ax + dx * t1, py1 = ay + (by - ay) * t1, pz1 = az + dz * t1;
    if (!cur || t0 > 0) { cur = [px0, py0, pz0]; out.push(cur); }
    cur.push(px1, py1, pz1);
    if (t1 < 1) cur = null;
  }
  return out.filter(l => l.length >= 6);
}

/** Keep the parts of a polyline outside a polygon (splits at the polygon's edges). */
export function clipOutside(line: Line3, poly: readonly { x: number; z: number }[], inside: (x: number, z: number) => boolean): Line3[] {
  const out: Line3[] = [];
  let cur: Line3 | null = null;
  const n = poly.length;
  for (let k = 0; k + 3 < line.length; k += 3) {
    const ax = line[k], ay = line[k + 1], az = line[k + 2], bx = line[k + 3], by = line[k + 4], bz = line[k + 5];
    // split parameters where the segment crosses the polygon
    const ts = [0, 1];
    for (let e = 0; e < n; e++) {
      const p = poly[e], q = poly[(e + 1) % n];
      const ex = q.x - p.x, ez = q.z - p.z, dx = bx - ax, dz = bz - az;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((p.x - ax) * ez - (p.z - az) * ex) / den, u = ((p.x - ax) * dz - (p.z - az) * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    for (let s = 0; s + 1 < ts.length; s++) {
      const t0 = ts[s], t1 = ts[s + 1];
      if (t1 - t0 < 1e-6) continue;
      const tm = (t0 + t1) / 2;
      if (inside(ax + (bx - ax) * tm, az + (bz - az) * tm)) { cur = null; continue; }
      const P0 = [ax + (bx - ax) * t0, ay + (by - ay) * t0, az + (bz - az) * t0], P1 = [ax + (bx - ax) * t1, ay + (by - ay) * t1, az + (bz - az) * t1];
      if (!cur || t0 > 0) { cur = [...P0]; out.push(cur); }
      cur.push(...P1);
      if (t1 < 1) cur = null;
    }
  }
  return out.filter(l => l.length >= 6);
}

/** Total length of an x, y, z polyline (xz). */
export function lineLength(l: Line3) {
  let L = 0;
  for (let k = 3; k < l.length; k += 3) L += Math.hypot(l[k] - l[k - 3], l[k + 2] - l[k - 1]);
  return L;
}

/**
 * Flat ribbon along an x, y, z polyline (y + lift at every point, level across), facing up. `offset` shifts it
 * sideways (rails, lane lines); `info` may be a function of (arc length, side) for the running-bond pavers.
 * The ends are cut square to the line, so two cells meeting at a clip point join seamlessly.
 */
export function ribbon(b: CityBatch, l: Line3, width: number, lift: number, color: THREE.Color, info: Info | ((s: number, side: number) => Info), offset = 0, yAt?: (x: number, z: number, y: number) => number) {
  const m = l.length / 3;
  if (m < 2) return;
  const base = b.vertexCount;
  let s = 0;
  for (let i = 0; i < m; i++) {
    const ia = Math.max(0, i - 1), ib = Math.min(m - 1, i + 1);
    let tx = l[ib * 3] - l[ia * 3], tz = l[ib * 3 + 2] - l[ia * 3 + 2];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    // miter: scale by 1 / cos of the half turn (limited)
    let k = 1;
    if (i > 0 && i < m - 1) {
      const sx = l[i * 3 + 3] - l[i * 3], sz = l[i * 3 + 5] - l[i * 3 + 2], sl = Math.hypot(sx, sz) || 1;
      k = 1 / Math.max(0.6, (tx * sx + tz * sz) / sl);
    }
    if (i > 0) s += Math.hypot(l[i * 3] - l[i * 3 - 3], l[i * 3 + 2] - l[i * 3 - 1]);
    const nx = -tz, nz = tx;
    for (const side of [-1, 1]) {
      const o = offset + (side * width) / 2;
      let x = l[i * 3] + nx * o * k, z = l[i * 3 + 2] + nz * o * k;
      if (b.clampXZ) { b.clampXZ(x, z, _cl); x = _cl.x; z = _cl.z; }
      const y = (yAt ? yAt(x, z, l[i * 3 + 1]) : l[i * 3 + 1]) + lift;
      b.vert(x, y, z, 0, 1, 0, color, typeof info === 'function' ? info(s, o) : info);
    }
  }
  for (let i = 0; i < m - 1; i++) {
    const a = base + i * 2;
    b.up(a, a + 1, a + 3);
    b.up(a, a + 3, a + 2);
  }
}

/** Dashes along a polyline (centre lines): `on` u painted every `period` u (phase continuous along the line). */
export function dashes(b: CityBatch, l: Line3, width: number, lift: number, color: THREE.Color, on: number, period: number, info: Info) {
  let acc = 0;
  for (let k = 0; k + 3 < l.length; k += 3) {
    const ax = l[k], ay = l[k + 1], az = l[k + 2], bx = l[k + 3], by = l[k + 4], bz = l[k + 5];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-4) continue;
    for (let n = Math.floor(acc / period); n * period < acc + L; n++) {
      const t0 = Math.max(0, n * period - acc), t1 = Math.min(L, n * period + on - acc);
      if (t1 - t0 < 0.2) continue;
      const f0 = t0 / L, f1 = t1 / L;
      ribbon(b, [ax + (bx - ax) * f0, ay + (by - ay) * f0, az + (bz - az) * f0, ax + (bx - ax) * f1, ay + (by - ay) * f1, az + (bz - az) * f1], width, lift, color, info);
    }
    acc += L;
  }
}
