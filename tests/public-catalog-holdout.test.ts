import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PUBLIC_CATALOG_FILES, WORLD_IMPORT_PENDING, inWorldPlannerCatalog } from '../src/data/public-catalog-holdout';

type CatalogRow = { id: string; startDate: string; endDate: string; occurrenceDates?: string[] };
type PlannerFile = { events: CatalogRow[] } & Record<string, unknown>;
// A Windows checkout may hold the generated files with CRLF endings; the export itself writes LF.
const text = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const apiEvents = JSON.parse(text(PUBLIC_CATALOG_FILES.apiEvents)) as CatalogRow[];
const apiPlanner = JSON.parse(text(PUBLIC_CATALOG_FILES.apiPlanner)) as PlannerFile;
const ids = (rows: { id: string }[]) => rows.map(row => row.id).sort();
const siteIds = MONTHLY_EVENTS.map(event => event.id).sort();

// The API copies public/event-catalog.json and public/planner-catalog.full.json and refuses a sync unless they cover
// identical event ids with the same dates (scripts/sync-editorial-catalogs.js in the API repo, from API-SYNC-3b); a
// mismatch blocks every content sync, not just the new items.
test('the two catalogs the API copies cover identical event ids with the same dates', () => {
  assert.deepEqual(ids(apiEvents), ids(apiPlanner.events));
  const planner = new Map(apiPlanner.events.map(row => [row.id, row]));
  for (const row of apiEvents) {
    const rich = planner.get(row.id)!;
    for (const field of ['startDate', 'endDate', 'occurrenceDates'] as const) assert.deepEqual(row[field], rich[field], `${row.id}.${field}`);
  }
});

test('the catalogs the API copies carry every site event, the ones held for the 3D world included (H07)', () => {
  assert.deepEqual(ids(apiEvents), siteIds, 'public/event-catalog.json is current (npm run export:events)');
  assert.deepEqual(ids(apiPlanner.events), siteIds, 'public/planner-catalog.full.json is current (npm run export:planner)');
  const api = new Set(ids(apiEvents));
  for (const id of WORLD_IMPORT_PENDING) assert.ok(api.has(id), `${id} reaches the API`);
});

test("/opus-bay's planner catalog is the full catalog without the held events, byte for byte", () => {
  const site = new Set(siteIds);
  for (const id of WORLD_IMPORT_PENDING) {
    assert.ok(site.has(id), `${id} is still a site event (an imported or removed event leaves the list)`);
    assert.equal(inWorldPlannerCatalog(id), false);
  }
  // Everything else in the file /opus-bay reads (places, guides, every other event row) is exactly the API's copy.
  const expected = { ...apiPlanner, events: apiPlanner.events.filter(row => inWorldPlannerCatalog(row.id)) };
  assert.equal(text(PUBLIC_CATALOG_FILES.worldPlanner), `${JSON.stringify(expected, null, 2)}\n`, 'public/planner-catalog.json is current (npm run export:planner)');
});
