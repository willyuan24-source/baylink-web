import type { MonthlyEvent } from '../data/monthly-types';
import { MONTHLY_EDITION } from '../data/monthly-settings';
import { addCalendarDays } from './calendar-days';
// The .ics builder lives in event-ics.ts (only pages with a calendar download load it); re-exported for existing callers.
export { buildEventCalendar, downloadEventCalendar } from './event-ics';

const bayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
export const getBayAreaToday = (now = new Date()): string => {
  const parts = bayDate.formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
};

export const isEditionCurrent = (today = getBayAreaToday()): boolean => today.slice(0, 7) >= MONTHLY_EDITION.startMonth && today <= MONTHLY_EDITION.throughDate;
export const getEventStatus = (event: MonthlyEvent, today = getBayAreaToday()): 'upcoming' | 'ongoing' | 'ended' =>
  event.occurrenceDates !== undefined
    ? event.occurrenceDates.some(day => day >= today && day >= event.startDate && day <= event.endDate)
      ? event.occurrenceDates.includes(today) ? 'ongoing' : 'upcoming' : 'ended'
    :
  event.endDate < today ? 'ended' : event.startDate > today ? 'upcoming' : 'ongoing';

export type MonthlyDateFilter = 'all' | 'today' | 'weekend' | 'next7' | 'september' | 'october' | 'november';
export const resolveMonthlyDateFilter = (value: string | null | undefined): MonthlyDateFilter =>
  value === 'today' || value === 'weekend' || value === 'next7' || value === 'september' || value === 'october' || value === 'november' ? value : 'all';

export const getMonthlyDateRange = (filter: MonthlyDateFilter, today = getBayAreaToday()): { start: string; end: string } | null => {
  if (filter === 'all') return null;
  if (filter === 'september') return { start: '2026-09-01', end: '2026-09-30' };
  if (filter === 'october') return { start: '2026-10-01', end: '2026-10-31' };
  if (filter === 'november') return { start: '2026-11-01', end: '2026-11-30' };
  if (filter === 'today') return { start: today, end: today };
  if (filter === 'next7') return { start: today, end: addCalendarDays(today, 6) };
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const start = addCalendarDays(today, weekday === 0 ? -1 : 6 - weekday);
  return { start, end: addCalendarDays(start, 1) };
};

// A mixed-price event is free to attend when its published price line opens by saying general admission, watching or
// the activity itself is free ("舰船参观与普通航空展观赏免费 · VIP 体验另售"); paid extras may follow. Not free: an
// opening clause that names who is exempt (ages, members, residents, eligibility), a reference-only price ("参考："),
// or a line that still needs a ticket or has unchecked parts (须购票, 待确认, 未核).
const FREE_OPENING = /^[^；;·，,。]{0,16}?(?:入场|观赏|观看|参观|活动|节庆|街区节|庆典|演出|讲座|讲解|导览|巡游|试吃)[^；;·，,。]{0,6}?免费|^免费(?:入场|观看|参观|社区活动)/;
const CONDITIONAL_OPENING = /符合|岁|会员|居民|学生|长者|登记|参考/;
const NOT_YET_FREE = /[须需]购票|待确认|待核|未核/;
// The events index (generate-events-index.ts) carries costLabel only on mixed-cost events, the one case read here.
export const isFreeToAttend = (event: Pick<MonthlyEvent, 'cost'> & Partial<Pick<MonthlyEvent, 'costLabel'>>): boolean => {
  if (event.cost === 'free') return true;
  if (event.cost !== 'mixed') return false;
  const label = (event.costLabel ?? '').trim();
  const opening = label.split(/[；;·]/)[0];
  return FREE_OPENING.test(label) && !CONDITIONAL_OPENING.test(opening) && !NOT_YET_FREE.test(label);
};

export const filterMonthlyEvents = (events: MonthlyEvent[], filters: { region?: string; cost?: string; includeEnded?: boolean; date?: MonthlyDateFilter }, today = getBayAreaToday()): MonthlyEvent[] => {
  const range = getMonthlyDateRange(filters.date || 'all', today);
  return events.filter(event => (!filters.region || filters.region === 'all' || event.region === filters.region)
    && (!filters.cost || filters.cost === 'all' || (filters.cost === 'free' ? isFreeToAttend(event) : event.cost === filters.cost))
    && (filters.includeEnded || getEventStatus(event, today) !== 'ended')
    && (!range || (event.startDate <= range.end && event.endDate >= range.start
      && (event.occurrenceDates === undefined || event.occurrenceDates.some(day => day >= range.start && day <= range.end && day >= event.startDate && day <= event.endDate && (filters.includeEnded || day >= today))))));
};

// Views of the events column (plan WEB-EVENTS; design.md §4.11) ----------------------------------------------------

type DatedEvent = Pick<MonthlyEvent, 'id' | 'startDate' | 'endDate' | 'occurrenceDates'>;
const dayGap = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
/** Confirmed days win: `occurrenceDates` (with any reviewed overrides already applied) or every day of the run. */
const occursOn = (event: DatedEvent, day: string) => day >= event.startDate && day <= event.endDate && (event.occurrenceDates === undefined || event.occurrenceDates.includes(day));

/** A run of a week or more (an exhibition, a pumpkin patch, a weekly market series), not a one-off outing. */
export const LONG_RUN_DAYS = 7;
export const isLongRunning = (event: DatedEvent): boolean => dayGap(event.startDate, event.endDate) >= LONG_RUN_DAYS;

export type WeekendDayTab = 'sat' | 'sun' | 'open';
/**
 * The 周六 / 周日 / 整个周末都开放 tabs an event belongs to. A long-running series that is on both days (an exhibition,
 * a festival season) goes to 整个周末都开放 instead of filling both day tabs; a one-off or a single-day series sits under
 * its day(s). Days already past (`today` is Sunday) are left out.
 */
export function weekendDayTabs(event: DatedEvent, [saturday, sunday]: readonly [string, string], today: string): WeekendDayTab[] {
  const sat = saturday >= today && occursOn(event, saturday);
  const sun = sunday >= today && occursOn(event, sunday);
  if (sat && sun && isLongRunning(event)) return ['open'];
  return [...(sat ? ['sat' as const] : []), ...(sun ? ['sun' as const] : [])];
}

/** The next day (on or after `from`) the event is on, or undefined once it is over. */
export function nextOccurrence(event: DatedEvent, from: string): string | undefined {
  if (event.occurrenceDates !== undefined) return [...event.occurrenceDates].filter(day => day >= from && day >= event.startDate && day <= event.endDate).sort()[0];
  if (event.endDate < from) return undefined;
  return event.startDate > from ? event.startDate : from;
}

/**
 * Date order for the event lists (今天 / 未来 7 天 / 十月 / 全部): by the next day each event is on (a series that began in
 * September sorts by its next date, not its first), one-offs before long-running series on the same day, then a real photo
 * first within ties (the cover ladder's answer, passed in), then the start date and the id.
 */
export function orderByNextDay<T extends DatedEvent>(events: readonly T[], from: string, hasRealPhoto: (event: T) => boolean): T[] {
  const keyed = events.map(event => ({ event, next: nextOccurrence(event, from) ?? event.endDate, series: isLongRunning(event), photo: hasRealPhoto(event) }));
  return keyed.sort((a, b) => a.next.localeCompare(b.next) || Number(a.series) - Number(b.series) || Number(b.photo) - Number(a.photo)
    || a.event.startDate.localeCompare(b.event.startDate) || a.event.id.localeCompare(b.event.id)).map(item => item.event);
}

/**
 * 图文 rhythm for a ranked two-column feed: the best-ranked items with a real photo take the first screen's diagonal
 * slots (1, 4, 5, 8 — a checkerboard against the information cards), everything else keeps its rank order. Only an order
 * change inside the ranked list: nothing is added, dropped or relabelled (plan WEB-EVENTS: ≥4 real photos in the first 8
 * cards where the cover ladder allows).
 */
export function featurePhotos<T>(ranked: readonly T[], hasPhoto: (item: T) => boolean, slots: readonly number[] = [0, 3, 4, 7]): T[] {
  const photos = ranked.filter(hasPhoto);
  const result: (T | undefined)[] = [];
  const placed = new Set<T>();
  for (const slot of slots) {
    const photo = photos.find(item => !placed.has(item));
    if (photo === undefined || slot > ranked.length - 1) break;
    result[slot] = photo;
    placed.add(photo);
  }
  const rest = ranked.filter(item => !placed.has(item));
  for (let index = 0; index < ranked.length; index++) if (result[index] === undefined) result[index] = rest.shift();
  return result as T[];
}
