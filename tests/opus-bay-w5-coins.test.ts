import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · lane E · W5-E2 / W5-E3: the coin spots (economy/coinSpots.ts, placed by scripts/opus-sf/coins-place.mts) and
 * the coins in the world (economy/coins.ts, economy/coinMesh.ts).
 *
 * - The registry is APPEND-ONLY: the W5-E2 order is pinned below (a new trail, cache or ring goes at the end).
 * - Every spot is checked against the published city with the placement script's own rules: standable, not water,
 *   reachable on foot from the Ferry gate's network, clear of the card prompts (caches 6.5 u, trail coins 3.5 u),
 *   3 u between coins; every air coin between the glide's soft floor (+ 1.5 u) and 250; downtown flags match the zones;
 *   and (the mid-wave checkpoint's CP-5) lane F's walk sweep verdicts on every ground spot: never BOXED, SNAG or
 *   UNREACHABLE for the real controller and the game's path finder.
 * - The live set: pickup radii, air coins only while gliding, trails back on the next Bay day, caches and rings once,
 *   downtown held, ≤ 32 instances drawn, a `reward` per coin (the ledger pays it), the chime ladder, the 48-triangle disc.
 */

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const spots = await import('../src/opus-bay/economy/coinSpots');
const { COIN_TRAILS, COIN_CACHES, COIN_RINGS, SLOT_COINS, trailCoinIds, ringCoinIds, cacheIds } = spots;
const { MAX_PLAY_BITS } = await import('../src/opus-bay/data/playSave');
const { onEvent } = await import('../src/opus-bay/core/events');
const save = await import('../src/opus-bay/data/save');
const L = await import('../src/opus-bay/economy/ledger');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const C = await import('../src/opus-bay/economy/coins');

const W5E2_TRAILS = ['filbert-steps', 'lyon-street-steps', 'tiled-steps', 'hidden-garden-steps', 'macondray-lane', 'ina-coolbrith', 'lombard-steps', 'twin-peaks', 'bernal-summit', 'mount-davidson', 'corona-heights', 'buena-vista-park', 'alta-plaza', 'lafayette-park', 'dolores-park', 'sutro-heights', 'mclaren-park', 'glen-canyon', 'mount-sutro', 'pier-39', 'municipal-pier', 'pier-7', 'pier-14', 'wave-organ-jetty', 'crane-cove', 'herons-head', 'blue-heron-lake', 'lands-end-trail', 'crissy-promenade', 'marina-green', 'tunnel-tops', 'conservatory-lawn', 'hippie-hill', 'alamo-square', 'stern-grove', 'lake-merced', 'dutch-windmill', 'ocean-beach', 'sunset-dunes', 'fort-funston', 'india-basin', 'visitacion-greenway', 'mountain-lake', 'baker-beach', 'candlestick', 'bison-paddock', 'koret-playground', 'yerba-buena', 'stop-palace', 'stop-ggb', 'stop-haight', 'stop-painted-ladies', 'stop-castro', 'stop-mission-dolores', 'stop-la-playa', 'stop-west-portal', 'stop-sf-state', 'stop-carl-cole', 'stop-9th-irving', 'stop-duboce-park'];
const W5E2_CACHES = ['grand-view-top', 'corona-top', 'bernal-top', 'davidson-top', 'buena-vista-top', 'mclaren-top', 'strawberry-hill', 'sutro-heights-top', 'mount-sutro-top', 'pier-39-end', 'municipal-pier-end', 'lands-end-overlook', 'fort-mason-meadow', 'crane-cove-end', 'herons-head-tip', 'fort-point-wharf', 'candlestick-point', 'sutro-baths-ruins', 'seward-slides-top', 'china-beach', 'baker-beach-north', 'murphy-windmill', 'lake-merced-nook', 'stern-grove-nook', 'glen-canyon-nook', 'fort-funston-top', 'palace-lagoon', 'mountain-lake-nook', 'presidio-nook', 'india-basin', 'balmy-alley', 'clarion-alley', 'irving-street', 'clement-street', 'calle-24', 'third-street', 'noe-valley', 'japantown', 'palace-rotunda', 'painted-ladies-roof'];
const W5E2_RINGS = ['first-flight', 'coit', 'transamerica', 'salesforce', 'ferry-clock', 'sutro-tower', 'painted-ladies', 'city-hall', 'ggb-south-tower', 'ggb-mid-span', 'palace-of-fine-arts', 'alcatraz', 'de-young-tower', 'lombard', 'twin-peaks', 'st-ignatius'];

// appended in part c (CP-5: the retired Ina Coolbrith trail's replacement; lane L's corner caches)
const PARTC_TRAILS = ['fort-mason-meadow'];
const PARTC_CACHES = ['castro', 'haight'];

test('W5-E2 registry: append-only (the W5-E2 order is a prefix), ids unique and well formed, the ledger bits fit', () => {
  assert.deepEqual(COIN_TRAILS.slice(0, W5E2_TRAILS.length + PARTC_TRAILS.length).map(t => t.id), [...W5E2_TRAILS, ...PARTC_TRAILS]);
  assert.deepEqual(COIN_CACHES.slice(0, W5E2_CACHES.length + PARTC_CACHES.length).map(c => c.id), [...W5E2_CACHES, ...PARTC_CACHES]);
  assert.ok(COIN_TRAILS.find(t => t.id === 'ina-coolbrith')?.retired, 'CP-5: Ina Coolbrith keeps its slot, retired');
  assert.deepEqual(COIN_RINGS.slice(0, W5E2_RINGS.length).map(r => r.id), W5E2_RINGS);
  for (const list of [COIN_TRAILS, COIN_CACHES, COIN_RINGS]) {
    assert.equal(new Set(list.map(e => e.id)).size, list.length, 'unique ids');
    for (const e of list) assert.match(e.id, /^[a-z0-9-]{1,30}$/, e.id);
  }
  assert.equal(trailCoinIds().length, COIN_TRAILS.length * SLOT_COINS);
  assert.equal(ringCoinIds().length, COIN_RINGS.length * SLOT_COINS);
  assert.deepEqual(cacheIds(), COIN_CACHES.map(c => c.id));
  for (const n of [trailCoinIds().length, ringCoinIds().length, cacheIds().length]) assert.ok(n <= MAX_PLAY_BITS);
  // every source the coins pay is a well-formed reward source of ≤ 40 characters (so play.e could hold one too)
  for (const s of [...trailCoinIds().map(i => `trail:${i}`), ...ringCoinIds().map(i => `ring:${i}`), ...cacheIds().map(i => `cache:${i}`)]) {
    assert.ok(s.length <= 40 && /^(trail|ring|cache):[a-z0-9:@-]{1,80}$/.test(s), s);
  }
  assert.ok(COIN_RINGS[0].reserved, 'ring slot 0 is lane A\'s first flight');
});

test('W5-E2 counts: ≈ 60 trails of 5–8 coins, 42 caches, 15 rings of 8 (plan §3.4); downtown held only where flagged', () => {
  const live = COIN_TRAILS.filter(t => !t.retired);
  assert.ok(live.length >= 55, `${live.length} trails`);
  for (const t of live) {
    assert.equal(t.p.length % 3, 0);
    const n = t.p.length / 3;
    assert.ok(n >= 5 && n <= SLOT_COINS, `${t.id}: ${n} coins`);
  }
  const coins = live.reduce((s, t) => s + t.p.length / 3, 0);
  assert.ok(coins >= 330 && coins <= 480, `${coins} trail coins`);
  assert.equal(COIN_CACHES.filter(c => !c.retired).length, 42, '40 + lane L\'s two corner caches');
  assert.equal(COIN_RINGS.filter(r => !r.retired && !r.reserved).length, 15);
  const items = C.coinItems(false), all = C.coinItems(true);
  assert.ok(all.length > items.length, 'downtown coins exist and are held');
  assert.ok(items.every(i => !i.source.startsWith('ring:transamerica') && !i.source.startsWith('trail:pier-14')), 'held: the Transamerica ring and Pier 14');
  assert.equal(C.DOWNTOWN_OPEN, false, 'until lane V publishes the downtown headroom (plan MF9 / D15)');
});

test('W5-E2 every spot stands in the published city: standable, dry, reachable, clear of the cards; air coins fly', async () => {
  const P = await import('../scripts/opus-sf/coins-place.mts');
  const ctx = await P.loadCity();
  const bad: string[] = [];
  try {
    const ground: { id: string; x: number; z: number }[] = [];
    for (const t of COIN_TRAILS) {
      if (t.retired) continue;
      for (let i = 0; i < t.p.length / 3; i++) {
        const x = t.p[3 * i], z = t.p[3 * i + 2];
        await ctx.ensure(x, z);
        const pr = [...P.spotProblems(ctx, x, z, P.RULES.trailPromptClear), ...await P.walkProblems(ctx, x, z)];
        if (pr.length) bad.push(`trail ${t.id} #${i + 1} (${x}, ${z}): ${pr.join(', ')}`);
        if ((P.DOWNTOWN_ZONES as readonly string[]).includes(ctx.zoneOf(x, z) ?? '') && !t.dt) bad.push(`trail ${t.id}: downtown but not flagged`);
        ground.push({ id: `${t.id}#${i + 1}`, x, z });
      }
    }
    for (const c of COIN_CACHES) {
      if (c.retired) continue;
      await ctx.ensure(c.x, c.z);
      const pr = c.air ? P.airProblems(ctx, [c]) : [...P.spotProblems(ctx, c.x, c.z), ...await P.walkProblems(ctx, c.x, c.z, P.RULES.walkDirsCache)];
      if (pr.length) bad.push(`cache ${c.id}: ${pr.join(', ')}`);
      if (!c.air) for (const q of ground) if (Math.hypot(q.x - c.x, q.z - c.z) < P.RULES.cacheGap) bad.push(`cache ${c.id}: ${Math.hypot(q.x - c.x, q.z - c.z).toFixed(1)} u from trail coin ${q.id}`);
      if (!c.air) ground.push({ id: c.id, x: c.x, z: c.z });
    }
    for (let a = 0; a < ground.length; a++) for (let b = a + 1; b < ground.length; b++) {
      if (Math.hypot(ground[a].x - ground[b].x, ground[a].z - ground[b].z) < P.RULES.coinGap - 0.05) bad.push(`${ground[a].id} and ${ground[b].id} < ${P.RULES.coinGap} u apart`);
    }
    for (const r of COIN_RINGS) {
      if (r.retired || r.reserved) continue;
      await ctx.ensure(r.x, r.z, 40);
      const pr = P.airProblems(ctx, C.ringCoinPositions(r));
      if (pr.length) bad.push(`ring ${r.id}: ${pr.join(', ')}`);
      assert.deepEqual(C.ringCoinPositions(r), P.ringCoins(r), 'the game and the script build the same ring');
    }
  } finally { ctx.done(); }
  assert.deepEqual(bad, []);
});

// --- the live set -------------------------------------------------------------------------------------------------

function fresh(date = '2026-10-03T10:30') {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  __setBayNowForTests(date);
}

const foot = (x: number, y: number, z: number): import('../src/opus-bay/economy/coins').Picker => ({ x, y, z, mode: 'foot', low: true });

test('W5-E3 pickup: foot / ride / glide radii; air coins only while gliding; one reward each, paid by the ledger', () => {
  fresh();
  const offLedger = L.initLedger();
  const rewards: string[] = [];
  const offEv = onEvent(e => { if (e.type === 'reward') rewards.push(e.source); });
  try {
    for (const [p, list] of [['trail', trailCoinIds()], ['cache', cacheIds()], ['ring', ringCoinIds()]] as const) L.registerRewardIds(p, list);
    const w = new C.CoinWorld(C.coinItems());
    const iTrail = w.items.findIndex(c => c.source === 'trail:twin-peaks:1');
    const t = w.items[iTrail], next = w.items[iTrail + 1];
    // step away from the trail's next coin (they are ≥ 3 u apart)
    const ax = t.x - next.x, az = t.z - next.z, al = Math.hypot(ax, az), ux = ax / al, uz = az / al;
    assert.deepEqual(w.step(foot(t.x + ux * 1.5, t.y, t.z + uz * 1.5), 0), [], '1.5 u away on foot: not yet');
    assert.deepEqual(w.step({ ...foot(t.x, t.y + 3, t.z) }, 10), [], 'on a deck 3 u above: no');
    assert.deepEqual(w.step({ x: t.x + ux * 1.8, y: t.y, z: t.z + uz * 1.8, mode: 'ride', low: true }, 20), [iTrail], 'the bike reaches 2 u');
    assert.equal(L.coinsTotal(), 1);
    assert.equal(w.isTaken(iTrail), true);
    assert.deepEqual(w.step(foot(t.x, t.y, t.z), 30), [], 'taken');
    // a cache: 10 coins, a find
    const finds: string[] = [];
    const offFind = onEvent(e => { if (e.type === 'find') finds.push(`${e.kind}:${e.id}:${e.first}`); });
    const iCache = w.items.findIndex(c => c.source === 'cache:bernal-top');
    const c = w.items[iCache];
    w.step(foot(c.x + 0.5, c.y, c.z), 40);
    offFind();
    assert.equal(L.coinsTotal(), 11);
    assert.deepEqual(finds, ['cache:bernal-top:true']);
    // a ring: nothing on foot under it; flying through the middle takes all eight
    const ring = spots.COIN_RINGS.find(r => r.id === 'coit')!;
    const ringItems = w.items.map((it, i) => [it, i] as const).filter(([it]) => it.source.startsWith('ring:coit:'));
    assert.equal(ringItems.length, 8);
    assert.deepEqual(w.step(foot(ring.x, ring.y, ring.z), 50), [], 'no air coin on foot');
    const got = w.step({ x: ring.x, y: ring.y, z: ring.z, mode: 'glide', low: false }, 60);
    assert.deepEqual(got.sort((a, b) => a - b), ringItems.map(([, i]) => i).sort((a, b) => a - b), 'through the middle: all eight');
    assert.equal(L.coinsTotal(), 19);
    // gliding high over a trail coin: nothing; low: the magnet
    const t2 = w.items.findIndex(cc => cc.source === 'trail:twin-peaks:2');
    assert.deepEqual(w.step({ x: w.items[t2].x, y: w.items[t2].y + 12, z: w.items[t2].z, mode: 'glide', low: false }, 70), []);
    assert.deepEqual(w.step({ x: w.items[t2].x, y: w.items[t2].y + 4, z: w.items[t2].z, mode: 'glide', low: true }, 80), [t2]);
    assert.equal(rewards.filter(s => s === 'trail:twin-peaks:1').length, 1, 'one reward per coin');
    assert.ok(w.popping.length > 0, 'the pops play');
  } finally { offEv(); offLedger(); }
});

test('W5-E3 trails come back on the next Bay day; caches and rings stay taken; a reset brings everything back', () => {
  fresh('2026-10-03T21:00');
  const offLedger = L.initLedger();
  try {
    for (const [p, list] of [['trail', trailCoinIds()], ['cache', cacheIds()], ['ring', ringCoinIds()]] as const) L.registerRewardIds(p, list);
    const w = new C.CoinWorld(C.coinItems());
    const off = L.subscribeLedger(() => w.markDirty());
    const it = (s: string) => w.items.findIndex(c => c.source === s);
    const tr = it('trail:dolores-park:2'), ca = it('cache:clarion-alley');
    for (const i of [tr, ca]) w.step(foot(w.items[i].x, w.items[i].y, w.items[i].z), 0);
    assert.ok(w.isTaken(tr) && w.isTaken(ca));
    __setBayNowForTests('2026-10-04T06:00');
    w.step(null, 1000);
    assert.equal(w.isTaken(tr), false, 'a new Bay day: the trail coin is back');
    assert.equal(w.isTaken(ca), true, 'the cache stays found');
    save.clearSave();
    w.step(null, 2000);
    assert.equal(w.isTaken(ca), false, 'Settings → reset progress: the cache is back');
    off();
  } finally { offLedger(); }
});

test('W5-E3 the draw list: nearest first, ≤ 32 instances (a cache counts 5), nothing taken, farther when gliding', () => {
  fresh();
  L.registerRewardIds('trail', trailCoinIds());
  const w = new C.CoinWorld(C.coinItems());
  const at = w.items.find(c => c.source === 'trail:blue-heron-lake:1')!;
  w.updateVisible(at.x, at.z, false, 0);
  assert.ok(w.visible.length > 0);
  assert.ok(w.stats.instances <= C.MAX_DRAWN);
  const d = (i: number) => Math.hypot(w.items[i].x - at.x, w.items[i].z - at.z);
  for (let k = 1; k < w.visible.length; k++) assert.ok(d(w.visible[k]) >= d(w.visible[k - 1]) - 1e-9, 'sorted by distance');
  assert.ok(w.visible.every(i => d(i) <= C.VIEW_R.foot));
  const n = w.stats.instances;
  w.updateVisible(at.x, at.z, true, 1000);
  assert.ok(w.stats.instances >= n && w.stats.instances <= C.MAX_DRAWN, 'gliding looks farther');
  // a crowded synthetic spot never draws more than 32 instances
  const crowd = new C.CoinWorld(Array.from({ length: 50 }, (_, i) => ({ source: `cache:crowd-${i}`, kind: i % 2 ? 'cache' as const : 'trail' as const, entry: 'x', x: i * 0.5, y: 0, z: 0, air: false, yaw: 0, coins: 1 })));
  crowd.updateVisible(0, 0, false, 0);
  assert.ok(crowd.stats.instances <= C.MAX_DRAWN && crowd.stats.instances >= C.MAX_DRAWN - C.CACHE_STACK, `${crowd.stats.instances}`);
});

test('W5-E3 the disc is 48 triangles on the TOY_INST program; the chime climbs a pentatonic ladder', async () => {
  const mesh = await import('../src/opus-bay/economy/coinMesh');
  const geo = mesh.coinGeometry();
  assert.equal(geo.index!.count / 3, 48);
  for (const a of ['position', 'normal', 'color', 'aInfo']) assert.ok(geo.getAttribute(a), a);
  const mat = mesh.coinMaterial();
  assert.equal(mat.customProgramCacheKey(), 'ob-toy-inst', 'the warmed TOY_INST program');
  assert.equal(mat.vertexColors, true);
  assert.deepEqual([...C.LADDER], [0, 2, 4, 7, 9, 12, 14, 16]);
  assert.ok(C.MAX_DRAWN * 48 <= 1536, '≤ 1.5k triangles (plan §3.4)');
});
