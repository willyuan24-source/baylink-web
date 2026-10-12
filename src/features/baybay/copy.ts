import { translateText, useLocale } from '../../i18n/locale';

/** t(zh, en) for the BayBay panel; 繁體 is the runtime conversion of zh. */
export function useBayBayCopy() {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  return { locale, english, t, pick: (copy: { zh: string; en: string }) => t(copy.zh, copy.en) };
}
