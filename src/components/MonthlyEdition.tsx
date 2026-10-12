import { EventsShell } from '../features/events/EventsShell';
import type { MonthlyDateFilter } from '../lib/monthly';

/**
 * /this-month: an alias of the events column (plan D3) opening on 全部日期 instead of 本周末. Kept under this name because
 * the prerender renders `<MonthlyEdition defaultDateFilter="all" />`; the column lives in src/features/events (WEB-EVENTS).
 */
export function MonthlyEdition({ today, defaultDateFilter = 'all' }: { today?: string; defaultDateFilter?: MonthlyDateFilter } = {}) {
  return <EventsShell today={today} defaultWhen={defaultDateFilter === 'september' ? 'all' : defaultDateFilter} />;
}
