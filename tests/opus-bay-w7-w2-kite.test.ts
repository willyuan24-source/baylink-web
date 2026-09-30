import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

/**
 * Wave 7 · lane W2 · 放风筝 (play/kite.ts, play/kiteEntry.ts, play/kiteZone.ts, play/kiteKind.ts, play/kites.ts): the kite's physics (a
 * gust lets the line out, a lull sinks it, a long hold dives, holding through the dive brings it down, letting go
 * climbs), a player who plays by the gauge reaches ★ inside the round, the tiers and points, a whole round through the
 * frame systems (medal:kite:n through the kit), where 放风筝 is offered, the ambient kites (day only, on the lawn, one
 * kind), the records row, and the chunks (lazy, outside GameRoot).
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const K = await import('../src/opus-bay/play/kite');
const E = await import('../src/opus-bay/play/kiteZone');
const kind = await import('../src/opus-bay/play/kiteKind');
const amb = await import('../src/opus-bay/play/kites');
const { KITE_LINES, KITE_ID } = await import('../src/opus-bay/play/kiteLines');
const chip = await import('../src/opus-bay/play/chip');
const kit = await import('../src/opus-bay/play/kit');
const { onEvent } = await import('../src/opus-bay/core/events');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { BEST_ROWS } = await import('../src/opus-bay/economy/records');
const THREE = await import('three');
const { U } = await import('../src/opus-bay/world/materials');

const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

test('W7-W2 kite physics: a gust lets the line out fast, a lull sinks it, a long hold dives and comes down, letting go climbs', () => {
  // hold through a gust: line out fast, the elevation holds
  const k = K.newKite(seeded(3));
  k.g0 = 0; k.g1 = 10;
  for (let i = 0; i < 10; i++) K.stepKite(k, 0.1, false); // the gust ramps in
  const l0 = k.line, e0 = k.e;
  for (let i = 0; i < 10; i++) K.stepKite(k, 0.1, true);
  assert.ok(k.line - l0 > 2, `in a gust 1 s of holding lets out ${(k.line - l0).toFixed(2)} u`);
  assert.ok(e0 - k.e < 0.1, 'the elevation holds in a gust');
  // held too long: it dives; hold on and it comes down (a crash: a short line again)
  let dived = false, crashed = false;
  for (let i = 0; i < 60 && !crashed; i++) { const ev = K.stepKite(k, 0.1, true); if (ev === 'dive') dived = true; if (ev === 'crash') crashed = true; }
  assert.ok(dived && crashed, 'dive, then down');
  assert.equal(k.crashes, 1);
  assert.ok(k.line < K.KITE.max);
  // a lull: holding sinks it, letting go climbs
  const c = K.newKite(seeded(4));
  c.g0 = 100; c.g1 = 103;
  const ce = c.e;
  for (let i = 0; i < 10; i++) K.stepKite(c, 0.1, true);
  assert.ok(c.e < ce - 0.2, 'a lull: holding sinks it');
  const low = c.e;
  for (let i = 0; i < 20; i++) K.stepKite(c, 0.1, false);
  assert.ok(c.e > low + 0.5, 'letting go climbs');
});

test('W7-W2 kite: playing by the gauge (hold in a gust, let go in a lull) reaches the top of the line inside the round; tiers and points', () => {
  for (const seed of [1, 7, 21, 99]) {
    const k = K.newKite(seeded(seed));
    let t = 0, topAt = -1;
    while (t < K.ROUND_S && topAt < 0) {
      const hold = k.wind >= K.GUST && k.holdT < K.KITE.holdMax - 0.3 && k.line < K.KITE.max;
      if (K.stepKite(k, 1 / 30, hold) === 'top') topAt = k.t;
      t += 1 / 30;
    }
    assert.ok(topAt > 0 && topAt < 45, `seed ${seed}: the top at ${topAt.toFixed(1)} s`);
    assert.equal(K.kiteTier(k), 3);
    assert.ok(K.kitePoints(k) >= 10);
  }
  // doing nothing: it never gets the line out (● at most)
  const idle = K.newKite(seeded(5));
  for (let i = 0; i < K.ROUND_S * 30; i++) K.stepKite(idle, 1 / 30, false);
  assert.ok(!idle.top && K.kiteTier(idle) <= 1, `idle: tier ${K.kiteTier(idle)}, h ${idle.h.toFixed(2)}`);
  assert.equal(K.kiteTier({ up: true, aloft: K.ALOFT_S, top: false }), 2);
  assert.equal(K.kiteTier({ up: true, aloft: 3, top: false }), 1);
  assert.equal(K.kitePoints({ aloft: 20.4, top: true }), 30);
});

test('W7-W2 kite: a round through the frame systems: the chip (hold, gauge), the top → medal:kite:3; 不玩了 is free', () => {
  kit.__setBestWriter(null);
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  runtime.move.mode = 'foot';
  const p = runtime.player;
  p.x = -380; p.z = 300;
  try {
    assert.ok(K.startKite(seeded(9)));
    const c = chip.chipState()!;
    assert.equal(c.id, KITE_ID);
    assert.ok(c.hold && c.meter && c.action, 'a hold button, the wind gauge, 不玩了');
    // play by the gauge through the chip's hold button
    let t = 0;
    while (kit.currentActivity() && t < K.ROUND_S + 5) {
      const k = K.kiteLive();
      if (k) K.__holdKite(k.wind >= K.GUST && k.holdT < K.KITE.holdMax - 0.3 && k.line < K.KITE.max);
      stepFrameSystems(1 / 30, t);
      t += 1 / 30;
    }
    assert.equal(kit.currentActivity(), null, 'the round ended');
    assert.ok(events.some(e => e.type === 'reward' && e.source === 'medal:kite:3'), JSON.stringify(events.filter(e => e.type === 'reward')));
    assert.equal(chip.chipState(), null);
    assert.equal(runtime.camera.shot, null, 'the camera is released');
    // 不玩了: nothing paid
    events.length = 0;
    assert.ok(K.startKite(seeded(2)));
    for (let i = 0; i < 30; i++) stepFrameSystems(1 / 30, 100 + i / 30);
    chip.chipState()?.action?.run();
    assert.equal(kit.currentActivity(), null);
    assert.ok(!events.some(e => e.type === 'reward'));
    // walking off ends it
    assert.ok(K.startKite(seeded(2)));
    p.x += K.KITE_LEAVE + 1;
    stepFrameSystems(1 / 30, 200);
    assert.equal(kit.currentActivity(), null);
  } finally { K.__resetKite(); off(); game.set({ phase: prev.phase, mode: prev.mode }); }
});

test('W7-W2 放风筝 is offered on Marina Green and the Crissy Field lawn only; the ambient kites fly by day over the lawn', () => {
  assert.ok(E.onKiteLawn({ x: -382, z: 301 }), 'Marina Green');
  assert.ok(E.onKiteLawn({ x: -570, z: 545 }), 'Crissy Field');
  for (const q of [{ x: -382, z: 330 }, { x: -340, z: 300 }, { x: 96, z: 221 }, { x: -450, z: 520 }]) assert.ok(!E.onKiteLawn(q), JSON.stringify(q));
  // the ambient kites: four, by day, over the Bay's side of the lawn (down the sea breeze), never at night
  const mesh = kind.kiteMesh(amb.AMBIENT.length * kind.KITE_PARTS);
  const cam = new THREE.Vector3(-380, 5, 330);
  U.uNight.value = 0;
  const n = amb.poseAmbient(mesh, 12.5, 15, cam);
  assert.equal(n, amb.AMBIENT.length * kind.KITE_PARTS);
  const m = new THREE.Matrix4(), pos = new THREE.Vector3();
  for (let k = 0; k < amb.AMBIENT.length; k++) {
    mesh.getMatrixAt(k * kind.KITE_PARTS, m);
    pos.setFromMatrixPosition(m);
    const stake = amb.stakeAt(amb.AMBIENT[k].t);
    const d = Math.hypot(pos.x - stake.x, pos.z - stake.z);
    assert.ok(pos.y - stake.y > 5 && pos.y - stake.y < 14, `kite ${k} ${(pos.y - stake.y).toFixed(1)} u up`);
    assert.ok(d > 2 && d < 9 && (pos.x - stake.x) * kind.DOWNWIND.x + (pos.z - stake.z) * kind.DOWNWIND.z > 0, `kite ${k} downwind`);
  }
  U.uNight.value = 0.8;
  assert.equal(amb.poseAmbient(mesh, 12.5, 22, cam), 0, 'no kites at night');
  U.uNight.value = 0;
  assert.ok(amb.breeze(15, 0) > amb.breeze(9, 0), 'the afternoon breeze is stronger');
  // one kind on lane A's instanced toy program (no new program)
  assert.equal((mesh.material as unknown as { customProgramCacheKey: () => string }).customProgramCacheKey(), 'ob-toy-inst');
  assert.equal(kind.diamondGeometry().getAttribute('position').count, 12, '4 triangles an instance');
});

test('W7-W2 kite: the words are fixed bubbles (voiceable), the records row is appended, the chunks are lazy and small', async () => {
  for (const [k, v] of Object.entries(KITE_LINES)) assert.ok(v.zh && v.en && !/\d|\$\{/.test(v.zh + v.en), `${k}: fixed text`);
  const keys = BEST_ROWS.map(r => r.key);
  assert.ok(keys.indexOf(KITE_ID) > keys.indexOf('bell') && keys.indexOf('bell') >= 0, 'the records row is appended after the wave-6 rows');
  const ROOT = path.resolve(import.meta.dirname, '..'), dir = path.join(ROOT, 'src/opus-bay/play');
  const entrySrc = fs.readFileSync(path.join(dir, 'kiteEntry.ts'), 'utf8');
  assert.match(entrySrc, /import\('\.\/kite'\)/);
  assert.match(entrySrc, /import\('\.\/kiteZone'\)/);
  assert.match(entrySrc, /import\('\.\/skyline'\)/);
  assert.doesNotMatch(entrySrc, /from '\.\/(kite|kites|kiteZone|kiteLines|skyline|skylineLines|partc)'/, 'the core entry imports none of the chunks');
  assert.match(fs.readFileSync(path.join(dir, 'kiteZone.ts'), 'utf8'), /import\('\.\/kites'\)/);
  assert.match(fs.readFileSync(path.join(dir, 'index.ts'), 'utf8'), /registerKites\(\)/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'src/opus-bay/game/GameRoot.tsx'), 'utf8'), /kite/i);
  const { build } = await import('esbuild');
  const shared = new Set(['kit', 'chip', 'partc', 'sounds3', 'toyMesh', 'kiteLines', 'kiteEntry', 'kiteZone'].map(n => path.join(dir, `${n}.ts`)));
  for (const f of ['kite.ts', 'kites.ts', 'kiteZone.ts', 'skyline.ts']) {
    const r = await build({
      entryPoints: [path.join(dir, f)], bundle: true, write: false, minify: true, format: 'esm', target: 'es2022', logLevel: 'silent',
      plugins: [{ name: 'own', setup(b) { b.onResolve({ filter: /.*/ }, a => { if (a.kind === 'entry-point') return undefined; const base = path.resolve(a.resolveDir, a.path); const hit = `${base}.ts`; return !a.path.startsWith('.') || !hit.startsWith(dir) || shared.has(hit) ? { path: a.path, external: true } : { path: hit }; }); } }],
    });
    const bytes = zlib.gzipSync(r.outputFiles[0].contents).length;
    assert.ok(bytes <= 6 * 1024, `${f}: ${bytes} B`);
  }
});
