import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLine, checkSummary } from '../src/lib/check-dates';

// CNT-SUPPLY-3 review: "核对于 X" only when every listed item was checked that day. A list whose most common day is also its
// latest (79 of 127 December events checked 10/15, the rest 9/28–10/14) says so, with the earliest day.
const zh = (text: string) => text;
const en = (_: string, text: string) => text;

test('one day for every item: 核对于 that day', () => {
  const summary = checkSummary(['2026-10-15', '2026-10-15', '2026-10-15'], '2026-10-15')!;
  assert.deepEqual(summary, { mostly: '2026-10-15', latest: '2026-10-15', earliest: '2026-10-15' });
  assert.equal(checkLine(summary, zh), '核对于 10/15');
  assert.equal(checkLine(summary, en), 'checked Oct 15');
});

test('most on the latest day but not all: 多数核对于 the latest day, with the earliest', () => {
  const summary = checkSummary(['2026-10-15', '2026-10-15', '2026-10-15', '2026-09-28', '2026-10-13', undefined], '2026-10-15')!;
  assert.deepEqual(summary, { mostly: '2026-10-15', latest: '2026-10-15', earliest: '2026-09-28' });
  assert.equal(checkLine(summary, zh), '多数核对于 10/15 · 最早 9/28');
  assert.equal(checkLine(summary, en), 'mostly checked Oct 15 · earliest Sep 28');
  assert.doesNotMatch(checkLine(summary, zh), /^核对于/);
});

test('most on an older day: 多数核对于 that day, with the latest', () => {
  const summary = checkSummary(['2026-09-29', '2026-09-29', '2026-10-12', '2026-09-28'], '2026-10-13')!;
  assert.equal(checkLine(summary, zh), '多数核对于 9/29 · 最近 10/12');
});

test('a stored summary without the earliest day keeps the old two forms', () => {
  assert.equal(checkLine({ mostly: '2026-10-12', latest: '2026-10-12' }, zh), '核对于 10/12');
  assert.equal(checkLine({ mostly: '2026-09-29', latest: '2026-10-12' }, zh), '多数核对于 9/29 · 最近 10/12');
});
