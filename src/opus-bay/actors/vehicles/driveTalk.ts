import type { Bilingual, Vec2 } from '../../core/types';

/**
 * Wave 4 · lane G · W4-G4 (integration part b): BAYBAY in the bike basket / the toy car's front seat while the autopilot
 * drives (plan sf-w4-plan.md §4.2 "BAYBAY leads", bike / car): she points ≈ 20 u before a turn of more than 45° ("前面
 * 左转！") and says one line at a third and at two thirds of a long drive. Pure: the movement system feeds it the
 * autopilot's progress (PursuitDriver.s) and plays the cue (the 'point' gesture + her bubble).
 *
 *   turns   the route's corners, turn measured over ±TURN_SPAN u, |turn| > 45°, corners closer than MERGE u merged
 *           (a jog round a block corner is one cue); a cue fires once, LEAD u before the corner
 *   thirds  on drives of THIRDS_MIN u or more, at 1/3 and 2/3 of the length, never within QUIET s of another cue
 *   pace    at most one cue every QUIET s (a turn waits for the quiet to end only if it is still ahead)
 */

export const DRIVE_TALK = {
  /** a corner counts when the route turns more than this (rad) */
  minTurn: Math.PI / 4,
  /** the turn is measured over ± this many u of route */
  turnSpan: 4,
  /** corners closer than this (u) are one cue */
  merge: 12,
  /** a turn cue fires this far (u) before the corner */
  lead: 20,
  /** the 1/3 and 2/3 lines only on drives this long (u) */
  thirdsMin: 150,
  /** seconds between two cues */
  quiet: 6,
} as const;

export type DriveCue =
  | { kind: 'turn'; side: 'left' | 'right'; at: number }
  | { kind: 'third'; n: 1 | 2 };

interface Corner { s: number; side: 'left' | 'right'; done: boolean }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Arc lengths of a polyline's vertices. */
function arcLengths(path: readonly Vec2[]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  return cum;
}

function pointAt(path: readonly Vec2[], cum: readonly number[], s: number): Vec2 {
  const n = path.length;
  if (s <= 0) return path[0];
  if (s >= cum[n - 1]) return path[n - 1];
  let i = 1;
  while (i < n - 1 && cum[i] < s) i++;
  const a = path[i - 1], b = path[i], L = cum[i] - cum[i - 1] || 1, k = (s - cum[i - 1]) / L;
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}

/**
 * The corners of a drive route worth a pointing cue: signed turn over ±turnSpan u at each vertex (heading = atan2(dx,
 * dz); the world is right-handed and y-up, x east and z south up to the city's rotation, so seen from above the heading
 * grows anticlockwise: a positive turn is a left turn for the rider, a negative one a right turn).
 */
export function routeCorners(path: readonly Vec2[], c: typeof DRIVE_TALK = DRIVE_TALK): { s: number; turn: number }[] {
  if (path.length < 3) return [];
  const cum = arcLengths(path), total = cum[cum.length - 1];
  const out: { s: number; turn: number }[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    const s = cum[i];
    if (s < c.turnSpan || s > total - c.turnSpan) continue;
    const a = pointAt(path, cum, s - c.turnSpan), m = path[i], b = pointAt(path, cum, s + c.turnSpan);
    const turn = wrap(Math.atan2(b.x - m.x, b.z - m.z) - Math.atan2(m.x - a.x, m.z - a.z));
    if (Math.abs(turn) <= c.minTurn) continue;
    const last = out[out.length - 1];
    if (last && s - last.s < c.merge) { if (Math.abs(turn) > Math.abs(last.turn)) { last.s = s; last.turn = turn; } continue; }
    out.push({ s, turn });
  }
  return out;
}

export class DriveTalk {
  readonly total: number;
  private readonly corners: Corner[];
  private readonly thirds: { s: number; n: 1 | 2; done: boolean }[] = [];
  private lastAt = -Infinity;
  private readonly c: typeof DRIVE_TALK;

  constructor(path: readonly Vec2[], c: typeof DRIVE_TALK = DRIVE_TALK) {
    this.c = c;
    const cum = arcLengths(path);
    this.total = cum[cum.length - 1] ?? 0;
    this.corners = routeCorners(path, c).map(k => ({ s: k.s, side: k.turn > 0 ? 'left' : 'right', done: false }));
    if (this.total >= c.thirdsMin) this.thirds.push({ s: this.total / 3, n: 1, done: false }, { s: (2 * this.total) / 3, n: 2, done: false });
  }

  /** The cue due at progress `s` (u along the route) at time `now` (s), or null. Each cue fires once. */
  step(s: number, now: number): DriveCue | null {
    const quiet = now - this.lastAt < this.c.quiet;
    for (const k of this.corners) {
      if (k.done) continue;
      if (s > k.s) { k.done = true; continue; } // passed (a quiet spell or a start past it)
      if (s < k.s - this.c.lead) break;
      if (quiet) return null;
      k.done = true;
      this.lastAt = now;
      return { kind: 'turn', side: k.side, at: k.s };
    }
    for (const t of this.thirds) {
      if (t.done || s < t.s) continue;
      if (quiet) return null;
      t.done = true;
      // not right on top of a corner cue: the turn is the more useful line there
      if (this.corners.some(k => !k.done && k.s - s < this.c.lead + 6)) return null;
      this.lastAt = now;
      return { kind: 'third', n: t.n };
    }
    return null;
  }
}

/** BAYBAY's words for a cue (bubble text; the pointing gesture goes with a turn). */
export function driveCueLine(cue: DriveCue, kind: 'bike' | 'car'): Bilingual {
  if (cue.kind === 'turn') return cue.side === 'left' ? { zh: '前面左转！', en: 'Left turn ahead!' } : { zh: '前面右转！', en: 'Right turn ahead!' };
  if (cue.n === 1) return kind === 'bike' ? { zh: '骑得真稳！跟着路走就好～', en: 'Nice and steady! Just follow the road.' } : { zh: '小车开得真稳！', en: 'Smooth driving!' };
  return { zh: '快到了，再坚持一下！', en: 'Almost there — nearly done!' };
}
