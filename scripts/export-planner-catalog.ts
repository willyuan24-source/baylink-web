import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadLocale, translateText } from '../src/i18n/locale';
import { PLANNER_CATALOG } from '../src/data/planner-catalog';
import supplyEvents1012 from '../src/data/supply-2026-10-12-events.json';

// The 3D world (/opus-bay) reads public/planner-catalog.json and every San Francisco event in it needs the Opus session's
// own placement decision (a venue row, or a stated reason to stay out: tests/opus-bay-w6-s-venues.test.ts). The
// 2026-10-12 supply batch's SF programmes stay website-only until that session imports them: the site's event pages,
// calendar and in-app planner (which bundle PLANNER_EVENTS) list them; only this public file holds them back.
const WORLD_IMPORT_PENDING = new Set(supplyEvents1012.filter(event => event.region === 'sf').map(event => event.id));

await loadLocale('en'); await loadLocale('zh-Hant');
for (const item of [...PLANNER_CATALOG.events, ...PLANNER_CATALOG.places]) item.aliases = [...new Set([...(item.aliases || []), item.title, translateText(item.title,'en'), translateText(item.title,'zh-Hant')])];
for (const items of [PLANNER_CATALOG.events, PLANNER_CATALOG.places]) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate planner catalog IDs');
  for (const item of items) if (item.location && (!Number.isFinite(item.location.lat) || !Number.isFinite(item.location.lng) || !item.location.sourceUrl)) throw new Error(`Invalid coordinates: ${item.id}`);
}
const publicCatalog = { ...PLANNER_CATALOG, events: PLANNER_CATALOG.events.filter(event => !WORLD_IMPORT_PENDING.has(event.id)) };
const destinations = [resolve('public/planner-catalog.json'), ...(process.argv[2] ? [resolve(process.argv[2])] : [])];
for (const destination of destinations) {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(publicCatalog, null, 2) + '\n');
}
console.log(`Exported ${publicCatalog.events.length} planner events (${PLANNER_CATALOG.events.length - publicCatalog.events.length} SF events awaiting the 3D world import held back) and ${publicCatalog.places.length} places.`);
