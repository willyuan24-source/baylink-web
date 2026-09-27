import type { Intersection } from 'three';
import { blockersNear, canStand, cityTerrain, inWorld, nearestWalkable, type Blocker } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { arrivalSpot } from './nav';

/**
 * Tap on a building (lane E2, wave 3, M2 of the lead note): in city mode the ground picker's ray (actors/system.ts
 * heightfieldRaycast) also stops at a building wall — a polygon blocker with a known top (Blocker.top: city buildings)
 * that the ray passes below — and the walk target becomes the nearest standable ground in front of that wall, back
 * along the ray toward the camera (then the nearest spot of a large open area there, nav.arrivalSpot, so a tap never
 * sends the walker into a backyard pocket). District mode has no building tops: nothing changes there.
 */

/** horizontal step of the wall search along the ray (u); city walls are ≥ 2 u deep, so none is stepped over */
const STEP = 0.5;
/** farthest wall a tap looks for (horizontal u from the camera): past it a tap keeps the old ground behaviour */
export const FACADE_REACH = 320;
/** how far back from the wall a front spot may be (u): past a row of lower buildings in front of the tapped one */
const FRONT_BACK = 24;
/** a front spot moves at most this far to reach a large open area (nav.arrivalSpot) */
const OPEN_REACH = 6;

export interface FacadeHit {
  /** ray parameter of the hit (the intersection distance for a unit direction) */
  t: number;
  x: number;
  y: number;
  z: number;
  /** horizontal unit direction of the ray (toward the wall) */
  ux: number;
  uz: number;
}

/** What the ground picker reports for a wall hit (R3F spreads the intersection into the click event). */
export type FacadeIntersection = Intersection & { facade?: FacadeHit };

type V3 = { x: number; y: number; z: number };
let last: { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number; tMax: number; px: number; py: number; pz: number; hit: FacadeHit | null } | null = null;

/**
 * Is (x, y, z) inside the occlusion dither between the camera o and the player p (world/materials TOY_FRAG: walls there
 * melt away, so a tap sees through them)? Same cylinder as the shader, at its full radius.
 */
function seeThrough(o: V3, p: V3, x: number, y: number, z: number): boolean {
  const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z, L = Math.hypot(dx, dy, dz);
  if (L < 0.5 || y <= p.y + 0.35) return false;
  const t = ((x - o.x) * dx + (y - o.y) * dy + (z - o.z) * dz) / L;
  if (t <= 0.5 || t >= L - 1.2) return false;
  const k = t / L, r = Math.hypot(x - (o.x + dx * k), y - (o.y + dy * k), z - (o.z + dz * k));
  return r < 0.7 + 1.5 * k;
}

/**
 * The first city building wall along the ray within tMax (ray units), or null (district mode, a vertical ray, open
 * ground). Buildings the ray starts inside (a camera pulled into a wall) are ignored, and so are wall points in the
 * dither between the camera and the player (`player`: what the view fades around). The last answer is cached: R3F
 * casts the same ray for pointerdown, pointerup and click.
 */
export function facadeAlongRay(o: V3, d: V3, tMax: number, player?: V3): FacadeHit | null {
  if (!cityTerrain()) return null;
  const hl = Math.hypot(d.x, d.z);
  if (hl < 1e-4 || !(tMax > 0)) return null;
  const px = player?.x ?? NaN, py = player?.y ?? NaN, pz = player?.z ?? NaN;
  if (last && last.ox === o.x && last.oy === o.y && last.oz === o.z && last.dx === d.x && last.dy === d.y && last.dz === d.z && last.tMax === tMax
    && Object.is(last.px, px) && Object.is(last.py, py) && Object.is(last.pz, pz)) return last.hit;
  const inside = new Set<Blocker>(blockersNear(o.x, o.z, 0.05));
  const dt = STEP / hl;
  let hit: FacadeHit | null = null;
  for (let t = dt; t <= tMax && !hit; t += dt) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (!inWorld(x, z) || (player && seeThrough(o, player, x, y, z))) continue;
    for (const b of blockersNear(x, z, 0.05)) {
      if (b.kind !== 'polygon' || b.top === undefined || y > b.top || inside.has(b)) continue;
      hit = { t, x, y, z, ux: d.x / hl, uz: d.z / hl };
      break;
    }
  }
  last = { ox: o.x, oy: o.y, oz: o.z, dx: d.x, dy: d.y, dz: d.z, tMax, px, py, pz, hit };
  return hit;
}

/**
 * Where to walk for a tap on a wall at (x, z) seen along (ux, uz): back along the ray toward the camera (≤ FRONT_BACK u),
 * the first standable point with a large open area within OPEN_REACH u on the camera side of the wall (a street or
 * plaza, not a pocket between two buildings, and never round the block to the back of a thin building); else a large
 * open area within 10 u of the wall on any side; else the first standable point; else the nearest walkable spot within
 * 8 u; null when there is none.
 */
export function frontSpot(x: number, z: number, ux: number, uz: number): Vec2 | null {
  let first: Vec2 | null = null;
  for (let s = STEP; s <= FRONT_BACK; s += STEP) {
    const px = x - ux * s, pz = z - uz * s;
    if (!canStand(px, pz, 0.45)) continue;
    first ??= { x: px, z: pz };
    const open = arrivalSpot({ x: px, z: pz }, OPEN_REACH);
    if (open && (open.x - x) * ux + (open.z - z) * uz < -0.25) return open;
  }
  return arrivalSpot({ x, z }, 10) ?? first ?? nearestWalkable({ x, z }, 8);
}

/** Forget the cached ray (tests; a new city terrain). */
export function resetFacadeCache() { last = null; }
