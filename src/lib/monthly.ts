import type { MonthlyEvent } from '../data/monthly-types';
import { MONTHLY_EDITION } from '../data/monthly-edition';
import { translateText } from '../i18n/locale';

const bayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
export const getBayAreaToday = (now = new Date()): string => {
  const parts = bayDate.formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
};

export const isEditionCurrent = (today = getBayAreaToday()): boolean => today.slice(0, 7) === MONTHLY_EDITION.month;
export const getEventStatus = (event: MonthlyEvent, today = getBayAreaToday()): 'upcoming' | 'ongoing' | 'ended' =>
  event.endDate < today ? 'ended' : event.startDate > today ? 'upcoming' : 'ongoing';

export type MonthlyDateFilter = 'all' | 'today' | 'weekend' | 'next7';
export const resolveMonthlyDateFilter = (value: string | null | undefined): MonthlyDateFilter =>
  value === 'today' || value === 'weekend' || value === 'next7' ? value : 'all';

// Treat the Bay Area date as a calendar day, never as a browser-local timestamp.
// UTC arithmetic keeps consecutive dates stable across DST and month/year changes.
const addCalendarDays = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const getMonthlyDateRange = (filter: MonthlyDateFilter, today = getBayAreaToday()): { start: string; end: string } | null => {
  if (filter === 'all') return null;
  if (filter === 'today') return { start: today, end: today };
  if (filter === 'next7') return { start: today, end: addCalendarDays(today, 6) };
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const start = addCalendarDays(today, weekday === 0 ? -1 : 6 - weekday);
  return { start, end: addCalendarDays(start, 1) };
};

export const filterMonthlyEvents = (events: MonthlyEvent[], filters: { region?: string; cost?: string; includeEnded?: boolean; date?: MonthlyDateFilter }, today = getBayAreaToday()): MonthlyEvent[] => {
  const range = getMonthlyDateRange(filters.date || 'all', today);
  return events.filter(event => (!filters.region || filters.region === 'all' || event.region === filters.region)
    && (!filters.cost || filters.cost === 'all' || event.cost === filters.cost)
    && (filters.includeEnded || getEventStatus(event, today) !== 'ended')
    && (!range || (event.startDate <= range.end && event.endDate >= range.start)));
};

const calendarText = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const nextDate = (date: string): string => addCalendarDays(date, 1).replace(/-/g, '');
// RFC 5545 folds at 75 UTF-8 octets, without splitting a Chinese character.
const foldCalendarLine = (line: string): string => {
  const encoder = new TextEncoder();
  let result = '', bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character; bytes += size;
  }
  return result;
};

export const buildEventCalendar = (event: MonthlyEvent): string => {
  const description = `这是活动日期提醒，不代表全天开放、预约或购票。具体场次、年龄限制与最新变动请查看主办方。\n${event.costLabel}\n${event.summary}\n官方详情：${event.officialUrl}\nBAYLINK 核对日期：${event.verifiedAt}`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Monthly Local Life//ZH', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${event.id}@baylink.us`, `DTSTAMP:${event.verifiedAt.replace(/-/g, '')}T120000Z`,
    `DTSTART;VALUE=DATE:${event.startDate.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDate(event.endDate)}`,
    `SUMMARY:${calendarText(translateText(`${event.title}（日期提醒）`))}`, `LOCATION:${calendarText(`${event.venue}, ${event.city}`)}`,
    `DESCRIPTION:${calendarText(translateText(description))}`, `URL:${event.officialUrl}`, 'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR',
  ].map(foldCalendarLine).join('\r\n') + '\r\n';
};

export const downloadEventCalendar = (event: MonthlyEvent): void => {
  const blob = new Blob([buildEventCalendar(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `baylink-${event.id}.ics`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
