import { AUTO_GLIDE } from '../actors/glide';
import type { Bilingual } from '../core/types';
import type { TripFlyLeg, TripLeg, TripOption } from './tripTypes';

/**
 * Wave 5 · lane N · W5-N9 (plan sf-w5-plan.md §3.2 "A-glide+", §4.5 item 9): 看风景飞过去 — the scenic auto-glide as a
 * trip option (pure, tiny: the map UI and the trip runner read it).
 *
 * For mid distances (150–900 u) once the pelican is unlocked, the map card lists it right after the fast 飞过去: the
 * pelican flies the way itself in the free glide (lane F's W5-F10 `moveApi.autoGlide`: it takes off toward the
 * destination, holds a sightseeing height over the roofs, boosts on the straight, lands about 20 u out facing open
 * ground); a push of the stick hands the wings to the player (a free glide from there: G / 降落 lands). The trip runner
 * (game/tripRun.ts) starts it for a scenic leg and walks the player (carried) from the landing to the trip's end. Never
 * 推荐 and never a goal (as every fly row).
 */

export const SCENIC_TRIP = {
  /** offered for flights this long (u): below, the walk is short; above, the fast hop (lane F's AUTO_GLIDE.maxDist) */
  minD: 150,
  maxD: AUTO_GLIDE.maxDist,
  /** the take-off swoop (s: the glide's own, actors/glide takeOff) */
  takeoffS: 1,
  /**
   * the planner's speed (u/s) over the straight-line distance: lane F's autopilot boosts (20 u/s) on the straight and
   * slows on the approach. Measured in the game (5502, part c, tap to the trip's end): see the report
   */
  speed: 18.5,
  /** the landing curve (2–3 s) and the carried walk from the landing (lane F sets down within ~10 u) to the trip's end (s) */
  landS: 2.5,
  walkS: 1.5,
} as const;

/** The flight is offered for a trip this long (u). */
export const scenicFits = (d: number): boolean => Number.isFinite(d) && d >= SCENIC_TRIP.minD && d <= SCENIC_TRIP.maxD;

/** Honest seconds of a scenic flight over `d` u: the take-off, the flight, the landing and the last few steps. */
export function scenicSeconds(d: number): number {
  return SCENIC_TRIP.takeoffS + Math.max(0, d) / SCENIC_TRIP.speed + SCENIC_TRIP.landS + SCENIC_TRIP.walkS;
}

/** Seconds left of a scenic flight from `pos` (the pilot's position: the player rides the pelican) to `to`, ≤ the leg's. */
export function scenicSecondsLeft(leg: Pick<TripFlyLeg, 'to' | 'seconds'>, pos: { x: number; z: number }): number {
  const d = Math.hypot(leg.to.x - pos.x, leg.to.z - pos.z);
  return Math.min(leg.seconds, d / SCENIC_TRIP.speed + SCENIC_TRIP.landS + SCENIC_TRIP.walkS);
}

/** A fly leg flown the scenic way (a structural extension of the frozen TripFlyLeg: it survives the trip's copies). */
export interface ScenicFlyLeg extends TripFlyLeg { scenic: true }
export const isScenicLeg = (l: TripLeg | null | undefined): l is ScenicFlyLeg => !!l && l.via === 'fly' && (l as Partial<ScenicFlyLeg>).scenic === true;
/** A whole option flown the scenic way. */
export const isScenicOption = (o: Pick<TripOption, 'mode' | 'legs'>): boolean => o.mode === 'fly' && isScenicLeg(o.legs[0]);

/**
 * (W5-N review) Is 让 BAYBAY 接着飞 on offer (pure; ui/GuideLayer's chip)? Only where lane F's auto-glide takes the
 * wings back: a scenic leg, the player gliding on their own wings, its end at least AUTO_GLIDE.minDist (60 u) away —
 * closer, the glide refuses and the chip did nothing when tapped (降落 / G lands; BAYBAY walks the rest).
 */
export function scenicResumeOffered(o: { gliding: boolean; autoGliding: boolean; leg: TripLeg | null | undefined; pos: { x: number; z: number } }): boolean {
  if (!o.gliding || o.autoGliding || !isScenicLeg(o.leg)) return false;
  const d = Math.hypot(o.leg.to.x - o.pos.x, o.leg.to.z - o.pos.z);
  return d >= AUTO_GLIDE.minDist && d <= AUTO_GLIDE.maxDist;
}

/** The row's name (ui/tripRows optionTitle) and the go button's. */
export const SCENIC_NAME: Bilingual = { zh: '看风景飞过去', en: 'Scenic flight' };
/** The row's second line: what the flight is. */
export const SCENIC_NOTE: Bilingual = { zh: '低空慢慢飞 · 能自己开', en: 'Low and slow · you can steer' };

/** The scenic twin of a fast fly option (null: not a one-leg fly option, or not a mid distance). */
export function scenicOption(fly: TripOption): TripOption | null {
  const leg = fly.mode === 'fly' && fly.legs.length === 1 ? fly.legs[0] : null;
  if (!leg || leg.via !== 'fly' || isScenicLeg(leg) || !scenicFits(leg.length)) return null;
  const seconds = scenicSeconds(leg.length);
  const to = leg.to.name;
  const scenic: ScenicFlyLeg = {
    ...leg, scenic: true, seconds,
    label: { zh: `看风景飞到${to?.zh ?? '目的地'}`, en: `Scenic flight to ${to?.en ?? 'there'}` },
  };
  return { mode: 'fly', legs: [scenic], seconds, note: SCENIC_NOTE };
}

/**
 * The options with the scenic flight right after the fast one (once the pelican is unlocked; never 推荐): the map
 * card's 其他方式 and 换个方式 rows. Pure; the planner's list is untouched (game/tripPlan planTrips).
 */
export function withScenic(options: readonly TripOption[], unlocked: boolean): TripOption[] {
  if (!unlocked || options.some(isScenicOption)) return [...options];
  const i = options.findIndex(o => o.mode === 'fly' && !isScenicOption(o));
  const s = i >= 0 ? scenicOption(options[i]) : null;
  return s ? [...options.slice(0, i + 1), s, ...options.slice(i + 1)] : [...options];
}
