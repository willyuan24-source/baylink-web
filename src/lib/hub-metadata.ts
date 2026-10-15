import { SLUG_TO_CATEGORY } from '../routing';
import type { PageMetadata } from './seo';
import { HUB_CARDS } from './hub-cards';
import { COMMUNITY_VISIBLE } from '../data/site-flags';

/**
 * Metadata of the hub pages whose copy is not editorial data: the ten community categories and the three legal pages
 * (I18N-SEO-02). Each carries its reviewed English, so /en is English in the crawler HTML, at first paint and after the
 * app takes over (the prerender and AppLayout read the same records); zh-Hant is the usual conversion of the zh.
 */
export type Copy = { zh: string; en: string };

/** The categories' English names (I18N-SEO-16: 闲置 is "Secondhand", 翻译 is "Translation help"). */
export const CATEGORY_LABELS: Readonly<Record<string, Copy>> = {
  rent: { zh: '租屋', en: 'Housing' },
  used: { zh: '闲置', en: 'Secondhand' },
  moving: { zh: '搬家', en: 'Moving' },
  cleaning: { zh: '清洁', en: 'Cleaning' },
  ride: { zh: '接送', en: 'Rides' },
  repair: { zh: '维修', en: 'Repairs' },
  translation: { zh: '翻译', en: 'Translation help' },
  'part-time': { zh: '兼职', en: 'Part-time work' },
  other: { zh: '其他', en: 'Other' },
  service: { zh: '本地服务', en: 'Local services' },
};
export const categoryLabel = (slug: string): Copy => CATEGORY_LABELS[slug] ?? { zh: SLUG_TO_CATEGORY[slug] ?? '全部', en: 'All' };

export const categoryHubMetadata = (slug: string): PageMetadata => {
  // COMMUNITY_VISIBLE = false (site-flags.ts): the tab title matches the paused page's H1, in the app and the prerender.
  if (!COMMUNITY_VISIBLE) return {
    title: '邻里信息暂停中｜BAYLINK',
    description: '邻里信息（测试中）暂时不显示，也暂停发布。已有的私信和联系请求照常在「消息」里。',
    english: { title: 'The neighborhood board is paused | BAYLINK', description: 'The neighborhood board (beta) is hidden for now, and posting is paused. Your messages and contact requests are still in Messages.' },
    path: `/category/${slug}`,
    image: HUB_CARDS.brand,
    noindex: true,
  };
  const label = categoryLabel(slug);
  const lower = label.en === 'Other' ? 'other' : label.en.toLowerCase();
  return {
    title: `${label.zh}｜湾区本地信息 · BAYLINK`,
    description: `浏览湾区${label.zh}信息，按地区查找本地资源和邻里需求。请联系发布者确认信息仍有效。`,
    english: {
      title: `${label.en} | Bay Area local listings · BAYLINK`,
      description: `Browse Bay Area ${lower} listings by area: local resources and neighbors’ requests. Confirm with the poster that a listing is still current.`,
    },
    path: `/category/${slug}`,
    image: HUB_CARDS.brand,
  };
};

export const TERMS_METADATA: PageMetadata = {
  title: '服务条款｜BAYLINK',
  description: '了解 BAYLINK 的账号、信息发布、用户交易、AI 功能和短信验证使用条款。',
  english: { title: 'Terms of Service | BAYLINK', description: 'BAYLINK’s terms for accounts, posting, transactions between users, AI features and SMS verification.' },
  path: '/terms',
  image: HUB_CARDS.brand,
};
export const PRIVACY_METADATA: PageMetadata = {
  title: '隐私政策｜BAYLINK',
  description: '了解 BAYLINK 账号资料、公开内容、验证手机号、联系方式分享与隐私申请说明。',
  english: { title: 'Privacy Policy | BAYLINK', description: 'How BAYLINK handles account data, public content, verified phone numbers, contact sharing and privacy requests.' },
  path: '/privacy',
  image: HUB_CARDS.brand,
};
export const SMS_METADATA: PageMetadata = {
  title: '短信验证说明｜BAYLINK',
  description: '了解 BAYLINK 手机验证码的主动请求、用途、短信费用、退订与帮助说明。',
  english: { title: 'SMS Verification Consent | BAYLINK', description: 'How BAYLINK sends one-time phone verification codes only when you ask: purpose, message rates, STOP and HELP.' },
  path: '/sms-consent',
  image: HUB_CARDS.brand,
};
/** The legal pages by path, for AppLayout. */
export const LEGAL_METADATA: Readonly<Record<string, PageMetadata>> = { '/terms': TERMS_METADATA, '/privacy': PRIVACY_METADATA, '/sms-consent': SMS_METADATA };
