import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { onEvent, type GameEvent } from '../src/opus-bay/core/events';
import { runtime } from '../src/opus-bay/core/runtime';
import { game } from '../src/opus-bay/core/store';
import { canStand, forEachBlockerNear, groundPending, heightAt, isWater, nearestWalkable, setCityTerrain, standAt, surfaceAt } from '../src/opus-bay/core/terrain';
import { createCityTerrain, landmarkWalkInputs, type CityTerrainProvider } from '../src/opus-bay/core/sfTerrain';
import { GRAPH_EDGE } from '../src/opus-bay/world/sf/format';
import { findGraphPath, polylineLength, type WalkGraphIndex } from '../src/opus-bay/core/walkGraph';
import { DISTRICT, frameAt, stationOf } from '../src/opus-bay/data/district';
import { project } from '../src/opus-bay/core/geo';
import { SF_LANDMARKS, landmarkToWorld, sfLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { sfLandmarkAnchor } from '../src/opus-bay/world/sf/landmarks/context';
import { CameraController, chooseYaw, heroPoints, loadCityViews, yawCandidates, zoneViews } from '../src/opus-bay/actors/camera';
import { RideCamera } from '../src/opus-bay/actors/cameraModes';
import { zoneFrame } from '../src/opus-bay/actors/cityViews';
import { VIEW_DIRS, VIEW_EYE, bestDir, preferredCameraYaw, preferredViewDir, resetViewField, viewScores, type ViewWorld } from '../src/opus-bay/actors/viewField';
import { rideables, view } from '../src/opus-bay/actors/view';
import { GLIDE, GlideSim, NO_GLIDE_INPUT, TallHash, terrainGlideWorld } from '../src/opus-bay/actors/glide';
import { LiveTall, bayBridgeTall } from '../src/opus-bay/actors/glideTall';
import { GGB } from '../src/opus-bay/world/sf/landmarks/golden-gate-bridge';
import { cityModule } from '../src/opus-bay/world/cityLoader';
import { PELICAN_SEATS, buildPelicanRig } from '../src/opus-bay/actors/vehicles/models';
import { Pelican } from '../src/opus-bay/actors/vehicles/pelican';
import { characterMaterial } from '../src/opus-bay/actors/models';
import { startTravel, stepTravel, travelActive, travelPose } from '../src/opus-bay/game/fastTravel';
import { CITY_BENCHES, CITY_BIKE_SPOTS } from '../src/opus-bay/data/sf/rideSpots';
import { PARK_R, POOL_SIZE } from '../src/opus-bay/actors/vehicles/cityBikes';
import { pickExitSlot } from '../src/opus-bay/actors/modes';
import { buildInteractables } from '../src/opus-bay/game/interactables';
import { PlayerController } from '../src/opus-bay/actors/controller';
import { GuideMover } from '../src/opus-bay/actors/guide';
import { arrivalSpot, graphNodeFilter, setWalkGraph } from '../src/opus-bay/actors/nav';
import { isLongRoute } from '../src/opus-bay/actors/routeFollow';
import { MoveSystem } from '../src/opus-bay/actors/moveSystem';
import * as moveApi from '../src/opus-bay/actors/moveApi';
import { NO_DRIVE, PENDING_SPEED, TERRAIN_WORLD, VehicleSim, poseCheck, type DriveInput, type StepReport, type VehicleWorld } from '../src/opus-bay/actors/vehicles/collide';
import { BIKE_LENGTH, BIKE_SPEC, BIKE_WIDTH } from '../src/opus-bay/actors/vehicles/bike';
import { CAR_SPEC } from '../src/opus-bay/actors/vehicles/toyCar';
import { BIKE_PURSUIT, CAR_PURSUIT, PursuitDriver, cornerCap } from '../src/opus-bay/actors/vehicles/autopilot';
import { DRIVE_EDGES, driveRoute, drivableAt, findDrivePath } from '../src/opus-bay/actors/vehicles/driveRoute';
import { sfDisk } from './opus-bay-sf-disk';

// Lane E2, wave 2, part a-routes: long click-to-walk and BAYBAY's long lead over the city walking graph (E2-1, E2-2),
// drive routes with an edge filter (E2-3), the tap-to-drive autopilot (E2-4), pending city chunks for vehicles and the
// walker (E2-14 + CS-4), and the save v2 fleet hooks (E2-15).

const DT = 1 / 60;
const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
const FERRY = DISTRICT.anchors['ferry-gate'];
const tick = () => new Promise<void>(r => setImmediate(r));
const lm = (id: string) => landmarkToWorld(sfLandmark(id)!, { x: 0, z: 0 });

/** A city provider with the chunks within r of each point attached, registered as the terrain. */
async function cityAround(points: { x: number; z: number }[], r: number): Promise<CityTerrainProvider> {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (const p of points) await sf.attachAround(city, p.x, p.z, r, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  return city;
}

/** Streaming stand-in: keep the chunks within `keep` u of p attached and drop those beyond `drop` u. */
async function stream(city: CityTerrainProvider, p: { x: number; z: number }, keep = 200, drop = 300) {
  await sf.attachAround(city, p.x, p.z, keep, LMS);
  for (const c of sf.manifest.chunks) {
    if (!city.rasters(c.cx, c.cz)) continue;
    const x0 = c.cx * 128, z0 = c.cz * 128;
    const dx = Math.max(x0 - p.x, 0, p.x - (x0 + 128)), dz = Math.max(z0 - p.z, 0, p.z - (z0 + 128));
    if (dx * dx + dz * dz > drop * drop) city.detach(c.cx, c.cz);
  }
}

function resetPlayer(p: { x: number; z: number }, heading = 0) {
  const pl = runtime.player;
  pl.x = p.x; pl.z = p.z; pl.y = heightAt(p.x, p.z); pl.heading = heading;
  pl.pathTarget = null; pl.pendingInteract = null; pl.locked = false;
  runtime.input.moveX = 0; runtime.input.moveY = 0; runtime.input.run = false; runtime.input.jump = false;
}

// ---------------------------------------------------------------------------
// E2-4 · the pursuit autopilot (pure)
// ---------------------------------------------------------------------------

/** An L-shaped street 3.6 u wide: north along x = 0, then a 90° turn (east or west) along z = 40; walls elsewhere. */
function lStreet(side: 1 | -1): { world: VehicleWorld; path: { x: number; z: number }[]; cross: (x: number, z: number) => number } {
  const h = 1.8;
  const inL = (x: number, z: number) => (Math.abs(x) <= h && z >= -6 && z <= 40 + h) || (z >= 40 - h && z <= 40 + h && side * x >= -h && side * x <= 46);
  const world: VehicleWorld = { heightAt: () => 0, surfaceAt: () => 'road', blocked: (x, z) => !inL(x, z), inWorld: () => true };
  const path = [{ x: 0, z: 0 }, { x: 0, z: 40 }, { x: 40 * side, z: 40 }];
  const cross = (x: number, z: number) => {
    let d = Infinity;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
      d = Math.min(d, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
    }
    return d;
  };
  return { world, path, cross };
}

function drivePursuit(sim: VehicleSim, drv: PursuitDriver, world: VehicleWorld, seconds: number, each?: (r: StepReport, inp: DriveInput) => void) {
  let t = 0;
  for (; t < seconds && !drv.done; t += DT) { const inp = drv.step(sim, DT); each?.(sim.step(DT, inp, world), inp); }
  for (let k = 0; k < 90; k++) sim.step(DT, drv.step(sim, DT), world);
  return t;
}

test('pursuit: the toy car and the bike take a 90° corner of a 3.6 u street with cross-track < 0.8 u and stop within 1.5 u of the goal', () => {
  assert.deepEqual([CAR_PURSUIT.lookMin, CAR_PURSUIT.lookMax, CAR_PURSUIT.arrive], [4, 8, 1.5]);
  assert.deepEqual(CAR_PURSUIT.caps, [1.9, 3.3, 6]);
  assert.ok(Math.abs(BIKE_PURSUIT.caps[2] - 6 * 9 / 14) < 1e-9, 'the bike table is the car table scaled to vmax 9');
  assert.equal(cornerCap(Math.PI / 2, CAR_PURSUIT.caps), 1.9);
  assert.equal(cornerCap(0.8, CAR_PURSUIT.caps), 3.3);
  assert.equal(cornerCap(0.3, CAR_PURSUIT.caps), 6);
  assert.equal(cornerCap(0.1, CAR_PURSUIT.caps), Infinity);
  for (const spec of [CAR_SPEC, BIKE_SPEC]) {
    for (const side of [1, -1] as const) {
      const { world, path, cross } = lStreet(side);
      const sim = new VehicleSim(spec);
      sim.place(0, 0, 0, world);
      const drv = new PursuitDriver(spec, path);
      let maxCross = 0, bumps = 0, maxV = 0, cornerV = Infinity;
      const t = drivePursuit(sim, drv, world, 40, r => {
        if (r.bump) bumps++;
        maxCross = Math.max(maxCross, cross(sim.x, sim.z));
        maxV = Math.max(maxV, sim.v);
        if (Math.hypot(sim.x, sim.z - 40) < 1.2) cornerV = Math.min(cornerV, sim.v);
      });
      const tag = `${spec.kind} turning ${side > 0 ? 'right (east)' : 'left (west)'}`;
      assert.equal(drv.state, 'arrived', `${tag}: arrived (t ${t.toFixed(1)} s)`);
      assert.ok(maxCross < 0.8, `${tag}: cross-track ${maxCross.toFixed(2)} u`);
      assert.equal(bumps, 0, `${tag}: never touched a wall`);
      assert.ok(Math.hypot(sim.x - path[2].x, sim.z - path[2].z) <= 1.5, `${tag}: stopped ${Math.hypot(sim.x - path[2].x, sim.z - path[2].z).toFixed(2)} u from the goal`);
      assert.ok(Math.abs(sim.v) < 0.3, `${tag}: at rest`);
      assert.ok(maxV > (spec.kind === 'car' ? 8.5 : 6) && maxV <= drv.tuning.cruise + 0.3, `${tag}: cruises on the straight (${maxV.toFixed(1)} u/s)`);
      assert.ok(cornerV <= drv.tuning.caps[1] + 0.3, `${tag}: slowed for the corner (${cornerV.toFixed(2)} u/s at the apex)`);
    }
  }
});

test('pursuit: a street blocked ahead → backs up once and retries, then gives up (stuck); manual-free, never tunnels', () => {
  const { path, cross } = lStreet(1);
  // a wall across the street at z = 20
  const world: VehicleWorld = { heightAt: () => 0, surfaceAt: () => 'road', blocked: (x, z) => Math.abs(x) > 1.8 || (z > 20 && z < 21.5), inWorld: () => true };
  const sim = new VehicleSim(CAR_SPEC);
  sim.place(0, 0, 0, world);
  const drv = new PursuitDriver(CAR_SPEC, path);
  const states = new Set<string>();
  let backed = false, maxZ = 0;
  for (let t = 0; t < 30 && drv.state !== 'stuck'; t += DT) {
    const inp = drv.step(sim, DT);
    states.add(drv.state);
    if (drv.state === 'backup') { backed = true; assert.ok(inp.brake === 1 && inp.throttle === 0, 'backing up = brake → reverse'); }
    sim.step(DT, inp, world);
    maxZ = Math.max(maxZ, sim.z);
    assert.ok(cross(sim.x, sim.z) < 1.8, 'stays in the street');
  }
  assert.ok(backed && drv.retries === 1, 'backed up once');
  assert.equal(drv.state, 'stuck', `gave up (states ${[...states].join(', ')})`);
  assert.ok(maxZ < 20, `never through the wall (max z ${maxZ.toFixed(2)})`);
  assert.deepEqual(drv.step(sim, DT), NO_DRIVE, 'a stuck driver hands the wheel back');
});

// ---------------------------------------------------------------------------
// E2-14 · vehicles next to ground that is still streaming in
// ---------------------------------------------------------------------------

test('vehicles: next to pending ground the top speed drops to 0.3·vmax and the hull waits at its edge without a bump; it drives on once it arrives', () => {
  let pendingFrom = 30;
  const world: VehicleWorld = { heightAt: () => 0, surfaceAt: z => (z === undefined ? null : 'road'), blocked: () => false, inWorld: () => true, pending: (_x, z) => z > pendingFrom };
  const car = new VehicleSim(CAR_SPEC);
  car.place(0, 0, 0, world);
  const full: DriveInput = { ...NO_DRIVE, throttle: 1 };
  let bumps = 0, maxNear = 0;
  for (let t = 0; t < 8; t += DT) {
    const r = car.step(DT, full, world);
    if (r.bump || r.refuse) bumps++;
    if (car.z > pendingFrom - 6) maxNear = Math.max(maxNear, car.v);
  }
  assert.equal(bumps, 0, 'no bump / refusal at pending ground');
  assert.ok(car.z < pendingFrom && car.z > pendingFrom - 2, `waits at the edge (z ${car.z.toFixed(2)})`);
  assert.ok(maxNear <= PENDING_SPEED * CAR_SPEC.vmax + 0.05, `crawls near it (${maxNear.toFixed(2)} u/s ≤ ${(PENDING_SPEED * CAR_SPEC.vmax).toFixed(1)})`);
  pendingFrom = 1e9;
  for (let t = 0; t < 3; t += DT) car.step(DT, full, world);
  assert.ok(car.z > 40 && car.v > 10, `drives on once the ground is there (z ${car.z.toFixed(1)}, ${car.v.toFixed(1)} u/s)`);
  // without the hook (district / synthetic worlds) nothing changes: the same run with no `pending` reaches full speed
  const plain = new VehicleSim(CAR_SPEC);
  plain.place(0, 0, 0, { ...world, pending: undefined });
  for (let t = 0; t < 6; t += DT) plain.step(DT, full, { ...world, pending: undefined });
  assert.ok(plain.v > 13.3);
});

// ---------------------------------------------------------------------------
// CS-4 · the walker on ground that is not resident (city mode)
// ---------------------------------------------------------------------------

test('CS-4: chunks evicted under the player (focus moved away) — the player stays put, never thrown back to the Ferry gate; walks on when they return', async () => {
  const spot0 = lm('mission-dolores');
  const city = await cityAround([spot0], 160);
  try {
    const at = arrivalSpot({ x: spot0.x + 10, z: spot0.z - 20 }, 30)!;
    assert.ok(at && canStand(at.x, at.z, 0.45), 'a standing spot in the Mission');
    const c = new PlayerController();
    resetPlayer(at, 0);
    c.sync();
    for (let i = 0; i < 30; i++) c.step({ dt: DT, now: i * DT, cameraYaw: Math.PI, frozen: false, riding: false });
    // the streamer's focus goes elsewhere (QA camera, a map preview): every chunk here is dropped
    const dropped: [number, number][] = [];
    for (const ch of sf.manifest.chunks) if (city.rasters(ch.cx, ch.cz)) { city.detach(ch.cx, ch.cz); dropped.push([ch.cx, ch.cz]); }
    // the bug's preconditions: not standable, nothing standable within 60 u, the ground is "pending"
    assert.equal(canStand(runtime.player.x, runtime.player.z, 0.3), false);
    assert.equal(standAt(runtime.player.x, runtime.player.z), -1);
    assert.equal(nearestWalkable({ x: runtime.player.x, z: runtime.player.z }, 60), null);
    assert.ok(groundPending(runtime.player.x, runtime.player.z));
    const before = { x: runtime.player.x, z: runtime.player.z };
    for (let i = 0; i < 240; i++) {
      runtime.input.moveY = i < 120 ? 1 : 0; // even pushing the stick
      c.step({ dt: DT, now: 1 + i * DT, cameraYaw: Math.PI, frozen: false, riding: false });
    }
    const moved = Math.hypot(runtime.player.x - before.x, runtime.player.z - before.z);
    assert.ok(moved < 0.5, `stayed within ${moved.toFixed(2)} u (4 s without ground)`);
    assert.ok(Math.hypot(runtime.player.x - FERRY.x, runtime.player.z - FERRY.z) > 500, 'not at the Ferry gate');
    // R (reset) with nothing resident does not move the player either
    c.unstick();
    assert.ok(Math.hypot(runtime.player.x - before.x, runtime.player.z - before.z) < 0.5, 'unstick with nothing resident keeps the player');
    // the chunks come back: walking works again
    for (const [cx, cz] of dropped) { const r = await sf.rasters(cx, cz, LMS); if (r) city.attach(r); }
    runtime.input.moveY = 1;
    const x0 = runtime.player.x, z0 = runtime.player.z;
    for (let i = 0; i < 90; i++) c.step({ dt: DT, now: 6 + i * DT, cameraYaw: Math.PI, frozen: false, riding: false });
    runtime.input.moveY = 0;
    assert.ok(Math.hypot(runtime.player.x - x0, runtime.player.z - z0) > 1.5, 'walks again');
  } finally { setCityTerrain(null); runtime.input.moveY = 0; }
});

test('district: groundPending is always false and the rescue still uses the district spawn fallback', () => {
  assert.equal(groundPending(FERRY.x, FERRY.z), false);
  assert.equal(groundPending(-5000, -5000, 2), false);
  assert.equal(isLongRoute(FERRY, DISTRICT.anchors['pier39-entrance'], null), false, 'district targets are never long routes');
  const c = new PlayerController();
  resetPlayer({ x: FERRY.x + 400, z: FERRY.z + 400 }); // far outside the slab
  c.sync();
  c.unstick();
  assert.ok(canStand(runtime.player.x, runtime.player.z, 0.4), 'rescued onto the slab');
});

// ---------------------------------------------------------------------------
// E2-1 · long click-to-walk across the city
// ---------------------------------------------------------------------------

test('long click-to-walk: the Ferry gate → City Hall (≈ 550 u of streets) with streaming, no stall over 3 s, breadcrumbs on the route', async () => {
  const goalL = lm('city-hall');
  const city = await cityAround([FERRY, goalL], 180);
  setWalkGraph(await sf.graphIndex());
  try {
    const goal = arrivalSpot({ x: goalL.x + 40, z: goalL.z }, 40)!;
    assert.ok(goal, 'a goal on the Civic Center side of City Hall');
    const c = new PlayerController();
    resetPlayer(FERRY, Math.PI);
    c.sync();
    runtime.player.pathTarget = goal;
    let t = 0, maxStall = 0, stall = 0, maxJump = 0, pendingFrames = 0, walked = 0;
    let prev = { x: runtime.player.x, z: runtime.player.z }, lastStream = -10, crumbs = 0, seenPlans = c.planCount, routeLen = 0;
    for (; t < 200 && runtime.player.pathTarget; t += DT) {
      if (t - lastStream > 1) { lastStream = t; await stream(city, runtime.player); }
      c.step({ dt: DT, now: t, cameraYaw: Math.PI, frozen: false, riding: false });
      if (c.route.pending) pendingFrames++;
      if (c.route.route) routeLen = c.route.route.length;
      if (c.planCount !== seenPlans) { seenPlans = c.planCount; const pts = c.crumbPath(); if (pts.length && polylineLength([runtime.player, ...pts]) > 60) crumbs++; }
      const p = runtime.player, d = Math.hypot(p.x - prev.x, p.z - prev.z);
      walked += d;
      maxJump = Math.max(maxJump, d);
      if (d < 0.25 * DT) { stall += DT; maxStall = Math.max(maxStall, stall); } else stall = 0;
      prev = { x: p.x, z: p.z };
      await tick();
    }
    const p = runtime.player;
    assert.equal(p.pathTarget, null, `arrived (t ${t.toFixed(1)} s)`);
    assert.ok(Math.hypot(p.x - goal.x, p.z - goal.z) < 1, `at the goal (${Math.hypot(p.x - goal.x, p.z - goal.z).toFixed(2)} u)`);
    assert.ok(c.pathFailedAt < 0, 'never gave up');
    assert.ok(routeLen > 450 && routeLen < 900, `graph route ${routeLen.toFixed(0)} u`);
    assert.ok(walked > 450, `walked ${walked.toFixed(0)} u`);
    assert.ok(maxStall < 3, `longest stall ${maxStall.toFixed(2)} s`);
    assert.ok(maxJump < 0.5, `no teleports (max step ${maxJump.toFixed(2)} u)`);
    assert.ok(pendingFrames >= 1, `walked the clamped path while the route was pending (${pendingFrames} frames)`);
    assert.ok(crumbs >= 1, 'breadcrumbs traced the route (≥ 60 u of it)');
  } finally { setCityTerrain(null); setWalkGraph(null); }
});

test('long click-to-walk: a new target while the route is pending aborts it (no stale route), and keyboard input cancels a long walk', async () => {
  const city = await cityAround([FERRY], 200);
  let resolveSlow: (() => void) | null = null;
  const ix = await sf.graphIndex();
  // a graph promise that resolves late: the first request stays pending until we let it go
  setWalkGraph(new Promise<WalkGraphIndex>(res => { resolveSlow = () => res(ix); }));
  try {
    const c = new PlayerController();
    resetPlayer(FERRY, Math.PI);
    c.sync();
    const far = lm('city-hall'), far2 = lm('painted-ladies');
    runtime.player.pathTarget = { x: far.x, z: far.z };
    c.step({ dt: DT, now: 0, cameraYaw: Math.PI, frozen: false, riding: false });
    assert.ok(c.longMode && c.route.pending, 'long target → route pending');
    const first = c.route.goal;
    runtime.player.pathTarget = { x: far2.x, z: far2.z };
    c.step({ dt: DT, now: DT, cameraYaw: Math.PI, frozen: false, riding: false });
    assert.ok(c.route.pending && c.route.goal && first && Math.hypot(c.route.goal.x - first.x, c.route.goal.z - first.z) > 50, 'the newer target owns the route');
    resolveSlow!();
    for (let i = 0; i < 400 && !c.route.active; i++) { await tick(); c.step({ dt: DT, now: 2 * DT + i * DT, cameraYaw: Math.PI, frozen: false, riding: false }); }
    assert.ok(c.route.active, 'route arrived');
    const end = c.route.route!.points[c.route.route!.points.length - 1];
    assert.ok(Math.hypot(end.x - far2.x, end.z - far2.z) < 1, 'the route goes to the newer target');
    assert.equal(c.route.arrivals, 1, 'the aborted request never landed');
    // the stick takes over: the long walk is dropped
    runtime.input.moveX = 1;
    c.step({ dt: DT, now: 10, cameraYaw: Math.PI, frozen: false, riding: false });
    runtime.input.moveX = 0;
    assert.equal(runtime.player.pathTarget, null);
    assert.ok(!c.longMode && c.route.state === 'idle');
  } finally { setCityTerrain(null); setWalkGraph(null); void city; }
});

// ---------------------------------------------------------------------------
// E2-2 · BAYBAY leads over a long route
// ---------------------------------------------------------------------------

test('BAYBAY leads the player from the Ferry gate to the Dragon Gate over the walking graph (route pending → legs), and keeps the > 60 u hop-in', async () => {
  const dest = lm('dragon-gate');
  const city = await cityAround([FERRY, dest], 180);
  setWalkGraph(await sf.graphIndex());
  try {
    const target = arrivalSpot({ x: dest.x, z: dest.z + 8 }, 20)!;
    const m = new GuideMover();
    resetPlayer(FERRY, Math.PI);
    m.place();
    const g = runtime.guide, p = runtime.player;
    g.x = FERRY.x + 1.5; g.z = FERRY.z + 0.5; g.y = heightAt(g.x, g.z);
    m.step(DT, 0, { playing: true, riding: false, visible: true });
    g.state = 'lead'; g.run = false; g.target = { x: target.x, z: target.z };
    let t = 0, sawPending = false, maxGap = 0, lastStream = -10;
    for (; t < 200; t += DT) {
      if (t - lastStream > 1) { lastStream = t; await stream(city, g); }
      // the brain nudges the lead target a little as the player moves (beside(dest, player)); the route is kept
      if (Math.round(t * 60) % 120 === 0) g.target = { x: target.x + Math.sin(t) * 1.5, z: target.z + Math.cos(t) * 1.5 };
      // the player follows BAYBAY at walking pace, easing off within ~3 u of her
      const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz);
      const v = Math.max(0, Math.min(4.2, (d - 2) * 3));
      if (v > 0) { p.x += (dx / d) * v * DT; p.z += (dz / d) * v * DT; p.y = heightAt(p.x, p.z); }
      p.moving = v > 0.3; p.speed = v; p.running = false;
      m.step(DT, 0.1 + t, { playing: true, riding: false, visible: true });
      if (m.route.pending) sawPending = true;
      maxGap = Math.max(maxGap, d);
      if (Math.hypot(g.x - target.x, g.z - target.z) < 2.5 && !m.long) break;
      await tick();
    }
    assert.ok(Math.hypot(g.x - target.x, g.z - target.z) < 2.5, `BAYBAY reached the Dragon Gate (${Math.hypot(g.x - target.x, g.z - target.z).toFixed(1)} u, t ${t.toFixed(0)} s)`);
    assert.ok(sawPending && m.route.requests <= 1, `one route, requested once (requests ${m.route.requests}); nudges kept it`);
    assert.equal(m.hops, 0, 'no hop-ins on the way');
    assert.ok(maxGap < 12, `she never ran away (max gap ${maxGap.toFixed(1)} u)`);
    // left 70 u behind: the > 60 u hop-in still fires, visible or not
    g.state = 'follow'; g.target = null;
    g.x = p.x + 70; g.z = p.z; g.y = heightAt(g.x, g.z);
    m.step(DT, 200, { playing: true, riding: false, visible: true });
    assert.equal(m.hops, 1);
  } finally { setCityTerrain(null); setWalkGraph(null); }
});

// ---------------------------------------------------------------------------
// E2-3 · drive routes
// ---------------------------------------------------------------------------

function edgeKindBetween(ix: WalkGraphIndex, u: number, v: number, allowed: readonly number[]): number {
  let kind = -1;
  for (let e = ix.graph.offsets[u]; e < ix.graph.offsets[u + 1]; e++) if (ix.graph.targets[e] === v && (kind < 0 || allowed.includes(ix.graph.kind[e]))) kind = ix.graph.kind[e];
  return kind;
}

test('drive routes: the car keeps to streets / service roads, the bike adds paths and pedestrian ways, neither ever takes steps', async () => {
  const ix = await sf.graphIndex();
  const pairs: [string, string][] = [['dragon-gate', 'grace-cathedral'], ['mission-dolores', 'castro-theatre'], ['painted-ladies', 'peace-pagoda'], ['lombard-crooked-street', 'ghirardelli-square']];
  const city = await cityAround(pairs.flatMap(([a, b]) => [lm(a), lm(b)]), 90);
  setWalkGraph(ix);
  const STEPS = GRAPH_EDGE.indexOf('steps');
  try {
    let graphRoutes = 0;
    for (const [a, b] of pairs) {
      const from = arrivalSpot(lm(a), 40)!, to = arrivalSpot(lm(b), 40)!;
      for (const kind of ['car', 'bike'] as const) {
        const r = await driveRoute(from, to, kind, { schedule: fn => setImmediate(fn) });
        assert.ok(r, `${kind} ${a} → ${b}: a route`);
        if (r.via === 'graph') graphRoutes++;
        for (let k = 1; k < r.nodes.length; k++) {
          const e = edgeKindBetween(ix, r.nodes[k - 1], r.nodes[k], DRIVE_EDGES[kind]);
          assert.ok(DRIVE_EDGES[kind].includes(e), `${kind} ${a} → ${b}: edge ${r.nodes[k - 1]} → ${r.nodes[k]} is a ${GRAPH_EDGE[e]}`);
          assert.notEqual(e, STEPS);
        }
        // no stairs under the straight / grid stretches either (where the ground is known)
        for (let k = 1; k < r.points.length; k++) {
          const A = r.points[k - 1], B = r.points[k], L = Math.hypot(B.x - A.x, B.z - A.z);
          for (let s = 0; s <= L; s += 0.5) {
            const x = A.x + ((B.x - A.x) * s) / (L || 1), z = A.z + ((B.z - A.z) * s) / (L || 1);
            if (!groundPending(x, z)) assert.notEqual(surfaceAt(x, z), 'stairs', `${kind} ${a} → ${b}: stairs at (${x.toFixed(1)}, ${z.toFixed(1)})`);
          }
        }
        assert.ok(Math.hypot(r.points[r.points.length - 1].x - to.x, r.points[r.points.length - 1].z - to.z) < 10, `${kind} ${a} → ${b}: ends at the goal`);
      }
    }
    assert.ok(graphRoutes >= 6, `graph routes ${graphRoutes}`);
    // a flight of steps the walker would take: the drive filter must go round it
    const accept = graphNodeFilter(ix);
    let checked = 0;
    for (let u = 0; u < ix.nodeCount && checked < 12; u += 7) {
      for (let e = ix.graph.offsets[u]; e < ix.graph.offsets[u + 1]; e++) {
        if (ix.graph.kind[e] !== STEPS) continue;
        const v = ix.graph.targets[e];
        if (!accept(u) || !accept(v)) continue;
        const walk = findGraphPath(ix, u, v);
        if (!walk || walk.nodes.length !== 2) continue; // the steps themselves are the walker's way
        const bike = findGraphPath(ix, u, v, { edgeAccept: e2 => DRIVE_EDGES.bike.includes(ix.graph.kind[e2]) });
        if (bike) {
          checked++;
          for (let k = 1; k < bike.nodes.length; k++) assert.notEqual(edgeKindBetween(ix, bike.nodes[k - 1], bike.nodes[k], DRIVE_EDGES.bike), STEPS);
          assert.ok(bike.length > walk.length, 'the bike goes round the steps');
        }
        break;
      }
    }
    assert.ok(checked >= 5, `step detours checked: ${checked}`);
  } finally { setCityTerrain(null); setWalkGraph(null); void city; }
});

test('drive routes: district mode is a grid route on the drive mask (the toy car never onto pier planks or steps)', async () => {
  const carSpot = { x: 158, z: 0.5 };
  const goal = DISTRICT.anchors['pier39-entrance'];
  assert.ok(drivableAt(carSpot.x, carSpot.z, 'car'), 'the car spot is drivable');
  const r = await driveRoute(carSpot, goal, 'car');
  assert.ok(r && r.via === 'grid', 'grid route');
  assert.ok(r.length > 300, `route ${r.length.toFixed(0)} u`);
  for (let k = 1; k < r.points.length; k++) {
    const A = r.points[k - 1], B = r.points[k], L = Math.hypot(B.x - A.x, B.z - A.z);
    for (let s = 0; s <= L; s += 0.4) {
      const x = A.x + ((B.x - A.x) * s) / (L || 1), z = A.z + ((B.z - A.z) * s) / (L || 1);
      const surf = surfaceAt(x, z);
      assert.ok(surf && CAR_SPEC.surfaces[surf], `drivable surface at (${x.toFixed(1)}, ${z.toFixed(1)}): ${surf}`);
    }
  }
  // the Filbert Steps are walkable but never drivable
  const steps = DISTRICT.ramps.find(rp => rp.surface === 'stairs');
  assert.ok(steps, 'the district has a flight of steps');
  const mid = steps.points[Math.floor(steps.points.length / 2)];
  assert.ok(canStand(mid.x, mid.z, 0.3) || surfaceAt(mid.x, mid.z) === 'stairs');
  assert.equal(drivableAt(mid.x, mid.z, 'bike'), false);
  assert.equal(findDrivePath(carSpot, mid, 'bike', 0.5), null, 'no drive path onto the steps');
});

// ---------------------------------------------------------------------------
// E2-4 · tap-to-drive through the movement system (district), E2-15 fleet hooks
// ---------------------------------------------------------------------------

function moveEnv(c: PlayerController) {
  return { cameraYaw: Math.PI, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() };
}

test('tap-to-drive in the district: board the toy car, driveTo a promenade point → route, autopilot, arrival; manual input takes over', async () => {
  game.set({ phase: 'playing' });
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'vehicle:auto') events.push(e); });
  const ms = new MoveSystem();
  moveApi.bindMoveApi(ms);
  try {
    const c = new PlayerController();
    const car = ms.fleet.rides.find(r => r.kind === 'car')!;
    assert.equal(moveApi.driveTo({ x: 0, z: 0 }), false, 'on foot: refused');
    resetPlayer({ x: car.sim.x + 1.6, z: car.sim.z }, 0);
    c.sync();
    ms.onInteract(`ride:${car.id}`, c);
    let t = 0;
    for (; t < 3; t += DT) ms.update(DT, t, moveEnv(c));
    assert.equal(ms.mode, 'car');
    assert.equal(moveApi.isRiding(), true);
    const target = { x: car.sim.x - 60, z: car.sim.z - 6 };
    const goal = (await driveRoute({ x: car.sim.x, z: car.sim.z }, target, 'car'))!.points.at(-1)!;
    assert.equal(moveApi.driveTo(target), true, 'riding: accepted');
    await tick();
    assert.ok(ms.auto, 'autopilot running');
    let arrivedAt = -1;
    for (let k = 0; k < 60 * 30 && arrivedAt < 0; k++, t += DT) {
      ms.update(DT, t, moveEnv(c));
      if (events.some(e => e.type === 'vehicle:auto' && e.state === 'arrive')) arrivedAt = t;
    }
    assert.ok(arrivedAt > 0, 'arrived');
    assert.ok(Math.hypot(car.sim.x - goal.x, car.sim.z - goal.z) <= 1.6, `stopped ${Math.hypot(car.sim.x - goal.x, car.sim.z - goal.z).toFixed(2)} u from the goal`);
    assert.deepEqual(events.map(e => (e as { state: string }).state), ['start', 'arrive']);
    // a second tap, then the stick: control goes back to the player at once
    assert.equal(moveApi.driveTo({ x: car.sim.x + 40, z: car.sim.z }), true);
    await tick();
    for (let k = 0; k < 20; k++, t += DT) ms.update(DT, t, moveEnv(c));
    assert.ok(ms.auto);
    runtime.input.moveX = 1;
    const { input } = await import('../src/opus-bay/core/input');
    input.manualMove = true;
    ms.update(DT, t, moveEnv(c));
    input.manualMove = false; runtime.input.moveX = 0;
    assert.equal(ms.auto, null);
    assert.equal(events.at(-1) && (events.at(-1) as { state: string }).state, 'cancel');
    // save v2: the car is away from its spot → in the snapshot; restore puts it back after a reset
    const snap = moveApi.fleetSnapshot();
    assert.ok(snap.car && Math.hypot(snap.car.x - car.sim.x, snap.car.z - car.sim.z) < 0.05, 'car pose in the snapshot');
    ms.toFoot();
    assert.equal(moveApi.isRiding(), false);
    ms.fleet.home(car);
    moveApi.restoreFleet(snap);
    assert.ok(Math.hypot(car.sim.x - snap.car.x, car.sim.z - snap.car.z) < 0.05, 'restored');
    assert.ok(poseCheck(TERRAIN_WORLD, car.sim.spec, car.sim.x, car.sim.z, car.sim.heading).ok);
  } finally { off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title' }); }
});

test('save v2 fleet hooks: snapshot of the last-ridden bike, validated restore (bad numbers ignored, a pose in a wall moves to the nearest fit)', () => {
  const ms = new MoveSystem();
  moveApi.bindMoveApi(ms);
  try {
    assert.deepEqual(moveApi.fleetSnapshot(), {}, 'nothing moved → nothing to save');
    const bike = ms.fleet.rides.find(r => r.kind === 'bike')!, other = ms.fleet.rides.filter(r => r.kind === 'bike')[1];
    const spot = nearestWalkable({ x: bike.sim.x + 6, z: bike.sim.z + 3 }, 6)!;
    moveApi.restoreFleet({ bike: { id: bike.id, x: spot.x, z: spot.z, heading: 1 } });
    assert.ok(bike.displaced && Math.hypot(bike.sim.x - spot.x, bike.sim.z - spot.z) < 0.6, 'bike placed (or fitted next to the spot)');
    const snap = moveApi.fleetSnapshot();
    assert.equal(snap.bike?.id, bike.id);
    assert.equal(snap.car, undefined);
    // junk is ignored
    const before = { x: other.sim.x, z: other.sim.z };
    moveApi.restoreFleet({ bike: { id: other.id, x: NaN, z: 3, heading: 0 } });
    moveApi.restoreFleet({ bike: { id: 'no-such-bike', x: 0, z: 0, heading: 0 } });
    moveApi.restoreFleet(null as unknown as moveApi.FleetSnapshot);
    assert.deepEqual({ x: other.sim.x, z: other.sim.z }, before);
    // a pose inside a building moves to the nearest pose where the hull fits (≤ 6 u), else it is skipped
    const blk = DISTRICT.blocks[3].footprint;
    const cx = blk.reduce((a, q) => a + q.x, 0) / blk.length, cz = blk.reduce((a, q) => a + q.z, 0) / blk.length;
    moveApi.restoreFleet({ bike: { id: other.id, x: cx, z: cz, heading: 0 } });
    assert.ok(poseCheck(TERRAIN_WORLD, other.sim.spec, other.sim.x, other.sim.z, other.sim.heading).ok, 'wherever it is, it fits');
  } finally { moveApi.bindMoveApi(null); ms.dispose(); }
});

// ---------------------------------------------------------------------------
// Wave 3, part b: the view field (E2-5) and the city camera (E2-6)
// ---------------------------------------------------------------------------

const flatWorld = (o: Partial<ViewWorld> = {}): ViewWorld => ({ heightAt: () => 0, inWorld: () => true, isWater: () => false, roofNear: () => -Infinity, ...o });
const dirOf = (k: number) => (k / VIEW_DIRS) * Math.PI * 2;
const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test('E2-5 view field: water draws the eye, higher ground and roofs over the eye line push it away; the hero rule is unchanged', () => {
  // open water to the west (x < −40): the view points west
  const west = bestDir(viewScores(0, 0, flatWorld({ isWater: x => x < -40 })));
  assert.ok(angleGap(dirOf(west), -Math.PI / 2) < 0.45, `water west → ${dirOf(west).toFixed(2)}`);
  // a slope rising toward +z: look down it (−z)
  const down = bestDir(viewScores(0, 0, flatWorld({ heightAt: (_x, z) => z * 0.3 })));
  assert.ok(angleGap(dirOf(down), Math.PI) < 0.45, `downhill → ${dirOf(down).toFixed(2)}`);
  // tall roofs everywhere east of x = 10: never look east
  const s = viewScores(0, 0, flatWorld({ roofNear: x => (x > 10 ? VIEW_EYE + 12 : -Infinity) }));
  assert.ok(Math.sin(dirOf(bestDir(s))) < 0.5, 'not into the roofs');
  assert.ok(s[4] < s[12] - 1, `east ${s[4].toFixed(2)} < west ${s[12].toFixed(2)}`);
  // a roof below the eye line does not count
  const low = viewScores(0, 0, flatWorld({ roofNear: x => (x > 10 ? VIEW_EYE - 1 : -Infinity) }));
  assert.ok(Math.abs(low[4] - low[12]) < 1e-6, 'a low roof is no block');
  // district: exactly today's rule (out over the Bay along the promenade normal)
  for (const a of ['ferry-clock', 'coit-view', 'pier14-end', 'levis-plaza']) {
    const p = DISTRICT.anchors[a];
    const f = frameAt(stationOf(p).st);
    assert.equal(preferredViewDir(p.x, p.z), Math.atan2(f.nx, f.nz), a);
    assert.equal(preferredCameraYaw(p.x, p.z), Math.atan2(-f.nx, -f.nz), a);
  }
});

test('E2-5 view field in the city: downhill from Twin Peaks, the ocean at Ocean Beach, the Bay from Russian Hill and the Marina; cached per 16 u cell', async () => {
  const tp = sfLandmarkAnchor('twin-peaks')!, ob = project(37.7599, -122.5095), rh = project(37.8021, -122.4187), mg = project(37.8065, -122.443);
  await cityAround([tp, ob, rh, mg], 130);
  resetViewField();
  try {
    const along = (p: { x: number; z: number }, r: number) => { const d = preferredViewDir(p.x, p.z); return { x: p.x + Math.sin(d) * r, z: p.z + Math.cos(d) * r }; };
    const t48 = along(tp, 48);
    assert.ok(heightAt(t48.x, t48.z) < heightAt(tp.x, tp.z) - 8, `Twin Peaks looks downhill (${heightAt(t48.x, t48.z).toFixed(1)} vs ${heightAt(tp.x, tp.z).toFixed(1)})`);
    for (const [name, p] of [['Ocean Beach', ob], ['the Marina', mg]] as const) { const w = along(p, 96); assert.ok(isWater(w.x, w.z), `${name} looks at the water`); }
    const r48 = along(rh, 48);
    assert.ok(heightAt(r48.x, r48.z) < heightAt(rh.x, rh.z) - 8, 'Russian Hill looks down toward the Bay');
    // the same 16 u cell answers the same; the camera yaw is the view turned round
    assert.equal(preferredViewDir(rh.x + 0.3, rh.z + 0.2), preferredViewDir(rh.x, rh.z));
    assert.ok(angleGap(preferredCameraYaw(rh.x, rh.z), preferredViewDir(rh.x, rh.z) + Math.PI) < 1e-9);
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) preferredViewDir(rh.x, rh.z);
    assert.ok(performance.now() - t0 < 50, 'a cached cell is cheap');
  } finally { setCityTerrain(null); resetViewField(); }
});

test('E2-6 hero points and zone views: district keeps its 3 + 7, the city adds Salesforce, the bridge towers, Sutro and one view per landmark arrival', async () => {
  game.set({ worldMode: 'district' });
  assert.deepEqual(heroPoints().map(h => h.id).sort(), ['coit-tower', 'ferry-clock-tower', 'transamerica']);
  const districtZones = zoneViews().length;
  assert.ok(zoneViews().every(z => !z.anchor.startsWith('lm-')));
  game.set({ worldMode: 'city' });
  try {
    await loadCityViews();
    const ids = heroPoints().map(h => h.id);
    for (const id of ['coit-tower', 'ferry-clock-tower', 'transamerica', 'salesforce-tower', 'ggb-tower-s', 'ggb-tower-n', 'sutro-tower']) assert.ok(ids.includes(id), id);
    const zones = zoneViews();
    assert.ok(zones.length > districtZones + 15, `${zones.length} zones`);
    for (const id of ['city-hall', 'palace-of-fine-arts', 'lombard-crooked-street', 'golden-gate-bridge']) {
      const z = zones.find(v => v.anchor === `lm-${id}`);
      const at = sfLandmarkAnchor(id)!;
      assert.ok(z && Math.hypot(z.x - at.x, z.z - at.z) < 1e-9 && z.near && z.frame, id);
    }
    assert.ok(!zones.some(v => v.anchor === 'lm-twin-peaks' || v.anchor === 'lm-sutro-tower'), 'no zone for an overlook or the foot of a tower');
    // the framing solver: a tall subject close by pulls the camera back and looks up; a low one keeps 15 u
    const tall = zoneFrame(9, 12.5, 0.12, 16), low = zoneFrame(3, 6, 0.1, 4.5);
    assert.ok(tall.dist >= 18 && tall.lookUp > 0, JSON.stringify(tall));
    assert.equal(low.dist, 15);
  } finally { game.set({ worldMode: 'district' }); }
  assert.equal(heroPoints().length, 3, 'back in the district');
});

test('E2-6 chooseYaw in the city: the City Hall arrival faces the dome; occlusion ignores roofs below the sight line', async () => {
  const at = sfLandmarkAnchor('city-hall')!, hall = sfLandmark('city-hall')!;
  const spot = project(37.7609, -122.435);
  await cityAround([at, spot], 120);
  game.set({ worldMode: 'city' });
  try {
    await loadCityViews();
    const yaw = chooseYaw(at.x, at.z, 0, 15);
    // the camera behind the player, the dome ahead: the view (camera → player) points at the landmark
    const toHall = Math.atan2(hall.x - at.x, hall.z - at.z);
    assert.ok(angleGap(yaw + Math.PI, toHall) < 0.75, `yaw ${yaw.toFixed(2)} vs dome ${toHall.toFixed(2)}`);
    // occlusion: push every roof round a Castro street spot below the sight line → nothing much hides the player
    const walk = nearestWalkable(spot, 10)!;
    const before = yawCandidates(walk.x, walk.z, 0, 15);
    assert.ok(before.some(c => c.occ > 0), 'a street between house rows has occluded yaws');
    const touched: [{ top?: number }, number | undefined][] = [];
    forEachBlockerNear(walk.x, walk.z, 20, b => { touched.push([b, b.top]); if (b.top !== undefined) b.top = heightAt(walk.x, walk.z) + 0.5; });
    try {
      const flat = yawCandidates(walk.x, walk.z, 0, 15);
      for (let i = 0; i < flat.length; i++) assert.ok(flat[i].occ <= before[i].occ, 'never more');
      assert.ok(flat.reduce((a, c) => a + c.occ, 0) < before.reduce((a, c) => a + c.occ, 0) * 0.5, 'low roofs hide much less');
    } finally { for (const [b, t] of touched) b.top = t; }
  } finally { setCityTerrain(null); game.set({ worldMode: 'district' }); }
});

test('E2-6 follow camera on a narrow city street: over the roofs round it, not among them; the ride rig allocates nothing per frame', async () => {
  const spot = project(37.7536, -122.4862);
  await cityAround([spot], 120);
  game.set({ worldMode: 'city', phase: 'playing' });
  const walk = nearestWalkable(spot, 20)!;
  try {
    resetPlayer(walk);
    Object.assign(view, { x: walk.x, y: heightAt(walk.x, walk.z), z: walk.z, ground: heightAt(walk.x, walk.z), vx: 0, vz: 0, ready: true });
    const cam = new THREE.PerspectiveCamera(42, 1440 / 900, 0.5, 4000);
    const rig = new CameraController();
    for (let i = 0; i < 90; i++) rig.update(cam, DT, i * DT, 900, 1440);
    // no house round the camera reaches above it
    let top = -Infinity;
    forEachBlockerNear(cam.position.x, cam.position.z, 1.8, b => { if (b.top !== undefined) top = Math.max(top, b.top); });
    assert.ok(top === -Infinity || cam.position.y >= top + 1, `camera y ${cam.position.y.toFixed(1)} vs roofs ${top.toFixed(1)}`);
    rig.dispose();
    // the ride rig reuses its vectors (E2-6: no per-frame allocation)
    const rc = new RideCamera();
    const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 44 };
    const sub = { mode: 'bike' as const, x: walk.x, y: heightAt(walk.x, walk.z) + 1, z: walk.z, heading: 0, speed: 3, gradeAhead: 0 };
    rc.update(sub, DT, 0, pose);
    let made = 0;
    const clone = THREE.Vector3.prototype.clone;
    THREE.Vector3.prototype.clone = function (this: THREE.Vector3) { made++; return clone.call(this); };
    try { for (let i = 1; i < 30; i++) rc.update({ ...sub, z: sub.z + i * 0.05 }, DT, i * DT, pose); } finally { THREE.Vector3.prototype.clone = clone; }
    assert.equal(made, 0, 'no clone() per frame');
  } finally { setCityTerrain(null); game.set({ worldMode: 'district', phase: 'title' }); }
});

// ---------------------------------------------------------------------------
// Wave 3, part b: the glide world (E2-7)
// ---------------------------------------------------------------------------

test('E2-7 glide world: the tall list is live (the city chunk and a later setTallStructures reach a glide already flying; landmark parts on the provider base); bucket hash = brute force', async () => {
  game.set({ worldMode: 'district' });
  const live = new LiveTall();
  const world = terrainGlideWorld(() => live.get());
  assert.equal(live.get().list.length, 4, 'district: Coit, Transamerica, Salesforce, the Ferry Building');
  const coit = DISTRICT.landmarks.find(l => l.kind === 'coit-tower')!;
  assert.ok(world.roofAt(coit.position.x, coit.position.z, 1) >= (coit.baseY ?? heightAt(coit.position.x, coit.position.z)) + 16);
  const ggb = sfLandmark('golden-gate-bridge')!, south = landmarkToWorld(ggb, { x: -GGB.TOWER, z: 0 });
  assert.equal(world.roofAt(south.x, south.z, 1), -Infinity, 'no bridge in the district');
  game.set({ worldMode: 'city' });
  const city = await cityAround([sfLandmarkAnchor('city-hall')!], 60);
  try {
    const { loadCity } = await import('../src/opus-bay/world/cityLoader');
    await loadCity();
    // the same world object, now over the city: the bridge's towers, Sutro, the Bay Bridge
    assert.ok(world.roofAt(south.x, south.z, 1) >= GGB.TOP, 'GGB south tower');
    const sutro = sfLandmark('sutro-tower')!;
    assert.ok(world.roofAt(sutro.x, sutro.z, 1) > heightAt(sutro.x, sutro.z) + 40, 'Sutro Tower');
    const bb = bayBridgeTall(), P = { w2: { x: 250.4, z: -1.1 } };
    assert.ok(bb.length > 50, `${bb.length} Bay Bridge circles`);
    const w2 = bb.slice(0, 4).sort((a, b) => Math.hypot(a.x - P.w2.x, a.z - P.w2.z) - Math.hypot(b.x - P.w2.x, b.z - P.w2.z))[0];
    assert.ok(Math.hypot(w2.x - P.w2.x, w2.z - P.w2.z) < 20 && world.roofAt(w2.x, w2.z, 1) >= 31, 'a Bay Bridge tower at its pier');
    for (const t of bb) assert.ok(world.roofAt(t.x, t.z, 0.5) >= 10.6, 'never lower than the deck');
    // setTallStructures after take-off reaches the same world
    live.setExtra([{ x: 3000, z: 3000, r: 3, top: 99 }]);
    assert.equal(world.roofAt(3000, 3000, 1), 99);
    // a 'terrain' landmark's tall parts stand on the base collision uses (the provider's), not the ground at its centre
    const base = city.landmarkBase('city-hall')!;
    const hl = sfLandmark('city-hall')!;
    const hall = live.get(performance.now() + 5000).list.filter(t => Math.hypot(t.x - hl.x, t.z - hl.z) < 30);
    const want = (cityModule()!.landmarkTallStructures(l => (l.id === 'city-hall' ? base : 0))).filter(t => t.id === 'city-hall').map(t => t.top);
    assert.ok(want.length > 0 && want.every(top => hall.some(t => Math.abs(t.top - top) < 1e-9)), `City Hall on its base ${base.toFixed(2)}`);
    // the 64 u bucket hash answers exactly what a scan of the list answers
    const h = new TallHash(live.get().list);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 3000; i++) {
      const x = -1100 + rnd() * 1800, z = -500 + rnd() * 2000, r = rnd() * 6;
      let brute = -Infinity;
      for (const t of h.list) if (Math.hypot(t.x - x, t.z - z) < t.r + r) brute = Math.max(brute, t.top);
      assert.equal(h.roofAt(x, z, r), brute, `(${x.toFixed(1)}, ${z.toFixed(1)}, ${r.toFixed(2)})`);
    }
  } finally { setCityTerrain(null); game.set({ worldMode: 'district' }); }
});

test('E2-7 glide over the city: the pelican never passes through the Golden Gate Bridge tower or the Bay Bridge; it lands on a large open area', async () => {
  const ggb = sfLandmark('golden-gate-bridge')!, south = landmarkToWorld(ggb, { x: -GGB.TOWER, z: 0 });
  game.set({ worldMode: 'city' });
  await cityAround([south], 40);
  try {
    const { loadCity } = await import('../src/opus-bay/world/cityLoader');
    await loadCity();
    const live = new LiveTall();
    const world = terrainGlideWorld(() => live.get());
    for (const [name, target] of [['GGB south tower', south], ['Bay Bridge W3', bayBridgeTall()[1]]] as const) {
      const sim = new GlideSim();
      // 90 u off, 30 u up, flying straight at it with no input
      const h = Math.atan2(target.x - (target.x - 90), 0);
      sim.x = target.x - 90; sim.z = target.z; sim.y = 30; sim.heading = h; sim.stage = 'flight';
      let near = Infinity, low = Infinity;
      for (let i = 0; i < 60 * 10; i++) {
        sim.step(DT, NO_GLIDE_INPUT, world);
        near = Math.min(near, Math.hypot(sim.x - target.x, sim.z - target.z));
        const roof = world.roofAt(sim.x, sim.z, 1);
        if (roof > -Infinity) low = Math.min(low, sim.y - roof);
      }
      // (the repulsor climbs and banks round it — over or beside — but never through it)
      assert.ok(near < 30, `${name}: it came by (${near.toFixed(1)} u)`);
      assert.ok(low >= GLIDE.hardClear - 0.5, `${name}: never through it (${low.toFixed(2)})`);
    }
    // city landing: nav.arrivalSpot, never a pocket
    const at = sfLandmarkAnchor('city-hall')!;
    await cityAround([at], 80);
    const w2 = terrainGlideWorld(() => live.get());
    assert.deepEqual(w2.landingSpot(at.x + 3, at.z + 3, 40), arrivalSpot({ x: at.x + 3, z: at.z + 3 }, 40));
  } finally { setCityTerrain(null); game.set({ worldMode: 'district' }); }
  // district: the nearest standable spot, as before
  const f = DISTRICT.anchors['ferry-clock'];
  assert.deepEqual(terrainGlideWorld().landingSpot(f.x, f.z, 40), nearestWalkable(f, 40));
});

// ---------------------------------------------------------------------------
// Wave 3, part b: the flying pelican (E2-8) and fast travel on it (G1 request 1)
// ---------------------------------------------------------------------------

test('E2-8 pelican rig: one skinned clay draw ≤ 3.5k triangles that reads as flying (bill forward, head drawn back, feet tucked, broad wings); seats on its back', () => {
  const rig = buildPelicanRig();
  const g = rig.mesh.geometry;
  const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
  assert.ok(tris <= 3500, `${tris} triangles`);
  assert.equal(rig.mesh.material, characterMaterial(), 'the characters\' material: no new program');
  for (const b of ['root', 'body', 'head', 'tail', 'wingL', 'wingR', 'tipL', 'tipR']) assert.ok(rig.bones[b], `bone ${b} (the flap / bank code drives these)`);
  // shape, from the bound vertices per bone (bind pose)
  const pos = g.attributes.position as THREE.BufferAttribute, si = g.attributes.skinIndex as THREE.BufferAttribute;
  const names = Object.keys(rig.bones), box = new Map<string, THREE.Box3>();
  for (let i = 0; i < pos.count; i++) {
    const b = rig.mesh.skeleton.bones[si.getX(i)].name;
    if (!box.has(b)) box.set(b, new THREE.Box3());
    box.get(b)!.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, i));
  }
  assert.ok(names.every(n => n === 'root' || box.has(n)), 'every bone carries geometry');
  const body = box.get('body')!, head = box.get('head')!, tail = box.get('tail')!, wl = box.get('wingL')!, tl = box.get('tipL')!, tr = box.get('tipR')!;
  assert.ok(head.max.z > body.max.z + 1.5, `the bill reaches well forward (${head.max.z.toFixed(2)})`);
  assert.ok(head.max.y < 0.5, 'the head is drawn back low on the shoulders, not up on a long neck');
  assert.ok(tail.min.z < body.min.z + 0.3 && tail.min.y < body.min.y + 0.4, 'tail and tucked feet behind and below');
  assert.ok(tl.max.x - tr.min.x > 7, `wingspan ${(tl.max.x - tr.min.x).toFixed(2)} u`);
  assert.ok(wl.min.x > 0.3, 'the left wing starts at its shoulder');
  // seats: on the back (just above the mantle), BAYBAY in front of the rider
  assert.ok(PELICAN_SEATS.baybay.z > PELICAN_SEATS.rider.z + 0.6);
  for (const s of [PELICAN_SEATS.rider, PELICAN_SEATS.baybay]) assert.ok(s.y > body.max.y - 0.2 && s.y < body.max.y + 0.15, `seat y ${s.y} on the back (${body.max.y.toFixed(2)})`);
  rig.mesh.geometry.dispose();
});

test('E2-8 the ride pelican flaps and banks with its bones; G1 request 1: fast travel carries the rider and BAYBAY on it, pickup to descent', () => {
  const pel = new Pelican();
  pel.sim.x = 0; pel.sim.y = 20; pel.sim.z = 0; pel.sim.heading = 0; pel.sim.stage = 'flight';
  pel.show();
  for (let i = 0; i < 30; i++) pel.update(DT, i * DT);
  const soar = pel.rig.bones.wingL.rotation.z;
  pel.sim.roll = 0.5;
  pel.update(DT, 0.6);
  assert.ok(pel.rig.bones.wingL.rotation.z < soar - 0.08 && pel.rig.bones.wingR.rotation.z < 0, 'wings follow the bank');
  pel.beating = true;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 60; i++) { pel.update(DT, 1 + i * DT); lo = Math.min(lo, pel.rig.bones.wingL.rotation.z); hi = Math.max(hi, pel.rig.bones.wingL.rotation.z); }
  assert.ok(hi - lo > 0.6, `a strong beat (${(hi - lo).toFixed(2)} rad)`);
  pel.dispose();

  // fast travel (district is enough: G1's trip needs no city), ferry gate → Pier 39 area
  game.set({ phase: 'playing', worldMode: 'district' });
  const ms = new MoveSystem();
  moveApi.bindMoveApi(ms);
  try {
    const c = new PlayerController();
    resetPlayer(FERRY);
    c.sync();
    const dest = DISTRICT.anchors['sea-lion-viewpoint'];
    assert.ok(startTravel({ id: 'test', name: { zh: '测试', en: 'Test' }, x: dest.x, z: dest.z }));
    const seen = new Set<string>();
    let t = 0, carried = 0, guideSeated = 0, maxY = -Infinity;
    for (; t < 20 && travelActive(); t += DT) {
      stepTravel(DT);
      ms.update(DT, t, moveEnv(c));
      const pose = travelPose();
      if (!pose) continue;
      seen.add(pose.phase);
      if (ms.mode === 'travel') {
        assert.ok(ms.pelican.visible, `the pelican is out (${pose.phase})`);
        if (ms.rider.active) carried++;
        if (ms.guide.active && ms.guideAnim.sitting) guideSeated++;
        if (pose.phase === 'pan') { maxY = Math.max(maxY, ms.rider.y); assert.ok(Math.abs(ms.pelican.sim.y - (pose.y + GLIDE.perch)) < 1e-6, 'on the sky path'); }
      }
    }
    assert.deepEqual([...seen], ['pickup', 'rise', 'pan', 'hold', 'descent'].filter(p => seen.has(p)));
    assert.ok(seen.has('pickup') && seen.has('rise') && seen.has('pan') && seen.has('descent'), [...seen].join());
    assert.ok(carried > 100 && guideSeated > 60, `rider carried ${carried} frames, BAYBAY seated ${guideSeated}`);
    assert.ok(maxY > heightAt(FERRY.x, FERRY.z) + 40, 'up at the cruise height');
    for (let i = 0; i < 30; i++) ms.update(DT, t + i * DT, moveEnv(c));
    assert.equal(ms.mode, 'foot');
    assert.equal(ms.rider.active, false, 'on foot again');
    assert.ok(Math.hypot(runtime.player.x - dest.x, runtime.player.z - dest.z) < 8, 'at the destination');
  } finally { moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title', move: { mode: 'foot' } }); }
});

// ---------------------------------------------------------------------------
// Wave 3, part b: city bike racks and benches (E2-12)
// ---------------------------------------------------------------------------

test('E2-12 generated ride spots: every city rack bike fits with a clear door slot, every bench has standable ground in front (ids unique)', async () => {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAll(city, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    assert.ok(CITY_BIKE_SPOTS.length >= 20 && CITY_BENCHES.length >= 100, `${CITY_BIKE_SPOTS.length} racks, ${CITY_BENCHES.length} benches`);
    assert.equal(new Set([...CITY_BIKE_SPOTS, ...CITY_BENCHES].map(s => s.id)).size, CITY_BIKE_SPOTS.length + CITY_BENCHES.length);
    const slots = { canStand, heightAt };
    for (const s of CITY_BIKE_SPOTS) {
      assert.ok(poseCheck(TERRAIN_WORLD, BIKE_SPEC, s.x, s.z, s.heading).ok, `${s.id} fits`);
      assert.ok(pickExitSlot(slots, { x: s.x, z: s.z, y: heightAt(s.x, s.z), heading: s.heading }, BIKE_WIDTH, BIKE_LENGTH), `${s.id} door slot`);
    }
    for (const b of CITY_BENCHES) assert.ok(canStand(b.x + Math.sin(b.heading) * 1.1, b.z + Math.cos(b.heading) * 1.1, 0.45), `${b.id} front`);
  } finally { setCityTerrain(null); }
});

test('E2-12 city bike pool: ≤ 4 bikes parked at the racks near the player, recycled beyond 160 u (never the one being ridden); rideables keyed by id; benches to sit on', async () => {
  const near = (a: { x: number; z: number }, r: number) => CITY_BIKE_SPOTS.filter(s => Math.hypot(s.x - a.x, s.z - a.z) < r);
  const A = [...CITY_BIKE_SPOTS].sort((a, b) => near(b, PARK_R).length - near(a, PARK_R).length)[0];
  const B = CITY_BIKE_SPOTS.find(s => Math.hypot(s.x - A.x, s.z - A.z) > 450)!;
  const bench = [...CITY_BENCHES].sort((a, b) => Math.hypot(a.x - B.x, a.z - B.z) - Math.hypot(b.x - B.x, b.z - B.z))[0];
  await cityAround([A, B, bench], 140);
  game.set({ phase: 'playing', worldMode: 'city' });
  const ms = new MoveSystem();
  moveApi.bindMoveApi(ms);
  const c = new PlayerController();
  const run = async (s: number) => { for (let t = 0; t < s; t += 0.1) { ms.update(0.1, t, moveEnv(c)); ms.syncRideables(); await tick(); } };
  try {
    resetPlayer(nearestWalkable(A, 10)!);
    c.sync();
    await run(1.5);
    assert.ok(ms.cityBikes, 'the pool loaded (city mode)');
    const wantA = near(A, PARK_R).sort((a, b) => Math.hypot(a.x - A.x, a.z - A.z) - Math.hypot(b.x - A.x, b.z - A.z)).slice(0, POOL_SIZE).map(s => s.id);
    const pooled = () => ms.cityBikes!.rides.map(r => r.id).sort();
    assert.deepEqual(pooled(), [...wantA].sort(), 'the racks nearest the player have their bikes');
    assert.ok(ms.cityBikes!.rides.length <= POOL_SIZE);
    for (const id of wantA) {
      const r = ms.fleet.byId(id)!, spot = CITY_BIKE_SPOTS.find(s => s.id === id)!;
      assert.ok(Math.hypot(r.sim.x - spot.x, r.sim.z - spot.z) < 0.05, `${id} at its rack`);
      assert.ok(rideables.some(v => v.id === id && v.free), `${id} rideable`);
    }
    const items = buildInteractables();
    assert.ok(wantA.every(id => items.some(it => it.id === `ride:${id}`)) && items.some(it => it.id === CITY_BENCHES[0].id), 'offered as interactables');
    // the player keeps one (occupied), walks to the far rack B: the others move there, the kept one stays
    const kept = ms.cityBikes!.rides[0];
    const keptId = kept.id;
    kept.occupied = true;
    resetPlayer(nearestWalkable(B, 10)!);
    c.sync();
    await run(1.5);
    assert.equal(kept.id, keptId, 'the ridden bike is never recycled');
    const wantB = near(B, PARK_R).sort((a, b) => Math.hypot(a.x - B.x, a.z - B.z) - Math.hypot(b.x - B.x, b.z - B.z)).slice(0, POOL_SIZE - 1).map(s => s.id);
    for (const id of wantB) assert.ok(ms.fleet.byId(id), `${id} now has a bike`);
    assert.ok(ms.cityBikes!.moves >= Math.min(wantB.length, POOL_SIZE - 1) - (ms.cityBikes!.rides.length - wantA.length));
    assert.deepEqual(rideables.map(v => v.id), ms.fleet.rides.map(r => r.id), 'rideables follow the ids');
    kept.occupied = false;
    // a city bench: sit and stand up again
    assert.ok(ms.seats.some(s => s.id === bench.id));
    resetPlayer({ x: bench.x + Math.sin(bench.heading) * 1.1, z: bench.z + Math.cos(bench.heading) * 1.1 });
    c.sync();
    await run(0.2);
    ms.onInteract(bench.id, c);
    await run(1.2);
    assert.equal(ms.mode, 'sit');
    assert.ok(Math.abs(ms.rider.y - (heightAt(bench.x, bench.z) + bench.y + 0.22)) < 0.05, 'on the seat');
  } finally { moveApi.bindMoveApi(null); ms.dispose(); setCityTerrain(null); game.set({ phase: 'title', worldMode: 'district' }); }
});
