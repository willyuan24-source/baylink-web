import type { Bilingual } from '../../core/types';

/**
 * Wave 5 · lane T (W5-T7): the real service of the lines the game runs, for the station cards' honest rows ("海德线
 * 7:00–23:00 · 午间约10分钟一班 · 现在有车"). Pure data + one pure function; the game's own cars keep running round
 * the clock (a toy city), the rows only say what the real line does and when it was checked.
 *
 * Every row: SFMTA's route page for the line (the span of service and the MIDDAY headway of its frequency table, weekday
 * and weekend), read on `verifiedAt`. The sightseeing loop is the game's own line: no row (nothing real to promise).
 *   Powell–Hyde  "7 a.m. - 11 p.m. daily", midday weekday 10 / weekend 9   https://www.sfmta.com/routes/powell-hyde-cable-car
 *   Powell–Mason "7 a.m. - 11 p.m. daily", midday weekday 12 / weekend 10  https://www.sfmta.com/routes/powell-mason-cable-car
 *   California   "7 a.m. - 9 p.m. daily", midday 10 / 10                   https://www.sfmta.com/routes/california-cable-car
 *   F Market & Wharves "7 a.m. - 12 a.m. daily", midday 12 / 12             https://www.sfmta.com/routes/f-market-wharves
 *   N Judah      "24 hours daily" ("Between subway hours and Owl service, use the N Bus": the morning and late-night
 *                columns), midday weekday 10 / weekend 12                   https://www.sfmta.com/routes/n-judah
 *   M Ocean View "6 a.m. - 12 a.m. daily", midday weekday 10 / weekend 12  https://www.sfmta.com/routes/m-ocean-view
 * (W5-T review, the pages re-read 2026-09-28: the rows said one figure for every day and hour — "约10分钟一班" at 22:30
 * when the late-night column is 20, and the weekday figure for the N and the M on weekends, where the pages say 12.
 * They now say 午间 and take the day's column.)
 */

export interface LineService {
  /** the game's line id (transit.json / the map's LINE_STYLES) */
  line: string;
  /** the real line's short name, as the row says it */
  short: Bilingual;
  /** service span, minutes after midnight Bay time: [first, last); last may be 1440 (midnight). null = round the clock */
  span: readonly [number, number] | null;
  /** the midday headway the route page lists (minutes): weekday, weekend */
  midday: { readonly wd: number; readonly we: number };
  /** a short extra the row may carry */
  note?: Bilingual;
  sourceUrl: string;
  /** the Bay date the source was read */
  verifiedAt: string;
}

const V = '2026-09-28';

export const LINE_SERVICE: Readonly<Record<string, LineService>> = {
  'powell-hyde': { line: 'powell-hyde', short: { zh: '海德线', en: 'Powell–Hyde' }, span: [7 * 60, 23 * 60], midday: { wd: 10, we: 9 }, sourceUrl: 'https://www.sfmta.com/routes/powell-hyde-cable-car', verifiedAt: V },
  'powell-mason': { line: 'powell-mason', short: { zh: '梅森线', en: 'Powell–Mason' }, span: [7 * 60, 23 * 60], midday: { wd: 12, we: 10 }, sourceUrl: 'https://www.sfmta.com/routes/powell-mason-cable-car', verifiedAt: V },
  california: { line: 'california', short: { zh: '加州街线', en: 'California' }, span: [7 * 60, 21 * 60], midday: { wd: 10, we: 10 }, sourceUrl: 'https://www.sfmta.com/routes/california-cable-car', verifiedAt: V },
  'f-line': { line: 'f-line', short: { zh: 'F 线', en: 'F' }, span: [7 * 60, 24 * 60], midday: { wd: 12, we: 12 }, sourceUrl: 'https://www.sfmta.com/routes/f-market-wharves', verifiedAt: V },
  'n-judah': { line: 'n-judah', short: { zh: 'N 线', en: 'N' }, span: null, midday: { wd: 10, we: 12 }, note: { zh: '清早和深夜是巴士', en: 'early and late: the N bus' }, sourceUrl: 'https://www.sfmta.com/routes/n-judah', verifiedAt: V },
  'm-ocean-view': { line: 'm-ocean-view', short: { zh: 'M 线', en: 'M' }, span: [6 * 60, 24 * 60], midday: { wd: 10, we: 12 }, sourceUrl: 'https://www.sfmta.com/routes/m-ocean-view', verifiedAt: V },
};

const hhmm = (m: number) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, '0')}`;

/**
 * One station-card row for `line` at Bay wall-clock `hour:minute` on `weekday` (0 = Sunday … 6 = Saturday; absent: a
 * weekday), or null (a line with no real service row).
 */
export function serviceRow(line: string, at: { hour: number; minute: number; weekday?: number }): { line: string; text: Bilingual; running: boolean; state: Bilingual; sourceUrl: string; verifiedAt: string } | null {
  const s = LINE_SERVICE[line];
  if (!s) return null;
  const now = at.hour * 60 + at.minute;
  const running = !s.span || (now >= s.span[0] && now < s.span[1]);
  const hours: Bilingual = s.span
    ? { zh: `${hhmm(s.span[0])}–${s.span[1] >= 1440 ? '24:00' : hhmm(s.span[1])}`, en: `${hhmm(s.span[0])}–${s.span[1] >= 1440 ? '24:00' : hhmm(s.span[1])}` }
    : { zh: '24 小时', en: '24 h' };
  const weekend = at.weekday === 0 || at.weekday === 6;
  const every = weekend ? s.midday.we : s.midday.wd;
  const text: Bilingual = {
    zh: `${s.short.zh} ${hours.zh} · 午间约${every}分钟一班${s.note ? ` · ${s.note.zh}` : ''}`,
    en: `${s.short.en} ${hours.en} · midday about every ${every} min${s.note ? ` · ${s.note.en}` : ''}`,
  };
  const state: Bilingual = running ? { zh: '现在有车', en: 'running now' } : { zh: '现在收车了', en: 'not running now' };
  return { line, text, running, state, sourceUrl: s.sourceUrl, verifiedAt: s.verifiedAt };
}
