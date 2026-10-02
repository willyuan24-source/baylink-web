/**
 * Wave 9 · lane R (W9-R1) · the travel profile (review R§5 #12, idea 9 "出行档案"): the three answers of 这周去哪 (who
 * with, what vibe, which part of town) kept across visits in their own key, so the recommendations, today's three small
 * things and the cards' emphasis (senior prices, kid games) can follow them. Contract (sf-w9-lead.md §4):
 *
 *   getPrefs()               the stored answers + the derived profile (never throws; defaults when storage is blocked)
 *   setPrefs(patch)          merge, derive the profile from `companions`, store, notify; returns the new prefs
 *   subscribePrefs(fn)       re-render hooks (useSyncExternalStore(subscribePrefs, getPrefs))
 *   profileOf(companions)    带娃 → 'kids', 带长辈 → 'seniors', 自己 → 'solo', 约会 → 'pair'; 和朋友 → null
 *
 * Its own localStorage key `opus-bay:prefs:v1` (no save bit, no save version: a missing / unreadable value is the
 * defaults); `?save=off` or a blocked storage keeps the prefs for this page only. Nothing personal: three chip values
 * from a fixed list and a Bay date.
 */

export type TravelProfile = 'kids' | 'seniors' | 'solo' | 'pair';

export interface TravelPrefs {
  /** 这周去哪 · 和谁: 'solo' | 'friends' | 'date' | 'kids' | 'seniors' */
  companions: string | null;
  /** 这周去哪 · 感觉: 'free' | 'food' | 'outdoors' | 'culture' | 'any' */
  vibe: string | null;
  /** 这周去哪 · 哪一带: a region ('sf', 'east-bay' …), a San Francisco area ('sf-north' …) or 'any' */
  region: string | null;
  /** derived from `companions` (null: no special emphasis) */
  profile: TravelProfile | null;
  /** the Bay date of the last answer (YYYY-MM-DD) */
  at: string | null;
}

export const PREFS_KEY = 'opus-bay:prefs:v1';
const VALUE_RE = /^[a-z][a-z-]{0,23}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const EMPTY_PREFS: Readonly<TravelPrefs> = Object.freeze({ companions: null, vibe: null, region: null, profile: null, at: null });

/** 带娃 → kids, 带长辈 → seniors, 自己 → solo, 约会 → pair; 和朋友 (and anything else) → no special emphasis. */
export function profileOf(companions: string | null | undefined): TravelProfile | null {
  switch (companions) {
    case 'kids': return 'kids';
    case 'seniors': return 'seniors';
    case 'solo': return 'solo';
    case 'date': return 'pair';
    default: return null;
  }
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): Store | null {
  try {
    if (typeof location !== 'undefined' && /[?&]save=off(?:&|$)/.test(location.search ?? '')) return null;
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch { return null; }
}

const clean = (v: unknown): string | null => (typeof v === 'string' && VALUE_RE.test(v) ? v : null);

/** Parse a stored value (untrusted): unknown fields dropped, bad values null. */
export function parsePrefs(raw: string | null | undefined): TravelPrefs {
  if (!raw) return { ...EMPTY_PREFS };
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== 'object') return { ...EMPTY_PREFS };
    const companions = clean(v.companions);
    return {
      companions,
      vibe: clean(v.vibe),
      region: clean(v.region),
      profile: profileOf(companions),
      at: typeof v.at === 'string' && DAY_RE.test(v.at) ? v.at : null,
    };
  } catch { return { ...EMPTY_PREFS }; }
}

let storage: Store | null | undefined;
let current: TravelPrefs | null = null;
const listeners = new Set<() => void>();

const store = (): Store | null => (storage === undefined ? (storage = defaultStorage()) : storage);

/** The stored travel prefs (the same object until they change: safe for useSyncExternalStore). */
export function getPrefs(): TravelPrefs {
  if (current) return current;
  let raw: string | null;
  try { raw = store()?.getItem(PREFS_KEY) ?? null; } catch { raw = null; }
  current = parsePrefs(raw);
  return current;
}

/** Merge answers in (the profile follows `companions`), store them, notify. Unknown / malformed values are ignored. */
export function setPrefs(patch: Partial<Pick<TravelPrefs, 'companions' | 'vibe' | 'region' | 'at'>>): TravelPrefs {
  const prev = getPrefs();
  const next: TravelPrefs = { ...prev };
  for (const key of ['companions', 'vibe', 'region'] as const) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (v === null) next[key] = null;
    else { const c = clean(v); if (c) next[key] = c; }
  }
  if (patch.at !== undefined) next.at = typeof patch.at === 'string' && DAY_RE.test(patch.at) ? patch.at : prev.at;
  next.profile = profileOf(next.companions);
  if (next.companions === prev.companions && next.vibe === prev.vibe && next.region === prev.region && next.at === prev.at) return prev;
  current = next;
  try { store()?.setItem(PREFS_KEY, JSON.stringify({ companions: next.companions, vibe: next.vibe, region: next.region, at: next.at })); } catch { /* blocked / full: this page only */ }
  for (const fn of listeners) fn();
  return next;
}

// ---------------------------------------------------------------------------
// W9-R-review R-RC-1 · the profile today's three were picked with. Their completion is paid by slot (daily:<date>:<n>),
// so once one is paid the day's pick must not change on a reload with a new profile (the paid slot would point at
// another task: one never done shown ticked, the one done paid again). Its own key: { day, profile } of the last pick.
// ---------------------------------------------------------------------------

export const DAILY_PIN_KEY = 'opus-bay:daily-pick:v1';
const PROFILES: readonly string[] = ['kids', 'seniors', 'solo', 'pair'];
let pin: { day: string; profile: TravelProfile | null } | null | undefined;

function readPin(): { day: string; profile: TravelProfile | null } | null {
  if (pin !== undefined) return pin;
  pin = null;
  try {
    const v = JSON.parse(store()?.getItem(DAILY_PIN_KEY) ?? 'null') as Record<string, unknown> | null;
    if (v && typeof v.day === 'string' && DAY_RE.test(v.day)) pin = { day: v.day, profile: typeof v.profile === 'string' && PROFILES.includes(v.profile) ? v.profile as TravelProfile : null };
  } catch { /* unreadable: no pin */ }
  return pin;
}

/** The profile today's three of `day` were picked with (undefined: none recorded for that day). */
export function dailyProfilePin(day: string): TravelProfile | null | undefined {
  const p = readPin();
  return p && p.day === day ? p.profile : undefined;
}

/** Record the profile the three of `day` were picked with. */
export function pinDailyProfile(day: string, profile: TravelProfile | null): void {
  const p = readPin();
  if (p && p.day === day && p.profile === profile) return;
  pin = { day, profile };
  try { store()?.setItem(DAILY_PIN_KEY, JSON.stringify(pin)); } catch { /* blocked / full: this page only */ }
}

/** Re-render when the prefs change. */
export function subscribePrefs(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Tests: start over with a given storage (null: memory only) and forget the cached value. */
export function __resetPrefsForTests(s: Store | null = null): void { storage = s; current = null; pin = undefined; }
