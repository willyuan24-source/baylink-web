import { game } from '../core/store';
import { activeLineFleet } from '../data/transit';
import type { Bus, BusWhy } from '../world/busSystem';

/**
 * Wave 5 · lane T (W5-T2, plan MF2 "instrument the loop buses: position, speed, reason when stopped"): the sightseeing
 * buses watched 4 Hz (game/lineRides.ts pollCity, the lazy line chunk; nothing here is in GameRoot's graph). Every bus
 * says why it goes slower than its profile (world/busSystem.ts `Bus.why` / `whyOf`); a bus that stands still for
 * STALL_LOG_AFTER s other than at its own stop is a stall: logged here (the last 40, with where, why and for how long;
 * DEV: a console warning past STALL_WARN s), for QA (`window.__opusBay.transit.busWatch()`) and the tests.
 *
 * The fixes that made the loop's two known stalls go (Mason St in the Marina, Lincoln Blvd in the Presidio: a toy car
 * waiting at its stop line for the bus behind it, and for the rider on the deck) live in world/sf/traffic.ts and
 * world/sf/cityLife.ts; the waiting rider's cap in world/busSystem.ts (dispatch farther back, relaxed after 12 s).
 */

/** a bus standing this long (s) other than at its stop (dwell / boarding) is a stall */
export const STALL_LOG_AFTER = 6;
/** DEV: a stall this long (s) is reported on the console */
export const STALL_WARN = 12;
const KEEP = 40;
/** reasons that are the bus doing its job, not a stall */
const AT_STOP: ReadonlySet<BusWhy> = new Set<BusWhy>(['dwell', 'board', 'stop']);

export interface BusStall {
  bus: number;
  /** the rider was aboard / waiting for this bus */
  rider: boolean;
  x: number;
  z: number;
  /** arc along the loop (u) */
  s: number;
  why: BusWhy;
  of: string;
  /** watch clock (s) when it started, and how long it lasted (still running: so far) */
  since: number;
  seconds: number;
  /** the stop the bus heads for */
  next: string | null;
  open: boolean;
}

export interface BusNow { bus: number; x: number; z: number; s: number; v: number; mode: string; why: BusWhy; of: string; still: number; next: string | null; rider: boolean }

let clock = 0;
const log: BusStall[] = [];
/** per bus: the open stall (or null) and how long it has stood still (s, not at its stop) */
const open = new Map<number, { stood: number; stall: BusStall | null }>();

function nextStop(b: Bus, stops: readonly { id: string }[]): string | null { return stops[b.next]?.id ?? null; }

/** 4 Hz (dt = the poll's step): look at every bus once. */
export function watchBuses(dt: number, fleet = activeLineFleet()) {
  clock += dt;
  if (!fleet) return;
  const sys = fleet.bus, stops = sys.track.stops;
  const riderCar = sys.rideStatus()?.car ?? -1;
  // W6-K2: Settings open (the game's pause) stands the rider's bus on purpose (game/transit holdRideForPause): no stall
  const paused = game.get().paused;
  for (const b of sys.buses) {
    let o = open.get(b.index);
    if (!o) { o = { stood: 0, stall: null }; open.set(b.index, o); }
    const standing = b.v < 0.3 && !AT_STOP.has(b.why) && !(paused && b.index === riderCar);
    o.stood = standing ? o.stood + dt : 0;
    if (standing && o.stood >= STALL_LOG_AFTER) {
      if (!o.stall) {
        o.stall = { bus: b.index, rider: b.index === riderCar, x: +b.pose.x.toFixed(1), z: +b.pose.z.toFixed(1), s: +b.s.toFixed(1), why: b.why, of: b.whyOf, since: +(clock - o.stood).toFixed(2), seconds: 0, next: nextStop(b, stops), open: true };
        log.push(o.stall);
        if (log.length > KEEP) log.splice(0, log.length - KEEP);
      }
      const st = o.stall;
      st.seconds = +o.stood.toFixed(2);
      if (b.why !== 'run') { st.why = b.why; st.of = b.whyOf; }
      if (import.meta.env?.DEV && st.seconds >= STALL_WARN && st.seconds - dt < STALL_WARN) {
        console.warn(`[opus-bay bus] bus#${st.bus}${st.rider ? ' (the rider’s)' : ''} held ${STALL_WARN} s by ${st.why}${st.of ? `:${st.of}` : ''} at (${st.x}, ${st.z}), s ${st.s}`);
      }
    } else if (!standing && o.stall) {
      o.stall.open = false;
      o.stall = null;
    }
  }
}

/** Every bus now: where, how fast, why (QA). */
export function busWatchNow(fleet = activeLineFleet()): BusNow[] {
  if (!fleet) return [];
  const sys = fleet.bus, stops = sys.track.stops, riderCar = sys.rideStatus()?.car ?? -1;
  return sys.buses.map(b => ({
    bus: b.index, x: +b.pose.x.toFixed(1), z: +b.pose.z.toFixed(1), s: +b.s.toFixed(1), v: +b.v.toFixed(2), mode: b.mode, why: b.why, of: b.whyOf,
    still: +(open.get(b.index)?.stood ?? 0).toFixed(1), next: nextStop(b, stops), rider: b.index === riderCar,
  }));
}

/** The stalls logged (newest last; at most 40). */
export function busStalls(): readonly BusStall[] { return log; }

/** Tests / QA: start a new log. */
export function resetBusWatch() { log.length = 0; open.clear(); clock = 0; }
