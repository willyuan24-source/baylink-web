import assert from 'node:assert/strict';
import test from 'node:test';
import type { SurfaceKind } from '../src/opus-bay/core/types';
import { canStand, heightAt, surfaceAt } from '../src/opus-bay/core/terrain';
import { DISTRICT } from '../src/opus-bay/data/district';
import { NO_DRIVE, TERRAIN_WORLD, VehicleSim, findFit, poseCheck, type DriveInput, type StepReport, type VehicleWorld } from '../src/opus-bay/actors/vehicles/collide';
import { BIKE_SPEC, bikeLean, createBike } from '../src/opus-bay/actors/vehicles/bike';
import { CAR_SPEC, carRoll, createToyCar } from '../src/opus-bay/actors/vehicles/toyCar';
import { GLIDE, GlideSim, NO_GLIDE_INPUT, type GlideWorld } from '../src/opus-bay/actors/glide';
import { gradeFactor, GradeTracker } from '../src/opus-bay/actors/controller';

const DT = 1 / 60;

/** Synthetic world: surface everywhere unless `wall` / `surf` say otherwise; height from `h`. */
function world(o: { h?: (x: number, z: number) => number; wall?: (x: number, z: number, r: number) => boolean; surf?: (x: number, z: number) => SurfaceKind | null } = {}): VehicleWorld {
  return {
    heightAt: o.h ?? (() => 0),
    surfaceAt: o.surf ?? (() => 'road'),
    blocked: o.wall ?? (() => false),
    inWorld: () => true,
  };
}
const drive = (p: Partial<DriveInput>): DriveInput => ({ ...NO_DRIVE, ...p });

function run(sim: VehicleSim, seconds: number, input: DriveInput | ((t: number) => DriveInput), w: VehicleWorld, each?: (r: StepReport, t: number) => void) {
  for (let t = 0; t < seconds; t += DT) {
    const r = sim.step(DT, typeof input === 'function' ? input(t) : input, w);
    each?.(r, t);
  }
}

test('toy car: top speed 14 u/s on the flat, reverse 4.5, brakes hard, coasts to a stop', () => {
  const car = createToyCar();
  const w = world();
  car.place(0, 0, 0, w);
  run(car, 6, drive({ throttle: 1 }), w);
  assert.ok(car.v > 13.3 && car.v <= 14.001, `top ${car.v.toFixed(2)}`);
  const z0 = car.z;
  run(car, 0.7, drive({ brake: 1 }), w);
  assert.ok(car.v < 0.5, `brake 24 u/s² stops from 14 in < 0.7 s (${car.v.toFixed(2)})`);
  assert.ok(car.z - z0 < 5, 'short stopping distance');
  run(car, 3, drive({ brake: 1 }), w);
  assert.ok(car.v < -4.2 && car.v >= -4.5, `reverse ${car.v.toFixed(2)}`);
  run(car, 3, NO_DRIVE, w);
  assert.equal(car.v, 0, 'rolling friction brings it to rest (no drag term)');
});

test('toy car: uphill at grade 0.54 chugs at ≈ 7.2 u/s; coasting down a hill never runs away (hill hold ≤ 6)', () => {
  const car = createToyCar();
  const up = world({ h: (_x, z) => 0.54 * z });
  car.place(0, 0, 0, up);
  run(car, 6, drive({ throttle: 1 }), up);
  assert.ok(Math.abs(car.v - 7.2) < 0.35, `uphill ${car.v.toFixed(2)} u/s`);
  assert.ok(Math.abs(car.grade - 0.54) < 0.01);
  // stopped on the hill with no input: it holds
  for (let i = 0; i < 120 && car.v > 0.2; i++) car.step(DT, drive({ brake: 1 }), up);
  const z1 = car.z;
  run(car, 2, NO_DRIVE, up);
  assert.ok(Math.abs(car.z - z1) < 0.3, 'held on the slope');
  // turn round and coast down: capped at 6
  car.place(0, 0, Math.PI, up);
  car.v = 2;
  let peak = 0;
  run(car, 4, NO_DRIVE, up, () => { peak = Math.max(peak, car.v); });
  assert.ok(peak <= 6.01 && car.v > 4, `downhill coast ${car.v.toFixed(2)} (peak ${peak.toFixed(2)})`);
  // throttle downhill: gravity adds, capped at 1.25·vmax
  run(car, 5, drive({ throttle: 1 }), up, () => { peak = Math.max(peak, car.v); });
  assert.ok(peak <= 1.25 * 14 + 1e-6 && peak > 14, `downhill with throttle ${peak.toFixed(2)}`);
});

test('toy car: full-lock turn radius ≤ 3 u at 6 u/s; keyboard steering is gentler at speed', () => {
  const car = createToyCar();
  const w = world();
  car.place(0, 0, 0, w);
  for (let i = 0; i < 180; i++) { car.v = 6; car.step(DT, drive({ steer: 1, digital: false }), w); }
  const r = Math.abs(car.v / car.yawRate);
  assert.ok(r <= 3 && r > 2.3, `radius ${r.toFixed(2)} u`);
  assert.ok(car.yawRate < 0, 'steering right turns right (heading decreases)');
  const k = createToyCar();
  k.place(0, 0, 0, w);
  for (let i = 0; i < 180; i++) { k.v = 12; k.step(DT, drive({ steer: 1, digital: true }), w); }
  const rk = Math.abs(k.v / k.yawRate);
  assert.ok(rk > 5, `keyboard at 12 u/s: radius ${rk.toFixed(2)}`);
  assert.ok(Math.abs(carRoll(12, k.yawRate)) <= 0.12);
});

test('toy car: glancing a wall slides along it (keeps most speed), a head-on hit bounces with a hard bump', () => {
  const car = createToyCar();
  const wall = world({ wall: (x, _z, r) => x + r > 5 });
  car.place(0, 0, Math.PI / 4, wall); // 45° toward the wall at x = 5
  let bumps = 0, maxStrength = 0;
  run(car, 2.5, drive({ throttle: 1 }), wall, r => { if (r.bump) { bumps++; maxStrength = Math.max(maxStrength, r.bump.strength); } });
  assert.ok(bumps >= 1, 'bumped');
  assert.ok(car.x < 5 - 0.1, `never through the wall (x ${car.x.toFixed(2)})`);
  assert.ok(car.z > 12, `slid along the wall (z ${car.z.toFixed(2)})`);
  assert.ok(car.v > 6, `kept rolling (${car.v.toFixed(2)} u/s)`);
  assert.ok(Math.abs(Math.sin(car.heading) ) < 0.35, `heading eased to the wall tangent (${car.heading.toFixed(2)})`);
  // head-on at full speed
  const hit = createToyCar();
  hit.place(0, 0, Math.PI / 2, wall);
  hit.v = 13;
  let hard = false;
  run(hit, 0.5, NO_DRIVE, wall, r => { if (r.bump?.hard) hard = true; });
  assert.ok(hard, 'hard bump');
  assert.ok(hit.v <= 0.5, `bounced back (${hit.v.toFixed(2)})`);
  assert.ok(hit.x < 5 - 0.5, 'still outside the wall');
});

test('toy car: crest hop over a hilltop at speed, lands with an impact; Space hop apex ≈ 0.42 u', () => {
  const car = createToyCar();
  // a ridge: up at grade 0.3 until z = 20, then down at 0.3
  const ridge = world({ h: (_x, z) => (z < 20 ? 0.3 * z : 6 - 0.3 * (z - 20)) });
  car.place(0, 0, 0, ridge);
  car.v = 12;
  let crest = false, land = 0;
  run(car, 3, drive({ throttle: 1 }), ridge, r => { if (r.hop?.crest) crest = true; if (r.land) land = r.land; });
  assert.ok(crest, 'crest hop');
  assert.ok(land > 0, 'landed');
  const hop = createToyCar();
  const flat = world();
  hop.place(0, 0, 0, flat);
  let apex = 0;
  run(hop, 1, t => drive({ hop: t < DT / 2 }), flat, () => { apex = Math.max(apex, hop.y); });
  assert.ok(Math.abs(apex - 0.42) < 0.03, `apex ${apex.toFixed(3)}`);
});

test('toy car: never on steps, pier planks or water; grass at half speed', () => {
  const car = createToyCar();
  const mixed = world({ surf: (_x, z) => (z > 10 ? 'stairs' : z > 5 ? 'grass' : 'plaza') });
  car.place(0, 0, 0, mixed);
  let refused = false;
  run(car, 4, drive({ throttle: 1 }), mixed, r => { if (r.refuse?.reason === 'stairs') refused = true; });
  assert.ok(refused, 'refused the steps');
  assert.ok(car.z < 10 - 0.9, `stopped before the steps (${car.z.toFixed(2)})`);
  assert.ok(car.factor === 0.5, 'on grass');
  assert.equal(poseCheck(TERRAIN_WORLD, CAR_SPEC, DISTRICT.anchors['pier7-end'].x, DISTRICT.anchors['pier7-end'].z, 0).ok, false, 'pier planks are for walking');
});

test('bike: cruise 9 / sprint 11.5, uphill cut, hop apex 0.52 u, lean into turns', () => {
  const bike = createBike();
  const w = world();
  bike.place(0, 0, 0, w);
  run(bike, 3, drive({ throttle: 1 }), w);
  assert.ok(Math.abs(bike.v - 9) < 0.2, `cruise ${bike.v.toFixed(2)}`);
  run(bike, 2, drive({ throttle: 1, sprint: true }), w);
  assert.ok(Math.abs(bike.v - 11.5) < 0.2, `sprint ${bike.v.toFixed(2)}`);
  const up = world({ h: (_x, z) => 0.5 * z });
  bike.place(0, 0, 0, up);
  run(bike, 4, drive({ throttle: 1 }), up);
  assert.ok(Math.abs(bike.v - 9 * 0.55) < 0.3, `uphill at 0.5: ${bike.v.toFixed(2)}`);
  const hop = createBike();
  hop.place(0, 0, 0, w);
  let apex = 0;
  run(hop, 1, t => drive({ hop: t < DT / 2 }), w, () => { apex = Math.max(apex, hop.y); });
  assert.ok(Math.abs(apex - 0.52) < 0.03, `apex ${apex.toFixed(3)}`);
  bike.place(0, 0, 0, w);
  for (let i = 0; i < 120; i++) { bike.v = 8; bike.step(DT, drive({ steer: -1, digital: false, throttle: 1 }), w); }
  const lean = bikeLean(bike.v, bike.yawRate);
  assert.ok(lean > 0.3 && lean < 1.2, `leans left into a left turn (${lean.toFixed(2)})`);
});

test('bike: blocked by the Filbert Steps (stairs) with a refusal, rides the promenade', () => {
  // find a pavement / plaza spot just below the steps, facing up them
  const bottom = DISTRICT.anchors['filbert-steps-bottom'], mid = DISTRICT.anchors['filbert-steps-mid'];
  const heading = Math.atan2(mid.x - bottom.x, mid.z - bottom.z);
  const bike = createBike();
  let start: { x: number; z: number } | null = null;
  for (let d = 2; d < 14 && !start; d += 0.5) {
    const x = bottom.x - Math.sin(heading) * d, z = bottom.z - Math.cos(heading) * d;
    if (poseCheck(TERRAIN_WORLD, BIKE_SPEC, x, z, heading).ok) start = { x, z };
  }
  assert.ok(start, 'a rideable spot at the foot of the steps');
  bike.place(start!.x, start!.z, heading);
  let refused = false, onStairs = false;
  run(bike, 4, drive({ throttle: 1 }), TERRAIN_WORLD, r => {
    if (r.refuse?.reason === 'stairs') refused = true;
    if (surfaceAt(bike.x, bike.z) === 'stairs') onStairs = true;
  });
  assert.ok(refused, 'the steps refuse the bike');
  assert.equal(onStairs, false, 'never rode onto the stairs');
  assert.ok(heightAt(bike.x, bike.z) < 1, 'still at the bottom');
  // the promenade is fine
  const gate = { x: 152, z: -19 };
  bike.place(gate.x, gate.z, Math.PI / 2);
  run(bike, 1.5, drive({ throttle: 1 }), TERRAIN_WORLD);
  assert.ok(bike.x - gate.x > 5, `rode along the back plaza (${(bike.x - gate.x).toFixed(1)} u)`);
  assert.ok(canStand(bike.x, bike.z, 0.3));
});

test('R: findFit puts a car wedged on the stairs back on open drivable ground nearby', () => {
  const at = DISTRICT.anchors['filbert-steps-bottom'];
  assert.equal(poseCheck(TERRAIN_WORLD, CAR_SPEC, at.x, at.z, 0).ok, false);
  const fit = findFit(TERRAIN_WORLD, CAR_SPEC, at.x, at.z, 0);
  assert.ok(fit, 'found a spot');
  assert.ok(poseCheck(TERRAIN_WORLD, CAR_SPEC, fit!.x, fit!.z, fit!.heading).ok);
  assert.ok(Math.hypot(fit!.x - at.x, fit!.z - at.z) < 30);
});

/** Glide world: rolling hills, one tower at (60, 0) (roof 40), model = |x|,|z| < 300. */
const hills = (x: number, z: number) => 10 + 8 * Math.sin(x * 0.03) * Math.cos(z * 0.025);
const GW: GlideWorld = {
  heightAt: hills,
  inWorld: (x, z) => Math.abs(x) < 300 && Math.abs(z) < 300,
  roofAt: (x, z, r) => (Math.hypot(x - 60, z) < 4 + r ? 40 : -Infinity),
  landingSpot: (x, z, r) => (Math.hypot(x, z) < 1e9 && r > 0 ? { x: Math.round(x), z: Math.round(z) } : null),
};

test('glide: never below its floor — a long dive rides the soft floor over hills and a tower', () => {
  const g = new GlideSim();
  g.takeOff(0, 0, Math.PI / 2, GW);
  let t = 0, minClear = Infinity, bumps = 0;
  for (; t < 1.2; t += DT) g.step(DT, NO_GLIDE_INPUT, GW);
  assert.equal(g.stage, 'flight', 'airborne after the swoop');
  for (t = 0; t < 30; t += DT) {
    const r = g.step(DT, { pitch: -1, steer: t > 15 ? 0.6 : 0, boost: false, slow: false }, GW);
    if (r.bump) bumps++;
    minClear = Math.min(minClear, g.y - Math.max(hills(g.x, g.z), GW.roofAt(g.x, g.z, 1)));
    assert.ok(g.y >= g.hardFloor - 1e-6, `above the hard floor at t=${t.toFixed(2)}`);
  }
  assert.ok(minClear >= GLIDE.hardClear - 1e-6, `min clearance ${minClear.toFixed(2)}`);
  assert.ok(Math.abs(g.speed - (GLIDE.cruise + g.pitch * -GLIDE.diveSpeed)) < 3, 'speed near cruise');
  assert.ok(bumps < 5, `few soft bumps (${bumps})`);
});

test('glide: climbs to the ceiling at most, turns back before the model edge, lands on a resolved spot', () => {
  const g = new GlideSim();
  g.takeOff(0, 0, 0, GW);
  for (let t = 0; t < 40; t += DT) g.step(DT, { pitch: 1, steer: 0, boost: true, slow: false }, GW);
  assert.ok(g.y <= GLIDE.ceiling + 20);
  let edged = false, maxZ = -Infinity;
  for (let t = 0; t < 40; t += DT) { const r = g.step(DT, NO_GLIDE_INPUT, GW); edged ||= r.edge; maxZ = Math.max(maxZ, g.z); }
  assert.ok(edged, 'edge turn-back');
  assert.ok(maxZ < 300, `stayed inside the model (max z ${maxZ.toFixed(1)})`);
  const dur = g.beginLanding(GW);
  assert.ok(dur !== null && dur >= 2 && dur <= 3, `descent ${dur}`);
  let landed = false;
  for (let t = 0; t < 3.2 && !landed; t += DT) landed = g.step(DT, NO_GLIDE_INPUT, GW).landed;
  assert.ok(landed);
  assert.ok(Math.abs(g.y - (hills(g.landing!.x, g.landing!.z) + GLIDE.perch)) < 1e-6, 'perched just above the spot');
  const none: GlideWorld = { ...GW, landingSpot: () => null };
  const g2 = new GlideSim();
  g2.takeOff(0, 0, 0, none);
  for (let t = 0; t < 1.2; t += DT) g2.step(DT, NO_GLIDE_INPUT, none);
  assert.equal(g2.beginLanding(none), null, 'no spot → keep flying');
});

test('on foot: grade model — uphill slower (≥ 0.55), downhill a touch faster, stairs factors, steep ground is a wall', () => {
  assert.equal(gradeFactor(0, 'plaza'), 1);
  assert.ok(Math.abs(gradeFactor(0.5, 'plaza') - 0.775) < 1e-9);
  assert.equal(gradeFactor(2, 'grass'), 0.55);
  assert.ok(Math.abs(gradeFactor(-0.25, 'plaza') - 1.06) < 1e-9);
  assert.ok(Math.abs(gradeFactor(-1, 'plaza') - 1.12) < 1e-9);
  assert.ok(Math.abs(gradeFactor(0.6, 'stairs') - 0.8) < 1e-9);
  assert.ok(Math.abs(gradeFactor(-0.6, 'stairs') - 0.9) < 1e-9);
  // pant after ≥ 10 s of running uphill at g > 0.25, at the crest
  const tr = new GradeTracker();
  let pant = false;
  for (let t = 0; t < 12; t += DT) pant ||= tr.update(DT, 0.35, true);
  assert.equal(pant, false, 'no pant while still climbing');
  for (let t = 0; t < 0.5; t += DT) pant ||= tr.update(DT, 0.02, true);
  assert.ok(pant, 'pant at the crest');
  const short = new GradeTracker();
  let p2 = false;
  for (let t = 0; t < 5; t += DT) p2 ||= short.update(DT, 0.35, true);
  for (let t = 0; t < 1; t += DT) p2 ||= short.update(DT, 0, true);
  assert.equal(p2, false, 'a short climb does not pant');
});

test('budgets: each rideable is one skinned draw under 3k triangles; the camera near plane rides with height', async () => {
  const { buildBikeRig, buildToyCarRig, buildWingsRig } = await import('../src/opus-bay/actors/vehicles/models');
  const { nearPlane } = await import('../src/opus-bay/actors/camera');
  const tris = (g: { index: { count: number } | null; attributes: { position: { count: number } } }) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  for (const [name, rig, max] of [['bike', buildBikeRig(1), 3000], ['toy car', buildToyCarRig(), 3000], ['pelican wings', buildWingsRig(), 700]] as const) {
    const n = tris(rig.mesh.geometry as never);
    assert.ok(n <= max, `${name}: ${n} triangles`);
    assert.ok(!Array.isArray(rig.mesh.material), `${name}: one material → one draw`);
  }
  assert.equal(nearPlane(1.6, 0), 0.532);
  assert.equal(nearPlane(0, 0), 0.5);
  assert.ok(Math.abs(nearPlane(60, 10) - 1.5) < 1e-9);
  assert.equal(nearPlane(600, 0), 8);
});
