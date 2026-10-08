import { translateText, useLocale, type Locale } from '../../i18n/locale';
import type { Copy } from '../../lib/event-facts';

/** Co-located UI copy for the primitives: t(zh, en); zh-Hant is the runtime conversion of zh. */
export function useUiCopy() {
  const locale: Locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const pick = (copy: Copy) => t(copy.zh, copy.en);
  return { locale, english, t, pick };
}

/** Joins class names, skipping empty values. */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');
