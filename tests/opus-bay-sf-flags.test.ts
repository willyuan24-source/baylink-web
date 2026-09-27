import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import * as THREE from 'three';
import { ATTRACTION_CAT_STYLE, ATTRACTION_GLYPHS } from '../src/opus-bay/data/sf/attractionTypes';
import {
  FLAG_GLYPHS, FLAG_GOLD, FLAG_RULES, type FlagPick, type FlagSource, PANORAMA, flagMax, inViewCone, isPanoramaViewpoint, layoutPanoramaTags,
  pickFlags, pickPanoramaTags, tagWidth, viewDir,
} from '../src/opus-bay/game/flags';
import {
  ATLAS, FLAG_CAPACITY, FLAG_FADE_S, FLAG_TRIS, FlagLayer, FlagSlots, PENNANT, atlasCellRect, drawGlyph, drawGlyphAtlas, flagGeometry,
  flagMaterial, flagMesh, flagScaleDistance, flagWarmupSet, glyphCell, pennantScale,
} from '../src/opus-bay/world/sf/flags';
import { FLAG_GLYPH_NODES } from '../src/opus-bay/world/sf/flagGlyphs';

/**
 * Lane G (W4-G7): attraction flags (plan §4.2; acceptance `sf-flags`): target first, ≤ max, none within 60 u, discovered
 * T1 excluded unless the setting is on, only within ±75° of the view; the mesh costs 1 call and 1 program (one
 * InstancedMesh, one ShaderMaterial, no shadow), ≤ 60 tris a flag and ≤ 1k for all; the pennant never shrinks under
 * 25 CSS px; the panorama tags (T1 / T2 in view within 2,000 u, ≤ 8, no overlaps).
 */

// the camera at yaw 0 sits at +z of the player and looks toward −z
const YAW_NORTH = 0;
const at = (id: string, x: number, z: number, extra: Partial<FlagSource> = {}): FlagSource => ({ id, rank: 1, cat: 'landmark', x, z, ...extra });
const PLAYER = { x: 0, z: 0 };
const T1 = [
  at('near-one', 0, -40),                          // within 60 u: never
  at('ahead-300', 20, -300),
  at('ahead-900', -100, -900, { cat: 'campus', glyph: 'GraduationCap', flag: { x: -95, z: -905, h: 48 } }),
  at('ahead-1500', 0, -1500),
  at('ahead-1700', 0, -1700),                      // beyond 1,600 u
  at('side-80deg', 500, -87),                      // ≈ 80° off the view: out
  at('side-70deg', 500, -182),                     // ≈ 70°: in
  at('behind', 0, 400),
  at('ahead-500-t2', 0, -500, { rank: 2, cat: 'museum' }),
  at('ahead-600', 30, -600, { cat: 'park' }),
  at('ahead-700', 30, -700, { cat: 'shopping' }),
  at('ahead-800', 30, -800, { cat: 'coast' }),
  at('ahead-1000', 30, -1000, { cat: 'viewpoint' }),
];
const none = () => false;

test('view cone: the camera at yaw looks along (−sin, −cos); ±75°', () => {
  const v = viewDir(YAW_NORTH);
  assert.ok(Math.abs(v.x) < 1e-12 && v.z === -1);
  assert.equal(inViewCone(PLAYER, 0, { x: 500, z: -182 }), true);
  assert.equal(inViewCone(PLAYER, 0, { x: 500, z: -87 }), false);
  assert.equal(inViewCone(PLAYER, 0, { x: 0, z: 10 }), false);
  assert.equal(inViewCone(PLAYER, Math.PI, { x: 0, z: 10 }), true);
});

test('pickFlags: undiscovered T1 within 1,600 u and ±75°, nearest first, none within 60 u, at most max', () => {
  const picks = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 6 });
  assert.deepEqual(picks.map(p => p.key), ['ahead-300', 'side-70deg', 'ahead-600', 'ahead-700', 'ahead-800', 'ahead-900']);
  assert.ok(picks.every(p => p.role === 'tier1' && p.d >= FLAG_RULES.near && p.d <= FLAG_RULES.far));
  assert.equal(pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 3 }).length, 3);
  assert.deepEqual(pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 0 }), []);
  // the pick carries the flag foot, height, category colour and glyph
  const far = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 16 }).find(p => p.key === 'ahead-900')!;
  assert.deepEqual([far.x, far.z, far.h, far.color, far.glyph], [-95, -905, 48, ATTRACTION_CAT_STYLE.campus.color, 'GraduationCap']);
  // no flag.h: the 30 u default pole; the category's own glyph
  const def = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 16 }).find(p => p.key === 'ahead-600')!;
  assert.equal(def.h, FLAG_RULES.defaultH);
  assert.equal(def.glyph, 'Trees');
  // T2 never gets a flag outside a panorama; nothing behind, nothing past 1,600 u
  const all = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 16 }).map(p => p.key);
  for (const k of ['near-one', 'ahead-1700', 'side-80deg', 'behind', 'ahead-500-t2']) assert.equal(all.includes(k), false, k);
  assert.equal(all.includes('ahead-1500'), true);
});

test('pickFlags: discovered T1 lose their flag unless Settings › 显示地标旗 is on', () => {
  const found = (a: FlagSource) => a.id === 'ahead-300' || a.id === 'ahead-600';
  const off = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: found, max: 6 }).map(p => p.key);
  assert.equal(off.includes('ahead-300'), false);
  assert.equal(off.includes('ahead-600'), false);
  const on = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: found, max: 6, showDiscovered: true }).map(p => p.key);
  assert.equal(on[0], 'ahead-300');
  assert.ok(on.includes('ahead-600'));
});

test('pickFlags: the active target first (gold), up to 3,000 u and even out of view; never twice; none within 60 u', () => {
  const target = { x: 0, z: 2500 };
  const picks = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 3, target });
  assert.equal(picks[0].role, 'target');
  assert.equal(picks[0].color, FLAG_GOLD);
  assert.equal(picks[0].glyph, 'MapPin');
  assert.equal(picks.length, 3);
  // an attraction target: its own foot / glyph, gold, and not repeated as a T1 flag
  const t2 = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 6, target: { x: 30, z: -700, attraction: 'ahead-700' } });
  assert.equal(t2[0].key, 'ahead-700');
  assert.equal(t2[0].glyph, 'ShoppingBag');
  assert.equal(t2[0].color, FLAG_GOLD);
  assert.equal(t2.filter(p => p.key === 'ahead-700').length, 1);
  // beyond the far plane or within 60 u: no target flag (the light column takes the last 150 u) and no duplicate
  assert.equal(pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 6, target: { x: 0, z: 3200 } })[0].role, 'tier1');
  const close = pickFlags({ player: { x: 30, z: -650 }, yaw: YAW_NORTH, attractions: T1, discovered: none, max: 6, target: { x: 30, z: -700, attraction: 'ahead-700' } });
  assert.equal(close.some(p => p.key === 'ahead-700'), false);
  // the target's height can be given (a stop pole, a low site)
  assert.equal(pickFlags({ player: PLAYER, yaw: 0, attractions: [], discovered: none, max: 1, target: { x: 0, z: 500, h: 200 } })[0].h, 70);
});

test('pickFlags: a panorama shows T1 then T2 in view within 2,000 u', () => {
  const list = [...T1, at('far-t1', 0, -1900), at('t2-far', 0, -2100, { rank: 2 }), at('t3', 0, -300, { rank: 3 })];
  const p = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: list, discovered: () => true, max: 8, panorama: true });
  assert.equal(p.length, 8);
  assert.ok(p.every(f => f.role === 'panorama'));
  const ranks = p.map(f => list.find(a => a.id === f.key)!.rank);
  assert.deepEqual([...ranks].sort(), ranks, 'T1 before T2');
  assert.equal(p.some(f => f.key === 't3'), false);
  const all = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: list, discovered: () => true, max: 20, panorama: true }).map(f => f.key);
  assert.ok(all.includes('far-t1') && all.includes('ahead-1700'), 'discovered and beyond 1,600 u still show in a panorama');
  assert.ok(all.includes('ahead-500-t2'));
  assert.equal(all.includes('t2-far'), false);
});

test('flagMax: 3 on phones / quality mid or low, 6 on desktop, 8 in a desktop panorama', () => {
  assert.equal(flagMax({ phone: true }), 3);
  assert.equal(flagMax({ phone: true, panorama: true }), 3);
  assert.equal(flagMax({ phone: false, quality: 'mid' }), 3);
  assert.equal(flagMax({ phone: false, quality: 'high' }), 6);
  assert.equal(flagMax({ phone: false, quality: 'high', panorama: true }), 8);
});

test('the mesh: one InstancedMesh, one ShaderMaterial (1 call, 1 program), no shadow, no fog, no tone mapping; ≤ 60 tris a flag', () => {
  const mesh = flagMesh();
  assert.ok(mesh instanceof THREE.InstancedMesh);
  assert.ok(mesh.material instanceof THREE.ShaderMaterial);
  assert.equal(mesh.material, flagMaterial(), 'the page shares one material instance');
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.receiveShadow, false);
  assert.equal(mesh.frustumCulled, false);
  assert.equal(mesh.material.fog, false);
  assert.equal(mesh.material.toneMapped, false);
  assert.equal(mesh.material.transparent, true);
  assert.equal(mesh.material.depthWrite, false);
  assert.equal(mesh.children.length, 0);
  assert.ok(FLAG_TRIS <= 60, `${FLAG_TRIS} tris a flag`);
  assert.ok(FLAG_TRIS * FLAG_CAPACITY <= 1000, 'all flags ≤ 1k tris');
  const g = flagGeometry();
  assert.equal(g.getIndex()!.count, FLAG_TRIS * 3);
  const part = g.getAttribute('aPart');
  const parts = new Set<number>();
  for (let i = 0; i < part.count; i++) parts.add(part.getX(i));
  assert.deepEqual([...parts].sort(), [0, 1, 2]);
  // the plan's alphas are in the shader: T1 smoothstep(140, 200) × (1 − smoothstep(1500, 1800)); the target from 60 u
  const vs = mesh.material.vertexShader;
  for (const s of ['smoothstep(140.0, 200.0, d)', 'smoothstep(1500.0, 1800.0, d)', 'smoothstep(60.0, 90.0, d)', 'smoothstep(2800.0, 3000.0, d)']) assert.ok(vs.includes(s), s);
  // the warm-up object is built exactly like the real one: same material instance, InstancedMesh, same flags
  const warm = flagWarmupSet();
  const w = warm.objects[0] as THREE.InstancedMesh;
  assert.ok(w instanceof THREE.InstancedMesh);
  assert.equal(w.material, mesh.material);
  assert.equal(w.castShadow, mesh.castShadow);
  assert.deepEqual(Object.keys(w.geometry.attributes).sort(), Object.keys(mesh.geometry.attributes).sort());
  warm.dispose?.();
  mesh.geometry.dispose();
});

test('the pennant never shrinks under 25 CSS px: a 390 × 844 phone at 1,200 u and a desktop', () => {
  const phone = flagScaleDistance(844, 62);
  const desk = flagScaleDistance(900, 42);
  assert.ok(Math.abs(phone - 197) < 3, `phone ${phone}`);
  assert.ok(Math.abs(desk - 328) < 3, `desktop ${desk}`);
  const px = (d: number, vh: number, fov: number, sd: number) => (PENNANT.w * pennantScale(d, sd) * vh) / (2 * d * Math.tan((fov * Math.PI) / 360));
  for (const d of [200, 400, 800, 1200, 1600, 2800]) {
    assert.ok(px(d, 844, 62, phone) >= 25 - 1e-9, `phone at ${d}: ${px(d, 844, 62, phone)}`);
    assert.ok(px(d, 900, 42, desk) >= 25 - 1e-9, `desktop at ${d}`);
  }
  assert.equal(pennantScale(100, 197), 1);
});

test('glyph atlas: every flag glyph has its lucide nodes and its own 64 px cell; the baked file is up to date', () => {
  assert.deepEqual(FLAG_GLYPHS.slice(0, ATTRACTION_GLYPHS.length), [...ATTRACTION_GLYPHS], 'the attraction glyphs first, in order');
  assert.ok(FLAG_GLYPHS.length <= ATLAS.cells * ATLAS.cells);
  for (const g of FLAG_GLYPHS) assert.ok((FLAG_GLYPH_NODES[g] ?? []).length > 0, g);
  const cells = new Set(FLAG_GLYPHS.map(glyphCell));
  assert.equal(cells.size, FLAG_GLYPHS.length);
  const r = atlasCellRect(5);
  assert.deepEqual(r, { x: 64 + 8, y: 64 + 8, size: 48 });
  // drawing: a recorder context sees every cell translated inside the atlas, paths stroked via Path2D
  const log: string[] = [];
  let paths = 0;
  const ctx = {
    save() {}, restore() {}, translate(x: number, y: number) { log.push(`t ${x} ${y}`); }, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    arc() { log.push('arc'); }, rect() {}, roundRect() {}, ellipse() {}, stroke() { log.push('stroke'); }, fill() { log.push('fill'); }, clearRect() { log.push('clear'); },
    lineWidth: 1, lineCap: 'butt' as CanvasLineCap, lineJoin: 'miter' as CanvasLineJoin, strokeStyle: '', fillStyle: '',
  };
  drawGlyphAtlas(ctx, () => { paths++; return {} as Path2D; });
  assert.equal(log[0], 'clear');
  const moves = log.filter(l => l.startsWith('t ')).map(l => l.split(' ').slice(1).map(Number));
  assert.equal(moves.length, FLAG_GLYPHS.length);
  for (const [x, y] of moves) assert.ok(x >= 0 && y >= 0 && x + 48 <= ATLAS.size && y + 48 <= ATLAS.size);
  assert.ok(paths > 30);
  // the Palette's filled dots are filled
  const before = log.length;
  drawGlyph(ctx, FLAG_GLYPH_NODES.Palette, 0, 0, 48, () => ({}) as Path2D);
  assert.ok(log.slice(before).includes('fill'));
  const out = execFileSync(process.execPath, ['scripts/opus-sf/flag-glyphs.mjs', '--check'], { encoding: 'utf8' });
  assert.match(out, /up to date/);
});

test('FlagSlots: stable slots, 0.4 s fades in and out, a returning flag fades back from where it was', () => {
  const pick = (key: string): FlagPick => ({ key, attraction: key, role: 'tier1', x: 0, z: 0, h: 40, color: '#d8744a', glyph: 'Landmark', d: 500 });
  const s = new FlagSlots(3);
  assert.equal(s.update([pick('a'), pick('b')], 0), true);
  assert.equal(s.count, 2);
  assert.equal(s.alpha(0, 0), 0);
  assert.ok(Math.abs(s.alpha(0, FLAG_FADE_S / 2) - 0.5) < 1e-9);
  assert.equal(s.alpha(0, 1), 1);
  assert.equal(s.fading(1), false);
  // same picks: nothing changes
  assert.equal(s.update([pick('a'), pick('b')], 1), false);
  // b dropped at t = 1: fades out, its slot is freed after 0.4 s; a keeps slot 0
  assert.equal(s.update([pick('a'), pick('c')], 1), true);
  assert.equal(s.slots[0]!.pick.key, 'a');
  assert.equal(s.slots[2]!.pick.key, 'c');
  assert.ok(Math.abs(s.alpha(1, 1.2) - 0.5) < 1e-9);
  assert.equal(s.fading(1.2), true);
  // b comes back at 1.2 (alpha 0.5): it continues from 0.5
  s.update([pick('a'), pick('b'), pick('c')], 1.2);
  assert.ok(Math.abs(s.alpha(1, 1.2) - 0.5) < 1e-9);
  assert.ok(Math.abs(s.alpha(1, 1.4) - 1) < 1e-9);
  // drop everything: all fade out, then the sweep frees the slots
  s.update([], 2);
  assert.equal(s.sweep(2.2), false);
  assert.equal(s.sweep(2.41), true);
  assert.equal(s.count, 0);
  // full: a new flag takes the faintest fading slot
  const f = new FlagSlots(2);
  f.update([pick('a'), pick('b')], 0);
  f.update([pick('a')], 1);
  f.update([pick('a'), pick('c')], 1.1);
  assert.deepEqual(f.slots.map(x => x?.pick.key), ['a', 'c']);
});

test('FlagLayer: one mesh, instances placed on the ground, hidden until their ground streams in', () => {
  let groundReady = false;
  const layer = new FlagLayer({ ground: (x, z) => (x > 1000 && !groundReady ? null : 10 + z * 0), capacity: 4 });
  const cam = new THREE.PerspectiveCamera(62, 390 / 844, 0.5, 3000);
  cam.position.set(0, 20, 50);
  const mk = (key: string, x: number): FlagPick => ({ key, attraction: key, role: key === 'tgt' ? 'target' : 'tier1', x, z: -500, h: 40, color: '#3f5f9f', glyph: 'GraduationCap', d: 500 });
  layer.setPicks([mk('a', 0), mk('tgt', 1200)], 0);
  layer.update(cam, 0.5, 844);
  assert.equal(layer.mesh.count, 2);
  assert.equal(layer.mesh.visible, true);
  const inst = layer.mesh.geometry.getAttribute('aInst') as THREE.InstancedBufferAttribute;
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  layer.mesh.getMatrixAt(0, m);
  p.setFromMatrixPosition(m);
  assert.deepEqual([p.x, p.y, p.z], [0, 10, -500]);
  assert.equal(inst.getX(0), 40);
  assert.equal(inst.getY(0), glyphCell('GraduationCap'));
  assert.equal(inst.getZ(0), 1, 'faded in after 0.4 s');
  assert.equal(inst.getW(1), 1, 'the target role code');
  assert.equal(inst.getZ(1), 0, 'its ground is not streamed in yet: hidden');
  groundReady = true;
  layer.update(cam, 1.2, 844);
  assert.ok(inst.getZ(1) > 0);
  layer.mesh.getMatrixAt(1, m);
  p.setFromMatrixPosition(m);
  assert.equal(p.y, 10);
  assert.ok(Math.abs(layer.mesh.material.uniforms.uScaleDist.value - flagScaleDistance(844, 62)) < 1e-9);
  layer.setPicks([], 2);
  layer.update(cam, 2.5, 844);
  assert.equal(layer.mesh.count, 0);
  assert.equal(layer.mesh.visible, false);
  layer.dispose();
});

test('panorama tags: T1 then T2 in view within 2,000 u, at most 8; laid out without overlaps inside the frame', () => {
  const list: FlagSource[] = [
    ...Array.from({ length: 6 }, (_, i) => at(`t1-${i}`, (i - 3) * 120, -300 - i * 200, { name: { zh: `一号${i}`, en: `T1 ${i}` } })),
    ...Array.from({ length: 6 }, (_, i) => at(`t2-${i}`, (i - 3) * 100, -250 - i * 150, { rank: 2, name: { zh: `二号${i}`, en: `T2 ${i}` }, short: { zh: `二${i}`, en: `2-${i}` } })),
    at('no-name', 0, -400),
    at('t1-behind', 0, 500, { name: { zh: '后面', en: 'Behind' } }),
    at('t1-far', 0, -2400, { name: { zh: '太远', en: 'Too far' } }),
  ];
  const tags = pickPanoramaTags(PLAYER, YAW_NORTH, list);
  assert.equal(tags.length, PANORAMA.max);
  assert.deepEqual(tags.slice(0, 6).map(t => t.rank), [1, 1, 1, 1, 1, 1]);
  assert.ok(tags.every(t => t.d <= 2000 && t.id !== 't1-behind' && t.id !== 'no-name'));
  assert.equal(tags.find(t => t.id === 't2-0')!.name.zh, '二0', 'the short name when there is one');
  // (review) a tag stands on its flag: the pole foot and the pole top (the projector anchors it at ground + h)
  const flagged = pickPanoramaTags(PLAYER, YAW_NORTH, [at('fl', 0, -400, { name: { zh: '旗', en: 'Flag' }, flag: { x: 12, z: -410, h: 52 } }), at('plain', 0, -600, { name: { zh: '无旗', en: 'Plain' } })]);
  assert.deepEqual(flagged.map(t => [t.id, t.x, t.z, t.h]), [['fl', 12, -410, 52], ['plain', 0, -600, FLAG_RULES.defaultH]]);
  const sameAsFlags = pickFlags({ player: PLAYER, yaw: YAW_NORTH, attractions: [at('fl', 0, -400, { flag: { x: 12, z: -410, h: 52 } })], discovered: none, max: 3, panorama: true })[0];
  assert.deepEqual([sameAsFlags.x, sameAsFlags.z, sameAsFlags.h], [flagged[0].x, flagged[0].z, flagged[0].h]);
  // screen layout: 390 × 844, anchors in a crowded band
  const inputs = tags.map((t, i) => ({ id: t.id, x: 120 + i * 22, y: 300 + (i % 3) * 6, w: tagWidth(t.name.zh), h: 26, rank: t.rank }));
  const area = { l: 12, t: 72, r: 378, b: 720 };
  const fixed = [{ l: 250, t: 10, r: 378, b: 60 }];
  const placed = layoutPanoramaTags(inputs, area, fixed);
  assert.ok(placed.length >= 5, `placed ${placed.length}`);
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i].box;
    assert.ok(a.l >= area.l && a.r <= area.r && a.t >= area.t && a.b <= area.b);
    for (let j = i + 1; j < placed.length; j++) {
      const b = placed[j].box;
      assert.ok(!(a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t), `${placed[i].id} overlaps ${placed[j].id}`);
    }
  }
  assert.ok(placed.some(p => p.lead), 'crowded tags lift with a leader line');
  // behind the camera / off screen: dropped
  assert.equal(layoutPanoramaTags([{ id: 'x', x: 100, y: 300, w: 60, h: 26, rank: 1, behind: true }, { id: 'y', x: -40, y: 300, w: 60, h: 26, rank: 1 }], area).length, 0);
  assert.equal(tagWidth('双峰'), 25 + 32);
  assert.equal(isPanoramaViewpoint({ id: 'twin-peaks' }), true);
  assert.equal(isPanoramaViewpoint({ id: 'twin-peaks', panorama: false }), false);
  assert.equal(isPanoramaViewpoint({ id: 'x', panorama: true }), true);
});
