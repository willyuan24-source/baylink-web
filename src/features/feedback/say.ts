import { translateText, type Locale } from '../../i18n/locale';

/** Co-located UI copy (plan §3.0 rule 4): Simplified Chinese with its English; Traditional comes from OpenCC at runtime. */
export type Copy = { zh: string; en: string };
export const say = (copy: Copy, locale: Locale) => locale === 'en' ? copy.en : translateText(copy.zh, locale);
