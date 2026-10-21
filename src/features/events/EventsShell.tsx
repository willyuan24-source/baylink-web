import type { EventsWhen } from './events-model';
import { EventsFrame, type EventsFrameProps } from './EventsFrame';
import { WeekendView } from './WeekendView';

/**
 * 活动 on /events, /this-month and /calendar: the column's frame (EventsFrame: head, view row, view switches, the boards) with
 * the 本周末 view and the other date lists (WeekendView). /calendar passes its day view too, so a switch to 本周末 needs no new
 * chunk. Rendering /calendar on EventsFrame alone (without the list) was measured (/calendar −7.9 KiB, /events +0.9 KiB, a
 * chunk split) and left as a captain's option (UI9-EVENTS PR.md, Budgets).
 */
export function EventsShell(props: Omit<EventsFrameProps, 'list'> & { defaultWhen?: EventsWhen }) {
  return <EventsFrame {...props} list={listProps => <WeekendView {...listProps} />} />;
}
