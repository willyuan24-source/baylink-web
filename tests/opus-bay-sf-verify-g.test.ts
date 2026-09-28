import assert from 'node:assert/strict';
import test from 'node:test';
import { runtime } from '../src/opus-bay/core/runtime';
import { heightAt, nearestWalkable, setCityTerrain } from '../src/opus-bay/core/terrain';
import { createCityTerrain, landmarkWalkInputs, type CityTerrainProvider } from '../src/opus-bay/core/sfTerrain';
import { SF_LANDMARKS } from '../src/opus-bay/world/sf/landmarks/index';
import { LONG_NO_PROGRESS, PlayerController } from '../src/opus-bay/actors/controller';
import { setWalkGraph } from '../src/opus-bay/actors/nav';
import { PARK_CLEAR, stopShortOf } from '../src/opus-bay/actors/vehicles/driveRoute';
import { FERRY_ROUTES } from '../src/opus-bay/data/ferry';
import { sfDisk } from './opus-bay-sf-disk';
import * as THREE from 'three';
import { onEvent, type GameEvent } from '../src/opus-bay/core/events';
import { game } from '../src/opus-bay/core/store';
import { MoveSystem } from '../src/opus-bay/actors/moveSystem';
import * as moveApi from '../src/opus-bay/actors/moveApi';
import { registerObstacleSource } from '../src/opus-bay/actors/view';

// Wave 4 · lane G integration part b: the wave-4 verify findings on lane G's files (the walker, the drive autopilot,
// the HUD). Screens for the DOM / CSS parts are in docs/opus-bay/qa/w4/G/ib-*.jpg.

const DT = 1 / 60;
const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
const tick = () => new Promise<void>(r => setImmediate(r));

async function cityAround(points: { x: number; z: number }[], r: number): Promise<CityTerrainProvider> {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (const p of points) await sf.attachAround(city, p.x, p.z, r, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  return city;
}

function resetPlayer(p: { x: number; z: number }, heading = 0) {
  const pl = runtime.player;
  pl.x = p.x; pl.z = p.z; pl.y = heightAt(p.x, p.z); pl.heading = heading;
  pl.pathTarget = null; pl.pendingInteract = null; pl.locked = false;
  runtime.input.moveX = 0; runtime.input.moveY = 0; runtime.input.run = false; runtime.input.jump = false;
}

test('verify-desktop D2: a long walk that stops getting closer gives up (≤ LONG_NO_PROGRESS s without progress) and marks the failure far — from the walled-in Pier 45 shed deck (the old Pier 41 landing) it never paces for a minute', async () => {
  // the ferry used to land here (lane T moved the landing to the Wharf promenade in W4-T16); the deck is still walled
  // in by the shed buildings, so it stands for any spot a walk cannot leave
  const quay = { x: -238, z: 66.5 };
  assert.ok(Math.hypot(FERRY_ROUTES[0].terminals.find(t => t.id === 'pier-41')!.quay.x - quay.x, FERRY_ROUTES[0].terminals.find(t => t.id === 'pier-41')!.quay.z - quay.z) > 20, 'the landing itself moved ashore (lane T)');
  const coit = { x: -50.2, z: 51.1 };
  await cityAround([quay, coit], 220);
  setWalkGraph(await sf.graphIndex());
  try {
    const at = nearestWalkable(quay, 16)!;
    assert.ok(at, 'a spot on the shed deck');
    const c = new PlayerController();
    resetPlayer(at, Math.PI / 2);
    c.sync();
    runtime.player.pathTarget = coit;
    const failedBefore = c.pathFailedAt;
    let t = 0, best = Infinity, bestAt = 0, worstGap = 0;
    for (; t < 150 && runtime.player.pathTarget; t += DT) {
      c.step({ dt: DT, now: t, cameraYaw: Math.PI, frozen: false, riding: false });
      const d = Math.hypot(coit.x - runtime.player.x, coit.z - runtime.player.z);
      if (d < best - 2) { best = d; bestAt = t; }
      worstGap = Math.max(worstGap, t - bestAt);
      if (Math.round(t / DT) % 30 === 0) await tick();
    }
    const arrived = Math.hypot(coit.x - runtime.player.x, coit.z - runtime.player.z) < 3;
    if (!arrived) {
      assert.notEqual(c.pathFailedAt, failedBefore, 'the walk was given up (the red ring + BAYBAY\'s line), not left pacing');
      assert.equal(c.pathFailedFar, true, 'a far target: the actor system says "这边走不过去了 · 打开地图换个方式吧"');
      assert.ok(t < 40, `gave up after ${t.toFixed(1)} s (without the watchdog: paced (-238, 67) ↔ (-212, 69) for 64 s here, 60 s and more in the verify run)`);
      // (the straight-line distance stands in for the route left here: a few seconds of slack on top of the rule)
      assert.ok(worstGap < LONG_NO_PROGRESS + 5, `no stretch of ${worstGap.toFixed(1)} s without getting closer`);
    }
  } finally { setCityTerrain(null); runtime.player.pathTarget = null; }
});

test('verify-desktop D5: the drive autopilot parks short of a postcard / resident / place at the route end, never on it', () => {
  // the map's 骑车去 to Clarion Alley ended 0.9 u from Luz's postcard (261.4, 606)
  const card = { x: 261.4, z: 606 };
  const route = [{ x: 240, z: 606.5 }, { x: 255, z: 606.6 }, { x: 260.8, z: 606.7 }];
  const out = stopShortOf(route, [card]);
  const end = out[out.length - 1];
  assert.ok(Math.hypot(end.x - card.x, end.z - card.z) >= PARK_CLEAR - 0.3, `parks ${Math.hypot(end.x - card.x, end.z - card.z).toFixed(2)} u from the card`);
  assert.ok(Math.hypot(end.x - card.x, end.z - card.z) <= PARK_CLEAR + 0.5, 'but close by: a couple of steps to walk');
  assert.deepEqual(out[0], route[0], 'the start is kept');
  for (let i = 1; i < out.length; i++) assert.ok(Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z) > 0.25, 'no zero-length stretch');
  // nothing to walk up to near the end: the route is untouched (a ground tap drives exactly there)
  assert.equal(stopShortOf(route, [{ x: 200, z: 600 }]), route);
  assert.equal(stopShortOf(route, []), route);
  // a spot beside the last stretch but not at the end does not cut the route
  assert.equal(stopShortOf(route, [{ x: 248, z: 612 }]), route);
  // a route that starts at the card (already there): kept (the rider can just get off)
  const here = [{ x: 261, z: 606.2 }, { x: 262, z: 606.4 }];
  assert.equal(stopShortOf(here, [card]), here);
  // a route bending round a corner onto the card stops on the last stretch
  const bend = [{ x: 250, z: 590 }, { x: 250, z: 606 }, { x: 261, z: 606 }];
  const b = stopShortOf(bend, [card]);
  assert.equal(b.length, 3);
  assert.ok(Math.abs(b[2].z - 606) < 1e-6 && b[2].x < 261.4 - PARK_CLEAR + 0.3);
});

test('verify-desktop D6: the drive autopilot waits for a walker who steps in front (≤ 6 s) instead of backing up and giving up', async () => {
  game.set({ phase: 'playing' });
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'vehicle:auto') events.push(e); });
  const ms = new MoveSystem();
  moveApi.bindMoveApi(ms);
  let unreg = () => {};
  try {
    const c = new PlayerController();
    const env = { cameraYaw: Math.PI, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() };
    const car = ms.fleet.rides.find(r => r.kind === 'car')!;
    resetPlayer({ x: car.sim.x + 1.6, z: car.sim.z }, 0);
    c.sync();
    ms.onInteract(`ride:${car.id}`, c);
    let t = 0;
    for (; t < 3; t += DT) ms.update(DT, t, env);
    assert.equal(ms.mode, 'car');
    assert.equal(moveApi.driveTo({ x: car.sim.x - 60, z: car.sim.z - 6 }), true);
    await tick();
    const path = ms.drivePath.slice();
    assert.ok(path.length >= 2, 'a route');
    // a walker stands on the route 10 u ahead for 4.5 s after the car gets there, then walks off
    let d = 0, spot = path[0];
    for (let i = 1; i < path.length && d < 10; i++) { const a = path[i - 1], b = path[i], L = Math.hypot(b.x - a.x, b.z - a.z); const k = Math.min(1, (10 - d) / L); spot = { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }; d += L; }
    let heldFrom = -1, gone = false;
    unreg = registerObstacleSource((out, x, z, r) => { if (!gone && Math.hypot(spot.x - x, spot.z - z) < r + 0.5) out.push({ x: spot.x, z: spot.z, r: 0.35, kind: 'crowd' }); });
    let arrivedAt = -1;
    for (let k = 0; k < 60 * 40 && arrivedAt < 0; k++, t += DT) {
      ms.update(DT, t, env);
      const near = Math.hypot(car.sim.x - spot.x, car.sim.z - spot.z) < 3.5;
      if (near && heldFrom < 0) heldFrom = t;
      if (heldFrom >= 0 && t - heldFrom > 4.5) gone = true;
      if (events.some(e => e.type === 'vehicle:auto' && (e.state === 'arrive' || e.state === 'stuck'))) arrivedAt = t;
    }
    assert.ok(heldFrom > 0, 'the car reached the walker');
    const states = events.map(e => (e as { state: string }).state);
    assert.deepEqual(states, ['start', 'arrive'], `the autopilot waited and drove on (events: ${states.join(', ')})`);
  } finally { unreg(); off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title' }); }
});

test('verify-desktop D10: the conversation two-shot counts a speaker hidden behind the player (and the old narrow angle did hide one)', async () => {
  const { pairOverlap } = await import('../src/opus-bay/actors/camera');
  // twoShotPose: the camera behind the player, rotated `a` round the pair's midpoint, 8 u out (+ 0.6 per u over 2.5)
  const shot = (L: number, a: number) => {
    const R = 8 + Math.max(0, L - 2.5) * 0.6;
    const cam = { x: Math.sin(a) * R, z: -Math.cos(a) * R }; // axis +z: player at −L/2, speaker at +L/2
    return pairOverlap(cam.x, cam.z, 0, -L / 2, 0, L / 2);
  };
  const A = 0.66;
  for (const L of [2.4, 2.9]) {
    assert.ok(shot(L, A * 0.65) > 0, `at ${L} u the 0.65× angle hides the speaker (the D10 shots)`);
    assert.ok(shot(L, A * 1.5) === 0, `at ${L} u the 1.5× angle shows both`);
  }
  assert.equal(shot(2.9, A), 0, 'the usual 38° shot of a pair 2.9 u apart is clear');
  assert.ok(shot(1.2, A) > shot(2.4, A), 'closer pairs overlap more');
  assert.equal(pairOverlap(0, -10, -3, 0, 3, 0), 0, 'side by side, seen from the front: clear');
});

test('W4-G4 (part b): BAYBAY in the basket points ≈ 20 u before a turn over 45° (the side seen from the saddle) and speaks at 1/3 and 2/3 of a long drive', async () => {
  const { DRIVE_TALK, DriveTalk, driveCueLine, routeCorners } = await import('../src/opus-bay/actors/vehicles/driveTalk');
  // north (−z) 100 u, then west (−x: a LEFT turn for the rider), 100 u, then north again (a RIGHT turn), 100 u
  const path = [{ x: 0, z: 0 }, { x: 0, z: -100 }, { x: -100, z: -100 }, { x: -100, z: -200 }];
  const corners = routeCorners(path);
  assert.equal(corners.length, 2);
  assert.ok(corners[0].turn > 0 && corners[1].turn < 0, 'left turn positive, right turn negative (heading = atan2(dx, dz))');
  const talk = new DriveTalk(path);
  const cues: { s: number; cue: NonNullable<ReturnType<typeof talk.step>> }[] = [];
  // 7 u/s along the route, 10 Hz
  for (let s = 0, t = 0; s <= 300; s += 0.7, t += 0.1) { const c = talk.step(s, t); if (c) cues.push({ s, cue: c }); }
  const turns = cues.filter(c => c.cue.kind === 'turn');
  assert.equal(turns.length, 2);
  assert.deepEqual(turns.map(c => c.cue.kind === 'turn' && c.cue.side), ['left', 'right']);
  for (const [i, c] of turns.entries()) assert.ok(Math.abs(corners[i].s - c.s - DRIVE_TALK.lead) < 1, `cue ${(corners[i].s - c.s).toFixed(1)} u before the corner`);
  assert.deepEqual(driveCueLine(turns[0].cue, 'bike'), { zh: '前面左转！', en: 'Left turn ahead!' });
  const thirds = cues.filter(c => c.cue.kind === 'third');
  assert.ok(thirds.length >= 1 && thirds.length <= 2, 'a line at the thirds (one may yield to a corner cue)');
  for (let i = 1; i < cues.length; i++) assert.ok((cues[i].s - cues[i - 1].s) / 7 >= DRIVE_TALK.quiet - 0.2, 'one cue at a time');
  // a short hop says nothing at the thirds; a gentle bend is no corner
  const short = new DriveTalk([{ x: 0, z: 0 }, { x: 0, z: -60 }, { x: 10, z: -120 }]);
  let said = 0;
  for (let s = 0, t = 0; s <= 125; s += 0.7, t += 0.1) if (short.step(s, t)) said++;
  assert.equal(said, 0);
});

test('part b: panorama tags on a crowded horizon (Twin Peaks at 1440 × 900) nudge sideways and lift up to 5 rows — all 8 find room, no overlaps, each anchor under its tag', async () => {
  const { layoutPanoramaTags, tagWidth, TAG_LIFTS } = await import('../src/opus-bay/game/flags');
  assert.equal(TAG_LIFTS, 5);
  const area = { l: 12, t: 80, r: 1428, b: 780 };
  const names = ['金门大桥', '渡轮大厦', '科伊特塔', '市政厅', '萨特罗塔', '金门公园', '海湾大桥', '恶魔岛'];
  // eight anchors along the skyline, 40–60 px apart (the 2,000 u view squeezes them together)
  const inputs = names.map((n, i) => ({ id: `t${i}`, x: 520 + i * 52, y: 360 + (i % 3) * 6, w: tagWidth(n), h: 26, rank: (i < 5 ? 1 : 2) as 1 | 2 }));
  const placed = layoutPanoramaTags(inputs, area, []);
  assert.equal(placed.length, 8, `placed ${placed.length} of 8 (in game before part b: 3 of 8 at Twin Peaks)`);
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i].box, anchor = inputs.find(t => t.id === placed[i].id)!;
    assert.ok(a.l >= area.l && a.r <= area.r && a.t >= area.t && a.b <= area.b);
    assert.ok(anchor.x >= a.l + 6 && anchor.x <= a.r - 6, 'the leader drops from under the tag');
    assert.ok(a.b <= anchor.y, 'above its anchor');
    for (let j = i + 1; j < placed.length; j++) {
      const b = placed[j].box;
      assert.ok(!(a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t), `${placed[i].id} overlaps ${placed[j].id}`);
    }
  }
});

test('W4-G9 (part b): coming out of a portal the ride camera looks back at the mouth pulled back and wider (the whole train), an attraction look does not', async () => {
  const THREE = await import('three');
  const { RideCamera, rideLookAt } = await import('../src/opus-bay/actors/cameraModes');
  const run = (wide: boolean) => {
    const cam = new RideCamera();
    const sub = { mode: 'transit' as const, x: 0, y: 0, z: 0, heading: 0, speed: 8, gradeAhead: 0, side: 1 as const };
    const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 46 };
    cam.update(sub, 1, 10, pose);
    rideLookAt(0, -60, 3.2, wide); // the portal behind the train
    const t0 = performance.now();
    while (performance.now() - t0 < 1000) { /* the 0.8 s ease-in */ }
    for (let i = 0; i < 90; i++) cam.update(sub, 1 / 30, 11 + i / 30, pose);
    return { d: Math.hypot(pose.pos.x, pose.pos.z), fov: pose.fov, h: pose.pos.y };
  };
  const plain = run(false), wide = run(true);
  assert.ok(wide.d > plain.d + 3, `pulled back (${plain.d.toFixed(1)} → ${wide.d.toFixed(1)} u)`);
  assert.ok(wide.fov > plain.fov + 3, `wider (${plain.fov.toFixed(1)} → ${wide.fov.toFixed(1)}°)`);
  assert.ok(wide.h > plain.h, 'a little higher');
});

test('verify-desktop D6: a stuck autopilot takes a grid route round the spot to the route further on (≤ 2 per drive) before handing back the steering', async () => {
  (globalThis as { window?: unknown }).window ??= { setTimeout, clearTimeout };
  const { PursuitDriver } = await import('../src/opus-bay/actors/vehicles/autopilot');
  const { CAR_SPEC } = await import('../src/opus-bay/actors/vehicles/toyCar');
  const { drivableAt, findDrivePath } = await import('../src/opus-bay/actors/vehicles/driveRoute');
  game.set({ phase: 'playing' });
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'vehicle:auto') events.push(e); });
  const ms = new MoveSystem();
  moveApi.bindMoveApi(ms);
  try {
    const c = new PlayerController();
    const env = { cameraYaw: Math.PI, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() };
    const car = ms.fleet.rides.find(r => r.kind === 'car')!;
    resetPlayer({ x: car.sim.x + 1.6, z: car.sim.z }, 0);
    c.sync();
    ms.onInteract(`ride:${car.id}`, c);
    await tick(); // (mounting fetches tap-to-drive's routing chunk: vehicles/driveRoute)
    let t = 0;
    for (; t < 3; t += DT) ms.update(DT, t, env);
    // a straight "route" through undrivable ground (as a walking-graph edge past a corner / a tree can be) whose end
    // is reachable by a grid route: the first such line round the toy car's spot
    const st = { x: car.sim.x, z: car.sim.z };
    let end: { x: number; z: number } | null = null;
    for (let k = 0; k < 32 && !end; k++) {
      const a = (k / 32) * Math.PI * 2, e = { x: st.x + Math.sin(a) * 20, z: st.z + Math.cos(a) * 20 };
      if (!drivableAt(e.x, e.z, 'car')) continue;
      let bad = 0;
      for (let d = 3; d < 18; d += 0.5) if (!drivableAt(st.x + Math.sin(a) * d, st.z + Math.cos(a) * d, 'car')) bad++;
      const r = bad >= 4 ? findDrivePath(st, e, 'car', 3) : null;
      if (r && !r.snapped) end = e;
    }
    assert.ok(end, 'a blocked straight line with a way round');
    ms.auto = new PursuitDriver(CAR_SPEC, [st, end!]);
    for (let k = 0; k < 60 * 40 && ms.auto; k++, t += DT) ms.update(DT, t, env);
    const states = events.map(e => (e as { state: string }).state);
    assert.deepEqual(states, ['arrive'], `went round and arrived (events: ${states.join(', ')})`);
    assert.ok(Math.hypot(car.sim.x - end!.x, car.sim.z - end!.z) < 2, 'at the end');
  } finally { off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title' }); }
});

test('W4-G4 (part b): no drive cue in the first seconds (the trip\'s "骑车出发！" line) nor for a corner right at the start', async () => {
  const { DRIVE_TALK, DriveTalk } = await import('../src/opus-bay/actors/vehicles/driveTalk');
  // a corner 5 u from the start and another at 40 u
  const talk = new DriveTalk([{ x: 0, z: 0 }, { x: 0, z: -5 }, { x: -30, z: -5 }, { x: -30, z: -40 }, { x: 0, z: -40 }]);
  const cues: number[] = [];
  for (let s = 0, t = 0; s <= 90; s += 0.35, t += 0.05) if (talk.step(s, t)) cues.push(t);
  assert.ok(cues.length >= 1, 'the later corners still get their cue');
  assert.ok(cues[0] >= DRIVE_TALK.hold, `first cue after ${DRIVE_TALK.hold} s (${cues[0].toFixed(2)})`);
});

test('part b: from a summit the skyline sits near the top of the frame — panorama tags hang under their anchors there (leader up), all 8, no overlaps', async () => {
  const { layoutPanoramaTags, tagWidth } = await import('../src/opus-bay/game/flags');
  const area = { l: 12, t: 80, r: 1428, b: 780 };
  const names = ['Painted Ladies', 'City Hall', 'Union Square', 'The Palace', 'Chinatown', 'Lombard St', 'Coit Tower', 'The Wharf'];
  // the Twin Peaks shot at 1440 × 900: the flags' tops at y 117–160 over x 250–660
  const inputs = names.map((n, i) => ({ id: `t${i}`, x: 250 + i * 58, y: 118 + (i % 3) * 20, w: tagWidth(n), h: 26, rank: 1 as const }));
  const placed = layoutPanoramaTags(inputs, area, []);
  assert.equal(placed.length, 8, `placed ${placed.length} of 8 (3 in game before)`);
  assert.ok(placed.some(p => p.below), 'some hang under their anchor');
  for (const p of placed) {
    const anchor = inputs.find(t => t.id === p.id)!;
    if (p.below) assert.ok(p.box.t > anchor.y && p.lead, 'under it, with a leader');
    else assert.ok(p.box.b <= anchor.y);
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i].box, b = placed[j].box;
    assert.ok(!(a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t), `${placed[i].id} overlaps ${placed[j].id}`);
  }
});
