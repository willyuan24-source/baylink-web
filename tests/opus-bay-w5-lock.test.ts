import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import * as THREE from 'three';

/**
 * Wave 5 · MF1 (owner F1: 有时如果飞的话，下来的时候，很多时候卡住，需要对话后，才能移动) — never stuck after a landing or an
 * arrival. Day 0 (W5-0b, the lead's hotfix) wrote the paths that run in node; lane F owns this file from W5-F1: the lock
 * is derived (game/playerLock deriveLock, every frame and at once after a change), and every path of plan
 * sf-w5-plan.md §2 MF1 is here — the tour-stop reveal, a walk trip's end, 飞过去 to a first-visit tier-1 site, a glide
 * landing then a tier-1 zone, the hop-off of the bus, the LRV, a cable car, the F-line and the ferry, the ArrivalCard's
 * close, the viewpoint panorama, the telescope, a resident's chat, photo mode, the map, the shop's try-on, a PlayKit
 * activity, an egg's camera beat — plus the game start, a district viewpoint and a plain 飞过去.
 *
 * Every path ends with the same check: the player's controller, stepped exactly as actors/system.ts steps it (its
 * `frozen` rule, the movement system first), walks ≥ 1 u within 1 s of the path ending — and the lock watchdog never
 * had to free anyone on the way (a watchdog release is a bug with a source, plan MF1).
 *
 * The cause (plan §2 MF1): the first-arrival reveal (guideCity reveal → cinema.playShots, 2.4 s) locked the player
 * and cinema's finish never recomputed the lock; only the next dialogue's close (flow.refreshLock) freed the feet.
 */

// flow code runs in the browser; give it the few globals it touches
const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { canStand, heightAt, setCityTerrain } = await import('../src/opus-bay/core/terrain');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const flowMod = await import('../src/opus-bay/game/flow');
const { cinemaActive, playShots, stepCinema, skipCinema } = await import('../src/opus-bay/game/cinema');
const { startTravel, stepTravel, travelActive } = await import('../src/opus-bay/game/fastTravel');
const { stepTransit, hopOffRide } = await import('../src/opus-bay/game/transit');
const { deriveLock } = await import('../src/opus-bay/game/playerLock');
const { stepLockWatchdog: watchdogStep, watchdogStats: wdStats } = await import('../src/opus-bay/game/lockWatchdog');
const { ArrivalWatcher, arrivalAnchors, arrivalBeats } = await import('../src/opus-bay/game/arrival');
const { ATTRACTIONS, ATTRACTION_INDEX, tripDestination } = await import('../src/opus-bay/data/sf/attractions');
const { planReveal, photoPose, revealShots } = await import('../src/opus-bay/actors/reveal');
const { landmarkBaseY } = await import('../src/opus-bay/actors/glideTall');
const { PlayerController } = await import('../src/opus-bay/actors/controller');
const { MoveSystem } = await import('../src/opus-bay/actors/moveSystem');
const moveApi = await import('../src/opus-bay/actors/moveApi');
const { input } = await import('../src/opus-bay/core/input');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { POIS } = await import('../src/opus-bay/data/pois');
const { NODES, START_NODE } = await import('../src/opus-bay/data/script');
const { buildInteractables, setInteractables } = await import('../src/opus-bay/game/interactables');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const siteContext = await import('../src/opus-bay/world/sf/landmarks/context');
const { sfDisk } = await import('./opus-bay-sf-disk');

setStorageForTests(null);

const DT = 1 / 30;
const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
const FERRY = DISTRICT.anchors['ferry-gate'];

type Vec2 = { x: number; z: number };

/** The published city (from disk) with the chunks within r of each point attached, registered as the terrain. */
async function cityAround(points: Vec2[], r: number) {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (const p of points) await sf.attachAround(city, p.x, p.z, r, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  return city;
}

// ---------------------------------------------------------------------------------------------------------------
// A small stand-in for the Canvas frame: game/Systems.tsx Ticker (cinema, travel) then actors/system.ts (movement
// system, then the controller with its `frozen` rule)
// ---------------------------------------------------------------------------------------------------------------

interface Rig { c: InstanceType<typeof PlayerController>; ms: InstanceType<typeof MoveSystem> | null; t: number; yaw: number }

function rig(withMoves: boolean): Rig {
  const ms = withMoves ? new MoveSystem() : null;
  if (ms) moveApi.bindMoveApi(ms);
  return { c: new PlayerController(), ms, t: 0, yaw: 0 };
}
function disposeRig(r: Rig) {
  if (r.ms) { moveApi.bindMoveApi(null); r.ms.dispose(); }
}

/** actors/system.ts ActorSystem.update: what freezes the walker (`frozen`) and what the movement system gets. */
function flowFrozen() {
  const s = game.get(), f = flow.get();
  return s.phase !== 'playing' || s.photoMode || !!s.dialogue.nodeId || !!f.fishing || !!f.postcardReward || !!f.cinematic;
}
const walkerFrozen = () => runtime.player.locked || flowFrozen();

function frame(r: Rig, dt = DT) {
  r.t += dt;
  // game/Systems.tsx Ticker (cinema, travel, rides, then the derived lock and its watchdog)
  stepCinema(dt);
  stepTravel(dt);
  stepTransit(dt);
  deriveLock();
  watchdogStep(dt);
  // actors/system.ts
  const s = game.get();
  r.ms?.update(dt, r.t, { cameraYaw: r.yaw, frozen: flowFrozen(), playing: s.phase === 'playing', controller: r.c, frustum: new THREE.Frustum() });
  r.c.step({ dt, now: r.t, cameraYaw: r.yaw, frozen: walkerFrozen(), riding: (r.ms?.carried ?? false) || s.riding === 'streetcar' });
}
function run(r: Rig, seconds: number, until?: () => boolean) {
  for (let t = 0; t < seconds; t += DT) { frame(r); if (until?.()) return true; }
  return false;
}

/** The camera yaw whose forward (controller: (−sin yaw, −cos yaw)) points along (dx, dz). */
const yawFor = (dx: number, dz: number) => Math.atan2(-dx, -dz);

/** A direction with standable ground for 4 u ahead (the check is about the lock, not about a wall in front). */
function openDirection(p: Vec2): Vec2 {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    if ([1, 2, 3, 4].every(k => canStand(p.x + dx * k, p.z + dz * k, 0.45))) return { x: dx, z: dz };
  }
  return { x: 0, z: 1 };
}

/** The acceptance check: push the stick for 1 s right after the path ended; the player walks ≥ 1 u. */
function walksWithin1s(r: Rig, label: string) {
  assert.equal(wdStats.releases, releasesAtStart, `${label}: the watchdog freed the player on the way (${JSON.stringify(wdStats.last)})`);
  const p = runtime.player;
  const from = { x: p.x, z: p.z };
  const d = openDirection(from);
  r.yaw = yawFor(d.x, d.z);
  runtime.input.moveX = 0; runtime.input.moveY = 1;
  try { run(r, 1); } finally { runtime.input.moveY = 0; }
  const moved = Math.hypot(p.x - from.x, p.z - from.z);
  assert.ok(moved >= 1, `${label}: walked ${moved.toFixed(2)} u in 1 s (locked ${runtime.player.locked}, cinematic ${flow.get().cinematic}, dialogue ${game.get().dialogue.nodeId})`);
}

/** watchdog releases when the path began (resetGame): a path that needed one fails */
let releasesAtStart = 0;

function resetGame(worldMode: 'district' | 'city') {
  releasesAtStart = wdStats.releases;
  game.set({ phase: 'playing', worldMode, move: { mode: 'foot' }, riding: null, photoMode: false, dialogue: { nodeId: null }, panel: { kind: null } });
  flow.set(initialFlowState());
  const p = runtime.player;
  p.locked = false; p.pathTarget = null; p.pendingInteract = null;
  runtime.input.moveX = 0; runtime.input.moveY = 0; runtime.input.run = false; runtime.input.jump = false;
  runtime.camera.shot = null;
  setInteractables(buildInteractables());
}
function place(r: Rig, p: Vec2, heading = 0) {
  const pl = runtime.player;
  pl.x = p.x; pl.z = p.z; pl.y = heightAt(p.x, p.z); pl.heading = heading;
  r.c.sync();
}

// ---------------------------------------------------------------------------------------------------------------
// The first-arrival reveal as game/guideCity.ts plays it (onArrival → reveal: the site's photo pose, planReveal,
// playShots('arrival', revealShots(plan), done)); `done` shows the card — it never touched the lock
// ---------------------------------------------------------------------------------------------------------------

function playReveal(attraction: string, camera: { x: number; y: number; z: number }): boolean {
  const a = ATTRACTION_INDEX.get(attraction);
  if (!a) return false;
  const id = a.landmarkId ?? siteContext.w4SiteOf(a.placeId ?? a.id)?.id ?? a.siteId;
  const frame = id ? siteContext.siteFrame(id, landmarkBaseY) : null, photo = id ? siteContext.sitePhoto(id) : null;
  if (!frame || !photo) return false;
  const p = runtime.player, feet = Math.max(p.y, heightAt(p.x, p.z));
  const plan = planReveal({ pos: camera, target: { x: p.x, y: feet + 1.6, z: p.z } }, photoPose(frame, photo), { x: p.x, y: feet, z: p.z }, (x, z) => heightAt(x, z));
  playShots('arrival', revealShots(plan), () => { flow.set({ arrival: null }); });
  return true;
}

/** Walk the player to an arrival anchor (auto-path), sampling lane C's ArrivalWatcher at 4 Hz like cityMoments. */
function arriveAt(r: Rig, watcher: InstanceType<typeof ArrivalWatcher>, target: Vec2, seconds = 30) {
  let acc = 0;
  const sample = () => {
    const s = game.get(), f = flow.get(), mode = s.move.mode;
    return watcher.step({
      x: runtime.player.x, z: runtime.player.z, now: r.t * 1000,
      onFoot: mode === 'foot' || mode === 'photo' || mode === 'sit',
      busy: !!s.dialogue.nodeId || !!s.panel.kind || cinemaActive() || !!f.cinematic || !!f.postcardReward || !!f.postcardFly,
      travelling: travelActive(),
    });
  };
  let hit = sample();
  if (hit) return hit;
  runtime.player.pathTarget = { x: target.x, z: target.z };
  for (let t = 0; t < seconds && !hit; t += DT) {
    frame(r);
    if ((acc += DT) >= 0.25) { acc = 0; hit = sample(); }
  }
  runtime.player.pathTarget = null;
  return hit;
}

// ---------------------------------------------------------------------------------------------------------------
// 1. The cinema itself (unit)
// ---------------------------------------------------------------------------------------------------------------

test('cinema: a shot sequence that ends frees the player when nothing else holds (the reveal\'s done never touched the lock)', () => {
  resetGame('district');
  const shot = { position: [0, 10, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], duration: 0.6, hold: 0.4 };
  let done = 0;
  playShots('arrival', [shot, shot, shot], () => { done++; });
  assert.equal(runtime.player.locked, true, 'locked while the shots play');
  for (let i = 0; i < 400 && cinemaActive(); i++) stepCinema(0.05);
  assert.equal(done, 1);
  assert.equal(cinemaActive(), false);
  assert.equal(flow.get().cinematic, null);
  assert.equal(runtime.player.locked, false, 'free after the last shot');
  // skipped (Esc / Skip): the same
  playShots('arrival', [shot, shot], () => { done++; });
  stepCinema(0.016);
  skipCinema();
  assert.equal(done, 2);
  assert.equal(runtime.player.locked, false, 'free after a skip');
});

test('cinema: the lock follows what is still open when the shots end (a dialogue opened by `done` keeps it; a sequence replaced by another keeps it)', () => {
  resetGame('district');
  const shot = { position: [0, 10, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], duration: 0.3 };
  playShots('viewpoint', [shot], () => flowMod.playDialogue(START_NODE));
  for (let i = 0; i < 100 && cinemaActive(); i++) stepCinema(0.05);
  assert.equal(game.get().dialogue.nodeId, START_NODE);
  assert.equal(runtime.player.locked, true, 'the dialogue the shots opened holds the player');
  flowMod.closeDialogue();
  assert.equal(runtime.player.locked, false);
  // a second sequence starting while the first runs: still locked until the second ends
  playShots('arrival', [shot, shot]);
  stepCinema(0.016);
  playShots('telescope', [shot, shot, shot]);
  stepCinema(0.016);
  assert.equal(runtime.player.locked, true);
  for (let i = 0; i < 100 && cinemaActive(); i++) stepCinema(0.05);
  assert.equal(runtime.player.locked, false);
});

// ---------------------------------------------------------------------------------------------------------------
// 2. The landing and arrival paths (district: the start; city: 飞过去 and the glide, on the published city)
// ---------------------------------------------------------------------------------------------------------------

test('path · the game start: the ferry arrival cinematic → the welcome → closing it → walking', () => {
  resetGame('district');
  const r = rig(false);
  try {
    mock.timers.enable({ apis: ['setTimeout'] });
    game.set({ phase: 'title' });
    flowMod.startGame();
    place(r, runtime.player, runtime.player.heading);
    for (let i = 0; i < 400 && cinemaActive(); i++) frame(r, 0.05);
    assert.equal(game.get().phase, 'playing');
    // the welcome's free-roam choice
    flowMod.playDialogue(START_NODE);
    const free = NODES[START_NODE].choices?.findIndex(c => c.action?.type === 'free-roam') ?? -1;
    flowMod.chooseDialogue(free);
    for (let i = 0; i < 20 && game.get().dialogue.nodeId; i++) flowMod.closeDialogue();
    walksWithin1s(r, 'after the welcome');
  } finally { mock.timers.reset(); disposeRig(r); }
});

test('path · a district viewpoint: the camera sweep → the reaction → closing it → walking', () => {
  resetGame('district');
  const r = rig(false);
  try {
    mock.timers.enable({ apis: ['setTimeout'] });
    const vp = POIS.find(poi => poi.interaction.kind === 'viewpoint');
    assert.ok(vp);
    place(r, vp.position);
    flowMod.performInteraction(vp.id);
    assert.equal(flow.get().cinematic, 'viewpoint');
    for (let i = 0; i < 400 && cinemaActive(); i++) frame(r, 0.05);
    for (let i = 0; i < 20 && game.get().dialogue.nodeId; i++) flowMod.closeDialogue();
    if (game.get().panel.kind) flowMod.closePanel();
    mock.timers.tick(3000);
    walksWithin1s(r, 'after the viewpoint');
  } finally { mock.timers.reset(); disposeRig(r); }
});

test('path · 飞过去 to a first-visit tier-1 site (Palace of Fine Arts): the trip lands, the first arrival\'s reveal plays, the player walks within 1 s', async () => {
  const palace = ATTRACTION_INDEX.get('palace-of-fine-arts');
  assert.ok(palace);
  const dest = tripDestination(palace);
  const arrive = palace.arrival ?? palace;
  await cityAround([FERRY, dest, arrive], 150);
  resetGame('city');
  const r = rig(true);
  try {
    place(r, FERRY);
    assert.ok(startTravel({ id: palace.id, name: palace.name, x: dest.x, z: dest.z }));
    assert.equal(runtime.player.locked, true, 'locked for the trip');
    assert.ok(run(r, 30, () => !travelActive()), 'the trip ends');
    run(r, 1);
    assert.equal(game.get().move.mode, 'foot');
    assert.equal(runtime.player.locked, false, 'free on landing');
    const watcher = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS));
    const hit = arriveAt(r, watcher, arrive);
    assert.ok(hit, 'the arrival fires');
    assert.equal(hit.anchor.attraction, 'palace-of-fine-arts');
    const beats = arrivalBeats(hit, { reducedMotion: false, qualityLow: false });
    assert.ok(hit.first && beats.reveal, 'a first tier-1 arrival on foot: the reveal plays');
    const p = runtime.player;
    assert.ok(playReveal(hit.anchor.attraction, { x: p.x + 6, y: p.y + 5, z: p.z + 6 }));
    assert.equal(runtime.player.locked, true, 'held for the reveal');
    assert.ok(run(r, 6, () => !cinemaActive()), 'the reveal ends (2.4 s)');
    walksWithin1s(r, 'after the 飞过去 + first-arrival reveal');
  } finally { disposeRig(r); setCityTerrain(null); game.set({ phase: 'title', worldMode: 'district', move: { mode: 'foot' } }); }
});

test('path · a glide landing, then walking into a tier-1 zone (City Hall): the reveal plays, the player walks within 1 s', async () => {
  const hall = ATTRACTION_INDEX.get('city-hall');
  assert.ok(hall);
  const arrive = hall.arrival ?? hall;
  await cityAround([arrive], 220);
  resetGame('city');
  const r = rig(true);
  try {
    // take off 90 u out from the arrival spot, looking at it
    const start = (() => {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, q = { x: arrive.x + Math.sin(a) * 90, z: arrive.z + Math.cos(a) * 90 };
        if (canStand(q.x, q.z, 0.45)) return q;
      }
      return null;
    })();
    assert.ok(start, 'a take-off spot');
    place(r, start);
    r.ms!.setGlideUnlocked(true);
    runtime.camera.yaw = Math.atan2(start.x - arrive.x, start.z - arrive.z);   // the glide flies along camera yaw + π
    r.yaw = runtime.camera.yaw;
    input.glideCount++;
    run(r, 2.5);
    assert.equal(r.ms!.mode, 'glide', 'gliding');
    input.glideCount++;                                                          // G / 降落
    assert.ok(run(r, 12, () => r.ms!.mode === 'foot'), 'landed');
    run(r, 0.5);
    assert.equal(runtime.player.locked, false, 'free on landing');
    const watcher = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS));
    const hit = arriveAt(r, watcher, arrive);
    assert.ok(hit, 'the arrival fires');
    assert.equal(hit.anchor.attraction, 'city-hall');
    assert.ok(hit.first && arrivalBeats(hit).reveal, 'the reveal plays');
    const p = runtime.player;
    assert.ok(playReveal('city-hall', { x: p.x + 6, y: p.y + 5, z: p.z + 6 }));
    assert.ok(run(r, 6, () => !cinemaActive()), 'the reveal ends');
    walksWithin1s(r, 'after the glide landing + first-arrival reveal');
  } finally { disposeRig(r); setCityTerrain(null); game.set({ phase: 'title', worldMode: 'district', move: { mode: 'foot' } }); }
});

test('path · 飞过去 without an arrival moment: the player walks within 1 s of the landing; a dialogue closing mid-trip never frees the rider', async () => {
  resetGame('district');
  const r = rig(true);
  try {
    place(r, FERRY);
    const dest = DISTRICT.anchors['sea-lion-viewpoint'];
    assert.ok(startTravel({ id: 'test', name: { zh: '测试', en: 'Test' }, x: dest.x, z: dest.z }));
    run(r, 1);
    // anything that re-derives the lock mid-trip (a line's dialogue closing, a ride ending) must not free the rider
    flowMod.refreshLock();
    assert.equal(runtime.player.locked, true, 'still held by the trip');
    assert.ok(run(r, 30, () => !travelActive()), 'the trip ends');
    run(r, 1);
    assert.equal(runtime.player.locked, false);
    walksWithin1s(r, 'after a plain 飞过去');
  } finally { disposeRig(r); game.set({ phase: 'title', move: { mode: 'foot' } }); }
});

// ---------------------------------------------------------------------------------------------------------------
// 3. game/playerLock (the API frozen at day 0) and the watchdog
// ---------------------------------------------------------------------------------------------------------------

const { holdLock, lockHeld, lockReport } = await import('../src/opus-bay/game/playerLock');
const { WATCHDOG_S, lockExplanation, stepLockWatchdog, watchdogStats } = await import('../src/opus-bay/game/lockWatchdog');
const { onEvent } = await import('../src/opus-bay/core/events');

test('playerLock: a hold locks until released (once, idempotent); the release re-derives the lock through flow\'s refresher; the report names the holders', () => {
  resetGame('district');
  assert.equal(lockHeld(), false);
  const a = holdLock('activity', 'slide');
  assert.equal(runtime.player.locked, true);
  assert.equal(lockHeld(), true);
  const b = holdLock('shop');
  const rep = lockReport();
  assert.deepEqual(rep.map(h => [h.source, h.key]), [['activity', 'slide'], ['shop', undefined]]);
  assert.ok(rep.every(h => Number.isFinite(h.since)));
  assert.ok(!('key' in rep[1]), 'no key field when none was given');
  a();
  assert.equal(runtime.player.locked, true, 'the shop still holds');
  a();
  assert.equal(lockReport().length, 1, 'a second release does nothing');
  b();
  assert.equal(lockHeld(), false);
  assert.equal(runtime.player.locked, false, 'free once the last hold is gone');
  // a release while a dialogue is open leaves the dialogue's lock alone (the refresher decides)
  const c = holdLock('activity');
  flowMod.playDialogue(START_NODE);
  c();
  assert.equal(runtime.player.locked, true, 'the dialogue keeps the player');
  flowMod.closeDialogue();
  assert.equal(runtime.player.locked, false);
  // flow's refreshLock honours a hold
  const d = holdLock('travel', 'x');
  flowMod.refreshLock();
  assert.equal(runtime.player.locked, true);
  d();
  assert.equal(runtime.player.locked, false);
});

test('watchdog: a lock nothing explains is freed after 1 s (a stuck event, what: watchdog), never before; an explained lock is never touched; R frees a stale lock at once', () => {
  resetGame('district');
  const stuck: { what: string; source?: string }[] = [];
  const off = onEvent(e => { if (e.type === 'stuck') stuck.push(e); });
  try {
    stepLockWatchdog(0.1);
    const before = watchdogStats.releases;
    // a stale lock (a writer that never released: the day-0 bug's shape)
    runtime.player.locked = true;
    assert.equal(lockExplanation(), null);
    for (let t = 0; t < WATCHDOG_S - 0.05; t += 0.1) assert.equal(stepLockWatchdog(0.1), false, 'not before 1 s');
    assert.equal(runtime.player.locked, true);
    let freed = false;
    for (let i = 0; i < 3 && !freed; i++) freed = stepLockWatchdog(0.1);
    assert.ok(freed, 'freed after 1 s');
    assert.equal(runtime.player.locked, false);
    assert.equal(watchdogStats.releases, before + 1);
    assert.deepEqual(stuck.map(e => [e.what, e.source]), [['watchdog', 'unknown']]);
    // explained: a dialogue, a panel, a cinema, a trip, an activity hold — never freed
    flowMod.playDialogue(START_NODE);
    for (let i = 0; i < 40; i++) assert.equal(stepLockWatchdog(0.1), false);
    assert.equal(runtime.player.locked, true);
    flowMod.closeDialogue();
    const act = holdLock('activity', 'stairs');
    for (let i = 0; i < 40; i++) assert.equal(stepLockWatchdog(0.1), false);
    assert.equal(runtime.player.locked, true, 'an activity holds as long as it wants');
    act();
    const shot = { position: [0, 10, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], duration: 5 };
    playShots('viewpoint', [shot]);
    for (let i = 0; i < 20; i++) { stepCinema(0.1); assert.equal(stepLockWatchdog(0.1), false); }
    skipCinema();
    assert.equal(runtime.player.locked, false);
    // a hold left behind by a trip that is not running: the watchdog frees the feet and names it
    const stale = holdLock('travel', 'lost-trip');
    for (let i = 0; i < 12; i++) stepLockWatchdog(0.1);
    assert.equal(runtime.player.locked, false);
    assert.equal(stuck.at(-1)?.source, 'travel:lost-trip');
    stale();
    // R (unstuck) frees a stale lock at once; with a dialogue open it does nothing
    runtime.player.locked = true;
    input.resetCount++;
    assert.equal(stepLockWatchdog(0.016), true, 'R frees it now');
    assert.equal(runtime.player.locked, false);
    flowMod.playDialogue(START_NODE);
    input.resetCount++;
    assert.equal(stepLockWatchdog(0.016), false);
    assert.equal(runtime.player.locked, true);
    flowMod.closeDialogue();
  } finally { off(); }
});

test('day-0 writers: the cinema and 飞过去 hold the lock through game/playerLock (no direct runtime.player.locked writes left in them)', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const src = (f: string) => readFileSync(path.resolve(import.meta.dirname, '../src/opus-bay', f), 'utf8');
  for (const f of ['game/cinema.ts', 'game/fastTravel.ts']) {
    assert.doesNotMatch(src(f), /runtime\.player\.locked\s*=[^=]/, `${f} writes the lock directly`);
    assert.match(src(f), /holdLock\('(cinema|travel)'/, `${f} holds through playerLock`);
  }
  assert.match(src('game/flow.ts'), /setLockRefresher\(refreshLock\)/, 'flow registers its refresher');
  assert.match(src('game/Systems.tsx'), /stepLockWatchdog\(dt\)/, 'the watchdog runs every frame');
});

// ---------------------------------------------------------------------------------------------------------------
// 4. W5-F1 · the other paths of plan MF1 (the lock derived every frame; each path ends walking within 1 s, the
//    watchdog untouched)
// ---------------------------------------------------------------------------------------------------------------

const tripRun = await import('../src/opus-bay/game/tripRun');
const { walkLeg } = await import('../src/opus-bay/game/trips');
const { updateGuide } = await import('../src/opus-bay/game/brain');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const transitData = await import('../src/opus-bay/data/transit');
const { beginLineRide, currentRide } = await import('../src/opus-bay/game/ride');
const { interactables } = await import('../src/opus-bay/game/interactables');
tripRun.initTripRun();

/** the Ticker's per-frame extras for trips (game/tripRun's frame system) and the brain's 10 Hz guide step */
function tripFrames(r: Rig, seconds: number, until?: () => boolean) {
  let acc = 0;
  for (let t = 0; t < seconds; t += DT) {
    frame(r);
    stepFrameSystems(DT, performance.now());
    if ((acc += DT) >= 0.1) { acc = 0; updateGuide(performance.now()); }
    if (until?.()) return true;
  }
  return false;
}

test('path · the Grand Tour stop (a tour leg into a first-visit tier-1: the Dragon Gate): the leg ends, the reveal plays, the player walks within 1 s', async () => {
  const fb = ATTRACTION_INDEX.get('chinatown-dragon-gate');
  assert.ok(fb);
  const arrive = fb.arrival ?? fb;
  await cityAround([arrive], 120);
  resetGame('city');
  const r = rig(true);
  try {
    // the leg's last 40 u (the tour walks here from the Ferry Building; the lock only cares how the stop ends)
    // (a start no other attraction's arrival ring holds: Union Square is 45 u south)
    const others = ATTRACTIONS.filter(o => o.id !== fb.id).map(o => o.arrival ?? o);
    const from = (() => {
      for (const rr of [40, 30, 50, 25]) {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2, q = { x: arrive.x + Math.sin(a) * rr, z: arrive.z + Math.cos(a) * rr };
          if (canStand(q.x, q.z, 0.45) && others.every(o => Math.hypot(o.x - q.x, o.z - q.z) > 30)) return q;
        }
      }
      return null;
    })();
    assert.ok(from, 'a start 25–50 u out');
    place(r, from);
    const leg = walkLeg({ x: from.x, z: from.z }, { x: arrive.x, z: arrive.z, name: fb.name });
    flowMod.startTrip({ mode: 'walk', legs: [leg], seconds: leg.seconds } as never, { placeId: fb.placeId ?? fb.id, attraction: fb.id, name: fb.name, x: arrive.x, z: arrive.z }, 'tour');
    assert.ok(flow.get().trip, 'the tour leg runs');
    assert.equal(runtime.player.locked, false, 'a walking leg never holds the feet');
    const watcher = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS));
    const hit = arriveAt(r, watcher, arrive, 40);
    assert.ok(hit && hit.anchor.attraction === fb.id, `the stop arrival fires (${hit?.anchor.attraction}; at ${runtime.player.x.toFixed(1)}, ${runtime.player.z.toFixed(1)} → ${arrive.x}, ${arrive.z}; from ${from.x.toFixed(1)}, ${from.z.toFixed(1)})`);
    assert.ok(hit.first && arrivalBeats(hit).reveal, 'first tier-1 arrival on foot: the reveal');
    const p = runtime.player;
    assert.ok(playReveal(fb.id, { x: p.x + 6, y: p.y + 5, z: p.z + 6 }));
    tripFrames(r, 6, () => !cinemaActive());
    assert.equal(cinemaActive(), false);
    walksWithin1s(r, 'after the tour stop reveal');
  } finally { if (flow.get().trip) flowMod.endTrip(); disposeRig(r); setCityTerrain(null); game.set({ phase: 'title', worldMode: 'district', move: { mode: 'foot' } }); }
});

test('path · a walk trip ends (flow.trip → end): the player walks within 1 s; a walk trip never locks', async () => {
  await cityAround([FERRY], 120);
  resetGame('city');
  const r = rig(true);
  try {
    place(r, FERRY);
    const d = openDirection(FERRY), to = { x: FERRY.x + d.x * 20, z: FERRY.z + d.z * 20 };
    const leg = walkLeg({ x: FERRY.x, z: FERRY.z }, { ...to, name: { zh: '前面', en: 'Ahead' } });
    flowMod.startTrip({ mode: 'walk', legs: [leg], seconds: leg.seconds } as never, { placeId: 'test-walk', x: to.x, z: to.z }, 'map');
    const ends: string[] = [];
    const off = onEvent(e => { if (e.type === 'trip') ends.push(e.what); });
    runtime.player.pathTarget = { ...to };
    runtime.guide.x = to.x + 1; runtime.guide.z = to.z;
    const ended = tripFrames(r, 20, () => ends.includes('end'));
    off();
    assert.ok(ended, `the trip ends (${ends.join(',')})`);
    assert.equal(runtime.player.locked, false);
    runtime.player.pathTarget = null;
    walksWithin1s(r, 'after a walk trip');
  } finally { if (flow.get().trip) flowMod.endTrip(); disposeRig(r); setCityTerrain(null); game.set({ phase: 'title', worldMode: 'district', move: { mode: 'foot' } }); }
});

/**
 * A line the ride code can board in node: the protocol of data/transit.ts LineRideSystem with one car standing beside
 * the player (docked at the pickup, then riding, then at a station). The real cars are lane T's world systems.
 */
function fakeLine(line: string, near: Vec2) {
  const pose = { x: near.x, y: heightAt(near.x, near.z), z: near.z, heading: 0, roll: 0 };
  let phase: 'here' | 'riding' | 'arrived' = 'here';
  const status = () => ({ line, car: 0, phase, eta: 0, station: phase === 'riding' ? null : 'b', arrivals: phase === 'arrived' ? 1 : 0, lastStation: 'a', odometer: phase === 'here' ? 0 : 40, turning: false, braking: false });
  return {
    sys: {
      request: () => status(), board: () => { phase = 'riding'; }, cancel: () => { phase = 'arrived'; }, rideStatus: () => status(), cars: [{ pose }],
      // (the cable-car system's turntables and the F-line's station list: nothing turning, no stations of its own)
      turningAt: () => null, push: () => false, line: { stations: [] }, legsFor: () => null,
    },
    dock: () => { phase = 'arrived'; },
  };
}

// the published lines (the F-line's stations, the loop and the Metro), as the city loads them (tests/opus-bay-sf-hopoff)
const { readFileSync } = await import('node:fs');
const nodePath = await import('node:path');
const TRANSIT_FILE = JSON.parse(readFileSync(nodePath.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
function loadTransit(on: boolean) {
  transitData.setFlineJson(on ? TRANSIT_FILE.lines.find(l => l.id === 'f-line') ?? null : null);
  transitData.setTransitW4(on ? transitData.buildTransitW4(TRANSIT_FILE) : null);
  transitData.setTransitData(on ? transitData.buildTransit(TRANSIT_FILE) : null);
}

for (const [kind, line] of [['bus', transitData.W4_BUS_LINE], ['light-rail', transitData.W4_RAIL_LINES[0]], ['cable-car', 'powell-hyde'], ['streetcar', 'streetcar'], ['ferry', 'ferry']] as const) {
  test(`path · the ${kind} hop-off (the 提前下车 brake → the step down): the ride ends, the player walks within 1 s`, () => {
    resetGame('district');
    const r = rig(true);
    const at = DISTRICT.anchors['ferry-gate'];
    const fake = fakeLine(line, { x: at.x + 2, z: at.z });
    const install = (v: unknown) => {
      if (kind === 'bus' || kind === 'light-rail') transitData.setActiveLineFleet(v ? ({ bus: v, rail: v } as never) : null);
      else if (kind === 'cable-car') transitData.setActiveCableSystem(v as never);
      else if (kind === 'streetcar') transitData.setActiveStreetcarSystem(v as never);
      else transitData.setActiveFerrySystem(v as never);
    };
    install(fake.sys);
    loadTransit(true);
    try {
      place(r, at);
      const ride = beginLineRide(line, 'a', 'b', 1, 0, kind);
      assert.ok(ride, 'the ride begins');
      ride.mode = 'follow'; ride.boarded = true;
      game.set({ riding: 'streetcar', move: { mode: 'transit', line, spot: kind === 'ferry' ? 'deck' : 'rail' } });
      flowMod.refreshLock();
      run(r, 1);
      assert.equal(runtime.player.locked, true, 'riding holds the feet');
      // the ferry lets you off only at a quay (lane F's rule): it docks first
      if (kind === 'ferry') fake.dock();
      input.hopOffCount++;
      const off = run(r, 3, () => currentRide() === null && game.get().move.mode === 'foot' && r.ms!.mode === 'foot');
      assert.ok(off, `off the ${kind} (ride ${!!currentRide()}, store ${game.get().move.mode}, feet ${r.ms!.mode})`);
      run(r, 0.5);
      walksWithin1s(r, `after the ${kind} hop-off`);
    } finally {
      if (currentRide()) hopOffRide();
      install(null);
      loadTransit(false);
      disposeRig(r);
      game.set({ phase: 'title', riding: null, move: { mode: 'foot' } });
    }
  });
}

test('path · the ArrivalCard close (a peek card after an arrival, no reveal): the player walks within 1 s', () => {
  resetGame('district');
  const r = rig(false);
  try {
    place(r, FERRY);
    flow.set({ arrival: { attraction: 'ferry-building-marketplace', place: 'ferry-building', toast: { zh: '到啦', en: 'Here' }, line: null, voice: null, mood: 'happy', reveal: false, peek: true, stamp: true, stampSound: true } as never });
    run(r, 2);
    flowMod.dismissArrival();
    assert.equal(flow.get().arrival, null);
    walksWithin1s(r, 'after the arrival card');
  } finally { disposeRig(r); }
});

test('path · the viewpoint panorama (the name tags over the view): the player walks within 1 s; the panorama never holds the feet', async () => {
  // (game/guideCity pulls the guide layer's stylesheet in: a module hook stands in for it, as tests/opus-bay-sf-guide-city)
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { startPanorama, panoramaActive } = await import('../src/opus-bay/game/guideCity');
  styles.deregister();
  resetGame('district');
  const r = rig(false);
  try {
    const coit = DISTRICT.anchors['coit-view'] ?? FERRY;
    place(r, coit);
    startPanorama({ x: coit.x, z: coit.z }, 0);
    run(r, 1);
    assert.equal(runtime.player.locked, false);
    walksWithin1s(r, `after the panorama (active ${panoramaActive()})`);
  } finally { disposeRig(r); }
});

test('path · the telescope (district): the camera looks, the reaction closes, the player walks within 1 s', () => {
  resetGame('district');
  const r = rig(false);
  try {
    mock.timers.enable({ apis: ['setTimeout'] });
    const scope = POIS.find(poi => poi.interaction.kind === 'telescope');
    assert.ok(scope);
    place(r, scope.position);
    flowMod.performInteraction(scope.id);
    assert.ok(cinemaActive() || game.get().dialogue.nodeId, 'the telescope looks (or talks)');
    for (let i = 0; i < 400 && cinemaActive(); i++) frame(r, 0.05);
    for (let i = 0; i < 20 && game.get().dialogue.nodeId; i++) flowMod.closeDialogue();
    mock.timers.tick(3000);
    walksWithin1s(r, 'after the telescope');
  } finally { mock.timers.reset(); disposeRig(r); }
});

test('path · a resident chat (a district resident): talking holds the feet, the close frees them within 1 s', () => {
  resetGame('district');
  const r = rig(false);
  try {
    mock.timers.enable({ apis: ['setTimeout'] });
    const npc = interactables().find(it => it.source === 'npc');
    assert.ok(npc, 'a resident to talk to');
    place(r, { x: npc.x + 1, z: npc.z + 1 });
    flowMod.performInteraction(npc.id);
    assert.ok(game.get().dialogue.nodeId, 'the chat opens');
    frame(r);
    assert.equal(runtime.player.locked, true);
    for (let i = 0; i < 20 && game.get().dialogue.nodeId; i++) flowMod.closeDialogue();
    mock.timers.tick(3000);
    walksWithin1s(r, 'after a resident chat');
  } finally { mock.timers.reset(); disposeRig(r); }
});

test('path · photo mode (enter, frame a shot, exit): the player walks within 1 s of the exit', () => {
  resetGame('district');
  const r = rig(false);
  try {
    place(r, FERRY);
    flowMod.enterPhotoMode();
    assert.equal(game.get().photoMode, true);
    run(r, 1);
    flowMod.exitPhotoMode();
    walksWithin1s(r, 'after photo mode');
  } finally { if (game.get().photoMode) flowMod.exitPhotoMode(); disposeRig(r); }
});

test('path · the map (open, look, close): the player walks within 1 s of the close', () => {
  resetGame('district');
  const r = rig(false);
  try {
    place(r, FERRY);
    flowMod.openPanel('map');
    assert.equal(game.get().panel.kind, 'map');
    run(r, 1);
    flowMod.closePanel();
    walksWithin1s(r, 'after the map');
  } finally { disposeRig(r); }
});

test('path · the shop try-on (lane E holds shop while BAYBAY turns round): held, then the close frees the feet within 1 s', () => {
  resetGame('district');
  const r = rig(false);
  try {
    place(r, FERRY);
    const release = holdLock('shop', 'try-on');
    runtime.input.moveY = 1;
    run(r, 3);
    runtime.input.moveY = 0;
    assert.equal(runtime.player.locked, true, 'held for the try-on (the watchdog leaves a shop hold alone)');
    assert.ok(Math.hypot(runtime.player.x - FERRY.x, runtime.player.z - FERRY.z) < 0.2, 'no walking during the try-on');
    release();
    walksWithin1s(r, 'after the shop try-on');
  } finally { disposeRig(r); }
});

test('path · a PlayKit activity (lane A holds activity): cancel or finish, the player walks within 1 s', () => {
  resetGame('district');
  const r = rig(false);
  try {
    place(r, FERRY);
    for (const end of ['finish', 'cancel']) {
      const release = holdLock('activity', `slides:${end}`);
      run(r, 2);
      assert.equal(runtime.player.locked, true);
      release();
      walksWithin1s(r, `after an activity ${end}`);
    }
  } finally { disposeRig(r); }
});

test('path · an egg camera beat (lane D: playShots, then a fact card): the player walks within 1 s of the beat', () => {
  resetGame('district');
  const r = rig(false);
  try {
    place(r, FERRY);
    const shot = { position: [FERRY.x + 8, 12, FERRY.z + 8] as [number, number, number], target: [FERRY.x, 1, FERRY.z] as [number, number, number], duration: 1.2, hold: 1 };
    let carded = false;
    playShots('viewpoint', [shot, shot], () => { carded = true; });
    run(r, 1);
    assert.equal(runtime.player.locked, true, 'held while the beat plays');
    assert.ok(run(r, 6, () => !cinemaActive()));
    assert.ok(carded, 'the beat ended (its card shows)');
    walksWithin1s(r, 'after an egg camera beat');
  } finally { disposeRig(r); }
});

test('W5-F1 · no module writes runtime.player.locked but game/playerLock (the derived lock has one writer)', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(import.meta.dirname, '../src/opus-bay');
  const files: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const f = path.join(d, n); if (statSync(f).isDirectory()) walk(f); else if (/\.(ts|tsx)$/.test(n)) files.push(f); } };
  walk(root);
  const writer = /\b(?:runtime\.player|player|pl|p)\.locked\s*=(?!=)/;
  const bad = files.filter(f => !f.endsWith(`game${path.sep}playerLock.ts`) && writer.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad.map(f => path.relative(root, f)), []);
  assert.ok(files.length > 300, `${files.length} files scanned`);
  // the frame derives it (Systems.tsx), flow's refresher is the same derive, the watchdog drops holds instead of writing
  const src = (f: string) => readFileSync(path.join(root, f), 'utf8');
  assert.match(src('game/Systems.tsx'), /deriveLock\(\);\s*\n[^\n]*\n\s*stepLockWatchdog\(dt\)/, 'Systems derives the lock every frame before the watchdog');
  assert.match(src('game/flow.ts'), /export function refreshLock\(\) \{\s*deriveLock\(\);\s*\}/);
  assert.match(src('game/lockWatchdog.ts'), /dropHolds\(/);
});

test('W5-F1 · the derive: a dialogue, fishing, a ride, the phase or a hold lock; nothing else does (a panel); a stale write is corrected on the next derive', () => {
  resetGame('district');
  const cases: [string, () => void, () => void][] = [
    ['dialogue', () => flowMod.playDialogue(START_NODE), () => { for (let i = 0; i < 20 && game.get().dialogue.nodeId; i++) flowMod.closeDialogue(); }],
    ['fishing', () => flow.set({ fishing: { stage: 'waiting' } as never }), () => flow.set({ fishing: null })],
    ['ride', () => game.set({ riding: 'streetcar' }), () => game.set({ riding: null })],
    ['phase', () => game.set({ phase: 'title' }), () => game.set({ phase: 'playing' })],
    ['hold', () => { heldForTest = holdLock('activity', 'derive-test'); }, () => { heldForTest?.(); }],
  ];
  for (const [what, on, off] of cases) {
    on();
    assert.equal(deriveLock(), true, `${what} locks`);
    off();
    assert.equal(deriveLock(), false, `${what} ends: free`);
  }
  flowMod.openPanel('map');
  assert.equal(deriveLock(), false, 'a panel does not lock');
  flowMod.closePanel();
  runtime.player.locked = true;
  assert.equal(deriveLock(), false);
});
let heldForTest: (() => void) | null = null;
