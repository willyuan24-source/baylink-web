import { translateText, type Locale } from '../../i18n/locale';

/** "加入这天计划：…" / "Add to this day’s plan: …" for one stop; none without a title. */
export function addToDayName(title: string | undefined, locale: Locale) {
  if (!title) return undefined;
  return `${locale === 'en' ? 'Add to this day’s plan: ' : `${translateText('加入这天计划', locale)}：`}${translateText(title, locale)}`;
}

/** "10/10" for a Pacific calendar day ("2026-10-10"): the confirmation and a new plan's title. */
export const shortDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
