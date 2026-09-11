import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../data/monthly-edition';
import { SITE_URL, type PageMetadata } from './seo';

export const MONTHLY_METADATA: PageMetadata = {
  title: `${MONTHLY_EDITION.label}湾区活动、优惠与新店消息｜BAYLINK`,
  description: 'BAYLINK 九月湾区精选：周末活动、免费福利、咖啡优惠与新店开业消息，附日期、领取条件、商家和主办方来源。已开业、庆典与预告分别标示。',
  path: '/this-month',
  image: `${SITE_URL}/guides/distinct/september-edition.webp`,
  structuredData: [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `${MONTHLY_EDITION.label}湾区生活精选`, url: `${SITE_URL}/this-month`, dateModified: MONTHLY_EDITION.checkedAt,
    mainEntity: { '@type': 'ItemList', itemListElement: MONTHLY_EVENTS.map((event, index) => ({ '@type': 'ListItem', position: index + 1, name: event.title, url: `${SITE_URL}/this-month#event-${event.id}` })) },
  }],
};
