import assert from 'node:assert/strict';
import test from 'node:test';
import { SEPTEMBER_REFRESH_PLANNING as facts, SEPTEMBER_REFRESH_SCHEDULES as schedules } from '../src/data/september-refresh-planning';
import regionalEvents from '../src/data/september-refresh-regional-events.json';
import sfEastEvents from '../src/data/september-refresh-sf-east-events.json';
import english from '../src/data/september-refresh-planning-en.json';
import { resolveStopTiming, resolveTimeEvidence } from '../src/lib/planner-hours';

const events = [...regionalEvents, ...sfEastEvents];
const asOf = '2026-09-29';
const evidence = (id: string, date: string) => resolveTimeEvidence(schedules[id], date, asOf);

test('every refresh event has dated source-backed planning facts, without inventing recurring dates', () => {
  const ids = events.map(event => event.id).sort();
  assert.equal(ids.length, 28);
  assert.deepEqual(Object.keys(facts).sort(), ids);
  assert.deepEqual(Object.keys(schedules).sort(), ids);
  for (const event of events) {
    const schedule = schedules[event.id];
    assert.equal(schedule.sourceUrl, event.officialUrl);
    assert.equal(schedule.verifiedAt, asOf);
    assert.equal(schedule.weekly, undefined);
    const actualDays = [...new Set([...Object.keys(schedule.dates ?? {}), ...(schedule.sessions ?? []).map(session => session.date)])].sort();
    assert.deepEqual(actualDays, [...event.occurrenceDates].sort(), event.id);
    for (const date of actualDays) assert.equal(evidence(event.id, date).status, 'confirmed', `${event.id} ${date}`);
    assert.equal(evidence(event.id, '2026-11-01').status, 'out-of-range');
  }
});

test('unknown entry prices and merchandise offers never become zero-dollar or five-dollar admission', () => {
  const unknown = events.filter(event => event.cost === 'unknown');
  assert.equal(unknown.length, 5);
  for (const event of unknown) assert.equal(facts[event.id].admissionUsd, null, event.id);
  assert.equal(facts['sonoma-valley-book-sale-free-child-book-2026'].admissionUsd, null);
  assert.equal(facts['santa-rosa-big-book-sale-discount-days-2026'].admissionUsd, null);
  assert.equal(facts['stanford-halloween-concert-2026'].admissionUsd, 32, 'Student eligibility must not make public admission free');
  assert.equal(facts['mountain-view-oktoberfest-2026'].admissionUsd, 0, 'Optional purchases do not erase officially free entry');
});

test('only whole-event age restrictions are encoded, not alcohol rules or optional sub-activities', () => {
  assert.equal(facts['berkeley-cal-sailing-open-house-oct4-2026'].minAge, 5);
  assert.equal(facts['san-lorenzo-metal-milagros-oct10-2026'].minAge, 8);
  assert.deepEqual(
    [facts['corte-madera-wooden-sugar-skull-painting-2026'].minAge, facts['corte-madera-wooden-sugar-skull-painting-2026'].maxAge],
    [5, 14],
  );
  assert.deepEqual(
    [facts['novato-teen-ai-literacy-escape-room-2026'].minAge, facts['novato-teen-ai-literacy-escape-room-2026'].maxAge],
    [11, 18],
  );
  for (const id of ['berkeley-crowden-community-music-day-oct4-2026', 'mountain-view-oktoberfest-2026', 'sf-halloween-broadside-printing-oct17-2026', 'fairfax-kids-halloween-costume-swap-2026']) {
    assert.equal(facts[id].minAge, undefined, id);
    assert.equal(facts[id].maxAge, undefined, id);
  }
});

test('Art for All requires one real session and does not admit a plan across its lunch gap', () => {
  const id = 'stanford-art-for-all-oct-2026';
  const ev = evidence(id, '2026-10-11');
  assert.equal(facts[id].reservation, 'required');
  assert.equal(ev.kind, 'sessions');
  assert.deepEqual(ev.sessions, [
    { date: '2026-10-11', start: '10:00', end: '12:00' },
    { date: '2026-10-11', start: '13:00', end: '15:00' },
  ]);
  assert.ok(resolveStopTiming(ev, 600, 120).conflicts.some(issue => issue.code === 'session-unselected'));
  assert.ok(resolveStopTiming(ev, 600, 300, '10:00').conflicts.some(issue => issue.code === 'session-overrun'));
  assert.ok(resolveStopTiming(ev, 750, 120, '12:30').conflicts.some(issue => issue.code === 'session-mismatch'));
  const afternoon = resolveStopTiming(ev, 750, 120, '13:00');
  assert.deepEqual([afternoon.start, afternoon.end], [780, 900]);
  assert.equal(afternoon.conflicts.length, 0);
});

test('Water Lantern plans cover the evening lantern experience on the chosen day, not just the early gates', () => {
  const id = 'foster-city-water-lantern-festival-2026';
  assert.equal(facts[id].admissionUsd, null, 'Free festival entry must not price the paid lantern experience at zero');
  assert.equal(facts[id].minAge, undefined, 'The under-8 ticket policy is not a minimum attendance age');
  for (const date of ['2026-10-03', '2026-10-04']) {
    const ev = evidence(id, date);
    assert.equal(ev.kind, 'sessions');
    assert.deepEqual(ev.windows, [{ open: '17:00', close: '21:00' }]);
    assert.deepEqual(ev.sessions, [{ date, start: '19:30', end: '21:00' }]);
    const planned = resolveStopTiming(ev, 17 * 60, 90);
    assert.deepEqual([planned.start, planned.end], [19 * 60 + 30, 21 * 60], 'The default 90-minute visit must include the 20:00 lantern launch');
    assert.equal(planned.conflicts.length, 0);
    assert.ok(resolveStopTiming(ev, 19 * 60 + 31, 90).conflicts.some(issue => issue.code === 'session-missed'));
    assert.match(ev.note!, /17:00.*19:30.*20:00–21:00/);
    assert.match(ev.note!, /免费入场.*须购票.*票价.*待确认/);
  }
  assert.equal(evidence(id, '2026-10-05').status, 'out-of-range');
});

test('Foodwise special market permits flexible visits without treating optional demos as mandatory sessions', () => {
  const id = 'sf-foodwise-latine-makers-oct3-2026';
  assert.equal(facts[id].admissionUsd, 0);
  assert.notEqual(facts[id].reservation, 'required');
  const ev = evidence(id, '2026-10-03');
  assert.equal(ev.kind, 'hours');
  assert.deepEqual(ev.windows, [{ open: '09:00', close: '14:00' }]);
  assert.deepEqual(ev.sessions, []);
  const laterVisit = resolveStopTiming(ev, 12 * 60 + 30, 90);
  assert.deepEqual([laterVisit.start, laterVisit.end], [750, 840]);
  assert.equal(laterVisit.conflicts.length, 0, 'Browsing after the noon demonstration starts must still be allowed');
  assert.match(ev.note!, /餐饮与商品另购.*11:00.*12:00.*结束时刻未公布/);
  assert.equal(evidence(id, '2026-10-04').status, 'out-of-range', 'The regular farmers market must not extend this one-day theme');
});

test('fixed concerts, storytime and crafts cannot silently shift after their published start', () => {
  for (const [id, date, arrival, duration, start] of [
    ['stanford-halloween-concert-2026', '2026-10-30', 1175, 90, 1170],
    ['stanford-noon-guitar-oct-2026', '2026-10-07', 755, 90, 750],
    ['san-lorenzo-banned-books-storytime-oct7-2026', '2026-10-07', 665, 30, 660],
    ['san-lorenzo-metal-milagros-oct10-2026', '2026-10-10', 905, 60, 900],
  ] as const) {
    const result = resolveStopTiming(evidence(id, date), arrival, duration);
    assert.equal(result.start, start, id);
    assert.ok(result.conflicts.some(issue => issue.code === 'session-missed'), id);
  }
});

test('Sonoma and Santa Rosa sale days keep their distinct opening times', () => {
  assert.deepEqual(evidence('sonoma-valley-book-sale-free-child-book-2026', '2026-10-03').windows, [{ open: '11:00', close: '16:00' }]);
  assert.deepEqual(evidence('sonoma-valley-book-sale-free-child-book-2026', '2026-10-04').windows, [{ open: '13:00', close: '16:00' }]);
  assert.deepEqual(evidence('santa-rosa-big-book-sale-discount-days-2026', '2026-10-04').windows, [{ open: '10:00', close: '16:00' }]);
  const monday = evidence('santa-rosa-big-book-sale-discount-days-2026', '2026-10-05');
  const beforeOpening = resolveStopTiming(monday, 720, 60);
  assert.equal(beforeOpening.start, 840);
  assert.equal(beforeOpening.wait, 120);
});

test('open houses retain optional sessions and multi-site/weather limits in source notes', () => {
  const borp = evidence('berkeley-borp-adaptive-sports-expo-oct17-2026', '2026-10-17');
  assert.deepEqual(borp.windows, [{ open: '10:00', close: '15:00' }]);
  assert.equal(borp.sessions.length, 0);
  assert.match(borp.note!, /80 Bolivar Drive.*10:00–13:00/);
  assert.match(borp.note!, /800 Potter Street.*12:00–15:00/);
  assert.match(borp.note!, /15:30–17:30/);
  assert.equal(facts['berkeley-borp-adaptive-sports-expo-oct17-2026'].reservation, 'optional', 'Only transport and climbing mandate advance registration');
  const sailing = evidence('berkeley-cal-sailing-open-house-oct4-2026', '2026-10-04');
  assert.deepEqual(sailing.windows, [{ open: '13:00', close: '15:00', lastEntry: '14:30' }]);
  assert.match(sailing.note!, /13:00–14:30/);
  assert.match(sailing.note!, /强风.*大雨.*潮汐/);
  const crowden = evidence('berkeley-crowden-community-music-day-oct4-2026', '2026-10-04');
  assert.equal(crowden.kind, 'hours');
  assert.equal(crowden.sessions.length, 0, 'Optional short concerts must not fix the entire music-day visit');
});

test('Cal Sailing cannot plan an arrival after on-site registration closes', () => {
  const sailing = evidence('berkeley-cal-sailing-open-house-oct4-2026', '2026-10-04');
  const atDeadline = resolveStopTiming(sailing, 14 * 60 + 30, 30);
  assert.equal(atDeadline.conflicts.length, 0, '14:30 arrival remains at the published registration boundary');
  assert.deepEqual([atDeadline.start, atDeadline.end], [870, 900]);
  const afterDeadline = resolveStopTiming(sailing, 14 * 60 + 45, 15);
  assert.deepEqual(afterDeadline.conflicts.map(issue => issue.code), ['last-entry-missed'], 'A short stay before closing must still fail after registration closes');
  assert.match(sailing.note!, /排队时长未知.*不保证船位与结束时间/, 'Boundary acceptance is not a boat-place or departure guarantee');
});

test('every official schedule note has a complete English translation with its numbers preserved', () => {
  const dictionary = english as Record<string, string>;
  const notes = Object.values(schedules).map(schedule => schedule.note!);
  assert.deepEqual(Object.keys(dictionary).sort(), [...new Set(notes)].sort());
  for (const note of notes) {
    const translated = dictionary[note];
    assert.ok(translated?.trim());
    assert.doesNotMatch(translated, /[\u3400-\u9fff]/);
  }
  assert.match(dictionary[schedules['stanford-halloween-concert-2026'].note!], /\$32.*\$27.*\$4/);
  assert.match(dictionary[schedules['berkeley-cal-sailing-open-house-oct4-2026'].note!], /13:00–14:30.*30 minutes.*at least 5/);
  assert.match(dictionary[schedules['novato-teen-ai-literacy-escape-room-2026'].note!], /11–18/);
});
