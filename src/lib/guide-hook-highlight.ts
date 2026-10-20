/**
 * Guide hooks (UI9-C, G19): the one sentence a guide's coded cover prints, with exactly one lime phrase.
 *
 * - A pilot guide with a one-line answer (src/data/guide-editorial/answers.ts, read only) prints that answer; its lime phrase
 *   is listed here by slug, in both reading languages. Each phrase is a substring of the answer (zh, its zh-Hant conversion
 *   and en: tests/cover-families.test.tsx), so this file adds no fact. Answers that are a phone number print on the number
 *   plate instead (coverPhoneKeep) and have no phrase.
 * - Any other guide prints the part of its title after the colon (splitGuideTitle, after translating), and its lime phrase is
 *   the first number, fee or phone run in it, else its first clause (`hookHighlight`).
 * scripts/generate-guide-data.ts and scripts/generate-home-catalog.ts carry the answered hooks into the generated cards, so
 * the /guides index and home read them without loading answers.ts.
 */
import { hookHighlight } from './guide-hook-phrase';

export type HookCopy = { zh: string; en: string };

export const GUIDE_HOOK_HIGHLIGHTS: Readonly<Record<string, HookCopy>> = {
  'bay-area-social-security-retirement-preparation-guide': { zh: '40 个工作积分', en: '40 work credits' },
  'bay-area-naturalization-official-path-guide': { zh: '绿卡满 5 年', en: '5 years' },
  'california-tenant-deposit-rights-help-guide': { zh: '21 天', en: '21 days' },
  'california-driver-license-id-preparation-guide': { zh: '$46', en: '$46' },
  'bay-area-newcomer-first-month-checklist': { zh: '3 周', en: '3 weeks' },
  'bay-area-rental-scam-guide': { zh: '先别转钱', en: 'Don\'t pay' },
  'bay-area-october-muni-clipper-payment-update-2026': { zh: '优惠 Clipper', en: 'discount Clipper' },
  'half-moon-bay-coastal-half-day-guide': { zh: '95 Kelly Avenue', en: '95 Kelly Avenue' },
  'bay-area-first-doctor-insurance-network-guide': { zh: '保险网络', en: 'network' },
  'bay-area-311-211-local-help-guide': { zh: '311', en: '311' },
  'san-jose-digital-help-sj-access-update-2026': { zh: '课还在', en: 'classes remain' },
  'bay-area-commute-guide': { zh: '试跑一次', en: 'trial run' },
  'bay-area-useful-apps-platforms-guide': { zh: '这周会用的', en: 'this week’s apps' },
  'bay-area-street-parking-first-time-guide': { zh: '先读路牌', en: 'Read the signs' },
  'bay-area-fastrak-bridge-express-lanes-guide': { zh: '分开算', en: 'bill apart' },
  'bay-area-bulky-items-ewaste-hhw-guide': { zh: '三类', en: 'Three kinds' },
  'bay-area-alerts-outages-first-day-checklist': { zh: '注册提醒', en: 'county alerts' },
  'bay-area-free-esl-adult-learning-guide': { zh: '免费英语课', en: 'Free ESL' },
  'bay-area-repair-request-guide': { zh: '先离开打 911', en: 'leave, call 911' },
  'bay-area-without-car-guide': { zh: '午夜收车', en: 'midnight' },
  'bay-area-senior-transit-clipper-discounts-guide': { zh: '62.5%', en: '62.5% off' },
  'bay-area-library-starter-guide': { zh: '办卡', en: 'Get a card' },
  'bay-area-holiday-hours-thanksgiving-new-year-2026': { zh: '11/26–27', en: 'Nov 26–27' },
};

// The phrase helpers the cover itself runs live in guide-hook-phrase.ts, so a page that only splits a title for its caption
// (guideCardHook) does not load them; their names stay importable from here.
export { hookHighlight, splitHook } from './guide-hook-phrase';

/** The hook fields scripts/generate-guide-data.ts and generate-home-catalog.ts add to an answered guide's card. */
export type GuideHookFields = { hook?: HookCopy; hi?: Partial<HookCopy> };
type Locale = 'zh-Hans' | 'zh-Hant' | 'en';

/** The guide title's head and the rest after its first colon (the same split as guide-facts.ts splitGuideTitle). */
export function splitTitleHook(title: string): { head: string; rest: string } {
  const match = /^(.{4,}?)(\s*[：:｜|]\s*)(.+)$/su.exec(title.trim());
  return match ? { head: match[1], rest: match[3] } : { head: title.trim(), rest: '' };
}

/**
 * What a guide card shows (G19): the cover's hook and lime phrase, and the caption. An answered guide prints its answer and
 * keeps its full title in the caption (`caption` undefined). Any other guide prints the title after the colon (translated
 * first) and its caption shows only the head; a title without a colon goes on the cover whole and the caption shows none
 * (''). `translated` is the title in the reader's language; `translate` converts a zh string to it.
 */
export function guideCardHook(card: GuideHookFields, translated: string, locale: Locale, translate: (zh: string) => string): { hook: string; hi?: string; caption?: string } {
  if (card.hook) {
    const hi = locale === 'en' ? card.hi?.en : card.hi?.zh && translate(card.hi.zh);
    return { hook: locale === 'en' ? card.hook.en : translate(card.hook.zh), hi: hi || undefined };
  }
  const { head, rest } = splitTitleHook(translated);
  return rest ? { hook: rest, caption: head } : { hook: translated, caption: '' };
}

/**
 * The hook fields an answered guide's card carries (generate time only: the scripts pass answers.ts in, so no page loads
 * it). A guide without an answer gets none and prints its title's hook.
 */
export function answeredHookFields(slug: string, answers: Readonly<Record<string, HookCopy>>): GuideHookFields {
  const answer = Object.hasOwn(answers, slug) ? answers[slug] : undefined;
  if (!answer) return {};
  const hi = Object.hasOwn(GUIDE_HOOK_HIGHLIGHTS, slug) ? GUIDE_HOOK_HIGHLIGHTS[slug] : undefined;
  // A phrase the page would pick by itself (hookHighlight) is not shipped again: only the languages where it differs.
  const zh = hi && hi.zh !== hookHighlight(answer.zh) ? hi.zh : undefined, en = hi && hi.en !== hookHighlight(answer.en) ? hi.en : undefined;
  return { hook: { zh: answer.zh, en: answer.en }, ...(zh || en ? { hi: { ...(zh ? { zh } : {}), ...(en ? { en } : {}) } } : {}) };
}
