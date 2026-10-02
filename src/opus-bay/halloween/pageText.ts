import type { Bilingual } from '../core/types';
import { bayNow, bayParts } from '../game/bayNow';
import { HALLOWEEN_DATES, type HalloweenPhase } from './season';

/**
 * Wave 9 · lane H · the 万圣节 page's head line (halloween/HalloweenPage.tsx; pure, tested). Not a BAYBAY line (never
 * voiced), so it may carry a number.
 *
 * The review (2026-10-01, R§6 language row, gamer/notes.md): the season's line said 「1–30 October」 while the page's own
 * postcard said "Trick-or-treat on Halloween, 31 October" — it read as if the season stopped before Halloween. The season
 * line now says the whole of October and counts down to the big night (31 October: every door answers, double treats).
 */
export function phaseLine(phase: HalloweenPhase, now: Date = bayNow()): Bilingual {
  if (phase === 'night') return { zh: '今晚是万圣节大夜晚：每家都开门，糖果加倍！', en: 'Tonight is Halloween: every door answers, and the treats are doubled!' };
  if (phase === 'muertos') return { zh: '11 月 1–2 日是亡灵节：万圣节讨糖结束啦。', en: '1–2 November is Día de los Muertos: trick-or-treating is over for the year.' };
  if (phase === 'off') return { zh: '万圣节是每年 10 月。', en: 'Halloween comes every October.' };
  const p = bayParts(now);
  // a `?halloween=1` preview outside October has no countdown
  const left = p.month === HALLOWEEN_DATES.night.month ? HALLOWEEN_DATES.night.day - p.day : 0;
  const soon = left <= 0 ? null : left === 1 ? { zh: '明天就是！', en: 'that’s tomorrow!' } : { zh: `还有 ${left} 天！`, en: `${left} days to go!` };
  return {
    zh: `整个 10 月都能敲门讨糖、找南瓜灯，天黑后门廊灯更亮。万圣夜（10 月 31 日）每家都开门、糖果加倍${soon ? `——${soon.zh}` : '！'}`,
    en: `All October: trick-or-treat and hunt for jack-o’-lanterns; the porch lights glow brighter after dark. On Halloween night (31 October) every door answers with double treats${soon ? ` — ${soon.en}` : '!'}`,
  };
}
