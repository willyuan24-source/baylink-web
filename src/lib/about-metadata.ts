import { SITE_URL, type PageMetadata } from './seo';

export const ABOUT_METADATA: PageMetadata = {
  title: '关于 BAYLINK｜湾区生活信息网站',
  description: 'BAYLINK 提供湾区活动优惠、生活攻略、实用工具，以及房源、闲置和本地服务信息。了解 BayBay AI 助手和联系方式。',
  path: '/about',
  structuredData: [{
    '@context': 'https://schema.org', '@type': 'AboutPage',
    name: '关于 BAYLINK', url: `${SITE_URL}/about`,
    about: { '@type': 'WebSite', name: 'BAYLINK', url: SITE_URL },
  }],
};
