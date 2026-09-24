import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PLANNER_CATALOG } from '../src/data/planner-catalog';

for (const items of [PLANNER_CATALOG.events, PLANNER_CATALOG.places]) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate planner catalog IDs');
  for (const item of items) if (item.location && (!Number.isFinite(item.location.lat) || !Number.isFinite(item.location.lng) || !item.location.sourceUrl)) throw new Error(`Invalid coordinates: ${item.id}`);
}
const destinations = [resolve('public/planner-catalog.json'), ...(process.argv[2] ? [resolve(process.argv[2])] : [])];
for (const destination of destinations) {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(PLANNER_CATALOG, null, 2) + '\n');
}
console.log(`Exported ${PLANNER_CATALOG.events.length} planner events and ${PLANNER_CATALOG.places.length} places.`);
