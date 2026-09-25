import type { PlannerEvent } from '../../lib/planner';
import { eventOccursOn } from '../../lib/event-calendar';
import { sfLandmarkEvents } from './sf-landmark-events';
import type { UnifiedPlace } from './unified-bay-world';

/** Only located venue events can be described as nearby; area-level locations stay on the regional calendar. */
export function unifiedPlaceEvents(events: PlannerEvent[], place: UnifiedPlace, date: string) {
  if (place.region === 'sf') return sfLandmarkEvents(events, place.id, date);
  const rad = Math.PI / 180, [lng, lat] = place.coordinate;
  return events.filter(event => {
    const location = event.location;
    if (event.region !== place.region || !location || location.precision !== 'venue' || !eventOccursOn(event, date)) return false;
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return false;
    const a = Math.sin((location.lat - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(location.lat * rad) * Math.sin((location.lng - lng) * rad / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return km <= .8;
  });
}
