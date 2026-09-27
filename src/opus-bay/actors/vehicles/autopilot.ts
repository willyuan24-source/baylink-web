import type { Vec2 } from '../../core/types';
import { NO_DRIVE, type DriveInput, type VehicleSpec } from './collide';

/**
 * Tap-to-drive autopilot (plan §6.4, checkpoint E2-4): pure pursuit along a drive route (vehicles/driveRoute.ts),
 * producing the same DriveInput the keyboard does, so the vehicle's own dynamics and collision stay in charge.
 * Pure: no three.js, no terrain (node tests drive it through synthetic worlds).
 *
 * - **Steering.** Look-ahead Ld = clamp(3 + 0.4·v, 4, 8) along the path from the vehicle's projection on it (the
 *   projection only moves forward, within a short window, so a path passing near itself never skips ahead); the
 *   wheel angle is the pure-pursuit arc δ = atan(wheelbase · 2 sin α / Ld) as an analog steer.
 * - **Speed.** A cruise speed, capped before corners by their turn over ±3 u of path — sharp (≥ 69°) 1.9, medium
 *   (≥ 34°) 3.3, gentle (≥ 14°) 6 u/s for the toy car (GTA_SZ's city-autopilot table ×0.55, per the plan); the bike's
 *   table is the car's scaled to its 9 u/s top speed — each reached with a gentle braking curve, and a braking curve
 *   into the goal. Aiming more than 69° off the heading also crawls at the sharp cap.
 * - **Arrival** within 1.5 u of the goal (brakes to a stop).
 * - **Stuck**: less than 0.3 u of progress in 1.5 s while it wants to move (not while the ground ahead is still
 *   streaming in) → back up for 1 s, the wheel turned to swing the nose toward the path, and try again once; stuck a
 *   second time → give up (`state 'stuck'`; the movement system hands control back with a line).
 */

export interface PursuitTuning {
  /** cruise speed (u/s) */
  cruise: number;
  /** look-ahead Ld = clamp(lookBase + lookK·v, lookMin, lookMax) */
  lookBase: number;
  lookK: number;
  lookMin: number;
  lookMax: number;
  /** corner speed caps (u/s): sharp, medium, gentle */
  caps: readonly [number, number, number];
  /** arrival radius (u) */
  arrive: number;
  /** braking deceleration the speed plan assumes (u/s²) */
  decel: number;
}

/** corner turn thresholds (rad) for the three caps, measured over ±CORNER_SPAN u of path */
export const CORNER_TURN = [1.2, 0.6, 0.25] as const;
const CORNER_SPAN = 3;
/** how far ahead corners are looked for (u): the braking distance from cruise to the sharp cap, and some */
const CORNER_HORIZON = 18;
/** the corner hold releases this much early (u): the wheel needs a moment to turn (steer rate), so the arc starts sooner */
const CORNER_LEAD = 1.2;
const STUCK_TIME = 1.5, STUCK_PROGRESS = 0.3, BACKUP_TIME = 1, RETRIES = 1;

export const CAR_PURSUIT: PursuitTuning = { cruise: 10, lookBase: 3, lookK: 0.4, lookMin: 4, lookMax: 8, caps: [1.9, 3.3, 6], arrive: 1.5, decel: 7 };
const BIKE_K = 9 / 14;
export const BIKE_PURSUIT: PursuitTuning = { ...CAR_PURSUIT, cruise: 7, caps: [1.9 * BIKE_K, 3.3 * BIKE_K, 6 * BIKE_K] };

export type PursuitState = 'drive' | 'backup' | 'arrived' | 'stuck';

/** What the driver needs of the vehicle (VehicleSim satisfies it). */
export interface PursuitPose { x: number; z: number; heading: number; v: number }

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Speed cap for a corner that turns by `turn` rad (Infinity = no cap). */
export function cornerCap(turn: number, caps: readonly [number, number, number]): number {
  return turn >= CORNER_TURN[0] ? caps[0] : turn >= CORNER_TURN[1] ? caps[1] : turn >= CORNER_TURN[2] ? caps[2] : Infinity;
}

export class PursuitDriver {
  readonly path: readonly Vec2[];
  readonly total: number;
  readonly tuning: PursuitTuning;
  state: PursuitState = 'drive';
  /** progress along the path (u) and the segment it is on */
  s = 0;
  /** distance from the vehicle to its projection on the path (u) */
  crossTrack = 0;
  /** the look-ahead point and the speed aimed for this frame */
  readonly target: Vec2 = { x: 0, z: 0 };
  vTarget = 0;
  /** back-ups so far */
  retries = 0;
  private readonly spec: VehicleSpec;
  private readonly cum: Float64Array;
  /** corner speed caps per path vertex (Infinity = none) */
  private readonly vcap: Float64Array;
  private seg = 0;
  private best = 0;
  private stuckT = 0;
  private backT = 0;
  private backSteer = 0;

  constructor(spec: VehicleSpec, path: readonly Vec2[], tuning?: PursuitTuning) {
    this.spec = spec;
    this.tuning = tuning ?? (spec.kind === 'bike' ? BIKE_PURSUIT : CAR_PURSUIT);
    const pts = path.length === 1 ? [path[0], path[0]] : path;
    this.path = pts;
    const n = pts.length;
    this.cum = new Float64Array(n);
    for (let i = 1; i < n; i++) this.cum[i] = this.cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    this.total = this.cum[n - 1];
    this.vcap = new Float64Array(n).fill(Infinity);
    for (let i = 1; i < n - 1; i++) this.vcap[i] = cornerCap(this.turnAt(this.cum[i]), this.tuning.caps);
  }

  get done(): boolean { return this.state === 'arrived' || this.state === 'stuck'; }
  get end(): Vec2 { return this.path[this.path.length - 1]; }

  /** Point at arc length s along the path (clamped). */
  pointAt(s: number, out: Vec2 = { x: 0, z: 0 }): Vec2 {
    const P = this.path, cum = this.cum, n = P.length;
    if (s <= 0) { out.x = P[0].x; out.z = P[0].z; return out; }
    if (s >= this.total) { out.x = P[n - 1].x; out.z = P[n - 1].z; return out; }
    let i = Math.min(this.seg, n - 2);
    while (i > 0 && cum[i] > s) i--;
    while (i < n - 2 && cum[i + 1] < s) i++;
    const L = cum[i + 1] - cum[i] || 1, t = (s - cum[i]) / L;
    out.x = P[i].x + (P[i + 1].x - P[i].x) * t; out.z = P[i].z + (P[i + 1].z - P[i].z) * t;
    return out;
  }

  /** Turn of the path (rad) around arc length s, over ±CORNER_SPAN u. */
  turnAt(s: number): number {
    const a = this.pointAt(s - CORNER_SPAN), m = this.pointAt(s), b = this.pointAt(s + CORNER_SPAN);
    const h1 = Math.atan2(m.x - a.x, m.z - a.z), h2 = Math.atan2(b.x - m.x, b.z - m.z);
    if (Math.hypot(m.x - a.x, m.z - a.z) < 0.5 || Math.hypot(b.x - m.x, b.z - m.z) < 0.5) return 0;
    return Math.abs(wrap(h2 - h1));
  }

  /** Move the projection forward (never back), searching a short window of segments. */
  private project(x: number, z: number) {
    const P = this.path, cum = this.cum, n = P.length;
    let bestD = Infinity, bestS = this.s, bestSeg = this.seg;
    for (let i = this.seg; i < n - 1 && cum[i] <= this.s + 15; i++) {
      const ax = P[i].x, az = P[i].z, dx = P[i + 1].x - ax, dz = P[i + 1].z - az, L2 = dx * dx + dz * dz;
      const t = L2 > 1e-9 ? clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1) : 0;
      const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      const s = cum[i] + t * Math.sqrt(L2);
      if (s + 1e-9 < this.s) continue;
      if (d < bestD - 1e-9) { bestD = d; bestS = s; bestSeg = i; }
    }
    if (bestD === Infinity) { const q = this.pointAt(this.s); bestD = Math.hypot(x - q.x, z - q.z); }
    this.s = bestS; this.seg = bestSeg; this.crossTrack = bestD;
  }

  /**
   * Arc length of the look-ahead point. Plain pure pursuit cuts a 90° street corner by ≈ 0.3·Ld; so when a medium or
   * sharp corner lies within Ld, the point stays on the corner until the vehicle is (Ld + CORNER_LEAD)/2 from it and then
   * slides past it twice as fast as the vehicle closes in (continuous): the arc it steers is about symmetric about the
   * corner, radius ≈ Ld/2 (cross-track ≈ 0.65 u at a 90° corner of a 3.6 u street, tests/opus-bay-sf-move2).
   */
  private lookAt(Ld: number): number {
    const cum = this.cum, n = this.path.length;
    for (let i = this.seg + 1; i < n - 1 && cum[i] <= this.s + Ld; i++) {
      if (this.vcap[i] > this.tuning.caps[1]) continue;
      const dv = cum[i] - this.s;
      if (dv <= 0) continue;
      return cum[i] + Math.max(0, Ld + CORNER_LEAD - 2 * dv);
    }
    return this.s + Ld;
  }

  /** Speed plan at the current progress: cruise, corner caps ahead (braking curves), the goal. */
  private plannedSpeed(): number {
    const T = this.tuning, cum = this.cum, n = this.path.length;
    let v = T.cruise;
    for (let i = Math.max(1, this.seg - 2); i < n - 1 && cum[i] <= this.s + CORNER_HORIZON; i++) {
      const cap = this.vcap[i];
      if (cap === Infinity) continue;
      const d = Math.max(0, cum[i] - this.s - 1.5);
      // until the vehicle is well out of the corner
      if (cum[i] < this.s - 3.5) continue;
      v = Math.min(v, Math.sqrt(cap * cap + 2 * T.decel * d));
    }
    const left = this.total - this.s;
    v = Math.min(v, Math.max(0.9, Math.sqrt(2 * T.decel * Math.max(0, left - 0.5))));
    return v;
  }

  /**
   * One frame: the DriveInput for the vehicle at `pose`. `pending` = the ground just ahead is still streaming in
   * (city mode): the vehicle waits there, and that is not being stuck.
   */
  step(pose: PursuitPose, dt: number, pending = false): DriveInput {
    const T = this.tuning, spec = this.spec;
    if (this.state === 'stuck') return NO_DRIVE;
    const end = this.end;
    const toEnd = Math.hypot(end.x - pose.x, end.z - pose.z);
    this.project(pose.x, pose.z);
    if (this.state === 'drive' && (toEnd < T.arrive || (this.s >= this.total - 0.3 && toEnd < T.arrive + 1))) this.state = 'arrived';
    if (this.state === 'arrived') {
      this.vTarget = 0;
      return pose.v > 0.45 ? { ...NO_DRIVE, digital: false, brake: 1 } : NO_DRIVE;
    }

    const v = pose.v, sp = Math.abs(v);
    const Ld = clamp(T.lookBase + T.lookK * sp, T.lookMin, T.lookMax);
    this.pointAt(Math.min(this.total, this.lookAt(Ld)), this.target);
    // near the goal the look-ahead point is the goal itself
    const tx = this.target.x, tz = this.target.z;
    const dl = Math.max(0.5, Math.hypot(tx - pose.x, tz - pose.z));
    const alpha = wrap(Math.atan2(tx - pose.x, tz - pose.z) - pose.heading);
    const delta = Math.atan((spec.wheelbase * 2 * Math.sin(alpha)) / dl);
    const dmax = spec.steerMax / (1 + spec.steerV * sp);
    const steer = clamp(-delta / dmax, -1, 1);

    if (this.state === 'backup') {
      this.backT -= dt;
      if (this.backT <= 0) { this.state = 'drive'; this.best = this.s; this.stuckT = 0; }
      else return { throttle: 0, brake: 1, steer: this.backSteer, digital: false, sprint: false, hop: false };
    }

    let vt = this.plannedSpeed();
    if (Math.abs(alpha) > CORNER_TURN[0]) vt = Math.min(vt, T.caps[0]);
    // off the line (after a corner, a bump): settle back before speeding up
    if (this.crossTrack > 0.6) vt = Math.min(vt, T.caps[1]); else if (this.crossTrack > 0.3) vt = Math.min(vt, T.caps[2]);
    if (pending) vt = Math.min(vt, 0.3 * spec.vmax);
    this.vTarget = vt;

    // progress watchdog
    if (vt > 0.8 && !pending) {
      if (this.s > this.best + STUCK_PROGRESS) { this.best = this.s; this.stuckT = 0; }
      else this.stuckT += dt;
      if (this.stuckT > STUCK_TIME) {
        this.stuckT = 0;
        if (this.retries >= RETRIES) { this.state = 'stuck'; return NO_DRIVE; }
        this.retries++;
        this.state = 'backup';
        this.backT = BACKUP_TIME;
        // reversing with the wheel turned the other way swings the nose toward the path
        this.backSteer = alpha >= 0 ? 1 : -1;
        return { throttle: 0, brake: 1, steer: this.backSteer, digital: false, sprint: false, hop: false };
      }
    } else { this.best = Math.max(this.best, this.s); this.stuckT = 0; }

    let throttle = 0, brake = 0;
    const err = vt - v;
    if (v < -0.2) throttle = 1; // rolling back (after a back-up): throttle brakes first
    else if (err > 0.1) throttle = clamp(0.25 + err * 0.5, 0, 1);
    else if (err < -0.3 && v > 0.5) brake = clamp(-err * 0.6, 0.15, 1);
    return { throttle, brake, steer, digital: false, sprint: false, hop: false };
  }
}
