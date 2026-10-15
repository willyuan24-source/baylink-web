import { translateText, type Locale } from '../../i18n/locale';

/**
 * The button's accessible name for one stop: "加入这天计划：…" / "Add to this day’s plan: …", and once the stop is in
 * that day's plan (`addedDay`: "10/10", or "Oct 10" on /en) "已加入 10/10 计划：…" / "In your Oct 10 plan: …", so the name
 * always starts with the visible text (WCAG 2.5.3). None without a title.
 */
export function addToDayName(title: string | undefined, locale: Locale, addedDay?: string) {
  if (!title) return undefined;
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const action = addedDay ? t(`已加入 ${addedDay} 计划`, `In your ${addedDay} plan`) : t('加入这天计划', 'Add to this day’s plan');
  return `${action}${locale === 'en' ? ': ' : '：'}${translateText(title, locale)}`;
}

/**
 * "10/10" for a Pacific calendar day ("2026-10-10"): the Chinese confirmation and a new plan's stored title (plan-title.ts
 * reads "10/10 计划" / "Plan for 10/10" back in the page's language). English confirmations use readerMonthDay ("Oct 10").
 */
export const shortDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
