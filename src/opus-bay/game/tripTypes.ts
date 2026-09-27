import type { Bilingual } from '../core/types';

/**
 * Wave 4 · trip types (FROZEN, day 0: docs/opus-bay/sf-w4-lead.md §4, plan sf-w4-plan.md §4.2). Dependency-free
 * (types + two constants). Who fills what:
 * - lane G `game/tripPlan.ts`: `planTrips(from, place) → TripOption[]` (honest times, sorted, up to 4, 推荐 flag);
 * - lane C `flow.trip: TripState | null` (the field lands on game/flowStore.ts in the integration phase), `startTrip`,
 *   the per-leg lead, the `trip` event (core/events.ts);
 * - lane P draws `legs` on the map (walk dashed gold, ride legs in the line colour) and lists options (TripOptions.tsx);
 * - lane T answers line legs (board / alight stations, wait, ride seconds) and boards pre-filled from a line leg.
 * All positions are in the world city frame (x, z in u, as `projectCity`); all times are seconds of real play time.
 */

/**
 * How a whole trip goes (the option the player picks): on foot, running, by bike, by car, on a line, flying.
 * The list order is the tie-break order of TripOptions rows.
 */
export const TRIP_MODES = ['walk', 'run', 'bike', 'car', 'line', 'fly'] as const;
export type TripMode = (typeof TRIP_MODES)[number];
/** Short mode names for option rows, the trip pill and the trip card (P, G and C show the same words). */
export const TRIP_MODE_NAMES: Readonly<Record<TripMode, Bilingual>> = {
  walk: { zh: '步行', en: 'Walk' },
  run: { zh: '跑过去', en: 'Run' },
  bike: { zh: '骑车', en: 'Bike' },
  car: { zh: '开车', en: 'Drive' },
  line: { zh: '坐车', en: 'Ride' },
  fly: { zh: '飞过去', en: 'Fly' },
};

/** One end of a leg. `place` / `station` name what stands there (a place-index id / a TransitStop id), when anything. */
export interface TripPoint {
  x: number;
  z: number;
  place?: string;
  station?: string;
  /** a parked vehicle id (data/vehicles.ts) the leg starts or ends at */
  vehicle?: string;
  name?: Bilingual;
}

export interface TripLegBase {
  from: TripPoint;
  to: TripPoint;
  /** honest estimate for this leg alone (s), waits and mounting included */
  seconds: number;
  /** route length (u): walking-graph / drive-graph / line arc length; straight line × 1.25 while no route is known */
  length: number;
  /** the route for the map and the ground chevrons, flat [x0, z0, x1, z1, …] in the city frame (absent: not computed) */
  path?: number[];
  /** true while the length / seconds are the straight × 1.25 estimate (the time-sliced A* has not answered: 计算中…) */
  estimate?: boolean;
  /** one-line label for the trip card ("步行到 9th & Irving"); the planner may leave it to the UI */
  label?: Bilingual;
}
/** Walking (4.2 u/s) or running (7.5 u/s) — BAYBAY leads on foot. */
export interface TripWalkLeg extends TripLegBase { via: 'walk' | 'run' }
/** Riding a bike or driving the toy car along the drive graph (moveApi.driveTo); `vehicle` = parked vehicle id. */
export interface TripDriveLeg extends TripLegBase { via: 'bike' | 'car'; vehicle: string }
/** A transit ride: board at `board`, get off at `alight` (TransitStop ids on `line`, the TransitLine id). */
export interface TripLineLeg extends TripLegBase {
  via: 'line';
  line: string;
  board: string;
  alight: string;
  /** expected wait at the boarding stop (s; the system's ETA, dispatch caps it near 15 s); included in `seconds` */
  wait: number;
  /** stops passed after boarding, the alighting stop included */
  stops: number;
  /** direction of travel along the line's arc: +1 = increasing `at`, −1 = decreasing (double-ended lines) */
  dir?: 1 | -1;
  /** part or all of the ride runs through a tunnel span (the subway overlay; no hop-off there) */
  underground?: boolean;
}
/** Fast travel (the pelican) to a discovered place: only offered for discovered places, never counts for goals. */
export interface TripFlyLeg extends TripLegBase { via: 'fly'; place: string }
export type TripLeg = TripWalkLeg | TripDriveLeg | TripLineLeg | TripFlyLeg;
export type TripLegVia = TripLeg['via'];

/** One way to get to a place (a row in TripOptions). `legs` run in order; `seconds` = their sum. */
export interface TripOption {
  mode: TripMode;
  legs: TripLeg[];
  seconds: number;
  /** a caveat or a bonus shown under the row: "不算登顶 / 骑行成就" (fly), "顺便完成叮当车目标" */
  note?: Bilingual;
  /** 推荐: the fastest non-fly option, or the one that completes an open goal (at most one option per list) */
  recommended?: boolean;
  /** the open goal id this option completes (why it is recommended) */
  goal?: string;
}

/** Where a trip was started from (objectiveTarget priority and analytics; a free lead is a one-leg walking trip). */
export type TripSource = 'map' | 'card' | 'call' | 'free-lead' | 'tour' | 'panorama' | 'qa';

/** The trip in progress (lane C's `flow.trip`; null when none). Immutable: a new object on every change. */
export interface TripState {
  /** the place-index id of the destination */
  placeId: string;
  /** the Attraction id when the destination is one (arrival moments, flags) */
  attraction?: string;
  option: TripOption;
  /** = option.legs (kept at the top level for the selectors) */
  legs: TripLeg[];
  /** index of the current leg in `legs` (legs.length = arrived) */
  leg: number;
  /** performance.now() ms when the trip started (as the other flow timers) */
  startedAt: number;
  source?: TripSource;
}
