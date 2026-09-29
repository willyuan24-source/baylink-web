import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 6 · lane G (W6-G3) · the Halloween costumes: the four shop items (append-only, seasonal), the gate (sold only in
 * season, owned ones stay shown), the geometry budget (≤ 420 triangles, the hats' material), what wear.ts sends for them
 * (BAYBAY's hats attach, the player's costumes attach to the head and clear the hat tint), and costume:first.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };

const items = await import('../src/opus-bay/economy/items');
const { hatGeometry, hatMaterial } = await import('../src/opus-bay/economy/hats');
const costumeMesh = await import('../src/opus-bay/halloween/costumeMesh');
const { HALLOWEEN_REWARD_IDS } = await import('../src/opus-bay/halloween/rewards');

const COSTUMES = ['hat-witch', 'hat-pumpkin', 'my-cat-ears', 'my-ghost'];

test('W6-G3 costumes: four seasonal items appended after every wave-5 item, priced, each with a costume kind and a note', () => {
  const ids = items.ITEMS.map(i => i.id);
  // append-only: the wave-5 items keep their indices; the costumes come after the last of them (frame-sounds)
  const last5 = ids.indexOf('frame-sounds');
  assert.ok(last5 >= 0);
  for (const id of COSTUMES) {
    const i = ids.indexOf(id);
    assert.ok(i > last5, `${id} appended`);
    const it = items.ITEMS[i];
    assert.equal(it.season, 'halloween');
    assert.ok(it.costume, `${id}: costume`);
    assert.ok(it.price > 0 && Number.isInteger(it.price));
    assert.ok([...it.short.zh].length <= 5 && it.short.en.length <= 13, `${id}: tile label`);
    assert.ok(it.note);
  }
  assert.equal(items.itemById('hat-witch')!.slot, 'baybay-hat');
  assert.equal(items.itemById('hat-pumpkin')!.slot, 'baybay-hat');
  assert.equal(items.itemById('my-cat-ears')!.slot, 'player-hat');
  assert.equal(items.itemById('my-ghost')!.slot, 'player-hat');
  assert.ok(HALLOWEEN_REWARD_IDS.includes('costume:first'));
});

test('W6-G3 the season gate: without it a costume is neither sold nor shown; in season sold and shown; out of season shown only when owned', () => {
  const witch = items.itemById('hat-witch')!;
  assert.equal(items.forSale(witch), false);
  assert.ok(!items.shelfItems('baybay', false).includes(witch));
  // the other items do not care
  assert.equal(items.forSale(items.itemById('hat-beanie')!), true);
  let season = true;
  const owned = new Set<string>();
  const off = items.setSeasonGate({ onSale: it => it.season === 'halloween' && season, shown: it => it.season === 'halloween' && (season || owned.has(it.id)) });
  try {
    assert.equal(items.forSale(witch), true);
    assert.ok(items.shelfItems('baybay', false).includes(witch));
    assert.ok(items.shelfItems('me', false).some(i => i.id === 'my-ghost'));
    season = false;
    assert.equal(items.forSale(witch), false);
    assert.ok(!items.shelfItems('baybay', false).includes(witch));
    owned.add('hat-witch');
    assert.ok(items.shelfItems('baybay', false).includes(witch), 'owned: still on the shelf (wearable)');
    assert.equal(items.forSale(witch), false);
  } finally {
    off();
  }
  assert.equal(items.forSale(witch), false);
});

test('W6-G3 geometry: the witch hat and the pumpkin head through hats.ts, the cat ears and the ghost sheet, ≤ 420 triangles each, on the hats\' material', () => {
  for (const kind of ['witch', 'pumpkin'] as const) {
    const geo = hatGeometry(kind);
    const tris = costumeMesh.trianglesOfGeometry(geo);
    assert.ok(tris > 20 && tris <= 420, `${kind}: ${tris}`);
    assert.ok(geo.getAttribute('aInfo') && geo.getAttribute('color'), `${kind}: a TOY geometry`);
  }
  for (const kind of ['cat-ears', 'ghost'] as const) {
    const m = costumeMesh.playerCostumeMesh(kind);
    const tris = costumeMesh.trianglesOfGeometry(m.geometry);
    assert.ok(tris > 20 && tris <= 420, `${kind}: ${tris}`);
    assert.equal(m.material, hatMaterial());
    assert.equal(m.castShadow, false);
    assert.equal(costumeMesh.playerCostumeMesh(kind), m, 'one mesh per kind, kept');
  }
  // the ghost sheet covers the bean (±0.45 wide) and stops above the feet
  const box = costumeMesh.playerCostumeMesh('ghost').geometry.boundingBox ?? (costumeMesh.playerCostumeMesh('ghost').geometry.computeBoundingBox(), costumeMesh.playerCostumeMesh('ghost').geometry.boundingBox!);
  assert.ok(box.max.x >= 0.5 && box.min.x <= -0.5 && box.max.y > 0.3 && box.min.y > -1.2, JSON.stringify(box));
  // the pumpkin's face glows at night
  const info = hatGeometry('pumpkin').getAttribute('aInfo');
  let lit = 0;
  for (let i = 0; i < info.count; i++) if (info.getW(i) > 0 && info.getW(i) <= 1) lit++;
  assert.ok(lit > 0);
});

test('W6-G3 wear: the player\'s costume attaches to the head and clears the hat tint; a plain hat detaches it; BAYBAY\'s costume hats attach', async () => {
  const wear = await import('../src/opus-bay/economy/wear');
  const calls: string[] = [];
  const api = {
    emote: () => {}, sitGround: () => false, stand: () => {}, glideSoftBox: () => {},
    attach: (who: string, slot: string, obj: { name?: string } | null) => { calls.push(`attach ${who} ${slot} ${obj?.name ?? 'null'}`); },
    tint: (who: string, part: string, c: number | null) => { calls.push(`tint ${who} ${part} ${c}`); },
    vehiclePaint: () => {},
  };
  wear.__resetWearForTests();
  wear.setPreview('player-hat', 'my-ghost');
  wear.syncLooks(api as never);
  assert.ok(calls.includes('attach player head ob-costume-ghost'), calls.join(' | '));
  assert.ok(calls.includes('tint player hat null'));
  calls.length = 0;
  wear.setPreview('player-hat', 'my-hat-maroon');
  wear.syncLooks(api as never);
  assert.ok(calls.includes('attach player head null'), calls.join(' | '));
  assert.ok(calls.includes(`tint player hat ${0x8e2f3c}`));
  calls.length = 0;
  wear.setPreview('baybay-hat', 'hat-pumpkin');
  wear.syncLooks(api as never);
  assert.ok(calls.includes('attach baybay head ob-hat-pumpkin'), calls.join(' | '));
  wear.__resetWearForTests();
});
