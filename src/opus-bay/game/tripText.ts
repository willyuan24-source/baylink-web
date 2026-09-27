import type { Bilingual } from '../core/types';

/**
 * Wave 4 · the ONE set of trip words (lane C, part 2; lane G's review O4, lane C's review O8). Before this module
 * three lanes wrote "约 N 分钟" three ways (lane G game/tripPlan.ts `tripTimeLabel` "~6s", lane P ui/tripRows.ts
 * `tripSecondsLabel` "~6 s" / "约 1 小时 5 分", lane C's tour texts "about 26 min") and two lanes wrote the quiet arrival
 * toast two ways (lane G "到了 · 名称", lane C the bare name). Every trip / tour / arrival time and toast now comes from
 * here; lanes G and P switch at integration (docs/opus-bay/sf-w4-C.md "Early phase · part 2" → Integration). Where a
 * trip to an island ends and what it is called (恶魔岛渡轮码头 · 33 号码头) has ONE source too: lane P's
 * data/sf/attractions.ts `ARRIVAL_PLACES` / `tripDestination(a)` (lane G's review O2); lane C's cards use its names.
 *
 * LIGHT on purpose (types only, no data): lane G's ui/guideText.ts and lane P's ui/tripRows.ts sit in the eager graph
 * and will import it.
 *
 * The time rule (`timeLabel`), honest play time rounded the way people say it:
 *   under 20 s   exact seconds, at least 1          约 6 秒 · ~6s
 *   20 s – 1 min 5-second steps                     约 40 秒 · ~40s        (57.5 s and up round to 1 minute)
 *   1 min – 1 h  whole minutes of the raw seconds   约 1 分钟 (60–89 s) · 约 2 分钟 (90 s) · ~4 min
 *   1 h and up   hours and minutes                  约 1 小时 · 约 1 小时 5 分钟 · ~1 h 5 min
 *   not a number (the A* has not answered)          计算中… · working it out…
 * Styles: `compact` (pills, rows, the waypoint: "~4 min"), `prose` (sentences, the recap, the call menu: "about 4
 * min"), `bare` (inside a list that already says "约" once: "4 分钟" / "4 min"). zh is the same in compact and prose.
 */

export type TimeStyle = 'compact' | 'prose' | 'bare';

export const PENDING_TIME: Bilingual = { zh: '计算中…', en: 'working it out…' };

interface TimeParts { unit: 's' | 'min' | 'h'; n: number; rest?: number }

/** The rounded amount a time label shows (exported for tests and for callers that need the number). */
export function timeParts(seconds: number): TimeParts | null {
  if (!Number.isFinite(seconds)) return null;
  const s0 = Math.max(0, seconds);
  const s = s0 < 20 ? Math.max(1, Math.round(s0)) : Math.round(s0 / 5) * 5;
  if (s < 60) return { unit: 's', n: s };
  const m = Math.max(1, Math.round(s0 / 60));
  if (m < 60) return { unit: 'min', n: m };
  return { unit: 'h', n: Math.floor(m / 60), rest: m % 60 };
}

/** "约 6 秒" / "约 40 秒" / "约 4 分钟" / "约 1 小时 5 分钟" and the English in the chosen style (see the header). */
export function timeLabel(seconds: number, style: TimeStyle = 'compact'): Bilingual {
  const p = timeParts(seconds);
  if (!p) return PENDING_TIME;
  let zh: string, en: string;
  if (p.unit === 's') { zh = `${p.n} 秒`; en = style === 'prose' ? `${p.n} sec` : `${p.n}s`; }
  else if (p.unit === 'min') { zh = `${p.n} 分钟`; en = `${p.n} min`; }
  else { zh = p.rest ? `${p.n} 小时 ${p.rest} 分钟` : `${p.n} 小时`; en = p.rest ? `${p.n} h ${p.rest} min` : `${p.n} h`; }
  if (style === 'bare') return { zh, en };
  return { zh: `约 ${zh}`, en: style === 'prose' ? `about ${en}` : `~${en}` };
}

/** A duration given in minutes (tour chapters, the Grand Tour): the same rule. */
export const minutesLabel = (minutes: number, style: TimeStyle = 'prose'): Bilingual => timeLabel(minutes * 60, style);

// ---------------------------------------------------------------------------------------------------------------
// The arrival toast (lane G shows it; lane C's arrival beats carry it)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The arrival toast: "抵达 · 艺术宫" (gold); in quiet places (memorials, churches, temples) "到了 · 圣依纳爵堂" (no gold,
 * no fanfare). One wording for lane C's `arrivalBeats().toast` and lane G's `arrivalToastText` (review O8).
 */
export function arrivalToast(name: Bilingual, quiet = false): Bilingual {
  return quiet ? { zh: `到了 · ${name.zh}`, en: `Here: ${name.en}` } : { zh: `抵达 · ${name.zh}`, en: `Arrived · ${name.en}` };
}
