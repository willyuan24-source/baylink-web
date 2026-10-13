import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { WORLD_IMPORT_PENDING, inPublicEventCatalogs } from '../src/data/public-catalog-holdout';

type CatalogRow = { id: string; startDate: string; endDate: string; occurrenceDates?: string[] };
const eventCatalog = JSON.parse(readFileSync('public/event-catalog.json', 'utf8')) as CatalogRow[];
const plannerCatalog = JSON.parse(readFileSync('public/planner-catalog.json', 'utf8')) as { events: CatalogRow[] };
const ids = (rows: { id: string }[]) => rows.map(row => row.id).sort();

// The API copies both files and refuses a sync unless they cover identical event ids with the same dates
// (scripts/sync-editorial-catalogs.js in the API repo); a mismatch blocks every content sync, not just the new items.
test('the public event and planner catalogs cover identical event ids with the same dates', () => {
  assert.deepEqual(ids(eventCatalog), ids(plannerCatalog.events));
  const planner = new Map(plannerCatalog.events.map(row => [row.id, row]));
  for (const row of eventCatalog) {
    const rich = planner.get(row.id)!;
    for (const field of ['startDate', 'endDate', 'occurrenceDates'] as const) assert.deepEqual(row[field], rich[field], `${row.id}.${field}`);
  }
});

test('both public catalogs carry every site event except the ones held for the 3D world, and none of those', () => {
  const site = new Set(MONTHLY_EVENTS.map(event => event.id));
  for (const id of WORLD_IMPORT_PENDING) {
    assert.ok(site.has(id), `${id} is still a site event (an imported or removed event leaves the list)`);
    assert.equal(inPublicEventCatalogs(id), false);
  }
  const expected = MONTHLY_EVENTS.filter(event => inPublicEventCatalogs(event.id)).map(event => event.id).sort();
  assert.deepEqual(ids(eventCatalog), expected, 'public/event-catalog.json is current (npm run export:events)');
  assert.deepEqual(ids(plannerCatalog.events), expected, 'public/planner-catalog.json is current (npm run export:planner)');
});
