import { getLocale } from '../i18n/locale';
import { SITE_URL, type PageMetadata } from './seo';
import { HUB_CARDS } from './hub-cards';

const TITLE = { zh: '关于 BAYLINK｜湾区去哪、怎么办——有来源的中文答案', en: 'About BAYLINK | Where to go and how to get it done in the Bay, with sources' };
const DESCRIPTION = {
  zh: '湾区去哪、怎么办：活动、福利和办事指南，每条附来源和核对日期。BAYLINK 的核对方法、图片标签说明和联系方式。',
  en: 'Bay Area events, benefits and practical guides, each with its source and check date: how BAYLINK checks them, what image labels mean and how to reach us.',
};

/**
 * The positioning line (HOMEIA-03) in the page title and description. The English copy is co-located instead of living in
 * the editorial dictionary, so both are read when the page renders: getters follow the current locale (the app sets it
 * before routing; the prerender sets it before each language). zh-Hant still goes through the usual OpenCC conversion.
 */
export const ABOUT_METADATA: PageMetadata = {
  get title() { return getLocale() === 'en' ? TITLE.en : TITLE.zh; },
  get description() { return getLocale() === 'en' ? DESCRIPTION.en : DESCRIPTION.zh; },
  path: '/about',
  image: HUB_CARDS.brand,
  structuredData: [{
    '@context': 'https://schema.org', '@type': 'AboutPage',
    name: '关于 BAYLINK', url: `${SITE_URL}/about`,
    about: { '@type': 'WebSite', name: 'BAYLINK', url: SITE_URL },
  }],
};
