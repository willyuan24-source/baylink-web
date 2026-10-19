import { translateText, type Locale } from '../../i18n/locale';
import { readerDate } from './content-review-runtime';

/** A press report as a listing's source (lib/schema-org.ts reads the same label): its check line never says 官网核对. */
const PRESS = /媒体报道|新闻|报道|media|news/i;
export const pressSource = (label: string | undefined) => !!label && PRESS.test(label);

/**
 * The card and facts check line (owner decisions 3, 17 and 20): "官网核对 10/15" / "Source checked Oct 15", or for a press
 * source "媒体报道 · 10/15 核对" / "News report · checked Oct 15". The date is the listing's verifiedAt, the one TrustRow
 * shows; nothing without a valid date on or before today. Plain functions (no component) so the rail and the facts card
 * share them without a component file exporting helpers.
 */
export function checkedText(verifiedAt: string | undefined, press: boolean, locale: Locale, today: string): string | undefined {
  if (!verifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) || verifiedAt > today) return undefined;
  const date = readerDate(verifiedAt, locale, today);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return press ? t(`媒体报道 · ${date} 核对`, `News report · checked ${date}`) : t(`官网核对 ${date}`, `Source checked ${date}`);
}
