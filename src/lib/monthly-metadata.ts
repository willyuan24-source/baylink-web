import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../data/monthly-edition';
import { SITE_URL, type PageMetadata } from './seo';

export const MONTHLY_METADATA: PageMetadata = {
  title: `${MONTHLY_EDITION.label}湾区活动、优惠与新店消息｜BAYLINK`,
  description: 'BAYLINK 2026 年 9–10 月湾区精选：覆盖至 10 月 31 日的社区节庆、南瓜季、亲子活动、免费文化日与本地优惠，附日期、预约条件和官方来源。',
  path: '/this-month',
  image: `${SITE_URL}/guides/distinct/september-edition.webp`,
  structuredData: [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `${MONTHLY_EDITION.label}湾区生活精选`, url: `${SITE_URL}/this-month`, dateModified: MONTHLY_EDITION.checkedAt,
    mainEntity: { '@type': 'ItemList', itemListElement: MONTHLY_EVENTS.map((event, index) => ({ '@type': 'ListItem', position: index + 1, name: event.title, url: `${SITE_URL}/events/${event.id}` })) },
  }],
};
