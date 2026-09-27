import { platformStop } from '../actors/platform';
import { CABLE, CROSSING_HALF, type CableLine, type CableStop, type TrackPoint, type TransitData, type Turntable, pointAt, stopPos } from '../data/transit';

/**
 * Cable-car motion (lane F, plan §6.5), pure: no three.js, no DOM, so node tests drive it exactly as the world does.
 *
 * - Constant cable: a gripping car runs at CABLE.speed (9 u/s), grips on at 3 u/s² and brakes into stops at 3 u/s².
 * - Dwell 4 s at every dwell stop (every second stop, termini, the crossing station); request stops for a waiting rider
 *   or the rider's destination; a rider's hop-off request (actors/platform.ts `platformStop(line)`) brakes the car to 0
 *   within the requested time and holds it until released.
 * - Single track per line (the Powell lines share theirs up to Jackson & Mason). Block signalling: a car leaves a dwell
 *   stop only when the stretch to its next dwell stop is free; cars meet only at a stop, where they pass side by side,
 *   each 1.05 u to its own right. Termini hold one car (the turntable). The Powell × California crossing is interlocked:
 *   a car enters the crossing box only while no car of the other line is in its own.
 * - Turntables (Powell & Market, Hyde & Beach, Taylor & Bay): after the arrival dwell the car turns 180° in ≈ 9 s on the
 *   disc; `push(turntable)` (E-mash on foot) adds 14°/s per press. California cars are double-ended and just reverse.
 * - Waiting-rider dispatch: `request()` picks the car that gets there first; if that is more than 5 s away, an unseen car
 *   is brought in upstream (30 u preferred, where the block allows; retried each second while the wait stays long), so
 *   the rider boards a real car.
 * - Poses: the car stands on the track at its two bogies (height from `groundY`, else the published path), pitch = track
 *   grade, heading along travel; passing cars are offset sideways.
 */

export type CarMode = 'run' | 'dwell' | 'turn' | 'hold';

export interface CarPose { x: number; y: number; z: number; heading: number; pitch: number; roll: number }

export interface CableCar {
  /** global index (instance slot) */
  index: number;
  line: CableLine;
  /** arc position on the line's extended path */
  s: number;
  /** travel direction along the path; the car faces it */
  dir: 1 | -1;
  v: number;
  mode: CarMode;
  /** dwell seconds left */
  timer: number;
  /** arc position (stop position) ending the block the car holds; NaN while dwelling at a block boundary */
  authority: number;
  /** station at the end of that block */
  authStation: string | null;
  /** turntable angle (rad, 0 … π) while turning */
  turn: number;
  /** extra turn speed from pushes (rad/s), decays */
  boost: number;
  /** at a terminus: already turned / reversed (reset on departure) */
  turned: boolean;
  /** station while stopped at one */
  station: string | null;
  /** sideways passing offset (u, to the car's right) */
  lateral: number;
  /** carries the rider */
  rider: boolean;
  /** a rider waits at this station for this direction */
  pickup: { station: string; dir: 1 | -1 } | null;
  /** the rider gets off here */
  dropoff: string | null;
  /** arc travelled since the rider boarded */
  odometer: number;
  /** stops made since the rider boarded */
  arrivals: number;
  /** a platform stop request is braking / holding this car */
  braking: boolean;
  /** the constant deceleration chosen when that request arrived (u/s²): 0 within its `within` seconds */
  brakeRate: number;
  /** seconds since the car last moved (deadlock diagnostics) */
  still: number;
  /** last time the gripman rang for someone on the track */
  bellAt: number;
  pose: CarPose;
}

export type CableEventWhat = 'arrive' | 'depart' | 'grip' | 'bell' | 'turn' | 'turned' | 'push' | 'board';
export interface CableEvent { what: CableEventWhat; car: number; line: string; station?: string | null; turntable?: string }

export interface RiderRequest { line: string; station: string; dir: 1 | -1; to: string }

export interface RideStatus {
  line: string;
  car: number;
  /** coming: the car is on its way; here: stopped at the pickup station (board now); riding; arrived: at `to` */
  phase: 'coming' | 'here' | 'riding' | 'arrived';
  /** seconds until the car stops at the pickup station (coming) */
  eta: number;
  /** station the car is stopped at, null while moving */
  station: string | null;
  arrivals: number;
  lastStation: string | null;
  odometer: number;
  turning: boolean;
  braking: boolean;
}

export interface CableOptions {
  /** ground height under (x, z) when known (resident terrain), else null → the published track height */
  groundY?: (x: number, z: number) => number | null;
  /** can the player see this spot? (a car is never brought in where it would pop into view) */
  visible?: (x: number, z: number) => boolean;
  /** the player (cars stop for someone standing on the track; dispatch keeps teleports away from them) */
  viewer?: () => { x: number; z: number; onFoot: boolean };
  /** cars per line (default 2) */
  perLine?: number;
}

/** Half the length a car claims on its track (half a body + a small gap). */
const HALF = CABLE.length / 2 + 0.3;
const TURN_RATE = Math.PI / CABLE.turnSeconds;
/** +14°/s per push (F4) */
export const PUSH_BOOST = (14 * Math.PI) / 180;
const PUSH_DECAY = 1.2;
/** dwell after turning / reversing at a terminus (boarding) */
const TERMINUS_BOARD = 2.5;
/** a car carrying the rider waits at least this long after boarding before it grips */
const BOARD_MIN = 1.6;
/** upstream placements tried for a brought-in car (u, preferred first) */
const TELEPORT_BACK = [30, 22, 15, 42, 60];
/** a rider waiting longer than this (s) gets a new dispatch attempt every second */
const REDISPATCH_ETA = 20;

const tmpA: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const tmpB: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const tmpC: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class CableSystem {
  readonly cars: CableCar[] = [];
  readonly events: CableEvent[] = [];
  readonly data: TransitData;
  private opts: CableOptions;
  private req: RiderRequest | null = null;
  private riderCar = -1;
  private status: RideStatus | null = null;
  private retry = 0;
  /** simulated seconds (tests) */
  time = 0;

  constructor(data: TransitData, opts: CableOptions = {}) {
    this.data = data;
    this.opts = opts;
    const per = opts.perLine ?? 2;
    // initial spacing: car A at the start terminus heading out, car B two thirds along heading back (California and
    // Mason further apart so the shared Powell trunk starts uncongested)
    const plan: Record<string, [number, 1 | -1][]> = {
      'powell-hyde': [[0, 1], [0.62, -1]],
      'powell-mason': [[0.36, 1], [0.86, -1]],
      california: [[0, 1], [0.58, -1]],
    };
    for (const line of data.lines) {
      const spots = plan[line.id] ?? [[0, 1], [0.6, -1]];
      for (let k = 0; k < per; k++) {
        const [f, dir] = spots[k % spots.length];
        const stop = this.nearestDwell(line, f * line.length);
        const car: CableCar = {
          index: this.cars.length, line, s: stopPos(stop, dir), dir, v: 0, mode: 'dwell', timer: 1 + k * 2.2 + this.cars.length * 0.7,
          authority: NaN, authStation: null, turn: 0, boost: 0, turned: stop.terminus, station: stop.station, lateral: 0, rider: false, pickup: null,
          dropoff: null, odometer: 0, arrivals: 0, braking: false, brakeRate: 0, still: 0, bellAt: -99, pose: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
        };
        this.cars.push(car);
        this.updatePose(car);
      }
    }
  }

  private nearestDwell(line: CableLine, s: number): CableStop {
    return line.stops.filter(st => st.dwell).sort((a, b) => Math.abs(a.at - s) - Math.abs(b.at - s))[0];
  }

  // -------------------------------------------------------------------------
  // Track geometry and occupancy
  // -------------------------------------------------------------------------

  /** Stops the car would stop at ahead of it (dwell stops, and requested ones), nearest first. */
  private nextStop(car: CableCar): CableStop | null {
    let best: CableStop | null = null, bestD = Infinity;
    for (const st of car.line.stops) {
      const pos = stopPos(st, car.dir);
      const d = (pos - car.s) * car.dir;
      if (d < 0.02 || d >= bestD) continue;
      const requested = (car.pickup && car.pickup.dir === car.dir && car.pickup.station === st.station) || (car.rider && car.dropoff === st.station);
      if (!st.dwell && !requested) continue;
      best = st; bestD = d;
    }
    return best;
  }

  /** The next dwell stop strictly ahead (the end of the block the car would enter). */
  private nextDwell(car: CableCar, from = car.s): CableStop | null {
    let best: CableStop | null = null, bestD = Infinity;
    for (const st of car.line.stops) {
      if (!st.dwell) continue;
      const d = (stopPos(st, car.dir) - from) * car.dir;
      if (d > 0.5 && d < bestD) { best = st; bestD = d; }
    }
    return best;
  }

  /** The arc interval a car holds on its line. */
  span(car: CableCar): [number, number] {
    if (Number.isNaN(car.authority)) return [car.s - HALF, car.s + HALF];
    const a = car.s - car.dir * HALF, b = car.authority + car.dir * HALF;
    return a < b ? [a, b] : [b, a];
  }

  /** How far two lines share their track from arc 0 (Infinity for the same line, 0 for none). */
  private sharedUntil(a: CableLine, b: CableLine): number {
    if (a === b) return Infinity;
    return a.shared.find(s => s.line === b.id)?.until ?? 0;
  }

  private isTerminus(line: CableLine, pos: number) {
    return pos < 0.5 || pos > line.length - 0.5;
  }

  /**
   * May `car` claim the arc span [a, b] (its next block, ending at the stop position `target` of station `targetStation`)?
   * Cars meet only at a station that is not a terminus, going opposite ways (at the crossing station they stand on the
   * two near sides, 8.8 u apart).
   */
  private free(car: CableCar, a: number, b: number, target: number, targetStation: string | null, ignore = -1): boolean {
    const terminus = this.isTerminus(car.line, target);
    const here = this.isTerminus(car.line, car.s) ? null : car.station;
    for (const o of this.cars) {
      if (o === car || o.index === ignore) continue;
      const until = this.sharedUntil(car.line, o.line);
      if (until <= 0) continue;
      const [oa, ob0] = this.span(o);
      const ca = a, lim = until === Infinity ? Infinity : until + HALF;
      const cb = Math.min(b, lim), ob = Math.min(ob0, lim);
      if (ca >= cb || oa >= ob || ca >= ob || oa >= cb) continue;
      const boundary = Number.isNaN(o.authority) && o.mode === 'dwell';
      const opposite = o.dir !== car.dir;
      if (opposite && boundary && o.station) {
        // the car dwelling at our target station, going the other way: we pass there
        if (!terminus && o.station === targetStation) continue;
        // the car dwelling beside us at our station, going the other way (we just passed it)
        if (here && o.station === here) continue;
      }
      // a car coming the other way whose block ends at our target station: we both stop there and pass
      if (opposite && !boundary && !terminus && o.mode !== 'turn' && o.authStation && o.authStation === targetStation) continue;
      return false;
    }
    // the crossing: our span through our crossing box needs the other line's cars out of theirs
    for (const cr of car.line.crossings) {
      if (b < cr.at - CROSSING_HALF || a > cr.at + CROSSING_HALF) continue;
      for (const o of this.cars) {
        if (o.line.id !== cr.line || o.index === ignore) continue;
        const [oa, ob] = this.span(o);
        if (ob >= cr.otherAt - CROSSING_HALF && oa <= cr.otherAt + CROSSING_HALF) return false;
      }
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Rider API (game/transit.ts via game/ride.ts)
  // -------------------------------------------------------------------------

  /** Seconds until `car` stops at arc `target` travelling in `dir` (rough: cable speed, dwells, one turn-around). */
  eta(car: CableCar, target: number, dir: 1 | -1): number {
    const line = car.line;
    let t = car.mode === 'dwell' || car.mode === 'hold' ? Math.max(0, car.timer) : 0;
    if (car.mode === 'turn') t += (Math.PI - car.turn) / (TURN_RATE + car.boost) + TERMINUS_BOARD;
    const dwellsBetween = (from: number, to: number) => line.stops.filter(st => st.dwell && (st.at - from) * Math.sign(to - from) > 0.5 && (to - st.at) * Math.sign(to - from) > 0.5).length;
    const leg = (from: number, to: number) => Math.abs(to - from) / CABLE.speed + dwellsBetween(from, to) * (CABLE.dwell + 3) + (Math.abs(to - from) > 0.5 ? 3 : 0);
    let dirNow = car.mode === 'turn' ? (-car.dir as 1 | -1) : car.dir;
    let s = car.s;
    if (car.mode !== 'turn' && car.turned === false && this.isTerminus(line, s) && Number.isNaN(car.authority) && car.mode === 'dwell'
      && ((s < 0.5 && dirNow < 0) || (s > line.length - 0.5 && dirNow > 0))) {
      t += (line.turntableStart || line.turntableEnd ? CABLE.turnSeconds : 0) + TERMINUS_BOARD;
      dirNow = -dirNow as 1 | -1;
    }
    if (dirNow === dir && (target - s) * dir >= -0.3) return t + leg(s, target);
    const end = dirNow > 0 ? line.length : 0;
    t += leg(s, end) + CABLE.dwell + (line.doubleEnded ? TERMINUS_BOARD : CABLE.turnSeconds + TERMINUS_BOARD);
    s = end;
    return t + leg(s, target);
  }

  /** A rider waits at `station` to ride toward `to` (direction `dir`). Picks (or brings in) the car. */
  request(req: RiderRequest): RideStatus | null {
    this.cancel();
    const line = this.data.lines.find(l => l.id === req.line);
    const stop = line?.stops.find(st => st.station === req.station);
    if (!line || !stop) return null;
    const target = stopPos(stop, req.dir);
    const cars = this.cars.filter(c => c.line === line);
    let best: CableCar | null = null, bestEta = Infinity;
    for (const c of cars) { const e = this.eta(c, target, req.dir); if (e < bestEta) { bestEta = e; best = c; } }
    if (!best) return null;
    if (bestEta > CABLE.dispatchSeconds) {
      const moved = this.bringIn(cars, line, stop, req.dir);
      if (moved) { best = moved; bestEta = this.eta(moved, target, req.dir); }
    }
    this.req = req;
    this.retry = 1;
    this.riderCar = best.index;
    best.pickup = { station: req.station, dir: req.dir };
    best.dropoff = req.to;
    this.status = { line: line.id, car: best.index, phase: 'coming', eta: bestEta, station: null, arrivals: 0, lastStation: null, odometer: 0, turning: false, braking: false };
    // a car already standing at the station facing the right way (turned, at a terminus): board now
    const facingOut = (best.s < 0.5 && best.dir < 0) || (best.s > line.length - 0.5 && best.dir > 0);
    if (best.station === req.station && best.dir === req.dir && best.mode === 'dwell' && !facingOut && Math.abs(best.s - stopPos(stop, best.dir)) < 0.3) this.markHere(best);
    return this.status;
  }

  /**
   * Bring an unseen car in upstream of the stop (30 u preferred, then nearer or farther placements; at a terminus: before
   * it, arriving to turn). Every placement must be out of sight, away from the player and on a free block.
   */
  private bringIn(cars: CableCar[], line: CableLine, stop: CableStop, dir: 1 | -1): CableCar | null {
    const vis = this.opts.visible ?? (() => false);
    const viewer = this.opts.viewer?.();
    const arriveDir = (stop.terminus && ((stop.at < 0.5 && dir > 0) || (stop.at > line.length - 0.5 && dir < 0)) ? -dir : dir) as 1 | -1;
    const target = stopPos(stop, arriveDir);
    for (const back of TELEPORT_BACK) {
      let place = Math.max(0, Math.min(line.length, target - arriveDir * back));
      // never behind a dwell stop that lies before the pickup (the car would stop there first)
      for (const st of line.stops) {
        if (!st.dwell || st === stop) continue;
        const pos = stopPos(st, arriveDir);
        if ((pos - place) * arriveDir >= 0 && (target - pos) * arriveDir > 0.5) place = pos + arriveDir * 0.5;
      }
      const dist = Math.abs(target - place);
      if (dist < 8) continue;
      const at = pointAt(line, place, tmpA);
      if (vis(at.x, at.z)) continue;
      if (viewer && Math.hypot(at.x - viewer.x, at.z - viewer.z) < 22) continue;
      for (const c of cars) {
        if (c.rider || c.mode === 'turn') continue;
        if (vis(c.pose.x, c.pose.z) || (viewer && Math.hypot(c.pose.x - viewer.x, c.pose.z - viewer.z) < 60)) continue;
        // the block the car is placed into runs to the next dwell stop at or beyond the pickup
        const probe: CableCar = { ...c, s: place, dir: arriveDir, station: null, authority: NaN };
        const end = stop.dwell ? stop : this.nextDwell(probe, target - arriveDir * 0.6);
        if (!end) continue;
        const endPos = stopPos(end, arriveDir);
        const a = Math.min(place - arriveDir * HALF, endPos + arriveDir * HALF), b = Math.max(place - arriveDir * HALF, endPos + arriveDir * HALF);
        // and a car length behind it: nobody may be right behind the placement
        const behind = place - arriveDir * HALF * 2;
        if (!this.free(probe, Math.min(a, behind), Math.max(b, behind), endPos, end.station, c.index)) continue;
        c.s = place; c.dir = arriveDir; c.v = Math.min(CABLE.speed, Math.sqrt(2 * CABLE.brake * dist)); c.mode = 'run'; c.timer = 0; c.authority = endPos; c.authStation = end.station; c.turned = false; c.turn = 0;
        c.station = null; c.lateral = 0; c.still = 0;
        this.updatePose(c);
        return c;
      }
    }
    return null;
  }

  /** While the rider still waits long (the first dispatch found no free unseen spot), try again once a second. */
  private redispatch() {
    const req = this.req, st = this.status, cur = this.cars[this.riderCar];
    if (!req || !st || !cur) return;
    const line = cur.line, stop = line.stops.find(s => s.station === req.station);
    if (!stop) return;
    const moved = this.bringIn(this.cars.filter(c => c.line === line), line, stop, req.dir);
    if (!moved) return;
    if (moved !== cur) { cur.pickup = null; cur.dropoff = null; }
    moved.pickup = { station: req.station, dir: req.dir };
    moved.dropoff = req.to;
    this.riderCar = moved.index;
    st.car = moved.index;
    st.eta = this.eta(moved, stopPos(stop, req.dir), req.dir);
  }

  private markHere(car: CableCar) {
    if (!this.status) return;
    this.status.phase = 'here';
    this.status.station = car.station;
    car.timer = Math.max(car.timer, BOARD_MIN + 1);
  }

  /** The rider stepped aboard the car standing at the pickup station. */
  board() {
    const car = this.cars[this.riderCar];
    if (!car || !this.status) return;
    car.rider = true;
    car.pickup = null;
    car.odometer = 0;
    car.arrivals = 0;
    car.timer = Math.max(car.timer, BOARD_MIN);
    this.status.phase = 'riding';
    this.events.push({ what: 'board', car: car.index, line: car.line.id, station: car.station });
  }

  /** The rider left (arrived, hopped off, cancelled): the car goes on with its round. */
  cancel() {
    const car = this.cars[this.riderCar];
    if (car) { car.rider = false; car.pickup = null; car.dropoff = null; car.braking = false; }
    this.req = null;
    this.riderCar = -1;
    this.status = null;
  }

  /** The rider's ride as the cars see it (null without a request). */
  rideStatus(): RideStatus | null { return this.status; }
  /** The car serving the rider (dispatched or carrying), or null. */
  riderCarOf(line: string): CableCar | null {
    const c = this.cars[this.riderCar];
    return c && c.line.id === line ? c : null;
  }

  // -------------------------------------------------------------------------
  // Turntables
  // -------------------------------------------------------------------------

  /** The car turning on turntable `id` (null when the disc is idle). */
  turningAt(id: string): CableCar | null {
    for (const c of this.cars) {
      if (c.mode !== 'turn') continue;
      const tt = this.turntableOf(c);
      if (tt?.id === id) return c;
    }
    return null;
  }

  /** The turntable a car at a terminus stands on. */
  turntableOf(car: CableCar): Turntable | null {
    if (car.s < 0.5) return car.line.turntableStart;
    if (car.s > car.line.length - 0.5) return car.line.turntableEnd;
    return null;
  }

  /** Disc angle of turntable `id` (rad): the turning car's angle, else 0 (the disc is symmetric end for end). */
  discAngle(id: string): number { return this.turningAt(id)?.turn ?? 0; }

  /** Help push it round (E on foot): +14°/s, decaying. Returns false when nothing is turning there. */
  push(id: string, strength = 1): boolean {
    const car = this.turningAt(id);
    if (!car) return false;
    car.boost = Math.min(car.boost + PUSH_BOOST * strength, PUSH_BOOST * 6);
    this.events.push({ what: 'push', car: car.index, line: car.line.id, turntable: id });
    return true;
  }

  // -------------------------------------------------------------------------
  // Step
  // -------------------------------------------------------------------------

  step(dt: number) {
    if (dt <= 0) return;
    this.time += dt;
    for (const car of this.cars) this.stepCar(car, dt);
    for (const car of this.cars) this.stepLateral(car, dt);
    for (const car of this.cars) this.updatePose(car);
    this.updateStatus(dt);
  }

  private stepCar(car: CableCar, dt: number) {
    const line = car.line;
    const s0 = car.s;
    // the rider's stop request (hop-off brake), honoured by the car carrying them
    const stopReq = car.rider ? platformStop(line.id) : null;
    // one constant deceleration per request (sim time, not the request's wall clock): stopped within `within` s
    if (stopReq && !car.braking) car.brakeRate = Math.max(CABLE.brake, car.v / Math.max(0.05, stopReq.within - stopReq.since));
    car.braking = !!stopReq;
    if (car.mode === 'turn') {
      car.turn += (TURN_RATE + car.boost) * dt;
      car.boost *= Math.exp(-dt / PUSH_DECAY);
      if (car.turn >= Math.PI) {
        car.turn = 0; car.boost = 0;
        car.dir = -car.dir as 1 | -1;
        car.turned = true;
        car.mode = 'dwell';
        car.timer = TERMINUS_BOARD;
        const tt = this.turntableOf(car);
        this.events.push({ what: 'turned', car: car.index, line: line.id, turntable: tt?.id, station: car.station });
        if (this.status && this.riderCar === car.index && car.pickup && car.pickup.dir === car.dir && car.pickup.station === car.station) this.markHere(car);
      }
    } else if (car.mode === 'dwell') {
      car.v = 0;
      car.timer -= dt;
      if (car.timer <= 0) this.leave(car);
    } else {
      // run / hold
      const next = this.nextStop(car);
      const target = next ? stopPos(next, car.dir) : car.dir > 0 ? line.length : 0;
      const dist = Math.max(0, (target - car.s) * car.dir);
      let limit = Math.min(CABLE.speed, Math.sqrt(2 * CABLE.brake * dist));
      // someone standing on the track ahead: the gripman stops (and rings)
      const viewer = this.opts.viewer?.();
      if (viewer?.onFoot) {
        const ahead = this.onTrackAhead(car, viewer.x, viewer.z);
        if (ahead !== null) {
          limit = Math.min(limit, Math.sqrt(2 * CABLE.brake * 2 * Math.max(0, ahead - 3.2)));
          if (ahead < 9 && car.v > 1 && this.time - car.bellAt > 3) { car.bellAt = this.time; this.events.push({ what: 'bell', car: car.index, line: line.id }); }
        }
      }
      if (stopReq) {
        car.v = Math.max(0, car.v - car.brakeRate * dt);
        car.mode = car.v <= 0.02 ? 'hold' : 'run';
      } else {
        if (car.mode === 'hold') car.mode = 'run';
        car.v = car.v < limit ? Math.min(limit, car.v + CABLE.grip * dt) : Math.max(limit, car.v - CABLE.brake * 2.5 * dt);
      }
      let step = car.v * dt;
      if (step >= dist && dist < Infinity) step = dist;
      car.s += car.dir * step;
      if (car.rider) car.odometer += step;
      if (car.v > 0.02) car.station = null;
      if (next && Math.abs(target - car.s) < 0.02 && !stopReq) this.arrive(car, next);
    }
    car.still = Math.abs(car.s - s0) > 1e-4 || car.mode === 'turn' ? 0 : car.still + dt;
  }

  /** Arc distance ahead of the car's front to a person standing on its track (within 1.3 u sideways), or null. */
  private onTrackAhead(car: CableCar, x: number, z: number): number | null {
    const dx = x - car.pose.x, dz = z - car.pose.z;
    const fx = Math.sin(car.pose.heading), fz = Math.cos(car.pose.heading);
    const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    return along > 0 && along < 14 && side < 1.3 ? along - CABLE.length / 2 : null;
  }

  private arrive(car: CableCar, stop: CableStop) {
    car.s = stopPos(stop, car.dir);
    car.v = 0;
    car.mode = 'dwell';
    car.station = stop.station;
    car.timer = CABLE.dwell;
    if (stop.dwell) { car.authority = NaN; car.authStation = null; }
    if (car.rider) car.arrivals++;
    this.events.push({ what: 'arrive', car: car.index, line: car.line.id, station: stop.station });
    const st = this.status;
    if (st && this.riderCar === car.index) {
      if (!car.rider && car.pickup && car.pickup.station === stop.station && car.pickup.dir === car.dir) this.markHere(car);
      if (car.rider) {
        st.lastStation = stop.station;
        st.arrivals = car.arrivals;
        if (car.dropoff === stop.station) { st.phase = 'arrived'; car.timer = Math.max(car.timer, 3); }
      }
    }
  }

  /** Dwell over: turn at a terminus, or claim the next block and grip the cable. */
  private leave(car: CableCar) {
    const line = car.line;
    const atStart = car.s < 0.5, atEnd = car.s > line.length - 0.5;
    const facingOut = (atStart && car.dir < 0) || (atEnd && car.dir > 0);
    if (facingOut && !car.turned) {
      if (car.rider) { car.timer = 0.5; return; }
      if ((atStart ? line.turntableStart : line.turntableEnd)) {
        car.mode = 'turn'; car.turn = 0; car.boost = 0;
        this.events.push({ what: 'turn', car: car.index, line: line.id, turntable: this.turntableOf(car)?.id, station: car.station });
      } else {
        // double-ended: the gripman walks to the other end
        car.dir = -car.dir as 1 | -1;
        car.turned = true;
        car.timer = TERMINUS_BOARD;
        if (this.status && this.riderCar === car.index && car.pickup && car.pickup.dir === car.dir && car.pickup.station === car.station) this.markHere(car);
      }
      return;
    }
    // a rider still boarding / the car waiting for its rider: hold
    if (this.status && this.riderCar === car.index && this.status.phase === 'here') { car.timer = 0.3; return; }
    if (car.rider && platformStop(line.id)) { car.timer = 0.3; return; }
    const end = this.nextDwell(car);
    if (!end) { car.timer = 0.5; return; }
    const endPos = stopPos(end, car.dir);
    const a = Math.min(car.s - car.dir * HALF, endPos + car.dir * HALF), b = Math.max(car.s - car.dir * HALF, endPos + car.dir * HALF);
    if (!Number.isNaN(car.authority) || this.free(car, a, b, endPos, end.station)) {
      if (Number.isNaN(car.authority)) { car.authority = endPos; car.authStation = end.station; }
      car.mode = 'run';
      car.turned = false;
      this.events.push({ what: 'grip', car: car.index, line: line.id, station: car.station });
      this.events.push({ what: 'depart', car: car.index, line: line.id, station: car.station });
    } else car.timer = 0.25;
  }

  /** Passing: two cars going opposite ways near the same stop step aside, each to its own right. */
  private stepLateral(car: CableCar, dt: number) {
    let want = 0;
    if (car.mode !== 'turn') {
      for (const o of this.cars) {
        if (o === car || o.dir === car.dir || o.mode === 'turn') continue;
        const until = this.sharedUntil(car.line, o.line);
        if (until <= 0 || (until !== Infinity && (car.s > until + HALF || o.s > until + HALF))) continue;
        if (Math.abs(o.s - car.s) < CABLE.length * 2.2) { want = CABLE.passOffset; break; }
      }
    }
    const k = 1.1 * dt;
    car.lateral += Math.max(-k, Math.min(k, want - car.lateral));
  }

  /** Recompute a car's world pose (bogies on the track, pitch = grade, sideways passing offset). */
  updatePose(car: CableCar) {
    const line = car.line, pose = car.pose;
    const g = this.opts.groundY;
    const yAt = (p: TrackPoint) => { const h = g?.(p.x, p.z); return (h ?? p.y) + CABLE.railLift; };
    if (car.mode === 'turn') {
      const p = pointAt(line, car.s, tmpA);
      const base = p.heading + (car.dir < 0 ? Math.PI : 0);
      pose.x = p.x; pose.z = p.z; pose.y = yAt(p);
      pose.heading = wrapAngle(base + car.turn);
      pose.pitch = 0; pose.roll = 0;
      return;
    }
    const f = pointAt(line, car.s + car.dir * CABLE.bogie, tmpA);
    const r = pointAt(line, car.s - car.dir * CABLE.bogie, tmpB);
    const yf = yAt(f), yr = yAt(r);
    const c = pointAt(line, car.s, tmpC);
    const heading = Math.atan2(f.x - r.x, f.z - r.z);
    const base = Math.hypot(f.x - r.x, f.z - r.z) || 1;
    pose.heading = Number.isFinite(heading) && base > 0.5 ? heading : c.heading + (car.dir < 0 ? Math.PI : 0);
    pose.pitch = Math.atan2(yf - yr, base);
    // right of the facing direction: (−cos h, sin h)
    pose.x = c.x - Math.cos(pose.heading) * car.lateral;
    pose.z = c.z + Math.sin(pose.heading) * car.lateral;
    pose.y = (yf + yr) / 2;
    pose.roll = car.v > 0.5 ? Math.sin(this.time * 6.1 + car.index) * 0.004 * Math.min(1, car.v / CABLE.speed) : 0;
  }

  private updateStatus(dt: number) {
    const st = this.status;
    if (st?.phase === 'coming' && st.eta > REDISPATCH_ETA && (this.retry -= dt) <= 0) { this.retry = 1; this.redispatch(); }
    const car = this.cars[this.riderCar];
    if (!st || !car) return;
    st.turning = car.mode === 'turn';
    st.braking = car.braking;
    st.odometer = car.odometer;
    st.station = car.v < 0.02 ? car.station : null;
    if (st.phase === 'coming' && this.req) {
      const stop = car.line.stops.find(s => s.station === this.req!.station);
      if (stop) st.eta = this.eta(car, stopPos(stop, this.req.dir), this.req.dir);
    }
  }

  /** Test helper: the pair of cars closest on a shared track (arc distance), ignoring passing pairs at stops. */
  violations(): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const a = this.cars[i], b = this.cars[j];
      const until = this.sharedUntil(a.line, b.line);
      if (until <= 0 || a.mode === 'turn' && b.mode === 'turn') continue;
      if (until !== Infinity && (a.s > until + HALF || b.s > until + HALF)) continue;
      const d = Math.abs(a.s - b.s);
      if (d >= CABLE.length - 0.1) continue;
      // passing at a station: both within 14 u of that station's stop (not a terminus; the crossing station has two), opposite ways
      const near = (c: CableCar) => c.line.stops.filter(st => !st.terminus && Math.abs(stopPos(st, c.dir) - c.s) < 14).map(st => st.station);
      const na = near(a), nb = near(b);
      if (a.dir !== b.dir && na.some(id => nb.includes(id))) continue;
      out.push(`${a.line.id}#${a.index} ${a.s.toFixed(1)}/${a.dir} vs ${b.line.id}#${b.index} ${b.s.toFixed(1)}/${b.dir}`);
    }
    return out;
  }
}

// The running system lives in data/transit.ts (a tiny registry), so game/ride.ts and game/transit.ts, which are in the
// main bundle, never import this module: world/transitLayer.ts (a lazy chunk) installs it.
export { activeCableSystem, setActiveCableSystem } from '../data/transit';
