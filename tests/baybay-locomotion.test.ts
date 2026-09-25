import assert from 'node:assert/strict';
import test from 'node:test';
import { BAYBAY_STRIDE, bayBayPawPose, bayBayStrideAdvance } from '../src/features/little-bay/baybay-locomotion';

test('a planted paw stays on the ground and cancels actual forward movement', () => {
  const worldStep = 0.08;
  const scale = 1.3;
  const before = bayBayPawPose(0.12, 0);
  const after = bayBayPawPose(0.12 + bayBayStrideAdvance(worldStep, scale), 0);
  assert.equal(before.lift, 0);
  assert.equal(after.lift, 0);
  assert.ok(Math.abs((after.travel - before.travel) * scale + worldStep) < 1e-10);
});

test('the returning paw lifts while the opposite paw supports BayBay', () => {
  let sawLift = false;
  for (let sample = 0; sample < 100; sample += 1) {
    const left = bayBayPawPose(sample / 100, 0);
    const right = bayBayPawPose(sample / 100, 1);
    assert.ok(left.lift >= 0 && right.lift >= 0);
    assert.ok(left.lift === 0 || right.lift === 0, 'At least one paw must remain planted');
    if (left.lift > 0.1 || right.lift > 0.1) sawLift = true;
  }
  assert.equal(sawLift, true);
});

test('stride length follows model size, advances only by distance, and loops continuously', () => {
  assert.equal(bayBayStrideAdvance(0, 1.3), 0);
  assert.ok(Math.abs(bayBayStrideAdvance(BAYBAY_STRIDE * 1.3, 1.3) - 1) < 1e-10);
  assert.equal(bayBayStrideAdvance(1, 2), bayBayStrideAdvance(1, 1) / 2);
  const end = bayBayPawPose(1 - 1e-6, 0);
  const start = bayBayPawPose(0, 0);
  assert.ok(Math.abs(end.travel - start.travel) < 1e-5);
  assert.ok(Math.abs(end.lift - start.lift) < 1e-5);
});
