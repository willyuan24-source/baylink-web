import { bayDateOverrideAllowed, bayNow, bayParts } from '../game/bayNow';

/**
 * Wave 6 day 0 (FROZEN API, docs/opus-bay/sf-w6-lead.md §4) · the Halloween season the toy city follows, on the Bay
 * clock (game/bayNow.ts, so `?date=` moves it in DEV / QA builds).
 *
 *   halloweenPhase(date)   'off' | 'season' (1–30 October) | 'night' (31 October) | 'muertos' (1–2 November)
 *   inHalloween(date)      the phase is not 'off'
 *   isTreatHour(date)      16:00–22:00 Bay time (doors answer brightest then; the lanes decide what the day does)
 *   halloweenPreview()     `?halloween=1|season|night|muertos` forces a phase in ANY build (production too), so the owner
 *                          can try the season before 1 October; `?halloween=0` / `off` forces it off
 *
 * Lanes H (the world) and G (the games) read only this; nobody else decides the dates.
 */

export type HalloweenPhase = 'off' | 'season' | 'night' | 'muertos';

export const HALLOWEEN_DATES = {
  /** dressing, the pumpkin hunt, costumes in the shop */
  seasonFrom: { month: 10, day: 1 },
  /** the big night (every door answers, double treats) */
  night: { month: 10, day: 31 },
  /** Día de los Muertos closes the season (1–2 November) */
  muertosTo: { month: 11, day: 2 },
  /** minutes after Bay midnight */
  treatFrom: 16 * 60,
  treatTo: 22 * 60,
} as const;

const PREVIEW: Readonly<Record<string, HalloweenPhase>> = { '1': 'season', season: 'season', night: 'night', muertos: 'muertos', '0': 'off', off: 'off' };

let previewCache: { search: string; phase: HalloweenPhase | null } | null = null;

/** The phase `?halloween=` forces, or null (no parameter, an unknown value, or no `location`: node tests). */
export function halloweenPreview(search: string | null = typeof location === 'undefined' ? null : location.search): HalloweenPhase | null {
  if (search == null) return null;
  if (previewCache && previewCache.search === search) return previewCache.phase;
  const v = new URLSearchParams(search).get('halloween');
  const phase = v == null ? null : PREVIEW[v.trim().toLowerCase()] ?? null;
  previewCache = { search, phase };
  return phase;
}

/** The phase of the Bay date of `date` (default: now). A `?halloween=` preview wins over the date. */
export function halloweenPhase(date: Date = bayNow(), search?: string | null): HalloweenPhase {
  const forced = halloweenPreview(search);
  if (forced) return forced;
  const p = bayParts(date);
  if (p.month === 10) return p.day === HALLOWEEN_DATES.night.day ? 'night' : 'season';
  if (p.month === 11 && p.day <= HALLOWEEN_DATES.muertosTo.day) return 'muertos';
  return 'off';
}

export const inHalloween = (date: Date = bayNow(), search?: string | null): boolean => halloweenPhase(date, search) !== 'off';

/** 16:00–22:00 Bay time. */
export function isTreatHour(date: Date = bayNow()): boolean {
  const p = bayParts(date);
  const m = p.hour * 60 + p.minute;
  return m >= HALLOWEEN_DATES.treatFrom && m < HALLOWEEN_DATES.treatTo;
}

/** Whether `?date=` may move the clock here (re-exported so the lanes' QA notes can say which build they used). */
export const halloweenDateOverride = bayDateOverrideAllowed;
