import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

/**
 * Wave 6 · lane W · W6-W4 捉迷藏 hide & seek with BAYBAY (play/hideSeek.ts, play/hideSeekEntry.ts): the warmer / colder
 * words, where she hides (a landmark 18–60 u away, else a walkable spot nearby, else nowhere), every spot standable and
 * walked to on the published city from four places, a whole round driven through the frame systems (count, seek,
 * warmer / colder on the chip, found → the medal through the kit), 放弃, and the chunk (≤ 5 KB, outside the core).
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const hs = await import('../src/opus-bay/play/hideSeek');
const chip = await import('../src/opus-bay/play/chip');
const kit = await import('../src/opus-bay/play/kit');
const { onEvent } = await import('../src/opus-bay/core/events');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const T = await import('../src/opus-bay/core/terrain');
const nav = await import('../src/opus-bay/actors/nav');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
const { cityDropLots } = await import('../src/opus-bay/world/sf/hero');
const { sfDisk } = await import('./opus-bay-sf-disk');

const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

test('W6-W4 warmer / colder: a word per 2.5 u closer or farther than the last word, and how warm it is', () => {
  assert.deepEqual(hs.heatStep(30, 28), { ref: 30, say: null });
  assert.deepEqual(hs.heatStep(30, 27.4), { ref: 27.4, say: 'warmer' });
  assert.deepEqual(hs.heatStep(27.4, 30), { ref: 30, say: 'colder' });
  assert.equal(hs.heatWord(5).en, 'Hot! Really close!');
  assert.equal(hs.heatWord(15).zh, '暖暖的');
  assert.equal(hs.heatWord(30).zh, '有点凉');
  assert.equal(hs.heatWord(80).zh, '冷冰冰');
  assert.equal(hs.SAY.warmer.zh, '暖了！');
  assert.equal(hs.SAY.colder.zh, '冷了…');
});

test('W6-W4 where she hides: a landmark 18–60 u away, behind its trip end; else a walkable spot nearby; else nowhere', () => {
  const list = [
    { id: 'near', name: { zh: '近', en: 'Near' }, x: 10, z: 0 },
    { id: 'mid', name: { zh: '中', en: 'Mid' }, x: 0, z: 40 },
    { id: 'far', name: { zh: '远', en: 'Far' }, x: 90, z: 0 },
  ];
  const all = { stand: () => true, reach: () => true, list, rand: seeded(7) };
  const s = hs.pickHideSpot({ x: 0, z: 0 }, all)!;
  assert.equal(s.near?.id, 'mid', 'only the 18–60 u landmark');
  assert.ok(Math.hypot(s.x, s.z) > 40 && Math.hypot(s.x, s.z - 40) <= 3.6, `behind it, away from the player: (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`);
  // the landmark is not walked to: a spot nearby instead
  const near = hs.pickHideSpot({ x: 0, z: 0 }, { ...all, reach: (_f, t) => Math.hypot(t.x, t.z - 40) > 10 })!;
  assert.equal(near.near, null);
  const d = Math.hypot(near.x, near.z);
  assert.ok(d >= hs.NEAR_MIN && d <= hs.NEAR_MAX, `${d.toFixed(1)} u away`);
  // nothing stands: no game
  assert.equal(hs.pickHideSpot({ x: 0, z: 0 }, { ...all, stand: () => false }), null);
  // the real list: attractions' trip ends (arrival first)
  const real = hs.hideCandidates();
  assert.ok(real.length > 100 && real.every(c => Number.isFinite(c.x) && Number.isFinite(c.z) && c.name.zh && c.name.en));
});

test('W6-W4 on the published city: from four places she hides on standable ground the nav grid walks to, within 64 u', async () => {
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  const places = [
    { id: 'washington-square', x: -66, z: 104 },
    { id: 'union-square', x: 96, z: 210 },
    { id: 'painted-ladies', x: -7.1, z: 585.2 },
    { id: 'ocean-beach', x: -478.1, z: 1416 },
  ];
  for (const p of places) await sf.attachAround(city, p.x, p.z, 110, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(cityDropLots(sf.manifest.heroDropLots)) });
  try {
    for (const p of places) {
      const start = T.canStand(p.x, p.z, T.STAND_RADIUS) ? p : nav.arrivalSpot(p, 10)!;
      assert.ok(start, `${p.id}: a start`);
      for (const seed of [3, 11]) {
        const s = hs.pickHideSpot(start, { ...hs.liveOpts(), rand: seeded(seed) });
        assert.ok(s, `${p.id}: somewhere to hide`);
        const d = Math.hypot(s.x - start.x, s.z - start.z);
        assert.ok(d <= 64 && d >= 14, `${p.id}: ${d.toFixed(1)} u away`);
        assert.ok(T.canStand(s.x, s.z, T.STAND_RADIUS), `${p.id}: standable`);
        const path = nav.findPath(start, s, 1), e = path?.points[path.points.length - 1];
        assert.ok(e && Math.hypot(e.x - s.x, e.z - s.z) < 1.1, `${p.id}: walked to`);
      }
    }
  } finally { T.setCityTerrain(null); }
});

test('W6-W4 a round: 3 · 2 · 1, she is pinned where she hides, warmer on the chip as you close in, found → medal:hide-seek; 放弃 is free', async () => {
  kit.__setBestWriter(null);
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  const p = runtime.player;
  p.x = 0; p.z = 0;
  const spot = { x: 0, z: 40 };
  const opts = { stand: () => true, reach: () => true, rand: seeded(5), list: [{ id: 'mid', name: { zh: '中间', en: 'the middle' }, x: spot.x, z: spot.z }] };
  try {
    assert.ok(hs.startHideSeek(opts));
    assert.equal(chip.chipState()?.id, hs.HIDE_ID);
    for (let i = 0; i < 40; i++) stepFrameSystems(0.1, i * 0.1);
    assert.ok(chip.chipState()?.line?.zh.includes('中间'), 'the chip names the landmark');
    const g = runtime.guide;
    assert.ok(Math.hypot(g.x - spot.x, g.z - spot.z) < 4, 'BAYBAY where she hides');
    // walk 5 u toward her: 暖了
    p.z = 5;
    stepFrameSystems(0.1, 5);
    assert.equal(chip.chipState()?.status?.zh.startsWith('暖了！'), true, chip.chipState()?.status?.zh);
    p.x = g.x; p.z = g.z - 1;
    stepFrameSystems(0.1, 5.1);
    // W7-W2: she says a fixed line (voiceable); the chip holds the seconds for FOUND_HOLD s, then the card
    const { flow } = await import('../src/opus-bay/game/flowStore');
    assert.deepEqual(flow.get().bubble?.text, hs.HIDE_LINES.found);
    assert.match(chip.chipState()?.status?.zh ?? '', /^\d+ 秒找到！$/);
    for (let i = 0; i < 13; i++) stepFrameSystems(0.1, 5.2 + i * 0.1);
    assert.equal(chip.chipState(), null, 'the chip goes after the found time');
    assert.ok(events.some(e => e.type === 'play' && e.activity === hs.HIDE_ID && e.what === 'end'));
    assert.ok(events.some(e => e.type === 'reward' && e.source === 'medal:hide-seek:3'), 'found in 5 s: the top medal');
    // 放弃: no medal, the pin goes
    events.length = 0;
    p.x = 0; p.z = 0;
    assert.ok(hs.startHideSeek(opts));
    for (let i = 0; i < 40; i++) stepFrameSystems(0.1, 10 + i * 0.1);
    chip.chipState()?.action?.run();
    assert.equal(kit.currentActivity(), null);
    assert.ok(events.some(e => e.type === 'play' && e.what === 'cancel'));
    assert.ok(!events.some(e => e.type === 'reward'));
  } finally { hs.stopHideSeek(); off(); game.set({ phase: prev.phase, mode: prev.mode }); }
});

test('W6-W4 the chunk: play/hideSeek.ts ≤ 5 KB gzip on its own, loaded only from the entry (outside GameRoot)', async () => {
  const { build } = await import('esbuild');
  const ROOT = path.resolve(import.meta.dirname, '..'), dir = path.join(ROOT, 'src/opus-bay/play');
  const entry = path.join(dir, 'hideSeek.ts');
  const shared = new Set(['kit', 'chip', 'partc', 'puppet', 'sounds2'].map(n => path.join(dir, `${n}.ts`)));
  const r = await build({
    entryPoints: [entry], bundle: true, write: false, minify: true, format: 'esm', target: 'es2022', logLevel: 'silent',
    plugins: [{ name: 'own', setup(b) { b.onResolve({ filter: /.*/ }, a => { if (a.kind === 'entry-point') return undefined; const base = path.resolve(a.resolveDir, a.path); const hit = `${base}.ts`; return !a.path.startsWith('.') || !hit.startsWith(dir) || shared.has(hit) ? { path: a.path, external: true } : { path: hit }; }); } }],
  });
  const bytes = zlib.gzipSync(r.outputFiles[0].contents).length;
  assert.ok(bytes <= 5 * 1024, `${bytes} B`);
  const entrySrc = fs.readFileSync(path.join(dir, 'hideSeekEntry.ts'), 'utf8');
  assert.match(entrySrc, /import\('\.\/hideSeek'\)/, 'loaded lazily');
  assert.doesNotMatch(entrySrc, /from '\.\/hideSeek'/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'src/opus-bay/game/GameRoot.tsx'), 'utf8'), /hideSeek/);
});

test('W6-W5 the coach line: once per device, after 40 s of quiet free roam (W7-W2: not waiting for lane A\'s emote coach), BAYBAY says 捉迷藏 is there', async () => {
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const mem = new Map<string, string>();
  const store = { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => { mem.set(k, v); } };
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  runtime.player.moving = false;
  flow.set({ bubble: null });
  try {
    // W7-W2: the emote coach's key stays unset — the line comes anyway after 40 s of quiet
    assert.equal(mem.get('opus-bay:play:emote-coach:v1'), undefined);
    const off = hs.startHideCoach(store);
    for (let i = 0; i < hs.HIDE_COACH_AFTER - 2; i++) stepFrameSystems(1, 100 + i);
    assert.equal(mem.get(hs.HIDE_COACH_KEY), undefined, 'not before 40 s');
    for (let i = 0; i < 4; i++) stepFrameSystems(1, 200 + i);
    assert.equal(mem.get(hs.HIDE_COACH_KEY), '1', 'said once');
    assert.ok(flow.get().bubble?.text.zh.includes('捉迷藏'), JSON.stringify(flow.get().bubble));
    off();
    // a second visit: never again
    const again = hs.startHideCoach(store);
    flow.set({ bubble: null });
    for (let i = 0; i < 60; i++) stepFrameSystems(1, 300 + i);
    assert.equal(flow.get().bubble, null);
    again();
  } finally { flow.set({ bubble: null }); game.set({ phase: prev.phase, mode: prev.mode }); }
});

// ---------------------------------------------------------------------------
// W6-W-review (adversarial review of lane W)
// ---------------------------------------------------------------------------

test('W6-W-review a round ends when BAYBAY is asked to lead (the next goal, a trip, the tour): she is never pinned in hiding while you are led', async () => {
  const { flow } = await import('../src/opus-bay/game/flowStore');
  kit.__setBestWriter(null);
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  flow.set({ trip: null, freeLead: null });
  const p = runtime.player;
  p.x = 0; p.z = 0;
  const opts = { stand: () => true, reach: () => true, rand: seeded(5), list: [{ id: 'mid', name: { zh: '中间', en: 'the middle' }, x: 0, z: 40 }] };
  try {
    // 问 BAYBAY → 带我去下一个目标 during the seek (live QA: the player was walked toward Coit Tower by nobody, BAYBAY
    // stayed frozen where she hid and the chip kept saying 冷了…)
    assert.ok(hs.startHideSeek(opts));
    for (let i = 0; i < 40; i++) stepFrameSystems(0.1, i * 0.1);
    assert.equal(kit.currentActivity()?.spec.id, hs.HIDE_ID);
    flow.set({ freeLead: 'pelican:coit' });
    stepFrameSystems(0.1, 4.1);
    assert.equal(kit.currentActivity(), null, 'the round is over');
    assert.equal(chip.chipState(), null, 'the chip is gone');
    assert.ok(events.some(e => e.type === 'play' && e.activity === hs.HIDE_ID && e.what === 'cancel'));
    assert.ok(!events.some(e => e.type === 'reward'), 'nothing paid');
    // a whole-city tour (the mode leaves free roam) ends it the same way
    flow.set({ freeLead: null });
    events.length = 0;
    assert.ok(hs.startHideSeek(opts));
    for (let i = 0; i < 40; i++) stepFrameSystems(0.1, 10 + i * 0.1);
    game.set({ mode: 'tour' });
    stepFrameSystems(0.1, 14.1);
    assert.equal(kit.currentActivity(), null);
    assert.ok(events.some(e => e.type === 'play' && e.what === 'cancel'));
  } finally { hs.stopHideSeek(); off(); flow.set({ trip: null, freeLead: null }); game.set({ phase: prev.phase, mode: prev.mode }); }
});

test('W6-W-review the seek repaints the chip only when a word or the second changes (not every frame for up to 3 minutes)', () => {
  kit.__setBestWriter(null);
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  const p = runtime.player;
  p.x = 0; p.z = 0;
  const opts = { stand: () => true, reach: () => true, rand: seeded(5), list: [{ id: 'mid', name: { zh: '中间', en: 'the middle' }, x: 0, z: 40 }] };
  try {
    assert.ok(hs.startHideSeek(opts));
    for (let i = 0; i < 40; i++) stepFrameSystems(0.1, i * 0.1);
    // 60 frames of one second, standing still: the clock ticks once, the words stay
    const s0 = chip.chipSeq();
    for (let i = 0; i < 60; i++) stepFrameSystems(1 / 60, 5 + i / 60);
    const n = chip.chipSeq() - s0;
    assert.ok(n <= 2, `${n} chip repaints in one still second`);
  } finally { hs.stopHideSeek(); game.set({ phase: prev.phase, mode: prev.mode }); }
});

test('W6-W-review the coach line does not read storage every frame once the emote coach has spoken', () => {
  const mem = new Map<string, string>([['opus-bay:play:emote-coach:v1', '1']]);
  let reads = 0;
  const store = { get: (k: string) => { reads++; return mem.get(k) ?? null; }, set: (k: string, v: string) => { mem.set(k, v); } };
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  runtime.player.moving = true; // walking: no quiet, the line waits
  try {
    const off = hs.startHideCoach(store);
    for (let i = 0; i < 120; i++) stepFrameSystems(1 / 60, i / 60);
    off();
    assert.ok(reads <= 3, `${reads} storage reads in 120 frames`);
  } finally { runtime.player.moving = false; game.set({ phase: prev.phase, mode: prev.mode }); }
});
