import { canStand, heightAt } from '../core/terrain';

/**
 * Wave 5 · W5-F6 (plan sf-w5-plan.md §2 MF2 "The GGB deck", §4.4): bridge decks the feet and the follow camera know
 * about. A deck is a straight walk between two rails (the Golden Gate Bridge's, registered by actors/cityViews.ts when
 * the city camera data loads, so the landmark library stays out of GameRoot's main graph).
 *
 * - `deckAt(x, z)`: on a deck's footprint → the deck, the station `s` along its axis and the lateral offset `l`.
 * - `deckWish(at, wx, wz, px, pz)`: forward input follows the deck — a wish within 60° of the axis runs along it (the
 *   across part kept at a third, so the player can still drift over to a rail), and a blocker ahead in the lane (the
 *   tower legs stand across the sidewalks) steers the wish to the nearest clear lane; a wish mostly across the deck (to
 *   look over the rail) is left alone.
 * - The camera (actors/camera.ts) stays behind the player along the axis on a deck, and the tower hero points are
 *   relaxed there (`heroRelaxed`): on the deck the towers are what you walk through, not what hides you.
 */

export interface Deck {
  id: string;
  /** the axis's start (world x / z) and its heading (rad: +s runs along (sin, cos)) */
  x: number;
  z: number;
  heading: number;
  /** the walkable deck runs from s = 0 to s = length */
  length: number;
  /** half width between the rails' inner faces (u) */
  half: number;
  /** the walk height (world y) */
  y: number;
  /** hero points (camera.ts HeroPoint ids) the follow camera may look through while the player is on this deck */
  relax?: readonly string[];
}

export interface DeckAt { deck: Deck; s: number; l: number }

/** the steering's constants (tests read them) */
export const DECK_STEER = {
  /** a wish within this of the axis (rad) follows the deck */
  cone: (60 * Math.PI) / 180,
  /** share of the across input kept while following the deck */
  across: 0.35,
  /** how far ahead a lane is checked for blockers (u) */
  ahead: 3.2,
  /** lane search step and the body's clearance from the rails (u) */
  laneStep: 0.35,
  railClear: 0.5,
  /** lateral steer gain (per u of lane offset) and its cap */
  gain: 1.4,
  maxSteer: 0.9,
  /** margin past the rails and the ends that still counts as "on the deck" (u) */
  margin: 0.4,
} as const;

const DECKS = new Map<string, Deck>();

/** Register (or with null remove) a deck. City mode registers the Golden Gate Bridge (actors/cityViews.ts). */
export function registerDeck(key: string, deck: Deck | null): void {
  if (deck) DECKS.set(key, deck); else DECKS.delete(key);
}

/** The registered decks (tests, QA). */
export function decks(): Deck[] { return [...DECKS.values()]; }

/** a walk height within this of the deck's is on it (the ground far below, Fort Point under the arch, is not) */
const DECK_Y = 3;

/**
 * The deck under (x, z) at walk height y (default: the ground there), with the station along its axis and the lateral
 * offset (+ = to the axis's right).
 */
export function deckAt(x: number, z: number, y?: number): DeckAt | null {
  if (DECKS.size === 0) return null;
  for (const deck of DECKS.values()) {
    const ax = Math.sin(deck.heading), az = Math.cos(deck.heading);
    const dx = x - deck.x, dz = z - deck.z;
    const s = dx * ax + dz * az;
    if (s < -DECK_STEER.margin || s > deck.length + DECK_STEER.margin) continue;
    // right of the axis = (cos h, −sin h)
    const l = dx * az - dz * ax;
    if (Math.abs(l) > deck.half + DECK_STEER.margin) continue;
    if (Math.abs((y ?? heightAt(x, z)) - deck.y) > DECK_Y) continue;
    return { deck, s, l };
  }
  return null;
}

/** World point at station s, lateral l on a deck. */
export function deckPoint(deck: Deck, s: number, l: number): { x: number; z: number } {
  const ax = Math.sin(deck.heading), az = Math.cos(deck.heading);
  return { x: deck.x + ax * s + az * l, z: deck.z + az * s - ax * l };
}

/** The camera may look through hero point `id` while the player stands at (x, z). */
export function heroRelaxed(id: string, x: number, z: number): boolean {
  const at = deckAt(x, z);
  return !!at?.deck.relax?.includes(id);
}

/** The body fits at (s, l) and a few steps on along `dir` (±1) on the deck. */
function laneClear(deck: Deck, s: number, l: number, dir: number, r: number): boolean {
  for (let d = 0.9; d <= DECK_STEER.ahead + 1e-6; d += 0.8) {
    const p = deckPoint(deck, s + dir * d, l);
    if (!canStand(p.x, p.z, r)) return false;
  }
  return true;
}

/**
 * Steer a unit wish (wx, wz) on a deck: along the axis when it points within DECK_STEER.cone of it, round a blocker in
 * the lane ahead. Returns a unit direction (the input one when the deck does not apply). `r` = the body's radius.
 */
export function deckWish(at: DeckAt, wx: number, wz: number, r = 0.45): { x: number; z: number; steered: boolean } {
  const { deck, s, l } = at;
  const ax = Math.sin(deck.heading), az = Math.cos(deck.heading);
  // right = (az, −ax)
  const along = wx * ax + wz * az, across = wx * az - wz * ax;
  if (Math.abs(along) < Math.cos(DECK_STEER.cone)) return { x: wx, z: wz, steered: false };
  const dir = along >= 0 ? 1 : -1;
  let lat = across * DECK_STEER.across;
  // a blocker in the lane ahead (a tower leg across the sidewalk): the nearest clear lane
  const limit = deck.half - DECK_STEER.railClear;
  if (!laneClear(deck, s, l, dir, r)) {
    let best: number | null = null;
    for (let k = 1; k * DECK_STEER.laneStep <= 2 * deck.half; k++) {
      for (const sgn of [1, -1]) {
        const cand = l + sgn * k * DECK_STEER.laneStep;
        if (Math.abs(cand) > limit) continue;
        if (laneClear(deck, s, cand, dir, r)) { best = cand; break; }
      }
      if (best !== null) break;
    }
    if (best !== null) lat = Math.max(-DECK_STEER.maxSteer, Math.min(DECK_STEER.maxSteer, (best - l) * DECK_STEER.gain));
  }
  // keep off the rails: no drift outward past the clearance
  if ((l >= limit && lat > 0) || (l <= -limit && lat < 0)) lat = 0;
  const x = dir * ax + lat * az, z = dir * az - lat * ax, L = Math.hypot(x, z) || 1;
  return { x: x / L, z: z / L, steered: true };
}

/** The yaw that puts a follow camera behind a player walking along the deck in direction `dir` (±1). */
export function deckCameraYaw(deck: Deck, dir: number): number {
  // the camera sits at (sin yaw, cos yaw)·dist from the player: behind = against the direction of travel
  const h = deck.heading + (dir >= 0 ? 0 : Math.PI);
  return Math.atan2(-Math.sin(h), -Math.cos(h));
}
