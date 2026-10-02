import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

/**
 * Wave 8 · lane M · the cable-car grip (play/grip.ts, play/GripPanel.tsx, play/sfgames8.ts): BAYBAY's fixed lines, the
 * let-go stretches / bells / stops read from the published Powell lines, players of every kind on lane F's real
 * CableSystem stepped in node (the game only reads the ridden car: it never moves it), a whole game through the frame
 * systems into the kit's `medal:grip:n`, 放弃 and a too-short ride pay nothing, the pad's visibility, the hold list, the
 * records row and the chunks (small, lazy, outside GameRoot).
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const TD = await import('../src/opus-bay/data/transit');
const { CableSystem } = await import('../src/opus-bay/world/transitLine');
const grip = await import('../src/opus-bay/play/grip');
const lines = await import('../src/opus-bay/play/sfgames8Lines');
const zones8 = await import('../src/opus-bay/play/sfgames8');
const kit = await import('../src/opus-bay/play/kit');
const hold = await import('../src/opus-bay/game/baybayHold');
const { onEvent } = await import('../src/opus-bay/core/events');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { BEST_ROWS } = await import('../src/opus-bay/economy/records');

const ROOT = path.resolve(import.meta.dirname, '..');
const PLAY = path.join(ROOT, 'src/opus-bay/play');
const FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = TD.buildTransit(FILE);
const DT = 1 / 30;
const line = (id: string) => DATA.lines.find(l => l.id === id)!;

test('W8-M grip lines: every BAYBAY line is fixed text (zh ≤ 45, en), the names and ids', () => {
  const all: [string, { zh: string; en: string }][] = [
    ...Object.entries(lines.GRIP_LINES).map(([k, v]) => [`grip-${k}`, v] as [string, { zh: string; en: string }]),
    ...Object.entries(lines.BUSK_LINES).map(([k, v]) => [`busk-${k}`, v] as [string, { zh: string; en: string }]),
    ...Object.entries(lines.FOG_LINES).map(([k, v]) => [`fog-${k}`, v] as [string, { zh: string; en: string }]),
  ];
  for (const [k, l] of all) {
    assert.ok(l.zh && l.en, k);
    assert.ok([...l.zh].length <= 45, `${k}: ${l.zh}`);
    assert.doesNotMatch(l.zh + l.en, /\$\{|undefined|NaN|\{\w+\}/, k);
  }
  for (const n of [lines.GRIP_NAME, lines.BUSK_NAME, lines.FOG_NAME]) assert.ok(n.zh && n.en);
  for (const id of [lines.GRIP_ID, lines.BUSK_ID, lines.FOG_ID]) assert.match(id, kit.ACTIVITY_ID);
});

test('W8-M grip marks: on both Powell lines both ways, a let-go stretch round the California crossing, corners, a bell at the crossing, the dwell stops', () => {
  for (const id of grip.GRIP_LINES_OK) {
    const l = line(id);
    assert.ok(l.crossings.length >= 1, `${id} crosses the California line`);
    const cross = l.crossings[0].at;
    for (const dir of [1, -1] as const) {
      const m = grip.gripMarks(l, dir, dir > 0 ? 0 : l.length, dir > 0 ? l.length : 0);
      const z = m.zones.find(q => q.kind === 'cross');
      assert.ok(z, `${id} ${dir}: a crossing stretch`);
      const lo = Math.min(z.a, z.b), hi = Math.max(z.a, z.b);
      assert.ok(lo < cross && cross < hi, `${id} ${dir}: the stretch covers the crossing (${lo}…${hi} vs ${cross})`);
      assert.ok(m.zones.some(q => q.kind === 'corner'), `${id} ${dir}: a corner`);
      assert.ok(m.bells.some(b => b.cross && Math.abs(b.at - cross) < 0.5), `${id} ${dir}: a bell at the crossing`);
      assert.ok(m.stops.length >= 5, `${id} ${dir}: dwell stops`);
      // in travel order, never overlapping
      for (let i = 1; i < m.zones.length; i++) assert.ok((m.zones[i].a - m.zones[i - 1].b) * dir > 0, `${id} ${dir}: zones in order`);
    }
  }
  // not a corner: the ends (turntable stubs)
  for (const [lo, hi] of grip.lineCorners(line('powell-hyde'))) assert.ok(lo >= grip.END_SKIP && hi <= line('powell-hyde').length - grip.END_SKIP + grip.CORNER_SPAN);
});

type Policy = 'perfect' | 'human' | 'always' | 'never' | 'nobell';

/**
 * A ride on lane F's real CableSystem (a fresh, deterministic system: the rider asks at `from`, boards when the car is
 * there), the game fed with the ridden car's view each frame as play/grip.ts liveCar() reads it, the lever worked by a
 * policy: perfect = what the hint says one frame late; human = the hint 0.3 s late; always / never = the lever held /
 * never touched; nobell = perfect but never ringing.
 */
function rideAndPlay(lineId: string, from: string, dir: 1 | -1, to: string, policy: Policy) {
  const sys = new CableSystem(DATA);
  const st = sys.request({ line: lineId, station: from, dir, to });
  assert.ok(st, 'a car is sent');
  let boarded = false;
  for (let i = 0; i < 240 / DT && !boarded; i++) {
    sys.step(DT);
    if (sys.rideStatus()?.phase === 'here') { sys.board(); boarded = true; }
  }
  assert.ok(boarded, `${lineId}: the car came to ${from}`);
  for (let i = 0; i < 20 / DT && sys.rideStatus()?.phase !== 'riding'; i++) sys.step(DT);
  const car = sys.cars[sys.rideStatus()!.car];
  const l = car.line;
  const toAt = l.stops.find(x => x.station === to)!.at;
  const view = () => ({ s: car.s, dir: car.dir, v: car.v, mode: car.mode });
  const game8 = new grip.GripGame(l, view(), toAt);
  const delay = policy === 'human' ? Math.round(0.3 / DT) : 1;
  const wants: string[] = [];
  const bells: boolean[] = [];
  const ev: string[] = [];
  const before = { s: car.s, dir: car.dir };
  for (let i = 0; i < 200 / DT && !game8.done; i++) {
    sys.step(DT);
    const phase = sys.rideStatus()?.phase;
    wants.push(game8.want);
    bells.push(game8.bellNow);
    const k = Math.max(0, wants.length - 1 - delay);
    const lever = policy === 'always' ? true : policy === 'never' ? false : wants[k] === 'grip';
    // a tap as the bell lights up (a player taps the glowing bell once)
    if ((policy === 'perfect' || policy === 'human') && bells[k] && (k === 0 || !bells[k - 1])) ev.push(...game8.ring());
    ev.push(...game8.step(DT, phase === 'riding' || phase === 'arrived' ? view() : null, lever));
  }
  assert.equal(car.dir, before.dir, 'the game never turned the car');
  return { game: game8, ev, tier: grip.gripTier(game8.score) };
}

// (southbound from a mid stop: a fresh node system without the game's view / service options never brings a car round
// the Hyde & Beach or Taylor & Bay turntable to a rider waiting there; the game's own rides do — played in the game)
const RIDES: [string, string, 1 | -1, string][] = [
  ['powell-hyde', 'powell-market', 1, 'hyde-beach'],
  ['powell-hyde', 'hyde-union', -1, 'powell-market'],
  ['powell-hyde', 'jackson-leavenworth', -1, 'powell-market'],
  ['powell-mason', 'powell-market', 1, 'taylor-bay'],
  ['powell-mason', 'mason-vallejo', -1, 'powell-market'],
  ['powell-hyde', 'powell-pine', 1, 'hyde-beach'],
];

test('W8-M grip on the real cars: a player who follows the hint gets ★, one 0.3 s late ◆ or better; holding all the way or never touching it earns no medal', () => {
  const table: string[] = [];
  let nobellMax = 0;
  for (const [id, from, dir, to] of RIDES) {
    const perfect = rideAndPlay(id, from, dir, to, 'perfect');
    const human = rideAndPlay(id, from, dir, to, 'human');
    const always = rideAndPlay(id, from, dir, to, 'always');
    const never = rideAndPlay(id, from, dir, to, 'never');
    const nobell = rideAndPlay(id, from, dir, to, 'nobell');
    if (process.env.GRIP_DEBUG) console.log(id, from, perfect.ev.filter(e => !e.startsWith('cue')).join(','), '| human', human.ev.filter(e => !e.startsWith('cue')).join(','));
    table.push(`${id} ${from}→${to}: perfect ${perfect.game.score} (${perfect.game.pts}/${perfect.game.max}) human ${human.game.score} always ${always.game.score} never ${never.game.score} nobell ${nobell.game.score}`);
    assert.equal(perfect.tier, 3, `${id} ${from}: perfect ${perfect.game.score} ${perfect.ev.filter(e => !e.startsWith('cue')).join(',')}`);
    assert.ok(human.tier >= 2, `${id} ${from}: human ${human.game.score} ${human.ev.filter(e => !e.startsWith('cue')).join(',')}`);
    assert.equal(always.tier, 0, `${id} ${from}: always ${always.game.score}`);
    assert.equal(never.tier, 0, `${id} ${from}: never ${never.game.score}`);
    nobellMax = Math.max(nobellMax, nobell.game.score);
    assert.ok(perfect.game.max >= 40, `${id} ${from}: enough judged moments in a minute (${perfect.game.max})`);
    assert.ok(perfect.ev.includes('letgo-ok') && !perfect.ev.includes('alarm'), `${id} ${from}: a let-go, no alarm`);
  }
  assert.ok(nobellMax < grip.GRIP_TIERS[2], `never ringing is never ★ (${nobellMax})`);
  console.log('W8-M grip on the real cars:\n ' + table.join('\n '));
});

test('W8-M grip (bug: the let-go clock ran on at a stop): a red stretch right after a dwell stop is a fair let-go when the lever was held on the way in', () => {
  // southbound on the Powell–Hyde: the car dwells at Powell & Sacramento (4 s or more), and the crossing's red begins
  // a few units on — the lever was last held before braking into Sacramento
  const l = line('powell-hyde');
  const crossAt = l.crossings[0].at;
  const sac = l.stops.find(s => s.station === 'powell-sacramento')!;
  assert.ok(sac.dwell && sac.at > crossAt && sac.at - crossAt < grip.CROSS_BEFORE + grip.RELEASE_LEAD, 'Sacramento is a dwell stop just north of the crossing');
  const g8 = new grip.GripGame(l, { s: sac.at + 60, dir: -1, v: 9, mode: 'run' }, 0);
  let s = sac.at + 60;
  // run at 9 u/s holding, let go 14 u before Sacramento, brake in, dwell 6 s, pull away (the lever off: red ahead)
  while (s > sac.at + 14) { s -= 9 * DT; g8.step(DT, { s, dir: -1, v: 9, mode: 'run' }, true); }
  let v = 9;
  const ev: string[] = [];
  while (s > sac.at + 0.05) { v = Math.max(0.5, v - 3 * DT); s -= v * DT; ev.push(...g8.step(DT, { s, dir: -1, v, mode: 'run' }, false)); }
  for (let i = 0; i < 6 / DT; i++) ev.push(...g8.step(DT, { s: sac.at, dir: -1, v: 0, mode: 'dwell' }, false));
  assert.ok(ev.includes('stop-ok'), ev.join(','));
  v = 0;
  while (s > crossAt) { v = Math.min(9, v + 3 * DT); s -= v * DT; ev.push(...g8.step(DT, { s, dir: -1, v, mode: 'run' }, false)); }
  assert.ok(ev.includes('letgo-ok'), `the crossing's let-go counts: ${ev.join(',')}`);
  assert.ok(!ev.includes('letgo-idle') && !ev.includes('go-late'), ev.join(','));
});

test('W8-M grip: the hint says let go before the red, not inside it', () => {
  const l = line('powell-hyde');
  const g8 = new grip.GripGame(l, { s: 60, dir: 1, v: 9, mode: 'run' }, l.length);
  const z = g8.zones[0];
  g8.step(DT, { s: z.a - grip.RELEASE_LEAD - 2, dir: 1, v: 9, mode: 'run' }, true);
  assert.notEqual(g8.want, 'release');
  g8.step(DT, { s: z.a - grip.RELEASE_LEAD + 1, dir: 1, v: 9, mode: 'run' }, true);
  assert.equal(g8.want, 'release');
});

/** A fake ridden car for the run through the frame systems (the kit, the card, the medals). */
function fakeRide(lineId: string, startS: number, dir: 1 | -1, seconds: number) {
  const l = line(lineId);
  const car = { s: startS, dir, v: 9, mode: 'run' as const };
  let left = seconds;
  return {
    car,
    step(dt: number) { left -= dt; car.s += dir * car.v * dt; },
    source: () => (left > 0 ? { view: { ...car }, line: l, to: dir > 0 ? l.length : 0 } : null),
  };
}

test('W8-M grip: a whole game through the frame systems pays medal:grip up to its tier and keeps the best; 放弃 and a too-short ride pay nothing', () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  grip.__resetGrip();
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', photoMode: false, paused: false } as never);
  try {
    // a minute on the Powell–Hyde from Powell & Market, worked by the hint
    const ride = fakeRide('powell-hyde', 30, 1, 120);
    assert.ok(grip.startGrip(ride.source));
    assert.ok(grip.gripRunning());
    assert.equal(kit.currentActivity()?.spec.id, 'grip');
    for (let i = 0; i < 70 / DT && grip.gripGame(); i++) {
      const gg = grip.gripGame()!;
      grip.setGripHold(gg.want === 'grip');
      if (gg.bellNow) grip.gripBell();
      ride.step(DT);
      stepFrameSystems(DT, i * DT);
    }
    assert.equal(grip.gripGame(), null, 'the game ended after its minute');
    assert.ok(events.some(e => e.type === 'play' && e.activity === 'grip' && e.what === 'end'));
    const best = kit.bestOf('grip')!;
    assert.ok(best >= grip.GRIP_TIERS[2], `best ${best}`);
    for (const t of [1, 2, 3]) assert.ok(events.some(e => e.type === 'reward' && e.source === `medal:grip:${t}`), `medal ${t}`);
    // 放弃: nothing paid
    events.length = 0;
    const ride2 = fakeRide('powell-mason', 30, 1, 120);
    assert.ok(grip.startGrip(ride2.source));
    for (let i = 0; i < 5 / DT; i++) { ride2.step(DT); stepFrameSystems(DT, 100 + i * DT); }
    grip.cancelGrip();
    assert.equal(grip.gripGame(), null);
    assert.ok(!events.some(e => e.type === 'reward'), 'nothing paid on 放弃');
    assert.ok(events.some(e => e.type === 'play' && e.what === 'cancel'));
    // a ride that ends after 8 s: no card, nothing paid, BAYBAY says why
    events.length = 0;
    const ride3 = fakeRide('powell-mason', 30, 1, 8);
    assert.ok(grip.startGrip(ride3.source));
    for (let i = 0; i < 12 / DT && grip.gripGame(); i++) { grip.setGripHold(true); ride3.step(DT); stepFrameSystems(DT, 200 + i * DT); }
    assert.equal(grip.gripGame(), null);
    assert.ok(!events.some(e => e.type === 'reward' || (e.type === 'play' && e.what === 'end')), 'no card for 8 s');
    assert.equal(flow.get().bubble?.text.zh, lines.GRIP_LINES.short.zh);
    // not on a Powell car: no game
    assert.equal(grip.startGrip(() => null), false);
  } finally { off(); grip.__resetGrip(); kit.__resetKit(); flow.set({ bubble: null } as never); game.set({ phase: prev.phase, mode: prev.mode, paused: prev.paused } as never); }
});

test('W8-M grip: Settings pauses the game clock with the ride', () => {
  kit.__resetKit();
  grip.__resetGrip();
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', paused: false } as never);
  try {
    const ride = fakeRide('powell-hyde', 30, 1, 120);
    assert.ok(grip.startGrip(ride.source));
    for (let i = 0; i < 2 / DT; i++) stepFrameSystems(DT, i * DT);
    const t0 = grip.gripGame()!.t;
    game.set({ paused: true } as never);
    for (let i = 0; i < 3 / DT; i++) stepFrameSystems(DT, 10 + i * DT);
    assert.equal(grip.gripGame()!.t, t0);
  } finally { grip.__resetGrip(); kit.__resetKit(); game.set({ phase: prev.phase, mode: prev.mode, paused: prev.paused } as never); }
});

test('W8-M grip pad: only on a Powell car under way, never on the California line, gone while the panel is up; the panel holds BAYBAY', () => {
  assert.equal(zones8.gripPadVisible({ stage: 'riding', from: 'powell-market', to: 'hyde-beach', line: 'powell-hyde', kind: 'cable-car' } as never), true);
  assert.equal(zones8.gripPadVisible({ stage: 'riding', from: 'powell-market', to: 'taylor-bay', line: 'powell-mason', kind: 'cable-car' } as never), true);
  assert.equal(zones8.gripPadVisible({ stage: 'waiting', from: 'powell-market', to: 'hyde-beach', line: 'powell-hyde', kind: 'cable-car' } as never), false);
  assert.equal(zones8.gripPadVisible({ stage: 'riding', from: 'california-drumm', to: 'van-ness', line: 'california', kind: 'cable-car' } as never), false);
  assert.ok(hold.BAYBAY_HOLD_OVERLAYS.includes(grip.GRIP_OVERLAY), 'lane K’s hold list names the grip panel');
  assert.ok(zones8.SF8_OVERLAYS.every(id => hold.BAYBAY_HOLD_OVERLAYS.includes(id)), 'every panel of the set holds BAYBAY');
});

test('W8-M records: the grip’s best is an appended row', () => {
  const keys = BEST_ROWS.map(r => r.key);
  assert.ok(keys.includes('grip'));
  assert.ok(keys.indexOf('grip') > keys.indexOf('sourdough'), 'appended after wave 7’s rows');
});

/** gzip size of a play module with the shared modules external (as the W7-M chunk test). */
async function chunkSize(file: string, shared: string[]) {
  const { build } = await import('esbuild');
  const own = new Set(shared.map(n => [path.join(PLAY, `${n}.ts`), path.join(PLAY, `${n}.tsx`)]).flat());
  const r = await build({
    entryPoints: [path.join(PLAY, file)], bundle: true, write: false, minify: true, format: 'esm', target: 'es2022', logLevel: 'silent', jsx: 'automatic',
    loader: { '.css': 'empty' },
    plugins: [{ name: 'own', setup(b) { b.onResolve({ filter: /.*/ }, a => { if (a.kind === 'entry-point') return undefined; if (a.path.endsWith('.css') || a.kind === 'dynamic-import') return { path: a.path, external: true }; const base = path.resolve(a.resolveDir, a.path); const hit = [`${base}.ts`, `${base}.tsx`].find(f => fs.existsSync(f)); return !a.path.startsWith('.') || !hit || !hit.startsWith(PLAY) || own.has(hit) ? { path: a.path, external: true } : { path: hit }; }); } }],
  });
  return zlib.gzipSync(r.outputFiles[0].contents).length;
}

test('W8-M grip chunks: small, loaded lazily (zones3 → sfgames8 → grip / its panel / its pad), nowhere in GameRoot', async () => {
  const shared = ['kit', 'chip', 'partc', 'puppet', 'zones', 'sfgames8Lines', 'sfgames8Sounds'];
  const sizes = {
    zones8: await chunkSize('sfgames8.ts', shared), grip: await chunkSize('grip.ts', shared),
    gripPanel: await chunkSize('GripPanel.tsx', [...shared, 'grip']), gripPad: await chunkSize('GripPad.tsx', shared),
    lines: await chunkSize('sfgames8Lines.ts', []), sounds: await chunkSize('sfgames8Sounds.ts', []),
  };
  assert.ok(sizes.zones8 <= 2.5 * 1024, JSON.stringify(sizes));
  for (const [k, v] of Object.entries(sizes)) assert.ok(v <= 5 * 1024, `${k}: ${v} B`);
  const z3 = fs.readFileSync(path.join(PLAY, 'zones3.ts'), 'utf8');
  assert.match(z3, /import\('\.\/sfgames8'\)/, 'the set loads lazily');
  assert.doesNotMatch(z3, /from '\.\/sfgames8'/);
  const zsrc = fs.readFileSync(path.join(PLAY, 'sfgames8.ts'), 'utf8');
  for (const m of ['grip', 'GripPanel', 'GripPad']) {
    assert.match(zsrc, new RegExp(`import\\('\\./${m}'\\)`), `${m} lazily`);
    assert.doesNotMatch(zsrc, new RegExp(`from '\\./${m}'`), `${m} not static`);
  }
  const root = fs.readFileSync(path.join(ROOT, 'src/opus-bay/game/GameRoot.tsx'), 'utf8');
  assert.doesNotMatch(root, /sfgames8|grip/i);
  // the ride code is read, never written: no transit module imports the game
  for (const f of ['data/transit.ts', 'world/transitLine.ts', 'game/transit.ts', 'game/ride.ts']) {
    const src = fs.readFileSync(path.join(ROOT, 'src/opus-bay', f), 'utf8');
    assert.doesNotMatch(src, /play\/grip|sfgames8/, f);
  }
  console.log('W8-M grip chunk sizes (B, gzip):', JSON.stringify(sizes));
});
