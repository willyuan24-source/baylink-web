import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

/**
 * Wave 7 · lane G (W7-G2) · the pelican's bat wings: the approved charApi widening (sf-w7-lead.md §4 — CharWho
 * 'pelican', AttachSlot wingL / wingR; actors/charImpl.ts: the pelican slot table, the anchor on host.pelican(), a
 * re-attach on a rig change, cleared on dispose), the item (economy/items.ts, appended, seasonal, the rides shelf), what
 * economy/wear.ts sends (both wings attached, the ribbon off; the ribbon back detaches them), and the toy geometry
 * (≤ 420 triangles for the pair, the hats' material, over the wing, flapping with its bone).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };

const { runtime } = await import('../src/opus-bay/core/runtime');
const { Animator } = await import('../src/opus-bay/actors/anim');
const { buildBaybay, buildNewcomer } = await import('../src/opus-bay/actors/models');
const { CharImpl } = await import('../src/opus-bay/actors/charImpl');
const { RIBBON_HIDDEN, buildPelicanRig } = await import('../src/opus-bay/actors/vehicles/models');
const items = await import('../src/opus-bay/economy/items');
const { hatMaterial } = await import('../src/opus-bay/economy/hats');
const costumeMesh = await import('../src/opus-bay/halloween/costumeMesh');
const { hLine } = await import('../src/opus-bay/halloween/lines');

type Rig = ReturnType<typeof buildNewcomer>;

function stub() {
  const player = buildNewcomer(), guide = buildBaybay() as Rig;
  const host = { pel: null as Rig | null };
  const api = new CharImpl({
    player, guide, playerAnim: new Animator(player, 'newcomer'), guideAnim: new Animator(guide, 'baybay'),
    guideIsGlb: () => false, playerFree: () => true, guideFree: () => true, playerMoving: () => false, guideMoving: () => false,
    placePlayer: (x, z, heading) => { runtime.player.x = x; runtime.player.z = z; runtime.player.heading = heading; },
    rides: () => [], pelican: () => host.pel,
  });
  return { host, api, player };
}

const worldX = (o: THREE.Object3D) => { o.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); };

test('W7-G2 charApi: a pelican attachment waits for the rig, rides the wing bone (flaps with it), moves to a new rig, is cleared on dispose', () => {
  const { host, api, player } = stub();
  const wingL = new THREE.Object3D(), wingR = new THREE.Object3D(), hat = new THREE.Object3D();
  // before the pelican exists: kept, not parented
  api.attach('pelican', 'wingL', wingL);
  api.attach('pelican', 'wingR', wingR);
  assert.equal(wingL.parent, null);
  assert.equal(api.attachedAt('pelican', 'wingL'), wingL);
  // the rig appears: the next frame puts the wings on its wing bones
  const rig = buildPelicanRig() as Rig;
  host.pel = rig;
  api.update(0);
  assert.equal(wingL.parent?.parent, rig.bones.wingL, 'on the left wing bone');
  assert.equal(wingR.parent?.parent, rig.bones.wingR, 'on the right wing bone');
  // the wing flaps (rotation.z, + = up): the attachment follows it
  const tipOf = (o: THREE.Object3D) => { const p = new THREE.Vector3(2, 0, 0); o.updateWorldMatrix(true, false); return p.applyMatrix4(o.matrixWorld); };
  const y0 = tipOf(wingL).y;
  rig.bones.wingL.rotation.z = 0.6;
  assert.ok(tipOf(wingL).y > y0 + 0.8, 'the wing tip rises with the flap');
  rig.bones.wingL.rotation.z = 0;
  // a head item on the pelican too
  api.attach('pelican', 'head', hat);
  assert.equal(hat.parent?.parent, rig.bones.head);
  // the rig is rebuilt: the attachments move over
  const rig2 = buildPelicanRig() as Rig;
  host.pel = rig2;
  api.update(0);
  assert.equal(wingL.parent?.parent, rig2.bones.wingL);
  assert.equal(hat.parent?.parent, rig2.bones.head);
  // the rig goes: they come off (and wait)
  host.pel = null;
  api.update(0);
  assert.equal(wingL.parent, null);
  host.pel = rig2;
  api.update(0);
  assert.equal(wingR.parent?.parent, rig2.bones.wingR);
  // wing slots only on the pelican; an emote / tint on the pelican does nothing
  const stray = new THREE.Object3D();
  api.attach('player', 'wingL', stray);
  assert.equal(stray.parent, null);
  assert.equal(api.attachedAt('player', 'wingL'), null);
  api.emote('pelican', 'wave');
  api.tint('pelican', 'hat', 0xff0000);
  assert.equal(player.bones.hat.scale.x, 1, 'the player\'s hat untouched');
  // detach, and dispose clears the rest
  api.attach('pelican', 'wingL', null);
  assert.equal(wingL.parent, null);
  api.dispose();
  assert.equal(wingR.parent, null);
  assert.equal(hat.parent, null);
  // existing callers unchanged: the player's head slot still hides the bucket hat
  const { api: api2, player: p2 } = stub();
  api2.attach('player', 'head', new THREE.Object3D());
  assert.ok(p2.bones.hat.scale.x < 0.01);
  assert.ok(worldX(p2.bones.body));
});

test('W7-G2 the item: appended after every earlier item, the rides shelf, the pelican slot, seasonal, ≈ 100 coins', () => {
  const i = items.itemIndex('pelican-bat-wings');
  assert.ok(i > items.itemIndex('my-ghost'), 'appended after the wave-6 costumes');
  assert.ok(i >= 35, `index ${i}`);
  const it = items.itemById('pelican-bat-wings')!;
  assert.equal(it.shelf, 'rides');
  assert.equal(it.slot, 'pelican');
  assert.equal(it.costume, 'bat-wings');
  assert.equal(it.season, 'halloween');
  assert.ok(it.price >= 80 && it.price <= 120);
  assert.ok([...it.short.zh].length <= 5 && it.short.en.length <= 13 && [...(it.note?.zh ?? '')].length <= 24);
  // the ribbon keeps its index (the save stores wear by index)
  assert.equal(items.ITEMS[items.itemIndex('ribbon-orange')].id, 'ribbon-orange');
  // her line for it is a fixed wave-7 line (lane X voices it)
  assert.ok(hLine('w7g-costume-bat-wings').zh.includes('蝙蝠'));
});

test('W7-G2 wear: the bat wings attach to both wing bones and take the ribbon off; the ribbon back detaches them', async () => {
  const wear = await import('../src/opus-bay/economy/wear');
  const calls: string[] = [];
  const api = {
    emote: () => {}, sitGround: () => false, stand: () => {}, glideSoftBox: () => {}, tint: () => {},
    attach: (who: string, slot: string, obj: { name?: string } | null) => { calls.push(`attach ${who} ${slot} ${obj?.name ?? 'null'}`); },
    vehiclePaint: (kind: string, id: string | null) => { calls.push(`paint ${kind} ${id}`); },
  };
  wear.__resetWearForTests();
  wear.setPreview('pelican', 'pelican-bat-wings');
  wear.syncLooks(api as never);
  assert.ok(calls.includes('attach pelican wingL ob-costume-bat-wing-L'), calls.join(' | '));
  assert.ok(calls.includes('attach pelican wingR ob-costume-bat-wing-R'));
  assert.ok(calls.includes('paint pelican null'));
  calls.length = 0;
  wear.setPreview('pelican', 'ribbon-orange');
  wear.syncLooks(api as never);
  assert.ok(calls.includes('attach pelican wingL null') && calls.includes('attach pelican wingR null'), calls.join(' | '));
  assert.ok(calls.includes('paint pelican orange'));
  wear.__resetWearForTests();
  // the ribbon hides when the wings go on (charImpl's paint: null = the ribbon at scale ≈ 0)
  assert.ok(RIBBON_HIDDEN < 0.01);
});

test('W7-G2 geometry: the pair ≤ 420 triangles on the hats\' material, over each wing (mirrored), the piping glows at night', () => {
  const L = costumeMesh.pelicanBatWingMesh('L'), R = costumeMesh.pelicanBatWingMesh('R');
  assert.equal(L.material, hatMaterial());
  assert.equal(R.material, hatMaterial());
  const tris = costumeMesh.trianglesOfGeometry(L.geometry) + costumeMesh.trianglesOfGeometry(R.geometry);
  assert.ok(tris <= 420, `${tris} triangles`);
  assert.ok(tris >= 120, `${tris}: a real membrane, ribs and claws`);
  L.geometry.computeBoundingBox();
  R.geometry.computeBoundingBox();
  const bl = L.geometry.boundingBox!, br = R.geometry.boundingBox!;
  // the left wing reaches out along +x to about the wrist (the hand is on its own bone), the right one along −x
  assert.ok(bl.min.x > -0.05 && bl.max.x > 1.9 && bl.max.x < 2.2, JSON.stringify(bl));
  assert.ok(br.max.x < 0.05 && br.min.x < -1.9, JSON.stringify(br));
  // just above the feathered arm (its top ≈ 0.1), a scalloped trailing edge behind the feathers (≈ −0.52)
  assert.ok(bl.min.y >= 0.09 && bl.max.y < 0.35 && bl.min.z < -0.8 && bl.max.z > 0.45, JSON.stringify(bl));
  // the orange piping glows at night only (aInfo.w in (0, 1])
  const info = L.geometry.getAttribute('aInfo');
  let lit = 0;
  for (let i = 0; i < info.count; i++) if (info.getW(i) > 0 && info.getW(i) <= 1) lit++;
  assert.ok(lit > 0);
  assert.equal(L.castShadow, false);
});
