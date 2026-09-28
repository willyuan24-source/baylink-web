import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ASSETS, SF_MODELS, SF_MODEL_IDS, listAssetUrls, registerVoiceClips } from '../src/opus-bay/data/assets';
import { W4_MODELS, W4_MODEL_IDS, w4ModelUrls } from '../src/opus-bay/data/sf/w4Models';
import { MAP_STICKERS_T1, MAP_STICKER_IDS, isMapStickerId, mapStickerRect, mapStickerSvg, mapStickerUrls } from '../src/opus-bay/data/sf/mapStickers';
import { T1_IDS } from '../src/opus-bay/data/sf/attractions';
import { TOUR_LINES, TOUR_LINES_2 } from '../src/opus-bay/data/sf/tourLines';
import { TOUR_VOICE_CHECK, TOUR_VOICE_CLIPS } from '../src/opus-bay/data/sf/voiceTour';
import { LOOP_STOPS, W4_STATION_IDS } from '../src/opus-bay/data/sf/stationNames';
import { W4_SITES, siteLod0R, w4Site } from '../src/opus-bay/world/sf/landmarks/w4sites';
import { LOD0 } from '../src/opus-bay/world/sf/sites';

/**
 * Lane V (wave 4, early phase): the new asset files against their data modules — the four AI landmark GLBs
 * (data/sf/w4Models.ts, registered in data/assets.ts SF_MODELS at the integration), the T1 map sticker atlas
 * (data/sf/mapStickers.ts + public/opus-bay/map/stickers-t1.json), the tour narration clips (data/sf/voiceTour.ts, lane C's
 * frozen TOUR_LINES) and the wave-4 perf spots (scripts/opus-sf/qa/perf/w4-spots.json). File checks only: no WebGL, no decoding.
 * The lane-V review added the wiring checks: each model's `landmarkId` = the lane L site that holds its AI slot, the ledger
 * rows = the files, the SVG sticker crop, the spots' site ids in their lod-0 rings and the rides on lane T's station ids.
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
  // integration (lane V step 1): registered as the rows themselves, loadable by id (world/models.ts reads ASSETS.models)
  const urls = new Set(listAssetUrls());
  for (const id of W4_MODEL_IDS) {
    assert.equal(SF_MODELS[id], W4_MODELS[id], `${id} in SF_MODELS`);
    assert.equal(ASSETS.models[id], W4_MODELS[id], `${id} in ASSETS.models`);
    assert.ok(urls.has(W4_MODELS[id].url) && (!W4_MODELS[id].mask || urls.has(W4_MODELS[id].mask!)), `${id} files listed`);
  }
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
  // St Ignatius: the towers rise "over 200 ft above the street" (California Preservation Foundation; USF says 210 ft,
  // the SF Chronicle 185 ft above the campus): lane L's 61 m to the lanterns + the crosses ≈ 65 m, and the AI mesh is fitted to it
  assert.ok(Math.abs(W4_MODELS['sf-st-ignatius'].size[1] - H(65)) < 0.1, 'St Ignatius towers ≈ 65 m to the crosses (lane L\'s procedural church)');
  assert.ok(Math.abs(W4_MODELS['sf-holy-virgin'].size[1] - H(38.1)) < 0.1, 'Holy Virgin 125 ft (SFGate)');
  assert.ok(Math.abs(W4_MODELS['sf-chinese-pavilion'].size[1] - H(8.5)) < 0.1, 'pavilion 28 ft');
  // the pavilion is walk-in: at least 3 u overall (measured on the decoded mesh by the lane-V review: floor platform 0.3 u,
  // roof underside 2.3 u at the centre, 2.5 u at the eaves = 2.0 u over the floor for the 1.73 u player of actors/dims.ts)
  assert.ok(W4_MODELS['sf-chinese-pavilion'].size[1] >= 3);
});

test('T1 stickers: 16 ids in the plan §4.1 order, atlas WebP 512 px with alpha, JSON = module (rects, bytes, sha256)', () => {
  assert.deepEqual([...MAP_STICKER_IDS], [
    'golden-gate-bridge', 'alcatraz', 'fishermans-wharf', 'ferry-building-marketplace', 'coit-tower', 'chinatown-dragon-gate',
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
  // one sticker per lane P's tier-1 attraction (data/sf/attractions.ts), no more, no less
  assert.deepEqual([...MAP_STICKER_IDS].sort(), [...T1_IDS].sort(), 'stickers = lane P T1_IDS');
  assert.equal(mapStickerRect('twin-peaks'), MAP_STICKERS_T1.rects['twin-peaks']);
  assert.equal(mapStickerRect('sutro-tower'), null, 'T2 attractions have no sticker');
  assert.ok(isMapStickerId('stonestown-galleria') && !isMapStickerId('stonestown'));
  assert.deepEqual(mapStickerUrls(), ['/opus-bay/map/stickers-t1.webp', '/opus-bay/map/stickers-t1.json']);
  // the SVG crop for lane P's SVG badges (ui/MapBadge.tsx): viewBox = the rect, the image at the atlas size, one shared
  // object per id (no allocation per render)
  for (const id of MAP_STICKER_IDS) {
    const v = mapStickerSvg(id)!, r = MAP_STICKERS_T1.rects[id];
    assert.equal(v.viewBox, `${r.x} ${r.y} ${r.w} ${r.h}`, `${id} viewBox`);
    assert.deepEqual([v.href, v.atlasW, v.atlasH], [MAP_STICKERS_T1.url, w, h]);
    assert.equal(mapStickerSvg(id), v, `${id}: the same object every call`);
    assert.ok(Object.isFrozen(v));
  }
  assert.equal(mapStickerSvg('sutro-tower'), null);
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
    // board / alight are lane T's stable station ids (data/sf/stationNames.ts): the rows board the real vehicles after integration
    for (const st of [r.board, r.alight]) assert.ok(W4_STATION_IDS.includes(st), `${r.id}: ${st} is a lane T station id`);
    const prefix = r.line === 'sf-loop' ? 'loop-' : 'muni-';
    assert.ok(r.board.startsWith(prefix) && r.alight.startsWith(prefix), `${r.id}: stations of its line`);
    const stop = LOOP_STOPS.find(x => x.id === r.alight);
    if (stop) assert.ok(Math.hypot(r.path.at(-1)![0] - stop.at.x, r.path.at(-1)![1] - stop.at.z) <= 30, `${r.id} ends at ${r.alight}`);
  }
  // `sites`: a built wave-4 site (lane L's W4Site ids) is listed only when its lod-0 ring reaches the spot; the other
  // entries are plan §2.3 site names still to come
  for (const s of S.spots.filter(x => x.since === 'w4')) {
    for (const id of s.sites ?? []) {
      const l = W4_SITES.find(x => x.id === id);
      if (!l) continue;
      const d = Math.hypot(l.x - s.go.x!, l.z - s.go.z!), ring = siteLod0R(l) ?? LOD0[l.tier];
      assert.ok(d <= ring, `${s.id}: ${id} is ${d.toFixed(0)} u away, its lod-0 ring is ${ring} u`);
    }
  }
});

test('w4 models: landmarkId = the lane L site whose AI slot the model fills (D2 swap rule); the ledger rows = the files', () => {
  const stem = (url: string) => path.basename(url, '.glb');
  for (const id of W4_MODEL_IDS) {
    const m = W4_MODELS[id], site = w4Site(m.landmarkId);
    // a built site: its AI slot names this model's file (lane L's `aiSlot.model` strings are the GLB stems until integration)
    if (site) assert.equal(site.w4.aiSlot?.model, stem(m.url), `${id}: site ${m.landmarkId} holds the AI slot for ${stem(m.url)}`);
  }
  // the two AI slots built today sit on their own sites, not on the plan's parent sites (music-concourse / usf-lone-mountain)
  assert.equal(W4_MODELS['sf-cal-academy'].landmarkId, 'cal-academy');
  assert.equal(W4_MODELS['sf-st-ignatius'].landmarkId, 'st-ignatius-church');
  // every built site whose AI slot names a wave-4 GLB is that model's landmarkId (a new site id: re-label the row, free)
  for (const l of W4_SITES) {
    const slot = l.w4.aiSlot?.model;
    const m = W4_MODEL_IDS.map(id => W4_MODELS[id]).find(x => stem(x.url) === slot);
    if (m) assert.equal(m.landmarkId, l.id, `${slot}: landmarkId ${m.landmarkId} vs its site ${l.id}`);
  }
  // docs/opus-bay/ledger/w4-V.md "Published" rows (the lead merges them into ASSETS-LEDGER.md) state the published files
  const ledger = fs.readFileSync(path.join(ROOT, 'docs/opus-bay/ledger/w4-V.md'), 'utf8').split(/\r?\n/);
  for (const id of W4_MODEL_IDS) {
    const m = W4_MODELS[id], row = ledger.find(line => line.startsWith(`| models/sf/${stem(m.url)}.glb`));
    assert.ok(row, `${id} ledger row`);
    const cells = row.split('|').map(c => c.trim());
    assert.equal(Number(cells[2].replace(/,/g, '')), m.triangles, `${id} ledger triangles`);
    assert.equal(Number(cells[3].replace(/,/g, '')), m.bytes, `${id} ledger bytes`);
    const dims = cells[4].split('×').map(v => parseFloat(v));
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(dims[k] - m.size[k]) <= 0.02, `${id} ledger size[${k}] ${dims[k]} vs ${m.size[k]}`);
  }
});

test('tour voice: every frozen TOUR_LINES line (and TOUR_LINES_2, added after the freeze) has its zh + en clip, word for word, files = the report (bytes, sha256), 1.5–9 s', () => {
  assert.equal(Object.keys(TOUR_VOICE_CLIPS).length, (TOUR_LINES.length + TOUR_LINES_2.length) * 2);
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/opus-bay/qa/w4/V/voice/tour-voice-report.json'), 'utf8')) as {
    clips: Record<string, { text: string; pick: { duration: number; passed: boolean; files: Record<'m4a' | 'ogg', { path: string; bytes: number; sha256: string }> } }>;
  };
  for (const line of [...TOUR_LINES, ...TOUR_LINES_2]) {
    for (const lang of ['zh', 'en'] as const) {
      const id = `${lang}-${line.id}`, c = TOUR_VOICE_CLIPS[id], r = report.clips[id];
      assert.ok(c && r, `${id} recorded`);
      assert.equal(c.text, line[lang], `${id} says the frozen text`);
      assert.equal(c.lang, lang);
      assert.equal(c.duration, r.pick.duration, `${id} duration`);
      assert.ok(c.duration >= 1.5 && c.duration <= 9, `${id} ${c.duration} s`);
      assert.equal(c.m4a, `/opus-bay/voice/sf/tour/${id}.m4a`);
      for (const ext of ['m4a', 'ogg'] as const) {
        const buf = fs.readFileSync(fileOf(c[ext]));
        assert.equal(buf.length, r.pick.files[ext].bytes, `${id}.${ext} bytes`);
        assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), r.pick.files[ext].sha256, `${id}.${ext} sha256`);
      }
      assert.equal(TOUR_VOICE_CHECK.includes(id), !r.pick.passed, `${id} muted exactly when its take missed a gate`);
      // integration: importing voiceTour registered the clip (audio/voice.ts plays listed ids only), unless it awaits the ear
      assert.equal(ASSETS.voice[id], TOUR_VOICE_CHECK.includes(id) ? undefined : c[ASSETS.voice['zh-hi']?.endsWith('.ogg') ? 'ogg' : 'm4a'], `${id} registered`);
    }
  }
});

test('registerVoiceClips: adds the missing ids in this device’s container, keeps listed ones, skips the held-back takes', () => {
  const clip = (id: string) => ({ m4a: `/opus-bay/voice/x/${id}.m4a`, ogg: `/opus-bay/voice/x/${id}.ogg`, lang: 'zh' as const, text: id, duration: 2 });
  const before = ASSETS.voice['zh-hi'];
  assert.equal(registerVoiceClips({ 'zh-v-test-a': clip('a'), 'zh-v-test-b': clip('b'), 'zh-hi': clip('hi') }, ['zh-v-test-b']), 1);
  assert.match(ASSETS.voice['zh-v-test-a'], /^\/opus-bay\/voice\/x\/a\.(m4a|ogg)$/);
  assert.equal(ASSETS.voice['zh-v-test-b'], undefined, 'held back');
  assert.equal(ASSETS.voice['zh-hi'], before, 'a listed id is kept');
  assert.equal(registerVoiceClips({ 'zh-v-test-a': clip('a') }), 0, 'twice is a no-op');
  delete ASSETS.voice['zh-v-test-a'];
});
