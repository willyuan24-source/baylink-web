import assert from 'node:assert/strict';
import test from 'node:test';
import records from '../src/data/october-refresh-community-events.json';
import english from '../src/data/october-refresh-community-en.json';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { OCTOBER_REFRESH_COMMUNITY_PLANNING as facts, OCTOBER_REFRESH_COMMUNITY_SCHEDULES as schedules, OCTOBER_REFRESH_COMMUNITY_ICS as ics } from '../src/data/october-refresh-community-planning';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { eventOccursOn } from '../src/lib/event-calendar';
import { resolveTimeEvidence } from '../src/lib/planner-hours';
import { buildOutingOptions } from '../src/lib/planner-outings';
import type { PlannerEvent, PlannerPlace } from '../src/lib/planner';

const events = records as MonthlyEvent[];
test('nine independently verified community events have exact occurrence dates, source links and valid imagery', () => {
  assert.equal(events.length, 9);
  assert.equal(new Set(events.map(event => event.id)).size, 9);
  for (const event of events) {
    assert.equal(event.verifiedAt, '2026-09-30');
    assert.deepEqual(event.occurrenceDates, [event.startDate]);
    assert.equal(event.startDate, event.endDate);
    assert.ok(GUIDE_IMAGES[event.imageKey]);
    assert.ok(eventOccursOn(event, event.startDate));
    assert.ok(!eventOccursOn(event, '2026-11-01'));
    if (!facts[event.id].programTimeUnconfirmed) assert.deepEqual(Object.keys(schedules[event.id].dates!), event.occurrenceDates);
    assert.equal(schedules[event.id].sourceUrl, event.officialUrl);
    assert.equal(resolveTimeEvidence(schedules[event.id], event.startDate, '2026-09-30').status, facts[event.id].programTimeUnconfirmed ? 'unknown' : 'confirmed');
    assert.equal(facts[event.id].admissionUsd, event.cost === 'free' ? 0 : null);
  }
});

test('SFPL UTC calendar timestamps convert to the actual Bay Area day and hour, including overnight UTC endings', () => {
  const officialUtc = [
    ['sfpl-ocean-view-stem-oct8-2026', '2026-10-08T22:30:00Z', '2026-10-08T23:30:00Z'],
    ['sfpl-richmond-lego-oct7-2026', '2026-10-07T23:00:00Z', '2026-10-08T00:30:00Z'],
    ['sfpl-career-coaching-oct8-2026', '2026-10-08T18:00:00Z', '2026-10-08T20:00:00Z'],
    ['sfpl-writing-gravity-oct8-2026', '2026-10-09T01:00:00Z', '2026-10-09T02:15:00Z'],
    ['sfpl-western-addition-open-house-oct24-2026', '2026-10-24T19:00:00Z', '2026-10-24T23:00:00Z'],
    ['sfpl-omi-history-day-oct17-2026', '2026-10-17T22:00:00Z', '2026-10-18T00:00:00Z'],
    ['sfpl-garden-green-bin-oct10-2026', '2026-10-10T18:00:00Z', '2026-10-10T19:30:00Z'],
  ];
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (const [id, start, end] of officialUtc) {
    const event = events.find(row => row.id === id)!;
    assert.match(ics[id], /^https:\/\/sfpl\.org\/sfpl-events\/add-to-calendar\/\d+$/);
    if (facts[id].programTimeUnconfirmed) {
      assert.match(schedules[id].note!, /11:00–13:00/);
      assert.equal(`${format.format(new Date(start))}–${format.format(new Date(end))}`, '11:00–13:00');
      assert.equal(schedules[id].dates, undefined, 'a service window cannot become an individual appointment');
    } else assert.deepEqual(schedules[id].dates![event.startDate], [{ open: format.format(new Date(start)), close: format.format(new Date(end)) }]);
  }
});

test('unconfirmed fees, age requirements, appointment length and public reception stay honest', () => {
  for (const id of ['sfpl-ocean-view-stem-oct8-2026', 'sfpl-richmond-lego-oct7-2026', 'sfpl-garden-green-bin-oct10-2026']) {
    assert.equal(events.find(row => row.id === id)!.cost, 'unknown');
    assert.equal(facts[id].admissionUsd, null);
  }
  assert.equal(facts['sfpl-ocean-view-stem-oct8-2026'].minAge, 3);
  assert.equal(facts['sfpl-richmond-lego-oct7-2026'].minAge, 5);
  assert.equal(facts['sfpl-career-coaching-oct8-2026'].reservation, 'required');
  assert.match(schedules['sfpl-career-coaching-oct8-2026'].note!, /30 分钟/);
  assert.equal(facts['palo-alto-pet-palooza-oct17-2026'].reservation, 'required');
  assert.deepEqual(schedules['palo-alto-art-center-reception-oct2-2026'].dates!['2026-10-02'], [{ open: '18:00', close: '20:00' }]);
});

test('all Chinese editorial text and planning notes have independent English translations', () => {
  const dictionary = english as Record<string, string>;
  const visit = (value: unknown) => {
    if (typeof value === 'string' && /[\u3400-\u9fff]/.test(value)) {
      assert.ok(dictionary[value], value);
      assert.doesNotMatch(dictionary[value], /[\u3400-\u9fff]/);
    } else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(events);
  visit(Object.values(schedules).map(schedule => schedule.note));
});

test('career coaching cannot auto-compose a 90-minute visit from the two-hour appointment window', () => {
  const id = 'sfpl-career-coaching-oct8-2026';
  const event = events.find(row => row.id === id)!;
  // Give the fixture precise venue coordinates so missing coordinates cannot hide the timing defect.
  const location = { lat: 37.79, lng: -122.4, precision: 'venue' as const, label: 'Test venue', sourceUrl: 'https://example.com/test-venue' };
  const anchor: PlannerEvent = { ...event, location, planning: { ...facts[id], schedule: schedules[id] } };
  const nearby: PlannerPlace[] = [1, 2].map(index => ({ id: `fixture-nearby-${index}`, title: 'Nearby test stop', city: event.city, region: event.region, summary: 'Test stop', guideSlug: 'test-stop', cost: 'free', category: 'attraction', location: { ...location, lat: location.lat + index * 0.002 }, planning: { admissionUsd: 0, schedule: { sourceUrl: location.sourceUrl, verifiedAt: '2026-09-30', dates: { [event.startDate]: [{ open: '09:00', close: '18:00' }] } } } }));
  const input = { suggestion: { id: 'test-suggestion', eventId: id, date: event.startDate, placeIds: [], reason: '', reasons: [], unknowns: [] }, filters: {}, asOf: '2026-09-30' };
  const unsafeAnchor = { ...anchor, planning: { ...anchor.planning, programTimeUnconfirmed: false, schedule: { ...schedules[id], dates: { [event.startDate]: [{ open: '11:00', close: '13:00' }] } } } };
  assert.ok(buildOutingOptions(input, { events: [unsafeAnchor], places: nearby }).length > 0, 'fixture exposes the old automatic-window behavior');
  assert.deepEqual(buildOutingOptions(input, { events: [anchor], places: nearby }), []);
  assert.equal(resolveTimeEvidence(anchor.planning?.schedule, event.startDate, '2026-09-30').status, 'unknown');
  assert.equal(anchor.planning?.reservation, 'required');
  assert.match(anchor.planning!.schedule!.note!, /实际每次咨询 30 分钟/);
});
