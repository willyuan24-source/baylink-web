// Wave 4 · lane T: small polyline helpers shared by the Metro extraction (metro.ts) and the loop bake (busLoop.ts).
// Pure (no I/O). Paths are city-frame [x, z] points; `cum` is the cumulative arc length in u.
import { type Terrain, heightAt } from './terrain';

export type P2 = [number, number];

export function cumulative(pts: P2[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}

/** Nearest arc position on the polyline to (x, z) and the distance. */
export function projectOnto(pts: P2[], cum: number[], x: number, z: number): { at: number; d: number; seg: number } {
  let best = { at: 0, d: Infinity, seg: 1 };
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best.d) best = { at: cum[i - 1] + t * Math.sqrt(L2), d, seg: i };
  }
  return best;
}

/** Point at arc s (clamped) with the index of the segment it falls on. */
export function pointAtArc(pts: P2[], cum: number[], s: number): { p: P2; seg: number } {
  const L = cum[cum.length - 1];
  const ss = Math.max(0, Math.min(L, s));
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= ss) lo = m; else hi = m; }
  const seg = cum[hi] - cum[lo] || 1, t = (ss - cum[lo]) / seg;
  return { p: [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t], seg: hi };
}

/** Street-surface heights: the terrain smoothed along the path over ±`half` u (the transit.ts rule, ±3 u). */
export function surfaceHeights(t: Terrain, pts: P2[], cum: number[], half = 3): number[] {
  const ground = pts.map(([x, z]) => heightAt(t, x, z));
  return ground.map((_, i) => {
    let s = 0, n = 0;
    for (let k = i; k >= 0 && cum[i] - cum[k] <= half; k--) { s += ground[k]; n++; }
    for (let k = i + 1; k < pts.length && cum[k] - cum[i] <= half; k++) { s += ground[k]; n++; }
    return s / n;
  });
}

/** Moving average of `v` over ±`half` u of arc (keeps the ends). */
export function smoothAlong(v: number[], cum: number[], half: number): number[] {
  return v.map((_, i) => {
    let s = 0, n = 0;
    for (let k = i; k >= 0 && cum[i] - cum[k] <= half; k--) { s += v[k]; n++; }
    for (let k = i + 1; k < v.length && cum[k] - cum[i] <= half; k++) { s += v[k]; n++; }
    return s / n;
  });
}

/**
 * Douglas–Peucker: drop vertices within `tol` u of the chord in xz (and, with `ys`, within `tolY` u of the chord's
 * height), always keeping the indices in `keep` (stop anchors, span ends). Returns the kept indices.
 */
export function simplifyIdx(pts: P2[], tol: number, keep: Set<number> = new Set(), ys?: number[], tolY = 0.04): number[] {
  const n = pts.length;
  const mark = new Uint8Array(n);
  mark[0] = 1; mark[n - 1] = 1;
  for (const k of keep) if (k >= 0 && k < n) mark[k] = 1;
  const stack: [number, number][] = [];
  // split at the forced vertices first
  const forced = [...Array(n).keys()].filter(i => mark[i]);
  for (let i = 1; i < forced.length; i++) stack.push([forced[i - 1], forced[i]]);
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const [ax, az] = pts[a], [bx, bz] = pts[b];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-9;
    let far = -1, fd = 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L / tol;
      let dy = 0;
      if (ys) {
        const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - az) * dz) / (L * L)));
        dy = Math.abs(ys[i] - (ys[a] + (ys[b] - ys[a]) * t)) / tolY;
      }
      const e = Math.max(d, dy);
      if (e > fd) { fd = e; far = i; }
    }
    if (far >= 0) { mark[far] = 1; stack.push([a, far], [far, b]); }
  }
  return [...Array(n).keys()].filter(i => mark[i]);
}

/** Resample a polyline so no segment is longer than `step` (straight subdivision). */
export function densify(pts: P2[], step: number): P2[] {
  const out: P2[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / step));
    for (let j = 1; j <= k; j++) out.push([ax + ((bx - ax) * j) / k, az + ((bz - az) * j) / k]);
  }
  return out;
}

/** Chaikin corner cutting (keeps both ends), `iterations` passes; used to round the hand-made hero splices. */
export function chaikin(pts: P2[], iterations = 2): P2[] {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const out: P2[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1];
      out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

export const round = (v: number, q = 100) => Math.round(v * q) / q;
