import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W6-K1 · feel & play fixes (docs/opus-bay/sf-w6-K1.md): the district keeps its feet, and the small per-frame and
 * guard fixes from the wave-5 reviews.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const { runtime } = await import('../src/opus-bay/core/runtime');
const { input } = await import('../src/opus-bay/core/input');
const { game } = await import('../src/opus-bay/core/store');
const T = await import('../src/opus-bay/core/terrain');
const { PlayerController } = await import('../src/opus-bay/actors/controller');

test('W6-K1: no mantle in the district (the lead\'s decision) — the hop onto the 1 u ledge at the plaza by the Filbert Steps lands on it as before wave 5', () => {
  assert.equal(T.cityTerrain(), null, 'district terrain');
  const saved = game.get();
  game.set({ phase: 'playing', worldMode: 'district', move: { mode: 'foot' } } as never);
  try {
    // the stairs run up to (−55.25, 57.5) at y 19.0; the plaza stands at y 20.0 from x −54.75: a 1 u ledge. W5-F10's
    // mantle climbed it hands first here (a hop from x −56.5); the district's own hop pops onto it
    const c = new PlayerController(), p = runtime.player;
    assert.ok(Math.abs(T.heightAt(-55.25, 57.5) - 19.01) < 0.05 && Math.abs(T.heightAt(-54.5, 57.5) - 20) < 0.05, 'the ledge is there');
    p.x = -56.5; p.z = 57.5; p.y = T.heightAt(p.x, p.z); p.heading = Math.PI / 2; p.pathTarget = null; p.locked = false;
    c.sync();
    let sawMantle = false;
    for (let i = 0; i < 90; i++) {
      runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.input.run = false; input.manualMove = true;
      runtime.input.jump = i === 20;
      c.step({ dt: 1 / 60, now: i / 60, cameraYaw: -Math.PI / 2, frozen: false, riding: false });
      if (c.mantle) sawMantle = true;
    }
    assert.equal(c.mantles, 0, 'no mantle');
    assert.ok(!sawMantle);
    assert.ok(p.x > -53.5 && Math.abs(p.y - 20) < 0.01 && c.grounded, `on the plaza (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  } finally {
    runtime.input.moveY = 0; input.manualMove = false;
    game.set(saved);
  }
});
