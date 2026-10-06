import { mkdir, writeFile } from 'node:fs/promises';
import { EVENT_DATE_OVERRIDES, EVENT_SCHEDULE_NOTES } from './data/event-calendar-schedule';
await mkdir('src/data/generated', { recursive: true });
await writeFile('src/data/generated/event-schedule.json', JSON.stringify({ dates: EVENT_DATE_OVERRIDES, notes: EVENT_SCHEDULE_NOTES }));
console.log('Compact calendar dates and schedule notes generated without full event descriptions.');
