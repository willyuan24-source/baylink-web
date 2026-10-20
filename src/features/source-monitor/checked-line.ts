import { translateText, type Locale } from '../../i18n/locale';
import { readerDate } from './content-review-runtime';

/**
 * A press report as a listing's source, decided by the source label alone (owner decision 17: render by source type, no
 * data edit). lib/schema-org.ts, the detail rails, the facts card and the trust row all read the same label rule, so a
 * page never calls one source two things. An official page reached by another URL (a mall's shop page, a city newsletter,
 * an official Instagram) is not press.
 */
const PRESS = /媒体报道|新闻|报道|media|news/i;
export const pressSource = (label: string | undefined) => !!label && PRESS.test(label);

/**
 * The words around a check date: "官网核对 {date}" / "Source checked {date}", or for a press source "媒体报道 · {date} 核对"
 * / "News report · checked {date}". The trust row puts a <time> between them; `checkedText` joins them for the cards and
 * the facts card, so both lines of a detail say the same thing.
 */
export function checkedWords(press: boolean, locale: Locale): [before: string, after: string] {
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return press ? [t('媒体报道 · ', 'News report · checked '), t(' 核对', '')] : [t('官网核对 ', 'Source checked '), ''];
}

/**
 * The card and facts check line (owner decisions 3, 17 and 20). The date is the listing's verifiedAt, the one TrustRow
 * shows; nothing without a valid date on or before today. Plain functions (no component) so the rail and the facts card
 * share them without a component file exporting helpers.
 */
export function checkedText(verifiedAt: string | undefined, press: boolean, locale: Locale, today: string): string | undefined {
  if (!verifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) || verifiedAt > today) return undefined;
  const [before, after] = checkedWords(press, locale);
  return `${before}${readerDate(verifiedAt, locale, today)}${after}`;
}
