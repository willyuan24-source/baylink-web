import type { Guide } from '../data/guides';
import { getGuideMedia } from '../data/guide-media';
import { SITE_URL, absolutePageUrl, localCopy, safeSocialImage, type PageMetadata } from './seo';
import { guideShare, shareCardPath } from './editorial-share';
import { BAYLINK_EDITORIAL, BAYLINK_ORGANIZATION, publicationDates } from './schema-org';

/**
 * Only published editorial data belongs in the public article metadata. `published`: the day the guide first shipped
 * (data/first-published/guides.json), passed by the prerender only (see discovery-metadata.ts).
 */
export const getGuideMetadata = (guide: Guide, published?: string): PageMetadata => {
  const path = `/guides/${guide.slug}`;
  // The zh-Hans URL: the page's language edition localizes url, @id, item and mainEntityOfPage (i18n/metadata.ts).
  const url = absolutePageUrl(path, 'zh_CN');
  const image = getGuideMedia(guide).cover.src;
  return {
    title: `${guide.title}｜BAYLINK`, description: guide.summary, path, image: shareCardPath(guideShare(guide)), type: 'article',
    structuredData: [
      {
        '@context': 'https://schema.org', '@type': 'Article', '@id': `${url}#article`,
        headline: guide.title, description: guide.summary, inLanguage: 'zh-CN',
        url, mainEntityOfPage: url, ...publicationDates(published, guide.updatedAt),
        // The editorial desk: no personal author is recorded, so none is named.
        author: BAYLINK_EDITORIAL, publisher: BAYLINK_ORGANIZATION,
        image: safeSocialImage(image),
        citation: guide.sources.map((source) => source.url),
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: localCopy('首页', 'Home'), item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: localCopy('生活指南', 'Guides'), item: `${SITE_URL}/guides` },
          { '@type': 'ListItem', position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };
};
