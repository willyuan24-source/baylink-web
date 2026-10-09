import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { api } from './api';
import { getStoredUser } from './session';
import { canonicalEventId } from './event-id';
import { recordProductEvent } from './product-events';
import { toggleSavedPost, useSavedPosts, type SavedPost } from './savedPosts';
import { useApp } from '../app/context';

/**
 * The one save model (plan D19, gate G15): ♡ 收藏 for events, places, guides, offers, openings and neighbourhood posts.
 *
 *  - Signed in: the account's favorites (`GET /api/planner/me`, `PUT/DELETE /api/planner/favorites/:kind/:id`).
 *    A save the API answers with 404 ITEM_NOT_IN_CATALOG (its catalog copy lags the web, RC-15) stays saved as a
 *    *pending* entry in this browser and is retried later; the ♡ is never lost and no error is shown.
 *  - Guest: one list in this browser. On first use it absorbs the older device lists (the planner's guest favorites
 *    and the reader library's saved guides); those keys are left in place so an older build still finds them.
 *  - Posts have no server kind; they stay in the per-account device list of `savedPosts.ts` and join the same list.
 *
 * Every surface (♡ buttons, My Week, the /me count) reads this store, so a count shown anywhere equals the number of
 * rows in My Week. This module stays free of catalog imports: it is on the home graph through the post ♡.
 */

export const SERVER_SAVE_KINDS = ['event', 'place', 'guide', 'offer', 'opening'] as const;
export type ServerSaveKind = typeof SERVER_SAVE_KINDS[number];
export type SaveKind = ServerSaveKind | 'post';
export type SaveRef = { kind: ServerSaveKind; id: string };
export type PostSnapshot = Omit<SavedPost, 'savedAt'>;
/** Where an entry lives: the account, this browser (guest list or a post), or this browser until the account accepts it. */
export type SaveSource = 'account' | 'device' | 'pending';
export type SavedEntry = { kind: SaveKind; id: string; key: string; source: SaveSource; post?: SavedPost };
export type SaveErrorCode = 'read' | 'write' | 'full' | 'storage' | 'session';
type Copy = { zh: string; en: string };
export const SAVE_ERROR_COPY: Record<SaveErrorCode, Copy> = {
  read: { zh: '暂时读不到账号收藏，请稍后重试。', en: 'Your saved items could not be loaded. Try again shortly.' },
  write: { zh: '暂时没能更新收藏，请重试。', en: 'Your saved items could not be updated. Try again.' },
  full: { zh: '收藏最多 150 项，请先移除一些。', en: 'You can save up to 150 items. Remove some first.' },
  storage: { zh: '浏览器未能保存收藏，请检查存储设置后重试。', en: 'Your browser could not store this. Check its storage settings and try again.' },
  session: { zh: '登录状态已变化，请刷新后重试。', en: 'Your sign-in changed. Refresh and try again.' },
};

export const SAVES_KEY_PREFIX = 'baylink.saves.v1.';
export const savesKey = (userId?: string) => `${SAVES_KEY_PREFIX}${userId ? `user:${encodeURIComponent(userId)}` : 'guest'}`;
/** Legacy device lists absorbed by the guest list on first use. */
export const LEGACY_PLANNER_KEY = 'baylink.planner.guest.v1';
export const LEGACY_READER_KEY = 'baylink.reader-library.v1';
export const MAX_SAVES = 150;
/** A pending save is retried at most this often (and after every fresh account read). */
export const PENDING_RETRY_MS = 15 * 60_000;
const REFRESH_AFTER_MS = 60_000;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/;

const isServerKind = (kind: unknown): kind is ServerSaveKind => typeof kind === 'string' && (SERVER_SAVE_KINDS as readonly string[]).includes(kind);
export const saveKey = (kind: SaveKind, id: string) => `${kind}:${kind === 'event' ? canonicalEventId(id) : id}`;
const validRef = (value: unknown): value is SaveRef => !!value && typeof value === 'object'
  && isServerKind((value as SaveRef).kind) && typeof (value as SaveRef).id === 'string' && ID.test((value as SaveRef).id);
const keyOf = (ref: SaveRef) => saveKey(ref.kind, ref.id);

type LocalEntry = SaveRef & { savedAt: number; triedAt?: number };
type Slot = {
  owner: string;
  userId?: string;
  /** Guests are always ready; an account is ready after its first successful read. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  account: SaveRef[];
  /** Guest: the whole list. Signed in: pending saves only. Newest first. */
  local: LocalEntry[];
  /** The stored text `local` was parsed from; null when nothing is stored. */
  raw: string | null;
  /** The last device write failed: keep the list for this visit and stop reading storage over it. */
  sessionOnly: boolean;
  /** Keys with a write in flight. */
  busy: readonly string[];
  loadedAt: number;
};

const ownerOf = (userId?: string) => userId ? `user:${userId}` : 'guest';
const slots = new Map<string, Slot>();
const errors = new Map<string, SaveErrorCode>();
const listeners = new Set<() => void>();
const reads = new Map<string, Promise<AccountLibrary>>();
let watching = false;
const now = () => Date.now();

function emit() { listeners.forEach(listener => listener()); }
function put(slot: Slot) { slots.set(slot.owner, slot); emit(); }

function storage(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
function readRaw(userId?: string): string | null { try { return storage()?.getItem(savesKey(userId)) ?? null; } catch { return null; } }
function parseLocal(raw: string | null): LocalEntry[] | null {
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || !Array.isArray(value.items)) return null;
    const seen = new Set<string>();
    return value.items.flatMap((item: unknown) => {
      if (!validRef(item) || seen.has(keyOf(item))) return [];
      seen.add(keyOf(item));
      const entry = item as LocalEntry;
      return [{ kind: entry.kind, id: entry.id, savedAt: Number.isFinite(entry.savedAt) ? entry.savedAt : 0, ...(Number.isFinite(entry.triedAt) ? { triedAt: entry.triedAt } : {}) }];
    }).slice(0, MAX_SAVES);
  } catch { return null; }
}
/** The device lists from before the one save model: planner guest favorites, then the reader library's guides. */
export function legacyGuestSaves(store: Pick<Storage, 'getItem'> | null = storage()): LocalEntry[] {
  const read = (key: string) => { try { return JSON.parse(store?.getItem(key) || 'null'); } catch { return null; } };
  const planner = read(LEGACY_PLANNER_KEY);
  const reader = read(LEGACY_READER_KEY);
  const refs: SaveRef[] = [
    ...(Array.isArray(planner?.favorites) ? planner.favorites.filter(validRef) : []),
    ...(Array.isArray(reader?.saved) ? reader.saved.filter((slug: unknown) => typeof slug === 'string' && /^[a-z0-9-]{1,120}$/.test(slug)).map((id: string) => ({ kind: 'guide' as const, id })) : []),
  ];
  const seen = new Set<string>();
  return refs.filter(ref => !seen.has(keyOf(ref)) && !!seen.add(keyOf(ref))).slice(0, MAX_SAVES).map(({ kind, id }) => ({ kind, id, savedAt: 0 }));
}
/** Write one owner's device list; returns the stored text, or null when the browser refused. */
function writeLocal(userId: string | undefined, local: LocalEntry[]): string | null {
  const raw = JSON.stringify({ v: 1, items: local });
  try { const store = storage(); if (!store) return null; store.setItem(savesKey(userId), raw); return raw; } catch { return null; }
}
function withLocal(slot: Slot, local: LocalEntry[]): Slot {
  const raw = writeLocal(slot.userId, local);
  return { ...slot, local, raw: raw ?? slot.raw, sessionOnly: raw === null };
}

/** The current slot of one owner, re-reading its device list when storage changed underneath (another tab, a reset). */
function slotFor(userId?: string): Slot {
  const owner = ownerOf(userId);
  const existing = slots.get(owner);
  if (typeof window === 'undefined') return existing ?? { ...EMPTY_SLOT, owner, userId, status: userId ? 'idle' : 'ready' };
  const raw = readRaw(userId);
  if (existing && (existing.sessionOnly || raw === existing.raw)) return existing;
  let local = parseLocal(raw);
  let stored = raw;
  if (!local && !userId) {
    // First use on this device: absorb the older guest lists once, then keep using the new key.
    local = legacyGuestSaves();
    stored = writeLocal(undefined, local);
  }
  const slot: Slot = existing
    ? { ...existing, local: local ?? [], raw: stored }
    : { owner, userId, status: userId ? 'idle' : 'ready', account: [], local: local ?? [], raw: stored, sessionOnly: false, busy: [], loadedAt: 0 };
  slots.set(owner, slot);
  return slot;
}
const EMPTY_SLOT: Slot = { owner: 'guest', status: 'ready', account: [], local: [], raw: null, sessionOnly: false, busy: [], loadedAt: 0 };

type AccountLibrary = { favorites?: unknown; plans?: unknown; preferences?: unknown };
const sessionMatches = (userId: string) => getStoredUser()?.id === userId;
const accountRefs = (favorites: unknown): SaveRef[] => Array.isArray(favorites) ? favorites.filter(validRef).map(({ kind, id }) => ({ kind, id })) : [];
const notInCatalog = (error: unknown) => !!error && typeof error === 'object' && (error as { status?: number }).status === 404 && (error as { code?: string }).code === 'ITEM_NOT_IN_CATALOG';

/** Accept the account's favorites (from a read or a write response) and drop pending entries it now holds. */
export function adoptAccountFavorites(userId: string, favorites: unknown) {
  if (!sessionMatches(userId)) return;
  let slot = slotFor(userId);
  const account = accountRefs(favorites);
  const held = new Set(account.map(keyOf));
  const local = slot.local.filter(entry => !held.has(keyOf(entry)));
  if (local.length !== slot.local.length) slot = withLocal(slot, local);
  put({ ...slot, account, status: 'ready', loadedAt: now() });
}

/**
 * One `/api/planner/me` read per account at a time: the planner library and the save store share it. The result
 * refreshes the store's favorites; pending saves are retried after it.
 */
export function loadPlannerAccount(userId: string): Promise<AccountLibrary> {
  const running = reads.get(userId);
  if (running) return running;
  const slot = slotFor(userId);
  if (slot.status !== 'ready') put({ ...slot, status: 'loading' });
  const request = (async () => {
    try {
      const library: AccountLibrary = await api.request('/planner/me');
      if (!sessionMatches(userId)) {
        // The account changed while reading: keep nothing, and let the next mount for this account read again.
        const current = slotFor(userId);
        if (current.status !== 'ready') put({ ...current, status: 'idle' });
        return library;
      }
      adoptAccountFavorites(userId, library?.favorites);
      void retryPending(userId);
      return library;
    } catch (error) {
      // A failed re-read keeps the list that was already confirmed.
      const current = slotFor(userId);
      if (current.status !== 'ready') put({ ...current, status: 'error' });
      throw error;
    } finally { reads.delete(userId); }
  })();
  reads.set(userId, request);
  return request;
}

async function retryPending(userId: string) {
  const due = slotFor(userId).local.filter(entry => !entry.triedAt || now() - entry.triedAt >= PENDING_RETRY_MS);
  for (const entry of due) {
    if (!sessionMatches(userId)) return;
    try {
      const result = await api.request(`/planner/favorites/${entry.kind}/${encodeURIComponent(entry.id)}`, { method: 'PUT' });
      adoptAccountFavorites(userId, result?.favorites);
    } catch {
      // Still unknown to the account (or offline): keep the device save and try again later.
      const slot = slotFor(userId);
      put(withLocal(slot, slot.local.map(item => keyOf(item) === keyOf(entry) ? { ...item, triedAt: now() } : item)));
    }
  }
}

function watchWindow() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  const revalidate = () => {
    if (document.visibilityState === 'hidden') return;
    const userId = getStoredUser()?.id;
    const slot = userId ? slots.get(ownerOf(userId)) : undefined;
    if (userId && slot?.status === 'ready' && now() - slot.loadedAt >= REFRESH_AFTER_MS) void loadPlannerAccount(userId).catch(() => {});
  };
  window.addEventListener('focus', revalidate);
  document.addEventListener('visibilitychange', revalidate);
  window.addEventListener('storage', event => {
    if (event.key !== null && !event.key.startsWith(SAVES_KEY_PREFIX)) return;
    for (const [owner, slot] of slots) slots.set(owner, { ...slot, sessionOnly: false, raw: '\u0000' });
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  watchWindow();
  return () => { listeners.delete(listener); };
}

/** Server rendering never reads a browser list: a guest list is empty and an account list unknown. */
const serverSlots = new Map<string, Slot>();
function serverSlot(userId?: string): Slot {
  const owner = ownerOf(userId);
  if (!serverSlots.has(owner)) serverSlots.set(owner, { ...EMPTY_SLOT, owner, userId, status: userId ? 'idle' : 'ready' });
  return serverSlots.get(owner)!;
}

function useSlot(userId?: string): Slot {
  const owner = ownerOf(userId);
  const slot = useSyncExternalStore(subscribe, () => slotFor(userId), () => serverSlot(userId));
  useEffect(() => {
    if (userId && slots.get(owner)?.status === 'idle') void loadPlannerAccount(userId).catch(() => {});
  }, [owner, userId]);
  return slot;
}

/** Whether the list is known: a signed-in list is unknown until the account has been read once. */
const known = (slot: Slot) => !slot.userId || slot.status === 'ready';

/** One owner's list in display order: device and pending saves (newest first), the account's (newest first), then posts. */
function entriesOf(slot: Slot, posts: readonly SavedPost[]): SavedEntry[] {
  const entries: SavedEntry[] = [];
  const seen = new Set<string>();
  const add = (entry: SavedEntry) => { if (!seen.has(entry.key)) { seen.add(entry.key); entries.push(entry); } };
  const deviceSource: SaveSource = slot.userId ? 'pending' : 'device';
  for (const entry of slot.local) add({ kind: entry.kind, id: entry.id, key: keyOf(entry), source: deviceSource });
  if (known(slot)) for (const ref of [...slot.account].reverse()) add({ kind: ref.kind, id: ref.id, key: keyOf(ref), source: 'account' });
  for (const post of posts) add({ kind: 'post', id: post.id, key: saveKey('post', post.id), source: 'device', post });
  return entries;
}

/** `pending`: saved in this browser until the account accepts it (RC-15). */
export type SaveOutcome = { saved: boolean; persisted: boolean; pending?: boolean };
type ToggleResult = SaveOutcome | { error: SaveErrorCode };
async function toggleServer(userId: string | undefined, ref: SaveRef): Promise<ToggleResult> {
  const owner = ownerOf(userId);
  const slot = slotFor(userId);
  const key = keyOf(ref);
  if (slot.busy.includes(key)) return { error: 'write' };
  const inAccount = slot.account.some(item => keyOf(item) === key);
  const inLocal = slot.local.some(item => keyOf(item) === key);
  const saving = !inAccount && !inLocal;
  if (!userId) {
    if (saving && slot.local.length >= MAX_SAVES) return { error: 'full' };
    const next = withLocal(slot, saving ? [{ ...ref, savedAt: now() }, ...slot.local] : slot.local.filter(item => keyOf(item) !== key));
    put(next);
    if (saving) recordProductEvent('favorite_saved');
    return { saved: saving, persisted: !next.sessionOnly };
  }
  if (!known(slot)) return { error: 'read' };
  if (!sessionMatches(userId)) return { error: 'session' };
  if (saving && slot.account.length + slot.local.length >= MAX_SAVES) return { error: 'full' };
  const release = () => { const current = slotFor(userId); put({ ...current, busy: current.busy.filter(item => item !== key) }); };
  if (!saving && !inAccount) {
    // Only a pending device save: nothing to delete on the account.
    const next = withLocal(slot, slot.local.filter(item => keyOf(item) !== key));
    put(next);
    return { saved: false, persisted: !next.sessionOnly };
  }
  // Optimistic: the ♡ changes now; a failure restores the confirmed state.
  const before = { account: slot.account, local: slot.local };
  const account = saving ? [...slot.account, ref] : slot.account.filter(item => keyOf(item) !== key);
  put({ ...slot, account, local: slot.local.filter(item => keyOf(item) !== key), busy: [...slot.busy, key] });
  try {
    const result = await api.request(`/planner/favorites/${ref.kind}/${encodeURIComponent(ref.id)}`, { method: saving ? 'PUT' : 'DELETE' });
    release();
    if (!sessionMatches(userId)) return { error: 'session' };
    adoptAccountFavorites(userId, result?.favorites);
    if (inLocal) { const current = slotFor(userId); put(withLocal(current, current.local.filter(item => keyOf(item) !== key))); }
    if (saving) recordProductEvent('favorite_saved');
    return { saved: saving, persisted: true };
  } catch (error) {
    const current = slotFor(userId);
    const busy = current.busy.filter(item => item !== key);
    if (saving && notInCatalog(error) && sessionMatches(userId)) {
      // RC-15: the account's catalog copy has not caught up with this item yet. Keep it saved here; retry later.
      const next = withLocal({ ...current, account: current.account.filter(item => keyOf(item) !== key), busy },
        [{ ...ref, savedAt: now(), triedAt: now() }, ...current.local.filter(item => keyOf(item) !== key)]);
      put(next);
      recordProductEvent('favorite_saved');
      return { saved: true, persisted: !next.sessionOnly, pending: true };
    }
    put({ ...current, ...before, busy });
    return { error: owner === ownerOf(getStoredUser()?.id) ? 'write' : 'session' };
  }
}

/** Toggle one item outside a component (the planner's catalog ♡). Prefer `useSave` in components. */
export const toggleSave = (userId: string | undefined, ref: SaveRef): Promise<ToggleResult> => toggleServer(userId, { kind: ref.kind, id: ref.id });

export type SaveState = {
  /** null while a signed-in list has not been read (an unread item is never called "not saved"). */
  saved: boolean | null;
  busy: boolean;
  /** Saved in this browser only, until the account accepts it (RC-15). */
  pending: boolean;
  error: SaveErrorCode | null;
  /** The signed-in list could not be read; `retry` reads it again. */
  readError: boolean;
  /** False when the last change could only be kept for this visit. */
  persisted: boolean;
  toggle: () => Promise<SaveOutcome | undefined>;
  /** Re-read a signed-in list after a failed read. */
  retry: () => void;
};

/**
 * ♡ state and toggle for one item. The owner is the signed-in user from the app context unless `userId` is given
 * (null = guest). A post needs `post`: the public display fields kept in the device list.
 */
export function useSave(kind: SaveKind, id: string, options: { userId?: string | null; post?: PostSnapshot } = {}): SaveState {
  const app = useApp();
  const userId = ('userId' in options ? options.userId : app?.user?.id) || undefined;
  const slot = useSlot(userId);
  const posts = useSavedPosts(userId);
  const key = saveKey(kind, id);
  const errorKey = `${slot.owner}|${key}`;
  const error = useSyncExternalStore(subscribe, () => errors.get(errorKey) ?? null, () => null);
  const isPost = kind === 'post';
  const saved = isPost ? posts.some(post => post.id === id) : known(slot) ? entriesOf(slot, []).some(entry => entry.key === key) : null;
  const setError = (code: SaveErrorCode | null) => { if (code) errors.set(errorKey, code); else errors.delete(errorKey); emit(); };
  const toggle = async () => {
    if (isPost) {
      const snapshot = options.post || posts.find(post => post.id === id);
      if (!snapshot) { setError('storage'); return undefined; }
      let result: { saved: boolean; error: string | null };
      try { result = toggleSavedPost(window.localStorage, userId, snapshot); } catch { result = { saved: false, error: 'storage' }; }
      if (result.error) { setError(result.error.includes('已满') ? 'full' : 'storage'); return undefined; }
      setError(null);
      if (result.saved) recordProductEvent('favorite_saved');
      return { saved: result.saved, persisted: true };
    }
    if (!isServerKind(kind)) return undefined;
    const result = await toggleServer(userId, { kind, id });
    if ('error' in result) { setError(result.error); return undefined; }
    setError(null);
    return result;
  };
  return {
    saved, error, toggle,
    pending: !isPost && !!userId && slot.local.some(entry => keyOf(entry) === key),
    readError: !isPost && !!userId && slot.status === 'error',
    busy: !isPost && (slot.busy.includes(key) || (!!userId && slot.status === 'loading')),
    persisted: isPost || !slot.sessionOnly,
    retry: () => { if (userId) void loadPlannerAccount(userId).catch(() => {}); },
  };
}

export type SavedList = {
  entries: SavedEntry[];
  /** null while a signed-in list is unknown (still loading, or the read failed). */
  count: number | null;
  status: Slot['status'];
  /** False when the guest list could only be kept for this visit. */
  persisted: boolean;
  busyKeys: readonly string[];
  retry: () => void;
  remove: (entry: SavedEntry) => Promise<boolean>;
};

/** The whole list of one owner (default: the signed-in user from the app context), as My Week renders it. */
export function useSavedEntries(userId?: string | null): SavedList {
  const app = useApp();
  const owner = (userId === undefined ? app?.user?.id : userId) || undefined;
  const slot = useSlot(owner);
  const posts = useSavedPosts(owner);
  const entries = useMemo(() => entriesOf(slot, posts), [slot, posts]);
  const retry = useCallback(() => { if (owner) void loadPlannerAccount(owner).catch(() => {}); }, [owner]);
  const remove = useCallback(async (entry: SavedEntry) => {
    if (entry.kind === 'post') {
      if (!entry.post) return false;
      try { return !toggleSavedPost(window.localStorage, owner, entry.post).error; } catch { return false; }
    }
    const result = await toggleServer(owner, { kind: entry.kind, id: entry.id });
    return !('error' in result) && !result.saved;
  }, [owner]);
  return { entries, count: known(slot) ? entries.length : null, status: slot.status, persisted: !slot.sessionOnly, busyKeys: slot.busy, retry, remove };
}

/** The saved-item count for the /me tile (WEB-ACCOUNT); always the number of rows My Week shows. null = not known yet. */
export function useSavedCount(userId?: string | null): number | null {
  return useSavedEntries(userId).count;
}

/** Guest saves that can move into an account (posts stay device-only). */
export function guestServerSaves(): SaveRef[] {
  return slotFor(undefined).local.map(({ kind, id }) => ({ kind, id }));
}

/**
 * Move the guest list into the signed-in account (the explicit import on My Week). Each imported item leaves the
 * guest list; an item the account does not know yet becomes a pending save of the account. Other errors are thrown
 * and the remaining items stay for a retry.
 */
export async function importGuestSaves(userId: string): Promise<void> {
  for (const ref of guestServerSaves()) {
    if (!sessionMatches(userId)) throw { error: SAVE_ERROR_COPY.session.zh };
    try {
      const result = await api.request(`/planner/favorites/${ref.kind}/${encodeURIComponent(ref.id)}`, { method: 'PUT' });
      adoptAccountFavorites(userId, result?.favorites);
    } catch (error) {
      if (!notInCatalog(error)) throw error;
      const slot = slotFor(userId);
      if (!slot.local.some(item => keyOf(item) === keyOf(ref))) put(withLocal(slot, [{ ...ref, savedAt: now(), triedAt: now() }, ...slot.local]));
    }
    const guest = slotFor(undefined);
    put(withLocal(guest, guest.local.filter(item => keyOf(item) !== keyOf(ref))));
  }
}

/** Test hook: forget every slot and pending read so the next access starts from storage. */
export function resetSaveStore() { slots.clear(); reads.clear(); errors.clear(); emit(); }
