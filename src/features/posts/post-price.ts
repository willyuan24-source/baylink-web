import type { Locale } from '../../i18n/locale';

/**
 * A post's price as the poster wrote it, with digit groups (UI9-R1 N06): "$1900" → "$1,900", "$1900/月" → "$1,900/月",
 * "$1800-2200" → "$1,800-2,200", "1900-2200元" → "1,900-2,200元", "1900 美元" → "1,900 美元", a bare "1900" → "1,900".
 * Only an amount that is clearly money is grouped: after a dollar sign (and the second end of that range), before
 * 美元 / 美金 / 元 / 块 / 刀 / USD (both ends of a range), or a price field that is only digits. An amount the poster already
 * grouped stays as written and still lets the other end of its range be grouped ("$1,900-2200" → "$1,900-2,200"); a comma
 * that is not followed by a digit ends the amount ("$1900, negotiable"). Years, phone numbers, room counts and words
 * (议价, Negotiable) stay as written; amounts under 1,000 are unchanged. The group sign comes from Intl.NumberFormat in the
 * reader's language (all three use a comma); the digits are grouped as text, so a long run keeps every digit.
 */
const INTL_LOCALE: Record<Locale, string> = { 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW', en: 'en-US' };
// An amount is already grouped (1,900) or a plain run of digits, and is not followed by another digit or by ",<digit>";
// a range is "<amount> - / – / ~ / 至 / 到 <amount>". Written out in full: the ratchet reads composed strings as UI copy.
const DOLLARS = /([$＄]\s?)(\d{1,3}(?:,\d{3})+|\d+)(?!\d|,\d)(?:(\s?[-–~至到]\s?[$＄]?\s?)(\d{1,3}(?:,\d{3})+|\d+)(?!\d|,\d))?/g;
const BEFORE_UNIT = /(^|[^\d,.])(\d{1,3}(?:,\d{3})+|\d+)(?!\d|,\d)(?:(\s?[-–~至到]\s?)(\d{1,3}(?:,\d{3})+|\d+)(?!\d|,\d))?(?=\s?(?:美元|美金|元|块|刀|USD\b))/g;

export function formatPostPrice(text: string, locale: Locale = 'zh-Hans'): string {
  if (!text) return text;
  const sign = new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'en-US').formatToParts(1000).find(part => part.type === 'group')?.value ?? ',';
  const group = (digits: string) => (digits.length >= 4 && digits[0] !== '0' && !digits.includes(',') ? digits.replace(/\B(?=(?:\d{3})+$)/g, sign) : digits);
  const range = (from: string, separator?: string, to?: string) => `${group(from)}${separator ? `${separator}${group(to as string)}` : ''}`;
  if (/^\s*\d+\s*$/.test(text)) return text.replace(/\d+/, group);
  return text
    .replace(DOLLARS, (_, dollar: string, from: string, separator?: string, to?: string) => `${dollar}${range(from, separator, to)}`)
    .replace(BEFORE_UNIT, (_, before: string, from: string, separator?: string, to?: string) => `${before}${range(from, separator, to)}`);
}
