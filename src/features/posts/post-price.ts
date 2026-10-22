import type { Locale } from '../../i18n/locale';

/**
 * A post's price as the poster wrote it, with digit groups (UI9-R1 N06): "$1900" → "$1,900", "$1900/月" → "$1,900/月",
 * "$1800-2200" → "$1,800-2,200", "1900 美元" → "1,900 美元", a bare "1900" → "1,900". Only an amount that is clearly money
 * is grouped: after a dollar sign (and the second end of that range), before 美元 / 美金 / 元 / 刀 / USD, or a price field
 * that is only digits. Years, phone numbers, room counts and words (议价, Negotiable) stay as written; amounts under
 * 1,000 are unchanged. The groups come from Intl.NumberFormat in the reader's language (all three use a comma).
 */
const INTL_LOCALE: Record<Locale, string> = { 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW', en: 'en-US' };
const DOLLARS = /([$＄]\s?)(\d+)(?![\d,])(?:(\s?[-–~至到]\s?[$＄]?\s?)(\d+)(?![\d,]))?/g;
const BEFORE_UNIT = /(^|[^\d,.])(\d{4,})(?=\s?(?:美元|美金|元|刀|USD\b))/g;

export function formatPostPrice(text: string, locale: Locale = 'zh-Hans'): string {
  if (!text) return text;
  const intl = new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'en-US', { maximumFractionDigits: 0 });
  const group = (digits: string) => (digits.length >= 4 && digits[0] !== '0' ? intl.format(Number(digits)) : digits);
  if (/^\s*\d+\s*$/.test(text)) return text.replace(/\d+/, group);
  return text
    .replace(DOLLARS, (_, sign: string, from: string, separator?: string, to?: string) => `${sign}${group(from)}${separator ? `${separator}${group(to as string)}` : ''}`)
    .replace(BEFORE_UNIT, (_, before: string, digits: string) => `${before}${group(digits)}`);
}
