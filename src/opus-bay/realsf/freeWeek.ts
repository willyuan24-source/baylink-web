import type { Catalog, CatalogEvent, Vec2 } from '../core/types';
import { addDays, companionFit, eventDaysInWindow, isAdultOnly, isProfessional, upcomingEvents, weekday } from '../data/catalog';
import { labelHoursOn } from './events';
import { offersOn, type LiveOffer } from './live';

/**
 * Wave 9 · lane R (W9-R3) · free days AHEAD (review R§5 #10: the offers were visible only on their own day, the place
 * cards never showed a free day, 「免费就好」 never read the offers). Pure selectors over BAYLINK's own offers
 * (live.json, realsf/live.ts) and the catalog:
 *
 *   freeWeek(today, days, offers, catalog)   the next `days` Bay dates, each with its free things: the offers that apply
 *                                            that day (dated and monthly first; an offer free on most days of the week —
 *                                            the cable car museum — is "常年免费", not a day's news) and the free San
 *                                            Francisco events of the catalog (never 18+ / professional)
 *   freeDaysAt(point, today, days, offers)   a place card's free days in the next `days` days (offers at that place)
 *   alwaysFreeAt(point, offers)              the place's offers that are free on most days (one "常年免费" line instead)
 *
 * An offer belongs to a place card when its place id is one of the card's ids (the card's own id, its attraction's place
 * index id) or, failing that, its point is within NEAR_PLACE u of the card's (SFMOMA and MoAD stand 12.5 u apart: a
 * wider ring would show one's free day on the other's card).
 */

export type FreeItem =
  | { kind: 'offer'; day: string; offer: LiveOffer; hours: [number, number] | null }
  | { kind: 'event'; day: string; event: CatalogEvent };

export interface FreeDay { day: string; items: FreeItem[] }

/** Within this many u of a card's point an offer with none of the card's ids is that place's. */
export const NEAR_PLACE = 8;

/** Free on at least this many days of the week: a standing free place, not a day's news. */
const MOSTLY = 5;

/** How many weekdays a weekly offer applies on (dated / monthly offers: 0). */
function weeklyDays(o: LiveOffer): number {
  if (o.from || !o.weekdays) return 0;
  return o.weekdays.filter(w => !Array.isArray(o.hours) || o.hours.length !== 7 || (o.hours as unknown[])[w] !== null).length;
}

/** Free on most days of the week (the cable car museum, the Randall): "常年免费", never a day's item. */
export const mostlyFree = (o: LiveOffer) => o.free && weeklyDays(o) >= MOSTLY;

const rank = (o: LiveOffer) => (o.from ? 0 : o.nth ? 1 : 2);

/** The free offers of a Bay date (no standing / mostly-free ones), dated first. */
export function freeOffersOn(day: string, offers: LiveOffer[] | null): FreeItem[] {
  return offersOn(day, offers)
    .filter(({ offer }) => offer.free && !mostlyFree(offer))
    .sort((a, b) => rank(a.offer) - rank(b.offer) || a.offer.id.localeCompare(b.offer.id))
    .map(({ offer, hours }) => ({ kind: 'offer' as const, day, offer, hours }));
}

/** The free San Francisco events of the catalog on a Bay date (for everyone; with `companions` 'kids' / 'seniors' only
 *  the ones that fit them — 这周去哪's 带娃 never lists an evening block party). */
export function freeEventsOn(day: string, catalog: Catalog | null, companions: string | null = null): FreeItem[] {
  if (!catalog) return [];
  const out: FreeItem[] = [];
  for (const { event } of upcomingEvents(catalog, day, 0)) {
    if (event.region !== 'sf' || event.cost !== 'free' || isAdultOnly(event) || isProfessional(event)) continue;
    if ((companions === 'kids' || companions === 'seniors') && !companionFit(event, companions)) continue;
    if (!eventDaysInWindow(event, day, day, day).length) continue;
    out.push({ kind: 'event', day, event });
  }
  return out;
}

/** The next `days` Bay dates from `today` (inclusive), each with its free things (offers first). */
export function freeWeek(today: string, days: number, offers: LiveOffer[] | null, catalog: Catalog | null, companions: string | null = null): FreeDay[] {
  const out: FreeDay[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    out.push({ day, items: [...freeOffersOn(day, offers), ...freeEventsOn(day, catalog, companions)] });
  }
  return out;
}

const hhmm = (s: string): number | null => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** A catalog event's hours on a day: its schedule (planning.schedule.dates) first, else the date label. */
export function eventDayHours(event: CatalogEvent, day: string): [number, number] | null {
  const sched = (event as CatalogEvent & { planning?: { schedule?: { dates?: Record<string, { open?: string; close?: string }[]> } } }).planning?.schedule?.dates?.[day];
  if (Array.isArray(sched) && sched.length) {
    const opens = sched.map(s => hhmm(s.open ?? '')).filter((n): n is number => n !== null);
    const closes = sched.map(s => hhmm(s.close ?? '')).filter((n): n is number => n !== null);
    if (opens.length && closes.length) { const a = Math.min(...opens), b = Math.max(...closes); if (b > a) return [a, b]; }
  }
  return labelHoursOn(event.dateLabel, day);
}

const near = (o: LiveOffer, p: Vec2, ids: readonly string[] = []) =>
  !!o.place && ((!!o.place.id && ids.includes(o.place.id)) || Math.hypot(o.place.x - p.x, o.place.z - p.z) <= NEAR_PLACE);

/** A place card's free days in the next `days` days (its offers that are not mostly free), soonest first. */
export function freeDaysAt(point: Vec2, today: string, days: number, offers: LiveOffer[] | null, ids: readonly string[] = []): FreeItem[] {
  if (!offers) return [];
  const mine = offers.filter(o => o.free && near(o, point, ids) && !mostlyFree(o));
  const out: FreeItem[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    for (const { offer, hours } of offersOn(day, mine)) out.push({ kind: 'offer', day, offer, hours });
  }
  return out;
}

/** The place's offers free on most days of the week (one line: 常年免费 + the days it is closed). */
export function alwaysFreeAt(point: Vec2, offers: LiveOffer[] | null, ids: readonly string[] = []): LiveOffer[] {
  return (offers ?? []).filter(o => near(o, point, ids) && mostlyFree(o));
}

/** 周一 … 周日 / Mon … Sun of a Bay date. */
export const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
export const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const dayLabel = (day: string) => ({
  zh: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))} ${WEEKDAY_ZH[weekday(day)]}`,
  en: `${WEEKDAY_EN[weekday(day)]} ${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
});

