import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

/**
 * Wave 7 · lane G · the Halloween games' polish (sf-w7-G.md part c):
 *
 *   W7-G3  seasonal items lead their shelf while on sale (economy/items.ts shelfItems)
 *   W7-G4  near a trick-or-treat street the phone pill keeps two lines (halloween/treatNear.ts CANDY_PHONE_CSS)
 *   W7-G5  the treat's toast says what it paid (the big night at a new door: door + night, ×3, +10 coins)
 *   W7-G6  the kit swap leaves the treat doors' houses alone in the season (world/sf/kitSwap.ts setKitSwapSkip,
 *          halloween/treat.ts doorOnLot)
 *   W7-G7  Belvedere: door 8 stood on a Clayton Street face at the Parnassus end (3.3 u from Clayton): gone
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };

const items = await import('../src/opus-bay/economy/items');
const near = await import('../src/opus-bay/halloween/treatNear');
const treat = await import('../src/opus-bay/halloween/treat');
const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');
const { SF_KIT } = await import('../src/opus-bay/data/assets');
const { CITY_STYLES } = await import('../src/opus-bay/world/recipes/city');
const { KIT_SWAP, KitSwap, kitChoices, setKitSwapSkip } = await import('../src/opus-bay/world/sf/kitSwap');
const { setRangeHidden } = await import('../src/opus-bay/world/sf/l0index');
type L0BuildingView = import('../src/opus-bay/world/sf/l0index').L0BuildingView;

test('W7-G3 in season the Halloween items lead their shelves (their slot group first); out of season an owned one keeps its place', () => {
  const off = items.setSeasonGate({ onSale: it => it.season === 'halloween', shown: it => it.season === 'halloween' });
  try {
    const baybay = items.shelfItems('baybay', true).map(i => i.id);
    assert.deepEqual(baybay.slice(0, 2), ['hat-witch', 'hat-pumpkin'], baybay.join(','));
    assert.deepEqual(items.shelfItems('me', true).slice(0, 2).map(i => i.id), ['my-cat-ears', 'my-ghost']);
    assert.equal(items.shelfItems('rides', true)[0].id, 'pelican-bat-wings');
    // everything else keeps its order behind them
    const plain = items.shelfItems('baybay', true).filter(i => !i.season).map(i => i.id);
    assert.deepEqual(plain, items.ITEMS.filter(i => i.shelf === 'baybay' && !i.hidden && !i.retired && !i.season).map(i => i.id));
  } finally { off(); }
  // out of season: shown only when owned, in the append order (at the end)
  const off2 = items.setSeasonGate({ onSale: () => false, shown: it => it.id === 'hat-witch' });
  try {
    const list = items.shelfItems('baybay', true).map(i => i.id);
    assert.equal(list[list.length - 1], 'hat-witch');
  } finally { off2(); }
});

test('W7-G4 the phone pill near a treat street: the goals line becomes the purse (two lines, no dangling "·"); far away the bag hides', () => {
  const css = near.CANDY_PHONE_CSS.replace(/\s+/g, ' ');
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /\.ob-pill-badge:has\(> \.ob-candy\[data-far\]\) \{ display: none; \}/);
  // near: the goals text sized to nothing, the badges at the pill's small size, the first separator gone
  assert.match(css, /\.ob-objective-text small:has\(\.ob-candy:not\(\[data-far\]\)\) \{ font-size: 0; gap: 0; \}/);
  assert.match(css, /small:has\(\.ob-candy:not\(\[data-far\]\)\) \.ob-pill-badges \{ font-size: 12px; margin-left: 0; \}/);
  assert.match(css, /\.ob-pill-badge:first-child::before \{ content: none; \}/);
  // never a rule that gives the badges a line of their own (the third line)
  assert.doesNotMatch(css, /display: flex/);
});

test('W7-G5 the toast: one candy in the season; ×2 on the big night; ×3 and +10 coins at a door never knocked before', () => {
  const c = treat.CANDIES[2];
  assert.deepEqual(treat.treatToast(c, false, 1, 5, 4), { zh: '得到巧克力！+5 金币 · 糖果袋 4 颗', en: 'Treat: chocolate bar! +5 coins · Candy bag: 4' });
  assert.deepEqual(treat.treatToast(c, true, 2, 5, 12), { zh: '双倍糖果：巧克力 ×2！+5 金币 · 糖果袋 12 颗', en: 'Double treat: chocolate bar ×2! +5 coins · Candy bag: 12' });
  assert.deepEqual(treat.treatToast(c, true, 3, 10, 3), { zh: '双倍糖果：巧克力 ×3！+10 金币 · 糖果袋 3 颗', en: 'Double treat: chocolate bar ×3! +10 coins · Candy bag: 3' });
  // the ledger gave nothing (a cap, a replay): no coin part
  assert.equal(treat.treatToast(c, false, 1, 0, 1).zh, '得到巧克力！糖果袋 1 颗');
  // what a knock pays on the big night at a new door: door + night, and the bag grows by three
  const k = treat.knockResult(7, 'night', '2026-10-31', true, () => false);
  assert.equal(k.kind, 'treat');
  if (k.kind === 'treat') {
    assert.deepEqual(k.pays.map(p => p.source), ['halloween:door:7', 'halloween:night:7']);
    const paid = new Set(k.pays.map(p => p.source));
    assert.equal(treat.candyCount(s => paid.has(s)) - treat.candyCount(() => false), 3);
  }
});

// --- a small L0 source for the kit swap (tests/opus-bay-sf-kit-swap.test.ts's fakes, trimmed) ---
const styleIdx = (s: (typeof CITY_STYLES)[number]) => CITY_STYLES.indexOf(s);
function lot(k: number, x: number, z: number, yaw = 0.3): L0BuildingView {
  const id = kitChoices('victorian')[0], [kw, kh, kd] = SF_KIT[id].size;
  return { k, osmId: 5000 + k, indexStart: k * 6, indexCount: 6, cx: x, cz: z, hx: (kw * 0.9) / 2, hz: (kd * 0.4) / 2, yaw, frontYaw: yaw, hasFront: true, baseY: 2, H: kh * 0.9 - KIT_SWAP.roof, wall: [0.8, 0.6, 0.7], slope: 0.2, style: styleIdx('victorian'), roof: 0, flags: 0 };
}
function source(lots: L0BuildingView[]) {
  const n = lots.length, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 4 * 3), 3));
  const idx = new Uint16Array(n * 6);
  for (let i = 0; i < n; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const ranges = new Uint32Array(n * 2);
  lots.forEach((_, i) => { ranges[i * 2] = i * 6; ranges[i * 2 + 1] = 6; });
  const b = { count: n, osmId: new Float64Array(n), ranges, data: new Float32Array(n * 16) }, hidden = new Map();
  return {
    quality: 'high',
    forEachL0Building(x: number, z: number, r: number, fn: (cell: number, k: number, b: L0BuildingView) => void) { for (const l of lots) if (Math.hypot(l.cx - x, l.cz - z) <= r) fn(1, l.k, l); },
    setL0BuildingHidden(_cell: number, k: number, h: boolean) { return setRangeHidden(geo, b as never, k, h, hidden as never); },
    onL0Drop() { return () => undefined; },
  };
}
const models = {
  cache: new Map<string, unknown>(),
  peek(id: string) {
    if (!(id in SF_KIT)) return null;
    let m = this.cache.get(id);
    if (!m) {
      const a = SF_KIT[id as keyof typeof SF_KIT], geo = new THREE.BoxGeometry(a.size[0], a.size[1], a.size[2]);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      m = { id, asset: a, geometry: geo, map: null, mask: null, triangles: a.triangles };
      this.cache.set(id, m);
    }
    return m as never;
  },
  retain() {}, release() {},
};

test('W7-G6 the kit swap leaves a treat door\'s house alone while the skip is set (and swaps it again after)', () => {
  const d = TREAT_DOORS.find(x => !x.gone && x.street === 'chenery')!;
  // the door's own lot: its box reaches the door (the door on its street face); a neighbour 9 u along the street
  const f = d.f, bx = d.x - Math.sin(f) * 1.1, bz = d.z - Math.cos(f) * 1.1;
  const home = lot(0, bx, bz, f), away = lot(1, bx + Math.cos(f) * 9, bz - Math.sin(f) * 9, f);
  assert.equal(treat.doorOnLot(home), true, 'the door is on its house\'s lot');
  assert.equal(treat.doorOnLot(away), false, 'not on the neighbour 9 u along');
  assert.equal(treat.doorOnLot(home, TREAT_DOORS.filter(x => x.n !== d.n)), false, 'no other door there');
  const run = (k: InstanceType<typeof KitSwap>, secs: number, t0: number) => { let t = t0; for (let i = 0; i < secs * 60; i++) { t += 1 / 60; k.update(bx, bz, t, 5); } return t; };
  const off = setKitSwapSkip(b => treat.doorOnLot(b));
  const k = new KitSwap(source([home, away]) as never, models as never);
  let t = run(k, 3, 0);
  let on = k.list().map(e => e.k).sort();
  assert.deepEqual(on, [1], 'only the neighbour swaps');
  off();
  t = run(k, 3, t);
  on = k.list().map(e => e.k).sort();
  assert.deepEqual(on, [0, 1], 'after the season both may');
  // set again with a lot already swapped: it leaves (never chosen, fades out)
  const off2 = setKitSwapSkip(b => treat.doorOnLot(b));
  run(k, 6, t);
  assert.deepEqual(k.list().filter(e => e.phase !== 'out').map(e => e.k), [1]);
  off2();
});

test('W7-G7 Belvedere: door 8 (a Clayton Street face at the Parnassus end) is gone; the other eight stay; the ids stay append-only', () => {
  const belv = TREAT_DOORS.filter(d => d.street === 'belvedere');
  assert.ok(belv.find(d => d.n === 8)?.gone, 'door 8 is gone');
  assert.deepEqual(belv.filter(d => !d.gone).map(d => d.n), [1, 2, 3, 4, 5, 6, 7, 9]);
  assert.equal(TREAT_DOORS.filter(d => !d.gone).length, 53, '53 doors to knock');
  assert.equal(Math.max(...TREAT_DOORS.map(d => d.n)), 54, 'no new number');
  assert.equal(new Set(TREAT_DOORS.map(d => d.n)).size, TREAT_DOORS.length);
});

test('W7-G8 the journal\'s 目标 tab gets a Halloween block while the season lasts (registered by halloween/play.ts, gone after it)', async () => {
  const slots = await import('../src/opus-bay/ui/slots');
  const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
  const { initHalloweenPlay } = await import('../src/opus-bay/halloween/play');
  const { HalloweenGoalsRow } = await import('../src/opus-bay/halloween/playGoalsRow');
  const ids = () => slots.goalsRows.list().map(r => r.id);
  // 12 October 2026, noon in San Francisco: in the season
  __setBayNowForTests(new Date('2026-10-12T19:00:00Z'));
  let undo = initHalloweenPlay();
  try {
    assert.deepEqual(ids(), ['g-halloween']);
    assert.equal(slots.goalsRows.get('g-halloween')?.Component, HalloweenGoalsRow);
  } finally { undo(); }
  assert.deepEqual(ids(), [], 'undone with the feature');
  // 20 November: no season, no block
  __setBayNowForTests(new Date('2026-11-20T19:00:00Z'));
  undo = initHalloweenPlay();
  try { assert.deepEqual(ids(), []); } finally { undo(); __setBayNowForTests(null); }
});
