import type { Bilingual } from '../core/types';
import { PICKUP_S, RISE_S } from './fastTravel';
import type { TripFlyLeg, TripLeg, TripOption } from './tripTypes';

/**
 * Wave 5 · lane N · W5-N9: 看风景飞过去 — the scenic flight as a trip option (pure, tiny: the map UI and the trip runner
 * read it; the flight itself is game/scenicFlight.ts, loaded with the trip runner).
 *
 * For mid distances (150–900 u, plan §3.2 "A-glide+") and once the pelican is unlocked, the map card lists it right
 * after the fast 飞过去: the pelican flies the way itself, low over the city with the glide's own camera; touch the stick
 * and you fly, let go and BAYBAY flies on; she lands at the destination. Never 推荐 and never a goal (as every fly row).
 */

export const SCENIC_TRIP = {
  /** offered for flights this long (u): below, the walk is short; above, the fast hop */
  minD: 150,
  maxD: 900,
  /**
   * the planner's speed (u/s): the autopilot boosts (20 u/s) except on turns and the approach. Measured in the game
   * (5502, part c): Ferry → Lombard 360 u in 22.5 s, Ferry → the Palace of Fine Arts 712 u in 41 s (tap to landing)
   */
  speed: 18.5,
  /** the landing curve (s, the planner's; game/fastTravel scenicDescentSeconds gives 2–3.2) */
  descentS: 2.6,
} as const;

/** The flight is offered for a trip this long (u). */
export const scenicFits = (d: number): boolean => Number.isFinite(d) && d >= SCENIC_TRIP.minD && d <= SCENIC_TRIP.maxD;

/** Honest seconds of a scenic flight over `d` u: the pickup and the rise, the flight, the landing. */
export function scenicSeconds(d: number): number {
  return PICKUP_S + RISE_S + Math.max(0, d) / SCENIC_TRIP.speed + SCENIC_TRIP.descentS;
}

/** A fly leg flown the scenic way (a structural extension of the frozen TripFlyLeg: it survives the trip's copies). */
export interface ScenicFlyLeg extends TripFlyLeg { scenic: true }
export const isScenicLeg = (l: TripLeg | null | undefined): l is ScenicFlyLeg => !!l && l.via === 'fly' && (l as Partial<ScenicFlyLeg>).scenic === true;
/** A whole option flown the scenic way. */
export const isScenicOption = (o: Pick<TripOption, 'mode' | 'legs'>): boolean => o.mode === 'fly' && isScenicLeg(o.legs[0]);

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
