import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · lane E · W5-E1: the ledger (economy/ledger.ts) — every reward source pays once (fuzzed), malformed sources
 * are ignored, the balance never goes negative or past the cap, where each kind of source is kept, the save round trip,
 * the size test with a full play block, Settings → reset, and the hint targets (economy/hints.ts).
 */

const { emit, onEvent, REWARD_PREFIXES } = await import('../src/opus-bay/core/events');
const save = await import('../src/opus-bay/data/save');
const { bitCount, bitGet, decodePlay, MAX_COINS, MAX_ONE_OFFS, MAX_PLAY_BITS, PLAY_BIT_KINDS } = await import('../src/opus-bay/data/playSave');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const L = await import('../src/opus-bay/economy/ledger');
const { FIXED_SOURCES } = await import('../src/opus-bay/economy/sources');
const hints = await import('../src/opus-bay/economy/hints');
const economy = await import('../src/opus-bay/economy/index');

function fresh(date = '2026-10-03T10:30') {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  __setBayNowForTests(date);
}

/** a small seeded PRNG (mulberry32) so the fuzz is reproducible */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('W5-E1 sources: the fixed registry is well formed, unique, and starts with the pelican, the goals, the favours, the postcards, the arrivals', () => {
  assert.equal(new Set(FIXED_SOURCES).size, FIXED_SOURCES.length, 'no duplicates');
  assert.ok(FIXED_SOURCES.length <= MAX_PLAY_BITS);
  for (const s of FIXED_SOURCES) assert.match(s, /^(arrive|postcard|favour|goal|pelican|page):[a-z0-9:@-]{1,80}$/, s);
  // APPEND-ONLY: the W5-E1 head never moves (a moved entry would read another source's saved bit)
  assert.deepEqual(FIXED_SOURCES.slice(0, 4), ['pelican:unlock', 'goal:pelican', 'goal:postcards', 'goal:cable-car']);
  assert.equal(FIXED_SOURCES.indexOf('favour:gripman'), 12);
  assert.equal(FIXED_SOURCES.indexOf('postcard:sf-golden-gate-fog'), 18);
  assert.equal(FIXED_SOURCES.indexOf('arrive:golden-gate-bridge'), 42);
  assert.equal(FIXED_SOURCES.indexOf('arrive:visitacion-valley-greenway'), 199);
  assert.ok(FIXED_SOURCES.length >= 200);
});

test('W5-E1 pay: once per source, capped per prefix, emits coins; malformed sources are ignored', () => {
  fresh();
  const seen: { total: number; delta: number; source: string }[] = [];
  const off = onEvent(e => { if (e.type === 'coins') seen.push({ total: e.total, delta: e.delta, source: e.source }); });
  try {
    assert.equal(L.pay('arrive:coit-tower', 10), 10);
    assert.equal(L.pay('arrive:coit-tower', 10), 0, 'twice: nothing');
    assert.equal(L.coinsTotal(), 10);
    assert.equal(L.pay('postcard:sf-painted-ladies', 999), 10, 'capped at the postcard rate');
    assert.equal(L.pay('favour:baker', 25), 25);
    assert.equal(L.pay('pelican:unlock', 20), 20);
    assert.equal(L.pay('goal:twin-peaks', 20), 20);
    assert.equal(L.pay('medal:slides:2', 10), 10, 'not in any registry: kept in play.e');
    assert.equal(L.pay('medal:slides:2', 10), 0);
    assert.deepEqual(L.playState().e, ['medal:slides:2']);
    for (const bad of ['', 'arrive:', 'Arrive:x', 'coins:1', 'arrive:Coit', 'arrive:coit tower', 'shop:scarf', 'x'.repeat(90), 'arrive:' + 'a'.repeat(81)]) assert.equal(L.pay(bad, 10), 0, `bad: ${bad}`);
    assert.equal(L.pay('arrive:dolores-park', -5), 0, 'negative asks pay 0 but mark the source');
    assert.equal(L.isPaid('arrive:dolores-park'), true);
    assert.equal(L.pay('arrive:twin-peaks', Number.NaN), 0);
    assert.equal(L.pay('arrive:sutro-tower', 3.9), 3, 'whole coins');
    assert.equal(L.coinsTotal(), 10 + 10 + 25 + 20 + 20 + 10 + 3);
    assert.deepEqual(seen.map(s => s.delta), [10, 10, 25, 20, 20, 10, 3], 'a coins event per paid source with coins');
    assert.equal(seen.at(-1)!.total, L.coinsTotal());
    const p = L.playState();
    assert.ok(bitGet(p.g.coin, FIXED_SOURCES.indexOf('arrive:coit-tower')), 'an arrival is kept in the coin bitset');
    assert.equal(bitCount(p.g.coin), 8);
  } finally { off(); }
});

test('W5-E1 the reward event is paid through the listener (init) and the listener stops with the off', () => {
  fresh();
  const off = economy.init();
  emit({ type: 'reward', source: 'arrive:ocean-beach', coins: 5 });
  emit({ type: 'reward', source: 'arrive:ocean-beach', coins: 5 });
  emit({ type: 'reward', source: 'not a source', coins: 5 });
  assert.equal(L.coinsTotal(), 5);
  off();
  emit({ type: 'reward', source: 'arrive:alcatraz', coins: 10 });
  assert.equal(L.coinsTotal(), 5, 'after the off nothing is paid');
});

test('W5-E1 registered kinds: ids index the lane\'s own bitset; earlier play.e entries move in on registration', () => {
  fresh();
  assert.equal(L.pay('egg:telegraph-hill-parrots', 10), 10, 'before D registers: play.e');
  assert.deepEqual(L.playState().e, ['egg:telegraph-hill-parrots']);
  const off = L.registerRewardIds('egg', ['pier39-sea-lion-season', 'telegraph-hill-parrots', 'musee-laughing-lady']);
  assert.equal(L.playState().e, undefined, 'moved out of play.e');
  assert.ok(bitGet(L.playState().g.egg, 1));
  assert.equal(L.isPaid('egg:telegraph-hill-parrots'), true);
  assert.equal(L.pay('egg:telegraph-hill-parrots', 10), 0, 'still once');
  assert.equal(L.pay('egg:musee-laughing-lady', 10), 10);
  assert.ok(bitGet(L.playState().g.egg, 2));
  L.registerRewardIds('event', ['hardly-strictly-bluegrass-2026']);
  assert.equal(L.pay('event:hardly-strictly-bluegrass-2026', 15), 15);
  assert.ok(bitGet(L.playState().g.souvenir, 0), 'event souvenirs in the souvenir bitset');
  off();
  assert.equal(L.isPaid('egg:musee-laughing-lady'), false, 'unregistered: the bit is not read (D registers at its init)');
  assert.equal(L.coinsTotal(), 35);
});

test('W5-E1 trails refill each Bay day; daily sources keep one date\'s mask and never pay a past day', () => {
  fresh('2026-10-03T08:00');
  assert.equal(L.pay('trail:filbert-steps:1', 1), 0, 'an unregistered trail id is not paid (it has no daily bit)');
  L.registerRewardIds('trail', ['filbert-steps:1', 'filbert-steps:2', 'lyon-steps:1']);
  assert.equal(L.pay('trail:filbert-steps:1', 5), 1, 'trail coins pay 1');
  assert.equal(L.pay('trail:filbert-steps:1', 1), 0);
  assert.deepEqual(L.playState().t, { d: '2026-10-03', b: 'AQ' });
  __setBayNowForTests('2026-10-04T07:00');
  assert.equal(L.isPaid('trail:filbert-steps:1'), false, 'a new Bay day: the trail is back');
  assert.equal(L.pay('trail:filbert-steps:2', 1), 1);
  assert.deepEqual(L.playState().t, { d: '2026-10-04', b: 'Ag' }, 'yesterday\'s bits are gone');
  assert.equal(L.pay('daily:2026-10-04:1', 10), 10);
  assert.equal(L.pay('daily:2026-10-04:1', 10), 0);
  assert.equal(L.pay('daily:2026-10-04:all', 20), 20);
  assert.deepEqual(L.playState().d, { d: '2026-10-04', m: 0b1000_0001 });
  assert.equal(L.pay('daily:2026-10-03:2', 10), 0, 'a past day');
  assert.equal(L.isPaid('daily:2026-10-03:2'), true);
  assert.equal(L.pay('daily:2026-10-05:2', 10), 10, 'the next day starts a new mask');
  assert.deepEqual(L.playState().d, { d: '2026-10-05', m: 0b10 });
  for (const bad of ['daily:2026-13-01:1', 'daily:2026-10-05:8', 'daily:2026-10-05:0', 'daily:today:1']) assert.equal(L.pay(bad, 10), 0, bad);
});

test('W5-E1 fuzz: 5,000 random rewards and purchases — each source pays once, the balance equals the sum paid and stays in 0..999999', () => {
  fresh();
  const rand = rng(20260928);
  L.registerRewardIds('egg', Array.from({ length: 24 }, (_, i) => `egg-${i}`));
  L.registerRewardIds('cache', Array.from({ length: 40 }, (_, i) => `c${i}`));
  L.registerRewardIds('trail', Array.from({ length: 60 }, (_, i) => `t${i >> 3}:${i & 7}`));
  const pool = [
    ...FIXED_SOURCES.slice(0, 60), ...Array.from({ length: 24 }, (_, i) => `egg:egg-${i}`), ...Array.from({ length: 40 }, (_, i) => `cache:c${i}`),
    ...Array.from({ length: 60 }, (_, i) => `trail:t${i >> 3}:${i & 7}`), ...Array.from({ length: 30 }, (_, i) => `medal:act-${i % 10}:${1 + (i % 3)}`),
    'daily:2026-10-03:1', 'daily:2026-10-03:2', 'daily:2026-10-03:all', 'bogus', 'shop:x', 'arrive:NOPE', `goal:${'z'.repeat(60)}`,
  ];
  const paidOnce = new Map<string, number>();
  let sum = 0, spent = 0;
  for (let k = 0; k < 5000; k++) {
    if (rand() < 0.1) {
      const price = Math.floor(rand() * 90) - 5;
      const before = L.coinsTotal();
      const ok = L.spend('fuzz-item', price);
      assert.equal(ok, Number.isInteger(price) && price > 0 && price <= before);
      if (ok) spent += price;
      assert.ok(L.coinsTotal() >= 0);
      continue;
    }
    const source = pool[Math.floor(rand() * pool.length)];
    const asked = [10, 999, -3, 0, 2.5, Number.POSITIVE_INFINITY][Math.floor(rand() * 6)];
    const got = L.pay(source, asked);
    if (got > 0) {
      assert.ok(!paidOnce.has(source), `${source} paid twice`);
      paidOnce.set(source, got);
    }
    sum += got;
    assert.equal(L.coinsTotal(), sum - spent);
    assert.ok(L.coinsTotal() >= 0 && L.coinsTotal() <= MAX_COINS);
  }
  assert.ok(paidOnce.size > 100, `${paidOnce.size} distinct sources paid`);
  // the play block survives the save round trip and decodes to itself
  const text = save.encodeSave({ version: 2, play: L.playState() as never });
  assert.deepEqual(save.decodeSave(text)!.play, L.playState());
  assert.deepEqual(decodePlay(JSON.parse(JSON.stringify(L.playState()))), L.playState());
});

test('W5-E1 caps: the balance stops at 999,999; play.e holds 128 and refuses more (never pays twice)', () => {
  fresh();
  save.patchSave(s => { s.play = { v: 1, c: MAX_COINS - 5, g: {} }; });
  assert.equal(L.pay('favour:ranger', 25), 5, 'up to the cap');
  assert.equal(L.coinsTotal(), MAX_COINS);
  assert.equal(L.pay('favour:gardener', 25), 0);
  assert.equal(L.isPaid('favour:gardener'), true, 'still marked');
  fresh();
  for (let i = 0; i < MAX_ONE_OFFS; i++) assert.equal(L.pay(`medal:m${i}:1`, 5), 5);
  assert.equal(L.pay('medal:one-more:1', 5), 0, 'play.e full: not paid');
  assert.equal(L.isPaid('medal:one-more:1'), false);
  assert.equal(L.playState().e!.length, MAX_ONE_OFFS);
  assert.equal(L.coinsTotal(), MAX_ONE_OFFS * 5);
});

test('W5-E1 the size test: a full play block (every bitset at its cap, 128 one-offs, 32 bests) with every save cap stays under 64 KB and round-trips', () => {
  fresh();
  const full = (n: number) => Buffer.from(new Uint8Array(n).fill(255)).toString('base64').replace(/=+$/, '');
  const g = Object.fromEntries(PLAY_BIT_KINDS.map(k => [k, full(192)]));
  const play = {
    v: 1 as const, c: MAX_COINS, g, t: { d: '2026-10-03', b: full(192) }, w: { 'baybay-scarf': 255, 'baybay-hat': 255, 'player-hat': 255, 'player-pack': 255, bike: 255, car: 255, pelican: 255, frame: 255 },
    b: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`activity-best-key-${String(i).padStart(21, '0')}`, -123456.789])),
    d: { d: '2026-10-03', m: 255 }, e: Array.from({ length: 128 }, (_, i) => `medal:${String(i).padStart(33, 'x')}`),
  };
  const long = (i: number, n: number) => `${String(i).padStart(n, 'p')}`;
  const s = {
    version: 2 as const, lastSafe: { world: 'city' as const, x: 1, z: 2, heading: 0, zone: 'z'.repeat(80) },
    discovered: Array.from({ length: 2000 }, (_, i) => long(i, 80)), zones: Array.from({ length: 64 }, (_, i) => long(i, 80)),
    rides: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [long(i, 80), 1e6])),
    unlocked: { glide: true }, arrivals: Array.from({ length: 512 }, (_, i) => `${long(i, 64)}@${'s'.repeat(24)}`),
    tours: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [long(i, 40), { chapter: 32, stop: 32, completed: Array.from({ length: 64 }, (_, j) => long(j, 40)), express: true }])),
    play, savedAt: Date.now(),
  };
  const decodedPlay = decodePlay(play)!;
  assert.equal(decodedPlay.e!.length, 128);
  const text = save.encodeSave(s);
  assert.ok(text.length <= save.SAVE_MAX_BYTES, `${text.length} B`);
  const back = save.decodeSave(text)!;
  assert.deepEqual(back.play, decodedPlay, 'the play block is never trimmed');
  assert.ok(JSON.stringify(decodedPlay).length < 12 * 1024, `the play block alone at the format caps (realistic: ≈ 1 KB): ${JSON.stringify(decodedPlay).length} B`);
});

test('W5-E1 Settings → reset progress: the balance starts over and subscribers hear it', () => {
  fresh();
  let heard = 0;
  const off = L.subscribeLedger(() => { heard++; });
  const offInit = economy.init();
  try {
    L.pay('arrive:coit-tower', 10);
    assert.equal(heard, 1);
    const v = L.ledgerVersion();
    save.clearSave();
    assert.equal(L.coinsTotal(), 0);
    assert.equal(heard, 2);
    assert.ok(L.ledgerVersion() > v);
    assert.equal(L.pay('arrive:coit-tower', 10), 10, 'paid again after a reset (a new save)');
  } finally { off(); offInit(); }
});

test('W5-E1 every reward prefix has a cap; the kinds the ledger writes are frozen play kinds', () => {
  for (const p of REWARD_PREFIXES) assert.ok(Number.isInteger(L.REWARD_CAPS[p]) && L.REWARD_CAPS[p] > 0, p);
  for (const k of Object.values(L.PREFIX_KIND)) assert.ok((PLAY_BIT_KINDS as readonly string[]).includes(k!), k);
});

test('W5-E1 hints: the nearest unfound target of a kind; any = the compass kinds; a throwing source is skipped', () => {
  const offA = hints.registerHintSource('egg', () => [{ id: 'far', x: 100, z: 0 }, { id: 'near', x: 10, z: 0 }]);
  const offB = hints.registerHintSource('cache', () => [{ id: 'c1', x: 0, z: 5 }]);
  const offC = hints.registerHintSource('postcard', () => [{ id: 'p1', x: 1, z: 1 }]);
  const offD = hints.registerHintSource('pebble', () => { throw new Error('boom'); });
  try {
    assert.equal(hints.hintTarget('egg', { x: 0, z: 0 })!.id, 'near');
    const any = hints.hintTarget('any', { x: 0, z: 0 })!;
    assert.deepEqual([any.kind, any.id, any.dist], ['cache', 'c1', 5], 'the magnifier kind (postcard) is not a compass kind');
    assert.equal(hints.hintTarget('postcard', { x: 0, z: 0 })!.id, 'p1');
    assert.equal(hints.hintTarget('pebble', { x: 0, z: 0 }), null);
  } finally { offA(); offB(); offC(); offD(); }
  assert.equal(hints.hintTarget('any', { x: 0, z: 0 }), null);
});
