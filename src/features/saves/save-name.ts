import { translateText, type Locale } from '../../i18n/locale';

/** The ♡'s accessible name: "收藏：…" / "取消收藏：…" (en "Save: …" / "Remove from saved: …"); none without a title. */
export function saveButtonName(saved: boolean, title: string | undefined, locale: Locale) {
  if (!title) return undefined;
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return `${saved ? t('取消收藏', 'Remove from saved') : t('收藏', 'Save')}${locale === 'en' ? ': ' : '：'}${translateText(title, locale)}`;
}
