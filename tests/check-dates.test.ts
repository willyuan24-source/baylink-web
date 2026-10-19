import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLine, checkSummary, officialCheckLine } from '../src/lib/check-dates';

// CNT-SUPPLY-3 review: "核对于 X" only when every listed item was checked that day. A list whose most common day is also its
// latest (79 of 127 December events checked 10/15, the rest 9/28–10/14) says so, with the earliest day.
const zh = (text: string) => text;
const en = (_: string, text: string) => text;

test('one day for every item: 核对于 that day', () => {
  const summary = checkSummary(['2026-10-15', '2026-10-15', '2026-10-15'], '2026-10-15')!;
  assert.deepEqual(summary, { mostly: '2026-10-15', latest: '2026-10-15', earliest: '2026-10-15', all: true });
  assert.equal(checkLine(summary, zh), '核对于 10/15');
  assert.equal(checkLine(summary, en), 'checked Oct 15');
});

test('most on the latest day but not all: 多数核对于 the latest day, with the earliest', () => {
  const summary = checkSummary(['2026-10-15', '2026-10-15', '2026-10-15', '2026-09-28', '2026-10-13', undefined], '2026-10-15')!;
  assert.deepEqual(summary, { mostly: '2026-10-15', latest: '2026-10-15', earliest: '2026-09-28', all: false });
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

// UI9-PREP: the 官网核对 wording of the same summaries (HOME's trust line, EVENTS' lede). checkLine above is unchanged.
test('officialCheckLine says 官网核对 with the same dates, leading or trailing, never 人工核对', () => {
  const all = checkSummary(['2026-10-15', '2026-10-15'], '2026-10-15')!;
  const undated = checkSummary(['2026-10-15', '2026-10-15', undefined], '2026-10-15')!;
  const earliest = checkSummary(['2026-10-15', '2026-10-15', '2026-10-15', '2026-09-28'], '2026-10-15')!;
  const latest = checkSummary(['2026-09-29', '2026-09-29', '2026-10-12'], '2026-10-13')!;
  assert.deepEqual([all, undated, earliest, latest].map(summary => officialCheckLine(summary, zh)), ['官网核对 10/15', '官网核对 多数 10/15', '官网核对 多数 10/15 · 最早 9/28', '官网核对 多数 9/29 · 最近 10/12']);
  assert.deepEqual([all, undated, earliest, latest].map(summary => officialCheckLine(summary, zh, { order: 'trail' })), ['10/15 官网核对', '多数 10/15 官网核对', '多数 10/15 官网核对 · 最早 9/28', '多数 9/29 官网核对 · 最近 10/12']);
  assert.deepEqual([all, undated, earliest, latest].map(summary => officialCheckLine(summary, en)), ['Source checked Oct 15', 'Source checked: mostly Oct 15', 'Source checked: mostly Oct 15 · earliest Sep 28', 'Source checked: mostly Sep 29 · latest Oct 12']);
  assert.deepEqual([all, undated, earliest, latest].map(summary => officialCheckLine(summary, en, { order: 'trail' })), [all, undated, earliest, latest].map(summary => officialCheckLine(summary, en)), 'English reads the same either way');
  // A stored summary without the earliest day (older snapshots) keeps the two old forms.
  assert.equal(officialCheckLine({ mostly: '2026-10-12', latest: '2026-10-12' }, zh), '官网核对 10/12');
  assert.equal(officialCheckLine({ mostly: '2026-09-29', latest: '2026-10-12' }, zh), '官网核对 多数 9/29 · 最近 10/12');
  for (const summary of [all, undated, earliest, latest]) {
    for (const line of [officialCheckLine(summary, zh), officialCheckLine(summary, zh, { order: 'trail' })]) assert.doesNotMatch(line, /人工核对|编辑核对/);
    // checkLine is unchanged: the same summary still prints its own wording.
    assert.doesNotMatch(checkLine(summary, zh), /官网/);
  }
});
