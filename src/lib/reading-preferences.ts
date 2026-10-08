import { useSyncExternalStore } from 'react';

// public/reading-init.js applies the same keys and URL parameters before the first paint; keep the two in step.
export type ReadingSize = 'standard' | 'large' | 'extra-large';
export const READING_SIZE_KEY = 'baylink.reading-size.v1';
export const SIMPLE_DISPLAY_KEY = 'baylink.simple-display.v1';
let sessionSize: ReadingSize = 'standard';
let sessionOnly = false;
let sessionSimple = false;
let simpleSessionOnly = false;
const listeners = new Set<() => void>();
export const validReadingSize = (value: unknown): ReadingSize => value === 'large' || value === 'extra-large' ? value : 'standard';

export function getReadingSize(): ReadingSize {
  if (typeof window === 'undefined') return 'standard';
  if (sessionOnly) return sessionSize;
  try { return validReadingSize(window.localStorage.getItem(READING_SIZE_KEY) || sessionSize); }
  catch { return sessionSize; }
}

export function applyReadingSize(size: ReadingSize) {
  if (typeof document !== 'undefined') document.documentElement.dataset.reading = size;
}

export function setReadingSize(size: ReadingSize) {
  sessionSize = validReadingSize(size);
  try { window.localStorage.setItem(READING_SIZE_KEY, sessionSize); sessionOnly = false; } catch { sessionOnly = true; }
  applyReadingSize(sessionSize);
  listeners.forEach(listener => listener());
}

/** 简洁显示 (适合长辈): text at least 16px, larger targets and tab bar (html[data-simple], src/tokens.css). */
export function getSimpleDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  if (simpleSessionOnly) return sessionSimple;
  try {
    const saved = window.localStorage.getItem(SIMPLE_DISPLAY_KEY);
    return saved === null ? sessionSimple : saved === '1';
  } catch { return sessionSimple; }
}

export function applySimpleDisplay(on: boolean) {
  if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-simple', on);
}

export function setSimpleDisplay(on: boolean) {
  sessionSimple = on;
  try { window.localStorage.setItem(SIMPLE_DISPLAY_KEY, on ? '1' : '0'); simpleSessionOnly = false; } catch { simpleSessionOnly = true; }
  applySimpleDisplay(on);
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => {
    if (event.key === READING_SIZE_KEY || event.key === null) { sessionOnly = false; applyReadingSize(getReadingSize()); }
    if (event.key === SIMPLE_DISPLAY_KEY || event.key === null) { simpleSessionOnly = false; applySimpleDisplay(getSimpleDisplay()); }
    if (event.key === READING_SIZE_KEY || event.key === SIMPLE_DISPLAY_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', changed);
  return () => { listeners.delete(listener); window.removeEventListener('storage', changed); };
}

export const useReadingSize = () => useSyncExternalStore(subscribe, getReadingSize, () => 'standard' as ReadingSize);
export const useSimpleDisplay = () => useSyncExternalStore(subscribe, getSimpleDisplay, () => false);

/** A shared link (?reading=large|extra-large, ?simple=1|0) becomes this reader's saved choice; otherwise the saved one applies. */
export function initializeReadingSize() {
  const query = new URLSearchParams(window.location.search);
  const reading = query.get('reading');
  if (reading === 'large' || reading === 'extra-large') setReadingSize(reading);
  else applyReadingSize(getReadingSize());
  const simple = query.get('simple');
  if (simple === '1' || simple === '0') setSimpleDisplay(simple === '1');
  else applySimpleDisplay(getSimpleDisplay());
}

/** The "发给家人" form of a link: it opens at 特大 with 简洁显示 on (product.md §5 family links). Hash and other parameters are kept. */
export function withFamilyReading(url: string): string {
  const hashAt = url.indexOf('#');
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const params = new URLSearchParams(queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '');
  params.set('reading', 'extra-large');
  params.set('simple', '1');
  return `${path}?${params.toString()}${hash}`;
}
