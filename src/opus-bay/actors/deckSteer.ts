import { canStand, heightAt } from '../core/terrain';
import { registerDeckSteer } from './citySlots';

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

/** (W6-K1) scratch for the helpers here that read a deckAt only within the call */
const AT: DeckAt = { deck: null as unknown as Deck, s: 0, l: 0 };
/** Whether (x, z) at walk height y (default: the ground there) is on a deck (no object made). */
export function onDeck(x: number, z: number, y?: number): boolean { return !!deckAt(x, z, y, AT); }

/** a walk height within this of the deck's is on it (the ground far below, Fort Point under the arch, is not) */
const DECK_Y = 3;

/**
 * The deck under (x, z) at walk height y (default: the ground there), with the station along its axis and the lateral
 * offset (+ = to the axis's right).
 */
export function deckAt(x: number, z: number, y?: number, out?: DeckAt): DeckAt | null {
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
    // (W6-K1) no object per frame on the deck: the controller, the camera and the helpers here pass their own `out`
    if (out) { out.deck = deck; out.s = s; out.l = l; return out; }
    return { deck, s, l };
  }
  return null;
}

/** (W5-Z) how far under a deck's walk height a spot between its rails may be before it is a dip in the edge */
export const DECK_DIP = 0.2;

/**
 * (W5-Z) A step from (x0, z0) at height y0 on a deck to (x1, z1) that would go down into a dip of its edge: the unit
 * normal toward the rail it lies against (a wall to slide along), else null. The walk raster is 0.5 u cells across a
 * deck that runs at an angle: at the rails `heightAt` blends the deck's cells with what is under them (the water), so
 * the sidewalks' outer half is dotted with narrow low spots — on the phone a thumb held 30–45° off the axis walked the
 * player into one and the ground round it was too steep to step out (stuck 0.4–1.8 u under the deck, no pull target).
 * Nothing between the rails is legitimately lower than the deck (the sidewalks stand 0.02 above the roadway).
 */
export function deckDip(x0: number, z0: number, y0: number, x1: number, z1: number, out?: { nx: number; nz: number }): { nx: number; nz: number } | null {
  const at = deckAt(x0, z0, y0, AT);
  if (!at) return null;
  const { deck } = at;
  if (heightAt(x1, z1) >= deck.y - DECK_DIP) return null;
  const ax = Math.sin(deck.heading), az = Math.cos(deck.heading);
  const dx = x1 - deck.x, dz = z1 - deck.z;
  const s = dx * ax + dz * az, l = dx * az - dz * ax;
  // past the ends (the bluff and the Marin side) or beyond the rails the ground is not the deck's business
  if (s < 2 || s > deck.length - 2 || Math.abs(l) > deck.half) return null;
  const sg = l >= 0 ? 1 : -1;
  if (out) { out.nx = az * sg; out.nz = -ax * sg; return out; }
  return { nx: az * sg, nz: -ax * sg };
}

/** World point at station s, lateral l on a deck. */
export function deckPoint(deck: Deck, s: number, l: number): { x: number; z: number } {
  const ax = Math.sin(deck.heading), az = Math.cos(deck.heading);
  return { x: deck.x + ax * s + az * l, z: deck.z + az * s - ax * l };
}

/** The camera may look through hero point `id` while the player stands at (x, z). */
export function heroRelaxed(id: string, x: number, z: number): boolean {
  const at = deckAt(x, z, undefined, AT);
  return !!at?.deck.relax?.includes(id);
}

/** The body fits at (s, l) and a few steps on along `dir` (±1) on the deck (W5-Z: and no dip of the edge is there). */
function laneClear(deck: Deck, s: number, l: number, dir: number, r: number): boolean {
  const ax = Math.sin(deck.heading), az = Math.cos(deck.heading);
  for (let d = 0.9; d <= DECK_STEER.ahead + 1e-6; d += 0.8) {
    // = deckPoint(deck, s + dir * d, l), inline (W6-K1: no object per probe)
    const ss = s + dir * d, x = deck.x + ax * ss + az * l, z = deck.z + az * ss - ax * l;
    if (!canStand(x, z, r) || heightAt(x, z) < deck.y - DECK_DIP) return false;
  }
  return true;
}

/**
 * Steer a unit wish (wx, wz) on a deck: along the axis when it points within DECK_STEER.cone of it, round a blocker in
 * the lane ahead. Returns a unit direction (the input one when the deck does not apply). `r` = the body's radius.
 */
export function deckWish(at: DeckAt, wx: number, wz: number, r = 0.45, out?: DeckWish): DeckWish {
  const { deck, s, l } = at;
  const ax = Math.sin(deck.heading), az = Math.cos(deck.heading);
  // right = (az, −ax)
  const along = wx * ax + wz * az, across = wx * az - wz * ax;
  if (Math.abs(along) < Math.cos(DECK_STEER.cone)) return wishOut(out, wx, wz, false);
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
  // keep off the rails: no drift outward past the clearance (W5-Z: and a body already past it is eased back in — the
  // edge by the rails is where the deck's walk raster is ragged)
  if ((l >= limit && lat > 0) || (l <= -limit && lat < 0)) lat = 0;
  if (Math.abs(l) > limit) lat = -Math.sign(l) * Math.min(DECK_STEER.maxSteer, Math.max(Math.abs(lat), (Math.abs(l) - limit) * DECK_STEER.gain));
  const x = dir * ax + lat * az, z = dir * az - lat * ax, L = Math.hypot(x, z) || 1;
  return wishOut(out, x / L, z / L, true);
}

export interface DeckWish { x: number; z: number; steered: boolean }
function wishOut(out: DeckWish | undefined, x: number, z: number, steered: boolean): DeckWish {
  if (!out) return { x, z, steered };
  out.x = x; out.z = z; out.steered = steered;
  return out;
}

/** The yaw that puts a follow camera behind a player walking along the deck in direction `dir` (±1). */
export function deckCameraYaw(deck: Deck, dir: number): number {
  // the camera sits at (sin yaw, cos yaw)·dist from the player: behind = against the direction of travel
  const h = deck.heading + (dir >= 0 ? 0 : Math.PI);
  return Math.atan2(-Math.sin(h), -Math.cos(h));
}

// W7-P1 (lane P): GameRoot's graph reaches this module through actors/citySlots.ts; it registers itself when it loads
registerDeckSteer({ deckAt, deckDip, deckWish, onDeck, heroRelaxed, deckCameraYaw });
