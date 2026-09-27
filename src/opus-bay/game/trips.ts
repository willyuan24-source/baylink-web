import type { GameEvent } from '../core/events';
import type { Bilingual } from '../core/types';
import { STREET_FACTOR, TRIP_SPEED, tripRemainingSeconds } from './tripPlan';
import type { TripLeg, TripOption, TripSource, TripState, TripWalkLeg } from './tripTypes';

/**
 * Wave 4 · lane C · W4-C1 (early part): the trip state machine on the FROZEN TripState (game/tripTypes.ts), pure.
 * Until `flow.trip` lands on game/flowStore.ts (lead, integration item 1), `createTripStore()` keeps a module-free store
 * with the same API; at integration the flow keeps `flow.trip` and calls `tripReducer` + `tripEvents` itself.
 *
 *   start       a new trip to a place with the option the player picked (TripOptions / 跟 BAYBAY 去 / a tour leg)
 *   leg-arrived the current leg's end was reached (walk: BAYBAY's lead arrived; drive: parked; line: got off)
 *   skip-leg    跳过这一站 on the trip card (the next leg starts from wherever the player is)
 *   replan      换个方式: same destination, a new option (lane G's planTrips from here)
 *   cancel      结束 / another trip replaced it / a tour took over
 *   clear       drop an arrived trip after its arrival moment (no event)
 *
 * Events (core/events.ts `trip`): `start` (leg 0), `leg` (the 0-based leg that just started), `end` (arrived),
 * `cancel`. objectiveTarget priority (plan §4.2): freeLead > trip leg > tour > week > mapTarget > freeHint —
 * `pickObjective`; a free lead is a one-leg walking trip (`freeLeadTrip`, source 'free-lead').
 *
 * Light on purpose: game/flow.ts (the main graph) imports it, so it imports no tour data (a Grand Tour stop as a trip
 * option is game/tourTrips.ts, lazy with data/sf/tours) and reuses lane G's numbers (game/tripPlan.ts: speeds, the
 * remaining time); the pill is lane G's ui/guideText.ts tripPillText, the time words the shared game/tripText.ts
 * (one rule for lanes C, G and P), where a trip to an attraction ends and its name lane P's data/sf/attractions.ts
 * `tripDestination(a)` (an island's trip ends at its pier: 恶魔岛渡轮码头 · 33 号码头).
 */

type XZ = { x: number; z: number };

export type TripAction =
  | { type: 'start'; placeId: string; attraction?: string; option: TripOption; now: number; source?: TripSource }
  | { type: 'leg-arrived' }
  | { type: 'skip-leg' }
  | { type: 'replan'; option: TripOption }
  | { type: 'cancel' }
  | { type: 'clear' };

export type TripEvent = Extract<GameEvent, { type: 'trip' }>;

/** The walking speed BAYBAY leads at and the straight-line → street factor (lane G's planner: one set of numbers). */
export const TRIP_WALK_SPEED = TRIP_SPEED.walk;
export const TRIP_STREET_FACTOR = STREET_FACTOR;

export const isArrived = (trip: TripState | null): boolean => !!trip && trip.leg >= trip.legs.length;
export const currentLeg = (trip: TripState | null): TripLeg | null => (trip && trip.leg < trip.legs.length ? trip.legs[trip.leg] : null);

/** The next state (pure; the same object back when nothing changes). */
export function tripReducer(state: TripState | null, action: TripAction): TripState | null {
  switch (action.type) {
    case 'start':
      if (!action.option.legs.length) return state;
      return {
        placeId: action.placeId,
        ...(action.attraction ? { attraction: action.attraction } : {}),
        option: action.option,
        legs: action.option.legs,
        leg: 0,
        startedAt: action.now,
        ...(action.source ? { source: action.source } : {}),
      };
    case 'leg-arrived':
    case 'skip-leg':
      if (!state || isArrived(state)) return state;
      return { ...state, leg: state.leg + 1 };
    case 'replan':
      if (!state || !action.option.legs.length) return state;
      return { ...state, option: action.option, legs: action.option.legs, leg: 0 };
    case 'cancel':
    case 'clear':
      return state ? null : state;
  }
}

/** The `trip` events a transition emits (pure; emit them in order). */
export function tripEvents(prev: TripState | null, next: TripState | null, action: TripAction): TripEvent[] {
  if (prev === next) return [];
  const ev = (what: TripEvent['what'], t: TripState, leg?: number): TripEvent => ({ type: 'trip', what, place: t.placeId, mode: t.option.mode, ...(leg !== undefined ? { leg } : {}) });
  switch (action.type) {
    case 'start':
    case 'replan': {
      const out: TripEvent[] = [];
      if (action.type === 'start' && prev && !isArrived(prev)) out.push(ev('cancel', prev));
      if (next) out.push(ev('start', next, 0));
      return out;
    }
    case 'leg-arrived':
    case 'skip-leg':
      if (!next) return [];
      return isArrived(next) ? [ev('end', next)] : [ev('leg', next, next.leg)];
    case 'cancel':
      return prev && !isArrived(prev) ? [ev('cancel', prev)] : [];
    case 'clear':
      return [];
  }
}

/**
 * Where BAYBAY leads for the current leg: before boarding / mounting the leg's start, then its end (null: arrived).
 * The point keeps its station / place / name, so objectiveTarget() can label the waypoint.
 */
export function legTarget(leg: TripLeg | null, stage: 'approach' | 'underway' = 'approach'): (XZ & { station?: string; place?: string; name?: Bilingual }) | null {
  if (!leg) return null;
  const p = (leg.via === 'line' || leg.via === 'bike' || leg.via === 'car') && stage === 'approach' ? leg.from : leg.to;
  return { x: p.x, z: p.z, ...(p.station ? { station: p.station } : {}), ...(p.place ? { place: p.place } : {}), ...(p.name ? { name: p.name } : {}) };
}

/** Seconds left: the unfinished part of the current leg (`progress` 0–1) plus the legs after it (lane G's rule). */
export function tripRemaining(trip: TripState | null, progress = 0): number {
  if (!trip || isArrived(trip)) return 0;
  const p = Math.max(0, Math.min(1, progress));
  return tripRemainingSeconds(trip, trip.legs[trip.leg].seconds * (1 - p));
}

/** A straight-line walking estimate (× 1.25) until the A* answers ("计算中…"). */
export function walkLeg(from: XZ & { place?: string; station?: string }, to: XZ & { place?: string; station?: string; name?: Bilingual }): TripWalkLeg {
  const length = Math.hypot(to.x - from.x, to.z - from.z) * TRIP_STREET_FACTOR;
  return {
    via: 'walk', from: { x: from.x, z: from.z, ...(from.place ? { place: from.place } : {}), ...(from.station ? { station: from.station } : {}) },
    to: { x: to.x, z: to.z, ...(to.place ? { place: to.place } : {}), ...(to.station ? { station: to.station } : {}), ...(to.name ? { name: to.name } : {}) },
    seconds: length / TRIP_WALK_SPEED, length, estimate: true,
  };
}

/** startFreeLead as a trip: one walking leg (source 'free-lead'). */
export function freeLeadTrip(from: XZ, to: XZ & { place: string; name?: Bilingual }, now: number): TripState {
  const leg = walkLeg(from, to);
  const option: TripOption = { mode: 'walk', legs: [leg], seconds: leg.seconds };
  return tripReducer(null, { type: 'start', placeId: to.place, option, now, source: 'free-lead' })!;
}

// ---------------------------------------------------------------------------------------------------------------
// objectiveTarget priority (plan §4.2)
// ---------------------------------------------------------------------------------------------------------------

export const OBJECTIVE_ORDER = ['freeLead', 'trip', 'tour', 'week', 'mapTarget', 'freeHint'] as const;
export type ObjectiveSource = (typeof OBJECTIVE_ORDER)[number];

/** Which objective the waypoint / BAYBAY follow: the first present in freeLead > trip > tour > week > mapTarget > freeHint. */
export function pickObjective(present: Partial<Record<ObjectiveSource, unknown>>): ObjectiveSource | null {
  for (const k of OBJECTIVE_ORDER) if (present[k] !== undefined && present[k] !== null && present[k] !== false) return k;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// A tiny store until flow.trip lands (integration item 1)
// ---------------------------------------------------------------------------------------------------------------

export interface TripStore {
  get(): TripState | null;
  /** apply an action; returns the events to emit (in order) */
  dispatch(action: TripAction): TripEvent[];
  subscribe(listener: () => void): () => void;
}

export function createTripStore(initial: TripState | null = null): TripStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    dispatch(action) {
      const next = tripReducer(state, action);
      const events = tripEvents(state, next, action);
      if (next !== state) { state = next; listeners.forEach(l => l()); }
      return events;
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
