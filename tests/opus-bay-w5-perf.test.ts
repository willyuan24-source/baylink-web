import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

/**
 * Wave 5 · lane V (visuals, performance, voice & assets): the hooks and levers of part a.
 *  - W5-V6 the warm-up recipe's helpers (instancedWarmup / meshWarmup) and a lazy registration compiling late;
 *  - W5-V4 the flag glyph atlas at 512² (the wave-4 cells in place, coin / calendar / sparkle / music added);
 *  - W5-V2 the waterfront residents hidden far away in city mode; the label atlas overflow guard.
 */

// --- headless canvas stub (before any world module makes an atlas) ---
const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const warm = await import('../src/opus-bay/world/warmup');

test('W5-V6: instancedWarmup / meshWarmup build the warm-up object like the real one (material, kind, shadows, instance colour)', () => {
  const mat = new THREE.MeshStandardMaterial({ name: 't-coin' });
  const tinted = warm.instancedWarmup(mat, { instanceColor: true, receiveShadow: true });
  assert.equal(tinted.objects.length, 1);
  const im = tinted.objects[0] as THREE.InstancedMesh;
  assert.ok(im.isInstancedMesh);
  assert.equal(im.material, mat, 'the very material instance (its program key)');
  assert.ok(im.instanceColor, 'setColorAt: the USE_INSTANCING_COLOR variant');
  assert.deepEqual([im.castShadow, im.receiveShadow, im.count], [false, true, 1]);
  assert.ok(im.name.startsWith('ob-warmup'), 'never taken for a live object');
  const plain = warm.instancedWarmup(mat, { castShadow: true });
  assert.equal((plain.objects[0] as THREE.InstancedMesh).instanceColor, null, 'no colour: the plain instanced variant');
  assert.equal(plain.objects[0].castShadow, true);
  // the real geometry is used and never disposed by the set; a geometry the set made is
  const real = new THREE.BoxGeometry();
  let disposed = 0;
  real.addEventListener('dispose', () => { disposed++; });
  const withReal = warm.meshWarmup(mat, { geometry: real });
  assert.ok((withReal.objects[0] as THREE.Mesh).isMesh && !(withReal.objects[0] as THREE.InstancedMesh).isInstancedMesh);
  assert.equal((withReal.objects[0] as THREE.Mesh).geometry, real);
  withReal.dispose?.();
  assert.equal(disposed, 0, 'the caller\'s geometry survives');
  let ownDisposed = 0;
  (tinted.objects[0] as THREE.Mesh).geometry.addEventListener('dispose', () => { ownDisposed++; });
  tinted.dispose?.();
  assert.equal(ownDisposed, 1, 'the set\'s own box is freed');
});

test('W5-V6: a lazy feature registering with the helper after the boot warm-up gets its program compiled in a late pass', async () => {
  const compiled: THREE.Object3D[][] = [];
  let target: unknown = null;
  const renderer = {
    info: { programs: [] as unknown[] },
    shadowMap: { enabled: true },
    getRenderTarget: () => target,
    setRenderTarget: (t: unknown) => { target = t; },
    compileAsync: (group: THREE.Object3D) => {
      const objs: THREE.Object3D[] = [];
      group.traverse(o => { if (o !== group) objs.push(o); });
      compiled.push(objs);
      renderer.info.programs.push({});
      return Promise.resolve();
    },
  } as unknown as THREE.WebGLRenderer;
  warm.resetWarmupState();
  await warm.warmPrograms(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), { offscreen: false });
  compiled.length = 0;
  const COIN = new THREE.MeshStandardMaterial({ name: 't-coin-late' });
  const off = warm.registerWarmup('t-w5-coins', () => warm.instancedWarmup(COIN, { instanceColor: true }));
  await new Promise(r => setTimeout(r, 80));
  const first = compiled[0] ?? [];
  const coin = first.find(o => (o as THREE.Mesh).material === COIN) as THREE.InstancedMesh | undefined;
  assert.ok(coin?.isInstancedMesh && coin.instanceColor, 'the coin mesh kind compiled on its own, ≈ 30 ms after registering');
  assert.deepEqual(warm.lateWarmups.at(-1)?.keys, ['t-w5-coins']);
  off();
  warm.resetWarmupState();
});

test('W5-V4: the flag atlas is 512² with room for 64 glyphs; the wave-4 cells keep their place; coins, calendar, sparkles and music are drawn', async () => {
  const { FLAG_GLYPHS } = await import('../src/opus-bay/game/flags');
  const F = await import('../src/opus-bay/world/sf/flags');
  const { FLAG_GLYPH_NODES } = await import('../src/opus-bay/world/sf/flagGlyphs');
  assert.equal(F.ATLAS.size, 512);
  assert.equal(F.ATLAS.cells * F.ATLAS.cell, F.ATLAS.size);
  for (const gl of ['Coins', 'CalendarDays', 'Sparkles', 'Music'] as const) {
    assert.ok(FLAG_GLYPHS.includes(gl), gl);
    assert.ok((FLAG_GLYPH_NODES[gl] ?? []).length > 0, `${gl} has its lucide nodes`);
  }
  assert.deepEqual(FLAG_GLYPHS.slice(0, 16), ['Landmark', 'Palette', 'Trees', 'PawPrint', 'Mountain', 'Binoculars', 'Waves', 'Sailboat', 'GraduationCap', 'ShoppingBag', 'Trophy', 'Church', 'Theater', 'Castle', 'Signpost', 'MapPin'], 'append only: the wave-4 cells');
  // the wave-4 cells keep their pixels (a 4 × 4 grid of 64 px in the top-left quadrant)
  for (let i = 0; i < 16; i++) assert.deepEqual(F.atlasCellRect(i), { x: (i % 4) * 64 + 8, y: Math.floor(i / 4) * 64 + 8, size: 48 }, `cell ${i}`);
  // every one of the 64 cells distinct and inside the canvas; cells 16–31 in the top-right quadrant
  const seen = new Set<string>();
  for (let i = 0; i < F.ATLAS.cells * F.ATLAS.cells; i++) {
    const r = F.atlasCellRect(i);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.size <= 512 && r.y + r.size <= 512, `cell ${i} inside`);
    seen.add(`${r.x},${r.y}`);
    if (i >= 16 && i < 32) assert.ok(r.x >= 256 && r.y < 256, `cell ${i}: top-right quadrant`);
  }
  assert.equal(seen.size, 64);
  // the fragment shader mirrors atlasCellColRow: evaluate its formula for every cell (the GLSL expressions in JS)
  const frag = F.makeFlagMaterial().fragmentShader;
  const num = (re: RegExp) => { const m = re.exec(frag); assert.ok(m, `shader: ${re}`); return Number(m[1]); };
  const per = num(/float blk = floor\(cell \/ ([\d.]+)\)/), blockW = num(/float col = mod\(inb, ([\d.]+)\)/), blocksRow = num(/mod\(blk, ([\d.]+)\)/), cells = num(/vec2 cuv = vec2\(\(col \+ g\.x\) \/ ([\d.]+)/);
  for (let cell = 0; cell < 64; cell++) {
    const blk = Math.floor(cell / per), inb = cell % per;
    const col = (inb % blockW) + (blk % blocksRow) * blockW, row = Math.floor(inb / blockW) + Math.floor(blk / blocksRow) * blockW;
    assert.deepEqual({ col, row }, F.atlasCellColRow(cell), `shader cell ${cell}`);
    // the glyph box's centre, in uv (v up), lands on the cell the canvas drew
    const r = F.atlasCellRect(cell);
    const u = (col + 0.5) / cells, v = (cells - 1 - row + 0.5) / cells;
    assert.ok(Math.abs(u * 512 - (r.x + r.size / 2)) < 1e-6 && Math.abs((1 - v) * 512 - (r.y + r.size / 2)) < 1e-6, `uv of cell ${cell}`);
  }
  // the drawing: one translate per glyph, all inside the 512² canvas
  const moves: number[][] = [];
  const ctx = {
    save() {}, restore() {}, translate(x: number, y: number) { moves.push([x, y]); }, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    arc() {}, rect() {}, roundRect() {}, ellipse() {}, stroke() {}, fill() {}, clearRect() {},
    lineWidth: 1, lineCap: 'butt' as CanvasLineCap, lineJoin: 'miter' as CanvasLineJoin, strokeStyle: '', fillStyle: '',
  };
  F.drawGlyphAtlas(ctx, () => ({}) as Path2D);
  assert.equal(moves.length, FLAG_GLYPHS.length);
  assert.deepEqual(moves[16], [F.atlasCellRect(16).x, F.atlasCellRect(16).y], 'Coins in cell 16');
});

test('W5-V2: in city mode the waterfront residents hide beyond 250 u (no draw, obstacle or blob) and come back inside 235 u; district mode never hides them', async () => {
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const N = await import('../src/opus-bay/actors/npcs');
  const def = N.NPC_DEFS.find(d => d.id === 'npc-vendor')!;
  const city = new N.Npc(def, 'city'), district = new N.Npc(def, 'district');
  const place = (d: number) => { runtime.player.x = city.x + d; runtime.player.z = city.z; };
  const obstacles = (n: InstanceType<typeof N.Npc>) => { const out: { kind: string }[] = []; n.obstacle(out as never); return out.length; };
  place(20);
  city.update(0.016, 1); district.update(0.016, 1);
  assert.ok(city.visible && city.object.visible && obstacles(city) === 1);
  place(N.DISTRICT_NPC_HIDE + 5);
  city.update(0.016, 2); district.update(0.016, 2);
  assert.equal(city.visible, false);
  assert.equal(city.object.visible, false, 'not drawn (nor its shadow)');
  assert.equal(obstacles(city), 0, 'no obstacle');
  assert.ok(district.visible && district.object.visible && obstacles(district) === 1, 'district mode unchanged');
  // hysteresis: still hidden between SHOW and HIDE, shown again inside SHOW
  place((N.DISTRICT_NPC_HIDE + N.DISTRICT_NPC_SHOW) / 2);
  city.update(0.016, 3);
  assert.equal(city.visible, false);
  place(N.DISTRICT_NPC_SHOW - 5);
  city.update(0.016, 4);
  assert.ok(city.visible && city.object.visible);
  assert.ok(N.DISTRICT_NPC_SHOW < N.DISTRICT_NPC_HIDE && N.DISTRICT_NPC_SHOW > N.RESIDENT_LOAD);
});

test('W5-V2: the label atlas never draws past its edge: a label that does not fit is a blank plaque, counted once; the district\'s labels fit', async () => {
  const { LabelAtlas, LABEL_RESERVE } = await import('../src/opus-bay/world/labels');
  const a = new LabelAtlas();
  const rects: { u0: number; v0: number; u1: number; v1: number }[] = [];
  for (let i = 0; i < 400; i++) rects.push(a.label(`t${i}`, { text: `T${i}`, w: 300, h: 64, bg: '#fff', fg: '#000' }));
  assert.ok(a.overflow > 0, 'the loop overfills the atlas');
  for (const r of rects) {
    assert.ok(r.u0 >= 0 && r.u1 <= 1 && r.v0 >= 0 && r.v1 <= 1 && r.u0 < r.u1 && r.v0 < r.v1, JSON.stringify(r));
    // real cells stay above the reserved strip; the blank one sits inside it
    const inStrip = r.v1 * 1024 <= LABEL_RESERVE;
    assert.ok(inStrip || r.v0 * 1024 >= LABEL_RESERVE - 1e-9);
  }
  const n = a.overflow;
  assert.deepEqual(a.label('t399', { text: 'again', w: 300, h: 64, bg: '#fff', fg: '#000' }), rects[399], 'cached');
  assert.equal(a.overflow, n, 'a key is counted once');
  assert.ok(a.used <= 1);
  // a too-wide label never allocates
  const b = new LabelAtlas();
  const wide = b.label('wide', { text: 'x', w: 2000, h: 64, bg: '#fff', fg: '#000' });
  assert.equal(b.overflow, 1);
  assert.ok(wide.v1 * 1024 <= LABEL_RESERVE);
  // the district World's labels: all placed, room left
  const { World } = await import('../src/opus-bay/world/world');
  const w = new World();
  assert.equal(w.atlas.overflow, 0);
  assert.ok(w.atlas.used < 0.95, `district atlas used ${w.atlas.used}`);
});
