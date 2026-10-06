import { SITE_URL, type PageMetadata } from './seo';

export const ARCHIVE_METADATA: PageMetadata = {
  title: '内容目录与往期记录｜BAYLINK',
  description: '按活动、优惠和新店浏览全部站内记录，保留原始日期、核对日期与状态；往期内容不表示当前可参与或领取。',
  path: '/archive',
  structuredData: [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '内容目录与往期记录', url: `${SITE_URL}/archive`,
    isPartOf: { '@type': 'WebSite', name: 'BAYLINK', url: SITE_URL },
  }],
};
