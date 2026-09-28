import { platformStop } from '../actors/platform';
import { CABLE, CROSSING_HALF, PERSON_CLEAR, type CableLine, type CableStop, type TrackPoint, type TransitData, type Turntable, activeLineFleet, pointAt, stopPos } from '../data/transit';

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
  /** (W5-T7) gone back to the barn for the night: off the track, not drawn, not in any block (CableSystem.barn) */
  parked?: boolean;
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
  /** seconds the car has stood short of someone on foot on its track (game/transit.ts asks them to step aside) */
  held: number;
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
  /**
   * (W5-T7) Does the real line run now (data/sf/serviceHours.ts by the Bay clock)? When it does not, the line keeps
   * one car out and its other idle cars go back to the barn unseen; a rider's request brings them out again. Absent
   * (tests, district mode): every car always runs.
   */
  realService?: (line: string) => boolean;
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
const TELEPORT_BACK = [30, 22, 15, 45, 70, 100];
/** a rider waiting longer than this (s) gets a new dispatch attempt every second */
const REDISPATCH_ETA = 20;
/** (W5-T part c) a bus this close (u) to an interlock box it shares with a cable line has it first (CableSystem.free) */
export const BOX_DUE = 160;
/** (W5-T part c) a car's stop inside a box's part while a bus waits there (s): the reversal at Drumm included */
const HURRY_DWELL = 1;
/** (W5-T part c) the longest a car leaves a box to a bus that is due (s); then it goes (the bus waits for it) */
const YIELD_MAX = 20;
/** (W5-T part c) the turntable push kept up while the bus waits for the turn (rad/s: the turn in ≈ 4.5 s instead of 9) */
const HURRY_BOOST = Math.PI / 9;

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
  /** (W5-T7) seconds since the last barn check */
  private barnT = 0;
  /** (W5-T part c) car index → the time it began leaving a box to a bus due there */
  private readonly yieldSince = new Map<number, number>();
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
          dropoff: null, odometer: 0, arrivals: 0, braking: false, brakeRate: 0, still: 0, bellAt: -99, held: 0, pose: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
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
      if (o === car || o.index === ignore || o.parked) continue;
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
    // wave 4 (lane T): a sightseeing bus inside an interlock box shared with this line (Bush × Powell, California near
    // Drumm, Hyde St at the terminus): no span through the box's part on our line until the bus is out (the bus in turn
    // waits at the box while a car holds a span there: world/busSystem.ts)
    const fleet = activeLineFleet();
    if (fleet) {
      for (const box of fleet.bus.boxes) {
        const o = box.other;
        if (!o || o.line !== car.line.id || b < o.b0 || a > o.b1) continue;
        if (fleet.bus.occupies(box.id)) return false;
        // (W5-T part c, checkpoint CP-11) a bus due there: a car still outside the part leaves it to the bus (a car that
        // went down California St to Drumm, reversed and came back held the loop bus 23–46 s); a car in the part goes on
        // (the bus waits for it), and the car carrying or fetching the rider never yields
        if (ignore >= 0 || car.rider || this.riderCar === car.index || (car.s + HALF > o.b0 && car.s - HALF < o.b1)) continue;
        if (fleet.bus.boxDue(box.id, BOX_DUE)) {
          // …for YIELD_MAX at most unless the bus is about to enter (a bus held up on its way never keeps a car for long)
          const since = this.yieldSince.get(car.index) ?? this.time;
          this.yieldSince.set(car.index, since);
          if (this.time - since < YIELD_MAX || fleet.bus.boxDue(box.id, 40)) return false;
        }
      }
    }
    this.yieldSince.delete(car.index);
    // the crossing: our span through our crossing box needs the other line's cars out of theirs
    for (const cr of car.line.crossings) {
      if (b < cr.at - CROSSING_HALF || a > cr.at + CROSSING_HALF) continue;
      for (const o of this.cars) {
        if (o.line.id !== cr.line || o.index === ignore || o.parked) continue;
        const [oa, ob] = this.span(o);
        if (ob >= cr.otherAt - CROSSING_HALF && oa <= cr.otherAt + CROSSING_HALF) return false;
      }
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Rider API (game/transit.ts via game/ride.ts)
  // -------------------------------------------------------------------------

  /** Seconds until `car` stops at arc `target` travelling in `dir` (rough: cable speed, dwells, up to two turn-arounds). */
  eta(car: CableCar, target: number, dir: 1 | -1): number {
    if (car.parked) return Infinity;
    const line = car.line;
    const reverse = line.turntableStart || line.turntableEnd ? CABLE.turnSeconds + TERMINUS_BOARD : TERMINUS_BOARD;
    let t = car.mode === 'dwell' || car.mode === 'hold' ? Math.max(0, car.timer) : 0;
    if (car.mode === 'turn') t += (Math.PI - car.turn) / (TURN_RATE + car.boost) + TERMINUS_BOARD;
    const dwellsBetween = (from: number, to: number) => line.stops.filter(st => st.dwell && (st.at - from) * Math.sign(to - from) > 0.5 && (to - st.at) * Math.sign(to - from) > 0.5).length;
    const leg = (from: number, to: number) => Math.abs(to - from) / CABLE.speed + dwellsBetween(from, to) * (CABLE.dwell + 3) + (Math.abs(to - from) > 0.5 ? 3 : 0);
    let d = car.mode === 'turn' ? (-car.dir as 1 | -1) : car.dir;
    let s = car.s;
    // standing at a terminus still facing out: it turns (or the gripman changes ends) first
    if (car.mode !== 'turn' && !car.turned && this.isTerminus(line, s) && Number.isNaN(car.authority) && car.mode === 'dwell'
      && ((s < 0.5 && d < 0) || (s > line.length - 0.5 && d > 0))) {
      t += reverse;
      d = -d as 1 | -1;
    }
    for (let k = 0; k < 3; k++) {
      if (d === dir && (target - s) * d >= -0.3) return t + leg(s, target);
      const end = d > 0 ? line.length : 0;
      t += leg(s, end) + CABLE.dwell + reverse;
      s = end;
      d = -d as 1 | -1;
    }
    return t;
  }

  /** A rider waits at `station` to ride toward `to` (direction `dir`). Picks (or brings in) the car. */
  request(req: RiderRequest): RideStatus | null {
    this.cancel();
    const line = this.data.lines.find(l => l.id === req.line);
    const stop = line?.stops.find(st => st.station === req.station);
    if (!line || !stop) return null;
    const target = stopPos(stop, req.dir);
    const cars = this.cars.filter(c => c.line === line);
    // (W5-T7) a rider after the real line's hours: the cars in the barn come out (rides stay available)
    for (const c of cars) if (c.parked && !this.seen(c)) this.unpark(c);
    let best: CableCar | null = null, bestEta = Infinity;
    for (const c of cars) { const e = this.eta(c, target, req.dir); if (e < bestEta) { bestEta = e; best = c; } }
    if (!best) return null;
    if (bestEta > CABLE.dispatchSeconds) {
      const moved = this.bringIn(cars, line, stop, req.dir, bestEta);
      if (moved) { best = moved; bestEta = this.eta(moved, target, req.dir); }
    }
    this.req = req;
    this.retry = 1;
    this.riderCar = best.index;
    best.pickup = { station: req.station, dir: req.dir };
    best.dropoff = req.to;
    this.status = { line: line.id, car: best.index, phase: 'coming', eta: bestEta, station: null, arrivals: 0, lastStation: null, odometer: 0, turning: false, braking: false };
    // a car already standing at the station facing the right way (turned, at a terminus): board now
    if (this.standingAt(best, stop, req.dir)) this.markHere(best);
    return this.status;
  }

  /** Is `car` standing at `stop`, ready to leave in `dir` (a turned car at a terminus included)? */
  private standingAt(car: CableCar, stop: CableStop, dir: 1 | -1): boolean {
    const line = car.line;
    const facingOut = (car.s < 0.5 && car.dir < 0) || (car.s > line.length - 0.5 && car.dir > 0);
    return car.station === stop.station && car.dir === dir && car.mode === 'dwell' && !facingOut && Math.abs(car.s - stopPos(stop, car.dir)) < 0.3;
  }

  /** Once a second while the rider waits: hand the pickup to another car of the line that now gets there clearly sooner. */
  private reassign() {
    const req = this.req, st = this.status, cur = this.cars[this.riderCar];
    if (!req || !st || !cur) return;
    const stop = cur.line.stops.find(s => s.station === req.station);
    if (!stop) return;
    const target = stopPos(stop, req.dir);
    let best = cur, bestEta = this.eta(cur, target, req.dir);
    for (const c of this.cars) {
      if (c.line !== cur.line || c === cur || c.rider) continue;
      const e = this.eta(c, target, req.dir);
      if (e < bestEta - 3) { best = c; bestEta = e; }
    }
    st.eta = bestEta;
    if (best === cur) return;
    cur.pickup = null; cur.dropoff = null;
    best.pickup = { station: req.station, dir: req.dir };
    best.dropoff = req.to;
    this.riderCar = best.index;
    st.car = best.index;
    if (this.standingAt(best, stop, req.dir)) this.markHere(best);
  }

  /**
   * Bring an unseen car in toward the stop: first 30, 22 or 15 u upstream (never behind a dwell stop before the pickup,
   * so it arrives within 5 s), else from farther back (45 … 100 u, through the dwell stops in between), and near the
   * line's end also from beyond the stop heading out (it turns round at the terminus and comes back) when that still
   * beats `maxEta`. At a terminus pickup the car arrives to turn. Every placement is out of sight, away from the player,
   * between two stops (never on one), and on a free block with nobody right behind it.
   */
  private bringIn(cars: CableCar[], line: CableLine, stop: CableStop, dir: 1 | -1, maxEta = Infinity): CableCar | null {
    const vis = this.opts.visible ?? (() => false);
    const viewer = this.opts.viewer?.();
    const arriveDir = (stop.terminus && ((stop.at < 0.5 && dir > 0) || (stop.at > line.length - 0.5 && dir < 0)) ? -dir : dir) as 1 | -1;
    const target = stopPos(stop, arriveDir);
    const cands: { place: number; pdir: 1 | -1; near: boolean }[] = TELEPORT_BACK.map(back => ({ place: target - arriveDir * back, pdir: arriveDir, near: back <= 30 }));
    const upEnd = arriveDir > 0 ? 0 : line.length;
    if (!stop.terminus && Math.abs(target - upEnd) < TELEPORT_BACK[3]) for (const back of [45, 70]) cands.push({ place: target + arriveDir * back, pdir: -arriveDir as 1 | -1, near: false });
    for (const cand of cands) {
      const pdir = cand.pdir;
      let place = cand.place;
      if (place < 0 || place > line.length) { if (!cand.near) continue; place = Math.max(0, Math.min(line.length, place)); }
      if (cand.near) {
        // never behind a dwell stop before the pickup (the car would stop there first)
        for (const st of line.stops) {
          const pos = stopPos(st, pdir);
          if (st !== stop && st.dwell && (pos - place) * pdir >= 0 && (target - pos) * pdir > 0.5) place = pos + pdir * 0.5;
        }
        if (Math.abs(target - place) < 8) continue;
      } else {
        // halfway between the two stops around the spot, never on one
        let lo = 0, hi = line.length;
        for (const st of line.stops) { const pos = stopPos(st, pdir); if (pos <= place) lo = Math.max(lo, pos); else hi = Math.min(hi, pos); }
        if (place - lo < HALF + 1 || hi - place < HALF + 1) place = (lo + hi) / 2;
        if (place - lo < HALF + 1 || hi - place < HALF + 1) continue;
      }
      const at = pointAt(line, place, tmpA);
      if (vis(at.x, at.z)) continue;
      if (viewer && Math.hypot(at.x - viewer.x, at.z - viewer.z) < 22) continue;
      for (const c of cars) {
        if (c.rider || c.mode === 'turn') continue;
        if (vis(c.pose.x, c.pose.z) || (viewer && Math.hypot(c.pose.x - viewer.x, c.pose.z - viewer.z) < 60)) continue;
        // the block the car is placed into runs to the first dwell stop ahead (the pickup, one before it, the next one
        // beyond a request-stop pickup, or the terminus it turns at)
        const probe: CableCar = { ...c, s: place, dir: pdir, station: null, authority: NaN, mode: 'run', timer: 0, turned: false, pickup: null, dropoff: null };
        const end = this.nextDwell(probe, place);
        if (!end) continue;
        const endPos = stopPos(end, pdir);
        const toStop = this.nextStop(probe);
        probe.v = Math.min(CABLE.speed, Math.sqrt(2 * CABLE.brake * Math.abs((toStop ? stopPos(toStop, pdir) : endPos) - place)));
        if (!cand.near && this.eta(probe, target, dir) >= maxEta - 3) continue;
        const a = Math.min(place - pdir * HALF, endPos + pdir * HALF), b = Math.max(place - pdir * HALF, endPos + pdir * HALF);
        // and a car length behind it: nobody may be right behind the placement
        const behind = place - pdir * HALF * 2;
        if (Math.abs(endPos - place) < 0.5 || !this.free(probe, Math.min(a, behind), Math.max(b, behind), endPos, end.station, c.index)) continue;
        c.s = place; c.dir = pdir; c.v = probe.v; c.mode = 'run'; c.timer = 0; c.authority = endPos; c.authStation = end.station; c.turned = false; c.turn = 0;
        c.station = null; c.lateral = 0; c.still = 0; c.parked = false;
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
    const moved = this.bringIn(this.cars.filter(c => c.line === line), line, stop, req.dir, st.eta);
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
    this.barnT += dt;
    if (this.barnT >= 1) { this.barnT = 0; this.barn(); }
    for (const car of this.cars) if (!car.parked) this.stepCar(car, dt);
    for (const car of this.cars) if (!car.parked) this.stepLateral(car, dt);
    for (const car of this.cars) if (!car.parked) this.updatePose(car);
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
      // (W5-T part c) the bus waits at the Hyde St box for this turn: the crew push hard (as a player's push, kept up)
      if (car.boost < HURRY_BOOST && this.riderCar !== car.index && this.busWaitsIn(car)) car.boost = HURRY_BOOST;
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
      car.held = 0;
      // (W5-T part c) a car standing in a box's part while the bus waits at it: a short stop, then on (its riders are toys)
      if (car.timer > HURRY_DWELL && !car.rider && this.riderCar !== car.index && this.busWaitsIn(car)) car.timer = HURRY_DWELL;
      car.timer -= dt;
      if (car.timer <= 0) this.leave(car);
    } else {
      // run / hold
      const next = this.nextStop(car);
      const target = next ? stopPos(next, car.dir) : car.dir > 0 ? line.length : 0;
      const dist = Math.max(0, (target - car.s) * car.dir);
      let limit = Math.min(CABLE.speed, Math.sqrt(2 * CABLE.brake * dist));
      // someone standing on the track ahead: the gripman stops (and rings). (verify D3) Someone past the spot the car
      // rests at (its nose then clears them by PERSON_CLEAR) is not in its way: it pulls in to its stop (the Powell & Market
      // turntable's card spot stands 2.8 u past the nose of a car on the turntable; the car used to wait 0.4 u short, for good)
      const viewer = this.opts.viewer?.();
      let held = false;
      if (viewer?.onFoot) {
        const ahead = this.onTrackAhead(car, viewer.x, viewer.z);
        if (ahead !== null && ahead - dist < PERSON_CLEAR) {
          limit = Math.min(limit, Math.sqrt(2 * CABLE.brake * 2 * Math.max(0, ahead - 3.2)));
          if (ahead < 9 && car.v > 1 && this.time - car.bellAt > 3) { car.bellAt = this.time; this.events.push({ what: 'bell', car: car.index, line: line.id }); }
          held = car.v < 0.3;
        }
      }
      car.held = held ? car.held + dt : 0;
      // wave 4 (lane T): a sightseeing bus inside a box shared with this line ahead: stop short of the box's part (the
      // bus in turn waits at the box while a car's body is in or close to it: world/sf/lineInterlocks.ts boxBlocked)
      const boxGap = this.boxAhead(car);
      if (boxGap < Infinity) limit = Math.min(limit, Math.sqrt(2 * CABLE.brake * Math.max(0, boxGap)));
      if (stopReq) {
        car.v = Math.max(0, car.v - car.brakeRate * dt);
        car.mode = car.v <= 0.02 ? 'hold' : 'run';
      } else {
        if (car.mode === 'hold') car.mode = 'run';
        car.v = car.v < limit ? Math.min(limit, car.v + CABLE.grip * dt) : Math.max(limit, car.v - CABLE.brake * 2.5 * dt);
      }
      let step = car.v * dt;
      if (step >= dist && dist < Infinity) step = dist;
      if (step > boxGap) step = Math.max(0, boxGap);
      car.s += car.dir * step;
      if (car.rider) car.odometer += step;
      if (car.v > 0.02) car.station = null;
      if (next && Math.abs(target - car.s) < 0.02 && !stopReq) this.arrive(car, next);
    }
    car.still = Math.abs(car.s - s0) > 1e-4 || car.mode === 'turn' ? 0 : car.still + dt;
  }

  /** Could the player see this car now (the dispatch's rule: in view, or within 60 u)? */
  private seen(c: CableCar): boolean {
    const viewer = this.opts.viewer?.();
    return !!this.opts.visible?.(c.pose.x, c.pose.z) || (!!viewer && Math.hypot(c.pose.x - viewer.x, c.pose.z - viewer.z) < 60);
  }

  /**
   * (W5-T7, once a second) The barn: outside the real line's hours (options.realService) a line keeps one car out and
   * sends its other idle cars in, one at a time and only unseen (standing at a stop, no rider, not fetching one); in
   * the real hours they come back out where they went in, unseen and when that stretch is free.
   */
  private barn() {
    const real = this.opts.realService;
    if (!real) return;
    for (const line of this.data.lines) {
      const cars = this.cars.filter(c => c.line === line);
      if (real(line.id)) { for (const c of cars) if (c.parked && !this.seen(c)) this.unpark(c); continue; }
      const out = cars.filter(c => !c.parked);
      if (out.length <= 1) continue;
      const c = out.find(q => !q.rider && this.riderCar !== q.index && !q.pickup && q.mode === 'dwell' && Number.isNaN(q.authority) && !this.seen(q));
      if (!c) continue;
      c.parked = true; c.v = 0; c.lateral = 0; c.held = 0; c.still = 0;
    }
  }

  /** Back out of the barn onto its stop (only when nobody holds that stretch). */
  private unpark(c: CableCar): boolean {
    if (!c.parked) return true;
    if (!this.free(c, c.s - HALF, c.s + HALF, c.s, c.station)) return false;
    c.parked = false; c.mode = 'dwell'; c.timer = 1; c.authority = NaN; c.authStation = null; c.v = 0;
    this.updatePose(c);
    return true;
  }

  /** (W5-T7) Cars in the barn now (QA, the station card). */
  parkedCars(): number { return this.cars.filter(c => c.parked).length; }

  /** (W5-T part c) Does a sightseeing bus wait (or stand within a few units) at a box whose part this car stands in? */
  private busWaitsIn(car: CableCar): boolean {
    const fleet = activeLineFleet();
    if (!fleet) return false;
    for (const box of fleet.bus.boxes) {
      const o = box.other;
      if (!o || o.line !== car.line.id || car.s + HALF <= o.b0 || car.s - HALF >= o.b1) continue;
      if (fleet.bus.boxDue(box.id, 24)) return true;
    }
    return false;
  }

  /**
   * Arc distance the car may still run before its front reaches the part of an interlock box a sightseeing bus
   * occupies (0.5 u short of it), ∞ if none within 40 u ahead (the part already entered does not stop it).
   */
  private boxAhead(car: CableCar): number {
    const fleet = activeLineFleet();
    if (!fleet) return Infinity;
    let best = Infinity;
    const front = car.s + car.dir * HALF;
    for (const box of fleet.bus.boxes) {
      const o = box.other;
      if (!o || o.line !== car.line.id) continue;
      const toEdge = ((car.dir > 0 ? o.b0 : o.b1) - front) * car.dir;
      if (toEdge < 0 || toEdge > 40 || !fleet.bus.occupies(box.id)) continue;
      best = Math.min(best, toEdge - 0.5);
    }
    return best;
  }

  /** Longest a car has stood short of the person on foot (s): game/transit.ts asks them to step aside after a few seconds. */
  viewerHeld(): number {
    let t = 0;
    for (const c of this.cars) if (c.held > t) t = c.held;
    return t;
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
    if (st?.phase === 'coming' && (this.retry -= dt) <= 0) {
      this.retry = 1;
      this.reassign();
      if (st.phase === 'coming' && st.eta > REDISPATCH_ETA) this.redispatch();
    }
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
      if (a.parked || b.parked) continue;
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
