export type SfCameraAction = 'left' | 'right' | 'up' | 'down' | 'zoom-in' | 'zoom-out' | 'reset';
export type SfCameraCommand = { id: number; action: SfCameraAction };
export type SfCameraView = { azimuth: number; polar: number; distance: number };
export type SfCameraLimits = { minDistance: number; maxDistance: number; minPolar: number; maxPolar: number };

export const SF_FOLLOW_CAMERA_LIMITS: SfCameraLimits = { minDistance: 8, maxDistance: 42, minPolar: .28, maxPolar: 1.05 };
export const SF_OVERVIEW_CAMERA_LIMITS: SfCameraLimits = { minDistance: 8, maxDistance: 600, minPolar: .28, maxPolar: 1.18 };
export const SF_GARDEN_CAMERA_LIMITS: SfCameraLimits = { minDistance: 9, maxDistance: 36, minPolar: .3, maxPolar: 1.28 };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Shared by the HUD and orbit controls so neither can cross the ground or lose the player in a close-up. */
export function adjustSfCamera(view: SfCameraView, action: Exclude<SfCameraAction, 'reset'>, limits: SfCameraLimits): SfCameraView {
  return {
    azimuth: view.azimuth + (action === 'left' ? -.3 : action === 'right' ? .3 : 0),
    polar: clamp(view.polar + (action === 'up' ? -.13 : action === 'down' ? .13 : 0), limits.minPolar, limits.maxPolar),
    distance: clamp(view.distance * (action === 'zoom-in' ? .82 : action === 'zoom-out' ? 1 / .82 : 1), limits.minDistance, limits.maxDistance),
  };
}

/** A release after a drag or multi-touch gesture must never also become a walk destination. */
export function createSfCameraGestureGuard() {
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = false;
  return {
    down(id: number, x: number, y: number) {
      if (pointers.size === 0) dragged = false;
      pointers.set(id, { x, y });
      if (pointers.size > 1) dragged = true;
    },
    move(id: number, x: number, y: number) {
      const start = pointers.get(id);
      if (start && Math.hypot(x - start.x, y - start.y) >= 6) dragged = true;
    },
    up(id: number) { pointers.delete(id); },
    cancel() { pointers.clear(); dragged = true; },
    allowsClick() { return !dragged; },
  };
}

export function observeSfCameraGestures(canvas: HTMLElement, guard: ReturnType<typeof createSfCameraGestureGuard>) {
  const down = (event: PointerEvent) => guard.down(event.pointerId, event.clientX, event.clientY);
  const move = (event: PointerEvent) => guard.move(event.pointerId, event.clientX, event.clientY);
  const up = (event: PointerEvent) => guard.up(event.pointerId);
  const cancel = () => guard.cancel();
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', cancel, true);
  window.addEventListener('blur', cancel);
  return () => {
    canvas.removeEventListener('pointerdown', down, true);
    canvas.removeEventListener('pointermove', move, true);
    canvas.removeEventListener('pointerup', up, true);
    canvas.removeEventListener('pointercancel', cancel, true);
    window.removeEventListener('blur', cancel);
  };
}
