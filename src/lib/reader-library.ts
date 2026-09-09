import { useMemo, useSyncExternalStore } from 'react';

export const READER_LIBRARY_KEY = 'baylink.reader-library.v1';
export type ReaderLibrary = { saved: string[]; recent: string[] };
const EMPTY = '{"saved":[],"recent":[]}';
let fallback = EMPTY;
let sessionOnly = false;
const listeners = new Set<() => void>();
const safeSlugs = (value: unknown, limit: number): string[] => Array.isArray(value)
  ? [...new Set(value.filter((slug): slug is string => typeof slug === 'string' && /^[a-z0-9-]{1,120}$/.test(slug)))].slice(0, limit)
  : [];

export function parseReaderLibrary(raw: string | null): ReaderLibrary {
  try {
    const value = JSON.parse(raw || EMPTY);
    return { saved: safeSlugs(value?.saved, 80), recent: safeSlugs(value?.recent, 12) };
  } catch { return { saved: [], recent: [] }; }
}

function snapshot(): string {
  if (typeof window === 'undefined') return EMPTY;
  if (sessionOnly) return fallback;
  try { return window.localStorage.getItem(READER_LIBRARY_KEY) || EMPTY; }
  catch { return fallback; }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === READER_LIBRARY_KEY || event.key === null) { sessionOnly = false; listener(); }
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

function write(library: ReaderLibrary): boolean {
  const raw = JSON.stringify(library);
  let persisted = false;
  try { window.localStorage.setItem(READER_LIBRARY_KEY, raw); persisted = true; } catch { /* Session-only fallback. */ }
  fallback = raw;
  sessionOnly = !persisted;
  listeners.forEach(listener => listener());
  return persisted;
}

export function toggleSavedGuide(slug: string) {
  const library = parseReaderLibrary(snapshot());
  const saved = !library.saved.includes(slug);
  library.saved = saved ? safeSlugs([slug, ...library.saved], 80) : library.saved.filter(item => item !== slug);
  return { saved, persisted: write(library) };
}

export function rememberGuide(slug: string) {
  const library = parseReaderLibrary(snapshot());
  if (library.recent[0] === slug) return;
  library.recent = safeSlugs([slug, ...library.recent], 12);
  write(library);
}

export function clearReadingHistory() {
  const library = parseReaderLibrary(snapshot());
  return write({ ...library, recent: [] });
}

export function useReaderLibrary() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return useMemo(() => parseReaderLibrary(raw), [raw]);
}
