import type { FreebieOffer } from '../components/FreebieBoard';
import { validCalendarDay } from './event-calendar';

/** Published weekday restrictions apply even when an offer's end date is unconfirmed. */
export function offerMatchesDateRange(offer: Pick<FreebieOffer, 'availability' | 'startDate' | 'endDate' | 'weekdays'>, from: string, through: string): boolean {
  if (!validCalendarDay(from) || !validCalendarDay(through) || from > through) return false;
  const start = offer.startDate || (offer.availability === 'dated' ? offer.endDate : undefined);
  const end = offer.endDate || (offer.availability === 'dated' ? offer.startDate : undefined);
  if (offer.availability === 'dated' && (!start || !end)) return false;
  if (start && !validCalendarDay(start) || end && !validCalendarDay(end) || start && end && start > end) return false;
  const first = start && start > from ? start : from;
  const last = end && end < through ? end : through;
  if (first > last) return false;
  if (offer.weekdays === undefined) return true;
  const firstDate = new Date(`${first}T12:00:00Z`);
  const daySpan = (new Date(`${last}T12:00:00Z`).getTime() - firstDate.getTime()) / 86400000;
  return offer.weekdays.some(day => Number.isInteger(day) && day >= 0 && day <= 6 && (day - firstDate.getUTCDay() + 7) % 7 <= daySpan);
}
