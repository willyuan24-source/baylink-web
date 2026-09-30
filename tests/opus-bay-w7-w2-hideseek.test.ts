import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 7 · lane W2 · hide & seek fixes (sf-w7-lead §3 W2 (5)): the ≈ 50 ms hitch at the tap (the spot's nav search ran
 * all in the tap's frame: now ≤ SEARCH_MS a frame over the count), the fixed 被你找到啦！ line (the seconds on the chip),
 * the coach line without lane A's emote-coach gate (tests/opus-bay-w6-w-hideseek.test.ts W6-W5).
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : noop), set: () => true });
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const hs = await import('../src/opus-bay/play/hideSeek');
const chip = await import('../src/opus-bay/play/chip');
const kit = await import('../src/opus-bay/play/kit');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');

const busy = (ms: number) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { /* a nav query's cost */ } };

test('W7-W2 hide & seek: the tap runs one slow nav query, the rest over the count; the round still finds her spot', () => {
  kit.__setBestWriter(null);
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  const p = runtime.player;
  p.x = 0; p.z = 0;
  // six landmarks 30–50 u away; the first five are not walked to (each query costs 10 ms), the last one is
  const list = [0, 1, 2, 3, 4, 5].map(i => ({ id: `l${i}`, name: { zh: `地标${i}`, en: `L${i}` }, x: Math.sin(i) * (30 + i * 3), z: Math.cos(i) * (30 + i * 3) }));
  let calls = 0;
  const opts = {
    stand: () => true,
    reach: (_f: { x: number; z: number }, t: { x: number; z: number }) => { calls++; busy(10); return Math.hypot(t.x - list[5].x, t.z - list[5].z) < 4; },
    rand: () => 0.5,
    list,
  };
  try {
    assert.ok(hs.startHideSeek(opts));
    assert.equal(calls, 1, `the tap's frame ran ${calls} nav queries (≤ SEARCH_MS ${hs.SEARCH_MS} ms)`);
    for (let i = 0; i < 40; i++) stepFrameSystems(0.1, i * 0.1);
    assert.ok(calls >= 6, `${calls} queries in all`);
    assert.ok(chip.chipState()?.line?.zh.includes('地标5'), chip.chipState()?.line?.zh);
    const gd = runtime.guide;
    assert.ok(Math.hypot(gd.x - list[5].x, gd.z - list[5].z) < 4, 'she hides by the one landmark walked to');
  } finally { hs.stopHideSeek(); game.set({ phase: prev.phase, mode: prev.mode }); }
});

test('W7-W2 hide & seek: nowhere to hide found on a later frame ends the round with the fixed line; the lines are fixed text', async () => {
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  const p = runtime.player;
  p.x = 0; p.z = 0;
  const list = [{ id: 'far', name: { zh: '远处', en: 'far' }, x: 0, z: 40 }];
  const opts = { stand: () => true, reach: () => { busy(8); return false; }, rand: () => 0.5, list };
  try {
    assert.ok(hs.startHideSeek(opts), 'the round starts (the search goes on)');
    for (let i = 0; i < 60 && kit.currentActivity(); i++) stepFrameSystems(0.1, i * 0.1);
    assert.equal(kit.currentActivity(), null, 'no spot: the round is over');
    assert.deepEqual(flow.get().bubble?.text, hs.HIDE_LINES.nowhere);
  } finally { hs.stopHideSeek(); flow.set({ bubble: null }); game.set({ phase: prev.phase, mode: prev.mode }); }
  for (const [k, v] of Object.entries(hs.HIDE_LINES)) assert.ok(v.zh && v.en && !/\d/.test(v.zh + v.en), `${k}: fixed`);
});
