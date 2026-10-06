import { discoveryShare, type LocalDiscovery } from '../data/local-discoveries';
import { shareCardPath } from './editorial-share';
import { SITE_URL, type PageMetadata } from './seo';

export function getDiscoveryMetadata(item: LocalDiscovery): PageMetadata {
  const share = discoveryShare(item);
  const publisher = { '@type': 'Organization', name: 'BAYLINK', url: SITE_URL };
  const entity = item.kind === 'event' ? {
    '@context': 'https://schema.org', '@type': 'Event', name: share.title,
    description: share.summary, url: `${SITE_URL}${share.path}`,
    startDate: item.event.startDate, endDate: item.event.endDate,
    // Unknown start times and prices remain unknown; do not manufacture a midnight session or $0 ticket.
    location: { '@type': 'Place', name: item.event.venue, address: { '@type': 'PostalAddress', addressLocality: item.event.city, addressRegion: 'CA', addressCountry: 'US' } },
    image: [`${SITE_URL}${shareCardPath(share)}`],
    ...(item.event.cost === 'free' ? { isAccessibleForFree: true } : {}),
    ...(item.event.occurrenceDates ? { subEvent: item.event.occurrenceDates.map(date => ({ '@type': 'Event', name: share.title, startDate: date, endDate: date })) } : {}),
  } : { '@context': 'https://schema.org', '@type': 'Article', headline: share.title, description: share.summary, mainEntityOfPage: `${SITE_URL}${share.path}`, ...(share.checkedAt ? { dateModified: share.checkedAt } : {}), publisher };
  return { title: `${share.title}｜BAYLINK`, description: `${share.date} · ${share.area}。${share.summary}`, path: share.path, image: shareCardPath(share), type: 'article',
    structuredData: [entity, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: item.kind === 'event' ? '活动日历' : '当期发现', item: `${SITE_URL}${item.kind === 'event' ? '/calendar' : '/this-month'}` },
      { '@type': 'ListItem', position: 3, name: share.title, item: `${SITE_URL}${share.path}` },
    ] }],
  };
}
