import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

/**
 * Wave 8 · lane H · the pelican's pumpkin bow (a Halloween costume for its neck): economy/items.ts appends
 * `pelican-pumpkin-bow` (the rides shelf, the pelican wear slot, 60 coins, in season only); economy/wear.ts attaches
 * halloween/costumeMesh.ts pelicanPumpkinBowMesh() to charApi 'pelican' 'neck' and takes the ribbon off (the bat wings'
 * pattern, W7-G2); ≤ 300 triangles on the hats' material; BAYBAY's fixed line w8h-costume-pumpkin-bow when worn.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };

const { runtime } = await import('../src/opus-bay/core/runtime');
const { Animator } = await import('../src/opus-bay/actors/anim');
const { buildBaybay, buildNewcomer } = await import('../src/opus-bay/actors/models');
const { CharImpl } = await import('../src/opus-bay/actors/charImpl');
const { buildPelicanRig } = await import('../src/opus-bay/actors/vehicles/models');
const items = await import('../src/opus-bay/economy/items');
const { MAX_WEAR_INDEX } = await import('../src/opus-bay/data/playSave');
const { hatMaterial } = await import('../src/opus-bay/economy/hats');
const costumeMesh = await import('../src/opus-bay/halloween/costumeMesh');
const { hLine } = await import('../src/opus-bay/halloween/lines');

type Rig = ReturnType<typeof buildNewcomer>;

test('W8-H the pumpkin bow: appended last (every earlier index kept), rides shelf, pelican slot, seasonal, ≈ 60 coins, short names', () => {
  const i = items.itemIndex('pelican-pumpkin-bow');
  assert.equal(i, items.ITEMS.length - 1, 'appended at the end');
  assert.equal(items.itemIndex('pelican-bat-wings'), i - 1, 'right after the bat wings (index 35 stays 35)');
  assert.ok(i <= MAX_WEAR_INDEX, 'its index fits the save\'s wear number');
  const it = items.itemById('pelican-pumpkin-bow')!;
  assert.equal(it.shelf, 'rides');
  assert.equal(it.slot, 'pelican');
  assert.equal(it.costume, 'pumpkin-bow');
  assert.equal(it.season, 'halloween');
  assert.ok(it.price >= 50 && it.price <= 70, `${it.price} coins`);
  assert.ok([...it.short.zh].length <= 5 && it.short.en.length <= 13 && [...(it.note?.zh ?? '')].length <= 24);
  assert.ok(items.forSale(it) === false, 'not on sale without the season gate');
  assert.match(hLine('w8h-costume-pumpkin-bow').zh, /南瓜领结/);
});

test('W8-H the pumpkin bow\'s mesh: ≤ 300 triangles on the hats\' material, on the pelican\'s neck slot where the ribbon\'s bow sits', () => {
  const m = costumeMesh.pelicanPumpkinBowMesh();
  assert.equal(m, costumeMesh.pelicanPumpkinBowMesh(), 'built once, kept');
  assert.equal(m.material, hatMaterial());
  assert.ok(!m.castShadow);
  const tris = costumeMesh.trianglesOfGeometry(m.geometry);
  assert.ok(tris <= 300 && tris >= 120, `${tris} triangles`);
  // on the real rig: charApi 'pelican' 'neck' puts it on the body bone on top of the hindneck, at the ribbon's own bow
    // (actors/vehicles/models.ts: mesh (±0.13, 0.06, 1.0) = body (0, 0.56, 1.0); the neck's top there at body y ≈ 0.60)
  const player = buildNewcomer(), guide = buildBaybay() as Rig;
  const rig = buildPelicanRig() as Rig;
  const api = new CharImpl({
    player, guide, playerAnim: new Animator(player, 'newcomer'), guideAnim: new Animator(guide, 'baybay'),
    guideIsGlb: () => false, playerFree: () => true, guideFree: () => true, playerMoving: () => false, guideMoving: () => false,
    placePlayer: (x, z, heading) => { runtime.player.x = x; runtime.player.z = z; runtime.player.heading = heading; },
    rides: () => [], pelican: () => rig,
  });
  try {
    api.attach('pelican', 'neck', m);
    api.update(0);
    assert.equal(m.parent?.parent, rig.bones.body, 'on the pelican\'s body bone (the neck slot)');
    m.geometry.computeBoundingBox();
    const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3());
    m.updateWorldMatrix(true, false);
    rig.bones.body.updateWorldMatrix(true, false);
    const inBody = c.clone().applyMatrix4(m.matrixWorld).applyMatrix4(rig.bones.body.matrixWorld.clone().invert());
    assert.ok(inBody.distanceTo(new THREE.Vector3(0, 0.56, 1.0)) < 0.12, `the bow's middle at (${inBody.toArray().map(v => v.toFixed(2))}) in the body`);
    const size = m.geometry.boundingBox!.getSize(new THREE.Vector3());
    assert.ok(size.x > 0.5 && size.x < 0.9, `a bow ${size.x.toFixed(2)} u wide`);
    api.attach('pelican', 'neck', null);
    assert.equal(m.parent, null);
  } finally { api.dispose(); }
});

test('W8-H wear: the pumpkin bow goes on the neck and takes the ribbon off; the ribbon back takes the bow off; wings and bow swap cleanly', async () => {
  const wear = await import('../src/opus-bay/economy/wear');
  const calls: string[] = [];
  const api = {
    emote: () => {}, sitGround: () => false, stand: () => {}, glideSoftBox: () => {}, tint: () => {},
    attach: (who: string, slot: string, obj: { name?: string } | null) => { calls.push(`attach ${who} ${slot} ${obj?.name ?? 'null'}`); },
    vehiclePaint: (kind: string, id: string | null) => { calls.push(`paint ${kind} ${id}`); },
  };
  wear.__resetWearForTests();
  try {
    wear.setPreview('pelican', 'pelican-pumpkin-bow');
    wear.syncLooks(api as never);
    assert.ok(calls.includes('attach pelican neck ob-costume-pumpkin-bow'), calls.join(' | '));
    assert.ok(calls.includes('paint pelican null'), 'the ribbon off');
    assert.ok(!calls.some(c => c.includes('wingL')), 'the wings untouched (never on)');
    calls.length = 0;
    wear.setPreview('pelican', 'pelican-bat-wings');
    wear.syncLooks(api as never);
    assert.ok(calls.includes('attach pelican neck null') && calls.includes('attach pelican wingL ob-costume-bat-wing-L'), calls.join(' | '));
    calls.length = 0;
    wear.setPreview('pelican', 'ribbon-orange');
    wear.syncLooks(api as never);
    assert.ok(calls.includes('attach pelican wingL null') && !calls.some(c => c.includes('neck')), calls.join(' | '));
    assert.ok(calls.includes('paint pelican orange'));
  } finally { wear.__resetWearForTests(); }
  // BAYBAY's line when it is worn (halloween/costume.ts), the page lists it, the shop tile draws it
  const fs = await import('node:fs');
  const read = (p: string) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(read('../src/opus-bay/halloween/costume.ts'), /'pumpkin-bow': 'w8h-costume-pumpkin-bow'/);
  assert.match(read('../src/opus-bay/halloween/HalloweenPage.tsx'), /'pelican-pumpkin-bow'\]/);
  assert.match(read('../src/opus-bay/halloween/costumeArt.tsx'), /kind === 'pumpkin-bow'/);
});
