import { MONTHLY_EVENTS, MONTHLY_EDITION } from './monthly-edition';
import { ATTRACTIONS } from './attractions';
import { guides } from './guides';
import type { GeoPoint, PlannerEvent, PlannerPlace, PlanningFacts } from '../lib/planner';
import placeLocationData from './place-locations.json';
import { aiEventLocations, aiEventSettings } from './ai-local-events';

const placeLocations = placeLocationData as Record<string, GeoPoint>;

const eventPlanning: Record<string, PlanningFacts> = {
  'portola-2026': { setting: 'mixed', minAge: 21, reservation: 'required' },
  'burlingame-mandarin-storytime-2026': { setting: 'indoor', minAge: 0, maxAge: 6 },
  'emeryville-art-exhibition-closing-2026': { setting: 'indoor' },
  'fremont-finding-nemo-outdoor-movie-2026': { setting: 'outdoor' },
  'sf-quinteto-latino-lunchtime-2026': { setting: 'outdoor' },
  'oakland-omca-dia-muertos-2026': { setting: 'mixed', admissionUsd: 10 },
  'oakland-omca-friday-finale-2026': { setting: 'outdoor' },
  'palo-alto-addams-family-opening-2026': { setting: 'mixed', minAge: 3 },
  ...aiEventSettings,
  'surrealdb-mastra-shared-memory-2026': { setting: 'indoor', minAge: 18, reservation: 'required' },
};
const eventLocations: Record<string, GeoPoint> = {
  ...aiEventLocations,
  'oakland-omca-dia-muertos-2026': placeLocations['lake-merritt'],
  'oakland-omca-friday-finale-2026': placeLocations['lake-merritt'],
  'cupertino-fall-bike-fest-2026': { lat: 37.3188973, lng: -122.0286498, label: 'Cupertino Civic Center Plaza · 10300 Torre Avenue', sourceUrl: 'https://www.cupertino.gov/Events-directory/Bike-Fest-2026', precision: 'venue' },
};

// Coordinates are added only from individually checked public venue sources.
export const PLANNER_EVENTS: PlannerEvent[] = MONTHLY_EVENTS.map(event => ({ ...event, ...(eventLocations[event.id] ? { location: eventLocations[event.id] } : {}), planning: { admissionUsd: event.cost === 'free' ? 0 : null, ...eventPlanning[event.id] } }));
export const PLANNER_PLACES: PlannerPlace[] = ATTRACTIONS.map(place => ({
  id: place.id, title: place.title, region: place.region, city: place.city, summary: place.note,
  guideSlug: place.slug, cost: place.cost,
  location: placeLocations[place.id],
  officialUrl: guides.find(guide => guide.slug === place.slug)?.sources[0]?.url || '',
  planning: { admissionUsd: place.cost === 'free' ? 0 : null, setting: ['golden-gate', 'chinatown', 'palace', 'presidio', 'redwood', 'half-moon-bay', 'baylands', 'hakone', 'muir-woods', 'sausalito'].includes(place.id) ? 'outdoor' : 'mixed' },
}));
export const PLANNER_CATALOG = { version: 1, checkedAt: MONTHLY_EDITION.checkedAt, events: PLANNER_EVENTS, places: PLANNER_PLACES, guides: guides.map(({ slug, title }) => ({ slug, title })) };
