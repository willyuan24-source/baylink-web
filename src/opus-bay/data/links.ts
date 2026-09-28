import type { Locale } from '../../i18n/locale';
import type { Catalog } from '../core/types';
import { addDays, eventDaysInWindow, eventNextDate, isDay, nextSaturday, todayInBay } from './catalog';

/**
 * Links into BAYLINK. Same-site paths keep the reader's language via `?lang=` for non zh-Hans locales,
 * exactly like the rest of the site. Only ids that exist in the published catalog become plan stops.
 */

export function withLang(path: string, locale: Locale): string {
  if (locale === 'zh-Hans') return path;
  const hashAt = path.indexOf('#');
  const base = hashAt < 0 ? path : path.slice(0, hashAt), hash = hashAt < 0 ? '' : path.slice(hashAt);
  return `${base}${base.includes('?') ? '&' : '?'}lang=${encodeURIComponent(locale)}${hash}`;
}

export const guideUrl = (slug: string, locale: Locale) => withLang(`/guides/${encodeURIComponent(slug)}`, locale);
export const guidesUrl = (locale: Locale) => withLang('/guides', locale);
export const eventUrl = (id: string, locale: Locale) => withLang(`/events/${encodeURIComponent(id)}`, locale);
export const myWeekUrl = (locale: Locale) => withLang('/my-week', locale);
/** A BAYLINK offer's page (`/offers/:id`, wave 5: the 今天 tab's 今天免费 rows). */
export const offerUrl = (id: string, locale: Locale) => withLang(`/offers/${encodeURIComponent(id)}`, locale);
export const homeUrl = (locale: Locale) => withLang('/', locale);
export const thisMonthUrl = (locale: Locale) => withLang('/this-month', locale);
export function calendarUrl(locale: Locale, opts: { date?: string; region?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.date && isDay(opts.date)) params.set('date', opts.date);
  if (opts.region && /^[a-z-]+$/.test(opts.region)) params.set('region', opts.region);
  const query = params.toString();
  return withLang(`/calendar${query ? `?${query}` : ''}`, locale);
}

export type PlanStop = { kind: 'place' | 'event'; id: string };

/** The site's planner keeps at most 3 stops (see src/lib/planner.ts cleanStops). */
export const PLAN_MAX_STOPS = 3;

/** Only stops whose ids exist in the catalog, de-duplicated, capped to what /plan accepts. */
export function validPlanStops(stops: PlanStop[], catalog: Catalog | null, cap = PLAN_MAX_STOPS): PlanStop[] {
  if (!catalog) return [];
  const seen = new Set<string>();
  const out: PlanStop[] = [];
  for (const stop of stops) {
    if (!stop || (stop.kind !== 'place' && stop.kind !== 'event') || typeof stop.id !== 'string') continue;
    const exists = stop.kind === 'place' ? catalog.places.some(place => place.id === stop.id) : catalog.events.some(event => event.id === stop.id);
    const key = `${stop.kind}:${stop.id}`;
    if (!exists || seen.has(key)) continue;
    seen.add(key);
    out.push(stop);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * `/plan?date=YYYY-MM-DD&stops=place:x,event:y#outing-plan` — the hash lands on the handed-off stops instead of the
 * top of the planner. Without an explicit date the date comes from `pickPlanDate` (a day every selected event is
 * really on), else the coming Saturday.
 */
export function planUrl(opts: { date?: string; stops: PlanStop[] }, catalog: Catalog | null, locale: Locale, today = todayInBay()): string {
  let stops = validPlanStops(opts.stops, catalog);
  let date = opts.date && isDay(opts.date) ? opts.date : nextSaturday(today);
  if (!(opts.date && isDay(opts.date)) && stops.some(stop => stop.kind === 'event')) {
    // never hand BAYLINK a day some of the events are not on: keep the ones that share the chosen day
    const pick = pickPlanDate(validPlanStops(opts.stops, catalog, Infinity), catalog, today);
    date = pick.date;
    stops = pick.stops;
  }
  const params = new URLSearchParams({ date });
  if (stops.length) params.set('stops', stops.map(stop => `${stop.kind}:${stop.id}`).join(','));
  return withLang(`/plan?${params.toString()}#outing-plan`, locale);
}

export type PlanPick = {
  /** the plan day (YYYY-MM-DD) */
  date: string;
  /** stops that fit that day (≤ PLAN_MAX_STOPS): events on that day, then places */
  stops: PlanStop[];
  /** selected events that are not on that day, each with its own next date (null = ended) */
  rest: { id: string; date: string | null }[];
};

/**
 * A plan date BAYLINK will accept: the earliest day within 14 days on which every selected event occurs. If there
 * is none, keep the events that share the soonest day (plus places, ≤ 3 stops) and list the others separately.
 * Ended events are dropped (they go to `rest` with date null).
 */
export function pickPlanDate(stops: PlanStop[], catalog: Catalog | null, today = todayInBay()): PlanPick {
  const valid = validPlanStops(stops, catalog, Infinity);
  const places = valid.filter(stop => stop.kind === 'place');
  const events = valid.filter(stop => stop.kind === 'event')
    .map(stop => {
      const event = catalog?.events.find(item => item.id === stop.id);
      return { stop, days: event ? eventDaysInWindow(event, today, addDays(today, 14), today) : [], next: event ? eventNextDate(event, today) : null };
    });
  const live = events.filter(item => item.next !== null);
  const ended = events.filter(item => item.next === null).map(item => ({ id: item.stop.id, date: null }));
  if (!live.length) {
    return { date: nextSaturday(today), stops: places.slice(0, PLAN_MAX_STOPS), rest: ended };
  }
  // a day inside the window on which every live event occurs (weekends first when several)
  const common = live.reduce<string[] | null>((acc, item) => (acc === null ? [...item.days] : acc.filter(day => item.days.includes(day))), null) ?? [];
  // keep the caller's order; over the cap, places give way to events
  const keep = (events: PlanStop[]) => {
    const out = valid.filter(stop => stop.kind === 'place' || events.includes(stop));
    while (out.length > PLAN_MAX_STOPS) {
      const lastPlace = out.map(stop => stop.kind).lastIndexOf('place');
      out.splice(lastPlace >= 0 ? lastPlace : out.length - 1, 1);
    }
    return out;
  };
  if (common.length) return { date: common[0], stops: keep(live.map(item => item.stop)), rest: ended };
  // no shared day: the soonest day any event is on, with every event that also runs that day
  const soonest = live.map(item => item.days[0] ?? item.next!).sort()[0];
  const onDay = live.filter(item => item.days.includes(soonest) || item.next === soonest);
  const others = live.filter(item => !onDay.includes(item)).map(item => ({ id: item.stop.id, date: item.days[0] ?? item.next }));
  return { date: soonest, stops: keep(onDay.map(item => item.stop)), rest: [...others, ...ended] };
}

/** Human names for what a plan link actually carries ("PIER 39", an event title). */
export function planStopTitles(stops: PlanStop[], catalog: Catalog | null): string[] {
  return validPlanStops(stops, catalog).map(stop => (stop.kind === 'place'
    ? catalog?.places.find(place => place.id === stop.id)?.title
    : catalog?.events.find(event => event.id === stop.id)?.title) ?? stop.id);
}

/**
 * Google Maps walking directions through real points (origin → waypoints → destination). Google allows at most
 * 9 waypoints on the web; extra middle points are thinned evenly. One point = directions to it from where you are.
 */
export function walkingRouteUrl(points: { lat: number; lng: number }[]): string | null {
  const ok = points.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!ok.length) return null;
  const fmt = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const params = new URLSearchParams({ api: '1', travelmode: 'walking' });
  if (ok.length === 1) { params.set('destination', fmt(ok[0])); return `https://www.google.com/maps/dir/?${params.toString()}`; }
  params.set('origin', fmt(ok[0]));
  params.set('destination', fmt(ok[ok.length - 1]));
  let middle = ok.slice(1, -1);
  if (middle.length > 9) middle = Array.from({ length: 9 }, (_, i) => middle[Math.round((i * (middle.length - 1)) / 8)]);
  if (middle.length) params.set('waypoints', middle.map(fmt).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Google Maps search link for a coordinate (label is only used when coordinates are missing). */
export function mapsUrl(lat: number | undefined, lng: number | undefined, label?: string): string {
  const query = Number.isFinite(lat) && Number.isFinite(lng) ? `${(lat as number).toFixed(5)},${(lng as number).toFixed(5)}` : label ?? 'San Francisco';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Human-readable domain for "信息来源" lines. */
export function sourceDomain(url: string | undefined): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** External links must be http(s); anything else (javascript:, data:) is dropped. */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/')) return url.startsWith('//') ? undefined : url;
  try { const parsed = new URL(url); return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined; } catch { return undefined; }
}
