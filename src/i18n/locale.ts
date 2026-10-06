import { useSyncExternalStore } from 'react';
import { ConverterFactory } from 'opencc-js/core';
import searchCharacters from 'opencc-js/dict/TSCharacters';
import searchPhrases from 'opencc-js/dict/TSPhrases';
import patterns from './en-patterns.json';
import { pathLanguage, languagePath } from '../lib/language-path';
import { createEnglishScopeLoader, englishScopesForFeature, englishScopesForPath } from '../lib/english-loading';

export type Locale = 'zh-Hans' | 'zh-Hant' | 'en';
export const LOCALE_KEY = 'baylink.reading-language.v1';
const listeners = new Set<() => void>();
let current: Locale = 'zh-Hans';
let english: Record<string, string> = {};
let traditional: ((text: string, words?: boolean) => string) | undefined;
let simplified: ((text: string) => string) | undefined;
let request = 0;
let englishLoad: Promise<void> | undefined;
let chineseLoad: Promise<void> | undefined;
let englishFullyLoaded = false;
let dictionaryRevision = 0;
const notifyLocale = () => { dictionaryRevision++; listeners.forEach(listener => listener()); };
let englishScopes: ReturnType<typeof createEnglishScopeLoader> | undefined;
let englishScopeLoad: Promise<ReturnType<typeof createEnglishScopeLoader>> | undefined;
// Registry is lazy too: generation can import media/locale before scoped files exist.
const loadEnglishScopes = () => englishScopeLoad ||= import('../data/generated/english-scope-loaders').then(({ englishScopeLoaders }) => {
  return englishScopes = createEnglishScopeLoader(englishScopeLoaders, dictionary => { Object.assign(english, dictionary); notifyLocale(); });
}).catch(error => { englishScopeLoad = undefined; throw error; });
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const englishPatterns = Object.entries(patterns).sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length).map(([source, target]) => ({
  pattern: new RegExp('^' + source.split(/\{\d+\}/).map(escapePattern).join('(.*?)') + '$', 's'), target,
}));

export const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ');
export const isLocale = (value: unknown): value is Locale => value === 'zh-Hans' || value === 'zh-Hant' || value === 'en';
export const getLocale = (): Locale => current;
export const subscribeLocale = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const readingSnapshot = () => `${current}:${dictionaryRevision}`;
export const useLocale = () => { useSyncExternalStore(subscribeLocale, readingSnapshot, readingSnapshot); return current; };

const loadChinese = () => chineseLoad ||= import('opencc-js').then((module) => {
  traditional = taiwanConverter(module);
}).catch((error) => { chineseLoad = undefined; throw error; });

/**
 * The game's 繁體 (wave 9, lane L): mainland words with a different everyday Taiwan word, and the 里 that mean "in" where
 * opencc keeps 里. Keys are Simplified, values Traditional; applied before opencc on the game's page only (/opus-bay:
 * `gamePage()`), so the rest of the site reads as before.
 */
export const TAIWAN_WORDS: readonly (readonly [string, string])[] = [
  ['设置', '設定'], ['信息', '資訊'], ['意大利', '義大利'], ['视频', '影片'], ['音频', '音訊'], ['网络', '網路'], ['软件', '軟體'],
  ['默认', '預設'], ['屏幕', '螢幕'], ['搜索', '搜尋'], ['登录', '登入'], ['菜单', '選單'], ['鼠标', '滑鼠'], ['在线', '線上'],
  ['数据', '資料'], ['内存', '記憶體'], ['链接', '連結'], ['账号', '帳號'], ['短信', '簡訊'], ['博客', '部落格'], ['打印', '列印'],
  ['发布', '發布'], ['出租车', '計程車'], ['自行车', '腳踏車'], ['公交中心', '轉運中心'], ['公交车', '公車'], ['公交', '公車'],
  ['带娃', '帶小孩'], ['巴松管', '低音管'], ['施特劳斯', '史特勞斯'], ['弗莱明', '佛萊明'],
  ['旅行本里', '旅行本裡'], ['游戏里', '遊戲裡'], ['隧道里', '隧道裡'], ['进海里', '進海裡'], ['掉进海里', '掉進海裡'], ['放回海里', '放回海裡'],
  ['回海里', '回海裡'], ['看海里', '看海裡'], ['在海里', '在海裡'], ['到海里', '到海裡'],
  // (W9-L9) the wave-9 screens' words (loading, the device, saving a photo): whole phrases where the bare word has other
  // senses in the catalog's text (保存完好, 健身设备)
  ['加载', '載入'], ['这台设备', '這臺裝置'], ['卡或设备', '卡或裝置'], ['显卡', '顯示卡'], ['硬件加速', '硬體加速'], ['存储', '儲存'],
  ['已保存', '已儲存'], ['保存好', '儲存好'], ['无法保存', '無法儲存'], ['保存照片', '儲存照片'], ['保存到相册', '儲存到相簿'],
  ['相册', '相簿'], ['缩略图', '縮圖'], ['触屏', '觸控'],
];
/** …and after opencc: a name it splits wrong (Haight-Ashbury: 阿什伯里, not 阿什伯裡) */
const TAIWAN_AFTER: readonly (readonly [string, string])[] = [['阿什伯裡', '阿什伯里']];

/** The game's own page (TAIWAN_WORDS apply there). */

/**
 * The site's cn → tw converter (opencc 'tw'), safe to run twice. opencc turns a phrase it knows into Traditional
 * (马里纳区 → 馬里納區, 小家伙 → 小傢伙, 花岗岩 → 花崗岩), but a second pass over that output goes character by character
 * (馬裡納區, 小傢夥, 花崗巖) — and the site does convert twice wherever a string already in Traditional (the game's
 * pick()) is a JSX child (i18n/host.ts). So every conversion is checked: when its output would change again, each phrase
 * of the text is added to the trie as itself (Traditional → Traditional) and the second pass leaves it alone. Cheap: one
 * extra pass per string; the trie learns only the phrases that need it. `words`: TAIWAN_WORDS first and metres as 公尺.
 */
export function taiwanConverter(O: Pick<typeof import('opencc-js'), 'Trie' | 'Locale'>): (text: string, words?: boolean) => string {
  const [st0] = O.Locale.from.cn, [tw0] = O.Locale.to.tw;
  const st = new O.Trie(), tw = new O.Trie(), local = new O.Trie();
  st.loadDictGroup(st0);
  tw.loadDictGroup(tw0);
  local.loadDict(TAIWAN_WORDS);
  const once = (text: string) => tw.convert(st.convert(text));
  return (text: string, words = false) => {
    const source = words ? local.convert(text) : text;
    const out = once(source);
    if (once(out) !== out) {
      for (const part of st.segment(source)) {
        if (part.length < 2) continue;
        const fin = once(part);
        if (once(fin) !== fin) st.addWord(fin, fin);
      }
    }
    // metres: 40 米 → 40 公尺, 15,000 平方米 → 15,000 平方公尺 (never 米飯 / 米色 / 米其林 …)
    return words ? TAIWAN_AFTER.reduce((t, [from, to]) => t.replaceAll(from, to), out.replace(/(\d)(\s*)(平方)?米(?![飯色黃粉其糕蘭])/g, '$1$2$3公尺')) : out;
  };
}

export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === 'en') await (englishLoad ||= import('../data/generated/english.json').then(module => { english = module.default; englishFullyLoaded = true; notifyLocale(); }).catch((error) => { englishLoad = undefined; throw error; }));
  else if (locale === 'zh-Hant') await loadChinese();
}

const scopesForPaths = (paths: string | readonly string[]) => [...new Set((typeof paths === 'string' ? [paths] : paths).flatMap(path => englishScopesForPath(path, englishScopes!.has)))];
export function isLocaleReadyForPath(locale: Locale, paths: string | readonly string[]): boolean {
  return locale === 'en' ? englishFullyLoaded || !!englishScopes && englishScopes.isReady(scopesForPaths(paths)) : locale === 'zh-Hant' ? !!traditional : true;
}
/** Browser routes wait for their complete displayed content; full loadLocale remains available to exports and SSR. */
export async function loadLocaleForPath(locale: Locale, paths: string | readonly string[]): Promise<void> {
  if (locale === 'en') { if (!englishFullyLoaded) { const scopes = await loadEnglishScopes(); await scopes.load(scopesForPaths(paths)); } }
  else await loadLocale(locale);
}
export async function loadLocaleForFeature(locale: Locale, feature: 'search'): Promise<void> {
  if (locale === 'en') { if (!englishFullyLoaded) { const scopes = await loadEnglishScopes(); await scopes.load(englishScopesForFeature(feature)); } }
  else await loadLocale(locale);
}

/** Preference changes never remount the app, rewrite form values, or touch account data. */
export async function setLocale(locale: Locale, persist = true, pathname?: string): Promise<boolean> {
  const sequence = ++request;
  if (pathname !== undefined) await loadLocaleForPath(locale, pathname);
  else await loadLocale(locale);
  if (sequence !== request) return false;
  current = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  if (persist && typeof localStorage !== 'undefined') {
    try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* Session preference remains usable. */ }
  }
  notifyLocale();
  return true;
}

export async function initializeLocale(): Promise<void> {
  if (typeof window === 'undefined') return;
  const query = new URLSearchParams(window.location.search).get('lang');
  // Stable Chinese-first content for every ordinary link and crawler. Explicit URLs choose translations.
  const prefixed = /^\/(?:en|zh-Hant)(?:\/|$)/u.test(window.location.pathname);
  await setLocale(prefixed ? pathLanguage(window.location.pathname) : isLocale(query) ? query : 'zh-Hans', isLocale(query) && !prefixed, window.location.pathname);
}

/** Keep complete editorial translations when a brand or label is appended.
 * Only resolve compositions whose Chinese parts are all known; partial matches
 * must still go through the normal dynamic templates below.
 */
const translateKnownComposition = (text: string, depth = 0): string | undefined => {
  if (!/[\u3400-\u9fff]/.test(text)) return text;
  const exact = english[normalizeText(text)];
  if (exact) return text.slice(0, text.length - text.trimStart().length) + exact + text.slice(text.trimEnd().length);
  if (depth >= 3) return undefined;
  for (const separator of ['｜', ' · ', ' / ', '\n', '：']) {
    const parts = text.split(separator);
    if (parts.length < 2) continue;
    const translated = parts.map(part => translateKnownComposition(part, depth + 1));
    if (translated.every(part => part !== undefined)) return translated.join(separator === '：' ? ': ' : separator);
  }
  return undefined;
};

/** Only visible strings go through this function. IDs, API enums and URLs stay canonical. */
export function translateText(text: string, locale: Locale = current, depth = 0): string {
  if (locale === 'zh-Hans' || !/[\u3400-\u9fff]/.test(text)) return text;
  if (locale === 'zh-Hant') return (traditional?.(text, true) ?? text).replaceAll('噹噹天', '當當天').replaceAll('別隻憑', '別只憑');
  const exact = english[normalizeText(text)];
  if (exact) return text.slice(0, text.length - text.trimStart().length) + exact + text.slice(text.trimEnd().length);
  const numericDate = /^(?:(\d{4})\s*年\s*)?(\d{1,2})月\s*(\d{1,2})日$/.exec(text.trim());
  if (numericDate && Number(numericDate[2]) >= 1 && Number(numericDate[2]) <= 12 && Number(numericDate[3]) >= 1 && Number(numericDate[3]) <= 31) {
    const date = new Date(Date.UTC(Number(numericDate[1] || 2000), Number(numericDate[2]) - 1, Number(numericDate[3]), 12));
    if (date.getUTCMonth() === Number(numericDate[2]) - 1 && date.getUTCDate() === Number(numericDate[3])) return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(numericDate[1] ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(date);
  }
  if (/^\d{4}\s*年$/.test(text.trim()) && Number(text.trim().slice(0,4)) >= 1900 && Number(text.trim().slice(0,4)) <= 2100) return text.trim().slice(0,4);
  const composed = translateKnownComposition(text);
  if (composed !== undefined) return composed;
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
  if (url.origin !== 'https://www.baylink.us') return url.href;
  url.pathname = languagePath(url.pathname, locale);
  url.searchParams.delete('lang');
  return url.href;
}

/** Public editorial data only; useful for search and exported copies. */
export function translateEditorial<T>(value: T, locale: Locale = current): T {
  if (typeof value === 'string') return translateText(value, locale) as T;
  if (Array.isArray(value)) return value.map((item) => translateEditorial(item, locale)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateEditorial(item, locale)])) as T;
  return value;
}
