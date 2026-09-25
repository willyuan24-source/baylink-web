import test from 'node:test';
import assert from 'node:assert/strict';
import { createSfWalkerState, stepSfWalker } from '../src/features/little-bay/sf-walking';
import type { SfWalkerState, SfWalkingOptions, SfWalkDirection } from '../src/features/little-bay/sf-walking';

const still = { x: 0, z: 0 };

function simulate(state: SfWalkerState, direction: SfWalkDirection, seconds: number, hz = 60, options?: SfWalkingOptions) {
  for (let frame = 0; frame < seconds * hz; frame++) state = stepSfWalker(state, direction, 1 / hz, options);
  return state;
}

test('walking accelerates without snapping and releases into a short smooth stop', () => {
  const initial = createSfWalkerState(3, 4);
  const first = stepSfWalker(initial, { x: 0, z: 1 }, 1 / 60);
  assert.ok(first.speed > 0 && first.speed < 1);
  assert.ok(first.z > initial.z);
  assert.deepEqual(initial, createSfWalkerState(3, 4), 'the previous state is never mutated');
  const running = simulate(initial, { x: 0, z: 1 }, 1);
  assert.ok(running.speed > 2.39 && running.speed <= 2.4);
  const released = stepSfWalker(running, still, 1 / 60);
  assert.ok(released.speed > 0 && released.speed < running.speed);
  const stopped = simulate(running, still, 1);
  assert.equal(stopped.speed, 0);
  assert.ok(stopped.z - running.z > .1 && stopped.z - running.z < .16, 'no ice-like gliding');
  assert.ok(Math.abs(stopped.distance - (stopped.z - initial.z)) < 1e-9);
});

test('diagonal input covers the same distance as a straight walk and ignores input magnitude', () => {
  const start = createSfWalkerState(0, 0);
  const straight = simulate(start, { x: 0, z: 1 }, 2);
  const diagonal = simulate(start, { x: 1, z: 1 }, 2);
  const oversized = simulate(start, { x: 100, z: 100 }, 2);
  assert.ok(Math.abs(straight.distance - diagonal.distance) < 1e-9);
  assert.ok(Math.abs(diagonal.speed - straight.speed) < 1e-9);
  assert.ok(Math.abs(diagonal.x - diagonal.z) < 1e-9);
  assert.deepEqual(oversized, diagonal);
});

test('30, 60 and 120 Hz produce the same acceleration, braking distance and gradual turn', () => {
  const results = [30, 60, 120].map(hz => {
    let state = simulate(createSfWalkerState(0, 0), { x: 0, z: 1 }, 1, hz);
    state = simulate(state, { x: 1, z: 0 }, 1, hz);
    return simulate(state, still, .5, hz);
  });
  for (const state of results.slice(1)) for (const key of ['x', 'z', 'heading', 'distance', 'speed'] as const) {
    assert.ok(Math.abs(state[key] - results[0][key]) < 1e-8, `${key} remains consistent across frame rates`);
  }
});

test('heading turns along the short arc across the -PI/PI boundary', () => {
  const initial = createSfWalkerState(0, 0, Math.PI - .05);
  const direction = { x: Math.sin(-Math.PI + .05), z: Math.cos(-Math.PI + .05) };
  const first = stepSfWalker(initial, direction, 1 / 60);
  assert.ok(first.turn > 0 && first.turn < 2, 'turns the short positive 0.1-radian arc');
  const settled = simulate(first, direction, 1);
  const error = Math.atan2(Math.sin(settled.heading - (-Math.PI + .05)), Math.cos(settled.heading - (-Math.PI + .05)));
  assert.ok(Math.abs(error) < .001);
});

test('an obstacle blocks the incoming axis but allows sliding and an immediate escape', () => {
  const canMove = (x: number, z: number) => x <= .5 && z <= 10;
  const blocked = simulate(createSfWalkerState(0, 0), { x: 1, z: 1 }, 1, 60, { canMove });
  assert.ok(blocked.x <= .5);
  assert.ok(blocked.z > 1.4, 'continues along the free axis');
  assert.equal(blocked.vx, 0, 'no momentum keeps building into the wall');
  assert.ok(blocked.vz > 1);
  const retreat = simulate(blocked, { x: -1, z: 0 }, .2, 60, { canMove });
  assert.ok(retreat.x < blocked.x - .25, 'walking away is responsive');
  const corner = simulate(createSfWalkerState(0, 0), { x: 1, z: 1 }, 1, 60, { canMove: (x, z) => x <= .1 && z <= .1 });
  assert.ok(corner.x <= .1 && corner.z <= .1);
  assert.equal(corner.speed, 0);
});

test('pause freezes position and drops velocity, while a frame gap cannot teleport', () => {
  const moving = simulate(createSfWalkerState(0, 0), { x: 1, z: 0 }, 1);
  const paused = stepSfWalker(moving, { x: 0, z: 1 }, 1, { active: false });
  assert.deepEqual(paused, { ...moving, vx: 0, vz: 0, speed: 0, turn: 0 });
  const next = stepSfWalker(moving, { x: 1, z: 0 }, 30);
  assert.ok(next.x - moving.x <= .240001);
  assert.deepEqual(stepSfWalker(moving, still, NaN), moving);
});

test('a tap destination slows on approach, arrives exactly and remains still without overshooting', () => {
  const destination = { x: 1, z: 1 };
  let state = createSfWalkerState(0, 0);
  let previousRemaining = Math.SQRT2;
  for (let frame = 0; frame < 180; frame++) {
    state = stepSfWalker(state, still, 1 / 60, { destination });
    const remaining = Math.hypot(destination.x - state.x, destination.z - state.z);
    assert.ok(remaining <= previousRemaining + 1e-9);
    assert.ok(state.x <= 1 && state.z <= 1);
    previousRemaining = remaining;
  }
  assert.equal(state.x, 1);
  assert.equal(state.z, 1);
  assert.equal(state.speed, 0);
  assert.equal(state.turn, 0);
  assert.deepEqual(stepSfWalker(state, still, 1 / 60, { destination }), state);
  const manual = stepSfWalker(state, { x: -1, z: 0 }, 1 / 60, { destination });
  assert.ok(manual.x < 1, 'manual input overrides the old tap destination');
});

test('a destination never snaps through a wall and different move speeds remain bounded', () => {
  const start = createSfWalkerState(0, 0);
  const wall = simulate(start, still, 2, 60, { destination: { x: 1, z: 0 }, canMove: x => x < .99 });
  assert.ok(wall.x < .99);
  assert.equal(wall.speed, 0);
  const fast = simulate(start, { x: 1, z: 0 }, 1, 60, { maxSpeed: 8 });
  assert.ok(fast.speed > 7.9 && fast.speed <= 8);
  assert.deepEqual(simulate(start, { x: 1, z: 0 }, 1, 60, { maxSpeed: 0 }), start);
});
