import assert from 'node:assert/strict';
import test from 'node:test';
import { createSfArrivalTracker, createSfWalkingSpawn, findSfArrival } from '../src/features/little-bay/sf-place-arrival';
import { SF_LANDMARKS, isOnLand } from '../src/features/little-bay/sf-world';
import { createSfWalkerState, stepSfWalker } from '../src/features/little-bay/sf-walking';

test('walking departures land at the correct attraction, including the closely spaced museums and island', () => {
  for (const landmark of SF_LANDMARKS) {
    const spawn = createSfWalkingSpawn(landmark.id);
    assert.ok(isOnLand(spawn.state.x, spawn.state.z), landmark.id);
    assert.equal(findSfArrival(spawn.state.x, spawn.state.z), landmark.id);
  }
});

test('new museum departures stand in front of the model, and can walk away freely', () => {
  for (const id of ['japanese-tea-garden', 'academy', 'de-young']) {
    const landmark = SF_LANDMARKS.find(item => item.id === id)!;
    const { state: spawn } = createSfWalkingSpawn(id);
    assert.ok(spawn.z - landmark.position[1] >= .9, `${id}: outside the front wall`);
    let walker = createSfWalkerState(spawn.x, spawn.z, spawn.heading);
    for (let frame = 0; frame < 30; frame++) walker = stepSfWalker(walker, { x: 0, z: 1 }, 1 / 60, { canMove: isOnLand });
    assert.ok(walker.z - spawn.z > .7, `${id}: no coast or invisible movement trap`);
  }
});

test('new campus and civic walking departures clear the miniature facades', () => {
  for (const id of ['ucsf-parnassus','ucsf-mission-bay','sf-state','exploratorium','stonestown','city-hall','salesforce','transamerica','oracle-park']) {
    const landmark = SF_LANDMARKS.find(item => item.id === id)!;
    const { state: spawn } = createSfWalkingSpawn(id);
    assert.ok(Math.hypot(spawn.x-landmark.position[0], spawn.z-landmark.position[1]) >= 1.6, `${id}: outside the front facade`);
    let walker = createSfWalkerState(spawn.x, spawn.z, spawn.heading);
    for (let frame = 0; frame < 30; frame++) walker = stepSfWalker(walker, {x:0,z:1}, 1/60, {canMove:isOnLand});
    assert.ok(walker.z-spawn.z > .7, `${id}: can leave freely`);
  }
});

test('resetting at the same attraction reports arrival again without repeating every frame', () => {
  const tracker = createSfArrivalTracker();
  const { state } = createSfWalkingSpawn('academy');
  assert.deepEqual(tracker.update(state.x, state.z), { id: 'academy', changed: true });
  assert.deepEqual(tracker.update(state.x, state.z), { id: 'academy', changed: false });
  tracker.reset();
  assert.deepEqual(tracker.update(state.x, state.z), { id: 'academy', changed: true });
  assert.deepEqual(tracker.update(80, 80), { id: null, changed: true });
  assert.deepEqual(tracker.update(80, 80), { id: null, changed: false });
  tracker.reset();
  assert.deepEqual(tracker.update(80, 80), { id: null, changed: true });
});
