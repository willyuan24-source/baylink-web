import { configureMetadataLanguage } from '../lib/seo';
import { getLocale, subscribeLocale, translateText, translateEditorial, localizedUrl } from './locale';

function localizeSchema(value: unknown, key = ''): unknown {
  if (typeof value === 'string' && ['url', '@id', 'item'].includes(key) && value.startsWith('https://www.baylink.us/')) return localizedUrl(value);
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
