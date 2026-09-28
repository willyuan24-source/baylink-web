import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

/**
 * Wave 3, lane C2 (P2 / P3): the per-frame CPU cost of the city renderer.
 *  - one material instance per object kind: the twins link the same programs as their originals, and kindSweep puts
 *    objects (and shadow casters' depth materials) on the right twin, so three never re-looks-up a program per draw;
 *  - the L1 / L2 pools cull per item themselves (BatchedMesh with three's per-instance pass off; the no-multi-draw tile
 *    pool by compacting each tile's index), so both paths draw the same items;
 *  - Karl's cloud bank rewrites its instance colours only while its tint changes.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop), set: () => true });
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const M = await import('../src/opus-bay/world/materials');
const { BatchedPool, TilePool, ViewCull, boundsSphere, cullTilePart, hazeCullDepth, HAZE_CULL, mergePoolArrays } = await import('../src/opus-bay/world/sf/pools');
type PoolArrays = Parameters<typeof mergePoolArrays>[0][number];

const std = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> });
const compiled = (m: THREE.Material) => { const s = std(); m.onBeforeCompile(s as never, undefined as never); return s; };

test('P2: each twin links the same program as its original (same cache key, same shader)', () => {
  for (const [a, b] of [[M.TOY, M.TOY_BATCH], [M.GROUND, M.GROUND_BATCH], [M.TOY_INST, M.TOY_INST_TINT]] as const) {
    assert.notEqual(a, b);
    assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey(), `${a.name} / ${b.name}: cache key`);
    const sa = compiled(a), sb = compiled(b);
    assert.equal(sa.vertexShader, sb.vertexShader, `${a.name} / ${b.name}: vertex shader`);
    assert.equal(sa.fragmentShader, sb.fragmentShader, `${a.name} / ${b.name}: fragment shader`);
    assert.equal(a.type, b.type);
    assert.deepEqual([a.vertexColors, (a as THREE.MeshStandardMaterial).roughness, a.transparent], [b.vertexColors, (b as THREE.MeshStandardMaterial).roughness, b.transparent]);
  }
  // TOY ≡ patchToyShader (the frozen contract) still holds
  const p = std();
  M.patchToyShader(p, { sway: true });
  assert.equal(compiled(M.TOY).fragmentShader, p.fragmentShader);
});

test('P2: kindSweep puts objects on their kind\'s twin and gives instanced / skinned casters their own depth material', () => {
  const box = new THREE.BoxGeometry();
  const root = new THREE.Group();
  const tinted = new THREE.InstancedMesh(box, M.TOY_INST, 2);
  tinted.setColorAt(0, new THREE.Color(1, 0.5, 0.5));
  const plainInst = new THREE.InstancedMesh(box, M.TOY_INST_TINT, 2);
  const batched = new THREE.BatchedMesh(2, 64, 128, M.TOY);
  const batchedGround = new THREE.BatchedMesh(2, 64, 128, M.GROUND);
  const mesh = new THREE.Mesh(box, M.TOY_BATCH);
  const ok = new THREE.Mesh(box, M.TOY);
  tinted.castShadow = true;
  const bones = [new THREE.Bone()];
  const skinned = new THREE.SkinnedMesh(box, new THREE.MeshStandardMaterial());
  skinned.bind(new THREE.Skeleton(bones));
  skinned.castShadow = true;
  const leafy = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ map: new THREE.Texture(), alphaTest: 0.5 }), 1);
  leafy.castShadow = true;
  root.add(tinted, plainInst, batched, batchedGround, mesh, ok, skinned, leafy);
  const n = M.kindSweep(root);
  assert.equal(tinted.material, M.TOY_INST_TINT);
  assert.equal(plainInst.material, M.TOY_INST);
  assert.equal(batched.material, M.TOY_BATCH);
  assert.equal(batchedGround.material, M.GROUND_BATCH);
  assert.equal(mesh.material, M.TOY);
  assert.equal(ok.material, M.TOY);
  assert.ok(tinted.customDepthMaterial?.name === 'ob-depth-instColor');
  assert.ok(skinned.customDepthMaterial?.name === 'ob-depth-skinned');
  assert.equal(leafy.customDepthMaterial, undefined, 'alpha-tested maps keep three\'s own per-material depth variant');
  assert.equal(n, 7);
  assert.equal(M.kindSweep(root), 0, 'idempotent');
});

/** A flat 2 × 2 u quad item at (x, z), toy part `h` u tall (bounds only matter for culling). */
function quad(x: number, z: number, y = 0, h = 0): PoolArrays {
  const position = new Float32Array([x - 1, y, z - 1, x + 1, y, z - 1, x + 1, y + h, z + 1, x - 1, y + h, z + 1]);
  return {
    vertexCount: 4, indexCount: 6, position, normal: new Int8Array(16), color: new Uint8Array(12), info: new Float32Array(16),
    index: new Uint16Array([0, 2, 1, 0, 3, 2]), bounds: new Float32Array([x - 1, y, z - 1, x + 1, y + h, z + 1]),
  };
}

/** A camera at the origin looking down −z (so items at negative z are in view, positive z behind). */
function camera() {
  const c = new THREE.PerspectiveCamera(60, 1.5, 0.5, 3000);
  c.position.set(0, 10, 0);
  c.lookAt(0, 0, -100);
  c.updateMatrixWorld();
  return c;
}

const spots = [[0, -100], [0, 100], [400, -50], [30, -300], [-700, 200]] as const;
const inViewAt = new Set([0, 3]);

test('P3: ViewCull and item spheres', () => {
  const cull = new ViewCull();
  const s = new Float32Array(4);
  boundsSphere([quad(0, -100)], s);
  assert.ok(cull.test(s), 'no frustum yet: everything is in');
  const cam = camera();
  assert.equal(cull.from(cam), true);
  assert.equal(cull.from(cam), false, 'a camera standing still: nothing to re-test');
  spots.forEach(([x, z], i) => { boundsSphere([quad(x, z)], s); assert.equal(cull.test(s), inViewAt.has(i), `item ${i}`); });
  boundsSphere([null, null], s);
  assert.equal(s[3], -1);
  assert.equal(cull.test(s), false, 'an empty item is never drawn');
});

test('haze cull: items wholly past the depth where FogExp2 reaches 98.5 % are out; the depth follows the density', () => {
  // walking height: golden 0.0012, morning 0.0022, night 0.0018 (palette.ts); Twin Peaks / a glide thin it (cityFogK)
  assert.equal(hazeCullDepth(0.0012), 1750);
  assert.equal(hazeCullDepth(0.0022), 950);
  assert.equal(hazeCullDepth(0.0018), 1150);
  assert.equal(hazeCullDepth(0.0012 * 0.45 * 0.9, 3000), Infinity, 'high up: nothing is cut before the far plane');
  assert.equal(hazeCullDepth(0), Infinity);
  for (const rho of [0.0011, 0.0012, 0.0018, 0.0022]) {
    const d = hazeCullDepth(rho);
    assert.ok(1 - Math.exp(-((rho * d) ** 2)) >= HAZE_CULL.fog, `${rho}: ${d} u is ≥ ${HAZE_CULL.fog} haze`);
    assert.ok(1 - Math.exp(-((rho * (d - HAZE_CULL.step)) ** 2)) < HAZE_CULL.fog, `${rho}: not a step too early`);
  }
  const cull = new ViewCull();
  const cam = camera();
  const s = new Float32Array(4);
  cull.from(cam);
  boundsSphere([quad(0, -1200)], s);
  assert.equal(cull.test(s), true, 'in the frustum');
  assert.equal(cull.from(cam, 1000), true, 'a new haze depth alone re-tests');
  assert.equal(cull.test(s), false, 'wholly past the haze depth');
  boundsSphere([quad(0, -800)], s);
  assert.equal(cull.test(s), true);
  // the depth along the view, as three's fog measures it: an item off to the side at the same distance stays
  boundsSphere([quad(600, -900)], s);
  assert.equal(cull.test(s), true, `view depth ≈ 900 < 1000 at a radial ${Math.hypot(600, 900).toFixed(0)}`);
  assert.equal(cull.from(cam, 1000), false, 'same camera, same depth: nothing to re-test');
  const pool = new BatchedPool({ toyVerts: 1024, groundVerts: 1024, instances: 16 });
  pool.add(1, { toy: quad(0, -1200), ground: null }, false);
  pool.add(5, { toy: quad(0, -500), ground: null }, false);
  pool.update(cam);
  assert.equal(pool.stats().inView, 2);
  pool.update(cam, hazeCullDepth(0.0022));
  assert.equal(pool.stats().inView, 1, 'the morning haze hides the far item');
  pool.dispose();
});

test('P2 / P3: the batched pool culls per item itself (three\'s per-instance pass off), only on a change', () => {
  const pool = new BatchedPool({ toyVerts: 1024, groundVerts: 1024, instances: 16 });
  const [ground, toy] = pool.group.children as THREE.BatchedMesh[];
  assert.equal(toy.material, M.TOY_BATCH);
  assert.equal(ground.material, M.GROUND_BATCH);
  for (const b of [toy, ground]) {
    assert.equal(b.perObjectFrustumCulled, false);
    assert.equal(b.sortObjects, false);
    assert.equal(b.matrixAutoUpdate, false);
  }
  spots.forEach(([x, z], i) => pool.add(i + 1, { toy: quad(x, z, 0, 8), ground: quad(x, z) }, i % 2 === 0));
  pool.update(camera());
  const shown = () => spots.map((_, i) => toy.getVisibleAt(i));
  assert.deepEqual(shown(), spots.map((_, i) => inViewAt.has(i)));
  assert.deepEqual(spots.map((_, i) => ground.getVisibleAt(i)), spots.map((_, i) => inViewAt.has(i)));
  assert.equal(pool.stats().inView, inViewAt.size);
  assert.equal(pool.stats().visible, spots.length, 'switched on ≠ in view');
  // switched off stays off; switched on again → tested against the frustum at once
  pool.setVisible(1, false);
  assert.equal(toy.getVisibleAt(0), false);
  pool.setVisible(2, false);
  pool.setVisible(2, true);
  assert.equal(toy.getVisibleAt(1), false, 'item 2 is behind the camera');
  pool.setVisible(1, true);
  assert.equal(toy.getVisibleAt(0), true);
  // turn around: the other items come in
  const back = camera();
  back.lookAt(0, 0, 100);
  back.updateMatrixWorld();
  pool.update(back);
  assert.equal(toy.getVisibleAt(1), true);
  assert.equal(toy.getVisibleAt(0), false);
  // a new item behind the camera arrives hidden
  pool.add(99, { toy: quad(0, -150, 0, 8), ground: null }, true);
  assert.equal(toy.getVisibleAt(5), false);
  pool.dispose();
});

test('P3: the tile pool draws only the items in view (index compaction, same draw calls) — the same items as batched', () => {
  const pool = new TilePool();
  const items = spots.map(([x, z]) => ({ toy: quad(x, z, 0, 8), ground: quad(x, z) }));
  items.forEach((it, i) => pool.add(i + 1, it, true));
  const cam = camera();
  for (let i = 0; i < 12; i++) pool.update(cam); // ≤ 1 tile rebuilt per frame
  const meshes = pool.group.children as THREE.Mesh[];
  assert.ok(meshes.length >= 4, `tiles ${meshes.length / 2}`);
  let drawn = 0, full = 0;
  for (const m of meshes) {
    if (m.material === M.TOY) {
      full += m.geometry.getIndex()?.count ?? 0;
      if (m.visible) drawn += Math.min(m.geometry.drawRange.count, m.geometry.getIndex()!.count);
    }
  }
  assert.equal(full, items.length * 6);
  assert.equal(drawn, inViewAt.size * 6, 'toy indices drawn = the items in view (the batched pool draws the same)');
  assert.equal(pool.stats().inView, inViewAt.size);
  for (const m of meshes) assert.ok(m.material === M.TOY || m.material === M.GROUND, 'plain meshes keep TOY / GROUND');
  pool.dispose();
});

test('P3: cullTilePart compacts the drawn index and uploads only that range', () => {
  const m = mergePoolArrays([quad(0, -100), quad(0, 100), quad(30, -300)])!;
  const mesh = new THREE.Mesh(m.geometry, M.GROUND);
  const part = { mesh, full: m.index, ranges: m.ranges, n: 3, mask: new Uint8Array(3).fill(1), drawn: m.index.length };
  const cull = new ViewCull();
  cull.from(camera());
  assert.equal(cullTilePart(part, (s, o) => cull.test(s, o)), true);
  assert.deepEqual([...part.mask], [1, 0, 1]);
  assert.equal(mesh.geometry.drawRange.count, 12);
  const idx = mesh.geometry.getIndex()!;
  assert.deepEqual([...(idx.array as Uint16Array).slice(0, 12)], [0, 2, 1, 0, 3, 2, 8, 10, 9, 8, 11, 10]);
  assert.deepEqual(idx.updateRanges, [{ start: 0, count: 12 }]);
  assert.equal(cullTilePart(part, (s, o) => cull.test(s, o)), false, 'no change, no upload');
  assert.equal(cullTilePart(part, () => false), true);
  assert.equal(mesh.visible, false, 'nothing in view: no draw call');
});

test('Karl\'s cloud bank: instance colours rewritten only while the tint slides (was every frame)', async () => {
  const { KarlState } = await import('../src/opus-bay/world/sf/fog');
  const { CloudBank } = await import('../src/opus-bay/world/sf/cloudBank');
  const k = new KarlState();
  k.setTime('golden', true);
  const bank = new CloudBank(k);
  assert.equal(bank.mesh.material, M.TOY_INST_TINT);
  const cam = new THREE.PerspectiveCamera(50, 1.6, 0.5, 3000);
  cam.position.set(140, 115, 1000);
  cam.lookAt(-420, 0, 1180);
  for (let i = 0; i < 30; i++) { k.update(0.016); bank.update(0.016, i * 0.016, cam); }
  assert.equal(bank.tintWrites, 1, 'a steady golden bank writes its colours once');
  k.setTime('night', false);
  for (let i = 0; i < 30; i++) { k.update(0.5); bank.update(0.5, i * 0.5, cam); }
  const sliding = bank.tintWrites;
  assert.ok(sliding > 5, `the tint slides: ${sliding}`);
  for (let i = 0; i < 90; i++) { k.update(1); bank.update(1, 20 + i, cam); }
  const settled = bank.tintWrites;
  for (let i = 0; i < 30; i++) { k.update(0.016); bank.update(0.016, 200 + i * 0.016, cam); }
  assert.equal(bank.tintWrites, settled, 'settled: no more writes');
  bank.dispose();
});

test('P6: city props are chosen for the view: nothing behind the camera beyond PROP_VIEW.near, the near ring always', async () => {
  const { CityProps, PROP_VIEW, widenedFrustum } = await import('../src/opus-bay/world/sf/props');
  // a ring of trees (kind 0) every 10° at 20 u and at 60 u around the origin
  const xyzr: number[] = [], kind: number[] = [], variant: number[] = [];
  for (const r of [20, 60]) for (let a = 0; a < 360; a += 10) { xyzr.push(Math.sin(a * Math.PI / 180) * r, 0, -Math.cos(a * Math.PI / 180) * r, 0); kind.push(0); variant.push(0); }
  const sumOf = (p: InstanceType<typeof CityProps>) => Object.values(p.counts()).reduce((a, b) => a + b, 0);
  const props = new CityProps();
  props.setSource(1, { count: kind.length, kind: Uint8Array.from(kind), variant: Uint8Array.from(variant), xyzr: Float32Array.from(xyzr) });
  const cam = camera(); // at (0, 10, 0) looking down −z
  props.update(0, 0, 0, 0, cam);
  const placed = sumOf(props);
  const all = kind.length;
  // the near ring (20 u) whole, and from the far ring only what the widened frustum holds
  const f = widenedFrustum(cam, PROP_VIEW.widen, new THREE.Frustum());
  let far = 0;
  for (let a = 0; a < 360; a += 10) if (f.intersectsSphere(new THREE.Sphere(new THREE.Vector3(Math.sin(a * Math.PI / 180) * 60, 2.5, -Math.cos(a * Math.PI / 180) * 60), 4))) far++;
  assert.equal(placed, 36 + far, `placed ${placed}`);
  assert.ok(far > 6 && far < 30, `far ring in view: ${far} of 36`);
  // without a camera (tests, QA): every direction, as before
  const blind = new CityProps();
  blind.setSource(1, { count: kind.length, kind: Uint8Array.from(kind), variant: Uint8Array.from(variant), xyzr: Float32Array.from(xyzr) });
  blind.update(0, 0, 0, 0);
  assert.equal(sumOf(blind), all);
  // turning the view by more than PROP_VIEW.yaw re-selects (the props behind come in); a small turn does not
  const before = placed;
  cam.lookAt(10, 0, -100); cam.updateMatrixWorld();
  props.update(0, 0, 1, 0, cam);
  assert.equal(sumOf(props), before, 'a 6° turn keeps the selection');
  // placed positions (instance translations of every layer)
  const where = (p: InstanceType<typeof CityProps>) => {
    const out: string[] = [], m = new THREE.Matrix4(), v = new THREE.Vector3();
    for (const o of p.group.children) {
      const im = o as THREE.InstancedMesh;
      if (!im.isInstancedMesh || im.material !== M.TOY_INST_TINT) continue;
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); v.setFromMatrixPosition(m); out.push(`${Math.round(v.x)},${Math.round(v.z)}`); }
    }
    return out;
  };
  assert.ok(where(props).includes('0,-60') && !where(props).includes('0,60'), 'looking north: the far tree ahead, not the one behind');
  cam.lookAt(0, 0, 100); cam.updateMatrixWorld();
  props.update(0, 0, 2, 0, cam);
  assert.ok(where(props).includes('0,60') && !where(props).includes('0,-60'), 'turned around: the other one');
  assert.ok(where(props).includes('0,-20'), 'the near ring stays whole');
  props.dispose(); blind.dispose();
});

test('C2-10: the tier cross-fade: complementary dithers, a uniform on plain meshes, the batching alpha on the pools', () => {
  // the GLSL rule (materials.ts TIER_FADE_FRAG) for a fade value v at a dither level b
  const drawn = (v: number, b: number) => (v >= 0.999 ? true : v >= 0 ? b < v : b >= v + 2);
  for (let t = 0; t <= 1.0001; t += 0.05) {
    for (let k = 0; k < 64; k++) {
      const b = (k + 0.5) / 64;
      assert.notEqual(drawn(M.tierFadeIn(t), b), drawn(M.tierFadeOut(t), b), `t ${t.toFixed(2)} level ${k}: exactly one tier`);
    }
  }
  assert.equal(M.tierFadeIn(1), 1, 'in: solid at the end');
  assert.ok(M.tierFadeIn(0) > 0 && M.tierFadeIn(0) < 0.01, 'in: (almost) nothing at the start (0 would read as solid)');
  // both shaders run the fade first; a material that sets no fade reads 0 = solid
  for (const m of [M.TOY, M.GROUND, M.TOY_INST, M.TOY_BATCH]) {
    const s = compiled(m);
    assert.ok(s.fragmentShader.includes(M.TIER_FADE_FRAG), `${m.name}: fade block`);
    assert.equal((s.uniforms.uTierFade as THREE.IUniform<number>).value, 0, `${m.name}: solid`);
  }
  // fade pairs: own uniform, the same programs as TOY / GROUND
  const p = M.makeTierFadePair();
  assert.equal(p.toy.customProgramCacheKey(), M.TOY.customProgramCacheKey());
  assert.equal(p.ground.customProgramCacheKey(), M.GROUND.customProgramCacheKey());
  assert.equal(compiled(p.toy).fragmentShader, compiled(M.TOY).fragmentShader);
  assert.equal(compiled(p.ground).fragmentShader, compiled(M.GROUND).fragmentShader);
  p.fade.value = -1.5;
  assert.equal((compiled(p.toy).uniforms.uTierFade as THREE.IUniform<number>).value, -1.5);
  assert.equal((compiled(p.ground).uniforms.uTierFade as THREE.IUniform<number>).value, -1.5);
  assert.equal((compiled(M.TOY).uniforms.uTierFade as THREE.IUniform<number>).value, 0, 'TOY itself stays solid');
});

test('C2-10: the batched pool fades an item through its colour alpha (texture from the start); tiles cannot fade', () => {
  const pool = new BatchedPool({ toyVerts: 1024, groundVerts: 1024, instances: 16 });
  const [ground, toy] = pool.group.children as THREE.BatchedMesh[];
  const tex = (b: THREE.BatchedMesh) => (b as unknown as { _colorsTexture: THREE.DataTexture | null })._colorsTexture;
  assert.ok(tex(toy) && tex(ground), 'the colour texture exists before any item (one program variant, warmed)');
  pool.add(1, { toy: quad(0, -100, 0, 8), ground: quad(0, -100) }, true);
  const alpha = (b: THREE.BatchedMesh, i: number) => (tex(b)!.image.data as Float32Array)[i * 4 + 3];
  assert.equal(alpha(toy, 0), 1);
  assert.equal(pool.setFade(1, 0.4), true);
  assert.ok(Math.abs(alpha(toy, 0) - 0.4) < 1e-6 && Math.abs(alpha(ground, 0) - 0.4) < 1e-6);
  const rgb = [...(tex(toy)!.image.data as Float32Array).slice(0, 3)];
  assert.deepEqual(rgb, [1, 1, 1], 'the colour itself stays white');
  // a reused slot starts solid again
  pool.remove(1);
  pool.add(2, { toy: quad(0, -100, 0, 8), ground: quad(0, -100) }, true);
  assert.equal(alpha(toy, 0), 1);
  pool.dispose();
  const tiles = new TilePool();
  assert.equal(tiles.setFade(1, 0.5), false);
  tiles.dispose();
});

test('wave-3 review, C2-10: a quick flip (in, then out within TIER_FADE) keeps the newer fade on the L0 cell; the pairs die with the streamer', async () => {
  const { CityStreamer } = await import('../src/opus-bay/world/sf/stream');
  const sites = { group: new THREE.Group(), dispose: noop };
  const s = new CityStreamer({ renderer: { extensions: { has: () => true } } as never, quality: 'high', slab: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], sites: sites as never, farInit: {} as never, onFar: noop });
  type Rec = { toy: THREE.Mesh; ground: THREE.Mesh; tris: number; buildings: null; hidden: Map<number, unknown> };
  const priv = s as unknown as { time: number; fadeL0(key: number, rec: Rec, out: boolean, end?: () => void): void; finishFades(key: number): void; stepFades(): void; pairs: { toy: THREE.Material; ground: THREE.Material }[] };
  const rec: Rec = { toy: new THREE.Mesh(new THREE.BufferGeometry(), M.TOY), ground: new THREE.Mesh(new THREE.BufferGeometry(), M.GROUND), tris: 0, buildings: null, hidden: new Map() };
  // the cell comes in: its L0 dithers in on fade pair A
  priv.fadeL0(7, rec, false);
  const a = rec.toy.material;
  assert.notEqual(a, M.TOY);
  // 0.1 s later it goes out again: dropL0 fades it out on pair B, then applyVisibility settles the older fade (A)
  priv.time += 0.1;
  let freed = false;
  priv.fadeL0(7, rec, true, () => { freed = true; });
  const b = rec.toy.material, bg = rec.ground.material;
  assert.notEqual(b, a);
  priv.finishFades(7);
  assert.equal(rec.toy.material, b, 'the fading-out cell keeps pair B (was: back on TOY, solid until it popped)');
  assert.equal(rec.ground.material, bg);
  priv.time += 0.31;
  priv.stepFades();
  assert.ok(freed, 'the fade out ends and frees the cell');
  assert.equal(rec.toy.material, M.TOY);
  // the pairs are the streamer's own material instances: disposed with it
  let disposed = 0;
  assert.equal(priv.pairs.length, 2);
  for (const p of priv.pairs) for (const m of [p.toy, p.ground]) m.addEventListener('dispose', () => { disposed++; });
  s.dispose();
  assert.equal(disposed, 4);
});

test('P5 (E2 request 3): the warm-up carries the shadow pass depth programs of plain casters, kept alive', async () => {
  const { shadowDepthSet, WARM_DEPTH_KINDS } = await import('../src/opus-bay/world/warmup');
  const a = shadowDepthSet();
  const mats = a.group.children.map(o => (o as THREE.Mesh).material as THREE.MeshDepthMaterial);
  // plain casters first (three's internal depth material: FrontSide materials cast BackSide, DoubleSide stays) …
  assert.deepEqual(mats.slice(0, 2).map(m => [m.type, m.side, m.depthPacking]), [['MeshDepthMaterial', THREE.BackSide, THREE.BasicDepthPacking], ['MeshDepthMaterial', THREE.DoubleSide, THREE.BasicDepthPacking]]);
  assert.ok(a.group.children.slice(0, 2).every(o => (o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !(o as THREE.BatchedMesh).isBatchedMesh));
  // … then (W4-V8) both sides of every other caster kind: instanced without / with instanceColor (kindSweep's depth
  // materials; the instColor one linked at the Palace after the warm-up), batched without / with colours (the fleet)
  assert.deepEqual([...WARM_DEPTH_KINDS], ['inst', 'instColor', 'batched', 'batchedColor']);
  const kinds = a.group.children.slice(2).map(o => {
    const i = o as THREE.InstancedMesh, b = o as THREE.BatchedMesh & { _colorsTexture: THREE.Texture | null };
    const m = i.material as THREE.MeshDepthMaterial;
    return `${i.isInstancedMesh ? (i.instanceColor ? 'instColor' : 'inst') : b.isBatchedMesh ? (b._colorsTexture ? 'batchedColor' : 'batched') : '?'}:${m.side}:${m.type}`;
  });
  assert.deepEqual(kinds, WARM_DEPTH_KINDS.flatMap(k => [`${k}:${THREE.BackSide}:MeshDepthMaterial`, `${k}:${THREE.DoubleSide}:MeshDepthMaterial`]));
  const all = a.group.children.map(o => (o as THREE.Mesh).material as THREE.MeshDepthMaterial);
  let disposed = 0;
  for (const m of all) m.addEventListener('dispose', () => disposed++);
  a.dispose();
  assert.equal(disposed, 0, 'three would drop the programs with their last material');
  const b = shadowDepthSet();
  assert.deepEqual(b.group.children.map(o => (o as THREE.Mesh).material), all, 'the same instances every warm-up');
  assert.ok(b.target.isWebGLRenderTarget, 'compiled into a render target, like the shadow map (no tone mapping)');
  b.dispose();
});

test('W4-V8: a warm-up set registered after the boot warm-up compiles by itself against the last render state', async () => {
  const warm = await import('../src/opus-bay/world/warmup');
  const compiled: { names: string[]; target: unknown }[] = [];
  let target: unknown = null;
  const renderer = {
    info: { programs: [] as unknown[] },
    shadowMap: { enabled: true },
    getRenderTarget: () => target,
    setRenderTarget: (t: unknown) => { target = t; },
    compileAsync: (group: THREE.Object3D) => {
      const names: string[] = [];
      group.traverse(o => { if (o !== group && o.name) names.push(o.name); });
      compiled.push({ names, target });
      renderer.info.programs.push({});
      return Promise.resolve();
    },
  } as unknown as THREE.WebGLRenderer;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  warm.resetWarmupState();
  const named = (name: string, cast = false) => () => { const o = new THREE.Object3D(); o.name = name; o.castShadow = cast; return { objects: [o] }; };
  const offEarly = warm.registerWarmup('t-early', named('early'));
  await warm.warmPrograms(renderer, scene, camera, { offscreen: true });
  assert.ok(compiled[0].names.includes('early'), 'the boot pass compiles the sets registered before it');
  assert.ok((compiled[0].target as THREE.WebGLRenderTarget)?.isWebGLRenderTarget, 'offscreen path: into a render target');
  compiled.length = 0;
  // a lazy chunk registers two sets back to back: one late pass with only them, same render path, no base dummies
  const offA = warm.registerWarmup('t-late-a', named('late-a'));
  const offB = warm.registerWarmup('t-late-b', named('late-b', true));
  assert.equal(compiled.length, 0, 'not inside the registering call');
  await new Promise(r => setTimeout(r, 80));
  assert.deepEqual(compiled[0].names, ['late-a', 'late-b']);
  assert.ok((compiled[0].target as THREE.WebGLRenderTarget)?.isWebGLRenderTarget, 'the last warm-up\'s render path');
  assert.equal(compiled.length, 2, 'late-b casts: the depth set follows');
  assert.equal(target, null, 'the render target is restored');
  assert.deepEqual(warm.lateWarmups.at(-1)?.keys, ['t-late-a', 't-late-b']);
  for (const off of [offEarly, offA, offB]) off();
  warm.resetWarmupState();
});

test('W4-V part b: one live object per material (all, or only the visible ones), never a warm-up dummy', async () => {
  const { liveObjects } = await import('../src/opus-bay/world/warmup');
  const scene = new THREE.Scene();
  const mA = new THREE.MeshBasicMaterial(), mB = new THREE.MeshBasicMaterial(), mC = new THREE.MeshBasicMaterial();
  const a = new THREE.Mesh(new THREE.BoxGeometry(), mA); a.name = 'a';
  const a2 = new THREE.Mesh(new THREE.BoxGeometry(), mA); a2.name = 'a2';
  const hidden = new THREE.Group(); hidden.visible = false;
  const b = new THREE.Mesh(new THREE.BoxGeometry(), mB); b.name = 'b';
  hidden.add(b);
  const dummy = new THREE.Mesh(new THREE.BoxGeometry(), mC); dummy.name = 'ob-warmup-x';
  scene.add(a, a2, hidden, dummy, new THREE.Object3D());
  assert.deepEqual(liveObjects(scene, false).map(o => o.name), ['a', 'b'], 'the first object per material (three\'s own rule), hidden ones too');
  assert.deepEqual(liveObjects(scene, true).map(o => o.name), ['a'], 'visible only');
});

test('W4-V part b: the live scene at this level, then the next level (dummies + visible objects) with the shadows lifted only during each compile', async t => {
  const warm = await import('../src/opus-bay/world/warmup');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls: { names: string[]; shadowMap: boolean; sunCasts: boolean; target: unknown }[] = [];
  let target: unknown = null;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true;
  const seen = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); seen.name = 'seen';
  const twin = new THREE.Mesh(new THREE.BoxGeometry(), seen.material); twin.name = 'twin';
  const night = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); night.name = 'night-only'; night.visible = false;
  scene.add(sun, seen, twin, night);
  const renderer = {
    info: { programs: [] as unknown[] },
    shadowMap: { enabled: true },
    getRenderTarget: () => target,
    setRenderTarget: (tg: unknown) => { target = tg; },
    compileAsync: (root: THREE.Object3D) => {
      const names: string[] = [];
      root.traverse(o => { if (o.name && !o.name.startsWith('ob-warmup')) names.push(o.name); });
      calls.push({ names, shadowMap: renderer.shadowMap.enabled, sunCasts: sun.castShadow, target });
      renderer.info.programs.push({});
      return Promise.resolve();
    },
  } as unknown as THREE.WebGLRenderer;
  const drive = async (ms: number) => { for (let i = 0; i < ms / 8; i++) { for (let k = 0; k < 6; k++) await Promise.resolve(); t.mock.timers.tick(8); } };
  warm.resetWarmupState();
  const off = warm.registerWarmup('t-set', () => { const o = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); o.name = 'set'; return { objects: [o] }; });
  const pBoot = warm.warmPrograms(renderer, scene, camera, { offscreen: false, next: { shadows: false } });
  await drive(8);
  await pBoot;
  const boot = calls.filter(c => c.names.includes('set'));
  assert.ok(boot.length >= 1 && boot.every(c => c.shadowMap && c.sunCasts), 'the boot pass at this level');
  const nBoot = calls.length;
  await drive(warm.NEXT_WARM_MS - 100);
  assert.equal(calls.length, nBoot, 'nothing more before NEXT_WARM_MS');
  await drive(100 + (warm.LIVE_GAP_MS + 8) * 40);
  const later = calls.slice(nBoot);
  const live = later.filter(c => c.shadowMap), next = later.filter(c => !c.shadowMap);
  assert.deepEqual(live.map(c => c.names), [['seen'], ['night-only']], 'the live scene at this level: one call per material, hidden objects too');
  assert.ok(next.length > 3 && next.every(c => !c.sunCasts), 'the next level (low): no shadow map, no casting light, during every call');
  assert.ok(next.some(c => c.names.includes('set')), 'the next level compiles the registered sets');
  assert.ok(next.some(c => c.names.includes('seen')) && !next.some(c => c.names.includes('night-only')) && !next.some(c => c.names.includes('twin')), 'and the visible live objects');
  assert.ok(later.every(c => c.names.length <= 1), 'LIVE_BATCH = 1: one object per compile call');
  assert.ok(renderer.shadowMap.enabled && sun.castShadow && target === null, 'the state is restored after the passes');
  assert.deepEqual(warm.lateWarmups.slice(-2).map(l => [l.keys, !!l.next]), [['live', false], ['all', true]]);
  off();
  warm.resetWarmupState();
});
