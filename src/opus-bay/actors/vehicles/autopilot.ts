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
 * - **Passing** (W5-bus): `passPath` plans the rest of the route shifted sideways round something standing on it (a
 *   stopped toy car, a bus at its stop) when the street has room; the movement system follows it with a fresh driver
 *   (`backUp` first when it stands too close to swing out).
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

  /**
   * (W5-bus) Reverse straight for `distance` u (at most `seconds`: by default the time it takes at the vehicle's reverse
   * speed, and a second) before driving on: room to swing out round something standing just ahead (passPath).
   */
  backUp(distance: number, seconds = 1.2 + distance / Math.max(0.5, this.spec.reverse)) {
    if (this.done) return;
    this.state = 'backup';
    this.backT = seconds;
    this.backSteer = 0;
    this.backDist = distance;
    this.backFrom = null;
  }
  private backDist = 0;
  private backFrom: Vec2 | null = null;
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
      // (W5-bus) a measured back-up (backUp): until the vehicle has reversed that far
      if (this.backDist > 0 && !this.backFrom) this.backFrom = { x: pose.x, z: pose.z };
      const far = this.backDist > 0 && !!this.backFrom && Math.hypot(pose.x - this.backFrom.x, pose.z - this.backFrom.z) >= this.backDist;
      if (this.backT <= 0 || far) { this.state = 'drive'; this.best = this.s; this.stuckT = 0; this.backDist = 0; this.backFrom = null; }
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

// ---------------------------------------------------------------------------
// (W5-bus) Passing something that stands on the route
// ---------------------------------------------------------------------------

/** An obstacle disc (actors/view obstacles: a toy car's two discs, a bus's three, a cable car's …). */
export interface PassDisc { x: number; z: number; r: number }

/** a pass keeps this much room (u) between the vehicle's side and a disc it goes by */
export const PASS_MARGIN = 0.3;
/**
 * the swing out takes 1.5 u + 2.2 u per u of shift (at least PASS_SWING, at most 7 u) and reaches its full shift 1 u
 * before the first disc; it merges back over PASS_RAMP once the vehicle's own length is past the last disc
 */
export const PASS_SWING = 3;
const PASS_RAMP = 4;
/** discs this far along the route ahead (u) are looked at */
const PASS_LOOK = 16;
const smooth = (t: number) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };

export interface PassPlan {
  /** the rest of the drive: the shifted stretch, then the route's own vertices (empty when `back` > 0) */
  points: Vec2[];
  /** −1 passing on the left, +1 on the right */
  side: -1 | 1;
  /** the vehicle stands too close to swing out: back up this far (u) and plan again */
  back: number;
}

/**
 * (W5-bus) A way past what stands on the route just ahead of a vehicle at `pose` following `driver` (the discs in its
 * lane: one parked vehicle, its neighbours ≤ 2.5 u apart counted as one): the rest of the route shifted sideways round
 * them — to the left when that is no farther than the right — reaching the full shift 1 u before the first disc (over
 * PASS_SWING u at least) and merging back PASS_RAMP u after the vehicle's own length is past the last. Every point of
 * the shifted stretch must be `drivable` (the hull) and clear of every disc by the vehicle's half width + PASS_MARGIN / 2.
 * Too close to swing out: `back` says how far to reverse first. Null when nothing stands in the way, the goal lies at or
 * just past it, or neither side is clear.
 */
export function passPath(driver: PursuitDriver, pose: Vec2, discs: readonly PassDisc[], halfW: number, halfL: number, drivable: (x: number, z: number) => boolean, minSwing = PASS_SWING): PassPlan | null {
  const s0 = driver.s, end = driver.total;
  const p = { x: 0, z: 0 }, q = { x: 0, z: 0 };
  /** the route's frame at s: point, right normal (−tz, tx) */
  const frame = (s: number) => {
    driver.pointAt(Math.max(0, s - 0.5), p);
    const ax = p.x, az = p.z;
    driver.pointAt(Math.min(end, s + 0.5), q);
    const L = Math.hypot(q.x - ax, q.z - az) || 1;
    const tx = (q.x - ax) / L, tz = (q.z - az) / L;
    driver.pointAt(s, p);
    return { x: p.x, z: p.z, rx: -tz, rz: tx };
  };
  // the vehicle's own arc (it may have backed up behind the driver's progress, which never goes back)
  let sv = s0, bestV = Infinity;
  for (let s = Math.max(0, s0 - 6); s <= Math.min(end, s0 + 1); s += 0.25) {
    driver.pointAt(s, p);
    const d = Math.hypot(pose.x - p.x, pose.z - p.z);
    if (d < bestV) { bestV = d; sv = s; }
  }
  // where each disc lies along the route (nearest sample, 0.5 u) and to its side (+ right of travel)
  const placed: { s: number; lat: number; r: number }[] = [];
  for (const d of discs) {
    let best = Infinity, bs = 0, bl = 0;
    for (let s = Math.max(0, sv - 1); s <= Math.min(end, sv + PASS_LOOK); s += 0.5) {
      const f = frame(s), dx = d.x - f.x, dz = d.z - f.z, dd = dx * dx + dz * dz;
      if (dd < best) { best = dd; bs = s; bl = dx * f.rx + dz * f.rz; }
    }
    if (best < 36) placed.push({ s: bs, lat: bl, r: d.r });
  }
  const inWay = placed.filter(o => o.s > sv && Math.abs(o.lat) < halfW + o.r + PASS_MARGIN).sort((a, b) => a.s - b.s);
  if (!inWay.length) return null;
  // the parked thing: the first disc in the way and every disc chained to it (≤ 2.5 u gaps, within 3 u of the lane)
  let sMin = inWay[0].s - inWay[0].r, sMax = inWay[0].s + inWay[0].r;
  let left = inWay[0].lat - inWay[0].r, right = inWay[0].lat + inWay[0].r;
  for (let grew = true; grew;) {
    grew = false;
    for (const o of placed) {
      if (o.s - o.r > sMax + 2.5 || o.s + o.r < sMin - 2.5 || Math.abs(o.lat) > halfW + o.r + 3) continue;
      if (o.s - o.r >= sMin && o.s + o.r <= sMax && o.lat - o.r >= left && o.lat + o.r <= right) continue;
      sMin = Math.min(sMin, o.s - o.r); sMax = Math.max(sMax, o.s + o.r);
      left = Math.min(left, o.lat - o.r); right = Math.max(right, o.lat + o.r);
      grew = true;
    }
  }
  const back = sMax + halfL + 0.5, out = back + PASS_RAMP;
  if (out + 1 > end) return null;
  const offL = left - halfW - PASS_MARGIN, offR = right + halfW + PASS_MARGIN;
  const sides: [number, -1 | 1][] = Math.abs(offL) <= Math.abs(offR) + 0.5 ? [[offL, -1], [offR, 1]] : [[offR, 1], [offL, -1]];
  // the swing: from the vehicle's nose, the full shift 1 u before the first disc
  const from = sv + halfL, full = sMin - 1;
  const clearOf = (x: number, z: number) => discs.every(d => Math.hypot(d.x - x, d.z - z) >= d.r + halfW + PASS_MARGIN / 2);
  for (const [off, side] of sides) {
    const wanted = Math.min(7, Math.max(PASS_SWING, 1.5 + 2.2 * Math.abs(off)));
    // (a tighter minSwing: take the room there is, down to it)
    const swing = minSwing < PASS_SWING ? Math.max(minSwing, Math.min(wanted, full - from)) : wanted;
    const need = swing - (full - from);
    const pts: Vec2[] = [];
    let ok = true;
    for (let s = from - halfL + 0.75; s <= out + 1e-6 && ok; s += 0.75) {
      const k = s < full ? smooth((s - (full - swing)) / swing) : s <= back ? 1 : 1 - smooth((s - back) / (out - back));
      const f = frame(s), x = f.x + f.rx * off * k, z = f.z + f.rz * off * k;
      if (k > 0.05 && (!drivable(x, z) || !clearOf(x, z))) ok = false;
      pts.push({ x, z });
    }
    if (!ok) continue;
    if (need > 0) return { points: [], side, back: need + 0.3 };
    // the rest of the route: its own vertices (its corners kept exactly)
    const P = driver.path;
    for (let i = 1, acc = 0; i < P.length; i++) {
      acc += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z);
      if (acc > out + 0.3) pts.push({ x: P[i].x, z: P[i].z });
    }
    return { points: pts, side, back: 0 };
  }
  return null;
}
