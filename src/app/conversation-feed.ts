import { useEffect, useSyncExternalStore } from 'react';
import { api } from '../lib/api';
import type { UserData } from '../lib/types';

/**
 * One /conversations poll for the whole app (G91 / CW-08). The unread badge (useUnreadMessages, every 30 s) and the inbox
 * (MessagesList, every 15 s while it is open) read the same list: one request at the shortest interval anyone needs, one
 * request in flight at a time, and a resume (tab shown, focus, back online, a message read or sent) refreshes once for
 * both instead of once each. A refresh is skipped while the page is hidden or the browser says it is offline. A failed
 * refresh keeps the last list (`failed` says the newest attempt did not land), so the inbox can say so quietly instead
 * of replacing a working list with an error.
 */
export type ConversationFeed = {
  /** `${user.id}:${user.token}` (conversationIdentity); '' when signed out. */
  identity: string;
  /** The last list the server returned for this identity; null until the first answer. */
  rows: unknown[] | null;
  /** The newest attempt failed; `rows` (if any) are from the last success. */
  failed: boolean;
  /** The browser reported no connection at the newest attempt. */
  offline: boolean;
  /** No answer yet for this identity. */
  loading: boolean;
};

/** The signed-in reader and session (the request itself carries the stored session); a new token is a new list. */
export const conversationIdentity = (user: Pick<UserData, 'id' | 'token'> | null | undefined): string =>
  user?.id ? `${user.id}:${user.token || ''}` : '';

const EMPTY: ConversationFeed = { identity: '', rows: null, failed: false, offline: false, loading: false };
let state: ConversationFeed = EMPTY;
const listeners = new Set<() => void>();
/** Each mounted reader and the interval it asks for. */
const readers = new Map<symbol, number>();
let controller = new AbortController();
let generation = 0;
let running = false;
let queued = false;
let timer: ReturnType<typeof setInterval> | undefined;
let detachEvents: (() => void) | undefined;

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
function update(next: Partial<ConversationFeed>) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}

/** Ask for a fresh list now (deduplicated with a request already in flight). */
export function refreshConversations(): void {
  if (!state.identity || typeof document === 'undefined' || document.visibilityState === 'hidden') return;
  if (isOffline()) { update({ offline: true, loading: false }); return; }
  if (running) { queued = true; return; }
  running = true;
  const round = generation;
  const { signal } = controller;
  void (async () => {
    try {
      const rows: unknown = await api.request('/conversations', { signal });
      if (round !== generation) return;
      if (!Array.isArray(rows)) throw new Error('Unexpected conversation list response');
      update({ rows, failed: false, offline: false, loading: false });
    } catch {
      if (round === generation) update({ failed: true, offline: isOffline(), loading: false });
    } finally {
      if (round === generation) {
        running = false;
        if (queued) { queued = false; refreshConversations(); }
      }
    }
  })();
}

/** A new account or session: forget the old list and cancel its request (a late answer can never show it). */
function reset(identity: string) {
  controller.abort();
  controller = new AbortController();
  generation += 1;
  running = false;
  queued = false;
  update({ ...EMPTY, identity, loading: !!identity });
}

function schedule() {
  if (timer !== undefined) clearInterval(timer);
  timer = readers.size ? setInterval(refreshConversations, Math.min(...readers.values())) : undefined;
}

function attachEvents() {
  const refresh = () => refreshConversations();
  const wentOffline = () => update({ offline: true });
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', wentOffline);
  window.addEventListener('baylink:messages-read', refresh);
  window.addEventListener('baylink:messages-changed', refresh);
  return () => {
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', wentOffline);
    window.removeEventListener('baylink:messages-read', refresh);
    window.removeEventListener('baylink:messages-changed', refresh);
  };
}

/** Join the poll as one reader; returns the leave function. The newest identity wins (both readers share the session). */
function join(identity: string, interval: number): () => void {
  const reader = Symbol('conversation reader');
  if (identity !== state.identity) reset(identity);
  readers.set(reader, interval);
  detachEvents ||= attachEvents();
  schedule();
  refreshConversations();
  return () => {
    readers.delete(reader);
    if (readers.size) { schedule(); return; }
    detachEvents?.();
    detachEvents = undefined;
    schedule();
    reset('');
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The shared conversation list for this identity, polled every `interval` ms (or faster when another reader asks). */
export function useConversationFeed(identity: string, interval: number): ConversationFeed {
  useEffect(() => identity ? join(identity, interval) : undefined, [identity, interval]);
  const snapshot = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  return snapshot.identity === identity ? snapshot : { ...EMPTY, identity, loading: !!identity };
}
