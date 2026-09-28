import type { MoveMode } from '../core/store';
import type { Vec2 } from '../core/types';
import { DISTRICT } from '../data/district';
import { CITY_GOAL, HOOD_PREFIX, NEIGHBOURHOOD_TARGET, neighbourhoodsVisited } from '../data/sf/goals';

/**
 * City goal detectors (lane G2, plan G2-5; lane C from wave 4): pure state machines (tested with synthetic input in
 * tests/opus-bay-sf-content.test.ts). LAZY: only game/cityLive.ts (its own chunk, with the landmark library) imports
 * them and feeds them from the runtime at 5 Hz; game/cityGoals.ts keeps the waypoints in the main graph.
 */

/** Modes that count as getting somewhere yourself (not the pelican, fast travel or a transit car). */
const OWN_WAY: ReadonlySet<MoveMode> = new Set<MoveMode>(['foot', 'sit', 'bike', 'car', 'photo']);

export interface GoalSample { x: number; y: number; z: number; mode: MoveMode; /** G1's travelEpoch() */ epoch: number; travelling: boolean }

/**
 * Twin Peaks, climbed yourself: the summit zone (within `r` u of the overlook, y ≥ `minY`) counts only when the
 * detector was armed by being at least `armDist` u away on your own (foot / bike / car). Fast travel disarms it (the
 * epoch changes), so arriving by fast travel, then walking the last metres, does not count; walk down and up again.
 */
export function createSummitDetector(summit: { x: number; z: number; y: number }, opts: { r?: number; minY?: number; armDist?: number } = {}) {
  const r = opts.r ?? 16, minY = opts.minY ?? summit.y - 3, armDist = opts.armDist ?? 150;
  let armed = false, epoch: number | null = null;
  return {
    get armed() { return armed; },
    step(s: GoalSample): boolean {
      if (epoch !== null && s.epoch !== epoch) armed = false;
      epoch = s.epoch;
      if (s.travelling || !OWN_WAY.has(s.mode)) { if (s.mode === 'glide' || s.mode === 'travel') armed = false; return false; }
      const d = Math.hypot(s.x - summit.x, s.z - summit.z);
      if (d >= armDist) { armed = true; return false; }
      return armed && d <= r && s.y >= minY;
    },
  };
}

/**
 * What a step of the deck crossing brought (W5-C5, plan MF2 "says its progress on the deck"): the first tower passed
 * (`tower`: −1 south, +1 north, local x), mid-span on the way to the other one, the crossing done.
 */
export type DeckStep = { what: 'tower'; tower: -1 | 1 } | { what: 'half' } | { what: 'done' };

/** A tower counts as passed within this distance of it on the deck (u; plan MF2 "within 10 u of both towers"). */
export const DECK_TOWER_NEAR = 10;

/**
 * Golden Gate crossing on the deck (wave 5, W5-C5; plan MF2): passing within `near` u of one tower and then of the other
 * (local frame: towers at x = ±`tower`, z = 0), on the deck (y > `deckY`, |z| ≤ `halfWidth`) on your own the whole way;
 * leaving the deck, gliding or fast travel starts it again. Both ways count. Each step says what it brought (the first
 * tower, mid-span, done) so BAYBAY can say the progress; null otherwise. At 5 Hz a 20 u window cannot be skipped on foot,
 * by bike or by car (≤ 8.5 u/s).
 */
export function createDeckCrossing(opts: { tower?: number; near?: number; deckY?: number; halfWidth?: number } = {}) {
  const tower = opts.tower ?? 89.29, near = opts.near ?? DECK_TOWER_NEAR, deckY = opts.deckY ?? 12, halfWidth = opts.halfWidth ?? 8;
  let from: -1 | 1 | 0 = 0, half = false, epoch: number | null = null;
  const reset = () => { from = 0; half = false; };
  return {
    /** the tower passed first in this attempt (−1 south, +1 north, 0 none) */
    get from() { return from; },
    /** `local`: the player in the bridge's local frame (x along the deck, z across it) */
    step(local: Vec2, s: Pick<GoalSample, 'y' | 'mode' | 'epoch' | 'travelling'>): DeckStep | null {
      if (epoch !== null && s.epoch !== epoch) reset();
      epoch = s.epoch;
      const onDeck = s.y > deckY && Math.abs(local.z) <= halfWidth && Math.abs(local.x) <= tower + near + 50;
      if (!onDeck || s.travelling || !OWN_WAY.has(s.mode)) { reset(); return null; }
      const at = (side: -1 | 1) => Math.hypot(local.x - side * tower, local.z) <= near;
      if (from === 0) {
        if (at(-1)) { from = -1; return { what: 'tower', tower: -1 }; }
        if (at(1)) { from = 1; return { what: 'tower', tower: 1 }; }
        return null;
      }
      if (at(from === -1 ? 1 : -1)) { reset(); return { what: 'done' }; }
      if (!half && local.x * from <= 0) { half = true; return { what: 'half' }; }
      return null;
    },
  };
}

/** A far-zone (DataSF neighbourhood) id worth counting: not a hand-made hero zone (Ferry Building, Pier 39 …). */
const HERO_ZONES = new Set(DISTRICT.zones.map(zone => zone.id));
export const isNeighbourhoodId = (id: string | null | undefined): id is string => !!id && !HERO_ZONES.has(id);

/** New goalsDone ids for a visit to neighbourhood `id` (the `hood:` mark, plus the goal on the 8th). */
export function neighbourhoodVisit(goalsDone: readonly string[], id: string): string[] {
  const mark = `${HOOD_PREFIX}${id}`;
  if (goalsDone.includes(mark)) return [];
  const out = [mark];
  if (!goalsDone.includes(CITY_GOAL.neighbourhoods) && neighbourhoodsVisited(goalsDone) + 1 >= NEIGHBOURHOOD_TARGET) out.push(CITY_GOAL.neighbourhoods);
  return out;
}

/** A photo taken within `r` u of the Painted Ladies row counts (Alamo Square's slope is ≈ 30–60 u away). */
export const PAINTED_LADIES_PHOTO_R = 70;

