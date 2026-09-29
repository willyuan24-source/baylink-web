import { canStand, forEachBlockerNear, heightAt, inWorld, isWater, pointInPolygon, standAt, type Blocker } from '../core/terrain';
import type { Polygon } from '../core/types';
import { onDeck } from './deckSteer';

/**
 * Wave 5 · W5-F5 forgiving feet (plan sf-w5-plan.md §2 MF2 table; walk speed, jump and stair rules unchanged). Pure
 * queries over core/terrain for the controller (actors/controller.ts) and the stuck helper (actors/stuckHelper.ts):
 *
 * - **slide along** (`corridorAt`): pushing into a wall or rail where the walk is a corridor — a deck, a pier, a narrow
 *   path or a stair landing: the other edge within FEET.corridor u of the wall — keeps walking along it: a wish within
 *   FEET.steerCone of the wall's direction runs along it at full speed, a steeper one slides down to FEET.corridorSlideMin
 *   of its speed before it stops and leans (open ground keeps the old SLIDE_MIN rule).
 * - **auto-vault** (`vaultPlan`): running or jumping into a blocker whose measured top (Blocker.top) is at most
 *   FEET.vaultRise above the feet, with standable ground at most FEET.vaultReach beyond it: a 0.35 s hands-on hop.
 *   Guards (plan D19): an unknown top is a wall; never when the far side is more than FEET.vaultDrop lower, over water,
 *   next to a cliff, or up onto anything higher than a step (never a roof: the landing must be standable ground, which a
 *   blocker's top is not); never inside a `noVault` area (bridge decks, pier ends, cliff paths: registerNoVault).
 * - **pull guards** (`pullTarget`): BAYBAY's 嘿咻 pull goes ≤ FEET.pullReach u toward the push, only across ground that is
 *   not water and not a blocker, never up a cliff or down a drop.
 */

export const FEET = {
  /** a wall contact whose opposite edge is within this (u, from the player) makes a corridor */
  corridor: 6,
  /** in a corridor, a wish within this (rad) of the wall's direction runs along it at full speed */
  steerCone: (35 * Math.PI) / 180,
  /** in a corridor the slide keeps going down to this share of the wish (open ground: controller SLIDE_MIN 0.35) */
  corridorSlideMin: 0.12,
  /** vault: the blocker's top at most this above the feet (u) */
  vaultRise: 1.1,
  /** vault: standable ground within this beyond the blocker's far side (u) */
  vaultReach: 1.6,
  /** vault: the far side at most this lower (u) and at most this higher (a step, never a roof) */
  vaultDrop: 0.75,
  vaultStep: 0.6,
  /** vault: how long the hop takes (s) and how far above the top the hands lift the body (u) */
  vaultTime: 0.35,
  vaultClear: 0.3,
  /** a cliff right beyond the landing: ground this far below within FEET.cliffRing u */
  cliffDrop: 2,
  cliffRing: 1.2,
  /** pull: ≥ pullPush s of pushing with < pullProgress u of progress (the stuck helper) */
  pullPush: 1.2,
  pullProgress: 0.3,
  /** pull: at most this far (u), at least this far along the push, within this cone (rad) of it */
  pullReach: 4,
  pullMin: 0.9,
  pullCone: (45 * Math.PI) / 180,
  /** pull: the landing at most this higher / lower than the feet, no ridge on the way higher than pullRidge (u) */
  pullUp: 0.8,
  pullDown: 1.2,
  pullRidge: 1,
  /**
   * W5-F10 mantle (a hop against a ledge): in the air, ground ahead standing above the body (by > mantleGap) and
   * mantleMin–mantleMax above the take-off feet is climbed hands first in up to mantleTime (s: the higher the edge
   * stands over the body, the longer the pull); in the city a ledge higher than mantleMax is a wall even in a jump
   * (before, any jump popped the body onto any height). A hop that clears the edge lands on top as before.
   */
  mantleGap: 0.1,
  mantleMin: 0.45,
  mantleMax: 1.6,
  mantleTime: 0.42,
} as const;

// ---------------------------------------------------------------------------
// noVault areas
// ---------------------------------------------------------------------------

const NO_VAULT = new Map<string, Polygon[]>();

/** Areas where the feet never vault (bridge decks, pier ends, cliff paths); keyed, null removes. */
export function registerNoVault(key: string, polys: Polygon[] | null): void {
  if (polys && polys.length) NO_VAULT.set(key, polys); else NO_VAULT.delete(key);
}

/** (x, z) lies in a noVault area, or on a bridge deck (actors/deckSteer: a deck's rails are never vaulted). */
export function noVaultAt(x: number, z: number): boolean {
  if (onDeck(x, z)) return true;
  if (NO_VAULT.size === 0) return false;
  const p = { x, z };
  for (const polys of NO_VAULT.values()) for (const poly of polys) if (pointInPolygon(p, poly)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// slide along
// ---------------------------------------------------------------------------

/**
 * A corridor at (x, z) against a wall whose normal (nx, nz) points into it: the walkable ground ends again within
 * FEET.corridor u on the other side (a deck, a pier, a narrow path, a stair landing), or the player is on a bridge deck.
 * Open ground (a sidewalk opening onto the street, a plaza) is not a corridor. O(12) raster reads.
 */
export function corridorAt(x: number, z: number, nx: number, nz: number): boolean {
  if (onDeck(x, z)) return true;
  const L = Math.hypot(nx, nz);
  if (L < 1e-6) return false;
  const ox = -nx / L, oz = -nz / L;
  for (let d = 0.5; d <= FEET.corridor + 1e-6; d += 0.5) {
    const s = standAt(x + ox * d, z + oz * d);
    // the other edge (an edge, a rail, a wall); ground that is not resident is unknown: not a corridor
    if (s !== 1) return s === 0;
  }
  return false;
}

// ---------------------------------------------------------------------------
// auto-vault
// ---------------------------------------------------------------------------

export interface VaultPlan {
  /** where the hop lands (standable) and its ground height */
  x: number;
  z: number;
  y: number;
  /** the highest blocker top jumped over (world y) */
  top: number;
  /** horizontal length of the hop (u) */
  dist: number;
}

let topMax = -Infinity;
let topUnknown = false;
let blockerCount = 0;
const readTop = (b: Blocker) => {
  blockerCount++;
  if (b.top === undefined) topUnknown = true;
  else if (b.top > topMax) topMax = b.top;
};

/** The blockers overlapping the disc: their highest top, whether any has no top, how many (module scratch). */
function tops(x: number, z: number, r: number): { max: number; unknown: boolean; count: number } {
  topMax = -Infinity; topUnknown = false; blockerCount = 0;
  forEachBlockerNear(x, z, r, readTop);
  return { max: topMax, unknown: topUnknown, count: blockerCount };
}

/** A cliff right beyond (x, z): ground more than FEET.cliffDrop below y within FEET.cliffRing, or no model there. */
function cliffNear(x: number, z: number, y: number): boolean {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, px = x + Math.cos(a) * FEET.cliffRing, pz = z + Math.sin(a) * FEET.cliffRing;
    if (!inWorld(px, pz) || isWater(px, pz)) continue; // a quay's edge over water is a drop the walk rules keep
    if (heightAt(px, pz) < y - FEET.cliffDrop) return true;
  }
  return false;
}

/**
 * The hop over the blocker in front of a player at (x, z) with the feet at `feet` (the ground there), heading
 * (dx, dz) (unit), body radius r: null unless every guard passes (plan §2 MF2 auto-vault, D19).
 */
export function vaultPlan(x: number, z: number, feet: number, dx: number, dz: number, r = 0.45): VaultPlan | null {
  const L = Math.hypot(dx, dz);
  if (L < 1e-6 || !Number.isFinite(feet)) return null;
  dx /= L; dz /= L;
  if (noVaultAt(x, z)) return null;
  // 1. what is in front: only blockers with a measured top, all of them low enough
  const probe = tops(x + dx * (r + 0.3), z + dz * (r + 0.3), 0.3);
  if (probe.count === 0 || probe.unknown || probe.max > feet + FEET.vaultRise) return null;
  let top = probe.max;
  // 2. march through the blocker to the first standable spot beyond it, within vaultReach of its far side
  let inside = false, farSide = -1;
  for (let d = 0.25; d <= r + 1.6 + FEET.vaultReach + 1e-6; d += 0.2) {
    const px = x + dx * d, pz = z + dz * d;
    if (!inWorld(px, pz) || isWater(px, pz) || noVaultAt(px, pz)) return null;
    const t = tops(px, pz, 0.05);
    if (t.count > 0) {
      if (t.unknown || t.max > feet + FEET.vaultRise) return null;
      if (t.max > top) top = t.max;
      inside = true; farSide = -1;
      continue;
    }
    if (!inside) continue;
    if (farSide < 0) farSide = d;
    if (d - farSide > FEET.vaultReach) return null;
    const gy = heightAt(px, pz);
    // the far side: never a drop, never up onto anything higher than a step
    if (gy < feet - FEET.vaultDrop || gy > feet + FEET.vaultStep) return null;
    // the body must fit clear of the blocker (the landing's centre r + a little past it)
    if (d - farSide < r) continue;
    if (!canStand(px, pz, r)) continue;
    if (cliffNear(px, pz, gy)) return null;
    return { x: px, z: pz, y: gy, top, dist: d };
  }
  return null;
}

// ---------------------------------------------------------------------------
// pull
// ---------------------------------------------------------------------------

/** Nothing solid, wet or off the model on the straight line from (x0, z0) to (x1, z1); no ridge or drop past the limits. */
export function pullLineClear(x0: number, z0: number, feet: number, x1: number, z1: number): boolean {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.ceil(L / 0.25));
  for (let i = 1; i <= n; i++) {
    const k = i / n, px = x0 + (x1 - x0) * k, pz = z0 + (z1 - z0) * k;
    if (!inWorld(px, pz) || isWater(px, pz)) return false;
    if (tops(px, pz, 0.08).count > 0) return false; // never across a building, a wall or a fence
    const gy = heightAt(px, pz);
    if (gy > feet + FEET.pullRidge || gy < feet - FEET.pullDown - 0.4) return false;
  }
  return true;
}

/**
 * Where BAYBAY pulls a player stuck at (x, z) (feet at `feet`) who pushes toward (dx, dz): the nearest standable spot
 * ≥ FEET.pullMin along the push, within FEET.pullCone of it and FEET.pullReach of the player, reached by a clear line
 * (pullLineClear) and not higher / lower than FEET.pullUp / pullDown. Null when there is none (a real wall: no pull).
 */
export function pullTarget(x: number, z: number, feet: number, dx: number, dz: number, r = 0.45): { x: number; z: number; y: number } | null {
  const L = Math.hypot(dx, dz);
  if (L < 1e-6) return null;
  const h = Math.atan2(dx / L, dz / L);
  let best: { x: number; z: number; y: number } | null = null, bestScore = Infinity;
  for (const off of [0, 0.26, -0.26, 0.52, -0.52, FEET.pullCone, -FEET.pullCone]) {
    const a = h + off, ux = Math.sin(a), uz = Math.cos(a);
    for (let d = FEET.pullMin; d <= FEET.pullReach + 1e-6; d += 0.25) {
      const px = x + ux * d, pz = z + uz * d;
      if (d * Math.cos(off) < FEET.pullMin) continue;
      const score = Math.abs(off) * 3 + d * 0.4;
      if (score >= bestScore) break;
      if (!canStand(px, pz, r)) continue;
      const gy = heightAt(px, pz);
      if (gy > feet + FEET.pullUp || gy < feet - FEET.pullDown) continue;
      if (!pullLineClear(x, z, feet, px, pz)) break; // farther along this ray crosses the same thing
      best = { x: px, z: pz, y: gy }; bestScore = score;
      break;
    }
  }
  return best;
}
