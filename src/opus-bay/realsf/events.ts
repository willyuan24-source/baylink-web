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
 *   eventHours(e, v, day)    its hours on a Bay date: the venue table's verified hours, else the catalog label's
 *                            "HH:mm–HH:mm" (or a start "HH:mm 开始" + 4 h, ≤ 21:00), else 08:00–21:00; null = not that day
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

/** An event's hours on the Bay date `dateKey` (minutes after midnight), or null when it is not on that day. */
export function eventHours(event: CatalogEvent, venue: EventVenue, dateKey: string): readonly [number, number] | null {
  if (!eventDaysInWindow(event, dateKey, dateKey).length) return null;
  const table = venue.hours?.[event.id];
  if (table) return table[dateKey] ?? null;
  return labelHours(event.dateLabel) ?? DEFAULT_HOURS;
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
