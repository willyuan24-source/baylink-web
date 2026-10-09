import { mkdir, rm, writeFile } from 'node:fs/promises';
import { EVENT_DATE_OVERRIDES, EVENT_SCHEDULE_NOTES } from './data/event-calendar-schedule';
await mkdir('src/data/generated', { recursive: true });
// Two files: the dates are on the homepage's graph (eventOccursOn), the notes only on the calendar and the 3D city guide.
await writeFile('src/data/generated/event-dates.json', JSON.stringify(EVENT_DATE_OVERRIDES));
await writeFile('src/data/generated/event-schedule-notes.json', JSON.stringify(EVENT_SCHEDULE_NOTES));
// The combined file it replaces (WEB-HOMEPREP): never left behind for a stale import to find.
await rm('src/data/generated/event-schedule.json', { force: true });
console.log('Compact calendar dates and schedule notes generated without full event descriptions.');
