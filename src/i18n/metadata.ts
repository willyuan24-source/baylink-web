import { configureMetadataLanguage } from '../lib/seo';
import { getLocale, subscribeLocale, translateText, translateEditorial } from './locale';

const update = () => configureMetadataLanguage(
  ({ 'zh-Hans': 'zh_CN', 'zh-Hant': 'zh_TW', en: 'en_US' })[getLocale()],
  translateText,
  (data) => translateEditorial(data).map(item => 'inLanguage' in item ? { ...item, inLanguage: getLocale() } : item),
);
subscribeLocale(update);
update();
