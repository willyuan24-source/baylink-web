import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { SF_MODEL_IDS } from '../src/opus-bay/data/assets';
import { W4_MODELS, W4_MODEL_IDS, w4ModelUrls } from '../src/opus-bay/data/sf/w4Models';
import { MAP_STICKERS_T1, MAP_STICKER_IDS, isMapStickerId, mapStickerRect, mapStickerUrls } from '../src/opus-bay/data/sf/mapStickers';

/**
 * Lane V (wave 4, early phase): the new asset files against their data modules — the four AI landmark GLBs
 * (data/sf/w4Models.ts, not registered in data/assets.ts until the integration phase), the T1 map sticker atlas
 * (data/sf/mapStickers.ts + public/opus-bay/map/stickers-t1.json) and the wave-4 perf spots (scripts/opus-sf/qa/perf/
 * w4-spots.json). File checks only: no WebGL, no decoding.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const fileOf = (url: string) => path.join(PUBLIC, url);

interface Glb { bytes: number; buf: Buffer; json: {
  extensionsRequired?: string[]; accessors: { count: number; min?: number[]; max?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number; extensions?: Record<string, unknown> }[] }[];
  images?: { mimeType?: string; bufferView: number }[]; bufferViews: { byteOffset?: number; byteLength: number }[];
  materials?: { name?: string }[];
} }
function glb(url: string): Glb {
  const buf = fs.readFileSync(fileOf(url));
  assert.equal(buf.readUInt32LE(0), 0x46546c67, `${url} is a GLB`);
  assert.equal(buf.readUInt32LE(4), 2, `${url} glTF 2`);
  const len = buf.readUInt32LE(12);
  return { bytes: buf.length, buf, json: JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) };
}
/** [width, height, hasAlpha] of a WebP (VP8X / VP8L / VP8 headers). */
function webpInfo(b: Buffer): [number, number, boolean] {
  assert.equal(b.subarray(0, 4).toString(), 'RIFF');
  assert.equal(b.subarray(8, 12).toString(), 'WEBP');
  const kind = b.subarray(12, 16).toString();
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3), (b[20] & 0x10) !== 0];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff), ((v >> 28) & 1) === 1]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff, false];
}
function glbTextures(g: Glb): [number, number, boolean][] {
  const len = g.buf.readUInt32LE(12), bin = 20 + len + 8;
  return (g.json.images ?? []).map(im => {
    const bv = g.json.bufferViews[im.bufferView];
    return webpInfo(g.buf.subarray(bin + (bv.byteOffset ?? 0), bin + (bv.byteOffset ?? 0) + bv.byteLength));
  });
}

test('w4 models: four new ids, no clash with SF_MODEL_IDS, each file matches its row (bytes, triangles, bounds ±2 %, origin)', () => {
  assert.deepEqual([...W4_MODEL_IDS], ['sf-cal-academy', 'sf-st-ignatius', 'sf-holy-virgin', 'sf-chinese-pavilion']);
  for (const id of W4_MODEL_IDS) assert.ok(!(SF_MODEL_IDS as readonly string[]).includes(id), `${id} is new`);
  for (const id of W4_MODEL_IDS) {
    const a = W4_MODELS[id];
    assert.match(a.url, /^\/opus-bay\/models\/sf\/w4-[a-z-]+\.glb$/, `${id} url`);
    const g = glb(a.url);
    assert.equal(g.bytes, a.bytes, `${id} bytes`);
    assert.equal(g.json.meshes.length, 1, `${id} one mesh`);
    const prim = g.json.meshes[0].primitives[0];
    assert.equal(g.json.meshes[0].primitives.length, 1, `${id} one primitive (one material, one draw)`);
    assert.equal(g.json.accessors[prim.indices].count / 3, a.triangles, `${id} triangles`);
    const pos = g.json.accessors[prim.attributes.POSITION];
    const size = [0, 1, 2].map(k => pos.max![k] - pos.min![k]);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(size[k] - a.size[k]) <= a.size[k] * 0.02, `${id} size[${k}] ${size[k].toFixed(3)} vs ${a.size[k]}`);
    assert.ok(Math.abs(pos.min![1]) < 1e-3, `${id} rests on y = 0`);
    assert.ok(Math.abs(pos.min![0] + pos.max![0]) < 0.02 && Math.abs(pos.min![2] + pos.max![2]) < 0.02, `${id} centred in x and z`);
    assert.equal(a.scale, 1); assert.equal(a.yOffset, 0); assert.equal(a.kind, 'hero'); assert.equal(a.draco, true);
    assert.ok(a.landmarkId.length > 0, `${id} landmarkId`);
  }
});

test('w4 models: Draco + WebP, one texture ≤ 1024 px, the plan §2.2 / §6 caps (≤ 6k triangles, ≤ 250 KB), masks are WebP', () => {
  for (const id of W4_MODEL_IDS) {
    const a = W4_MODELS[id], g = glb(a.url);
    assert.deepEqual([...(g.json.extensionsRequired ?? [])].sort(), ['EXT_texture_webp', 'KHR_draco_mesh_compression'], `${id} Draco + WebP`);
    assert.ok(g.json.meshes[0].primitives[0].extensions?.KHR_draco_mesh_compression, `${id} Draco primitive`);
    assert.ok(g.json.images?.length === 1 && g.json.images.every(i => i.mimeType === 'image/webp'), `${id} one WebP texture`);
    for (const [w, h] of glbTextures(g)) assert.ok(w === h && w <= 1024 && w >= 512, `${id} texture ${w}×${h}`);
    assert.ok(a.triangles <= 6000, `${id} ≤ 6k triangles`);
    assert.ok(a.bytes <= 250_000, `${id} ≤ 250 KB`);
    if (a.mask) {
      const [w, h] = webpInfo(fs.readFileSync(fileOf(a.mask)));
      assert.ok(w === 256 && h === 256, `${id} mask 256 px`);
    }
  }
  // the small walk-in pavilion stays lean
  assert.ok(W4_MODELS['sf-chinese-pavilion'].triangles <= 3000);
  const urls = w4ModelUrls();
  assert.equal(urls.length, 5, 'four GLBs + the Cal Academy mask');
  for (const u of urls) assert.ok(fs.statSync(fileOf(u)).size > 0, u);
});

test('w4 models: the landmark height rule H = 3.2 + 0.155 · h (data/sf/landmarks.ts) for the three buildings of known height', () => {
  const H = (m: number) => 3.2 + 0.155 * m;
  assert.ok(Math.abs(W4_MODELS['sf-st-ignatius'].size[1] - H(65)) < 0.1, 'St Ignatius towers 213 ft (lane L: 61 m to the lanterns + the crosses)');
  assert.ok(Math.abs(W4_MODELS['sf-holy-virgin'].size[1] - H(38.1)) < 0.1, 'Holy Virgin 125 ft');
  assert.ok(Math.abs(W4_MODELS['sf-chinese-pavilion'].size[1] - H(8.5)) < 0.1, 'pavilion 28 ft');
  // the pavilion's eaves clear the player (1.5 u): at least 3 u overall
  assert.ok(W4_MODELS['sf-chinese-pavilion'].size[1] >= 3);
});

test('T1 stickers: 16 ids in the plan §4.1 order, atlas WebP 512 px with alpha, JSON = module (rects, bytes, sha256)', () => {
  assert.deepEqual([...MAP_STICKER_IDS], [
    'golden-gate-bridge', 'alcatraz', 'fishermans-wharf', 'ferry-building', 'coit-tower', 'chinatown-dragon-gate',
    'lombard-crooked', 'palace-of-fine-arts', 'golden-gate-park', 'alamo-square-painted-ladies', 'twin-peaks', 'city-hall',
    'union-square', 'sutro-baths', 'sf-state-university', 'stonestown-galleria',
  ]);
  const buf = fs.readFileSync(fileOf(MAP_STICKERS_T1.url));
  const [w, h, alpha] = webpInfo(buf);
  assert.deepEqual([w, h], [...MAP_STICKERS_T1.size]);
  assert.ok(alpha, 'the atlas has an alpha channel');
  assert.equal(buf.length, MAP_STICKERS_T1.bytes);
  assert.ok(buf.length <= 120_000, 'the atlas stays small for phones');
  const meta = JSON.parse(fs.readFileSync(fileOf(MAP_STICKERS_T1.meta), 'utf8'));
  assert.deepEqual(meta.ids, [...MAP_STICKER_IDS]);
  assert.equal(meta.bytes, buf.length);
  assert.equal(meta.sha256, crypto.createHash('sha256').update(buf).digest('hex'));
  assert.equal(meta.cell, MAP_STICKERS_T1.cell);
  for (const id of MAP_STICKER_IDS) {
    const r = MAP_STICKERS_T1.rects[id];
    assert.deepEqual({ x: meta.rects[id].x, y: meta.rects[id].y, w: meta.rects[id].w, h: meta.rects[id].h }, r, `${id} rect`);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h && r.w === r.h, `${id} inside the atlas, square`);
  }
  // no two rects overlap (each has its own cell with 2 px of padding)
  const rs = MAP_STICKER_IDS.map(id => MAP_STICKERS_T1.rects[id]);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${MAP_STICKER_IDS[i]} / ${MAP_STICKER_IDS[j]}`);
  }
  assert.equal(mapStickerRect('twin-peaks'), MAP_STICKERS_T1.rects['twin-peaks']);
  assert.equal(mapStickerRect('sutro-tower'), null, 'T2 attractions have no sticker');
  assert.ok(isMapStickerId('stonestown-galleria') && !isMapStickerId('stonestown'));
  assert.deepEqual(mapStickerUrls(), ['/opus-bay/map/stickers-t1.webp', '/opus-bay/map/stickers-t1.json']);
});

interface Spot { id: string; since: string; go: { x?: number; z?: number; fx: number; fz: number; anchor?: string; arrival?: boolean }; sites?: string[] }
interface Ride { id: string; line: string; board: string; alight: string; speed: number; camH: number; lookAhead: number; path: [number, number][] }

test('w4 perf spots: the six old spots unchanged, the five new views of plan §2.6, three rides on the new lines, the gate numbers', () => {
  const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/opus-sf/qa/perf/w4-spots.json'), 'utf8')) as {
    gate: { desktop: { calls: number; triangles: number }; phone: { fps: number; dpr: number; cpuThrottle: number } }; spots: Spot[]; rides: Ride[];
  };
  assert.equal(S.gate.desktop.calls, 150);
  assert.equal(S.gate.desktop.triangles, 400_000);
  assert.equal(S.gate.phone.fps, 45);
  assert.equal(S.gate.phone.dpr, 3);
  assert.equal(S.gate.phone.cpuThrottle, 4);
  const ids = S.spots.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length, 'unique spot ids');
  assert.deepEqual(ids, ['ferry-gate', 'chinatown', 'twin-peaks', 'ocean-beach', 'ggb-south', 'mission',
    'union-square', 'civic-center', 'music-concourse', 'stonestown-sfsu', 'haight-usf']);
  // the six older spots keep perf-gen.mjs's coordinates, so the tables stay comparable across waves
  const gen = fs.readFileSync(path.join(ROOT, 'scripts/opus-sf/qa/perf/perf-gen.mjs'), 'utf8');
  for (const s of S.spots.filter(x => x.since !== 'w4' && !x.go.anchor)) {
    const m = gen.match(new RegExp(`['"]?${s.id}['"]?:\\s*\\[([-\\d., ]+)\\]`));
    assert.ok(m, `${s.id} in perf-gen.mjs`);
    assert.deepEqual(m[1].split(',').map(Number), [s.go.x, s.go.z, s.go.fx, s.go.fz], `${s.id} coordinates`);
  }
  for (const s of S.spots) {
    if (s.go.anchor) continue;
    assert.ok(s.go.x! > -900 && s.go.x! < 1000 && s.go.z! > -100 && s.go.z! < 1800, `${s.id} inside the SF land frame`);
    if (s.since === 'w4') assert.ok((s.sites?.length ?? 0) >= 3, `${s.id} lists the new sites in range`);
  }
  assert.deepEqual(S.rides.map(r => r.line), ['sf-loop', 'n-judah', 'm-ocean-view']);
  for (const r of S.rides) {
    assert.ok(r.path.length >= 8, `${r.id} path`);
    for (let i = 1; i < r.path.length; i++) {
      const d = Math.hypot(r.path[i][0] - r.path[i - 1][0], r.path[i][1] - r.path[i - 1][1]);
      assert.ok(d > 0 && d <= 25, `${r.id} step ${i} = ${d.toFixed(1)} u`);
    }
    assert.ok(r.speed >= 8 && r.speed <= 14 && r.camH > 0 && r.lookAhead > 0, `${r.id} ride parameters`);
  }
});
