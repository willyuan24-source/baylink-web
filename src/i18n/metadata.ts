import { configureMetadataLanguage } from '../lib/seo';
import { unprefixedPath } from '../lib/language-path';
import { enableUsEnglishTimes, getLocale, subscribeLocale, translateText, translateEditorial, localizedUrl } from './locale';

/**
 * The Opus Bay game's own pages: /opus-bay (App.tsx) and /play, which opens it. The game reads the site's English
 * dictionary through translateText and keeps the dictionary's formats there ("9/29 and 10/2 at 19:30";
 * tests/opus-bay-w9-r-words.test.ts pins them), so US style stays off on these pages.
 */
export const isGamePage = (pathname: string): boolean => /^\/(?:opus-bay|play)(?:\.html)?(?:\/|$)/.test(unprefixedPath(pathname));

// H41: the site's English reads times and dates in US style ("Oct 18 · 2–4pm"). Switched on here, the site's i18n entry
// (main.tsx, the prerender and the page metadata import it), for every page but the game's (prerender: no window, site).
void enableUsEnglishTimes(() => typeof window === 'undefined' || !window.location || !isGamePage(window.location.pathname));

function localizeSchema(value: unknown, key = ''): unknown {
  // Page URLs take the page's language; files (the logo, images) keep their one address.
  if (typeof value === 'string' && ['url', '@id', 'item', 'mainEntityOfPage'].includes(key) && value.startsWith('https://www.baylink.us/') && !/\.[a-z0-9]{2,5}$/i.test(new URL(value).pathname)) return localizedUrl(value);
  if (Array.isArray(value)) return value.map(item => localizeSchema(item, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, localizeSchema(item, name)]));
  return value;
}

const update = () => configureMetadataLanguage(
  ({ 'zh-Hans': 'zh_CN', 'zh-Hant': 'zh_TW', en: 'en_US' })[getLocale()],
  translateText,
  (data) => translateEditorial(data).map(item => localizeSchema('inLanguage' in item ? { ...item, inLanguage: getLocale() } : item) as Record<string, unknown>),
);
subscribeLocale(update);
update();
