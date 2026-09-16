import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';

const catalog = MONTHLY_EVENTS.map(({ id, title, startDate, endDate }) => ({ id, title, startDate, endDate }));
if (new Set(catalog.map(event => event.id)).size !== catalog.length) throw new Error('Duplicate event IDs');
const destinations = [resolve('public/event-catalog.json'), ...(process.argv[2] ? [resolve(process.argv[2])] : [])];
for (const destination of destinations) {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(catalog, null, 2)}\n`);
}
console.log(`Exported ${catalog.length} official events to ${destinations.length} catalog(s).`);
