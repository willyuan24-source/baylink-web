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
  // Listing a program's date here made the assistant treat it as a chosen day.
  // Send optional catalog IDs only; ask for the user's date before planning.
  const known = events.slice(0, 2).map(({event}) => event.id).join('; ');
  const prefix = locale === 'en'
    ? `Help plan a half-day in ${city.nameEn} during ${month}. I have NOT chosen a date or event. First ask my preferred day, transport and companions; do not select a day for me. Use BAYLINK sources; do not invent events or live availability. Note booking checks. Optional catalog IDs, NOT my selections: `
    : `请帮我安排 ${month} 的${city.name}半日游。我还没有选择具体日期或活动，请先问哪一天、交通和同行人，不要替我选日期。使用 BAYLINK 来源，不编造活动或实时余票，说明需核实的时段与预约。以下只是可选目录 ID，不是我的选择：`;
  return prefix + (known || (locale === 'en' ? 'No confirmed city events listed.' : '暂未收录本城活动。')).slice(0, Math.max(0, 500-prefix.length));
}
