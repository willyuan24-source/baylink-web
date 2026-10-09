import type { MonthlyEvent } from '../data/monthly-types';
import type { PlanningFacts } from './planner';
import { translateText } from '../i18n/locale';
import { addCalendarDays, eventOccursOn } from './event-calendar';

/**
 * An event's dates as an .ics file (the date-reminder downloads on /events, event pages and My Week). Kept out of monthly.ts so
 * that pages which only need today's date, an event's status or the event filter (guides, the home page) do not
 * download it; monthly.ts re-exports both functions for existing callers.
 *
 * E2E-13: when the session time of a day is confirmed (the editorial `sessions`, or the reviewed planning schedule), that
 * day is a timed event in America/Los_Angeles with reminders a day and two hours before; otherwise it stays an all-day
 * date reminder (never an invented time) with one reminder at 9:00 the day before.
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

export const CALENDAR_TIME_ZONE = 'America/Los_Angeles';
// US Pacific rules since 2007 (second Sunday in March, first Sunday in November), as calendar apps expect them.
const PACIFIC_TIME_ZONE = [
  'BEGIN:VTIMEZONE', `TZID:${CALENDAR_TIME_ZONE}`,
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'TZNAME:PDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'TZNAME:PST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

/** What the builder reads besides the catalog fields: the editorial sessions and the reviewed planning schedule, when present. */
export type CalendarEventInput = MonthlyEvent & {
  sessions?: { date: string; start?: string; end?: string }[];
  planning?: Pick<PlanningFacts, 'schedule' | 'programTimeUnconfirmed'>;
};
const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const clock = (value: string | undefined) => CLOCK.exec(value || '');
/** The confirmed start (and end) on one day, or undefined: sessions first, then the schedule's dates, sessions and weekly hours. */
export function sessionTimes(event: CalendarEventInput, day: string): { start: string; end?: string } | undefined {
  if (event.planning?.programTimeUnconfirmed) return undefined;
  const schedule = event.planning?.schedule;
  const weekly = schedule?.weekly && (!schedule.validFrom || day >= schedule.validFrom) && (!schedule.validThrough || day <= schedule.validThrough)
    ? schedule.weekly[new Date(`${day}T12:00:00Z`).getUTCDay()]?.[0] : undefined;
  const session = event.sessions?.find(item => item.date === day);
  const window = session?.start ? { start: session.start, end: session.end }
    : schedule?.dates?.[day]?.[0] ? { start: schedule.dates[day][0].open, end: schedule.dates[day][0].close }
    : schedule?.sessions?.find(item => item.date === day) ? (({ start, end }) => ({ start, end }))(schedule.sessions.find(item => item.date === day)!)
    : weekly ? { start: weekly.open, end: weekly.close } : undefined;
  const start = clock(window?.start), end = clock(window?.end);
  if (!start) return undefined;
  const pad = (match: RegExpExecArray) => `${match[1].padStart(2, '0')}${match[2]}00`;
  return { start: pad(start), ...(end && pad(end) > pad(start) ? { end: pad(end) } : {}) };
}

export const buildEventCalendar = (event: CalendarEventInput, date?: string): string => {
  if (date !== undefined && !eventOccursOn(event, date)) throw new Error('This date is not a confirmed event occurrence.');
  const description = `这是活动日期提醒，不代表全天开放、预约或购票。具体场次、年龄限制与最新变动请查看主办方。\n${event.costLabel}\n${event.summary}\n官方详情：${event.officialUrl}\nBAYLINK 核对日期：${event.verifiedAt}`;
  const dates = date ? [{ start: date, end: date, uid: `${event.id}-${date}` }] : event.occurrenceDates === undefined ? [{ start: event.startDate, end: event.endDate, uid: event.id }]
    : [...new Set(event.occurrenceDates)].filter(day => day >= event.startDate && day <= event.endDate).sort().map(day => ({ start: day, end: day, uid: `${event.id}-${day}` }));
  const title = translateText(`${event.title}（日期提醒）`);
  const alarm = (trigger: string, text: string) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${calendarText(translateText(text))}`, `TRIGGER:${trigger}`, 'END:VALARM'];
  // A single day with a confirmed time becomes a timed event; a multi-day run stays a date range.
  const timed = dates.map(({ start, end }) => start === end ? sessionTimes(event, start) : undefined);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Monthly Local Life//ZH', 'CALSCALE:GREGORIAN',
    ...(timed.some(Boolean) ? PACIFIC_TIME_ZONE : []),
    ...dates.flatMap(({ start, end, uid }, index) => {
      const time = timed[index];
      const day = start.replace(/-/g, '');
      return [
        'BEGIN:VEVENT', `UID:${uid}@baylink.us`, `DTSTAMP:${event.verifiedAt.replace(/-/g, '')}T120000Z`,
        ...(time ? [`DTSTART;TZID=${CALENDAR_TIME_ZONE}:${day}T${time.start}`, ...(time.end ? [`DTEND;TZID=${CALENDAR_TIME_ZONE}:${day}T${time.end}`] : [])]
          : [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDate(end)}`]),
        `SUMMARY:${calendarText(title)}`, `LOCATION:${calendarText(`${event.venue}, ${event.city}`)}`,
        `DESCRIPTION:${calendarText(translateText(description))}`, `URL:${event.officialUrl}`, 'TRANSP:TRANSPARENT',
        ...(time ? [...alarm('-P1D', `明天：${event.title}`), ...alarm('-PT2H', `两小时后开始：${event.title}`)] : alarm('-PT15H', `明天：${event.title}`)),
        'END:VEVENT',
      ];
    }), 'END:VCALENDAR',
  ].map(foldCalendarLine).join('\r\n') + '\r\n';
};

export const downloadEventCalendar = (event: CalendarEventInput, date?: string): void => {
  const blob = new Blob([buildEventCalendar(event, date)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `baylink-${event.id}.ics`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
