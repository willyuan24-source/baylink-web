import type { Bilingual } from '../core/types';
import { bayNow, bayParts } from '../game/bayNow';
import { festivalOn } from './festivalDate';
import { halloweenPhase } from './season';
import { lineText, type WorldLineKey } from './worldLines';

/**
 * Wave 9 · lane H · BAYBAY's line about the big Halloween days (pure: no three.js, no DOM; read by realsf/todayLine.ts
 * for the 'returning' welcome and by halloween/world.ts for a first visit's invitation): one FIXED line of
 * halloween/worldLines.ts (voiced by lane X), or null on any other day.
 *
 *   31 October  11:00–15:00 (the Chinatown festival, halloween/festivalDate.ts)   w9-h-today-festival
 *               any other hour (every door answers, double treats: treat.ts)      w9-h-today-big-night
 *   1–2 Nov     Día de los Muertos                                                 w6-h-muertos-hello (recorded in wave 6)
 *   2 Nov       16:00–21:00 (the gathering at 18:00, the walk 19:00–21:00)         w9-h-today-procession
 *
 * The review (2026-10-01, R§6 growth row): a player back on Halloween night at 19:30 heard the generic sunset / three
 * things line. A `?halloween=` preview counts (night → the big night; muertos → the hello: the procession follows the
 * real 2 November).
 */

/** 2 November: the procession's line from this minute after Bay midnight (two hours before the gathering) … */
export const PROCESSION_LINE_FROM = 16 * 60;
/** … until the walk ends (halloween/muertos.ts MUERTOS_TIMES.walkTo, 21:00). */
export const PROCESSION_LINE_TO = 21 * 60;

/** The key of today's big-day line at `now` (Bay clock), or null. */
export function halloweenTodayKey(now: Date = bayNow(), search?: string | null): WorldLineKey | null {
  const phase = halloweenPhase(now, search);
  if (phase === 'night') return festivalOn(now) ? 'todayFestival' : 'todayBigNight';
  if (phase !== 'muertos') return null;
  const p = bayParts(now), m = p.hour * 60 + p.minute;
  if (p.month === 11 && p.day === 2 && m >= PROCESSION_LINE_FROM && m < PROCESSION_LINE_TO) return 'todayProcession';
  return 'muertosHello';
}

/** A first visit hears the big day's line after this much play (s): the first minute belongs to the welcome. */
export const INVITE_AFTER_S = 90;
/** … and only while farther than this from the place the line is about (u): there, the place's own lines speak. */
export const INVITE_FAR = 60;

/**
 * The first visit's invitation (halloween/world.ts, once a Bay day through the season's line scheduler): today's
 * big-day key when the player has played INVITE_AFTER_S, is INVITE_FAR from its place and was not welcomed back with it
 * (a 'returning' welcome said todayLine, which is this line); else null.
 */
export function bigDayInvite(key: WorldLineKey | null, fromPlace: number, playS: number, returning: boolean): WorldLineKey | null {
  if (!key || returning || playS < INVITE_AFTER_S || fromPlace < INVITE_FAR) return null;
  return key;
}

/** Today's big-day line (a fixed, voiced text), or null on any other day. */
export function halloweenTodayLine(now: Date = bayNow(), search?: string | null): Bilingual | null {
  const k = halloweenTodayKey(now, search);
  return k ? lineText(k) : null;
}
