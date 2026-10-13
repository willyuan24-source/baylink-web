import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadLocale, translateText } from '../src/i18n/locale';
import { PLANNER_CATALOG } from '../src/data/planner-catalog';
import { inPublicEventCatalogs } from '../src/data/public-catalog-holdout';

await loadLocale('en'); await loadLocale('zh-Hant');
for (const item of [...PLANNER_CATALOG.events, ...PLANNER_CATALOG.places]) item.aliases = [...new Set([...(item.aliases || []), item.title, translateText(item.title,'en'), translateText(item.title,'zh-Hant')])];
for (const items of [PLANNER_CATALOG.events, PLANNER_CATALOG.places]) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate planner catalog IDs');
  for (const item of items) if (item.location && (!Number.isFinite(item.location.lat) || !Number.isFinite(item.location.lng) || !item.location.sourceUrl)) throw new Error(`Invalid coordinates: ${item.id}`);
}
// The same events as public/event-catalog.json (export-event-catalog.ts): src/data/public-catalog-holdout.ts holds the
// events still waiting for the 3D world's placement decision out of both files.
const publicCatalog = { ...PLANNER_CATALOG, events: PLANNER_CATALOG.events.filter(event => inPublicEventCatalogs(event.id)) };
const destinations = [resolve('public/planner-catalog.json'), ...(process.argv[2] ? [resolve(process.argv[2])] : [])];
for (const destination of destinations) {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(publicCatalog, null, 2) + '\n');
}
console.log(`Exported ${publicCatalog.events.length} planner events (${PLANNER_CATALOG.events.length - publicCatalog.events.length} held back until the 3D world places them) and ${publicCatalog.places.length} places.`);
