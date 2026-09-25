import type { PlannerEvent } from '../../lib/planner';
import { eventOccursOn } from '../../lib/event-calendar';
import { SF_LANDMARKS, projectCoordinate } from './sf-world';

const VENUES: Record<string, RegExp> = {
  academy: /california academy of sciences|加州科学馆|加州科學館/i,
  'de-young': /de young|笛洋|德扬|德揚/i,
  'japanese-tea-garden': /japanese tea garden|日本茶园|日本茶園/i,
  pier: /pier\s*39/i,
  skystar: /skystar/i,
  ferry: /ferry building|渡轮大厦|渡輪大廈/i,
  'union-square': /union square|联合广场|聯合廣場/i,
  'ocean-beach': /ocean beach/i,
  'baker-beach': /baker beach/i,
  'lands-end': /lands end|lands’ end/i,
};

/** Exact venue names take priority over nearby coordinates in the museum cluster. */
export function sfEventLandmark(event: PlannerEvent): string | undefined {
  if (event.region !== 'sf') return undefined;
  for (const [id, name] of Object.entries(VENUES)) if (name.test(event.venue)) return id;
  if (!event.location || event.location.precision !== 'venue') return undefined;
  const { lng, lat } = event.location;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  const point = projectCoordinate([lng, lat]);
  const nearest = SF_LANDMARKS.map(place => ({ id: place.id, distance: Math.hypot(point[0] - place.position[0], point[1] - place.position[1]) }))
    .sort((a, b) => a.distance - b.distance)[0];
  // Roughly a block, explicitly described in the UI as nearby, never as at the venue.
  return nearest?.distance <= 1.2 ? nearest.id : undefined;
}

export function sfLandmarkEvents(events: PlannerEvent[], landmarkId: string, date: string, freeOnly = false) {
  return events.filter(event => (!freeOnly || event.cost === 'free') && eventOccursOn(event, date) && sfEventLandmark(event) === landmarkId);
}
