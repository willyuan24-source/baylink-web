import { canStand, nearestWalkable } from '../../core/terrain';
import type { Vec2 } from '../../core/types';
import { collectRoadVehicles, type RoadVehicle } from '../../world/sf/streetNet';
import { GUIDE_RADIUS } from '../guide';
import { TERRAIN_WORLD, findFit, poseCheck } from './collide';
import type { Fleet, Ride } from './fleet';

/**
 * W7-K2 (lane B's wave-6 requests to K1): the transit — the cable cars, the F-line, the loop bus and the Metro — stops
 * only for the player (on foot, or sitting in their bike / toy car: world/sf/roadViewer). Two more things stood on its
 * rails and lanes and were driven through:
 *
 * - **the player's parked, empty ride** (they got out on the tracks): making it a blocker would hold a line for good
 *   once the player walks away, so it is towed — when a transit vehicle has it in its path within TOW_REACH u ahead
 *   of its nose (or is already over it), the ride hops to the kerb beside the vehicle's lane (Fleet.tow: the toy
 *   traffic's give-way hop, ≈ 0.5 s), parallel to it, on the side it stood on when that side has room;
 * - **BAYBAY on foot** (the player on the pavement, she by the rails): she steps off the rails — a quick dash to the
 *   side of the vehicle's path (actors/guide.ts setTransitAside) — when one comes within ASIDE_REACH u.
 *
 * City mode only: actors/vehicles/cityBikes.ts (the city's lazy ride module) runs `clearTransitPaths` every frame and
 * registers `guideAside`. The vehicles are streetNet's road-vehicle list (the transit within 250 u of the player).
 */

/** a transit vehicle this far (u) ahead of its nose (+ LEAD_S of its travel) tows a parked ride out of its path */
export const TOW_REACH = 10;
/** BAYBAY steps off the rails for a vehicle this far (u) ahead of its nose (+ LEAD_S of its travel) */
export const ASIDE_REACH = 12;
/**
 * (played: a California St car at 9 u/s — the tow started 10 u off, the car's side passed 0.6 u from the landed toy
 * car) the reach grows with the vehicle's speed: this many seconds of its travel on top
 */
export const LEAD_S = 1;
/** the gap (u) left between the vehicle's side and the towed ride / BAYBAY */
export const TOW_GAP = 0.7;
/** checks per second */
const EVERY = 0.2;

const vehicles: RoadVehicle[] = [];
let checkIn = 0;

/** A transit vehicle (not the toy traffic, not the player's own ride). */
export const isTransit = (q: RoadVehicle) => q.kind !== 'traffic' && q.kind !== 'player';

/**
 * Is the disc (x, z, r) on q's path: beside its centre line within its half width (+ r), from its tail to `reach` u
 * ahead of its nose (so a ride under the vehicle counts too)? Returns the signed side (+1 left of travel, −1 right) or 0.
 */
export function pathSide(q: Pick<RoadVehicle, 'x' | 'z' | 'heading' | 'halfL' | 'halfW'>, x: number, z: number, r: number, reach: number): -1 | 0 | 1 {
  const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
  const rx = x - q.x, rz = z - q.z;
  const along = rx * fx + rz * fz, cross = rx * fz - rz * fx;
  if (Math.abs(cross) >= q.halfW + r + 0.2 || along < -q.halfL - r || along > q.halfL + r + reach) return 0;
  return cross >= 0 ? 1 : -1;
}

/** The ride's footprint as a disc (half its diagonal). */
const rideR = (r: Ride) => Math.hypot(r.width, r.length) / 2;

/**
 * Where to tow `ride` out of q's path: beside the lane (the ride's half width + TOW_GAP past q's side), parallel to q,
 * on `side` first; the pose must fit (collide.poseCheck) and be off every transit path in `list`. Null: nowhere near.
 */
export function towSpot(ride: Ride, q: RoadVehicle, side: 1 | -1, list: readonly RoadVehicle[] = [q]): { x: number; z: number; heading: number } | null {
  const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
  // the ride's point along q's axis
  const rx = ride.sim.x - q.x, rz = ride.sim.z - q.z, along = rx * fx + rz * fz;
  const clear = (x: number, z: number) => !list.some(o => isTransit(o) && pathSide(o, x, z, ride.width / 2, 0) !== 0);
  for (const s of [side, -side as 1 | -1]) {
    for (let extra = 0; extra <= 2.5; extra += 0.5) {
      const off = q.halfW + ride.width / 2 + TOW_GAP + extra;
      // left of travel = (fz, −fx)… as pathSide's cross: cross = rx·fz − rz·fx > 0 ⇒ the offset (fz, −fx)
      const x = q.x + fx * along + fz * off * s, z = q.z + fz * along - fx * off * s;
      for (const heading of [q.heading, q.heading + Math.PI]) {
        if (poseCheck(TERRAIN_WORLD, ride.sim.spec, x, z, heading).ok && clear(x, z)) return { x, z, heading };
      }
    }
  }
  const fit = findFit(TERRAIN_WORLD, ride.sim.spec, ride.sim.x + fz * side * 3, ride.sim.z - fx * side * 3, q.heading, 8);
  return fit && clear(fit.x, fit.z) ? fit : null;
}

/**
 * Every frame (city mode): tow each parked, empty ride that a transit vehicle has in its path. Returns true when a ride
 * started a tow (the caller refreshes the rideables). `vehiclesOverride` for tests.
 */
export function clearTransitPaths(fleet: Fleet, dt: number, vehiclesOverride?: readonly RoadVehicle[]): boolean {
  checkIn -= dt;
  if (checkIn > 0) return false;
  checkIn = EVERY;
  const list = vehiclesOverride ?? collectRoadVehicles(vehicles);
  if (!list.length) return false;
  let towed = false;
  for (const ride of fleet.rides) {
    if (ride.occupied || ride.call || ride.tow || !ride.displaced) continue;
    for (const q of list) {
      if (!isTransit(q)) continue;
      const side = pathSide(q, ride.sim.x, ride.sim.z, rideR(ride), TOW_REACH + Math.max(0, q.v) * LEAD_S);
      if (!side) continue;
      const to = towSpot(ride, q, side, list);
      if (to) { fleet.tow(ride, to.x, to.z, to.heading); towed = true; }
      break;
    }
  }
  return towed;
}

/**
 * BAYBAY at (x, z) on foot: the point to step to when a transit vehicle comes at her (its path within ASIDE_REACH u
 * ahead), else null. To the side she stands on, just past the vehicle's side; the other side or the nearest walkable
 * spot when that one has no room. `vehiclesOverride` for tests.
 */
export function guideAside(x: number, z: number, vehiclesOverride?: readonly RoadVehicle[]): Vec2 | null {
  const list = vehiclesOverride ?? collectRoadVehicles(vehicles);
  for (const q of list) {
    if (!isTransit(q)) continue;
    const side = pathSide(q, x, z, GUIDE_RADIUS, ASIDE_REACH + Math.max(0, q.v) * LEAD_S);
    if (!side) continue;
    const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
    const rx = x - q.x, rz = z - q.z, along = rx * fx + rz * fz;
    for (const s of [side, -side]) {
      const off = q.halfW + GUIDE_RADIUS + TOW_GAP;
      const p = { x: q.x + fx * along + fz * off * s, z: q.z + fz * along - fx * off * s };
      if (canStand(p.x, p.z, GUIDE_RADIUS)) return p;
    }
    return nearestWalkable({ x: x + fz * side * (q.halfW + 1.5), z: z - fx * side * (q.halfW + 1.5) }, 6);
  }
  return null;
}

/** Tests: restart the check clock. */
export function resetTransitClear() { checkIn = 0; }
