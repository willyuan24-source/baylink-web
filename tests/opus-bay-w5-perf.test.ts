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
  const per = num(/float blk = floor\(cell \/ ([\d.]+)\)/), blockW = num(/float acol = mod\(inb, ([\d.]+)\)/), blocksRow = num(/mod\(blk, ([\d.]+)\)/), cells = num(/vec2 cuv = vec2\(\(acol \+ g\.x\) \/ ([\d.]+)/);
  // a float named col / row inside the glyph block shadows the vec3 flag colour and breaks mix() (e276fe0: no flag drew)
  assert.ok(!/float col\b/.test(frag) && !/float row\b/.test(frag), 'no float col / row in the flag shader');
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

test('W5-V2: the hero far detail keeps every building triangle for triangle, ≤ 30 % of the near toy triangles, one far chunk per near tile; district mode builds none', async () => {
  const { loadCity } = await import('../src/opus-bay/world/cityLoader');
  await loadCity();
  const { World } = await import('../src/opus-bay/world/world');
  const { Batch } = await import('../src/opus-bay/world/builder');
  const { buildCity } = await import('../src/opus-bay/world/city');
  const { LabelBatch } = await import('../src/opus-bay/world/labels');
  const F = await import('../src/opus-bay/world/sf/farHero');
  const tris = (m: THREE.Mesh) => (m.geometry.getIndex()?.count ?? 0) / 3;
  const city = new World('city');
  const tiles = (city as unknown as { heroTiles: import('../src/opus-bay/world/sf/farHero').HeroTile[] }).heroTiles;
  const paired = tiles.filter(t => t.near && t.far);
  assert.ok(paired.length >= 6, `${paired.length} tiles with near and far chunks`);
  assert.equal(tiles.filter(t => t.far && !t.near).length, 0, 'no far chunk without its near tile');
  let near = 0, far = 0;
  for (const t of tiles) { if (t.near) near += tris(t.near); if (t.far) far += tris(t.far); }
  assert.ok(near > 100_000 && far < near * 0.3, `near ${near}, far ${far}`);
  for (const t of paired) {
    assert.equal(t.far!.visible, false, 'the far chunks start hidden');
    assert.equal(t.far!.material, t.near!.material, 'the same TOY material (same program; the fade pairs dress both)');
    assert.deepEqual([t.far!.castShadow, t.far!.receiveShadow], [t.near!.castShadow, t.near!.receiveShadow]);
    assert.ok(/^city-far#\d+$/.test(t.far!.name) && t.far!.parent === city.root);
    assert.ok(t.box.x1 - t.box.x0 <= 150 + 60 && t.box.z1 - t.box.z0 <= 150 + 60, 'about one 150 u tile');
  }
  // the far geometry starts with buildCity's triangles, byte for byte (the skyline never changes at the swap)
  const lots = new Batch();
  buildCity(lots, new LabelBatch(), city.atlas);
  const farGeo = F.heroFarGeometry(city.atlas);
  const n = lots.idx.length, pos = farGeo.getAttribute('position') as THREE.BufferAttribute, idx = farGeo.getIndex()!;
  for (let i = 0; i < n; i += 97) {
    const a = lots.idx[i], b = idx.getX(i);
    assert.deepEqual([pos.getX(b), pos.getY(b), pos.getZ(b)].map(v => Math.fround(v)), [lots.pos[a * 3], lots.pos[a * 3 + 1], lots.pos[a * 3 + 2]].map(v => Math.fround(v)), `vertex of index ${i}`);
  }
  assert.ok(idx.count / 3 - n / 3 < 12_000, `the planting stand-ins: ${(idx.count - n) / 3} triangles`);
  // district mode: no far chunk, no tile
  const district = new World('district');
  let farMeshes = 0;
  district.root.traverse(o => { if (o.name.startsWith('city-far#')) farMeshes++; });
  assert.equal(farMeshes, 0);
  assert.equal((district as unknown as { heroTiles: unknown[] }).heroTiles.length, 0);
});

test('W5-V2: the streamer swaps a hero tile to its far detail beyond HERO_TILE_FAR with the dither cross-fade, back inside it (hysteresis), and hides both while the whole hero is far', async () => {
  const { CityStreamer, HERO_TILE_FAR, HERO_TILE_HYST, TIER_FADE } = await import('../src/opus-bay/world/sf/stream');
  const M = await import('../src/opus-bay/world/materials');
  const near = new THREE.Mesh(new THREE.BufferGeometry(), M.TOY), far = new THREE.Mesh(new THREE.BufferGeometry(), M.TOY);
  far.visible = false;
  const tile = { near, far, box: { x0: 0, z0: 0, x1: 150, z1: 150 } };
  const sites = { group: new THREE.Group(), dispose: noop, counts: () => ({ near: 0, triangles: 0 }) };
  const s = new CityStreamer({ renderer: { extensions: { has: () => true } } as never, quality: 'high', slab: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], sites: sites as never, farInit: {} as never, onFar: noop, hero: { meshes: [], proxy: () => null, tiles: [tile] } });
  const priv = s as unknown as { focus: { x: number; z: number }; time: number; _heroFar: boolean; updateHeroTiles(): void; applyHeroTiles(): void; stepFades(): void };
  const at = (d: number) => { priv.focus.x = 150 + d; priv.focus.z = 75; priv.updateHeroTiles(); };
  const settle = () => { priv.time += TIER_FADE + 0.01; priv.stepFades(); };
  at(HERO_TILE_FAR.high - 10);
  assert.deepEqual([near.visible, far.visible], [true, false], 'near inside the radius');
  at(HERO_TILE_FAR.high + 10);
  assert.deepEqual([near.visible, far.visible], [true, true], 'both drawn while they cross-fade');
  assert.notEqual(far.material, M.TOY, 'the far chunk dithers in on a fade pair');
  assert.notEqual(near.material, M.TOY, 'the near chunk dithers out on another');
  settle();
  assert.deepEqual([near.visible, far.visible], [false, true]);
  assert.deepEqual([near.material, far.material], [M.TOY, M.TOY], 'the plain material back after the fade');
  assert.deepEqual(s.stats().heroTiles, { far: 1, of: 1 });
  // hysteresis: between R − HYST and R it stays far; inside R − HYST it comes back
  at(HERO_TILE_FAR.high - HERO_TILE_HYST / 2);
  settle();
  assert.deepEqual([near.visible, far.visible], [false, true]);
  at(HERO_TILE_FAR.high - HERO_TILE_HYST - 5);
  settle();
  assert.deepEqual([near.visible, far.visible], [true, false]);
  // a quick flip (out, then back within the fade) ends on the newer state
  at(HERO_TILE_FAR.high + 30);
  priv.time += 0.1; priv.stepFades();
  at(HERO_TILE_FAR.high - HERO_TILE_HYST - 30);
  settle();
  assert.deepEqual([near.visible, far.visible, near.material, far.material], [true, false, M.TOY, M.TOY]);
  // the whole hero far (the L1 boxes stand in): both hidden; back near: the tile's own state
  at(HERO_TILE_FAR.high + 50); settle();
  priv._heroFar = true; priv.applyHeroTiles();
  assert.deepEqual([near.visible, far.visible], [false, false]);
  priv._heroFar = false; priv.applyHeroTiles();
  assert.deepEqual([near.visible, far.visible], [false, true]);
  // mid quality swaps sooner
  assert.ok(HERO_TILE_FAR.mid < HERO_TILE_FAR.high && HERO_TILE_FAR.low < HERO_TILE_FAR.mid);
  s.dispose();
  assert.deepEqual([near.visible, far.visible], [true, false], 'dispose: back to the near chunk');
});

test('W5-V4: the signs atlas — 1024² of 256 × 128 plaques, append-only ids, generic trade words only, each plaque painted in its own cell', async () => {
  const S = await import('../src/opus-bay/world/sf/signsAtlas');
  assert.equal(S.SIGN_ATLAS.size, 1024);
  assert.equal(S.SIGN_ATLAS.cols * S.SIGN_ATLAS.cellW, 1024);
  assert.equal(S.SIGN_ATLAS.rows * S.SIGN_ATLAS.cellH, 1024);
  assert.ok(S.SIGNS.length <= S.SIGN_ATLAS.cols * S.SIGN_ATLAS.rows);
  // append only: the first ids never move (lane L's corners name them)
  assert.deepEqual(S.SIGNS.slice(0, 13).map(s => s.id), ['bakery', 'dim-sum', 'books', 'flowers', 'coffee', 'grocery', 'produce', 'tea', 'noodles', 'hardware', 'taqueria', 'panaderia', 'mercado']);
  assert.equal(new Set(S.SIGNS.map(s => s.id)).size, S.SIGNS.length);
  // generic trade words only (plan §3.6 / D24: never a brand or a shop's name): the whole vocabulary is this list
  const WORDS = new Set(['面包', 'Bakery', '点心', 'Dim Sum', '书店', 'Books', '花店', 'Flowers', '咖啡', 'Coffee', '杂货', 'Grocery', '蔬果', 'Produce', '茶', 'Tea', '面馆', 'Noodles', '五金', 'Hardware', 'Taquería', 'Tacos · Burritos', 'Panadería', 'Mercado', 'Market', 'Café', 'Records', 'Vintage', 'Barber', 'Deli', 'Soul Food', '洗衣', 'Laundry']);
  for (const s of S.SIGNS) {
    for (const l of s.lines) if (l) assert.ok(WORDS.has(l.text), `${s.id}: "${l.text}" is not in the generic vocabulary`);
    const z = s.lines.find(l => l?.script === 'zh');
    if (z) assert.ok([...z.text].length <= 4, `${s.id}: short Chinese`);
    assert.ok(S.SIGN_STYLES[s.style]);
  }
  // cells: inside the canvas, distinct, uv rectangles inside their plaque (v up)
  const boxes = new Set<string>();
  for (let i = 0; i < S.SIGNS.length; i++) {
    const b = S.signCellBox(i);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 1024 && b.y + b.h <= 1024 && b.w === 2 * b.h, `plaque ${i}: 2 : 1 inside the canvas`);
    boxes.add(`${b.x},${b.y}`);
    const r = S.signRect(S.SIGNS[i].id)!;
    assert.ok(r.u0 * 1024 > b.x && r.u1 * 1024 < b.x + b.w && (1 - r.v1) * 1024 > b.y && (1 - r.v0) * 1024 < b.y + b.h, `uv of ${S.SIGNS[i].id}`);
  }
  assert.equal(boxes.size, S.SIGNS.length);
  assert.equal(S.signRect('no-such-sign'), null);
  // painting: every plaque's words drawn inside its own box
  const texts: { text: string; x: number; y: number; tx: number; ty: number }[] = [];
  let tx = 0, ty = 0;
  const stack: [number, number][] = [];
  const ctx = {
    save() { stack.push([tx, ty]); }, restore() { [tx, ty] = stack.pop()!; }, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, fillRect() {}, clearRect() {}, translate(x: number, y: number) { tx += x; ty += y; }, scale() {},
    fillText(text: string, x: number, y: number) { texts.push({ text, x, y, tx, ty }); }, measureText: (t: string) => ({ width: t.length * 30 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    font: '', fillStyle: '' as unknown, strokeStyle: '' as unknown, lineWidth: 1, textAlign: 'left' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline, globalAlpha: 1,
  };
  S.drawSignsAtlas(ctx);
  S.SIGNS.forEach((s, i) => {
    const b = S.signCellBox(i);
    for (const l of s.lines) {
      if (!l) continue;
      const want = l.script === 'zh' ? [...l.text].join(' ') : l.text;
      const t = texts.find(e => e.text === want && e.x + e.tx >= b.x && e.x + e.tx <= b.x + b.w && e.y + e.ty >= b.y && e.y + e.ty <= b.y + b.h);
      assert.ok(t, `${s.id}: "${want}" drawn inside its plaque`);
    }
  });
});

test('W5-V4: SignBatch quads face their yaw, carry the plaque\'s uvs, 2 : 1; signsMaterial is one own instance, warmed as \'v-signs\'', async () => {
  const S = await import('../src/opus-bay/world/sf/signsAtlas');
  const sb = new S.SignBatch();
  assert.equal(sb.plaque('bakery', 10, 3, 20, 0, 2.4), true);
  assert.equal(sb.plaque('nope', 0, 0, 0, 0, 1), false);
  assert.equal(sb.count, 1);
  const geo = sb.build();
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
  assert.equal(pos.count, 4);
  assert.deepEqual([nor.getX(0), nor.getY(0), nor.getZ(0)], [0, 0, 1], 'ry 0 faces +z');
  const xs = [0, 1, 2, 3].map(i => pos.getX(i)), ys = [0, 1, 2, 3].map(i => pos.getY(i));
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 2.4) < 1e-5 && Math.abs(Math.max(...ys) - Math.min(...ys) - 1.2) < 1e-5);
  assert.ok(Math.abs(pos.getZ(0) - 20.02) < 1e-5, 'lifted 0.02 u off its wall');
  const r = S.signRect('bakery')!;
  assert.deepEqual([uv.getX(0), uv.getY(0), uv.getX(2), uv.getY(2)], [r.u0, r.v0, r.u1, r.v1]);
  const m = S.signsMaterial();
  assert.equal(S.signsMaterial(), m, 'one instance');
  assert.equal(m.name, 'ob-signs');
  assert.ok(m.map && m.emissiveMap === m.map);
  // the warm-up registration: a late pass after a boot warm-up compiles a plain Mesh with this very material
  const compiled: THREE.Object3D[] = [];
  let target: unknown = null;
  const renderer = {
    info: { programs: [] as unknown[] }, shadowMap: { enabled: true },
    getRenderTarget: () => target, setRenderTarget: (t: unknown) => { target = t; },
    compileAsync: (group: THREE.Object3D) => { group.traverse(o => { if (o !== group) compiled.push(o); }); renderer.info.programs.push({}); return Promise.resolve(); },
  } as unknown as THREE.WebGLRenderer;
  warm.resetWarmupState();
  await warm.warmPrograms(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), { offscreen: false });
  const sign = compiled.find(o => (o as THREE.Mesh).material === m) as THREE.Mesh | undefined;
  assert.ok(sign && !(sign as unknown as THREE.InstancedMesh).isInstancedMesh && sign.receiveShadow && !sign.castShadow, 'the sign program is in the boot pass (registered at module load)');
  warm.resetWarmupState();
});

// ---------------------------------------------------------------------------
// Part b · W5-V5: lit nights in the outer city, coin glints
// ---------------------------------------------------------------------------

test('W5-V5: residential streets glow in the lit outer zones only (level 0.35, one pool per side every 24 u); FiDi and SoMa keep their lights', async () => {
  const L = await import('../src/opus-bay/world/sf/look');
  assert.deepEqual(L.asphaltInfo('residential', 4, 5, 1), [5, 0, 0, 1], 'default (and district / downtown): unlit');
  const res = L.asphaltInfo('residential', 4, 5, 1, true) as (s: number, o: number) => readonly number[];
  assert.equal(typeof res, 'function');
  assert.deepEqual(res(24, -4), [5, 24 * L.NIGHT_STREETS.resScale, -1, 1 + L.NIGHT_STREETS.residential]);
  // the shader's pool pattern is 9 u: read along 0.375 × the arc length, a pool per side every 24 u
  assert.equal(9 / L.NIGHT_STREETS.resScale, 24);
  assert.deepEqual((L.asphaltInfo('primary', 4, 5, 1, true) as (s: number, o: number) => readonly number[])(12, 4), [5, 12, 1, 2], 'lit classes unchanged');
  assert.ok(L.NIGHT_STREETS.residential < L.STREET_LAMP.tertiary, 'dimmer than any main street');
  for (const z of ['sunset-parkside', 'outer-richmond', 'bayview-hunters-point', 'excelsior', 'haight-ashbury', 'marina', 'glen-park', 'chinatown', 'tenderloin', 'nob-hill', 'north-beach']) assert.ok(L.litOuterZone(z), z);
  for (const z of ['financial-district-south-beach', 'south-of-market', null, '']) assert.ok(!L.litOuterZone(z), String(z));
});

test('W5-V5: lamp posts on the published streets of the lit zones — inside their chunk, off every carriageway, clear of mapped lamps and trees; none downtown, none without zones', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const B = await import('../src/opus-bay/world/sf/build');
  const L = await import('../src/opus-bay/world/sf/look');
  const F = await import('../src/opus-bay/world/sf/format');
  const { CitySites } = await import('../src/opus-bay/world/sf/sites');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const { CHUNK, CURB_BAND } = await import('../src/opus-bay/core/geo');
  const { inPoly } = await import('../src/opus-bay/world/sf/raster');
  const sf = sfDisk();
  const zones = L.lookZones(await sf.far());
  const init = { palettes: sf.manifest.palettes, slab: DISTRICT.slab, excludes: new CitySites().excludes(), zones };
  const LAMP = F.PROP_KINDS.indexOf('lamp');
  const TREES = new Set(['tree', 'pine', 'palm'].map(k => F.PROP_KINDS.indexOf(k as (typeof F.PROP_KINDS)[number])));
  const CARRIAGEWAY = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'];
  // the Sunset (-3_10), the Outer Richmond (-4_8), the Haight (-1_6), the Mission (3_5); FiDi / SoMa (1_0, 1_-1, 1_1, 1_2)
  let total = 0;
  for (const [cx, cz] of [[-3, 10], [-4, 8], [-1, 6], [3, 5]]) {
    const c = (await sf.chunk(cx, cz))!;
    const ctx = B.chunkContext(c, init);
    const lamps = B.outerLamps(ctx);
    assert.ok(lamps.length >= 20, `${cx}_${cz}: ${lamps.length} lamps`);
    assert.deepEqual(B.outerLamps(B.chunkContext(c, init)), lamps, 'deterministic');
    total += lamps.length;
    const mapped: [number, number][] = [], trees: [number, number][] = [];
    for (let i = 0; i < c.props.count; i++) {
      if (c.props.kind[i] === LAMP) mapped.push([c.props.xz[i * 2], c.props.xz[i * 2 + 1]]);
      else if (TREES.has(c.props.kind[i])) trees.push([c.props.xz[i * 2], c.props.xz[i * 2 + 1]]);
    }
    for (const l of lamps) {
      assert.ok(l.x >= cx * CHUNK && l.z >= cz * CHUNK && l.x < (cx + 1) * CHUNK && l.z < (cz + 1) * CHUNK, 'inside its chunk');
      assert.ok(L.litOuterZone(L.zoneAt(zones, l.x, l.z)), 'in a lit zone');
      assert.ok(!inPoly(l.x, l.z, DISTRICT.slab));
      assert.ok(mapped.every(([x, z]) => Math.hypot(x - l.x, z - l.z) >= L.NIGHT_STREETS.osmClear), 'clear of the mapped lamps');
      assert.ok(trees.every(([x, z]) => Math.hypot(x - l.x, z - l.z) >= 1.1), 'not in a tree');
      // off every carriageway of the chunk (the asphalt half width + 0.3 u)
      const rd = c.roads;
      for (let i = 0; i < rd.count; i++) {
        const k = F.ROAD_CLASSES[rd.cls[i]];
        if (!CARRIAGEWAY.includes(k) || rd.flags[i] & (F.ROAD_FLAG.bridge | F.ROAD_FLAG.deckOnly)) continue;
        const ahw = Math.max(1.6, rd.width[i] - CURB_BAND * 2) / 2;
        for (let p = rd.pStart[i]; p + 1 < rd.pStart[i + 1]; p++) {
          const ax = rd.xyz[p * 3], az = rd.xyz[p * 3 + 2], bx = rd.xyz[p * 3 + 3], bz = rd.xyz[p * 3 + 5];
          const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
          const t = L2 > 0 ? Math.max(0, Math.min(1, ((l.x - ax) * dx + (l.z - az) * dz) / L2)) : 0;
          assert.ok(Math.hypot(l.x - ax - dx * t, l.z - az - dz * t) >= ahw + 0.29, `a lamp on the carriageway of a ${k}`);
        }
      }
    }
    // the chunk's instanced props carry them as lamps
    const props = B.buildL1(ctx).props;
    const lampsInProps = Array.from(props.kind).filter(k => k === LAMP).length;
    assert.ok(lampsInProps >= lamps.length, `${lampsInProps} lamp props`);
  }
  assert.ok(total >= 150, `${total} lamps in four outer chunks`);
  for (const [cx, cz] of [[1, 0], [1, -1], [1, 1], [1, 2]]) {
    const c = (await sf.chunk(cx, cz))!;
    assert.equal(B.outerLamps(B.chunkContext(c, init)).length, 0, `downtown ${cx}_${cz}: none`);
  }
  const c = (await sf.chunk(-3, 10))!;
  assert.equal(B.outerLamps(B.chunkContext(c, { ...init, zones: null })).length, 0, 'no zones: none');
});

test('W5-V5: the lamp layer stays capped (48 posts, ≈ 24 in view: ≤ 3.5k triangles), so the outer posts add no draw call where a lamp already stood', async () => {
  const P = await import('../src/opus-bay/world/sf/props');
  assert.equal(P.propCaps(0).lamp, 48);
  assert.equal(P.PROP_VIEW.k, 0.5);
  const cp = new P.CityProps();
  const lampMesh = cp.group.children.find(o => o.name === 'city-lamps') as THREE.InstancedMesh;
  const tris = (lampMesh.geometry.getIndex()?.count ?? lampMesh.geometry.getAttribute('position').count) / 3;
  assert.ok(tris * 24 <= 3500, `${tris} triangles a post`);
  assert.equal(lampMesh.castShadow, false, 'no shadow pass');
});

test('W5-V5: coin glints — the field keeps 16 glint slots after its lights (same Points draw), fills them from the drawn coins at night, clears them by day', async () => {
  const Li = await import('../src/opus-bay/world/sf/lights');
  assert.equal(Li.GLINT_SLOTS, 16);
  // where a glint sits: a trail coin's centre bobs 0.8 u up, a cache's top coin 1.15 u, an air coin is its own centre
  const world = {
    items: [
      { kind: 'trail', x: 1, y: 2, z: 3, air: false }, { kind: 'cache', x: 4, y: 5, z: 6, air: false },
      { kind: 'cache', x: 7, y: 8, z: 9, air: true }, { kind: 'ring', x: 10, y: 11, z: 12, air: true },
    ],
    visible: [3, 0, 1, 2],
  };
  const spots = Li.coinGlints(world);
  assert.deepEqual(spots.map(s => +s.y.toFixed(3)), [11.45, 3.25, 6.6, 9]);
  assert.deepEqual(spots.map(s => s.x), [10, 1, 4, 7], 'in the draw order (nearest first)');
  assert.equal(Li.coinGlints(null).length, 0);
  assert.equal(Li.coinGlints({ items: world.items, visible: Array(40).fill(0) }).length, Li.GLINT_SLOTS);
  const renderer = { getDrawingBufferSize: (v: THREE.Vector2) => v.set(960, 600) } as unknown as THREE.WebGLRenderer;
  let live: { x: number; y: number; z: number }[] = spots;
  const field = new Li.LightField(renderer, { siteLights: () => [], glints: () => live });
  field.setExtra([{ x: 0, y: 5, z: 0, level: 1, color: [1, 0.6, 0.3] }]);
  field.setFar({ lines: { count: 0, cls: new Uint8Array(0), flags: new Uint8Array(0), width: new Float32Array(0), pStart: new Uint32Array([0]), xyz: new Float32Array(0) } } as never);
  const base = field.count;
  const pts = field.group.children[0] as THREE.Points;
  assert.equal(pts.geometry.getAttribute('position').count, base + Li.GLINT_SLOTS, 'the slots follow the lights');
  const cam = new THREE.PerspectiveCamera(50);
  field.update(0.3, 0, cam, 1);
  assert.equal(field.glintCount, 4);
  const lvl = pts.geometry.getAttribute('aLevel'), pos = pts.geometry.getAttribute('position');
  for (let k = 0; k < Li.GLINT_SLOTS; k++) {
    if (k < 4) { assert.ok(lvl.getX(base + k) >= 3 && lvl.getX(base + k) < 4, 'a glint level'); assert.equal(pos.getX(base + k), spots[k].x); }
    else assert.equal(lvl.getX(base + k), 0, 'unused: culled');
  }
  // a coin picked up: its glint goes at the next refresh (≤ 5 Hz)
  live = spots.slice(1);
  field.update(0.1, 0, cam, 1);
  assert.equal(field.glintCount, 4, 'not before 0.2 s');
  field.update(0.15, 0, cam, 1);
  assert.equal(field.glintCount, 3);
  // a rebuild (landmark lights streaming in) keeps them
  field.setExtra([]);
  assert.equal(field.glintCount, 3);
  assert.ok((field.group.children[0] as THREE.Points).geometry.getAttribute('aLevel').getX(field.count) >= 3);
  // by day: the field is hidden and the glints are cleared
  field.update(0.3, 0, cam, 0);
  assert.equal(field.visible, false);
  assert.equal(field.glintCount, 0);
  field.dispose();
  // the shader: a glint branch (star, no near fade) before the blinking aviation lights, one program
  const vs = Li.LIGHT_FIELD.vertexShader, fs = Li.LIGHT_FIELD.fragmentShader;
  assert.ok(vs.includes('aLevel >= 3.0') && vs.indexOf('aLevel >= 3.0') < vs.indexOf('aLevel >= 2.0'));
  assert.ok(vs.includes('varying float vStar') && fs.includes('varying float vStar'));
});

// ---------------------------------------------------------------------------
// Part b · W5-V8: the six secret postcards (H5-2)
// ---------------------------------------------------------------------------

/** A WebP's size from its first chunk (VP8 / VP8L / VP8X). */
function webpSize(b: Uint8Array): [number, number] {
  const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
  assert.equal(String.fromCharCode(b[0], b[1], b[2], b[3], b[8], b[9], b[10], b[11]), 'RIFFWEBP');
  if (tag === 'VP8 ') return [(b[26] | (b[27] << 8)) & 0x3fff, (b[28] | (b[29] << 8)) & 0x3fff];
  if (tag === 'VP8L') { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
}

test('W5-V8: the six secret postcards — one per egg of lane D\'s registry, 1200 × 900 and 600 × 450 WebP on disk, small, bilingual titles', async () => {
  const fsm = await import('node:fs');
  const P = await import('../src/opus-bay/data/sf/eggPostcards');
  const { EGG_IDS } = await import('../src/opus-bay/eggs/registry');
  assert.equal(P.EGG_POSTCARDS.length, 6);
  assert.deepEqual(P.EGG_POSTCARDS.map(p => p.egg).sort(), ['china-beach-fishermen', 'dahlia-dell-100', 'ggb-foghorn-duet', 'lands-end-labyrinth', 'telegraph-hill-parrots', 'wave-organ-high-tide']);
  for (const p of P.EGG_POSTCARDS) {
    assert.ok(EGG_IDS.includes(p.egg), `${p.egg} is an egg`);
    assert.equal(P.eggPostcard(p.egg), p);
    assert.ok(p.title.zh.length <= 12 && p.title.en.length <= 40 && [...p.alt.zh].length <= 45);
    for (const [url, size, max] of [[p.large, [1200, 900], 160_000], [p.small, [600, 450], 60_000]] as const) {
      const buf = new Uint8Array(fsm.readFileSync(`public${url}`));
      assert.deepEqual(webpSize(buf), size, url);
      assert.ok(buf.length <= max, `${url} ${buf.length} B`);
    }
  }
  assert.equal(P.eggPostcard('not-an-egg'), null);
});

// ---------------------------------------------------------------------------
// Part b · W5-V7: BAYBAY's recorded wave-5 lines
// ---------------------------------------------------------------------------

test('W5-V7: the line inventory — spoken sentences only (no labels, templates, speaker prefixes or paper notes), a stable id from both texts', async () => {
  const L = await import('../scripts/opus-sf/voice/w5/lines');
  assert.ok(L.isSentence('嘿嘿，好痒！', 'Hehe, that tickles!'));
  assert.ok(!L.isSentence('再试试', 'Try again'), 'a label');
  assert.ok(!L.isSentence('想飞的时候${key.zh}就行～', 'x'), 'a template');
  assert.ok(!L.isSentence('街坊：你好呀！天气这么好，下次来喝茶！', 'Neighbour: Hello there!'), 'another speaker');
  assert.ok(!L.isSentence('一'.repeat(46) + '！', 'x'), 'longer than a bubble');
  assert.equal(L.lineId('d', '甲', 'A'), L.lineId('d', '甲', 'A'));
  assert.notEqual(L.lineId('d', '甲', 'A'), L.lineId('d', '甲', 'B'), 'a changed English word is a new line');
  assert.match(L.lineId('a', '甲', 'A'), /^w5-a-[0-9a-f]{8}$/);
  const lines = await L.w5Lines();
  assert.ok(lines.length >= 90, `${lines.length} lines`);
  for (const l of lines) {
    assert.ok(L.isSentence(l.zh, l.en), l.zh);
    assert.ok(!L.EXCLUDE[l.zh], `excluded: ${l.zh}`);
    assert.equal(l.id, l.voiceId ?? L.lineId(l.lane, l.zh, l.en));
  }
  assert.equal(new Set(lines.map(l => l.id)).size, lines.length, 'one id per line');
  for (const lane of ['a', 'c', 'd', 'n', 'r']) assert.ok(lines.some(l => l.lane === lane), `lane ${lane}`);
  assert.ok(lines.some(l => l.voiceId === 'realsf-fire-season-end'), 'lane R voices its own line: its id is kept');
  // takes: zh + en per line, the Pixie preset, an instruction within the service's cap
  const takes = L.takesFor(lines.slice(0, 3));
  assert.equal(takes.length, 6);
  for (const t of takes) assert.ok(t.instruction.length <= L.MAX_INSTRUCTION && t.clip === `${t.language}-${t.line}`);
});

test('W5-V7: the recorded table — every clip on disk as the report says (bytes, sha256, duration), muted exactly when its pick missed a gate', async () => {
  const fsm = await import('node:fs');
  const crypto = await import('node:crypto');
  const V = await import('../src/opus-bay/data/sf/voiceW5');
  const report = JSON.parse(fsm.readFileSync('docs/opus-bay/qa/w5/V/voice/w5-voice-report.json', 'utf8')) as { clips: Record<string, { text: string; line: string; language: string; pick: { duration: number; passed: boolean; files: Record<string, { path: string; bytes: number; sha256: string }> } }> };
  assert.ok(V.W5_VOICE_LINES.length >= 90);
  assert.equal(Object.keys(V.W5_VOICE_CLIPS).length, V.W5_VOICE_LINES.length * 2);
  for (const l of V.W5_VOICE_LINES) {
    for (const [k, lang] of (['zh', 'en'] as const).entries()) {
      const id = `${lang}-${l.id}`, e = report.clips[id];
      assert.ok(e, `${id} in the report`);
      assert.equal(e.text, l[lang]);
      assert.equal(l.s[k], e.pick.duration);
      assert.ok(l.s[k] >= 0.5 && l.s[k] <= 9, `${id} ${l.s[k]} s`);
      const clip = V.W5_VOICE_CLIPS[id];
      assert.equal(clip.m4a, `/opus-bay/w5/voice/${id}.m4a`);
      for (const ext of ['m4a', 'ogg']) {
        const f = e.pick.files[ext];
        const buf = fsm.readFileSync(f.path);
        assert.equal(buf.length, f.bytes, f.path);
        assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), f.sha256, f.path);
      }
      assert.equal(V.W5_VOICE_CHECK.includes(id), !e.pick.passed, `${id} muted exactly when it missed a gate`);
    }
  }
});

test('W5-V7: a BAYBAY bubble with a recorded text plays its clip (once per bubble); residents, other texts, lane-voiced and unapproved lines stay text', async () => {
  const W = await import('../src/opus-bay/game/voiceW5');
  const V = await import('../src/opus-bay/data/sf/voiceW5');
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const { onEvent } = await import('../src/opus-bay/core/events');
  const line = V.W5_VOICE_LINES.find(l => !l.own && !V.W5_VOICE_CHECK.includes(`zh-${l.id}`))!;
  const own = V.W5_VOICE_LINES.find(l => l.own);
  assert.equal(W.w5VoiceFor({ zh: line.zh, en: line.en }), line.id);
  assert.equal(W.w5VoiceFor({ zh: ` ${line.zh}`, en: line.en }), line.id, 'trimmed like the rumour frames');
  assert.equal(W.w5VoiceFor({ zh: line.zh, en: 'something else' }), null, 'both texts must match');
  if (own) assert.equal(W.w5VoiceFor({ zh: own.zh, en: own.en }), null, 'a line its lane voices itself');
  // lane C's frozen lines keep lane C's ids (its pacer plays them): never matched here; their approved clips are exported
  const paced = V.W5_VOICE_LINES.filter(l => l.paced);
  assert.ok(paced.length >= 11 && paced.every(l => l.own && l.id.startsWith('w5c-') && l.lane === 'c'));
  for (const l of paced) assert.equal(W.w5VoiceFor({ zh: l.zh, en: l.en }), null, l.id);
  assert.deepEqual(Object.keys(V.W5_PACED_CLIPS).sort(), paced.flatMap(l => [`zh-${l.id}`, `en-${l.id}`]).filter(id => !V.W5_VOICE_CHECK.includes(id)).sort());
  const heard: string[] = [];
  const offEv = onEvent(e => { if (e.type === 'voice-line') heard.push(e.id); });
  const off = W.initW5Voice();
  flow.set({ bubble: { who: 'baybay', text: { zh: line.zh, en: line.en }, key: 9001, tone: 'bark' } });
  flow.set({ postcardFly: null, bubble: { who: 'baybay', text: { zh: line.zh, en: line.en }, key: 9001, tone: 'bark' } });
  flow.set({ bubble: { who: 'hank', text: { zh: line.zh, en: line.en }, key: 9002, tone: 'npc' } });
  flow.set({ bubble: { who: 'baybay', text: { zh: '随便说说。', en: 'Just chatting.' }, key: 9003, tone: 'bark' } });
  off();
  flow.set({ bubble: { who: 'baybay', text: { zh: line.zh, en: line.en }, key: 9004, tone: 'bark' } });
  offEv();
  flow.set({ bubble: null });
  assert.deepEqual(heard, [line.id], 'one voice-line, for BAYBAY\'s recorded bubble only, none after off');
});
