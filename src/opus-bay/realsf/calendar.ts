import type { Bilingual, Vec2 } from '../core/types';
import { addDays } from '../data/catalog';
import type { SourceRef } from './todayRows';

/**
 * Wave 5 · lane R (W5-R7) · the verified real-world calendar (plan §3.3 should; DESIGN.md §8's carve-out): fixed civic
 * and natural dates that may DRESS the world and give BAYBAY a line — never an event card (events come only from the
 * BAYLINK catalog; a row links `/events/:id` only through `catalogId`). Exact dates only from organisers (`official`);
 * a date read elsewhere says 以官网为准 (`secondary`); a custom says 通常 (`usually`); a row whose date is not posted is
 * `hidden` and shows nothing; a past row shows nothing.
 *
 *   calendarOn(dateKey)          the visible rows on that Bay date
 *   calendarAhead(dateKey, n)    the visible rows starting in the next n days (the 今天 tab's 这周)
 *   dressingOn(dateKey)          the dressings the world puts up that day (realsf/dressing.ts)
 *
 * Every row carries its source and the day it was checked (all on the web on 2026-09-28).
 */

export type CalendarGrade = 'official' | 'secondary' | 'usually';
export type Dressing = 'pumpkins' | 'king-tide';

export interface CalendarRow {
  id: string;
  title: Bilingual;
  /** the Bay dates (inclusive) */
  from: string;
  to: string;
  /** minutes after Bay midnight when it has a time */
  at?: number;
  where: Bilingual;
  /** 带我去: a place-index id and / or its point */
  placeId?: string;
  xz?: Vec2;
  /** what the row says (≤ 40 zh characters) */
  note: Bilingual;
  grade: CalendarGrade;
  source: SourceRef;
  /** the BAYLINK catalog event this date belongs to (the only way a row links an event) */
  catalogId?: string;
  /** the world's dressing that day */
  dress?: Dressing;
  /** BAYBAY once on the day, near `xz` (≤ 45 zh characters) */
  line?: Bilingual;
  /** shown nowhere: why (a date not posted yet) */
  hidden?: string;
  /** data for later waves: never shown in this build, kept with its source */
  later?: boolean;
}

const CHECKED = '2026-09-28';
const src = (label: string, url: string): SourceRef => ({ label, url, verifiedAt: CHECKED });

/** Waller St between Scott and Steiner (Lower Haight / Duboce Triangle) — the pumpkins' street (realsf/dressing.ts) */
export const WALLER_ST: Vec2 = { x: 62.4, z: 637.6 };
/** the Embarcadero seawall by the Ferry Building */
export const EMBARCADERO_SEAWALL: Vec2 = { x: 131.5, z: 15.1 };
const KING_TIDES: SourceRef = { label: 'coastal.ca.gov', url: 'https://www.coastal.ca.gov/kingtides/', verifiedAt: CHECKED };
const KING_TIDE_NOTE: Bilingual = { zh: '一年里最高的潮水，海水会漫近堤岸 · 离水边远一点', en: 'The year’s highest tides reach the seawall · keep back from the edge' };
const KING_TIDE_LINE: Bilingual = { zh: '今天是特大潮，海水快漫上堤岸了，离水边远一点哦。', en: 'King tide today — the Bay is up to the seawall. Keep back from the edge.' };

export const CALENDAR: readonly CalendarRow[] = [
  {
    id: 'halloween-2026', title: { zh: '万圣节', en: 'Halloween' }, from: '2026-10-31', to: '2026-10-31',
    where: { zh: '维多利亚老房子的台阶', en: 'Victorian stoops' }, placeId: 'alamo-square-painted-ladies', xz: { x: 8.7, z: 572.4 },
    // (review) the source names Waller St's decorated houses, not the Painted Ladies: the note says only what it bears out
    // (the game's own pumpkins stand on both; 带我去 goes to the Painted Ladies, the nearer landmark)
    note: { zh: 'Waller 街（Scott 到 Steiner）有很多人家做万圣节装饰', en: 'Waller St (Scott to Steiner) has many Halloween-decorated houses' },
    grade: 'usually', dress: 'pumpkins',
    line: { zh: '今天万圣节！老房子的台阶上摆满了南瓜灯～', en: 'Happy Halloween! The old houses have pumpkins on their steps.' },
    // "Waller Street, particularly the stretch from Scott Street to Steiner Street in the Duboce Triangle, has several
    // Halloween-decorated houses" (Local News Matters, 2025-10-27); 31 October is a fixed date
    source: src('localnewsmatters.org', 'https://localnewsmatters.org/2025/10/27/skeletons-fangs-lost-souls-heres-where-to-find-sfs-best-halloween-decorated-homes/'),
  },
  {
    id: 'dia-de-los-muertos-2026', title: { zh: '亡灵节', en: 'Día de los Muertos' }, from: '2026-11-02', to: '2026-11-02',
    where: { zh: '加菲尔德广场', en: 'Garfield Square' }, placeId: 'osm-w24253472', xz: { x: 475.48, z: 668.77 },
    note: { zh: '每年 11 月 2 日前后的纪念 · 以官网为准', en: 'A remembrance around 2 November · check before you go' },
    grade: 'usually', source: src('dayofthedeadsf.org', 'https://www.dayofthedeadsf.org/'),
    hidden: 'the 2026 date is not posted (the page still shows November 2nd, 2025): shown once an organiser date is checked',
  },
  {
    id: 'king-tides-2026-11', title: { zh: '特大潮', en: 'King tides' }, from: '2026-11-24', to: '2026-11-26',
    where: { zh: '内河码头海堤', en: 'the Embarcadero seawall' }, placeId: 'ferry-building-marketplace', xz: EMBARCADERO_SEAWALL,
    note: KING_TIDE_NOTE, grade: 'official', dress: 'king-tide', line: KING_TIDE_LINE, source: KING_TIDES,
  },
  {
    id: 'king-tides-2026-12', title: { zh: '特大潮', en: 'King tides' }, from: '2026-12-23', to: '2026-12-25',
    where: { zh: '内河码头海堤', en: 'the Embarcadero seawall' }, placeId: 'ferry-building-marketplace', xz: EMBARCADERO_SEAWALL,
    note: KING_TIDE_NOTE, grade: 'official', dress: 'king-tide', line: KING_TIDE_LINE, source: KING_TIDES,
  },
  {
    id: 'king-tides-2027-01', title: { zh: '特大潮', en: 'King tides' }, from: '2027-01-21', to: '2027-01-22',
    where: { zh: '内河码头海堤', en: 'the Embarcadero seawall' }, placeId: 'ferry-building-marketplace', xz: EMBARCADERO_SEAWALL,
    note: KING_TIDE_NOTE, grade: 'official', dress: 'king-tide', line: KING_TIDE_LINE, source: KING_TIDES,
  },
  // data for later waves (kept with their sources; not shown in this build)
  {
    id: 'lunar-new-year-2027', title: { zh: '农历新年', en: 'Lunar New Year' }, from: '2027-02-06', to: '2027-02-06',
    where: { zh: '唐人街', en: 'Chinatown' }, placeId: 'chinatown-dragon-gate',
    note: { zh: '羊年春节 · 以官网为准', en: 'Year of the Goat · check before you go' }, grade: 'secondary', later: true,
    source: src('si.edu', 'https://www.si.edu/spotlight/lunar-year-goat'),
  },
  {
    id: 'chinese-new-year-parade-2027', title: { zh: '春节大游行', en: 'Chinese New Year Parade' }, from: '2027-02-20', to: '2027-02-20',
    where: { zh: '唐人街一带', en: 'around Chinatown' }, placeId: 'chinatown-dragon-gate',
    note: { zh: '2027 年 2 月 20 日 · 羊年', en: 'February 20, 2027 · the Year of the Ram' }, grade: 'official', later: true,
    source: src('chineseparade.com', 'https://www.chineseparade.com/'),
  },
  {
    id: 'cherry-blossom-2027', title: { zh: '樱花节', en: 'Cherry Blossom Festival' }, from: '2027-04-10', to: '2027-04-18',
    where: { zh: '日本城', en: 'Japantown' },
    note: { zh: '4 月 10–11 日和 17–18 日 · 18 日大游行', en: 'April 10–11 and 17–18 · the Grand Parade on the 18th' }, grade: 'official', later: true,
    source: src('sfcherryblossom.org', 'https://www.sfcherryblossom.org/'),
  },
  {
    id: 'quake-1906-2027', title: { zh: '1906 大地震纪念', en: '1906 earthquake remembrance' }, from: '2027-04-18', to: '2027-04-18', at: 5 * 60 + 12,
    where: { zh: '洛塔喷泉', en: 'Lotta’s Fountain' },
    note: { zh: '通常每年 4 月 18 日清晨 5:12 默哀 · 以官网为准', en: 'Usually a silence at 5:12 am every April 18 · check before you go' }, grade: 'usually', later: true,
    source: src('downtownsf.org', 'https://downtownsf.org/do/1906-earthquake-and-fire-anniversary-commemoration'),
  },
  {
    id: 'pride-2027', title: { zh: '旧金山骄傲节', en: 'San Francisco Pride' }, from: '2027-06-26', to: '2027-06-27',
    where: { zh: '市中心', en: 'downtown' },
    note: { zh: '2027 年 6 月 26–27 日 · 第 57 届', en: 'June 26–27, 2027 · the 57th' }, grade: 'official', later: true,
    source: src('sfpride.org', 'https://www.sfpride.org/'),
  },
];

const visible = (r: CalendarRow) => !r.hidden && !r.later;

/** The visible rows on a Bay date. */
export function calendarOn(dateKey: string, rows: readonly CalendarRow[] = CALENDAR): CalendarRow[] {
  return rows.filter(r => visible(r) && dateKey >= r.from && dateKey <= r.to);
}

/** The visible rows that start in the `days` days after `dateKey` (not today's). */
export function calendarAhead(dateKey: string, days: number, rows: readonly CalendarRow[] = CALENDAR): CalendarRow[] {
  const end = addDays(dateKey, days);
  return rows.filter(r => visible(r) && r.from > dateKey && r.from <= end);
}

/** The dressings the world puts up on a Bay date. */
export function dressingOn(dateKey: string, rows: readonly CalendarRow[] = CALENDAR): CalendarRow[] {
  return calendarOn(dateKey, rows).filter(r => !!r.dress);
}

/** 以官网为准 / 通常 by grade (the tab's suffix). */
export const GRADE_SAY: Record<CalendarGrade, Bilingual> = {
  official: { zh: '官网日期', en: 'organiser’s date' },
  secondary: { zh: '以官网为准', en: 'check before you go' },
  usually: { zh: '通常如此', en: 'usually' },
};
