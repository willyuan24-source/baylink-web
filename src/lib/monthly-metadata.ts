import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../data/monthly-edition';
import { SITE_URL, type PageMetadata } from './seo';

export const MONTHLY_METADATA: PageMetadata = {
  title: `${MONTHLY_EDITION.label}湾区活动、周末攻略与推荐地点｜BAYLINK`,
  description: 'BAYLINK 九月湾区精选：花园钢琴、中秋街庆、音乐与艺术节、亲子和宠物活动，附主办方链接、日期提醒与半日玩法。',
  path: '/this-month',
  image: `${SITE_URL}/guides/editorial/weekend-illustration.webp`,
  structuredData: [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `${MONTHLY_EDITION.label}湾区生活精选`, url: `${SITE_URL}/this-month`, dateModified: MONTHLY_EDITION.checkedAt,
    mainEntity: { '@type': 'ItemList', itemListElement: MONTHLY_EVENTS.map((event, index) => ({ '@type': 'ListItem', position: index + 1, name: event.title, url: `${SITE_URL}/this-month#event-${event.id}` })) },
  }],
};
