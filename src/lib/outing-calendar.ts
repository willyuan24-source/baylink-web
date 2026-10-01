import type { Outing } from './outings';

const validInstant = (value: number) => Number.isFinite(value) && Math.abs(value) <= 8.64e15;
const stamp = (value: number) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

// RFC 5545: physical lines are at most 75 UTF-8 octets, including continuation spaces.
function fold(line: string): string {
  const encoder = new TextEncoder();
  let output = '', bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { output += '\r\n '; bytes = 1; }
    output += character; bytes += length;
  }
  return output;
}

/** Callers must fetch the latest outing and check their live session before downloading. */
export function canExportOutingCalendar(outing: Outing, userId: string | null | undefined, now = Date.now()): boolean {
  if (!userId || outing.status !== 'open' || !validInstant(now) || !validInstant(outing.startAt)
    || !validInstant(outing.endAt) || outing.endAt <= now || outing.endAt <= outing.startAt
    || !Number.isSafeInteger(outing.planVersion) || outing.planVersion < 1
    || (outing.me && outing.me.userId !== userId)) return false;
  return outing.host.id === userId || !!(outing.me?.userId === userId && outing.me.status === 'confirmed'
    && !outing.me.waitlisted && outing.me.confirmedVersion === outing.planVersion);
}

export function buildOutingCalendar(outing: Outing, userId: string, now = Date.now(), locale = 'zh-Hans'): string {
  if (!canExportOutingCalendar(outing, userId, now)) throw new Error('This outing cannot be exported for the current account.');
  const description = locale === 'en'
    ? 'A one-time copy of your BAYLINK outing, not a ticket or booking. It does not update automatically. Check the outing on BAYLINK for changes or cancellation before leaving.'
    : locale === 'zh-Hant'
      ? '這是 BAYLINK 小隊安排的單次副本，不是門票或預約憑證，不會自動同步。出發前請回到小隊頁核對變更或取消。'
      : '这是 BAYLINK 小队安排的单次副本，不是门票或预约凭证，不会自动同步。出发前请回到小队页核对变更或取消。';
  // Deliberate allowlist: never serialize members, application notes, discussion or contact details.
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Outings//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:outing-${encodeURIComponent(outing.id)}@baylink.us`, `SEQUENCE:${outing.planVersion}`,
    `DTSTAMP:${stamp(now)}`, ...(validInstant(outing.updatedAt) ? [`LAST-MODIFIED:${stamp(outing.updatedAt)}`] : []),
    `DTSTART:${stamp(outing.startAt)}`, `DTEND:${stamp(outing.endAt)}`, `SUMMARY:${text(outing.title)}`,
    `LOCATION:${text([outing.venue, outing.city].filter(Boolean).join(', '))}`, `DESCRIPTION:${text(description)}`,
    `URL:https://www.baylink.us/together?outing=${encodeURIComponent(outing.id)}`,
    'STATUS:CONFIRMED', 'CLASS:PRIVATE', 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}

export function downloadOutingCalendar(outing: Outing, userId: string, now = Date.now(), locale = 'zh-Hans'): void {
  const blob = new Blob([buildOutingCalendar(outing, userId, now, locale)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `baylink-outing-${encodeURIComponent(outing.id)}.ics`;
  try { document.body.append(anchor); anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
