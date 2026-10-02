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

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;

/**
 * W8-Q1 · a BAYLINK catalog string (`/planner-catalog.json` is Simplified Chinese only: event and place titles,
 * summaries, date labels) in the reader's language, through the site's own editorial dictionary (`translateText`,
 * loaded by `setLocale('en')`). Needed wherever such a string is JOINED into a sentence (`Take ${titles} to BAYLINK…`):
 * the site runtime translates a lone JSX text child, never a name inside an English template. In English a title the
 * dictionary does not know keeps only its Latin parts ("Exploratorium · 日间科学探索馆" → "Exploratorium", "Ferry
 * Plaza 农夫市集" → "Ferry Plaza"); a title with no Latin word at all stays as it is (never an empty name).
 */
export function catalogText(text: string, locale: Locale): string {
  if (locale === 'zh-Hans' || !text) return text;
  const out = translateText(text, locale);
  if (locale !== 'en' || !HAN.test(out)) return out;
  const parts = out.split(/\s*(?: · |｜|\/|：|（|）|\(|\))\s*/).map(part => part.trim()).filter(part => part && !HAN.test(part));
  if (parts.length) return parts.join(' · ');
  const words = out.replace(/[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]+/g, ' ').replace(/\s+/g, ' ').trim();
  return /[A-Za-z]{3}/.test(words) ? words : out;
}
