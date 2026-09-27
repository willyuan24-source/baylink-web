// Plain 2D geometry for the offline SF build (flat number arrays: [x0, z0, x1, z1, …]).
// Polygons are open rings (last point ≠ first). "CCW" follows district.ts: signed area of (x, −z) > 0,
// i.e. area2() below is NEGATIVE for CCW-from-above rings.

export type Ring = number[];

export function area2(r: Ring): number {
  let s = 0;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) s += r[j * 2] * r[i * 2 + 1] - r[i * 2] * r[j * 2 + 1];
  return s;
}
export const ringArea = (r: Ring) => Math.abs(area2(r)) / 2;
/** CCW from above (district.ts convention, THREE.Shape friendly with (x, −z)) */
export const ccw = (r: Ring): Ring => (area2(r) > 0 ? reverseRing(r) : r);
export const cw = (r: Ring): Ring => (area2(r) < 0 ? reverseRing(r) : r);
export function reverseRing(r: Ring): Ring {
  const out: number[] = [];
  for (let i = r.length / 2 - 1; i >= 0; i--) out.push(r[i * 2], r[i * 2 + 1]);
  return out;
}

export function centroid(r: Ring): [number, number] {
  const n = r.length / 2;
  const ox = r[0], oz = r[1];
  let a = 0, cx = 0, cz = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xj = r[j * 2] - ox, zj = r[j * 2 + 1] - oz, xi = r[i * 2] - ox, zi = r[i * 2 + 1] - oz;
    const f = xj * zi - xi * zj;
    a += f; cx += (xj + xi) * f; cz += (zj + zi) * f;
  }
  if (Math.abs(a) < 1e-12) {
    let sx = 0, sz = 0;
    for (let i = 0; i < n; i++) { sx += r[i * 2]; sz += r[i * 2 + 1]; }
    return [sx / n, sz / n];
  }
  return [ox + cx / (3 * a), oz + cz / (3 * a)];
}

export function bbox(r: number[], stride = 2): [number, number, number, number] {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < r.length; i += stride) {
    const x = r[i], z = r[i + (stride === 3 ? 2 : 1)];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return [x0, z0, x1, z1];
}

export function pointInRing(x: number, z: number, r: Ring): boolean {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = r[i * 2], az = r[i * 2 + 1], bx = r[j * 2], bz = r[j * 2 + 1];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  let t = L2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - ax - dx * t, ez = pz - az - dz * t;
  return ex * ex + ez * ez;
}

export function distToRingEdge(x: number, z: number, r: Ring): number {
  let d = Infinity;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) d = Math.min(d, segDist2(x, z, r[j * 2], r[j * 2 + 1], r[i * 2], r[i * 2 + 1]));
  return Math.sqrt(d);
}
export const distToRing = (x: number, z: number, r: Ring) => (pointInRing(x, z, r) ? 0 : distToRingEdge(x, z, r));

/** Clip a ring to the half-plane (p − o)·n ≤ 0. */
export function clipHalf(r: Ring, ox: number, oz: number, nx: number, nz: number): Ring {
  const out: number[] = [];
  const n = r.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = r[i * 2], az = r[i * 2 + 1], bx = r[j * 2], bz = r[j * 2 + 1];
    const sa = (ax - ox) * nx + (az - oz) * nz, sb = (bx - ox) * nx + (bz - oz) * nz;
    if (sa <= 0) out.push(ax, az);
    if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push(ax + (bx - ax) * t, az + (bz - az) * t); }
  }
  return out;
}

/** Clip a ring to an axis-aligned rectangle (Sutherland–Hodgman). */
export function clipRect(r: Ring, x0: number, z0: number, x1: number, z1: number): Ring {
  let o = clipHalf(r, x0, 0, -1, 0);
  if (o.length) o = clipHalf(o, x1, 0, 1, 0);
  if (o.length) o = clipHalf(o, 0, z0, 0, -1);
  if (o.length) o = clipHalf(o, 0, z1, 0, 1);
  return o;
}

/** Douglas–Peucker on an open polyline of 2D points. */
function dpMark(p: number[], i0: number, i1: number, tol2: number, keep: Uint8Array, stride: number) {
  const stack: [number, number][] = [[i0, i1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, bestD = tol2;
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(p[i * stride], p[i * stride + stride - 1], p[a * stride], p[a * stride + stride - 1], p[b * stride], p[b * stride + stride - 1]);
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
}

/** Simplify an open polyline (x, z pairs). */
export function simplifyLine(p: number[], tol: number): number[] {
  const n = p.length / 2;
  if (n <= 2) return p.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  dpMark(p, 0, n - 1, tol * tol, keep, 2);
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

/** Simplify a closed ring: split at the two mutually farthest-ish vertices so the result stays closed. */
export function simplifyRing(r: Ring, tol: number): Ring {
  const n = r.length / 2;
  if (n <= 4) return r.slice();
  // anchor 0 and the vertex farthest from it
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) { const d = (r[i * 2] - r[0]) ** 2 + (r[i * 2 + 1] - r[1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const keep = new Uint8Array(n + 1);
  const closed = [...r, r[0], r[1]];
  keep[0] = keep[far] = keep[n] = 1;
  dpMark(closed, 0, far, tol * tol, keep, 2);
  dpMark(closed, far, n, tol * tol, keep, 2);
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(r[i * 2], r[i * 2 + 1]);
  return out;
}

/** Remove near-duplicate and collinear vertices of a ring. */
export function cleanRing(r: Ring, eps = 1e-3): Ring {
  let out = r.slice();
  for (let pass = 0; pass < 3; pass++) {
    const n = out.length / 2;
    if (n < 3) return out;
    const next: number[] = [];
    for (let i = 0; i < n; i++) {
      const px = out[((i + n - 1) % n) * 2], pz = out[((i + n - 1) % n) * 2 + 1];
      const x = out[i * 2], z = out[i * 2 + 1];
      const nx = out[((i + 1) % n) * 2], nz = out[((i + 1) % n) * 2 + 1];
      if (Math.hypot(x - px, z - pz) < eps) continue;
      const cross = (x - px) * (nz - z) - (z - pz) * (nx - x);
      if (Math.abs(cross) < eps * Math.hypot(nx - px, nz - pz) * 0.5) continue;
      next.push(x, z);
    }
    if (next.length === out.length) return next;
    out = next;
  }
  return out;
}

/** Convex hull (monotone chain) of x, z pairs, returned CCW-from-above. */
export function convexHull(pts: number[]): Ring {
  const n = pts.length / 2;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
  const cross = (o: number, a: number, b: number) => (pts[a * 2] - pts[o * 2]) * (pts[b * 2 + 1] - pts[o * 2 + 1]) - (pts[a * 2 + 1] - pts[o * 2 + 1]) * (pts[b * 2] - pts[o * 2]);
  const lower: number[] = [], upper: number[] = [];
  for (const i of idx) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop(); lower.push(i); }
  for (let k = idx.length - 1; k >= 0; k--) { const i = idx[k]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop(); upper.push(i); }
  const h = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const out: number[] = [];
  for (const i of h) out.push(pts[i * 2], pts[i * 2 + 1]);
  return ccw(out);
}

/** Minimum-area oriented rectangle of a point set (rotating calipers over hull edges). */
export function minRect(pts: number[]): Ring {
  const h = convexHull(pts);
  const n = h.length / 2;
  let best: Ring | null = null, bestA = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let ux = h[j * 2] - h[i * 2], uz = h[j * 2 + 1] - h[i * 2 + 1];
    const L = Math.hypot(ux, uz);
    if (L < 1e-9) continue;
    ux /= L; uz /= L;
    const vx = -uz, vz = ux;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const a = h[k * 2] * ux + h[k * 2 + 1] * uz, b = h[k * 2] * vx + h[k * 2 + 1] * vz;
      if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b;
    }
    const A = (a1 - a0) * (b1 - b0);
    if (A < bestA) {
      bestA = A;
      best = [a0 * ux + b0 * vx, a0 * uz + b0 * vz, a1 * ux + b0 * vx, a1 * uz + b0 * vz, a1 * ux + b1 * vx, a1 * uz + b1 * vz, a0 * ux + b1 * vx, a0 * uz + b1 * vz];
    }
  }
  return ccw(best ?? h);
}

/** Simplify a ring to at most maxV vertices: DP with growing tolerance, then the min-area rectangle. */
export function simplifyToMax(r: Ring, maxV: number, tol0: number, tolMax: number): Ring {
  let out = cleanRing(r);
  let tol = tol0;
  while (out.length / 2 > maxV && tol <= tolMax) { out = cleanRing(simplifyRing(r, tol)); tol *= 1.6; }
  if (out.length / 2 > maxV || out.length / 2 < 3 || ringArea(out) < ringArea(r) * 0.6) {
    const rect = minRect(r);
    if (out.length / 2 > maxV || out.length / 2 < 3) return rect;
  }
  return out;
}

export function polylineLength(p: number[], stride = 2): number {
  let L = 0;
  for (let i = stride; i < p.length; i += stride) L += Math.hypot(p[i] - p[i - stride], p[i + stride - 1] - p[i - 1]);
  return L;
}

/** Clip a polyline (x, y, z triples) to a rectangle; returns runs (each ≥ 2 points), y interpolated. */
export function clipPolyline3(p: number[], x0: number, z0: number, x1: number, z1: number): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  const n = p.length / 3;
  const inside = (x: number, z: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  for (let i = 0; i + 1 < n; i++) {
    const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2], bx = p[i * 3 + 3], by = p[i * 3 + 4], bz = p[i * 3 + 5];
    // Liang–Barsky
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    const tests: [number, number][] = [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]];
    let ok = true;
    for (const [pp, q] of tests) {
      if (pp === 0) { if (q < 0) { ok = false; break; } continue; }
      const t = q / pp;
      if (pp < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; } else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
    }
    if (!ok) { if (run.length >= 6) runs.push(run); run = []; continue; }
    const sx = ax + dx * t0, sy = ay + (by - ay) * t0, sz = az + dz * t0;
    const ex = ax + dx * t1, ey = ay + (by - ay) * t1, ez = az + dz * t1;
    if (!run.length) run.push(sx, sy, sz);
    else if (t0 > 0) { if (run.length >= 6) runs.push(run); run = [sx, sy, sz]; }
    run.push(ex, ey, ez);
    if (t1 < 1 || !inside(bx, bz)) { if (run.length >= 6) runs.push(run); run = []; }
  }
  if (run.length >= 6) runs.push(run);
  return runs;
}

/** Resample a polyline (x, z pairs) so no segment is longer than maxSeg; returns x, z pairs. */
export function densify(p: number[], maxSeg: number): number[] {
  const out: number[] = [p[0], p[1]];
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], az = p[i - 1], bx = p[i], bz = p[i + 1];
    const L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / maxSeg));
    for (let s = 1; s <= k; s++) out.push(ax + ((bx - ax) * s) / k, az + ((bz - az) * s) / k);
  }
  return out;
}

/** Hash grid of items by bbox, cell size c. */
export class SpatialHash {
  private map = new Map<number, number[]>();
  private c: number;
  constructor(cell: number) { this.c = cell; }
  private key(i: number, j: number) { return (i + 32768) * 65536 + (j + 32768); }
  insert(id: number, x0: number, z0: number, x1: number, z1: number) {
    const c = this.c;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
      const k = this.key(i, j);
      const a = this.map.get(k);
      if (a) a.push(id); else this.map.set(k, [id]);
    }
  }
  query(x0: number, z0: number, x1: number, z1: number, out: Set<number> = new Set()): Set<number> {
    const c = this.c;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
      const a = this.map.get(this.key(i, j));
      if (a) for (const id of a) out.add(id);
    }
    return out;
  }
}

export const smoothstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Deterministic hash → [0, 1). */
export function hash01(a: number, b = 0): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
