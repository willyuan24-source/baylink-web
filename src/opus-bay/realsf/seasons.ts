import type { Bilingual } from '../core/types';
import { bayNow, bayParts } from '../game/bayNow';
import { halloweenPhase } from '../halloween/season';

/**
 * Wave 5 · lane R (W5-R1) · sourced seasons and hours the world follows (plan §3.3 item 4, §4.3 hooks).
 *
 *   isFireRingLit(date)    Ocean Beach's fire rings may burn: 1 March – 31 October, 06:00 – 21:30 Bay time (lane L wires
 *                          the rings' glow to it; the glow shows at night only, so in season it lights from dusk to 21:30)
 *   fireRingSeason(date)   the Bay date is inside the 1 March – 31 October program
 *   karlMonthFactor(date)  how foggy the month usually is, 0 … 1 (July 1; October the clearest); climatology, "通常"
 *
 * Everything reads the Bay clock through game/bayNow.ts, so `?date=` (DEV / QA builds) moves it.
 */

export interface SourcedRule { sourceUrl: string; verifiedAt: string }

/**
 * NPS "Ocean Beach Fire Program" (checked 2026-09-28): fire rings available 1 March through 31 October; fires allowed
 * 6:00 am – 9:30 pm, then put out with water only; 16 rings, first come, first served; fires only in the rings.
 */
export const FIRE_RINGS = {
  from: { month: 3, day: 1 },
  to: { month: 10, day: 31 },
  /** minutes after Bay midnight */
  open: 6 * 60,
  close: 21 * 60 + 30,
  sourceUrl: 'https://www.nps.gov/articles/ocean-beach-fire-program.htm',
  verifiedAt: '2026-09-28',
} as const;

const md = (month: number, day: number) => month * 100 + day;

/** The Bay date of `date` is inside the fire-ring program (1 March – 31 October). */
export function fireRingSeason(date: Date = bayNow()): boolean {
  const p = bayParts(date);
  const k = md(p.month, p.day);
  return k >= md(FIRE_RINGS.from.month, FIRE_RINGS.from.day) && k <= md(FIRE_RINGS.to.month, FIRE_RINGS.to.day);
}

/** Fires may burn in Ocean Beach's rings right now: in season and between 06:00 and 21:30 Bay time. */
export function isFireRingLit(date: Date = bayNow()): boolean {
  if (!fireRingSeason(date)) return false;
  const p = bayParts(date);
  const m = p.hour * 60 + p.minute;
  return m >= FIRE_RINGS.open && m < FIRE_RINGS.close;
}

/** BAYBAY on the season's last day at Ocean Beach (≤ 45 zh characters). */
export const FIRE_SEASON_LAST_DAY: Bilingual = { zh: '海滩篝火季到 10 月底，11 月起就不能生火啦。', en: 'Beach-fire season ends with October — no fires from November.' };

/**
 * How foggy (Karl) a month usually is, 0 … 1: summer fog peaks in July (June "gloom", August easing), September and
 * October are the clearest, late April – May clear often too. Qualitative climatology, always worded 通常 / usually:
 * SFBayWeather "When does San Francisco's summer fog peak?" (checked 2026-09-28).
 */
export const KARL_BY_MONTH = [0.4, 0.4, 0.45, 0.45, 0.6, 0.85, 1, 0.9, 0.45, 0.35, 0.35, 0.4] as const;
export const KARL_SOURCE: SourcedRule = { sourceUrl: 'https://www.sfbayweather.com/learn/when-does-sf-fog-peak', verifiedAt: '2026-09-28' };

/**
 * (W6-H4) On a Halloween-season evening (halloween/season.ts 'season' / 'night': 1–31 October, or a `?halloween=`
 * preview) from 18:00 to 06:00 Bay time, Karl comes in a little thicker and lower over the west side — the game's
 * spooky-but-cosy mood, NOT climatology (October stays the clearest month by day). A uniform-level change: no cost.
 */
export const HALLOWEEN_NIGHT_KARL = 0.6;

/** Karl's usual strength for the Bay month of `date` (0 … 1); a Halloween-season evening at least HALLOWEEN_NIGHT_KARL. */
export function karlMonthFactor(date: Date = bayNow()): number {
  const p = bayParts(date);
  const base = KARL_BY_MONTH[p.month - 1] ?? 0.5;
  const phase = halloweenPhase(date);
  if (phase !== 'season' && phase !== 'night') return base;
  return p.hour >= 18 || p.hour < 6 ? Math.max(base, HALLOWEEN_NIGHT_KARL) : base;
}
