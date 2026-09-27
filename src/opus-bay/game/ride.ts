import { runtime } from '../core/runtime';
import type { TransitKind } from '../core/events';
import type { Vec2 } from '../core/types';
import { platformStop, riderWorld } from '../actors/platform';
import { DISTRICT } from '../data/district';
import { RIDE_MIN_ODOMETER, activeCableSystem } from '../data/transit';

/**
 * Streetcar ride. Prefers the world's streetcar (runtime.streetcar): wait for it at the stop, ride along
 * while it moves, get off at the next stop. If the world car is not moving (not built yet / paused),
 * a "virtual" ride glides along the track so the feature still works.
 * While riding, the newcomer is INSIDE the car: the 'streetcar' moving platform (actors/platform.ts) carries the
 * rider's spot (rail / seat / aisle), and the player position is that spot in world space (riderWorld()).
 */

export type RideMode = 'wait' | 'follow' | 'virtual';
export interface RideState {
  from: string;
  to: string;
  fromT: number;
  toT: number;
  mode: RideMode;
  elapsed: number;
  duration: number;
  carT0: number;
  leftStop: boolean;
  // --- city lines (lane F, wave 2): absent on the hero F-line ride
  /** transit line id (= move.line = the platform id) */
  line?: string;
  kind?: TransitKind;
  /** direction along the line's path */
  dir?: 1 | -1;
  /** game/fastTravel travelEpoch() at boarding: a trip in between voids the count */
  epoch?: number;
  /** the ride already counted (a real stop-to-stop segment of ≥ RIDE_MIN_ODOMETER) */
  counted?: boolean;
  /** stops the car had made when last looked at */
  seenArrivals?: number;
  /** the rider is aboard (the car stopped at the pickup station and they stepped on) */
  boarded?: boolean;
}

export function pathLength(path: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return total;
}

/** Point + heading at parameter t (0..1 by arc length). */
export function pointOnPath(path: Vec2[], t: number): { x: number; z: number; heading: number } {
  if (path.length === 0) return { x: 0, z: 0, heading: 0 };
  if (path.length === 1) return { x: path[0].x, z: path[0].z, heading: 0 };
  const total = pathLength(path);
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining <= seg || i === path.length - 1) {
      const k = seg > 0 ? Math.min(1, remaining / seg) : 0;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, heading: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    remaining -= seg;
  }
  const last = path[path.length - 1];
  return { x: last.x, z: last.z, heading: 0 };
}

export function sortedStops() {
  return [...(DISTRICT.streetcar?.stops ?? [])].sort((a, b) => a.at - b.at);
}

/** The stop the ride ends at: the neighbouring stop (towards the lower `at` end first). */
export function nextStopId(fromId: string): string | null {
  const stops = sortedStops();
  const index = stops.findIndex(stop => stop.id === fromId);
  if (index < 0 || stops.length < 2) return null;
  return (index > 0 ? stops[index - 1] : stops[index + 1]).id;
}

export function nearestStopId(p: Vec2): string | null {
  let best: string | null = null, bestD = Infinity;
  for (const stop of DISTRICT.streetcar?.stops ?? []) {
    const at = DISTRICT.anchors?.[`streetcar-${stop.id}`] ?? pointOnPath(DISTRICT.streetcar.path, stop.at);
    const d = Math.hypot(at.x - p.x, at.z - p.z);
    if (d < bestD) { bestD = d; best = stop.id; }
  }
  return best;
}

/** Longest wait at a stop before the ride starts anyway (F17: ≤ 5 s). */
export const MAX_WAIT = 5;

let ride: RideState | null = null;
export const currentRide = () => ride;

/** Seconds a (virtual) ride between two stops takes. */
export function rideSeconds(from: string, to: string): number {
  const stops = sortedStops();
  const a = stops.find(stop => stop.id === from), b = stops.find(stop => stop.id === to);
  if (!a || !b) return 0;
  return Math.min(26, Math.max(5, (pathLength(DISTRICT.streetcar.path) * Math.abs(b.at - a.at)) / 13));
}

export function beginRide(from: string, target?: string): RideState | null {
  const to = target ?? nextStopId(from);
  const stops = sortedStops();
  const a = stops.find(stop => stop.id === from), b = stops.find(stop => stop.id === to);
  if (!a || !b || !to) return null;
  const length = pathLength(DISTRICT.streetcar.path) * Math.abs(b.at - a.at);
  ride = {
    from, to, fromT: a.at, toT: b.at,
    mode: runtime.streetcar.atStop === from ? 'follow' : 'wait',
    elapsed: 0,
    duration: Math.min(26, Math.max(5, length / 13)),
    carT0: runtime.streetcar.t,
    leftStop: false,
  };
  return ride;
}

export function endRide() { ride = null; }

export type RideTick = {
  done: boolean;
  stage: 'waiting' | 'riding' | 'braking' | 'turning';
  eta?: number;
  /** city lines: the rider just stepped aboard */
  boarded?: boolean;
  /** city lines: the car just stopped at this station (while carrying the rider) */
  arrivedAt?: string | null;
  /** city lines: this stop completes a real stop-to-stop segment (count the ride once) */
  count?: boolean;
  /** city lines: the car serving the ride is gone (layer disposed): end the ride */
  lost?: boolean;
};

/**
 * City cable-car ride (lane F): ask the running cable-car system (world/transitLine.ts, driven by world/transitLayer.ts)
 * for a car to `station` heading `dir` toward `to`. Null when no system runs (district mode, data not loaded).
 */
export function beginLineRide(line: string, from: string, to: string, dir: 1 | -1, epoch: number): RideState | null {
  const sys = activeCableSystem();
  if (!sys) return null;
  const st = sys.request({ line, station: from, dir, to });
  if (!st) return null;
  ride = { from, to, fromT: 0, toT: 0, mode: 'wait', elapsed: 0, duration: 0, carT0: 0, leftStop: false, line, kind: 'cable-car', dir, epoch, counted: false, seenArrivals: 0, boarded: false };
  return ride;
}

/** The pickup ETA of a waiting line ride (s), or null. */
export function lineRideEta(): number | null {
  const st = ride?.line ? activeCableSystem()?.rideStatus() : null;
  return st && st.phase === 'coming' ? st.eta : null;
}

/** Is the car coming for the waiting rider turning on a turntable right now? */
export function lineRideTurning(): boolean {
  return !!(ride?.line && activeCableSystem()?.rideStatus()?.turning);
}

function stepLineRide(r: RideState, dt: number, travelEpochNow: number): RideTick {
  const sys = activeCableSystem();
  const st = sys?.rideStatus();
  if (!sys || !st || st.line !== r.line) return { done: false, stage: r.mode === 'wait' ? 'waiting' : 'riding', lost: true };
  if (r.mode === 'wait') {
    if (st.phase !== 'here') return { done: false, stage: 'waiting', eta: Math.max(1, Math.round(st.eta)) };
    r.mode = 'follow';
    r.elapsed = 0;
    r.boarded = true;
    sys.board();
    return { done: false, stage: 'riding', boarded: true };
  }
  // aboard: the rider stands / sits on the car's platform (actors/moveSystem places them; mirror it here)
  const at = riderWorld();
  const car = sys.cars[st.car];
  runtime.player.x = at ? at.x : car.pose.x;
  runtime.player.z = at ? at.z : car.pose.z;
  runtime.player.heading = at ? at.heading : car.pose.heading;
  const tick: RideTick = { done: st.phase === 'arrived', stage: platformStop(r.line!) || st.braking ? 'braking' : st.turning ? 'turning' : 'riding' };
  if (st.arrivals > (r.seenArrivals ?? 0)) {
    r.seenArrivals = st.arrivals;
    tick.arrivedAt = st.lastStation;
    // a real stop-to-stop segment: another station, far enough along, no fast travel since boarding
    if (!r.counted && st.lastStation && st.lastStation !== r.from && st.odometer >= RIDE_MIN_ODOMETER && travelEpochNow === r.epoch) {
      r.counted = true;
      tick.count = true;
    }
  }
  void dt;
  return tick;
}

/** Where a virtual ride is along DISTRICT.streetcar.path (0..1, eased in and out) — the world carries a car here. */
export function virtualT(r: RideState): number {
  const k = Math.min(1, r.elapsed / r.duration);
  const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  return r.fromT + (r.toT - r.fromT) * eased;
}

/** Advance the ride; writes the player position while riding. `travelEpochNow` (city lines): G1's travelEpoch(). */
export function stepRide(dt: number, travelEpochNow = 0): RideTick | null {
  const r = ride;
  if (!r) return null;
  r.elapsed += dt;
  if (r.line) return stepLineRide(r, dt, travelEpochNow);
  const car = runtime.streetcar;
  if (r.mode === 'wait') {
    if (car.atStop === r.from) { r.mode = 'follow'; r.elapsed = 0; return { done: false, stage: 'riding' }; }
    // The world car is not moving, or not here within 5 s: a car "comes" for you (virtual ride) — never a long wait.
    if ((r.elapsed > 1.5 && Math.abs(car.t - r.carT0) < 1e-4) || r.elapsed > MAX_WAIT) { r.mode = 'virtual'; r.elapsed = 0; }
    const eta = Math.max(1, Math.round(MAX_WAIT - r.elapsed));
    return { done: false, stage: 'waiting', eta };
  }
  if (r.mode === 'follow') {
    if (car.atStop !== r.from) r.leftStop = true;
    const at = riderWorld();
    runtime.player.x = at ? at.x : car.x;
    runtime.player.z = at ? at.z : car.z;
    runtime.player.heading = at ? at.heading : car.heading;
    if ((r.leftStop && car.atStop === r.to) || r.elapsed > 60) return { done: true, stage: 'riding' };
    return { done: false, stage: 'riding' };
  }
  const k = Math.min(1, r.elapsed / r.duration);
  const p = pointOnPath(DISTRICT.streetcar.path, virtualT(r));
  // (the world carries a car here and publishes it as the platform; without a world, ride the track itself)
  const at = riderWorld();
  runtime.player.x = at ? at.x : p.x;
  runtime.player.z = at ? at.z : p.z;
  runtime.player.heading = at ? at.heading : r.toT < r.fromT ? p.heading + Math.PI : p.heading;
  return { done: k >= 1, stage: 'riding' };
}
