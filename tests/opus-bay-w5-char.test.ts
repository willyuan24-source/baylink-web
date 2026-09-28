import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

/**
 * Wave 5 · W5-F2 — the charApi implementation (actors/charImpl.ts) against the frozen interface (actors/charApi.ts),
 * on the real clay rigs with a stub host (the actor system needs a canvas; its CharHost adapter is these few lines).
 */

const { runtime } = await import('../src/opus-bay/core/runtime');
const { canStand, heightAt } = await import('../src/opus-bay/core/terrain');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { EMOTES, charApi, setCharApi } = await import('../src/opus-bay/actors/charApi');
const { Animator, BODY_EMOTES, EMOTE_SECONDS, GLB_BAYBAY_TUNING } = await import('../src/opus-bay/actors/anim');
const { BAYBAY_SCARF, NEWCOMER_WEAR, baybayScarfUniforms, buildBaybay, buildNewcomer } = await import('../src/opus-bay/actors/models');
const { CharImpl, SIT_REACH } = await import('../src/opus-bay/actors/charImpl');
const { BIKE_LIVERIES, PAINTS, PAINT_IDS, PALETTE, PELICAN_RIBBON, RIBBON_HIDDEN, buildBikeRig, buildPelicanRig, buildToyCarRig } = await import('../src/opus-bay/actors/vehicles/models');
const { countColor } = await import('../src/opus-bay/actors/recolor');
const { GLIDE, GlideSim, glideSoftBoxAt, glideSoftBoxes, setGlideSoftBox } = await import('../src/opus-bay/actors/glide');
const { rayCapsuleT } = await import('../src/opus-bay/actors/system');

type Rig = ReturnType<typeof buildNewcomer>;

function stubHost() {
  const player = buildNewcomer(), guide = buildBaybay();
  const bike = { kind: 'bike' as const, rig: buildBikeRig(1), occupied: false, spot: { livery: 1 } };
  const car = { kind: 'car' as const, rig: buildToyCarRig(), occupied: false, spot: {} };
  const host = {
    player, guide: guide as Rig, glb: false,
    playerAnim: new Animator(player, 'newcomer'), guideAnim: new Animator(guide, 'baybay'),
    free: true, gfree: true, moving: false, gmoving: false,
    rides: [bike, car], pel: buildPelicanRig() as Rig | null,
  };
  const api = new CharImpl({
    get player() { return host.player; }, get guide() { return host.guide; },
    get playerAnim() { return host.playerAnim; }, get guideAnim() { return host.guideAnim; },
    guideIsGlb: () => host.glb, playerFree: () => host.free, guideFree: () => host.gfree,
    playerMoving: () => host.moving, guideMoving: () => host.gmoving,
    placePlayer: (x, z, heading) => { const p = runtime.player; p.x = x; p.z = z; p.y = heightAt(x, z); p.heading = heading; },
    rides: () => host.rides, pelican: () => host.pel,
  });
  return { host, api, bike, car };
}

/** step both animators as the actor system does (charImpl first, then the rigs) */
function frames(h: ReturnType<typeof stubHost>, seconds: number, dt = 1 / 30) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    clock += dt;
    h.api.update(dt);
    const m = { t: clock, dt, speed: 0, stride: 0, walkSpeed: 3, runSpeed: 6, grounded: true, vy: 0, crouch: 0, turnRate: 0, accel: 0, lookYaw: 0, lookWeight: 0, talking: false, riding: false };
    h.host.playerAnim.update(m);
    h.host.guideAnim.update(m);
  }
}
let clock = 0;

const colors = (g: THREE.BufferGeometry) => Float32Array.from((g.getAttribute('color') as THREE.BufferAttribute).array as ArrayLike<number>);

test('charApi: the frozen emote list plays on both heroes; one play ends by itself, a loop holds until its seconds or the next move', () => {
  const h = stubHost();
  for (const name of EMOTES) {
    assert.ok(name in EMOTE_SECONDS, `${name} is an Animator emote`);
    h.api.emote('player', name);
    assert.ok(h.host.playerAnim.playing(name), `player ${name}`);
    h.api.emote('baybay', name);
    assert.ok(h.host.guideAnim.playing(name), `baybay ${name}`);
  }
  // one play: the dance ends after its bar
  h.api.emote('baybay', 'dance');
  frames(h, EMOTE_SECONDS.dance + 0.2);
  assert.equal(h.host.guideAnim.playing(), false, 'one play ends');
  // loop with seconds
  h.api.emote('baybay', 'dance', { loop: true, seconds: 10 });
  frames(h, 6);
  assert.ok(h.host.guideAnim.playing('dance'), 'still dancing at 6 s of 10');
  frames(h, 4.5);
  assert.equal(h.host.guideAnim.playing('dance'), false, 'the loop ends at its seconds');
  // loop without seconds: until the next move
  h.api.emote('player', 'dance', { loop: true });
  frames(h, 30);
  assert.ok(h.host.playerAnim.playing('dance'), 'dancing after 30 s');
  h.host.moving = true;
  frames(h, 0.1);
  h.host.moving = false;
  frames(h, 0.6);
  assert.equal(h.host.playerAnim.playing(), false, 'a move ends it');
  // a gesture (not a whole-body mood) is not cut by walking
  h.api.emote('player', 'wave');
  h.host.moving = true;
  frames(h, 0.3);
  assert.ok(h.host.playerAnim.playing('wave'), 'waving while walking');
  h.host.moving = false;
  // whole-body moods are skipped while carried
  h.host.free = false;
  frames(h, 2);
  h.api.emote('player', 'lie', { loop: true });
  assert.equal(h.host.playerAnim.playing('lie'), false, 'no lying down on a bike');
  h.api.emote('player', 'cheer');
  assert.ok(h.host.playerAnim.playing('cheer'), 'a cheer on the bike is fine');
  h.host.free = true;
  // unknown names and bad seconds never throw
  h.api.emote('player', 'moonwalk' as never);
  h.api.emote('player', 'dance', { loop: true, seconds: Number.NaN });
  assert.ok(h.host.playerAnim.playing('dance'));
  assert.deepEqual([...BODY_EMOTES].sort(), ['dance', 'float', 'lie', 'sit']);
});

test('charApi: lie and float lay the rig on its back (root pitched, lifted), dance steps its feet on the beat, pet squints BAYBAY', () => {
  const h = stubHost();
  const root = h.host.guide.bones.root, eyes = h.host.guide.bones.eyes;
  h.api.emote('baybay', 'float', { loop: true });
  frames(h, 2);
  assert.ok(root.rotation.x < -1.3, `on her back (${root.rotation.x.toFixed(2)} rad)`);
  assert.ok(root.position.y > 0.25, `lifted (${root.position.y.toFixed(2)} u)`);
  h.api.emote('baybay', 'pet');
  frames(h, 0.4);
  assert.ok(eyes.scale.y < 0.5, `a happy squint (${eyes.scale.y.toFixed(2)})`);
  frames(h, 3);
  assert.ok(Math.abs(root.rotation.x) < 0.05, 'upright again after the pet');
  // the dance lifts one foot, then the other
  h.api.emote('player', 'dance', { loop: true });
  const fl = h.host.player.bones.footL, fr = h.host.player.bones.footR, restL = h.host.player.rest.footL.y, restR = h.host.player.rest.footR.y;
  let upL = 0, upR = 0;
  for (let i = 0; i < 60; i++) { frames(h, 1 / 30); upL = Math.max(upL, fl.position.y - restL); upR = Math.max(upR, fr.position.y - restR); }
  assert.ok(upL > 0.05 && upR > 0.05, `both feet step (${upL.toFixed(2)}, ${upR.toFixed(2)})`);
  // the GLB tuning plays them too (same bone names)
  const glbAnim = new Animator(buildBaybay(), 'baybay', GLB_BAYBAY_TUNING);
  glbAnim.play('lie', 5);
  for (let i = 0; i < 30; i++) glbAnim.update({ t: i / 30, dt: 1 / 30, speed: 0, stride: 0, walkSpeed: 3, runSpeed: 6, grounded: true, vy: 0, crouch: 0, turnRate: 0, accel: 0, lookYaw: 0, lookWeight: 0, talking: false, riding: false });
  assert.ok(glbAnim.rig.bones.root.rotation.x < -1);
});

test('charApi: sitGround sits the player on standable ground within reach (never in the water, never far, never while carried); stand() and a move get up', () => {
  const h = stubHost();
  const gate = DISTRICT.anchors['ferry-gate'];
  const p = runtime.player;
  p.x = gate.x; p.z = gate.z; p.y = heightAt(gate.x, gate.z);
  assert.ok(canStand(gate.x + 1, gate.z, 0.4));
  assert.equal(h.api.sitGround({ x: gate.x + 1, z: gate.z, heading: 1.2 }), true);
  assert.equal(p.x, gate.x + 1);
  assert.equal(p.heading, 1.2);
  assert.ok(h.host.playerAnim.playing('sit'));
  assert.equal(h.api.seated, true);
  frames(h, 20);
  assert.ok(h.host.playerAnim.playing('sit'), 'still sitting after 20 s');
  h.api.stand();
  assert.equal(h.api.seated, false);
  frames(h, 0.6);
  assert.equal(h.host.playerAnim.playing(), false);
  // a move gets up too
  assert.ok(h.api.sitGround({ x: p.x, z: p.z, heading: 0 }));
  h.host.moving = true; frames(h, 0.1); h.host.moving = false;
  assert.equal(h.api.seated, false);
  // refusals: the Bay beside the gate, too far, NaN, on a ride
  let water: { x: number; z: number } | null = null;
  for (let d = 2; d < SIT_REACH && !water; d += 0.5) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!water && !canStand(gate.x + dx * d, gate.z + dz * d, 0.4)) water = { x: gate.x + dx * d, z: gate.z + dz * d };
  p.x = gate.x; p.z = gate.z;
  assert.ok(water, 'unstandable ground near the gate');
  assert.equal(h.api.sitGround({ ...water, heading: 0 }), false, 'not standable');
  assert.equal(h.api.sitGround({ x: gate.x + SIT_REACH + 3, z: gate.z, heading: 0 }), false, 'too far');
  assert.equal(h.api.sitGround({ x: Number.NaN, z: gate.z, heading: 0 }), false, 'NaN');
  h.host.free = false;
  assert.equal(h.api.sitGround({ x: gate.x, z: gate.z, heading: 0 }), false, 'on a ride');
});

test('charApi: attach puts an object on a slot anchor (again: replaced; null: removed); a player head item hides the bucket hat; BAYBAY\'s items move to her GLB body', () => {
  const h = stubHost();
  const hat = new THREE.Object3D(), hat2 = new THREE.Object3D(), bag = new THREE.Object3D();
  h.api.attach('baybay', 'head', hat);
  assert.equal(hat.parent?.name, 'ob-slot-baybay-head');
  assert.equal(hat.parent?.parent, h.host.guide.bones.head, 'on her head bone');
  h.api.attach('baybay', 'head', hat2);
  assert.equal(hat.parent, null, 'the old one is taken off');
  assert.equal(h.api.attachedAt('baybay', 'head'), hat2);
  h.api.attach('player', 'back', bag);
  assert.equal(bag.parent?.parent, h.host.player.bones.pack);
  h.api.attach('player', 'head', hat);
  assert.ok(h.host.player.bones.hat.scale.x < 0.01, 'the bucket hat hides under a new hat');
  h.api.attach('player', 'head', null);
  assert.equal(hat.parent, null);
  assert.equal(h.host.player.bones.hat.scale.x, 1, 'and comes back');
  // the GLB swap: a new body (same bone names), the items follow, a mood goes on
  h.api.emote('baybay', 'dance', { loop: true, seconds: 30 });
  const glb = buildBaybay();
  h.host.guide = glb; h.host.glb = true; h.host.guideAnim = new Animator(glb, 'baybay', GLB_BAYBAY_TUNING);
  h.api.onGuideSwap();
  assert.equal(hat2.parent?.parent, glb.bones.head, 'the hat is on the new head');
  assert.ok(h.host.guideAnim.playing('dance'), 'still dancing on the new body');
  h.api.dispose();
  assert.equal(hat2.parent, null);
  assert.equal(bag.parent, null);
});

test('charApi: tint repaints the player\'s hat / backpack and BAYBAY\'s scarf in place (shading kept, nothing else touched); null restores every vertex exactly', () => {
  const h = stubHost();
  const pg = h.host.player.mesh.geometry, before = colors(pg);
  h.api.tint('player', 'hat', 0x2f6fb0);
  const after = colors(pg);
  let changed = 0;
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) changed++;
  assert.ok(changed > 300, `hat vertices repainted (${changed} channels)`);
  assert.ok(countColor(pg, NEWCOMER_WEAR.pack) > 0, 'the pack keeps its own colour');
  assert.equal(countColor(pg, NEWCOMER_WEAR.hat), 0, 'no terracotta left on the hat');
  h.api.tint('player', 'pack', 0xd8668f);
  h.api.tint('player', 'hat', null);
  h.api.tint('player', 'pack', null);
  assert.deepEqual(colors(pg), before, 'null restores exactly');
  // BAYBAY's scarf: the procedural body repaints; the GLB keys it in the shader
  const gg = h.host.guide.mesh.geometry, g0 = colors(gg);
  h.api.tint('baybay', 'scarf', 0xc0362c);
  assert.notDeepEqual(colors(gg), g0);
  assert.equal(baybayScarfUniforms.scarfOn.value, 1);
  assert.ok(Math.abs(baybayScarfUniforms.scarfTint.value.getHex() - 0xc0362c) < 0x020202);
  assert.equal(countColor(gg, BAYBAY_SCARF.color), 0, 'no teal left in the scarf');
  h.api.tint('baybay', 'scarf', null);
  assert.deepEqual(colors(gg), g0);
  assert.equal(baybayScarfUniforms.scarfOn.value, 0);
  // parts with nothing to tint: no-ops, no throw
  h.api.tint('player', 'scarf', 0xffffff);
  h.api.tint('baybay', 'hat', 0xffffff);
  h.api.tint('player', 'hat', Number.NaN);
  assert.deepEqual(colors(pg), before);
});

test('charApi: vehiclePaint — the ridden bike wears the paint (its livery back on getting off), every toy car, the pelican ribbon (hidden without one); unknown ids change nothing', () => {
  const h = stubHost();
  const bg = h.bike.rig.mesh.geometry, b0 = colors(bg);
  const [frame] = BIKE_LIVERIES[1];
  h.api.vehiclePaint('bike', 'maroon');
  h.api.update(0.016);
  assert.deepEqual(colors(bg), b0, 'a parked bike keeps its livery');
  h.bike.occupied = true;
  h.api.update(0.016);
  assert.equal(countColor(bg, frame), 0, 'no terracotta frame left while riding');
  assert.ok(countColor(bg, PAINTS.maroon.color) > 100, 'maroon');
  h.bike.occupied = false;
  h.api.update(0.016);
  assert.deepEqual(colors(bg), b0, 'its livery comes back');
  // the car: always
  const cg = h.car.rig.mesh.geometry, c0 = colors(cg);
  h.api.vehiclePaint('car', 'teal');
  assert.notDeepEqual(colors(cg), c0);
  assert.equal(countColor(cg, PALETTE.terracotta), 0);
  h.api.vehiclePaint('car', null);
  assert.deepEqual(colors(cg), c0);
  // the pelican's ribbon
  const pel = h.host.pel!;
  h.api.update(0.016);
  assert.ok(pel.bones.ribbon.scale.x <= RIBBON_HIDDEN, 'no ribbon by default');
  h.api.vehiclePaint('pelican', 'dahlia');
  assert.equal(pel.bones.ribbon.scale.x, 1);
  assert.equal(countColor(pel.mesh.geometry, PELICAN_RIBBON), 0, 'not orange any more');
  assert.ok(countColor(pel.mesh.geometry, PAINTS.dahlia.color) > 50, 'painted dahlia');
  h.api.vehiclePaint('pelican', 'nope');
  assert.equal(h.api.paintOf('pelican'), 'dahlia', 'an unknown id changes nothing');
  h.api.vehiclePaint('pelican', null);
  assert.ok(pel.bones.ribbon.scale.x <= RIBBON_HIDDEN);
  // the table
  assert.deepEqual(PAINT_IDS.slice(0, 3), ['teal', 'terracotta', 'gold'], 'the parked bikes\' liveries first (append-only)');
  for (const id of PAINT_IDS) assert.ok(PAINTS[id].name.zh && PAINTS[id].name.en && PAINTS[id].color && PAINTS[id].dark);
});

test('charApi: glideSoftBox — the pelican turns back before a box (the model edge\'s gentle turn), steers out when inside, flies under a box\'s minY; keyed, null removes', () => {
  const world = {
    heightAt: () => 0, inWorld: () => true, roofAt: () => -Infinity, landingSpot: () => null,
    avoid: (x: number, z: number, y: number) => glideSoftBoxAt(x, z, y),
  };
  const box = { minX: -200, maxX: 200, minZ: 150, maxZ: 400 };
  setGlideSoftBox('test-air', box, { zh: '我们在旁边看就好', en: 'Let’s watch from here' });
  assert.equal(glideSoftBoxes().length, 1);
  const fly = (y: number, minY?: number) => {
    setGlideSoftBox('test-air', minY === undefined ? box : { ...box, minY });
    const g = new GlideSim();
    g.x = 0; g.z = 0; g.y = y; g.heading = 0; g.stage = 'flight'; g.speed = GLIDE.cruise;
    let entered = false, turned = false;
    for (let i = 0; i < 30 * 40; i++) {
      const r = g.step(1 / 30, { pitch: 0, steer: 0, boost: false, slow: false }, world);
      if (r.softBox) turned = true;
      if (g.x > box.minX && g.x < box.maxX && g.z > box.minZ && g.z < box.maxZ) entered = true;
    }
    return { entered, turned };
  };
  const a = fly(40);
  assert.ok(a.turned && !a.entered, 'turned back, never in');
  const b = fly(40, 120);
  assert.ok(!b.turned && b.entered, 'under the box\'s floor it is open sky');
  // inside already: out by the nearest side
  setGlideSoftBox('test-air', box);
  const g = new GlideSim();
  g.x = 0; g.z = 170; g.y = 40; g.heading = 0; g.stage = 'flight';
  let out = false;
  for (let i = 0; i < 30 * 20 && !out; i++) { g.step(1 / 30, { pitch: 0, steer: 0, boost: false, slow: false }, world); out = !glideSoftBoxAt(g.x, g.z, g.y); }
  assert.ok(out, 'steered out');
  // bad boxes are ignored, null removes
  setGlideSoftBox('bad', { minX: 5, maxX: 1, minZ: 0, maxZ: 1 });
  setGlideSoftBox('nan', { minX: Number.NaN, maxX: 1, minZ: 0, maxZ: 1 });
  assert.deepEqual(glideSoftBoxes().map(x => x.key), ['test-air']);
  const h = stubHost();
  h.api.glideSoftBox('test-air', null);
  assert.equal(glideSoftBoxes().length, 0);
});

test('charApi: registered and cleared through setCharApi; the self-tap body is a capsule round the drawn player', () => {
  const h = stubHost();
  setCharApi(h.api);
  assert.equal(charApi(), h.api);
  setCharApi(null);
  assert.equal(charApi(), null);
  // a ray from the camera down onto the player's middle hits; one beside or above misses
  const o = { x: 0, y: 8, z: 10 };
  const aim = (x: number, y: number, z: number) => { const d = new THREE.Vector3(x - o.x, y - o.y, z - o.z).normalize(); return { x: d.x, y: d.y, z: d.z }; };
  assert.ok(rayCapsuleT(o, aim(0, 0.8, 0), 0, 0, 0, 0.6, 1.7) > 0, 'hit');
  assert.equal(rayCapsuleT(o, aim(1.4, 0.8, 0), 0, 0, 0, 0.6, 1.7), -1, 'miss beside');
  assert.equal(rayCapsuleT(o, aim(0, 3, -4), 0, 0, 0, 0.6, 1.7), -1, 'miss above');
});
