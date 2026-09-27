import { useCallback } from 'react';
import { translateText, useLocale, type Locale } from '../i18n/locale';
import type { Bilingual } from './core/types';

/**
 * Opus Bay strings are authored as { zh, en }. zh is Simplified Chinese; Traditional is derived.
 * Inside native JSX elements the site runtime converts zh-Hans → zh-Hant automatically, but strings
 * used in attributes of custom components, canvas labels or document.title must go through pick().
 */
export function pick(text: Bilingual | string, locale: Locale): string {
  if (typeof text === 'string') return locale === 'en' ? text : translateText(text, locale);
  if (locale === 'en') return text.en;
  return locale === 'zh-Hant' ? translateText(text.zh, 'zh-Hant') : text.zh;
}

export function useT() {
  const locale = useLocale();
  const t = useCallback((zh: string | Bilingual, en?: string) => (typeof zh === 'string' && en !== undefined ? pick({ zh, en }, locale) : pick(zh as Bilingual | string, locale)), [locale]);
  return { t, locale };
}

export const bi = (zh: string, en: string): Bilingual => ({ zh, en });
