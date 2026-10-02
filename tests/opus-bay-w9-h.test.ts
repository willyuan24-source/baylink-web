import assert from 'node:assert/strict';
import test from 'node:test';
import type { Catalog } from '../src/opus-bay/core/types';

/**
 * Wave 9 · lane H · the big Halloween days in words (docs/opus-bay/sf-w9-H.md part a):
 *   - BAYBAY's welcome back on 31 October / 1–2 November is the big day's fixed line (halloween/today.ts through
 *     realsf/todayLine.ts) — the review heard the generic sunset / three-things line at 19:30 on Halloween night
 *   - a first visit on those days is invited once the first minute is over, far from the place (bigDayInvite)
 *   - the 万圣节 page's season line says the whole of October and counts down to the 31st (it said 「1–30 October」)
 *   - the new lines are fixed, short, bilingual and unique (lane X records them by exact text)
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

const { parseBayDate } = await import('../src/opus-bay/game/bayNow');
const { todayLine, todaySpoken } = await import('../src/opus-bay/realsf/todayLine');
const T = await import('../src/opus-bay/halloween/today');
const WL = await import('../src/opus-bay/halloween/worldLines');
const HL = await import('../src/opus-bay/halloween/lines');
const { phaseLine } = await import('../src/opus-bay/halloween/pageText');
const FD = await import('../src/opus-bay/halloween/festivalDate');
const WF = await import('../src/opus-bay/halloween/worldFestival');
const { MUERTOS_TIMES } = await import('../src/opus-bay/halloween/muertos');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const empty: Catalog = { checkedAt: '2026-09-27', events: [], places: [], guides: [] };

test('W9-H today: the big days\' keys by the Bay clock (31 Oct festival / big night, 1–2 Nov, the procession\'s evening)', () => {
  const cases: [string, string | null][] = [
    ['2026-10-30T19:30', null], ['2026-10-31T00:30', 'todayBigNight'], ['2026-10-31T10:59', 'todayBigNight'],
    ['2026-10-31T11:00', 'todayFestival'], ['2026-10-31T14:59', 'todayFestival'], ['2026-10-31T15:00', 'todayBigNight'],
    ['2026-10-31T19:30', 'todayBigNight'], ['2026-11-01T12:00', 'muertosHello'], ['2026-11-02T15:59', 'muertosHello'],
    ['2026-11-02T16:00', 'todayProcession'], ['2026-11-02T19:10', 'todayProcession'], ['2026-11-02T20:59', 'todayProcession'],
    ['2026-11-02T21:00', 'muertosHello'], ['2026-11-03T00:00', null], ['2026-10-15T19:30', null],
  ];
  for (const [at, want] of cases) assert.equal(T.halloweenTodayKey(bay(at)), want, at);
  // a preview counts: night → the big night, muertos → the hello (the procession follows the real 2 November)
  assert.equal(T.halloweenTodayKey(bay('2026-10-15T19:30'), '?halloween=night'), 'todayBigNight');
  assert.equal(T.halloweenTodayKey(bay('2026-10-15T19:30'), '?halloween=muertos'), 'muertosHello');
  assert.equal(T.halloweenTodayKey(bay('2026-10-31T19:30'), '?halloween=0'), null);
  assert.equal(T.PROCESSION_LINE_TO, MUERTOS_TIMES.walkTo, 'the line ends with the walk');
  assert.ok(T.PROCESSION_LINE_FROM < MUERTOS_TIMES.gatherFrom);
  // the festival's rule is one rule (the kit re-exports it)
  assert.equal(WF.FESTIVAL, FD.FESTIVAL);
  assert.equal(WF.festivalOn, FD.festivalOn);
});

test('W9-H today: the welcome back on Halloween night is the big night\'s line, not the generic one (red before)', () => {
  const night = todayLine(bay('2026-10-31T19:30'), empty);
  assert.deepEqual(night, WL.lineText('todayBigNight'));
  assert.doesNotMatch(night.zh, /三件小事|日落/);
  assert.deepEqual(todayLine(bay('2026-10-31T12:30'), empty), WL.lineText('todayFestival'));
  assert.deepEqual(todayLine(bay('2026-11-01T18:00'), empty), WL.lineText('muertosHello'));
  assert.deepEqual(todayLine(bay('2026-11-02T19:10'), empty), WL.lineText('todayProcession'));
  // any other day is lane R's line as before
  assert.match(todayLine(bay('2026-10-30T19:30'), empty).zh, /三件小事/);
  assert.match(todayLine(bay('2026-11-03T10:00'), empty).zh, /日落/);
});

test("W9-H today: what BAYBAY SAYS on the welcome back (todaySpoken, the game's call since W9-X4) is the big day's line too", () => {
  // realsf/index.ts's welcome back and its late welcome call todaySpoken(), not todayLine(): between W9-X4 and W9-X5 it
  // said 旅行本「今天」里有今日三件小事… on 31 Oct 19:30 instead of the big night's line (W9-X5 fixed it; this pins all
  // four big-day moments from lane H's side)
  const at = (iso: string) => todaySpoken(bay(iso), empty);
  assert.deepEqual(at('2026-10-31T19:30'), { line: WL.lineText('todayBigNight'), toast: null });
  assert.deepEqual(at('2026-10-31T12:30'), { line: WL.lineText('todayFestival'), toast: null });
  assert.deepEqual(at('2026-11-01T18:00'), { line: WL.lineText('muertosHello'), toast: null });
  assert.deepEqual(at('2026-11-02T19:10'), { line: WL.lineText('todayProcession'), toast: null });
  // any other day is W9-X's fixed line as before
  assert.doesNotMatch(at('2026-10-30T19:30').line.zh, /万圣|亡灵/);
  assert.doesNotMatch(at('2026-11-03T10:00').line.zh, /万圣|亡灵/);
});

test('W9-H today: a first visit is invited after the first minute, away from the place, never after a welcome back', () => {
  assert.equal(T.bigDayInvite('todayBigNight', 500, 120, false), 'todayBigNight');
  assert.equal(T.bigDayInvite('todayBigNight', 500, T.INVITE_AFTER_S - 1, false), null, 'the first minute is the welcome\'s');
  assert.equal(T.bigDayInvite('todayBigNight', T.INVITE_FAR - 1, 120, false), null, 'at the place its own lines speak');
  assert.equal(T.bigDayInvite('todayBigNight', 500, 120, true), null, 'a returning player heard it in the welcome');
  assert.equal(T.bigDayInvite(null, 500, 120, false), null);
  assert.ok(T.INVITE_AFTER_S >= 60);
});

test('W9-H lines: the wave-9 lines are fixed, short, bilingual, unique; the older lists unchanged', () => {
  const all = [...WL.EVERY_WORLD_LINE, ...HL.HALLOWEEN_LINES, ...HL.W7_HALLOWEEN_LINES, ...HL.W8_HALLOWEEN_LINES];
  assert.equal(new Set(all.map(l => l.id)).size, all.length, 'ids unique');
  assert.equal(new Set(all.map(l => l.zh)).size, all.length, 'zh unique');
  assert.equal(new Set(all.map(l => l.en)).size, all.length, 'en unique');
  assert.equal(WL.W9_WORLD_LINES.length, 3);
  for (const l of WL.W9_WORLD_LINES) {
    assert.match(l.id, /^w9-h-[a-z0-9-]+$/, l.id);
    assert.ok(/[一-鿿]/.test(l.zh) && !/[一-鿿]/.test(l.en), `${l.id}: bilingual`);
    assert.ok([...l.zh].length <= 45 && l.en.length <= 110, `${l.id}: short (${[...l.zh].length} / ${l.en.length})`);
    assert.doesNotMatch(l.zh + l.en, /\$\{|undefined|NaN|\d{1,2}:\d{2}/, `${l.id}: fixed text`);
    assert.match(l.en, /^[A-Z]/);
  }
  assert.match(WL.lineText('todayProcession').zh, /通常.*以官网为准/);
  assert.match(WL.lineText('todayProcession').en, /usually.*official/);
  // the recorded wave-6 hello is reused as it was recorded
  assert.deepEqual(WL.lineText('muertosHello'), { zh: '今天是亡灵节！教会区挂满了彩色剪纸旗，还有万寿菊。', en: 'It’s Día de los Muertos! The Mission is full of papel picado and marigolds.' });
  assert.equal(WL.EVERY_WORLD_LINE.length, WL.ALL_WORLD_LINES.length + WL.W7_WORLD_LINES.length + WL.W8_WORLD_LINES.length + WL.W9_WORLD_LINES.length);
});

test('W9-H page: the season line covers the whole of October and counts down to the big night (it said 1–30 October)', () => {
  const first = phaseLine('season', bay('2026-10-01T10:00'));
  assert.doesNotMatch(first.zh + first.en, /1–30|1-30/);
  assert.match(first.zh, /整个 10 月.*10 月 31 日.*还有 30 天！/);
  assert.match(first.en, /^All October: .*31 October.* 30 days to go!$/);
  assert.match(phaseLine('season', bay('2026-10-30T20:00')).zh, /明天就是！$/);
  assert.match(phaseLine('season', bay('2026-10-30T20:00')).en, /tomorrow!$/);
  // a `?halloween=1` preview in September: no countdown
  const preview = phaseLine('season', bay('2026-09-20T10:00'));
  assert.doesNotMatch(preview.zh + preview.en, /还有|to go|明天|tomorrow/);
  assert.match(preview.zh, /糖果加倍！$/);
  assert.match(phaseLine('night').zh, /今晚是万圣节大夜晚/);
  assert.match(phaseLine('muertos').en, /Día de los Muertos/);
  assert.equal(phaseLine('off').en, 'Halloween comes every October.');
});
