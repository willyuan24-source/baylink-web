export type SiteLanguage = 'zh-Hans' | 'zh-Hant' | 'en';
export const languagePrefix = (locale: SiteLanguage) => locale === 'zh-Hans' ? '' : `/${locale}`;
export const pathLanguage = (path: string): SiteLanguage => /^\/en(?:\/|$)/.test(path) ? 'en' : /^\/zh-Hant(?:\/|$)/.test(path) ? 'zh-Hant' : 'zh-Hans';
export const unprefixedPath = (path: string) => path.replace(/^\/(en|zh-Hant)(?=\/|$)/, '') || '/';
export const languagePath = (path: string, locale: SiteLanguage) => `${languagePrefix(locale)}${unprefixedPath(path)}`;
