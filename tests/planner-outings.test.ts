import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { buildOutingOptions, buildPlaceOutingOptions, type OutingCatalog } from '../src/lib/planner-outings';
import type { PlannerEvent, PlannerPlace, PlanningSchedule, Suggestion } from '../src/lib/planner';
import { resolveTimeEvidence } from '../src/lib/planner-hours';
import { buildItinerary } from '../src/lib/planner-itinerary';

const date = '2026-10-03';
const asOf = '2026-09-29';
const point = { lat: 37.79, lng: -122.4, precision: 'venue' as const, label: 'Verified venue', sourceUrl: 'https://example.com/venue' };
const schedule = (patch: Partial<PlanningSchedule> = {}): PlanningSchedule => ({ sourceUrl: 'https://example.com/hours', verifiedAt: asOf, dates: { [date]: [{ open: '08:00', close: '22:00' }] }, ...patch });
const anchor = (patch: Partial<PlannerEvent> = {}): PlannerEvent => ({ ...PLANNER_EVENTS[0], id: 'fixture-anchor', title: 'Published main event', city: 'San Francisco', region: 'sf', startDate: date, endDate: date, occurrenceDates: [date], cost: 'free', category: 'family', location: point, planning: { admissionUsd: 0, schedule: schedule() }, ...patch });
const place = (id: string, category: PlannerPlace['category'] = 'attraction', patch: Partial<PlannerPlace> = {}): PlannerPlace => ({ id, title: id, city: 'San Francisco', region: 'sf', summary: 'Published place', guideSlug: id, officialUrl: 'https://example.com/place', cost: 'free', category, location: { ...point, lat: point.lat + 0.002 }, planning: { admissionUsd: 0, schedule: schedule() }, ...patch });
const suggestion: Suggestion = { id: 'fixture-suggestion', eventId: 'fixture-anchor', date, placeIds: [], reason: 'Published event', reasons: [], unknowns: [] };
const sources = (events = [anchor()], places = [place('museum'), place('lunch', 'restaurant'), place('coffee', 'cafe'), place('shop', 'shop')]): OutingCatalog => ({ events, places });

test('place-led outings keep their real place identity and require distinct useful stops', () => {
  for (const category of ['restaurant', 'cafe', 'shop', 'attraction'] as const) {
    const first = place('anchor-place', category, { location: point, openingStatus: 'soft_open', planning: { admissionUsd: null, schedule: schedule() } });
    const data = sources([], [first, place('museum'), place('coffee', 'cafe'), place('shop', 'shop')]);
    const before = structuredClone(data);
    const options = buildPlaceOutingOptions({ placeId: first.id, date, filters: {}, asOf }, data);
    assert.ok(options.length, category);
    assert.ok(options.every(option => option.stops.length >= 2 && option.stops.every(stop => stop.kind === 'place') && option.stops.filter(stop => stop.id === first.id).length === 1));
    assert.match(options[0].notices.join(' '), /主地点费用仍待核实/);
    assert.match(options[0].notices.join(' '), /试营业/);
    assert.deepEqual(data, before);
    assert.deepEqual(buildPlaceOutingOptions({ placeId: first.id, date, filters: {}, asOf }, sources([], [first])), []);
  }
});

test('place anchors cannot be fabricated from missing hours, approximate locations or announced opening dates', () => {
  for (const patch of [{ location: undefined }, { location: { ...point, precision: 'area' as const } }, { planning: { admissionUsd: 0 } }, { planning: { admissionUsd: 0, schedule: schedule({ verifiedAt: '2026-07-01' }) } }, { openingStatus: 'announced' as const }, { openedOn: '2026-10-10' }, { planning: { admissionUsd: 0, schedule: schedule({ dates: { [date]: [] } }) } }]) {
    const data = sources([], [place('anchor-place', 'attraction', { location: point, ...patch }), place('cafe', 'cafe')]);
    assert.deepEqual(buildPlaceOutingOptions({ placeId: 'anchor-place', date, filters: {}, asOf }, data), [], JSON.stringify(patch));
  }
});

test('place anchors honor free-only, age and exact city constraints without treating restaurant spending as free', () => {
  const data = sources([], [place('restaurant', 'restaurant', { location: point }), place('coffee', 'cafe')]);
  for (const filters of [{ freeOnly: true }, { budget: 0 }, { city: 'South San Francisco' }]) assert.deepEqual(buildPlaceOutingOptions({ placeId: 'restaurant', date, filters, asOf }, data), []);
  data.places[0].planning!.minAge = 18;
  assert.deepEqual(buildPlaceOutingOptions({ placeId: 'restaurant', date, filters: { childAges: [8, 16] }, asOf }, data), []);
});

test('real Ferry Building restaurant can anchor a timed plan without requiring a scheduled event', () => {
  const options = buildPlaceOutingOptions({ placeId: 'restaurant-gotts-ferry-building', date, filters: { city: 'San Francisco', partySize: 2 }, asOf });
  assert.ok(options.length);
  for (const option of options) {
    assert.ok(option.stops.every(stop => stop.kind === 'place'));
    assert.deepEqual(buildItinerary(option.stops, option.details, date, asOf).issues, []);
  }
});

test('complete options contain actual distinct stops, a meal stop and editable cost placeholders', () => {
  const data = sources();
  const options = buildOutingOptions({ suggestion, filters: { partySize: 2 }, asOf }, data);
  assert.ok(options.length > 0);
  assert.ok(options.some(option => option.style === 'full-day'));
  for (const option of options) {
    assert.ok(option.stops.length >= 2 && option.stops.length <= 6);
    assert.equal(new Set(option.stops.map(stop => `${stop.kind}:${stop.id}`)).size, option.stops.length);
    assert.equal(option.stops.filter(stop => stop.kind === 'event').length, 1);
    assert.ok(option.stops.some(stop => stop.id === 'lunch'));
    assert.deepEqual(option.details.costBreakdown, { foodUsd: 0, transportUsd: 0, otherUsd: 0 });
    assert.equal(option.details.extraCostUsd, 0);
    assert.match(option.notices.join(' '), /不表示这些消费免费/);
    assert.match(option.notices.join(' '), /不是已核实的路线/);
    assert.equal(option.details.constraints?.partySize, 2);
  }
  assert.notDeepEqual(options[0].stops, options.at(-1)!.stops);
});

test('unknown, approximate or other-city coordinates never get inserted as on-the-way stops', () => {
  for (const destination of [place('unknown', 'attraction', { location: undefined }), place('area', 'attraction', { location: { ...point, precision: 'area' } }), place('across-bay', 'attraction', { city: 'Alameda' })]) {
    assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf }, sources([anchor()], [destination])), []);
  }
  assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf }, sources([anchor({ location: undefined })])), []);
  assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf }, sources([anchor()], [place('alcatraz', 'attraction')])), []);
});

test('same-city spelling variants retain verified nearby places without broadening to another city', () => {
  const data = sources([anchor({ city: 'San José' })], [place('sj-museum', 'attraction', { city: 'San Jose' }), place('other', 'attraction', { city: 'Santa Clara' })]);
  const options = buildOutingOptions({ suggestion, filters: { city: 'San Jose' }, asOf }, data);
  assert.ok(options.length > 0);
  assert.ok(options.every(option => option.stops.some(stop => stop.id === 'sj-museum') && !option.stops.some(stop => stop.id === 'other')));
});

test('closed, unavailable or stale opening evidence cannot be used for automatic secondary stops', () => {
  const rejected = [
    place('unknown-hours', 'attraction', { planning: { admissionUsd: 0 } }),
    place('closed', 'attraction', { planning: { admissionUsd: 0, schedule: schedule({ dates: { [date]: [] } }) } }),
    place('too-short', 'attraction', { planning: { admissionUsd: 0, schedule: schedule({ dates: { [date]: [{ open: '11:00', close: '11:20' }] } }) } }),
    place('stale', 'attraction', { planning: { admissionUsd: 0, schedule: schedule({ verifiedAt: '2026-07-01' }) } }),
    place('announced', 'restaurant', { openingStatus: 'announced' }),
    place('future-opening', 'cafe', { openedOn: '2026-10-04' }),
  ];
  for (const destination of rejected) assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf }, sources([anchor()], [destination])), [], destination.id);
});

test('the main event retains its exact official session instead of being moved to fit extra stops', () => {
  const event = anchor({ planning: { admissionUsd: 0, schedule: schedule({ dates: undefined, sessions: [{ date, start: '14:00', end: '15:00' }] }) } });
  const options = buildOutingOptions({ suggestion, filters: {}, asOf }, sources([event]));
  assert.ok(options.length > 0);
  for (const option of options) {
    const settings = option.details.stopSettings.find(stop => stop.kind === 'event')!;
    assert.equal(settings.fixedStartTime, '14:00');
    assert.equal(settings.durationMinutes, 60);
    assert.ok(option.details.startTime <= '14:00');
  }
  const exhausted = anchor({ occurrenceDates: [], planning: event.planning });
  assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf }, sources([exhausted])), []);
});

test('an event with unconfirmed timing stays explicitly tentative instead of acquiring invented hours', () => {
  const options = buildOutingOptions({ suggestion, filters: {}, asOf }, sources([anchor({ planning: { admissionUsd: 0 } })]));
  assert.ok(options.length > 0);
  assert.ok(options.every(option => option.notices.some(notice => /主活动尚无可用的官方时段/.test(notice))));
});

test('sum of known admissions stays under per-person and group caps, and unknown costs stay visible', () => {
  const paid = anchor({ cost: 'paid', planning: { admissionUsd: 20, schedule: schedule() } });
  const ten = place('ten', 'attraction', { cost: 'paid', planning: { admissionUsd: 10, schedule: schedule() } });
  for (const filters of [{ budget: 25, budgetScope: 'person' as const, partySize: 4 }, { budget: 100, budgetScope: 'total' as const, partySize: 4 }]) {
    assert.deepEqual(buildOutingOptions({ suggestion, filters, asOf }, sources([paid], [ten])), []);
    const options = buildOutingOptions({ suggestion, filters, asOf }, sources([paid], [place('free')]));
    assert.ok(options.length > 0);
    assert.equal(options[0].details.totalBudgetUsd, filters.budgetScope === 'total' ? 100 : null);
  }
  const unknown = anchor({ cost: 'unknown', planning: { admissionUsd: null, schedule: schedule() } });
  const options = buildOutingOptions({ suggestion: { ...suggestion, budgetStatus: 'unknown' }, filters: { budget: 25 }, asOf }, sources([unknown], [place('free')]));
  assert.ok(options.length > 0);
  assert.match(options[0].notices.join(' '), /备选.*不能视为整趟符合预算/);
  const unpriced = place('unpriced', 'attraction', { cost: 'unknown', planning: { admissionUsd: null, schedule: schedule() } });
  assert.deepEqual(buildOutingOptions({ suggestion, filters: { budget: 25 }, asOf }, sources([anchor()], [unpriced])), []);
});

test('free-only and every supplied child age constrain every added stop', () => {
  const options = buildOutingOptions({ suggestion, filters: { freeOnly: true, childAges: [5, 12] }, asOf }, sources([anchor()], [
    place('free'),
    place('paid', 'attraction', { cost: 'paid', planning: { admissionUsd: 10, schedule: schedule() } }),
    place('age-limited', 'attraction', { planning: { admissionUsd: 0, maxAge: 10, schedule: schedule() } }),
    place('adult-only', 'attraction', { planning: { admissionUsd: 0, minAge: 18, schedule: schedule() } }),
    place('paid-food', 'restaurant'),
  ]));
  assert.ok(options.length > 0);
  assert.ok(options.every(option => option.stops.filter(stop => stop.kind === 'place').every(stop => stop.id === 'free')));
  assert.deepEqual(buildOutingOptions({ suggestion, filters: { childAges: [5, 12] }, asOf }, sources([anchor({ planning: { minAge: 18, schedule: schedule() } })])), []);
});

test('missing restaurants keep meals pending without inventing a restaurant or forcing a short outing to take a meal break', () => {
  const options = buildOutingOptions({ suggestion, filters: {}, asOf }, sources([anchor()], [place('museum')]));
  assert.ok(options.length > 0);
  for (const option of options) {
    assert.ok(option.details.stopSettings.every(settings => !settings.breakBeforeMinutes));
    assert.match(option.notices.join(' '), /餐厅.*待选|餐厅.*待选择/);
    assert.deepEqual(option.stops.map(stop => stop.id).sort(), ['fixture-anchor', 'museum']);
  }
});

test('flexible evening hours can follow later dinner, and short late visits need no forced meal break', () => {
  const evening = anchor({ planning: { admissionUsd: 0, schedule: schedule({ dates: { [date]: [{ open: '18:00', close: '22:00' }] } }) } });
  const dinner = place('late-dinner', 'restaurant', { planning: { admissionUsd: null, schedule: schedule({ dates: { [date]: [{ open: '19:00', close: '20:00' }] } }) } });
  const options = buildOutingOptions({ suggestion, filters: { travelMode: 'walk' }, asOf }, sources([evening], [dinner]));
  assert.ok(options.length > 0);
  assert.deepEqual(options[0].stops.map(stop => stop.id), ['late-dinner', 'fixture-anchor']);
  assert.equal(options[0].details.stopSettings.find(stop => stop.kind === 'event')?.fixedStartTime, '20:30');
  const lateEvent = anchor({ planning: { admissionUsd: 0, schedule: schedule({ dates: undefined, sessions: [{ date, start: '21:00', end: '22:00' }] }) } });
  const latePlace = place('late-visit', 'attraction', { planning: { admissionUsd: 0, schedule: schedule({ dates: { [date]: [{ open: '22:00', close: '23:59' }] } }) } });
  const lateOptions = buildOutingOptions({ suggestion, filters: { travelMode: 'walk' }, asOf }, sources([lateEvent], [latePlace]));
  assert.ok(lateOptions.length > 0);
  assert.equal(lateOptions[0].details.finishBy, '23:30');
  assert.ok(lateOptions[0].details.stopSettings.every(stop => !stop.breakBeforeMinutes));
});

test('a restaurant cannot be added after its last order even when its doors remain open', () => {
  const event = anchor({ planning: { admissionUsd: 0, schedule: schedule({ dates: undefined, sessions: [{ date, start: '16:00', end: '17:00' }] }) } });
  const restaurant = place('early-last-order', 'restaurant', { planning: { admissionUsd: null, schedule: schedule({ dates: { [date]: [{ open: '17:00', close: '22:00', lastOrder: '17:15' }] } }) } });
  assert.deepEqual(buildOutingOptions({ suggestion, filters: { travelMode: 'walk' }, asOf }, sources([event], [restaurant])), []);
});

test('clock evaluation remains deterministic with asOf and returns no renamed single-stop outing', () => {
  const data = sources();
  assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf }, data), buildOutingOptions({ suggestion, filters: {}, asOf }, data));
  assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf: '2026-10-04' }, data), []);
  assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf }, sources([anchor()], [])), []);
  assert.equal(resolveTimeEvidence(schedule(), date, asOf).status, 'confirmed');
});

test('unstructured negative preferences prevent automatic additions while supported no-driving and budget ceilings remain usable', () => {
  const data = sources();
  for (const message of ['不要亲子活动', '不要音乐，想看脱口秀', 'avoid crowded places', 'no family events', 'without children activities', 'not outdoors', '不想去商店']) assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, message, asOf }, data), [], message);
  for (const message of ['不开车', '不想开车', 'no driving', 'without a car', 'budget not more than $100', '预算不超过100']) assert.ok(buildOutingOptions({ suggestion, filters: {}, message, asOf }, data).length > 0, message);
});

test('evening opening windows produce an evening visit and preserve the source qualification', () => {
  const evening = anchor({ planning: { admissionUsd: 0, schedule: schedule({ dates: { [date]: [{ open: '18:00', close: '22:00' }] }, note: 'Program sessions have separate times.' }) } });
  const options = buildOutingOptions({ suggestion, filters: {}, asOf }, sources([evening], [place('dinner', 'restaurant')]));
  assert.ok(options.length > 0);
  assert.equal(options[0].details.stopSettings.find(stop => stop.kind === 'event')?.fixedStartTime, '18:00');
  assert.match(options[0].notices.join(' '), /不代表.*官方开演/);
  assert.ok(options[0].notices.includes('Program sessions have separate times.'));
});

test('the same attraction cannot be a second visit to the anchor, while its restaurant can remain', () => {
  const colocated = { ...point, lat: point.lat + 0.0001 };
  const options = buildOutingOptions({ suggestion, filters: {}, asOf }, sources([anchor()], [
    place('same-museum', 'attraction', { location: colocated }),
    place('inside-restaurant', 'restaurant', { location: colocated }),
  ]));
  assert.ok(options.length > 0);
  assert.ok(options.every(option => option.stops.some(stop => stop.id === 'inside-restaurant') && !option.stops.some(stop => stop.id === 'same-museum')));
});

test('a main program with unknown show times is not reduced to a visit during broader venue hours', () => {
  const event = anchor({ planning: { admissionUsd: 0, schedule: schedule(), programTimeUnconfirmed: true } });
  assert.deepEqual(buildOutingOptions({ suggestion, filters: {}, asOf }, sources([event])), []);
});

test('the real Ferry catalog supports a shorter market meal and a full day with an independent museum', () => {
  const eventId = 'ferry-plaza-farmers-market-2026-autumn';
  const options = buildOutingOptions({ suggestion: { ...suggestion, eventId }, filters: { date, travelMode: 'walk', partySize: 2 }, asOf });
  const half = options.find(option => option.style === 'half-day');
  const full = options.find(option => option.style === 'full-day');
  assert.ok(half);
  assert.ok(full);
  assert.ok(half.stops.length < full.stops.length);
  assert.ok(full.stops.some(stop => stop.id === 'restaurant-gotts-ferry-building'));
  assert.ok(full.stops.some(stop => stop.id === 'venue-exploratorium-daytime'));
  for (const option of options) {
    const itinerary = buildItinerary(option.stops, option.details, date, asOf);
    assert.deepEqual(itinerary.issues, []);
    assert.ok(option.style === 'half-day' ? itinerary.duration <= 240 : itinerary.duration >= 300 && itinerary.duration <= 600);
    assert.match(option.notices.join(' '), /入场金额待确认|费用.*填写/);
  }
});

test('real museum events retain one venue visit and unconfirmed show times fall back to the single event', () => {
  const cases = [
    ['sf-exploratorium-after-dark-01-oct2026', '2026-10-01', 'venue-exploratorium-daytime', 'restaurant-gotts-ferry-building'],
    ['oakland-omca-dia-muertos-2026', '2026-10-25', 'venue-omca', 'restaurant-town-fare-omca'],
  ];
  for (const [eventId, visitDate, duplicateVenueId, restaurantId] of cases) {
    const options = buildOutingOptions({ suggestion: { ...suggestion, eventId, date: visitDate }, filters: { date: visitDate, travelMode: 'walk', partySize: 2 }, asOf });
    assert.ok(options.length > 0, eventId);
    for (const option of options) {
      assert.ok(option.stops.some(stop => stop.id === restaurantId));
      assert.ok(option.stops.every(stop => stop.id !== duplicateVenueId));
      assert.deepEqual(buildItinerary(option.stops, option.details, visitDate, asOf).issues, []);
    }
  }
  assert.deepEqual(buildOutingOptions({ suggestion: { ...suggestion, eventId: 'san-jose-first-friday-ballet-2026', date: '2026-10-02' }, filters: {}, asOf }), []);
});
