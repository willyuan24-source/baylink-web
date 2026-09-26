import { emit } from '../core/events';
import { game, type GameState } from '../core/store';
import type { WishItem } from '../core/types';

/**
 * Local-only persistence: the "想去" wishlist and game progress. Everything is wrapped so a blocked,
 * full or missing localStorage never breaks the game (private windows, thumbnails, tests).
 */

export const WISHLIST_KEY = 'opus-bay:wishlist:v1';
export const PROGRESS_KEY = 'opus-bay:progress:v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
let storageOverride: StorageLike | null | undefined;

/** Tests inject a fake storage; `undefined` restores the real one. */
export function setStorageForTests(storage: StorageLike | null | undefined) { storageOverride = storage; }

function storage(): StorageLike | null {
  if (storageOverride !== undefined) return storageOverride;
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

function readJson<T>(key: string): T | null {
  try { const raw = storage()?.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function writeJson(key: string, value: unknown) {
  try { storage()?.setItem(key, JSON.stringify(value)); } catch { /* quota / blocked: ignore */ }
}

const KINDS = new Set<WishItem['kind']>(['place', 'event', 'poi', 'guide']);
const validItem = (item: unknown): item is WishItem => {
  const it = item as WishItem;
  return !!it && typeof it === 'object' && KINDS.has(it.kind) && typeof it.id === 'string' && it.id.length > 0 && it.id.length < 200 && typeof it.title === 'string';
};

export function readWishlist(): WishItem[] {
  const raw = readJson<unknown>(WISHLIST_KEY);
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: unknown[] }).items : []);
  const seen = new Set<string>();
  return list.filter(validItem).filter(item => { const key = `${item.kind}:${item.id}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 100)
    .map(item => ({ kind: item.kind, id: item.id, title: item.title.slice(0, 200), addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString() }));
}

function commit(items: WishItem[]) {
  game.set({ wishlist: items });
  writeJson(WISHLIST_KEY, { v: 1, items });
}

export const wishlist = {
  has(kind: WishItem['kind'], id: string) { return game.get().wishlist.some(item => item.kind === kind && item.id === id); },
  add(item: Omit<WishItem, 'addedAt'> & { addedAt?: string }) {
    if (!validItem({ ...item, addedAt: '' }) || wishlist.has(item.kind, item.id)) return false;
    commit([...game.get().wishlist, { ...item, addedAt: item.addedAt ?? new Date().toISOString() }]);
    emit({ type: 'wish', added: true });
    return true;
  },
  remove(kind: WishItem['kind'], id: string) {
    const items = game.get().wishlist;
    const next = items.filter(item => !(item.kind === kind && item.id === id));
    if (next.length === items.length) return false;
    commit(next);
    emit({ type: 'wish', added: false });
    return true;
  },
  /** returns the new "is in wishlist" state */
  toggle(item: Omit<WishItem, 'addedAt'>) {
    if (wishlist.has(item.kind, item.id)) { wishlist.remove(item.kind, item.id); return false; }
    wishlist.add(item);
    return true;
  },
  clear() { commit([]); },
};

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type Progress = {
  v: 1;
  postcards: string[];
  goalsDone: string[];
  tour: { stop: number; completed: string[]; finished?: boolean };
  viewpointUnlocked: boolean;
  settings: Partial<GameState['settings']>;
  /** seen the intro once (returning visitors get a shorter welcome) */
  visited?: boolean;
};

const strings = (value: unknown, max = 64) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length < 120) : []).filter((item, i, all) => all.indexOf(item) === i).slice(0, max);

export function readProgress(): Progress | null {
  const raw = readJson<Partial<Progress>>(PROGRESS_KEY);
  if (!raw || typeof raw !== 'object') return null;
  const settings: Partial<GameState['settings']> = {};
  const s = (raw.settings ?? {}) as Record<string, unknown>;
  if (typeof s.sound === 'boolean') settings.sound = s.sound;
  if (typeof s.music === 'boolean') settings.music = s.music;
  if (s.quality === 'low' || s.quality === 'mid' || s.quality === 'high') settings.quality = s.quality;
  if (['auto', 'morning', 'day', 'golden', 'night'].includes(s.timeOfDay as string)) settings.timeOfDay = s.timeOfDay as GameState['settings']['timeOfDay'];
  if (typeof s.reducedMotion === 'boolean') settings.reducedMotion = s.reducedMotion;
  if (typeof s.cameraDistance === 'number' && s.cameraDistance >= 7 && s.cameraDistance <= 30) settings.cameraDistance = s.cameraDistance;
  const tour = (raw.tour ?? {}) as Partial<Progress['tour']>;
  return {
    v: 1,
    postcards: strings(raw.postcards),
    goalsDone: strings(raw.goalsDone),
    tour: { stop: Number.isInteger(tour.stop) && (tour.stop as number) >= 0 ? tour.stop as number : 0, completed: strings(tour.completed), finished: tour.finished === true },
    viewpointUnlocked: raw.viewpointUnlocked === true,
    settings,
    visited: raw.visited === true,
  };
}

/**
 * Settings that apply to this visit only and must not overwrite the saved choice: values forced by the URL
 * (?quality= / ?time= QA links) and automatic changes (the adaptive-quality monitor stepping down on a hitch).
 */
const sessionOnly = new Set<keyof GameState['settings']>();
let savedSettings: Partial<GameState['settings']> = {};

/** Apply settings for this visit only (not saved). */
export function setSessionSettings(patch: Partial<GameState['settings']>) {
  (Object.keys(patch) as (keyof GameState['settings'])[]).forEach(key => sessionOnly.add(key));
  game.set(state => ({ settings: { ...state.settings, ...patch } }));
}
/** The player picked this setting explicitly: save it from now on. */
export function keepSetting(key: keyof GameState['settings']) { sessionOnly.delete(key); }

function persistedSettings(settings: GameState['settings']): Partial<GameState['settings']> {
  if (!sessionOnly.size) return settings;
  const out: Partial<GameState['settings']> = { ...settings };
  for (const key of sessionOnly) {
    if (savedSettings[key] !== undefined) (out as Record<string, unknown>)[key] = savedSettings[key];
    else delete out[key];
  }
  return out;
}

export function snapshotProgress(state: GameState, extra: { finished?: boolean; visited?: boolean } = {}): Progress {
  return {
    v: 1,
    postcards: state.postcards,
    goalsDone: state.goalsDone,
    tour: { stop: state.tour.stop, completed: state.tour.completed, finished: extra.finished },
    viewpointUnlocked: state.viewpointUnlocked,
    settings: persistedSettings(state.settings),
    visited: extra.visited,
  };
}

export function writeProgress(progress: Progress) { writeJson(PROGRESS_KEY, progress); }

export function clearProgress() {
  try { storage()?.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
}

let extras: { finished?: boolean; visited?: boolean } = {};
export function markProgress(patch: { finished?: boolean; visited?: boolean }) {
  extras = { ...extras, ...patch };
  writeProgress(snapshotProgress(game.get(), extras));
}
export const progressExtras = () => extras;

/**
 * Hydrate the store from storage, then save whenever persisted fields change (debounced).
 * `lockedSettings` are settings forced by the URL (e.g. ?quality=low) that must not be overwritten.
 */
export function initPersistence(opts: { lockedSettings?: (keyof GameState['settings'])[] } = {}): () => void {
  const saved = readProgress();
  const items = readWishlist();
  extras = { finished: saved?.tour.finished, visited: saved?.visited };
  savedSettings = { ...(saved?.settings ?? {}) };
  sessionOnly.clear();
  opts.lockedSettings?.forEach(key => sessionOnly.add(key));
  game.set(state => {
    const settings = { ...state.settings };
    if (saved) for (const [key, value] of Object.entries(saved.settings) as [keyof GameState['settings'], never][]) {
      if (!opts.lockedSettings?.includes(key)) (settings as Record<string, unknown>)[key] = value;
    }
    return {
      wishlist: items,
      postcards: saved?.postcards ?? state.postcards,
      goalsDone: saved?.goalsDone ?? state.goalsDone,
      viewpointUnlocked: saved?.viewpointUnlocked ?? state.viewpointUnlocked,
      tour: saved ? { ...state.tour, stop: saved.tour.stop, completed: saved.tour.completed } : state.tour,
      settings,
    };
  });
  let last = game.get();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = game.subscribe(() => {
    const now = game.get();
    if (now.postcards === last.postcards && now.goalsDone === last.goalsDone && now.tour === last.tour && now.viewpointUnlocked === last.viewpointUnlocked && now.settings === last.settings) return;
    last = now;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; writeProgress(snapshotProgress(game.get(), extras)); }, 250);
  });
  return () => {
    unsubscribe();
    if (timer) { clearTimeout(timer); writeProgress(snapshotProgress(game.get(), extras)); }
  };
}
