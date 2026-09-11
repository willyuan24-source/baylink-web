import { useSyncExternalStore } from 'react';
import { ConverterFactory } from 'opencc-js/core';
import searchCharacters from 'opencc-js/dict/TSCharacters';
import searchPhrases from 'opencc-js/dict/TSPhrases';
import patterns from './en-patterns.json';

export type Locale = 'zh-Hans' | 'zh-Hant' | 'en';
export const LOCALE_KEY = 'baylink.reading-language.v1';
const listeners = new Set<() => void>();
let current: Locale = 'zh-Hans';
let english: Record<string, string> = {};
let traditional: ((text: string) => string) | undefined;
let simplified: ((text: string) => string) | undefined;
let request = 0;
let englishLoad: Promise<void> | undefined;
let chineseLoad: Promise<void> | undefined;
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const englishPatterns = Object.entries(patterns).sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length).map(([source, target]) => ({
  pattern: new RegExp('^' + source.split(/\{\d+\}/).map(escapePattern).join('(.*?)') + '$', 's'), target,
}));

export const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ');
export const isLocale = (value: unknown): value is Locale => value === 'zh-Hans' || value === 'zh-Hant' || value === 'en';
export const getLocale = (): Locale => current;
export const subscribeLocale = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useLocale = () => useSyncExternalStore(subscribeLocale, getLocale, () => 'zh-Hans' as Locale);

const loadChinese = () => chineseLoad ||= import('opencc-js').then((module) => {
  traditional = module.Converter({ from: 'cn', to: 'tw' });
}).catch((error) => { chineseLoad = undefined; throw error; });

export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === 'en') await (englishLoad ||= import('./en.json').then((module) => { english = module.default; }).catch((error) => { englishLoad = undefined; throw error; }));
  else if (locale === 'zh-Hant') await loadChinese();
}

/** Preference changes never remount the app, rewrite form values, or touch account data. */
export async function setLocale(locale: Locale, persist = true): Promise<boolean> {
  const sequence = ++request;
  await loadLocale(locale);
  if (sequence !== request) return false;
  current = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  if (persist && typeof localStorage !== 'undefined') {
    try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* Session preference remains usable. */ }
  }
  listeners.forEach((listener) => listener());
  return true;
}

export async function initializeLocale(): Promise<void> {
  if (typeof window === 'undefined') return;
  const query = new URLSearchParams(window.location.search).get('lang');
  let stored: string | null = null;
  try { stored = localStorage.getItem(LOCALE_KEY); } catch { /* Optional browser storage. */ }
  await setLocale(isLocale(query) ? query : isLocale(stored) ? stored : 'zh-Hans', isLocale(query));
}

/** Only visible strings go through this function. IDs, API enums and URLs stay canonical. */
export function translateText(text: string, locale: Locale = current, depth = 0): string {
  if (locale === 'zh-Hans' || !/[\u3400-\u9fff]/.test(text)) return text;
  if (locale === 'zh-Hant') return (traditional?.(text) ?? text).replaceAll('噹噹天', '當當天').replaceAll('別隻憑', '別只憑');
  const exact = english[normalizeText(text)];
  if (exact) return text.slice(0, text.length - text.trimStart().length) + exact + text.slice(text.trimEnd().length);
  if (depth < 3) for (const { pattern, target } of englishPatterns) {
    const match = pattern.exec(text.trim());
    if (match) return text.slice(0, text.length - text.trimStart().length) + target.replace(/\{(\d+)\}/g, (_, index: string) => translateText(match[Number(index) + 1], locale, depth + 1)) + text.slice(text.trimEnd().length);
  }
  const colon = text.indexOf('：');
  if (colon > 0 && english[normalizeText(text.slice(0, colon))]) return english[normalizeText(text.slice(0, colon))] + ': ' + text.slice(colon + 1);
  return text.split(/(\n| · | \/ |｜)/).map((part) => part !== text && depth < 3 ? translateText(part, locale, depth + 1) : english[normalizeText(part)] || part).join('');
}

/** Search works on the first keystroke, independently of the display language.
 * Only the compact traditional-to-simplified dictionaries load synchronously;
 * phrase exceptions take precedence and the trie is built on first Chinese use.
 */
export const simplifySearch = (text: string): string => {
  if (!/\p{Script=Han}/u.test(text)) return text;
  simplified ||= ConverterFactory([searchPhrases, searchCharacters]);
  return simplified(text);
};
export function localizedUrl(value: string, locale: Locale = current): string {
  const url = new URL(value, 'https://www.baylink.us');
  if (locale === 'zh-Hans') url.searchParams.delete('lang'); else url.searchParams.set('lang', locale);
  return url.href;
}

/** Public editorial data only; useful for search and exported copies. */
export function translateEditorial<T>(value: T, locale: Locale = current): T {
  if (typeof value === 'string') return translateText(value, locale) as T;
  if (Array.isArray(value)) return value.map((item) => translateEditorial(item, locale)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateEditorial(item, locale)])) as T;
  return value;
}
