import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleSfCableCarRide, SF_CABLE_CAR_SECONDS } from '../src/features/little-bay/sf-cable-car-ride';
import { SF_LANDMARKS, isOnLand, terrainHeight } from '../src/features/little-bay/sf-world';

test('sightseeing tram starts at Powell and ends beside the waterfront wheel', () => {
  const start = sampleSfCableCarRide(0), end = sampleSfCableCarRide(SF_CABLE_CAR_SECONDS);
  const cableCar = SF_LANDMARKS.find(place => place.id === 'cable-car')!;
  const wheel = SF_LANDMARKS.find(place => place.id === 'skystar')!;
  assert.ok(Math.hypot(start.x - cableCar.position[0], start.z - cableCar.position[1]) < .01);
  assert.ok(Math.hypot(end.x - wheel.position[0], end.z - wheel.position[1]) < wheel.arrivalRadius);
  assert.equal(start.progress, 0); assert.equal(end.progress, 1);
  assert.deepEqual(sampleSfCableCarRide(-1), start);
  assert.deepEqual(sampleSfCableCarRide(Number.NaN), start);
  assert.deepEqual(sampleSfCableCarRide(SF_CABLE_CAR_SECONDS + 10), end);
});

test('every tram frame stays on land and above the terrain without position jumps', () => {
  let previous = sampleSfCableCarRide(0);
  const chapters = new Set([previous.chapter]);
  for (let frame = 1; frame <= SF_CABLE_CAR_SECONDS * 60; frame++) {
    const point = sampleSfCableCarRide(frame / 60);
    assert.ok(isOnLand(point.x, point.z), `land at ${frame / 60}s`);
    assert.ok(point.y > terrainHeight(point.x, point.z));
    assert.ok(Number.isFinite(point.heading));
    assert.ok(Math.hypot(point.x - previous.x, point.z - previous.z) < .05, `smooth position at ${frame / 60}s`);
    assert.ok(point.progress >= previous.progress);
    chapters.add(point.chapter); previous = point;
  }
  assert.equal(chapters.size, 3);
});

test('tram eases into departure and arrival rather than stopping at full speed', () => {
  const distance = (from: number, to: number) => {
    const a = sampleSfCableCarRide(from), b = sampleSfCableCarRide(to);
    return Math.hypot(b.x - a.x, b.z - a.z);
  };
  const cruising = distance(SF_CABLE_CAR_SECONDS / 2, SF_CABLE_CAR_SECONDS / 2 + .1);
  assert.ok(distance(0, .1) < cruising * .05);
  assert.ok(distance(SF_CABLE_CAR_SECONDS - .1, SF_CABLE_CAR_SECONDS) < cruising * .05);
});
