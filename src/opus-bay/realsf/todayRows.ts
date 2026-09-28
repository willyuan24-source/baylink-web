import type { Bilingual, Vec2 } from '../core/types';
import { addDays, weekday } from '../data/catalog';
import { parseBayDate } from '../game/bayNow';
import { FIRE_RINGS } from './seasons';

/**
 * Wave 5 · lane R (W5-R4) · the hand rows of 今天 · SF Today (plan §3.3 item 5): what is free or open in San Francisco
 * on a Bay date, from organisers' own pages, each with its source and the day it was checked. The rows only say what the
 * real place does; in the game the place can be visited at any time. A row whose hours are over for the day is hidden
 * (plan: "past rows show nothing"); every time says 以官网为准 / check before you go.
 *
 *   rowsOn(dateKey)         the free / market / fire / light-show rows of that Bay date (hours in minutes after midnight)
 *   freePlacesOn(dateKey)   the places that are free for everyone that day (the daily three's 'free' task picks one)
 *   isMarketDayKey(dateKey) Ferry Plaza Farmers Market day (Tue · Thu · Sat)
 *
 * Checked on the web 2026-09-28:
 *   - Gardens of Golden Gate Park, "Hours & Admissions" (https://gggp.org/visit/admissions-hours/): Japanese Tea Garden
 *     free Monday, Wednesday and Friday 9–10 am (last entry 5:30 pm March–October, 4:30 pm November–February);
 *     Conservatory of Flowers free on the first Tuesday of the month, open 10 am – 4:30 pm (last entry 4 pm), closed
 *     Wednesdays, and its light art "Photosynthesis" beginning 30 minutes after sunset every night, about 30 minutes
 *     long, free (a secondary listing says it loops until midnight: not used); San Francisco Botanical Garden free daily
 *     7:30–9 am, on the second Tuesday of every month and on Thanksgiving, Christmas and New Year's Day (last entry 6 pm
 *     from the 2nd Sunday in March through September, 5 pm February – the 2nd Saturday in March and October – the 1st
 *     Saturday in November, 4 pm from the 1st Sunday in November through January).
 *   - Foodwise, Ferry Plaza Farmers Market (https://foodwise.org/markets/ferry-plaza-farmers-market/): Tuesday and
 *     Thursday 10 am – 2 pm, Saturday 8 am – 2 pm, year round.
 *   - NPS Ocean Beach Fire Program (realsf/seasons.ts FIRE_RINGS): 1 March – 31 October, 6 am – 9:30 pm.
 */

export interface SourceRef { label: string; url: string; verifiedAt: string }

export type HandKind = 'free' | 'market' | 'fire' | 'show';

export interface HandRow {
  id: string;
  kind: HandKind;
  /** the place (BAYBAY / the row's title) */
  place: Bilingual;
  /** what is on: 免费入园 · 农夫市集 · 篝火 · 灯光秀 */
  what: Bilingual;
  /** [open, close] minutes after Bay midnight (close may pass 24:00 for night shows); null = all day */
  hours: readonly [number, number] | null;
  /** conditions (always ends with 以官网为准 / check before you go) */
  note: Bilingual;
  /** 带我去: an attraction id for lane N's goTo (none: go to the point itself), and the point */
  placeId?: string;
  at: Vec2;
  source: SourceRef;
}

const H = (h: number, m = 0) => h * 60 + m;
const CHECKED = '2026-09-28';
export const GGGP: SourceRef = { label: 'gggp.org', url: 'https://gggp.org/visit/admissions-hours/', verifiedAt: CHECKED };
export const FOODWISE: SourceRef = { label: 'foodwise.org', url: 'https://foodwise.org/markets/ferry-plaza-farmers-market/', verifiedAt: CHECKED };
export const NPS_FIRE: SourceRef = { label: 'nps.gov', url: FIRE_RINGS.sourceUrl, verifiedAt: FIRE_RINGS.verifiedAt };

/**
 * The places (attraction ids and points of data/sf/attractions.ts; the Botanical Garden at its arrival gate). The fire
 * rings have no attraction of their own (Ocean Beach's point is 170 u south of them): 带我去 goes to the point.
 */
export const PLACES: Record<'teaGarden' | 'conservatory' | 'botanical' | 'market' | 'fireRings', { placeId?: string; at: Vec2; name: Bilingual }> = {
  teaGarden: { placeId: 'japanese-tea-garden', at: { x: -242.9, z: 964.4 }, name: { zh: '日本茶园', en: 'the Japanese Tea Garden' } },
  conservatory: { placeId: 'conservatory-of-flowers', at: { x: -177.51, z: 858.11 }, name: { zh: '花卉温室', en: 'the Conservatory of Flowers' } },
  botanical: { placeId: 'sf-botanical-garden', at: { x: -178.3, z: 970.9 }, name: { zh: '旧金山植物园', en: 'the SF Botanical Garden' } },
  market: { placeId: 'ferry-building-marketplace', at: { x: 131.5, z: 15.1 }, name: { zh: '渡轮大厦农夫市集', en: 'the Ferry Plaza Farmers Market' } },
  fireRings: { at: { x: -564.83, z: 1363.73 }, name: { zh: '海洋海滩篝火圈', en: 'the Ocean Beach fire rings' } },
};

/** The Conservatory's light show runs about this long after it starts (minutes; gggp.org). */
export const LIGHT_SHOW_MIN = 30;

const md = (dateKey: string) => { const [, m, d] = dateKey.split('-').map(Number); return { m, d }; };
/** the n-th (1-based) weekday `w` (0 = Sunday) of the month of `dateKey`: true when dateKey is it */
const nthWeekday = (dateKey: string, w: number, n: number) => weekday(dateKey) === w && Math.ceil(md(dateKey).d / 7) === n;
/** the day of the month of the first weekday `w` (0 = Sunday) in month 'YYYY-MM' */
const firstWeekdayDay = (month: string, w: number) => ((w - weekday(`${month}-01`) + 7) % 7) + 1;
/** Thanksgiving: the fourth Thursday of November */
const thanksgiving = (dateKey: string) => md(dateKey).m === 11 && nthWeekday(dateKey, 4, 4);

/** Ferry Plaza Farmers Market day (Tuesday, Thursday, Saturday). */
export const isMarketDayKey = (dateKey: string) => [2, 4, 6].includes(weekday(dateKey));
/** The market's hours that day (Foodwise): Tue & Thu 10–14, Sat 8–14; null on other days. */
export function marketHours(dateKey: string): readonly [number, number] | null {
  const w = weekday(dateKey);
  return w === 6 ? [H(8), H(14)] : w === 2 || w === 4 ? [H(10), H(14)] : null;
}

/** The Japanese Tea Garden's last entry (March–October 17:30, November–February 16:30). */
export const teaGardenLastEntry = (dateKey: string) => { const m = md(dateKey).m; return m >= 3 && m <= 10 ? H(17, 30) : H(16, 30); };

/** The Botanical Garden's last entry by the season rows of gggp.org. */
export function botanicalLastEntry(dateKey: string): number {
  const { m, d } = md(dateKey);
  const month = dateKey.slice(0, 7);
  // the 2nd Sunday of March … September: 18:00; the 1st Sunday of November … January: 16:00; else 17:00
  if ((m > 3 && m <= 9) || (m === 3 && d >= firstWeekdayDay(month, 0) + 7)) return H(18);
  if ((m === 11 && d >= firstWeekdayDay(month, 0)) || m === 12 || m === 1) return H(16);
  return H(17);
}

/** The Botanical Garden is free all day (the 2nd Tuesday, Thanksgiving, Christmas, New Year's Day). */
export function botanicalFreeAllDay(dateKey: string): boolean {
  const { m, d } = md(dateKey);
  return nthWeekday(dateKey, 2, 2) || thanksgiving(dateKey) || (m === 12 && d === 25) || (m === 1 && d === 1);
}

/** The Conservatory is free (first Tuesday of the month; it closes on Wednesdays, never a Tuesday). */
export const conservatoryFree = (dateKey: string) => nthWeekday(dateKey, 2, 1);

/** The fire-ring season covers the Bay date (1 March – 31 October). */
export function fireSeasonKey(dateKey: string): boolean {
  const { m, d } = md(dateKey);
  const k = m * 100 + d;
  return k >= FIRE_RINGS.from.month * 100 + FIRE_RINGS.from.day && k <= FIRE_RINGS.to.month * 100 + FIRE_RINGS.to.day;
}

/** The places free for everyone ALL of their open hours or in a named hour that day (the daily three's 'free' task). */
export function freePlacesOn(dateKey: string): { id: 'teaGarden' | 'conservatory' | 'botanical'; hours: readonly [number, number] }[] {
  const out: { id: 'teaGarden' | 'conservatory' | 'botanical'; hours: readonly [number, number] }[] = [];
  const w = weekday(dateKey);
  if (w === 1 || w === 3 || w === 5) out.push({ id: 'teaGarden', hours: [H(9), H(10)] });
  if (conservatoryFree(dateKey)) out.push({ id: 'conservatory', hours: [H(10), H(16)] });
  if (botanicalFreeAllDay(dateKey)) out.push({ id: 'botanical', hours: [H(7, 30), botanicalLastEntry(dateKey)] });
  return out;
}

/**
 * Every hand row of a Bay date, in the tab's order: the market, the free places, the fire rings, the Conservatory's
 * light show (its start is `sunsetMin + 30`: pass the day's sunset in minutes after midnight).
 */
export function rowsOn(dateKey: string, sunsetMin: number): HandRow[] {
  const rows: HandRow[] = [];
  const mh = marketHours(dateKey);
  if (mh) {
    const sat = weekday(dateKey) === 6;
    rows.push({
      id: 'ferry-plaza-market', kind: 'market', place: { zh: '渡轮大厦', en: 'the Ferry Building' }, what: { zh: '农夫市集', en: 'farmers market' }, hours: mh,
      note: sat ? { zh: '周六 8–14 点 · 周二、周四 10–14 点 · 以官网为准', en: 'Sat 8 am–2 pm · Tue & Thu 10 am–2 pm · check before you go' }
        : { zh: '周二、周四 10–14 点 · 周六 8–14 点 · 以官网为准', en: 'Tue & Thu 10 am–2 pm · Sat 8 am–2 pm · check before you go' },
      placeId: PLACES.market.placeId, at: PLACES.market.at, source: FOODWISE,
    });
  }
  for (const f of freePlacesOn(dateKey)) {
    const p = PLACES[f.id];
    const note: Bilingual = f.id === 'teaGarden' ? { zh: '每周一、三、五 9–10 点所有人免费 · 以官网为准', en: 'Free for everyone Mon, Wed & Fri 9–10 am · check before you go' }
      : f.id === 'conservatory' ? { zh: '每月第一个周二免费 · 周三闭馆 · 以官网为准', en: 'Free on the first Tuesday of the month · closed Wednesdays · check before you go' }
      : { zh: '每月第二个周二和几个节日全天免费 · 以官网为准', en: 'Free all day on the 2nd Tuesday and a few holidays · check before you go' };
    rows.push({ id: `free-${f.id}`, kind: 'free', place: p.name, what: { zh: '免费入园', en: 'free entry' }, hours: f.hours, note, placeId: p.placeId, at: p.at, source: GGGP });
  }
  // the Botanical Garden's free early hour, every day (a row of its own when the whole day is not free)
  if (!botanicalFreeAllDay(dateKey)) {
    rows.push({
      id: 'free-botanical-morning', kind: 'free', place: PLACES.botanical.name, what: { zh: '早上免费入园', en: 'free early entry' }, hours: [H(7, 30), H(9)],
      note: { zh: '每天 7:30–9 点免费 · 以官网为准', en: 'Free daily 7:30–9 am · check before you go' }, placeId: PLACES.botanical.placeId, at: PLACES.botanical.at, source: GGGP,
    });
  }
  if (fireSeasonKey(dateKey)) {
    rows.push({
      id: 'ocean-beach-fire-rings', kind: 'fire', place: PLACES.fireRings.name, what: { zh: '篝火季', en: 'fire season' }, hours: [FIRE_RINGS.open, FIRE_RINGS.close],
      note: { zh: '3 月到 10 月底 · 只能在火圈里生火 · 以官网为准', en: 'March – October · fires only in the rings · check before you go' },
      at: PLACES.fireRings.at, source: NPS_FIRE,
    });
  }
  if (Number.isFinite(sunsetMin)) {
    const start = Math.round(sunsetMin) + 30;
    rows.push({
      id: 'conservatory-light-show', kind: 'show', place: PLACES.conservatory.name, what: { zh: '灯光秀', en: 'light show' }, hours: [start, start + LIGHT_SHOW_MIN],
      note: { zh: '日落后 30 分钟开始，约半小时，免费 · 以官网为准', en: 'Starts 30 min after sunset, about half an hour, free · check before you go' },
      placeId: PLACES.conservatory.placeId, at: PLACES.conservatory.at, source: GGGP,
    });
  }
  return rows;
}

/** A row's state at `nowMin` (minutes after Bay midnight): 'open', 'later' (opens later today) or 'over' (hidden). */
export function rowState(hours: readonly [number, number] | null, nowMin: number): 'open' | 'later' | 'over' {
  if (!hours) return 'open';
  if (nowMin >= hours[1]) return 'over';
  return nowMin >= hours[0] ? 'open' : 'later';
}

/** A Bay date + minutes → the instant (ms); minutes ≥ 24:00 roll into the next day. */
export function atMinute(dateKey: string, min: number): number {
  const day = min >= H(24) ? addDays(dateKey, 1) : dateKey;
  const m = min >= H(24) ? min - H(24) : min;
  const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(Math.round(m % 60)).padStart(2, '0');
  return parseBayDate(`${day}T${hh}:${mm}`)?.getTime() ?? Number.NaN;
}

/** 'H:mm' for minutes after midnight (24:00 → 24:00). */
export function hm(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
