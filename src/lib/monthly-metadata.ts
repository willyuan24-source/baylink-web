import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../data/monthly-edition';
import { SITE_URL, type PageMetadata } from './seo';

export const MONTHLY_METADATA: PageMetadata = {
  title: `${MONTHLY_EDITION.label}湾区活动、优惠与新店消息｜BAYLINK`,
  description: 'BAYLINK 2026 秋季湾区精选：收录至 11 月 15 日已公布的文化、户外、美食、亲子活动与本地优惠，附日期、预约条件、资格限制和官方来源。',
  path: '/this-month',
  image: `${SITE_URL}/guides/november/autumn-community.webp`,
  structuredData: [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `${MONTHLY_EDITION.label}湾区生活精选`, url: `${SITE_URL}/this-month`, dateModified: MONTHLY_EDITION.checkedAt,
    mainEntity: { '@type': 'ItemList', itemListElement: MONTHLY_EVENTS.map((event, index) => ({ '@type': 'ListItem', position: index + 1, name: event.title, url: `${SITE_URL}/events/${event.id}` })) },
  }],
};
