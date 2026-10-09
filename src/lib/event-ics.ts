import type { MonthlyEvent } from '../data/monthly-types';
import { translateText } from '../i18n/locale';
import { addCalendarDays, eventOccursOn } from './event-calendar';

/**
 * An event's dates as an .ics file (the date-reminder downloads on /events, event pages and My Week). Kept out of monthly.ts so
 * that pages which only need today's date, an event's status or the event filter (guides, the home page) do not
 * download it; monthly.ts re-exports both functions for existing callers.
 */
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

export const buildEventCalendar = (event: MonthlyEvent, date?: string): string => {
  if (date !== undefined && !eventOccursOn(event, date)) throw new Error('This date is not a confirmed event occurrence.');
  const description = `这是活动日期提醒，不代表全天开放、预约或购票。具体场次、年龄限制与最新变动请查看主办方。\n${event.costLabel}\n${event.summary}\n官方详情：${event.officialUrl}\nBAYLINK 核对日期：${event.verifiedAt}`;
  const dates = date ? [{ start: date, end: date, uid: `${event.id}-${date}` }] : event.occurrenceDates === undefined ? [{ start: event.startDate, end: event.endDate, uid: event.id }]
    : [...new Set(event.occurrenceDates)].filter(day => day >= event.startDate && day <= event.endDate).sort().map(day => ({ start: day, end: day, uid: `${event.id}-${day}` }));
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Monthly Local Life//ZH', 'CALSCALE:GREGORIAN',
    ...dates.flatMap(({ start, end, uid }) => [
    'BEGIN:VEVENT', `UID:${uid}@baylink.us`, `DTSTAMP:${event.verifiedAt.replace(/-/g, '')}T120000Z`,
    `DTSTART;VALUE=DATE:${start.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDate(end)}`,
    `SUMMARY:${calendarText(translateText(`${event.title}（日期提醒）`))}`, `LOCATION:${calendarText(`${event.venue}, ${event.city}`)}`,
    `DESCRIPTION:${calendarText(translateText(description))}`, `URL:${event.officialUrl}`, 'TRANSP:TRANSPARENT', 'END:VEVENT']), 'END:VCALENDAR',
  ].map(foldCalendarLine).join('\r\n') + '\r\n';
};

export const downloadEventCalendar = (event: MonthlyEvent, date?: string): void => {
  const blob = new Blob([buildEventCalendar(event, date)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `baylink-${event.id}.ics`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
