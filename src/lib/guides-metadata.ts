import type { PageMetadata } from './seo';
import { HUB_CARDS } from './hub-cards';

/**
 * Shared by initial HTML and client navigation so the guide library has one description. H34: the title says what the
 * section is for (办事指南) with the site line 湾区去哪、怎么办; the English title stays short (SEO-3 H46: ≤60 characters).
 */
export const GUIDES_METADATA: PageMetadata = {
  title: '办事指南｜BAYLINK 湾区去哪、怎么办',
  english: { title: 'Bay Area how-to guides | BAYLINK' },
  description: '按生活场景查湾区活动、交通、就医、租客权益与实用办事步骤，每篇保留官方来源与核对说明。',
  path: '/guides',
  image: HUB_CARDS.guides,
};
