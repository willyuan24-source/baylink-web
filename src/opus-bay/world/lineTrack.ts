import type { Bilingual } from '../core/types';
import type { TransitLine, TransitTunnel } from './sf/format';

/**
 * Wave 4 · lane T: the track of a bus / light-rail line for the simulations (world/busSystem.ts, world/lightRail.ts).
 * Pure: no three.js, no DOM (node tests drive it exactly as the world does). Built from a transit.json line
 * (`TransitLine`, plus the loop's optional `speeds` spans):
 *
 *   buildLineTrack(line, opts) → LineTrack: arc-length tables (loops wrap), stops, tunnel spans, a speed-limit profile
 *     sampled every 1 u (cruise per span, the curve limit √(a_lat · R), the underground speed, accel / decel smoothed)
 *     and the time table T(s) of an unhindered run (ride-time estimates, dispatch, the trip planner);
 *   trackPoint(track, s)  position / heading / grade at arc s;  arcAhead(track, a, b)  forward distance a → b;
 *   runSeconds(track, a, b, dir)  seconds from a to b at the profile, stops not included;
 *   proximitySpans(a, b, d)  where two tracks come within d u (crossings and shared running → interlock boxes).
 */

export interface TrackPoint { x: number; y: number; z: number; heading: number; grade: number }

export interface TrackStop {
  id: string;
  name: Bilingual;
  at: number;
  x: number;
  z: number;
  /** vehicles always stop here (every loop stop; LRV majors); else only on request */
  major: boolean;
  /** inside a tunnel span (boarded at its kiosk; the train stops 3 s under the overlay) */
  underground: boolean;
  attractions: string[];
}

export interface LineTrack {
  id: string;
  kind: 'bus' | 'light-rail';
  name: Bilingual;
  short: string;
  color: string;
  loop: boolean;
  doubleEnded: boolean;
  /** centreline world [x, y, z] triples */
  xyz: Float32Array;
  cum: Float32Array;
  length: number;
  stops: TrackStop[];
  tunnels: TransitTunnel[];
  /** speed limit (u/s) at s = i · PROFILE_STEP (the last sample at `length`) */
  limit: Float32Array;
  /** seconds of an unhindered run from arc 0 to i · PROFILE_STEP at the profile (monotone) */
  time: Float32Array;
}

export const PROFILE_STEP = 1;

export interface TrackOptions {
  /** cruise (u/s) where the line gives no speed span (LRV surface 10; the bus uses its spans) */
  cruise: number;
  /** cruise underground (virtual subway ride, plan §3.3: 25 u/s), near a mouth the surface cruise */
  tunnelCruise?: number;
  /** lateral acceleration for the curve limit (u/s²) */
  aLat: number;
  accel: number;
  decel: number;
  /** slowest the curve limit goes (u/s) */
  minCurve?: number;
  /** accel / decel deep inside a tunnel (the virtual subway, away from the mouths) */
  tunnelAccel?: number;
}

type LineIn = Pick<TransitLine, 'id' | 'kind' | 'name' | 'short' | 'color' | 'loop' | 'doubleEnded' | 'path' | 'stops' | 'tunnels'> & { speeds?: [number, number, number][] };

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function buildLineTrack(line: LineIn, opts: TrackOptions): LineTrack {
  if (line.kind !== 'bus' && line.kind !== 'light-rail') throw new Error(`${line.id}: not a bus / light-rail line`);
  const n = Math.floor(line.path.length / 3);
  const xyz = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) xyz[i] = line.path[i];
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(xyz[i * 3] - xyz[i * 3 - 3], xyz[i * 3 + 2] - xyz[i * 3 - 1]);
  const length = cum[n - 1];
  const tunnels = (line.tunnels ?? []).map(t => ({ ...t, stations: [...t.stations] }));
  const inTunnel = (s: number) => tunnels.some(t => s > t.fromAt && s < t.toAt);
  const stops: TrackStop[] = line.stops.map(s => ({
    id: s.id, name: s.name, at: s.at, x: s.x, z: s.z, major: line.kind === 'bus' ? true : !!s.major,
    underground: tunnels.some(t => t.stations.includes(s.id)) || inTunnel(s.at), attractions: [...(s.attractions ?? [])],
  }));
  const track: LineTrack = {
    id: line.id, kind: line.kind, name: line.name, short: line.short ?? line.id, color: line.color, loop: !!line.loop,
    doubleEnded: line.doubleEnded, xyz, cum, length, stops, tunnels, limit: new Float32Array(0), time: new Float32Array(0),
  };
  // --- the speed-limit profile
  const m = Math.ceil(length / PROFILE_STEP) + 1;
  const limit = new Float32Array(m);
  const p = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
  const hdg = new Float32Array(m);
  for (let i = 0; i < m; i++) hdg[i] = trackPoint(track, Math.min(length, i * PROFILE_STEP), p).heading;
  const spans = line.speeds ?? [];
  const cruiseAt = (s: number) => {
    for (const [a, b, v] of spans) if (s >= a && s <= b) return v;
    return opts.cruise;
  };
  // heading change over ±6 u (a shorter window reads the polyline's small kinks as curves)
  const W = 6;
  const deep = new Uint8Array(m);
  for (let i = 0; i < m; i++) {
    const s = Math.min(length, i * PROFILE_STEP);
    let v = cruiseAt(s);
    const t = tunnels.find(u => s > u.fromAt && s < u.toAt);
    if (t && opts.tunnelCruise) {
      // near a mouth the train is still visible: surface cruise within 25 u of it
      const nearMouth = (t.portalA && s - t.fromAt < 25) || (t.portalB && t.toAt - s < 25);
      if (!nearMouth) { v = opts.tunnelCruise; deep[i] = 1; }
    }
    // curve limit from the heading change over ±W u
    const a = hdg[Math.max(0, i - W)], b = hdg[Math.min(m - 1, i + W)];
    const span = (Math.min(m - 1, i + W) - Math.max(0, i - W)) * PROFILE_STEP;
    const k = span > 0 ? Math.abs(wrapAngle(b - a)) / span : 0;
    if (k > 1e-4) v = Math.min(v, Math.max(opts.minCurve ?? 2.5, Math.sqrt(opts.aLat / k)));
    limit[i] = v;
  }
  // accel / decel smoothing (loops wrap: two passes each way settle it)
  const passes = track.loop ? 2 : 1;
  const dec = (i: number) => (deep[i] && opts.tunnelAccel ? opts.tunnelAccel : opts.decel);
  const acc = (i: number) => (deep[i] && opts.tunnelAccel ? opts.tunnelAccel : opts.accel);
  for (let pass = 0; pass < passes; pass++) {
    for (let i = m - 2; i >= 0; i--) limit[i] = Math.min(limit[i], Math.sqrt(limit[i + 1] ** 2 + 2 * dec(i) * PROFILE_STEP));
    if (track.loop) limit[m - 1] = Math.min(limit[m - 1], limit[0]);
    for (let i = 1; i < m; i++) limit[i] = Math.min(limit[i], Math.sqrt(limit[i - 1] ** 2 + 2 * acc(i) * PROFILE_STEP));
    if (track.loop) limit[0] = Math.min(limit[0], limit[m - 1]);
  }
  const time = new Float32Array(m);
  for (let i = 1; i < m; i++) {
    const ds = Math.min(length, i * PROFILE_STEP) - Math.min(length, (i - 1) * PROFILE_STEP);
    time[i] = time[i - 1] + ds / Math.max(0.5, (limit[i] + limit[i - 1]) / 2);
  }
  track.limit = limit;
  track.time = time;
  return track;
}

/** Arc s normalised onto the track: wraps on a loop, clamps otherwise. */
export function normArc(track: Pick<LineTrack, 'loop' | 'length'>, s: number): number {
  if (track.loop) return ((s % track.length) + track.length) % track.length;
  return s <= 0 ? 0 : s >= track.length ? track.length : s;
}

/** Point on the track at arc s: position, heading of increasing s (three.js: faces (sin h, cos h)), grade dy/ds. */
export function trackPoint(track: Pick<LineTrack, 'xyz' | 'cum' | 'length' | 'loop'>, s: number, out: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 }): TrackPoint {
  const { xyz, cum } = track;
  const n = cum.length;
  const ss = normArc(track, s);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= ss) lo = mid; else hi = mid; }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (ss - cum[lo]) / seg;
  const ax = xyz[lo * 3], ay = xyz[lo * 3 + 1], az = xyz[lo * 3 + 2];
  const bx = xyz[hi * 3], by = xyz[hi * 3 + 1], bz = xyz[hi * 3 + 2];
  out.x = ax + (bx - ax) * t;
  out.y = ay + (by - ay) * t;
  out.z = az + (bz - az) * t;
  out.heading = Math.atan2(bx - ax, bz - az);
  out.grade = (by - ay) / seg;
  return out;
}

/** The speed limit at arc s (u/s). */
export function limitAt(track: Pick<LineTrack, 'limit' | 'length' | 'loop'>, s: number): number {
  const ss = normArc(track, s);
  const i = Math.min(track.limit.length - 1, Math.max(0, Math.round(ss / PROFILE_STEP)));
  return track.limit[i];
}

/** Forward distance from a to b (loops: the way round; otherwise b − a, may be negative). */
export function arcAhead(track: Pick<LineTrack, 'loop' | 'length'>, a: number, b: number): number {
  if (!track.loop) return b - a;
  const d = normArc(track, b) - normArc(track, a);
  return d < 0 ? d + track.length : d;
}

function timeAt(track: Pick<LineTrack, 'time' | 'length' | 'loop'>, s: number): number {
  const ss = normArc(track, s);
  const f = ss / PROFILE_STEP, i = Math.min(track.time.length - 2, Math.floor(f));
  const t = f - i;
  return track.time[i] + (track.time[i + 1] - track.time[i]) * Math.min(1, Math.max(0, t));
}

/** Seconds of an unhindered run from arc a to arc b in `dir` (loops go forward, the long way when b is behind). */
export function runSeconds(track: Pick<LineTrack, 'time' | 'length' | 'loop'>, a: number, b: number, dir: 1 | -1 = 1): number {
  if (track.loop) {
    const lap = track.time[track.time.length - 1];
    const d = timeAt(track, b) - timeAt(track, a);
    return d < 0 ? d + lap : d;
  }
  return Math.max(0, (timeAt(track, b) - timeAt(track, a)) * dir);
}

/** The tunnel span containing s (inclusive of its ends), or null. */
export function tunnelOf(track: Pick<LineTrack, 'tunnels'>, s: number): TransitTunnel | null {
  for (const t of track.tunnels) if (s >= t.fromAt && s <= t.toAt) return t;
  return null;
}

/**
 * Where track `a` comes within `dist` u of track `b` (crossings and shared running): arc intervals on both, merged when
 * closer than `merge` u. Sampled every 1 u on `a`. Pure; the hosts turn these into interlock boxes.
 */
export function proximitySpans(a: Pick<LineTrack, 'xyz' | 'cum' | 'length' | 'loop'>, b: Pick<LineTrack, 'xyz' | 'cum' | 'length' | 'loop'>, dist: number, merge = 4): { a0: number; a1: number; b0: number; b1: number }[] {
  const out: { a0: number; a1: number; b0: number; b1: number }[] = [];
  const p = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
  const bn = b.cum.length;
  // coarse reject: b's bounding box grown by dist
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < bn; i++) { x0 = Math.min(x0, b.xyz[i * 3]); x1 = Math.max(x1, b.xyz[i * 3]); z0 = Math.min(z0, b.xyz[i * 3 + 2]); z1 = Math.max(z1, b.xyz[i * 3 + 2]); }
  for (let s = 0; s <= a.length; s += 1) {
    trackPoint(a, s, p);
    if (p.x < x0 - dist || p.x > x1 + dist || p.z < z0 - dist || p.z > z1 + dist) continue;
    let bd = Infinity, bs = 0;
    for (let i = 1; i < bn; i++) {
      const ax = b.xyz[i * 3 - 3], az = b.xyz[i * 3 - 1], bx = b.xyz[i * 3], bz = b.xyz[i * 3 + 2];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L2));
      const d = Math.hypot(p.x - ax - dx * t, p.z - az - dz * t);
      if (d < bd) { bd = d; bs = b.cum[i - 1] + (b.cum[i] - b.cum[i - 1]) * t; }
    }
    if (bd > dist) continue;
    const last = out[out.length - 1];
    if (last && s - last.a1 <= merge) { last.a1 = s; last.b0 = Math.min(last.b0, bs); last.b1 = Math.max(last.b1, bs); } else out.push({ a0: s, a1: s, b0: bs, b1: bs });
  }
  return out;
}

/** A vehicle body for bodySpans: half length and half width (u), plus a lateral allowance (passing offsets, kerb shift). */
export interface BodyDims { halfL: number; halfW: number; margin?: number }

/**
 * Where a vehicle running on track `a` and one on track `b` could touch (wave 4 · lane T, the interlock boxes): both
 * bodies are rectangles on their tracks (centre at the arc, heading along the chord over the body), sampled every 1 u;
 * every pair within reach is tested (separating axes). Returns the arc spans on `a` (merged over `merge` u) with the
 * arcs on `b` that touched them; a span never joins hits whose `b` arcs jump by more than 20 u (two lanes of a street,
 * the two ends of a loop). Unlike proximitySpans this sees a body sweeping out in a tight turn (a bus's hairpin near a
 * streetcar terminal). Pure.
 */
export function bodySpans(a: Pick<LineTrack, 'xyz' | 'cum' | 'length' | 'loop'>, ab: BodyDims, b: Pick<LineTrack, 'xyz' | 'cum' | 'length' | 'loop'>, bb: BodyDims, merge = 4): { a0: number; a1: number; b0: number; b1: number }[] {
  const CELL = 8;
  const pa = { x: 0, y: 0, z: 0, heading: 0, grade: 0 }, pf = { ...pa }, pr = { ...pa };
  // the body pose at arc s: centre on the track, heading along the chord between its ends
  const pose = (t: Pick<LineTrack, 'xyz' | 'cum' | 'length' | 'loop'>, sArc: number, half: number) => {
    trackPoint(t, sArc, pa);
    trackPoint(t, sArc + half * 0.8, pf); trackPoint(t, sArc - half * 0.8, pr);
    const h = Math.hypot(pf.x - pr.x, pf.z - pr.z) > 0.3 ? Math.atan2(pf.x - pr.x, pf.z - pr.z) : pa.heading;
    return { x: pa.x, z: pa.z, h };
  };
  const grid = new Map<number, { s: number; x: number; z: number; h: number }[]>();
  const key = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);
  for (let sb = 0; sb <= b.length; sb += 1) {
    const q = pose(b, sb, bb.halfL);
    const k = key(Math.floor(q.x / CELL), Math.floor(q.z / CELL));
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push({ s: sb, ...q });
  }
  const aw = ab.halfW + (ab.margin ?? 0), bw = bb.halfW + (bb.margin ?? 0);
  const reach = ab.halfL + bb.halfL + aw + bw;
  const cellsOut = Math.ceil(reach / CELL);
  // separating axes of two rectangles (centre, heading h, half length l, half width w)
  const proj = (x: number, z: number, h: number, l: number, w: number, ax: number, az: number): [number, number] => {
    const fx = Math.sin(h), fz = Math.cos(h);
    const c = x * ax + z * az, r = Math.abs((fx * ax + fz * az) * l) + Math.abs((fz * ax - fx * az) * w);
    return [c - r, c + r];
  };
  const touch = (A: { x: number; z: number; h: number }, B: { x: number; z: number; h: number }) => {
    for (const h of [A.h, A.h + Math.PI / 2, B.h, B.h + Math.PI / 2]) {
      const ax = Math.sin(h), az = Math.cos(h);
      const [a0, a1] = proj(A.x, A.z, A.h, ab.halfL, aw, ax, az), [b0, b1] = proj(B.x, B.z, B.h, bb.halfL, bw, ax, az);
      if (a1 < b0 || b1 < a0) return false;
    }
    return true;
  };
  const out: { a0: number; a1: number; b0: number; b1: number }[] = [];
  for (let s = 0; s <= a.length; s += 1) {
    const A = pose(a, s, ab.halfL);
    const cx = Math.floor(A.x / CELL), cz = Math.floor(A.z / CELL);
    for (let i = -cellsOut; i <= cellsOut; i++) for (let j = -cellsOut; j <= cellsOut; j++) {
      const list = grid.get(key(cx + i, cz + j));
      if (!list) continue;
      for (const B of list) {
        if (Math.abs(B.x - A.x) > reach || Math.abs(B.z - A.z) > reach || !touch(A, B)) continue;
        const span = out.find(o => s - o.a1 <= merge && B.s >= o.b0 - 20 && B.s <= o.b1 + 20);
        if (span) { span.a1 = Math.max(span.a1, s); span.b0 = Math.min(span.b0, B.s); span.b1 = Math.max(span.b1, B.s); } else out.push({ a0: s, a1: s, b0: B.s, b1: B.s });
      }
    }
  }
  return out.sort((p, q) => p.a0 - q.a0);
}
