import notes from './generated/event-schedule-notes.json';

// Generated from reviewed scripts/data/event-calendar-schedule.ts: one line per event about how its dates work.
// Kept apart from the dates (event-calendar-dates.ts) so the homepage does not download them.
export const EVENT_SCHEDULE_NOTES: Record<string, string> = notes;
