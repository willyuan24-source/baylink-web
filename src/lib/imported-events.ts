import { validDay } from './planner';

export type ImportedEvent = {
  id: string; title: string; date: string; startTime: string; endTime: string;
  city: string; venue: string; address: string; price: string; sourceUrl: string; description: string;
};
export type EventDraft = Omit<ImportedEvent, 'id'>;
export const EMPTY_EVENT: EventDraft = { title: '', date: '', startTime: '', endTime: '', city: '', venue: '', address: '', price: '', sourceUrl: '', description: '' };
export const EVENT_LIMITS: Record<keyof EventDraft, number> = { title: 160, date: 10, startTime: 5, endTime: 5, city: 100, venue: 200, address: 300, price: 200, sourceUrl: 1000, description: 2000 };
export const validEventTime = (value: string) => value === '' || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function safeEventUrl(value: string): boolean {
  if (!value) return true;
  if (/\s/.test(value) || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function parseEventDraft(input: unknown): EventDraft | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const keys = Object.keys(EMPTY_EVENT) as Array<keyof EventDraft>;
  if (!keys.every(key => typeof record[key] === 'string' && (record[key] as string).length <= EVENT_LIMITS[key]
    && ![...(record[key] as string)].some(char => { const code = char.charCodeAt(0); return (code < 32 && ![9, 10, 13].includes(code)) || code === 127; }))) return null;
  const draft = Object.fromEntries(keys.map(key => [key, (record[key] as string).trim()])) as EventDraft;
  if ((draft.date && !validDay(draft.date)) || !validEventTime(draft.startTime) || !validEventTime(draft.endTime) || !safeEventUrl(draft.sourceUrl)) return null;
  return draft;
}
export function eventDraftError(draft: EventDraft): string {
  if (!draft.title.trim()) return '请填写活动名称。';
  if (!validDay(draft.date)) return '请确认活动的完整日期，包括年份。';
  if (!parseEventDraft(draft)) return '请检查时间、链接和文字长度。来源链接需以 https:// 开头。';
  if (draft.endTime && (!draft.startTime || draft.endTime <= draft.startTime)) return '结束时间应晚于开始时间；跨日活动请按每天分别记录。';
  return '';
}
export function parseImportedEvents(value: unknown): ImportedEvent[] | null {
  if (!Array.isArray(value) || value.length > 60) return null;
  const result: ImportedEvent[] = [];
  for (const item of value) {
    const draft = parseEventDraft(item);
    if (!draft || eventDraftError(draft) || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(item.id) || result.some(event => event.id === item.id)) return null;
    result.push({ id: item.id, ...draft });
  }
  return result;
}
const calendarText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const foldLine = (line: string) => {
  let result = '', bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += char; bytes += size;
  }
  return result;
};
/** A confirmed wall time belongs to the Bay Area, including daylight-saving changes. */
export function importedEventCalendar(event: ImportedEvent, now = new Date()): string {
  if (!parseImportedEvents([event])) throw new Error('Invalid event');
  const date = event.date.replaceAll('-', '');
  const next = new Date(`${event.date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const timing = event.startTime
    ? [`DTSTART;TZID=America/Los_Angeles:${date}T${event.startTime.replace(':', '')}00`, ...(event.endTime ? [`DTEND;TZID=America/Los_Angeles:${date}T${event.endTime.replace(':', '')}00`] : [])]
    : [`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replaceAll('-', '')}`];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Personal Events//EN', 'CALSCALE:GREGORIAN',
    ...(event.startTime ? ['BEGIN:VTIMEZONE', 'TZID:America/Los_Angeles', 'BEGIN:DAYLIGHT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'END:STANDARD', 'END:VTIMEZONE'] : []),
    'BEGIN:VEVENT', `UID:${event.id}@personal.baylink.us`, `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`, ...timing,
    `SUMMARY:${calendarText(event.title)}`, `LOCATION:${calendarText([event.venue, event.address, event.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${calendarText([event.description, event.price, 'Saved from a personal event card. Confirm details with the organizer.'].filter(Boolean).join('\n'))}`,
    ...(event.sourceUrl ? [`URL:${event.sourceUrl}`] : []), 'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR'].map(foldLine).join('\r\n') + '\r\n';
}
export function downloadImportedEvent(event: ImportedEvent) {
  const url = URL.createObjectURL(new Blob([importedEventCalendar(event)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `baylink-event-${event.id}.ics`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
