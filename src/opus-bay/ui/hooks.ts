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

type Device = 'keyboard' | 'touch' | 'gamepad';
let deviceNow: Device | null = null;
const deviceListeners = new Set<() => void>();
let deviceInstalled = false;
function setDevice(next: Device) {
  if (next === deviceNow) return;
  deviceNow = next;
  deviceListeners.forEach(listener => listener());
}
function installDevice() {
  if (deviceInstalled || typeof window === 'undefined') return;
  deviceInstalled = true;
  window.addEventListener('touchstart', () => setDevice('touch'), { passive: true, capture: true });
  window.addEventListener('keydown', () => setDevice('keyboard'), { capture: true });
  window.addEventListener('mousedown', event => { if ((event as MouseEvent).detail > 0 && deviceNow === 'touch' && !(event as PointerEvent).pointerType) setDevice('keyboard'); }, { capture: true });
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
