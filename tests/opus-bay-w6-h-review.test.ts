import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 6 · lane H review: the defects the adversarial review found in the Halloween world, each pinned here.
//   1. the bats' colonies carried a ground y 5–10 u BELOW the published hills (Buena Vista, Twin Peaks): the bats flew
//      inside the hillside (Buena Vista: their whole band under the crown) — only Alamo Square's showed, half of it.
//   2. the halo pool (an InstancedMesh) was never `dispose()`d on teardown: its instanceMatrix / instanceColor GPU
//      buffers leaked on every city → district switch.

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const WD = await import('../src/opus-bay/halloween/worldDress');
const { createHaloPool } = await import('../src/opus-bay/halloween/worldHalos');

test('W6-H review: every bat colony circles clear above the published ground under its whole circle (not inside the hill)', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { setCityTerrain, heightAt } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const c of WD.BAT_COLONIES) await sf.attachAround(city, c.x, c.z, c.r + 4, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const { lo, hi } = WD.batBand();
  for (const c of WD.BAT_COLONIES) {
    // the bats' reach: radius ≤ r, a sideways wobble ≤ 1.2, a wing ≤ 0.4
    let top = -Infinity;
    for (let a = 0; a < 72; a++) for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const r = (c.r + 1.6) * f, t = (a / 72) * Math.PI * 2;
      top = Math.max(top, heightAt(c.x + Math.sin(t) * r, c.z + Math.cos(t) * r));
    }
    assert.ok(c.y + lo >= top + 2, `${c.id}: the lowest bat (y ${(c.y + lo).toFixed(1)}) clears the ground's crown ${top.toFixed(1)} by ≥ 2 u`);
    assert.ok(c.y + lo <= top + 8, `${c.id}: the colony stays near the hilltop (lowest bat ${(c.y + lo).toFixed(1)}, crown ${top.toFixed(1)})`);
    assert.ok(hi > lo);
  }
});

test('W6-H review: the halo pool frees its instanced buffers on teardown (InstancedMesh.dispose)', () => {
  const pool = createHaloPool(8);
  let disposed = false;
  pool.mesh.addEventListener('dispose', () => { disposed = true; });
  pool.dispose();
  assert.ok(disposed, 'the InstancedMesh dispatched dispose (the renderer drops instanceMatrix / instanceColor)');
});
