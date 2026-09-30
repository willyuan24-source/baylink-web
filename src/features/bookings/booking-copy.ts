import { translateText, useLocale } from '../../i18n/locale';
import { useCallback } from 'react';

export function useBookingCopy() {
  const locale = useLocale();
  const t = useCallback((zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale), [locale]);
  return { locale, t };
}
export type BookingTranslate = ReturnType<typeof useBookingCopy>['t'];
