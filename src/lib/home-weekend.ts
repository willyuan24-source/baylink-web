import type { MonthlyEvent } from '../data/monthly-types';
import { MONTHLY_EVENTS, HOME_WEEKENDS } from './home-catalog';
import { filterMonthlyEvents, getMonthlyDateRange } from './monthly';
import { eventOccursOn } from './event-calendar';

export function getHomeWeekend(today: string, catalog: MonthlyEvent[] = MONTHLY_EVENTS) {
  const range = getMonthlyDateRange('weekend', today)!;
  const days = [range.start, range.end].filter(day => day >= today);
  const events = filterMonthlyEvents(catalog, { date: 'weekend' }, today).map(event => ({
    event, date: days.find(day => eventOccursOn(event, day)),
  })).filter((entry): entry is { event: MonthlyEvent; date: string } => !!entry.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.event.endDate.localeCompare(b.event.endDate) || a.event.id.localeCompare(b.event.id));
  const selected: typeof events = [];
  // Offer a few different areas first; the result is editorial selection, not a popularity claim.
  for (const entry of events) if (!selected.some(pick => pick.event.region === entry.event.region) && selected.length < 3) selected.push(entry);
  for (const entry of events) if (!selected.some(pick => pick.event.id === entry.event.id) && selected.length < 3) selected.push(entry);
  const snapshot = catalog === MONTHLY_EVENTS ? (HOME_WEEKENDS as Record<string, { ids: string[]; total: number }>)[today] : undefined;
  const picks = snapshot ? snapshot.ids.flatMap(id => events.find(entry => entry.event.id === id) || []) : selected;
  return { ...range, events, picks, total: snapshot?.total ?? events.length };
}
