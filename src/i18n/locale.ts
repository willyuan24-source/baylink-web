import { useSyncExternalStore } from 'react';
import type { DictLike } from 'opencc-js/core';
import patterns from './en-patterns.json';
import { pathLanguage, languagePath } from '../lib/language-path';
import { createEnglishScopeLoader, englishScopesForFeature, englishScopesForPath, searchFreePath } from '../lib/english-loading';

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

/**
 * 繁體's converter (WEB-DATA-SPLIT, ENGSEC-01). In the browser: opencc's core with only the phrases the site's sources
 * contain (i18n/traditional.ts, about 45 KB instead of the 495 KB full build, exact on every Chinese run of the sources), and
 * the full phrase table once the page is ready and idle (upgradeTraditional) for text the site does not ship. 繁體 search
 * uses the same search dictionaries as the other languages (loadSearchConversion). Node (tests, prerender, generators)
 * keeps the full build, which also carries search; its specifier is hidden from the bundler, so the browser never loads it.
 */
const OPENCC_FULL = 'opencc-js';
const loadChinese = () => chineseLoad ||= (nodeProcess?.getBuiltinModule
  ? (import(/* @vite-ignore */ OPENCC_FULL) as Promise<typeof import('opencc-js')>).then((module) => {
    traditional = taiwanConverter(module);
    // the full opencc build holds the search dictionaries too (Locale.to.cn is TSPhrases then TSCharacters)
    if (!buildSearch) { buildSearch = () => module.ConverterFactory(module.Locale.to.cn); searchUnavailable = false; notifyLocale(); }
  })
  : import('./traditional').then(({ Trie, SITE_LOCALE }) => {
    const site = taiwanConverter({ Trie, Locale: SITE_LOCALE } as unknown as OpenccTables);
    const seen = new Map<string, string>();
    traditional = (text, words = false) => {
      const out = site(text, words);
      if (seen.size < 20000) seen.set(`${words ? 1 : 0}${text}`, out);
      return out;
    };
    upgradeTraditional(Trie, SITE_LOCALE, seen);
  })).catch((error) => { chineseLoad = undefined; throw error; });

type OpenccTables = Pick<typeof import('opencc-js'), 'Trie' | 'Locale'>;
type TrieClass = OpenccTables['Trie'];
/** One idle slice (or a short timeout where requestIdleCallback is missing, Safari). */
const idleSlice = () => new Promise<void>(resolve => {
  const idle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(() => resolve(), { timeout: 2000 }); else setTimeout(resolve, 50);
});
/**
 * Text the site does not ship (BayBay answers, API messages) appears after the reader does something, so the full phrase
 * table waits for the first tap or key press: a reader who only reads never downloads it. Then, between idle periods,
 * it downloads, its trie is built in slices of 2,000 phrases (no long task) and the converter switches to it. Text converted
 * so far is converted again with the full table and the page re-renders only when some of it changes; the site's own text
 * never does (scripts/generate-traditional-phrases.ts).
 */
function upgradeTraditional(Trie: TrieClass, siteLocale: typeof import('./traditional')['SITE_LOCALE'], seen: Map<string, string>): void {
  if (typeof window === 'undefined') return;
  const start = async () => {
    await idleSlice();
    const { fullPhrases } = await import('./traditional-full');
    const [[, characters]] = siteLocale.from.cn;
    const phrases = new Trie();
    phrases.loadDict(characters);
    const entries = fullPhrases.split('|');
    for (let at = 0; at < entries.length; at += 2000) {
      for (const entry of entries.slice(at, at + 2000)) { const space = entry.indexOf(' '); phrases.addWord(entry.slice(0, space), entry.slice(space + 1)); }
      await idleSlice();
    }
    const full = taiwanConverter({ Trie, Locale: { from: { cn: [[]] }, to: siteLocale.to } } as unknown as OpenccTables, phrases);
    let changed = false;
    for (const [key, out] of seen) if (full(key.slice(1), key[0] === '1') !== out) { changed = true; break; }
    traditional = full;
    seen.clear();
    if (changed) notifyLocale();
  };
  const triggers = ['pointerdown', 'keydown'] as const;
  const begin = () => {
    for (const type of triggers) window.removeEventListener(type, begin, true);
    void start().catch(() => { /* The site's own phrases stay; text it does not ship converts by character until a reload. */ });
  };
  for (const type of triggers) window.addEventListener(type, begin, { capture: true, passive: true });
}

/**
 * Search folds 繁體 into 简体 with opencc's traditional → simplified dictionaries (TSPhrases, TSCharacters). They are not
 * in the shell or the homepage's graph (WEB-HOMEPREP, RC-8 iii): the browser loads them with the first page that
 * searches — every route except the homepage and what opens over it waits for them in its language gate
 * (isLocaleReadyForPath), as do the search dialog and BayBay — or on the first Chinese text simplifySearch sees. Until
 * then simplifySearch returns its input, and it stays synchronous throughout. Node (tests, prerender, generators) loads
 * them synchronously at import, so scripts and cold tests keep exactly the search keys they had; BAYLINK_LAZY_SEARCH=1
 * makes Node take the browser's path (tests/search-cold.test.ts).
 */
let buildSearch: (() => (text: string) => string) | undefined;
let searchLoad: Promise<void> | undefined;
/** After a failed load the language gates stop waiting (search matches exact characters) until a later load succeeds. */
let searchUnavailable = false;
/** The trie is built on first Chinese use. */
const searchConversion = () => simplified ||= buildSearch?.();
type NodeProcess = { env?: Record<string, string | undefined>; getBuiltinModule?: (id: string) => unknown };
const nodeProcess = (globalThis as { process?: NodeProcess }).process;
if (nodeProcess?.getBuiltinModule && nodeProcess.env?.BAYLINK_LAZY_SEARCH !== '1') {
  const { createRequire } = nodeProcess.getBuiltinModule('node:module') as { createRequire: (from: string) => (id: string) => unknown };
  const require = createRequire(import.meta.url);
  const { ConverterFactory } = require('opencc-js/core') as typeof import('opencc-js/core');
  const [phrases, characters] = ['opencc-js/dict/TSPhrases', 'opencc-js/dict/TSCharacters'].map(id => (require(id) as { default: DictLike }).default);
  buildSearch = () => ConverterFactory([phrases, characters]);
}
/** Loads the search dictionaries once; resolves at once when they are in, and after a failure the next call retries. */
export function loadSearchConversion(): Promise<void> {
  if (buildSearch) return Promise.resolve();
  return searchLoad ||= import('./search-dictionaries')
    .then(({ ConverterFactory, searchPhrases, searchCharacters }) => {
      searchUnavailable = false;
      if (buildSearch) return;
      buildSearch = () => ConverterFactory([searchPhrases, searchCharacters]);
      notifyLocale();
    })
    .catch(error => { searchLoad = undefined; searchUnavailable = true; throw error; });
}
export const isSearchConversionReady = (): boolean => !!buildSearch;
const pathsSearch = (paths: string | readonly string[]) => (typeof paths === 'string' ? [paths] : paths).some(path => !searchFreePath(path));

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
export function taiwanConverter(O: Pick<typeof import('opencc-js'), 'Trie' | 'Locale'>, prebuilt?: InstanceType<typeof O.Trie>): (text: string, words?: boolean) => string {
  const [st0] = O.Locale.from.cn, [tw0] = O.Locale.to.tw;
  // `prebuilt`: a cn trie already filled (the browser's full phrase table, built in slices: upgradeTraditional)
  const st = prebuilt ?? new O.Trie(), tw = new O.Trie(), local = new O.Trie();
  if (!prebuilt) st.loadDictGroup(st0);
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

/** Everything a language needs, search included (exports, SSR and scripts; zh-Hant's opencc build carries search). */
export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === 'en') await Promise.all([englishLoad ||= import('../data/generated/english.json').then(module => { english = module.default; englishFullyLoaded = true; notifyLocale(); }).catch((error) => { englishLoad = undefined; throw error; }), loadSearchConversion().catch(() => undefined)]);
  else if (locale === 'zh-Hant') await Promise.all([loadChinese(), loadSearchConversion().catch(() => undefined)]);
  else await loadSearchConversion().catch(() => undefined);
}

const scopesForPaths = (paths: string | readonly string[]) => [...new Set((typeof paths === 'string' ? [paths] : paths).flatMap(path => englishScopesForPath(path, englishScopes!.has)))];
export function isLocaleReadyForPath(locale: Locale, paths: string | readonly string[]): boolean {
  const content = locale === 'en' ? englishFullyLoaded || !!englishScopes && englishScopes.isReady(scopesForPaths(paths)) : locale === 'zh-Hant' ? !!traditional : true;
  return content && (!!buildSearch || searchUnavailable || !pathsSearch(paths));
}
/** Browser routes wait for their complete displayed content (and the search dictionaries where the page searches);
 * full loadLocale remains available to exports and SSR. */
export async function loadLocaleForPath(locale: Locale, paths: string | readonly string[]): Promise<void> {
  // The page still works without them (exact-character search); the gate stops waiting after a failure. Handled from
  // the start, so a failure is never unhandled when the language's own load fails first.
  const search = pathsSearch(paths) ? loadSearchConversion().catch(() => undefined) : undefined;
  if (locale === 'en') { if (!englishFullyLoaded) { const scopes = await loadEnglishScopes(); await scopes.load(scopesForPaths(paths)); } }
  else if (locale === 'zh-Hant') await loadChinese();
  await search;
}
export async function loadLocaleForFeature(locale: Locale, feature: 'search' | 'guide-search'): Promise<void> {
  const search = loadSearchConversion().catch(() => undefined);
  if (locale === 'en') { if (!englishFullyLoaded) { const scopes = await loadEnglishScopes(); await scopes.load(englishScopesForFeature(feature)); } }
  else if (locale === 'zh-Hant') await loadChinese();
  await search;
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
  // Stable Chinese-first content for every ordinary link and crawler. Explicit URLs choose translations. A saved 繁體 /
  // English choice is honoured on neutral URLs before the first paint by public/reading-init.js (D17), not here.
  const prefixed = /^\/(?:en|zh-Hant)(?:\/|$)/u.test(window.location.pathname);
  const target = prefixed ? pathLanguage(window.location.pathname) : isLocale(query) ? query : 'zh-Hans';
  // A ?lang= link is a choice to remember. The edge 301s ?lang=en|zh-Hant to the language's own URL with the query kept,
  // so it arrives as /en/…?lang=en: remember it when the two agree; a prefixed URL with another ?lang= stays a one-off.
  await setLocale(target, isLocale(query) && query === target, window.location.pathname);
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

/** Search matches 繁體 and 简体 alike, independently of the display language, and stays synchronous: phrase exceptions
 * take precedence and the trie is built on first Chinese use. Before the dictionaries are in (see loadSearchConversion)
 * it returns its input and starts loading them. */
export const simplifySearch = (text: string): string => {
  if (!/\p{Script=Han}/u.test(text)) return text;
  const convert = searchConversion();
  if (convert) return convert(text);
  loadSearchConversion().catch(() => { /* Search keeps working on exact characters; the next search retries. */ });
  return text;
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
