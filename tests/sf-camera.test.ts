import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustSfCamera, createSfCameraGestureGuard, SF_FOLLOW_CAMERA_LIMITS, SF_GARDEN_CAMERA_LIMITS, SF_OVERVIEW_CAMERA_LIMITS } from '../src/features/little-bay/sf-camera';

test('camera directions are reversible and do not change player zoom', () => {
  const original = { azimuth: .45, polar: .8, distance: 18 };
  const rotated = adjustSfCamera(original, 'left', SF_FOLLOW_CAMERA_LIMITS);
  assert.ok(rotated.azimuth < original.azimuth);
  assert.equal(rotated.distance, original.distance);
  const restored = adjustSfCamera(rotated, 'right', SF_FOLLOW_CAMERA_LIMITS);
  assert.ok(Math.abs(restored.azimuth - original.azimuth) < 1e-12);
  assert.equal(original.azimuth, .45, 'commands never mutate the previous camera state');
  const higher = adjustSfCamera(original, 'up', SF_FOLLOW_CAMERA_LIMITS);
  assert.ok(higher.polar < original.polar, 'up shows more of the ground from above');
});

test('repeated zoom and pitch commands stay inside each scene safe viewing range', () => {
  for (const limits of [SF_FOLLOW_CAMERA_LIMITS, SF_GARDEN_CAMERA_LIMITS, SF_OVERVIEW_CAMERA_LIMITS]) {
    let view = { azimuth: 0, polar: .8, distance: 20 };
    for (let i = 0; i < 100; i++) {
      view = adjustSfCamera(adjustSfCamera(view, 'zoom-in', limits), 'down', limits);
    }
    assert.equal(view.distance, limits.minDistance);
    assert.equal(view.polar, limits.maxPolar);
    for (let i = 0; i < 100; i++) {
      view = adjustSfCamera(adjustSfCamera(view, 'zoom-out', limits), 'up', limits);
    }
    assert.equal(view.distance, limits.maxDistance);
    assert.equal(view.polar, limits.minPolar);
  }
});

test('a short tap walks but an orbit drag followed by release cannot also walk', () => {
  const guard = createSfCameraGestureGuard();
  guard.down(1, 100, 100); guard.move(1, 102, 101); guard.up(1);
  assert.equal(guard.allowsClick(), true);
  guard.down(2, 100, 100); guard.move(2, 116, 101); guard.move(2, 100, 100); guard.up(2);
  assert.equal(guard.allowsClick(), false, 'dragging back to the start does not turn the gesture into a tap');
  guard.down(3, 40, 40); guard.up(3);
  assert.equal(guard.allowsClick(), true, 'the next intentional tap still works');
});

test('two-finger gestures and cancelled touches never create a walking destination', () => {
  const guard = createSfCameraGestureGuard();
  guard.down(1, 50, 50); guard.down(2, 80, 80); guard.up(2); guard.up(1);
  assert.equal(guard.allowsClick(), false, 'even a stationary two-finger touch is camera input');
  guard.down(3, 50, 50); guard.cancel();
  assert.equal(guard.allowsClick(), false);
  guard.down(4, 50, 50); guard.up(4);
  assert.equal(guard.allowsClick(), true);
});
