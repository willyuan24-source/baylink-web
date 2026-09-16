import { discoveryShare, type LocalDiscovery } from '../data/local-discoveries';
import { shareCardPath } from './editorial-share';
import { SITE_URL, type PageMetadata } from './seo';

export function getDiscoveryMetadata(item: LocalDiscovery): PageMetadata {
  const share = discoveryShare(item);
  return { title: `${share.title}｜BAYLINK`, description: `${share.date} · ${share.area}。${share.summary}`, path: share.path, image: shareCardPath(share), type: 'article',
    structuredData: [{ '@context': 'https://schema.org', '@type': 'Article', headline: share.title, description: share.summary, mainEntityOfPage: `${SITE_URL}${share.path}`, ...(share.checkedAt ? { dateModified: share.checkedAt } : {}), publisher: { '@type': 'Organization', name: 'BAYLINK', url: SITE_URL } }],
  };
}
