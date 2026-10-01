import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type * as THREE_NS from 'three';

/**
 * Lane C2-5 (high-view budget ≤ 150 calls / ≤ 400k triangles incl. shadows) and HC-1 / HC-2 (the lazy city chunk):
 * radii and prop caps by camera height, the hero ground stand-in, and a guard that keeps the city code out of the
 * main graph.
 */

// --- headless canvas stub (world modules create label atlases / board-shadow canvases at import) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { HIGH_VIEW, RADII, radiiFor } = await import('../src/opus-bay/world/sf/cell');
const { PROP_HIGH, propCaps } = await import('../src/opus-bay/world/sf/props');

test('radiiFor: a walking camera keeps today\'s radii; the hero lowers one quality step', () => {
  for (const q of ['high', 'mid', 'low'] as const) {
    for (const camH of [0, 8, 25]) assert.deepEqual(radiiFor(q, { heroNear: false, camH }), RADII[q], `${q} ${camH}`);
  }
  assert.deepEqual(radiiFor('high', { heroNear: true, camH: 5 }), RADII.mid);
  assert.deepEqual(radiiFor('low', { heroNear: true, camH: 5 }), RADII.low);
  assert.deepEqual(radiiFor('high', { heroNear: false, camH: Number.NaN }), RADII.high, 'unknown height = walking');
});

test('radiiFor: L0 shrinks to 60 / 90 u from camH 25 to 60, L1 to 240 / 290 u from 80 to 120; gliding above 40 u = L0 60 / 90', () => {
  const r60 = radiiFor('high', { heroNear: false, camH: 60 });
  assert.equal(r60.l0In, HIGH_VIEW.l0.in); assert.equal(r60.l0Out, HIGH_VIEW.l0.out);
  assert.equal(r60.l1In, RADII.high.l1In, 'L1 untouched below 80 u');
  const r250 = radiiFor('high', { heroNear: false, camH: 250 });
  assert.deepEqual(r250, { l0In: 60, l0Out: 90, l1In: 240, l1Out: 290 });
  const mid = radiiFor('high', { heroNear: false, camH: 40 });
  assert.ok(mid.l0In < RADII.high.l0In && mid.l0In > 60, `${mid.l0In}`);
  assert.deepEqual(radiiFor('high', { heroNear: false, camH: 5, glideH: 50 }), { ...RADII.high, l0In: 60, l0Out: 90 });
  assert.deepEqual(radiiFor('high', { heroNear: false, camH: 5, glideH: 30 }), RADII.high);
  // low quality never grows, every radius on the 5 u step, out > in, monotone in camH
  assert.deepEqual(radiiFor('low', { heroNear: false, camH: 250 }), { l0In: 60, l0Out: 90, l1In: 220, l1Out: 270 });
  let prev = radiiFor('high', { heroNear: false, camH: 0 });
  for (let h = 0; h <= 300; h += 1.7) {
    const r = radiiFor('high', { heroNear: false, camH: h });
    for (const v of Object.values(r)) assert.equal(v % HIGH_VIEW.step, 0);
    assert.ok(r.l0Out > r.l0In && r.l1In > r.l0Out && r.l1Out > r.l1In);
    assert.ok(r.l0In <= prev.l0In && r.l1In <= prev.l1In, `monotone at ${h}`);
    prev = r;
  }
});

test('propCaps: full caps below 25 u, the high caps from 80 u, only a few steps in between', () => {
  assert.deepEqual(propCaps(0), { tree: 200, lolli: 600, lamp: 48, rFull: 70, rLolli: 140, rLamp: 120, step: 0 });
  assert.deepEqual(propCaps(10), propCaps(25));
  const hi = propCaps(250);
  assert.equal(hi.tree, PROP_HIGH.tree); assert.equal(hi.lolli, PROP_HIGH.lolli); assert.equal(hi.lamp, PROP_HIGH.lamp);
  assert.deepEqual(propCaps(80), hi);
  const steps = new Set<number>();
  for (let h = 0; h < 120; h += 0.5) steps.add(propCaps(h).step);
  assert.equal(steps.size, PROP_HIGH.steps + 1);
  // triangles of the props at the cap (round tree ≈ 130, lollipop 36, lamp ≈ 100): about half
  const tris = (c: ReturnType<typeof propCaps>) => c.tree * 130 + c.lolli * 36 + c.lamp * 100;
  assert.ok(tris(hi) < tris(propCaps(0)) * 0.5, `${tris(hi)} vs ${tris(propCaps(0))}`);
});

test('hero ground stand-in: ≤ 10k triangles for the ≈ 47k of the hand-made ground, same heights and colours', async () => {
  const THREE = await import('three');
  const { loadCity } = await import('../src/opus-bay/world/cityLoader');
  const cm = await loadCity();
  const { World } = await import('../src/opus-bay/world/world');
  const { TopSampler } = await import('../src/opus-bay/world/sf/heroGround');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const world = new World('city');
  const chunks = (world as unknown as { heroGroundChunks: THREE_NS.Mesh[] }).heroGroundChunks;
  assert.ok(chunks.length >= 6 && chunks.length <= 10, `${chunks.length} hero ground chunks`);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of DISTRICT.slab) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const src = chunks.reduce((s, m) => s + (m.geometry.getIndex()?.count ?? m.geometry.getAttribute('position').count) / 3, 0);
  const box = { x0: x0 - 20, z0: z0 - 20, x1: x1 + 20, z1: z1 + 20 };
  // the stream runs it in ≈ 2 ms frame slices: it must yield often (every ≤ 6000 source triangles and every 64 u cell)
  const job = cm.heroGroundJob(chunks, { box });
  let yields = 0, r = job.next();
  while (!r.done) { yields++; r = job.next(); }
  const a = r.value;
  assert.ok(a, 'a stand-in');
  assert.ok(yields >= 20, `${yields} slices`);
  const tris = a.indexCount / 3;
  assert.ok(src > 40_000, `source ${src}`);
  assert.ok(tris <= 10_000, `stand-in ${tris} triangles`);
  // compare the topmost surfaces at random points of the source ground
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  const col = new Float32Array(a.vertexCount * 3);
  for (let i = 0; i < col.length; i++) col[i] = a.color[i] / 255;
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(a.index, 1));
  const proxy = TopSampler.of([new THREE.Mesh(geo)], box);
  const full = TopSampler.of(chunks, box);
  const hs = { y: 0, r: 0, g: 0, b: 0 }, hp = { y: 0, r: 0, g: 0, b: 0 };
  let n = 0, missing = 0, far = 0, dr = 0, dg = 0, db = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (n < 600) {
    const x = box.x0 + rnd() * (box.x1 - box.x0), z = box.z0 + rnd() * (box.z1 - box.z0);
    if (!full.sample(x, z, hs) || hs.y < -0.6) continue;
    n++;
    if (!proxy.sample(x, z, hp)) { missing++; continue; }
    if (Math.abs(hp.y - hs.y) > 0.6) far++;
    dr += hp.r - hs.r; dg += hp.g - hs.g; db += hp.b - hs.b;
  }
  assert.ok(missing / n < 0.04, `${missing} of ${n} ground points not covered`);
  assert.ok(far / n < 0.05, `${far} of ${n} points off by more than 0.6 u`);
  const k = n - missing;
  for (const d of [dr, dg, db]) assert.ok(Math.abs(d / k) < 0.03, `mean colour shift ${(d / k).toFixed(3)}`);
});

test('HC-2: the city code stays out of the main graph (import it through world/cityLoader.ts)', () => {
  const root = path.resolve('src/opus-bay');
  const heavy = /from\s+'[./]*(?:world\/)?sf\/(stream|sites|water|pools|hero|heroGround|stats|cityMode|far|build|worker|raster|cell|fog|cloudBank|lights|boards|boardData)'|from\s+'[./]*(?:core\/)?sfTerrain'/;
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const rel = path.relative(root, p).replace(/\\/g, '/');
      // the city chunk itself (world/sf; the P7 test below walks the whole static graph of GameRoot)
      if (rel.startsWith('world/sf/') && !rel.startsWith('world/sf/landmarks/')) continue;
      if (rel === 'world/cityLoader.ts') continue;
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        if (!/^\s*import\s/.test(line) || /^\s*import\s+type\s/.test(line)) continue;
        if (heavy.test(line)) bad.push(`${rel}: ${line.trim()}`);
      }
    }
  };
  walk(root);
  assert.deepEqual(bad, [], 'static imports of city modules outside the city chunk (use cityLoader.ts: loadCity / cityModule / cityStreamerLazy)');
});

/**
 * Every module GameRoot reaches through static imports (P7, wave 3): `import` / `export … from` lines that are not
 * type-only, relative specifiers resolved to .ts / .tsx / index files. Map: module → the module that first reached it.
 */
function mainGraph(root: string, from = 'game/GameRoot.tsx'): Map<string, string> {
  const spec = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"](\.[^'"]+)['"]/gm;
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
  const resolve = (from: string, s: string) => {
    const base = path.resolve(path.dirname(from), s);
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    return null;
  };
  const start = path.join(root, from);
  const seen = new Map<string, string>([[rel(start), '']]);
  const queue = [start];
  while (queue.length) {
    const f = queue.shift()!;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(spec)) {
      const r = resolve(f, m[1]);
      if (r && !seen.has(rel(r))) { seen.set(rel(r), rel(f)); queue.push(r); }
    }
  }
  return seen;
}

test('P7: the static graph of GameRoot reaches no city module, the landmark library included (only the tile format)', () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  assert.ok(graph.size > 100 && graph.has('world/WorldScene.tsx') && graph.has('world/fogShader.ts'), `the walk follows the imports (${graph.size} modules)`);
  // world/sf in the main graph: only the tile format (G1's streets read it). The landmark library (D2's recipes and
  // context, ≈ 28 KB gzip) left with G2's C2 request 4 (88ed44f): read it through cityModule() or a dynamic import
  const sf = [...graph.keys()].filter(m => m.startsWith('world/sf/') || m === 'core/sfTerrain.ts');
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  assert.deepEqual(sf.filter(m => m !== 'world/sf/format.ts').map(why), [], 'city modules in the main graph (use cityLoader.ts cityModule() or a dynamic import)');
  // wave 5 (W5-V3): the four feature folders are lazy chunks (game/w5Features.ts imports them dynamically; a type import
  // is fine), and the city's warm-up dummies no longer pull the city recipes / TypedBatch into the main graph
  const w5 = [...graph.keys()].filter(m => /^(economy|play|eggs|realsf)\//.test(m));
  assert.deepEqual(w5.map(why), [], 'wave-5 feature modules in the main graph (import them through their index.ts init, lazily)');
  for (const m of ['world/recipes/city.ts', 'world/typedBatch.ts']) assert.ok(!graph.has(m), `${m} in the main graph: ${graph.has(m) ? why(m) : ''}`);
});

test('W5-V3: the city data chunk — the landmark cards leave GameRoot, the chunk shares no module with its graph, district mode never fetches it', async () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  assert.ok(graph.has('data/sf/cityData.ts') && graph.has('data/sf/cityPois.ts'), 'the loader is in the main graph (cityPois reads CITY_DATA)');
  for (const m of ['data/sf/landmarks.ts', 'data/sf/cityDataChunk.ts', 'data/sf/postcardCards.ts', 'data/sf/cityPhotos.ts']) assert.ok(!graph.has(m), `${m} in the main graph: ${graph.has(m) ? why(m) : ''}`);
  // cityData.ts awaits the chunk while GameRoot's chunk evaluates: a module in both graphs would stay in GameRoot's
  // chunk, the data chunk would import it from there and the two would wait on each other for ever
  const chunk = mainGraph(root, 'data/sf/cityDataChunk.ts');
  assert.ok(chunk.has('data/sf/landmarks.ts'), 'the walk follows the chunk\'s re-exports');
  assert.deepEqual([...chunk.keys()].filter(m => graph.has(m)).map(why), [], 'modules the data chunk reaches that GameRoot also imports statically');
  // the loader: city mode in the game, always in node (no import.meta.env), never district mode in the game
  const { cityDataWanted, CITY_DATA } = await import('../src/opus-bay/data/sf/cityData');
  assert.deepEqual([cityDataWanted('district', true), cityDataWanted('city', true), cityDataWanted('district', false), cityDataWanted('city', false)], [false, true, true, true]);
  assert.ok(CITY_DATA, 'node tests load the chunk');
  const { SF_LANDMARK_INFO } = await import('../src/opus-bay/data/sf/landmarks');
  assert.equal(CITY_DATA.SF_LANDMARK_INFO, SF_LANDMARK_INFO, 'one module instance: the chunk re-exports the library');
  const { CITY_POIS, CITY_SUBJECT_FACTS } = await import('../src/opus-bay/data/sf/cityPois');
  assert.deepEqual(CITY_POIS.map(p => p.id), SF_LANDMARK_INFO.map(i => `sf:${i.id}`), 'the 24 cards resolve from the chunk as before');
  assert.equal(Object.keys(CITY_SUBJECT_FACTS).length, SF_LANDMARK_INFO.length);
  // the postcards' texts and the landmark photos came along (part c): the tables resolve as before
  const { CITY_POSTCARDS, CITY_POSTCARD_NEAR } = await import('../src/opus-bay/data/sf/postcards');
  assert.equal(CITY_POSTCARDS.length, 16);
  assert.ok(CITY_POSTCARDS.every(c => c.title.zh && c.fact.en && c.image) && Object.keys(CITY_POSTCARD_NEAR).length === 16);
  const { CITY_PHOTOS } = await import('../src/opus-bay/data/sf/cityPois');
  assert.equal(CITY_PHOTOS, CITY_DATA.CITY_PHOTOS);
  assert.ok(Object.keys(CITY_PHOTOS).length >= 10);
});

test('W6-P1: the play layer (HUD, dialogue box, moments, cards, touch stick) is one chunk outside GameRoot; the Overlay renders it through lazyPart, GameRoot holds Start until it is in', async () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  assert.ok(graph.has('ui/Overlay.tsx') && graph.has('ui/playLayer.tsx'), 'the Overlay (its boot, keys and layout) and the loader stay');
  const moved = ['ui/playParts.tsx', 'ui/Hud.tsx', 'ui/Moments.tsx', 'ui/Dialogue.tsx', 'ui/PoiCard.tsx', 'ui/EventCard.tsx', 'ui/CoachMark.tsx', 'ui/Floating.tsx', 'actors/TouchControls.tsx'];
  assert.deepEqual(moved.filter(m => graph.has(m)).map(why), [], 'play-layer modules in the main graph (render them through ui/playLayer.tsx lazyPart)');
  // every stand-in the Overlay asks for is a component the chunk exports
  const overlay = fs.readFileSync(path.join(root, 'ui/Overlay.tsx'), 'utf8');
  const keys = [...overlay.matchAll(/lazyPart\('(\w+)'\)/g)].map(m => m[1]);
  assert.ok(keys.length >= 21, `${keys.length} stand-ins`);
  // (read, not imported: the parts import CSS, which node cannot load)
  const exported = new Set<string>();
  const src = fs.readFileSync(path.join(root, 'ui/playParts.tsx'), 'utf8');
  for (const m of src.matchAll(/^export \{([^}]+)\} from '([^']+)';$/gm)) {
    const from = path.join(root, 'ui', `${m[2]}.tsx`);
    const target = fs.readFileSync(from, 'utf8');
    for (const name of m[1].split(',').map(s => s.trim())) {
      assert.match(target, new RegExp(`^export function ${name}\\(`, 'm'), `${m[2]} exports the component ${name}`);
      exported.add(name);
    }
  }
  for (const k of keys) assert.ok(exported.has(k), `playParts.${k}`);
  // the loader: nothing before the chunk is in (node never fetches it here)
  const { lazyPart, playParts } = await import('../src/opus-bay/ui/playLayer');
  assert.equal(typeof lazyPart('Hud'), 'function');
  assert.equal(playParts(), null);
  // GameRoot starts the fetch at once and passes Start on only with the parts in (and the world drawn)
  const gameRoot = fs.readFileSync(path.join(root, 'game/GameRoot.tsx'), 'utf8');
  assert.match(gameRoot, /if \(typeof window !== 'undefined'\) loadPlayParts\(\)/);
  assert.match(gameRoot, /startRequested=\{startRequested && drawn && partsIn\}/);
});

test('W6-P4: the photo capture and the high tier\'s post pass leave GameRoot; the ticker reaches the capture through the shutter hook', async () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  for (const m of ['game/photo.ts', 'game/photoFrames.ts', 'world/post.ts']) assert.ok(!graph.has(m), `${m} in the main graph: ${graph.has(m) ? why(m) : ''}`);
  assert.ok(graph.has('game/shutterHook.ts'));
  // photo.ts registers its consumer when it loads; a shutter reaches the capture through the hook the ticker calls
  const hook = await import('../src/opus-bay/game/shutterHook');
  const photo = await import('../src/opus-bay/game/photo');
  let composed = 0;
  const g = globalThis as unknown as { queueMicrotask: (fn: () => void) => void };
  const q = g.queueMicrotask;
  g.queueMicrotask = () => { composed++; };
  try {
    hook.consumeShutter({} as HTMLCanvasElement);
    assert.equal(composed, 0, 'no shutter, nothing to do');
    photo.requestShutter('cap', 'stamp');
    hook.consumeShutter({} as HTMLCanvasElement);
    assert.equal(composed, 1, 'the requested shutter is consumed through the hook');
  } finally { g.queueMicrotask = q; }
  // the world waits for the post chunk only at the high tier, and renders without it if the fetch failed
  const scene = fs.readFileSync(path.join(root, 'world/WorldScene.tsx'), 'utf8');
  assert.match(scene, /import type \{ PostFX, PostParams \} from '\.\/post'/);
  assert.match(scene, /if \(!postSettled && st\.quality === 'high' && !st\.reducedMotion\) throw loadPost\(\)/);
  assert.match(scene, /\(\) => \{ postSettled = true; \/\* offline: no post pass \*\/ \}/);
});

test('W6-P-review: a failed play-layer fetch reloads the page once (Chrome keeps a failed import() failed for the page\'s life, so a retry never lands), never in a loop', async () => {
  // measured on the production build (review of W6-P1): playParts 404 at load → Start pressed → file back → the
  // 2-second retry kept failing for the page's life (the same URL fetched 200 by then); Start spun for ever
  const { loadPlayParts, PLAY_PARTS_RELOAD_KEY } = await import('../src/opus-bay/ui/playLayer');
  const store = new Map<string, string>();
  let reloads = 0;
  const g = globalThis as unknown as Record<string, unknown>;
  Object.defineProperty(g, 'sessionStorage', { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } } });
  Object.defineProperty(g, 'location', { configurable: true, value: { reload: () => { reloads++; } } });
  try {
    const lost = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
    await assert.rejects(loadPlayParts(lost));
    assert.equal(reloads, 1, 'the first failure reloads the page (the title comes back; nothing is lost before Start)');
    assert.equal(store.get(PLAY_PARTS_RELOAD_KEY), '1');
    await assert.rejects(loadPlayParts(lost));
    assert.equal(reloads, 1, 'after that reload a failure does not reload again (offline: no loop)');
  } finally {
    delete g.sessionStorage;
    delete g.location;
  }
});

test('W6-P2 / P3: the autopilot comes with the first drive, the six residents and the landmark arrivals with the city data chunk', async () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  for (const m of ['actors/vehicles/autopilot.ts', 'data/sf/residents.ts', 'data/sf/arrivals.ts']) assert.ok(!graph.has(m), `${m} in the main graph: ${graph.has(m) ? why(m) : ''}`);
  // the autopilot loads with the drive routes (one promise), and every PursuitDriver is made after it
  const move = fs.readFileSync(path.join(root, 'actors/moveSystem.ts'), 'utf8');
  // (W7-P3: each through importRetry — a lost request is fetched again)
  assert.match(move, /Promise\.all\(\[importRetry\(\(\) => import\('\.\/vehicles\/driveRoute'\)\), importRetry\(\(\) => import\('\.\/vehicles\/autopilot'\)\)\]\)/);
  assert.doesNotMatch(move, /new PursuitDriver\(/, 'a PursuitDriver only through pursuit() (after loadDrive)');
  // the data chunk carries them (node always loads it: the tables are whole here)
  const { CITY_DATA } = await import('../src/opus-bay/data/sf/cityData');
  const residents = await import('../src/opus-bay/data/sf/residents');
  const { LANDMARK_ARRIVALS } = await import('../src/opus-bay/data/sf/arrivals');
  assert.ok(CITY_DATA);
  assert.equal(CITY_DATA.RESIDENTS, residents.RESIDENTS, 'one module instance');
  assert.equal(CITY_DATA.RESIDENTS.length, 6);
  assert.equal(CITY_DATA.LANDMARK_ARRIVALS, LANDMARK_ARRIVALS);
  const { CITY_NPC_DEFS } = await import('../src/opus-bay/actors/npcs');
  assert.deepEqual(CITY_NPC_DEFS.map(d => d.resident), residents.RESIDENTS.map(r => r.key), 'the city spawns the six as before');
  const { CITY_POIS } = await import('../src/opus-bay/data/sf/cityPois');
  for (const p of CITY_POIS) { const a = LANDMARK_ARRIVALS[p.id.slice(3)]; if (a) assert.deepEqual([p.position.x, p.position.z], [a.x, a.z], p.id); }
});

test('city ?debug panel (G1 w3 a3): on a phone it wraps inside the screen at 10 px under G1\'s debug line; desktop keeps bottom right', async () => {
  const { CITY_DEBUG_NARROW, cityDebugPlacement } = await import('../src/opus-bay/world/sf/stats');
  assert.equal(CITY_DEBUG_NARROW, '(max-width: 720px)');
  const phone = cityDebugPlacement(true, 160.4);
  assert.deepEqual([phone.top, phone.bottom, phone.left, phone.maxWidth, phone.whiteSpace, phone.fontSize], ['166px', 'auto', '6px', 'calc(100% - 12px)', 'pre-wrap', '10px']);
  assert.equal(cityDebugPlacement(true, null).top, '156px', 'before G1\'s line mounts');
  const desk = cityDebugPlacement(false, 160);
  assert.deepEqual([desk.right, desk.bottom, desk.top, desk.whiteSpace, desk.fontSize], ['8px', '96px', 'auto', 'pre', '11px']);
});

test('W7-P1 / P2: the play layer carries hudLayout; drei\'s PerformanceMonitor, discovery + the place index, the GGB deck steer, the city view field and the district cards\' texts leave GameRoot\'s static graph', () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  // (measured on the production build, sf-w7-P.md: GameRoot 279.21 → 267.14 KB gzip with these moves)
  const moved = ['game/hudLayout.ts', 'world/perfMonitor.tsx', 'game/discovery.ts', 'data/sf/places.ts', 'actors/deckSteer.ts', 'actors/viewField.ts', 'data/poiTexts.ts', 'ui/PoiCardBody.tsx'];
  assert.deepEqual(moved.filter(m => graph.has(m)).map(why), [], 'W7-P modules back in the main graph (read them through their stand-ins / lazy imports)');
  for (const m of ['game/hudLayoutSlot.ts', 'actors/citySlots.ts', 'ui/playLayer.tsx']) assert.ok(graph.has(m), `${m}: the stand-ins stay in the main graph`);
  // drei (≈ 0.7 KB of PerformanceMonitor) only through world/perfMonitor.tsx: no module of the main graph imports it
  const drei = [...graph.keys()].filter(m => /^\s*import\s+(?!type\s)[^;]*from\s+'@react-three\/drei'/m.test(fs.readFileSync(path.join(root, m), 'utf8')));
  assert.deepEqual(drei, [], 'static drei imports in the main graph');
  const src = (m: string) => fs.readFileSync(path.join(root, m), 'utf8');
  // the play-layer chunk carries hudLayout (Systems reads it through the stand-ins); the city chunk carries the view field
  assert.match(src('ui/playParts.tsx'), /^export \* as hudLayout from '\.\.\/game\/hudLayout';\r?$/m);
  assert.match(src('game/Systems.tsx'), /from '\.\/hudLayoutSlot';/);
  assert.match(src('world/sf/cityMode.ts'), /^import '\.\.\/\.\.\/actors\/viewField';\r?$/m);
  // each moved actor module registers itself with the stand-ins when it loads
  assert.match(src('actors/deckSteer.ts'), /^registerDeckSteer\(\{ deckAt, deckDip, deckWish, onDeck, heroRelaxed, deckCameraYaw \}\);\r?$/m);
  assert.match(src('actors/viewField.ts'), /^registerViewField\(\{ heroView, preferredViewDir, preferredCameraYaw \}\);\r?$/m);
  // the card body fills the district cards' texts before it renders; node fills them when data/pois.ts loads
  assert.match(src('ui/PoiCardBody.tsx'), /^fillPoiTexts\(DISTRICT_POI_TEXTS\);\r?$/m);
  // discovery: the Overlay's boot fetches it (both modes, as before); resume and the QA map export import it lazily
  assert.match(src('ui/Overlay.tsx'), /void importRetry\(\(\) => import\('\.\.\/game\/discovery'\)\)\.then\(m => \{ m\.initG1\(\); \}/);
});

test('W7-P3: the lazy chunks where a retry is safe load through game/importRetry.ts (a failed import() stays failed for the page\'s life in Chrome)', () => {
  const root = path.resolve('src/opus-bay');
  const src = (m: string) => fs.readFileSync(path.join(root, m), 'utf8');
  const sites: [string, RegExp][] = [
    ['actors/moveSystem.ts', /importRetry\(\(\) => import\('\.\/vehicles\/driveRoute'\)\)/],
    ['actors/camera.ts', /importRetry\(\(\) => import\('\.\/cityViews'\)\)/],
    ['world/cityLoader.ts', /importRetry\(\(\) => import\('\.\/sf\/cityMode'\)\)/],
    ['data/sf/cityData.ts', /await importRetry\(\(\) => import\('\.\/cityDataChunk'\)\)/],
    ['world/WorldScene.tsx', /importRetry\(\(\) => import\('\.\/post'\)\)/],
    ['world/WorldScene.tsx', /importRetry\(\(\) => import\('\.\/perfMonitor'\)\)/],
    ['ui/Overlay.tsx', /importRetry\(\(\) => import\('\.\.\/game\/discovery'\)\)/],
    ['game/resume.ts', /importRetry\(\(\) => import\('\.\.\/data\/sf\/places'\)\)/],
    ['ui/lazyParts.ts', /loadGuideLayer = \(\) => importRetry\(\(\) => import\('\.\/GuideLayer'\)\)/],
    ['ui/playLayer.tsx', /importRetry\(\(\) => import\('\.\/playParts'\), \{ waits: PLAY_PARTS_RETRY_MS \}\)/],
  ];
  for (const [m, re] of sites) assert.match(src(m), re, m);
  // the helper imports nothing (cityData.ts awaits it at the top level of GameRoot's chunk)
  assert.doesNotMatch(src('game/importRetry.ts'), /^\s*import\s/m);
});

test('W7-P3: the dialogue script rides with the play layer; GameRoot\'s modules read it through data/scriptSlot.ts; a ?start= deep link begins once the play layer is in', () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  for (const m of ['data/script.ts', 'data/scriptLoad.ts']) assert.ok(!graph.has(m), `${m} in the main graph: ${graph.has(m) ? why(m) : ''}`);
  assert.ok(graph.has('data/scriptSlot.ts'));
  const src = (m: string) => fs.readFileSync(path.join(root, m), 'utf8');
  assert.match(src('ui/playParts.tsx'), /^import '\.\.\/data\/scriptLoad';\r?$/m);
  for (const m of ['game/flow.ts', 'game/brain.ts', 'game/content.ts', 'game/cityContent.ts']) assert.match(src(m), /from '\.\.\/data\/scriptSlot';/, m);
  // the script imports nothing that imports the slot (node awaits it at the slot's top level: no wait on itself)
  const scriptGraph = mainGraph(root, 'data/script.ts');
  assert.ok(!scriptGraph.has('data/scriptSlot.ts'));
  assert.match(src('ui/Overlay.tsx'), /if \(qa\.start\) \{ const start = qa\.start; void loadPlayParts\(\)\.then\(\(\) => beginPlaying\(start\), \(\) => beginPlaying\(start\)\); \}/);
});

test('W7-P5: the live catalog prefetch (≈ 125 KB gzip) waits for the world\'s first frame; GameRoot marks it', () => {
  const root = path.resolve('src/opus-bay');
  const src = (m: string) => fs.readFileSync(path.join(root, m), 'utf8');
  assert.match(src('ui/Overlay.tsx'), /const off = afterFirstFrame\(\(\) => \{ id = window\.setTimeout\(\(\) => \{ void loadCatalog\(\); \}, 1500\); \}\);/);
  assert.doesNotMatch(src('ui/Overlay.tsx'), /^\s*const id = window\.setTimeout\(\(\) => \{ void loadCatalog\(\); \}, 1500\);/m, 'no blind timer from the boot');
  assert.match(src('game/GameRoot.tsx'), /done\.current = true; markFirstFrame\(\); onDrawn\(true\);/);
});

test('W8-P1: the city-only GLSL of the shared materials and the sky rides with the city data chunk; GameRoot\'s modules splice it in through world/cityShaderSlot.ts', () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  // (measured on the production build, sf-w8-P.md: GameRoot 262.00 → 259.10 KB gzip with this move; the wave's target ≤ 255)
  assert.ok(!graph.has('data/sf/cityShaders.ts'), `data/sf/cityShaders.ts in the main graph: ${graph.has('data/sf/cityShaders.ts') ? why('data/sf/cityShaders.ts') : ''}`);
  assert.ok(graph.has('world/cityShaderSlot.ts'), 'the slot stays in the main graph');
  const src = (m: string) => fs.readFileSync(path.join(root, m), 'utf8');
  assert.match(src('data/sf/cityDataChunk.ts'), /^export \{ CITY_SHADERS \} from '\.\/cityShaders';\r?$/m);
  assert.doesNotMatch(src('data/sf/cityShaders.ts'), /^\s*import\s/m, 'the blocks import nothing (the data chunk shares no module with GameRoot\'s graph)');
  for (const m of ['world/materials.ts', 'world/environment.ts']) assert.match(src(m), /^import \{ CITY_SHADERS \} from '\.\/cityShaderSlot';\r?$/m, m);
  // no module of GameRoot's graph carries the moved GLSL again (a copy back would put the bytes back in its chunk)
  const markers = ['vec2 obPuffs(vec3 d)', 'obFac == 9.0 || obFac == 10.0', '} else if (pat == 9.0) {', 'if (pat == 5.0 && vInfo.w > 1.05 && uNight > 0.01) {', 'if (uCityDay > 0.0 && y > 0.0) {'];
  const back = [...graph.keys()].filter(m => m.endsWith('.ts') || m.endsWith('.tsx')).flatMap(m => markers.filter(k => src(m).includes(k)).map(k => `${m}: ${k}`));
  assert.deepEqual(back, [], 'city-only GLSL in a main-graph module (put it in data/sf/cityShaders.ts)');
});

test('W8-P2: the landmark cards\' tables ride with the city data chunk; data/sf/cityPois.ts keeps every export name and hands out the chunk\'s own values', async () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  assert.ok(!graph.has('data/sf/cityPoisData.ts'), `data/sf/cityPoisData.ts in the main graph: ${graph.has('data/sf/cityPoisData.ts') ? why('data/sf/cityPoisData.ts') : ''}`);
  const src = (m: string) => fs.readFileSync(path.join(root, m), 'utf8');
  assert.match(src('data/sf/cityDataChunk.ts'), /^export \* as CITY_POI_TABLES from '\.\/cityPoisData';\r?$/m);
  // the tables' code is not in the slot any more (a copy back would put the bytes back in GameRoot's chunk)
  for (const k of ['export const ZH_GLOSSARY: readonly (readonly [from: string, to: string])[] = [', 'function cityPoi(info: SfLandmarkInfo)', "landmark: { zh: '地标', en: 'Landmark' }"]) assert.ok(!src('data/sf/cityPois.ts').includes(k), k);
  const slot = await import('../src/opus-bay/data/sf/cityPois');
  const { CITY_DATA } = await import('../src/opus-bay/data/sf/cityData');
  const T = CITY_DATA!.CITY_POI_TABLES;
  // every name the module exported before the move (sf-w8-P.md) is still exported
  const before = ['CITY_POI_PREFIX', 'cityPoiId', 'ZH_GLOSSARY', 'glossZh', 'ZH_TEXT_NAMES', 'glossZhText', 'SF_GUIDE_SLUG', 'isMonthTagged', 'CITY_PHOTOS', 'CITY_POIS', 'CITY_DISTRICT_POI_NAMES', 'CITY_DISTRICT_TEXT_NAMES', 'cityDistrictZh', 'cityDistrictPoi', 'CITY_POI_ZONES', 'CITY_POI_OFFICIAL_URLS', 'cardOfficialUrl', 'CITY_POI_EXTRA_SOURCES', 'CITY_PHOTO_SOURCE_PAGES', 'CITY_SUBJECT_FACTS', 'PLACE_KIND_NAMES', 'setCardLookup', 'placeCardTarget', 'attractionCardId', 'placeCardName'];
  assert.deepEqual(before.filter(k => !(k in slot)), []);
  // node loads the chunk: the slot's tables are the chunk's own objects, its glossaries the chunk's functions
  for (const k of ['ZH_GLOSSARY', 'ZH_TEXT_NAMES', 'CITY_POIS', 'CITY_POI_ZONES', 'CITY_POI_OFFICIAL_URLS', 'CITY_POI_EXTRA_SOURCES', 'CITY_PHOTO_SOURCE_PAGES', 'CITY_SUBJECT_FACTS', 'PLACE_KIND_NAMES'] as const) assert.equal(slot[k], T[k], k);
  for (const s of ['双子峰 · 码头区 Marina 的缆车', '沿 Grant Avenue 一路走到 North Beach 的 Washington Square', 'Twin Peaks']) {
    assert.equal(slot.glossZh(s), T.glossZh(s));
    assert.equal(slot.glossZhText(s), T.glossZhText(s));
  }
  assert.deepEqual(slot.placeCardName({ zh: '中国城', en: 'Chinatown' }), { zh: '唐人街', en: 'Chinatown' });
  // the data chunk's private copies of the slot's helpers agree (the chunk may not import the slot: W5-V3)
  assert.ok(T.CITY_POIS.length >= 24 && T.CITY_POIS.every(p => p.id === slot.cityPoiId(p.id.slice(slot.CITY_POI_PREFIX.length))));
  for (const slug of ['san-francisco-guide', 'sf-october-2026-payment-update', 'muni-2025', 'golden-gate-park', 'march-events', '']) assert.equal(T.isMonthTagged(slug), slot.isMonthTagged(slug), slug);
  assert.equal(T.SF_GUIDE_SLUG, slot.SF_GUIDE_SLUG);
  assert.equal(T.cityPoiId('coit-tower'), slot.cityPoiId('coit-tower'));
});

test('W8-P3: the cable-car network builder is a lazy chunk loadTransit fetches with transit.json; it imports types only (node binds it at data/transit.ts\'s top level without a wait on itself)', async () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  assert.ok(graph.has('data/transit.ts'), 'data/transit.ts stays in the main graph');
  assert.ok(!graph.has('data/transitBuild.ts'), `data/transitBuild.ts in the main graph: ${graph.has('data/transitBuild.ts') ? why('data/transitBuild.ts') : ''}`);
  const src = (m: string) => fs.readFileSync(path.join(root, m), 'utf8');
  const build = src('data/transitBuild.ts');
  assert.deepEqual([...build.matchAll(/^import\s+(?!type\s)[^\n]*$/gm)].map(m => m[0]), [], 'type imports only (a runtime import of data/transit.ts would make the node-side await wait on itself)');
  const transit = src('data/transit.ts');
  assert.ok(!/^export function buildTransit\(/m.test(transit) && !transit.includes('function stubPoints('), 'the builder\'s code is not back in data/transit.ts');
  assert.match(transit, /const builder = importRetry\(\(\) => import\('\.\/transitBuild'\)\);/);
  // node: the export is bound at load and builds through the chunk with data/transit.ts's own helpers
  const T = await import('../src/opus-bay/data/transit');
  const B = await import('../src/opus-bay/data/transitBuild');
  const file = { version: 't', source: 't', props: {}, lines: [{ id: 'powell-hyde', kind: 'cable-car', name: { zh: '鲍威尔-海德线缆车', en: 'Powell–Hyde' }, color: '#c33', sourceUrl: 'x', doubleEnded: false, length: 40, heroSpans: [], turntables: [], path: [0, 0, 0, 0, 0, 20, 0, 0, 40], stops: [{ id: 'a', name: { zh: 'A', en: 'Powell Street & Market Street' }, at: 0, x: 0, z: 0, osmId: null }, { id: 'b', name: { zh: 'B', en: 'Hyde Street & Beach Street' }, at: 40, x: 0, z: 40, osmId: null }] }] } as unknown as import('../src/opus-bay/data/transit').TransitFileJson;
  const viaExport = T.buildTransit(file);
  const direct = B.buildTransit(file, { CABLE: T.CABLE, CROSSING_STOP: T.CROSSING_STOP, pointAt: T.pointAt, stationSlug: T.stationSlug, shortStationName: T.shortStationName, stationZh: T.stationZh, turntableZh: T.turntableZh, glossName: T.glossName });
  assert.deepEqual(viaExport, direct);
  assert.deepEqual(viaExport.stations.map(s => [s.id, s.name.zh]), [['powell-market', '鲍威尔街 · 市场街'], ['hyde-beach', '海德街 · 海滩街']]);
  assert.equal(viaExport.lines[0].name.zh, '鲍威尔-海德线叮当车');
});

test('W8-P4: the district postcards\' words come with the play layer (data/scriptLoad.ts) and are filled in place: the cards keep their objects, every word is there once filled', async () => {
  const root = path.resolve('src/opus-bay');
  const graph = mainGraph(root);
  const why = (m: string) => { const chain = [m]; let c = m; while (graph.get(c)) { c = graph.get(c)!; chain.push(c); } return chain.join(' <- '); };
  assert.ok(!graph.has('data/postcardTexts.ts'), `data/postcardTexts.ts in the main graph: ${graph.has('data/postcardTexts.ts') ? why('data/postcardTexts.ts') : ''}`);
  const src = (m: string) => fs.readFileSync(path.join(root, m), 'utf8');
  assert.match(src('data/scriptLoad.ts'), /^fillPostcardTexts\(DISTRICT_POSTCARD_TEXTS\);\r?$/m);
  assert.match(src('ui/playParts.tsx'), /^import '\.\.\/data\/scriptLoad';\r?$/m, 'the play layer loads it (GameRoot holds Start until that chunk is in)');
  assert.ok(!src('data/postcards.ts').includes('清晨的渡轮大厦'), 'the words are not back in data/postcards.ts');
  const P = await import('../src/opus-bay/data/postcards');
  const { DISTRICT_POSTCARD_TEXTS } = await import('../src/opus-bay/data/postcardTexts');
  assert.ok(P.postcardTextsFilled(), 'node fills them at load');
  assert.equal(P.DISTRICT_POSTCARDS.length, 8);
  for (const c of P.DISTRICT_POSTCARDS) {
    const t = DISTRICT_POSTCARD_TEXTS[c.id as keyof typeof DISTRICT_POSTCARD_TEXTS];
    assert.deepEqual({ title: c.title, fact: c.fact, hint: c.hint }, t, c.id);
    assert.notEqual(c.title, t.title, `${c.id}: the card keeps its own object (filled in place, so a name taken before Start reads it)`);
    assert.ok(c.title.zh && c.title.en && c.fact.zh && c.fact.en && c.hint?.zh && c.hint.en && c.sourceUrl.startsWith('https://'), c.id);
  }
  assert.deepEqual(P.DISTRICT_POSTCARDS[0].title, { zh: '清晨的渡轮大厦', en: 'Ferry Building at Dawn' });
  // a second fill is a no-op (the play layer and node never fill twice)
  P.fillPostcardTexts({ 'ferry-building-dawn': { title: { zh: 'x', en: 'x' }, fact: { zh: 'x', en: 'x' }, hint: { zh: 'x', en: 'x' } } });
  assert.equal(P.DISTRICT_POSTCARDS[0].title.en, 'Ferry Building at Dawn');
});
