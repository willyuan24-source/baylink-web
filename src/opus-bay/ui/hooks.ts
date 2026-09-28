import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Mood } from '../core/types';
import { runtime } from '../core/runtime';
import { ASSETS } from '../data/assets';

/** Non-component UI helpers (hooks, asset lookups), kept apart from common.tsx so Fast Refresh stays happy. */

// ---------------------------------------------------------------------------
// Device / layout hooks
// ---------------------------------------------------------------------------

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return match;
}

export const useIsMobile = () => useMedia('(max-width: 720px)');

export type Device = 'keyboard' | 'touch' | 'gamepad';
let deviceNow: Device | null = null;
const deviceListeners = new Set<() => void>();
let deviceInstalled = false;
function setDevice(next: Device) {
  if (next === deviceNow) return;
  deviceNow = next;
  deviceListeners.forEach(listener => listener());
}

/** A mouse event this soon (ms) after a touch is the tap's own compat event, not a mouse. */
export const TOUCH_COMPAT_MS = 1000;
/** The parts of an input event the device detector reads. */
export interface DeviceInput {
  type: string;
  pointerType?: string;
  detail?: number;
  target?: EventTarget | null;
  /** MouseEvent.sourceCapabilities.firesTouchEvents (Chrome): the mouse event comes from a touch */
  firesTouch?: boolean;
}
const EDITABLE = /^(INPUT|TEXTAREA|SELECT)$/;
const editable = (t: EventTarget | null | undefined): boolean => {
  const el = t as { tagName?: string; isContentEditable?: boolean } | null | undefined;
  return !!el && (EDITABLE.test(el.tagName ?? '') || !!el.isContentEditable);
};
/**
 * Which device an input event says the player uses, or null when it says nothing (lane P, verify-phone B1). A tap
 * also fires compat mouse events (mousedown / mouseup / click, no pointerType) right after its touchend; the old
 * detector took that mousedown for a mouse and flipped the HUD to the keyboard layout between mousedown and mouseup,
 * so the tapped action button (和 Ray 聊聊, 坐渡轮, 捡起明信片 …) unmounted under the finger and never got its click,
 * and 跳 vanished for ≈ 350 ms after every tap. Now only a real mouse pointer (pointerdown with pointerType 'mouse') or
 * a key pressed outside a text field (the map search types on the phone keyboard) switches to the keyboard layout; the
 * mousedown path stays for browsers without pointer events, never within TOUCH_COMPAT_MS of a touch. Pure.
 */
export function deviceFromInput(e: DeviceInput, current: Device | null, msSinceTouch: number): Device | null {
  switch (e.type) {
    case 'touchstart': return 'touch';
    case 'pointerdown':
      if (e.pointerType === 'touch' || e.pointerType === 'pen') return 'touch';
      return e.pointerType === 'mouse' && msSinceTouch > TOUCH_COMPAT_MS ? 'keyboard' : null;
    case 'mousedown':
      return (e.detail ?? 0) > 0 && current === 'touch' && !e.pointerType && !e.firesTouch && msSinceTouch > TOUCH_COMPAT_MS ? 'keyboard' : null;
    case 'keydown': return current === 'touch' && editable(e.target) ? null : 'keyboard';
    default: return null;
  }
}

/**
 * Listen on `target` (the window) and feed the shared device state. `pointer`: the browser has pointer events (then
 * mousedown is not listened to: pointerdown says which pointer it was). Returns the remover. Exported for the tests.
 */
export function trackDevice(target: EventTarget, pointer: boolean, now: () => number = () => performance.now()): () => void {
  let touchAt = -Infinity;
  const on = (event: Event) => {
    const ev = event as Event & { pointerType?: string; detail?: number; sourceCapabilities?: { firesTouchEvents?: boolean } | null };
    const t = now();
    if (ev.type === 'touchstart' || ev.type === 'touchend' || (ev.type === 'pointerdown' && ev.pointerType === 'touch')) touchAt = t;
    const next = deviceFromInput({ type: ev.type, pointerType: ev.pointerType, detail: ev.detail, target: ev.target, firesTouch: !!ev.sourceCapabilities?.firesTouchEvents }, deviceNow, t - touchAt);
    if (next) setDevice(next);
  };
  const types = ['touchstart', 'touchend', 'keydown', pointer ? 'pointerdown' : 'mousedown'];
  for (const type of types) target.addEventListener(type, on, { capture: true, passive: true });
  return () => { for (const type of types) target.removeEventListener(type, on, { capture: true }); };
}
/** The device the shared detector holds now (null before any input). */
export const currentDevice = (): Device | null => deviceNow;

function installDevice() {
  if (deviceInstalled || typeof window === 'undefined') return;
  deviceInstalled = true;
  trackDevice(window, typeof window.PointerEvent === 'function');
  // actors report gamepad use through runtime.input.device
  window.setInterval(() => { if (runtime.input.device === 'gamepad' || (runtime.input.device === 'touch' && deviceNow !== 'touch')) setDevice(runtime.input.device); }, 500);
}
const subscribeDevice = (listener: () => void) => { installDevice(); deviceListeners.add(listener); return () => { deviceListeners.delete(listener); }; };
const getDevice = () => deviceNow;

/** keyboard | touch | gamepad — one shared detector (last input wins), coarse pointer as the first guess. */
export function useDevice(): Device {
  const coarse = useMedia('(pointer: coarse)');
  const device = useSyncExternalStore(subscribeDevice, getDevice, getDevice);
  return device ?? (coarse ? 'touch' : 'keyboard');
}

/**
 * Window keydown listener that is registered once and always calls the latest handler.
 * (Re-registering on every render can drop a key press when a render happens mid-dispatch.)
 */
export function useWindowKey(handler: (event: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useLayoutEffect(() => { ref.current = handler; });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => ref.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}

/** Loads an optional image once and remembers whether it exists (assets may be missing in some builds). */
const imageCache = new Map<string, boolean>();
export function useImageState(src: string | undefined): 'none' | 'loading' | 'ok' | 'error' {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!src || imageCache.has(src)) return;
    const img = new Image();
    img.onload = () => { imageCache.set(src, true); bump(n => n + 1); };
    img.onerror = () => { imageCache.set(src, false); bump(n => n + 1); };
    img.src = src;
  }, [src]);
  if (!src) return 'none';
  const known = imageCache.get(src);
  return known === undefined ? 'loading' : known ? 'ok' : 'error';
}
/** True once the image is known to load (false while unknown or missing). */
export const useImageOk = (src: string | undefined): boolean => useImageState(src) === 'ok';

// ---------------------------------------------------------------------------
// Portraits
// ---------------------------------------------------------------------------

export function portraitSrc(key: string, mood?: Mood): string | undefined {
  const p = ASSETS.portraits ?? {};
  return (mood && (p[`${key}-${mood}`] ?? p[`${key}.${mood}`] ?? (key === 'baybay' ? p[mood] : undefined))) ?? p[key] ?? p[`${key}-happy`] ?? undefined;
}
