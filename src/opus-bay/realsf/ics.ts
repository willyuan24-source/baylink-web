import type { CatalogEvent } from '../core/types';
import { addDays } from '../data/catalog';
import { publicText } from '../data/publicText';
import { catalogText } from '../i18n';
import type { Locale } from '../../i18n/locale';
import { atMinute } from './todayRows';
import { eventDayHours } from './freeWeek';
import type { LiveOffer } from './live';

/**
 * Wave 9 · lane R (W9-R3) · 「加到日历」 (review R§5 #10, idea 3): an .ics file for a BAYLINK event day or a free day of
 * BAYLINK's offers, with a reminder the day before (VALARM, TRIGGER -P1D; an all-day entry reminds at 09:00 the day
 * before). The same shape as the site's own event calendar (src/lib/monthly.ts buildEventCalendar: UID@baylink.us,
 * all-day DTSTART;VALUE=DATE when no time is known, 75-octet folding, "以官网为准" in the description); written here
 * rather than imported because the site builder drags the site's translator and monthly edition into the game, has no
 * VALARM and takes the site's event type. Timed entries are written in UTC (no VTIMEZONE needed). Its own lazy chunk:
 * loaded on the first tap.
 *
 *   buildIcs(entry)            the file's text (pure)
 *   eventIcs(event, day)       a catalog event on one of its days (its hours from the catalog's schedule / date label)
 *   offerIcs(offer, day, h)    a free day of an offer (its hours that day)
 *   downloadIcs(name, text)    save it (a Blob link; iOS opens 添加到日历)
 */

export interface IcsEntry {
  uid: string;
  title: string;
  /** Bay date */
  day: string;
  /** minutes after Bay midnight (both, or neither = all day) */
  start?: number;
  end?: number;
  location?: string;
  description?: string;
  url?: string;
  /** the reminder's text */
  alarm: string;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (day: string) => day.replace(/-/g, '');
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

/** Fold a content line at 75 octets (RFC 5545 §3.1), as the site does. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  let out = '', bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 75) { out += '\r\n '; bytes = 1; }
    out += ch; bytes += n;
  }
  return out;
}

export function buildIcs(e: IcsEntry, stamp: number = Date.now()): string {
  const timed = e.start !== undefined && e.end !== undefined && e.end > e.start;
  const when = timed
    ? [`DTSTART:${utc(atMinute(e.day, e.start!))}`, `DTEND:${utc(atMinute(e.day, e.end!))}`]
    : [`DTSTART;VALUE=DATE:${ymd(e.day)}`, `DTEND;VALUE=DATE:${ymd(addDays(e.day, 1))}`];
  // the day before: the same time for a timed entry; 09:00 the day before for an all-day one (−15 h from midnight)
  const trigger = timed ? 'TRIGGER:-P1D' : 'TRIGGER:-PT15H';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Little Bay Trip//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${e.uid}@baylink.us`, `DTSTAMP:${utc(stamp)}`, ...when,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    ...(e.url && /^https:\/\//.test(e.url) ? [`URL:${e.url}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.alarm)}`, trigger, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export { eventDayHours };

/** The venue, then the city unless the venue already names it (W9-R-review R-RP-6: never "…, San Francisco, CA, San Francisco"). */
export function icsLocation(venue: string | null | undefined, city: string | null | undefined): string {
  const v = (venue ?? '').trim(), c = (city ?? '').trim();
  if (!v) return c;
  return c && !v.toLowerCase().includes(c.toLowerCase()) ? `${v}, ${c}` : v;
}

/**
 * The .ics of a catalog event on one of its days, in the reader's language (W9-R-review R-RC-2 / R-RP-2: in English the
 * file was the catalog's Chinese — the card translates through the site runtime, a saved file never does): the title and
 * the venue through the site's dictionary (catalogText), the cost line through publicText; the first line stays bilingual.
 */
export function eventIcs(event: CatalogEvent, day: string, stamp?: number, locale: Locale = 'zh-Hans'): string {
  const h = eventDayHours(event, day);
  const title = catalogText(event.title, locale);
  const venue = event.venue ? catalogText(event.venue, locale) : '';
  const en = locale === 'en';
  // W9-R5: no working notes. (W9-R-review own-1) a cost line the site's dictionary does not know stays Chinese: never in
  // an English file (the official link is there)
  const shown = event.costLabel ? publicText(event.costLabel, locale) : '';
  const cost = en && /[\u3400-\u9fff]/.test(shown) ? '' : shown;
  return buildIcs({
    uid: `${event.id}-${day}`,
    title,
    day,
    ...(h ? { start: h[0], end: h[1] } : {}),
    location: icsLocation(venue, event.city),
    description: [
      '日期提醒 · 以官网为准 / Date reminder — check the official site before you go.',
      locale === 'zh-Hant' ? catalogText(cost, locale) : cost,
      event.officialUrl ? `${en ? 'Official' : '官网 / Official'}: ${event.officialUrl}` : '',
      `BAYLINK: https://www.baylink.us/events/${encodeURIComponent(event.id)}`,
      event.verifiedAt ? `${en ? 'BAYLINK checked' : 'BAYLINK 核对日期 / checked'}: ${event.verifiedAt}` : '',
    ].filter(Boolean).join('\n'),
    url: event.officialUrl,
    alarm: en ? `Tomorrow: ${title}` : `${catalogText('明天', locale)}：${title}`,
  }, stamp);
}

/** The .ics of an offer's free day (its hours that day, when known); the reminder in the reader's language. */
export function offerIcs(offer: LiveOffer, day: string, hours: [number, number] | null, stamp?: number, locale: Locale = 'zh-Hans'): string {
  const en = locale === 'en';
  return buildIcs({
    uid: `offer-${offer.id}-${day}`,
    title: en ? offer.title.en : `${offer.title.zh} / ${offer.title.en}`,
    day,
    ...(hours ? { start: hours[0], end: hours[1] } : {}),
    location: offer.place ? `${offer.place.name.en}, San Francisco` : 'San Francisco',
    description: [
      en ? offer.who.en : `${offer.who.zh} / ${offer.who.en}`,
      ...(en ? [] : [offer.requirement.zh]),
      offer.requirement.en,
      `${en ? 'Check before you go' : '以官网为准 / Check before you go'}: ${offer.source.url} (${offer.source.verifiedAt})`,
      `BAYLINK: https://www.baylink.us${offer.href}`,
    ].join('\n'),
    url: offer.source.url,
    alarm: en ? `Free tomorrow: ${offer.title.en}` : `明天免费：${offer.title.zh}`,
  }, stamp);
}

/** Save the file (never throws: a blocked download is the browser's to report). */
export function downloadIcs(name: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9-]+/gi, '-').slice(0, 80)}.ics`;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch { return false; }
}
