import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANNER_PLACES } from '../src/data/planner-catalog';
import { offersForStop } from '../src/lib/planner-offers';
import type { FreebieOffer } from '../src/components/FreebieBoard';

test('venue offers respect the selected day and never attach by a similar brand name', () => {
  const place = PLANNER_PLACES[0];
  const previous = place.offerIds;
  place.offerIds = ['on-day', 'future', 'expired', 'ongoing', 'bad-dates'];
  const offer = (id: string, startDate: string, endDate: string): FreebieOffer => ({ id, brand: place.title, title: 'Conditional entry', dateLabel: 'Check terms', startDate, endDate,
    availability: 'dated', kind: 'reservation', requirement: 'Reservation and matching ID required', description: '', imageKey: '', sourceUrl: 'https://example.org/terms', sourceLabel: 'Official terms' });
  const rows = [offer('on-day', '2026-10-03', '2026-10-03'), offer('future', '2026-10-04', '2026-10-04'), offer('expired', '2026-10-01', '2026-10-02'),
    { ...offer('ongoing', '', ''), availability: 'ongoing' as const }, offer('bad-dates', '2026-10-05', '2026-10-02'), offer('unlinked', '2026-10-03', '2026-10-03')];
  try {
    const found = offersForStop({ kind: 'place', id: place.id }, '2026-10-03', rows, '2026-09-29');
    assert.deepEqual(found.map(item => item.id), ['on-day', 'ongoing']);
    assert.equal(found[0].requirement, 'Reservation and matching ID required');
    assert.deepEqual(offersForStop({ kind: 'event', id: place.id }, '2026-10-03', rows), []);
    assert.deepEqual(offersForStop({ kind: 'place', id: 'unknown-venue' }, '2026-10-03', rows), []);
    assert.deepEqual(offersForStop({ kind: 'place', id: place.id }, '2026-10-04', rows, '2026-09-29').map(item => item.id), ['future', 'ongoing']);
  } finally { if (previous) place.offerIds = previous; else delete place.offerIds; }
});
