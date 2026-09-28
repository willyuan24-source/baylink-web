import type { Bilingual } from '../core/types';
import { bayNow, bayParts } from '../game/bayNow';
import { MOON_LABELS, moonPhase } from '../realsf/moon';
import { sunHm, sunTimes } from '../realsf/sun';

/**
 * Wave 5 · lane E · W5-E5: the 手帐's header — today's real San Francisco in one line, from lane R's sun and moon
 * (realsf/sun.ts: NOAA's equations checked against the US Naval Observatory; realsf/moon.ts: the phase, said as 约 /
 * about). The Bay date and weekday come from game/bayNow (`?date=` in DEV / QA builds).
 *
 * W5-E-review: the sunset is printed as the almanacs print it and as BAYBAY says it (lane R's `sunHm`, rounded to the
 * nearest minute; `bayHm` truncated it, so on about half the days the page was a minute earlier than the US Naval
 * Observatory and than BAYBAY's own sunset line — 2026-10-31: 18:11 here, 18:12 in both). The moon is tonight's (at
 * today's sunset), not the one of the hour the page is opened: 今晚约是… read at 08:00 said the morning's phase.
 */

const WEEK_ZH = '日一二三四五六';
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function todayLine(now: Date = bayNow()): Bilingual {
  const p = bayParts(now);
  const sunset = sunTimes(now).sunset;
  const sun = sunHm(sunset);
  const moon = MOON_LABELS[moonPhase(sunset).name];
  return {
    zh: `旧金山 ${p.month}月${p.day}日 周${WEEK_ZH[p.weekday]} · 日落 ${sun} · 今晚约是${moon.zh}`,
    en: `San Francisco today · ${WEEK_EN[p.weekday]} ${p.day} ${MONTH_EN[p.month - 1]} · sunset ${sun} · tonight about a ${moon.en.toLowerCase()}`,
  };
}
