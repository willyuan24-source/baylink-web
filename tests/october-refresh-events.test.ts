import assert from 'node:assert/strict';
import test from 'node:test';
import records from '../src/data/october-refresh-events.json';
import english from '../src/data/october-refresh-events-en.json';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { eventOccursOn } from '../src/lib/event-calendar';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { OCTOBER_REFRESH_SCHEDULES as schedules } from '../src/data/october-refresh-planning';
const events = records as MonthlyEvent[];
const find = (id: string) => PLANNER_EVENTS.find(event => event.id === id)!;

test('October additions reach the shared planner once with sources and translated editorial facts', () => {
  assert.equal(events.length, 5);
  const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  for (const event of events) {
    assert.equal(PLANNER_EVENTS.filter(row => row.id === event.id).length, 1);
    assert.equal(event.verifiedAt, '2026-09-30');
    assert.ok(GUIDE_IMAGES[event.imageKey]);
    assert.equal(new URL(event.officialUrl).protocol, 'https:');
  }
  for (const value of strings([events, schedules]).filter(text => /[\u3400-\u9fff]/.test(text))) {
    assert.ok((english as Record<string, string>)[value], value);
  }
});

test('two-day market and free film dates never invent overnight hours or include the paid opening', () => {
  const market = find('san-jose-365-night-market-october-2026');
  assert.equal(market.planning?.programTimeUnconfirmed, true);
  assert.equal(market.planning?.schedule, undefined);
  assert.ok(eventOccursOn(market, '2026-10-31'));
  assert.equal(eventOccursOn(market, '2026-10-29'), false);
  const film = find('oakland-drunken-film-fest-free-shorts-2026');
  assert.equal(eventOccursOn(film, '2026-10-03'), false);
  assert.ok(eventOccursOn(film, '2026-10-04'));
  assert.equal(film.location, undefined, 'Multiple venues cannot share a fabricated pin');
  assert.equal(film.planning?.schedule, undefined);
});

test('member price and unclear fees cannot silently become universal admission', () => {
  const napa = find('napa-tulocay-heritage-halloween-tour-2026');
  assert.equal(napa.planning?.admissionUsd, 45);
  assert.deepEqual(napa.planning?.schedule?.sessions, [{ date: '2026-10-24', start: '16:00', end: '17:30' }]);
  const quiz = find('concord-sidegate-trivia-october-2026');
  assert.equal(quiz.cost, 'unknown');
  assert.equal(quiz.planning?.admissionUsd, null);
  assert.equal(eventOccursOn(quiz, '2026-10-08'), false);
  assert.ok(eventOccursOn(quiz, '2026-10-28'));
  assert.equal(quiz.planning?.schedule?.sessions?.[0].start, '19:00');
  assert.equal(quiz.planning?.schedule?.sessions?.[0].end, undefined);
});

test('Thursday Live special edition stays on Saturday and its street pin remains an area reference', () => {
  const event = find('palo-alto-cal-ave-halloween-live-2026');
  assert.equal(eventOccursOn(event, '2026-10-29'), false);
  assert.equal(new Date(event.startDate + 'T12:00:00Z').getUTCDay(), 6);
  assert.equal(event.location?.precision, 'area');
  assert.equal(event.planning?.schedule, undefined);
  assert.equal(event.planning?.programTimeUnconfirmed, true, 'Tentative official hours cannot become hard scheduling facts');
});
