/**
 * Wave 9 · lane X (W9-X5): what BAYBAY SAYS for today (realsf/todayLine.ts `todaySpoken`, the 'returning' welcome and the
 * late welcome in realsf/index.ts) keeps lane H's big Halloween days. W9-H2 (22:44 PDT) put them into `todayLine()`;
 * W9-X4 (00:35 PDT) switched the welcome to `todaySpoken()`, which did not have them: a player back at 19:30 on
 * Halloween night heard the generic 「今天的日落时间和三件小事…」 again (the review's R§6 growth row) — red before this fix.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Catalog } from '../src/opus-bay/core/types';

const { parseBayDate } = await import('../src/opus-bay/game/bayNow');
const T = await import('../src/opus-bay/realsf/todayLine');
const WL = await import('../src/opus-bay/halloween/worldLines');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const empty: Catalog = { checkedAt: '2026-09-27', events: [], places: [], guides: [] };

test('W9-X5 · todaySpoken: the welcome back on the big Halloween days is the day\'s own fixed line (lane H), with no toast', () => {
  const cases: [string, Parameters<typeof WL.lineText>[0]][] = [
    ['2026-10-31T19:30', 'todayBigNight'], ['2026-10-31T12:30', 'todayFestival'],
    ['2026-11-01T18:00', 'muertosHello'], ['2026-11-02T19:10', 'todayProcession'],
  ];
  for (const [at, key] of cases) {
    const s = T.todaySpoken(bay(at), empty);
    assert.deepEqual(s.line, WL.lineText(key), at);
    assert.deepEqual(s.line, T.todayLine(bay(at), empty), `${at}: the line of record and the spoken line agree`);
    assert.equal(s.toast, null, `${at}: the big day's line names its own place and time`);
  }
  // any other day: the fixed today lines (W9-X4)
  assert.deepEqual(T.todaySpoken(bay('2026-10-30T10:30'), empty).line, T.TODAY_SUNSET_LINE);
  assert.deepEqual(T.todaySpoken(bay('2026-11-03T22:30'), empty).line, T.TODAY_PLAIN_LINE);
});
