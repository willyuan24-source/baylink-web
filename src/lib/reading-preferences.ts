import { useSyncExternalStore } from 'react';

export type ReadingSize = 'standard' | 'large' | 'extra-large';
export const READING_SIZE_KEY = 'baylink.reading-size.v1';
let sessionSize: ReadingSize = 'standard';
let sessionOnly = false;
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

function subscribe(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => {
    if (event.key === READING_SIZE_KEY || event.key === null) { sessionOnly = false; applyReadingSize(getReadingSize()); listener(); }
  };
  window.addEventListener('storage', changed);
  return () => { listeners.delete(listener); window.removeEventListener('storage', changed); };
}

export const useReadingSize = () => useSyncExternalStore(subscribe, getReadingSize, () => 'standard' as ReadingSize);

export function initializeReadingSize() {
  const query = new URLSearchParams(window.location.search).get('reading');
  if (query === 'large' || query === 'extra-large') setReadingSize(query);
  else applyReadingSize(getReadingSize());
}
