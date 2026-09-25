import test from 'node:test';
import assert from 'node:assert/strict';
import { sfCameraRelativeDirection, sfMovementAxes, usesSfAnalogInput } from '../src/features/little-bay/sf-movement-input';

const idle = { forward: false, backward: false, left: false, right: false };

test('analog strength is preserved, diagonals are bounded, invalid values are ignored', () => {
  assert.deepEqual(sfMovementAxes({ ...idle, moveX: .3, moveY: .4 }), { x: .3, y: .4 });
  const diagonal = sfMovementAxes({ ...idle, moveX: 1, moveY: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
  assert.deepEqual(sfMovementAxes({ ...idle, moveX: NaN, moveY: Infinity }), { x: 0, y: 0 });
});

test('screen-relative joystick direction follows camera orbit and preserves proportional speed', () => {
  assert.deepEqual(sfCameraRelativeDirection({ ...idle, moveX: .5 }, { x: 0, z: -1 }), { x: .5, z: 0 });
  assert.deepEqual(sfCameraRelativeDirection({ ...idle, moveY: .5 }, { x: 1, z: 0 }), { x: .5, z: 0 });
  assert.deepEqual(sfCameraRelativeDirection({ ...idle, moveX: .5 }, { x: 1, z: 0 }), { x: 0, z: .5 });
  assert.deepEqual(sfCameraRelativeDirection({ ...idle, moveY: 1 }, { x: 0, z: 0 }), { x: 0, z: -1 });
});

test('keyboard overrides joystick input and release is still recognized as analog braking', () => {
  assert.deepEqual(sfMovementAxes({ ...idle, forward: true, moveX: .5, moveY: -.5 }), { x: 0, y: 1 });
  assert.equal(usesSfAnalogInput({ ...idle, forward: true, moveX: .5 }), false);
  assert.equal(usesSfAnalogInput({ ...idle, moveX: 0, moveY: 0 }), true);
  assert.equal(usesSfAnalogInput(idle), false);
});
