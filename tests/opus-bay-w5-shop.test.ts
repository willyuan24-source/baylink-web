import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 5 · lane E · W5-E6 / W5-E7: the 小铺 — the item registry (append-only, prices, nothing that sells speed, access or
 * places), buy / wear / take off, earned items, the 飞行券 rule (BAYBAY's gift, one held, the refund after the pelican),
 * the conveniences, the bit helpers, the looks through a stub charApi (only what changed, try-on and back), the hats and
 * the frames, E's BAYBAY lines, the sheet rendered in node, and the save round trip.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const { onEvent } = await import('../src/opus-bay/core/events');
const save = await import('../src/opus-bay/data/save');
const { bitGet, bitSet, decodePlay, MAX_WEAR_INDEX, normalBits, WEAR_SLOTS } = await import('../src/opus-bay/data/playSave');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const L = await import('../src/opus-bay/economy/ledger');
const I = await import('../src/opus-bay/economy/items');
const W = await import('../src/opus-bay/economy/wallet');
const bits = await import('../src/opus-bay/economy/bits');
const { PAINTS } = await import('../src/opus-bay/actors/vehicles/models');
const charApiMod = await import('../src/opus-bay/actors/charApi');
const wearMod = await import('../src/opus-bay/economy/wear');
const hats = await import('../src/opus-bay/economy/hats');
const frames = await import('../src/opus-bay/economy/frames');
const { E_LINES } = await import('../src/opus-bay/economy/lines');
const compass = await import('../src/opus-bay/economy/compass');

function fresh(coins = 0) {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  wearMod.__resetWearForTests();
  __setBayNowForTests('2026-10-10T11:00');
  if (coins) L.commitPlay(p => ({ ...p, c: coins }));
}

/** a seeded PRNG (mulberry32) */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('W5-E6 items: append-only order pinned, ids well formed and unique, every wearable in a frozen wear slot, ≤ 256', () => {
  assert.deepEqual(I.ITEM_IDS.slice(0, 8), ['scarf-fog', 'scarf-maroon', 'scarf-orange', 'scarf-cream', 'scarf-dahlia', 'hat-beanie', 'hat-sun', 'hat-sailor']);
  assert.equal(I.itemIndex('ribbon-orange'), 20);
  assert.equal(I.itemIndex('frame-golden'), 23);
  assert.equal(I.itemIndex('scarf-treasure'), 25);
  assert.equal(I.itemIndex('fly-ticket'), 28);
  assert.equal(I.itemIndex('fly-gift'), 29);
  assert.equal(I.itemIndex('frame-sounds'), 30, 'W5-E9: appended for the 城市之声 page');
  assert.equal(new Set(I.ITEM_IDS).size, I.ITEMS.length);
  assert.ok(I.ITEMS.length <= MAX_WEAR_INDEX + 1, 'every item index fits a wear slot number');
  for (const it of I.ITEMS) {
    assert.match(it.id, /^[a-z0-9-]{1,32}$/, it.id);
    assert.ok(it.slot === 'use' || (WEAR_SLOTS as readonly string[]).includes(it.slot), `${it.id}: slot`);
    assert.ok(it.name.zh.length > 0 && it.name.zh.length <= 12 && it.name.en.length <= 32, `${it.id}: name`);
    if (it.note) assert.ok(it.note.zh.length <= 24, `${it.id}: note ≤ 24`);
    if (it.source) { assert.match(it.source.url, /^https:\/\//); assert.match(it.source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/); }
    if (it.slot === 'baybay-scarf' || it.slot === 'player-hat' || it.slot === 'player-pack') assert.ok(Number.isInteger(it.color) && it.color! >= 0 && it.color! <= 0xffffff, `${it.id}: colour`);
    // (W7-G2, lane G: the pelican's Halloween bat wings are a costume on its wing bones, not a paint)
    if ((it.slot === 'bike' || it.slot === 'car' || it.slot === 'pelican') && !(it.slot === 'pelican' && it.costume === 'bat-wings')) { assert.ok(it.paint && it.paint in PAINTS, `${it.id}: a PAINTS id`); assert.equal(it.swatch, PAINTS[it.paint as keyof typeof PAINTS].color); }
    if (it.slot === 'baybay-hat') assert.ok(it.hat, `${it.id}: hat kind`);
    if (it.slot === 'frame') assert.ok(it.frame, `${it.id}: frame kind`);
    if (it.slot === 'use') assert.ok(it.use, `${it.id}: use kind`);
  }
});

test('W5-E8 prices LOCKED by the scripted economy run (plan MF5 / D21) and nothing sells speed, access or places', () => {
  // scripts/opus-sf/economy-run.mts (the typical profile: hour 1 = 449 coins ≈ 5.2 cosmetics at the average price 85.7,
  // one about every 11–12 minutes; the whole wardrobe, 1,970, after about 7 hours): the plan's ratios × ≈ 1.8
  const price = (slot: string) => [...new Set(I.ITEMS.filter(it => it.slot === slot && I.forSale(it)).map(it => it.price))];
  assert.deepEqual(price('baybay-scarf'), [70]);
  assert.deepEqual(price('baybay-hat'), [150]);
  assert.deepEqual(price('player-hat'), [50]);
  assert.deepEqual(price('player-pack'), [50]);
  assert.deepEqual(price('bike'), [110]);
  assert.deepEqual(price('car'), [110]);
  assert.deepEqual(price('pelican'), [90]);
  assert.deepEqual(price('frame'), [60]);
  assert.equal(I.itemById('compass')!.price, 20);
  assert.equal(I.itemById('magnifier')!.price, 20);
  assert.equal(I.itemById('fly-ticket')!.price, 10);
  const sale = I.ITEMS.filter(I.forSale);
  assert.ok(sale.length >= 24 && sale.length <= 30, `≈ 27 items (${sale.length} for sale)`);
  const wear = sale.filter(it => it.slot !== 'use').reduce((n, it) => n + it.price, 0);
  assert.equal(wear, 1970, 'the wardrobe: 23 wearables');
  // earned items are never sold; each full notebook page gives one
  for (const [page, id] of Object.entries(I.PAGE_ITEM)) { const it = I.itemById(id)!; assert.equal(it.earn, page); assert.equal(it.price, 0); assert.equal(I.forSale(it), false); }
  // conveniences point the way; wearables are looks: the only `use` kinds
  assert.deepEqual([...new Set(I.ITEMS.filter(it => it.slot === 'use').map(it => it.use))].sort(), ['compass', 'fly-gift', 'fly-ticket', 'magnifier']);
  // the economy never unlocks, discovers, completes or speeds anything up
  const dir = path.join(ROOT, 'src/opus-bay/economy');
  for (const f of fs.readdirSync(dir).filter(f => /\.tsx?$/.test(f))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(text, /\b(setGlideUnlocked|markDiscovered|completeGoal|markGoalsDone|visitZone|RUN_SPEED|WALK_SPEED|setSpeed)\b/, `${f} changes speed / access / places`);
  }
});

test('W5-E6 buy: the price comes off once, the item is owned and worn; short, owned and unknown change nothing', () => {
  fresh(30);
  const coins: { delta: number; source: string }[] = [], shop: { what: string; item?: string }[] = [];
  const off = onEvent(e => { if (e.type === 'coins') coins.push({ delta: e.delta, source: e.source }); if (e.type === 'shop') shop.push({ what: e.what, item: e.item }); });
  try {
    assert.equal(W.buy('scarf-fog', { pelican: false }), 'short', '70 > 30');
    assert.equal(L.coinsTotal(), 30);
    assert.equal(W.owns('scarf-fog'), false);
    L.commitPlay(p => ({ ...p, c: 100 }));
    assert.equal(W.buy('scarf-fog', { pelican: false }), 'ok');
    assert.equal(L.coinsTotal(), 30);
    assert.equal(W.owns('scarf-fog'), true);
    assert.equal(W.wornItem('baybay-scarf')?.id, 'scarf-fog', 'worn at once');
    assert.equal(W.buy('scarf-fog', { pelican: false }), 'owned');
    assert.equal(L.coinsTotal(), 30, 'twice: nothing more taken');
    assert.equal(W.buy('nope', { pelican: false }), 'unknown');
    assert.equal(W.buy('frame-golden', { pelican: false }), 'not-for-sale');
    assert.equal(W.buy('fly-gift', { pelican: false }), 'not-for-sale');
    assert.deepEqual(coins.filter(c => c.delta < 0), [{ delta: -70, source: 'shop:scarf-fog' }]);
    assert.deepEqual(shop, [{ what: 'buy', item: 'scarf-fog' }, { what: 'wear', item: 'scarf-fog' }]);
  } finally { off(); }
});

test('W5-E6 wear / take off: only owned wearables, one per slot, the default look back', () => {
  fresh(500);
  assert.equal(W.wear('scarf-maroon'), false, 'not owned');
  assert.equal(W.buy('scarf-maroon', { pelican: false }), 'ok');
  assert.equal(W.buy('scarf-cream', { pelican: false }), 'ok');
  assert.equal(W.wornItem('baybay-scarf')?.id, 'scarf-cream', 'the latest buy is worn');
  assert.equal(W.wear('scarf-maroon'), true);
  assert.equal(W.wornItem('baybay-scarf')?.id, 'scarf-maroon');
  assert.equal(W.buy('hat-sailor', { pelican: false }), 'ok');
  assert.deepEqual(Object.entries(W.wornAll()).filter(([, v]) => v), [['baybay-scarf', 'scarf-maroon'], ['baybay-hat', 'hat-sailor']]);
  assert.equal(W.takeOff('baybay-scarf'), true);
  assert.equal(W.wornItem('baybay-scarf'), null);
  assert.equal(W.takeOff('baybay-scarf'), false, 'already the default');
  assert.equal(W.wear('compass'), false, 'a convenience is not worn');
  // an index in play.w that is not owned (a hand-edited save) is not worn
  L.commitPlay(p => ({ ...p, w: { ...(p.w ?? {}), frame: I.itemIndex('frame-night') } }));
  assert.equal(W.wornItem('frame'), null);
});

test('W5-E6 earned items: a full page gives one once, for free; the shop shows it locked until then', () => {
  fresh(0);
  assert.equal(W.canBuy('frame-golden', { pelican: false }), 'not-for-sale');
  assert.equal(W.grant('frame-golden'), true);
  assert.equal(W.grant('frame-golden'), false, 'once');
  assert.equal(L.coinsTotal(), 0);
  assert.equal(W.wear('frame-golden'), true);
  assert.equal(W.wornItem('frame')?.id, 'frame-golden');
  assert.ok(I.shelfItems('photos', false).some(it => it.id === 'frame-golden'), 'shown on its shelf');
});

test('W5-E6 the 飞行券: BAYBAY gives the first before the pelican (once), one held at a time, hidden and refunded after the unlock', () => {
  fresh(0);
  assert.equal(W.giveFirstTicket(true), false, 'the pelican is out: no gift');
  assert.equal(W.holds('fly-ticket'), false);
  assert.equal(W.giveFirstTicket(false), true);
  assert.equal(W.holds('fly-ticket'), true);
  assert.equal(W.giveFirstTicket(false), false, 'once per save');
  assert.equal(W.consume('fly-ticket'), true, 'flown');
  assert.equal(W.holds('fly-ticket'), false);
  assert.equal(W.giveFirstTicket(false), false, 'the gift stays given after it is used');
  L.commitPlay(p => ({ ...p, c: 25 }));
  assert.equal(W.buy('fly-ticket', { pelican: false }), 'ok');
  assert.equal(L.coinsTotal(), 15);
  assert.equal(W.buy('fly-ticket', { pelican: false }), 'owned', 'one held at a time');
  assert.equal(W.ticketRule(false), 0, 'before the unlock nothing happens');
  const seen: number[] = [];
  const off = onEvent(e => { if (e.type === 'coins') seen.push(e.delta); });
  try {
    assert.equal(W.ticketRule(true), I.TICKET_REFUND);
    assert.equal(W.ticketRule(true), 0, 'refunded once');
  } finally { off(); }
  assert.deepEqual(seen, [10]);
  assert.equal(L.coinsTotal(), 25);
  assert.equal(W.canBuy('fly-ticket', { pelican: true }), 'after-pelican');
  assert.ok(!I.shelfItems('helpers', true).some(it => it.use === 'fly-ticket'), 'hidden after the unlock');
  assert.ok(I.shelfItems('helpers', false).some(it => it.use === 'fly-ticket'));
  assert.ok(!I.shelfItems('helpers', false).some(it => it.hidden), 'the gift marker never shows');
});

test('W5-E6 conveniences: bought = on for one outing, used up by the find, then for sale again', () => {
  fresh(60);
  assert.equal(W.buy('compass', { pelican: true }), 'ok');
  assert.equal(W.holds('compass'), true);
  assert.equal(W.buy('compass', { pelican: true }), 'owned');
  assert.equal(W.consume('compass'), true);
  assert.equal(W.consume('compass'), false);
  assert.equal(W.buy('compass', { pelican: true }), 'ok', 'again');
  assert.equal(L.coinsTotal(), 20);
  assert.equal(W.consume('scarf-fog'), false, 'a wearable is never used up');
});

test('W5-E6 bits: bitClear / bitList agree with a set model (fuzz) and keep playSave\'s normal form', () => {
  const r = rng(7);
  for (let round = 0; round < 200; round++) {
    const model = new Set<number>();
    let b = '';
    for (let k = 0; k < 40; k++) {
      const i = Math.floor(r() * 300);
      if (r() < 0.6) { b = bitSet(b, i); model.add(i); } else { b = bits.bitClear(b, i); model.delete(i); }
      assert.equal(normalBits(b), b, 'normal form');
    }
    assert.deepEqual(bits.bitList(b), [...model].sort((x, y) => x - y));
    let rebuilt = '';
    for (const i of model) rebuilt = bitSet(rebuilt, i);
    assert.equal(b, rebuilt, 'the same string bitSet builds');
  }
  assert.equal(bits.bitClear(bitSet('', 3), 3), '', 'the empty set is the empty string');
  assert.equal(bits.bitClear('', 5000), '');
  assert.equal(bitGet(bits.bitClear(bitSet(bitSet('', 1), 9), 9), 1), true);
});

test('W5-E6 the play block round-trips through the save (own, stamp, w) and decodes clean', () => {
  fresh(300);
  W.buy('hat-beanie', { pelican: false });
  W.buy('frame-fog', { pelican: false });
  W.grant('frame-postmark');
  const p = L.playState();
  const text = save.encodeSave(save.readSave()!);
  const back = decodePlay(JSON.parse(text).play)!;
  assert.deepEqual(back, p);
  assert.equal(back.w?.['baybay-hat'], I.itemIndex('hat-beanie'));
  assert.equal(back.w?.frame, I.itemIndex('frame-fog'));
});

/** A charApi that records what it is asked. */
function stubApi() {
  const calls: string[] = [];
  const api: import('../src/opus-bay/actors/charApi').CharApi = {
    emote: (who, name) => { calls.push(`emote ${who} ${name}`); },
    sitGround: () => false,
    stand: () => undefined,
    attach: (who, slot, obj) => { calls.push(`attach ${who} ${slot} ${obj ? obj.name : 'null'}`); },
    tint: (who, part, color) => { calls.push(`tint ${who} ${part} ${color === null ? 'null' : color.toString(16)}`); },
    vehiclePaint: (kind, id) => { calls.push(`paint ${kind} ${id}`); },
    glideSoftBox: () => undefined,
  };
  return { api, calls };
}

test('W5-E7 the looks through charApi: only what differs from the default, again after a change, try-on and back', () => {
  fresh(1000);
  const { api, calls } = stubApi();
  assert.equal(wearMod.syncLooks(api), 0, 'nothing worn: nothing sent to a new implementation');
  W.buy('scarf-orange', { pelican: false });
  W.buy('hat-sun', { pelican: false });
  W.buy('my-pack-gold', { pelican: false });
  W.buy('bike-dahlia', { pelican: false });
  W.buy('ribbon-orange', { pelican: false });
  wearMod.syncLooks(api);
  assert.deepEqual(calls.sort(), ['attach baybay head ob-hat-sun', 'paint bike dahlia', 'paint pelican orange', 'tint baybay scarf c44a31', 'tint player pack e0a94a'].sort());
  calls.length = 0;
  assert.equal(wearMod.syncLooks(api), 0, 'unchanged: nothing sent again');
  // try-on in the shop, then close
  W.buy('scarf-fog', { pelican: false });
  W.wear('scarf-orange');
  wearMod.syncLooks(api);
  calls.length = 0;
  charApiMod.setCharApi(api);
  try {
    wearMod.setPreview('baybay-hat', 'hat-beanie');
    wearMod.setPreview('baybay-scarf', null);
    assert.deepEqual(calls, ['attach baybay head ob-hat-beanie', 'tint baybay scarf null']);
    assert.equal(wearMod.lookOf('baybay-hat')?.id, 'hat-beanie');
    calls.length = 0;
    wearMod.clearPreview();
    assert.deepEqual(calls.sort(), ['attach baybay head ob-hat-sun', 'tint baybay scarf c44a31'].sort(), 'the worn looks come back');
    wearMod.setPreview('baybay-hat', 'scarf-fog');
    assert.equal(wearMod.lookOf('baybay-hat')?.id, 'hat-sun', 'an item of another slot is not tried on');
    // a new implementation (the actors remount) gets every worn look again
    const second = stubApi();
    wearMod.syncLooks(second.api);
    assert.equal(second.calls.length, 5);
  } finally { charApiMod.setCharApi(null); wearMod.__resetWearForTests(); }
});

test('W5-E7 the hats: small toy meshes on the TOY_DYN program, no shadow, inside the head slot', () => {
  for (const kind of ['beanie', 'sun', 'sailor'] as const) {
    const m = hats.hatMesh(kind);
    assert.ok(hats.hatTriangles(kind) <= 420, `${kind}: ${hats.hatTriangles(kind)} triangles`);
    assert.equal(m.castShadow, false);
    assert.equal(m.receiveShadow, false);
    assert.equal(m.material, hats.hatMaterial(), 'one material instance for every hat');
    for (const a of ['position', 'normal', 'color', 'aInfo']) assert.ok(m.geometry.getAttribute(a), `${kind}: ${a}`);
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox!;
    assert.ok(b.min.y > -0.12 && b.max.y < 0.36, `${kind}: sits on the crown (${b.min.y.toFixed(2)} … ${b.max.y.toFixed(2)})`);
    assert.ok(Math.max(-b.min.x, b.max.x) <= 0.43, `${kind}: ${b.max.x.toFixed(2)} wide`);
  }
  assert.equal(hats.hatMaterial().customProgramCacheKey(), 'ob-toy-dyn', 'the warmed TOY_DYN program');
  const set = hats.hatWarmup();
  assert.equal(set.objects.length, 1);
  assert.equal((set.objects[0] as import('three').Mesh).material, hats.hatMaterial(), 'warmed with the real material instance');
  set.dispose?.();
});

/** A 2D context that records the calls (enough for the frames). */
function fakeCtx() {
  const calls: string[] = [];
  const grad = { addColorStop: () => undefined };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, k: string) => {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
      return (...args: unknown[]) => { calls.push(`${k}${k === 'clip' ? `:${String(args[0])}` : ''}`); };
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

test('W5-E7 the frames paint only the card\'s ring (clipped even-odd), thin enough to miss the caption', () => {
  for (const kind of ['fog', 'golden', 'night', 'postmark', 'sounds'] as const) {
    const { ctx, calls } = fakeCtx();
    const f = { ctx, width: 1340, height: 1003, photo: { x: 36, y: 36, w: 1268, h: 840 }, band: { x: 0, y: 876, w: 1340, h: 127 }, pad: 36, caption: 'x', stamp: 'y', at: new Date() };
    frames.drawFrame(kind, f);
    assert.equal(calls[0], 'save');
    assert.ok(calls.indexOf('clip:evenodd') > 0 && calls.indexOf('clip:evenodd') < calls.findIndex(c => c === 'fillRect' || c === 'fill'), `${kind}: clipped before painting`);
    assert.equal(calls.at(-1), 'restore');
    const t = frames.ringWidth(f);
    assert.ok(t <= f.pad * 0.6 && t <= f.band.h * 0.25, `${kind}: ring ${t}`);
  }
});

test('W5-E6 E\'s BAYBAY lines: zh ≤ 45 characters, en ≤ 110; the glossary words', () => {
  for (const [key, l] of Object.entries(E_LINES)) {
    assert.ok([...l.zh].length <= 45, `${key}: ${[...l.zh].length}`);
    assert.ok(l.en.length <= 110, `${key}: en ${l.en.length}`);
    assert.doesNotMatch(l.zh, /硬币|商店|笔记本|机票|传送券/, `${key}: VOICE.md words`);
  }
  assert.match(E_LINES.ticketRefund.zh, /10 金币/);
});

test('W5-E6 the compass maths: the arrow points where the target is on screen; real distances in 米 / 公里', () => {
  // camera at yaw 0 sits south of the player (+z) and looks north (−z): a target straight north is up (0)
  const up = compass.screenAngle(0, 0, 0, -50, 0);
  assert.ok(Math.abs(Math.sin(up)) < 1e-9 && Math.cos(up) > 0.99, `north ahead: ${up}`);
  // east (+x) is to the right: +90°
  const right = compass.screenAngle(0, 0, 50, 0, 0);
  assert.ok(Math.abs(Math.sin(right) - 1) < 1e-9, `east right: ${right}`);
  assert.equal(compass.distanceText(83, true), '80米');
  assert.equal(compass.distanceText(1234, true), '1.2公里');
  assert.equal(compass.distanceText(4, false), '10m');
  const m = compass.realMetres({ x: 0, z: 0 }, { x: 100, z: 0 });
  assert.ok(m > 100 && m < 2000, `100 u ≈ ${m.toFixed(0)} m`);
});

test('W5-E6 the sheet renders in node: shelves, tiles with prices, owned and worn marks; the helpers shelf hides the ticket after the pelican', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { ShopSheet } = await import('../src/opus-bay/economy/Shop');
  styles.deregister();
  fresh(95);
  W.buy('scarf-dahlia', { pelican: false });
  const html = renderToStaticMarkup(h(ShopSheet, { props: { from: 'more' }, close: () => undefined }));
  assert.match(html, /BAYBAY 小铺/);
  assert.match(html, /🪙<\/span>25/, 'the balance');
  for (const s of ['BAYBAY', '我', '坐骑', '相框', '小帮手']) assert.match(html, new RegExp(`role="tab"[^>]*>${s}<`), `shelf ${s}`);
  assert.match(html, /大丽花粉[^]*?穿着/, 'the bought scarf is worn');
  assert.match(html, /雾灰[^]*?🪙<\/span>70/, 'a price on a tile');
  assert.match(html, /aria-label="寻宝金围巾 · 集满手帐「小发现」页"/, 'the earned scarf is locked with how to get it');
  const helpers = renderToStaticMarkup(h(ShopSheet, { props: { shelf: 'helpers' }, close: () => undefined }));
  assert.match(helpers, /飞行券/);
});
