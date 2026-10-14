import { configureMetadataLanguage } from '../lib/seo';
import { enableUsEnglishTimes, getLocale, subscribeLocale, translateText, translateEditorial, localizedUrl } from './locale';

// H41: the site's English reads times and dates in US style ("Oct 18 · 2–4pm"). Switched on here, the site's i18n entry
// (the app, the prerender and the page metadata import it), before any English loads; the Opus Bay game keeps its formats.
void enableUsEnglishTimes();

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
