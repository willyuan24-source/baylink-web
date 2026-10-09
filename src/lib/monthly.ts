import type { MonthlyEvent } from '../data/monthly-types';
import { MONTHLY_EDITION } from '../data/monthly-settings';
import { addCalendarDays } from './event-calendar';
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
export const isFreeToAttend = (event: Pick<MonthlyEvent, 'cost' | 'costLabel'>): boolean => {
  if (event.cost === 'free') return true;
  if (event.cost !== 'mixed') return false;
  const label = event.costLabel.trim();
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
