import { discoveryShare, type LocalDiscovery } from '../data/local-discoveries';
import firstPublished from '../data/first-published/listings.json';
import { shareCardPath } from './editorial-share';
import { SITE_URL, localCopy, type PageMetadata } from './seo';
import { BAYLINK_EDITORIAL, BAYLINK_ORGANIZATION, eventOffers, eventOrganizer, eventStatusUrl, eventTimes, pacificDateTime, publicationDates, venueParts } from './schema-org';

const PUBLISHED = firstPublished as Record<string, string>;
const OFFLINE = 'https://schema.org/OfflineEventAttendanceMode';

/**
 * Event and Article JSON-LD for /events/:id, /offers/:id and /openings/:id (I18N-SEO-04, -13). Times come from the
 * overlay's sessions (Bay Area wall time with its offset), the address from the overlay or the venue's street line, the
 * price only when stated; an article's publication day is the day the listing first shipped (data/first-published).
 */
export function getDiscoveryMetadata(item: LocalDiscovery): PageMetadata {
  const share = discoveryShare(item);
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
      description: share.summary, url, image,
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
      '@context': 'https://schema.org', '@type': 'Article', headline: share.title, description: share.summary, url, mainEntityOfPage: url, image,
      ...publicationDates(PUBLISHED[`${item.kind}:${share.id}`], share.checkedAt),
      author: BAYLINK_EDITORIAL, publisher: BAYLINK_ORGANIZATION,
    };
  }
  const section = item.kind === 'event' ? localCopy('活动', 'Events') : item.kind === 'offer' ? localCopy('免费与优惠', 'Free & deals') : localCopy('新店', 'New openings');
  // Keep each reviewed date/summary intact: date labels may already contain middle dots.
  return { title: `${share.title}｜BAYLINK`, shortTitle: item.kind === 'event' ? item.event.shortTitle : undefined, description: `${share.date} ｜ ${share.area} ｜ ${share.summary}`, path: share.path, image: shareCardPath(share), type: 'article',
    structuredData: [entity, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: localCopy('首页', 'Home'), item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: section, item: `${SITE_URL}/events` },
      { '@type': 'ListItem', position: 3, name: share.title, item: url },
    ] }],
  };
}
