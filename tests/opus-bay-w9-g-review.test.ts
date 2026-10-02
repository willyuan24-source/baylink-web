import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 9 · lane G · the Ultra review's fixes (docs/opus-bay/sf-w9-G.md "Review (Ultra)"):
 *   - G-RV-1: 摸摸 (play/pet.ts) and a finished 看风景 (play/sit.ts) emit `play` end events too; they took the day's
 *     今日小游戏 coins silently → only a mini-game's end pays `daily:<Bay date>:4`;
 *   - G-RV-2: Settings pauses the game but the claw / crab / dough kept stepping (quarters spent, the oven burning) and
 *     their panels stayed over the sheet → their frame systems wait while paused and the panels hide (is-paused).
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, toDataURL: () => 'data:image/png;base64,AAAA' }) };

const fs = await import('node:fs');
const path = await import('node:path');
const { emit } = await import('../src/opus-bay/core/events');
const { game } = await import('../src/opus-bay/core/store');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const ledger = await import('../src/opus-bay/economy/ledger');
const kit = await import('../src/opus-bay/play/kit');
const claw = await import('../src/opus-bay/play/claw');

test('G-RV-1: petting BAYBAY or a finished view does not take the day\'s 今日小游戏 coins; a mini-game does', async () => {
  __setBayNowForTests(new Date('2026-10-04T19:00:00Z'));
  kit.__setBestWriter(null);
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  const entry = await import('../src/opus-bay/play/dexEntry');
  const off = entry.initDex();
  try {
    const src = kit.todaySource();
    assert.equal(ledger.isPaid(src), false);
    emit({ type: 'play', activity: 'pet', what: 'end' });
    emit({ type: 'play', activity: 'view', what: 'end' });
    emit({ type: 'play', activity: 'sit', what: 'end' });
    assert.equal(ledger.isPaid(src), false, 'pet / view / sit are not mini-games');
    kit.startActivity({ id: 'crab', name: { zh: '捞螃蟹', en: 'Crabbing' } })!.end({ tier: 0, card: false });
    assert.equal(ledger.isPaid(src), true, 'the first mini-game of the day pays');
  } finally { off(); kit.__resetKit(); game.set({ phase: prev.phase, mode: prev.mode }); __setBayNowForTests(null); }
});

test('G-RV-2: a paused game pauses the claw (no aim time spent, no auto drop); the W7 panels hide while paused', () => {
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false, paused: false });
  try {
    assert.ok(claw.startClaw(() => 0.5));
    const cg = claw.clawGame()!;
    stepFrameSystems(0.1, 1);
    const left = cg.aimLeft;
    game.set({ paused: true });
    for (let i = 0; i < 200; i++) stepFrameSystems(0.1, 2 + i * 0.1);
    assert.equal(cg.phase, 'aim', 'still aiming after 20 s in Settings');
    assert.equal(cg.aimLeft, left, 'the aim clock waited');
    game.set({ paused: false });
    stepFrameSystems(0.1, 30);
    assert.ok(cg.aimLeft < left, 'and runs again once Settings closes');
  } finally { claw.__resetClaw(); kit.__resetKit(); game.set({ phase: prev.phase, mode: prev.mode, paused: false }); }
  const PLAY = path.resolve(import.meta.dirname, '../src/opus-bay/play');
  for (const f of ['ClawPanel.tsx', 'CrabPanel.tsx', 'DoughPanel.tsx', 'FortunePanel.tsx']) {
    assert.match(fs.readFileSync(path.join(PLAY, f), 'utf8'), /is-paused/, `${f} hides while paused`);
  }
  assert.match(fs.readFileSync(path.join(PLAY, 'sfgames.css'), 'utf8'), /\.ob-sfg-panel\.is-paused\s*\{\s*visibility:\s*hidden/);
  for (const f of ['crab.ts', 'dough.ts']) assert.match(fs.readFileSync(path.join(PLAY, f), 'utf8'), /cur !== r \|\| obStore\.get\(\)\.paused/, `${f} waits while paused`);
});
