import test from 'node:test';
import assert from 'node:assert/strict';
import { SF_ALCATRAZ_DEPARTURE, SF_CITY_RINGS, SF_LANDMARKS, isOnLand, nearestRoad } from '../src/features/little-bay/sf-world';
import { createSfDrivingSpawn, SF_DRIVING_EMPTY_INPUT, SF_DRIVING_FORWARD_SPEED, sfDrivingPosition, stepSfVehicle } from '../src/features/little-bay/sf-driving';
import type { SfVehicleState } from '../src/features/little-bay/sf-driving';

const forward = { ...SF_DRIVING_EMPTY_INPUT, forward: true };

test('every attraction starts on land and can depart without a street-width trap', () => {
  for (const landmark of SF_LANDMARKS) {
    const spawn = createSfDrivingSpawn(landmark.id);
    assert.ok(isOnLand(spawn.state.x, spawn.state.z), `${landmark.id}: start is on land`);
    assert.ok(nearestRoad(spawn.state.x, spawn.state.z, true).distance < .001, `${landmark.id}: recognisable street departure`);
    let state = spawn.state;
    for (let frame = 0; frame < 36; frame++) {
      const result = stepSfVehicle(state, forward, 1 / 60);
      assert.equal(result.blocked, false, `${landmark.id}: unobstructed departure at frame ${frame}`);
      state = result.state;
    }
    assert.ok(Math.hypot(state.x - spawn.state.x, state.z - spawn.state.z) > 1.9, `${landmark.id}: responsive forward movement`);
    assert.equal(spawn.state.speed, 0, 'movement must not mutate a cached spawn');
  }
});

test('free driving crosses multiple streets and scenery instead of following a narrow lane', () => {
  const initial: SfVehicleState = { ...createSfDrivingSpawn('park').state, heading: Math.PI / 2 };
  let state = initial;
  let greatestRoadDistance = 0;
  const crossedStreets = new Set<string>();
  for (let frame = 0; frame < 240; frame++) {
    const result = stepSfVehicle(state, forward, 1 / 60);
    assert.equal(result.blocked, false, `free cross-city movement at frame ${frame}`);
    state = result.state;
    greatestRoadDistance = Math.max(greatestRoadDistance, nearestRoad(state.x, state.z, true).distance);
    crossedStreets.add(result.streetName);
  }
  assert.ok(state.x - initial.x > 20, 'can travel useful distances on the city map');
  assert.ok(greatestRoadDistance > .5, 'crosses ground well outside any lane');
  assert.ok(crossedStreets.size >= 3, 'street labels follow the surroundings without restricting movement');
});

test('landmark scenery does not create invisible movement walls', () => {
  for (const id of ['park', 'palace', 'coit', 'painted-ladies']) {
    const landmark = SF_LANDMARKS.find(item => item.id === id)!;
    assert.equal(sfDrivingPosition(...landmark.position).allowed, true, `${id}: scenery is freely explorable`);
    const initial = { x: landmark.position[0], z: landmark.position[1], heading: 0, speed: 0 };
    const result = stepSfVehicle(initial, forward, 1 / 60);
    assert.equal(result.blocked, false);
    assert.ok(result.state.z > initial.z);
  }
});

test('a diagonal approach to the real shoreline slides along it and never enters the water', () => {
  let initial: SfVehicleState | undefined;
  for (const ring of SF_CITY_RINGS) {
    for (let index = 0; index < ring.length; index++) {
      const [ax, az] = ring[index], [bx, bz] = ring[(index + 1) % ring.length];
      const length = Math.hypot(bx - ax, bz - az);
      if (length < .6 || (ax + bx) / 2 > -40) continue;
      const tx = (bx - ax) / length, tz = (bz - az) / length;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      for (const side of [-1, 1]) {
        const nx = -tz * side, nz = tx * side;
        const x = mx + nx * .02, z = mz + nz * .02;
        if (!isOnLand(x, z) || isOnLand(mx - nx * .1, mz - nz * .1)) continue;
        initial = { x, z, heading: Math.atan2(tx - nx, tz - nz), speed: SF_DRIVING_FORWARD_SPEED };
        break;
      }
      if (initial) break;
    }
    if (initial) break;
  }
  assert.ok(initial, 'fixture uses an actual straight ocean coastline segment');
  const first = stepSfVehicle(initial, forward, .04);
  assert.equal(first.blocked, true, 'outward part reaches the shoreline');
  assert.ok(Math.hypot(first.state.x - initial.x, first.state.z - initial.z) > .05, 'tangential movement is preserved');
  let state = first.state;
  for (let frame = 0; frame < 180; frame++) {
    state = stepSfVehicle(state, forward, 1 / 60).state;
    assert.ok(isOnLand(state.x, state.z), 'shoreline safety is preserved across continued input');
  }
});

test('Alcatraz defensive spawn uses the mainland ferry departure, never water or the island', () => {
  const { state } = createSfDrivingSpawn('alcatraz');
  assert.ok(Math.hypot(state.x - SF_ALCATRAZ_DEPARTURE.position[0], state.z - SF_ALCATRAZ_DEPARTURE.position[1]) < 4);
  assert.ok(isOnLand(state.x, state.z));
});

test('paused input stops immediately and releasing controls produces smooth deceleration', () => {
  const initial = createSfDrivingSpawn('chinatown').state;
  const moving: SfVehicleState = { ...initial, speed: 1.7 };
  const paused = stepSfVehicle(moving, { ...forward, left: true }, 1 / 60, false);
  assert.deepEqual(paused.state, { ...moving, speed: 0 });
  assert.deepEqual(stepSfVehicle(initial, SF_DRIVING_EMPTY_INPUT, 1 / 60).state, initial);
  const coasting = stepSfVehicle(moving, SF_DRIVING_EMPTY_INPUT, 1 / 60);
  assert.ok(coasting.state.speed > 0 && coasting.state.speed < moving.speed);
  assert.equal(coasting.state.heading, moving.heading);
});

test('large frame gaps remain bounded and ordinary frame rates cover similar distances', () => {
  const initial = { ...createSfDrivingSpawn('chinatown').state, speed: SF_DRIVING_FORWARD_SPEED };
  const next = stepSfVehicle(initial, forward, 8).state;
  assert.ok(Math.hypot(next.x - initial.x, next.z - initial.z) <= SF_DRIVING_FORWARD_SPEED * .04 + .000001);
  const simulate = (fps: number) => {
    let state = { ...createSfDrivingSpawn('park').state, heading: Math.PI / 2 };
    for (let frame = 0; frame < fps * 2; frame++) state = stepSfVehicle(state, forward, 1 / fps).state;
    return state;
  };
  assert.ok(Math.abs(simulate(30).x - simulate(60).x) < .06);
  assert.ok(Math.abs(simulate(60).x - simulate(120).x) < .03);
});

test('turning and reversing are controlled by input and reset returns a fresh stationary vehicle', () => {
  const initial = createSfDrivingSpawn('chinatown').state;
  const turned = stepSfVehicle(initial, { ...SF_DRIVING_EMPTY_INPUT, left: true }, 1 / 60).state;
  assert.ok(turned.heading > initial.heading);
  assert.equal(turned.x, initial.x);
  assert.equal(turned.z, initial.z);
  const reverse = stepSfVehicle(initial, { ...SF_DRIVING_EMPTY_INPUT, backward: true }, 1 / 60).state;
  assert.ok(reverse.speed < 0);
  const steeringBack = stepSfVehicle({ ...initial, speed: -2 }, { ...SF_DRIVING_EMPTY_INPUT, backward: true, left: true }, 1 / 60).state;
  assert.ok(steeringBack.heading < initial.heading, 'reversing mirrors the steering direction');
  initial.x += 100;
  assert.notEqual(createSfDrivingSpawn('chinatown').state.x, initial.x, 'callers cannot corrupt a cached reset point');
});
