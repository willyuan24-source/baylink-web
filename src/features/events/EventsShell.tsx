import type { EventsWhen } from './events-model';
import { EventsFrame, type EventsFrameProps } from './EventsFrame';
import { WeekendView } from './WeekendView';

/**
 * 活动 on /events and /this-month: the column's frame (EventsFrame: head, view row, view switches, the boards) with the 本周末
 * view and the other date lists (WeekendView). /calendar renders the frame with its day view only, so its route graph does
 * not carry the list (UI9-EVENTS: route JS ≤ base).
 */
export function EventsShell(props: Omit<EventsFrameProps, 'list'> & { defaultWhen?: EventsWhen }) {
  return <EventsFrame {...props} list={listProps => <WeekendView {...listProps} />} />;
}
