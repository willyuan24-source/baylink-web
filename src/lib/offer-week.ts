import type { FreebieOffer } from '../components/FreebieBoard';

// Offer dates on the deals board (FreebieBoard): Bay Area calendar days as YYYY-MM-DD, compared as strings.
export const validDate = (value?: string): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
};
export function dateRange(offer: FreebieOffer): [string, string] | null {
  const start = offer.startDate || offer.endDate;
  const end = offer.endDate || offer.startDate;
  return validDate(start) && validDate(end) && start <= end ? [start, end] : null;
}
export const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
/** The Sunday that ends this week (today when today is Sunday), Bay Area dates. */
export const weekEndOf = (today: string) => addDays(today, (7 - weekdayOf(today)) % 7);

/**
 * 本周有效 (G26): an offer a reader can still use between today and this Sunday. Ongoing perks count; a dated offer when
 * its dates (and published weekdays) touch the week; a 查本店 offer once it has started. Unconfirmed or undated offers do
 * not: the board cannot promise them for this week. Nor does an offer the editorial overlay marks (`sold_out`: a sale
 * that started on its source date but has nothing left, the next batch months away).
 */
export function validThisWeek(offer: FreebieOffer, today: string, weekEnd = weekEndOf(today)): boolean {
  if (offer.verificationStatus === 'needs-confirmation' || offer.status) return false;
  if (offer.availability === 'ongoing') return true;
  if (offer.availability === 'check-local') return !offer.startDate || offer.startDate <= weekEnd;
  const range = dateRange(offer);
  if (!range || range[1] < today || range[0] > weekEnd) return false;
  if (!offer.weekdays?.length) return true;
  for (let day = range[0] > today ? range[0] : today; day <= weekEnd && day <= range[1]; day = addDays(day, 1)) if (offer.weekdays.includes(weekdayOf(day) as 0)) return true;
  return false;
}
