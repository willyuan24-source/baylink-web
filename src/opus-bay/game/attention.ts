import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Bilingual } from '../core/types';

/**
 * Wave 9 · lane F · W9-F1 — the attention arbiter (review R§5 #5: 7–9 messages on screen at once at the Ferry Building;
 * sf-w9-lead.md §4 "Attention").
 *
 * THE RULE: one message per level on screen at a time, the rest queue, two holders of a level ≥ ATTENTION_GAP_MS apart:
 *
 *   'title'   banners and cards: the toasts (ui/Floating Toasts: one at a time, progress merged into one ribbon), the
 *             arrival card (ui/ArrivalCard, the arrival banner hands over to it), N's stuck / chapter / resume cards,
 *             S's share toast, R's arrival re-open
 *   'action'  what the player can do now: the E prompt, the wait / ride chips, G's game prompts (no gap: an E prompt
 *             follows the focus)
 *   'line'    BAYBAY's bubble + voice (game/cityMoments.ts' pacer asks before it speaks; a dropped bubble never plays
 *             its voice — lane X)
 *
 * LAZY on purpose (GameRoot has ≈ 0.2 KB of static room): only lazy chunks import this module (the play layer, the city
 * guide layer, the city moments). A caller in GameRoot's static graph reaches it through `importRetry(() =>
 * import('./attention'))`; a caller whose module may load before it writes `attention?.requestSlot(...)`.
 *
 *   const slot = requestSlot('title', 'n-stuck', { priority: ATTENTION_PRIORITY.stuck, onGrant: show, onDrop: hide });
 *   if (slot.granted) show();          // else onGrant fires when it is its turn (or onDrop('expired') after maxWaitMs)
 *   …
 *   slot.release();                    // shown and gone (or no longer wanted while waiting)
 *
 * Priorities: a waiter of a HIGHER priority takes a level from its holder once the holder has been up `minMs` (the
 * holder's onDrop('preempted') hides it; no gap after a take-over); equal or lower waits its turn. `firstVisit`: the
 * holder has no timer of its own (the arrival card on a first visit stays until a tap or until the player walks on) —
 * only a higher priority takes the level from it. `absorb`: while this holder is up, title-level toasts are written into
 * its ribbon line (`ribbon()`), not queued behind it (the arrival card's 「今日小事 1/3 · 南瓜灯 1/40 · +10 金币」 row).
 *
 * Pure apart from timers: the clock and the timer are injectable (`setAttentionClockForTests`).
 */

export type AttentionLevel = 'title' | 'action' | 'line';
export const ATTENTION_LEVELS: readonly AttentionLevel[] = ['title', 'action', 'line'];

/** Two holders of one level start at least this far apart (ms) — the queue's breath (review R§5 #5: "≥ 2.5 s"). */
export const ATTENTION_GAP_MS = 2500;
/** The gap per level: the action slot follows the focus (an E prompt for the next door may show at once). */
export const LEVEL_GAP_MS: Readonly<Record<AttentionLevel, number>> = { title: ATTENTION_GAP_MS, action: 0, line: ATTENTION_GAP_MS };
/** A waiter gives up after this long by default (ms): a message about a moment that passed is not shown late. */
export const DEFAULT_MAX_WAIT_MS = 15_000;

/** The priorities the lanes use (higher first). */
export const ATTENTION_PRIORITY = {
  /** a plain toast (info) */
  toast: 0,
  /** a gold / success toast (a goal, an unlock) */
  gold: 1,
  /** the arrival banner (it hands over to the arrival card at once) */
  arrivalBanner: 2,
  /** the arrival card, a chapter-end / resume card, R's arrival re-open */
  card: 3,
  /** N's 这段路被挡住了 card: the player is stuck, it wins */
  stuck: 4,
  /** the E prompt over the action chips */
  prompt: 2,
  /** the wait / ride / lead chips */
  chip: 1,
  /** BAYBAY's paced lines */
  line: 1,
} as const;

export type DropReason = 'preempted' | 'expired' | 'cleared';

export interface SlotOptions {
  /** higher first (ATTENTION_PRIORITY); default 0 */
  priority?: number;
  /** the holder stays at least this long before a higher priority may take the level (ms); default 0 */
  minMs?: number;
  /** a first-visit holder (no auto-close: it holds until release() or a higher priority after minMs) */
  firstVisit?: boolean;
  /** while held, title toasts go into this holder's ribbon instead of waiting */
  absorb?: boolean;
  /** a waiter gives up after this long (ms; default DEFAULT_MAX_WAIT_MS; Infinity: never) */
  maxWaitMs?: number;
  /** called once when a waiting request is granted (also right away when granted at once) */
  onGrant?: () => void;
  /** called once when the request is dropped: taken over ('preempted'), waited too long ('expired'), `clearAttention` */
  onDrop?: (why: DropReason) => void;
}

export interface SlotTicket {
  readonly level: AttentionLevel;
  readonly id: string;
  /** on screen now (a live read: false while waiting, false again once released or dropped) */
  readonly granted: boolean;
  /** still waiting for its turn */
  readonly waiting: boolean;
  /** shown and gone, or no longer wanted: frees the level (a waiting request leaves the queue) */
  release(): void;
}

interface Req {
  level: AttentionLevel;
  id: string;
  priority: number;
  minMs: number;
  firstVisit: boolean;
  absorb: boolean;
  maxWaitMs: number;
  onGrant?: () => void;
  onDrop?: (why: DropReason) => void;
  /** when it was asked for / granted (clock ms) */
  askedAt: number;
  grantedAt: number;
  state: 'waiting' | 'held' | 'done';
  seq: number;
}

interface LevelState { holder: Req | null; queue: Req[]; freeAt: number; freePriority: number }

let now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
type Timer = ReturnType<typeof setTimeout>;
let setTimer = (fn: () => void, ms: number): Timer => setTimeout(fn, ms);
let clearTimer = (t: Timer) => clearTimeout(t);

const levels: Record<AttentionLevel, LevelState> = {
  title: { holder: null, queue: [], freeAt: -Infinity, freePriority: -Infinity },
  action: { holder: null, queue: [], freeAt: -Infinity, freePriority: -Infinity },
  line: { holder: null, queue: [], freeAt: -Infinity, freePriority: -Infinity },
};
const timers: Partial<Record<AttentionLevel, Timer>> = {};
const freeListeners = new Set<(level: AttentionLevel) => void>();
const changeListeners = new Set<() => void>();
let seq = 0;
let version = 0;

/** Stats for QA / the first-minute gate (`__opusBay.attention`). */
export const attentionLog: { at: number; level: AttentionLevel; id: string; what: 'grant' | 'release' | 'drop' | 'wait' | 'absorb' }[] = [];
const LOG_MAX = 200;
function log(level: AttentionLevel, id: string, what: (typeof attentionLog)[number]['what']) {
  attentionLog.push({ at: Math.round(now()), level, id, what });
  if (attentionLog.length > LOG_MAX) attentionLog.splice(0, attentionLog.length - LOG_MAX);
}

function changed() {
  version++;
  for (const fn of [...changeListeners]) { try { fn(); } catch (e) { if (import.meta.env?.DEV) console.error('[opus-bay attention]', e); } }
}

function safe(fn: (() => void) | undefined) {
  if (!fn) return;
  try { fn(); } catch (e) { if (import.meta.env?.DEV) console.error('[opus-bay attention]', e); }
}

/** the head of a queue: highest priority, then the oldest */
const better = (a: Req, b: Req) => (a.priority !== b.priority ? a.priority > b.priority : a.seq < b.seq);
function head(q: readonly Req[]): Req | null {
  let best: Req | null = null;
  for (const r of q) if (!best || better(r, best)) best = r;
  return best;
}

function grant(L: LevelState, r: Req, t: number) {
  L.queue = L.queue.filter(x => x !== r);
  L.holder = r;
  r.state = 'held';
  r.grantedAt = t;
  log(r.level, r.id, 'grant');
}

function drop(r: Req, why: DropReason) {
  if (r.state === 'done') return;
  r.state = 'done';
  log(r.level, r.id, 'drop');
  const fn = r.onDrop;
  safe(fn && (() => fn(why)));
}

/** Grant what may be granted now; schedule the next look. */
function pump(level: AttentionLevel) {
  const L = levels[level];
  const t = now();
  // expire the waiters that waited too long
  for (const r of [...L.queue]) if (t - r.askedAt > r.maxWaitMs) { L.queue = L.queue.filter(x => x !== r); drop(r, 'expired'); }
  let granted: Req | null = null;
  const h = head(L.queue);
  if (h && L.holder && h.priority > L.holder.priority && t - L.holder.grantedAt >= L.holder.minMs) {
    // a take-over: no gap (the higher message replaces the lower one in place)
    const old = L.holder;
    L.holder = null;
    drop(old, 'preempted');
    grant(L, h, t);
    granted = h;
  } else if (h && !L.holder && (t >= L.freeAt || h.priority > L.freePriority)) {
    // (a waiter above the one that just left would have taken over from it: no gap)
    grant(L, h, t);
    granted = h;
  }
  if (granted) { changed(); safe(granted.onGrant); }
  schedule(level);
}

/** The next time something on this level can change on its own (a free gap, a holder's minMs, a waiter's expiry). */
function schedule(level: AttentionLevel) {
  const L = levels[level];
  const prev = timers[level];
  if (prev !== undefined) { clearTimer(prev); delete timers[level]; }
  if (!L.queue.length) return;
  const t = now();
  let at = Infinity;
  for (const r of L.queue) at = Math.min(at, r.askedAt + r.maxWaitMs + 1);
  const h = head(L.queue)!;
  if (!L.holder) at = Math.min(at, h.priority > L.freePriority ? t : L.freeAt);
  else if (h.priority > L.holder.priority) at = Math.min(at, L.holder.grantedAt + L.holder.minMs);
  if (!Number.isFinite(at)) return;
  timers[level] = setTimer(() => { delete timers[level]; pump(level); }, Math.max(0, at - t));
}

function ticketOf(r: Req): SlotTicket {
  return {
    level: r.level,
    id: r.id,
    get granted() { return r.state === 'held'; },
    get waiting() { return r.state === 'waiting'; },
    release: () => releaseReq(r),
  };
}

function releaseReq(r: Req) {
  const L = levels[r.level];
  if (r.state === 'done') return;
  if (r.state === 'waiting') {
    r.state = 'done';
    L.queue = L.queue.filter(x => x !== r);
    log(r.level, r.id, 'release');
    schedule(r.level);
    return;
  }
  r.state = 'done';
  if (L.holder === r) {
    L.holder = null;
    L.freeAt = now() + LEVEL_GAP_MS[r.level];
    L.freePriority = r.priority;
    log(r.level, r.id, 'release');
    changed();
    for (const fn of [...freeListeners]) { try { fn(r.level); } catch (e) { if (import.meta.env?.DEV) console.error('[opus-bay attention]', e); } }
  }
  pump(r.level);
}

/**
 * Ask for a level. Granted at once when the level is free (and its gap has passed) and nobody of a higher or equal
 * priority waits; a higher priority takes the level from a holder that has been up its `minMs`; else it waits its turn
 * (`onGrant` then). The same `id` asked again while it waits or holds returns that request (no duplicate).
 */
export function requestSlot(level: AttentionLevel, id: string, opts: SlotOptions = {}): SlotTicket {
  const L = levels[level];
  const same = L.holder?.id === id ? L.holder : L.queue.find(r => r.id === id);
  if (same) return ticketOf(same);
  const t = now();
  const r: Req = {
    level, id,
    priority: opts.priority ?? 0,
    minMs: opts.minMs ?? 0,
    firstVisit: !!opts.firstVisit,
    absorb: !!opts.absorb,
    maxWaitMs: opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
    onGrant: opts.onGrant,
    onDrop: opts.onDrop,
    askedAt: t, grantedAt: 0, state: 'waiting', seq: ++seq,
  };
  L.queue.push(r);
  log(level, id, 'wait');
  pump(level);
  return ticketOf(r);
}

/** Called with the level each time a holder releases it (a caller that was refused may ask again). */
export function onSlotFree(cb: (level: AttentionLevel) => void): () => void {
  freeListeners.add(cb);
  return () => { freeListeners.delete(cb); };
}

/** Who holds a level now (its id), or null. */
export const slotHolder = (level: AttentionLevel): string | null => levels[level].holder?.id ?? null;
/** The ids waiting on a level, head first. */
export function slotQueue(level: AttentionLevel): string[] {
  return [...levels[level].queue].sort((a, b) => (better(a, b) ? -1 : 1)).map(r => r.id);
}
/** The title holder takes toasts into its ribbon (the arrival card). */
export const titleAbsorbs = (): boolean => !!levels.title.holder?.absorb;
/** The holder of a level is a first-visit holder (no timer of its own). */
export const holderIsFirstVisit = (level: AttentionLevel): boolean => !!levels[level].holder?.firstVisit;

/** Subscribe to any change (grant / release / drop / ribbon); returns the unsubscribe. */
export function subscribeAttention(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => { changeListeners.delete(fn); };
}
export const attentionVersion = () => version;

// ---------------------------------------------------------------------------------------------------------------
// The ribbon: progress (今日小事 1/3, 南瓜灯 1/40, +10 金币, 解锁…) merged into one line
// ---------------------------------------------------------------------------------------------------------------

/** A note of the ribbon; `kind` (optional) names what a later note of the same kind replaces (the finds' chip: +1 · X → +2 个地点). */
export type RibbonPart = Bilingual & { kind?: string };
export interface RibbonItem { key: number; parts: RibbonPart[]; at: number }
/** Progress notes that arrive this close together (ms) share one ribbon line. */
export const RIBBON_MERGE_MS = 2500;
/** At most this many notes in one ribbon line (the oldest leaves). */
export const RIBBON_MAX_PARTS = 3;
let ribbonItem: RibbonItem | null = null;
let ribbonKey = 0;

/** Join notes into one line: "今日小事 ✓ 新地点 1/3 · 南瓜灯 1/40 · +10 金币" (pure). */
export function ribbonText(parts: readonly Bilingual[]): Bilingual {
  return { zh: parts.map(p => p.zh).join(' · '), en: parts.map(p => p.en).join(' · ') };
}

/**
 * Add a note to the ribbon (the merge rule, pure over `cur`): within RIBBON_MERGE_MS of the last note it joins the line
 * (a note of the same kind — same text before its count — replaces the older one: 南瓜灯 1/40 → 2/40), else a new line.
 */
export function mergeRibbon(cur: RibbonItem | null, note: RibbonPart, at: number, key: number): RibbonItem {
  if (!cur || at - cur.at > RIBBON_MERGE_MS) return { key, parts: [note], at };
  // the words before the first count / tick (今日小事, 南瓜灯), or after a leading "+N" (金币)
  const kind = (b: RibbonPart) => b.kind ?? (b.zh.split(/[\d✓·+]/u)[0].trim() || b.zh.replace(/^[\s+\d·]+/u, '').trim() || b.zh);
  const parts = cur.parts.filter(p => kind(p) !== kind(note));
  parts.push(note);
  return { key: cur.key, parts: parts.slice(-RIBBON_MAX_PARTS), at };
}

/** A progress note for the ribbon (the arrival card's row when one is up, else ui/Floating's top ribbon). */
export function ribbonNote(note: Bilingual, kind?: string): void {
  ribbonItem = mergeRibbon(ribbonItem, kind ? { zh: note.zh, en: note.en, kind } : note, now(), ++ribbonKey);
  const holder = levels.title.holder;
  log('title', holder?.absorb ? holder.id : 'ribbon', 'absorb');
  changed();
}
/** The current ribbon line (null when none was written, or it was cleared). */
export const ribbon = (): RibbonItem | null => ribbonItem;
export function clearRibbon(): void { if (ribbonItem) { ribbonItem = null; changed(); } }

// ---------------------------------------------------------------------------------------------------------------
// React
// ---------------------------------------------------------------------------------------------------------------

/**
 * Hold a level while `active` (a mounted message): true while granted. The request is made when `active` turns true and
 * released when it turns false or the component unmounts; `onDrop` — taken over or expired — turns it false for good
 * (until `active` turns false and true again, or `id` changes).
 */
export function useAttention(level: AttentionLevel, id: string, active: boolean, opts: Omit<SlotOptions, 'onGrant' | 'onDrop'> & { onDrop?: (why: DropReason) => void } = {}): boolean {
  const [granted, setGranted] = useState(false);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });
  useEffect(() => {
    if (!active) { setGranted(false); return; }
    let live = true;
    const ticket = requestSlot(level, id, {
      ...optsRef.current,
      onGrant: () => { if (live) setGranted(true); },
      onDrop: why => { if (live) { setGranted(false); optsRef.current.onDrop?.(why); } },
    });
    setGranted(ticket.granted);
    return () => { live = false; ticket.release(); };
  }, [level, id, active]);
  return granted && active;
}

/** The ribbon line, re-rendered on change. */
export function useRibbon(): RibbonItem | null {
  return useSyncExternalStore(subscribeAttention, ribbon, ribbon);
}

// ---------------------------------------------------------------------------------------------------------------
// Tests / QA
// ---------------------------------------------------------------------------------------------------------------

/** Drop every holder and waiter (onDrop('cleared')), the gaps and the ribbon: a restart, the tests. */
export function clearAttention(): void {
  for (const level of ATTENTION_LEVELS) {
    const L = levels[level];
    const all = [...(L.holder ? [L.holder] : []), ...L.queue];
    L.holder = null; L.queue = []; L.freeAt = -Infinity; L.freePriority = -Infinity;
    const tm = timers[level];
    if (tm !== undefined) { clearTimer(tm); delete timers[level]; }
    for (const r of all) drop(r, 'cleared');
  }
  ribbonItem = null;
  attentionLog.length = 0;
  changed();
}

/** Tests: a fake clock and timers (pass nothing to restore the real ones). */
export function setAttentionClockForTests(clock?: () => number, timer?: { set(fn: () => void, ms: number): unknown; clear(t: unknown): void }): void {
  now = clock ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  if (timer) { setTimer = (fn, ms) => timer.set(fn, ms) as Timer; clearTimer = t => timer.clear(t); } else { setTimer = (fn, ms) => setTimeout(fn, ms); clearTimer = t => clearTimeout(t); }
}

/** A snapshot for QA scripts (`__opusBay.attention()`): who holds what, who waits, the ribbon. */
export function attentionSnapshot() {
  const out = {} as Record<AttentionLevel, { holder: string | null; queue: string[] }> & { ribbon: Bilingual | null };
  for (const level of ATTENTION_LEVELS) out[level] = { holder: slotHolder(level), queue: slotQueue(level) };
  out.ribbon = ribbonItem ? ribbonText(ribbonItem.parts) : null;
  return out;
}
