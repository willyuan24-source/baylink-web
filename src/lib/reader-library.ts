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

// Saving a guide is the one save model now (src/lib/saves.ts), which read `saved` once on first use. This store keeps
// only the reading history; `saved` is still parsed and written back unchanged so an older build finds its list.

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

/**
 * The reading history only. The older `saved` list stays in storage for a rollback but is not returned: every count
 * of saved items comes from the one save model (`useSavedCount` / `useSavedEntries` in src/lib/saves.ts), so a guide
 * removed there can never be counted again from here.
 */
export function useReaderLibrary(): Pick<ReaderLibrary, 'recent'> {
  const raw = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return useMemo(() => ({ recent: parseReaderLibrary(raw).recent }), [raw]);
}
