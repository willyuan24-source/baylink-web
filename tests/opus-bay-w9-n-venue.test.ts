import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Wave 9 · lane N · W9-N6 (plan sf-w9-lead.md §3 N (4); review R§6 现实出行: "Take me there" brought the Ferry Plaza
 * farmers market's visitor to the F-line platform across the Embarcadero — first10/runB/B-go-5.jpg, planner/shots/022,
 * strategy/shots/en-14). The Ferry Building venue's 带我去 now ends at the market's stalls on the front plaza (the
 * district's farmers-market anchor); the place, its name and its arrival moment stay the Ferry Building's.
 * Red before: GoToTarget had no `at`, the venue no `door` — the trip ended at the attraction point (131.5, 15.1), 3.4 u
 * from the F-line / loop stop (128.2, 15.7).
 */

const { resolveGoToTarget } = await import('../src/opus-bay/game/goToRun');
const { EVENT_VENUES } = await import('../src/opus-bay/realsf/eventVenues');
const { anchorAt } = await import('../src/opus-bay/data/pois');
await import('../src/opus-bay/data/district');
const { ATTRACTION_INDEX } = await import('../src/opus-bay/data/sf/attractions');

const lookups = (snap?: (p: { x: number; z: number }) => { x: number; z: number } | null) => ({
  attraction: (id: string) => ATTRACTION_INDEX.resolve(id),
  primary: (placeId: string) => ATTRACTION_INDEX.primary(placeId),
  // the place index row of places.json (ferry-building at 132.11, 19.31); its primary attraction speaks for it
  place: (id: string) => (id === 'ferry-building' ? { id, name: { zh: '渡轮大厦', en: 'Ferry Building' }, arrival: { x: 132.11, z: 19.31 } } : undefined),
  interactable: () => undefined,
  ...(snap ? { snap } : {}),
});

test('W9-N6 the Ferry Building venue ends 带我去 at the market stalls, not at the F-line platform', () => {
  const venue = EVENT_VENUES.find(v => v.id === 'ferry-building')!;
  assert.ok(venue.events.includes('ferry-plaza-farmers-market-2026-autumn'));
  const door = venue.door!;
  const market = anchorAt('farmers-market');
  assert.ok(Math.hypot(door.x - market.x, door.z - market.z) < 0.2, `the door is the district's farmers-market anchor (${market.x.toFixed(1)}, ${market.z.toFixed(1)})`);
  // the building side of the Embarcadero (the Bay is −z): ≥ 15 u from the F-line / loop stop at (128.2, 15.7)
  const stop = { x: 128.2, z: 15.7 };
  assert.ok(Math.hypot(door.x - stop.x, door.z - stop.z) >= 15 && door.z < stop.z - 10, 'across the street from the platform');
  const plain = resolveGoToTarget({ placeId: venue.placeId!, name: venue.name }, lookups())!;
  const atDoor = resolveGoToTarget({ placeId: venue.placeId!, name: venue.name, at: door }, lookups())!;
  assert.ok(Math.hypot(plain.x - stop.x, plain.z - stop.z) < 5, 'without the door: the attraction point by the platform (the review)');
  assert.deepEqual({ x: atDoor.x, z: atDoor.z }, door);
  assert.equal(atDoor.placeId, plain.placeId, 'the place stays the Ferry Building');
  assert.equal(atDoor.attraction, plain.attraction, 'its arrival moment too');
  // the spot is snapped like a bare point; a point target ignores `at`
  const snapped = resolveGoToTarget({ placeId: venue.placeId!, at: door }, lookups(p => ({ x: p.x + 1, z: p.z })))!;
  assert.deepEqual({ x: snapped.x, z: snapped.z }, { x: door.x + 1, z: door.z });
  const pt = resolveGoToTarget({ point: { x: 10, z: 10 }, at: door }, lookups())!;
  assert.deepEqual({ x: pt.x, z: pt.z }, { x: 10, z: 10 });
  // realsf's 带我去 passes the venue's door
  const src = readFileSync(new URL('../src/opus-bay/realsf/index.ts', import.meta.url), 'utf8');
  assert.match(src, /\.\.\.\(venue\.door \? \{ at: venue\.door \} : \{\}\)/);
});
