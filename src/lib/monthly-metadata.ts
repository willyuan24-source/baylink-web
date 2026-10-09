import { EVENTS_INDEX } from '../features/events/events-model';
import { SITE_URL, type PageMetadata } from './seo';

// Read from the slim events index (RC-33), not the full catalog: the events column's pages load this module.
const { edition, events } = EVENTS_INDEX;

export const MONTHLY_METADATA: PageMetadata = {
  title: `${edition.label}湾区活动、优惠与新店消息｜BAYLINK`,
  description: 'BAYLINK 2026 秋季湾区精选：收录至 11 月 30 日已公布的文化、户外、美食、亲子活动与本地优惠，附日期、预约条件、资格限制和官方来源。',
  path: '/this-month',
  image: `${SITE_URL}/guides/november/autumn-community.webp`,
  structuredData: [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `${edition.label}湾区生活精选`, url: `${SITE_URL}/this-month`, dateModified: edition.checkedAt,
    mainEntity: { '@type': 'ItemList', itemListElement: events.map((event, index) => ({ '@type': 'ListItem', position: index + 1, name: event.title, url: `${SITE_URL}/events/${event.id}` })) },
  }],
};

/** /events (活动, 本周末 by default). /this-week is a 301 to it. */
export const EVENTS_METADATA: PageMetadata = {
  ...MONTHLY_METADATA,
  path: '/events',
  title: '本周末湾区活动与官方来源｜BAYLINK',
  description: '按湾区当地日期查看本周末的真实活动，附日期、费用、主办方来源与出游入口。',
  structuredData: MONTHLY_METADATA.structuredData!.map(item => ({ ...item, url: `${SITE_URL}/events` })),
};
