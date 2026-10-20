import type { MonthlyEvent } from '../data/monthly-types';
import { SITE_URL } from './seo';

/**
 * schema.org helpers for the Event and Article JSON-LD (I18N-SEO-04 / -13). Every value comes from a reviewed field:
 * a start time only from an editorial session, an address only from the overlay or the venue's own street line, a price
 * only from the overlay's structured price or a free listing, an organizer only from the listing's official source.
 * Unknown stays unknown: no midnight session, no $0 ticket, no organizer guessed from a media report or a ticket platform.
 */

/** The publisher and the author of BAYLINK's own articles: the editorial desk, never a person (none is recorded). */
export const BAYLINK_ORGANIZATION = { '@type': 'Organization', name: 'BAYLINK', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/baylink-app-icon.png`, width: 512, height: 512 } } as const;
export const BAYLINK_EDITORIAL = { '@type': 'Organization', name: 'BAYLINK', url: `${SITE_URL}/about` } as const;

const sundayOf = (year: number, month: number, nth: number) => {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (nth - 1) * 7;
};
/**
 * The Bay Area's UTC offset at a local wall time: PDT (-07:00) from the second Sunday of March 02:00 to the first Sunday
 * of November 02:00, else PST (-08:00). The repeated hour on the November change reads as PDT. Pure arithmetic, so the
 * build, the browser and every test agree without a time-zone database.
 */
export function pacificOffset(date: string, time = '12:00'): '-07:00' | '-08:00' {
  const [year, month, day] = date.split('-').map(Number);
  const start = sundayOf(year, 3, 2), end = sundayOf(year, 11, 1);
  const after = month > 3 || month === 3 && (day > start || day === start && time >= '02:00');
  const before = month < 11 || month === 11 && (day < end || day === end && time < '02:00');
  return after && before ? '-07:00' : '-08:00';
}
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
/** "2026-10-17T09:00:00-07:00" for a stated time; the bare date when the source states none. */
export const pacificDateTime = (date: string, time?: string): string => time && TIME.test(time) ? `${date}T${time}:00${pacificOffset(date, time)}` : date;

export type VenueParts = { name: string; streetAddress?: string; postalCode?: string };
const STREET = /^\d+[A-Za-z]?(?:-\d+)?\s+\S/;
/**
 * Venue strings are "Place · 430 Virginia Street, Vallejo, CA 94590": the part that starts with a house number is the
 * street line. The overlay's `address` (CNT-EVENTS) wins when present.
 */
export function venueParts(venue: string, address?: string): VenueParts {
  const parts = venue.split(' · ').map(part => part.trim()).filter(Boolean);
  const streetIndex = parts.findIndex(part => STREET.test(part));
  let line = address?.trim() || (streetIndex >= 0 ? parts[streetIndex] : '');
  // H47: a street line after a comma inside one part ("Healdsburg Regional Library 主阅览室，139 Piper Street",
  // "Oakland Arena, 7000 Coliseum Way"): the pieces from the house number on; the venue name keeps the whole part.
  if (!line) for (const part of parts) {
    const pieces = part.split(/，|,\s+/).map(piece => piece.trim());
    const first = pieces.findIndex((piece, index) => index > 0 && STREET.test(piece));
    if (first > 0) { line = pieces.slice(first).join(', '); break; }
  }
  const name = parts.filter((_, index) => index !== streetIndex).join(' · ') || venue;
  if (!line || !STREET.test(line)) return { name };
  const streetAddress = line.split(',')[0].trim();
  const postalCode = /\b(9\d{4})(?:-\d{4})?\b/.exec(line)?.[1];
  return { name, streetAddress, ...(postalCode ? { postalCode } : {}) };
}

/** Ticketing, calendar and social platforms list other people's events: they are not the organizer. */
const PLATFORM = /(?:^|\.)(?:luma\.com|lu\.ma|eventbrite\.com|ticketmaster\.com|livenation\.com|meetup\.com|axs\.com|partiful\.com|tixr\.com|universe\.com|seatgeek\.com|stubhub\.com|dice\.fm|posh\.vip|allevents\.in|facebook\.com|instagram\.com|activecommunities\.com|bibliocommons\.com|libcal\.com|evanced\.info|eventeny\.com|showclix\.com|etix\.com|ticketweb\.com|simpletix\.com|brownpapertickets\.com|zeffy\.com|givebutter\.com)$/i;
const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const ORGANISATION_SITE = /\.(?:gov|edu|org|us|museum)$/i;
/** Visitor bureaus, tourism boards, chambers and event listings: they list events, they do not organize them. */
const LISTING_SITE = /^(?:www\.)?(?:visit|see|explore|discover)[a-z-]*\.|tourism|travel|chamber|(?:^|\.)(?:patch\.com|sanjose\.org)$|funcheap|allevents|eventful/i;
const VISITOR_BUREAU = /visitors?\s+bureau|convention\s*(?:&|and)\s*visitors|tourism|visitor\s+cent(?:er|re)/i;
/** A site's section, not its organisation: calendar.santaclaraca.gov is santaclaraca.gov's calendar. */
const SECTION_HOST = /^(?:www|calendar|events?|admissions|members|tickets?|register|registration|apps?|portal)\./i;
/**
 * H47: the organisation behind an official host, as other listings of the same site already name it, in their label or
 * its reviewed English (tests/structured-data checks each name against the event data): a library page labelled only in
 * Chinese ("旧金山公共图书馆活动页") or by its domain still names its library. Venues' own sites (an arena's, a mall's) are not here: the venue is not the organizer.
 */
export const ORGANIZER_BY_HOST: Readonly<Record<string, string>> = {
  'sfpl.org': 'San Francisco Public Library',
  'cupertino.gov': 'City of Cupertino',
  'ssfca.gov': 'City of South San Francisco',
  'ebparks.org': 'East Bay Regional Park District',
  'danville.ca.gov': 'Town of Danville',
  'foodwise.org': 'Foodwise',
  'marinlibrary.bibliocommons.com': 'Marin County Free Library',
  'events.sonomalibrary.org': 'Sonoma County Library',
  'chsa.org': 'Chinese Historical Society of America',
  'petalumavintage.com': 'Petaluma Vintage Market',
};
/** The organizer named by the listing's official source, or nothing when the source is a report or a platform. */
export function eventOrganizer(event: Pick<MonthlyEvent, 'sourceLabel' | 'officialUrl'>): Record<string, unknown> | undefined {
  // Broader than the cards' press rule on purpose (lib/event-facts.ts isPressSource, the 「媒体报道 · 」 prefix): a label that
  // names an outlet anywhere ("… 报道 / 官网") could hand the outlet's name to the organizer below, so no organizer then.
  if (/媒体报道|新闻|报道|media|news/i.test(event.sourceLabel)) return undefined;
  // "Marin Convention & Visitors Bureau / Point Reyes Open Studios": the bureau lists, the studios organize
  const label = event.sourceLabel.split(/\s+\/\s+/).filter(part => !VISITOR_BUREAU.test(part)).join(' / ').trim();
  let host = '';
  let origin = '';
  try { const url = new URL(event.officialUrl); host = url.hostname.replace(/^www\./, ''); origin = `${url.origin}/`; } catch { /* no organizer URL */ }
  // the url only when the page is on the organizer's own site: never a ticket platform, a bureau or a listing site
  const organization = (name: string) => ({ '@type': 'Organization', name, ...(origin && !PLATFORM.test(host) && !LISTING_SITE.test(host) ? { url: origin } : {}) });
  const known = Object.hasOwn(ORGANIZER_BY_HOST, host) ? ORGANIZER_BY_HOST[host] : undefined;
  // A bare domain names the organizer only when it is an organisation's own site (a city, a library, a park district, a
  // museum), never a visitor bureau, a listing site or a ticket platform; a section host names its organisation.
  if (DOMAIN.test(label) && (!ORGANISATION_SITE.test(label) || LISTING_SITE.test(label))) return known ? organization(known) : undefined;
  // "Lambtown Festival 主办方", "Novato 市官方活动页": the Latin name before the Chinese description of the page
  const name = DOMAIN.test(label) ? label.replace(SECTION_HOST, '') : label.replace(/\s*\p{Script=Han}.*$/u, '').replace(/[\s·/,-]+$/, '').trim();
  if (!name || name.length < 3 || PLATFORM.test(name) || /^visit[\s·]/i.test(name)) return known ? organization(known) : undefined;
  // a bare domain label of a site whose organisation other listings name: that name
  return organization(DOMAIN.test(label) && known ? known : name);
}

const STATUS: Record<string, string> = { cancelled: 'https://schema.org/EventCancelled', postponed: 'https://schema.org/EventPostponed' };
export const eventStatusUrl = (status?: MonthlyEvent['status']) => (status && STATUS[status]) || 'https://schema.org/EventScheduled';

/**
 * Offers only from a stated price or a free listing, and none for a cancelled event. `availability` only when the source
 * states it (sold out): BAYLINK does not show live ticket availability (不代表实时余票), so it never claims InStock.
 */
export function eventOffers(event: Pick<MonthlyEvent, 'cost' | 'price' | 'officialUrl' | 'status'>): Record<string, unknown> | undefined {
  if (event.status === 'cancelled') return undefined;
  const base = { url: event.officialUrl, priceCurrency: 'USD', ...(event.status === 'sold_out' ? { availability: 'https://schema.org/SoldOut' } : {}) };
  const price = event.price;
  if (price && typeof price.min === 'number' && price.min >= 0) {
    return typeof price.max === 'number' && price.max > price.min
      ? { '@type': 'AggregateOffer', ...base, lowPrice: price.min, highPrice: price.max }
      : { '@type': 'Offer', ...base, price: price.min };
  }
  if (event.cost === 'free' || price?.free) return { '@type': 'Offer', ...base, price: 0 };
  return undefined;
}

type Session = NonNullable<MonthlyEvent['sessions']>[number];
const two = (value: number) => String(value).padStart(2, '0');
/** "14:00", "7:30 p.m.": 24-hour HH:MM, or undefined for anything that is not a clock time. */
const clock = (hours: string, minutes: string, meridiem?: string): string | undefined => {
  let hour = Number(hours);
  if (meridiem) { if (hour < 1 || hour > 12) return undefined; hour = hour % 12 + (/^p/i.test(meridiem) ? 12 : 0); }
  return hour <= 23 ? `${two(hour)}:${minutes}` : undefined;
};
// an hour reads its two digits first ("20:00", not "2"), and nothing reads into a longer number
const LABEL_TIME = /(2[0-3]|[01]?\d):([0-5]\d)(?!\d)(?:\s*([ap])\.?m\.?)?(?:\s*[–—~-]\s*(2[0-3]|[01]?\d)(?!\d)(?::([0-5]\d)(?!\d))?(?:\s*([ap])\.?m\.?)?)?/gi;
/** After a single time, one that is not when the event starts: doors, entry, registration or check-in ("19:00 开门",
 * "18:30入场／19:30开演"). An entry window ("9:00–12:30入场") is when the event runs, so it counts. */
const NOT_THE_START = /^\s*(?:开门|開門|入场|入場|进场|進場|登记|登記|签到|簽到|报到|報到|doors|check-in|registration)/i;
/** A single time that ends the event: "12:00 结束", "供餐至13:00", "until 9pm". */
const ENDS_AFTER = /^\s*(?:结束|結束|散场|散場|ends?\b)/i;
const ENDS_BEFORE = /(?:至|到|until|till)\s*$/i;
/** The clock times of a line that are not inside a longer number, a time or a date. The character before each is checked
 * in code: Safari before 16.4 cannot parse a regex look-behind (tests/opus-bay-w9-e-lookbehind). */
const labelTimeMatches = (line: string): RegExpExecArray[] => {
  const matches: RegExpExecArray[] = [];
  LABEL_TIME.lastIndex = 0;
  for (let match = LABEL_TIME.exec(line); match; match = LABEL_TIME.exec(line)) {
    if (match.index === 0 || !/[\d:/]/.test(line[match.index - 1])) matches.push(match);
    else LABEL_TIME.lastIndex = match.index + 1;
  }
  return matches;
};
/** A range's end: its hour needs its minutes or its am/pm ("–16:00", "–6pm"); a bare "–6" is not read. */
const rangeEnd = (match: RegExpExecArray): string | undefined => match[4] && (match[5] || match[6]) ? clock(match[4], match[5] || '00', match[6]) : undefined;
const after = (line: string, match: RegExpExecArray) => line.slice(match.index + match[0].length);
/** A single time the line says the event ends at. */
const endsAt = (line: string, match: RegExpExecArray): string | undefined => !match[4] && (ENDS_AFTER.test(after(line, match)) || ENDS_BEFORE.test(line.slice(0, match.index))) ? clock(match[1], match[2], match[3]) : undefined;
/**
 * H47: the stated times of a one-day listing without sessions, from its reviewed date line ("10/18 · 14:00–16:00",
 * "10 月 6 日 · 18:00–19:00", "10/10 · 10:30 开始"): the line the page shows, so the JSON-LD says what the page says. A
 * multi-day listing's line may give one day's hours only, so it states none. A doors, entry or registration time
 * ("19:00入场／20:00开演") is not the start. The end is the latest one the line states: of its ranges ("10:00–12:00 或
 * 13:00–15:00" ends at 15:00) or a time it ends at ("09:00 登记；10:00 开幕；12:00 结束", "9:00–12:30入场；供餐至13:00").
 */
export function labelTimes(event: Pick<MonthlyEvent, 'startDate' | 'endDate' | 'occurrenceDates' | 'dateLabel' | 'sessions' | 'status'>): { start: string; end?: string } | undefined {
  if (event.startDate !== event.endDate || event.sessions?.length || (event.occurrenceDates?.length ?? 0) > 1 || event.status === 'postponed' || event.status === 'cancelled') return undefined;
  const line = event.dateLabel || '';
  const matches = labelTimeMatches(line);
  const match = matches.find(time => !endsAt(line, time) && (time[4] || !NOT_THE_START.test(after(line, time))));
  if (!match) return undefined;
  // "4:30–6pm": the end's am/pm also reads the start when the start has none
  const start = clock(match[1], match[2], match[3] || (match[6] && Number(match[1]) <= Number(match[4]) ? match[6] : undefined));
  if (!start) return undefined;
  const end = matches.flatMap(time => [rangeEnd(time), endsAt(line, time)]).filter((time): time is string => !!time).sort().at(-1);
  return end && end > start ? { start, end } : { start };
}
/**
 * First start and last end: from the sessions when the overlay has them, else the start and end a one-day listing's date
 * line states (labelTimes), else the listing's dates (date only).
 */
export function eventTimes(event: Pick<MonthlyEvent, 'startDate' | 'endDate' | 'sessions' | 'status'> & Partial<Pick<MonthlyEvent, 'occurrenceDates' | 'dateLabel'>>): { startDate: string; endDate: string; sessions: readonly Session[] } {
  const sessions = event.status === 'postponed' || event.status === 'cancelled' ? [] : [...event.sessions || []].sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));
  if (!sessions.length) {
    const label = event.dateLabel ? labelTimes({ ...event, dateLabel: event.dateLabel }) : undefined;
    return label ? { startDate: pacificDateTime(event.startDate, label.start), endDate: pacificDateTime(event.endDate, label.end), sessions } : { startDate: event.startDate, endDate: event.endDate, sessions };
  }
  const first = sessions[0], last = sessions[sessions.length - 1];
  const lastEnd = [...sessions].reverse().find(session => session.date === last.date && session.end)?.end;
  return { startDate: pacificDateTime(first.date, first.start), endDate: pacificDateTime(last.date, lastEnd), sessions };
}

/**
 * Article dates: `datePublished` is the day the item first shipped (data/first-published), `dateModified` the later of
 * that day and the last editorial check — a page cannot have changed before it existed. Neither is invented when absent.
 */
export function publicationDates(published?: string, checked?: string): { datePublished?: string; dateModified?: string } {
  const modified = [published, checked].filter((day): day is string => !!day).sort().at(-1);
  return { ...(published ? { datePublished: published } : {}), ...(modified ? { dateModified: modified } : {}) };
}
