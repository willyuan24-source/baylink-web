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
  const line = address?.trim() || (streetIndex >= 0 ? parts[streetIndex] : '');
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
const LISTING_SITE = /^(?:www\.)?(?:visit|go|see|explore|discover)[a-z-]*\.|tourism|travel|chamber|patch\.com|sanjose\.org|funcheap|allevents|eventful/i;
/** The organizer named by the listing's official source, or nothing when the source is a report or a platform. */
export function eventOrganizer(event: Pick<MonthlyEvent, 'sourceLabel' | 'officialUrl'>): Record<string, unknown> | undefined {
  const label = event.sourceLabel.trim();
  if (/媒体报道|新闻|报道|media|news/i.test(label)) return undefined;
  let host = '';
  let origin = '';
  try { const url = new URL(event.officialUrl); host = url.hostname.replace(/^www\./, ''); origin = `${url.origin}/`; } catch { /* no organizer URL */ }
  // A bare domain names the organizer only when it is an organisation's own site (a city, a library, a park district, a
  // museum), never a visitor bureau, a listing site or a ticket platform.
  if (DOMAIN.test(label) && (!ORGANISATION_SITE.test(label) || LISTING_SITE.test(label))) return undefined;
  // "Lambtown Festival 主办方", "Novato 市官方活动页": the Latin name before the Chinese description of the page
  const name = DOMAIN.test(label) ? label.replace(/^www\./, '') : label.replace(/\s*\p{Script=Han}.*$/u, '').replace(/[\s·/,-]+$/, '').trim();
  if (!name || name.length < 3 || PLATFORM.test(name) || /^visit[\s·]/i.test(name)) return undefined;
  return { '@type': 'Organization', name, ...(origin && !PLATFORM.test(host) ? { url: origin } : {}) };
}

const STATUS: Record<string, string> = { cancelled: 'https://schema.org/EventCancelled', postponed: 'https://schema.org/EventPostponed' };
export const eventStatusUrl = (status?: MonthlyEvent['status']) => (status && STATUS[status]) || 'https://schema.org/EventScheduled';

/** Offers only from a stated price or a free listing; `availability` says sold out when the source does. */
export function eventOffers(event: Pick<MonthlyEvent, 'cost' | 'price' | 'officialUrl' | 'status'>): Record<string, unknown> | undefined {
  const availability = event.status === 'sold_out' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
  const base = { url: event.officialUrl, priceCurrency: 'USD', availability };
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
/** First start and last end: from the sessions when the overlay has them, else the listing's dates (date only). */
export function eventTimes(event: Pick<MonthlyEvent, 'startDate' | 'endDate' | 'sessions' | 'status'>): { startDate: string; endDate: string; sessions: readonly Session[] } {
  const sessions = event.status === 'postponed' || event.status === 'cancelled' ? [] : [...event.sessions || []].sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));
  if (!sessions.length) return { startDate: event.startDate, endDate: event.endDate, sessions };
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
