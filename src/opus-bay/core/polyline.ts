import type { Vec2 } from './types';

/**
 * Polyline helpers the walker and the drive routes use every frame (lane E2, HC-1): split out of core/walkGraph so the
 * main graph can measure and split routes without the walking-graph code and world/sf/format, which actors/nav and
 * actors/vehicles/driveRoute load lazily with the graph itself. core/walkGraph re-exports them.
 */

/** longest leg a route is split into (u); each leg is refined by the local grid A* as the walker reaches it */
export const LEG_MAX = 60;

export function polylineLength(pts: readonly Vec2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return L;
}

/**
 * Split a polyline into consecutive legs of at most `legMax` u (each leg starts where the previous ended; a segment
 * longer than legMax is cut). Every leg keeps the polyline's own vertices.
 */
export function splitLegs(pts: readonly Vec2[], legMax = LEG_MAX): Vec2[][] {
  const legs: Vec2[][] = [];
  if (pts.length < 2) return pts.length ? [[{ ...pts[0] }]] : [];
  let leg: Vec2[] = [{ ...pts[0] }], acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = leg[leg.length - 1];
    const b = pts[i];
    let seg = Math.hypot(b.x - a.x, b.z - a.z);
    while (acc + seg > legMax + 1e-9) {
      const t = (legMax - acc) / seg, cut = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      if (legMax - acc > 1e-6) leg.push(cut);
      legs.push(leg);
      leg = [cut]; acc = 0; a = cut; seg = Math.hypot(b.x - a.x, b.z - a.z);
    }
    leg.push({ x: b.x, z: b.z }); acc += seg;
  }
  if (leg.length > 1) legs.push(leg);
  return legs;
}
