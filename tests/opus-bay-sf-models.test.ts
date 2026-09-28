import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { ASSETS, SF_DRACO_DECODER_PATH, SF_KIT, SF_KIT_IDS, SF_MODELS, SF_MODEL_IDS, listAssetUrls } from '../src/opus-bay/data/assets';
import { TOY, U, makeHeroMaterial } from '../src/opus-bay/world/materials';
import { MODEL_INST_ATTR, MODEL_TINT_ATTR, MODEL_VARIANTS, keyLuminance, makeModelMaterial, modelInstanceGeometry, modelWarmupSet, setModelInstance } from '../src/opus-bay/world/modelMaterial';
import * as models from '../src/opus-bay/world/models';
import { AI_R, CitySites, LOD0, buildGroundMesh, buildSwapObjects, disposeSwapObjects, fadeOccludes } from '../src/opus-bay/world/sf/sites';
import { pointInPolygon } from '../src/opus-bay/core/terrain';
import type { Vec2 } from '../src/opus-bay/core/types';
import { SF_LANDMARKS, type SfLandmark, landmarkToWorld } from '../src/opus-bay/world/sf/landmarks/index';
import { Batch } from '../src/opus-bay/world/builder';

/**
 * Lane D2 (wave 2): the AI-mesh runtime — world/models.ts (shared GLTF + Draco loader, cache), world/modelMaterial.ts
 * (the TOY look on a textured GLB, its program variants and warm-up set), the registry in data/assets.ts against the
 * files on disk, and the swap objects world/sf/sites.ts builds. No WebGL here: shader strings are checked as text.
 */

const PUBLIC = path.resolve(import.meta.dirname, '../public');
const fileOf = (url: string) => path.join(PUBLIC, url);

interface GlbInfo { bytes: number; json: { extensionsRequired?: string[]; accessors: { count: number; min?: number[]; max?: number[] }[]; meshes: { primitives: { attributes: Record<string, number>; indices: number; extensions?: Record<string, unknown> }[] }[]; images?: { mimeType?: string }[] } }
function glb(url: string): GlbInfo {
  const buf = fs.readFileSync(fileOf(url));
  assert.equal(buf.readUInt32LE(0), 0x46546c67, `${url} is a GLB`);
  const len = buf.readUInt32LE(12);
  return { bytes: buf.length, json: JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) };
}
const isWebp = (url: string) => { const b = fs.readFileSync(fileOf(url)); return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'; };
/** Pixel size of the GLB's embedded WebP textures (VP8 / VP8L / VP8X headers). */
function glbTextureSizes(url: string): [number, number][] {
  const buf = fs.readFileSync(fileOf(url));
  const len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  const bin = 20 + len + 8;
  return (json.images ?? []).map((im: { bufferView: number }) => {
    const bv = json.bufferViews[im.bufferView], w = buf.subarray(bin + (bv.byteOffset ?? 0), bin + (bv.byteOffset ?? 0) + bv.byteLength);
    assert.equal(w.subarray(8, 12).toString(), 'WEBP');
    const kind = w.subarray(12, 16).toString();
    if (kind === 'VP8X') return [1 + w.readUIntLE(24, 3), 1 + w.readUIntLE(27, 3)];
    if (kind === 'VP8L') { const b = w.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
    return [w.readUInt16LE(26) & 0x3fff, w.readUInt16LE(28) & 0x3fff];
  });
}

test('models.ts is node-safe: importing touches no DOM, every load resolves null without a browser', async () => {
  assert.equal(models.canLoadModels(), false);
  models.preloadDraco();
  assert.equal(await models.loadModel('sf-dragon-gate'), null);
  assert.equal(await models.loadModel('no-such-model'), null);
  assert.equal(await models.retainModel('sf-conservatory'), null);
  models.releaseModel('sf-conservatory');
  assert.equal(models.peekModel('sf-dragon-gate'), null);
  assert.equal(models.modelState('sf-dragon-gate'), null, 'nothing cached outside a browser');
  assert.deepEqual(models.modelStats(), { ready: 0, loading: 0, failed: 0, retained: 0, triangles: 0, failures: 0 });
  assert.ok(models.KEEP_UNUSED >= 4);
  models.disposeModels();
});

test('registry: every SF model / kit house matches its file (bytes, triangles, bounds within 2 %), Draco + WebP, masks, size caps', () => {
  const all = [...SF_MODEL_IDS.map(id => [id, SF_MODELS[id]] as const), ...SF_KIT_IDS.map(id => [id, SF_KIT[id]] as const)];
  assert.equal(all.length, 24);
  for (const [id, a] of all) {
    const g = glb(a.url);
    assert.equal(g.bytes, a.bytes, `${id} bytes`);
    const prim = g.json.meshes[0].primitives[0];
    assert.equal(g.json.accessors[prim.indices].count / 3, a.triangles, `${id} triangles`);
    assert.deepEqual([...(g.json.extensionsRequired ?? [])].sort(), ['EXT_texture_webp', 'KHR_draco_mesh_compression'], `${id} Draco + WebP`);
    assert.ok(prim.extensions?.KHR_draco_mesh_compression, `${id} Draco primitive`);
    assert.ok(g.json.images?.every(i => i.mimeType === 'image/webp'), `${id} WebP texture`);
    const pos = g.json.accessors[prim.attributes.POSITION];
    const size = [0, 1, 2].map(k => pos.max![k] - pos.min![k]);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(size[k] - a.size[k]) <= a.size[k] * 0.02, `${id} size[${k}] ${size[k].toFixed(2)} vs ${a.size[k]}`);
    // origin at the ground centre: rests on y = 0, centred in x and z
    assert.ok(Math.abs(pos.min![1]) < 1e-3 && Math.abs(pos.min![0] + pos.max![0]) < 0.02 && Math.abs(pos.min![2] + pos.max![2]) < 0.02, `${id} origin`);
    const mask = (a as { mask?: string }).mask;
    if (mask) assert.ok(isWebp(mask), `${id} mask is a WebP`);
    // textures: 1024 px for the landmark heroes, 512 px for the houses (GPU memory on phones: ≈ 5.3 MB per hero with mips)
    for (const [w, h] of glbTextureSizes(a.url)) assert.ok(w === h && w <= (a.kind === 'hero' ? 1024 : 512), `${id} texture ${w}×${h}`);
    const cap = a.kind === 'hero' ? 250_000 : 90_000;
    assert.ok(a.bytes <= cap, `${id} ${a.bytes} B ≤ ${cap}`);
    assert.ok(a.triangles <= (a.kind === 'hero' ? 10_000 : 3_500), `${id} triangles`);
    assert.equal(ASSETS.models[id], a);
  }
  const urls = listAssetUrls();
  for (const f of ['draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
    assert.ok(fs.statSync(fileOf(`${SF_DRACO_DECODER_PATH}${f}`)).size > 10_000, f);
    assert.ok(urls.includes(`${SF_DRACO_DECODER_PATH}${f}`), f);
  }
});

/** onBeforeCompile on MeshStandardMaterial's real shader sources (what three hands the hook). */
function compile(m: THREE.Material) {
  const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader } as unknown as THREE.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, undefined as unknown as THREE.WebGLRenderer);
  return shader;
}
const count = (s: string, sub: string) => s.split(sub).length - 1;

test('model material: two program variants on the TOY patch (applied once), map + mask + tint + glass, shared programs', () => {
  assert.deepEqual([...MODEL_VARIANTS], ['ob-model-hero', 'ob-model-inst']);
  const map = new THREE.Texture();
  const fade = { value: 0.2 };
  const hero = makeModelMaterial({ map, variant: 'ob-model-hero', fade, tintKey: '#cfe0d0', glass: { color: '#ffe2b0', strength: 0.9 } });
  const inst = makeModelMaterial({ map, variant: 'ob-model-inst' });
  assert.equal(hero.customProgramCacheKey(), 'ob-model-hero');
  assert.equal(inst.customProgramCacheKey(), 'ob-model-inst');
  assert.ok(hero.defines && 'OB_HERO' in hero.defines, 'hero: whole-mesh fade');
  assert.ok(!inst.defines || !('OB_HERO' in inst.defines), 'houses: per-fragment occlusion dither');
  assert.equal(hero.map, map);
  assert.equal(hero.vertexColors, false);
  const h = compile(hero), i = compile(inst);
  for (const s of [h, i]) {
    assert.equal(count(s.fragmentShader, 'float obBayer8('), 1, 'TOY patch applied exactly once');
    assert.equal(count(s.vertexShader, 'vWPos = obWp.xyz;'), 1);
    assert.ok(s.fragmentShader.includes('texture2D(uObMask, vMapUv)'), 'mask sampled with the map UVs');
    assert.ok(s.fragmentShader.indexOf('#include <map_fragment>') < s.fragmentShader.indexOf('uObMask, vMapUv'), 'tint after the map');
    assert.ok(s.vertexShader.includes('vInfo = vec4(0.0, obO.y, -obSeed, vObInst.w);'), 'aInfo synthesized after the TOY vertex patch');
    assert.ok(s.vertexShader.indexOf('vInfo = aInfo;') < s.vertexShader.indexOf('vInfo = vec4(0.0, obO.y'));
  }
  assert.ok(h.fragmentShader.includes('uniform float uHeroFade;') && !i.fragmentShader.includes('uniform float uHeroFade;'));
  assert.equal(h.uniforms.uHeroFade, fade, 'the landmark fade uniform is shared, not copied');
  assert.equal((h.uniforms.uObGlass.value as THREE.Vector4).w, 0.9);
  assert.ok(Math.abs((h.uniforms.uObKeyLum.value as number) - keyLuminance('#cfe0d0')) < 1e-9);
  // a second material of the same variant compiles to the same source (three shares one program per key)
  const hero2 = makeModelMaterial({ map: new THREE.Texture(), variant: 'ob-model-hero' });
  const h2 = compile(hero2);
  assert.equal(h2.vertexShader, h.vertexShader);
  assert.equal(h2.fragmentShader, h.fragmentShader);
  assert.notEqual(h2.uniforms.uObMask, h.uniforms.uObMask, 'per-material uniforms');
  // without a mask: a black 1×1 one (no tint, no glass), same program
  assert.ok((h2.uniforms.uObMask.value as THREE.DataTexture).isDataTexture);
  for (const m of [hero, inst, hero2]) m.dispose();
});

test('model instances: aObTint / aObInst per instance, sharing the model geometry', () => {
  const box = new THREE.BoxGeometry(1, 2, 1);
  const g = modelInstanceGeometry(box, 3);
  assert.equal(g.getAttribute('position'), box.getAttribute('position'), 'positions shared, not copied');
  const t = g.getAttribute(MODEL_TINT_ATTR) as THREE.InstancedBufferAttribute, a = g.getAttribute(MODEL_INST_ATTR) as THREE.InstancedBufferAttribute;
  assert.ok(t.isInstancedBufferAttribute && a.isInstancedBufferAttribute && t.count === 3 && a.count === 3);
  assert.deepEqual([a.getX(1), a.getY(1)], [0, 1], 'default: solid (fade 1)');
  setModelInstance(g, 2, '#ffffff', 0.8, 0.4, 0.5, 0.3, 0.08);
  assert.ok(Math.abs(t.getX(2) - 1) < 1e-6 && Math.abs(t.getW(2) - 0.8) < 1e-6);
  assert.deepEqual([a.getX(2), a.getY(2), a.getZ(2), a.getW(2)].map(v => +v.toFixed(3)), [0.4, 0.5, 0.3, 0.08]);
  setModelInstance(g, 0, null, 1);
  assert.equal(t.getW(0), 0, 'no tint');
});

test('warm-up set: one object per model variant plus the per-landmark hero TOY program, built like the real meshes', () => {
  const set = modelWarmupSet();
  const keys = set.objects.map(o => ((o as THREE.Mesh).material as THREE.Material).customProgramCacheKey());
  assert.deepEqual(keys, ['ob-model-hero', 'ob-model-inst', 'ob-toy-hero']);
  const [hero, inst, toy] = set.objects as THREE.Mesh[];
  assert.ok(!(hero as THREE.InstancedMesh).isInstancedMesh && (inst as THREE.InstancedMesh).isInstancedMesh && !(toy as THREE.InstancedMesh).isInstancedMesh);
  for (const m of [hero, inst]) {
    assert.ok((m.material as THREE.MeshStandardMaterial).map, 'USE_MAP like a GLB');
    assert.ok(m.geometry.getAttribute('normal') && m.geometry.getAttribute('uv'));
  }
  assert.ok(inst.geometry.getAttribute(MODEL_TINT_ATTR) && inst.geometry.getAttribute(MODEL_INST_ATTR));
  assert.equal((toy.material as THREE.MeshStandardMaterial).vertexColors, true);
  assert.ok(toy.geometry.getAttribute('aInfo'));
  assert.equal(makeHeroMaterial('x').material.customProgramCacheKey(), 'ob-toy-hero');
  set.dispose();
  // the materials outlive the set: three frees a program when its last material is disposed, so the warmed programs
  // must stay referenced until the real models draw
  const again = modelWarmupSet();
  assert.deepEqual(again.objects.map(o => (o as THREE.Mesh).material), set.objects.map(o => (o as THREE.Mesh).material));
  let disposed = 0;
  for (const o of again.objects) ((o as THREE.Mesh).material as THREE.Material).addEventListener('dispose', () => { disposed++; });
  again.dispose();
  assert.equal(disposed, 0);
});

function fakeModel(id: string, w: number, h: number, d: number): models.LoadedModel {
  const geometry = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  geometry.computeBoundingBox();
  return { id, asset: ASSETS.models[id] ?? SF_MODELS['sf-dragon-gate'], geometry, map: new THREE.Texture(), mask: null, triangles: geometry.getIndex()!.count / 3 };
}

test('swap objects: one hero mesh per single part (sharing the landmark fade), one InstancedMesh per repeated model; scale baked', () => {
  const fade = { value: 0 };
  const map = new Map([['sf-dragon-gate', fakeModel('sf-dragon-gate', 2, 1, 1)], ['sf-victorian-a', fakeModel('sf-victorian-a', 4, 5, 4)]]);
  const { objects, triangles } = buildSwapObjects([
    { model: 'sf-dragon-gate', x: 1, y: 0.5, z: 0, yaw: 0.3, scale: [0.5, 2, 1], castShadow: true, glow: 0.08 },
    { model: 'sf-victorian-a', x: -2, y: 0, z: 0, scale: [0.4, 1, 0.85], tint: '#e8c6cf' },
    { model: 'sf-victorian-a', x: 2, y: 0.3, z: 0, scale: [0.4, 1, 0.85], tint: '#c9d6e8' },
  ], map, fade, 'test');
  assert.equal(objects.length, 2);
  const [gate, row] = objects as [THREE.Mesh, THREE.InstancedMesh];
  assert.equal((gate.material as THREE.Material).customProgramCacheKey(), 'ob-model-hero');
  assert.equal((gate.material as ReturnType<typeof makeModelMaterial>).userData.obModel.fade, fade);
  assert.ok(gate.castShadow && gate.receiveShadow && !gate.matrixAutoUpdate);
  assert.ok(Math.abs(gate.rotation.y - 0.3) < 1e-9 && gate.position.x === 1);
  gate.geometry.computeBoundingBox();
  const s = gate.geometry.boundingBox!.getSize(new THREE.Vector3());
  assert.ok(Math.abs(s.x - 1) < 1e-6 && Math.abs(s.y - 2) < 1e-6 && Math.abs(s.z - 1) < 1e-6, 'per-axis scale baked into the geometry');
  assert.equal((gate.material as ReturnType<typeof makeModelMaterial>).userData.obModel.inst.value.w, 0.08, 'floodlight glow');
  assert.ok(row.isInstancedMesh && row.count === 2);
  assert.equal((row.material as THREE.Material).customProgramCacheKey(), 'ob-model-inst');
  const tint = row.geometry.getAttribute(MODEL_TINT_ATTR) as THREE.InstancedBufferAttribute;
  assert.equal(tint.getW(0), 1);
  assert.notEqual(tint.getX(0), tint.getX(1), 'per-house tint');
  assert.equal(triangles, 12 + 12 * 2);
  disposeSwapObjects(objects);
});

test('sites: AI counts start empty; ground strips use the city GROUND program; every swap part is a registered model', () => {
  const sites = new CitySites();
  assert.deepEqual(sites.counts().ai, { on: 0, pending: 0, failed: 0, triangles: 0, draws: 0 });
  for (const l of SF_LANDMARKS) {
    const g = buildGroundMesh(l);
    if (g) assert.equal((g.material as THREE.Material).name, 'ob-ground');
    for (const p of l.swap?.parts ?? []) assert.ok(ASSETS.models[p.model], `${l.id}: ${p.model}`);
  }
  assert.notEqual(TOY.customProgramCacheKey(), 'ob-model-hero');
});

const lm = (id: string) => SF_LANDMARKS.find(l => l.id === id)!;
/** Is the local point p inside one of l's walk blockers? */
const blocked = (l: SfLandmark, p: Vec2) => l.walk!.blockers.some(b => ('r' in b ? Math.hypot(p.x - b.x, p.z - b.z) < b.r : pointInPolygon(p, b.poly)));
/** Sample points of a local rectangle [x0, x1] × [z0, z1] (shrunk by 0.05: edges may touch). */
function samples(x0: number, x1: number, z0: number, z1: number, n = 6): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) out.push({ x: x0 + 0.05 + ((x1 - x0 - 0.1) * i) / n, z: z0 + 0.05 + ((z1 - z0 - 0.1) * j) / n });
  return out;
}
const inExclude = (l: SfLandmark, p: Vec2) => {
  const w = landmarkToWorld(l, p), e = l.exclude;
  return 'r' in e ? Math.hypot(w.x - l.x, w.z - l.z) <= e.r : pointInPolygon(w, e.poly);
};

test('AI swaps: the D2-06/07 decision gates, walk data authored to the AI meshes (measured on the decoded GLBs)', () => {
  assert.deepEqual(SF_LANDMARKS.filter(l => l.swap?.ship).map(l => l.id).sort(), [
    'castro-theatre', 'city-hall', 'conservatory-of-flowers', 'dragon-gate', 'dutch-windmill', 'grace-cathedral', 'legion-of-honor',
    'mission-dolores', 'palace-of-fine-arts',
  ]);
  assert.equal(lm('painted-ladies').swap?.ship, false, 'D2-07: the procedural row reads better at 64 px and golden hour');
  // Dragon Gate: walk-through >= 2.2 u clear between the inner pillars; the 4 pillars (inner |x| 1.14-2.05, outer
  // 3.21-4.01, depth ±0.48) and the lion plinths (z 0.56-1.16) are solid; the pillar footprint is inside the exclusion
  const gate = lm('dragon-gate');
  for (const p of samples(-1.1, 1.1, -2, 2)) assert.ok(!blocked(gate, p), `gate passage free at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  for (const sx of [-1, 1]) {
    for (const p of samples(1.14, 2.05, -0.48, 0.48)) assert.ok(blocked(gate, { x: sx * p.x, z: p.z }), 'inner pillar solid');
    for (const p of samples(3.21, 4.01, -0.48, 0.48)) assert.ok(blocked(gate, { x: sx * p.x, z: p.z }), 'outer pillar solid');
    for (const p of samples(1.29, 1.91, 0.56, 1.16)) assert.ok(blocked(gate, { x: sx * p.x, z: p.z }), 'lion plinth solid');
    for (const z of [-0.48, 0.48]) assert.ok(inExclude(gate, { x: sx * 4.01, z }), 'pillars inside the exclusion');
  }
  // side openings stay walkable (between the inner and the outer pillar)
  for (const sx of [-1, 1]) assert.ok(!blocked(gate, { x: sx * 2.6, z: 0 }) && !blocked(gate, { x: sx * 2.6, z: -0.8 }));
  // Palace rotunda: 8 walk-in arches between the piers (centre reachable), piers solid, a 0.2 u deck
  const pal = lm('palace-of-fine-arts');
  assert.ok(!blocked(pal, { x: 0, z: 0 }), 'rotunda centre free');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, b = ((k + 0.5) / 8) * Math.PI * 2;
    for (const r of [2.4, 3.0, 3.7, 4.4]) assert.ok(!blocked(pal, { x: Math.sin(a) * r, z: Math.cos(a) * r }), `arch ${k} free at r ${r}`);
    assert.ok(blocked(pal, { x: Math.sin(b) * 3.7, z: Math.cos(b) * 3.7 }), `pier ${k} solid`);
  }
  const part = pal.swap!.parts[0], size = SF_MODELS['sf-palace-rotunda'].size;
  assert.ok(Math.abs((size[0] * part.scale[0]) / 2 - 4.11) < 0.05, 'rotunda squeezed to r 4.1 (the procedural platform)');
  assert.ok(pal.walk!.surfaces?.some(s => s.y === 0.2 && s.surface === 'plaza'));
  // Conservatory: the scaled footprint (wings, entrance porch, rear house) is solid and inside the exclusion
  const con = lm('conservatory-of-flowers');
  for (const [x0, x1, z0, z1] of [[-5.3, 5.3, -1.23, 0.68], [-1.9, 1.9, 0.68, 2.45], [-2.63, 4.1, -2.45, -1.22]]) {
    for (const p of samples(x0, x1, z0, z1)) assert.ok(blocked(con, p), `conservatory solid at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    for (const p of [{ x: x0, z: z0 }, { x: x1, z: z1 }]) assert.ok(inExclude(con, p), 'inside the exclusion');
  }
  // AI budget per landmark view: <= 12 draws, <= 60k triangles
  for (const l of SF_LANDMARKS.filter(x => x.swap?.ship)) {
    const tris = l.swap!.parts.reduce((t, p) => t + ASSETS.models[p.model].triangles, 0);
    assert.ok(tris <= 60_000 && l.swap!.parts.length <= 12, `${l.id} AI budget`);
  }
});

test('sites: a landmark with `fade` thins as a whole while it stands between the camera and the player', () => {
  const sites = new CitySites();
  const inner = sites as unknown as { sites: { l: SfLandmark; baseY: number; fade: { value: number } | null }[]; updateFade(s: unknown, dt: number): void };
  const s = inner.sites.find(x => x.l.id === 'dragon-gate')!, l = s.l;
  assert.ok(s.fade && l.fade, 'the gate has its own fade uniform');
  assert.equal(inner.sites.find(x => x.l.id === 'painted-ladies')!.fade, null);
  s.baseY = 5;
  const f = { x: Math.sin(l.yaw), z: Math.cos(l.yaw) };
  const run = (n = 60) => { for (let i = 0; i < n; i++) inner.updateFade(s, 1 / 30); return s.fade!.value; };
  const saved = { cam: U.uCam.value.clone(), player: U.uPlayer.value.clone(), fade: U.uFade.value };
  try {
    U.uFade.value = 1;
    // the player just walked through the gate, the camera follows from the other side: the whole gate thins
    U.uPlayer.value.set(l.x + f.x * 3, 5, l.z + f.z * 3);
    U.uCam.value.set(l.x - f.x * 8, 11, l.z - f.z * 8);
    const v = run();
    assert.ok(v > 0.3 && v <= 0.35, `fade ${v}`);
    // camera on the player's side of the gate: solid again
    U.uCam.value.set(l.x + f.x * 12, 11, l.z + f.z * 12);
    assert.equal(run(), 0);
    // the segment passes 6 u beside the gate: no fade
    const r = { x: Math.cos(l.yaw), z: -Math.sin(l.yaw) };
    U.uPlayer.value.set(l.x + f.x * 3 + r.x * 6, 5, l.z + f.z * 3 + r.z * 6);
    U.uCam.value.set(l.x - f.x * 8 + r.x * 6, 11, l.z - f.z * 8 + r.z * 6);
    assert.equal(run(), 0);
    // occlusion fade off (QA camera, photo mode): never
    U.uFade.value = 0;
    U.uPlayer.value.set(l.x + f.x * 3, 5, l.z + f.z * 3);
    U.uCam.value.set(l.x - f.x * 8, 11, l.z - f.z * 8);
    assert.equal(run(), 0);
  } finally {
    U.uCam.value.copy(saved.cam);
    U.uPlayer.value.copy(saved.player);
    U.uFade.value = saved.fade;
  }
});

test('fadeOccludes: under the gate or the rotunda = occluded; in front of it, beside it or above its top = not', () => {
  const at = (l: SfLandmark, x: number, y: number, z: number) => { const w = landmarkToWorld(l, { x, z }); return new THREE.Vector3(w.x, y, w.z); };
  const gate = lm('dragon-gate'), g = gate.fade!;
  assert.ok(fadeOccludes(gate, g, 0, at(gate, 0, 6, -9), at(gate, 0, 0, 0)), 'player under the gate');
  assert.ok(fadeOccludes(gate, g, 0, at(gate, 3, 6, -9), at(gate, 3, 0, 2)), 'side opening, just through');
  assert.ok(!fadeOccludes(gate, g, 0, at(gate, 0, 6, 12), at(gate, 0, 0, 3)), 'gate behind the player');
  assert.ok(!fadeOccludes(gate, g, 0, at(gate, 7, 6, -9), at(gate, 7, 0, 3)), 'beside the gate');
  assert.ok(!fadeOccludes(gate, g, 0, at(gate, 0, 40, -9), at(gate, 0, 30, 3)), 'above the top');
  const pal = lm('palace-of-fine-arts'), p = pal.fade!;
  assert.ok(fadeOccludes(pal, p, 0.1, at(pal, 0, 9, 14), at(pal, 0, 0.3, 0)), 'player under the dome');
  assert.ok(!fadeOccludes(pal, p, 0.1, at(pal, 0, 9, 20), at(pal, 0, 0.3, 7)), 'rotunda behind the player');
});

/** Local ground-level box corners of a swap part: registry size × scale, turned by the part's yaw, at its offset. */
function partCorners(p: NonNullable<SfLandmark['swap']>['parts'][number]): Vec2[] {
  const size = ASSETS.models[p.model].size, hx = (size[0] * p.scale[0]) / 2, hz = (size[2] * p.scale[2]) / 2;
  const c = Math.cos(p.yaw ?? 0), s = Math.sin(p.yaw ?? 0);
  return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => ({ x: p.x + x * c + z * s, z: p.z - x * s + z * c }));
}

test('D2-15 swaps: the eight SAM landmarks — decision gates, AI bounds inside the exclusions, walk data on the measured meshes', () => {
  // the gates (SoloView golden / night / 64 px + the city): six ship, two stay procedural with the reason in `note`
  for (const id of ['legion-of-honor', 'mission-dolores', 'castro-theatre', 'dutch-windmill', 'grace-cathedral', 'city-hall']) assert.equal(lm(id).swap?.ship, true, id);
  for (const id of ['fort-point', 'ghirardelli-square']) {
    assert.equal(lm(id).swap?.ship, false, id);
    assert.match(lm(id).swap!.note ?? '', /^prototype: /, `${id} says why`);
  }
  const d215 = ['legion-of-honor', 'ghirardelli-square', 'fort-point', 'mission-dolores', 'castro-theatre', 'dutch-windmill', 'grace-cathedral', 'city-hall'];
  for (const id of d215) {
    const l = lm(id), swap = l.swap!;
    assert.equal(swap.parts.length, 1, `${id}: one AI part`);
    const p = swap.parts[0], m = SF_MODELS[p.model as keyof typeof SF_MODELS];
    assert.ok(m && m.landmarkId === id && m.kind === 'hero', `${id}: ${p.model} is its hero model`);
    // the AI footprint stands inside the exclusion (city buildings there are dropped) ...
    for (const c of partCorners(p)) assert.ok(inExclude(l, c), `${id}: AI corner ${c.x.toFixed(2)},${c.z.toFixed(2)} inside the exclusion`);
    if (!swap.ship) continue;
    // ... and its middle is solid (the Legion's middle is the open Court of Honor, checked below)
    if (id !== 'legion-of-honor') assert.ok(blocked(l, { x: p.x, z: p.z }), `${id}: AI centre blocked`);
    assert.ok(l.fade && l.fade.procedural === false, `${id}: the AI part thins as one`);
  }
  // Legion: the Court of Honor is reached through the widened gateway (|x| < 0.8), the Thinker's plinth is solid,
  // museum, wings and the screen are solid (measured on the decoded mesh, +0.5 u toward the gate)
  const legion = lm('legion-of-honor');
  for (const p of samples(-0.75, 0.75, 5.1, 6.4)) assert.ok(!blocked(legion, p), `gateway free at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  for (const p of samples(-2.4, 2.4, -1.7, 4.9)) if (Math.hypot(p.x, p.z - 3.2) > 0.55) assert.ok(!blocked(legion, p), `court free at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  assert.ok(blocked(legion, { x: 0, z: 3.2 }), 'The Thinker');
  for (const [x0, x1, z0, z1] of [[-4.3, 4.3, -5.2, -2.9], [-4.2, -2.6, -2.7, 4.9], [2.6, 4.2, -2.7, 4.9], [-4.3, -0.9, 5.3, 6.2], [0.9, 4.3, 5.3, 6.2]]) {
    for (const p of samples(x0, x1, z0, z1, 4)) assert.ok(blocked(legion, p), `Legion solid at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  }
  // City Hall: the scaled AI block (|x| ≤ 8.86, z −5.85…6.35 with its offset) lies inside the procedural blockers,
  // which the frozen terrain tests pin
  const hall = lm('city-hall'), hp = hall.swap!.parts[0];
  for (const c of partCorners(hp)) assert.ok(blocked(hall, { x: c.x * 0.99, z: hp.z + (c.z - hp.z) * 0.99 }), 'AI hall inside its blockers');
  // windmill: the procedural sails turn on the AI body's windshaft stub (tip at y 5.85, z 1.71), in front of the stage
  const mill = lm('dutch-windmill'), o = new THREE.Object3D();
  mill.animate!.update(o, 0);
  assert.ok(Math.abs(o.position.y - 5.85) < 0.05 && o.position.z >= 1.9 && o.position.z <= 2.1, `hub ${o.position.y}, ${o.position.z}`);
  assert.ok(blocked(mill, { x: 1.8, z: 0 }) && !blocked(mill, { x: 0, z: 2.3 }), 'plinth r 1.85, the door side free');
  // Castro: the marquee over the sidewalk stays inside the (widened) exclusion
  assert.ok(inExclude(lm('castro-theatre'), { x: 0, z: 4.2 }));
});

test('AI budget per view: the shipped AI parts inside any lod-0 ring stay ≤ 60k triangles (shadows counted) and ≤ 12 draws', () => {
  const ship = SF_LANDMARKS.filter(l => l.swap?.ship);
  let worst = { tris: 0, draws: 0, at: '' };
  for (const at of SF_LANDMARKS) {
    let tris = 0, draws = 0;
    for (const l of ship) {
      if (Math.hypot(l.x - at.x, l.z - at.z) > LOD0[l.tier]) continue;
      for (const p of l.swap!.parts) { const t = ASSETS.models[p.model].triangles; tris += p.castShadow ? 2 * t : t; draws += p.castShadow ? 2 : 1; }
    }
    if (tris > worst.tris) worst = { tris, draws, at: at.id };
    assert.ok(tris <= 60_000 && draws <= 12, `at ${at.id}: ${tris} AI triangles, ${draws} draws`);
  }
  assert.ok(worst.tris > 0, `worst view ${JSON.stringify(worst)}`);
});

test('AI parts near the focus only (C2 request 2): within AI_R the lod 0 may draw its GLBs, past AI_R + 30 it is procedural', () => {
  const sites = new CitySites();
  const inner = sites as unknown as { sites: { l: SfLandmark; aiNear: boolean; ai: boolean }[] };
  const s = inner.sites.find(x => x.l.id === 'city-hall')!, l = s.l;
  const at = (d: number) => { sites.update(l.x + d, l.z, 0); return s.aiNear; };
  try {
    assert.equal(at(AI_R - 20), true, 'near: AI allowed');
    assert.equal(at(AI_R + 20), true, 'hysteresis holds it');
    assert.equal(at(AI_R + 40), false, 'past AI_R + 30: procedural');
    assert.equal(at(AI_R + 10), false, 'needs AI_R to come back');
    assert.equal(at(AI_R - 10), true);
    // no GLBs in node: the lod 0 is procedural either way, and a far site never counts as pending
    at(AI_R + 40);
    assert.equal(s.ai, false);
    assert.equal(sites.counts().ai.pending, 0);
  } finally { sites.dispose(); }
  assert.ok(AI_R < LOD0[2], 'inside the T2 lod-0 ring');
});

test('W4-IL5 (W4-L4): the wave-4 AI swaps — registered models of their own site, gate verdicts, placements at the slots, AI budget', async () => {
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { W4_ALL_SITES } = await import('../src/opus-bay/world/sf/landmarks/w4sites');
  const { siteGround } = await import('../src/opus-bay/world/sf/landmarks/siteKit');
  const swapped = W4_ALL_SITES.filter(s => s.swap);
  assert.deepEqual(swapped.map(s => s.id).sort(), ['blue-heron-lake', 'cal-academy', 'geary-west', 'st-ignatius-church']);
  // every one ships (lane V's gate for Holy Virgin and the pavilion, lane L's SoloView gate for the two others)
  assert.deepEqual(swapped.filter(s => s.swap!.ship).map(s => s.id).sort(), swapped.map(s => s.id).sort());
  for (const s of swapped) {
    assert.ok(SF_SITES.includes(s));
    for (const p of s.swap!.parts) {
      const m = ASSETS.models[p.model];
      assert.ok(m, `${s.id}: ${p.model} registered`);
      assert.equal((m as { landmarkId?: string }).landmarkId, s.id, `${p.model} names its site (D2's swap rule)`);
      assert.equal(p.scale.length, 3);
      // the part stands where the site's AI slot planned it (lane L's d6d8c24 / lane V's rows allow 0.05 u)
      const at = s.w4.aiSlot!.at;
      assert.equal(s.w4.aiSlot!.id, p.model);
      assert.ok(Math.abs(p.x - at[0]) <= 0.05 && Math.abs(p.y - at[1]) <= 0.05 && Math.abs(p.z - at[2]) <= 0.05, `${s.id} part at the slot`);
      // on the site's ground (or on its stone base: the pavilion)
      const gy = siteGround(s.id, s.base).at(p.x, p.z);
      assert.ok(p.y >= gy - 0.05 && p.y <= gy + 0.5, `${s.id}: part y ${p.y} over ground ${gy.toFixed(2)}`);
    }
    const tris = s.swap!.parts.reduce((t, p) => t + ASSETS.models[p.model].triangles, 0);
    assert.ok(tris <= 6_000 && s.swap!.parts.length === 1, `${s.id}: one AI part ≤ 6k triangles`);
    // the remainder is small (the site's setting): the AI part carries the building
    const b = new Batch();
    s.swap!.build(b);
    const g = b.build(), n = (g.getIndex()?.count ?? g.getAttribute('position')?.count ?? 0) / 3;
    assert.ok(n <= 1200, `${s.id}: remainder ${n} triangles`);
  }
});
