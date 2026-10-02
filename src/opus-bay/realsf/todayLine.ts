import type { Bilingual, Catalog, Vec2 } from '../core/types';
import { getCatalog, weekday } from '../data/catalog';
import { bayNow, bayParts } from '../game/bayNow';
import { CALENDAR, calendarAhead, calendarOn, type CalendarRow } from './calendar';
import { halloweenTodayLine } from '../halloween/today';
import { EVENT_SAY, VENUE_SAY } from './eventVenues';
import { weekEvents } from './events';
import { liveOffers, offersOn, type LiveOffer } from './live';
import { sunHm, sunTimes } from './sun';
import { atMinute, hm } from './todayRows';

/**
 * Wave 5 · lane R (W5-R4) · one short line about San Francisco today (zh ≤ 45 characters): BAYBAY's addition to lane C's
 * welcome back (game/welcome.ts onWelcome 'returning') and the header of lane E's notebook (plan §3.5: "today's real SF
 * line"). Today's event in the world first, else the sunset, else the daily three.
 *
 *   todayLine(now?, catalog?)   今天金门公园有蓝草音乐节，旅行本「今天」里有～ · 今天旧金山日落 18:47，旅行本「今天」里有三件小事～
 */

const cut = (zh: string, alt: string) => ([...zh].length <= 45 ? zh : alt);

export function todayLine(now: Date = bayNow(), catalog: Catalog | null = getCatalog()): Bilingual {
  // (W9-H, lane H surgical) the big Halloween days come first — 31 Oct (the Chinatown festival / every door answers),
  // 1–2 Nov (Día de los Muertos, the procession): a fixed, voiced line (halloween/today.ts); the review's 19:30 return
  // on Halloween night heard the generic line
  const big = halloweenTodayLine(now);
  if (big) return big;
  const day = bayParts(now).dateKey;
  const w = weekEvents(now, 1, catalog).find(x => x.dateKey === day);
  if (w) {
    const place = VENUE_SAY[w.venue.id] ?? w.venue.name;
    const name = EVENT_SAY[w.event.id] ?? { zh: '活动', en: 'an event' };
    return {
      zh: cut(`今天${place.zh}有${name.zh}，旅行本「今天」里有～`, `今天${place.zh}有${name.zh}！`),
      // (W8-I, W8I-WS-1) a sentence never starts lowercase ('the Ferry Building has …'), and it is *on* a page
      en: `${place.en.charAt(0).toUpperCase()}${place.en.slice(1)} has ${name.en} today — it is on the journal's Today page.`,
    };
  }
  const sun = sunTimes(now);
  if (now.getTime() < sun.sunset.getTime()) {
    const t = sunHm(sun.sunset);
    return { zh: `今天旧金山日落 ${t}，旅行本「今天」里有三件小事～`, en: `Sunset in San Francisco today is at ${t}; three small things wait on the journal's Today page.` };
  }
  return { zh: '旅行本「今天」里有今日三件小事，慢慢逛～', en: 'Three small things for today wait on the journal’s Today page — no rush.' };
}

// ---------------------------------------------------------------------------
// Wave 9 · lane R (W9-R1) · 此刻旧金山 (review idea 11, sf-w9-lead.md §4): ONE headline at a time for the title's
// 「今天在旧金山」 strip (lane F) and anyone else who wants a single real-SF line with something to do about it.
// ---------------------------------------------------------------------------

/** What a headline offers to do: go there (N's goTo target; `prefer: 'fly'` = by pelican), open an event card, or the
 *  journal's 今天 page. `label` is the button's text. */
export type HeadlineAction =
  | { kind: 'go'; placeId?: string; point?: Vec2; name: Bilingual; prefer?: 'fly' | 'ground'; label: Bilingual }
  | { kind: 'event'; eventId: string; label: Bilingual }
  | { kind: 'today'; label: Bilingual };

export interface Headline {
  /** stable per thing and day (metrics, "seen" memory): 'cal:<row id>', 'sunset', 'free:<offer id>', 'event:<id>' */
  id: string;
  zh: string;
  en: string;
  action?: HeadlineAction;
}

export interface HeadlineInputs {
  catalog?: Catalog | null;
  /** BAYLINK's same-site offers (realsf/live.ts; null / missing: no 今天免费 line) */
  offers?: LiveOffer[] | null;
  rows?: readonly CalendarRow[];
}

/** Sunset lines start this many minutes before it (「日落还有 12 分钟 · 飞去双峰」). */
export const SUNSET_SOON_MIN = 30;
const TWIN_PEAKS = { placeId: 'twin-peaks', name: { zh: '双峰', en: 'Twin Peaks' } } as const;
const GO: Bilingual = { zh: '带我去', en: 'Take me' };
const FLY: Bilingual = { zh: '飞过去', en: 'Fly there' };
const SEE: Bilingual = { zh: '看看', en: 'See it' };
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const rowGo = (r: CalendarRow): HeadlineAction | undefined =>
  r.placeId || r.xz ? { kind: 'go', ...(r.placeId ? { placeId: r.placeId } : {}), ...(r.xz ? { point: r.xz } : {}), name: r.where, label: GO } : undefined;

/** A calendar row on its day: 「正在进行」 inside its stated hours, its start before them; nothing once over. */
function rowToday(r: CalendarRow, min: number): { h: Headline; now: boolean } | null {
  if (r.at === undefined || r.dress) return null; // a dressing day's greeting is lane H's (todayLine / dressing)
  const action = rowGo(r);
  const id = `cal:${r.id}`;
  // the place when it fits on the strip (the 带我去 button names it anyway)
  const withWhere = (zh: string, en: string): Bilingual =>
    ([...`${zh} · ${r.where.zh}`].length <= 32 ? { zh: `${zh} · ${r.where.zh}`, en: `${en} at ${r.where.en}` } : { zh, en });
  if (r.show && min >= r.show[0] && min < r.show[1]) {
    const text = r.headline?.now ?? withWhere(`${r.title.zh}正在进行`, `${r.title.en} is on now`);
    return { h: { id, ...text, ...(action ? { action } : {}) }, now: true };
  }
  const start = r.show ? r.show[0] : r.at;
  if (min >= start) return null;
  // the stated on-hours are the organiser's; a bare start of a 'secondary' / 'usually' row is 约 (around)
  const about = !r.show && r.grade !== 'official';
  const t = hm(start);
  const text = r.headline?.before ?? withWhere(`今天${about ? '约 ' : ' '}${t} ${r.title.zh}`, `Today ${about ? 'around' : 'at'} ${t}: ${r.title.en}`);
  return { h: { id, ...text, ...(action ? { action } : {}) }, now: false };
}

/** A dressing day without a time (Halloween's pumpkins, the king tides): 「今天万圣节 · 维多利亚老房子的台阶」. */
function dressToday(r: CalendarRow): Headline | null {
  if (!r.dress || r.at !== undefined) return null;
  const action = rowGo(r);
  const zh = `今天${r.title.zh}`, en = `${r.title.en} today`;
  const fits = [...`${zh} · ${r.where.zh}`].length <= 32;
  return { id: `cal:${r.id}`, zh: fits ? `${zh} · ${r.where.zh}` : zh, en: fits ? `${en} · ${cap(r.where.en)}` : en, ...(action ? { action } : {}) };
}

/** place 有 name, a space beside a Latin word (大通中心有 Doja Cat 演唱会 · Portola 有万圣节手工和游戏). */
const has = (place: string, name: string) => `${place}${/[A-Za-z0-9]$/.test(place) ? ' ' : ''}有${/^[A-Za-z0-9]/.test(name) ? ' ' : ''}${name}`;

/** An offer's line when it is open now or later today (dated and once-a-month offers first: they are the news). */
function freeToday(offers: LiveOffer[] | null | undefined, dateKey: string, min: number): Headline | null {
  const rank = (o: LiveOffer) => (o.from ? 0 : o.nth ? 1 : 2);
  const list = offersOn(dateKey, offers ?? null)
    .filter(({ offer, hours }) => offer.free && (!hours || min < hours[1]))
    // a weekly offer is not news (the tea garden's free hour Mon / Wed / Fri, the cable car museum, the Museo's
    // Thursdays …): a dated one is, and a monthly one on its day (the Museo's first Sunday)
    .filter(({ offer }) => !!offer.from || (!!offer.nth && !offer.weekdays?.includes(weekday(dateKey))))
    .sort((a, b) => rank(a.offer) - rank(b.offer) || a.offer.id.localeCompare(b.offer.id));
  const hit = list[0];
  if (!hit) return null;
  const { offer, hours } = hit;
  const name = offer.place?.name ?? offer.title;
  const when = hours ? ` ${hm(hours[0])}–${hm(hours[1])}` : '';
  const action: HeadlineAction = offer.place
    ? { kind: 'go', ...(offer.place.id ? { placeId: offer.place.id } : {}), point: { x: offer.place.x, z: offer.place.z }, name: offer.place.name, label: GO }
    : { kind: 'today', label: SEE };
  // who it is for only when it is not everyone (SF 居民 · 凭地址证件); a long line drops it
  const full = /^所有人/.test(offer.who.zh) ? null : offer.who;
  let zh = `今天免费：${name.zh}${when}`, en = `Free today: ${name.en}${when}`;
  const len = (w: Bilingual | null) => [...(w ? `${zh} · ${w.zh}` : zh)].length;
  // a long "who" keeps its first part (SF 居民 · 凭地址证件 → SF 居民): the condition matters more than the detail,
  // and more than the hours (the card has them)
  const who = full && len(full) > 32 ? { zh: full.zh.split(/ · |，/)[0], en: full.en.split(/ · |, /)[0] } : full;
  if (len(who) > 32) { zh = `今天免费：${name.zh}`; en = `Free today: ${name.en}`; }
  return { id: `free:${offer.id}`, zh: who ? `${zh} · ${who.zh}` : zh, en: who ? `${en} · ${who.en}` : en, action };
}

/**
 * The one line about San Francisco right now (null: nothing worth a line). Order: a calendar day happening now →
 * the sunset within 30 minutes (fly to Twin Peaks) → a calendar day later today → a dressing day (Halloween, king
 * tides) → today's free (a dated / monthly offer) → today's event in the world → a calendar day in the next 3 days.
 * Pure: everything comes from `now` and
 * the inputs (defaults: the loaded catalog and offers, the verified calendar). `locale` is part of the contract; the
 * line is returned in both languages (zh-Hant through the caller's t()).
 */
export function todayHeadline(now: Date, _locale?: string, inputs: HeadlineInputs = {}): Headline | null {
  const catalog = inputs.catalog === undefined ? getCatalog() : inputs.catalog;
  const offers = inputs.offers === undefined ? liveOffers() : inputs.offers;
  const rows = inputs.rows ?? CALENDAR;
  const b = bayParts(now), day = b.dateKey, min = b.hour * 60 + b.minute;
  const todays = calendarOn(day, rows).map(r => rowToday(r, min)).filter((x): x is { h: Headline; now: boolean } => !!x);
  const nowRow = todays.find(x => x.now);
  if (nowRow) return nowRow.h;
  const sun = sunTimes(now);
  const toSunset = Math.round((sun.sunset.getTime() - now.getTime()) / 60_000);
  if (toSunset > 0 && toSunset <= SUNSET_SOON_MIN) {
    return {
      id: 'sunset',
      zh: `日落还有 ${toSunset} 分钟 · 飞去双峰`,
      en: `Sunset in ${toSunset} min · fly to Twin Peaks`,
      action: { kind: 'go', placeId: TWIN_PEAKS.placeId, name: TWIN_PEAKS.name, prefer: 'fly', label: FLY },
    };
  }
  if (todays[0]) return todays[0].h;
  const dressed = calendarOn(day, rows).map(dressToday).find((h): h is Headline => !!h);
  if (dressed) return dressed;
  const free = freeToday(offers, day, min);
  if (free) return free;
  const w = weekEvents(now, 1, catalog).find(x => x.dateKey === day && EVENT_SAY[x.event.id]);
  if (w) {
    const place = VENUE_SAY[w.venue.id] ?? w.venue.name;
    const name = EVENT_SAY[w.event.id]!;
    const t = hm(Math.round((w.open - atMinute(day, 0)) / 60_000));
    const on = now.getTime() >= w.open;
    return {
      id: `event:${w.event.id}`,
      zh: on ? `${place.zh}的${name.zh}正在进行` : `今天 ${t} ${has(place.zh, name.zh)}`,
      en: on ? `${cap(name.en)} is on now at ${place.en}` : `Today at ${t}: ${name.en} at ${place.en}`,
      action: { kind: 'event', eventId: w.event.id, label: SEE },
    };
  }
  const ahead = calendarAhead(day, 3, rows).filter(r => !r.dress || r.dress === 'king-tide').sort((x, y) => x.from.localeCompare(y.from))[0];
  if (ahead) {
    const m = Number(ahead.from.slice(5, 7)), d = Number(ahead.from.slice(8, 10));
    const action = rowGo(ahead);
    const zh = `${m}月${d}日 ${ahead.title.zh}`, en = `${MONTHS_EN[m - 1]} ${d}: ${ahead.title.en}`;
    // the place when it fits on the strip (恶魔岛（33 号码头乘船） does not: the 带我去 button names it)
    const fits = [...`${zh} · ${ahead.where.zh}`].length <= 32;
    return {
      id: `cal:${ahead.id}`,
      zh: fits ? `${zh} · ${ahead.where.zh}` : zh,
      en: fits ? `${en} at ${ahead.where.en}` : en,
      ...(action ? { action } : {}),
    };
  }
  return null;
}

const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
