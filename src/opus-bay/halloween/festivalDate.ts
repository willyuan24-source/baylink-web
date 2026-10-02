import { bayParts } from '../game/bayNow';

/**
 * Wave 9 · lane H · the Chinatown Halloween Festival's date and hours, pure (no three.js): the kit
 * (halloween/worldFestival.ts, which re-exports these) and BAYBAY's 31 October greeting (halloween/today.ts, read by
 * realsf/todayLine.ts) share one rule.
 *
 * Facts (checked 2026-10-01): https://www.cycsf.org/chinatown-halloween-festival/ — "Saturday, October 31, 2026, from
 * 11am-3pm", Waverly Place, the Community Youth Center (wave 8 read it on 2026-09-30; the page still says the same).
 */
export const FESTIVAL = { id: 'chinatown-halloween-festival-2026', date: '2026-10-31', from: 11 * 60, to: 15 * 60 } as const;

/** Whether the festival is on at `now` (the Bay clock): 31 October 2026, 11:00 ≤ t < 15:00. */
export function festivalOn(now: Date): boolean {
  const p = bayParts(now);
  const m = p.hour * 60 + p.minute;
  return p.dateKey === FESTIVAL.date && m >= FESTIVAL.from && m < FESTIVAL.to;
}
