import type { GeoPoint, PlanningFacts, PlanningSchedule } from '../lib/planner';
import events from './october-refresh-community-events.json';

/** Read from the official calendar exports on 2026-09-30. UTC converts to PDT in October. */
export const OCTOBER_REFRESH_COMMUNITY_ICS: Record<string, string> = {
  'sfpl-ocean-view-stem-oct8-2026': 'https://sfpl.org/sfpl-events/add-to-calendar/162842',
  'sfpl-richmond-lego-oct7-2026': 'https://sfpl.org/sfpl-events/add-to-calendar/151405',
  'sfpl-career-coaching-oct8-2026': 'https://sfpl.org/sfpl-events/add-to-calendar/137792',
  'sfpl-writing-gravity-oct8-2026': 'https://sfpl.org/sfpl-events/add-to-calendar/98154',
  'sfpl-western-addition-open-house-oct24-2026': 'https://sfpl.org/sfpl-events/add-to-calendar/159136',
  'sfpl-omi-history-day-oct17-2026': 'https://sfpl.org/sfpl-events/add-to-calendar/161894',
  'sfpl-garden-green-bin-oct10-2026': 'https://sfpl.org/sfpl-events/add-to-calendar/165140',
};

export const OCTOBER_REFRESH_COMMUNITY_PLANNING: Record<string, PlanningFacts> = {
  'sfpl-ocean-view-stem-oct8-2026': { setting: 'indoor', admissionUsd: null, minAge: 3, reservation: 'optional' },
  'sfpl-richmond-lego-oct7-2026': { setting: 'indoor', admissionUsd: null, minAge: 5, reservation: 'optional' },
  // The published service window is not an individual's booked 30-minute session.
  'sfpl-career-coaching-oct8-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'required', programTimeUnconfirmed: true },
  'sfpl-writing-gravity-oct8-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'optional' },
  'sfpl-western-addition-open-house-oct24-2026': { setting: 'mixed', admissionUsd: 0, reservation: 'optional' },
  'sfpl-omi-history-day-oct17-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'optional' },
  'sfpl-garden-green-bin-oct10-2026': { setting: 'indoor', admissionUsd: null, reservation: 'optional' },
  'palo-alto-pet-palooza-oct17-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'required' },
  'palo-alto-art-center-reception-oct2-2026': { admissionUsd: 0, reservation: 'unknown' },
};

const windows: Record<string, [string, string]> = {
  'sfpl-ocean-view-stem-oct8-2026': ['15:30', '16:30'],
  'sfpl-richmond-lego-oct7-2026': ['16:00', '17:30'],
  'sfpl-career-coaching-oct8-2026': ['11:00', '13:00'],
  'sfpl-writing-gravity-oct8-2026': ['18:00', '19:15'],
  'sfpl-western-addition-open-house-oct24-2026': ['12:00', '16:00'],
  'sfpl-omi-history-day-oct17-2026': ['15:00', '17:00'],
  'sfpl-garden-green-bin-oct10-2026': ['11:00', '12:30'],
  'palo-alto-pet-palooza-oct17-2026': ['10:00', '12:00'],
  'palo-alto-art-center-reception-oct2-2026': ['18:00', '20:00'],
};
const fixedSessions = new Set(['sfpl-writing-gravity-oct8-2026', 'sfpl-omi-history-day-oct17-2026', 'sfpl-garden-green-bin-oct10-2026']);
export const OCTOBER_REFRESH_COMMUNITY_SCHEDULES: Record<string, PlanningSchedule> = Object.fromEntries(events.map(event => {
  const [open, close] = windows[event.id];
  return [event.id, {
    sourceUrl: event.officialUrl, verifiedAt: event.verifiedAt, validFrom: event.startDate, validThrough: event.endDate,
    ...(!OCTOBER_REFRESH_COMMUNITY_PLANNING[event.id].programTimeUnconfirmed ? { dates: { [event.startDate]: [{ open, close }] } } : {}),
    ...(fixedSessions.has(event.id) ? { sessions: [{ date: event.startDate, start: open, end: close }] } : {}),
    note: event.plan[0],
  }];
}));

/** Only the city event page supplies this verified map point. No inferred library pins. */
export const OCTOBER_REFRESH_COMMUNITY_LOCATIONS: Record<string, GeoPoint> = {
  'palo-alto-pet-palooza-oct17-2026': {
    lat: 37.4291646, lng: -122.1419126, label: 'Cal Ave · 457–433 California Avenue', precision: 'area',
    sourceUrl: 'https://www.paloalto.gov/Events-Directory/Community-Services/Pet-Parade',
  },
};
