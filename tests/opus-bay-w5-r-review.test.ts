import assert from 'node:assert/strict';
import test from 'node:test';
import type { Catalog, CatalogEvent } from '../src/opus-bay/core/types';

/**
 * Wave 5 · lane R · the adversarial review's fixes (docs/opus-bay/sf-w5-R.md "## Review"):
 *   - sun times are printed rounded to the minute, as the almanacs print them (truncated, half of them were a minute early)
 *   - a new Bay day forgets the lines still waiting from yesterday: the daily three's intro and "all done", the event
 *     souvenir line (the scheduler's day memory rolls over at midnight, so they were said again)
 *   - the once-a-day memory keeps a malformed key for the page (it used to drop it, and the line repeated every 20 s)
 *   - the Halloween row says only what its source says
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { parseBayDate, __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { onEvent } = await import('../src/opus-bay/core/events');
const { setCatalogForTests } = await import('../src/opus-bay/data/catalog');
const { sunDay } = await import('../src/opus-bay/game/qa');
const sun = await import('../src/opus-bay/realsf/sun');
const { todayLine } = await import('../src/opus-bay/realsf/todayLine');
const daily = await import('../src/opus-bay/realsf/daily');
const { createDayMemory, RealLineScheduler, REALSF_LINE_GAP } = await import('../src/opus-bay/realsf/lines');
const { initPresence } = await import('../src/opus-bay/realsf/presence');
const { venueById } = await import('../src/opus-bay/realsf/eventVenues');
const cal = await import('../src/opus-bay/realsf/calendar');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const save = await import('../src/opus-bay/data/save');
const L = await import('../src/opus-bay/economy/ledger');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };

/** US Naval Observatory, one day, 37.7749,-122.4194 (the same table as tests/opus-bay-w5-sun.test.ts; Bay wall clock). */
const USNO: [string, string, string, string, string][] = [
  ['2026-09-28', '06:37', '07:03', '18:57', '19:23'], ['2026-10-02', '06:40', '07:06', '18:51', '19:17'],
  ['2026-10-04', '06:42', '07:08', '18:48', '19:14'], ['2026-10-09', '06:46', '07:13', '18:40', '19:07'],
  ['2026-10-31', '07:07', '07:34', '18:12', '18:39'], ['2026-11-01', '06:08', '06:35', '17:11', '17:38'],
  ['2026-11-02', '06:09', '06:36', '17:10', '17:37'], ['2026-12-21', '06:52', '07:21', '16:54', '17:24'],
  ['2027-01-15', '06:55', '07:24', '17:15', '17:43'], ['2027-03-13', '05:58', '06:24', '18:15', '18:41'],
  ['2027-03-14', '06:56', '07:22', '19:16', '19:42'], ['2027-03-20', '06:47', '07:13', '19:22', '19:48'],
  ['2027-06-21', '05:17', '05:48', '20:35', '21:06'], ['2027-06-27', '05:18', '05:50', '20:36', '21:07'],
];

test('W5-R review · sun times are printed as the almanac prints them (rounded): every sunrise and sunset of the 14 USNO dates, 55 of 56 times', () => {
  let same = 0;
  for (const [day, ...want] of USNO) {
    const s = sunDay(day);
    const got = [s.dawn, s.sunrise, s.sunset, s.dusk].map(ms => sun.sunHm(new Date(ms)));
    assert.equal(got[1], want[1], `${day} sunrise`);
    assert.equal(got[2], want[2], `${day} sunset`);
    same += got.filter((t, i) => t === want[i]).length;
  }
  assert.ok(same >= 55, `${same} of 56`);
  // what the player reads: BAYBAY's sunset line and the SF Today line on Halloween (the sun sets at 18:11:49)
  assert.match(sun.sunsetLine(bay('2026-10-31T16:00')).zh, /日落 18:12，/);
  const empty: Catalog = { checkedAt: '2026-09-27', events: [], places: [], guides: [] };
  assert.match(todayLine(bay('2026-10-31T10:00'), empty).zh, /日落 18:12，/);
  // the daily sunset task's hours: golden light to civil dusk, rounded the same way (dusk Dec 21 17:23:47 → 17:24)
  for (let i = 0; i < 90; i++) {
    const day = new Date(Date.UTC(2026, 11, 1 + i)).toISOString().slice(0, 10);
    const t = daily.dailyThree(day, daily.daySignals(day, empty)).find(x => x.kind === 'sunset');
    if (!t) continue;
    const st = sun.sunTimes(bay(`${day}T12:00`));
    assert.ok(t.hint.zh.includes(`${sun.sunHm(st.golden).replace(/^0/, '')}–${sun.sunHm(st.dusk).replace(/^0/, '')}`), `${day}: ${t.hint.zh}`);
    return;
  }
  assert.fail('no sunset task in 90 days');
});

test('W5-R review · the once-a-day memory keeps a malformed key for the page (never repeated every 20 s) and saves only well-formed ones', () => {
  const kept = new Map<string, string>();
  const store = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => { kept.set(k, v); } };
  const mem = createDayMemory(store);
  const sched = new RealLineScheduler(mem);
  const open = { silent: false, bubble: false, quiet: false };
  const odd = { key: 'event-Some_Event.2026', text: { zh: '今天有活动', en: 'An event today' } };
  const fine = { key: 'sunset', text: { zh: '日落', en: 'Sunset' } };
  assert.equal(sched.step(100, '2026-10-03', open, [odd])?.key, odd.key);
  assert.equal(sched.step(100 + REALSF_LINE_GAP + 1, '2026-10-03', open, [odd]), null, 'said once today');
  assert.equal(sched.step(100 + 2 * REALSF_LINE_GAP + 2, '2026-10-03', open, [odd, fine])?.key, 'sunset');
  const saved = JSON.parse(kept.get('opus-bay:realsf:v1')!) as { d: string; said: string[] };
  assert.deepEqual(saved, { d: '2026-10-03', said: ['sunset'] });
  // a new Bay day: both again
  assert.equal(mem.has('2026-10-04', odd.key), false);
});

/** The two San Francisco events the rollover tests need (as in public/planner-catalog.json, 2026-09-27). */
const ev = (id: string, title: string, startDate: string, endDate: string, dateLabel: string, venue: string): CatalogEvent =>
  ({ id, title, startDate, endDate, dateLabel, region: 'sf', city: 'San Francisco', venue, category: 'culture', cost: 'free', officialUrl: `https://example.org/${id}`, sourceLabel: id, verifiedAt: '2026-09-23' });
const FIXTURE: Catalog = {
  checkedAt: '2026-09-27', places: [], guides: [],
  events: [
    ev('hardly-strictly-bluegrass-2026', 'Hardly Strictly Bluegrass 免费音乐节', '2026-10-02', '2026-10-04', '10 月 2–4 日 · 连续三天', 'Hellman Hollow, Lindley & Marx Meadows · Golden Gate Park'),
    ev('sf-african-arts-festival-2026', '非洲艺术节：草坪上的鼓乐、舞蹈与市集', '2026-10-03', '2026-10-03', '10 月 3 日 · 11:00–16:00', 'Great Lawn · Yerba Buena Gardens'),
  ],
};

function cityPlay<T>(fn: () => T): T {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  daily.__resetDailyForTests();
  const offLedger = L.initLedger();
  setCatalogForTests(FIXTURE);
  const was = { phase: game.get().phase, mode: game.get().mode, x: runtime.player.x, z: runtime.player.z };
  game.set({ phase: 'playing', mode: 'free' });
  try { return fn(); } finally {
    offLedger();
    game.set({ phase: was.phase, mode: was.mode });
    runtime.player.x = was.x; runtime.player.z = was.z;
    __setBayNowForTests(null);
    setCatalogForTests(null);
    save.clearSave();
  }
}

test('W5-R review · the daily three: after midnight BAYBAY names today\'s three, and "all three done" is not said again for a new day', () => {
  cityPlay(() => {
    __setBayNowForTests('2026-10-03T23:40');
    const rt = daily.initDaily({ introAfter: 1 });
    try {
      assert.equal(game.get().worldMode, 'city');
      const step = () => stepFrameSystems(0.6, 0);
      step(); step(); step();
      const first = rt.tasks()!;
      const intro1 = rt.offered().find(l => l.key === 'daily-intro');
      assert.deepEqual(intro1?.text, daily.dailyLine(first));
      for (const t of first) rt.complete(t.kind);
      assert.ok(rt.offered().some(l => l.key === 'daily-all'), 'all three done tonight');
      // midnight
      __setBayNowForTests('2026-10-04T00:05');
      step(); step();
      const second = rt.tasks()!;
      assert.ok(second.every(t => t.source.startsWith('daily:2026-10-04:')));
      const keys = rt.offered().map(l => l.key);
      assert.ok(!keys.includes('daily-all'), `yesterday's "all done" is gone: ${keys.join(', ')}`);
      const intro2 = rt.offered().find(l => l.key === 'daily-intro');
      assert.deepEqual(intro2?.text, daily.dailyLine(second), 'the intro names today\'s three');
    } finally { rt.off(); }
  });
});

test('W5-R review · the event souvenir: paid once; its line waits for the day it was earned, not for the next one', () => {
  cityPlay(() => {
    const rewards: string[] = [];
    const offEv = onEvent(e => { if (e.type === 'reward') rewards.push(e.source); });
    const hsb = venueById('hellman-hollow')!;
    runtime.player.x = hsb.x; runtime.player.z = hsb.z;
    __setBayNowForTests('2026-10-03T18:58');
    const p = initPresence();
    try {
      stepFrameSystems(0.6, 0);
      assert.deepEqual(p.stats().open, ['hardly-strictly-bluegrass-2026']);
      assert.deepEqual(rewards, ['event:hardly-strictly-bluegrass-2026']);
      assert.ok(p.offered().some(l => l.key === 'souvenir-hardly-strictly-bluegrass-2026'), 'the stamp line waits to be said');
      // the next morning, the festival's last day, still standing there: no second stamp, no stale 纪念章收好啦
      __setBayNowForTests('2026-10-04T09:30');
      stepFrameSystems(0.6, 0);
      assert.deepEqual(p.stats().open, ['hardly-strictly-bluegrass-2026']);
      assert.deepEqual(rewards, ['event:hardly-strictly-bluegrass-2026'], 'paid once');
      assert.ok(!p.offered().some(l => l.key.startsWith('souvenir-')), 'yesterday\'s souvenir line is gone');
      assert.ok(p.offered().some(l => l.key === 'event-hardly-strictly-bluegrass-2026'), 'today\'s event line');
    } finally { p.off(); offEv(); }
  });
});

test('W5-R review · the Halloween row says only what its source says (Waller St\'s decorated houses), still short', () => {
  const h = cal.CALENDAR.find(r => r.id === 'halloween-2026')!;
  assert.match(h.note.zh, /Waller 街（Scott 到 Steiner）/);
  assert.doesNotMatch(h.note.zh + h.note.en, /南瓜|pumpkin|Painted Ladies|彩绘/i, 'the source does not name pumpkins or the Painted Ladies');
  assert.ok([...h.note.zh].length <= 40);
  assert.equal(h.grade, 'usually');
});
