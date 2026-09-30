import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W7-K7 (W6-K1 part b's open item): the glide's per-frame GlideReport — GlideSim.step made a new report object every
 * frame of a flight. Every caller reads it at once (moveSystem.flyGlide: bump, softBox; the tests), so the sim keeps one
 * and rewrites it: the same object each step, every field reset (a landing's `landed` does not stick to the next step).
 */

const { GlideSim, NO_GLIDE_INPUT } = await import('../src/opus-bay/actors/glide');
type GlideWorld = import('../src/opus-bay/actors/glide').GlideWorld;

const DT = 1 / 60;
const flat: GlideWorld = {
  heightAt: () => 0,
  inWorld: (x, z) => Math.abs(x) < 400 && Math.abs(z) < 400,
  roofAt: () => -Infinity,
  landingSpot: (x, z) => ({ x: Math.round(x), z: Math.round(z) }),
};

test('W7-K7: GlideSim.step returns one report object, rewritten each step (no object per frame), fields reset between steps', () => {
  const g = new GlideSim();
  g.takeOff(0, 0, 0, flat);
  const first = g.step(DT, NO_GLIDE_INPUT, flat);
  let same = true, airborneSeen = false, landedAt = -1;
  for (let i = 0; i < 400; i++) {
    const r = g.step(DT, NO_GLIDE_INPUT, flat);
    if (r !== first) same = false;
    if (r.airborne) airborneSeen = true;
  }
  assert.ok(same, 'the same report object every step');
  assert.ok(airborneSeen, 'the take-off swoop ended (airborne once)');
  assert.equal(first.airborne, false, 'airborne is reset on the next step');
  const dur = g.beginLanding(flat);
  assert.ok(dur !== null);
  for (let i = 0; i < 400 && landedAt < 0; i++) if (g.step(DT, NO_GLIDE_INPUT, flat).landed) landedAt = i;
  assert.ok(landedAt >= 0, 'landed');
  assert.equal(first.landed, true, 'the landing step says so');
  g.step(DT, NO_GLIDE_INPUT, flat);
  assert.equal(first.landed, false, 'and the next step does not');
  assert.equal(first.softBox, undefined);
  // a zero dt answers a clean report too
  first.bump = true;
  assert.equal(g.step(0, NO_GLIDE_INPUT, flat).bump, false);
});
