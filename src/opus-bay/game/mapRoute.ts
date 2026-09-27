import { routeTo } from '../actors/nav';
import { runtime } from '../core/runtime';
import type { Vec2 } from '../core/types';
import { flow } from './flowStore';
import { routeAhead } from './travel';

/**
 * G1-8 · the walking route the city map draws for 带我去 (lane G1). The selected place gets a route preview with an
 * honest time (travel.ts routeTravelLabel), and while a trip is on (flow.mapTarget = `place:<id>`, set by navigateTo)
 * the map draws what is left of it. Routes come from E2's `routeTo` (actors/nav: the same walking graph, snapping and
 * local grid the auto-walk itself uses; time-sliced A*, ≤ 2 ms a frame), one plan at a time: a newer request aborts
 * the older one. The last few plans are kept, so the map re-opens on the same route at once.
 */

export interface PlannedRoute {
  /** where the plan started (the player) and the place's arrival spot */
  from: Vec2;
  to: Vec2;
  points: Vec2[];
  length: number;
  /** the goal had to move to the nearest reachable spot */
  snapped: boolean;
}

/** Where routes come from (tests inject one; the game uses E2's routeTo). */
export type PlanSource = (from: Vec2, to: Vec2, signal: { aborted: boolean }) => Promise<{ points: Vec2[]; length: number; snapped: boolean } | null>;
const defaultSource: PlanSource = (from, to, signal) => routeTo(from, to, { signal });

/**
 * A cached plan still serves while the player is within this of it (and the goal is the same): near its start, or
 * anywhere along its polyline — someone walking the route (带我去 with the map open) keeps the one plan, so the map,
 * the trip strip and the waypoint count down one number instead of re-planning every 20 u (G1-review: each new A*
 * from the middle of a street snapped to another node, and the time jumped 35 s → 40 s → 25 s → 30 s on the way).
 */
export const REPLAN_U = 20;
const CACHE = 6;
const cache: PlannedRoute[] = [];
let token: { aborted: boolean } | null = null;

const same = (a: Vec2, b: Vec2, r: number) => Math.hypot(a.x - b.x, a.z - b.z) <= r;

/** true when pos has left the plan: more than REPLAN_U from its start and from every point of its polyline. */
export function offRoute(route: Pick<PlannedRoute, 'from' | 'points'>, pos: Vec2): boolean {
  return !same(route.from, pos, REPLAN_U) && routeAhead(route.points, pos).off > REPLAN_U;
}

/** A kept plan to `to` that `from` is still on (near its start or its polyline, see offRoute), or null. */
export function cachedRoute(from: Vec2, to: Vec2): PlannedRoute | null {
  for (let i = cache.length - 1; i >= 0; i--) if (same(cache[i].to, to, 1) && !offRoute(cache[i], from)) return cache[i];
  return null;
}

/**
 * Plan a walking route from → to. Resolves the route, null when there is no way, or undefined when a newer request
 * (or cancelPlan) superseded this one.
 */
export async function planRoute(from: Vec2, to: Vec2, source: PlanSource = defaultSource): Promise<PlannedRoute | null | undefined> {
  const hit = cachedRoute(from, to);
  if (hit) return hit;
  if (token) token.aborted = true;
  const mine = { aborted: false };
  token = mine;
  const f = { x: from.x, z: from.z }, t = { x: to.x, z: to.z };
  let r: Awaited<ReturnType<PlanSource>>;
  try { r = await source(f, t, mine); } catch { r = null; }
  if (mine.aborted) return undefined;
  if (token === mine) token = null;
  if (!r || r.points.length < 2) return null;
  const plan: PlannedRoute = { from: f, to: t, points: r.points, length: r.length, snapped: r.snapped };
  cache.push(plan);
  if (cache.length > CACHE) cache.shift();
  return plan;
}

/**
 * How much of a kept plan to `to` is still ahead of someone at pos (u), or null when no plan goes there or pos is more
 * than 25 u off it (the in-world waypoint then keeps its straight-line estimate).
 */
export function routeLeftTo(to: Vec2, pos: Vec2): number | null {
  for (let i = cache.length - 1; i >= 0; i--) {
    if (!same(cache[i].to, to, 1)) continue;
    const ahead = routeAhead(cache[i].points, pos);
    if (ahead.off <= 25) return ahead.length + ahead.off;
  }
  return null;
}

/** Drop the plan in flight (the map closed or the selection changed). */
export function cancelPlan() { if (token) { token.aborted = true; token = null; } }

/** The place 带我去 is taking the player to (flow.mapTarget `place:<id>`), or null. */
export function tripPlaceId(target: string | null = flow.get().mapTarget): string | null {
  return target && target.startsWith('place:') ? target.slice(6) : null;
}

/** End 带我去: the target and its waypoint go, and the auto-walk stops if it was still heading there. */
export function endTrip(arrival?: Vec2) {
  flow.set({ mapTarget: null });
  const t = runtime.player.pathTarget;
  if (t && (!arrival || same(t, arrival, 2))) { runtime.player.pathTarget = null; runtime.player.pendingInteract = null; }
}
