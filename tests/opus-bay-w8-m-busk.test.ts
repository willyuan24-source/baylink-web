import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

/**
 * Wave 8 · lane M · play along with the busker (play/busk.ts, play/BuskPanel.tsx, play/buskSounds.ts, the prompts in
 * play/sfgames8.ts): the two songs' charts, players of every kind (a steady hand ★, a late thumb learnt, a masher and a
 * dozer earn nothing), a whole jam through the frame systems into `medal:busk:n`, 放弃 and the stick pay nothing, the
 * prompts on standable ground beside lane L's guitarists (their hours pinned to the corners'), the hold list, the
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

const busk = await import('../src/opus-bay/play/busk');
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
const DT = 1 / 60;
const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

test('W8-M busk songs: 18 bars, the dots in order from bar 3, the backbeat on Haight St and the off-beats on 24th St, a chord a bar, about 40–45 s', () => {
  for (const s of Object.values(busk.SONGS)) {
    assert.equal(s.bars, 18);
    assert.equal(s.chords.length, s.bars, `${s.style}: a chord a bar`);
    for (let i = 1; i < s.notes.length; i++) assert.ok(s.notes[i] > s.notes[i - 1], `${s.style}: ascending`);
    assert.ok(s.notes[0] >= 8, 'two bars to listen in');
    assert.ok(s.notes[s.notes.length - 1] < s.bars * 4, 'inside the song');
    assert.ok(s.chorusAt > s.notes[0] && s.chorusAt < s.notes[s.notes.length - 1]);
    const len = s.bars * 4 * s.beat;
    assert.ok(len >= 38 && len <= 47, `${s.style}: ${len.toFixed(1)} s`);
    const gap = Math.min(...s.notes.slice(1).map((n, i) => (n - s.notes[i]) * s.beat));
    assert.ok(gap >= 0.27, `${s.style}: dots at least 0.27 s apart (${gap.toFixed(2)})`);
  }
  const verse = (s: typeof busk.SONGS.haight) => s.notes.filter(n => n < s.chorusAt).map(n => n % 4);
  assert.deepEqual([...new Set(verse(busk.SONGS.haight))].sort(), [1, 3], 'the tambourine on two and four');
  assert.deepEqual([...new Set(verse(busk.SONGS.mission))].sort(), [0.5, 1.5, 2.5, 3.5], 'the maracas on the off-beats');
});

/** Play a whole song with a policy: `offset` / `jitter` (s) around each dot, `skip` every n-th dot, `mash` a tap every n s. */
function play(style: 'haight' | 'mission', p: { offset?: number; jitter?: number; skip?: number; mash?: number; seed?: number }) {
  const gm = new busk.BuskGame(busk.SONGS[style]);
  const rnd = seeded(p.seed ?? 7);
  const taps: number[] = [];
  if (p.mash) for (let t = 0; t < gm.end; t += p.mash) taps.push(t);
  else gm.song.notes.forEach((_, i) => { if (!p.skip || i % p.skip) taps.push(gm.at(i) + (p.offset ?? 0) + (rnd() * 2 - 1) * (p.jitter ?? 0)); });
  taps.sort((a, b) => a - b);
  let k = 0;
  const ev: string[] = [];
  while (!gm.done) {
    ev.push(...gm.step(DT));
    while (k < taps.length && taps[k] <= gm.t) ev.push(...gm.tap(taps[k++]));
  }
  return { gm, ev, tier: busk.buskTier(gm.score) };
}

test('W8-M busk players: on the dot ★ 100, a steady hand (±40 ms) ★, a sloppy one (±110 ms) below ★, a late thumb (+130 ms) learnt, every third dot skipped no ★, a masher or a dozer nothing', () => {
  const rows: string[] = [];
  for (const style of ['haight', 'mission'] as const) {
    const exact = play(style, {});
    const steady = play(style, { jitter: 0.04 });
    const sloppy = play(style, { jitter: 0.11 });
    const late = play(style, { offset: 0.13, jitter: 0.02 });
    const skip = play(style, { skip: 3 });
    const mash = play(style, { mash: 0.06 });
    const doze = play(style, { mash: 1000 });
    rows.push(`${style}: exact ${exact.gm.score} steady ${steady.gm.score} sloppy ${sloppy.gm.score} late ${late.gm.score} (offset ${late.gm.judge.offset.toFixed(2)}) skip3 ${skip.gm.score} mash ${mash.gm.score} doze ${doze.gm.score}`);
    assert.equal(exact.gm.score, 100);
    assert.ok(exact.ev.includes('chorus') && exact.ev.includes('cheer') && exact.ev.includes('coin') && exact.ev.at(-1) === 'done');
    assert.equal(steady.tier, 3, `${style} steady ${steady.gm.score}`);
    assert.ok(sloppy.tier < 3 && sloppy.tier >= 1, `${style} sloppy ${sloppy.gm.score}`);
    assert.ok(late.tier >= 2, `${style} late ${late.gm.score}`);
    assert.ok(late.gm.judge.offset > 0.08, 'the late thumb was learnt');
    assert.ok(skip.tier < 3, `${style} skip ${skip.gm.score}`);
    assert.equal(mash.tier, 0, `${style} mash ${mash.gm.score}`);
    assert.equal(doze.gm.score, 0);
    assert.equal(doze.gm.missed, doze.gm.song.notes.length, 'every dot missed');
  }
  console.log('W8-M busk players:\n ' + rows.join('\n '));
});

test('W8-M busk: a whole jam through the frame systems pays medal:busk up to its tier and keeps the best; 放弃 and the stick pay nothing; Settings pauses the song', () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  busk.__resetBusk();
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  const prevMode = runtime.move.mode;
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false, paused: false } as never);
  runtime.move.mode = 'foot';
  try {
    assert.ok(busk.startBusk('mission', false));
    assert.equal(kit.currentActivity()?.spec.id, 'busk');
    assert.equal(busk.buskWithBusker(), false, 'BAYBAY plays');
    let i = 0;
    for (; i < 60 / DT && busk.buskGame(); i++) {
      stepFrameSystems(DT, i * DT);
      const gm = busk.buskGame();
      if (!gm) break;
      const k = gm.first;
      if (k < gm.song.notes.length && Math.abs(gm.at(k) - gm.t) <= DT / 2 + 1e-9) busk.buskTap();
    }
    assert.equal(busk.buskGame(), null, 'the song ended');
    for (const t of [1, 2, 3]) assert.ok(events.some(e => e.type === 'reward' && e.source === `medal:busk:${t}`), `medal ${t}`);
    assert.ok((kit.bestOf('busk') ?? 0) >= busk.BUSK_TIERS[2], `best ${kit.bestOf('busk')}`);
    // 放弃
    events.length = 0;
    assert.ok(busk.startBusk('haight'));
    for (let j = 0; j < 3 / DT; j++) stepFrameSystems(DT, 100 + j * DT);
    busk.cancelBusk();
    assert.equal(busk.buskGame(), null);
    assert.ok(!events.some(e => e.type === 'reward'));
    // the stick gives up (after the kit's grace)
    events.length = 0;
    assert.ok(busk.startBusk('haight'));
    for (let j = 0; j < 1 / DT; j++) stepFrameSystems(DT, 200 + j * DT);
    runtime.input.moveX = 1;
    stepFrameSystems(DT, 202);
    runtime.input.moveX = 0;
    assert.equal(busk.buskGame(), null, 'the stick gave up');
    assert.ok(!events.some(e => e.type === 'reward'));
    // Settings pauses the song
    assert.ok(busk.startBusk('haight'));
    for (let j = 0; j < 2 / DT; j++) stepFrameSystems(DT, 300 + j * DT);
    const t0 = busk.buskGame()!.t;
    game.set({ paused: true } as never);
    for (let j = 0; j < 2 / DT; j++) stepFrameSystems(DT, 310 + j * DT);
    assert.equal(busk.buskGame()!.t, t0);
    game.set({ paused: false } as never);
    busk.cancelBusk();
  } finally { off(); busk.__resetBusk(); kit.__resetKit(); runtime.input.moveX = 0; runtime.move.mode = prevMode; flow.set({ bubble: null } as never); game.set({ phase: prev.phase, mode: prev.mode, paused: prev.paused } as never); }
});

test('W8-M busk prompts: beside lane L’s guitarists on standable ground, clear of him, his case and his listeners; his hours are the corner’s; the verb follows them', async () => {
  const { HAIGHT_CORNER } = await import('../src/opus-bay/world/sf/landmarks/haight-ashbury');
  const { CALLE_24_CORNER } = await import('../src/opus-bay/world/sf/landmarks/calle-24');
  const T = await import('../src/opus-bay/core/terrain');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { cityDropLots } = await import('../src/opus-bay/world/sf/hero');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  for (const [spot, corner] of [[zones8.BUSK_HAIGHT, HAIGHT_CORNER], [zones8.BUSK_MISSION, CALLE_24_CORNER]] as const) {
    const w = corner.windows?.afternoon;
    assert.ok(w, 'the corner has its afternoon');
    assert.equal(spot.from, w.from, `${spot.style}: from`);
    assert.equal(spot.to, w.to, `${spot.style}: to`);
    assert.deepEqual(spot.frame, corner.frame, `${spot.style}: the corner's frame`);
    // clear of the guitarist, his case and his listeners (local frame)
    for (const s of corner.soft ?? []) assert.ok(Math.hypot(spot.local.x - s.x, spot.local.z - s.z) >= s.r + 0.6, `${spot.style}: clear of soft (${s.x}, ${s.z})`);
    for (const c of corner.crowds ?? []) for (const q of c.spots) assert.ok(Math.hypot(spot.local.x - q.x, spot.local.z - q.z) >= 0.75, `${spot.style}: clear of a listener (${q.x}, ${q.z})`);
    assert.equal(zones8.buskerOut(spot, { hour: Math.floor(spot.from / 60), minute: 0 }), true);
    assert.equal(zones8.buskerOut(spot, { hour: 9, minute: 30 }), false);
    assert.equal(zones8.buskerOut(spot, { hour: 22, minute: 0 }), false);
  }
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  const its = zones8.sf8Its();
  for (const it of its) await sf.attachAround(city, it.x, it.z, 60, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(cityDropLots(sf.manifest.heroDropLots)) });
  try {
    for (const it of its) assert.ok(T.canStand(it.x, it.z, T.STAND_RADIUS), `${it.id} standable at (${it.x}, ${it.z})`);
  } finally { T.setCityTerrain(null); }
});

test('W8-M busk: the hold list names the panel, the records row is appended, BAYBAY’s lines are fixed', () => {
  assert.ok(hold.BAYBAY_HOLD_OVERLAYS.includes(busk.BUSK_OVERLAY));
  assert.ok(zones8.SF8_OVERLAYS.includes(busk.BUSK_OVERLAY as never));
  const keys = BEST_ROWS.map(r => r.key);
  assert.ok(keys.indexOf('busk') > keys.indexOf('grip'), 'appended');
  for (const [k, l] of Object.entries(lines.BUSK_LINES)) assert.ok(l.zh && l.en && !/\$\{/.test(l.zh + l.en), k);
});

test('W8-M busk chunks: small, lazy from the set’s zones, nowhere in GameRoot', async () => {
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
  const sizes = { zones8: await size('sfgames8.ts', shared), busk: await size('busk.ts', shared), buskPanel: await size('BuskPanel.tsx', [...shared, 'busk', 'buskSounds']) };
  assert.ok(sizes.zones8 <= 2.5 * 1024, JSON.stringify(sizes));
  for (const [k, v] of Object.entries(sizes)) assert.ok(v <= 5 * 1024, `${k}: ${v} B`);
  const zsrc = fs.readFileSync(path.join(PLAY, 'sfgames8.ts'), 'utf8');
  for (const m of ['busk', 'BuskPanel']) {
    assert.match(zsrc, new RegExp(`import\\('\\./${m}'\\)`), `${m} lazily`);
    assert.doesNotMatch(zsrc, new RegExp(`from '\\./${m}'`), `${m} not static`);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'src/opus-bay/game/GameRoot.tsx'), 'utf8'), /busk/i);
  console.log('W8-M busk chunk sizes (B, gzip):', JSON.stringify(sizes));
});
