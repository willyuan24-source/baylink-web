import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PUBLIC_CATALOG_FILES } from '../src/data/public-catalog-holdout';

// Every site event, for the API (src/data/public-catalog-holdout.ts says who reads which file): it copies this file with
// public/planner-catalog.full.json (export-planner-catalog.ts) and refuses a sync unless both cover identical ids.
// An optional path argument writes the same catalog there too (the API's data/event-catalog.json).
const catalog = MONTHLY_EVENTS.map(({ id, title, startDate, endDate, occurrenceDates }) => ({ id, title, startDate, endDate, ...(occurrenceDates !== undefined ? { occurrenceDates } : {}) }));
if (new Set(catalog.map(event => event.id)).size !== catalog.length) throw new Error('Duplicate event IDs');
const destinations = [resolve(PUBLIC_CATALOG_FILES.apiEvents), ...(process.argv[2] ? [resolve(process.argv[2])] : [])];
for (const destination of destinations) {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(catalog, null, 2)}\n`);
}
console.log(`Exported ${catalog.length} official events to ${destinations.length} catalog(s).`);
