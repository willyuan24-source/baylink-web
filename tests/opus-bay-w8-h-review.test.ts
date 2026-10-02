import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 8 · lane H · the Ultra review's fixes (docs/opus-bay/sf-w8-H.md "Review (Ultra)"):
 *   - H-code-4: the two walkers of a procession row part as a pair — a player standing just beside a file no longer sends
 *     that file's walker onto the other file's line (before: 0.14 u apart, two robes merged into one);
 *   - H-code-5 / H-RP-4: the walkers part only round someone on the street (not under a pelican glide), and BAYBAY's
 *     "let's step onto the sidewalk" line is offered only while the player is on foot (not from the air or a toy car).
 * (The door-to-street rule's review fixes are in tests/opus-bay-w8-h-doors.test.ts; the bow's tile label in -bow.test.ts.)
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };

const MW = await import('../src/opus-bay/halloween/muertosWalkers');
const MU = await import('../src/opus-bay/halloween/muertos');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { runtime } = await import('../src/opus-bay/core/runtime');

const minPair = (w: { each(fn: (x: number, z: number) => void): void }) => {
  const xs: number[] = [], zs: number[] = [];
  w.each((x, z) => { xs.push(x); zs.push(z); });
  let d = Infinity;
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) d = Math.min(d, Math.hypot(xs[i] - xs[j], zs[i] - zs[j]));
  return d;
};

test('W8-H-review walkers: a player beside a file — the row parts as a pair, no two robes merge (H-code-4)', () => {
  const walkS = 120;
  const base = MW.createWalkers(() => 2.6);
  let baseline: number;
  try { base.step('walk', walkS, 0); baseline = minPair(base); } finally { base.dispose(); }
  const n0 = MW.createWalkers(() => 2.6);
  const head = MW.headAt(walkS, n0.count());
  n0.dispose();
  const c = MW.routeAt(head.s - 3 * MW.WALK.row);
  for (const lat of [0, -0.3, -0.5, -0.7, -0.9, 0.3, 0.5, 0.7, 0.9]) {
    const w = MW.createWalkers(() => 2.6);
    try {
      // left of the walking direction is (−hz, hx)
      const px = c.x - c.hz * lat, pz = c.z + c.hx * lat;
      for (let t = 0; t < 2; t += 1 / 30) w.step('walk', walkS, t, px, pz, 1 / 30);
      const pair = minPair(w);
      assert.ok(pair >= baseline - 0.02, `player ${lat} u across: two walkers ${pair.toFixed(3)} u apart (${baseline.toFixed(3)} without the player)`);
      let near = Infinity;
      w.each((x, z) => { near = Math.min(near, Math.hypot(x - px, z - pz)); });
      assert.ok(near >= MW.ASIDE.radius - 0.12, `player ${lat} u across: the nearest walker ${near.toFixed(2)} u away`);
    } finally { w.dispose(); }
  }
});

test('W8-H-review muertos: the walkers part only round someone on the street; BAYBAY\'s aside line only on foot (H-code-5, H-RP-4)', () => {
  const m = MU.createMuertos();
  const mode0 = runtime.move.mode, glide0 = runtime.glide.active, gx0 = runtime.guide.x, gz0 = runtime.guide.z;
  try {
    __setBayNowForTests('2026-11-02T19:05');
    runtime.move.mode = 'foot';
    runtime.glide.active = false;
    const at = MU.MUERTOS_AT;
    m.step(1, at.x, 3, at.z, true);
    assert.equal(m.stats().procession, 'walk');
    const n = m.stats().walkers;
    assert.ok(n > 0);
    // the player stands in the lane a few rows behind the head (BAYBAY far off)
    const p = MW.routeAt(MW.headAt(300, n).s - 3 * MW.WALK.row);
    runtime.guide.x = p.x + 40; runtime.guide.z = p.z + 40;
    const run = (secs: number) => { for (let t = 0; t < secs; t += 1 / 30) m.step(1 / 30, p.x, 3, p.z, true); };
    const aside = () => m.near(p.x, p.z).some(l => l.line === 'processionAside');
    // gliding over the column (move mode 'glide', the glide active): no parting, no line
    runtime.move.mode = 'glide';
    runtime.glide.active = true;
    run(1.5);
    assert.ok(!aside(), 'no "step onto the sidewalk" from the air');
    // on foot: they part round the player and BAYBAY offers the line
    runtime.move.mode = 'foot';
    runtime.glide.active = false;
    run(1.5);
    assert.ok(aside(), 'on foot: the aside line is on offer');
    // in a toy car: they still part (they do not walk through the car), but no sidewalk line from the driver's seat
    runtime.move.mode = 'car';
    run(0.5);
    assert.ok(!aside(), 'no sidewalk line from a toy car');
    // and gliding again: they close their files (the line stays off)
    runtime.move.mode = 'glide';
    runtime.glide.active = true;
    run(2);
    runtime.move.mode = 'foot';
    runtime.glide.active = false;
    assert.ok(!aside(), 'back in their files once the pelican is over them');
  } finally {
    m.dispose();
    __setBayNowForTests(null);
    runtime.move.mode = mode0; runtime.glide.active = glide0; runtime.guide.x = gx0; runtime.guide.z = gz0;
  }
});

test('W8-H-review hop: while the stoops\' mesh is not drawn the pending upload ranges stay bounded and still cover every child (own finding)', async () => {
  const THREE = await import('three');
  const WD = await import('../src/opus-bay/halloween/worldDress');
  const key = [...WD.stoopIndex().keys()].find(k => (WD.stoopIndex().get(k) ?? []).filter(i => WD.stoopFigure(i) >= 0).length >= 2)!;
  const cell = WD.buildCell(key, true);
  const pos = new Float32Array(cell.pos);
  const hops = WD.hopRanges([cell], pos);
  const attr = new THREE.BufferAttribute(pos.slice(), 3);
  // ten minutes at 60 fps and the renderer never uploads (the mesh culled): the ranges never cleared
  let most = 0;
  for (let f = 0; f < 36000; f++) { WD.stepHops(hops, attr, f / 60, false); most = Math.max(most, attr.updateRanges.length); }
  assert.ok(most <= WD.HOP_RANGES_MAX + hops.length, `${most} pending ranges at most`);
  // whatever is pending covers every child's vertices (the next upload brings them all up to date)
  const covered = (v: number) => attr.updateRanges.some(r => v * 3 >= r.start && v * 3 + 3 <= r.start + r.count);
  // one more frame with every child changed (reduced motion: all back to the ground) after the cap
  WD.stepHops(hops, attr, 0, true);
  for (const h of hops) assert.ok(covered(h.start) && covered(h.start + h.count - 1), `child at ${h.start} covered`);
});
