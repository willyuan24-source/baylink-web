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
  forgetFamilyLink(0);
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
  forgetFamilyLink(1);
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

/**
 * G52 / CW-06: a family link (?reading=large|extra-large, ?simple=1|0). public/reading-init.js removes it from the address
 * bar before the first paint and hands it over in sessionStorage as "size|simple" (FAMILY_LINK_KEY). A reader with no saved
 * choice keeps the link's choice (it is saved and the hand-over is cleared); a reader who already chose a size or 简洁显示
 * gets the link for this visit only (this tab, reloads included) and keeps their own choice for later visits. Choosing in
 * the Aa sheet ends the visit's link for that setting.
 */
export const FAMILY_LINK_KEY = 'baylink.reading-link.v1';
type FamilyLink = [size: string, simple: string];

function session(action: (storage: Storage) => string | null | void): string | null {
  try { return action(window.sessionStorage) ?? null; } catch { return null; }
}

/** Drop one part of the visit's link (0 = size, 1 = 简洁显示) once the reader chooses that setting themselves. */
function forgetFamilyLink(part: 0 | 1) {
  if (typeof window === 'undefined') return;
  const stored = session(storage => storage.getItem(FAMILY_LINK_KEY));
  if (stored === null) return;
  const link = stored.split('|') as FamilyLink;
  link[part] = '';
  session(storage => link.join('') ? storage.setItem(FAMILY_LINK_KEY, link.join('|')) : storage.removeItem(FAMILY_LINK_KEY));
}

function hasSavedChoice(): boolean {
  try { return window.localStorage.getItem(READING_SIZE_KEY) !== null || window.localStorage.getItem(SIMPLE_DISPLAY_KEY) !== null; }
  catch { return false; }
}

/** The link, from the address bar when reading-init could not take it out (storage blocked, no reading-init), else the hand-over. */
function takeFamilyLink(): FamilyLink | null {
  const url = new URL(window.location.href);
  if (url.searchParams.has('reading') || url.searchParams.has('simple')) {
    const link: FamilyLink = [url.searchParams.get('reading') || '', url.searchParams.get('simple') || ''];
    url.searchParams.delete('reading'); url.searchParams.delete('simple');
    try { window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); } catch { /* the link still applies */ }
    session(storage => storage.setItem(FAMILY_LINK_KEY, link.join('|')));
    return link;
  }
  const stored = session(storage => storage.getItem(FAMILY_LINK_KEY));
  return stored === null ? null : stored.split('|') as FamilyLink;
}

/** At boot: apply a family link (see FAMILY_LINK_KEY) or the saved choice. */
export function initializeReadingSize() {
  const link = takeFamilyLink();
  const size = link && (link[0] === 'large' || link[0] === 'extra-large') ? link[0] : null;
  const simple = link && (link[1] === '1' || link[1] === '0') ? link[1] === '1' : null;
  if (link && !size && simple === null) session(storage => storage.removeItem(FAMILY_LINK_KEY));
  else if (link && !hasSavedChoice()) {
    // No choice of their own yet: the link's choice becomes theirs, as before G52.
    if (size) setReadingSize(size);
    if (simple !== null) setSimpleDisplay(simple);
    session(storage => storage.removeItem(FAMILY_LINK_KEY));
  } else if (link) {
    if (size) { sessionSize = size; sessionOnly = true; }
    if (simple !== null) { sessionSimple = simple; simpleSessionOnly = true; }
    listeners.forEach(listener => listener());
  }
  applyReadingSize(getReadingSize());
  applySimpleDisplay(getSimpleDisplay());
}

// Lives in its own module so the boot bundle (this file) does not carry it; the guide and detail pages import it there.
export { withFamilyReading } from './family-reading';
