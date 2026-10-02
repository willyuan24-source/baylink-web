import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 9 · lane G · W9-G3 hide & seek (review 2026-10-01 R§5 #13; gamer-3 / x1 in C:/Users/willy/opus-qa/review-1001/
 * verify-gamer/notes.md) and W9-G4 今日小游戏 (R§6 玩法: a replay paid nothing):
 *   - from the Ferry Building plaza she hid across the Embarcadero 30 times of 30 (hsexp.mjs) → now on the player's side;
 *   - from Gate E the chip said 「金银岛附近」 while she was on Pier 14 → no offWalk / far-trip-end landmark is a clue;
 *   - a kerb stopped the player without a word → 从斑马线过去 on the chip + her line once;
 *   - the camera turned by itself during the hunt → the follow camera's assists wait;
 *   - the words flipped → the heat band holds past its edges;
 *   - time up paid nothing, showed nothing → a reveal (camera to her, her wave), the card 再试试 + where she was, and the
 *     day's first finished game pays 10 (`daily:<Bay date>:4`, inside the ledger's daily cap: no new cap, no save bit).
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
const { input } = await import('../src/opus-bay/core/input');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { __setBayNowForTests, bayParts } = await import('../src/opus-bay/game/bayNow');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const dexData = await import('../src/opus-bay/ui/playDexData');

const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const LIST = [{ id: 'mid', name: { zh: '中间', en: 'the middle' }, x: 0, z: 40 }];

test('W9-G3 the clue: no offWalk landmark (Treasure Island, Alcatraz) and no trip end far from its landmark is a hiding place', () => {
  const ids = new Set(hs.hideCandidates().map(c => c.id));
  assert.ok(!ids.has('treasure-island'), 'x1: 「她藏在金银岛附近」 while she sat on Pier 14');
  assert.ok(!ids.has('alcatraz'));
  for (const a of ATTRACTIONS) {
    if (!ids.has(a.id)) continue;
    assert.ok(!a.offWalk, a.id);
    if (a.arrival) assert.ok(Math.hypot(a.arrival.x - a.x, a.arrival.z - a.z) <= hs.NEAR_LANDMARK, a.id);
  }
  assert.ok(ids.size > 100);
});

test('W9-G3 the same side: a spot round a road is only the fallback (the shortest detour), a same-side one wins', () => {
  // two landmarks: 'across' is closer to the straight line but its route is 3× longer (a road between); 'side' is walked
  const list = [{ id: 'across', name: { zh: '对面', en: 'Across' }, x: 0, z: 30 }, { id: 'side', name: { zh: '这边', en: 'This side' }, x: 30, z: 0 }];
  const route = (_f: { x: number; z: number }, t: { x: number; z: number }) => (t.z > 15 ? Math.hypot(t.x, t.z) * 3 : Math.hypot(t.x, t.z) * 1.1);
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = hs.pickHideSpot({ x: 0, z: 0 }, { stand: () => true, reach: () => true, route, rand: seeded(seed), list })!;
    assert.equal(s.near?.id, 'side', `seed ${seed}`);
  }
  // only across a road: she still hides (the shortest detour), never nowhere
  const only = hs.pickHideSpot({ x: 0, z: 0 }, { stand: () => true, reach: () => true, route: (_f, t) => Math.hypot(t.x, t.z) * 3, rand: seeded(3), list })!;
  assert.ok(only, 'a fallback spot');
  // no route at all: nowhere (the nav does not get there)
  assert.equal(hs.pickHideSpot({ x: 0, z: 0 }, { stand: () => true, reach: () => true, route: () => null, rand: seeded(3), list }), null);
  // the threshold
  assert.equal(hs.SIDE_K, 1.35);
});

test('W9-G3 the heat band holds past its edges (no flipping at 20 u); the moment\'s word goes before it', () => {
  let b = hs.heatBand(-1, 25);
  assert.equal(b, 2);
  b = hs.heatBand(b, 19.5); // just inside 暖暖的: still 有点凉 until 18.5
  assert.equal(b, 2);
  b = hs.heatBand(b, 18.4);
  assert.equal(b, 1);
  b = hs.heatBand(b, 20.8); // back out a little: still 暖暖的 until 21.5
  assert.equal(b, 1);
  b = hs.heatBand(b, 21.6);
  assert.equal(b, 2);
  assert.equal(hs.heatBand(-1, 3), 0);
  assert.equal(hs.heatBand(0, 9), 0);
  assert.equal(hs.heatBand(0, 9.6), 1);
  assert.equal(hs.heatOfBand(3).zh, '冷冰冰');
});

function round(opts: Parameters<typeof hs.startHideSeek>[0]) {
  const p = runtime.player;
  p.x = 0; p.z = 0; p.heading = 0;
  assert.ok(hs.startHideSeek(opts));
  for (let i = 0; i < 40; i++) stepFrameSystems(0.1, i * 0.1);
}

test('W9-G3 a round: the camera keeps still while you seek; a kerb push brings 从斑马线过去 and her line once', () => {
  kit.__setBestWriter(null);
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  const opts = { stand: () => true, reach: () => true, rand: seeded(5), list: LIST };
  try {
    round(opts);
    input.lastCameraInputAt = -1e9;
    stepFrameSystems(0.1, 5);
    assert.ok(performance.now() - input.lastCameraInputAt <= 1200, 'the assists wait (idle < 1.2 s) while you seek');
    // push into a kerb: the stick held, the feet still, a road ahead
    hs.__setKerbProbe(() => true);
    runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.player.speed = 0;
    flow.set({ bubble: null });
    for (let i = 0; i < 16; i++) stepFrameSystems(0.1, 6 + i * 0.1);
    assert.deepEqual(chip.chipState()?.status, hs.CROSS_WORD);
    assert.deepEqual(flow.get().bubble?.text, hs.HIDE_LINES.crosswalk);
    flow.set({ bubble: null });
    for (let i = 0; i < 16; i++) stepFrameSystems(0.1, 8 + i * 0.1);
    assert.equal(flow.get().bubble, null, 'her line once a round');
  } finally {
    hs.__setKerbProbe(null);
    runtime.input.moveX = 0; runtime.input.moveY = 0;
    hs.stopHideSeek(); game.set({ phase: prev.phase, mode: prev.mode });
  }
});

test('W9-G3 time up: the reveal (no 放弃, the camera to her), then the card 再试试 with where she was; W9-G4 today\'s coins', async () => {
  kit.__setBestWriter(null);
  __setBayNowForTests(new Date('2026-10-03T19:00:00Z'));
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  const events: { type: string; source?: string; what?: string; tier?: number }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const entry = await import('../src/opus-bay/play/dexEntry');
  const ledger = await import('../src/opus-bay/economy/ledger');
  const offDex = entry.initDex();
  const opts = { stand: () => true, reach: () => true, rand: seeded(5), list: LIST };
  try {
    round(opts);
    for (let i = 0; i < hs.GIVE_UP_S; i++) stepFrameSystems(1, 10 + i);
    stepFrameSystems(0.1, 200);
    assert.ok(kit.currentActivity(), 'still running: the reveal');
    assert.equal(chip.chipState()?.action, undefined, 'no 放弃 during the reveal');
    assert.match(chip.chipState()?.status?.zh ?? '', /时间到/);
    assert.deepEqual(flow.get().bubble?.text, hs.HIDE_LINES.giveUp);
    for (let i = 0; i < 30; i++) stepFrameSystems(0.1, 201 + i * 0.1);
    assert.equal(kit.currentActivity(), null);
    const card = kit.lastResultShown()!;
    assert.equal(card.tier, 0);
    assert.deepEqual(card.detail, { zh: '她刚才藏在中间附近', en: 'She was hiding near the middle' });
    assert.ok(card.again);
    assert.ok(events.some(e => e.type === 'play' && e.what === 'end'));
    assert.ok(!events.some(e => e.type === 'reward' && e.source?.startsWith('medal:')), 'no medal for a time-up');
    // W9-G4: the day's first finished game pays 10 through the ledger (daily:<Bay date>:4), once a date
    const src = kit.todaySource();
    assert.equal(src, `daily:${bayParts().dateKey}:4`);
    assert.equal(src, dexData.todayGameSource(bayParts().dateKey), 'the guide reads the same source');
    assert.equal(kit.TODAY_COINS, dexData.TODAY_GAME_COINS);
    assert.ok(ledger.isPaid(src));
    assert.equal(card.today, kit.TODAY_COINS, 'the card says it');
    const c0 = ledger.coinsTotal();
    round(opts);
    hs.stopHideSeek();
    kit.startActivity({ id: 'crab', name: { zh: '捞螃蟹', en: 'Crabbing' } })!.end({ tier: 1, card: false });
    assert.equal(ledger.coinsTotal() - c0 <= 5, true, 'a second game the same day: the medal only, not today\'s again');
    // and the source fits the ledger's daily kind (bits 0–6 for :1–:7, inside REWARD_CAPS.daily)
    assert.ok(kit.TODAY_COINS <= ledger.REWARD_CAPS.daily);
    assert.match(src, /^daily:\d{4}-\d{2}-\d{2}:[1-7]$/);
  } finally {
    offDex(); off(); hs.stopHideSeek();
    __setBayNowForTests(null);
    game.set({ phase: prev.phase, mode: prev.mode });
  }
});

test('W9-G3 on the published city: from the Ferry Building plaza she hides on your side of the Embarcadero', async () => {
  const T = await import('../src/opus-bay/core/terrain');
  const nav = await import('../src/opus-bay/actors/nav');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { cityDropLots } = await import('../src/opus-bay/world/sf/hero');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  const places = [{ id: 'ferry-plaza', x: 131.5, z: 15.1 }, { id: 'gate-e', x: 157, z: -21 }];
  for (const p of places) await sf.attachAround(city, p.x, p.z, 110, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(cityDropLots(sf.manifest.heroDropLots)) });
  try {
    for (const p of places) {
      const start = T.canStand(p.x, p.z, T.STAND_RADIUS) ? p : nav.arrivalSpot(p, 10)!;
      let same = 0;
      for (const seed of [1, 3, 5, 7, 11, 13]) {
        const opts = hs.liveOpts();
        const s = hs.pickHideSpot(start, { ...opts, rand: seeded(seed) });
        assert.ok(s, `${p.id}: somewhere to hide`);
        assert.notEqual(s.near?.id, 'treasure-island', `${p.id}: never the island seen from Pier 14`);
        const len = opts.route!(start, s)!, d = Math.hypot(s.x - start.x, s.z - start.z);
        if (len <= d * hs.SIDE_K + hs.SIDE_ADD && !hs.blockedBetween(start, s)) same++;
      }
      // (the review: 30 of 30 across the road from the plaza)
      assert.equal(same, 6, `${p.id}: ${same} / 6 on the player's side`);
    }
  } finally { T.setCityTerrain(null); }
});
