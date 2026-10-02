/**
 * Wave 9 · lane P (sf-w9-lead.md §3 P; the first-use review docs/opus-bay/review-2026-10-01-first-use.md R§5 #4 and its R§6
 * tech rows): the cold start (no frame until the first frame's programs are linked; Start 准备中… until then), the WebGL
 * probe (no WebGL: the title stays with links; software GL: quality low + a note), the context-lost card by device, and
 * GameRoot's city-only figures in the city chunk.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';

const src = (p: string) => fs.readFileSync(path.join('src/opus-bay', p), 'utf8');

// --- the warm-ready contract (game/warmReady.ts) ---

test('W9-P1 warm-ready: a flag the title reads, set once, listeners told once per change', async () => {
  const W = await import('../src/opus-bay/game/warmReady');
  W.resetWarmReadyForTests();
  assert.equal(W.warmReady(), false);
  W.setWarmReady();
  assert.equal(W.warmReady(), true);
  W.setWarmReady(false);
  assert.equal(W.warmReady(), false);
  W.resetWarmReadyForTests();
});

type Ctx = { getExtension(n: string): unknown; getParameter(p: unknown): unknown; RENDERER: number };
function probeDoc(opts: { caveat?: boolean; none?: boolean; renderer?: string }) {
  const lost: string[] = [];
  const asked: (WebGLContextAttributes | undefined)[] = [];
  const doc = {
    createElement: () => ({
      getContext: (_t: string, attrs?: WebGLContextAttributes) => {
        asked.push(attrs);
        if (opts.none) return null;
        if (opts.caveat && attrs?.failIfMajorPerformanceCaveat) return null;
        const ctx: Ctx = {
          RENDERER: 0x1f01,
          getExtension: (n: string) => n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : n === 'WEBGL_lose_context' ? { loseContext: () => lost.push('lost') } : null,
          getParameter: (p: unknown) => (p === 0x9246 ? opts.renderer ?? '' : 'WebKit WebGL'),
        };
        return ctx;
      },
    }),
  };
  return { doc, lost, asked };
}

test('W9-P2 probeGl: no WebGL 2 → none; a hardware GPU → ok; SwiftShader / WARP / llvmpipe or a performance caveat → software; the probe context is lost again', async () => {
  const { probeGl } = await import('../src/opus-bay/game/warmReady');
  assert.equal(probeGl(probeDoc({ none: true }).doc).support, 'none');
  const hw = probeDoc({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)' });
  assert.deepEqual(probeGl(hw.doc), { support: 'ok', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)' });
  assert.equal(hw.asked[0]?.failIfMajorPerformanceCaveat, true, 'the first try refuses a major performance caveat');
  assert.deepEqual(hw.lost, ['lost'], 'the throwaway context is released');
  for (const r of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)', 'llvmpipe (LLVM 15.0.7, 256 bits)']) {
    assert.equal(probeGl(probeDoc({ renderer: r }).doc).support, 'software', r);
  }
  assert.equal(probeGl(probeDoc({ caveat: true, renderer: 'Intel UHD' }).doc).support, 'software', 'only without failIfMajorPerformanceCaveat');
  assert.equal(probeGl(null).support, 'ok', 'no document (node): never blocks');
});

test('W9-P2 software GL: the visit starts at low unless a ?quality= link says otherwise (session-only, not a choice)', async () => {
  const { startQuality } = await import('../src/opus-bay/world/quality');
  const desk = { coarse: false, dpr: 1 };
  assert.deepEqual(startQuality({ ...desk, software: true }), { quality: 'low', reason: 'device' });
  assert.deepEqual(startQuality({ ...desk, software: true, choice: 'high' }), { quality: 'low', reason: 'device' }, 'over a remembered pick: 5 fps is no choice');
  assert.deepEqual(startQuality({ ...desk, software: true, url: 'high' }), { quality: 'high', reason: 'url' });
  assert.deepEqual(startQuality({ ...desk }), { quality: 'high', reason: 'default' });
  assert.match(src('world/quality.ts'), /software: glSupport\(\) === 'software'/, 'initQualityPolicy reads the probe');
});

// --- the title (ui/TitleScreen.tsx, surgical) and the page (OpusBayPage.tsx) ---

test('W9-P1 title: Start shows 准备中… with aria-busy + aria-disabled until warm-ready (city mode), a press then does nothing; no WebGL: no Start, the note', () => {
  const t = src('ui/TitleScreen.tsx');
  assert.match(t, /const preparing = \(city && !warm\) \|\| gl === 'none';/);
  assert.match(t, /preparing \? \(\) => \{\} :/, 'Start, 继续旅程 and Enter / Space are no-ops while preparing');
  assert.match(t, /aria-busy=\{waiting \|\| preparing \|\| undefined\} aria-disabled=\{preparing \|\| undefined\}/);
  assert.match(t, /preparing \? t\('准备中…', 'Getting ready…'\)/);
  assert.match(t, /onClick=\{preparing \? undefined : onStart\} aria-disabled=\{preparing \|\| undefined\}/, '从头开始 waits too');
  assert.match(t, /gl === 'none' \? <TitleGlNote kind="none" \/>/);
  assert.match(t, /gl === 'software' && <TitleGlNote kind="software" \/>/);
  // the guides link and the language pills are never gated (plain DOM: they work while the world warms up)
  assert.match(t, /<a className="ob-title-link" href=\{guidesUrl\(locale\)\}>/);
  const note = src('ui/TitleGl.tsx');
  for (const s of ['这台设备打不开 3D 画面', 'thisMonthUrl(locale)', "withLang('/calendar', locale)", '「省电」']) assert.ok(note.includes(s), s);
});

test('W9-P1 title rendered: 准备中… (aria-busy, aria-disabled) before warm-ready, 开始 after; the district never waits; no WebGL: no Start, the note with this month + the calendar', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { game, initialGameState } = await import('../src/opus-bay/core/store');
  const save = await import('../src/opus-bay/data/save');
  const W = await import('../src/opus-bay/game/warmReady');
  const { TitleScreen } = await import('../src/opus-bay/ui/TitleScreen');
  const render = () => renderToStaticMarkup(h(TitleScreen, { onStart: () => undefined }));
  try {
    save.clearSave();
    W.resetWarmReadyForTests();
    game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' });
    const cold = render();
    assert.ok(cold.includes('ob-title-start" aria-busy="true" aria-disabled="true"'), 'busy and disabled');
    assert.ok(cold.includes('<span>准备中…</span>'));
    assert.ok(cold.includes('class="ob-lang-pills"'), 'the language pills are there (plain buttons, never gated)');
    assert.ok(cold.includes('class="ob-title-link" href="/guides"'), '直接看攻略 is there');
    W.setWarmReady();
    assert.ok(render().includes('ob-title-start"><span>开始</span>'), 'warm: Start, no busy / disabled attributes');
    W.resetWarmReadyForTests();
    game.set({ ...initialGameState(), phase: 'title', worldMode: 'district' });
    assert.ok(render().includes('ob-title-start"><span>开始</span>'), 'the district: as before (Start at once, waiting after the press)');
    game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' });
    W.setGlSupport('none');
    const none = render();
    assert.ok(!none.includes('ob-title-start'));
    assert.ok(none.includes('这台设备打不开 3D 画面'));
    assert.ok(none.includes('href="/this-month"'));
    assert.ok(none.includes('href="/calendar"'));
    W.setGlSupport('software');
    W.setWarmReady();
    assert.match(render(), /软件模式显示 3D/);
  } finally {
    W.resetWarmReadyForTests();
    game.set({ ...initialGameState() });
  }
});

test('W9-P2 page: the probe runs once before the game chunk mounts; no WebGL keeps the title (a ?start= link too) and never loads GameRoot', () => {
  const p = src('OpusBayPage.tsx');
  assert.match(p, /if \(glSupport\(\) === null\) \{ try \{ setGlSupport\(probeGl\(\)\.support\); \} catch \{ setGlSupport\('ok'\); \} \}/);
  assert.match(p, /useState\(\(\) => direct && glOk\(\)\)/);
  assert.match(p, /const go = \(\) => \{ if \(glOk\(\)\) setLoad\(true\); \};/);
  assert.match(p, /const showTitle = \(!direct \|\| noGl\) && phase === 'title';/);
});

// --- GameRoot: no frame before the programs are linked (game/GameRoot.tsx, world/warmup.ts) ---

test('W9-P1 GameRoot: city mode keeps the frame loop off until the pre-first-frame warm-up resolves (at most PRE_MAX_MS); warm-ready = the first frame + the play layer; the district renders from the mount as before', () => {
  const g = src('game/GameRoot.tsx');
  assert.match(g, /useState\(\(\) => game\.get\(\)\.worldMode !== 'city' \|\| firstFrameDrawn\(\)\)/, 'district: frames from the mount');
  assert.match(g, /frameloop=\{framesOn \? 'always' : 'never'\}/);
  assert.match(g, /if \(drawn && partsIn\) setWarmReady\(\);/);
  assert.match(g, /const first = game\.get\(\)\.worldMode === 'city' && !firstFrameDrawn\(\);/);
  assert.match(g, /prewarmPrograms\(gl, scene, camera, st\)/);
  assert.match(g, /m\.warmPost\(gl\)/, 'the post pass\'s programs too (high quality)');
  assert.match(g, /window\.setTimeout\(\(\) => r\(null\), PRE_MAX_MS\)/, 'a link that never reports (a lost context) cannot hold the title');
  assert.match(g, /\.finally\(\(\) => \{ if \(!gone && first\) onPre\(true\); \}\)/, 'frames on even when the warm-up throws');
});

type FakeProgram = { ready: boolean; used: number; isReady(): boolean; getUniforms(): unknown };
function fakeRenderer(opts: { parallel: boolean; linkMs: number }) {
  const programs: FakeProgram[] = [];
  const order: string[] = [];
  let target: unknown = null;
  const r = {
    info: { programs },
    extensions: { has: (n: string) => n === 'KHR_parallel_shader_compile' && opts.parallel },
    shadowMap: { enabled: true },
    getRenderTarget: () => target,
    setRenderTarget: (t: unknown) => { target = t; },
    compileAsync: (o: THREE.Object3D) => {
      order.push(o.name || o.type);
      // one new program per compiled object, linking for linkMs (a KHR poll answers false until then)
      const p: FakeProgram = { ready: false, used: 0, isReady() { return this.ready; }, getUniforms() { this.used++; return {}; } };
      setTimeout(() => { p.ready = true; }, opts.linkMs);
      programs.push(p);
      return Promise.resolve();
    },
  };
  return { renderer: r as unknown as THREE.WebGLRenderer, programs, order };
}

test('W9-P1 prewarmPrograms: the depth set, the dummies and one object per material of the VISIBLE scene, PRE_BATCH at a time with each batch\'s links awaited; every program first-used before it resolves; the background passes follow', async () => {
  const warm = await import('../src/opus-bay/world/warmup');
  warm.resetWarmupState();
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const mats = Array.from({ length: 9 }, () => new THREE.MeshBasicMaterial());
  mats.forEach((m, i) => { const o = new THREE.Mesh(new THREE.BoxGeometry(), m); o.name = `live-${i}`; scene.add(o); });
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); hidden.name = 'night-only'; hidden.visible = false;
  scene.add(hidden);
  const { renderer, programs, order } = fakeRenderer({ parallel: true, linkMs: 15 });
  const r = await warm.prewarmPrograms(renderer, scene, camera, { offscreen: false, next: null });
  assert.ok(order.includes('ob-warmup-shadow'), 'the shadow pass\'s depth set');
  for (let i = 0; i < 9; i++) assert.ok(order.includes(`live-${i}`), `live-${i}`);
  assert.ok(!order.includes('night-only'), 'a hidden object waits for the background live pass');
  assert.ok(programs.every(p => p.ready), 'every link done before the first frame');
  assert.ok(programs.every(p => p.used === 1), 'every program first-used (its link-status query) before the first frame');
  assert.equal(r.after, programs.length);
  warm.stopWarmup(renderer);
  warm.resetWarmupState();
});

test('W9-P1 prewarmPrograms: batches wait for their links (a batch never starts while the last one links) and yield between batches', async () => {
  const warm = await import('../src/opus-bay/world/warmup');
  warm.resetWarmupState();
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  for (let i = 0; i < 2 * warm.PRE_BATCH; i++) { const o = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); o.name = `m${i}`; scene.add(o); }
  const { renderer, programs } = fakeRenderer({ parallel: true, linkMs: 30 });
  const seen: number[] = [];
  const orig = renderer.compileAsync.bind(renderer);
  (renderer as unknown as { compileAsync: typeof orig }).compileAsync = ((o: THREE.Object3D, c: THREE.Camera, s?: THREE.Scene) => {
    seen.push(programs.filter(p => !p.ready).length);
    return orig(o, c, s);
  }) as typeof orig;
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 1);
  await warm.prewarmPrograms(renderer, scene, camera, {});
  clearInterval(timer);
  assert.ok(Math.max(...seen) < warm.PRE_BATCH + 1, `at most one batch linking at a time (max pending at a compile: ${Math.max(...seen)})`);
  assert.ok(ticks > 3, 'the page got the main thread between batches');
  warm.stopWarmup(renderer);
  warm.resetWarmupState();
});

test('W9-P1 prewarmPrograms without KHR_parallel_shader_compile: every program first-used, one per task (each such query waits for its link)', async () => {
  const warm = await import('../src/opus-bay/world/warmup');
  warm.resetWarmupState();
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  for (let i = 0; i < 4; i++) scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  const { renderer, programs } = fakeRenderer({ parallel: false, linkMs: 0 });
  await warm.prewarmPrograms(renderer, scene, camera, {});
  assert.ok(programs.length > 4 && programs.every(p => p.used === 1));
  assert.ok(src('world/warmup.ts').includes("const per = renderer.extensions.has('KHR_parallel_shader_compile') ? 8 : 1;"));
  warm.stopWarmup(renderer);
  warm.resetWarmupState();
});

test('W9-P1 post: warmPost compiles the bright / blur passes into targets and the last pass to the screen, and keeps its PostFX (its materials hold the programs)', async () => {
  const { warmPost } = await import('../src/opus-bay/world/post');
  const calls: { mat: string; target: unknown }[] = [];
  let target: unknown = null;
  const gl = {
    getRenderTarget: () => target,
    setRenderTarget: (t: unknown) => { target = t; },
    compileAsync: (s: THREE.Scene) => { calls.push({ mat: ((s.children[0] as THREE.Mesh).material as THREE.Material).name, target }); return Promise.resolve(); },
  } as unknown as THREE.WebGLRenderer;
  await warmPost(gl);
  assert.deepEqual(calls.map(c => c.mat), ['ob-bloom-bright', 'ob-bloom-blur', 'ob-post']);
  assert.ok((calls[0].target as THREE.WebGLRenderTarget).isWebGLRenderTarget && (calls[1].target as THREE.WebGLRenderTarget).isWebGLRenderTarget);
  assert.equal(calls[2].target, null, 'the last pass to the screen: tone mapping in its key');
  assert.equal(target, null, 'the render target restored');
});

// --- the context-lost card by device (ui/glHealth.ts) ---

test('W9-P2 GL-lost card: a computer reads 浏览器…, a touch-first phone keeps 手机…', async () => {
  const { touchFirst } = await import('../src/opus-bay/ui/glHealth');
  const mm = (coarse: boolean, fine: boolean) => ({ matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' ? coarse : q === '(any-pointer: fine)' ? fine : false }) });
  assert.equal(touchFirst(mm(true, false)), true, 'a phone');
  assert.equal(touchFirst(mm(false, true)), false, 'a laptop');
  assert.equal(touchFirst(mm(true, true)), false, 'a touch laptop with a trackpad');
  assert.equal(touchFirst(null), false);
  const g = src('ui/glHealth.ts');
  assert.match(g, /const tx = touchFirst\(\) \? TEXT\[key\] : \{ \.\.\.TEXT\[key\], body: DESK_BODY\[key\] \};/);
  assert.match(g, /zh: '浏览器暂停了游戏的 3D 画面/);
  assert.doesNotMatch(g.slice(g.indexOf('const DESK_BODY'), g.indexOf('/** A touch-first')), /手机|手機|phone/i);
});

// --- GameRoot toward 255 KB: the city-only figures in the city chunk ---

test('W9-P GameRoot: the rideable ferry\'s sun deck and the city gull ride with the city chunk (world/sf/cityFigures.ts fills life.ts\'s slot); the district keeps its ferry and gull', async () => {
  const life = src('world/life.ts');
  assert.ok(!life.includes('function sunDeck(') && !life.includes('export function cityGullGeometry('), 'the code is not back in GameRoot\'s life.ts');
  assert.match(src('world/sf/cityMode.ts'), /^import '\.\/cityFigures';\r?$/m, 'the city chunk loads it');
  const L = await import('../src/opus-bay/world/life');
  const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  const before = tris(L.ferryGeometry('#2f8f88', true));
  assert.equal(L.cityFigures.deck, null, 'nothing filled before the city chunk');
  assert.equal(before, tris(L.ferryGeometry('#2f8f88', true)));
  await import('../src/opus-bay/world/sf/cityFigures');
  assert.equal(typeof L.cityFigures.deck, 'function');
  assert.equal(typeof L.cityFigures.gull, 'function');
  const deck = L.ferryGeometry('#2f8f88', true), closed = L.ferryGeometry('#2f8f88', false);
  assert.notEqual(tris(deck), tris(closed), 'the open-deck ferry differs from the enclosed one again');
});

// --- W9-P4 (w8 NEXT #11): a part being loaded again, a lost panel closes, the feature loaders retry ---

const CHROME = (url: string) => new TypeError(`Failed to fetch dynamically imported module: ${url}`);

test('W9-P4 importRetry: a loud retry in flight counts (onRetrying 1 → 0), a quiet prefetch never does, a loud caller joining a quiet retry does', async () => {
  const R = await import('../src/opus-bay/game/importRetry');
  const seen: number[] = [];
  const off = R.onRetrying(n => seen.push(n));
  const memo = new Map();
  const sleep = () => new Promise<void>(r => setTimeout(r, 5));
  let ok = false;
  const url = 'https://www.baylink.us/assets/MapPanel-A.js';
  const p = R.importRetry(() => Promise.reject(CHROME(url)), { memo, sleep, importUrl: () => (ok ? Promise.resolve('map') : Promise.reject(CHROME(`${url}?retry=1`))), waits: [5, 5, 5] });
  await new Promise(r => setTimeout(r, 1));
  assert.equal(R.retryingLoud(), 1, 'the press waits: the pill shows');
  ok = true;
  assert.equal(await p, 'map');
  assert.equal(R.retryingLoud(), 0, 'landed: the pill goes');
  assert.deepEqual(seen, [1, 0]);
  // a quiet prefetch retrying: nobody waits, nothing shows — until a press of the same chunk joins it
  seen.length = 0;
  ok = false;
  const url2 = 'https://www.baylink.us/assets/Journal-B.js';
  const q = R.quietly(() => R.importRetry(() => Promise.reject(CHROME(url2)), { memo, sleep, importUrl: () => (ok ? Promise.resolve('j') : Promise.reject(CHROME(`${url2}?retry=1`))), waits: [5, 5, 5] }));
  await new Promise(r => setTimeout(r, 1));
  assert.equal(R.retryingLoud(), 0, 'a quiet prefetch: no pill');
  const loud = R.importRetry(() => Promise.reject(CHROME(url2)), { memo, sleep });
  await new Promise(r => setTimeout(r, 1));
  assert.equal(R.retryingLoud(), 1, 'the press joined it: the pill');
  ok = true;
  assert.equal(await loud, 'j');
  assert.equal(await q, 'j');
  assert.equal(R.retryingLoud(), 0);
  off();
});

test('W9-P4 chunkPending: 还在加载… while a loud retry runs (the reader\'s language), gone when it settles; uninstall removes it', async () => {
  const { initChunkPending } = await import('../src/opus-bay/game/chunkPending');
  const R = await import('../src/opus-bay/game/importRetry');
  const made: Record<string, unknown>[] = [];
  const page = { children: [] as unknown[], append(c: unknown) { this.children.push(c); } };
  const doc = {
    createElement: () => { const el: Record<string, unknown> = { style: {}, attrs: {} as Record<string, string>, removed: false, textContent: '', className: '' }; el.setAttribute = (k: string, v: string) => { (el.attrs as Record<string, string>)[k] = v; }; el.remove = () => { el.removed = true; }; made.push(el); return el; },
    querySelector: (s: string) => (s === '.ob-page' ? page : null),
    body: page,
  };
  const off = initChunkPending(doc as never);
  const memo = new Map();
  let ok = false;
  const url = 'https://www.baylink.us/assets/WeekPanel-C.js';
  const p = R.importRetry(() => Promise.reject(CHROME(url)), { memo, sleep: () => new Promise(r => setTimeout(r, 5)), importUrl: () => (ok ? Promise.resolve(1) : Promise.reject(CHROME(`${url}?retry=1`))), waits: [5, 5, 5] });
  await new Promise(r => setTimeout(r, 1));
  assert.equal(made.length, 1);
  assert.equal((made[0].attrs as Record<string, string>).role, 'status');
  assert.match(String(made[0].textContent), /还在加载/);
  assert.equal(made[0].removed, false);
  ok = true;
  await p;
  assert.equal(made[0].removed, true, 'gone once the part landed');
  off();
});

test('W9-P4 lazyChunk { onLost }: told once when the part is lost for good (the four panels close themselves), never for the module\'s own error; tests\' makeLazy still works', async () => {
  const { lazyChunk } = await import('../src/opus-bay/game/lazyChunk');
  const factories: (() => Promise<{ default: unknown }>)[] = [];
  const fakeLazy = (f: () => Promise<{ default: unknown }>) => { factories.push(f); return (() => null) as never; };
  let lostCalls = 0;
  lazyChunk(() => Promise.reject(CHROME('https://www.baylink.us/assets/MapPanel-A.js?retry=3')), { onLost: () => { lostCalls++; }, makeLazy: fakeLazy });
  await factories[0]();
  assert.equal(lostCalls, 1);
  lazyChunk(() => Promise.reject(new TypeError("Cannot read properties of undefined (reading 'x')")), { onLost: () => { lostCalls++; }, makeLazy: fakeLazy });
  await assert.rejects(factories[2](), /Cannot read/);
  assert.equal(lostCalls, 1, 'a bug in the module is not a lost chunk');
  const o = src('ui/Overlay.tsx');
  for (const [p, k] of [['MapPanel', 'map'], ['Journal', 'journal'], ['WeekPanel', 'week'], ['SettingsPanel', 'settings']]) assert.ok(o.split(/\r?\n/).some(l => l.startsWith(`const ${p} = lazyChunk(`) && l.trimEnd().endsWith(`{ onLost: closeLost('${k}') });`)), p);
  // a lost Map closes the Map only — never the Journal the player opened while it retried
  assert.ok(o.includes("function closeLost(kind: 'map' | 'journal' | 'week' | 'settings'): () => void { return () => { if (game.get().panel.kind === kind) closePanel(); }; }"));
  assert.match(src('OpusBayPage.tsx'), /const offPending = initChunkPending\(\);/, 'the page installs the pill');
});

test('W9-P4 w5Features: the five feature chunks load through importRetry (a lost one retries, then the reload card) — not exempt from the W8-P5 scan any more', () => {
  const w = src('game/w5Features.ts');
  for (const id of ['economy', 'play', 'eggs', 'realsf', 'halloween']) assert.ok(w.includes(`${id}: () => importRetry(() => import('../${id}/index')),`), id);
  assert.doesNotMatch(fs.readFileSync('tests/opus-bay-w8-p-retry.test.ts', 'utf8'), /'game\/w5Features\.ts', 'game\/goTo\.ts'/);
});
