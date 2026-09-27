import type { GameEvent } from '../core/events';
import type { Bilingual } from '../core/types';
import { rideArc, rideSeconds, targetAt, TOUR_GEO, TOUR_MODEL, type CityTourStop, type XZ } from '../data/sf/tours';
import type { TripLeg, TripLineLeg, TripMode, TripOption, TripSource, TripState, TripWalkLeg } from './tripTypes';

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
 */

export type TripAction =
  | { type: 'start'; placeId: string; attraction?: string; option: TripOption; now: number; source?: TripSource }
  | { type: 'leg-arrived' }
  | { type: 'skip-leg' }
  | { type: 'replan'; option: TripOption }
  | { type: 'cancel' }
  | { type: 'clear' };

export type TripEvent = Extract<GameEvent, { type: 'trip' }>;

/** The walking speed BAYBAY leads at (actors/controller.ts WALK_SPEED) and the straight-line → street factor. */
export const TRIP_WALK_SPEED = 4.2;
export const TRIP_STREET_FACTOR = 1.25;

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

/** Where BAYBAY leads for the current leg: before boarding / mounting the leg's start, then its end (null: arrived). */
export function legTarget(leg: TripLeg | null, stage: 'approach' | 'underway' = 'approach'): (XZ & { station?: string; place?: string }) | null {
  if (!leg) return null;
  if ((leg.via === 'line' || leg.via === 'bike' || leg.via === 'car') && stage === 'approach') return { x: leg.from.x, z: leg.from.z, ...(leg.from.station ? { station: leg.from.station } : {}) };
  return { x: leg.to.x, z: leg.to.z, ...(leg.to.station ? { station: leg.to.station } : {}), ...(leg.to.place ? { place: leg.to.place } : {}) };
}

/** Seconds left: the unfinished part of the current leg (`progress` 0–1) plus the legs after it. */
export function tripRemaining(trip: TripState | null, progress = 0): number {
  if (!trip || isArrived(trip)) return 0;
  const p = Math.max(0, Math.min(1, progress));
  return trip.legs.slice(trip.leg).reduce((sum, leg, i) => sum + (i === 0 ? leg.seconds * (1 - p) : leg.seconds), 0);
}

/** "约 3 分钟" / "约 40 秒" / "不到 10 秒" — the honest time the pill, the card and the ETA chip show. */
export function durationText(seconds: number): Bilingual {
  if (!Number.isFinite(seconds) || seconds < 10) return { zh: '不到 10 秒', en: 'under 10 s' };
  if (seconds < 55) { const s = Math.round(seconds / 5) * 5; return { zh: `约 ${s} 秒`, en: `about ${s} s` }; }
  const m = Math.max(1, Math.round(seconds / 60));
  return { zh: `约 ${m} 分钟`, en: `about ${m} min` };
}

const clip = (text: string, max: number) => ([...text].length <= max ? text : `${[...text].slice(0, Math.max(1, max - 1)).join('')}…`);

/**
 * The trip pill's text: "下一站 名称 · 约 N 分钟" (plan §4.2). `name` = the next stop's or the destination's name;
 * the zh name is clipped so the whole pill stays ≤ `maxZh` characters (16 on phones).
 */
export function tripPillText(trip: TripState | null, name: Bilingual, progress = 0, maxZh = 16): { mode: TripMode; text: Bilingual } | null {
  if (!trip || isArrived(trip)) return null;
  const t = durationText(tripRemaining(trip, progress));
  const room = Math.max(2, maxZh - [...`下一站  · ${t.zh}`].length);
  return { mode: trip.option.mode, text: { zh: `下一站 ${clip(name.zh, room)} · ${t.zh}`, en: `Next: ${name.en} · ${t.en}` } };
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

/**
 * A Grand Tour stop as a trip option (so the trip pill, the map route and BAYBAY's lead treat tour legs like any
 * trip): a walk, or walk → wait → ride on the stop's line (TOUR_GEO, the tour's timing model). `prev` = where the
 * previous stop ended. Null when the stop's target is unknown.
 */
export function tourStopOption(stop: CityTourStop, prev: XZ): TripOption | null {
  const end = targetAt(stop.target);
  if (!end) return null;
  const place = stop.target.startsWith('place:') ? stop.target.slice(6) : stop.target.startsWith('sf:') ? stop.target : undefined;
  if (stop.leg.via === 'walk') {
    const leg = walkLeg(prev, { ...end, ...(place ? { place } : {}) });
    return { mode: 'walk', legs: [leg], seconds: leg.seconds };
  }
  const { line, from, to } = stop.leg;
  const geo = TOUR_GEO[line];
  const board = geo?.stations[from], alight = geo?.stations[to], r = rideArc(line, from, to);
  if (!geo || !board || !alight || !r) return null;
  const legs: TripLeg[] = [];
  if (Math.hypot(board.x - prev.x, board.z - prev.z) > 4) legs.push(walkLeg(prev, { x: board.x, z: board.z, station: from }));
  const wait = geo.kind === 'bus' ? TOUR_MODEL.bus.wait : geo.kind === 'cable-car' ? TOUR_MODEL.cable.wait : TOUR_MODEL.rail.wait;
  const underground = (geo.tunnels ?? []).some(([a, b]) => Math.min(r.b, b) > Math.max(r.a, a));
  // stops passed after boarding, the alighting one included (TOUR_GEO lists the major stations; lane T's line data
  // gives the full count at integration)
  const stops = Object.entries(geo.stations).filter(([id, s]) => {
    if (id === from) return false;
    if (geo.loop) { const d = ((s.at - board.at) % geo.length + geo.length) % geo.length; return d > 0 && d <= r.arc; }
    return s.at >= r.a && s.at <= r.b;
  }).length;
  const ride: TripLineLeg = {
    via: 'line', line, board: from, alight: to, wait, stops,
    dir: r.dir, ...(underground ? { underground: true } : {}),
    from: { x: board.x, z: board.z, station: from }, to: { x: alight.x, z: alight.z, station: to },
    seconds: wait + rideSeconds(line, from, to), length: r.arc,
  };
  legs.push(ride);
  const seconds = legs.reduce((s, l) => s + l.seconds, 0);
  return { mode: 'line', legs, seconds };
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
