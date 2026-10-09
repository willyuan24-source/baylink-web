import dates from './generated/event-dates.json';

// Generated from reviewed scripts/data/event-calendar-schedule.ts.
// Calendar arithmetic must not pull full descriptions into the homepage — nor the schedule notes
// (event-schedule-notes.ts), which only the calendar and the 3D city guide show.
export const EVENT_DATE_OVERRIDES: Record<string, string[]> = dates;
