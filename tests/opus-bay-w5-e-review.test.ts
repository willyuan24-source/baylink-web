import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · the adversarial review of lane E (economy & notebook): what it found, pinned.
 *
 * 1. The 手帐 header printed the sunset truncated (`bayHm`) while the almanacs, lane R's review and BAYBAY's own sunset
 *    line round it (`sunHm`): on 2026-10-31 the page said 18:11, the US Naval Observatory and BAYBAY 18:12. Its
 *    "今晚约是…" moon was the phase of the hour the page was opened, not tonight's.
 * 2. The coins' frame system built an array, a picker object, a date object and bucket-key strings 30 times a second.
 * 3. The 飞行券 picker left Alcatraz out ("the 16 must-sees" were 15), though its trip destination is the Pier 33 landing.
 * 4. After Settings → reset progress, BAYBAY's first 飞行券 waited for the next page load.
 * 5. Each ledger change queued its own full notebook check (a ring flown through: eight in one frame), and one queued
 *    just before a teardown still ran after it.
 * 6. The compass arrow's CSS turn went the long way round (a full spin) whenever the target crossed behind you.
 */

const save = await import('../src/opus-bay/data/save');
const { __setBayNowForTests, bayNow } = await import('../src/opus-bay/game/bayNow');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { setGlideUnlocked } = await import('../src/opus-bay/actors/moveApi');
const L = await import('../src/opus-bay/economy/ledger');
const W = await import('../src/opus-bay/economy/wallet');
const C = await import('../src/opus-bay/economy/coins');
const spots = await import('../src/opus-bay/economy/coinSpots');
const { todayLine } = await import('../src/opus-bay/economy/today');
const { sunsetLine, sunTimes } = await import('../src/opus-bay/realsf/sun');
const { MOON_LABELS, moonPhase } = await import('../src/opus-bay/realsf/moon');
const compass = await import('../src/opus-bay/economy/compass');
const attractions = await import('../src/opus-bay/data/sf/attractions');

function fresh(date = '2026-10-10T11:00') {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  __setBayNowForTests(date);
}

test('W5-E-review 1: the header\'s sunset is the almanac\'s (rounded) and BAYBAY\'s; the moon is tonight\'s', () => {
  try {
    // USNO, checked on the web 2026-09-28 (aa.usno.navy.mil rstt/oneday, 37.7749 N 122.4194 W): Sep 28 set 18:57, Oct 31 set 18:12
    __setBayNowForTests('2026-09-28T12:00');
    assert.match(todayLine().zh, /日落 18:57 /);
    __setBayNowForTests('2026-10-31T12:00');
    assert.match(todayLine().zh, /日落 18:12 /, 'USNO 18:12 (truncated it read 18:11)');
    assert.match(todayLine().en, /sunset 18:12 /);
    // every day for half a year: the page and BAYBAY's sunset line say the same minute
    const start = Date.parse('2026-09-28T19:00:00Z');
    for (let d = 0; d < 183; d++) {
      __setBayNowForTests(new Date(start + d * 864e5));
      const said = /日落 (\d\d:\d\d)/.exec(sunsetLine().zh)?.[1];
      const page = /日落 (\d\d:\d\d)/.exec(todayLine().zh)?.[1];
      assert.ok(said && page === said, `${bayNow().toISOString()}: page ${page} vs BAYBAY ${said}`);
    }
    // 今晚: the phase at tonight's sunset, whatever hour the page is opened; find a day where the morning's differs
    let checked = 0;
    for (let d = 0; d < 60 && checked < 3; d++) {
      const morning = new Date(Date.parse('2026-09-28T15:00:00Z') + d * 864e5); // 08:00 PDT
      __setBayNowForTests(morning);
      const tonight = moonPhase(sunTimes(morning).sunset).name;
      if (moonPhase(morning).name === tonight) continue;
      checked++;
      assert.ok(todayLine(morning).zh.endsWith(`今晚约是${MOON_LABELS[tonight].zh}`), `${morning.toISOString()}: ${todayLine(morning).zh}`);
    }
    assert.ok(checked > 0, 'a day whose morning phase is not tonight\'s');
  } finally { __setBayNowForTests(null); }
});

test('W5-E-review 2: a coin step with nothing to pick allocates nothing; picking still works; the Bay day still turns', () => {
  fresh('2026-10-03T21:00');
  const offLedger = L.initLedger();
  try {
    for (const [p, list] of [['trail', spots.trailCoinIds()], ['cache', spots.cacheIds()], ['ring', spots.ringCoinIds()]] as const) L.registerRewardIds(p, list);
    const w = new C.CoinWorld(C.coinItems());
    const off = L.subscribeLedger(() => w.markDirty());
    const i = w.items.findIndex(c => c.source === 'trail:dolores-park:2');
    const c = w.items[i];
    const far = { x: c.x + 40, y: c.y, z: c.z, mode: 'foot' as const, low: true };
    const a = w.step(null, 0), b = w.step(far, 33), d = w.step(far, 66);
    assert.equal(a, b, 'the same empty result, no new array');
    assert.equal(b, d);
    assert.equal(a.length, 0);
    const got = w.step({ x: c.x, y: c.y, z: c.z, mode: 'foot', low: true }, 99);
    assert.deepEqual(got, [i], 'a pickup still returns what was picked');
    assert.notEqual(got, a);
    assert.equal(w.isTaken(i), true);
    assert.equal(w.step(far, 132).length, 0);
    // the day is looked at once a second: a new Bay day brings the trail coin back within that second
    __setBayNowForTests('2026-10-04T06:00');
    w.step(null, 1200);
    assert.equal(w.isTaken(i), false, 'a new Bay day: the trail coin is back');
    off();
    // one picker object, refilled; none in photo mode
    game.set({ phase: 'playing', worldMode: 'city', photoMode: false });
    runtime.move.mode = 'foot';
    const p1 = C.currentPicker(), p2 = C.currentPicker();
    assert.ok(p1 && p1 === p2, 'the same object each step');
    runtime.move.mode = 'bike';
    game.set({ photoMode: true });
    assert.equal(C.currentPicker(), null, 'photo mode picks nothing up');
  } finally {
    game.set({ photoMode: false });
    runtime.move.mode = 'foot';
    offLedger();
    __setBayNowForTests(null);
  }
});

test('W5-E-review 3: the 飞行券 flies to all 16 must-sees — Alcatraz by its Pier 33 landing', async () => {
  const { ticketDestinations } = await import('../src/opus-bay/economy/shopRun');
  const far = { x: 5000, z: 5000 };
  const list = ticketDestinations(attractions, far, () => false);
  assert.equal(list.length, 16);
  const alcatraz = list.find(d => d.id === 'alcatraz-landing');
  assert.ok(alcatraz, 'Alcatraz: its landing');
  const island = attractions.ATTRACTIONS.find(a => a.id === 'alcatraz')!;
  assert.deepEqual(alcatraz!.look, { x: island.x, z: island.z }, 'the first sight looks at the island');
  // not visited first, then the farthest first; nothing within 60 u
  const seen = new Set(['coit-tower', 'twin-peaks']);
  const at = { x: -50, z: 51 };
  const ordered = ticketDestinations(attractions, at, id => seen.has(id));
  assert.ok(!ordered.some(d => d.id === 'coit-tower'), 'Coit is where you stand');
  assert.equal(ordered.at(-1)!.id, 'twin-peaks', 'the visited ones last');
});

test('W5-E-review 4: after Settings → reset progress BAYBAY gives the first 飞行券 again, without a reload', async () => {
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const run = await import('../src/opus-bay/economy/shopRun');
  styles.deregister();
  fresh();
  setGlideUnlocked(false);
  const off = run.initShop(() => null);
  try {
    assert.ok(W.holds('fly-ticket') && W.owns('fly-gift'), 'a new player: the gift');
    // the pelican: the unused ticket gives back 10
    setGlideUnlocked(true);
    assert.equal(W.holds('fly-ticket'), false);
    assert.equal(L.coinsTotal(), 10);
    // Settings → reset progress (ui/Settings.tsx: clearSave, then the glide off)
    save.clearSave();
    setGlideUnlocked(false);
    await Promise.resolve();
    assert.ok(W.holds('fly-ticket') && W.owns('fly-gift'), 'the new save gets her gift at once');
    assert.equal(L.coinsTotal(), 0);
    // a reset while the pelican was never out (the glide does not change): the gift still comes
    W.consume('fly-ticket');
    save.clearSave();
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(W.holds('fly-ticket'), 'the reset alone brings it');
  } finally { off(); setGlideUnlocked(false); }
  // after the off nothing is given any more
  save.clearSave();
  await Promise.resolve();
  assert.equal(W.holds('fly-ticket'), false);
});

test('W5-E-review 5: a burst of ledger changes (a ring flown through: 8 coins in one step) is one notebook check; none after the off', async () => {
  const N = await import('../src/opus-bay/economy/notebookRun');
  fresh();
  L.registerRewardIds('ring', spots.ringCoinIds());
  const off = N.initNotebook();
  try {
    await Promise.resolve();
    const before = N.notebookStats.runs;
    for (let i = 1; i <= 8; i++) L.pay(`ring:coit:${i}`, 1);
    assert.equal(L.coinsTotal(), 8);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(N.notebookStats.runs - before, 1, 'one check for the eight coins');
  } finally { off(); }
  const after = N.notebookStats.runs;
  L.pay('ring:twin-peaks:1', 1);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(N.notebookStats.runs, after, 'nothing runs once the notebook is torn down');
  assert.equal(N.notebookPages(), null);
});

test('W5-E-review 6: the compass arrow turns the short way', () => {
  for (const [prev, a] of [[3.0, -3.0], [-3.1, 3.1], [0.2, 0.1 + 4 * Math.PI], [10, -10]] as const) {
    const t = compass.nearestTurn(prev, a);
    assert.ok(Math.abs(t - prev) <= Math.PI + 1e-9, `${prev} → ${a}: ${t}`);
    assert.ok(Math.abs(Math.sin(t - a)) < 1e-9 && Math.cos(t - a) > 0, 'the same direction');
  }
});
