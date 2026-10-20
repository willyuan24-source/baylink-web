import { translateText, type Locale } from '../../i18n/locale';
import { readerMonthDay } from '../../lib/event-facts';

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
  // The API's region after "城市不限" / "anywhere in the Bay" (api baybayState: clear the city, region 'all').
  all: { zh: '湾区各地', hant: '灣區各地', en: 'Anywhere in the Bay Area' },
};
const WEEKDAYS: Names[] = [
  { zh: '周日', hant: '週日', en: 'Sun' }, { zh: '周一', hant: '週一', en: 'Mon' }, { zh: '周二', hant: '週二', en: 'Tue' }, { zh: '周三', hant: '週三', en: 'Wed' },
  { zh: '周四', hant: '週四', en: 'Thu' }, { zh: '周五', hant: '週五', en: 'Fri' }, { zh: '周六', hant: '週六', en: 'Sat' },
];
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

/**
 * "14:00" → "2pm", "10:30" → "10:30am": English answers and cards use 12-hour times (api-bb-7). Chinese reads "8:00",
 * "14:00": the same pattern as C's eventWhenLine on the cards beside the plan (N06, one time pattern per locale).
 */
export function bayBayClock(time: string, english: boolean): string {
  if (!english) { const [hour, minute] = time.split(':'); return /^\d{1,2}$/.test(hour ?? '') && minute !== undefined ? `${Number(hour)}:${minute}` : time; }
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${hour >= 12 ? 'pm' : 'am'}`;
}

/** "8:00–14:00" (zh) / "8am–2pm" (en) for a plan stop's opening windows; several windows in one day are listed in order. */
export function bayBayOpeningWindowsLabel(windows: readonly { open: string; close: string }[], english: boolean): string {
  return windows.map(window => `${bayBayClock(window.open, english)}–${bayBayClock(window.close, english)}`).join(english ? ', ' : '、');
}

const BAY_AREA: Names = { zh: '湾区', hant: '灣區', en: 'Bay Area' };
const DAY_PLAN: Names = { zh: '一日安排', hant: '一日安排', en: 'day plan' };
const PLAN_PLACES: Record<string, Names> = { 'bay area': BAY_AREA, 湾区: BAY_AREA, 灣區: BAY_AREA, 'san francisco': REGIONS.sf, 旧金山: REGIONS.sf, 舊金山: REGIONS.sf };
const CJK = '\\u3400-\\u9fff\\uf900-\\ufaff';
/** Chinese text next to a Latin word gets one space ("Fremont 一日安排"), the way the site writes mixed names. Digits are left alone ("10月"). */
export function spaceMixedScript(text: string): string {
  return text.replace(new RegExp(`([A-Za-z])([${CJK}])`, 'gu'), '$1 $2').replace(new RegExp(`([${CJK}])([A-Za-z])`, 'gu'), '$1 $2');
}

/**
 * The plan card's title in the reader's language. The api titles a plan "<city>一日安排" / "<city> day plan" with its
 * own city value, so a Chinese plan read "San Francisco一日安排" (API-BB-7 live check). San Francisco and the Bay Area take
 * their Chinese names (旧金山一日安排); another city keeps its English name with a space (Fremont 一日安排). Other
 * titles are translated as they are, with the same spacing rule.
 */
export function bayBayPlanTitle(title: string, locale: Locale): string {
  const match = /^(.+?)\s*(?:一日安排| day plan)$/iu.exec(title.trim());
  if (!match) return spaceMixedScript(translateText(title, locale));
  const place = match[1].trim(), known = PLAN_PLACES[place.toLowerCase()];
  const name = known ? pick(known, locale) : translateText(place, locale);
  return locale === 'en' ? `${name} ${DAY_PLAN.en}` : spaceMixedScript(name + pick(DAY_PLAN, locale));
}

/** "10/17 周六" (zh), "10/17 週六" (zh-Hant), "Sat, Oct 17" (en) for an ISO day; null for anything that is not a real day. */
export function bayBayDayLabel(day: string | null | undefined, locale: Locale): string | null {
  const match = ISO_DAY.exec(day || '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (date.toISOString().slice(0, 10) !== day) return null;
  const weekday = pick(WEEKDAYS[date.getUTCDay()], locale);
  // US English on /en: "Sat, Oct 17" (WEB-FIX6); Chinese "10/17 周六".
  return locale === 'en' ? `${weekday}, ${readerMonthDay(day!, true)}` : `${readerMonthDay(day!)} ${weekday}`;
}

/** "10/17 周六 – 10/18 周日" for a weekend or other range; one day when both ends are the same; null when invalid. */
export function bayBayDayRangeLabel(range: { start?: string | null; end?: string | null } | null | undefined, locale: Locale): string | null {
  const start = bayBayDayLabel(range?.start, locale), end = bayBayDayLabel(range?.end, locale);
  if (!start || !end || range!.end! < range!.start!) return null;
  return range!.start === range!.end ? start : `${start} – ${end}`;
}
