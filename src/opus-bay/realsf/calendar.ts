import type { Bilingual, Vec2 } from '../core/types';
import { bayParts } from '../game/bayNow';
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
 * Every row carries its source and the day it was checked (on the web on 2026-09-28; W7-S's rows on 2026-09-29).
 *
 * W7-S: rows without a dressing may carry a BAYBAY line too (`line` + `lineAt`: near a point and / or between two Bay
 * times, or anywhere that day) — calendarLines(now, player) offers them to realsf/index.ts's scheduler (the dressing
 * rows' lines stay with realsf/dressing.ts); `sunsetNote` adds today's sunset (realsf/sun.ts, at runtime) to the 今天 row.
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
  /** (W7-S) where and when a line of a row without a dressing is said: within `r` of `near`, from / to Bay minutes */
  lineAt?: { near?: Vec2; r?: number; from?: number; to?: number };
  /** (W7-S) the 今天 row adds today's sunset (the DST day: 天黑得更早) */
  sunsetNote?: boolean;
}

const CHECKED = '2026-09-28';
const src = (label: string, url: string): SourceRef => ({ label, url, verifiedAt: CHECKED });
/** (W7-S) the rows checked on the web on 2026-09-29 */
const src29 = (label: string, url: string): SourceRef => ({ label, url, verifiedAt: '2026-09-29' });

/** (W7-S) 22nd & Bryant, where the Día de los Muertos procession gathers (lane H's ROUTE_CORNERS.bryant22, OSM) */
export const BRYANT_22: Vec2 = { x: 434.95, z: 581.84 };
/** (W7-S) Waverly Place, Chinatown: the pavement by its south end (OSM way 1559829857, 37.7937342, -122.4067462) */
export const WAVERLY_PLACE: Vec2 = { x: 36.0, z: 149.0 };
/** (W7-S) the Embarcadero pavement at Pier 33 Alcatraz Landing (OSM node 9871169469, 37.8065495, -122.4051482) */
export const PIER_33: Vec2 = { x: -96.8, z: 0.2 };

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
  // (W7-S) the 2025 pattern (the organisers have not posted 2026): the procession on 2 November whatever the weekday,
  // gathering ≈ 18:00 and starting 19:00 at Bryant & 22nd (Bryant → 24th → Mission → 22nd); the Festival of Altars at
  // Potrero del Sol Park (no longer Garfield Square). Grade 'usually', 以官网为准 (lane H builds the procession)
  {
    id: 'dia-de-los-muertos-2026', title: { zh: '亡灵节', en: 'Día de los Muertos' }, from: '2026-11-02', to: '2026-11-02', at: 19 * 60,
    where: { zh: '22 街 & Bryant · Potrero del Sol', en: '22nd & Bryant · Potrero del Sol' }, xz: BRYANT_22,
    note: { zh: '通常晚 7 点从 22 街 & Bryant 出发游行 · 以官网为准', en: 'Usually a procession from 22nd & Bryant at 7 pm · check before you go' },
    grade: 'usually',
    // "The procession will begin at 7 p.m. … from Bryant & 22nd" (2025); dayofthedeadsf.org/festival-of-altars shows only
    // "November 2, 2025 @ Potrero Del Sol Park" (both read 2026-09-29)
    source: src29('sfmta.com', 'https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025'),
  },
  // ---- W7-S: real dates of October – November 2026 (checked on the web on 2026-09-29) ----
  {
    id: 'fleet-week-parade-of-ships-2026', title: { zh: '舰队周 · 舰船游行', en: 'Fleet Week · Parade of Ships' }, from: '2026-10-09', to: '2026-10-09', at: 11 * 60,
    where: { zh: '码头绿地看台', en: 'the Marina Green reviewing stand' }, placeId: 'marina-green',
    note: { zh: '11:00–12:00 舰船从金门大桥下开进湾里', en: '11:00–12:00 · ships sail in under the Golden Gate Bridge' },
    grade: 'official', source: src29('fleetweeksf.org', 'https://fleetweeksf.org/events/parade-of-ships/'),
  },
  {
    id: 'alcatraz-sunrise-2026-10', title: { zh: '原住民日 · 恶魔岛日出聚会', en: 'Indigenous Peoples’ Day · Sunrise Gathering' }, from: '2026-10-12', to: '2026-10-12', at: 4 * 60 + 15,
    where: { zh: '恶魔岛（33 号码头乘船）', en: 'Alcatraz (boats from Pier 33)' }, xz: PIER_33,
    note: { zh: '清晨 4:15 起从 33 号码头开船 · 安静的纪念', en: 'Boats from Pier 33 from 4:15 am · a quiet remembrance' },
    // organised by the International Indian Treaty Council; its own page still shows 2019 only: secondary
    grade: 'secondary', source: src29('sf.funcheap.com', 'https://sf.funcheap.com/event-series/sunrise-gathering-alcatraz-indigenous-peoples-day/'),
    line: { zh: '今天是原住民日。恶魔岛上通常有一场日出聚会，大家安静地纪念。', en: 'It’s Indigenous Peoples’ Day. There is usually a sunrise gathering on Alcatraz — a quiet remembrance.' },
    lineAt: { near: PIER_33, r: 260, to: 12 * 60 },
  },
  {
    id: 'chinatown-halloween-festival-2026', title: { zh: '唐人街万圣节庆典', en: 'Chinatown Halloween Festival' }, from: '2026-10-31', to: '2026-10-31', at: 11 * 60,
    where: { zh: '唐人街 Waverly Place', en: 'Waverly Place, Chinatown' }, xz: WAVERLY_PLACE,
    note: { zh: '11:00–15:00 · 手工、游戏、南瓜和变装比赛', en: '11:00–15:00 · crafts, games, pumpkins, a costume contest' },
    // "Saturday, October 31, 2026, from 11am-3pm on Waverly Place" (the organiser, Chinatown YMCA / CYC); not in the
    // BAYLINK catalog yet (a request to the site's editors in sf-w7-S.md)
    grade: 'official', source: src29('cycsf.org', 'https://www.cycsf.org/chinatown-halloween-festival/'),
    line: { zh: '唐人街的万圣节庆典在 Waverly 巷，有手工、游戏和南瓜，去看看吧！', en: 'Chinatown’s Halloween Festival is on Waverly Place — crafts, games and pumpkins. Let’s go see!' },
    lineAt: { near: WAVERLY_PLACE, r: 220, from: 11 * 60, to: 15 * 60 },
  },
  {
    id: 'dst-end-2026', title: { zh: '夏令时结束', en: 'Daylight saving time ends' }, from: '2026-11-01', to: '2026-11-01', at: 2 * 60,
    where: { zh: '整个旧金山', en: 'all of San Francisco' },
    note: { zh: '凌晨 2:00 钟拨回 1:00 · 天黑得更早', en: 'At 2:00 am the clocks go back to 1:00 · darker earlier' },
    // "at 2:00 a.m. … on the first Sunday of November" (US law, NIST); 2026: Sunday 1 November
    grade: 'official', source: src29('nist.gov', 'https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst'),
    sunsetNote: true,
    line: { zh: '今天凌晨两点，钟拨回了一小时，天会黑得早一点哦。', en: 'The clocks went back an hour at 2 this morning — it gets dark earlier now.' },
    lineAt: {},
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

/**
 * (W7-S) BAYBAY's lines of today's rows without a dressing (a dressing row's line is realsf/dressing.ts's): near the
 * row's point within `lineAt.r` (default 220 u) — or anywhere when it names none — and between `lineAt.from` / `to`.
 */
export function calendarLines(now: Date, p: Vec2, rows: readonly CalendarRow[] = CALENDAR): { key: string; text: Bilingual }[] {
  const b = bayParts(now), min = b.hour * 60 + b.minute;
  return calendarOn(b.dateKey, rows)
    .filter(r => r.line && r.lineAt && !r.dress)
    .filter(r => {
      const a = r.lineAt!;
      if (a.from !== undefined && min < a.from) return false;
      if (a.to !== undefined && min >= a.to) return false;
      return !a.near || Math.hypot(p.x - a.near.x, p.z - a.near.z) < (a.r ?? 220);
    })
    .map(r => ({ key: `calendar-${r.id}`, text: r.line! }));
}

/** 以官网为准 / 通常 by grade (the tab's suffix). */
export const GRADE_SAY: Record<CalendarGrade, Bilingual> = {
  official: { zh: '官网日期', en: 'organiser’s date' },
  secondary: { zh: '以官网为准', en: 'check before you go' },
  usually: { zh: '通常如此', en: 'usually' },
};
