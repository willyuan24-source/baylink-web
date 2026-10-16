import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadLocale, translateText } from '../src/i18n/locale';
import { PLANNER_CATALOG } from '../src/data/planner-catalog';
import { PUBLIC_CATALOG_FILES, WORLD_HELD_FIELDS, inWorldPlannerCatalog, worldPlannerEvent } from '../src/data/public-catalog-holdout';

await loadLocale('en'); await loadLocale('zh-Hant');
for (const item of [...PLANNER_CATALOG.events, ...PLANNER_CATALOG.places]) item.aliases = [...new Set([...(item.aliases || []), item.title, translateText(item.title,'en'), translateText(item.title,'zh-Hant')])];
for (const items of [PLANNER_CATALOG.events, PLANNER_CATALOG.places]) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate planner catalog IDs');
  for (const item of items) if (item.location && (!Number.isFinite(item.location.lat) || !Number.isFinite(item.location.lng) || !item.location.sourceUrl)) throw new Error(`Invalid coordinates: ${item.id}`);
}
// Two files from one catalog (src/data/public-catalog-holdout.ts says who reads which):
// - public/planner-catalog.full.json: every event, for the API. It must cover the same event ids as public/event-catalog.json
//   (export-event-catalog.ts). An optional path argument receives this catalog too (the API's data/planner-catalog.json).
// - public/planner-catalog.json: /opus-bay's copy, without the events still waiting for the 3D world's placement decision,
//   and with WORLD_HELD_FIELDS kept at the values the opus tests pin.
const worldCatalog = { ...PLANNER_CATALOG, events: PLANNER_CATALOG.events.filter(event => inWorldPlannerCatalog(event.id)).map(worldPlannerEvent) };
const write = async (destination: string, catalog: typeof PLANNER_CATALOG) => {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(catalog, null, 2) + '\n');
};
const apiDestinations = [resolve(PUBLIC_CATALOG_FILES.apiPlanner), ...(process.argv[2] ? [resolve(process.argv[2])] : [])];
for (const destination of apiDestinations) await write(destination, PLANNER_CATALOG);
await write(resolve(PUBLIC_CATALOG_FILES.worldPlanner), worldCatalog);
console.log(`Exported ${PLANNER_CATALOG.events.length} planner events and ${PLANNER_CATALOG.places.length} places to ${apiDestinations.length} API catalog(s); /opus-bay's copy holds back ${PLANNER_CATALOG.events.length - worldCatalog.events.length} until the 3D world places them and keeps ${Object.keys(WORLD_HELD_FIELDS).length} pinned field set(s).`);
