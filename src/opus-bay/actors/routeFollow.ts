import { cityTerrain } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { LOCAL_ROUTE, RouteWalker, routeTo, type PathResult, type Route } from './nav';

/**
 * Long routes for a walker in city mode (plan §5.7, checkpoint E2-1 / E2-2): the player's click-to-walk and BAYBAY's
 * lead ask for a city walking-graph route (nav.routeTo, time-sliced A* over frames) and follow it leg by leg with a
 * RouteWalker, while the local grid path (findPath, clamped to its 384 u window) keeps them walking until the route
 * arrives. Framework-free: a controller calls `request` once per target and `update` every frame.
 *
 * Races: every request gets its own abort token, so a result that arrives after a newer request, a cancel or a
 * teleport is dropped (and its A* stops at the next slice). District mode never gets here (`isLongRoute` is false
 * without a city terrain): the district walker is findPath only, as before.
 */

/** Where the long routes come from (tests inject a scheduler / graph through the default's options). */
export type RouteSource = (from: Vec2, to: Vec2, signal: { aborted: boolean }) => Promise<Route | null>;

const defaultSource: RouteSource = (from, to, signal) => routeTo(from, to, { signal });

/**
 * A target needs a graph route: city mode, and farther than LOCAL_ROUTE (the local window may clamp it or walk a
 * detour the street graph knows better), or the local grid found no way at all.
 */
export function isLongRoute(from: Vec2, to: Vec2, local: PathResult | null): boolean {
  if (!cityTerrain()) return false;
  return Math.hypot(to.x - from.x, to.z - from.z) > LOCAL_ROUTE || !local || local.points.length === 0;
}

export type FollowState = 'idle' | 'pending' | 'active' | 'failed';

export class RouteFollower {
  state: FollowState = 'idle';
  /** the goal of the current / pending route */
  goal: Vec2 | null = null;
  route: Route | null = null;
  walker: RouteWalker | null = null;
  /** incremented whenever a route arrives (breadcrumbs, QA) */
  arrivals = 0;
  /** requests made since the last `cancel` (1 = the first route, more = re-routes) */
  requests = 0;
  private token: { aborted: boolean } | null = null;
  private readonly source: RouteSource;

  constructor(source: RouteSource = defaultSource) { this.source = source; }

  get pending(): boolean { return this.state === 'pending'; }
  get active(): boolean { return this.state === 'active'; }

  /** Ask for a route from → to (aborts the previous one). The walker keeps its local path until it arrives. */
  request(from: Vec2, to: Vec2) {
    if (this.token) this.token.aborted = true;
    const token = { aborted: false };
    this.token = token;
    this.goal = { x: to.x, z: to.z };
    this.state = 'pending';
    this.requests++;
    this.source({ x: from.x, z: from.z }, this.goal, token).then(r => {
      if (token.aborted || this.token !== token) return;
      this.token = null;
      if (!r || r.legs.length === 0) { this.state = 'failed'; this.route = null; this.walker = null; return; }
      this.route = r;
      this.walker = new RouteWalker(r);
      this.state = 'active';
      this.arrivals++;
    }, () => {
      if (token.aborted || this.token !== token) return;
      this.token = null;
      this.state = 'failed';
    });
  }

  /** Drop the route (and abort a pending search). */
  cancel() {
    if (this.token) this.token.aborted = true;
    this.token = null;
    this.state = 'idle';
    this.goal = null;
    this.route = null;
    this.walker = null;
    this.requests = 0;
  }

  /**
   * Local waypoints toward the end of the current leg (refined with findPath as each leg starts), or null once the
   * route's end is within `finalReach` (or when there is no active route).
   */
  update(pos: Vec2, reach = 3, finalReach = 0.35): Vec2[] | null {
    return this.walker ? this.walker.update(pos, reach, finalReach) : null;
  }

  /** Re-plan the current leg (a stall). */
  replan(pos: Vec2): Vec2[] | null { return this.walker ? this.walker.replan(pos) : null; }

  /** Remaining length along the route (Infinity while pending / idle). */
  remaining(pos: Vec2): number { return this.walker ? this.walker.remaining(pos) : Infinity; }

  /** The route ahead of pos, at most `maxLen` u of it (breadcrumbs): from the current leg's end backwards-free. */
  ahead(pos: Vec2, maxLen: number): Vec2[] {
    const w = this.walker;
    if (!w) return [];
    const out: Vec2[] = [];
    let acc = 0, prev = pos;
    for (let i = w.leg; i < w.route.legs.length && acc < maxLen; i++) {
      const leg = w.route.legs[i];
      for (let k = i === w.leg ? 0 : 1; k < leg.length && acc < maxLen; k++) {
        const q = leg[k];
        // skip leg points behind us (the current leg's first points)
        if (i === w.leg && k < leg.length - 1 && Math.hypot(leg[leg.length - 1].x - pos.x, leg[leg.length - 1].z - pos.z) < Math.hypot(leg[leg.length - 1].x - q.x, leg[leg.length - 1].z - q.z)) continue;
        acc += Math.hypot(q.x - prev.x, q.z - prev.z);
        out.push(q);
        prev = q;
      }
    }
    return out;
  }
}
