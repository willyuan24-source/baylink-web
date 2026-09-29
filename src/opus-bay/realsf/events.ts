import type { Catalog, CatalogEvent } from '../core/types';
import { eventDaysInWindow, getCatalog, isAdultOnly, isProfessional, upcomingEvents, addDays } from '../data/catalog';
import { bayNow, bayParts, parseBayDate } from '../game/bayNow';
import { venueForEvent, type EventVenue } from './eventVenues';

/**
 * Wave 5 · lane R (W5-R2 / R3) · BAYLINK's San Francisco events in their real window (plan §3.3 items 1–2, §4.3 hook
 * `activeEventsAt`).
 *
 *   worldEvent(e)            an event may appear in the world: San Francisco, a venue in the table, never adult-only or
 *                            professional / tech
 *   eventHours(e, v, day)    its hours on a Bay date: the venue table's verified hours, else the catalog label's part
 *                            for that day (labelHoursOn: "HH:mm–HH:mm", or a start + 4 h ≤ 21:00 opened by its doors),
 *                            else 08:00–21:00; null = not that day
 *   activeEventsAt(date)     the world events on now (their day and hours), nearest end first
 *   weekEvents(date, days)   the world events with a day in the next `days` days (today included), soonest first
 *
 * Everything reads the Bay clock (game/bayNow.ts: `?date=` moves it in DEV / QA builds) and the loaded catalog
 * (nothing before /planner-catalog.json arrives).
 */

export interface EventWindow {
  event: CatalogEvent;
  venue: EventVenue;
  /** the Bay date of this window */
  dateKey: string;
  /** open / close instants (ms) */
  open: number;
  close: number;
}

export const DEFAULT_HOURS: readonly [number, number] = [8 * 60, 21 * 60];
const LATEST = 21 * 60;

/** San Francisco, mapped, and for everyone (no 18+ / 21+, no professional or tech events in the world). */
export function worldEvent(event: CatalogEvent): EventVenue | null {
  if (event.region !== 'sf' || isAdultOnly(event) || isProfessional(event)) return null;
  return venueForEvent(event);
}

/** "11:00–16:00" → [660, 960]; "12:30 开始" → [750, 990]; nothing → null (minutes after Bay midnight). */
export function labelHours(label: string | undefined): [number, number] | null {
  if (!label) return null;
  const range = /(\d{1,2})[:：](\d{2})\s*[–—~-]\s*(\d{1,2})[:：](\d{2})/.exec(label);
  if (range) {
    const a = Number(range[1]) * 60 + Number(range[2]), b = Number(range[3]) * 60 + Number(range[4]);
    return a < b && b <= 24 * 60 ? [a, b] : null;
  }
  const start = /(\d{1,2})[:：](\d{2})\s*(?:开始|起|start)/i.exec(label);
  if (start) {
    const a = Number(start[1]) * 60 + Number(start[2]);
    return a < LATEST ? [a, Math.min(LATEST, a + 240)] : null;
  }
  return null;
}

const TIME = /(\d{1,2})[:：](\d{2})/g;
const RANGE = /(\d{1,2})[:：](\d{2})\s*[–—~-]\s*(\d{1,2})[:：](\d{2})/g;
/** 周二、四 / 周六、日 / 每周日 → weekdays (0 = Sunday) */
const WEEKDAY = /周([一二三四五六日天](?:[、，,]?[一二三四五六日天])*)/g;
const WD: Readonly<Record<string, number>> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
/** 9/29、10/2 · 10/9–11 · 10/4–10/12 · 10 月 17 日 */
const MONTH_DAY = /(\d{1,2})\/(\d{1,2})(?:\s*[–-]\s*(?:(\d{1,2})\/)?(\d{1,2})(?![:：\d]))?|(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;

interface LabelPart { text: string; days: Set<string>; weekdays: Set<number>; rest: boolean }

function labelParts(label: string, year: number): LabelPart[] {
  const dot = label.indexOf('·');
  const detail = dot >= 0 ? label.slice(dot + 1) : label;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return detail.split(/[；;]/).map(text => {
    const days = new Set<string>(), weekdays = new Set<number>();
    for (const m of text.matchAll(MONTH_DAY)) {
      const mo = Number(m[1] ?? m[5]), d0 = Number(m[2] ?? m[6]);
      const mo1 = m[3] ? Number(m[3]) : mo, d1 = m[4] ? Number(m[4]) : d0;
      if (mo1 === mo && d1 >= d0 && d1 - d0 < 31) for (let d = d0; d <= d1; d++) days.add(`${year}-${pad2(mo)}-${pad2(d)}`);
      else { days.add(`${year}-${pad2(mo)}-${pad2(d0)}`); days.add(`${year}-${pad2(mo1)}-${pad2(d1)}`); }
    }
    for (const m of text.matchAll(WEEKDAY)) for (const ch of m[1]) if (ch in WD) weekdays.add(WD[ch]);
    return { text, days, weekdays, rest: /其余|其他日期|其它日期/.test(text) };
  });
}

/** Hours in one piece of a label: every "HH:mm–HH:mm" joined (earliest start, latest end), else a start ("HH:mm 开始",
 *  or the first plain time) opened early by its doors ("HH:mm 开门") and closed 4 h later (≤ 21:00). */
function partHours(text: string): [number, number] | null {
  let a = Infinity, b = -Infinity;
  for (const m of text.matchAll(RANGE)) {
    const s = Number(m[1]) * 60 + Number(m[2]), e = Number(m[3]) * 60 + Number(m[4]);
    if (s < e && e <= 24 * 60) { a = Math.min(a, s); b = Math.max(b, e); }
  }
  if (a < b) return [a, b];
  let start: number | null = null, doors: number | null = null, plain: number | null = null;
  for (const m of text.matchAll(TIME)) {
    const t = Number(m[1]) * 60 + Number(m[2]);
    if (t >= 24 * 60) continue;
    const after = text.slice((m.index ?? 0) + m[0].length).trimStart();
    if (/^(开门|入场)/.test(after)) doors ??= t;
    else if (/^(开始|起|start)/i.test(after)) start ??= t;
    else if (!/^(签到|结束|截止)/.test(after)) plain ??= t;
  }
  const s = start ?? plain;
  if (s === null || s >= LATEST) return null;
  return [doors !== null && doors < s ? doors : s, Math.min(LATEST, s + 240)];
}

/**
 * (W6-S) The hours a catalog date label gives for one Bay date: the part naming that date (10/4 14:00) or its weekday
 * (周六08:00–14:00) wins, then a part for the other dates (其余所列日期 19:30), then the parts naming no day at all. The
 * autumn catalog's labels read "10/23 · 19:00；17:30 开门", "9/29、10/2 19:30；10/4 14:00" or "周二、四10:00–14:00；周六…".
 */
export function labelHoursOn(label: string | undefined, dateKey: string): [number, number] | null {
  if (!label) return null;
  const year = Number(dateKey.slice(0, 4));
  const weekday = new Date(Date.UTC(year, Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10)))).getUTCDay();
  const parts = labelParts(label, year);
  const named = (p: LabelPart) => p.days.size > 0 || p.weekdays.size > 0;
  const pick = (list: LabelPart[]) => list.length ? partHours(list.map(p => p.text).join('；')) : null;
  return pick(parts.filter(p => p.days.has(dateKey) || p.weekdays.has(weekday)))
    ?? pick(parts.filter(p => p.rest))
    ?? pick(parts.filter(p => !named(p)))
    ?? labelHours(label);
}

/** An event's hours on the Bay date `dateKey` (minutes after midnight), or null when it is not on that day. */
export function eventHours(event: CatalogEvent, venue: EventVenue, dateKey: string): readonly [number, number] | null {
  if (!eventDaysInWindow(event, dateKey, dateKey).length) return null;
  const table = venue.hours?.[event.id];
  if (table) return table[dateKey] ?? null;
  return labelHoursOn(event.dateLabel, dateKey) ?? DEFAULT_HOURS;
}

/**
 * (W6-S) A catalog event the 今天 tab and the daily three already show as a hand row (realsf/todayRows.ts): the Ferry
 * Plaza farmers market (the autumn catalog lists it as an event) is the `market` row and the `market` task, so it is not
 * a second row or a second task. It still stands in the world (pennant, crowd, 看看活动) on its market days.
 */
export function handRowOf(event: Pick<CatalogEvent, 'id' | 'region' | 'venue'>): 'market' | null {
  return event.region === 'sf' && /farmers-market/.test(event.id) && /Ferry (Building|Plaza)/i.test(event.venue ?? '') ? 'market' : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const at = (dateKey: string, min: number) => parseBayDate(`${dateKey}T${pad(Math.floor(min / 60))}:${pad(min % 60)}`)?.getTime() ?? Number.NaN;

/** The event's window on a Bay date (null when it is not on). */
export function eventWindow(event: CatalogEvent, venue: EventVenue, dateKey: string): EventWindow | null {
  const h = eventHours(event, venue, dateKey);
  if (!h) return null;
  const open = at(dateKey, h[0]), close = h[1] >= 24 * 60 ? at(addDays(dateKey, 1), 0) : at(dateKey, h[1]);
  return Number.isFinite(open) && Number.isFinite(close) ? { event, venue, dateKey, open, close } : null;
}

/** The world events on at `date` (default: now on the Bay clock), the one closing first first. */
export function activeEventsAt(date: Date = bayNow(), catalog: Catalog | null = getCatalog()): EventWindow[] {
  if (!catalog) return [];
  const t = date.getTime(), day = bayParts(date).dateKey;
  const out: EventWindow[] = [];
  for (const event of catalog.events) {
    const venue = worldEvent(event);
    if (!venue) continue;
    const w = eventWindow(event, venue, day);
    if (w && t >= w.open && t < w.close) out.push(w);
  }
  return out.sort((a, b) => a.close - b.close || a.event.id.localeCompare(b.event.id));
}

/** The next window of each world event from `date` on within `days` days (a window already over today is skipped). */
export function weekEvents(date: Date = bayNow(), days = 7, catalog: Catalog | null = getCatalog()): EventWindow[] {
  if (!catalog) return [];
  const t = date.getTime(), today = bayParts(date).dateKey;
  const out: EventWindow[] = [];
  for (const { event } of upcomingEvents(catalog, today, days)) {
    const venue = worldEvent(event);
    if (!venue) continue;
    for (const day of eventDaysInWindow(event, today, addDays(today, days), today)) {
      const w = eventWindow(event, venue, day);
      if (w && w.close > t) { out.push(w); break; }
    }
  }
  return out.sort((a, b) => a.open - b.open || a.event.id.localeCompare(b.event.id));
}
