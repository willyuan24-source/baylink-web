// Date words and the month grid for DateChips (UI9-R1), apart from the component so DateChips.tsx exports components only
// (react-refresh/only-export-components). Calendar days as YYYY-MM-DD, formatted in UTC so no time zone moves them a day.
import type { Locale } from '../../i18n/locale';

export const DAY = 86_400_000;
export const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const intlLocale = (locale: Locale) => locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN';

/**
 * Localized date words, never mm/dd/yyyy: zh 「10月24日周六」 / 「2026年10月」, en "Sat, Oct 24" / "October 2026". Dates are
 * calendar days, formatted in UTC so no time zone can move them a day.
 */
export function dateWords(locale: Locale) {
  const tag = intlLocale(locale);
  const english = locale === 'en';
  const day = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', month: english ? 'short' : 'long', day: 'numeric', weekday: 'short' });
  const full = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const month = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', year: 'numeric', month: 'long' });
  const weekday = { narrow: new Intl.DateTimeFormat(tag, { timeZone: 'UTC', weekday: 'narrow' }), long: new Intl.DateTimeFormat(tag, { timeZone: 'UTC', weekday: 'long' }) };
  return {
    day: (value: string) => day.format(parse(value)),
    full: (value: string) => full.format(parse(value)),
    month: (year: number, monthIndex: number) => month.format(Date.UTC(year, monthIndex, 1)),
    /** Sunday first, as US calendars: narrow for the column heads (S M T / 日 一 二), long for their abbr (Sunday / 星期日). */
    weekdays: (width: 'narrow' | 'long' = 'narrow') => Array.from({ length: 7 }, (_, index) => weekday[width].format(Date.UTC(2026, 0, 4 + index))),
  };
}

/** The weeks of one month (Sunday first), as YYYY-MM-DD or null for the blanks before the 1st and after the last day. */
export function monthGrid(year: number, monthIndex: number): (string | null)[][] {
  const first = Date.UTC(year, monthIndex, 1);
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(new Date(first).getUTCDay()).fill(null), ...Array.from({ length: days }, (_, index) => iso(first + index * DAY))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}
