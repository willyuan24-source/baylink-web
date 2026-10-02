/**
 * Wave 8 · lane X · looks: the vehicles up close (W8-X2: the city F-line car's cab, its lit interior at night, the cable
 * car's dash and roof, the tour bus's front and wheels), one burst per reward moment (the double coin pop), the Golden
 * Gate's floodlit towers in the night light field.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type * as THREE from 'three';

// --- headless canvas stub (the fx pool draws its fallback atlas on a canvas; as tests/opus-bay-w7-v.test.ts) ---
const gl = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'measureText' ? () => ({ width: 10 }) : noop),
  set: () => true,
});
gl.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const tris = (g: THREE.BufferGeometry) => g.getIndex()!.count / 3;
const box = async (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };
/** vertices whose aInfo style is 7 (warm at night) */
const warm = (g: THREE.BufferGeometry) => { const a = g.getAttribute('aInfo'); let n = 0; for (let i = 0; i < a.count; i++) if (Math.round(a.getX(i)) === 7) n++; return n; };
const checksum = (g: THREE.BufferGeometry) => {
  let s = 0;
  for (const n of ['position', 'normal', 'color', 'aInfo']) { const a = g.getAttribute(n).array; for (let i = 0; i < a.length; i++) s += a[i] * ((i % 7) + 1); }
  const ix = g.getIndex()!.array; let t = 0; for (let i = 0; i < ix.length; i++) t += ix[i] * ((i % 5) + 1);
  return [g.getAttribute('position').count, ix.length / 3, +s.toFixed(3), t];
};

test('W8-X2 · the city F-line car: a glazed cab that glows at night and a lit saloon, in the same footprint; the district car is byte-identical', async () => {
  const { carGeometry, carFarGeometry } = await import('../src/opus-bay/world/streetcar');
  const { carMidGeometry } = await import('../src/opus-bay/world/flineLayer');
  const district = carGeometry('#2f7d5a'), city = carGeometry('#2f7d5a', true);
  // the district's car (district mode never changes): the checksum of wave 7's geometry
  assert.deepEqual(checksum(district), [1920, 1068, 23455.827, 9465787]);
  assert.deepEqual(checksum(carFarGeometry('#2f7d5a')), [216, 108, 3029.471, 104498]);
  assert.equal(warm(district), 0, 'the district car has no warm-at-night faces');
  assert.ok(warm(city) >= 5 * 2 * 24, `city: the cab glass and the inside glow at night (${warm(city)} vertices)`);
  const d = await box(district), c = await box(city);
  assert.ok(c.max.x - c.min.x <= d.max.x - d.min.x + 0.1 && c.max.z - c.min.z <= d.max.z - d.min.z + 0.1, 'same footprint');
  assert.ok(c.min.y >= -0.15, `the wheels stand on the rail (${c.min.y.toFixed(2)})`);
  assert.ok(tris(city) <= 2000, `city car ${tris(city)} tris`);
  assert.ok(tris(carMidGeometry('#2f7d5a')) < tris(city) * 0.46);
});

/** the positions of the vertices whose aInfo style is 7 (warm at night) */
const warmAt = (g: THREE.BufferGeometry) => {
  const a = g.getAttribute('aInfo'), p = g.getAttribute('position'), out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < a.count; i++) if (Math.round(a.getX(i)) === 7) out.push({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) });
  return out;
};

test('W8-X-review · the city F-line car at night: dark cab glass, a lit saloon seen through the windows (floor, bench seats and backs), and the gold header line on the outside', async () => {
  const { carGeometry, CAR_LEN } = await import('../src/opus-bay/world/streetcar');
  const city = carGeometry('#2f7d5a', true), L = CAR_LEN - 2;
  const w = warmAt(city);
  assert.ok(w.every(p => Math.abs(p.z) <= L / 2 + 0.05), 'nothing warm in the cab: lit, its five panes read as peach boards');
  assert.ok(w.every(p => p.y >= 0.5 - 1e-3 && Math.abs(p.x) <= 1.0 + 1e-3), 'nothing warm on the outside (the floor’s edge under the livery)');
  assert.ok(w.some(p => p.y > 1.0 && p.y < 1.3 && Math.abs(p.x) > 0.85 && Math.abs(p.x) < 0.95 && Math.abs(p.z) < L / 2), 'the benches’ backs glow below the window band');
  assert.ok(w.some(p => p.y > 0.5 && p.y < 0.51 && Math.abs(Math.abs(p.x) - 0.9) < 0.01), 'the aisle floor glows');
  // the gold line under the header: on its outer face (it sat inside the header wall)
  const pos = city.getAttribute('position'), col = city.getAttribute('color');
  let out = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i)), y = pos.getY(i), z = Math.abs(pos.getZ(i));
    if (x > 2.1 / 2 + 0.005 && y > 2.2 && y < 2.32 && z < L / 2 + 0.01 && col.getX(i) > col.getZ(i) * 1.5) out++;
  }
  assert.ok(out >= 8, `the gold header line stands on the header's outer face (${out} vertices)`);
});

test('W8-X2 · the cable car (dash panels, lamp rims, the roof arch) and the tour bus (front, symmetric wheels) keep their sizes and budgets', async () => {
  const { cableCarGeometry, cableCarMidGeometry } = await import('../src/opus-bay/world/cablecar');
  const { CABLE } = await import('../src/opus-bay/data/transit');
  const cc = cableCarGeometry(), b = await box(cc);
  assert.ok(b.max.z - b.min.z <= CABLE.length + 0.25 && b.max.x - b.min.x <= CABLE.width + 0.85, `cable car ${(b.max.x - b.min.x).toFixed(2)} × ${(b.max.z - b.min.z).toFixed(2)}`);
  assert.ok(b.max.y < 2.7, 'no taller');
  assert.ok(tris(cc) <= 2600 && tris(cableCarMidGeometry()) < tris(cc) * 0.3, `cable car ${tris(cc)} tris`);
  assert.equal(cc.name, 'cable-car');
  const { tourBusGeometry } = await import('../src/opus-bay/world/sf/tourBus');
  const { BUS } = await import('../src/opus-bay/world/busSystem');
  const bus = tourBusGeometry(), bb = await box(bus);
  assert.ok(tris(bus) <= 1200, `bus ${tris(bus)} tris`);
  assert.ok(bb.max.x - bb.min.x <= BUS.width + 0.3, 'within the body footprint');
  assert.ok(Math.abs(bb.max.x + bb.min.x) < 0.02, `the wheels stand out alike on both sides (${bb.min.x.toFixed(2)} … ${bb.max.x.toFixed(2)})`);
});

test('W8-X3 · one burst per reward moment: a coin pop waits a beat and goes when the reward bursts at the player; paid coins alone still pop', async () => {
  const { FxPool, POP_DELAY, POP_MERGE } = await import('../src/opus-bay/world/fx');
  const { emit } = await import('../src/opus-bay/core/events');
  const { game } = await import('../src/opus-bay/core/store');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  game.set({ worldMode: 'city' });
  runtime.player.x = 0; runtime.player.z = 0;
  const pool = new FxPool();
  try {
    const n = () => pool.count;
    // coins first, the reward's own sparkle at the player in the same moment: only the sparkle stays
    const c0 = n();
    emit({ type: 'coins', total: 10, delta: 10, source: 'egg:test' });
    const pop = n() - c0;
    assert.ok(pop > 0, 'the pop is queued');
    pool.spawn('sparkle', 0.5, 1.1, 0.3);
    const spark = n() - c0 - pop;
    pool.update(0.01);
    assert.equal(n(), c0 + spark, 'the pop went: one burst');
    // the sparkle first, then the coins: no pop
    pool.update(POP_MERGE * 0.5);
    const c1 = n();
    emit({ type: 'coins', total: 20, delta: 10, source: 'crest:test' });
    assert.equal(n(), c1, 'no pop right after a burst at the player');
    // paid coins on their own (long after any burst, or with a burst far away): the pop shows after its beat
    for (let i = 0; i < 40; i++) pool.update(0.1);
    pool.spawn('sparkle', 40, 1, 40);
    const c2 = n();
    emit({ type: 'coins', total: 30, delta: 10, source: 'postcard:test' });
    const pop2 = n() - c2;
    assert.ok(pop2 > 0, 'a paid reward pops');
    pool.update(POP_DELAY + 0.01);
    assert.equal(n(), c2 + pop2, 'it lives past its beat');
    // (W8-X-review) a small glint the world makes near the player (a pebble's, the hunt's: 5) is not the reward's burst
    for (let i = 0; i < 40; i++) pool.update(0.1);
    pool.spawn('sparkle', 2, 0.5, 0, { count: 5, color: '#ffffff' });
    pool.update(0.3);
    const c3 = n();
    emit({ type: 'coins', total: 40, delta: 10, source: 'goal:test' });
    assert.ok(n() - c3 > 0, 'a goal paid next to a pebble glint still pops');
  } finally { pool.dispose(); }
  // (W8-X-review) district mode never changes: its pop shows at once, and a burst at the player does not take it
  game.set({ worldMode: 'district' });
  const d = new FxPool();
  try {
    emit({ type: 'coins', total: 50, delta: 10, source: 'egg:test' });
    const pop = d.count;
    assert.ok(pop > 0);
    d.spawn('sparkle', 0.5, 1.1, 0.3);
    const all = d.count;
    d.update(0.01);
    assert.equal(d.count, all, 'the district pop is not merged away');
  } finally { d.dispose(); game.set({ worldMode: 'city' }); }
});

test('W8-X-review · the Golden Gate towers are washed from floodlights at their feet, no strings of dots up the legs (W8-X6’s rows read as bulbs); the source is the bridge district’s styling page', async () => {
  const { ggbLights, GGB_TOWER_LIGHT_SOURCE } = await import('../src/opus-bay/world/sf/lights');
  const { GGB } = await import('../src/opus-bay/world/sf/landmarks/golden-gate-bridge');
  const flood = ggbLights().filter(l => l.color[1] === 0.8 && l.color[0] === 1);
  assert.equal(flood.filter(l => l.level < 1).length, 0, 'no dimmer dots up the legs');
  assert.ok(flood.every(l => l.y - Math.min(...flood.map(f => f.y)) < 1), 'the floodlights stand at the legs’ feet');
  assert.ok(flood.length >= 4 && flood.every(l => l.y < GGB.TOP * 0.2));
  assert.equal(GGB_TOWER_LIGHT_SOURCE.sourceUrl, 'https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/');
});

test('W8-X4 · the sky puffs take their edge width from the view direction (its derivative before the city sky\'s branch), not fwidth of the puff distance', async () => {
  const { CITY_SHADERS } = await import('../src/opus-bay/data/sf/cityShaders');
  const code = (g: string) => g.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const puffs = code(CITY_SHADERS.skyPuffs), day = code(CITY_SHADERS.skyCityDay);
  assert.ok(puffs.includes('vec2 obPuffs(vec3 d, float pix)'));
  assert.ok(!/fwidth|dFdx|dFdy/.test(puffs), 'no derivative inside the puff loop');
  const pix = day.indexOf('fwidth(d)');
  assert.ok(pix >= 0 && pix < day.indexOf('if ('), 'the derivative is taken before the branch');
  assert.ok(day.includes('obPuffs(d, pix)'));
  // the sky program in city mode carries both blocks (lane P's slot)
  const { Environment } = await import('../src/opus-bay/world/environment');
  const env = new Environment('city');
  const frag = (env as unknown as { skyMat: { fragmentShader: string } }).skyMat.fragmentShader;
  assert.ok(frag.includes('obPuffs(d, pix)') && frag.includes('float pix = length(fwidth(d));'));
  env.dispose();
});
