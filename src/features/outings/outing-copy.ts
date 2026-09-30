import { useCallback, useEffect, useState } from 'react';
import { translateText, useLocale } from '../../i18n/locale';

export function useOutingCopy() {
  const locale = useLocale();
  const t = useCallback((zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale), [locale]);
  return { locale, t };
}
export type OutingTranslate = ReturnType<typeof useOutingCopy>['t'];
export function useOutingNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(interval); }, []);
  return now;
}
