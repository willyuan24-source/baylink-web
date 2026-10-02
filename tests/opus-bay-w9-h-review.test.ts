import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

/**
 * Wave 9 · the review of lane H (Ultra) — H-RV-1: a returning player's welcome on the big Halloween days.
 *
 * The title's 继续 starts 'local' (game/resume.ts beginPlaying('local') → game/flow.ts startFree({ local, back })), and
 * since W9-F4 that runs the 3-minute hush (flow.hushUntil, held by game/baybayHold.ts baybayHeld()). welcomeBack() offered
 * its second line — the welcome listener's (realsf todaySpoken → halloween/today.ts halloweenTodayLine on 31 Oct / 1–2 Nov)
 * or goal #1 — to BAYBAY's pacer with a 60 s ttl, and the pacer is held by the same hush: the line expired unsaid (the
 * lens: 'Happy Halloween! Every treat-street door answers today…' never said in 200 s; zh-Hant on the phone the same).
 * The pacer here is the real one (game/cityContent.ts initCityContent loads game/cityMoments.ts as in the city).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
g.requestAnimationFrame ??= (cb: () => void) => setTimeout(cb, 16);
g.cancelAnimationFrame ??= (id: number) => clearTimeout(id);
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, toBlob: (cb: (b: null) => void) => cb(null) }) };
let clock = 900_000;
mock.method(performance, 'now', () => clock);

const store = await import('../src/opus-bay/core/store');
const { game } = store;
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const save = await import('../src/opus-bay/data/save');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const welcome = await import('../src/opus-bay/game/welcome');
const cc = await import('../src/opus-bay/game/cityContent');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { __setBayNowForTests, bayNow } = await import('../src/opus-bay/game/bayNow');
const { halloweenTodayLine } = await import('../src/opus-bay/halloween/today');
setStorageForTests(null);

game.set({ ...store.initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
const offCity = cc.initCityContent();
// the pacer's chunk (game/cityMoments.ts) is a dynamic import: wait for it (carriedTimeLabel is null before it lands)
for (let i = 0; i < 300 && cc.carriedTimeLabel(100) === null; i++) await new Promise(res => setTimeout(res, 50));

test('H-RV-1: 继续 on 31 Oct 19:30 — after 欢迎回来, BAYBAY says the big night\'s line through the hush (before: held by W9-F4\'s 3-min hush until its 60 s ttl ran out)', () => {
  assert.notEqual(cc.carriedTimeLabel(100), null, 'the pacer is loaded (the bug is the pacer held by the hush)');
  __setBayNowForTests('2026-10-31T19:30');
  const big = halloweenTodayLine(bayNow());
  assert.ok(big, 'lane H\'s big-night line exists on 31 Oct 19:30');
  welcome.resetWelcome();
  // the day's line, as lane R's listener (realsf/index.ts todaySpoken().line) gives it on the big days
  const off = welcome.onWelcome(kind => (kind === 'returning' ? halloweenTodayLine(bayNow()) : null));
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    game.set({ ...store.initialGameState(), worldMode: 'city', mode: 'onboarding', phase: 'arrival' });
    flow.set(initialFlowState());
    Object.assign(runtime.player, { x: 8.7, y: 0, z: 572.4, heading: 0, moving: false, pendingInteract: null, pathTarget: null });
    save.resetSaveCache();
    save.patchSave(s => { s.lastSafe = { world: 'city', x: 8.7, z: 572.4, heading: 0 }; });
    assert.equal(flowMod.hasProgress(), true);
    flowMod.beginPlaying('local');
    assert.equal(flow.get().bubble?.text.zh, flowMod.WELCOME_BACK.zh, '欢迎回来！我们接着逛吧。 first');
    assert.ok(flow.get().hushUntil > clock + 170_000, 'W9-F4\'s hush runs for the resumed player (kept)');
    const seen: string[] = [];
    for (let i = 0; i < 600; i++) {
      clock += 100;
      mock.timers.tick(100);
      stepFrameSystems(0.1, clock);
      const zh = flow.get().bubble?.text.zh;
      if (zh && seen[seen.length - 1] !== zh) seen.push(zh);
    }
    assert.ok(seen.includes(big.zh), `the big night's line within 60 s (seen: ${JSON.stringify(seen)})`);
    assert.ok(seen.indexOf(big.zh) > seen.indexOf(flowMod.WELCOME_BACK.zh), 'after 欢迎回来, never over it');
    assert.ok(flow.get().hushUntil > clock, 'and the hush still holds the ambient lines after it');
  } finally {
    off();
    mock.timers.reset();
    __setBayNowForTests(null);
  }
});

test('H-RV-2: doors 10 / 43 went gone in W9-H3 after the season opened — a save that knocked them keeps their treats in the bag and the 敲开 5 户 goal (before: 5 doors / 5 candies -> 3 / 3, the goal 3/5)', async () => {
  const treat = await import('../src/opus-bay/halloween/treat');
  const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');
  const { halloweenGoals } = await import('../src/opus-bay/halloween/progress');
  const gone = TREAT_DOORS.filter(d => d.gone).map(d => d.n);
  assert.ok(gone.includes(10) && gone.includes(43), 'W9-H3\'s pair is gone');
  const paid = new Set([10, 11, 12, 13, 43].map(n => treat.doorSource(n)));
  const isPaid = (s: string) => paid.has(s);
  assert.equal(treat.doorsKnocked(isPaid), 5);
  assert.equal(treat.candyCount(isPaid), 5);
  assert.equal(halloweenGoals(isPaid).find(x => x.id === 'doors')?.have, 5, '敲开 5 户人家的门 stays done');
  // the big night's treat at a gone door (2 more) stays too
  paid.add(treat.nightSource(43));
  assert.equal(treat.candyCount(isPaid), 7);
  // the page's x / 42 counts the live doors (never 44 / 42), and "every door" asks the live ones only
  const live = TREAT_DOORS.filter(d => !d.gone);
  assert.equal(treat.doorsKnocked(isPaid, live), 3);
  const allLiveButOne = new Set([...live.slice(1).map(d => treat.doorSource(d.n)), ...gone.map(n => treat.doorSource(n))]);
  assert.equal(treat.allDoorsKnocked(s => allLiveButOne.has(s)), false, 'gone doors never stand in for a live one');
  assert.equal(treat.allDoorsKnocked(s => s.startsWith('halloween:door:')), true);
});

test.after(() => { offCity(); });
