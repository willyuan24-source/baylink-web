import type { MonthlyEvent } from '../data/monthly-types';
import type { PlannerEvent } from './planner';
import { EVENT_DATE_OVERRIDES } from '../data/event-calendar-dates';
import { CALENDAR_CITY_LOCATIONS } from '../data/calendar-city-locations';
import type { CalendarMapPoint } from '../components/CalendarEventMap';

export const CALENDAR_METADATA = { title: '湾区活动日历与地图｜BAYLINK', description: '按月或按周查看湾区活动，点击日期，在地图上发现当天的城市与场馆，保存你的出游安排。', path: '/calendar' };
export type CalendarView = 'month' | 'week';
export const validCalendarDay = (day: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= '1900-01-01' && day <= '2100-12-31' && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
/** Calendar arithmetic uses UTC noon; the selected day itself is a Pacific calendar date. */
export function addCalendarDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function shiftCalendarPeriod(day: string, view: CalendarView, direction: number): string {
  if (view === 'week') return addCalendarDays(day, direction * 7);
  const date = new Date(`${day}T12:00:00Z`); const preferred = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + direction);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
  date.setUTCDate(Math.min(preferred, last)); return date.toISOString().slice(0, 10);
}
export function calendarPeriod(day: string, view: CalendarView): { start: string; end: string; days: string[] } {
  const date = new Date(`${day}T12:00:00Z`);
  const start = view === 'week' ? addCalendarDays(day, -((date.getUTCDay() + 6) % 7)) : `${day.slice(0, 7)}-01`;
  const end = view === 'week' ? addCalendarDays(start, 6) : addCalendarDays(shiftCalendarPeriod(start, 'month', 1), -1);
  const days: string[] = []; for (let current = start; current <= end; current = addCalendarDays(current, 1)) days.push(current);
  return { start, end, days };
}
export function calendarCells(day: string, view: CalendarView): string[] {
  const period = calendarPeriod(day, view);
  if (view === 'week') return period.days;
  const start = calendarPeriod(period.start, 'week').start;
  const end = calendarPeriod(period.end, 'week').end;
  const days: string[] = []; for (let current = start; current <= end; current = addCalendarDays(current, 1)) days.push(current);
  return days;
}
export function eventOccursOn(event: MonthlyEvent, day: string, overrides: Record<string, string[]> = EVENT_DATE_OVERRIDES): boolean {
  return validCalendarDay(day) && event.startDate <= day && event.endDate >= day
    && (!Object.hasOwn(overrides, event.id) || overrides[event.id].includes(day));
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
