import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';

/**
 * Lane C2-4 (city haze, CS-2): cityFogK is a pure density multiplier — 1 for a walking camera below y 15, much
 * clearer high up and on the Twin Peaks summit, morning still the softest — and fog stays a uniform (the shared
 * THREE.ShaderChunk is never touched: the site's Little Bay uses the same three).
 */

// every shader chunk as three ships it, before any Opus Bay module is loaded
const CHUNKS_BEFORE = JSON.stringify(THREE.ShaderChunk);

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop), set: () => true });
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { CITY_FOG, cityFogK, fogFactor } = await import('../src/opus-bay/world/sf/fog');
const { Environment } = await import('../src/opus-bay/world/environment');
const { TIME_PRESETS } = await import('../src/opus-bay/world/palette');

const TODS = ['morning', 'day', 'golden', 'night'] as const;

test('walking stays exactly as today: k = 1 below y 15 (any ground, any time)', () => {
  for (const tod of TODS) for (const y of [2, 6, 10, 14.9]) for (const ground of [0, 3, 8]) assert.equal(cityFogK(y, ground, tod), 1, `${tod} y ${y}`);
});

test('the Twin Peaks summit and high views are much clearer; morning stays the softest', () => {
  // summit walking camera ≈ y 55 over ground 45; high QA view y 115 over 45; 250 u view
  for (const tod of TODS) {
    const summit = cityFogK(55, 45, tod), high = cityFogK(115, 45, tod), top = cityFogK(250, 45, tod);
    assert.ok(summit < 0.62 && summit > 0.2, `${tod} summit ${summit.toFixed(3)}`);
    assert.ok(high < summit && top <= high, `${tod}: higher is clearer`);
    assert.ok(top >= 0.07, `${tod}: never fog-free (${top.toFixed(3)})`);
  }
  // downtown (≈ 900 u) seen from the summit: golden / day clear, morning soft but no longer a white-out
  const f = (tod: (typeof TODS)[number]) => fogFactor(TIME_PRESETS[tod].fogDensity * cityFogK(55, 45, tod), 900);
  assert.ok(f('golden') < 0.35 && f('day') < 0.35, `golden ${f('golden').toFixed(2)} day ${f('day').toFixed(2)}`);
  assert.ok(f('morning') > f('golden') && f('morning') > 0.45 && f('morning') < 0.75, `morning ${f('morning').toFixed(2)}`);
  assert.ok(f('night') < f('golden'), 'night: the lit city reads from the hills');
  // before (the old ground-only thinning): the summit got none and downtown sat under 62–98 % fog
  assert.ok(fogFactor(TIME_PRESETS.golden.fogDensity, 900) > 0.65);
});

test('k is continuous and never grows with altitude or height (no pumping while climbing)', () => {
  for (const tod of TODS) {
    let prev = Infinity;
    for (let y = 0; y <= 300; y += 0.5) {
      const k = cityFogK(y, 20, tod);
      assert.ok(k <= prev + 1e-12, `${tod} y ${y}`);
      assert.ok(prev === Infinity || prev - k < 0.02, `${tod} jump at y ${y}`);
      prev = k;
    }
  }
  assert.equal(CITY_FOG.altitude.y0, 20);
});

test('fog stays a uniform: the city Environment scales FogExp2.density, THREE.ShaderChunk is untouched', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../node_modules/three/src/renderers/shaders/ShaderChunk/fog_fragment.glsl.js'), 'utf8');
  const squash = (x: string) => x.replace(/\s+/g, ' ').trim();
  assert.equal(squash(THREE.ShaderChunk.fog_fragment), squash(/`([\s\S]*)`/.exec(src)![1]));
  assert.equal(JSON.stringify(THREE.ShaderChunk), CHUNKS_BEFORE);
  const env = new Environment('city');
  env.setTime('golden', true);
  env.groundAt = () => 45;
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(128, 55, 922);
  for (let i = 0; i < 60; i++) env.update(0.1, cam, new THREE.Vector3(128, 45, 922));
  const want = TIME_PRESETS.golden.fogDensity * cityFogK(55, 45, 'golden');
  assert.ok(Math.abs(env.fog.density - want) < want * 0.01, `density ${env.fog.density} vs ${want}`);
  cam.position.set(128, 8, 922);
  env.groundAt = () => 0;
  for (let i = 0; i < 60; i++) env.update(0.1, cam, new THREE.Vector3(128, 0, 922));
  assert.ok(Math.abs(env.fog.density - TIME_PRESETS.golden.fogDensity) < 1e-7, 'walking: the preset density');
  // district: never scaled
  const d = new Environment('district');
  d.setTime('golden', true);
  cam.position.set(0, 200, 0);
  d.update(0.1, cam, new THREE.Vector3());
  assert.equal(d.fog.density, TIME_PRESETS.golden.fogDensity);
  assert.equal(JSON.stringify(THREE.ShaderChunk), CHUNKS_BEFORE);
});
