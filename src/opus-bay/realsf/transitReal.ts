import type { Bilingual, Vec2 } from '../core/types';
import { distanceKm, walkMinutes, weekday } from '../data/catalog';
import { unprojectCity } from '../core/geo';
import { flineJson, transitData, transitW4, type TransitLineJson } from '../data/transit';

/**
 * Wave 5 · lane R (W5-R7) · 现实中怎么去 (plan §3.3 should, proposal S5): the real Muni lines the game also runs, their
 * real service hours and daytime headways from sfmta.com's route pages, and the nearest real stop to a point with the
 * walking minutes. Route names are descriptive only (no marks); every row says 出发前查 SFMTA / 511 确认.
 *
 * sfmta.com route pages, checked 2026-09-28 (hours; headways in minutes, morning / midday / evening / late night / owl):
 *   N Judah       24 hours daily (between subway hours and Owl service, the N bus) · weekday 10 10 10 20 30 · weekend 12 12 12 20 30
 *   M Ocean View  6 a.m. – 12 a.m. daily · weekday 10 10 10 20 · weekend 15 12 10 20
 *   F Market & Wharves  7 a.m. – 12 a.m. daily · weekday 20 12 12 20 · weekend 20 12 12 20
 *   Powell–Hyde cable car   7 a.m. – 11 p.m. daily · weekday 20 10 7 20 · weekend 20 9 12 20
 *   Powell–Mason cable car  7 a.m. – 11 p.m. daily · weekday 10 – 12 20 · weekend 10 10 10 20
 *   California cable car    7 a.m. – 9 p.m. daily · weekday 20 10 10 · weekend 20 10 10
 * The game's sightseeing loop is the game's own (not a real route): it is never listed here.
 */

export interface RealLine {
  id: string;
  name: Bilingual;
  /** service hours [first, last] in minutes after Bay midnight; null = 24 hours */
  hours: [number, number] | null;
  /** daytime headways (minutes): weekday and weekend [min, max] over the morning, midday and evening columns */
  day: { wd: [number, number]; we: [number, number] };
  /** after the daytime columns (late night / owl), when the page gives one */
  night?: number;
  sourceUrl: string;
  verifiedAt: string;
}

const CHECKED = '2026-09-28';
const H = (h: number) => h * 60;
export const REAL_LINES: Readonly<Record<string, RealLine>> = {
  'n-judah': { id: 'n-judah', name: { zh: 'N 线', en: 'N Judah' }, hours: null, day: { wd: [10, 10], we: [12, 12] }, night: 20, sourceUrl: 'https://www.sfmta.com/routes/n-judah', verifiedAt: CHECKED },
  'm-ocean-view': { id: 'm-ocean-view', name: { zh: 'M 线', en: 'M Ocean View' }, hours: [H(6), H(24)], day: { wd: [10, 10], we: [10, 15] }, night: 20, sourceUrl: 'https://www.sfmta.com/routes/m-ocean-view', verifiedAt: CHECKED },
  'f-line': { id: 'f-line', name: { zh: 'F 线复古电车', en: 'F Market & Wharves' }, hours: [H(7), H(24)], day: { wd: [12, 20], we: [12, 20] }, night: 20, sourceUrl: 'https://www.sfmta.com/routes/f-market-wharves', verifiedAt: CHECKED },
  'powell-hyde': { id: 'powell-hyde', name: { zh: '鲍威尔-海德线缆车', en: 'Powell–Hyde cable car' }, hours: [H(7), H(23)], day: { wd: [7, 20], we: [9, 20] }, night: 20, sourceUrl: 'https://www.sfmta.com/routes/powell-hyde-cable-car', verifiedAt: CHECKED },
  'powell-mason': { id: 'powell-mason', name: { zh: '鲍威尔-梅森线缆车', en: 'Powell–Mason cable car' }, hours: [H(7), H(23)], day: { wd: [10, 12], we: [10, 10] }, night: 20, sourceUrl: 'https://www.sfmta.com/routes/powell-mason-cable-car', verifiedAt: CHECKED },
  california: { id: 'california', name: { zh: '加州街线缆车', en: 'California St cable car' }, hours: [H(7), H(21)], day: { wd: [10, 20], we: [10, 20] }, sourceUrl: 'https://www.sfmta.com/routes/california-cable-car', verifiedAt: CHECKED },
};

export const CHECK_511 = { zh: '出发前查 SFMTA / 511 确认', en: 'Check SFMTA / 511 before you go' } as const;
export const URL_511 = 'https://511.org/transit/trip-planner';

export interface RealStop { line: string; id: string; name: Bilingual; x: number; z: number }
export interface NearStop { stop: RealStop; line: RealLine; km: number; walkMin: number }

/** Every stop of the real lines in a list of transit lines (the published transit.json shape). */
export function realStopsOf(lines: readonly { id: string; stops: readonly { id: string; name: Bilingual; x: number; z: number }[] }[]): RealStop[] {
  const out: RealStop[] = [];
  for (const l of lines) {
    if (!REAL_LINES[l.id]) continue;
    for (const s of l.stops) if (Number.isFinite(s.x) && Number.isFinite(s.z)) out.push({ line: l.id, id: s.id, name: s.name, x: s.x, z: s.z });
  }
  return out;
}

/**
 * The nearest real stop of each line within `maxKm` (real distance: the world point unprojected to latitude and
 * longitude), nearest first, at most `max` lines. Walking minutes by the catalog's own rule (80 m a minute, rounded to 5).
 */
export function nearestRealStops(point: Vec2, stops: readonly RealStop[], max = 2, maxKm = 1.2): NearStop[] {
  const here = unprojectCity(point);
  const best = new Map<string, NearStop>();
  for (const s of stops) {
    const km = distanceKm(here, unprojectCity(s));
    if (km > maxKm) continue;
    const had = best.get(s.line);
    if (!had || km < had.km) best.set(s.line, { stop: s, line: REAL_LINES[s.line], km, walkMin: walkMinutes(km) });
  }
  return [...best.values()].sort((a, b) => a.km - b.km).slice(0, max);
}

/** Is the line running at `minute` (after Bay midnight)? */
export const lineRunning = (line: RealLine, minute: number) => !line.hours || (minute >= line.hours[0] && minute < line.hours[1]);

const hh = (m: number) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, '0')}`;

/** The service line of a row: the daytime headway on that day, or its hours when it is not running now. */
export function serviceLabel(line: RealLine, dateKey: string, minute: number): Bilingual {
  const w = weekday(dateKey);
  const [lo, hi] = w === 0 || w === 6 ? line.day.we : line.day.wd;
  const every = lo === hi ? `${lo}` : `${lo}–${hi}`;
  const hours: Bilingual = line.hours ? { zh: `${hh(line.hours[0])}–${line.hours[1] >= H(24) ? '24:00' : hh(line.hours[1])}`, en: `${hh(line.hours[0])}–${line.hours[1] >= H(24) ? '24:00' : hh(line.hours[1])}` } : { zh: '全天 24 小时', en: '24 hours' };
  if (!lineRunning(line, minute)) return { zh: `现在停运 · 运营 ${hours.zh}`, en: `Not running now · runs ${hours.en}` };
  return { zh: `${hours.zh} · 白天约 ${every} 分钟一班`, en: `${hours.en} · about every ${every} min by day` };
}

/** Every stop of the real lines the game has loaded (cable cars, the F line, the Metro). */
export function loadedRealStops(): RealStop[] {
  const out: RealStop[] = [];
  const d = transitData();
  if (d) for (const st of d.stations) for (const l of st.lines) if (REAL_LINES[l.line]) out.push({ line: l.line, id: st.id, name: st.name, x: st.x, z: st.z });
  const f = flineJson();
  if (f) out.push(...realStopsOf([f]));
  const w = transitW4();
  if (w) out.push(...realStopsOf(w.metro as unknown as TransitLineJson[]));
  return out;
}
