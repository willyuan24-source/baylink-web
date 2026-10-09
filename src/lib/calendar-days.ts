/**
 * Pacific calendar-day arithmetic with no data imports, so the events column can page through days without loading the
 * reviewed date overrides or city coordinates (event-calendar.ts re-exports these for its existing callers).
 * Calendar arithmetic uses UTC noon; the day itself is a Pacific calendar date (YYYY-MM-DD).
 */
export type CalendarView = 'month' | 'week';
export const validCalendarDay = (day: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= '1900-01-01' && day <= '2100-12-31' && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
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
