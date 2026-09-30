import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

/**
 * Wave 7 · lane M · the San Francisco mini-games (play/sfgames.ts zones, play/claw.ts the Musée Mécanique's claw machine,
 * play/fortune.ts its fortune teller, …): BAYBAY's fixed lines, the claw's rules (a centred grab never slips, an empty
 * grab misses, five quarters), a whole game through the frame systems into the kit's `medal:claw:n`, 放弃 pays nothing,
 * the fortunes (a real fact and its page each), the prompts on standable ground clear of the others on the published
 * city, the records rows, and the chunks (small, lazy, outside GameRoot).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const lines = await import('../src/opus-bay/play/sfgamesLines');
const claw = await import('../src/opus-bay/play/claw');
const fortune = await import('../src/opus-bay/play/fortune');
const crab = await import('../src/opus-bay/play/crab');
const dough = await import('../src/opus-bay/play/dough');
const zones = await import('../src/opus-bay/play/sfgames');
const kit = await import('../src/opus-bay/play/kit');
const { onEvent } = await import('../src/opus-bay/core/events');
const { game } = await import('../src/opus-bay/core/store');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { BEST_ROWS } = await import('../src/opus-bay/economy/records');

const ROOT = path.resolve(import.meta.dirname, '..');
const PLAY = path.join(ROOT, 'src/opus-bay/play');
const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const always = (v: number) => () => v;

test('W7-M lines: every BAYBAY line is fixed text (zh ≤ 45, en), names for every game', () => {
  const all = { ...lines.CLAW_LINES, ...lines.CRAB_LINES, ...lines.DOUGH_LINES };
  for (const [k, l] of Object.entries({ ...lines.CLAW_LINES, ...Object.fromEntries(Object.entries(lines.CRAB_LINES).map(([a, b]) => [`crab-${a}`, b])), ...Object.fromEntries(Object.entries(lines.DOUGH_LINES).map(([a, b]) => [`dough-${a}`, b])) })) {
    assert.ok(l.zh && l.en, k);
    assert.ok([...l.zh].length <= 45, `${k}: ${l.zh}`);
    assert.doesNotMatch(l.zh + l.en, /\$\{|undefined|NaN/, k);
  }
  assert.ok(Object.keys(all).length >= 30);
  for (const n of [lines.CLAW_NAME, lines.CRAB_NAME, lines.DOUGH_NAME, lines.FORTUNE_NAME]) assert.ok(n.zh && n.en);
  for (const id of [lines.CLAW_ID, lines.CRAB_ID, lines.DOUGH_ID]) assert.match(id, kit.ACTIVITY_ID);
});

test('W7-M claw: the pile holds every souvenir once, inside the glass, clear of the chute', () => {
  for (const seed of [1, 7, 42, 99]) {
    const pile = claw.layoutPrizes(seeded(seed));
    assert.deepEqual(pile.map(p => p.kind).sort(), claw.PRIZE_KINDS.map((_, i) => i));
    for (const p of pile) {
      const half = claw.catchHalf(claw.PRIZE_KINDS[p.kind]);
      assert.ok(p.x - half >= claw.CHUTE_W - 0.5 && p.x + half <= claw.CAB_W + 0.5, `${claw.PRIZE_KINDS[p.kind].id} at ${p.x}`);
    }
  }
  const k = claw.PRIZE_KINDS[0];
  assert.equal(claw.holdChance(0, k), 1);
  assert.equal(claw.holdChance(claw.SWEET, k), 1);
  assert.ok(claw.holdChance(claw.catchHalf(k) - 0.1, k) < 0.4);
  assert.equal(claw.holdChance(claw.catchHalf(k) + 0.1, k), 0);
  assert.deepEqual([0, 1, 2, 3, 5].map(claw.clawTier), [0, 1, 2, 3, 3]);
});

/** Step a game until `phase` (or 30 s of game time). */
function runUntil(game: InstanceType<typeof claw.ClawGame>, want: string, ev: string[] = []) {
  for (let i = 0; i < 600 && game.phase !== want; i++) ev.push(...game.step(0.05));
  return ev;
}

test('W7-M claw: a centred grab never slips and lands in the chute; off-centre ones may slip; an empty grab misses; five quarters', () => {
  // the worst luck: every roll 0.999 — a centred grab still holds
  const g1 = new claw.ClawGame(always(0.999));
  const target = g1.prizes[2];
  g1.target = target.x; g1.dropOnArrive = true;
  const ev = runUntil(g1, 'aim', runUntil(g1, 'drop'));
  assert.ok(ev.includes('grab') && ev.includes('won') && !ev.includes('slip'), ev.join(','));
  assert.deepEqual(g1.won, [target.kind]);
  assert.equal(g1.tries, claw.TRIES - 1);
  // off-centre by most of its half-width, the same luck: it slips back on the pile
  const g2 = new claw.ClawGame(always(0.999));
  const p2 = g2.prizes.find(p => p.row === 0)!;
  for (const p of g2.prizes) if (p !== p2) p.won = true;
  g2.target = p2.x + claw.catchHalf(claw.PRIZE_KINDS[p2.kind]) - 0.3; g2.dropOnArrive = true;
  const ev2 = runUntil(g2, 'aim', runUntil(g2, 'drop'));
  assert.ok(ev2.includes('slip') && !ev2.includes('won'), ev2.join(','));
  // an empty spot: a miss (the nearest prize's edge is farther than it can reach)
  const g3 = new claw.ClawGame(always(0.5));
  for (const p of g3.prizes) p.x = 80;
  g3.target = 30; g3.dropOnArrive = true;
  const ev3 = runUntil(g3, 'aim', runUntil(g3, 'drop'));
  assert.ok(ev3.includes('miss'), ev3.join(','));
  // five quarters, then done; the aim clock drops by itself
  const g4 = new claw.ClawGame(always(0.5));
  const ev4: string[] = [];
  for (let i = 0; i < 5000 && g4.phase !== 'done'; i++) ev4.push(...g4.step(0.05));
  assert.equal(g4.phase, 'done');
  assert.equal(ev4.filter(e => e === 'drop').length, claw.TRIES);
});

test('W7-M claw: a whole game through the frame systems pays medal:claw up to its tier; 放弃 pays nothing', () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  try {
    assert.ok(claw.startClaw(always(0.999)));
    const gm = claw.clawGame()!;
    assert.ok(gm);
    // play like a player: aim at a souvenir's middle each try
    for (let i = 0; i < 4000 && claw.clawGame(); i++) {
      const cg = claw.clawGame()!;
      if (cg.phase === 'aim' && cg.target === null) { const p = cg.prizes.find(q => !q.won); if (p) claw.aimClaw(p.x, true); }
      stepFrameSystems(0.05, i * 0.05);
    }
    assert.equal(claw.clawGame(), null, 'the game ended');
    assert.ok(events.some(e => e.type === 'play' && e.activity === 'claw' && e.what === 'end'));
    for (const t of [1, 2, 3]) assert.ok(events.some(e => e.type === 'reward' && e.source === `medal:claw:${t}`), `medal ${t}`);
    assert.equal(kit.bestOf('claw'), claw.TRIES, 'five souvenirs in five quarters');
    assert.equal(claw.setCount(claw.clawSet()), claw.TRIES, 'the kinds won are kept');
    assert.equal(kit.lastResultShown()?.tier, 3);
    // 放弃: nothing paid, the lock and the game gone
    events.length = 0;
    assert.ok(claw.startClaw(always(0.5)));
    for (let i = 0; i < 20; i++) stepFrameSystems(0.05, 300 + i * 0.05);
    claw.cancelClaw();
    assert.equal(claw.clawGame(), null);
    assert.equal(kit.currentActivity(), null);
    assert.ok(events.some(e => e.type === 'play' && e.what === 'cancel'));
    assert.ok(!events.some(e => e.type === 'reward'));
  } finally { claw.__resetClaw(); kit.__resetKit(); off(); game.set({ phase: prev.phase, mode: prev.mode }); }
});

test('W7-M fortunes: eight cards, each a playful line and a real fact with its page; the next card each time; no medal', () => {
  assert.equal(fortune.FORTUNES.length, 8);
  for (const f of fortune.FORTUNES) {
    assert.ok(f.luck.zh && f.luck.en && f.fact.zh && f.fact.en);
    assert.match(f.source, /^https:\/\/[a-z0-9.-]+\//);
  }
  assert.equal(fortune.fortuneFor(0), fortune.FORTUNES[0]);
  assert.equal(fortune.fortuneFor(9), fortune.FORTUNES[1]);
  kit.__setBestWriter(null);
  kit.__resetKit();
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  try {
    const a = fortune.tellFortune();
    assert.ok(a);
    assert.equal(kit.currentActivity()?.spec.id, fortune.FORTUNE_ID, 'the feet held while the card is up');
    assert.equal(fortune.tellFortune(), null, 'one card at a time');
    fortune.fortuneDone();
    assert.equal(kit.currentActivity(), null);
    const b = fortune.tellFortune();
    assert.notEqual(a, b, 'the next card');
    fortune.fortuneDone();
    assert.ok(!events.some(e => e.type === 'reward'), 'a keepsake: nothing paid');
  } finally { kit.__resetKit(); off(); game.set({ phase: prev.phase, mode: prev.mode }); }
});

test('W7-M crab rules: a Dungeness always goes back, a rock crab stays from 4 inches; no rock crab within ¼ inch of the line', () => {
  assert.equal(crab.mustRelease({ kind: 'dungeness', size: 6.5 }), true);
  assert.equal(crab.mustRelease({ kind: 'rock', size: 3.9 }), true);
  assert.equal(crab.mustRelease({ kind: 'rock', size: 4 }), false);
  let dung = 0, rock = 0;
  for (let seed = 1; seed < 60; seed++) for (const c of crab.crabWave(seeded(seed))) {
    if (c.kind === 'rock') { rock++; assert.ok(Math.abs(c.size - crab.MIN_ROCK) >= 0.25 && c.size >= 2.5 && c.size <= 5.6, `rock ${c.size}`); }
    else { dung++; assert.ok(c.size >= 4.5 && c.size <= 7.1, `dungeness ${c.size}`); }
  }
  assert.ok(dung > 60 && rock > 150, `${dung} Dungeness, ${rock} rock`);
});

/** Play a whole crabbing game with a policy: haul when `pull(g)`, hold all the way; calls right (or every other wrong). */
function crabPlay(seed: number, pull: (g: InstanceType<typeof crab.CrabGame>) => boolean, opts: { wrongEvery?: number; stallAt?: number } = {}) {
  const g = new crab.CrabGame(seeded(seed));
  let calls = 0;
  for (let i = 0; i < 6000 && g.phase !== 'done'; i++) {
    if (g.phase === 'ready') g.drop();
    if (g.phase === 'soak' && pull(g)) g.hold(true);
    // a haul that stops and starts: let go for a moment low down
    if (opts.stallAt !== undefined && g.phase === 'pull') g.hold(!(g.depth > 0.62 && g.depth < opts.stallAt));
    if (g.phase === 'measure') { const c = g.caught[g.measuring]; const wrong = !!opts.wrongEvery && calls++ % opts.wrongEvery === 0; g.call(wrong ? !crab.mustRelease(c) : crab.mustRelease(c)); continue; }
    g.step(0.05);
  }
  return g;
}

test('W7-M crabbing: patience and the right calls win (★ often), hauling too early or too late lands nothing, a stalled haul loses crabs', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i * 7 + 3);
  const tiers = (f: (s: number) => number) => [0, 1, 2, 3].map(t => seeds.filter(s => crab.crabTier(f(s)) === t).length);
  const patient = tiers(s => crabPlay(s, g => g.eating >= 3 || g.soak >= 11).score);
  assert.ok(patient[3] >= 12 && patient[0] === 0, `patient: ${patient}`);
  assert.deepEqual(tiers(s => crabPlay(s, g => g.soak >= 2).score), [40, 0, 0, 0], 'too early');
  assert.deepEqual(tiers(s => crabPlay(s, g => g.soak >= crab.BAIT_S + 3).score), [40, 0, 0, 0], 'too late');
  const wrong = seeds.map(s => crabPlay(s, g => g.eating >= 3 || g.soak >= 11, { wrongEvery: 2 }).score);
  assert.ok(wrong.every(x => crab.crabTier(x) < 3), 'half the calls wrong: never ★');
  const steady = seeds.reduce((n, s) => n + crabPlay(s, g => g.eating >= 3 || g.soak >= 11).escaped, 0);
  const stalled = seeds.reduce((n, s) => n + crabPlay(s, g => g.eating >= 3 || g.soak >= 11, { stallAt: 0.95 }).escaped, 0);
  assert.ok(stalled > steady * 2, `escapes: steady ${steady}, stalled ${stalled}`);
});

test('W7-M crabbing: a whole game through the frame systems pays medal:crab; 放弃 pays nothing', () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  try {
    assert.ok(crab.startCrab(seeded(17)));
    for (let i = 0; i < 8000 && crab.crabGame(); i++) {
      const g = crab.crabGame()!;
      if (g.phase === 'ready') crab.crabDrop();
      else if (g.phase === 'soak' && (g.eating >= 3 || g.soak >= 11)) crab.setCrabHold(true);
      else if (g.phase === 'measure') { crab.setCrabHold(false); crab.crabCall(crab.mustRelease(g.caught[g.measuring])); continue; }
      stepFrameSystems(0.05, i * 0.05);
    }
    assert.equal(crab.crabGame(), null, 'the game ended');
    const end = events.find(e => e.type === 'play' && e.activity === 'crab' && e.what === 'end');
    assert.ok(end);
    const best = kit.bestOf('crab')!;
    assert.ok(best >= crab.CRAB_TIERS[0], `best ${best}`);
    for (let t = 1; t <= crab.crabTier(best); t++) assert.ok(events.some(e => e.type === 'reward' && e.source === `medal:crab:${t}`), `medal ${t}`);
    // 放弃
    events.length = 0;
    assert.ok(crab.startCrab(seeded(3)));
    crab.crabDrop();
    for (let i = 0; i < 20; i++) stepFrameSystems(0.05, 900 + i * 0.05);
    crab.cancelCrab();
    assert.equal(crab.crabGame(), null);
    assert.equal(kit.currentActivity(), null);
    assert.ok(!events.some(e => e.type === 'reward'));
  } finally { crab.__resetCrab(); kit.__resetKit(); off(); game.set({ phase: prev.phase, mode: prev.mode }); }
});

/** Play the sourdough: knead taps `off` s from each beat, cuts `cutOff` from each guide, out of the oven at `crust`. */
function doughPlay(off: number, cutOff: number, crust: number, shape: 'boule' | 'crab' | 'turtle' = 'crab') {
  const g = new dough.DoughGame();
  const dt = 0.01;
  for (let i = 0; i < 20000 && g.phase !== 'done'; i++) {
    if (g.phase === 'knead' && g.beat < dough.BEATS && g.t >= g.beatAt(g.beat) + off - 1e-9) g.tap();
    else if (g.phase === 'shape') g.pick(shape);
    else if (g.phase === 'score') { const gd = dough.GUIDES[g.cuts.length]; if (gd !== undefined && Math.abs(g.blade - (gd + cutOff)) < 0.006) g.tap(); }
    else if (g.phase === 'bake' && g.crust >= crust) g.tap();
    g.step(dt);
  }
  return g;
}

test('W7-M sourdough: a precise baker gets ★, a sloppy one ◆ or ●, untouched it still ends (the oven burns it), the parts add up', () => {
  const best = doughPlay(0, 0, (dough.GOLD_LO + dough.GOLD_HI) / 2);
  assert.equal(best.phase, 'done');
  assert.equal(best.shape, 'crab');
  assert.ok(best.knead === 40 && best.scoring >= 27 && best.baked >= 29, `${best.knead} ${best.scoring} ${best.baked}`);
  assert.equal(dough.doughTier(best.score), 3);
  const ok = doughPlay(0.15, 0.06, dough.GOLD_HI + 0.03);
  assert.ok(ok.score >= dough.DOUGH_TIERS[0] && ok.score < dough.DOUGH_TIERS[2], `sloppy ${ok.score} (${ok.knead} ${ok.scoring} ${ok.baked})`);
  // nothing pressed at all: every beat a miss, the blade cuts by itself, the oven burns it — it ends, 再试试
  const g = new dough.DoughGame();
  for (let i = 0; i < 20000 && g.phase !== 'done'; i++) { if (g.phase === 'shape') g.pick('boule'); g.step(0.02); }
  assert.equal(g.phase, 'done');
  assert.equal(g.hits.filter(h => h === 'miss').length, dough.BEATS);
  assert.equal(g.crust, 1);
  assert.equal(dough.doughTier(g.score), 0, `idle ${g.score}`);
  assert.equal(best.score, best.knead + best.scoring + best.baked);
  // the parts' scales
  assert.equal(dough.bakePoints((dough.GOLD_LO + dough.GOLD_HI) / 2), 30);
  assert.equal(dough.bakePoints(0), 0);
  assert.equal(dough.bakePoints(1), 0);
  assert.equal(dough.cutPoints(0), 10);
  assert.equal(dough.cutPoints(dough.CUT_GOOD + 0.01), 0);
  // a tap far from any beat is ignored (no penalty for nerves)
  const n = new dough.DoughGame();
  n.step(0.3); n.tap();
  assert.equal(n.hits.length, 0);
});

test('W7-M sourdough: a whole game through the frame systems pays medal:sourdough; 放弃 pays nothing', () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  try {
    assert.ok(dough.startDough());
    for (let i = 0; i < 20000; i++) {
      const g = dough.doughGame();
      if (!g || g.phase === 'done') break;
      if (g.phase === 'knead' && g.beat < dough.BEATS && Math.abs(g.t - g.beatAt(g.beat)) < 0.006) dough.doughTap();
      else if (g.phase === 'shape') dough.doughPick('turtle');
      else if (g.phase === 'score') { const gd = dough.GUIDES[g.cuts.length]; if (gd !== undefined && Math.abs(g.blade - gd) < 0.006) dough.doughTap(); }
      else if (g.phase === 'bake' && g.crust >= 0.635) dough.doughTap();
      stepFrameSystems(0.004, i * 0.004);
    }
    assert.equal(dough.doughGame()?.phase, 'done');
    dough.__finishNow();
    assert.equal(dough.doughGame(), null);
    for (const t of [1, 2, 3]) assert.ok(events.some(e => e.type === 'reward' && e.source === `medal:sourdough:${t}`), `medal ${t}`);
    assert.ok((kit.bestOf('sourdough') ?? 0) >= dough.DOUGH_TIERS[2]);
    events.length = 0;
    assert.ok(dough.startDough());
    for (let i = 0; i < 30; i++) stepFrameSystems(0.05, 500 + i * 0.05);
    dough.cancelDough();
    assert.equal(dough.doughGame(), null);
    assert.equal(kit.currentActivity(), null);
    assert.ok(!events.some(e => e.type === 'reward'));
  } finally { dough.__resetDough(); kit.__resetKit(); off(); game.set({ phase: prev.phase, mode: prev.mode }); }
});

test('W7-M zones: BAYBAY invites at a game once; never again for a game already played this visit (her invite followed the sourdough card)', async () => {
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  kit.__resetKit();
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false, worldMode: 'city' } as never);
  const off = zones.initSfGames();
  const p = runtime.player, g = runtime.guide;
  const at = (s: { x: number; z: number }, t: number) => {
    p.x = s.x; p.z = s.z + 1; g.x = s.x + 2; g.z = s.z + 1;
    flow.set({ bubble: null, cinematic: null } as never);
    for (let i = 0; i < 6; i++) stepFrameSystems(0.25, t + i * 0.25);
  };
  try {
    // a game not played yet: her invite at the rail
    at(zones.CRAB_SPOT, 1000);
    assert.equal(flow.get().bubble?.text.zh, lines.CRAB_LINES.invite.zh, 'the crab invite');
    // the sourdough played (and given up) first: no invite at the bakery afterwards
    const run = kit.startActivity({ id: lines.DOUGH_ID, name: lines.DOUGH_NAME });
    stepFrameSystems(0.25, 2000);
    run?.cancel();
    at(zones.DOUGH_SPOT, 2001);
    assert.notEqual(flow.get().bubble?.text.zh, lines.DOUGH_LINES.invite.zh, 'no sourdough invite after playing it');
  } finally { off(); kit.__resetKit(); flow.set({ bubble: null } as never); game.set({ phase: prev.phase, mode: prev.mode, worldMode: prev.worldMode } as never); }
});

test('W7-M records: the games’ bests are appended rows (claw, crab, sourdough), after the older ones', () => {
  const keys = BEST_ROWS.map(r => r.key);
  for (const k of ['claw', 'crab', 'sourdough']) assert.ok(keys.includes(k), k);
  assert.ok(keys.indexOf('claw') > keys.indexOf('bell'), 'appended');
});

test('W7-M the prompts: on standable ground on the published city, each clear of the others and of the Laughing Sal egg', async () => {
  const T = await import('../src/opus-bay/core/terrain');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { cityDropLots } = await import('../src/opus-bay/world/sf/hero');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { eggById } = await import('../src/opus-bay/eggs/registry');
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  const its = zones.sfGameIts();
  for (const it of its) await sf.attachAround(city, it.x, it.z, 60, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(cityDropLots(sf.manifest.heroDropLots)) });
  try {
    const sal = eggById('musee-laughing-lady')!;
    for (const it of its) {
      assert.ok(T.canStand(it.x, it.z, T.STAND_RADIUS), `${it.id} standable`);
      assert.ok(Math.hypot(it.x - sal.at.x, it.z - sal.at.z) >= it.radius + 3, `${it.id} clear of Laughing Sal`);
      // the Wharf's own card (sf:fishermans-wharf, r 4, checked in the game 2026-09-29)
      assert.ok(Math.hypot(it.x + 198.5, it.z - 76.6) >= it.radius + 4, `${it.id} clear of the Wharf card`);
      for (const o of its) if (o !== it) assert.ok(Math.hypot(it.x - o.x, it.z - o.z) >= it.radius + o.radius - 0.2, `${it.id} vs ${o.id}`);
    }
  } finally { T.setCityTerrain(null); }
});

test('W7-M the chunks: small, loaded lazily from the zones, nowhere in GameRoot', async () => {
  const { build } = await import('esbuild');
  const size = async (file: string, shared: string[]) => {
    const own = new Set(shared.map(n => path.join(PLAY, `${n}.ts`)));
    const r = await build({
      entryPoints: [path.join(PLAY, file)], bundle: true, write: false, minify: true, format: 'esm', target: 'es2022', logLevel: 'silent', jsx: 'automatic',
      loader: { '.css': 'empty' },
      plugins: [{ name: 'own', setup(b) { b.onResolve({ filter: /.*/ }, a => { if (a.kind === 'entry-point') return undefined; if (a.path.endsWith('.css') || a.kind === 'dynamic-import') return { path: a.path, external: true }; const base = path.resolve(a.resolveDir, a.path); const hit = [`${base}.ts`, `${base}.tsx`].find(f => fs.existsSync(f)); return !a.path.startsWith('.') || !hit || !hit.startsWith(PLAY) || own.has(hit) ? { path: a.path, external: true } : { path: hit }; }); } }],
    });
    return zlib.gzipSync(r.outputFiles[0].contents).length;
  };
  const shared = ['kit', 'chip', 'partc', 'puppet', 'zones', 'sfgamesLines', 'sfgamesSounds'];
  const sizes = {
    zones: await size('sfgames.ts', shared), claw: await size('claw.ts', shared), clawPanel: await size('ClawPanel.tsx', [...shared, 'claw']),
    fortune: await size('fortune.ts', shared), fortunePanel: await size('FortunePanel.tsx', [...shared, 'fortune']),
    crab: await size('crab.ts', shared), crabPanel: await size('CrabPanel.tsx', [...shared, 'crab']), props: await size('sfgamesProps.ts', [...shared, 'toyMesh']),
    dough: await size('dough.ts', shared), doughPanel: await size('DoughPanel.tsx', [...shared, 'dough']),
  };
  assert.ok(sizes.zones <= 2.5 * 1024, JSON.stringify(sizes));
  for (const [k, v] of Object.entries(sizes)) assert.ok(v <= 5 * 1024, `${k}: ${v} B`);
  const z3 = fs.readFileSync(path.join(PLAY, 'zones3.ts'), 'utf8');
  assert.match(z3, /import\('\.\/sfgames'\)/, 'the zones load lazily');
  assert.doesNotMatch(z3, /from '\.\/sfgames'/);
  const zsrc = fs.readFileSync(path.join(PLAY, 'sfgames.ts'), 'utf8');
  for (const m of ['claw', 'ClawPanel', 'fortune', 'FortunePanel', 'crab', 'CrabPanel', 'dough', 'DoughPanel', 'sfgamesProps']) {
    assert.match(zsrc, new RegExp(`import\\('\\./${m}'\\)`), `${m} lazily`);
    assert.doesNotMatch(zsrc, new RegExp(`from '\\./${m}'`), `${m} not static`);
  }
  const root = fs.readFileSync(path.join(ROOT, 'src/opus-bay/game/GameRoot.tsx'), 'utf8');
  assert.doesNotMatch(root, /sfgames|claw|fortune|crab|dough|sourdough/i);
  console.log('lane M chunk sizes (B, gzip):', JSON.stringify(sizes));
});

test('W7-M-review sourdough: the loaf out of the oven, a push of the stick in the beat before its card still pays the medals and shows the card (while it bakes the stick still gives up)', async () => {
  const { runtime } = await import('../src/opus-bay/core/runtime');
  kit.__setBestWriter(null);
  kit.__resetKit();
  const events: { type: string; source?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  const input = runtime.input;
  try {
    assert.ok(dough.startDough());
    for (let i = 0; i < 20000; i++) {
      const g = dough.doughGame();
      if (!g || g.phase === 'done') break;
      if (g.phase === 'knead' && g.beat < dough.BEATS && Math.abs(g.t - g.beatAt(g.beat)) < 0.006) dough.doughTap();
      else if (g.phase === 'shape') dough.doughPick('crab');
      else if (g.phase === 'score') { const gd = dough.GUIDES[g.cuts.length]; if (gd !== undefined && Math.abs(g.blade - gd) < 0.006) dough.doughTap(); }
      else if (g.phase === 'bake' && g.crust >= 0.635) dough.doughTap();
      stepFrameSystems(0.004, 3000 + i * 0.004);
    }
    assert.equal(dough.doughGame()?.phase, 'done');
    // 出炉！ — the game looks over, so the thumb goes back to the stick before the card (it comes 1.4 s later)
    input.moveX = 1;
    for (let i = 0; i < 20; i++) stepFrameSystems(0.05, 3100 + i * 0.05);
    await new Promise(r => setTimeout(r, 1700));
    assert.equal(dough.doughGame(), null);
    for (const t of [1, 2, 3]) assert.ok(events.some(e => e.type === 'reward' && e.source === `medal:sourdough:${t}`), `medal ${t} paid after the stick`);
    assert.equal(kit.lastResultShown()?.activity, 'sourdough', 'the card shows');
    // mid-game the stick still gives up at no cost (the kit's rule, after its grace)
    input.moveX = 0;
    kit.__resetKit();
    events.length = 0;
    assert.ok(dough.startDough());
    for (let i = 0; i < 20; i++) stepFrameSystems(0.05, 3200 + i * 0.05);
    assert.ok(dough.doughGame());
    input.moveX = 1;
    for (let i = 0; i < 4; i++) stepFrameSystems(0.05, 3300 + i * 0.05);
    assert.equal(dough.doughGame(), null, 'given up');
    assert.equal(kit.currentActivity(), null);
    assert.ok(!events.some(e => e.type === 'reward'));
  } finally { input.moveX = 0; dough.__resetDough(); kit.__resetKit(); off(); game.set({ phase: prev.phase, mode: prev.mode }); }
});
