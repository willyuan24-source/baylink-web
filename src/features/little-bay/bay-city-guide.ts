import type { PlannerEvent } from '../../lib/planner';
import { addCalendarDays, calendarPeriod, eventOccursOn, shiftCalendarPeriod, validCalendarDay } from '../../lib/event-calendar';
import { BAY_CITIES, bayCityForPlace, type BayCity } from './bay-cities';
import { UNIFIED_BAY_PLACES, type UnifiedPlace } from './unified-bay-world';

export type CityEvent = { event: PlannerEvent; nextDate: string; dates: string[] };
export function cityGuideMonths(today: string) {
  if (!validCalendarDay(today)) return [];
  return [0, 1].map(offset => {
    const day = shiftCalendarPeriod(`${today.slice(0, 7)}-01`, 'month', offset), period = calendarPeriod(day, 'month');
    return { ...period, key: day.slice(0, 7), start: period.start < today ? today : period.start };
  });
}
export function eventsForBayCity(events: readonly PlannerEvent[], city: BayCity, month: string, today: string): CityEvent[] {
  const period = cityGuideMonths(today).find(item => item.key === month);
  if (!period) return [];
  return events.filter(event => event.city.trim().toLowerCase() === city.nameEn.toLowerCase() && event.region === city.region)
    .flatMap(event => {
      const start = event.startDate > period.start ? event.startDate : period.start;
      const end = event.endDate < period.end ? event.endDate : period.end;
      if (!validCalendarDay(start) || !validCalendarDay(end) || start > end) return [];
      const dates: string[] = [];
      for (let day = start; day <= end; day = addCalendarDays(day, 1)) if (eventOccursOn(event, day)) dates.push(day);
      return dates.length ? [{ event, nextDate: dates[0], dates }] : [];
    }).sort((a,b) => a.nextDate.localeCompare(b.nextDate) || a.event.id.localeCompare(b.event.id));
}
export function cityGuidePlaces(city: BayCity): UnifiedPlace[] {
  return UNIFIED_BAY_PLACES.filter(place => bayCityForPlace(place)?.id === city.id);
}
export function cityEventCounts(events: readonly PlannerEvent[], today: string): Record<string, number> {
  const months = cityGuideMonths(today);
  return Object.fromEntries(BAY_CITIES.map(city => [city.id, new Set(months.flatMap(month => eventsForBayCity(events,city,month.key,today).map(item=>item.event.id))).size]));
}
export function cityEventUrl(id: string, locale: string, together = false) {
  return `/events/${encodeURIComponent(id)}${locale === 'zh-Hans' ? '' : `?lang=${encodeURIComponent(locale)}`}${together ? '#event-participation' : ''}`;
}
/** Do not geocode a venue from a city centre: the query keeps the catalog's actual venue/address. */
export function cityEventMapUrl(event: PlannerEvent) {
  const query = event.location?.precision === 'venue' ? `${event.location.lat},${event.location.lng}` : `${event.venue}, ${event.city}, California`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
export function cityGuideAiPrompt(city: BayCity, month: string, events: CityEvent[], locale: string) {
  const known = events.slice(0, 2).map(({event,nextDate}) => `${event.id} (${nextDate}; ${event.venue})`).join('; ').slice(0,220);
  return locale === 'en'
    ? `Plan a half-day in ${city.nameEn} in ${month}. Ask my date, transport and companions first. Use BAYLINK sources; do not invent events or live availability. Note booking checks. Catalog IDs/dates: ${known || 'No confirmed city events listed.'}`
    : `请安排 ${month} 的${city.name}半日游，先问日期、交通与同行人。使用 BAYLINK 来源，不编造活动或实时余票，说明需核实的时段与预约。已收录活动 ID / 日期：${known || '暂未收录本城活动。'}`;
}
