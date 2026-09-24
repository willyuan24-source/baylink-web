import type { MonthlyEvent } from '../data/monthly-types';

/** The next confirmed local calendar day, including today; null means no future session. */
export function nextConfirmedEventDate(event: Pick<MonthlyEvent, 'startDate' | 'endDate' | 'occurrenceDates'>, today: string): string | null {
  if (event.endDate < today) return null;
  if (event.occurrenceDates === undefined) return event.startDate > today ? event.startDate : today;
  return event.occurrenceDates.reduce<string | null>((next, day) =>
    day >= today && day >= event.startDate && day <= event.endDate && (next === null || day < next) ? day : next, null);
}
