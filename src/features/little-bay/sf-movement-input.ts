export type SfMovementInput = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  /** Joystick displacement: right is +X, screen-up is +Y. */
  moveX?: number;
  moveY?: number;
};

export const hasSfDigitalInput = (input: SfMovementInput) => input.forward || input.backward || input.left || input.right;

export function usesSfAnalogInput(input: SfMovementInput) {
  return !hasSfDigitalInput(input) && (Number.isFinite(input.moveX) || Number.isFinite(input.moveY));
}

/** Keyboard controls take priority; a partial joystick tilt keeps its magnitude. */
export function sfMovementAxes(input: SfMovementInput) {
  const digital = hasSfDigitalInput(input);
  const x = digital ? Number(input.right) - Number(input.left) : Number.isFinite(input.moveX) ? input.moveX! : 0;
  const y = digital ? Number(input.forward) - Number(input.backward) : Number.isFinite(input.moveY) ? input.moveY! : 0;
  const magnitude = Math.max(1, Math.hypot(x, y));
  return { x: x / magnitude, y: y / magnitude };
}

/** A thumb pushed up always travels into the view, even after orbiting the camera. */
export function sfCameraRelativeDirection(input: SfMovementInput, cameraForward: { x: number; z: number }) {
  const axes = sfMovementAxes(input);
  const length = Math.hypot(cameraForward.x, cameraForward.z);
  const x = length > 1e-6 ? cameraForward.x / length : 0;
  const z = length > 1e-6 ? cameraForward.z / length : -1;
  return { x: x * axes.y - z * axes.x, z: z * axes.y + x * axes.x };
}
