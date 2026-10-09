import { EventsShell } from '../features/events/EventsShell';

/**
 * /events (活动, plan D3): the events column opening on 本周末. The prerender (scripts/prerender.tsx) and the page both
 * render this; the column itself lives in src/features/events (WEB-EVENTS).
 */
export function EventsView({ today }: { today?: string }) {
  return <EventsShell today={today} defaultWhen="weekend" />;
}
