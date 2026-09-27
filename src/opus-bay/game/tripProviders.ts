import { isRiding } from '../actors/moveApi';
import { routeTo } from '../actors/nav';
import { driveRoute } from '../actors/vehicles/driveRoute';
import { game } from '../core/store';
import type { Vec2 } from '../core/types';
import { type CableLine, type TransitData, glossName, transitData } from '../data/transit';
import type { TransitLine } from '../world/sf/format';
import { isDiscovered } from './discovery';
import { interactables } from './interactables';
import { RIDEABLE_R, type TripGoalRule, type TripLineInfo, type TripProviders, type TripRideable, TripRouteCache } from './tripPlan';

/**
 * The live providers for planTrips (lane G, W4-G1): the game's routers, parked rideables, the transit lines, discovery.
 * One cache per page (`tripProviders()`), so every TripOptions list, the trip pill and the flow share the searches.
 *
 *   walk        actors/nav routeTo (time-sliced A* on the walking graph, the local grid for short hops)
 *   drive       actors/vehicles/driveRoute (the vehicle's edge filter; its end may snap to the drivable network)
 *   rideables   interactables with source 'vehicle' (ids ride:bike-… / ride:car-…) within RIDEABLE_R
 *   riding      game.move.mode bike / car while moveApi says the player is carried
 *   lines       the cable cars from data/transit.ts (`cableTripLines`) + lines registered by lane T
 *               (`registerTripLines`: the loop, N and M from transit.json via `transitTripLine`)
 *   lineWait / lineRide   estimators registered by lane T's systems (`registerLineEstimator`); the planner's models
 *               answer until then
 *   discovered  game/discovery isDiscovered (fast travel is offered to discovered places only)
 *   goals       open-goal rules registered by lane C (`registerTripGoals`)
 */

/** A cable-car line of data/transit.ts as the planner sees it (dwell stops and termini are its halting stops). */
export function cableTripLine(line: CableLine, data: Pick<TransitData, 'stations'>): TripLineInfo {
  const st = new Map(data.stations.map(s => [s.id, s] as const));
  return {
    id: line.id, kind: 'cable-car', name: glossName(line.name), color: line.color, length: line.length,
    stops: line.stops.map(s => {
      const station = st.get(s.station);
      return { id: s.station, at: s.at, x: station?.x ?? 0, z: station?.z ?? 0, ...(station ? { name: glossName(station.name) } : {}), major: s.dwell || s.terminus };
    }),
    path: line.xyz, pathStride: 3,
  };
}

export function cableTripLines(data: TransitData | null): TripLineInfo[] {
  return data ? data.lines.map(l => cableTripLine(l, data)) : [];
}

/** A published transit.json line (world/sf/format.ts: the loop, N, M) as the planner sees it. */
export function transitTripLine(line: TransitLine): TripLineInfo {
  return {
    id: line.id, kind: line.kind, name: line.name, ...(line.short ? { short: line.short } : {}), color: line.color, length: line.length,
    ...(line.loop ? { loop: true } : {}),
    stops: line.stops.map(s => ({ id: s.id, at: s.at, x: s.x, z: s.z, name: s.name, ...(s.major ? { major: true } : {}) })),
    ...(line.tunnels?.length ? { tunnels: line.tunnels.map(t => ({ fromAt: t.fromAt, toAt: t.toAt })) } : {}),
    path: line.path, pathStride: 3,
  };
}

const flat = (pts: readonly Vec2[]) => { const out: number[] = []; for (const p of pts) out.push(p.x, p.z); return out; };

/**
 * The kind of a rideable interactable: `ride:car-…` is the toy car, every other `ride:` id a bike (the Hud's rule).
 * (Review: a bare /car/ test called a bike parked at "Carl & Cole" or "Oscar Alley" a car.)
 */
export const rideableKind = (id: string): 'bike' | 'car' => (/^(?:ride:)?car(?:-|$)/.test(id) ? 'car' : 'bike');

/** The rideables near a point, from the interactables (the same rule as game/travel rideableNear). */
export function rideablesFrom(list: readonly { id: string; source: string; x: number; z: number; name?: { zh: string; en: string } }[], near: Vec2, radius = RIDEABLE_R): TripRideable[] {
  const out: TripRideable[] = [];
  for (const it of list) {
    if (it.source !== 'vehicle') continue;
    if (Math.hypot(it.x - near.x, it.z - near.z) > radius) continue;
    out.push({ id: it.id, kind: rideableKind(it.id), x: it.x, z: it.z, ...(it.name ? { name: it.name } : {}) });
  }
  return out;
}

// registries (lanes T and C add to them in the integration phase)
const lineSources = new Map<string, () => readonly TripLineInfo[]>();
let estimator: Pick<TripProviders, 'lineWait' | 'lineRide'> = {};
const goalSources = new Map<string, () => readonly TripGoalRule[]>();

/** Lane T: the loop / Metro lines (and their stations) for the planner. Returns the unregister function. */
export function registerTripLines(key: string, fn: () => readonly TripLineInfo[]): () => void {
  lineSources.set(key, fn);
  return () => { if (lineSources.get(key) === fn) lineSources.delete(key); };
}
/** Lane T: the running systems' ETA / ride estimates (null / undefined answers fall back to the planner's model). */
export function registerLineEstimator(e: Pick<TripProviders, 'lineWait' | 'lineRide'>) { estimator = e; }
/** Lane C: the open goals' rules (cable-car, twin-peaks, metro, sightseeing, …). */
export function registerTripGoals(key: string, fn: () => readonly TripGoalRule[]): () => void {
  goalSources.set(key, fn);
  return () => { if (goalSources.get(key) === fn) goalSources.delete(key); };
}

let cache: TripRouteCache | null = null;
/** The page's route cache (subscribe to it to re-plan when a route lands). */
export function tripRouteCache(): TripRouteCache {
  return (cache ??= new TripRouteCache({
    walk: (a, b) => routeTo(a, b).then(r => (r ? { length: r.length, path: flat(r.points) } : null)),
    drive: (a, b, kind) => driveRoute(a, b, kind).then(r => (r ? { length: r.length, path: flat(r.points), end: r.points[r.points.length - 1] } : null)),
  }));
}

/** The providers for planTrips in the running game. */
export function tripProviders(): TripProviders {
  const c = tripRouteCache();
  return {
    walk: c.walk,
    drive: c.drive,
    rideables: (near, radius) => rideablesFrom(interactables(), near, radius),
    riding: () => { const m = game.get().move.mode; return (m === 'bike' || m === 'car') && isRiding() ? m : null; },
    lines: () => { const out = cableTripLines(transitData()); for (const fn of lineSources.values()) out.push(...fn()); return out; },
    lineWait: (line, stop, dir) => estimator.lineWait?.(line, stop, dir),
    lineRide: (line, board, alight, dir) => estimator.lineRide?.(line, board, alight, dir),
    discovered: id => isDiscovered(id),
    goals: [...goalSources.values()].flatMap(fn => fn()),
  };
}
