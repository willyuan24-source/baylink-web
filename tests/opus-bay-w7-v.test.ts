/**
 * Wave 7 · lane V: the painted particle atlas and the richer fx pool (W7-V2), the characters' felt (W7-V3).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');

// --- headless canvas stub (the fx pool draws its fallback atlas on a canvas) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'measureText' ? () => ({ width: 10 }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

/** WebP canvas size from its header (VP8 lossy, VP8L lossless, VP8X extended) */
function webpSize(buf: Buffer): { w: number; h: number; alpha: boolean } {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), alpha: (buf[20] & 0x10) !== 0 };
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff), alpha: ((b >> 28) & 1) === 1 }; }
  assert.equal(kind, 'VP8 ');
  return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, alpha: false };
}

test('W7-V2 · the painted fx atlas: 512 × 512 with alpha, small, the cells the shader addresses', async () => {
  const { FX_ATLAS_URL, FX_SHAPE } = await import('../src/opus-bay/world/fx');
  const file = path.join(ROOT, 'public', FX_ATLAS_URL);
  assert.ok(fs.existsSync(file), `${FX_ATLAS_URL} exists`);
  const buf = fs.readFileSync(file);
  const s = webpSize(buf);
  assert.deepEqual([s.w, s.h], [512, 512]);
  assert.ok(s.alpha, 'the atlas has an alpha channel (coverage)');
  assert.ok(buf.length < 64_000, `small (${buf.length} B)`);
  const cells = Object.values(FX_SHAPE);
  assert.equal(new Set(cells).size, cells.length, 'one cell per shape');
  assert.ok(cells.every(c => Number.isInteger(c) && c >= 0 && c < 16), 'every shape fits the 4 × 4 grid (code < 16)');
});

test('W7-V2 · every preset spawns into the one pool and dies out; the mesh hides when nothing is alive', async () => {
  const { FxPool } = await import('../src/opus-bay/world/fx');
  const { game } = await import('../src/opus-bay/core/store');
  game.set({ worldMode: 'district' });
  const pool = new FxPool([{ x: 0, y: 0, z: 0 }]);
  try {
    for (const p of ['dust', 'splash', 'sparkle', 'rings', 'hearts', 'notes', 'coin', 'confetti', 'wake', 'wisp', 'leaves'] as const) {
      const before = pool.count;
      pool.spawn(p, 1, 0, 1);
      assert.ok(pool.count > before, `${p} spawns`);
    }
    assert.ok(pool.count <= 256);
    pool.update(0.016);
    assert.equal(pool.mesh.count, pool.count);
    assert.ok(pool.mesh.visible);
    // flood: never past the pool
    for (let i = 0; i < 40; i++) pool.spawn('confetti', 0, 0, 0);
    assert.equal(pool.count, 256);
    for (let i = 0; i < 40 * 30; i++) pool.update(1 / 30);
    assert.equal(pool.count, 0, 'everything dies (the longest, a wisp, lives 12 s)');
    assert.equal(pool.mesh.visible, false);
    assert.equal(pool.mesh.count, 0);
  } finally { pool.dispose(); }
});

test('W7-V2 · the pool listens: dust on sand / dirt steps only, a coin pop except for coins that sparkle by themselves', async () => {
  const { FxPool } = await import('../src/opus-bay/world/fx');
  const { emit } = await import('../src/opus-bay/core/events');
  const { game } = await import('../src/opus-bay/core/store');
  game.set({ worldMode: 'district' });
  const pool = new FxPool();
  try {
    const n = () => pool.count;
    emit({ type: 'footstep', surface: 'pavement', run: false });
    emit({ type: 'footstep', surface: 'grass', run: true });
    assert.equal(n(), 0, 'no dust on pavement or grass');
    emit({ type: 'footstep', surface: 'sand', run: false });
    assert.equal(n(), 2);
    emit({ type: 'footstep', surface: 'dirt', run: true });
    assert.equal(n(), 5);
    const c0 = n();
    emit({ type: 'coins', total: 10, delta: 1, source: 'trail:filbert-steps:3' });
    emit({ type: 'coins', total: 10, delta: 5, source: 'cache:bernal-top' });
    emit({ type: 'coins', total: 10, delta: -5, source: 'shop:hat' });
    assert.equal(n(), c0, 'no pop for a picked coin (it sparkles where it lay) or a purchase');
    emit({ type: 'coins', total: 20, delta: 10, source: 'postcard:coit-tower' });
    assert.ok(n() > c0, 'a paid reward pops');
    const c1 = n();
    emit({ type: 'play', activity: 'kite', what: 'end', tier: 3 });
    assert.ok(n() >= c1 + 20, 'a ★ ends in confetti');
  } finally { pool.dispose(); }
});

test('W7-V2 · Golden Gate fog wisps: city mode, near the bridge, quality mid / high only, at most WISP.max', async () => {
  const { FxPool, GGB, WISP } = await import('../src/opus-bay/world/fx');
  const { game } = await import('../src/opus-bay/core/store');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const run = (mode: 'city' | 'district', quality: 'low' | 'mid' | 'high', at: { x: number; z: number }) => {
    game.set(s => ({ worldMode: mode, settings: { ...s.settings, quality, reducedMotion: false } }));
    Object.assign(runtime.player, { x: at.x, y: 1, z: at.z });
    const pool = new FxPool();
    let most = 0;
    for (let i = 0; i < 60 * 30; i++) { pool.update(1 / 30); most = Math.max(most, pool.wispCount); }
    const now = pool.wispCount;
    pool.dispose();
    return { most, now };
  };
  const near = { x: GGB.x + 60, z: GGB.z + 80 };
  const city = run('city', 'high', near);
  assert.ok(city.now >= 4 && city.most <= WISP.max, `wisps near the bridge (${city.now}, at most ${city.most})`);
  assert.equal(run('city', 'mid', near).most > 0, true);
  assert.equal(run('city', 'low', near).most, 0, 'none at quality low');
  assert.equal(run('district', 'high', near).most, 0, 'none in the district');
  assert.equal(run('city', 'high', { x: 131, z: 15 }).most, 0, 'none far from the bridge (the Ferry Building)');
  game.set(s => ({ worldMode: 'district', settings: { ...s.settings, quality: 'high' } }));
});

test('W7-V3 · felt: the file, the patched character shader, the hard toys on the same program without felt', async () => {
  const THREE = await import('three');
  const m = await import('../src/opus-bay/actors/models');
  const file = path.join(ROOT, 'public', m.FELT_URL);
  assert.ok(fs.existsSync(file));
  const buf = fs.readFileSync(file);
  const s = webpSize(buf);
  assert.deepEqual([s.w, s.h], [256, 256]);
  assert.ok(buf.length < 40_000, `small (${buf.length} B)`);
  assert.ok(m.feltUniforms.feltAmt.value > 0 && m.baybayFelt.feltAmt.value > 0 && m.noFelt.feltAmt.value === 0 && m.noFelt.feltBump.value === 0);
  assert.equal(m.feltUniforms.feltMap, m.baybayFelt.feltMap, 'one felt texture for every material');
  // the three chunks the patch hooks into must exist in this three's standard shader (a silent miss = no felt)
  const char = m.characterMaterial(), hard = m.hardToyMaterial();
  assert.equal(char.customProgramCacheKey(), hard.customProgramCacheKey(), 'the hard toys reuse the characters\' program');
  for (const mat of [char, hard]) {
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
    for (const s2 of ['vObN = objectNormal;', 'vObP = position;']) assert.ok(shader.vertexShader.includes(s2), s2);
    for (const s2 of ['float obFeltV', 'diffuseColor.rgb *= 1.0 + obFeltV * feltAmt;', 'normal = normalize(abs(obDet) * normal - obGrad);', 'obFeltV * feltAmt * 2.5']) assert.ok(shader.fragmentShader.includes(s2), s2);
    assert.ok(shader.uniforms.feltMap && shader.uniforms.feltAmt && shader.uniforms.feltBump);
  }
  // the hard toys' uniforms are the felt-free ones: build both shaders again and compare the amounts they carry
  const u = { uniforms: {} as Record<string, { value: number }>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  hard.onBeforeCompile(u as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
  assert.equal(u.uniforms.feltAmt.value, 0);
});

test('W7-V3 · the rigs: the player and BAYBAY keep every bone name; the toy car and the bike are hard toys', async () => {
  const m = await import('../src/opus-bay/actors/models');
  const v = await import('../src/opus-bay/actors/vehicles/models');
  const player = m.buildNewcomer();
  assert.deepEqual(Object.keys(player.bones).sort(), ['armL', 'armR', 'body', 'eyes', 'footL', 'footR', 'hat', 'pack', 'root']);
  assert.equal(player.mesh.material, m.characterMaterial());
  const baybay = m.buildBaybay();
  assert.ok(['root', 'body', 'head'].every(b => b in baybay.bones));
  assert.equal(baybay.mesh.material, m.characterMaterial());
  assert.equal(v.buildToyCarRig().mesh.material, m.hardToyMaterial());
  assert.equal(v.buildBikeRig().mesh.material, m.hardToyMaterial());
  assert.equal(v.buildPelicanRig().mesh.material, m.characterMaterial(), 'the pelican is a plush toy');
});

test('W7-V4 · the AI de Young tower: registered, the file matches its row, Draco + one WebP ≤ 1024², ≤ 4k triangles, shipped by the site', async () => {
  const { ASSETS, SF_MODELS, SF_MODEL_IDS, listAssetUrls } = await import('../src/opus-bay/data/assets');
  const { W7V_MODELS, W7V_MODEL_IDS } = await import('../src/opus-bay/data/sf/w7vModels');
  const { deYoungTower } = await import('../src/opus-bay/world/sf/landmarks/de-young-tower');
  const { usesAi } = await import('../src/opus-bay/world/sf/landmarks/index');
  const urls = new Set(listAssetUrls());
  for (const id of W7V_MODEL_IDS) {
    const a = W7V_MODELS[id];
    assert.ok(!(SF_MODEL_IDS as readonly string[]).includes(id), `${id} is new`);
    assert.equal(SF_MODELS[id], a); assert.equal(ASSETS.models[id], a); assert.ok(urls.has(a.url), `${id} listed`);
    const buf = fs.readFileSync(path.join(ROOT, 'public', a.url));
    assert.equal(buf.readUInt32LE(0), 0x46546c67, 'a GLB');
    assert.equal(buf.length, a.bytes, `${id} bytes`);
    const jl = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8')) as { extensionsRequired?: string[]; accessors: { count: number; min?: number[]; max?: number[] }[]; meshes: { primitives: { attributes: Record<string, number>; indices: number; extensions?: Record<string, unknown> }[] }[]; images?: { mimeType?: string; bufferView: number }[]; bufferViews: { byteOffset?: number; byteLength: number }[] };
    assert.deepEqual([...(json.extensionsRequired ?? [])].sort(), ['EXT_texture_webp', 'KHR_draco_mesh_compression']);
    assert.equal(json.meshes.length, 1); assert.equal(json.meshes[0].primitives.length, 1, 'one draw');
    const prim = json.meshes[0].primitives[0];
    assert.equal(json.accessors[prim.indices].count / 3, a.triangles);
    assert.ok(a.triangles <= 4000, '≤ 4k triangles (a T1 part)');
    const pos = json.accessors[prim.attributes.POSITION];
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(pos.max![k] - pos.min![k] - a.size[k]) <= a.size[k] * 0.02, `size[${k}]`);
    assert.ok(Math.abs(pos.min![1]) < 1e-3, 'rests on y = 0');
    assert.equal(json.images?.length, 1);
    const bin = 20 + jl + 8, bv = json.bufferViews[json.images![0].bufferView];
    const s = webpSize(buf.subarray(bin + (bv.byteOffset ?? 0), bin + (bv.byteOffset ?? 0) + bv.byteLength));
    assert.ok(s.w <= 1024 && s.h <= 1024, 'texture ≤ 1024²');
    assert.ok(a.bytes < 150_000, 'small');
    assert.equal(a.landmarkId, 'de-young-tower');
  }
  // the site ships it: the swap part names the model, the remainder keeps the museum, the walk data follows the AI tower
  assert.ok(deYoungTower.swap && usesAi(deYoungTower));
  assert.deepEqual(deYoungTower.swap!.parts.map(p => p.model), ['sf-de-young-tower']);
  const tri = (fn: (b: { add: () => void }) => void) => { let n = 0; const b = new Proxy({}, { get: () => () => { n++; } }); fn(b as never); return n; };
  assert.ok(tri(b => deYoungTower.swap!.build(b as never)) < tri(b => deYoungTower.build(b as never, 0)), 'the remainder draws less than the full procedural site (no tower)');
});

test('W7-V-review · the felt bump takes its screen-space derivatives in uniform control flow (GLSL ES 3.00 §8.9: dFdx / dFdy are undefined inside a branch that differs per pixel)', async () => {
  const THREE = await import('three');
  const m = await import('../src/opus-bay/actors/models');
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.characterMaterial().onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
  const frag = shader.fragmentShader;
  const start = frag.indexOf('float obNear'), branch = frag.indexOf('if (obNear', start);
  assert.ok(start > 0 && branch > start, 'the felt bump is in the shader');
  const end = frag.indexOf('#include', branch);
  const inBranch = frag.slice(branch, end < 0 ? undefined : end);
  assert.ok(!/dFd[xy]\s*\(/.test(inBranch), `no derivative inside the per-pixel branch:\n${inBranch}`);
  assert.ok(/dFdx\(obFeltV\)/.test(frag.slice(start, branch)), 'the height derivatives are taken before the branch');
});
