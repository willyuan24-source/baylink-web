import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

/**
 * Wave 8 · lane H · the Halloween dusk beyond Karl's bank: W7-H1's golden-hour tint coloured only the bank (the west);
 * world/sf/fog.ts KarlState.setGoldenTint gains a `haze` — at golden hour (with a tint) the camera's own ground counts
 * as at least that much under the bank (uKarlCam's floor), so the tinted colour also lies thinly over downtown and the
 * east side, deepening with view depth (the shader's own extinction: obKarl). halloween/world.ts pushes DUSK_TINT.haze.
 * Uniform-only: no program, no call; city-only (KarlState lives in the city chunk); district never has Karl.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { KARL } = await import('../src/opus-bay/world/fogShader');
const { KarlState } = await import('../src/opus-bay/world/sf/fog');
const { DUSK_TINT } = await import('../src/opus-bay/halloween/world');

const DOWNTOWN = { x: 137, z: 133 }, SUNSET = { x: -243, z: 1306 };

test('W8-H dusk haze: at golden hour with the tint, downtown\'s own ground counts DUSK_TINT.haze under the bank; none by day, none without the tint', () => {
  assert.ok(DUSK_TINT.haze > 0.15 && DUSK_TINT.haze <= 0.5, 'a thin haze, not a fog');
  const k = new KarlState();
  k.setTime('golden', true);
  k.update(0.016, DOWNTOWN);
  assert.equal(KARL.uKarlCam.value, 0, 'downtown: no bank, no tint → nothing (as before)');
  k.setGoldenTint(DUSK_TINT.color, DUSK_TINT.amount, true, DUSK_TINT.haze);
  k.update(0.016, DOWNTOWN);
  assert.ok(Math.abs(KARL.uKarlCam.value - DUSK_TINT.haze) < 1e-6, `downtown at the Halloween dusk: ${KARL.uKarlCam.value}`);
  assert.equal(k.goldenHaze, DUSK_TINT.haze);
  // inside the bank the bank wins (max)
  k.update(0.016, SUNSET);
  assert.ok(KARL.uKarlCam.value > 0.95);
  // by day: the haze slides away with Karl's own slide
  k.setTime('day', false);
  k.update(1, DOWNTOWN);
  assert.ok(KARL.uKarlCam.value > 0 && KARL.uKarlCam.value < DUSK_TINT.haze, `sliding out: ${KARL.uKarlCam.value}`);
  for (let i = 0; i < 80; i++) k.update(1, DOWNTOWN);
  assert.equal(KARL.uKarlCam.value, 0, 'none by day');
  // back to golden: in again; the tint cleared → none
  k.setTime('golden', true);
  k.update(0.016, DOWNTOWN);
  assert.ok(Math.abs(KARL.uKarlCam.value - DUSK_TINT.haze) < 1e-6);
  k.setGoldenTint(null, 0, true);
  k.update(0.016, DOWNTOWN);
  assert.equal(KARL.uKarlCam.value, 0, 'cleared with the tint');
  // an old caller (no haze argument) keeps W7's behaviour: the colour only
  k.setGoldenTint(DUSK_TINT.color, DUSK_TINT.amount, true);
  k.update(0.016, DOWNTOWN);
  assert.equal(KARL.uKarlCam.value, 0);
});

test('W8-H dusk haze: the Halloween world pushes the haze with its tint; fog.ts still reads no calendar', () => {
  const world = fs.readFileSync(new URL('../src/opus-bay/halloween/world.ts', import.meta.url), 'utf8');
  assert.match(world, /k\.setGoldenTint\(t\?\.color \?\? null, t\?\.amount \?\? 0, tinted !== k, t\?\.haze \?\? 0\)/);
  const fog = fs.readFileSync(new URL('../src/opus-bay/world/sf/fog.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(fog, /from ['"][^'"]*halloween/);
  assert.match(fog, /Math\.max\(karlCover\(cam\.x, -1e3, cam\.z, this\.cur\), this\.hazeCur\)/);
});
