import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';

/**
 * Canvas gestures (attached to the WebGL canvas, so taps still reach R3F for tap-to-walk / interact):
 *  - mouse: left- or right-drag rotates the camera (a click without drag still walks), wheel zooms;
 *  - touch: a drag that starts on the left half becomes a floating joystick (base where the thumb landed,
 *    follows the thumb past its rim); a drag on the right half rotates the camera; two fingers pinch-zoom
 *    and rotate; a quick tap is left alone for R3F's onClick;
 *  - photo mode: one-finger / left drag orbits anywhere.
 * Writes input.stick / dragX / dragY / wheel / pinch; never React state.
 */

export const DRAG_THRESHOLD = 8;
const STICK_RADIUS = 52;
/**
 * Peek cards over the thumb zone whose touches the stick shares (a drag steers, a tap stays the card's): CP-12, and
 * (W5-Z) lane D's compact find card (小发现 · +10 金币, 6 s, the same bottom-left slot on phones): a thumb that came down
 * on it walked nowhere and kept it open (its timer waits while the pointer is on it). Once opened it reads normally.
 */
export const THUMB_PASS = '.ob-arrival-card, .ob-egg-card:not(.is-open)';

type Role = 'pending' | 'stick' | 'look' | 'pinch';
interface Touch { id: number; x0: number; y0: number; x: number; y: number; role: Role; left: boolean }

/** What TouchControls draws (CSS px relative to the canvas). */
export const stickView = { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0 };
let renderStick: (() => void) | null = null;
/** TouchControls registers a function that paints `stickView` (DOM transforms, no React state). */
export function setStickRenderer(fn: (() => void) | null) { renderStick = fn; fn?.(); }
const paint = () => renderStick?.();

export function attachPointer(el: HTMLElement): () => void {
  const touches = new Map<number, Touch>();
  let mouse: null | { id: number; x0: number; y0: number; x: number; y: number; dragging: boolean; button: number } = null;
  let pinchPrev: null | { d: number; mx: number; my: number } = null;
  const rect = () => el.getBoundingClientRect();
  const photo = () => game.get().photoMode;
  const noteCamera = () => { input.lastCameraInputAt = performance.now(); };

  const releaseStick = () => {
    input.stick.active = false; input.stick.x = 0; input.stick.y = 0;
    if (stickView.active) { stickView.active = false; paint(); }
  };

  const pinchPair = (): [Touch, Touch] | null => {
    const list = [...touches.values()].filter(t => t.role === 'pinch');
    return list.length >= 2 ? [list[0], list[1]] : null;
  };
  const pinchMetrics = (a: Touch, b: Touch) => ({ d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 });

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (e.button !== 0 && e.button !== 2) return;
      mouse = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dragging: false, button: e.button };
      return;
    }
    runtime.input.device = 'touch';
    const r = rect();
    const t: Touch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, role: 'pending', left: e.clientX - r.left < r.width * 0.5 };
    touches.set(e.pointerId, t);
    // two free fingers → pinch / two-finger rotate (a thumb already on the stick keeps steering)
    const free = [...touches.values()].filter(item => item.role !== 'stick');
    if (free.length >= 2) {
      for (const item of free.slice(0, 2)) item.role = 'pinch';
      const pair = pinchPair();
      if (pair) pinchPrev = pinchMetrics(pair[0], pair[1]);
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (!mouse || e.pointerId !== mouse.id) return;
      const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!mouse.dragging && Math.hypot(e.clientX - mouse.x0, e.clientY - mouse.y0) > DRAG_THRESHOLD) {
        mouse.dragging = true;
        input.dragX += e.clientX - mouse.x0 - dx; input.dragY += e.clientY - mouse.y0 - dy;
        try { el.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      }
      if (mouse.dragging) { input.dragX += dx; input.dragY += dy; noteCamera(); }
      return;
    }
    const t = touches.get(e.pointerId);
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY;
    if (t.role === 'pending' && Math.hypot(t.x - t.x0, t.y - t.y0) > DRAG_THRESHOLD + 2) {
      const stickTaken = [...touches.values()].some(item => item.role === 'stick');
      t.role = t.left && !stickTaken && !photo() ? 'stick' : 'look';
      if (t.role === 'stick') { stickView.active = true; stickView.baseX = t.x0 - rect().left; stickView.baseY = t.y0 - rect().top; }
    }
    if (t.role === 'stick') {
      const r = rect();
      let vx = t.x - r.left - stickView.baseX, vy = t.y - r.top - stickView.baseY;
      const L = Math.hypot(vx, vy);
      if (L > STICK_RADIUS) {
        // floating stick: drag the base along so reversing direction is instant
        stickView.baseX += (vx / L) * (L - STICK_RADIUS);
        stickView.baseY += (vy / L) * (L - STICK_RADIUS);
        vx = (vx / L) * STICK_RADIUS; vy = (vy / L) * STICK_RADIUS;
      }
      stickView.knobX = vx; stickView.knobY = vy;
      input.stick.active = true;
      input.stick.x = vx / STICK_RADIUS;
      input.stick.y = -vy / STICK_RADIUS;
      paint();
    } else if (t.role === 'look') {
      input.dragX += dx * 1.15; input.dragY += dy * 1.15; noteCamera();
    } else if (t.role === 'pinch') {
      const pair = pinchPair();
      if (pair && pinchPrev) {
        const m = pinchMetrics(pair[0], pair[1]);
        input.pinch *= pinchPrev.d / m.d;
        input.dragX += (m.mx - pinchPrev.mx) * 1.1;
        input.dragY += (m.my - pinchPrev.my) * 1.1;
        pinchPrev = m;
        noteCamera();
      }
    }
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (mouse && e.pointerId === mouse.id) {
        try { if (mouse.dragging) el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        mouse = null;
      }
      return;
    }
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (t.role === 'stick') releaseStick();
    if (t.role === 'pinch') {
      pinchPrev = null;
      // the remaining pinch finger keeps rotating
      for (const item of touches.values()) if (item.role === 'pinch') item.role = 'look';
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    input.wheel += e.deltaY * scale;
    noteCamera();
  };
  const onContext = (e: Event) => e.preventDefault();
  const onCancelAll = () => { touches.clear(); mouse = null; pinchPrev = null; releaseStick(); };

  // (checkpoint CP-12) a touch that lands on a peek card over the thumb zone (THUMB_PASS: lane N's arrival card, 6 s,
  // bottom left on phones) is the canvas's too: a drag steers the stick (or turns the camera on the right half) and the
  // click that would end it is swallowed; a tap stays the card's. The card's body lets touches through (opus-bay.css).
  const passing = new Set<number>();
  const passTarget = (e: PointerEvent) => e.pointerType !== 'mouse' && e.target instanceof Element && !!e.target.closest(THUMB_PASS);
  let swallowUntil = 0;
  const onPassDown = (e: PointerEvent) => {
    swallowUntil = 0;     // a new touch: the click to swallow belonged to the gesture before
    if (passTarget(e)) { passing.add(e.pointerId); onDown(e); }
  };
  const onPassMove = (e: PointerEvent) => { if (passing.has(e.pointerId)) onMove(e); };
  const onPassUp = (e: PointerEvent) => {
    if (!passing.has(e.pointerId)) return;
    passing.delete(e.pointerId);
    const role = touches.get(e.pointerId)?.role;
    if (role && role !== 'pending') swallowUntil = performance.now() + 450;
    onUp(e);
  };
  const onPassClick = (e: MouseEvent) => {
    if (performance.now() > swallowUntil) return;
    swallowUntil = 0;
    e.preventDefault(); e.stopPropagation();
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('lostpointercapture', onUp as EventListener);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('contextmenu', onContext);
  window.addEventListener('blur', onCancelAll);
  window.addEventListener('pointerdown', onPassDown, true);
  window.addEventListener('pointermove', onPassMove, true);
  window.addEventListener('pointerup', onPassUp, true);
  window.addEventListener('pointercancel', onPassUp, true);
  window.addEventListener('click', onPassClick, true);
  return () => {
    window.removeEventListener('pointerdown', onPassDown, true);
    window.removeEventListener('pointermove', onPassMove, true);
    window.removeEventListener('pointerup', onPassUp, true);
    window.removeEventListener('pointercancel', onPassUp, true);
    window.removeEventListener('click', onPassClick, true);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('lostpointercapture', onUp as EventListener);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('contextmenu', onContext);
    window.removeEventListener('blur', onCancelAll);
    onCancelAll();
  };
}
