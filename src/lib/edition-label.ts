import type { Locale } from '../i18n/locale';

type EditionCoverage = { editionMonth?: string; editionStartDate?: string; editionThroughDate?: string };

/** A publication's label follows its actual coverage, rather than its filename. */
export function editionCoverageLabel(edition: EditionCoverage, locale: Locale = 'zh-Hans'): string {
  const language = locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN';
  const validDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  if (validDate(edition.editionStartDate) && validDate(edition.editionThroughDate) && edition.editionStartDate! <= edition.editionThroughDate!) {
    const formatter = new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    return formatter.formatRange(new Date(`${edition.editionStartDate}T12:00:00Z`), new Date(`${edition.editionThroughDate}T12:00:00Z`));
  }
  if (!edition.editionMonth || !/^\d{4}-\d{2}$/.test(edition.editionMonth)) return '';
  const month = Number(edition.editionMonth.slice(5));
  if (month < 1 || month > 12) return '';
  if (locale !== 'en') return `${edition.editionMonth.slice(0, 4)} 年 ${month} 月`;
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${edition.editionMonth}-01T12:00:00Z`));
}
