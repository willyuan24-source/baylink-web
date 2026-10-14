import { useSyncExternalStore } from 'react';
import type { DictLike } from 'opencc-js/core';
import type { TaiwanTerms } from './taiwan-terms';
import patterns from './en-patterns.json';
import { pathLanguage, languagePath } from '../lib/language-path';
import { createEnglishScopeLoader, englishScopesForFeature, englishScopesForPath, searchFreePath, type EnglishFeature } from '../lib/english-loading';

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
const loadEnglishScopes = () => englishScopeLoad ||= Promise.all([import('../data/generated/english-scope-loaders'), loadEnglishTimes()]).then(([{ englishScopeLoaders }]) => {
  return englishScopes = createEnglishScopeLoader(englishScopeLoaders, dictionary => { Object.assign(english, dictionary); notifyLocale(); });
}).catch(error => { englishScopeLoad = undefined; throw error; });
/** H41: US-style times and dates for the date and time tokens pages render from data (englishNeutral); English only. */
let englishTimesOf: ((text: string) => string) | undefined;
let englishTimesLoad: Promise<void> | undefined;
const loadEnglishTimes = () => englishTimesLoad ||= import('../lib/english-times').then(module => { englishTimesOf = module.englishTimes; }).catch(error => { englishTimesLoad = undefined; throw error; });
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
 * contain (i18n/traditional.ts, about 45 KB instead of the 495 KB full build, exact on every Chinese run of the sources),
 * and the full phrase table only once text the site does not ship is shown (noteDynamicChinese). 繁體 search uses the same
 * search dictionaries as the other languages (loadSearchConversion). Node (tests, prerender, generators) keeps the full
 * build, which also carries search; its specifier is hidden from the bundler, so the browser never loads it.
 * BAYLINK_SITE_TRADITIONAL=1 makes Node take the browser's path (tests/traditional-upgrade.test.ts).
 * WEB-SEO-I18N: the site's term table rides with opencc (taiwan-terms.ts): every 繁體 converter the app installs takes it,
 * the browser's pruned one and its full-table upgrade included.
 */
const OPENCC_FULL = 'opencc-js';
/** The full phrase table's loader once the site converter is in; whether text the site does not ship has been shown. */
let upgradeTraditional: (() => void) | undefined;
let dynamicChinese = false;
const loadChinese = () => chineseLoad ||= (nodeProcess?.getBuiltinModule && nodeProcess.env?.BAYLINK_SITE_TRADITIONAL !== '1'
  ? Promise.all([import(/* @vite-ignore */ OPENCC_FULL) as Promise<typeof import('opencc-js')>, import('./taiwan-terms')]).then(([module, terms]) => {
    traditional = taiwanConverter(module, undefined, terms.SITE_TAIWAN_TERMS);
    // the full opencc build holds the search dictionaries too (Locale.to.cn is TSPhrases then TSCharacters)
    if (!buildSearch) { buildSearch = () => module.ConverterFactory(module.Locale.to.cn); searchUnavailable = false; notifyLocale(); }
  })
  : Promise.all([import('./traditional'), import('./taiwan-terms')]).then(([{ siteTraditional }, terms]) => {
    const site = siteTraditional((O, prebuilt) => taiwanConverter(O, prebuilt, terms.SITE_TAIWAN_TERMS), (full, changed) => { traditional = full; if (changed) notifyLocale(); });
    traditional = site.convert;
    upgradeTraditional = site.upgrade;
    if (dynamicChinese) site.upgrade();
  })).catch((error) => { chineseLoad = undefined; throw error; });

/**
 * Text the site does not ship is about to be shown: an API response (lib/api.ts: posts, profiles, messages, errors) or
 * BayBay's answers (its feature gate, LocaleContentGate.tsx). The site's own text converts exactly with the pruned phrase
 * table; this text needs opencc's full one, which then loads in idle time (once 繁體's converter is in, if it is not yet).
 * A reader who only reads the site never downloads it. `text` without Chinese changes nothing.
 */
export function noteDynamicChinese(text?: string): void {
  if (text !== undefined && !/[\u3400-\u9fff]/u.test(text)) return;
  dynamicChinese = true;
  upgradeTraditional?.();
}

/** Strings the browser's pruned converter would turn into something else than the full build (checkSiteTraditional). */
let siteCheck: { convert: (text: string, words?: boolean) => string; mismatched: Set<string> } | undefined;
/**
 * The prerender converts every 繁體 page with the full build and, after this call, also with the browser's pruned phrase
 * table (i18n/traditional.ts): the returned function lists the strings where the two differ, so text the pages assemble
 * at render time (template joins, dates, counts) is proven too, not only the Chinese runs of the sources. Both sides
 * apply the site's term table (taiwan-terms.ts), as the browser does.
 */
export async function checkSiteTraditional(): Promise<() => string[]> {
  const [{ siteTraditional }, { SITE_TAIWAN_TERMS }] = await Promise.all([import('./traditional'), import('./taiwan-terms')]);
  const check = siteCheck = { convert: siteTraditional((O, prebuilt) => taiwanConverter(O, prebuilt, SITE_TAIWAN_TERMS), () => {}).convert, mismatched: new Set<string>() };
  return () => [...check.mismatched];
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
 * extra pass per string; the trie learns only the phrases that need it. `words`: TAIWAN_WORDS and the site's `terms`
 * (taiwan-terms.ts) first, metres as 公尺.
 */
const NO_TERMS: TaiwanTerms = { words: [], after: [] };
export function taiwanConverter(O: Pick<typeof import('opencc-js'), 'Trie' | 'Locale'>, prebuilt?: InstanceType<typeof O.Trie>, terms: TaiwanTerms = NO_TERMS): (text: string, words?: boolean) => string {
  const [st0] = O.Locale.from.cn, [tw0] = O.Locale.to.tw;
  // `prebuilt`: a cn trie already filled (the browser's full phrase table, built in slices: traditional.ts siteTraditional)
  const st = prebuilt ?? new O.Trie(), tw = new O.Trie(), local = new O.Trie();
  if (!prebuilt) st.loadDictGroup(st0);
  tw.loadDictGroup(tw0);
  const once = (text: string) => tw.convert(st.convert(text));
  // the site's term table (taiwan-terms.ts, loaded with opencc) on top of the game's words; a guard (a phrase mapped to
  // itself, left to opencc) also guards its converted form, so a second pass cannot cut it (按周邊 never becomes 按週邊)
  local.loadDict([...TAIWAN_WORDS, ...terms.words]);
  for (const [from, to] of terms.words) if (from === to) local.addWord(once(from), once(from));
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
    return words ? terms.after.reduce((t, [pattern, to]) => t.replace(pattern, to), TAIWAN_AFTER.reduce((t, [from, to]) => t.replaceAll(from, to), out.replace(/(\d)(\s*)(平方)?米(?![飯色黃粉其糕蘭])/g, '$1$2$3公尺'))) : out;
  };
}

/** Everything a language needs, search included (exports, SSR and scripts; zh-Hant's opencc build carries search). */
export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === 'en') await Promise.all([englishLoad ||= import('../data/generated/english.json').then(module => { english = module.default; englishFullyLoaded = true; notifyLocale(); }).catch((error) => { englishLoad = undefined; throw error; }), loadEnglishTimes(), loadSearchConversion().catch(() => undefined)]);
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
/** Whether a feature's displayed content and search dictionaries are in (the search dialog: LocaleFeatureGate). */
export function isLocaleReadyForFeature(locale: Locale, feature: EnglishFeature): boolean {
  const content = locale === 'en' ? englishFullyLoaded || !!englishScopes && englishScopes.isReady(englishScopesForFeature(feature).filter(englishScopes.has)) : locale === 'zh-Hant' ? !!traditional : true;
  return content && (!!buildSearch || searchUnavailable);
}
export async function loadLocaleForFeature(locale: Locale, feature: EnglishFeature): Promise<void> {
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
  // a part without Chinese (the date line of "10/18 · 14:00–16:00 ｜ Atherton ｜ …") reads in US style too (H41)
  if (!/[\u3400-\u9fff]/.test(text)) return englishNeutral(text);
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

/**
 * H41: a language-neutral line with a time or a numeric date ("10/18 \u00b7 14:00\u201316:00") reads in US style on /en through
 * its generated English entry (scripts/generate-english-scopes.ts), whole or by its " \u00b7 " parts. Text made only of date
 * and time tokens that has no entry (a page's <time>2026-10-05</time>, a session's "14:00\u201316:00", a date line a page
 * composes) is converted as it is shown, if it has a 24-hour time or an ISO date: those come from data fields and never
 * pass through the dictionary. Other text without Chinese stays as it is.
 */
const NEUTRAL_DATE_OR_TIME = /\d[:/-]\d/;
const DATE_TIME_TOKENS = /^[\d\s/:.,\u00b7\u2013\u2014~\uff1b\u3001\uff0c-]+$/u;
const CLOCK_OR_ISO = /(?<![\d:.$/])(?:[01]?\d|2[0-3]):[0-5]\d|\b20\d\d-[01]\d-[0-3]\d\b/;
/** Inside translateEditorial (structured data, catalog exports) a token is data: JSON-LD's startDate stays ISO. */
let editorialData = 0;
const englishTokens = (text: string): string => englishTimesOf && !editorialData && DATE_TIME_TOKENS.test(text) && CLOCK_OR_ISO.test(text)
  ? englishTimesOf(text.replace(/\uff1b\s*/gu, '; ').replace(/[\u3001\uff0c]\s*/gu, ', '))
  : text;
const englishNeutral = (text: string): string => {
  if (!NEUTRAL_DATE_OR_TIME.test(text)) return text;
  const exact = english[normalizeText(text)];
  if (exact) return text.slice(0, text.length - text.trimStart().length) + exact + text.slice(text.trimEnd().length);
  const tokens = englishTokens(text);
  if (tokens !== text) return tokens;
  return text.split(/(\n| \u00b7 | \/ |\uff5c)/).map(part => english[normalizeText(part)] || englishTokens(part)).join('');
};

/** Only visible strings go through this function. IDs, API enums and URLs stay canonical. */
export function translateText(text: string, locale: Locale = current, depth = 0): string {
  if (locale === 'zh-Hans') return text;
  if (!/[\u3400-\u9fff]/.test(text)) return locale === 'en' ? englishNeutral(text) : text;
  if (locale === 'zh-Hant') {
    const converted = traditional?.(text, true) ?? text;
    if (siteCheck && traditional && siteCheck.convert(text, true) !== converted) siteCheck.mismatched.add(text);
    return converted.replaceAll('噹噹天', '當當天').replaceAll('別隻憑', '別只憑');
  }
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
  if (typeof value === 'string') {
    editorialData++;
    try { return translateText(value, locale) as T; } finally { editorialData--; }
  }
  if (Array.isArray(value)) return value.map((item) => translateEditorial(item, locale)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateEditorial(item, locale)])) as T;
  return value;
}
