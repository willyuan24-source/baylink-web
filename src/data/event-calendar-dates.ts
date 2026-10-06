import schedule from './generated/event-schedule.json';

// Generated from reviewed scripts/data/event-calendar-schedule.ts.
// Calendar arithmetic must not pull full descriptions into the homepage.
export const EVENT_DATE_OVERRIDES: Record<string, string[]> = schedule.dates;
export const EVENT_SCHEDULE_NOTES: Record<string, string> = schedule.notes;
