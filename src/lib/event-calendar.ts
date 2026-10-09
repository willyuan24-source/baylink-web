import type { MonthlyEvent } from '../data/monthly-types';
import type { PlannerEvent } from './planner';
import { EVENT_DATE_OVERRIDES } from '../data/event-calendar-dates';
import { CALENDAR_CITY_LOCATIONS } from '../data/calendar-city-locations';
import type { CalendarMapPoint } from '../components/CalendarEventMap';
import { validCalendarDay } from './calendar-days';

export { CALENDAR_METADATA } from './calendar-metadata';
export { addCalendarDays, calendarCells, calendarPeriod, shiftCalendarPeriod, validCalendarDay, type CalendarView } from './calendar-days';
export function eventOccursOn(event: MonthlyEvent, day: string, overrides: Record<string, string[]> = EVENT_DATE_OVERRIDES): boolean {
  const dates = Object.hasOwn(overrides, event.id) ? overrides[event.id] : event.occurrenceDates;
  return validCalendarDay(day) && event.startDate <= day && event.endDate >= day
    && (dates === undefined || dates.includes(day));
}
export const eventsOnCalendarDay = <T extends MonthlyEvent>(events: T[], day: string): T[] => events.filter(event => eventOccursOn(event, day));
export type CalendarMapGroup = CalendarMapPoint & { eventIds: string[]; sourceUrl: string };
/** Exact venue points stay distinct from explicitly labelled city/area fallback points. */
export function groupCalendarMapEvents(events: PlannerEvent[]): { points: CalendarMapGroup[]; unmapped: PlannerEvent[] } {
  const groups = new Map<string, CalendarMapGroup>(); const unmapped: PlannerEvent[] = [];
  for (const event of events) {
    const location = event.location || CALENDAR_CITY_LOCATIONS[event.city];
    if (!location || !Number.isFinite(location.lat) || Math.abs(location.lat) > 85 || !Number.isFinite(location.lng) || Math.abs(location.lng) > 180) { unmapped.push(event); continue; }
    const id = `${location.precision}:${event.city}:${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
    const group = groups.get(id);
    if (group) { group.eventIds.push(event.id); group.count++; }
    else groups.set(id, { id, city: event.city, title: event.location ? event.venue : event.city, lat: location.lat, lng: location.lng, count: 1, precision: location.precision, eventIds: [event.id], sourceUrl: location.sourceUrl });
  }
  return { points: [...groups.values()], unmapped };
}
