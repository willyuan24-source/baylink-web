import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 8 · lane K · W8-K8 — the kite's two small W7-W2 review items: (1) after clicking the chip's 放线 with a mouse the
 * button kept the focus and swallowed Space (the games' holdKeys skip a focused BUTTON): the chip's hold button now
 * gives the focus back after a mouse press and, when it has the focus (tabbed to), holds on Space / Enter / E itself;
 * (2) 放风筝 set `quietUntil` 75 s at the start and kept it after an early 不玩了: BAYBAY's idle chatter waited up to 75 s
 * after a short round — the quiet now ends KITE_QUIET_AFTER after the round (a later activity's own quiet untouched).
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };
let clock = 2_000_000;
mock.method(performance, 'now', () => clock);

const K = await import('../src/opus-bay/play/kite');
const chip = await import('../src/opus-bay/play/chip');
const kit = await import('../src/opus-bay/play/kit');
const { chipHoldKey, CHIP_HOLD_KEYS } = await import('../src/opus-bay/play/chipKeys');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');

const src = (p: string) => readFileSync(new URL(`../src/opus-bay/${p}`, import.meta.url), 'utf8');
const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

test('W8-K8 the chip’s hold button: Space / Enter / E hold it while it has the focus; a mouse press gives the focus back', () => {
  assert.deepEqual([...CHIP_HOLD_KEYS], ['Space', 'Enter', 'KeyE']);
  assert.equal(chipHoldKey('Space', true, false), true);
  assert.equal(chipHoldKey('Space', false, false), false);
  assert.equal(chipHoldKey('KeyE', true, true), null, 'a key repeat changes nothing');
  assert.equal(chipHoldKey('KeyW', true, false), null, 'other keys pass');
  const tsx = src('play/PlayChip.tsx');
  assert.match(tsx, /onKeyDown=\{key\(true\)\} onKeyUp=\{key\(false\)\} onBlur=\{\(\) => hold\?\.set\(false\)\}/, 'wired on the hold button');
  assert.match(tsx, /if \(!down && e\.pointerType === 'mouse'\) \(e\.currentTarget as HTMLElement\)\.blur\?\.\(\);/, 'a mouse press blurs it');
  // the games' own keys still skip a focused button (no double hold)
  assert.match(src('play/partc.ts'), /el\.tagName === 'BUTTON'/);
});

test('W8-K8 an early 不玩了 releases the kite’s 75 s quiet (KITE_QUIET_AFTER later); a later activity’s quiet stays', () => {
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  runtime.move.mode = 'foot';
  const p = runtime.player;
  p.x = -380; p.z = 300;
  try {
    flow.set({ quietUntil: 0 });
    assert.ok(K.startKite(seeded(3)));
    assert.equal(flow.get().quietUntil, clock + 75000, 'the round sets its 75 s');
    for (let i = 0; i < 30; i++) { clock += 33; stepFrameSystems(1 / 30, i / 30); }
    chip.chipState()?.action?.run(); // 不玩了 after a second
    assert.equal(kit.currentActivity(), null);
    assert.ok(flow.get().quietUntil <= clock + K.KITE_QUIET_AFTER, `quiet ends ${K.KITE_QUIET_AFTER} ms after the round, not 75 s after its start (${flow.get().quietUntil - clock})`);
    assert.ok(flow.get().quietUntil > clock, 'a short breath is kept (the medal card, her done line)');
    // another activity took the quiet meanwhile: left alone
    assert.ok(K.startKite(seeded(4)));
    flow.set({ quietUntil: clock + 200000 });
    chip.chipState()?.action?.run();
    assert.equal(flow.get().quietUntil, clock + 200000, 'not shortened');
    // walking off ends it the same way
    flow.set({ quietUntil: 0 });
    assert.ok(K.startKite(seeded(5)));
    p.x += K.KITE_LEAVE + 1;
    clock += 33; stepFrameSystems(1 / 30, 300);
    assert.equal(kit.currentActivity(), null);
    assert.ok(flow.get().quietUntil <= clock + K.KITE_QUIET_AFTER, 'walked off: released too');
  } finally { K.__resetKite(); game.set({ phase: prev.phase, mode: prev.mode }); }
});
