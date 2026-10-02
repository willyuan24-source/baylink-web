/**
 * (W9-P6, lane P) A ferry route's line: moved verbatim from data/ferry.ts (GameRoot's first-load chunk) — only
 * world/ferry.ts (the lazy transit layer) and the tests build one. data/ferry.ts keeps the route table, the boat
 * constants and `ferryTerminal` (game/transit.ts reads them in GameRoot) and re-exports these types only.
 */
import type { Bilingual, Vec2 } from '../core/types';
import { FERRY, type FerryRouteDef, type FerryTerminal } from './ferry';

export interface FerryStop { terminal: string; u: number }
export interface FerryLine {
  id: string;
  name: Bilingual;
  /** the loop: x, z pairs; cum has n + 1 entries (the last closes back to vertex 0) */
  xz: Float32Array;
  cum: Float32Array;
  length: number;
  /** speed limit per vertex */
  vlim: Float32Array;
  stops: FerryStop[];
  terminals: FerryTerminal[];
}

/** Closed Catmull-Rom through the control points, `per` samples a segment. */
function catmullLoop(src: Vec2[], per = 10): Vec2[] {
  const n = src.length, out: Vec2[] = [];
  const get = (i: number) => src[(i + n) % n];
  for (let i = 0; i < n; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  return out;
}

/** Point on a ferry loop at u (wraps): position and heading of travel. */
export function ferryPoint(line: Pick<FerryLine, 'xz' | 'cum' | 'length'>, u: number): { x: number; z: number; heading: number; i: number } {
  const L = line.length, uu = ((u % L) + L) % L, cum = line.cum, n = line.xz.length / 2;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= uu) lo = mid; else hi = mid; }
  const j = (lo + 1) % n, t = (uu - cum[lo]) / (cum[lo + 1] - cum[lo] || 1), a = line.xz;
  return { x: a[lo * 2] + (a[j * 2] - a[lo * 2]) * t, z: a[lo * 2 + 1] + (a[j * 2 + 1] - a[lo * 2 + 1]) * t, heading: Math.atan2(a[j * 2] - a[lo * 2], a[j * 2 + 1] - a[lo * 2 + 1]), i: lo };
}

/** Build a route's smoothed loop, its speed limits (curves, slow ahead near berths) and the terminal stops on it. */
export function buildFerryLine(def: FerryRouteDef): FerryLine {
  const pts = catmullLoop(def.loop);
  const n = pts.length;
  const xz = new Float32Array(n * 2), cum = new Float32Array(n + 1);
  pts.forEach((p, i) => {
    xz[i * 2] = p.x; xz[i * 2 + 1] = p.z;
    const q = pts[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(q.x - p.x, q.z - p.z);
  });
  const length = cum[n];
  const line = { xz, cum, length };
  const stops: FerryStop[] = def.terminals.map(t => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.hypot(pts[i].x - t.berth.x, pts[i].z - t.berth.z); if (d < bd) { bd = d; best = i; } }
    return { terminal: t.id, u: cum[best] };
  });
  const vlim = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = ferryPoint(line, cum[i] - FERRY.length / 2), b = ferryPoint(line, cum[i] + FERRY.length / 2), p = ferryPoint(line, cum[i]);
    let dh = Math.atan2(b.x - p.x, b.z - p.z) - Math.atan2(p.x - a.x, p.z - a.z);
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    const k = Math.abs(dh) / FERRY.length;
    let v = k > 1e-4 ? Math.max(FERRY.vCurveMin, Math.min(FERRY.speed, Math.sqrt(FERRY.aLat / k))) : FERRY.speed;
    for (const st of stops) {
      const d = Math.min(Math.abs(cum[i] - st.u), length - Math.abs(cum[i] - st.u));
      if (d < FERRY.berthZone) v = Math.min(v, FERRY.berthSpeed + (FERRY.speed - FERRY.berthSpeed) * (d / FERRY.berthZone) ** 2);
    }
    vlim[i] = v;
  }
  stops.sort((a, b) => a.u - b.u);
  return { id: def.id, name: def.name, xz, cum, length, vlim, stops, terminals: def.terminals };
}
