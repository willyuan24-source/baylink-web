import { translateText, type Locale } from '../../i18n/locale';

/**
 * How the requirement card and the plan card name a region and a day (BBL-12, G79): "东湾 · 10/17 周六", never the
 * API's own values ("east-bay", "2026-10-17"). zh-Hant is written out, not converted, so it never depends on the
 * conversion dictionary having loaded.
 */
type Names = { zh: string; hant: string; en: string };
const REGIONS: Record<string, Names> = {
  sf: { zh: '旧金山', hant: '舊金山', en: 'San Francisco' },
  'east-bay': { zh: '东湾', hant: '東灣', en: 'East Bay' },
  'south-bay': { zh: '南湾', hant: '南灣', en: 'South Bay' },
  peninsula: { zh: '半岛', hant: '半島', en: 'Peninsula' },
  'north-bay': { zh: '北湾', hant: '北灣', en: 'North Bay' },
};
const WEEKDAYS: Names[] = ['日', '一', '二', '三', '四', '五', '六'].map((day, index) => ({ zh: `周${day}`, hant: `週${day}`, en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index] }));
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pick = (names: Names, locale: Locale) => locale === 'en' ? names.en : locale === 'zh-Hant' ? names.hant : names.zh;

/** "东湾" / "東灣" / "East Bay" for a region slug; null for an unknown value, so the raw slug never shows. */
export function bayBayRegionLabel(region: string | null | undefined, locale: Locale): string | null {
  const names = region ? REGIONS[region] : undefined;
  return names ? pick(names, locale) : null;
}

/** The place a reader asked about: the city when there is one ("Fremont"; San Francisco as 旧金山), else the region. */
export function bayBayPlaceLabel(state: { city?: string | null; region?: string | null }, locale: Locale): string | null {
  if (state.city) return state.city === 'San Francisco' ? pick(REGIONS.sf, locale) : translateText(state.city, locale);
  return bayBayRegionLabel(state.region, locale);
}

/** "10/17 周六" (zh), "10/17 週六" (zh-Hant), "Sat 10/17" (en) for an ISO day; null for anything that is not a real day. */
export function bayBayDayLabel(day: string | null | undefined, locale: Locale): string | null {
  const match = ISO_DAY.exec(day || '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (date.toISOString().slice(0, 10) !== day) return null;
  const monthDay = `${Number(match[2])}/${Number(match[3])}`, weekday = pick(WEEKDAYS[date.getUTCDay()], locale);
  return locale === 'en' ? `${weekday} ${monthDay}` : `${monthDay} ${weekday}`;
}

/** "10/17 周六 – 10/18 周日" for a weekend or other range; one day when both ends are the same; null when invalid. */
export function bayBayDayRangeLabel(range: { start?: string | null; end?: string | null } | null | undefined, locale: Locale): string | null {
  const start = bayBayDayLabel(range?.start, locale), end = bayBayDayLabel(range?.end, locale);
  if (!start || !end || range!.end! < range!.start!) return null;
  return range!.start === range!.end ? start : `${start} – ${end}`;
}
