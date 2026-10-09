import { CalendarEventMap } from '../../components/CalendarEventMap';
import { groupCalendarMapEvents } from '../../lib/event-calendar';
import type { PlannerEvent } from '../../lib/planner';
import type { IndexEvent } from './events-index-types';

/**
 * The calendar's 地图 mode, loaded only when a reader opens it: the city coordinates and maplibre stay out of the list's
 * first load. Venue points stay distinct from labelled city/area fallbacks (event-calendar.ts groupCalendarMapEvents).
 */
export default function CalendarMap({ events, selectedId, onSelect }: { events: IndexEvent[]; selectedId: string; onSelect: (id: string, eventIds: string[]) => void }) {
  const { points } = groupCalendarMapEvents(events as unknown as PlannerEvent[]);
  return <CalendarEventMap points={points} selectedId={selectedId} onSelect={id => onSelect(id, points.find(point => point.id === id)?.eventIds ?? [])} />;
}
