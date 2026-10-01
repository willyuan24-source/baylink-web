import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

/**
 * Wave 8 · lane H · the Día de los Muertos procession (halloween/muertosWalkers.ts):
 *   - the walkers swing their legs while they walk (still at a corner pause and while they gather) — four instances a
 *     walker in the robes' InstancedMesh (robe, sleeve, two legs: one unit cylinder), still two meshes / two calls;
 *   - they step aside for the player: a player standing in their lane is walked round (no walker within reach of the
 *     player once they have parted), the files close again when the player leaves, and BAYBAY's w8-h-procession-aside
 *     line is offered (halloween/muertos.ts near()).
 * Before W8-H the walkers had no legs (a robe to the ground) and walked straight through the player (W7-H known gap).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };

const MW = await import('../src/opus-bay/halloween/muertosWalkers');

const foot = (m: THREE.InstancedMesh, i: number) => {
  const mat = new THREE.Matrix4();
  m.getMatrixAt(i, mat);
  return new THREE.Vector3(0, 0, 0).applyMatrix4(mat);
};

test('W8-H walkers: legs under the robe, four parts a walker in the same two meshes; the legs swing while walking, still while gathering', () => {
  const w = MW.createWalkers(() => 2.6);
  try {
    const n = w.count();
    const meshes = w.group.children as THREE.InstancedMesh[];
    assert.equal(meshes.length, 2, 'still two meshes (two calls)');
    const robes = meshes.find(m => m.count === n * MW.WALKER_PARTS);
    assert.ok(robes, `the robes' mesh draws ${MW.WALKER_PARTS} parts a walker`);
    assert.ok(MW.walkerTriangles() <= 460, `${MW.walkerTriangles()} triangles a walker`);
    // gathering: both legs stand straight (feet level under the hips)
    w.step('gather', 0, 0);
    const L0 = foot(robes, 2 * n), R0 = foot(robes, 3 * n);
    assert.ok(Math.abs(L0.y - R0.y) < 1e-3, 'feet level while gathering');
    // walking (well after 19:00, not at a corner pause): the feet move apart along the walk and change over time
    const walkS = 300;
    const spreadAt = (clock: number) => { w.step('walk', walkS, clock); return foot(robes, 2 * n).distanceTo(foot(robes, 3 * n)); };
    let most = 0, least = Infinity;
    for (let t = 0; t < 1.2; t += 0.05) { const d = spreadAt(100 + t); most = Math.max(most, d); least = Math.min(least, d); }
    if (!MW.headAt(walkS, n).paused) {
      assert.ok(most > 0.2, `the feet swing apart (${most.toFixed(3)} u at most)`);
      assert.ok(most - least > 0.1, 'and back together');
    }
    // the robe's hem is above the feet: the leg instance reaches the ground, the robe starts higher
    const robe0 = foot(robes, 0);
    assert.ok(robe0.y - L0.y > 0.15, 'the robe stops above the ankles');
  } finally { w.dispose(); }
});

test('W8-H walkers step aside: a player standing in the lane is walked round, the files close again after; BAYBAY offers the aside line', async () => {
  const w = MW.createWalkers(() => 2.6);
  try {
    const n = w.count();
    const walkS = 120;
    const head = MW.headAt(walkS, n);
    // the player stands on the route a few rows behind the head (between the two files)
    const p = MW.routeAt(head.s - 3 * MW.WALK.row);
    const minDist = () => { let d = Infinity; w.each((x, z) => { d = Math.min(d, Math.hypot(x - p.x, z - p.z)); }); return d; };
    w.step('walk', walkS, 0);
    const before = minDist();
    assert.ok(before < 0.6, `without stepping aside a walker is ${before.toFixed(2)} u from the player`);
    // the player there: the walkers slide off the player's line (dt 1/30 s, 1.5 s)
    for (let t = 0; t < 1.5; t += 1 / 30) w.step('walk', walkS, t, p.x, p.z, 1 / 30);
    const after = minDist();
    assert.ok(after >= MW.ASIDE.radius - 0.12, `after stepping aside the nearest walker is ${after.toFixed(2)} u away`);
    assert.ok(w.aside(), 'aside() says so');
    // the player walks off: the files close again (back on their lines)
    for (let t = 1.5; t < 3.5; t += 1 / 30) w.step('walk', walkS, t, p.x + 30, p.z + 30, 1 / 30);
    assert.ok(!w.aside(), 'back in their files');
    w.step('walk', walkS, 3.5);
    assert.ok(Math.abs(minDist() - before) < 0.05, 'the same places as before');
    // BAYBAY standing in the lane (the player far away): the same parting round her
    for (let t = 3.5; t < 5; t += 1 / 30) w.step('walk', walkS, t, p.x + 30, p.z + 30, 1 / 30, p.x, p.z);
    assert.ok(minDist() >= MW.ASIDE.radius - 0.12, 'they step round BAYBAY too');
    for (let t = 5; t < 7; t += 1 / 30) w.step('walk', walkS, t, p.x + 30, p.z + 30, 1 / 30, p.x + 30, p.z + 30);
    // no player passed (other callers): exactly the W7 placement
    const w2 = MW.createWalkers(() => 2.6);
    try {
      w2.step('walk', walkS, 0);
      const a: number[] = [], b: number[] = [];
      w.step('walk', walkS, 0);
      w.each((x, z) => a.push(x, z));
      w2.each((x, z) => b.push(x, z));
      assert.deepEqual(a.map(v => v.toFixed(4)), b.map(v => v.toFixed(4)));
    } finally { w2.dispose(); }
  } finally { w.dispose(); }
  // muertos.ts offers BAYBAY's aside line while they part round the player (before the watch line)
  const src = (await import('node:fs')).readFileSync(new URL('../src/opus-bay/halloween/muertos.ts', import.meta.url), 'utf8');
  assert.match(src, /walkers\?\.aside\(\)\) out\.push\(\{ key: 'procession-aside', line: 'processionAside' \}\)/);
  assert.match(src, /walkers\.step\(today\.procession, walkBase\.s \+ \(clock - walkBase\.at\), clock, px, pz, dt, runtime\.guide\.x, runtime\.guide\.z\)/);
});
