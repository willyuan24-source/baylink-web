import type { Locale } from './locale';

/** Match the visitor's ordered language preferences to the editions we publish. */
export function browserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    try {
      const locale = new Intl.Locale(language);
      if (locale.language === 'en') return 'en';
      if (locale.language === 'zh') {
        if (locale.script === 'Hant') return 'zh-Hant';
        if (locale.script === 'Hans') return 'zh-Hans';
        return ['TW', 'HK', 'MO'].includes(locale.region || '') ? 'zh-Hant' : 'zh-Hans';
      }
    } catch { /* Ignore malformed preferences; continue to the next language. */ }
  }
  return 'en';
}
