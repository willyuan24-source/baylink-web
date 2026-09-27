import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { onEvent, type GameEvent } from '../src/opus-bay/core/events';
import { runtime } from '../src/opus-bay/core/runtime';
import { L3_STICK_MAX, clearKeys, input, onKeyDown, onKeyUp, padActions, pickGamepad, pollInput, rumble, touchJump } from '../src/opus-bay/core/input';
import { game } from '../src/opus-bay/core/store';
import { blockersNear, canStand, heightAt, setCityTerrain } from '../src/opus-bay/core/terrain';
import { createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { SF_LANDMARKS } from '../src/opus-bay/world/sf/landmarks/index';
import { facadeAlongRay, frontSpot, resetFacadeCache } from '../src/opus-bay/actors/tapTarget';
import { sfDisk } from './opus-bay-sf-disk';
import { GradeTracker, PANT, PlayerController, type Obstacle } from '../src/opus-bay/actors/controller';
import { DISTRICT } from '../src/opus-bay/data/district';
import { MoveSystem } from '../src/opus-bay/actors/moveSystem';
import * as moveApi from '../src/opus-bay/actors/moveApi';
import { registerObstacleSource } from '../src/opus-bay/actors/view';

// Lane E2, wave 3, part a: the cross-lane hooks other lanes wait for (setGlideUnlocked for G1's save v2, obstacle
// sources in giveWay for F's crowd and traffic), then the transit rider, touch, gamepad and pant work.

const DT = 1 / 60;
/** the district clock plaza (flat, open): a clean spot to jump */
const DISTRICT_CLOCK = DISTRICT.anchors['ferry-clock'];

function moveEnv(c: PlayerController) {
  return { cameraYaw: Math.PI, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() };
}

function resetPlayer(p: { x: number; z: number }, heading = 0) {
  const pl = runtime.player;
  pl.x = p.x; pl.z = p.z; pl.y = heightAt(p.x, p.z); pl.heading = heading;
  pl.pathTarget = null; pl.pendingInteract = null; pl.locked = false;
}

// ---------------------------------------------------------------------------
// setGlideUnlocked (G1's save v2 restore)
// ---------------------------------------------------------------------------

test('moveApi.setGlideUnlocked: applied at the bind when called before it, quiet (no unlock event), and locks again', () => {
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'glide:unlock') events.push(e); });
  moveApi.bindMoveApi(null);
  moveApi.setGlideUnlocked(true);
  assert.equal(moveApi.glideUnlocked(), true, 'before the bind: the pending value answers');
  const ms = new MoveSystem();
  assert.equal(ms.glideUnlocked, false, 'a fresh system starts locked (no viewpoint, no ?debug)');
  moveApi.bindMoveApi(ms);
  try {
    assert.equal(ms.glideUnlocked, true, 'the pending restore is applied at the bind');
    assert.equal(moveApi.glideUnlocked(), true);
    const c = new PlayerController();
    game.set({ phase: 'playing' });
    ms.update(DT, 0, moveEnv(c));
    assert.equal(events.length, 0, 'a restored unlock is quiet');
    moveApi.setGlideUnlocked(false);
    assert.equal(moveApi.glideUnlocked(), false, 'Settings reset locks it again');
    moveApi.setGlideUnlocked('yes' as unknown as boolean);
    assert.equal(moveApi.glideUnlocked(), false, 'junk is ignored');
    moveApi.setGlideUnlocked(true);
    assert.equal(ms.glideUnlocked, true);
  } finally { off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title' }); }
  moveApi.bindMoveApi(null);
  const ms2 = new MoveSystem();
  moveApi.bindMoveApi(ms2);
  try { assert.equal(ms2.glideUnlocked, false, 'the pending value is used once'); } finally { moveApi.bindMoveApi(null); ms2.dispose(); }
});

test('moveApi.subscribeGlide: the UI hears the bind, a restore and the viewpoint unlock', async () => {
  let calls = 0;
  const off = moveApi.subscribeGlide(() => { calls++; });
  const ms = new MoveSystem();
  try {
    moveApi.bindMoveApi(ms);
    assert.equal(calls, 0, 'the bind notifies after the render that built the system');
    await Promise.resolve();
    assert.equal(calls, 1);
    moveApi.setGlideUnlocked(true);
    assert.equal(calls, 2);
    moveApi.setGlideUnlocked(false);
    game.set({ phase: 'playing', viewpointUnlocked: true });
    // (the unlock line is a toast: core/store toast times out through window.setTimeout)
    const g = globalThis as { window?: unknown };
    const hadWindow = 'window' in g;
    if (!hadWindow) g.window = { setTimeout: () => 0 };
    try { ms.update(DT, 0, moveEnv(new PlayerController())); } finally { if (!hadWindow) delete g.window; }
    assert.equal(ms.glideUnlocked, true);
    assert.equal(calls, 4, 'the Coit viewpoint unlock notifies too');
  } finally { off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title', viewpointUnlocked: false }); }
});

// ---------------------------------------------------------------------------
// E2-16 · obstacle sources in giveWay (F's crowd walkers and toy traffic)
// ---------------------------------------------------------------------------

test('E2-16 giveWay: a vehicle stops short of a registered crowd walker (soft bump, a "whoa"), and drives on once it is gone', () => {
  game.set({ phase: 'playing' });
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'vehicle:bump' || e.type === 'bump') events.push(e); });
  const ms = new MoveSystem();
  moveApi.bindMoveApi(ms);
  let unregister = () => {};
  try {
    const c = new PlayerController();
    const car = ms.fleet.rides.find(r => r.kind === 'car')!;
    resetPlayer({ x: car.sim.x + 1.6, z: car.sim.z }, 0);
    c.sync();
    ms.onInteract(`ride:${car.id}`, c);
    let t = 0;
    for (; t < 3; t += DT) ms.update(DT, t, moveEnv(c));
    assert.equal(ms.mode, 'car');
    // a walker standing 7 u up the promenade, in the car's lane
    const fx = Math.sin(car.sim.heading), fz = Math.cos(car.sim.heading);
    const walker = { x: car.sim.x + fx * 7, z: car.sim.z + fz * 7 };
    const asked: number[] = [];
    unregister = registerObstacleSource((out: Obstacle[], x, z, r) => {
      asked.push(r);
      if (Math.hypot(walker.x - x, walker.z - z) <= r + 0.5) out.push({ x: walker.x, z: walker.z, r: 0.35, kind: 'crowd' });
    });
    runtime.input.moveY = 1;
    let minGap = Infinity;
    for (let k = 0; k < 60 * 3; k++, t += DT) {
      ms.update(DT, t, moveEnv(c));
      minGap = Math.min(minGap, (walker.x - car.sim.x) * fx + (walker.z - car.sim.z) * fz);
    }
    assert.ok(asked.length > 0, 'the source was asked');
    assert.ok(minGap > car.length * 0.5, `the car never reached the walker (closest gap ${minGap.toFixed(2)} u)`);
    assert.ok(events.some(e => e.type === 'vehicle:bump' && !e.hard), 'a soft bump');
    assert.ok(events.some(e => e.type === 'bump' && e.kind === 'npc'), 'the walker says whoa');
    // gone: the car drives on past the spot
    unregister(); unregister = () => {};
    for (let k = 0; k < 60 * 1.5; k++, t += DT) ms.update(DT, t, moveEnv(c));
    const past = (car.sim.x - walker.x) * fx + (car.sim.z - walker.z) * fz;
    assert.ok(past > 0, `drove on (${past.toFixed(2)} u past the spot)`);
    // toy traffic 6 u ahead (a wider radius): a soft bump at speed, no "whoa"
    events.length = 0;
    const hx = Math.sin(car.sim.heading), hz = Math.cos(car.sim.heading);
    const cab = { x: car.sim.x + hx * 6, z: car.sim.z + hz * 6 };
    unregister = registerObstacleSource((out, x, z, r) => {
      if (Math.hypot(cab.x - x, cab.z - z) <= r + 2) out.push({ x: cab.x, z: cab.z, r: 1.1, kind: 'traffic' });
    });
    let cabGap = Infinity;
    for (let k = 0; k < 60 * 2; k++, t += DT) {
      ms.update(DT, t, moveEnv(c));
      cabGap = Math.min(cabGap, Math.hypot(cab.x - car.sim.x, cab.z - car.sim.z));
    }
    assert.ok(cabGap > car.length * 0.5 + 0.9, `stopped short of the other car (gap ${cabGap.toFixed(2)} u)`);
    assert.ok(events.some(e => e.type === 'vehicle:bump'), 'traffic: a soft bump');
    assert.ok(!events.some(e => e.type === 'bump' && e.kind === 'npc'), 'traffic: no whoa');
    // a static source (a mural board) ahead: stops the car too, no voice
    unregister(); unregister = () => {};
    for (let k = 0; k < 60 * 2; k++, t += DT) ms.update(DT, t, moveEnv(c));
    events.length = 0;
    const board = { x: car.sim.x + Math.sin(car.sim.heading) * 5, z: car.sim.z + Math.cos(car.sim.heading) * 5 };
    unregister = registerObstacleSource((out, x, z, r) => { if (Math.hypot(board.x - x, board.z - z) <= r + 1) out.push({ x: board.x, z: board.z, r: 0.5, kind: 'static' }); });
    let boardGap = Infinity;
    for (let k = 0; k < 60 * 2; k++, t += DT) { ms.update(DT, t, moveEnv(c)); boardGap = Math.min(boardGap, Math.hypot(board.x - car.sim.x, board.z - car.sim.z)); }
    assert.ok(boardGap > car.length * 0.5, `stopped short of the board (gap ${boardGap.toFixed(2)} u)`);
    assert.ok(events.some(e => e.type === 'vehicle:bump'), 'static: a soft bump');
    assert.ok(!events.some(e => e.type === 'bump' && e.kind === 'npc'), 'static: no whoa');
  } finally { runtime.input.moveY = 0; unregister(); off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title' }); }
});

// ---------------------------------------------------------------------------
// M2 · a tap on a building facade walks to the ground in front of it (city mode)
// ---------------------------------------------------------------------------

test('M2 tap on a facade: the ray stops at the first city wall; the walk target is open ground in front of it; district unchanged', async () => {
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, 96, 210, 200, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  resetFacadeCache();
  try {
    // Union Square side streets (the phone QA shot): a camera 8 u up behind the player, looking at a tower wall on Post St
    const eye = { x: 97, y: heightAt(97, 229) + 8, z: 229 };
    const aim = { x: 101.1, y: 12.2, z: 192.6 };
    const L = Math.hypot(aim.x - eye.x, aim.y - eye.y, aim.z - eye.z);
    const d = { x: (aim.x - eye.x) / L, y: (aim.y - eye.y) / L, z: (aim.z - eye.z) / L };
    const hit = facadeAlongRay(eye, d, 400);
    assert.ok(hit, 'the ray stops at a wall');
    const wall = blockersNear(hit.x, hit.z, 0.05).find(b => b.kind === 'polygon' && b.top !== undefined);
    assert.ok(wall && wall.top !== undefined && hit.y <= wall.top, 'below the wall top of a city building');
    assert.ok(hit.t < L + 2, `the first wall on the way (t ${hit.t.toFixed(1)} vs aim ${L.toFixed(1)})`);
    assert.equal(facadeAlongRay(eye, d, 400), hit, 'the same ray answers from the cache (pointerdown / click)');
    // the player just behind that wall: the view dithers the wall away between the camera and the player, the tap goes through
    const behind = { x: eye.x + d.x * (hit.t + 4), y: eye.y + d.y * (hit.t + 4) - 1, z: eye.z + d.z * (hit.t + 4) };
    const through = facadeAlongRay(eye, d, 400, behind);
    assert.ok(!through || through.t > hit.t + 0.4, 'a dithered wall does not stop the tap');
    assert.deepEqual(facadeAlongRay(eye, d, 400, { x: eye.x - 30, y: 0, z: eye.z + 30 }), hit, 'a player elsewhere changes nothing');
    const spot = frontSpot(hit.x, hit.z, hit.ux, hit.uz);
    assert.ok(spot && canStand(spot.x, spot.z, 0.4), 'a standable walk target');
    const back = (spot.x - hit.x) * hit.ux + (spot.z - hit.z) * hit.uz;
    assert.ok(back < 0, `in front of the wall, on the camera side (${back.toFixed(2)})`);
    assert.ok(Math.hypot(spot.x - hit.x, spot.z - hit.z) < 20, 'near the wall');
    // a thin building seen over a lower row (the 375 × 667 QA shot): the street on the camera side, not its back street
    const eye2 = { x: 95.5, y: heightAt(95.5, 228) + 8, z: 228 };
    const aim2 = { x: 98.2, y: 10, z: 191.4 };
    const L2 = Math.hypot(aim2.x - eye2.x, aim2.y - eye2.y, aim2.z - eye2.z);
    const hit2 = facadeAlongRay(eye2, { x: (aim2.x - eye2.x) / L2, y: (aim2.y - eye2.y) / L2, z: (aim2.z - eye2.z) / L2 }, 400);
    assert.ok(hit2, 'the thin building is hit');
    const spot2 = frontSpot(hit2.x, hit2.z, hit2.ux, hit2.uz);
    assert.ok(spot2 && canStand(spot2.x, spot2.z, 0.4));
    assert.ok((spot2.x - hit2.x) * hit2.ux + (spot2.z - hit2.z) * hit2.uz < 0, `camera side: ${spot2.x.toFixed(1)}, ${spot2.z.toFixed(1)}`);
    // a ray at the street under the camera meets no wall before the ground
    const down = { x: 0.05, y: -1, z: -0.3 };
    const dl = Math.hypot(down.x, down.y, down.z);
    assert.equal(facadeAlongRay(eye, { x: down.x / dl, y: down.y / dl, z: down.z / dl }, 9), null, 'open ground: no wall');
  } finally { setCityTerrain(null); resetFacadeCache(); }
  // district mode: no building tops, the ground picker stays as it was
  assert.equal(facadeAlongRay({ x: 120, y: 30, z: -40 }, { x: 0.6, y: -0.2, z: 0.77 }, 400), null);
});

// ---------------------------------------------------------------------------
// E2-9 · the touch 跳 / Hop button: a press is the jump edge, holding it is the full jump
// ---------------------------------------------------------------------------

test('E2-9 touch hop: a press raises the jump edge once, a quick tap is a short hop, a held press the full jump', () => {
  const c = new PlayerController();
  const apex = (holdFrames: number) => {
    resetPlayer(DISTRICT_CLOCK, 0);
    c.sync();
    let top = 0;
    touchJump(true);
    assert.equal(runtime.input.jump, true, 'the press is a jump edge');
    touchJump(true);
    for (let i = 0; i < 80; i++) {
      if (i === holdFrames) touchJump(false);
      pollInput();
      c.step({ dt: DT, now: i * DT, cameraYaw: 0, frozen: false, riding: false });
      top = Math.max(top, runtime.player.y - heightAt(runtime.player.x, runtime.player.z));
    }
    touchJump(false);
    return top;
  };
  // (a finger tap lasts ~0.1 s, past the 0.07 s take-off crouch; a release before take-off keeps the full jump, as for clicks)
  const tap = apex(8), held = apex(60);
  assert.ok(tap < 1.0, `quick tap: short hop (${tap.toFixed(2)} u)`);
  assert.ok(held > 1.3, `held: the full jump (${held.toFixed(2)} u)`);
  // held touch + Space released: still held; clearKeys (blur) lets go
  touchJump(true);
  onKeyDown({ code: 'Space', repeat: false, target: null, metaKey: false, ctrlKey: false, altKey: false });
  onKeyUp({ code: 'Space' });
  assert.equal(input.jumpHeld, true, 'the thumb still holds it');
  clearKeys();
  pollInput();
  assert.equal(input.jumpHeld, false, 'blur releases the touch hold');
  assert.equal(input.touchJumpHeld, false);
  runtime.input.jump = false;
});

test('E2-review touch hop: a tap released before the take-off crouch is a short hop too; Space keeps the old rule', () => {
  const c = new PlayerController();
  const apex = (press: () => void, release: () => void, releaseAt: number) => {
    resetPlayer(DISTRICT_CLOCK, 0);
    c.sync();
    let top = 0;
    press();
    for (let i = 0; i < 80; i++) {
      if (i === releaseAt) release();
      pollInput();
      c.step({ dt: DT, now: i * DT, cameraYaw: 0, frozen: false, riding: false });
      top = Math.max(top, runtime.player.y - heightAt(runtime.player.x, runtime.player.z));
    }
    return top;
  };
  const key = (code: string) => ({ code, repeat: false, target: null, metaKey: false, ctrlKey: false, altKey: false });
  // (before: a 40 ms touch tap — released inside the 0.07 s crouch — gave the full 1.33 u jump, a 0.1 s tap 0.65 u)
  const quick = apex(() => touchJump(true), () => touchJump(false), 1);
  const tap = apex(() => touchJump(true), () => touchJump(false), 8);
  const held = apex(() => touchJump(true), () => touchJump(false), 60);
  assert.ok(quick < 1.0 && tap < 1.0, `quick ${quick.toFixed(2)} u, tap ${tap.toFixed(2)} u: short hops`);
  assert.ok(held > 1.3, `held: the full jump (${held.toFixed(2)} u)`);
  const space = apex(() => onKeyDown(key('Space')), () => onKeyUp({ code: 'Space' }), 1);
  assert.ok(space > 1.3, `Space released before take-off keeps the full jump (${space.toFixed(2)} u)`);
  assert.equal(input.touchJumpArm, false, 'the touch mark goes with the edge');
  runtime.input.jump = false;
});

// ---------------------------------------------------------------------------
// E2-11 · gamepad: standard mapping first, A = interact + the E count, View = map, L3 ignored on a hard stick push
// ---------------------------------------------------------------------------

test('E2-11 gamepad (stubbed getGamepads): standard pad preferred, A counts as E, View opens the map, L3 needs a calm stick, rumble', () => {
  type Btn = { pressed: boolean; value: number };
  const mkPad = (mapping: string, index: number) => {
    const buttons: Btn[] = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const effects: { type: string; p: { duration: number } }[] = [];
    return {
      id: `pad ${index}`, index, connected: true, mapping, timestamp: 0, axes: [0, 0, 0, 0], buttons, hapticActuators: [],
      vibrationActuator: { playEffect: (type: string, p: { duration: number }) => { effects.push({ type, p }); return Promise.resolve('complete'); } },
      effects,
    };
  };
  const odd = mkPad('', 0), std = mkPad('standard', 1);
  const nav = globalThis.navigator as unknown as Record<string, unknown>;
  const had = Object.getOwnPropertyDescriptor(nav, 'getGamepads');
  let pads: unknown[] = [null, odd, std];
  Object.defineProperty(nav, 'getGamepads', { value: () => pads, configurable: true, writable: true });
  const press = (pad: ReturnType<typeof mkPad>, i: number, on: boolean) => { pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; };
  let maps = 0;
  padActions.map = () => { maps++; };
  try {
    assert.equal(pickGamepad(pads as Gamepad[]), std as unknown as Gamepad, 'the standard-mapped pad wins');
    assert.equal(pickGamepad([odd] as unknown as Gamepad[]), odd as unknown as Gamepad, 'else the first connected one');
    assert.equal(pickGamepad([null, { ...std, connected: false }] as unknown as Gamepad[]), null);
    // (the non-standard pad's buttons are ignored while a standard one is there)
    press(odd, 3, true);
    // A: one edge = the flow's interact + one E count; holding it does not repeat
    runtime.input.interact = false;
    const e0 = input.interactCount;
    press(std, 0, true);
    pollInput();
    assert.equal(runtime.input.interact, true);
    assert.equal(input.interactCount, e0 + 1);
    assert.equal(runtime.input.device, 'gamepad');
    runtime.input.interact = false;
    pollInput();
    assert.equal(input.interactCount, e0 + 1, 'held A does not repeat');
    assert.equal(runtime.input.interact, false);
    press(std, 0, false); pollInput();
    // View / Back → the map (once per press)
    press(std, 8, true); pollInput(); pollInput();
    press(std, 8, false); pollInput();
    assert.equal(maps, 1, 'View opened the map once');
    // L3 with the stick pushed hard (a run): ignored; with the stick calm: take-off
    const g0 = input.glideCount;
    std.axes[0] = 0.2; std.axes[1] = -0.99;
    assert.ok(Math.hypot(std.axes[0], std.axes[1]) > L3_STICK_MAX);
    press(std, 10, true); pollInput();
    assert.equal(runtime.input.run, true, 'a hard push runs');
    press(std, 10, false); pollInput();
    assert.equal(input.glideCount, g0, 'L3 clicked by a hard push is ignored');
    std.axes[0] = 0; std.axes[1] = -0.4;
    press(std, 10, true); pollInput();
    press(std, 10, false); pollInput();
    assert.equal(input.glideCount, g0 + 1, 'L3 with a calm stick takes off');
    std.axes[1] = 0;
    // B held = jump held (the variable jump)
    press(std, 1, true); pollInput();
    assert.equal(runtime.input.jump, true);
    assert.equal(input.jumpHeld, true);
    press(std, 1, false); pollInput();
    assert.equal(input.jumpHeld, false);
    runtime.input.jump = false;
    // rumble: on the pad in use, clamped; nothing once the keyboard is the device
    rumble(0.5, 2, 1000);
    assert.equal(std.effects.length, 1);
    assert.equal(std.effects[0].type, 'dual-rumble');
    assert.equal(std.effects[0].p.duration, 400);
    runtime.input.device = 'keyboard';
    rumble(0.5, 0.5, 100);
    assert.equal(std.effects.length, 1);
    // no pad at all: nothing breaks, the pad inputs read zero
    pads = [];
    pollInput();
    assert.equal(input.throttle, 0);
  } finally {
    padActions.map = null;
    if (had) Object.defineProperty(nav, 'getGamepads', had); else delete nav.getGamepads;
    pollInput();
    runtime.input.device = 'keyboard'; runtime.input.interact = false; runtime.input.jump = false;
  }
});

// ---------------------------------------------------------------------------
// E2-13 · the crest pant by climb height
// ---------------------------------------------------------------------------

test('E2-13 crest pant rule: ≥ 6 u rise at g > 0.2 (walking too), fires at the crest, landings are not crests, 45 s cooldown', () => {
  const tr = new GradeTracker();
  let y = 0, t = 0;
  const pants: number[] = [];
  /** walk `secs` at grade g and 3 u/s (moving = false: standing still) */
  const go = (secs: number, g: number, moving = true) => {
    for (let k = 0; k < Math.round(secs / DT); k++) {
      if (moving) y += g * 3 * DT;
      t += DT;
      if (tr.update(DT, moving ? g : 0, moving, y)) pants.push(t);
    }
  };
  // 4 u up the steps, a 0.5 s landing, a gentle stretch, 4 u more: no pant on the way
  go(4 / 0.9, 0.3); go(0.5, 0.02); go(3, 0.15); go(4 / 0.9, 0.3);
  assert.equal(pants.length, 0, 'no pant on the way up');
  assert.ok(tr.rise > 8, `one climb (${tr.rise.toFixed(1)} u)`);
  const top = t;
  go(2, 0);
  assert.equal(pants.length, 1, 'one pant at the crest');
  assert.ok(pants[0] - top <= PANT.crestMove + DT * 2, `right at the top (${(pants[0] - top).toFixed(2)} s)`);
  // another 7 u climb 20 s later: inside the cooldown
  go(20, 0); go(7 / 0.9, 0.3); go(2, 0);
  assert.equal(pants.length, 1, '45 s cooldown');
  // after the cooldown: a climb that ends by standing still at the top pants
  go(30, 0, false); go(7 / 0.9, 0.3); go(1.2, 0, false);
  assert.equal(pants.length, 1, 'still standing 1.2 s: not yet');
  go(0.5, 0, false);
  assert.equal(pants.length, 2, 'standing 1.5 s at the top');
  // a climb that turns straight back down (1.5 u below its peak) is a crest too; 5 u is not enough
  go(50, 0); go(5 / 0.9, 0.3); go(1, -0.3);
  assert.equal(pants.length, 2, '5 u: no pant');
  tr.reset();
  assert.equal(tr.rise, 0, 'reset forgets the climb');
});

test("E2-13 the Filbert Steps: a click-to-walk from Levi's Plaza to the Coit summit pants once, at the top", () => {
  const c = new PlayerController();
  const a = DISTRICT.anchors['levis-plaza'], b = DISTRICT.anchors['coit-summit'];
  resetPlayer(a, 0);
  c.sync();
  const p = runtime.player;
  p.pathTarget = { x: b.x, z: b.z };
  const pants: { t: number; y: number }[] = [];
  let arrived = -1, maxY = 0;
  for (let i = 0; i < 60 * 60; i++) {
    const t = i * DT;
    c.step({ dt: DT, now: t, cameraYaw: 0, frozen: false, riding: false });
    maxY = Math.max(maxY, p.y);
    if (c.pantAt === t) pants.push({ t, y: p.y });
    if (arrived < 0 && !p.pathTarget && i > 60) arrived = t;
    if (arrived >= 0 && t > arrived + 4) break;
  }
  assert.ok(arrived > 0, 'arrived at the summit');
  assert.ok(maxY > 15, `climbed (${maxY.toFixed(1)} u)`);
  assert.equal(pants.length, 1, `one pant (${JSON.stringify(pants)})`);
  assert.ok(pants[0].y > maxY - 0.5, 'at the top');
  assert.ok(pants[0].t - arrived <= PANT.crestStill + 0.1, 'as the walker stops there');
  p.pathTarget = null;
});
