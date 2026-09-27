import type { MoveMode } from '../core/store';
import type { Vec2 } from '../core/types';
import { DISTRICT } from '../data/district';
import { CITY_GOAL, HOOD_PREFIX, NEIGHBOURHOOD_TARGET, neighbourhoodsVisited } from '../data/sf/goals';
import { LANDMARK_ARRIVALS } from '../data/sf/arrivals';
import { cityPoiId } from '../data/sf/cityPois';
import type { GoalTarget } from './cityContent';

/**
 * City goal detectors (lane G2, plan G2-5). The goals themselves are data/sf/goals.ts; `postcards`, `cable-car` (lane F
 * calls completeGoal after a counted ride) and `viewpoint` (Coit's sweep) complete through game/flow. The detectors
 * below are pure state machines (tested with synthetic input in tests/opus-bay-sf-content.test.ts); game/cityLive.ts
 * (its own chunk, with the landmark library: P7) feeds them from the runtime at 5 Hz and completes goals through the
 * `done` callback flow passes in. This module stays in the main graph (the waypoints), so it imports no world/sf code.
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
 * Golden Gate crossing on the deck: local x (bridge frame, towers at ±GGB.TOWER) from ≤ −`end` to ≥ +`end` or back,
 * staying on the deck (y > `deckY`) on your own the whole way; leaving the deck, gliding or fast travel resets it.
 */
export function createDeckCrossing(opts: { end?: number; deckY?: number; halfWidth?: number } = {}) {
  const end = opts.end ?? 89, deckY = opts.deckY ?? 12, halfWidth = opts.halfWidth ?? 8;
  let from: -1 | 1 | 0 = 0, epoch: number | null = null;
  return {
    get from() { return from; },
    /** `local`: the player in the bridge's local frame (x along the deck, z across it) */
    step(local: Vec2, s: Pick<GoalSample, 'y' | 'mode' | 'epoch' | 'travelling'>): boolean {
      if (epoch !== null && s.epoch !== epoch) from = 0;
      epoch = s.epoch;
      const onDeck = s.y > deckY && Math.abs(local.z) <= halfWidth && Math.abs(local.x) <= end + 60;
      if (!onDeck || s.travelling || !OWN_WAY.has(s.mode)) { from = 0; return false; }
      if (local.x <= -end) { if (from === 1) { from = 0; return true; } from = -1; }
      else if (local.x >= end) { if (from === -1) { from = 0; return true; } from = 1; }
      return false;
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

/** Soft waypoints for unfinished city goals (game/cityContent goalTargets): the landmark card of each place goal. */
export function cityGoalTargets(): GoalTarget[] {
  const out: GoalTarget[] = [];
  const add = (goal: string, landmark: string, name: GoalTarget['name']) => {
    const at = LANDMARK_ARRIVALS[landmark];
    if (at) out.push({ id: cityPoiId(landmark), goal, x: at.x, z: at.z, name, radius: 4 });
  };
  add(CITY_GOAL.cableCar, 'cable-car-turntable', { zh: '叮当车 · Powell & Market 转车台', en: 'Cable car · Powell & Market turntable' });
  add(CITY_GOAL.twinPeaks, 'twin-peaks', { zh: '爬上双峰', en: 'Climb Twin Peaks' });
  add(CITY_GOAL.goldenGate, 'golden-gate-bridge', { zh: '走过金门大桥', en: 'Cross the Golden Gate Bridge' });
  add(CITY_GOAL.paintedLadies, 'painted-ladies', { zh: '给彩绘女士拍张照', en: 'Photograph the Painted Ladies' });
  return out;
}
