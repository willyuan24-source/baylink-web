import { platformStop } from '../actors/platform';
import { FL, type FLine, type FLineStop, aheadU, cyclePoint, legAt, sAtU, uAtS, wrapU } from '../data/fline';
import { PERSON_CLEAR } from '../data/transit';
import type { CarPose, RideStatus, RiderRequest } from './transitLine';

/**
 * F-line streetcars in city mode (lane F, checkpoint F7), pure: no three.js, no DOM, so node tests drive it exactly as
 * the world does (world/transitLayer.ts steps it and draws the cars).
 *
 * - Four cars run forward round the line's closed cycle (data/fline.ts): the hero Embarcadero (double track), the foot
 *   of Market, Market Street (single track with passing places at stations), the Castro balloon loop and the Pier 39
 *   turnaround. Speed: 11 u/s on the hero side, 13 on Market, less on curves (lateral 2.4 u/s²), accel / brake 2.6 u/s².
 * - Single track: one car per block between passing places, whatever its direction. A car takes the next block (and the
 *   side of the passing place at its far end, for its direction) before it gets there, else it stops at the passing
 *   place; it frees a block once its tail is out of it. Taking the far side with the block keeps the line free of
 *   deadlocks (the side a car will stand on is always its own).
 * - Stops: dwell stops always (every hero stop, every second Market station, the termini), request stops for the rider;
 *   a car carrying the rider brakes to 0 within the requested time on a hop-off request (`platformStop('streetcar')`).
 * - Waiting rider: the car that gets there first; if that is more than 5 s away an unseen car is brought in upstream
 *   (30 … 140 u, where the block rules allow), retried once a second while the wait stays long.
 * - Poses: the body between its two bogies on the track, height from `groundY` where the terrain is exact, pitch = the
 *   grade between the bogies, a little sway.
 */

export type FCarMode = 'run' | 'dwell';

export interface FCar {
  index: number;
  /** cycle position of the car's centre */
  u: number;
  v: number;
  mode: FCarMode;
  /** dwell seconds left */
  timer: number;
  /** the stop (index into line.stops) the car stands at, else −1 */
  at: number;
  /** blocks held (indices into line.bounds: block k = bounds[k] … bounds[k + 1]) */
  blocks: number[];
  /** the passing place (index into bounds) whose side the car has taken for its direction, −1 for none */
  side: number;
  sideDir: 1 | -1;
  /** carries the rider */
  rider: boolean;
  /** stop index a waiting rider boards at / gets off at */
  pickup: number;
  dropoff: number;
  odometer: number;
  arrivals: number;
  braking: boolean;
  brakeRate: number;
  /** seconds without moving (deadlock diagnostics) */
  still: number;
  bellAt: number;
  /** seconds the car has stood short of someone on foot on its track (game/transit.ts asks them to step aside) */
  held: number;
  pose: CarPose;
}

export type FEventWhat = 'arrive' | 'depart' | 'bell' | 'board';
export interface FEvent { what: FEventWhat; car: number; station?: string | null }

export interface FLineOptions {
  /** ground height under (x, z) where the terrain is exact, else null (the published track height) */
  groundY?: (x: number, z: number) => number | null;
  /** can the player see this spot? (a car is never brought in where it would pop into view) */
  visible?: (x: number, z: number) => boolean;
  /** the player (cars stop for someone on the track; a brought-in car stays away from them) */
  viewer?: () => { x: number; z: number; onFoot: boolean };
  /** cars (default 4) */
  cars?: number;
  /**
   * Wave 4 (lane T): the distance (u) from a car's centre to the nearest sightseeing bus on its track ahead (the loop
   * shares Market St and crosses the hero U-turn), ∞ / undefined if none: the car stops short of it (the bus in turn
   * waits at its interlock boxes while a car is in the F-line's part).
   */
  roadAhead?: (car: FCar) => number;
  /**
   * (W5-bus) a sightseeing bus waits at an interlock box whose part this car stands in (world/sf/lineInterlocks.ts
   * busWaitsForFCar): the car's stop there is cut to HURRY_DWELL s (not the rider's car)
   */
  hurryDwell?: (car: FCar) => boolean;
}

/** The platform id and ride line of the F-line (the district's, kept in city mode). */
export const FLINE_ID = 'streetcar';

const BOARD_MIN = 1.6;
/** (W5-bus) a stop inside a box part while a bus waits for it (s) */
const HURRY_DWELL = 1;
const TELEPORT_BACK = [30, 45, 22, 70, 100, 140];
const REDISPATCH_ETA = 20;
const DISPATCH_SECONDS = 5;
const tmp = { x: 0, y: 0, z: 0, heading: 0, i: 0, t: 0 };
const tmp2 = { x: 0, y: 0, z: 0, heading: 0, i: 0, t: 0 };

export class StreetcarSystem {
  readonly line: FLine;
  readonly cars: FCar[] = [];
  readonly events: FEvent[] = [];
  private opts: FLineOptions;
  private riderCar = -1;
  private status: RideStatus | null = null;
  private retry = 0;
  /** simulated seconds */
  time = 0;
  /** blocks on the single track */
  private readonly nBlocks: number;

  constructor(line: FLine, opts: FLineOptions = {}) {
    this.line = line;
    this.opts = opts;
    this.nBlocks = line.bounds.length - 1;
    const count = opts.cars ?? 4;
    // spread the cars round the cycle, each at a dwell stop off the single track (the hero stops, the Castro terminal)
    const homes = line.stops.filter(st => st.dwell && (st.leg === 2 || !(sAtU(line, st.u) < line.sJoin)));
    const used = new Set<FLineStop>();
    for (let k = 0; k < count; k++) {
      const want = (line.length * k) / count;
      let home: FLineStop | null = null;
      for (const st of homes) if (!used.has(st) && (!home || aheadU(line, want, st.u) < aheadU(line, want, home.u))) home = st;
      if (home) used.add(home);
      const car: FCar = {
        index: k, u: home ? home.u : want, v: 0, mode: home ? 'dwell' : 'run', timer: 1 + k * 1.7, at: home ? line.stops.indexOf(home) : -1,
        blocks: [], side: -1, sideDir: 1, rider: false, pickup: -1, dropoff: -1, odometer: 0, arrivals: 0, braking: false, brakeRate: 0,
        still: 0, bellAt: -99, held: 0, pose: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
      };
      this.cars.push(car);
      this.updatePose(car);
    }
  }

  /**
   * Take over where the district's hero cars are (city mode switches from the district loop to this line once the data
   * is in): the first cars move to the cycle position nearest each given pose with the same heading, off the single
   * track and clear of the others, so no car pops in or out of view at the switch.
   */
  seedFrom(poses: { x: number; z: number; heading: number }[]) {
    const L = this.line, n = L.xyz.length / 3;
    poses.forEach((q, k) => {
      const car = this.cars[k];
      if (!car) return;
      let best = -1, bd = 6;
      for (let i = 0; i < n; i++) {
        const leg = L.leg[i];
        if ((leg === 1 || leg === 3) && L.sOf[i] < L.sJoin + FL.half) continue;
        const p = cyclePoint(L, L.cum[i], tmp);
        const dh = Math.abs(Math.atan2(Math.sin(p.heading - q.heading), Math.cos(p.heading - q.heading)));
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (dh < 0.6 && d < bd) { bd = d; best = i; }
      }
      if (best < 0 || !this.clearAt(L.cum[best], car.index)) return;
      car.u = L.cum[best]; car.v = 0; car.mode = 'run'; car.at = -1; car.timer = 0; car.blocks = []; car.side = -1;
      this.updatePose(car);
    });
  }

  /** Distance ahead to a hold point; a hold point just behind the car (it rolled onto it) counts as here. */
  /**
   * (W5-bus) Where `car` will have to stop for its next single-track block (the hold point's cycle u) when it could not
   * take that block now, else NaN. world/sf/lineInterlocks.ts: a car that would stand inside a box part a bus is coming
   * to (Market St: an inbound car waiting at a passing place for the outbound one) leaves the part to the bus.
   */
  pendingHold(car: FCar): number {
    const need = this.nextNeed(car);
    if (!need || car.blocks.includes(need.k)) return NaN;
    return this.canTake(car, need.k, need.dir) && this.firstInLine(car, need) ? NaN : need.hold;
  }

  /**
   * (W5-bus) Does car `o` wait for car `by` — its next single-track block free but for `by` (held, its side of the
   * passing place, or its body on it)? Then `by` must not stand still for anyone else (lineInterlocks: a streetcar never
   * leaves a box to a bus while another waits for it: the bus would wait for that one in turn).
   */
  waitsOn(o: FCar, by: FCar): boolean {
    if (o === by) return false;
    const need = this.nextNeed(o);
    if (!need || o.blocks.includes(need.k)) return false;
    return !this.canTake(o, need.k, need.dir) && this.canTake(o, need.k, need.dir, by.index);
  }

  private toHold(car: FCar, hold: number): number {
    const d = aheadU(this.line, car.u, hold);
    return d > this.line.length / 2 ? 0 : d;
  }

  // -------------------------------------------------------------------------
  // Geometry of the single track
  // -------------------------------------------------------------------------

  /** Direction on the stem at u: −1 toward Castro (leg 1), +1 toward Pier 39 (leg 3), 0 elsewhere. */
  private dirAt(u: number): -1 | 0 | 1 {
    const leg = legAt(this.line, u);
    return leg === 1 ? -1 : leg === 3 ? 1 : 0;
  }

  /** The exclusive part of block k on C (outside the passing places at its ends; the switch ramp is inside it). */
  private blockSpan(k: number): [number, number] {
    const b = this.line.bounds, m = b.length - 1;
    return [k === 0 ? -1 : b[k] + FL.passHalf, k === m - 1 ? b[m] : b[k + 1] - FL.passHalf];
  }

  /** Physical interval of a car's body on C, or null off the stem. */
  private bodyS(car: FCar): [number, number] | null {
    const a = sAtU(this.line, car.u - FL.half), c = sAtU(this.line, car.u), b = sAtU(this.line, car.u + FL.half);
    const vals = [a, c, b].filter(v => !Number.isNaN(v));
    if (!vals.length) return null;
    // a body straddling J2 (half on the loop) still covers s = 0 … its stem end
    if (vals.length < 3 && this.nearJ2(car.u)) vals.push(0);
    return [Math.min(...vals), Math.max(...vals)];
  }

  private nearJ2(u: number): boolean {
    const L = this.line;
    return aheadU(L, L.legU[1], u) < FL.half + 1 || aheadU(L, u, L.legU[1]) < FL.half + 1 || aheadU(L, L.legU[2], u) < FL.half + 1 || aheadU(L, u, L.legU[2]) < FL.half + 1;
  }

  /**
   * The next block `car` must hold before going on, with the car-centre u where it has to stop without it, or null.
   * Leg 1 enters at the switch (block m−1) and works down; the loop exit and leg 3 work up from block 0.
   */
  private nextNeed(car: FCar): { k: number; dir: 1 | -1; hold: number } | null {
    const L = this.line, m = this.nBlocks, leg = legAt(L, car.u);
    if (leg === 1) {
      // the first block below the front (s falling) not yet held; it is taken at the passing place above it
      const front = sAtU(L, car.u - FL.half);
      for (let k = m - 1; k >= 0; k--) {
        if (this.blockSpan(k)[1] >= (Number.isNaN(front) ? -Infinity : front) - 1e-3 || car.blocks.includes(k)) continue;
        return { k, dir: -1, hold: k === m - 1 ? uAtS(L, 1, L.sJoin + FL.half + 0.6) : uAtS(L, 1, L.bounds[k + 1]) };
      }
      return null;
    }
    if (leg === 2) {
      if (car.blocks.includes(0)) return null;
      const into = aheadU(L, L.legU[1], car.u);
      if (into < (L.legU[2] - L.legU[1]) / 2) return null; // still entering the loop
      return { k: 0, dir: 1, hold: L.uLoopHold };
    }
    if (leg === 3) {
      // the first block above the front (s rising) not yet held; block 0 was taken at the loop exit
      const front = sAtU(L, car.u + FL.half);
      for (let k = 1; k < m; k++) {
        if (this.blockSpan(k)[0] <= (Number.isNaN(front) ? Infinity : front) + 1e-3 || car.blocks.includes(k)) continue;
        return { k, dir: 1, hold: uAtS(L, 3, L.bounds[k]) };
      }
      return null;
    }
    return null;
  }

  /** May `car` take block k heading `dir` (and the far passing place's side)? */
  private canTake(car: FCar, k: number, dir: 1 | -1, ignore = -1): boolean {
    const b = this.line.bounds, m = this.nBlocks;
    const far = dir > 0 ? k + 1 : k;
    const sideNeeded = far >= 1 && far <= m - 1;
    const [lo, hi] = this.blockSpan(k);
    for (const o of this.cars) {
      if (o === car || o.index === ignore) continue;
      if (o.blocks.includes(k)) return false;
      if (sideNeeded && o.side === far && o.sideDir === dir) return false;
      // anyone physically on the block's exclusive part (a placement, a car without authority)
      const body = this.bodyS(o);
      if (body && body[1] > lo + 0.1 && body[0] < hi - 0.1 && this.dirAt(o.u) !== 0) return false;
    }
    void b;
    return true;
  }

  /**
   * Wave 4 (lane T's integration): the car may take block `need.k` only when no car ahead of it on the way to its hold
   * point waits for the same block. Cars are stepped in index order, so when a car released a block mid-frame the one
   * behind in the queue (stepped later) used to get it first: at the Castro loop exit the car behind then held the single
   * track while the car ahead of it waited at the hold point for it — a jam for good (seen once another delay, a
   * sightseeing bus in a shared box, lined two cars up there).
   */
  private firstInLine(car: FCar, need: { k: number; hold: number }): boolean {
    const L = this.line, reach = this.toHold(car, need.hold) + FL.length;
    for (const o of this.cars) {
      if (o === car || o.blocks.includes(need.k)) continue;
      const d = aheadU(L, car.u, o.u);
      if (d <= 0 || d > reach) continue;
      const on = this.nextNeed(o);
      if (on && on.k === need.k) return false;
    }
    return true;
  }

  private take(car: FCar, k: number, dir: 1 | -1) {
    const m = this.nBlocks;
    car.blocks.push(k);
    const far = dir > 0 ? k + 1 : k;
    if (far >= 1 && far <= m - 1) { car.side = far; car.sideDir = dir; } else car.side = -1;
  }

  /** Free the blocks the car's tail has left. */
  private release(car: FCar) {
    if (!car.blocks.length) return;
    const L = this.line, leg = legAt(L, car.u);
    if (leg === 4) { car.blocks.length = 0; car.side = -1; return; }
    if (leg === 2) {
      // entering the loop (its first half): the stem is free once the tail is well into it; a car leaving the loop
      // (second half) keeps the block it took at the hold point
      const into = aheadU(L, L.legU[1], car.u);
      if (into < (L.legU[2] - L.legU[1]) / 2 && into >= FL.loopClear + FL.half) { car.blocks.length = 0; car.side = -1; }
      return;
    }
    const tailS = sAtU(L, car.u + (leg === 1 ? FL.half : -FL.half));
    const tail = Number.isNaN(tailS) ? (leg === 1 ? L.clen : 0) : tailS;
    car.blocks = car.blocks.filter(k => {
      const [lo, hi] = this.blockSpan(k);
      return leg === 1 ? tail > lo - 0.05 : tail < hi + 0.05;
    });
    if (leg === 3 && !car.blocks.length && (Number.isNaN(tailS) || tailS >= L.sJoin)) car.side = -1;
  }

  // -------------------------------------------------------------------------
  // Stops and rider API (game/ride.ts through the ride-system registry in data/transit.ts)
  // -------------------------------------------------------------------------

  /** The next stop this car will stop at (dwell, or requested), with the distance to it. */
  private nextStop(car: FCar): { stop: FLineStop; index: number; d: number } | null {
    let best: { stop: FLineStop; index: number; d: number } | null = null;
    this.line.stops.forEach((st, i) => {
      if (i === car.at && car.mode === 'dwell') return;
      const requested = i === car.pickup || (car.rider && i === car.dropoff);
      if (!st.dwell && !requested) return;
      const d = aheadU(this.line, car.u, st.u);
      if (d < 0.02 && car.at === i) return;
      if (!best || d < best.d) best = { stop: st, index: i, d };
    });
    return best;
  }

  /** Rough seconds until `car` stands at stop index `target`. */
  eta(car: FCar, target: number): number {
    const L = this.line, st = L.stops[target];
    const d = car.at === target && car.mode === 'dwell' ? 0 : aheadU(L, car.u, st.u);
    const dwells = L.stops.filter((s, i) => i !== target && s.dwell && aheadU(L, car.u, s.u) < d - 0.5 && aheadU(L, car.u, s.u) > 0.5).length;
    return (car.mode === 'dwell' ? Math.max(0, car.timer) : 0) + d / 10 + dwells * (FL.dwellCity + 4) + (d > 1 ? 3 : 0);
  }

  /** Stop indices of a station (one per leg it is on). */
  stopsOf(station: string): number[] {
    const out: number[] = [];
    this.line.stops.forEach((st, i) => { if (st.station === station) out.push(i); });
    return out;
  }

  /** From station `from` to `to`: the boarding stop and the first stop of `to` after it (the shorter way round). */
  legsFor(from: string, to: string): { board: number; drop: number; distance: number } | null {
    const L = this.line;
    let best: { board: number; drop: number; distance: number } | null = null;
    for (const b of this.stopsOf(from)) for (const d of this.stopsOf(to)) {
      const dist = aheadU(L, L.stops[b].u, L.stops[d].u);
      if (dist < 1) continue;
      if (!best || dist < best.distance) best = { board: b, drop: d, distance: dist };
    }
    return best;
  }

  /** A rider waits at `req.station` to ride to `req.to` (the direction follows from the shorter way). */
  request(req: RiderRequest): RideStatus | null {
    this.cancel();
    const legs = this.legsFor(req.station, req.to);
    if (!legs) return null;
    let best: FCar | null = null, bestEta = Infinity;
    for (const c of this.cars) { const e = this.eta(c, legs.board); if (e < bestEta) { bestEta = e; best = c; } }
    if (!best) return null;
    if (bestEta > DISPATCH_SECONDS) {
      const moved = this.bringIn(legs.board, bestEta);
      if (moved) { best = moved; bestEta = this.eta(moved, legs.board); }
    }
    this.retry = 1;
    this.riderCar = best.index;
    best.pickup = legs.board;
    best.dropoff = legs.drop;
    this.status = { line: FLINE_ID, car: best.index, phase: 'coming', eta: bestEta, station: null, arrivals: 0, lastStation: null, odometer: 0, turning: false, braking: false };
    if (best.mode === 'dwell' && best.at === legs.board) this.markHere(best);
    return this.status;
  }

  /** Once a second while the rider waits: hand the pickup to a car that now gets there clearly sooner. */
  private reassign() {
    const st = this.status, cur = this.cars[this.riderCar];
    if (!st || !cur || cur.pickup < 0) return;
    const target = cur.pickup;
    let best = cur, bestEta = this.eta(cur, target);
    for (const c of this.cars) {
      if (c === cur || c.rider) continue;
      const e = this.eta(c, target);
      if (e < bestEta - 3) { best = c; bestEta = e; }
    }
    st.eta = bestEta;
    if (best === cur) return;
    best.pickup = cur.pickup; best.dropoff = cur.dropoff;
    cur.pickup = -1; cur.dropoff = -1;
    this.riderCar = best.index;
    st.car = best.index;
    if (best.mode === 'dwell' && best.at === target) this.markHere(best);
  }

  /** Is cycle position u free for a whole car (bumper gaps to every other car, both ways)? */
  private clearAt(u: number, ignore: number): boolean {
    for (const o of this.cars) {
      if (o.index === ignore) continue;
      if (aheadU(this.line, u, o.u) < FL.length + FL.gap + 4 || aheadU(this.line, o.u, u) < FL.length + FL.gap + 4) return false;
    }
    return true;
  }

  /**
   * Bring an unseen car in upstream of the pickup stop (never in view, ≥ 22 u from the player, clear of the other cars,
   * and on the single track only on a free block, which it takes). Returns the moved car.
   */
  private bringIn(target: number, maxEta: number): FCar | null {
    const L = this.line, vis = this.opts.visible ?? (() => false), viewer = this.opts.viewer?.();
    const stopU = L.stops[target].u;
    for (const back of TELEPORT_BACK) {
      const u = wrapU(L, stopU - back);
      const p = cyclePoint(L, u, tmp);
      if (vis(p.x, p.z)) continue;
      if (viewer && Math.hypot(p.x - viewer.x, p.z - viewer.z) < 22) continue;
      // never behind a dwell stop before the pickup (the car would stop there first) for the near placements
      if (back <= 30 && L.stops.some((s, i) => i !== target && s.dwell && aheadU(L, u, s.u) < back - 0.5)) continue;
      for (const c of this.cars) {
        if (c.rider || c.index === this.riderCar && this.status?.phase === 'here') continue;
        if (vis(c.pose.x, c.pose.z) || (viewer && Math.hypot(c.pose.x - viewer.x, c.pose.z - viewer.z) < 60)) continue;
        if (!this.clearAt(u, c.index)) continue;
        // the single track: the block under the placement must be free (the car takes it)
        const probe: FCar = { ...c, u, blocks: [], side: -1, mode: 'run', at: -1 };
        const need = this.placementBlocks(probe);
        if (need === null) continue;
        if (need.some(([k, dir]) => !this.canTake(probe, k, dir, c.index))) continue;
        const eta = aheadU(L, u, stopU) / 9 + 3;
        if (eta >= maxEta - 3 && back > 30) continue;
        c.u = u; c.mode = 'run'; c.at = -1; c.timer = 0; c.blocks = []; c.side = -1; c.still = 0;
        for (const [k, dir] of need) this.take(c, k, dir);
        const toStop = aheadU(L, u, stopU);
        c.v = Math.min(this.limitAt(u), Math.sqrt(2 * FL.dec * Math.max(0, toStop)));
        this.updatePose(c);
        return c;
      }
    }
    return null;
  }

  /** Blocks a car placed at `car.u` must hold ([block, dir] pairs), [] off the single track, null if it cannot stand there. */
  private placementBlocks(car: FCar): [number, 1 | -1][] | null {
    const L = this.line, dir = this.dirAt(car.u);
    const body = this.bodyS(car);
    if (!body || dir === 0) {
      // the loop's last stretch before J2 counts as the approach to block 0: not a placement spot
      if (legAt(L, car.u) === 2 && aheadU(L, car.u, L.legU[2]) < FL.loopHold + FL.half + 1) return null;
      return [];
    }
    if (body[0] >= L.sJoin) return [];
    const out: [number, 1 | -1][] = [];
    for (let k = 0; k < this.nBlocks; k++) {
      const [lo, hi] = this.blockSpan(k);
      if (body[1] > lo && body[0] < hi) out.push([k, dir as 1 | -1]);
    }
    return out.length <= 1 ? out : null;
  }

  /** While the rider still waits long, try again once a second. */
  private redispatch() {
    const st = this.status, cur = this.cars[this.riderCar];
    if (!st || !cur || cur.pickup < 0) return;
    const moved = this.bringIn(cur.pickup, st.eta);
    if (!moved) return;
    if (moved !== cur) { moved.pickup = cur.pickup; moved.dropoff = cur.dropoff; cur.pickup = -1; cur.dropoff = -1; }
    this.riderCar = moved.index;
    st.car = moved.index;
    st.eta = this.eta(moved, moved.pickup);
  }

  private markHere(car: FCar) {
    if (!this.status) return;
    this.status.phase = 'here';
    this.status.station = this.line.stops[car.at]?.station ?? null;
    car.timer = Math.max(car.timer, BOARD_MIN + 1);
  }

  board() {
    const car = this.cars[this.riderCar];
    if (!car || !this.status) return;
    car.rider = true;
    car.pickup = -1;
    car.odometer = 0;
    car.arrivals = 0;
    car.timer = Math.max(car.timer, BOARD_MIN);
    this.status.phase = 'riding';
    this.events.push({ what: 'board', car: car.index, station: this.line.stops[car.at]?.station ?? null });
  }

  cancel() {
    const car = this.cars[this.riderCar];
    if (car) { car.rider = false; car.pickup = -1; car.dropoff = -1; car.braking = false; }
    this.riderCar = -1;
    this.status = null;
  }

  rideStatus(): RideStatus | null { return this.status; }
  /** The car serving the rider (dispatched or carrying), or null. */
  riderCarOf(line: string): FCar | null {
    const c = this.cars[this.riderCar];
    return c && line === FLINE_ID ? c : null;
  }

  // -------------------------------------------------------------------------
  // Step
  // -------------------------------------------------------------------------

  step(dt: number) {
    if (dt <= 0) return;
    this.time += dt;
    for (const car of this.cars) this.stepCar(car, dt);
    for (const car of this.cars) this.updatePose(car);
    this.updateStatus(dt);
  }

  /** Speed limit at u (the vertex limit of its segment). */
  private limitAt(u: number): number {
    const L = this.line, i = cyclePoint(L, u, tmp2).i;
    return Math.min(L.vlim[i], L.vlim[(i + 1) % L.vlim.length]);
  }

  /** The fastest the car may go now so it can still keep every limit ahead (curves) within braking distance. */
  private curveLimit(car: FCar): number {
    const L = this.line, n = L.vlim.length;
    let lim = this.limitAt(car.u);
    const reach = (car.v * car.v) / (2 * FL.dec) + 4;
    let i = (cyclePoint(L, car.u, tmp2).i + 1) % n;
    for (let k = 0; k < 60; k++) {
      const d = aheadU(L, car.u, L.cum[i]);
      if (d > reach) break;
      lim = Math.min(lim, Math.sqrt(L.vlim[i] * L.vlim[i] + 2 * FL.dec * Math.max(0, d - FL.half)));
      i = (i + 1) % n;
    }
    return lim;
  }

  private stepCar(car: FCar, dt: number) {
    const L = this.line;
    const u0 = car.u;
    const stopReq = car.rider ? platformStop(FLINE_ID) : null;
    if (stopReq && !car.braking) car.brakeRate = Math.max(FL.dec, car.v / Math.max(0.05, stopReq.within - stopReq.since));
    car.braking = !!stopReq;
    this.release(car);
    const need = this.nextNeed(car);
    if (car.mode === 'dwell') {
      car.v = 0;
      car.held = 0;
      if (car.timer > HURRY_DWELL && !car.rider && this.riderCar !== car.index && this.opts.hurryDwell?.(car)) car.timer = HURRY_DWELL;
      car.timer -= dt;
      if (car.timer <= 0) this.leave(car, need);
    } else {
      // try for the next block early enough to keep going
      if (need && this.toHold(car, need.hold) < (car.v * car.v) / (2 * FL.dec) + 14 && this.firstInLine(car, need) && this.canTake(car, need.k, need.dir)) this.take(car, need.k, need.dir);
      const need2 = this.nextNeed(car);
      let limit = this.curveLimit(car);
      const next = this.nextStop(car);
      if (next) limit = Math.min(limit, Math.sqrt(2 * FL.dec * Math.max(0, next.d)));
      let holdD = Infinity;
      if (need2) { holdD = this.toHold(car, need2.hold); limit = Math.min(limit, Math.sqrt(2 * FL.dec * holdD)); }
      // the car ahead
      let gap = Infinity;
      for (const o of this.cars) if (o !== car) gap = Math.min(gap, aheadU(L, car.u, o.u) - FL.length - FL.gap);
      limit = Math.min(limit, Math.sqrt(2 * FL.dec * Math.max(0, gap)));
      // a sightseeing bus on the track ahead (wave 4): stop short of it
      const road = this.opts.roadAhead?.(car);
      const roadGap = road !== undefined && road < Infinity ? road - FL.half - 1.5 : Infinity;
      if (roadGap < Infinity) limit = Math.min(limit, Math.sqrt(2 * FL.dec * Math.max(0, roadGap)));
      // someone standing on the track ahead: slow, stop short, ring (verify D3: not someone past the spot the car's nose
      // rests at when it stops at its next stop)
      const viewer = this.opts.viewer?.();
      let held = false;
      if (viewer?.onFoot) {
        const ahead = this.onTrackAhead(car, viewer.x, viewer.z);
        if (ahead !== null && !(next && ahead - next.d >= PERSON_CLEAR)) {
          limit = Math.min(limit, Math.sqrt(2 * FL.dec * Math.max(0, ahead - 2.5)));
          if (ahead < 10 && car.v > 1 && this.time - car.bellAt > 3) { car.bellAt = this.time; this.events.push({ what: 'bell', car: car.index }); }
          held = car.v < 0.3;
        }
      }
      car.held = held ? car.held + dt : 0;
      if (stopReq) car.v = Math.max(0, car.v - car.brakeRate * dt);
      else car.v = car.v < limit ? Math.min(limit, car.v + FL.acc * dt) : Math.max(limit, car.v - FL.dec * 1.8 * dt);
      let step = car.v * dt;
      if (next && step >= next.d) step = next.d;
      if (step > holdD) step = Math.max(0, holdD);
      if (step > gap && gap >= 0) step = Math.max(0, gap);
      if (step > roadGap) step = Math.max(0, roadGap);
      car.u = wrapU(L, car.u + step);
      if (car.rider) car.odometer += step;
      if (next && next.d - step < 0.03 && !stopReq) this.arrive(car, next.index);
    }
    const moved = aheadU(L, u0, car.u);
    car.still = moved > 1e-4 ? 0 : car.still + dt;
  }

  /** Longest a car has stood short of the person on foot (s): game/transit.ts asks them to step aside. */
  viewerHeld(): number {
    let t = 0;
    for (const c of this.cars) if (c.held > t) t = c.held;
    return t;
  }

  /** Arc distance ahead of the car's front to a person standing on its track (within 1.4 u sideways), or null. */
  private onTrackAhead(car: FCar, x: number, z: number): number | null {
    const dx = x - car.pose.x, dz = z - car.pose.z;
    const fx = Math.sin(car.pose.heading), fz = Math.cos(car.pose.heading);
    const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    return along > 0 && along < 16 && side < 1.4 ? along - FL.half : null;
  }

  private arrive(car: FCar, index: number) {
    const st = this.line.stops[index];
    car.u = st.u;
    car.v = 0;
    car.mode = 'dwell';
    car.at = index;
    car.timer = st.wait;
    if (car.rider) car.arrivals++;
    this.events.push({ what: 'arrive', car: car.index, station: st.station });
    const status = this.status;
    if (status && this.riderCar === car.index) {
      if (!car.rider && car.pickup === index) this.markHere(car);
      if (car.rider) {
        status.lastStation = st.station;
        status.arrivals = car.arrivals;
        if (car.dropoff === index) { status.phase = 'arrived'; car.timer = Math.max(car.timer, 3); }
      }
    }
  }

  /** Dwell over: go on if the block ahead (when one is close) can be taken. */
  private leave(car: FCar, need: { k: number; dir: 1 | -1; hold: number } | null) {
    if (this.status && this.riderCar === car.index && this.status.phase === 'here') { car.timer = 0.3; return; }
    if (car.rider && platformStop(FLINE_ID)) { car.timer = 0.3; return; }
    if (need && this.toHold(car, need.hold) < 16) {
      if (!this.firstInLine(car, need) || !this.canTake(car, need.k, need.dir)) { car.timer = 0.25; return; }
      this.take(car, need.k, need.dir);
    }
    car.mode = 'run';
    car.at = -1;
    car.u = wrapU(this.line, car.u + 0.05);
    this.events.push({ what: 'depart', car: car.index });
  }

  /** Recompute a car's pose: the body between its bogies, pitch = grade, a little sway. */
  updatePose(car: FCar) {
    const L = this.line, pose = car.pose, g = this.opts.groundY;
    const f = cyclePoint(L, car.u + FL.bogie, tmp), fx = f.x, fz = f.z, fy = (g?.(f.x, f.z) ?? f.y);
    const r = cyclePoint(L, car.u - FL.bogie, tmp2), rx = r.x, rz = r.z, ry = (g?.(r.x, r.z) ?? r.y);
    const base = Math.hypot(fx - rx, fz - rz) || 1;
    pose.x = (fx + rx) / 2;
    pose.z = (fz + rz) / 2;
    pose.y = (fy + ry) / 2 + FL.carY;
    pose.heading = Math.atan2(fx - rx, fz - rz);
    pose.pitch = Math.atan2(fy - ry, base);
    pose.roll = car.v > 0.5 ? Math.sin(this.time * 7 + car.index) * 0.006 * Math.min(1, car.v / 5) : 0;
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
    st.braking = car.braking;
    st.odometer = car.odometer;
    st.station = car.v < 0.02 && car.mode === 'dwell' ? this.line.stops[car.at]?.station ?? null : null;
    if (st.phase === 'coming' && car.pickup >= 0) st.eta = this.eta(car, car.pickup);
  }

  /** Test helper: pairs of cars overlapping on the single track (or bumping on the cycle). */
  violations(): string[] {
    const out: string[] = [];
    const L = this.line;
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const a = this.cars[i], b = this.cars[j];
      const d = Math.min(aheadU(L, a.u, b.u), aheadU(L, b.u, a.u));
      if (d < FL.length - 0.05) out.push(`bump #${a.index} u${a.u.toFixed(1)} #${b.index} u${b.u.toFixed(1)}`);
      const da = this.dirAt(a.u), db = this.dirAt(b.u);
      if (da && db && da !== db) {
        const ba = this.bodyS(a), bb = this.bodyS(b);
        if (!ba || !bb || ba[1] <= bb[0] || bb[1] <= ba[0]) continue;
        // overlapping in s: fine only side by side at a passing place (both bodies inside its open zone) or on the
        // double track
        const lo = Math.max(ba[0], bb[0]), hi = Math.min(ba[1], bb[1]);
        if (lo >= L.sJoin - 0.5) continue;
        const inZone = L.bounds.slice(1, -1).some(p => lo >= p - FL.passHalf - 0.3 && hi <= p + FL.passHalf + 0.3);
        if (!inZone) out.push(`head-on #${a.index} s${ba[0].toFixed(1)}–${ba[1].toFixed(1)} #${b.index} s${bb[0].toFixed(1)}–${bb[1].toFixed(1)}`);
      }
    }
    return out;
  }
}
