import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W6-K1 · lane D's open items (sf-w5-D.md review, W5-Z §7.3): the sea-otter egg does not fire from the Golden Gate
 * Bridge's deck over Fort Point; the Castro prints' prop pool rebuilds at most every 0.25 s while a trail changes.
 */

// --- headless canvas stub (world modules create label atlases at import time; same as the eggs tests) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { eggById } = await import('../src/opus-bay/eggs/registry');
const H = await import('../src/opus-bay/eggs/hosts');
const { makeHosts } = await import('../src/opus-bay/eggs/index');
const deck = await import('../src/opus-bay/actors/deckSteer');
const { clearSave } = await import('../src/opus-bay/data/save');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { onEvent } = await import('../src/opus-bay/core/events');

const run = (seconds: number) => { for (let t = 0; t < seconds; t += 1 / 30) H.stepHosts(1 / 30); };

test('W6-K1 (W5-Z §7.3): BAYBAY\'s otter cousins wait for the water by the fort — not the bridge deck 15 u over it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const finds: string[] = [];
  const off = onEvent(e => { if (e.type === 'find' && e.first) finds.push(e.id); });
  const otter = eggById('baybay-otter-roots')!;
  // the walk deck over the spot (the city registers the GGB's in actors/cityViews.ts): a deck at y 15.4 across it
  deck.registerDeck('k1-ggb', { id: 'k1-ggb', x: otter.at.x - 60, z: otter.at.z, heading: Math.PI / 2, length: 120, half: 13, y: 15.4 });
  clearSave();
  H.__resetHostsForTests();
  const stop = H.startHosts(makeHosts());
  const p = runtime.player, gd = runtime.guide;
  const put = (x: number, z: number, y: number) => { p.x = x; p.z = z; p.y = y; p.speed = 0; p.pathTarget = null; };
  try {
    game.set({ phase: 'playing', timeOfDay: 'morning' });
    runtime.move.mode = 'foot';
    // on the deck's sidewalk right over the spot, BAYBAY beside you: nothing (before: found — its 2D distance)
    put(otter.at.x, otter.at.z + 5, 15.4);
    gd.x = otter.at.x + 2; gd.z = otter.at.z + 5;
    assert.ok(deck.onDeck(p.x, p.z, p.y), 'on the walk deck');
    run(1);
    assert.ok(!finds.includes(otter.id), 'not from the deck');
    // no deck registered, still up at deck height: the height cap
    deck.registerDeck('k1-ggb', null);
    run(1);
    assert.ok(!finds.includes(otter.id), 'not from 15 u up either way');
    // down at the water by the fort: found
    put(otter.at.x, otter.at.z, 2);
    gd.x = otter.at.x + 3; gd.z = otter.at.z;
    run(0.5);
    assert.ok(finds.includes(otter.id), 'found at the water');
  } finally { stop(); off(); deck.registerDeck('k1-ggb', null); H.__resetHostsForTests(); clearSave(); }
});

test('W6-K1 (lane D\'s review): a changed prop pool rebuilds at most every 0.25 s (the Castro prints: drops and fades one by one)', async () => {
  const P = await import('../src/opus-bay/eggs/props');
  assert.equal(P.PROP_REBUILD_FLOOR, 0.25);
  const pool = new P.PropPool();
  const x = -500, z = 300;
  try {
    let builds = 0;
    const geo = () => pool.mesh.geometry;
    let last = geo();
    const step = (t: number) => { pool.step(t, x, z); if (geo() !== last) { builds++; last = geo(); } };
    pool.set('p0', { kind: 'tin', x, z, y: 0 });
    step(0);
    assert.deepEqual(pool.visibleKeys(), ['p0']);
    // a trail: a print every 0.1 s for 2 s, stepped at the host's 10 Hz
    for (let i = 1; i <= 20; i++) {
      pool.set(`p${i}`, { kind: 'tin', x: x + i * 0.3, z, y: 0 });
      step(i * 0.1);
    }
    assert.ok(builds <= 1 + Math.ceil(2 / 0.25), `≤ 9 rebuilds in 2 s (${builds}); before: 21`);
    step(2.3);
    assert.equal(pool.visibleKeys().length, 21, 'the last change still shows (within the floor)');
  } finally { pool.dispose(); }
});
