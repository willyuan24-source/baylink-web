import assert from 'node:assert/strict';
import test from 'node:test';
import type { Catalog, CatalogEvent } from '../src/opus-bay/core/types';

/**
 * Wave 5 · lane R (W5-R4 / W5-R5): 今天 · SF Today (realsf/TodayTab.tsx, the hand rows of realsf/todayRows.ts, the line of
 * realsf/todayLine.ts) and 今日三件小事 (realsf/daily.ts): every row carries its organiser source and check date, the
 * rules of the gardens / the market / the fire rings by date, the daily three seeded and stable for a Bay date and paid
 * once through lane E's ledger, the tab rendered with 带我去 and its sources, past rows hidden. City mode, like the game.
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
const { emit, onEvent, REWARD_SOURCE } = await import('../src/opus-bay/core/events');
const { addDays, setCatalogForTests } = await import('../src/opus-bay/data/catalog');
const rows = await import('../src/opus-bay/realsf/todayRows');
const daily = await import('../src/opus-bay/realsf/daily');
const { todayLine } = await import('../src/opus-bay/realsf/todayLine');
const { sunTimes } = await import('../src/opus-bay/realsf/sun');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const save = await import('../src/opus-bay/data/save');
const L = await import('../src/opus-bay/economy/ledger');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const zhLen = (s: string) => [...s].length;
const minuteOf = (d: Date) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d); return Number(p.find(x => x.type === 'hour')!.value) * 60 + Number(p.find(x => x.type === 'minute')!.value); };

/** The San Francisco rows of the 2026-09-27 catalog these tests need (copied from public/planner-catalog.json). */
const ev = (id: string, title: string, startDate: string, endDate: string, dateLabel: string, venue: string, extra: Partial<CatalogEvent> = {}): CatalogEvent =>
  ({ id, title, startDate, endDate, dateLabel, region: 'sf', city: 'San Francisco', venue, category: 'culture', cost: 'free', officialUrl: `https://example.org/${id}`, sourceLabel: id, verifiedAt: '2026-09-23', ...extra });
const FIXTURE: Catalog = {
  checkedAt: '2026-09-27',
  places: [], guides: [],
  events: [
    ev('portola-2026', '21+ · Portola：把月底留给现场音乐', '2026-09-26', '2026-09-27', '9 月 26–27 日 · 周末', 'Pier 80 · San Francisco', { cost: 'paid' }),
    ev('ai-conference-sf-2026', 'The AI Conference：从研究到实际产品', '2026-09-29', '2026-10-01', '9 月 29 日–10 月 1 日', 'Pier 48 · Shed A & B', { location: { lat: 37.7758086, lng: -122.3853487 } }),
    ev('hardly-strictly-bluegrass-2026', 'Hardly Strictly Bluegrass 免费音乐节', '2026-10-02', '2026-10-04', '10 月 2–4 日 · 连续三天', 'Hellman Hollow, Lindley & Marx Meadows · Golden Gate Park'),
    ev('sf-african-arts-festival-2026', '非洲艺术节：草坪上的鼓乐、舞蹈与市集', '2026-10-03', '2026-10-03', '10 月 3 日 · 11:00–16:00', 'Great Lawn · Yerba Buena Gardens'),
    ev('litquake-out-loud-2026', 'Litquake Out Loud 与独立出版书市', '2026-10-04', '2026-10-04', '10 月 4 日 · 11:00–16:00', 'Yerba Buena Gardens · Esplanade stage · 750 Howard Street'),
    ev('san-francisco-fleet-week-2026', 'San Francisco Fleet Week：海湾与城市活动周', '2026-10-04', '2026-10-12', '10 月 4–12 日 · 各项目日期不同', "San Francisco waterfront · Fisherman's Wharf / Pier 27 and other venues", { category: 'outdoors', cost: 'mixed' }),
    ev('sf-castro-street-fair-2026', 'Castro 街区节：在音乐与市集中认识社区', '2026-10-04', '2026-10-04', '10 月 4 日 · 11:00–18:00', 'Castro & Market Streets'),
    ev('sf-halloween-hoopla-2026', '旧金山 Halloween Hoopla：儿童装扮大游行', '2026-10-31', '2026-10-31', '10 月 31 日 · 12:00–15:00', "Children's Garden, Yerba Buena Gardens · 799 Howard Street", { category: 'family' }),
  ],
};

test('W5-R4 hand rows: every row has its organiser source and check date and says 以官网为准; the gardens, the market, the fire rings and the light show by date', () => {
  const sunset = (day: string) => minuteOf(sunTimes(bay(`${day}T12:00`)).sunset);
  const ids = (day: string) => rows.rowsOn(day, sunset(day)).map(r => r.id);
  for (let i = 0; i < 400; i++) {
    const day = addDays('2026-09-28', i);
    for (const r of rows.rowsOn(day, sunset(day))) {
      assert.match(r.source.url, /^https:\/\//, `${day} ${r.id}`);
      assert.match(r.source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(r.note.zh.endsWith('以官网为准') && r.note.en.endsWith('check before you go'), `${r.id}: ${r.note.zh}`);
      if (r.hours) assert.ok(r.hours[0] < r.hours[1], r.id);
      assert.ok(Number.isFinite(r.at.x) && Number.isFinite(r.at.z));
    }
  }
  // Tue Oct 6, 2026: the market 10–14, the Conservatory's first Tuesday, the Botanical Garden's early hour, the fire rings
  assert.deepEqual(ids('2026-10-06'), ['ferry-plaza-market', 'free-conservatory', 'free-botanical-morning', 'ocean-beach-fire-rings', 'conservatory-light-show']);
  assert.deepEqual(rows.rowsOn('2026-10-06', 1128).find(r => r.id === 'ferry-plaza-market')!.hours, [600, 840]);
  // Tue Oct 13: the Botanical Garden's second Tuesday, all day to its October last entry (17:00)
  assert.deepEqual(rows.rowsOn('2026-10-13', 1120).find(r => r.id === 'free-botanical')!.hours, [450, 1020]);
  assert.ok(!ids('2026-10-13').includes('free-conservatory') && !ids('2026-10-13').includes('free-botanical-morning'));
  // Sat Oct 3: the Saturday market 8–14; Fri Oct 9 and Wed Oct 7: the Tea Garden's free hour 9–10, no market
  assert.deepEqual(rows.rowsOn('2026-10-03', 1129).find(r => r.id === 'ferry-plaza-market')!.hours, [480, 840]);
  for (const d of ['2026-10-09', '2026-10-07', '2026-10-05']) {
    assert.deepEqual(rows.rowsOn(d, 1120).find(r => r.id === 'free-teaGarden')!.hours, [540, 600], d);
    assert.ok(!ids(d).includes('ferry-plaza-market'), d);
  }
  // the fire season ends on Oct 31; Nov 1 has no fire row (and no fire task)
  assert.ok(ids('2026-10-31').includes('ocean-beach-fire-rings'));
  assert.ok(!ids('2026-11-01').includes('ocean-beach-fire-rings'));
  assert.ok(ids('2027-03-01').includes('ocean-beach-fire-rings') && !ids('2027-02-28').includes('ocean-beach-fire-rings'));
  // the light show starts 30 min after sunset and lasts about half an hour
  const show = rows.rowsOn('2026-10-06', 1128).find(r => r.id === 'conservatory-light-show')!;
  assert.deepEqual(show.hours, [1158, 1188]);
  // Thanksgiving, Christmas, New Year's Day: the Botanical Garden is free all day
  for (const d of ['2026-11-26', '2026-12-25', '2027-01-01']) assert.ok(ids(d).includes('free-botanical'), d);
  // the Botanical Garden's last entry by gggp.org's season rows (the spring change follows the 2nd Sunday in March)
  const last: [string, number][] = [['2026-03-07', 1020], ['2026-03-08', 1080], ['2026-09-30', 1080], ['2026-10-01', 1020], ['2026-10-31', 1020], ['2026-11-01', 960], ['2026-12-15', 960], ['2027-01-31', 960], ['2027-02-01', 1020], ['2027-03-13', 1020], ['2027-03-14', 1080]];
  for (const [d, m] of last) assert.equal(rows.botanicalLastEntry(d), m, d);
  assert.equal(rows.teaGardenLastEntry('2026-10-15'), 1050);
  assert.equal(rows.teaGardenLastEntry('2026-11-15'), 990);
  // past rows are hidden, rows later today say when
  assert.equal(rows.rowState([450, 540], 600), 'over');
  assert.equal(rows.rowState([600, 840], 600), 'open');
  assert.equal(rows.rowState([600, 840], 599), 'later');
  assert.equal(rows.rowState(null, 1439), 'open');
});

test('W5-R5 the daily three: seeded by the Bay date and stable, three different kinds, at most two tied to a time, today\'s event first, only what the day really offers', () => {
  const combos = new Set<string>();
  for (let i = 0; i < 150; i++) {
    const day = addDays('2026-09-28', i);
    const s = daily.daySignals(day, FIXTURE);
    const a = daily.dailyThree(day, s), b = daily.dailyThree(day, daily.daySignals(day, FIXTURE));
    assert.deepEqual(a, b, `${day}: the same three all day`);
    assert.equal(a.length, 3, day);
    assert.equal(new Set(a.map(t => t.kind)).size, 3, `${day}: three different kinds`);
    assert.ok(a.filter(t => daily.TIMED.has(t.kind)).length <= 2, `${day}: something is always doable`);
    if (s.events.length) assert.equal(a[0].kind, 'event', `${day}: today's event first`);
    a.forEach((t, k) => {
      assert.equal(t.source, `daily:${day}:${k + 1}`);
      assert.match(t.source, REWARD_SOURCE);
      assert.ok(zhLen(t.title.zh) <= 30 && zhLen(t.short.zh) <= 12, t.title.zh);
      assert.ok(!/undefined|NaN/.test(JSON.stringify(t)), `${day} ${t.kind}`);
      if (t.kind === 'market') assert.ok(s.market, `${day}: a market task only on a market day`);
      if (t.kind === 'free') assert.ok(s.free.length, `${day}: a free place only when one is free`);
      if (t.kind === 'fire') assert.ok(s.fire, `${day}: the fire rings only in season`);
      if (t.window) assert.ok(t.window.open < t.window.close);
    });
    const line = daily.dailyLine(a);
    assert.ok(zhLen(line.zh) <= 45, `${day}: ${line.zh}`);
    combos.add(a.map(t => t.kind).join('+'));
  }
  assert.ok(combos.size >= 8, `${combos.size} different days`);
  assert.ok(zhLen(daily.DAILY_ALL_LINE.zh) <= 45);
  // Sat Oct 3: an event (the African Arts Festival at YBG or HSB), its real window
  const oct3 = daily.dailyThree('2026-10-03', daily.daySignals('2026-10-03', FIXTURE));
  assert.equal(oct3[0].kind, 'event');
  assert.ok(['sf-african-arts-festival-2026', 'hardly-strictly-bluegrass-2026'].includes(oct3[0].eventId!));
  // Nov 5: no catalog event, no fire season: still three things
  const nov5 = daily.dailyThree('2026-11-05', daily.daySignals('2026-11-05', FIXTURE));
  assert.ok(nov5.every(t => t.kind !== 'event' && t.kind !== 'fire'));
  // the sunset task's window is the real golden band to civil dusk
  for (let i = 0; i < 60; i++) {
    const day = addDays('2026-10-01', i);
    const t = daily.dailyThree(day, daily.daySignals(day, FIXTURE)).find(x => x.kind === 'sunset');
    if (!t) continue;
    const sun = sunTimes(bay(`${day}T12:00`));
    assert.deepEqual(t.window, { open: sun.golden.getTime(), close: sun.dusk.getTime() });
    break;
  }
});

test('W5-R5 paid once through lane E\'s ledger: +10 each, +20 for all three, by the real signals; tomorrow starts fresh', () => {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  daily.__resetDailyForTests();
  const offLedger = L.initLedger();
  setCatalogForTests(FIXTURE);
  __setBayNowForTests('2026-10-03T10:30');
  const saved = { phase: game.get().phase, mode: game.get().mode };
  game.set({ phase: 'playing', mode: 'free' });
  const rewards: string[] = [];
  const offEv = onEvent(e => { if (e.type === 'reward') rewards.push(`${e.source}=${e.coins}`); });
  const rt = daily.initDaily({ introAfter: 1 });
  try {
    assert.equal(game.get().worldMode, 'city');
    const tasks = rt.tasks()!;
    assert.ok(tasks && tasks.length === 3);
    assert.equal(daily.activeDaily(), rt);
    const step = (s = 0.6) => stepFrameSystems(s, 0);
    // BAYBAY's once-a-day line after a while in the city
    step(); step(); step();
    assert.ok(rt.offered().some(l => l.key === 'daily-intro'));
    // each task by what the player really does (or the QA complete for kinds that need a ride / an arrival)
    for (const t of tasks) {
      if (t.kind === 'event') {
        emit({ type: 'realsf', what: 'event-enter', id: 'sf-quinteto-latino-lunchtime-2026' });
        assert.ok(!rt.done(t), 'another event does not count');
        __setBayNowForTests('2026-10-03T12:00');
        emit({ type: 'realsf', what: 'event-enter', id: t.eventId! });
      } else if (t.kind === 'fire') {
        runtime.player.x = -560; runtime.player.z = 1360;
        step();
      } else if (t.kind === 'sunset') {
        runtime.player.x = 125.7; runtime.player.z = 925;
        __setBayNowForTests('2026-10-03T12:00');
        step();
        assert.ok(!rt.done(t), 'not at noon');
        const sun = sunTimes(bay('2026-10-03T12:00'));
        __setBayNowForTests(new Date(sun.sunset.getTime() - 10 * 60_000));
        step();
      } else if (t.kind === 'ride') {
        emit({ type: 'transit', what: 'ride', line: 'powell-hyde', kind: 'cable-car', real: true });
      } else if (t.kind === 'new') {
        emit({ type: 'arrival', place: 'coit-tower', tier: 1, first: true });
      } else if (t.kind === 'market') {
        runtime.player.x = 131; runtime.player.z = 12;
        emit({ type: 'emote', who: 'player', emote: 'taste' });
      } else if (t.kind === 'free') {
        runtime.player.x = t.go!.point.x; runtime.player.z = t.go!.point.z;
        step();
      }
      assert.ok(rt.done(t), `${t.kind} done`);
      assert.ok(L.isPaid(t.source), `${t.source} paid`);
    }
    assert.deepEqual(rewards.sort(), ['daily:2026-10-03:1=10', 'daily:2026-10-03:2=10', 'daily:2026-10-03:3=10', 'daily:2026-10-03:all=20'].sort());
    assert.equal(L.coinsTotal(), 50);
    assert.deepEqual(L.playState().d, { d: '2026-10-03', m: 0b10000111 });
    assert.equal(rt.complete(tasks[0].kind), false, 'never twice');
    assert.ok(rt.offered().some(l => l.key === 'daily-all'));
    // the next Bay day: three new things, nothing carried, nothing lost
    __setBayNowForTests('2026-10-04T09:00');
    const next = rt.tasks()!;
    assert.ok(next.every(t => t.source.startsWith('daily:2026-10-04:') && !rt.done(t)));
    assert.equal(L.coinsTotal(), 50);
  } finally {
    rt.off(); offEv(); offLedger();
    assert.equal(daily.activeDaily(), null);
    game.set(saved);
    __setBayNowForTests(null);
    setCatalogForTests(null);
    save.clearSave();
  }
});

test('W5-R4 the SF Today line (welcome back, the notebook header) ≤ 45 zh characters: today\'s event, else the sunset, else the daily three', () => {
  setCatalogForTests(FIXTURE);
  try {
    const a = todayLine(bay('2026-10-03T10:30'), FIXTURE);
    assert.match(a.zh, /今天(金门公园|芳草地花园)有/);
    const b = todayLine(bay('2026-10-06T10:00'), FIXTURE);
    assert.match(b.zh, /^今天旧金山日落 18:\d\d，/);
    const c = todayLine(bay('2026-10-06T20:00'), FIXTURE);
    assert.match(c.zh, /三件小事/);
    for (let i = 0; i < 60; i++) for (const hh of ['08:00', '13:00', '21:00']) {
      const l = todayLine(bay(`${addDays('2026-09-28', i)}T${hh}`), FIXTURE);
      assert.ok(zhLen(l.zh) <= 45, l.zh);
      assert.ok(!/undefined|NaN/.test(l.zh + l.en), l.en);
      // (W8-I, W8I-WS-1) an English sentence starts with a capital ('the Ferry Building has …' did not), *on* the page
      assert.match(l.en, /^[A-Z0-9]/, l.en);
      assert.doesNotMatch(l.en, /in the journal's Today page/, l.en);
    }
  } finally { setCatalogForTests(null); }
});

test('W5-R4 the 今天 tab: the clock, sun and moon, the next goal, the daily three, today\'s rows with 带我去 and their sources, the week; past rows hidden', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { default: TodayTab } = await import('../src/opus-bay/realsf/TodayTab');
  styles.deregister();
  setCatalogForTests(FIXTURE);
  __setBayNowForTests('2026-10-03T10:30');
  try {
    const html = renderToStaticMarkup(h(TodayTab));
    assert.match(html, /10:30/);
    assert.match(html, /日出 7:0\d/);
    assert.match(html, /日落 18:4\d/);
    assert.match(html, /约(新月|蛾眉月|上弦月|盈凸月|满月|亏凸月|下弦月|残月)/);
    assert.match(html, /今日三件小事/);
    assert.match(html, /今天在旧金山/);
    assert.match(html, /Hardly Strictly Bluegrass 免费音乐节/);
    assert.match(html, /非洲艺术节/);
    assert.match(html, /渡轮大厦 · 农夫市集/, 'Saturday: the market');
    assert.match(html, /foodwise\.org/);
    assert.match(html, /gggp\.org/);
    assert.match(html, /nps\.gov/);
    assert.match(html, /查证于 2026-09-28/);
    assert.doesNotMatch(html, /早上免费入园/, 'the 7:30–9 free hour is over at 10:30: hidden');
    assert.ok((html.match(/带我去/g) ?? []).length >= 6, 'every row can go');
    assert.match(html, /这周/);
    assert.match(html, /Castro 街区节/);
    assert.doesNotMatch(html, /Portola|AI Conference/, 'never 21+ or professional events');
    assert.match(html, /以官网为准/);
    // early morning: the free hour is there, the festival not yet open
    __setBayNowForTests('2026-10-03T07:45');
    const early = renderToStaticMarkup(h(TodayTab));
    assert.match(early, /早上免费入园/);
    assert.match(early, /11:00 起/);
  } finally { __setBayNowForTests(null); setCatalogForTests(null); }
});
