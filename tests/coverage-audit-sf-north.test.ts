import assert from 'node:assert/strict';
import test from 'node:test';
import events from '../src/data/coverage-audit-sf-north-events.json';
import translations from '../src/data/coverage-audit-sf-north-en.json';
import { COVERAGE_AUDIT_SF_NORTH_PLANNING as facts, COVERAGE_AUDIT_SF_NORTH_SCHEDULES as schedules } from '../src/data/coverage-audit-sf-north-planning';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { eventsOnCalendarDay, groupCalendarMapEvents } from '../src/lib/event-calendar';
import { resolveTimeEvidence } from '../src/lib/planner-hours';
import { loadLocale, translateText } from '../src/i18n/locale';
import { plannerNoticeText } from '../src/lib/planner-copy';
import { filterMonthlyEvents } from '../src/lib/monthly';

test('six coverage additions are integrated once, with matching official dates, planner facts and illustrations', () => {
  assert.equal(events.length, 6);
  assert.equal(new Set(events.map(event => event.id)).size, 6);
  for (const event of events) {
    assert.equal(MONTHLY_EVENTS.filter(row => row.id === event.id).length, 1, event.id);
    const planned = PLANNER_EVENTS.find(row => row.id === event.id)!;
    assert.ok(planned, event.id);
    assert.equal(planned.region, event.city === 'Sausalito' ? 'north-bay' : 'sf');
    assert.equal(planned.planning?.admissionUsd, facts[event.id].admissionUsd);
    assert.equal(planned.planning?.schedule?.sourceUrl, event.officialUrl);
    assert.equal(schedules[event.id].verifiedAt, '2026-09-29');
    if (!facts[event.id].programTimeUnconfirmed) assert.deepEqual(Object.keys(schedules[event.id].dates!), event.occurrenceDates);
    assert.equal(GUIDE_IMAGES[event.imageKey].kind, 'illustration');
    for (const date of event.occurrenceDates) {
      assert.equal(eventsOnCalendarDay([planned], date).length, 1);
      assert.equal(resolveTimeEvidence(schedules[event.id], date, '2026-09-29').status, facts[event.id].programTimeUnconfirmed ? 'unknown' : 'confirmed');
    }
  }
  assert.deepEqual(groupCalendarMapEvents(PLANNER_EVENTS.filter(row => events.some(event => event.id === row.id))).unmapped, []);
});

test('free street entry, paid tasting, member prices and unknown admission keep distinct budget boundaries', () => {
  const toast = MONTHLY_EVENTS.find(row => row.id === 'sausalito-toast-street-fair-oct17-2026')!;
  const nexus = MONTHLY_EVENTS.find(row => row.id === 'sf-nexus-party-oct1-2026')!;
  const flea = MONTHLY_EVENTS.find(row => row.id === 'sf-inner-sunset-flea-oct11-2026')!;
  assert.equal(toast.cost, 'mixed');
  assert.equal(facts[toast.id].admissionUsd, 0);
  assert.equal(facts[toast.id].minAge, undefined, 'family street fair must not inherit an alcohol-only age restriction');
  assert.equal(facts[nexus.id].admissionUsd, 25, 'member-only $20 must not be a universal budget');
  assert.equal(facts[nexus.id].minAge, undefined, 'do not infer an unpublished age restriction');
  assert.equal(flea.cost, 'unknown');
  assert.equal(facts[flea.id].admissionUsd, null);
  const freeIds = new Set(filterMonthlyEvents([toast, nexus, flea], { cost: 'free' }, '2026-09-29').map(event => event.id));
  assert.ok(!freeIds.has(nexus.id));
  assert.ok(!freeIds.has(flea.id));
  // The street fair itself is free to walk into (G17: 免费 means free to attend); the tasting wristband stays on the price line.
  assert.ok(freeIds.has(toast.id));
  assert.match(toast.costLabel, /品饮手环 \$40/);
});

test('Fall Show respects shorter Sunday hours and excludes the separate gala', () => {
  const event = MONTHLY_EVENTS.find(row => row.id === 'sf-fall-show-oct15-18-2026')!;
  assert.equal(event.cost, 'paid');
  assert.equal(facts[event.id].admissionUsd, null);
  assert.equal(eventsOnCalendarDay([event], '2026-10-14').length, 0);
  assert.equal(eventsOnCalendarDay([event], '2026-10-19').length, 0);
  assert.deepEqual(schedules[event.id].dates!['2026-10-15'], [{ open: '10:30', close: '19:00' }]);
  assert.deepEqual(schedules[event.id].dates!['2026-10-18'], [{ open: '11:00', close: '17:00' }]);
});

test('Potrero remains discoverable while conflicting official end times stay unknown to planning', () => {
  const event = MONTHLY_EVENTS.find(row => row.id === 'sf-potrero-hill-festival-oct17-2026')!;
  assert.equal(eventsOnCalendarDay([event], '2026-10-17').length, 1);
  assert.equal(event.cost, 'unknown');
  assert.equal(facts[event.id].admissionUsd, null);
  assert.equal(facts[event.id].programTimeUnconfirmed, true);
  assert.equal(schedules[event.id].dates, undefined);
  assert.equal(schedules[event.id].sessions, undefined);
  assert.equal(resolveTimeEvidence(schedules[event.id], '2026-10-17', '2026-09-29').status, 'unknown');
  assert.match(schedules[event.id].note!, /17:00/);
  assert.match(schedules[event.id].note!, /16:00/);
});

test('every new Chinese statement and planner note has English with numeric conditions intact', async () => {
  await loadLocale('en');
  const dictionary = translations as Record<string, string>;
  const visit = (value: unknown) => {
    if (typeof value === 'string' && /[\u3400-\u9fff]/.test(value)) {
      assert.ok(dictionary[value], value);
      assert.doesNotMatch(translateText(value, 'en'), /[\u3400-\u9fff]/, value);
      for (const number of value.match(/\d+(?:[:/.]\d+)*/g) || []) {
        // English conventional date order uses October 18 instead of 10 月 18 日.
        if (!/月/.test(value)) assert.ok(dictionary[value].includes(number), value);
      }
    } else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(events);
  for (const schedule of Object.values(schedules)) {
    visit(schedule.note);
    assert.doesNotMatch(plannerNoticeText(schedule.note!, true), /[\u3400-\u9fff]/);
  }
});
