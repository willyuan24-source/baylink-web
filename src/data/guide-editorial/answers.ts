import { translateText, type Locale } from '../../i18n/locale';
import type { EditorialCopy } from './types';

/**
 * The one-line answer printed on a pilot guide's coded cover in the index (1007 §4.4 "封面印大字短标题和一个关键数字").
 * Kept apart from the full editorial data so the /guides index does not load it. Facts come from the article.
 */
export const GUIDE_COVER_ANSWERS: Readonly<Record<string, EditorialCopy>> = {
  'bay-area-chinese-senior-services-referral-guide': { zh: '先打 800-510-2020', en: 'Call 800-510-2020 first' },
  'bay-area-medicare-hicap-medi-cal-guide': { zh: '免费咨询 1-800-434-0222', en: 'Free advice: 1-800-434-0222' },
  'bay-area-dental-care-insurance-low-cost-guide': { zh: 'Medi-Cal 牙科 1-800-322-6384', en: 'Medi-Cal Dental: 1-800-322-6384' },
  'bay-area-social-security-retirement-preparation-guide': { zh: '通常需 40 个工作积分', en: 'Usually needs 40 work credits' },
  'bay-area-naturalization-official-path-guide': { zh: '一般路径：绿卡满 5 年', en: 'Usual path: 5 years as a resident' },
  'bay-area-free-tax-help-vita-calfile-guide': { zh: '免费报税点 800-906-9887', en: 'Free tax help: 800-906-9887' },
  'california-tenant-deposit-rights-help-guide': { zh: '押金：搬出后 21 天', en: 'Deposit: 21 days after move-out' },
  'california-driver-license-id-preparation-guide': { zh: '先分清驾照、ID、REAL ID', en: 'License, ID or REAL ID first' },
};

export function guideEditorialAnswer(slug: string, locale: Locale): string | undefined {
  const answer = GUIDE_COVER_ANSWERS[slug];
  return answer ? locale === 'en' ? answer.en : translateText(answer.zh, locale) : undefined;
}
