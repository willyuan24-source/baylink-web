import assert from 'node:assert/strict';
import test from 'node:test';
import { onEvent, type GameEvent } from '../src/opus-bay/core/events';
import { input, onKeyDown, onKeyUp, pollInput, clearKeys } from '../src/opus-bay/core/input';
import { runtime } from '../src/opus-bay/core/runtime';
import { canStand, heightAt, nearestWalkable, surfaceAt } from '../src/opus-bay/core/terrain';
import { DISTRICT } from '../src/opus-bay/data/district';
import { PlayerController, RUN_SPEED, WALK_SPEED, moveDisc, PLAYER_RADIUS } from '../src/opus-bay/actors/controller';
import { GuideMover } from '../src/opus-bay/actors/guide';
import { PITCH_DEFAULT, basePitch, heroClear, heroPoints, zoneViews } from '../src/opus-bay/actors/camera';
import { findPath, lineOfSight, navGrid, navOpen, pathLength } from '../src/opus-bay/actors/nav';

const A = (name: string) => { const p = DISTRICT.anchors[name]; assert.ok(p, name); return p; };
const DT = 1 / 60;

function resetPlayer(at: { x: number; z: number }, heading = 0) {
  const p = runtime.player;
  p.x = at.x; p.z = at.z; p.y = heightAt(at.x, at.z); p.heading = heading;
  p.pathTarget = null; p.pendingInteract = null; p.locked = false;
  runtime.input.moveX = 0; runtime.input.moveY = 0; runtime.input.run = false; runtime.input.jump = false;
}

function collect() {
  const events: GameEvent[] = [];
  const off = onEvent(e => events.push(e));
  return { events, off };
}

/** Run the controller for `seconds` with a fixed input (camera behind the start heading). */
function run(c: PlayerController, seconds: number, opts: { x?: number; y?: number; run?: boolean; yaw?: number; each?: (t: number) => void } = {}) {
  const yaw = opts.yaw ?? runtime.player.heading + Math.PI;
  let t = 0;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    runtime.input.moveX = opts.x ?? 0;
    runtime.input.moveY = opts.y ?? 0;
    runtime.input.run = !!opts.run;
    c.step({ dt: DT, now: t, cameraYaw: yaw, frozen: false, riding: false });
    opts.each?.(t);
    t += DT;
  }
  runtime.input.moveX = 0; runtime.input.moveY = 0; runtime.input.run = false;
}

// ---------------------------------------------------------------------------
// nav
// ---------------------------------------------------------------------------

test('A* reaches the hill, Pier 39 and the Pier 7 end with clean string-pulled legs', () => {
  const from = A('ferry-gate');
  navGrid(); // build the grids outside the timed section
  for (const goal of ['coit-view', 'pier39-entrance', 'pier7-end', 'sea-lion-viewpoint', 'levis-plaza']) {
    const t0 = performance.now();
    const res = findPath(from, A(goal));
    const ms = performance.now() - t0;
    assert.ok(res, `path to ${goal}`);
    const pts = res.points;
    assert.ok(pts.length >= 1 && pts.length < 60, `${goal}: ${pts.length} legs`);
    let prev = from;
    for (const p of pts) {
      assert.ok(navOpen(p.x, p.z), `${goal} waypoint open`);
      assert.ok(lineOfSight(prev, p) || prev === from, `${goal} leg has line of sight`);
      prev = p;
    }
    const last = pts[pts.length - 1];
    assert.ok(Math.hypot(last.x - A(goal).x, last.z - A(goal).z) < 1, `${goal} ends at the goal`);
    const L = pathLength(from, pts), straight = Math.hypot(A(goal).x - from.x, A(goal).z - from.z);
    assert.ok(L < straight * 2.2 + 20, `${goal} path not absurd (${L.toFixed(0)} vs ${straight.toFixed(0)})`);
    assert.ok(ms < 400, `${goal} planned in ${ms.toFixed(1)} ms`); // typically < 10 ms; generous for loaded CI
  }
});

test('A goal inside a building snaps to the nearest reachable spot', () => {
  const fb = DISTRICT.landmarks.find(l => l.kind === 'ferry-building')!;
  const res = findPath(A('ferry-clock'), fb.position, 30);
  assert.ok(res, 'snapped path exists');
  assert.equal(res.snapped, true);
  const last = res.points[res.points.length - 1];
  assert.ok(canStand(last.x, last.z, 0.4));
});

// ---------------------------------------------------------------------------
// controller
// ---------------------------------------------------------------------------

test('walking forward along the promenade: ~4.2 u/s, grounded, footsteps on contacts, never off the walkable area', () => {
  const c = new PlayerController();
  const start = A('ferry-clock');
  // face along the promenade toward Pier 39
  resetPlayer(start, Math.atan2(A('embarcadero-mid').x - start.x, A('embarcadero-mid').z - start.z));
  c.sync();
  const { events, off } = collect();
  let maxSpeed = 0;
  run(c, 3, { y: 1, each: () => { maxSpeed = Math.max(maxSpeed, runtime.player.speed); assert.ok(canStand(runtime.player.x, runtime.player.z, PLAYER_RADIUS * 0.9), 'standable'); } });
  off();
  const d = Math.hypot(runtime.player.x - start.x, runtime.player.z - start.z);
  assert.ok(d > 10 && d < 13, `walked ${d.toFixed(2)} u in 3 s`);
  assert.ok(Math.abs(maxSpeed - WALK_SPEED) < 0.05, `top speed ${maxSpeed}`);
  const steps = events.filter(e => e.type === 'footstep');
  assert.ok(steps.length >= 11 && steps.length <= 16, `${steps.length} footsteps`);
  assert.ok(steps.every(e => e.type === 'footstep' && !e.run && !!e.surface));
});

test('running is faster and flags run footsteps', () => {
  const c = new PlayerController();
  const start = A('ferry-clock');
  resetPlayer(start, Math.atan2(A('embarcadero-mid').x - start.x, A('embarcadero-mid').z - start.z));
  c.sync();
  const { events, off } = collect();
  run(c, 2, { y: 1, run: true });
  off();
  assert.ok(Math.abs(runtime.player.speed - RUN_SPEED) < 0.05, `run speed ${runtime.player.speed}`);
  assert.ok(runtime.player.running);
  assert.ok(events.some(e => e.type === 'footstep' && e.run));
});

test('jump: anticipation, jump event, snappy arc (apex 1.3–1.5 u, air 0.5–0.6 s), land event with impact', () => {
  const c = new PlayerController();
  resetPlayer(A('ferry-clock'), 0);
  c.sync();
  const { events, off } = collect();
  runtime.input.jump = true;
  let maxY = 0, air = 0;
  run(c, 1.2, { each: () => { maxY = Math.max(maxY, runtime.player.y - heightAt(runtime.player.x, runtime.player.z)); if (!c.grounded) air += DT; } });
  off();
  assert.equal(runtime.input.jump, false, 'jump edge consumed');
  assert.ok(events.some(e => e.type === 'jump'));
  const land = events.find(e => e.type === 'land');
  assert.ok(land && land.type === 'land' && land.impact > 0.2 && land.impact <= 1);
  assert.ok(maxY > 1.3 && maxY < 1.5, `apex ${maxY.toFixed(2)}`);
  assert.ok(air >= 0.5 && air <= 0.62, `air time ${air.toFixed(3)}`);
  assert.ok(c.grounded);
});

test('jump: a press just before landing is buffered; releasing early makes a short hop', () => {
  const c = new PlayerController();
  resetPlayer(A('ferry-clock'), 0);
  c.sync();
  const { events, off } = collect();
  runtime.input.jump = true;
  input.jumpHeld = true;
  let t = 0, pressed = false, maxY = 0;
  // hold through the first jump; press again 0.08 s before touching down
  for (let i = 0; i < 120; i++) {
    const h = runtime.player.y - heightAt(runtime.player.x, runtime.player.z);
    if (!pressed && !c.grounded && c.vy < 0 && h < 0.25) { runtime.input.jump = true; pressed = true; input.jumpHeld = false; }
    c.step({ dt: DT, now: t, cameraYaw: 0, frozen: false, riding: false });
    t += DT;
    if (pressed) maxY = Math.max(maxY, runtime.player.y - heightAt(runtime.player.x, runtime.player.z));
  }
  off();
  const jumps = events.filter(e => e.type === 'jump').length;
  assert.equal(jumps, 2, 'buffered press jumped again on landing');
  assert.ok(maxY > 1.2, 'second jump (released key before takeoff → no cut, UI-style press)');
  // short hop: key released right after takeoff
  resetPlayer(A('ferry-clock'), 0);
  c.sync();
  runtime.input.jump = true; input.jumpHeld = true;
  let apex = 0;
  for (let i = 0; i < 70; i++) {
    if (i === 8) input.jumpHeld = false;
    c.step({ dt: DT, now: t, cameraYaw: 0, frozen: false, riding: false });
    t += DT;
    apex = Math.max(apex, runtime.player.y - heightAt(runtime.player.x, runtime.player.z));
  }
  assert.ok(apex < 1.0, `short hop apex ${apex.toFixed(2)}`);
  input.jumpHeld = false;
});

test('walls: running into the Bay from the back plaza slides along the seawall and stays standable', () => {
  const c = new PlayerController();
  const start = A('ferry-back-plaza');
  resetPlayer(start, 0);
  c.sync();
  // run toward the bay (away from the promenade) and diagonally, for a while
  for (const [x, y] of [[0, 1], [0.7, 0.7], [-0.7, 0.7], [1, 0], [-1, 0]]) {
    run(c, 2.5, { x, y, run: true, yaw: 0 });
    assert.ok(canStand(runtime.player.x, runtime.player.z, PLAYER_RADIUS * 0.9), `standable after ${x},${y}`);
    assert.ok(surfaceAt(runtime.player.x, runtime.player.z));
  }
});

test('moveDisc slides along a round blocker instead of stopping dead', () => {
  const lamp = DISTRICT.props.find(p => p.blockRadius && !p.pushable && canStand(p.x + p.blockRadius + 0.6, p.z, 0.4) && canStand(p.x + p.blockRadius + 0.6, p.z + 1, 0.4) && canStand(p.x + p.blockRadius + 0.6, p.z - 1, 0.4));
  assert.ok(lamp, 'a free-standing blocker');
  let x = lamp.x + lamp.blockRadius! + 0.45, z = lamp.z - 0.05;
  // push straight into it (−x) with a little +z bias: must slide, not tunnel
  for (let i = 0; i < 20; i++) {
    const r = moveDisc(x, z, -0.15, 0.02, 0.4, heightAt(x, z));
    x = r.x; z = r.z;
    assert.ok(Math.hypot(x - lamp.x, z - lamp.z) >= lamp.blockRadius! + 0.39, 'outside the blocker');
  }
  assert.ok(Math.abs(z - (lamp.z - 0.05)) > 0.1, 'slid around it');
});

test('click-to-walk: follows an A* path up the Filbert Steps to the Coit viewpoint (y ≈ 20)', () => {
  const c = new PlayerController();
  resetPlayer(A('filbert-steps-bottom'), 0);
  c.sync();
  const goal = A('coit-view');
  runtime.player.pathTarget = { x: goal.x, z: goal.z };
  let t = 0;
  while (runtime.player.pathTarget && t < 40) { run(c, 0.5, {}); t += 0.5; }
  assert.equal(runtime.player.pathTarget, null, `arrived (t=${t})`);
  assert.ok(Math.hypot(runtime.player.x - goal.x, runtime.player.z - goal.z) < 1, 'at the viewpoint');
  assert.ok(runtime.player.y > 19, `height ${runtime.player.y.toFixed(2)}`);
});

test('keyboard input cancels an auto-walk; teleports reset the controller', () => {
  const c = new PlayerController();
  resetPlayer(A('ferry-clock'), 0);
  c.sync();
  runtime.player.pathTarget = { ...A('pier7-end') };
  runtime.player.pendingInteract = 'pier7';
  run(c, 0.5, {});
  assert.ok(runtime.player.pathTarget, 'walking');
  run(c, 0.1, { y: 1 });
  assert.equal(runtime.player.pathTarget, null);
  assert.equal(runtime.player.pendingInteract, null);
  // external teleport (flow.teleportPlayer)
  run(c, 0.5, { y: 1 });
  const lev = A('levis-plaza');
  runtime.player.x = lev.x; runtime.player.z = lev.z;
  run(c, DT, {});
  assert.ok(Math.hypot(runtime.player.x - lev.x, runtime.player.z - lev.z) < 0.1, 'stays at the teleport target');
  assert.ok(c.teleported || runtime.player.speed < 0.5);
});

test('frozen (dialogue / cinematic) keeps the player still and drops jump presses', () => {
  const c = new PlayerController();
  resetPlayer(A('ferry-clock'), 0);
  c.sync();
  const { events, off } = collect();
  runtime.input.jump = true;
  for (let i = 0; i < 30; i++) { runtime.input.moveY = 1; c.step({ dt: DT, now: i * DT, cameraYaw: 0, frozen: true, riding: false }); }
  off();
  assert.ok(Math.hypot(runtime.player.x - A('ferry-clock').x, runtime.player.z - A('ferry-clock').z) < 0.01);
  assert.ok(!events.some(e => e.type === 'jump'));
});

test('unstuck: a player dropped inside a blocker is moved to the nearest walkable spot within ~1 s', () => {
  const c = new PlayerController();
  const shed = DISTRICT.piers.find(p => p.shed)!.shed!.footprint;
  const cx = shed.reduce((a, p) => a + p.x, 0) / shed.length, cz = shed.reduce((a, p) => a + p.z, 0) / shed.length;
  resetPlayer({ x: cx, z: cz }, 0);
  c.sync();
  run(c, 1.3, {});
  assert.ok(canStand(runtime.player.x, runtime.player.z, PLAYER_RADIUS * 0.9), 'rescued');
});

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------

test('input: WASD + arrows by event.code, diagonal normalised, Shift runs, Space is a one-shot jump, typing is ignored', () => {
  clearKeys();
  const key = (code: string, target: unknown = null) => onKeyDown({ code, repeat: false, target: target as EventTarget, metaKey: false, ctrlKey: false, altKey: false });
  key('KeyW'); key('KeyD');
  pollInput();
  assert.ok(Math.abs(Math.hypot(runtime.input.moveX, runtime.input.moveY) - 1) < 1e-6);
  assert.ok(runtime.input.moveX > 0 && runtime.input.moveY > 0);
  assert.equal(input.manualMove, true);
  key('ShiftLeft'); pollInput();
  assert.equal(runtime.input.run, true);
  onKeyUp({ code: 'KeyW' }); onKeyUp({ code: 'KeyD' }); onKeyUp({ code: 'ShiftLeft' });
  key('ArrowDown'); pollInput();
  assert.equal(runtime.input.moveY, -1);
  onKeyUp({ code: 'ArrowDown' });
  runtime.input.jump = false;
  key('Space');
  assert.equal(runtime.input.jump, true);
  runtime.input.jump = false;
  key('Space', { tagName: 'BUTTON', getAttribute: () => null });
  assert.equal(runtime.input.jump, false, 'Space on a focused button is the button’s');
  key('KeyW', { tagName: 'INPUT', getAttribute: () => null, isContentEditable: false });
  pollInput();
  assert.equal(runtime.input.moveY, 0, 'typing into a field does not walk');
  const before = input.resetCount;
  key('KeyR');
  assert.equal(input.resetCount, before + 1);
  clearKeys();
});

// ---------------------------------------------------------------------------
// guide
// ---------------------------------------------------------------------------

test('BAYBAY walks to a target via the nav grid, reports arrival, and keeps out of the player’s way', () => {
  const m = new GuideMover();
  resetPlayer(A('ferry-clock'), 0);
  m.place();
  const g = runtime.guide;
  g.state = 'lead';
  g.run = false;
  const dest = A('weekly-board');
  g.target = { x: dest.x, z: dest.z };
  let t = 0;
  for (; t < 30 && !(g.arrived && Math.hypot(g.x - dest.x, g.z - dest.z) < 0.8); t += DT) m.step(DT, t, { playing: true, riding: false });
  assert.ok(Math.hypot(g.x - dest.x, g.z - dest.z) < 0.8, `reached the board (t=${t.toFixed(1)})`);
  assert.ok(canStand(g.x, g.z, 0.3));
  // player walks right onto BAYBAY → BAYBAY steps aside
  runtime.player.x = g.x + 0.3; runtime.player.z = g.z;
  g.target = null; g.state = 'talk';
  for (let i = 0; i < 90; i++) m.step(DT, t + i * DT, { playing: true, riding: false });
  assert.ok(Math.hypot(g.x - runtime.player.x, g.z - runtime.player.z) > 1.0, 'made room');
});

test('BAYBAY left far behind hops back near the player', () => {
  const m = new GuideMover();
  m.place();
  resetPlayer(A('pier39-entrance'), 0);
  runtime.guide.state = 'follow';
  runtime.guide.target = null;
  m.step(DT, 0, { playing: true, riding: false });
  assert.ok(Math.hypot(runtime.guide.x - runtime.player.x, runtime.guide.z - runtime.player.z) < 12);
});

// ---------------------------------------------------------------------------
// polish round 1: camera framing, wall contact, BAYBAY pacing
// ---------------------------------------------------------------------------

test('camera: zoom-coupled pitch (7 → 0.14, 15 → 0.28, 22 → 0.50, 30 → 0.88), monotonic', () => {
  assert.ok(Math.abs(basePitch(7) - 0.14) < 1e-9 && Math.abs(basePitch(15) - 0.28) < 1e-9 && Math.abs(basePitch(22) - 0.5) < 1e-9 && Math.abs(basePitch(30) - 0.88) < 1e-9);
  assert.ok(Math.abs(PITCH_DEFAULT - 0.28) < 1e-9);
  let prev = -1;
  for (let d = 5; d <= 32; d += 0.5) { const p = basePitch(d); assert.ok(p >= prev); prev = p; }
});

test('camera: every preferred zone view (A2) sees the player without a hero landmark in between', () => {
  const views = zoneViews();
  for (const name of ['coit-view', 'coit-summit', 'ferry-clock', 'sea-lion-viewpoint', 'pier14-end', 'pier7-end', 'exploratorium-front']) {
    assert.ok(views.some(v => v.anchor === name), `zone view for ${name}`);
  }
  assert.equal(heroPoints().length, 3, 'Coit, the Ferry clock tower, Transamerica');
  for (const v of views) {
    for (const d of [v.dist ?? 15, 7, 30]) assert.ok(heroClear(v.x, v.z, v.yaw, d), `${v.anchor} at ${d} u clears the heroes`);
  }
  // and the rule itself bites: a camera straight behind Coit Tower from the viewpoint is rejected
  const coit = heroPoints().find(h => h.id === 'coit-tower')!, cv = A('coit-view');
  const behind = Math.atan2(coit.x - cv.x, coit.z - cv.z);
  assert.equal(heroClear(cv.x, cv.z, behind, 18), false);
});

test('walls: pushing straight into the water edge stops cleanly (no sideways crawl, no twitching heading)', () => {
  const c = new PlayerController();
  resetPlayer(A('ferry-back-plaza'), Math.PI);
  c.sync();
  const headings: number[] = [];
  const speeds: number[] = [];
  let t = 0;
  // walk north (camera yaw 0 → forward = −z) into the seawall, then keep pushing for 2 s
  run(c, 6, { y: 1, yaw: 0, each: () => { t += DT; if (t > 4) { headings.push(runtime.player.heading); speeds.push(runtime.player.speed); } } });
  const mean = Math.atan2(headings.reduce((a, h) => a + Math.sin(h), 0), headings.reduce((a, h) => a + Math.cos(h), 0));
  const variance = headings.reduce((a, h) => a + Math.atan2(Math.sin(h - mean), Math.cos(h - mean)) ** 2, 0) / headings.length;
  assert.ok(variance < 0.05, `heading variance ${variance.toFixed(4)}`);
  for (const v of speeds) assert.ok(v < 0.05 || v >= 0.35 * WALK_SPEED, `speed ${v.toFixed(2)} is a clean stop or a real slide`);
  assert.ok(canStand(runtime.player.x, runtime.player.z, PLAYER_RADIUS * 0.9));
});

test('BAYBAY keeps up with a walking / running player (follow) and never sprints away while leading', () => {
  const m = new GuideMover();
  const start = A('ferry-clock'), end = A('pier39-entrance');
  const path = findPath(start, end)!.points;
  resetPlayer(start, 0);
  m.place();
  const g = runtime.guide;
  g.x = start.x + 2; g.z = start.z; g.y = heightAt(g.x, g.z);
  let maxGap = 0, t = 0;
  // the player walks (then runs) the promenade path; the brain's follow target = 3.5 u behind the player
  let i = 0;
  const p = runtime.player;
  const walkTo = (speed: number, seconds: number) => {
    for (let k = 0; k < Math.round(seconds / DT) && i < path.length; k++) {
      const wp = path[i], dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { i++; continue; }
      p.x += (dx / d) * speed * DT; p.z += (dz / d) * speed * DT; p.y = heightAt(p.x, p.z);
      p.heading = Math.atan2(dx, dz); p.speed = speed; p.moving = true; p.running = speed > 5;
      runtime.camera.yaw = p.heading + Math.PI;
      g.state = 'follow'; g.run = false;
      g.target = { x: p.x - Math.sin(p.heading) * 3.5, z: p.z - Math.cos(p.heading) * 3.5 };
      m.step(DT, t, { playing: true, riding: false, visible: true });
      t += DT;
      if (t > 1.5) maxGap = Math.max(maxGap, Math.hypot(g.x - p.x, g.z - p.z));
    }
  };
  walkTo(WALK_SPEED, 20);
  walkTo(RUN_SPEED, 15);
  assert.ok(maxGap < 12, `gap stayed under 12 u (max ${maxGap.toFixed(1)})`);

  // lead: BAYBAY heads for Pier 7 with the player walking behind her; her speed never exceeds player speed + 2
  resetPlayer(start, 0);
  const m2 = new GuideMover();
  m2.place();
  g.x = start.x + 1; g.z = start.z - 1; g.y = heightAt(g.x, g.z);
  m2.step(DT, 0, { playing: true, riding: false, visible: true });
  const dest = A('pier7-end');
  g.state = 'lead'; g.run = false; g.target = { x: dest.x, z: dest.z };
  let maxOver = -Infinity, gx0 = g.x, gz0 = g.z;
  for (let k = 0; k < 600; k++) {
    // the player follows BAYBAY at walking pace
    const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz);
    const walking = d > 1.5;
    if (walking) { p.x += (dx / d) * WALK_SPEED * DT; p.z += (dz / d) * WALK_SPEED * DT; }
    p.moving = walking; p.speed = walking ? WALK_SPEED : 0; p.running = false;
    m2.step(DT, 2 + k * DT, { playing: true, riding: false, visible: true });
    // telemetry every 0.25 s (collision push-outs make single frames noisy)
    if (k % 15 === 14) {
      if (k > 30) maxOver = Math.max(maxOver, Math.hypot(g.x - gx0, g.z - gz0) / (15 * DT) - WALK_SPEED);
      gx0 = g.x; gz0 = g.z;
    }
  }
  assert.ok(maxOver <= 2.05, `lead speed over the player's ${maxOver.toFixed(2)} u/s`);
});

test('BAYBAY off-screen and far behind hops back in beside the player (no visible teleport)', () => {
  const m = new GuideMover();
  m.place();
  resetPlayer(A('pier7-end'), 0);
  runtime.camera.yaw = Math.PI;
  const g = runtime.guide;
  // ~30 u back along the walk toward the Ferry Building
  const route = findPath(A('pier7-end'), A('ferry-clock'))!.points;
  let far = route[0], acc = 0, prevPt = A('pier7-end');
  for (const pt of route) { acc += Math.hypot(pt.x - prevPt.x, pt.z - prevPt.z); prevPt = pt; far = pt; if (acc > 30) break; }
  far = nearestWalkable(far, 6) ?? far;
  g.x = far.x; g.z = far.z; g.y = heightAt(far.x, far.z);
  g.state = 'follow'; g.target = null;
  m.step(DT, 0, { playing: true, riding: false, visible: true });
  // visible: no hop, she walks
  for (let k = 0; k < 20; k++) m.step(DT, k * DT, { playing: true, riding: false, visible: true });
  assert.equal(m.hops, 0, 'no hop while on screen');
  assert.ok(Math.hypot(g.x - runtime.player.x, g.z - runtime.player.z) > 18, 'still far');
  // stuck (not following) and out of sight
  g.state = 'idle';
  for (let k = 0; k < 150; k++) m.step(DT, 2 + k * DT, { playing: true, riding: false, visible: false });
  assert.equal(m.hops, 1, 'hopped once after 1.5 s off-screen');
  for (let k = 0; k < 40; k++) m.step(DT, 5 + k * DT, { playing: true, riding: false, visible: true });
  assert.ok(Math.hypot(g.x - runtime.player.x, g.z - runtime.player.z) < 4, 'landed beside the player');
  assert.ok(canStand(g.x, g.z, 0.3));
});
