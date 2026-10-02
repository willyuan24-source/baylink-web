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

test('W9-X review (X-RV-2) · the today toast comes with its line\'s bubble, not in the welcome back\'s own tick; once; never after its ttl', async () => {
  const fs = await import('node:fs');
  const line = T.TODAY_SUNSET_LINE, toast = { zh: '今天旧金山日落 18:51', en: 'Sunset in San Francisco today: 18:51' };
  let shown: { zh: string; en: string } | null = null, now = 1000;
  const subs = new Set<() => void>();
  const said: string[] = [];
  const deps = { bubble: () => shown, subscribe: (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; }, say: (t: { en: string }) => { said.push(t.en); }, now: () => now, ttlMs: 60_000 };
  const show = (b: typeof shown) => { shown = b; for (const fn of [...subs]) fn(); };
  T.toastWithLine(line, toast, deps);
  assert.deepEqual(said, [], 'nothing in the welcome\'s tick');
  show({ zh: '欢迎回来！我们接着逛吧。', en: 'Welcome back! Let\'s keep exploring.' });
  assert.deepEqual(said, [], 'not with the welcome-back bubble');
  show(null);
  now += 6000;
  show(line);
  assert.deepEqual(said, [toast.en], 'with the line\'s own bubble');
  show(null); show(line);
  assert.deepEqual(said, [toast.en], 'once');
  assert.equal(subs.size, 0, 'unsubscribed');
  // a line never said within its ttl: no toast at all
  said.length = 0;
  T.toastWithLine(line, toast, deps);
  now += 61_000;
  show(line);
  assert.deepEqual(said, [], 'after the ttl the line was let go: no toast');
  // no toast to add: nothing waits; the off stops a waiting toast
  T.toastWithLine(line, null, deps);
  const off = T.toastWithLine(line, toast, deps);
  off();
  show(null); show(line);
  assert.deepEqual(said, []);
  assert.equal(subs.size, 0);
  // the welcome listener itself no longer raises the toast (before: sayTodayToast(s.toast) inside onWelcome)
  const src = fs.readFileSync('src/opus-bay/realsf/index.ts', 'utf8');
  assert.doesNotMatch(src, /onWelcome\([^\n]*sayTodayToast\(s\.toast\)/);
  assert.match(src, /toastWithLine\(s\.line, s\.toast/);
});
