import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import aliases from '../src/data/event-id-aliases.json';
import { guides } from '../src/data/guides';
import { discoveryShare, localDiscoveries } from '../src/data/local-discoveries';
import { PUBLIC_CATALOG_FILES } from '../src/data/public-catalog-holdout';

/**
 * H07: every page the site publishes must be known to the API, or its 公开想去 / 一起去 line, a member's save or add-to-plan
 * and BayBay's recommendations fail for it. The API knows only what it copies from these public files (API-SYNC runs after
 * each content merge), so a page whose id is missing here is a page the API will 404 on.
 *
 * Event ids with a detail page that may stay out of the API's catalogs, each with its reason. Keep it empty unless an
 * event really must not take part (for example a listing kept only for an old shared link). An entry that is no longer a
 * detail page fails the test, so the list cannot go stale. An entry only relaxes this test: both exporters
 * (scripts/export-event-catalog.ts, scripts/export-planner-catalog.ts) still write every site event, and
 * tests/public-catalog-holdout.test.ts requires both API files to carry every one. Keeping an event out of the API also
 * needs the exporters to filter it and the holdout test to allow it.
 */
const API_CATALOG_EXCLUSIONS: Readonly<Record<string, string>> = {};

const read = <T,>(file: string) => JSON.parse(readFileSync(file, 'utf8')) as T;
const apiEvents = new Set(read<{ id: string }[]>(PUBLIC_CATALOG_FILES.apiEvents).map(row => row.id));
const apiPlannerEvents = new Set(read<{ events: { id: string }[] }>(PUBLIC_CATALOG_FILES.apiPlanner).events.map(row => row.id));
const detailIds = (kind: 'event' | 'offer' | 'opening') => localDiscoveries.filter(item => item.kind === kind).map(item => discoveryShare(item).id);
const missing = (ids: string[], known: Set<string>) => ids.filter(id => !known.has(id));

test('every event with a detail page is in both catalogs the API copies, apart from the listed exclusions', () => {
  const events = detailIds('event');
  assert.ok(events.length > 400, `the site lists ${events.length} events`);
  const pages = new Set(events);
  for (const [id, reason] of Object.entries(API_CATALOG_EXCLUSIONS)) {
    assert.ok(pages.has(id), `${id}: an exclusion must name an event that still has a detail page`);
    assert.ok(reason.trim().length > 10, `${id}: say why it stays out of the API catalogs`);
  }
  const required = events.filter(id => !Object.hasOwn(API_CATALOG_EXCLUSIONS, id));
  assert.deepEqual(missing(required, apiEvents), [], `${PUBLIC_CATALOG_FILES.apiEvents} misses event pages (npm run export:events)`);
  assert.deepEqual(missing(required, apiPlannerEvents), [], `${PUBLIC_CATALOG_FILES.apiPlanner} misses event pages (npm run export:planner)`);
});

test('an old event id that still opens a detail page resolves to an event the API knows', () => {
  // scripts/generate-detail-records.ts writes a detail record under the old id; the API maps it with its own copy of
  // event-id-aliases.json, so the id it lands on must be in both catalogs.
  for (const [alias, canonical] of Object.entries(aliases as Record<string, string>)) {
    assert.ok(apiEvents.has(canonical) && apiPlannerEvents.has(canonical), `${alias} → ${canonical}`);
  }
});

test('every offer, opening and guide page is in the file the API copies for it', () => {
  // The API's discoveries.json and guide-catalog.json (favorites for offers, openings and guides; BayBay's context).
  const discoveries = new Set(read<{ items: { kind: string; id: string }[] }>('public/discovery-context.json').items.map(item => `${item.kind}:${item.id}`));
  const pages = [...detailIds('offer').map(id => `offer:${id}`), ...detailIds('opening').map(id => `opening:${id}`)];
  assert.deepEqual(missing(pages, discoveries), [], 'public/discovery-context.json is current (npm run export:discovery)');
  const guideCatalog = new Set(read<{ slug: string }[]>('public/baybay-guides.json').map(guide => guide.slug));
  assert.deepEqual(missing(guides.map(guide => guide.slug), guideCatalog), [], 'public/baybay-guides.json is current (npm run export:guides)');
});
