import assert from 'node:assert/strict';
import test from 'node:test';
import { sfEventLandmark, sfLandmarkEvents } from '../src/features/little-bay/sf-landmark-events';
import type { PlannerEvent } from '../src/lib/planner';
import { SF_LANDMARKS } from '../src/features/little-bay/sf-world';

const base = { id: 'test-exhibition', region: 'sf', venue: 'California Academy of Sciences', startDate: '2026-10-01', endDate: '2026-10-31', occurrenceDates: ['2026-10-03', '2026-10-10'], cost: 'paid' } as PlannerEvent;
test('landmark events use exact occurrences, cost filters and never include expired dates', () => {
  assert.equal(sfLandmarkEvents([base], 'academy', '2026-10-03').length, 1);
  for (const date of ['2026-10-04', '2026-11-01', '']) assert.deepEqual(sfLandmarkEvents([base], 'academy', date), []);
  assert.deepEqual(sfLandmarkEvents([base], 'academy', '2026-10-03', true), []);
  assert.deepEqual(sfLandmarkEvents([base], 'de-young', '2026-10-03'), []);
});
test('venue names disambiguate neighboring museums and only precise nearby coordinates get mapped', () => {
  const museum = SF_LANDMARKS.find(place => place.id === 'de-young')!;
  const location = { lat: museum.coordinate[1], lng: museum.coordinate[0], precision: 'venue' as const, label: 'Museum', sourceUrl: museum.sourceUrl };
  assert.equal(sfEventLandmark({ ...base, location }), 'academy', 'named venue beats approximate coordinates');
  assert.equal(sfEventLandmark({ ...base, venue: 'Museum courtyard', location }), 'de-young');
  assert.equal(sfEventLandmark({ ...base, venue: 'Golden Gate Park', location: { ...location, precision: 'area' } }), undefined);
  assert.equal(sfEventLandmark({ ...base, venue: 'Anywhere', location: { ...location, lat: 0, lng: 0 } }), undefined);
  assert.equal(sfEventLandmark({ ...base, region: 'east-bay' }), undefined);
});
