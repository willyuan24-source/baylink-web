import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANNER_PLACES } from '../src/data/planner-catalog';
import { PLANNER_NEIGHBORHOOD_STOPS } from '../src/data/planner-neighborhood-stops';
import { buildPlaceOutingOptions } from '../src/lib/planner-outings';
import { buildItinerary } from '../src/lib/planner-itinerary';
import { resolveTimeEvidence } from '../src/lib/planner-hours';
import { distanceKm } from '../src/lib/planner';

const asOf = '2026-09-29';
const regions = ['sf', 'east-bay', 'south-bay', 'north-bay', 'peninsula'];

for (const date of ['2026-10-03', '2026-10-04', '2026-10-07']) {
  test(`${date}: each Bay Area region has two real anchors for a three-stop half-day walking draft`, () => {
    for (const region of regions) {
      const choices = PLANNER_PLACES.filter(place => place.region === region).flatMap(place => {
        const option = buildPlaceOutingOptions({ placeId: place.id, date, filters: { date, travelMode: 'walk' }, asOf })
          .find(outing => outing.style === 'half-day' && outing.stops.length >= 3);
        return option ? [{ anchor: place, option }] : [];
      });
      const uniqueSequences = new Set(choices.map(({ option }) => option.stops.map(stop => `${stop.kind}:${stop.id}`).join('|')));
      assert.ok(uniqueSequences.size >= 2, `${region}: fewer than two distinct stop sequences`);
      const defaultSequences = new Set(PLANNER_PLACES.filter(place => place.region === region).flatMap(place =>
        buildPlaceOutingOptions({ placeId: place.id, date, filters: { date }, asOf })
          .filter(option => option.style === 'half-day' && option.stops.length >= 2)
          .map(option => option.stops.map(stop => `${stop.kind}:${stop.id}`).join('|'))));
      assert.ok(defaultSequences.size >= 2, `${region}: fewer than two half-day sequences with the default travel allowance`);
      for (const { anchor, option } of choices) {
        const places = option.stops.map(stop => PLANNER_PLACES.find(place => place.id === stop.id)!);
        assert.ok(places.every(place => place?.city === anchor.city));
        assert.ok(places.some(place => place.id === anchor.id));
        assert.ok(places.every(place => place.location?.precision === 'venue'));
        assert.ok(places.every(place => resolveTimeEvidence(place.planning?.schedule, date, asOf).status === 'confirmed'));
        assert.ok(places.every((place, index) => !index || distanceKm(places[index - 1].location!, place.location!) <= 2));
        const itinerary = buildItinerary(option.stops, option.details, date, asOf);
        assert.deepEqual(itinerary.issues, [], `${anchor.id}: ${itinerary.issues.join('; ')}`);
        assert.ok(itinerary.duration <= 240);
        assert.match(option.notices.join(' '), /预留缓冲/);
      }
    }
  });
}

test('new source records retain closures, last admission and unconfirmed spending', () => {
  const museum = PLANNER_NEIGHBORHOOD_STOPS.find(place => place.id === 'venue-san-mateo-history-museum')!;
  assert.equal(resolveTimeEvidence(museum.planning?.schedule, '2026-10-05', asOf).status, 'closed');
  const museumSaturday = resolveTimeEvidence(museum.planning?.schedule, '2026-10-03', asOf);
  assert.ok(museumSaturday.status === 'confirmed' && museumSaturday.kind === 'hours');
  assert.equal(museumSaturday.windows[0].lastEntry, '15:45');
  assert.equal(museum.planning?.admissionUsd, null, 'mixed ticket categories must not become a single price for everyone');
  const library = PLANNER_NEIGHBORHOOD_STOPS.find(place => place.id === 'venue-redwood-city-library')!;
  assert.equal(resolveTimeEvidence(library.planning?.schedule, '2026-10-19', asOf).status, 'closed');
  for (const place of PLANNER_NEIGHBORHOOD_STOPS.filter(place => ['restaurant', 'cafe', 'shop'].includes(place.category!))) {
    assert.equal(place.planning?.admissionUsd, null, `${place.id}: purchases are not known to be free`);
  }
});
