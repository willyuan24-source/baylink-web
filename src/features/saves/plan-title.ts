import { translateText, type Locale } from '../../i18n/locale';

/** The title 加入这天计划 gives a new plan, in the language it was created in ("10/10 计划", "10/10 計劃", "Plan for 10/10"). */
const AUTO_TITLE = /^(?:(\d{1,2}\/\d{1,2}) (?:计划|計劃|計畫)|Plan for (\d{1,2}\/\d{1,2}))$/u;

/**
 * A plan's title as My Week shows it. The title 加入这天计划 wrote is site copy: it reads in the page's language
 * (`auto`), so a plan made on /en does not show English on the Chinese page, or the reverse. Any other title is the
 * reader's own words and stays as written (the page marks it translate="no").
 */
export function planDisplayTitle(title: string, locale: Locale): { text: string; auto: boolean } {
  const match = AUTO_TITLE.exec(title.trim());
  if (!match) return { text: title, auto: false };
  const day = match[1] ?? match[2];
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return { text: t(`${day} 计划`, `Plan for ${day}`), auto: true };
}
