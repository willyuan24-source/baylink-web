import { translateText, useLocale } from '../i18n/locale';

/** t(zh, en) for the legal pages; zh-Hant is the runtime conversion of zh. */
export function useLegalCopy() {
  const locale = useLocale();
  const english = locale === 'en';
  return { locale, english, t: (zh: string, en: string) => english ? en : translateText(zh, locale) };
}

/** A section title in English, with its Chinese name after it on Chinese pages. */
export const legalTitle = (en: string, zh: string, english: boolean) => english ? en : `${en} / ${zh}`;
