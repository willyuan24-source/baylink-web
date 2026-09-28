import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 5 · lane D, part c (W5-D6 should): 城市之声 (twelve city sounds heard where and when they happen), BAYBAY's
// pebbles and the second batch of eggs — the registries, the gates, and the finds played on the real host code with
// lane E's real ledger.

// --- headless canvas stub (world modules create label atlases at import time; same as the other egg tests) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const zhLen = (s: string) => [...s].length;
const hasZh = (s: string) => /[一-鿿]/.test(s);
const bilingual = (b: { zh: string; en: string }, where: string) => {
  assert.ok(b.zh.trim() && b.en.trim(), `${where}: both languages`);
  assert.ok(hasZh(b.zh), `${where}: zh has Chinese`);
  assert.ok(!hasZh(b.en), `${where}: en has no Chinese`);
};
const sourced = (sources: readonly { url: string; verifiedAt: string }[], where: string) => {
  assert.ok(sources.length >= 1, `${where}: a source`);
  for (const s of sources) {
    assert.match(s.url, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//, `${where}: https source`);
    assert.ok(s.verifiedAt >= '2026-09-27' && s.verifiedAt <= '2026-12-31', `${where}: checked during wave 5`);
  }
};

const { REWARD_SOURCE, rewardPrefix, onEvent } = await import('../src/opus-bay/core/events');
type GameEvent = import('../src/opus-bay/core/events').GameEvent;
const { MAX_PLAY_BITS } = await import('../src/opus-bay/data/playSave');
const { EGG_AREAS, ALL_EGG_IDS } = await import('../src/opus-bay/eggs/registry');
const CS = await import('../src/opus-bay/eggs/citySounds');
const { EGG_SOUNDS } = await import('../src/opus-bay/eggs/sounds');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { registerHooks } = await import('node:module');
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { makeHosts } = await import('../src/opus-bay/eggs/index');
const { FactCard, ListenRing } = await import('../src/opus-bay/eggs/FactCard');
styles.deregister();
const H = await import('../src/opus-bay/eggs/hosts');
const L = await import('../src/opus-bay/eggs/listen');
const marina = await import('../src/opus-bay/eggs/marina');
const park = await import('../src/opus-bay/eggs/park');
const gates = await import('../src/opus-bay/eggs/gates');
const { cardEntry } = await import('../src/opus-bay/eggs/cards');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const slots = await import('../src/opus-bay/ui/slots');
const ledger = await import('../src/opus-bay/economy/ledger');
const { clearSave } = await import('../src/opus-bay/data/save');
const { KARL } = await import('../src/opus-bay/world/fogShader');
const { KARL_TIME } = await import('../src/opus-bay/world/sf/fog');
const { lockHeld } = await import('../src/opus-bay/game/playerLock');
const { cinemaActive, skipCinema } = await import('../src/opus-bay/game/cinema');

/** Step the hosts like the frame system for `seconds`. */
const run = (seconds: number, each?: (t: number) => void) => { for (let t = 0; t < seconds; t += 1 / 30) { each?.(t); H.stepHosts(1 / 30); } };

/** The shared set-up: a clean save, the ledger and the id lists, the card overlays, playing on foot, Bay time `spec`. */
function world(t: import('node:test').TestContext, spec: string) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'find' || e.type === 'reward') events.push(e); });
  const phase = game.get().phase, tod = game.get().timeOfDay;
  const lvl = KARL.uKarl.value, a = KARL.uKarlA.value.clone();
  const offs = [
    ledger.initLedger(),
    ...['egg-card', 'egg-note', 'egg-operator', 'egg-listen'].map(id => slots.registerOverlay({ id, Component: () => null })),
  ];
  clearSave();
  gates.__resetDailyForTests();
  H.__resetHostsForTests();
  L.__resetListenForTests();
  __setBayNowForTests(spec);
  game.set({ phase: 'playing' });
  runtime.move.mode = 'foot';
  runtime.glide.active = false;
  runtime.camera.shot = null;
  const p = runtime.player;
  const put = (x: number, z: number, y = 0) => { p.x = x; p.z = z; p.y = y; p.speed = 0; p.pathTarget = null; };
  const firsts = (kind: string) => events.filter(e => e.type === 'find' && e.kind === kind && e.first).map(e => (e as { id: string }).id);
  const overlay = (id: string) => slots.openOverlays().find(o => o.id === id);
  const prompt = (id: string) => H.liveHosts().flatMap(h => h.interactables?.() ?? []).find(it => it.id === id);
  const cleanup = () => {
    off(); for (const o of offs) o();
    H.__resetHostsForTests(); L.__resetListenForTests(); gates.__resetDailyForTests(); clearSave(); __setBayNowForTests(null);
    KARL.uKarl.value = lvl; KARL.uKarlA.value.copy(a);
    runtime.move.mode = 'foot'; runtime.glide.active = false; runtime.camera.shot = null;
    if (cinemaActive()) skipCinema();
    game.set({ phase, timeOfDay: tod });
  };
  return { events, put, p, firsts, overlay, prompt, cleanup };
}

// ---------------------------------------------------------------------------------------------------------------
// W5-D6 · 城市之声
// ---------------------------------------------------------------------------------------------------------------

/** Append-only (bit i of play.g.sound). */
const SOUNDS_1 = ['ggb-foghorns', 'cable-car-bell', 'ferry-horn', 'sea-lions', 'parrots', 'wave-organ', 'laughing-lady', 'sea-cave', 'tiled-steps', 'festival-banjos', 'taiko', 'karl-wind'];

test('W5-D6 城市之声 registry: twelve append-only ids (bit i of play.g.sound), sourced facts, riddles ≤ 20, lines ≤ 45, a playback of registered recipes each', () => {
  assert.deepEqual(CS.SOUND_IDS.slice(0, SOUNDS_1.length), SOUNDS_1);
  assert.equal(new Set(CS.SOUND_IDS).size, CS.SOUND_IDS.length);
  assert.ok(CS.SOUND_IDS.length <= MAX_PLAY_BITS);
  assert.equal(CS.SOUND_COINS, 5);
  assert.equal(CS.LISTEN_S, 3);
  CS.CITY_SOUNDS.forEach((s, i) => {
    assert.equal(s.n, i + 1);
    assert.equal(CS.soundById(s.id), s);
    const source = CS.soundRewardSource(s.id);
    assert.ok(REWARD_SOURCE.test(source) && rewardPrefix(source) === 'sound', source);
    assert.ok(EGG_AREAS.includes(s.area), `${s.id}: area`);
    for (const [k, b] of Object.entries({ name: s.name, riddle: s.riddle, how: s.how, line: s.line, fact: s.fact })) bilingual(b, `${s.id} ${k}`);
    assert.ok(zhLen(s.riddle.zh) <= 20, `${s.id}: riddle ≤ 20 (${zhLen(s.riddle.zh)})`);
    assert.ok(zhLen(s.line.zh) <= 45, `${s.id}: line ≤ 45 (${zhLen(s.line.zh)})`);
    assert.ok(zhLen(s.fact.zh) <= 80 && s.fact.en.length <= 200, `${s.id}: the fact fits the card`);
    sourced(s.sources, s.id);
    assert.ok(s.by === 'moment' || s.radius >= 3, `${s.id}: a prompt with a reach`);
    const play = L.SOUND_PLAYBACK[s.id];
    assert.ok(play && play.length >= 1, `${s.id}: what plays`);
    for (const [id] of play) assert.ok(id in EGG_SOUNDS, `${s.id}: ${id} is a registered recipe`);
    assert.ok(!/硬币|彩蛋|最陡|疯/.test([s.name.zh, s.riddle.zh, s.how.zh, s.line.zh, s.fact.zh].join(' ')), `${s.id}: wording`);
  });
  // our own voices: the laugh is ours (said on its card), the banjo tune is ours, the ferry's blast follows the rule's 4–6 s
  assert.match(CS.soundById('laughing-lady')!.fact.zh, /我们自己做的笑声/);
  assert.match(CS.soundById('festival-banjos')!.fact.zh, /自己弹的/);
  assert.match(CS.soundById('ferry-horn')!.fact.zh, /4 到 6 秒/);
  // four are collected by their moment (no prompt), eight by listening
  assert.deepEqual(CS.CITY_SOUNDS.filter(s => s.by === 'moment').map(s => s.id), ['ggb-foghorns', 'wave-organ', 'laughing-lady', 'tiled-steps']);
});

test('W5-D6 城市之声 spots: every 听一听 spot stands in the published city and joins the walking network', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const s of CS.CITY_SOUNDS) await sf.attachAround(city, s.at.x, s.at.z, 16, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ix = await sf.graphIndex();
    for (const s of CS.CITY_SOUNDS.filter(q => q.by === 'listen')) {
      assert.ok(canStand(s.at.x, s.at.z, 0.4) && !isWater(s.at.x, s.at.z), `${s.id}: (${s.at.x}, ${s.at.z}) standable`);
      // on the walking network (the static sweep read every spot ok: scripts/opus-sf/qa/sweep-static.mts' judge, lane D's report)
      assert.ok(ix.nearestNode(s.at.x, s.at.z, 25) >= 0, `${s.id}: a walking-graph node near`);
    }
  } finally { setCityTerrain(null); }
});

test('W5-D6 城市之声 gates: ferries and parrots by day, the taiko on the April festival weekends, the banjos only with the festival open, Karl\'s wind with Karl', () => {
  const lvl = KARL.uKarl.value, a = KARL.uKarlA.value.clone();
  try {
    const at = (spec: string, id: string) => { __setBayNowForTests(spec); return L.soundLive(id); };
    assert.equal(at('2026-09-28T12:00', 'ferry-horn'), true);
    assert.equal(at('2026-09-28T23:30', 'ferry-horn'), false);
    assert.equal(at('2026-09-28T09:00', 'parrots'), true);
    assert.equal(at('2026-09-28T20:00', 'parrots'), false);
    // taiko: April, a weekend between the 8th and the 21st, 10:00–18:00 (2026: 11–12 and 18–19)
    assert.equal(at('2026-04-11T11:00', 'taiko'), true);
    assert.equal(at('2026-04-19T17:30', 'taiko'), true);
    assert.equal(at('2026-04-19T18:30', 'taiko'), false);
    assert.equal(at('2026-04-15T12:00', 'taiko'), false, 'a Wednesday');
    assert.equal(at('2026-04-04T12:00', 'taiko'), false, 'too early in April');
    assert.equal(at('2026-09-26T12:00', 'taiko'), false, 'September');
    // the banjos follow lane R's festival windows: nothing without the catalog
    assert.equal(at('2026-10-03T12:00', 'festival-banjos'), false, 'no catalog in node: no festival');
    // Karl's wind: in with Karl's morning bank, away at midday
    for (const [tod, want] of [['morning', true], ['day', false]] as const) {
      const k = KARL_TIME[tod];
      KARL.uKarl.value = k.level; KARL.uKarlA.value.set(k.front, k.top, k.gate, k.gateLen);
      assert.equal(L.soundLive('karl-wind'), want, tod);
    }
    for (const id of ['cable-car-bell', 'sea-lions', 'sea-cave']) assert.equal(at('2026-09-28T03:00', id), true, `${id}: any time`);
  } finally { __setBayNowForTests(null); KARL.uKarl.value = lvl; KARL.uKarlA.value.copy(a); }
});

test('W5-D6 城市之声 listening: 听一听 plays the sound, three seconds standing still collect it (5 金币 through lane E\'s ledger, the card); walking off cancels; a second listen is quiet', t => {
  const w = world(t, '2026-09-28T11:00');
  const offIds = ledger.registerRewardIds('sound', CS.SOUND_IDS);
  let stop = () => {};
  try {
    stop = H.startHosts(makeHosts());
    const bell = CS.soundById('cable-car-bell')!;
    // the prompt, near the turntable
    w.put(bell.at.x + 1, bell.at.z);
    run(0.3);
    const it = w.prompt('sound:cable-car-bell');
    assert.ok(it && it.source === 'find' && it.act && it.verb.zh === '听一听' && it.action === 'bell', 'the 听一听 prompt');
    // walking away after a second: cancelled, nothing found, BAYBAY's miss line
    it!.act!();
    assert.ok(w.overlay('egg-listen'), 'the ring');
    assert.equal(L.listeningTo(), 'cable-car-bell');
    assert.equal(w.prompt('sound:cable-car-bell'), undefined, 'no prompt while listening');
    run(1);
    w.put(bell.at.x + 4, bell.at.z);
    run(0.3);
    assert.equal(L.listeningTo(), null);
    assert.ok(!w.overlay('egg-listen'), 'the ring goes');
    assert.deepEqual(w.firsts('sound'), []);
    // standing still for three seconds: collected
    w.put(bell.at.x + 1, bell.at.z);
    run(0.3);
    const before = ledger.coinsTotal();
    w.prompt('sound:cable-car-bell')!.act!();
    run(2.8);
    assert.deepEqual(w.firsts('sound'), [], 'not before three seconds');
    run(0.4);
    assert.deepEqual(w.firsts('sound'), ['cable-car-bell']);
    assert.ok(w.events.some(e => e.type === 'reward' && e.source === 'sound:cable-car-bell' && e.coins === 5));
    assert.equal(ledger.coinsTotal() - before, 5, 'lane E pays 5');
    assert.ok(ledger.isPaid('sound:cable-car-bell') && L.soundFound('cable-car-bell'));
    t.mock.timers.tick(1500);
    assert.deepEqual(w.overlay('egg-card')?.props, { id: 'cable-car-bell', kind: 'sound', coins: 5 }, 'the sound card');
    slots.closeOverlay('egg-card');
    // again: find { first: false }, no reward, no card
    w.events.length = 0;
    run(0.3);
    w.prompt('sound:cable-car-bell')!.act!();
    run(3.3);
    assert.deepEqual(w.events, [{ type: 'find', kind: 'sound', id: 'cable-car-bell', first: false }]);
    t.mock.timers.tick(3000);
    assert.equal(w.overlay('egg-card'), undefined);
    // a prompt that is not live now is not offered: the taiko in September
    const taiko = CS.soundById('taiko')!;
    w.put(taiko.at.x, taiko.at.z);
    run(0.5);
    assert.equal(w.prompt('sound:taiko'), undefined, 'no taiko in September');
    __setBayNowForTests('2027-04-10T11:00');
    run(0.5);
    assert.ok(w.prompt('sound:taiko'), 'the April festival weekend');
    // no listening under a dialogue or on a ride: the act does nothing
    runtime.move.mode = 'bike';
    assert.equal(L.startListen('taiko'), false);
    runtime.move.mode = 'foot';
  } finally { stop(); offIds(); w.cleanup(); }
});

test('W5-D6 城市之声 moments: the foghorn duet heard on the deck and the Tiled Steps climbed in one go collect their sounds — each card after the egg\'s, BAYBAY\'s line after hers', t => {
  const w = world(t, '2026-09-28T08:00');
  const offIds = [ledger.registerRewardIds('sound', CS.SOUND_IDS), ledger.registerRewardIds('egg', ALL_EGG_IDS)];
  let stop = () => {};
  try {
    stop = H.startHosts(makeHosts());
    const k = KARL_TIME.morning;
    KARL.uKarl.value = k.level; KARL.uKarlA.value.set(k.front, k.top, k.gate, k.gateLen);
    const deck = { x: -840, z: 529 };
    w.put(deck.x, deck.z, 15.4);
    assert.ok(marina.onDeck(deck.x, 15.4, deck.z));
    run(14);
    assert.ok(w.firsts('egg').includes('ggb-foghorn-duet'), 'the egg');
    assert.deepEqual(w.firsts('sound'), ['ggb-foghorns'], 'and the sound');
    // the egg's card first (3.5 s), the sound's after it goes
    t.mock.timers.tick(3600);
    assert.equal((w.overlay('egg-card')?.props as { id: string }).id, 'ggb-foghorn-duet');
    t.mock.timers.tick(4000);
    assert.equal((w.overlay('egg-card')?.props as { id: string }).id, 'ggb-foghorn-duet', 'the sound waits');
    slots.closeOverlay('egg-card');
    // (the queue polls: step the mocked clock the way time passes)
    for (let i = 0; i < 6; i++) t.mock.timers.tick(250);
    assert.deepEqual(w.overlay('egg-card')?.props, { id: 'ggb-foghorns', kind: 'sound', coins: 5 });
    slots.closeOverlay('egg-card');
    KARL.uKarl.value = 0;
    // the Tiled Steps: a climb in one go from the foot to the top
    w.put(park.STEPS_BOTTOM.x, park.STEPS_BOTTOM.z);
    run(0.5);
    run(12, tt => { const k2 = Math.min(1, tt / 10); w.put(park.STEPS_BOTTOM.x + (park.STEPS_TOP.x - park.STEPS_BOTTOM.x) * k2, park.STEPS_BOTTOM.z + (park.STEPS_TOP.z - park.STEPS_BOTTOM.z) * k2); });
    assert.ok(w.firsts('egg').includes('tiled-steps-sea-to-stars'));
    assert.ok(w.firsts('sound').includes('tiled-steps'));
    assert.ok(!lockHeld());
  } finally { stop(); for (const o of offIds) o(); w.cleanup(); }
});

test('W5-D6 城市之声 card and ring: the sound card says 城市之声 · +5 金币 with its sources; the ring names the sound', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const close = () => {};
  const card = renderToStaticMarkup(h(FactCard, { props: { id: 'ferry-horn', kind: 'sound', coins: 5 }, close }));
  assert.match(card, /is-sound/);
  assert.match(card, /城市之声/);
  assert.match(card, /\+5 金币/);
  assert.match(card, /渡轮离港的长笛/);
  assert.equal(cardEntry('sound', 'ferry-horn')?.sources.length, 3);
  assert.equal(cardEntry('sound', 'nope'), null);
  const ring = renderToStaticMarkup(h(ListenRing, { props: { name: CS.soundById('sea-cave')!.name, seconds: 3 }, close }));
  assert.match(ring, /竖起耳朵听/);
  assert.match(ring, /苏特罗浴场的石洞/);
});

// ---------------------------------------------------------------------------------------------------------------
// W5-D6 · BAYBAY's pebbles
// ---------------------------------------------------------------------------------------------------------------

const PS = await import('../src/opus-bay/eggs/pebbleSpots');
const PB = await import('../src/opus-bay/eggs/pebbles');
const PR = await import('../src/opus-bay/eggs/props');
const { setCharApi } = await import('../src/opus-bay/actors/charApi');
const THREE_MOD = await import('three');
type CharApi = import('../src/opus-bay/actors/charApi').CharApi;

/** A charApi that records what it was asked, with a head slot that can hold a hat (lane E's). */
function fakeChar() {
  const emotes: string[] = [];
  const held = new Map<string, import('three').Object3D | null>();
  const api = {
    emote: (who: string, name: string) => { emotes.push(`${who}:${name}`); },
    sitGround: () => false, stand: () => {},
    attach: (who: string, slot: string, obj: import('three').Object3D | null) => { held.set(`${who}:${slot}`, obj); },
    tint: () => {}, vehiclePaint: () => {}, glideSoftBox: () => {},
    attachedAt: (who: string, slot: string) => held.get(`${who}:${slot}`) ?? null,
  };
  return { api: api as unknown as CharApi, emotes, held };
}

const AREA_PREFIX = { 'north-beach': 'nb', wharf: 'wf', downtown: 'dt', 'marina-presidio': 'mp', 'golden-gate-park': 'gp', 'west-coast': 'wc', 'mission-castro': 'mc', south: 'so' } as const;

test('W5-D6 pebbles registry: 48 append-only ids (bit i of play.g.pebble), six in each of the eight areas, spread out, tricks at 10 / 25 / 40, the golden one at 48', () => {
  const order = EGG_AREAS.flatMap(a => [1, 2, 3, 4, 5, 6].map(n => `${AREA_PREFIX[a]}-${n}`));
  assert.deepEqual(PS.PEBBLE_IDS, order, 'the append-only order');
  assert.equal(PS.PEBBLES.length, 48);
  for (const a of EGG_AREAS) assert.equal(PS.PEBBLES.filter(q => q.area === a).length, 6, `${a}: six`);
  for (const q of PS.PEBBLES) {
    bilingual(q.near, `${q.id} near`);
    assert.ok(zhLen(q.near.zh) <= 14, `${q.id}: a short place name`);
    const source = PS.pebbleRewardSource(q.id);
    assert.ok(REWARD_SOURCE.test(source) && rewardPrefix(source) === 'pebble', source);
    for (const o of PS.PEBBLES) if (o !== q) assert.ok(Math.hypot(o.x - q.x, o.z - q.z) >= 10, `${q.id} / ${o.id}: spread out`);
  }
  assert.equal(PS.PEBBLE_COINS, 3);
  assert.deepEqual(PS.PEBBLE_TRICKS.map(tr => tr.at), [10, 25, 40]);
  assert.equal(PS.GOLDEN_AT, 48);
  assert.deepEqual(PS.tricksAt(9), []);
  assert.deepEqual(PS.tricksAt(25), ['tap', 'balance']);
  // the card says only what the aquarium says; the pouch is BAYBAY's own
  assert.match(PS.PEBBLE_CARD.fact.zh, /BAYBAY 自己的爱好/);
  sourced(PS.PEBBLE_CARD.sources, 'pebble card');
  assert.equal(cardEntry('pebble', 'first')?.coins, 3);
  assert.ok(cardEntry('pebble', 'golden'));
  assert.equal(cardEntry('pebble', 'nb-1'), null, 'no card per pebble');
  for (const l of [...PB.SNIFF_LINES, PB.FIRST_LINE, PB.GOLDEN_LINE, PB.SHOW_LINE, ...Object.values(PB.TRICK_LINES), PB.countLine(47)]) {
    bilingual(l, l.en);
    assert.ok(zhLen(l.zh) <= 45, l.zh);
  }
});

test('W5-D6 pebbles spots: every pebble lies on standable ground of the published city (landmarks registered), on the walking network, off the water', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const q of PS.PEBBLES) await sf.attachAround(city, q.x, q.z, 12, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ix = await sf.graphIndex();
    for (const q of PS.PEBBLES) {
      assert.ok(canStand(q.x, q.z, 0.4), `${q.id}: (${q.x}, ${q.z}) standable`);
      assert.ok(!isWater(q.x, q.z), `${q.id}: not water`);
      assert.ok(ix.nearestNode(q.x, q.z, 20) >= 0, `${q.id}: a walking-graph node near`);
    }
  } finally { setCityTerrain(null); }
});

test('W5-D6 pebbles on the real host: BAYBAY wiggles at 25 u and points at 8 u; walking over one pays 3 金币 (lane E\'s ledger); 10 / 25 teach a trick, never taking her hat off; 问 BAYBAY → 玩石子 from 10', t => {
  const w = world(t, '2026-09-28T11:00');
  const offIds = ledger.registerRewardIds('pebble', PS.PEBBLE_IDS);
  const ch = fakeChar();
  setCharApi(ch.api);
  PB.__resetPebblesForTests();
  let stop = () => {};
  try {
    stop = H.startHosts(makeHosts());
    const q = PS.pebbleById('mp-1')!;
    const g = runtime.guide;
    const at = (d: number) => { w.put(q.x + d, q.z); g.x = q.x + d + 1.5; g.z = q.z; };
    assert.ok(H.props.has('pebble:mp-1'), 'the stone lies in the pool');
    at(20); run(0.3);
    assert.ok(ch.emotes.includes('baybay:pet'), 'a happy wiggle within 25 u');
    assert.ok(!ch.emotes.includes('baybay:point'));
    at(6); run(0.3);
    assert.ok(ch.emotes.includes('baybay:point'), 'she points within 8 u');
    assert.equal(w.firsts('pebble').length, 0);
    const before = ledger.coinsTotal();
    at(0.5); run(0.3);
    assert.deepEqual(w.firsts('pebble'), ['mp-1']);
    assert.equal(ledger.coinsTotal() - before, 3, 'lane E pays 3');
    assert.ok(ledger.isPaid('pebble:mp-1') && PB.pebbleFound('mp-1'));
    assert.ok(!H.props.has('pebble:mp-1'), 'gone from the ground');
    for (let i = 0; i < 6; i++) t.mock.timers.tick(400);
    assert.deepEqual(w.overlay('egg-card')?.props, { id: 'first', kind: 'pebble', coins: 3 }, 'the first pebble\'s card');
    slots.closeOverlay('egg-card');
    // no tricks yet: the ask item waits
    const ask = () => slots.askItems.list().find(a => a.id === 'eggs-pebbles');
    assert.ok(ask() && !ask()!.visible!(), '玩石子 hidden before 10');
    // the tenth pebble teaches the tummy tap: the stone on her chest (neck slot), then gone
    while (PB.pebbleCount() < 10) PB.pickPebble(PS.PEBBLE_IDS.find(id => !PB.pebbleFound(id))!);
    t.mock.timers.tick(1300);
    assert.ok(ch.emotes.includes('baybay:float'), 'on her back');
    assert.ok(ch.held.get('baybay:neck'), 'a stone on her chest');
    t.mock.timers.tick(5000);
    assert.equal(ch.held.get('baybay:neck') ?? null, null, 'put away after the trick');
    assert.ok(ask()!.visible!(), '玩石子 from 10');
    // she wears a hat (lane E's): the balancing trick puts the stone ON the hat, and the hat stays
    const hat = new THREE_MOD.Group();
    ch.held.set('baybay:head', hat);
    while (PB.pebbleCount() < 25) PB.pickPebble(PS.PEBBLE_IDS.find(id => !PB.pebbleFound(id))!);
    t.mock.timers.tick(1300);
    assert.equal(ch.held.get('baybay:head'), hat, 'the hat stays on');
    assert.equal(hat.children.length, 1, 'the stone sits on the hat');
    t.mock.timers.tick(4000);
    assert.equal(hat.children.length, 0, 'and comes off again');
    assert.equal(ch.held.get('baybay:head'), hat);
    // 玩石子 shows the known tricks in turn
    assert.equal(PB.showNextTrick(), true);
  } finally { stop(); offIds(); setCharApi(null); PB.__resetPebblesForTests(); w.cleanup(); }
});

test('W5-D6 pebbles and batch-2 props and flock: every recipe within its budget (props ≤ 200, the yacht and the glider small), the held stone on its own material', () => {
  for (const kind of ['pebble', 'semaphore', 'picket', 'flower'] as const) {
    const n = PR.propTriangles(kind, kind === 'semaphore' ? { size: 1 } : {});
    assert.ok(n > 0 && n <= 200, `${kind}: ${n} tris`);
  }
  for (const pose of [0, 1, 2]) assert.ok(PR.propTriangles('semaphore', { size: pose }) <= 200);
  assert.ok(PR.FLOCK_KINDS.includes('yacht') && PR.FLOCK_KINDS.includes('glider'));
  const f = new PR.Flock();
  try {
    for (const c of f.group.children) {
      const m = c as import('three').InstancedMesh;
      const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
      if (m.name === 'ob-egg-yachts' || m.name === 'ob-egg-gliders') assert.ok(tris <= 120, `${m.name}: ${tris}`);
    }
  } finally { f.dispose(); }
  const a = PR.heldPebbleMesh(false), b = PR.heldPebbleMesh(true);
  assert.notEqual(a, b);
  assert.equal(PR.heldPebbleMesh(false), a, 'one mesh per colour, reused');
  assert.equal(a.material, b.material, 'one material for the held stone');
  const pool = new PR.PropPool();
  try {
    assert.notEqual(a.material, pool.mesh.material, 'never the pool\'s material');
    assert.equal((a.material as import('three').Material & { customProgramCacheKey(): string }).customProgramCacheKey(), 'ob-toy-dyn', 'TOY_DYN\'s program');
    assert.equal(a.castShadow, false);
  } finally { pool.dispose(); }
});

// ---------------------------------------------------------------------------------------------------------------
// W5-D6 · batch 2 (eggs 25–32)
// ---------------------------------------------------------------------------------------------------------------

const B2 = await import('../src/opus-bay/eggs/batch2');
const { eggById } = await import('../src/opus-bay/eggs/registry');
const BATCH_2 = ['mt-davidson-top-of-sf', 'telegraph-hill-semaphore', 'sutro-baths-tunnel', 'spreckels-lake-model-yachts', 'fort-funston-hang-gliders', 'castro-theatre-organ', 'presidio-pet-cemetery', 'grace-outdoor-labyrinth', 'bay-lights'];

test('W5-D6 batch 2: nine more eggs appended (bits 24–32, their own list after batch 1), each with its host; the plan\'s other three stay out until the city can host them', async () => {
  const R2 = await import('../src/opus-bay/eggs/registry');
  assert.deepEqual(ALL_EGG_IDS.slice(24), BATCH_2);
  assert.deepEqual(R2.EGGS_BATCH_2.map(e => e.id), BATCH_2);
  assert.deepEqual(R2.EGGS_BATCH_2.map(e => e.n), [25, 26, 27, 28, 29, 30, 31, 32, 33]);
  assert.equal(R2.EGG_IDS.length, 24, 'batch 1 unchanged (lane E\'s page)');
  for (const id of BATCH_2) assert.equal(R2.eggIndex(id), 24 + BATCH_2.indexOf(id), `${id}: its bit`);
  assert.deepEqual(B2.batch2Hosts().map(h => h.id), BATCH_2);
  for (const id of ['hyde-street-pier-ships', 'lands-end-low-tide-wrecks', 'ocean-beach-king-philip']) assert.equal(eggById(id), undefined, `${id}: not yet`);
  assert.match(eggById('bay-lights')!.lines[1].zh, /我们学着做的/, 'our own shimmer, said so');
  // cautious words: the pet cemetery is quiet; the organ tune is ours; no guns at Fort Funston; no going into the tunnel in surf
  assert.match(eggById('presidio-pet-cemetery')!.lines[0].zh, /轻声/);
  assert.match(eggById('castro-theatre-organ')!.lines[1].zh, /我们自己编的/);
  assert.ok(!/炮|枪/.test(eggById('fort-funston-hang-gliders')!.fact.zh));
  assert.match(eggById('sutro-baths-tunnel')!.lines[1].zh, /别往里走/);
});

test('W5-D6 batch 2 on the real host code: the summit, the semaphore, the tunnel, the yachts (not in powered-boat hours), the gliders (on foot or on the pelican), the organ at golden hour, the pet cemetery, the Grace labyrinth', t => {
  const w = world(t, '2026-09-28T15:00');
  const offIds = ledger.registerRewardIds('egg', ALL_EGG_IDS);
  let stop = () => {};
  const settle = () => { for (let i = 0; i < 400 && cinemaActive(); i++) { H.stepHosts(1 / 30); skipCinema(); } };
  try {
    stop = H.startHosts(makeHosts());
    game.set({ timeOfDay: 'day' });
    // 25 · the summit: 1.5 s standing on top
    w.put(B2.DAVIDSON_TOP.x + 2, B2.DAVIDSON_TOP.z);
    run(1);
    assert.ok(!w.firsts('egg').includes(BATCH_2[0]));
    run(0.8);
    settle();
    assert.ok(w.firsts('egg').includes(BATCH_2[0]), 'the top of SF');
    assert.equal(lockHeld(), false);
    // 26 · the semaphore raises its arms, then lowers them
    w.put(B2.SEMA_STAND.x, B2.SEMA_STAND.z);
    run(1.8);
    assert.ok(w.firsts('egg').includes(BATCH_2[1]));
    assert.ok([1, 2].includes(H.props.get('egg:telegraph-hill-semaphore')!.size!), 'arms up');
    run(7.5);
    assert.equal(H.props.get('egg:telegraph-hill-semaphore')!.size, 0, 'and down again');
    // 27 · the tunnel mouth: on arrival
    w.put(B2.TUNNEL_AT.x + 1, B2.TUNNEL_AT.z);
    run(0.3);
    assert.ok(w.firsts('egg').includes(BATCH_2[2]));
    // 28 · the yachts: Monday 15:00 yes; Tuesday 11:00 (powered boats) no
    w.put(B2.YACHT_SHORE.x, B2.YACHT_SHORE.z);
    run(2.3);
    assert.ok(w.firsts('egg').includes(BATCH_2[3]));
    assert.equal(H.flock.active, 'yacht');
    assert.equal(B2.yachtsOut(), true);
    __setBayNowForTests('2026-09-29T11:00');
    assert.equal(B2.yachtsOut(), false, 'Tuesday morning: powered boats');
    __setBayNowForTests('2026-09-29T13:30');
    assert.equal(B2.yachtsOut(), true);
    __setBayNowForTests('2026-09-28T21:00');
    assert.equal(B2.yachtsOut(), false, 'night');
    __setBayNowForTests('2026-09-28T15:00');
    w.put(0, 0);
    run(0.5);
    H.flock.stop();
    // 29 · the gliders: on foot at the deck
    w.put(B2.FUNSTON_DECK.x + 2, B2.FUNSTON_DECK.z);
    run(0.3);
    assert.ok(w.firsts('egg').includes(BATCH_2[4]));
    assert.equal(H.flock.active, 'glider');
    H.flock.stop();
    // 30 · the organ: not at midday, yes at golden hour
    w.put(B2.MARQUEE.x, B2.MARQUEE.z);
    run(0.5);
    assert.ok(!w.firsts('egg').includes(BATCH_2[5]), 'not at midday');
    w.put(0, 0);
    run(0.3);
    game.set({ timeOfDay: 'golden' });
    w.put(B2.MARQUEE.x, B2.MARQUEE.z);
    run(0.5);
    assert.ok(w.firsts('egg').includes(BATCH_2[5]), 'golden hour');
    // 31 · the pet cemetery: 2 s standing quietly; the flower stays
    w.put(B2.PETS_AT.x, B2.PETS_AT.z);
    run(2.4);
    assert.ok(w.firsts('egg').includes(BATCH_2[6]));
    assert.ok(H.props.has('egg:presidio-pet-cemetery:flower'));
    // 32 · the Grace labyrinth: 2 s beside it
    w.put(B2.GRACE_STAND.x, B2.GRACE_STAND.z);
    run(2.4);
    assert.ok(w.firsts('egg').includes(BATCH_2[7]));
    // 33 · the Bay Lights: not at golden hour, yes at night by Pier 14
    w.put(B2.PIER14.x, B2.PIER14.z);
    run(2);
    assert.ok(!w.firsts('egg').includes(BATCH_2[8]), 'not before dark');
    w.put(0, 0);
    run(0.3);
    game.set({ timeOfDay: 'night' });
    w.put(B2.PIER14.x, B2.PIER14.z);
    run(2);
    assert.ok(w.firsts('egg').includes(BATCH_2[8]), 'at night');
    assert.equal(lockHeld(), false);
    // the gliders from the pelican too
    stop();
    H.__resetHostsForTests();
    clearSave();
    stop = H.startHosts(makeHosts());
    runtime.move.mode = 'glide';
    runtime.glide.active = true;
    runtime.glide.x = B2.FUNSTON_DECK.x - 40; runtime.glide.z = B2.FUNSTON_DECK.z; runtime.glide.y = 40;
    w.put(runtime.glide.x, runtime.glide.z, 40);
    run(0.3);
    assert.equal(H.flock.active, 'glider', 'on the pelican past the cliffs');
  } finally { stop(); offIds(); w.cleanup(); }
});
