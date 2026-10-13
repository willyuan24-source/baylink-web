import { translateText, type Locale } from '../../i18n/locale';
import type { EditorialCopy } from './types';

/**
 * The one-line answer printed on a pilot guide's coded cover in the index (1007 §4.4 "封面印大字短标题和一个关键数字").
 * Kept apart from the full editorial data so the /guides index does not load it. Facts come from the article.
 */
export const GUIDE_COVER_ANSWERS: Readonly<Record<string, EditorialCopy>> = {
  'bay-area-chinese-senior-services-referral-guide': { zh: '先打 800-510-2020', en: 'Call 800-510-2020' },
  'bay-area-medicare-hicap-medi-cal-guide': { zh: '免费 1-800-434-0222', en: 'HICAP 1-800-434-0222' },
  'bay-area-dental-care-insurance-low-cost-guide': { zh: '牙科 1-800-322-6384', en: 'Dental 1-800-322-6384' },
  'bay-area-social-security-retirement-preparation-guide': { zh: '退休需 40 个工作积分', en: 'Retirement: 40 work credits' },
  'bay-area-naturalization-official-path-guide': { zh: '一般：绿卡满 5 年', en: 'Usually 5 years' },
  'bay-area-free-tax-help-vita-calfile-guide': { zh: '报税 800-906-9887', en: 'VITA 800-906-9887' },
  'california-tenant-deposit-rights-help-guide': { zh: '押金：搬出后 21 天', en: 'Deposit: 21 days' },
  'california-driver-license-id-preparation-guide': { zh: '首次驾照申请费 $46', en: 'First license: $46' },
  'bay-area-newcomer-first-month-checklist': { zh: '社安卡 3 周没到去 SSA', en: 'No SSN card in 3 weeks? SSA' },
  'bay-area-rental-scam-guide': { zh: '没看房先别转钱', en: "Don't pay before viewing" },
  'bay-area-october-muni-clipper-payment-update-2026': { zh: '长者用优惠 Clipper', en: 'Seniors: discount Clipper' },
  'half-moon-bay-coastal-half-day-guide': { zh: '入口 95 Kelly Avenue', en: 'Enter at 95 Kelly Avenue' },
  'bay-area-first-doctor-insurance-network-guide': { zh: '先认准保险网络', en: 'Know your network first' },
};

export function guideEditorialAnswer(slug: string, locale: Locale): string | undefined {
  const answer = GUIDE_COVER_ANSWERS[slug];
  return answer ? locale === 'en' ? answer.en : translateText(answer.zh, locale) : undefined;
}
