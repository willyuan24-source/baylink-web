import { discoveryShare, type LocalDiscovery } from '../data/local-discoveries';
import { shareCardPath } from './editorial-share';
import { brandCase } from './event-facts';
import { SITE_URL, localCopy, type PageMetadata } from './seo';
import { getBayAreaToday } from './monthly';
import { listingEndedDaysAgo, NOINDEX_ENDED_DAYS } from './listing-lifecycle';
import { BAYLINK_EDITORIAL, BAYLINK_ORGANIZATION, eventOffers, eventOrganizer, eventStatusUrl, eventTimes, pacificDateTime, publicationDates, venueParts } from './schema-org';

const OFFLINE = 'https://schema.org/OfflineEventAttendanceMode';

/**
 * Event and Article JSON-LD for /events/:id, /offers/:id and /openings/:id (I18N-SEO-04, -13, H47). Times come from the
 * overlay's sessions or a one-day listing's date line (Bay Area wall time with its offset), the address from the overlay
 * or the venue's street line, the price only when stated, the page's language as inLanguage. `published` is the day an
 * offer or opening first shipped (data/first-published, passed by the prerender only, so the dates never ride in the
 * page's bundle; the app keeps the prerendered JSON-LD, seo.ts).
 */
/** The reviewed short title: an event's shortens its titles in every language, an offer's or opening's the English one (H46). */
const discoveryShortTitle = (item: LocalDiscovery): Pick<PageMetadata, 'shortTitle' | 'shortTitleScope'> => {
  if (item.kind === 'event') return { shortTitle: item.event.shortTitle };
  const short = (item.kind === 'offer' ? item.offer : item.shop) as { shortTitle?: string };
  return short.shortTitle ? { shortTitle: short.shortTitle, shortTitleScope: 'en' } : {};
};
export function getDiscoveryMetadata(item: LocalDiscovery, published?: string, today = getBayAreaToday()): PageMetadata {
  const share = discoveryShare(item);
  // An offer's page name shows its brand as the page does ("SFMTA · San Francisco"), not the catalog's capitals.
  const name = item.kind === 'offer' ? `${brandCase(item.offer.brand)} · ${item.offer.title}` : share.title;
  const url = `${SITE_URL}${share.path}`;
  const image = [`${SITE_URL}${shareCardPath(share)}`];
  let entity: Record<string, unknown>;
  if (item.kind === 'event') {
    const { event } = item;
    const times = eventTimes(event);
    const venue = venueParts(event.venue, event.address);
    // The venue string whole (the editorial dictionary translates it whole); its street line is also the address's.
    const place = (street: boolean) => ({ '@type': 'Place', name: event.venue, address: { '@type': 'PostalAddress', ...(street && venue.streetAddress ? { streetAddress: venue.streetAddress } : {}), addressLocality: event.city, ...(street && venue.postalCode ? { postalCode: venue.postalCode } : {}), addressRegion: 'CA', addressCountry: 'US' } });
    const status = eventStatusUrl(event.status);
    const organizer = eventOrganizer(event);
    const offers = eventOffers(event);
    // Named sessions when the overlay lists several; otherwise the confirmed days of a non-continuous programme.
    const subEvents = times.sessions.length > 1
      ? times.sessions.map(session => ({ startDate: pacificDateTime(session.date, session.start), endDate: pacificDateTime(session.date, session.end) }))
      : !times.sessions.length && event.occurrenceDates?.length ? event.occurrenceDates.map(date => ({ startDate: date, endDate: date })) : [];
    entity = {
      '@context': 'https://schema.org', '@type': 'Event', name: share.title,
      // the page's own language (i18n/metadata.ts writes each edition's: zh-Hans, zh-Hant, en; H47)
      description: share.summary, inLanguage: 'zh-Hans', url, image,
      startDate: times.startDate, endDate: times.endDate,
      eventStatus: status, eventAttendanceMode: OFFLINE,
      // Unknown start times and prices remain unknown; do not manufacture a midnight session or $0 ticket.
      location: place(true),
      ...(organizer ? { organizer } : {}),
      ...(offers ? { offers } : {}),
      ...(event.cost === 'free' || event.price?.free ? { isAccessibleForFree: true } : {}),
      ...(subEvents.length ? { subEvent: subEvents.map(times => ({ '@type': 'Event', name: share.title, ...times, eventStatus: status, eventAttendanceMode: OFFLINE, location: place(false) })) } : {}),
    };
  } else {
    entity = {
      '@context': 'https://schema.org', '@type': 'Article', headline: name, description: share.summary, inLanguage: 'zh-Hans', url, mainEntityOfPage: url, image,
      ...publicationDates(published, share.checkedAt),
      author: BAYLINK_EDITORIAL, publisher: BAYLINK_ORGANIZATION,
    };
  }
  const section = item.kind === 'event' ? localCopy('活动', 'Events') : item.kind === 'offer' ? localCopy('免费与优惠', 'Free & deals') : localCopy('新店', 'New openings');
  // Keep each reviewed date/summary intact: date labels may already contain middle dots.
  // a month after its last day an ended listing asks not to be indexed (it left the sitemap after a week)
  const ended = (listingEndedDaysAgo(item, today) ?? -1) > NOINDEX_ENDED_DAYS;
  return { title: `${name}｜BAYLINK`, ...(ended ? { noindex: true } : {}), ...discoveryShortTitle(item), description: `${share.date} ｜ ${share.area} ｜ ${share.summary}`, path: share.path, image: shareCardPath(share), type: 'article',
    structuredData: [entity, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: localCopy('首页', 'Home'), item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: section, item: `${SITE_URL}/events` },
      { '@type': 'ListItem', position: 3, name, item: url },
    ] }],
  };
}
