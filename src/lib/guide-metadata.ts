import type { Guide } from '../data/guides';
import { SITE_URL, absolutePageUrl, safeSocialImage, type PageMetadata } from './seo';

/** Only published editorial data belongs in the public article metadata. */
export const getGuideMetadata = (guide: Guide): PageMetadata => {
  const path = `/guides/${guide.slug}`;
  const url = absolutePageUrl(path);
  return {
    title: `${guide.title}｜BAYLINK`, description: guide.summary, path, image: guide.cover, type: 'article',
    structuredData: [
      {
        '@context': 'https://schema.org', '@type': 'Article', '@id': `${url}#article`,
        headline: guide.title, description: guide.summary, inLanguage: 'zh-CN',
        mainEntityOfPage: url, dateModified: guide.updatedAt,
        publisher: { '@type': 'Organization', name: 'BAYLINK', url: SITE_URL },
        ...(guide.cover ? { image: safeSocialImage(guide.cover) } : {}),
        citation: guide.sources.map((source) => source.url),
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'BAYLINK', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '生活指南', item: `${SITE_URL}/guides` },
          { '@type': 'ListItem', position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };
};
