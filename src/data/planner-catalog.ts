import { MONTHLY_EVENTS, MONTHLY_EDITION } from './monthly-edition';
import { ATTRACTIONS } from './attractions';
import novemberNorthPlanning from './november-refresh-north-planning.json';
import novemberSouthPlanning from './november-refresh-peninsula-south-planning.json';
import novemberEastPlanning from './november-refresh-east-sf-planning.json';
import { guides } from './guides';
import type { GeoPoint, PlannerEvent, PlannerPlace, PlanningFacts } from '../lib/planner';
import placeLocationData from './place-locations.json';
import { aiEventLocations, aiEventSettings } from './ai-local-events';
import { PLANNER_LOCAL_STOPS } from './planner-local-stops';
import { VERIFIED_EVENT_SCHEDULES, VERIFIED_PLACE_SCHEDULES, VERIFIED_VENUE_LOCATIONS } from './planner-verified-hours';
import { SEPTEMBER_REFRESH_PLANNING, SEPTEMBER_REFRESH_SCHEDULES } from './september-refresh-planning';
import { COVERAGE_AUDIT_REGIONAL_PLANNING, COVERAGE_AUDIT_REGIONAL_SCHEDULES } from './coverage-audit-regional-planning';
import { COVERAGE_AUDIT_SF_NORTH_PLANNING, COVERAGE_AUDIT_SF_NORTH_SCHEDULES } from './coverage-audit-sf-north-planning';
import { OCTOBER_REFRESH_PLANNING, OCTOBER_REFRESH_SCHEDULES, OCTOBER_REFRESH_LOCATIONS } from './october-refresh-planning';
import { OCTOBER_REFRESH_COMMUNITY_PLANNING, OCTOBER_REFRESH_COMMUNITY_SCHEDULES, OCTOBER_REFRESH_COMMUNITY_LOCATIONS } from './october-refresh-community-planning';

const placeLocations = placeLocationData as Record<string, GeoPoint>;
const EVENT_ALIASES: Record<string, string[]> = {
  'san-francisco-fleet-week-2026': ['San Francisco Fleet Week', 'Fleet Week', '舰队周', '艦隊週', '蓝天使', '藍天使', 'Blue Angels'],
  'hardly-strictly-bluegrass-2026': ['Hardly Strictly Bluegrass', 'HSB', '蓝草音乐节', '藍草音樂節'],
  'half-moon-bay-pumpkin-festival-2026': ['Half Moon Bay Art & Pumpkin Festival', 'Half Moon Bay Pumpkin Festival', '半月湾南瓜节', '半月灣南瓜節'],
  'oakland-autumn-lights-festival-2026': ['Autumn Lights Festival', '秋灯节', '秋燈節'],
  'ai-conference-sf-2026': ['The AI Conference', 'AI Conference SF'],
  'n8n-sf-tech-week-workshop-2026': ['n8n workshop', 'n8n 工作坊'],
};
const PLACE_ALIASES: Record<string, string[]> = {
  'golden-gate': ['Golden Gate Bridge', '金门大桥', '金門大橋'],
  'chinatown': ['San Francisco Chinatown', '旧金山唐人街', '舊金山唐人街'],
  'palace': ['Palace of Fine Arts', '艺术宫', '藝術宮'],
  'presidio': ['Presidio', 'Presidio Tunnel Tops'],
  'redwood': ['Reinhardt Redwood Regional Park', '红杉区域公园', '紅杉區域公園'],
  'muir-woods': ['Muir Woods', '缪尔森林', '繆爾森林'],
  'lake-merritt': ['Lake Merritt', '梅里特湖'],
  'filoli': ['Filoli', '费罗丽', '費羅麗'],
  'half-moon-bay': ['Half Moon Bay', '半月湾', '半月灣'],
};

const eventPlanning: Record<string, PlanningFacts> = {
  ...SEPTEMBER_REFRESH_PLANNING,
  ...COVERAGE_AUDIT_REGIONAL_PLANNING,
  ...COVERAGE_AUDIT_SF_NORTH_PLANNING,
  ...OCTOBER_REFRESH_PLANNING,
  ...OCTOBER_REFRESH_COMMUNITY_PLANNING,
  'portola-2026': { setting: 'mixed', minAge: 21, reservation: 'required' },
  'burlingame-mandarin-storytime-2026': { setting: 'indoor', minAge: 0, maxAge: 6 },
  'emeryville-art-exhibition-closing-2026': { setting: 'indoor' },
  'fremont-finding-nemo-outdoor-movie-2026': { setting: 'outdoor' },
  'sf-quinteto-latino-lunchtime-2026': { setting: 'outdoor' },
  'oakland-omca-dia-muertos-2026': { setting: 'mixed', admissionUsd: 10 },
  'oakland-omca-friday-finale-2026': { setting: 'outdoor' },
  // 18:00–21:00 is the museum evening; the ballet room only opens at 19:25.
  'san-jose-first-friday-ballet-2026': { programTimeUnconfirmed: true },
  'palo-alto-addams-family-opening-2026': { setting: 'mixed', minAge: 3 },
  ...aiEventSettings,
  'surrealdb-mastra-shared-memory-2026': { setting: 'indoor', minAge: 18, reservation: 'required' },
  // Entry restrictions confirmed by the event sources, not inferred from drinking ages.
  'sf-exploratorium-after-dark-01-oct2026': { minAge: 18 },
  'sf-exploratorium-after-dark-08-oct2026': { minAge: 18 },
  'sf-exploratorium-after-dark-15-oct2026': { minAge: 18 },
  'sf-exploratorium-after-dark-22-oct2026': { minAge: 18 },
  'sf-exploratorium-after-dark-29-oct2026': { minAge: 18 },
  'r2-vallejo-wonder-deep-dive-2026': { minAge: 18 },
  'r2-vallejo-wonder-after-dark-2026': { minAge: 18 },
  'tiburon-wine-festival-2026': { minAge: 21 },
  'napa-harvest-after-dark-2026': { minAge: 21 },
  'vacaville-boo-bash-20261030': { minAge: 21 },
  'fremont-trick-or-treat-2026': { minAge: 2, maxAge: 10, reservation: 'required' },
};
const eventLocations: Record<string, GeoPoint> = {
  ...OCTOBER_REFRESH_LOCATIONS,
  ...OCTOBER_REFRESH_COMMUNITY_LOCATIONS,
  ...aiEventLocations,
  'ferry-plaza-farmers-market-2026-autumn': VERIFIED_VENUE_LOCATIONS['ferry-plaza'],
  ...Object.fromEntries(['01', '08', '15', '22', '29'].map(day => [`sf-exploratorium-after-dark-${day}-oct2026`, VERIFIED_VENUE_LOCATIONS.exploratorium])),
  'san-jose-first-friday-ballet-2026': VERIFIED_VENUE_LOCATIONS.sjma,
  'san-jose-sjma-dia-muertos-community-2026': VERIFIED_VENUE_LOCATIONS.sjma,
  // Despite the legacy place key, this stored pin is OMCA itself, not Lake Merritt's center.
  'oakland-omca-dia-muertos-2026': placeLocations['lake-merritt'],
  'oakland-omca-friday-finale-2026': placeLocations['lake-merritt'],
  'cupertino-fall-bike-fest-2026': { lat: 37.3188973, lng: -122.0286498, label: 'Cupertino Civic Center Plaza · 10300 Torre Avenue', sourceUrl: 'https://www.cupertino.gov/Events-directory/Bike-Fest-2026', precision: 'venue' },
};

// Coordinates are added only from individually checked public venue sources.
const eventSchedules = { ...VERIFIED_EVENT_SCHEDULES, ...SEPTEMBER_REFRESH_SCHEDULES, ...COVERAGE_AUDIT_REGIONAL_SCHEDULES, ...COVERAGE_AUDIT_SF_NORTH_SCHEDULES, ...OCTOBER_REFRESH_SCHEDULES, ...OCTOBER_REFRESH_COMMUNITY_SCHEDULES };
const novemberPlanning = { ...novemberNorthPlanning, ...novemberSouthPlanning, ...novemberEastPlanning } as Record<string, { planning: PlanningFacts }>;
export const PLANNER_EVENTS: PlannerEvent[] = MONTHLY_EVENTS.map(event => ({ ...event, aliases: [...new Set([event.title, ...(event.aliases || []), ...(EVENT_ALIASES[event.id] || [])])], ...(eventLocations[event.id] ? { location: eventLocations[event.id] } : {}), planning: { admissionUsd: event.cost === 'free' ? 0 : null, ...eventPlanning[event.id], ...(eventSchedules[event.id] ? { schedule: eventSchedules[event.id] } : {}), ...novemberPlanning[event.id]?.planning, ...(event.cost === 'unknown' ? { admissionUsd: null } : {}) } }));
export const PLANNER_PLACES: PlannerPlace[] = [...ATTRACTIONS.map((place): PlannerPlace => ({
  id: place.id, title: place.title, aliases: [...new Set([place.title, ...(PLACE_ALIASES[place.id] || [])])], region: place.region, city: place.city, summary: place.note,
  guideSlug: place.slug, path: `/guides/${encodeURIComponent(place.slug)}`, category: 'attraction', cost: place.cost,
  location: placeLocations[place.id],
  officialUrl: place.officialUrl || guides.find(guide => guide.slug === place.slug)?.sources[0]?.url || '',
  planning: { admissionUsd: place.cost === 'free' ? 0 : null, setting: ['golden-gate', 'chinatown', 'palace', 'presidio', 'redwood', 'half-moon-bay', 'baylands', 'hakone', 'muir-woods', 'sausalito', 'lands-end', 'mission-dolores', 'coyote-hills', 'angel-island'].includes(place.id) ? 'outdoor' : 'mixed', ...(VERIFIED_PLACE_SCHEDULES[place.id] ? { schedule: VERIFIED_PLACE_SCHEDULES[place.id] } : {}), ...(place.id === 'filoli' ? { reservation: 'optional' as const } : {}) },
})), ...PLANNER_LOCAL_STOPS];
export const PLANNER_CATALOG = { version: 1, checkedAt: MONTHLY_EDITION.checkedAt, events: PLANNER_EVENTS, places: PLANNER_PLACES, guides: guides.map(({ slug, title }) => ({ slug, title })) };
