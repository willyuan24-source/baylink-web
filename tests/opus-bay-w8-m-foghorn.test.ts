import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

/**
 * Wave 8 · lane M · the foghorns' call and answer at Fort Point (play/foghorn.ts, play/FogPanel.tsx, the prompt in
 * play/sfgames8.ts): the tunes drawn each game, players of every kind (a good ear ★ 100, one who taps the south horn
 * short, one who needs a second listen, one who never answers), a whole game through the frame systems into
 * `medal:foghorn:n`, 放弃 / the stick / Settings, the prompt on ground the fort's arrival walks to, the hold list, the
 * records row and the chunks.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const fog = await import('../src/opus-bay/play/foghorn');
const zones8 = await import('../src/opus-bay/play/sfgames8');
const lines = await import('../src/opus-bay/play/sfgames8Lines');
const kit = await import('../src/opus-bay/play/kit');
const hold = await import('../src/opus-bay/game/baybayHold');
const { onEvent } = await import('../src/opus-bay/core/events');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { BEST_ROWS } = await import('../src/opus-bay/economy/records');

const ROOT = path.resolve(import.meta.dirname, '..');
const PLAY = path.join(ROOT, 'src/opus-bay/play');
const DT = 1 / 30;
const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
type Horn = import('../src/opus-bay/play/foghorn').Horn;

test('W8-M foghorn tunes: six rounds of 2–5 horns, the south horn at most once a round, never one mid-span horn three times running; drawn fresh each game', () => {
  const seen = new Set<string>();
  for (let s = 1; s <= 60; s++) {
    const t = fog.drawTunes(seeded(s));
    assert.deepEqual(t.map(x => x.length), [...fog.ROUND_LENGTHS]);
    for (const tune of t) {
      assert.ok(tune.filter(h => h === 'S').length <= 1, tune.join(''));
      for (let i = 2; i < tune.length; i++) assert.ok(!(tune[i] === tune[i - 1] && tune[i] === tune[i - 2]), tune.join(''));
    }
    seen.add(t.map(x => x.join('')).join('|'));
  }
  assert.ok(seen.size >= 55, `tunes vary (${seen.size} of 60)`);
  for (const l of Object.values(lines.FOG_LINES)) assert.ok(l.zh && l.en && [...l.zh].length <= 45);
});

/**
 * Play a whole game: in each answer, blow the tune (`mistakes`: per round, the try on which the first horn is wrong;
 * `short`: tap the south horn too briefly; `idle`: never answer), a south horn held 1 s, the others 0.2 s, 0.3 s apart.
 */
function play(p: { mistakes?: Record<number, number[]>; short?: boolean; idle?: boolean; seed?: number }) {
  const gm = new fog.FogGame(fog.drawTunes(seeded(p.seed ?? 3)));
  const ev: string[] = [];
  let plan: { at: number; h: Horn; down: boolean }[] = [];
  let planFor = '';
  while (!gm.done && gm.clock < 400) {
    ev.push(...gm.step(DT));
    if (gm.phase !== 'answer' || p.idle) continue;
    const key = `${gm.round}:${gm.tries}`;
    if (planFor !== key) {
      planFor = key;
      plan = [];
      let at = gm.t + 0.4;
      gm.tune.forEach((h0, i) => {
        const wrong = i === 0 && (p.mistakes?.[gm.round] ?? []).includes(gm.tries);
        const h: Horn = wrong ? (h0 === 'H' ? 'L' : 'H') : h0;
        const len = h === 'S' ? (p.short ? 0.3 : 1.0) : 0.2;
        plan.push({ at, h, down: true }, { at: at + len, h, down: false });
        at += len + 0.3;
      });
    }
    while (plan.length && plan[0].at <= gm.t && gm.phase === 'answer' && `${gm.round}:${gm.tries}` === planFor) {
      const s = plan.shift()!;
      ev.push(...(s.down ? gm.press(s.h) : gm.release(s.h)));
    }
  }
  return { gm, ev, tier: fog.fogTier(gm.score) };
}

test('W8-M foghorn players: a good ear ★ 100 in about a minute; a second listen on two rounds ◆; two lost ships below ★; a south horn always tapped short no ★; never answering 0', () => {
  const ear = play({});
  assert.equal(ear.gm.score, 100);
  assert.equal(ear.gm.first, 6);
  assert.ok(ear.gm.clock >= 45 && ear.gm.clock <= 85, `${ear.gm.clock.toFixed(1)} s`);
  for (const e of ['ship', 'answer', 'round-ok', 'longer', 'done']) assert.ok(ear.ev.includes(e), e);
  const twice = play({ mistakes: { 2: [0], 4: [0] } });
  assert.equal(twice.gm.second, 2);
  assert.ok(twice.tier === 2, `second listen x2: ${twice.gm.score}`);
  assert.ok(twice.ev.includes('retry') && twice.ev.includes('wrong'));
  const lost = play({ mistakes: { 1: [0, 1], 3: [0, 1] } });
  assert.equal(lost.gm.lost, 2);
  assert.ok(lost.tier < 3 && lost.tier >= 1, `two lost: ${lost.gm.score}`);
  assert.ok(lost.ev.includes('round-lost'));
  // the south horn tapped short every time: each round with it needs the second try and loses it
  const anyS = play({ seed: 5 }).gm.tunes.some(t => t.includes('S'));
  if (anyS) {
    const short = play({ short: true, seed: 5 });
    assert.ok(short.ev.includes('short'));
    assert.ok(short.tier < 3, `short: ${short.gm.score}`);
  }
  const idle = play({ idle: true });
  assert.equal(idle.gm.score, 0);
  assert.equal(idle.gm.lost, 6);
  assert.ok(idle.ev.filter(e => e === 'late').length === 12, 'two late answers a round');
  console.log(`W8-M foghorn players: ear ${ear.gm.score} (${ear.gm.clock.toFixed(1)} s) · twice ${twice.gm.score} · lost2 ${lost.gm.score} · idle ${idle.gm.score}`);
});

test('W8-M foghorn: a whole game through the frame systems pays medal:foghorn up to its tier; 放弃 and the stick pay nothing; Settings pauses', () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  fog.__resetFoghorn();
  const events: { type: string; source?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  const prevMode = runtime.move.mode;
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false, paused: false } as never);
  runtime.move.mode = 'foot';
  try {
    assert.ok(fog.startFoghorn(fog.drawTunes(seeded(9))));
    assert.equal(kit.currentActivity()?.spec.id, 'foghorn');
    let plan: { at: number; h: Horn; down: boolean }[] = [];
    let planFor = '';
    for (let i = 0; i < 200 / DT && fog.fogGame(); i++) {
      stepFrameSystems(DT, i * DT);
      const gm = fog.fogGame();
      if (!gm || gm.phase !== 'answer') continue;
      const key = `${gm.round}:${gm.tries}`;
      if (planFor !== key) {
        planFor = key; plan = [];
        let at = gm.t + 0.3;
        for (const h of gm.tune) { const len = h === 'S' ? 1 : 0.2; plan.push({ at, h, down: true }, { at: at + len, h, down: false }); at += len + 0.3; }
      }
      while (plan.length && plan[0].at <= gm.t) { const s = plan.shift()!; if (s.down) fog.fogPress(s.h); else fog.fogRelease(s.h); }
    }
    assert.equal(fog.fogGame(), null, 'the game ended');
    for (const t of [1, 2, 3]) assert.ok(events.some(e => e.type === 'reward' && e.source === `medal:foghorn:${t}`), `medal ${t}`);
    assert.equal(kit.bestOf('foghorn'), 100);
    // 放弃
    events.length = 0;
    assert.ok(fog.startFoghorn());
    for (let j = 0; j < 3 / DT; j++) stepFrameSystems(DT, 500 + j * DT);
    fog.cancelFoghorn();
    assert.equal(fog.fogGame(), null);
    // the stick
    assert.ok(fog.startFoghorn());
    for (let j = 0; j < 1 / DT; j++) stepFrameSystems(DT, 600 + j * DT);
    runtime.input.moveY = 1;
    stepFrameSystems(DT, 602);
    runtime.input.moveY = 0;
    assert.equal(fog.fogGame(), null, 'the stick gave up');
    assert.ok(!events.some(e => e.type === 'reward'), 'nothing paid');
    // Settings
    assert.ok(fog.startFoghorn());
    for (let j = 0; j < 1 / DT; j++) stepFrameSystems(DT, 700 + j * DT);
    const c0 = fog.fogGame()!.clock;
    game.set({ paused: true } as never);
    for (let j = 0; j < 2 / DT; j++) stepFrameSystems(DT, 710 + j * DT);
    assert.equal(fog.fogGame()!.clock, c0);
    game.set({ paused: false } as never);
    fog.cancelFoghorn();
  } finally { off(); fog.__resetFoghorn(); kit.__resetKit(); runtime.input.moveY = 0; runtime.move.mode = prevMode; flow.set({ bubble: null } as never); game.set({ phase: prev.phase, mode: prev.mode, paused: prev.paused } as never); }
});

test('W8-M foghorn prompt: on ground the Fort Point arrival walks to, clear of egg 9 and of the arrival, BAYBAY’s invite reaching the arrival', async () => {
  const T = await import('../src/opus-bay/core/terrain');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { cityDropLots } = await import('../src/opus-bay/world/sf/hero');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { eggById } = await import('../src/opus-bay/eggs/registry');
  const { LANDMARK_ARRIVALS } = await import('../src/opus-bay/data/sf/attractions');
  const trip = LANDMARK_ARRIVALS['fort-point'];
  assert.ok(trip, 'the fort has its arrival');
  const sp = zones8.FOG_SPOT;
  const egg = eggById('baybay-otter-roots');
  if (egg) assert.ok(Math.hypot(sp.x - egg.at.x, sp.z - egg.at.z) >= sp.r + 3, 'clear of egg 9');
  const dTrip = Math.hypot(sp.x - trip.x, sp.z - trip.z);
  assert.ok(dTrip >= 2.5 + sp.r && dTrip <= zones8.FOG_INVITE_R, `the arrival ${dTrip.toFixed(1)} u away`);
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, sp.x, sp.z, 60, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(cityDropLots(sf.manifest.heroDropLots)) });
  try {
    assert.ok(T.canStand(sp.x, sp.z, T.STAND_RADIUS), 'standable');
    // walkable from the arrival: a flood over a 0.25 u grid (radius 0.3) between them
    const step = 0.25, x0 = Math.min(sp.x, trip.x) - 8, z0 = Math.min(sp.z, trip.z) - 8, nx = Math.ceil((Math.max(sp.x, trip.x) + 8 - x0) / step), nz = Math.ceil((Math.max(sp.z, trip.z) + 8 - z0) / step);
    const seen = new Uint8Array(nx * nz);
    const idx = (x: number, z: number) => Math.round((x - x0) / step) * nz + Math.round((z - z0) / step);
    const q = [idx(trip.x, trip.z)];
    seen[q[0]] = 1;
    while (q.length) {
      const k = q.pop()!, i = Math.floor(k / nz), j = k % nz;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const kk = a * nz + b;
        if (seen[kk] || !T.canStand(x0 + a * step, z0 + b * step, 0.3)) continue;
        seen[kk] = 1; q.push(kk);
      }
    }
    assert.ok(seen[idx(sp.x, sp.z)], 'the prompt is reached on foot from the arrival');
  } finally { T.setCityTerrain(null); }
});

test('W8-M foghorn: the hold list names the panel, the records row is appended', () => {
  assert.ok(hold.BAYBAY_HOLD_OVERLAYS.includes(fog.FOG_OVERLAY));
  assert.ok(zones8.SF8_OVERLAYS.includes(fog.FOG_OVERLAY as never));
  const keys = BEST_ROWS.map(r => r.key);
  assert.ok(keys.indexOf('foghorn') > keys.indexOf('busk'), 'appended');
});

test('W8-M foghorn chunks: small, lazy from the set’s zones, nowhere in GameRoot', async () => {
  const { build } = await import('esbuild');
  const size = async (file: string, shared: string[]) => {
    const own = new Set(shared.map(n => [path.join(PLAY, `${n}.ts`), path.join(PLAY, `${n}.tsx`)]).flat());
    const r = await build({
      entryPoints: [path.join(PLAY, file)], bundle: true, write: false, minify: true, format: 'esm', target: 'es2022', logLevel: 'silent', jsx: 'automatic',
      loader: { '.css': 'empty' },
      plugins: [{ name: 'own', setup(b) { b.onResolve({ filter: /.*/ }, a => { if (a.kind === 'entry-point') return undefined; if (a.path.endsWith('.css') || a.kind === 'dynamic-import') return { path: a.path, external: true }; const base = path.resolve(a.resolveDir, a.path); const hit = [`${base}.ts`, `${base}.tsx`].find(f => fs.existsSync(f)); return !a.path.startsWith('.') || !hit || !hit.startsWith(PLAY) || own.has(hit) ? { path: a.path, external: true } : { path: hit }; }); } }],
    });
    return zlib.gzipSync(r.outputFiles[0].contents).length;
  };
  const shared = ['kit', 'chip', 'partc', 'puppet', 'zones', 'sfgames8Lines', 'sfgames8Sounds'];
  const sizes = { zones8: await size('sfgames8.ts', shared), foghorn: await size('foghorn.ts', shared), fogPanel: await size('FogPanel.tsx', [...shared, 'foghorn']) };
  assert.ok(sizes.zones8 <= 2.5 * 1024, JSON.stringify(sizes));
  for (const [k, v] of Object.entries(sizes)) assert.ok(v <= 5 * 1024, `${k}: ${v} B`);
  const zsrc = fs.readFileSync(path.join(PLAY, 'sfgames8.ts'), 'utf8');
  for (const m of ['foghorn', 'FogPanel']) {
    assert.match(zsrc, new RegExp(`import\\('\\./${m}'\\)`), `${m} lazily`);
    assert.doesNotMatch(zsrc, new RegExp(`from '\\./${m}'`), `${m} not static`);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'src/opus-bay/game/GameRoot.tsx'), 'utf8'), /foghorn|FogPanel/);
  console.log('W8-M foghorn chunk sizes (B, gzip):', JSON.stringify(sizes));
});
