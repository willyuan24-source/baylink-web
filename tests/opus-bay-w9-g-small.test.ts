import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 9 · lane G · W9-G5 the small games (review 2026-10-01 R§6 玩法与收集; w8 NEXT #9 / #11):
 *   - the claw dropped by itself after 12 s with no word → its rule in one line on the panel and a blinking 3, 2, 1 over
 *     the glass in the aim's last 3 s (ClawGame.countdown);
 *   - the claw's result was too cold for a child → each souvenir won pops up big over the glass, BAYBAY cheers at the end
 *     and the card shows the souvenirs big (a snapshot, 保存照片);
 *   - the grip's live number was the 0–100 share and fell from 100 to 14 at the first miss → the panel shows the points
 *     gathered so far (GripGame.livePoints: a miss adds nothing, never takes), the 0–100 score waits for the card;
 *   - the foghorn's prompt was not found in ten steps round the fort → its reach 1.5 → 3 u;
 *   - a game started while its panel's chunk was still loading (the claw's 12 s ran on unseen) → each SF game's prompt
 *     loads the game and its panel together before it starts.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const drawn: string[] = [];
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : (...a: unknown[]) => { drawn.push(String(k)); void a; }),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, toDataURL: () => 'data:image/png;base64,AAAA' }) };

const claw = await import('../src/opus-bay/play/claw');
const grip = await import('../src/opus-bay/play/grip');
const zones8 = await import('../src/opus-bay/play/sfgames8');
const kit = await import('../src/opus-bay/play/kit');
const { setCharApi } = await import('../src/opus-bay/actors/charApi');
const TD = await import('../src/opus-bay/data/transit');
const { CableSystem } = await import('../src/opus-bay/world/transitLine');
const { game } = await import('../src/opus-bay/core/store');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');

const ROOT = path.resolve(import.meta.dirname, '..');
const PLAY = path.join(ROOT, 'src/opus-bay/play');
const read = (f: string) => fs.readFileSync(path.join(PLAY, f), 'utf8');
const always = (v: number) => () => v;

test('W9-G5 the claw: a blinking 3, 2, 1 in the aim\'s last 3 s (none before, none once it drops); the rule on the panel', () => {
  const cg = new claw.ClawGame(always(0.5));
  const seen: number[] = [];
  let firstAt = -1;
  for (let i = 0; i < 400 && cg.phase === 'aim'; i++) {
    const n = cg.countdown;
    if (n && firstAt < 0) firstAt = claw.AIM_SECONDS - cg.aimLeft;
    if (seen[seen.length - 1] !== n) seen.push(n);
    cg.step(0.05);
  }
  assert.deepEqual(seen, [0, 3, 2, 1], `the count: ${seen.join(',')}`);
  assert.ok(Math.abs(firstAt - (claw.AIM_SECONDS - claw.COUNT_FROM)) < 0.06, `it starts 3 s before the drop (${firstAt.toFixed(2)} s in)`);
  assert.equal(cg.phase, 'drop', 'then the claw drops by itself');
  assert.equal(cg.countdown, 0, 'no count while it drops');
  const src = read('ClawPanel.tsx');
  assert.match(src, /g\.countdown/, 'the panel draws the game\'s count');
  assert.match(src, /className="ob-sfg-rule"/, 'the rule line is on the panel');
  assert.match(src, /时间到会自己落爪/, 'it says the claw drops by itself');
  assert.match(read('sfgames.css'), /\.ob-sfg-count\.is-on \{[^}]*animation/, 'the count blinks');
});

test('W9-G5 the claw\'s result: BAYBAY cheers, the card shows the souvenirs big (保存照片); nothing won: no cheer, no picture', () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  const emotes: string[] = [];
  setCharApi({ emote: (_who: string, name: string) => { emotes.push(name); } } as never);
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  try {
    assert.ok(claw.startClaw(always(0.999)));
    for (let i = 0; i < 4000 && claw.clawGame(); i++) {
      const cg = claw.clawGame()!;
      if (cg.phase === 'aim' && cg.target === null) { const p = cg.prizes.find(q => !q.won); if (p) claw.aimClaw(p.x, true); }
      stepFrameSystems(0.05, i * 0.05);
    }
    assert.equal(claw.clawGame(), null, 'the game ended');
    const card = kit.lastResultShown();
    assert.ok(card?.tier, 'a medal');
    assert.ok(card?.photo?.url.startsWith('data:image'), 'the souvenirs on the card');
    assert.equal(typeof card?.photo?.save, 'function', '保存照片');
    assert.ok(emotes.includes('cheer'), `BAYBAY cheers (${emotes.join(',')})`);
    // a game that wins nothing: the claw always misses (prizes slip at chance 0)
    kit.__resetKit();
    emotes.length = 0;
    assert.ok(claw.startClaw(always(0)));
    for (let i = 0; i < 4000 && claw.clawGame(); i++) stepFrameSystems(0.05, 500 + i * 0.05);
    assert.equal(claw.clawGame(), null);
    const none = kit.lastResultShown();
    if (none?.tier === 0) {
      assert.equal(none.photo, undefined, 'no picture of nothing');
      assert.ok(!emotes.includes('cheer'), 'no cheer for nothing');
    }
  } finally { claw.__resetClaw(); kit.__resetKit(); setCharApi(null); game.set({ phase: prev.phase, mode: prev.mode }); }
  assert.equal(claw.prizeSnapshot([]), null, 'nothing won: no snapshot');
  drawn.length = 0;
  assert.ok(claw.prizeSnapshot([0, 3])?.startsWith('data:image'));
  assert.ok(drawn.length > 10, 'the souvenirs are drawn');
});

const FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = TD.buildTransit(FILE);
const DT = 1 / 30;

test('W9-G5 the grip\'s live number: the points so far never drop at a miss (the 0–100 share fell 100 → 14 at the first alarm)', () => {
  // a rider who holds the cable all the way: every let-go stretch is an alarm (the review's first miss)
  const sys = new CableSystem(DATA);
  assert.ok(sys.request({ line: 'powell-hyde', station: 'powell-market', dir: 1, to: 'hyde-beach' }));
  let boarded = false;
  for (let i = 0; i < 240 / DT && !boarded; i++) { sys.step(DT); if (sys.rideStatus()?.phase === 'here') { sys.board(); boarded = true; } }
  assert.ok(boarded);
  for (let i = 0; i < 20 / DT && sys.rideStatus()?.phase !== 'riding'; i++) sys.step(DT);
  const car = sys.cars[sys.rideStatus()!.car];
  const view = () => ({ s: car.s, dir: car.dir, v: car.v, mode: car.mode });
  const gg = new grip.GripGame(car.line, view(), car.line.stops.find(x => x.station === 'hyde-beach')!.at);
  let shareDrop = 0, prevShare = gg.score, prevLive = gg.livePoints, liveDrop = 0, alarms = 0;
  const live: number[] = [prevLive];
  for (let i = 0; i < 200 / DT && !gg.done; i++) {
    sys.step(DT);
    const phase = sys.rideStatus()?.phase;
    // hold the lever except where the hint says to wait, ring each bell as it lights
    if (gg.bellNow) gg.ring();
    const ev = gg.step(DT, phase === 'riding' || phase === 'arrived' ? view() : null, gg.want !== 'wait');
    alarms += ev.filter(e => e === 'alarm').length;
    shareDrop = Math.max(shareDrop, prevShare - gg.score); prevShare = gg.score;
    liveDrop = Math.max(liveDrop, prevLive - gg.livePoints); prevLive = gg.livePoints;
    if (live[live.length - 1] !== gg.livePoints) live.push(gg.livePoints);
  }
  assert.ok(alarms >= 1, 'the cable held through a red stretch');
  assert.ok(shareDrop >= 15, `the old live number (the 0–100 share) fell by ${shareDrop} in one frame`);
  assert.equal(liveDrop, 0, `the points so far never drop (${live.join(' → ')})`);
  assert.ok(gg.livePoints > 0 && gg.livePoints === Math.round(gg.pts), 'the bells and the take-offs still count');
  const panel = read('GripPanel.tsx');
  assert.match(panel, /textContent = String\(gg\.livePoints\)/, 'the panel shows the points so far each frame');
  assert.ok(!/textContent = String\(gg\.score\)/.test(panel), 'not the 0–100 share');
});

test('W9-G5 the foghorn\'s prompt reaches 3 u (was 1.5: not found in ten steps round the fort)', () => {
  assert.equal(zones8.FOG_SPOT.r, 3);
  assert.equal(zones8.fogIt.radius, 3);
});

test('W9-G5 (w8 NEXT #11) every SF game\'s prompt loads its panel\'s chunk with the game before it starts', () => {
  const pairs: [string, string, string][] = [
    ['sfgames.ts', 'claw', 'ClawPanel'], ['sfgames.ts', 'fortune', 'FortunePanel'], ['sfgames.ts', 'crab', 'CrabPanel'],
    ['sfgames.ts', 'dough', 'DoughPanel'], ['sfgames8.ts', 'busk', 'BuskPanel'], ['sfgames8.ts', 'foghorn', 'FogPanel'],
    ['GripPad.tsx', 'grip', 'GripPanel'],
  ];
  for (const [file, gameMod, panel] of pairs) {
    assert.ok(fs.existsSync(path.join(PLAY, `${panel}.tsx`)), `${panel}.tsx exists`);
    const src = read(file);
    const re = new RegExp(`Promise\\.all\\(\\[importRetry\\(\\(\\) => import\\('\\./${gameMod}'\\)\\), importRetry\\(\\(\\) => import\\('\\./${panel}'\\)\\)\\]\\)`);
    assert.match(src, re, `${file}: ${gameMod} waits for ${panel}`);
    assert.ok(!new RegExp(`importRetry\\(\\(\\) => import\\('\\./${gameMod}'\\)\\)\\.then`).test(src), `${file}: no start of ${gameMod} before its panel`);
  }
});

test('W9-G5 (w8 NEXT #9) a phone on its side: the six SF game panels lay out in two columns, the picture on the left', () => {
  const css = read('sfgames.css');
  const block = css.slice(css.indexOf('@media (max-height: 560px) and (min-width: 600px)'));
  assert.ok(block.length > 100, 'the landscape block');
  assert.match(block, /display: grid; grid-template-columns:/);
  for (const k of ['is-claw', 'is-crab', 'is-dough', 'is-fortune', 'is-busk', 'is-fog']) assert.ok(block.includes(`.${k}`), k);
  assert.match(read('sfgames8.css'), /max-height/, 'the grip keeps its own landscape rules (sfgames8.css)');
});
