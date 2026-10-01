import type { GeoPoint, PlanningFacts, PlanningSchedule } from '../lib/planner';
import events from './october-refresh-events.json';

const source = (id: string) => {
  const event = events.find(row => row.id === id)!;
  return { sourceUrl: event.officialUrl, verifiedAt: event.verifiedAt, validFrom: event.startDate, validThrough: event.endDate };
};
export const OCTOBER_REFRESH_PLANNING: Record<string, PlanningFacts> = {
  'san-jose-365-night-market-october-2026': { admissionUsd: 0, programTimeUnconfirmed: true, reservation: 'unknown' },
  'oakland-drunken-film-fest-free-shorts-2026': { admissionUsd: 0, programTimeUnconfirmed: true, reservation: 'unknown' },
  'napa-tulocay-heritage-halloween-tour-2026': { setting: 'outdoor', admissionUsd: 45, reservation: 'required' },
  'palo-alto-cal-ave-halloween-live-2026': { setting: 'outdoor', admissionUsd: 0, programTimeUnconfirmed: true },
  'concord-sidegate-trivia-october-2026': { admissionUsd: null, reservation: 'unknown' },
};
export const OCTOBER_REFRESH_LOCATIONS: Record<string, GeoPoint> = {
  'palo-alto-cal-ave-halloween-live-2026': { lat: 37.4262659, lng: -122.1417963, label: 'California Avenue · El Camino Real–Birch Street', precision: 'area', sourceUrl: source('palo-alto-cal-ave-halloween-live-2026').sourceUrl },
};
export const OCTOBER_REFRESH_SCHEDULES: Record<string, PlanningSchedule> = {
  'napa-tulocay-heritage-halloween-tour-2026': {
    ...source('napa-tulocay-heritage-halloween-tour-2026'),
    sessions: [{ date: '2026-10-24', start: '16:00', end: '17:30' }],
    note: events.find(row => row.id === 'napa-tulocay-heritage-halloween-tour-2026')!.costLabel,
  },
  'concord-sidegate-trivia-october-2026': {
    ...source('concord-sidegate-trivia-october-2026'),
    dates: Object.fromEntries(['07', '14', '21', '28'].map(day => [`2026-10-${day}`, [{ open: '18:30', close: '20:30' }]])),
    sessions: ['07', '14', '21', '28'].map(day => ({ date: `2026-10-${day}`, start: '19:00' })),
    note: events.find(row => row.id === 'concord-sidegate-trivia-october-2026')!.plan[0],
  },
};
