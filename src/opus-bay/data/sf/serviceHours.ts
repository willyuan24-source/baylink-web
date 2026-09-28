import type { Bilingual } from '../../core/types';

/**
 * Wave 5 · lane T (W5-T7): the real service of the lines the game runs, for the station cards' honest rows ("现实
 * 7:00–23:00 · 约 10 分钟一班 · 现在运营中"). Pure data + one pure function; the game's own cars keep running round
 * the clock (a toy city), the rows only say what the real line does and when it was checked.
 *
 * Every row: SFMTA's route page for the line (the span of service and the midday headway it lists), read on
 * `verifiedAt`. The sightseeing loop is the game's own line: no row (nothing real to promise).
 *   Powell–Hyde  "7 a.m. - 11 p.m. daily", weekday midday 10 min   https://www.sfmta.com/routes/powell-hyde-cable-car
 *   Powell–Mason "7 a.m. - 11 p.m. daily", weekday midday 12 min   https://www.sfmta.com/routes/powell-mason-cable-car
 *   California   "7 a.m. - 9 p.m. daily", midday 10 min            https://www.sfmta.com/routes/california-cable-car
 *   F Market & Wharves "7 a.m. - 12 a.m. daily", midday 12 min      https://www.sfmta.com/routes/f-market-wharves
 *   N Judah      "24 hours daily" (the N bus between subway hours and owl service), midday 10 min
 *                                                                  https://www.sfmta.com/routes/n-judah
 *   M Ocean View "6 a.m. - 12 a.m. daily", weekday midday 10 min   https://www.sfmta.com/routes/m-ocean-view
 */

export interface LineService {
  /** the game's line id (transit.json / the map's LINE_STYLES) */
  line: string;
  /** the real line's short name, as the row says it */
  short: Bilingual;
  /** service span, minutes after midnight Bay time: [first, last); last may be 1440 (midnight). null = round the clock */
  span: readonly [number, number] | null;
  /** the midday headway the route page lists (minutes; a range when weekdays and weekends differ) */
  every: readonly [number, number];
  /** a short extra the row may carry */
  note?: Bilingual;
  sourceUrl: string;
  /** the Bay date the source was read */
  verifiedAt: string;
}

const V = '2026-09-28';

export const LINE_SERVICE: Readonly<Record<string, LineService>> = {
  'powell-hyde': { line: 'powell-hyde', short: { zh: '海德线', en: 'Powell–Hyde' }, span: [7 * 60, 23 * 60], every: [9, 10], sourceUrl: 'https://www.sfmta.com/routes/powell-hyde-cable-car', verifiedAt: V },
  'powell-mason': { line: 'powell-mason', short: { zh: '梅森线', en: 'Powell–Mason' }, span: [7 * 60, 23 * 60], every: [10, 12], sourceUrl: 'https://www.sfmta.com/routes/powell-mason-cable-car', verifiedAt: V },
  california: { line: 'california', short: { zh: '加州街线', en: 'California' }, span: [7 * 60, 21 * 60], every: [10, 10], sourceUrl: 'https://www.sfmta.com/routes/california-cable-car', verifiedAt: V },
  'f-line': { line: 'f-line', short: { zh: 'F 线', en: 'F' }, span: [7 * 60, 24 * 60], every: [12, 12], sourceUrl: 'https://www.sfmta.com/routes/f-market-wharves', verifiedAt: V },
  'n-judah': { line: 'n-judah', short: { zh: 'N 线', en: 'N' }, span: null, every: [10, 10], note: { zh: '深夜换 N 线巴士', en: 'late night: the N bus' }, sourceUrl: 'https://www.sfmta.com/routes/n-judah', verifiedAt: V },
  'm-ocean-view': { line: 'm-ocean-view', short: { zh: 'M 线', en: 'M' }, span: [6 * 60, 24 * 60], every: [10, 10], sourceUrl: 'https://www.sfmta.com/routes/m-ocean-view', verifiedAt: V },
};

const hhmm = (m: number) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, '0')}`;

/** One station-card row for `line` at Bay wall-clock `hour:minute`, or null (a line with no real service row). */
export function serviceRow(line: string, at: { hour: number; minute: number }): { line: string; text: Bilingual; running: boolean; state: Bilingual; sourceUrl: string; verifiedAt: string } | null {
  const s = LINE_SERVICE[line];
  if (!s) return null;
  const now = at.hour * 60 + at.minute;
  const running = !s.span || (now >= s.span[0] && now < s.span[1]);
  const hours: Bilingual = s.span
    ? { zh: `${hhmm(s.span[0])}–${s.span[1] >= 1440 ? '24:00' : hhmm(s.span[1])}`, en: `${hhmm(s.span[0])}–${s.span[1] >= 1440 ? '24:00' : hhmm(s.span[1])}` }
    : { zh: '24 小时', en: '24 h' };
  const every = s.every[0] === s.every[1] ? `${s.every[0]}` : `${s.every[0]}–${s.every[1]}`;
  const text: Bilingual = {
    zh: `${s.short.zh} ${hours.zh} · 约${every}分钟一班${s.note ? ` · ${s.note.zh}` : ''}`,
    en: `${s.short.en} ${hours.en} · about every ${every} min${s.note ? ` · ${s.note.en}` : ''}`,
  };
  const state: Bilingual = running ? { zh: '现在有车', en: 'running now' } : { zh: '现在收车了', en: 'not running now' };
  return { line, text, running, state, sourceUrl: s.sourceUrl, verifiedAt: s.verifiedAt };
}
