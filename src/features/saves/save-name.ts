import { translateText, type Locale } from '../../i18n/locale';

/**
 * The ♡'s accessible name: the words on the button, then the title: "收藏：…" / "已收藏：…" (en "Save: …" /
 * "Saved: …"); none without a title. It starts with the visible label (WCAG 2.5.3 Label in Name), so a voice-control
 * user can say what they see; the state itself is `aria-pressed`.
 */
export function saveButtonName(saved: boolean, title: string | undefined, locale: Locale) {
  if (!title) return undefined;
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return `${saved ? t('已收藏', 'Saved') : t('收藏', 'Save')}${locale === 'en' ? ': ' : '：'}${translateText(title, locale)}`;
}
