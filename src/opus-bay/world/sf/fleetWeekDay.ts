import { bayNow, bayParts, parseBayDate } from '../../game/bayNow';

/**
 * Wave 8 · lane S (W8-S2) · when the Parade of Ships sails (pure and tiny: realsf/index.ts imports it to decide whether
 * to load the parade's lazy chunk, world/sf/fleetWeek.ts; another lane can ask `paradeOn()` without loading the ships).
 *
 * San Francisco Fleet Week 2026's Parade of Ships: "Friday 10/9 11:00 am - 12:00 pm", the ships sail "under the Golden
 * Gate Bridge", "the procession of ships can be seen from the Golden Gate Bridge to the Bay Bridge", "a reviewing stand
 * at the Marina Green", and the San Francisco Fire Department's fireboat leads "shooting jets of water into the air"
 * (https://fleetweeksf.org/events/parade-of-ships/, read 2026-09-30). The toy line keeps that hour on the Bay clock.
 */

export const PARADE_SOURCE = { sourceUrl: 'https://fleetweeksf.org/events/parade-of-ships/', verifiedAt: '2026-09-30' } as const;
/** the Bay date and the window (minutes after Bay midnight) */
export const PARADE_DAY = '2026-10-09';
export const PARADE_FROM = 11 * 60;
export const PARADE_TO = 12 * 60;

let windowCache: { open: number; close: number } | null = null;
/** The parade's window as instants (ms). */
export function paradeWindow(): { open: number; close: number } {
  if (windowCache) return windowCache;
  const at = (min: number) => parseBayDate(`${PARADE_DAY}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`)!.getTime();
  windowCache = { open: at(PARADE_FROM), close: at(PARADE_TO) };
  return windowCache;
}

/** The parade's Bay day (its lines and its chunk). */
export const isParadeDay = (date: Date = bayNow()) => bayParts(date).dateKey === PARADE_DAY;

/** The ships are sailing now (9 Oct 2026, 11:00–12:00 Bay time). */
export function paradeOn(date: Date = bayNow()): boolean {
  const w = paradeWindow(), t = date.getTime();
  return t >= w.open && t < w.close;
}

/**
 * (W8-S4) What the Marina Green spot (the jets' WATCH, the parade's reviewing stand) offers for the parade: 'soon' on the
 * parade's morning before 11:00 (舰船巡游 · 码头绿地 → the Fleet Week card; BAYBAY's 今天上午十一点… line sends the
 * player there), 'on' while the ships sail (拍舰船巡游 → photo mode), else null (the jets' own prompt).
 */
export function paradeWatchState(date: Date = bayNow()): 'soon' | 'on' | null {
  if (paradeOn(date)) return 'on';
  return isParadeDay(date) && date.getTime() < paradeWindow().open ? 'soon' : null;
}

/**
 * (W8-S review, S-P5) realsf/index.ts holds the jets' lines on the parade's Bay day while the parade's lazy chunk is
 * still loading: the scheduler offers the parade's lines first (11:00 before the noon air show), but on the first ticks
 * after a load the parade is not there yet, so a player who opened the game on the parade morning heard the jets' noon
 * line first. A chunk that failed for good never mutes the jets.
 */
export function holdJetsForParade(date: Date, parade: { ready: boolean; failed: boolean }): boolean {
  return isParadeDay(date) && !parade.ready && !parade.failed;
}
