import { onEvent } from '../core/events';
import { game, toast, type Toast } from '../core/store';
import type { Bilingual } from '../core/types';
import { ATTENTION_PRIORITY, RIBBON_MERGE_MS, attentionLog, attentionSnapshot, requestSlot, ribbon, ribbonNote, subscribeAttention, titleAbsorbs, type RibbonItem, type SlotTicket } from '../game/attention';
import { flow } from '../game/flowStore';
import { BAYBAY_HOLD_OVERLAYS } from '../game/baybayHold';
import { GOALS_STEP_ID } from '../data/sf/goals';
import { openOverlays, subscribeOverlays } from './slots';
import { importRetry } from '../game/importRetry';
import { lastWelcome, onWelcome, type WelcomeInfo } from '../game/welcome';

/**
 * Wave 9 · lane F · W9-F2 — the title level on screen (review R§5 #5: the arrival banner, the unlock toast, 今日小事 1/3
 * and the +1 chip stacked with the ARRIVED card; sf-w9-lead.md §3 F (1)). Lives in the play layer's chunk (ui/Floating
 * Toasts renders it), so GameRoot does not carry it.
 *
 *   toasts     core/store `toast()` keeps up to three at once; here ONE is on screen at a time (game/attention.ts 'title'),
 *              the next ≥ 2.5 s later, each for its reading time; a toast that waited 10 s is not shown late
 *   progress   a toast with a count or a tick (今日小事 ✓ … 1/3, 南瓜灯 1 / 40, +1 · 渡轮大厦) and the coins of a reward go
 *              into ONE ribbon line (game/attention.ts ribbonNote: notes within 2.5 s share it) shown like one toast
 *   absorbed   while the arrival card holds the title (an `absorb` holder) every toast is written into its ribbon row
 *   modal      a dialogue, a side panel, the postcard reward, the goals step or a card / play panel (BAYBAY's hold list)
 *              holds the title level itself: a toast waits under it instead of stacking on top
 */

/** How long a toast stays once on screen (ms): its reading time, 2.4–4.6 s (a gold one 0.6 s more). */
export function toastMs(text: string, tone: Toast['tone'] = 'info'): number {
  const n = [...text].length;
  const cjk = /[㐀-鿿]/.test(text);
  const base = Math.min(4600, Math.max(2400, 1400 + n * (cjk ? 110 : 42)));
  return base + (tone === 'gold' ? 600 : 0);
}
/** The ribbon stays this long after its last note (ms). */
export const RIBBON_SHOW_MS = 3600;
/** A toast or the ribbon is on screen at least this long before a card (the arrival banner, a stuck card…) takes over (ms). */
export const TOAST_MIN_MS = 1800;
/** A toast is not shown after waiting this long (ms). */
export const TOAST_MAX_WAIT_MS = 10_000;

/** A progress note (pure): a count (1/3, 1 / 40), a tick, or a "+N" find / reward. */
export const isProgress = (text: string): boolean => /\d\s*\/\s*\d|✓|^\s*\+\d/.test(text);

export interface ShownToast { key: string; text: Bilingual | string; tone: Toast['tone'] }
export interface TitleHostState {
  /** the toast on screen (null: none) */
  toast: ShownToast | null;
  /** the ribbon line on screen (null: none) */
  ribbon: RibbonItem | null;
}

let state: TitleHostState = { toast: null, ribbon: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<TitleHostState>) => { state = { ...state, ...patch }; for (const fn of [...listeners]) fn(); };
export const titleHostState = (): TitleHostState => state;
export function subscribeTitleHost(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

const asBi = (t: Toast): Bilingual => t.bi ?? { zh: t.text, en: t.text };

// --- toasts -------------------------------------------------------------------------------------------------------

let lastToastId = 0;
const tickets = new Map<string, SlotTicket>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function showToast(key: string, item: Toast) {
  set({ toast: { key, text: item.bi ?? item.text, tone: item.tone } });
  const ms = toastMs(item.text, item.tone);
  timers.set(key, setTimeout(() => endToast(key), ms));
}
function endToast(key: string) {
  const tm = timers.get(key);
  if (tm) clearTimeout(tm);
  timers.delete(key);
  if (state.toast?.key === key) set({ toast: null });
  tickets.get(key)?.release();
  tickets.delete(key);
}

function onToasts(list: readonly Toast[]) {
  for (const item of list) {
    if (item.id <= lastToastId) continue;
    lastToastId = item.id;
    const bi = asBi(item);
    // progress → the ribbon; anything while the arrival card holds the title → its ribbon row
    if (isProgress(item.text) || titleAbsorbs()) { ribbonNote(bi); continue; }
    const key = `toast:${item.id}`;
    // (W9-I, F-RC-1 / F-RP-2: 想去, 已保存, 链接已复制 and the map compass waited behind the 'modal' holder and were dropped
    // after 10 s) a toast raised while a dialogue / panel / card is up is that panel's own feedback: it shows at once
    // (the top stack sits beside the sheet)
    if (modalUp()) { showToast(key, item); continue; }
    const ticket = requestSlot('title', key, {
      // toasts never cut each other short (first come, first shown); a card takes over after TOAST_MIN_MS
      priority: ATTENTION_PRIORITY.toast,
      minMs: TOAST_MIN_MS,
      maxWaitMs: TOAST_MAX_WAIT_MS,
      onGrant: () => showToast(key, item),
      onDrop: () => endToast(key),
    });
    tickets.set(key, ticket);
    if (ticket.granted && state.toast?.key !== key) showToast(key, item);
  }
}

// --- the ribbon ---------------------------------------------------------------------------------------------------

let ribbonTicket: SlotTicket | null = null;
let ribbonTimer: ReturnType<typeof setTimeout> | null = null;
let seenRibbon: RibbonItem | null = null;

function endRibbon() {
  if (ribbonTimer) clearTimeout(ribbonTimer);
  ribbonTimer = null;
  if (state.ribbon) set({ ribbon: null });
  ribbonTicket?.release();
  ribbonTicket = null;
}
function holdRibbon() {
  if (ribbonTimer) clearTimeout(ribbonTimer);
  ribbonTimer = setTimeout(endRibbon, RIBBON_SHOW_MS);
  set({ ribbon: ribbon() });
}
function onAttention() {
  const r = ribbon();
  if (r === seenRibbon) return;
  seenRibbon = r;
  // the arrival card shows it in its own row
  if (!r || titleAbsorbs()) return;
  if (ribbonTicket?.granted || modalUp()) { holdRibbon(); return; } // (W9-I, F-RC-1: under a panel, at once)
  if (ribbonTicket?.waiting) return;
  ribbonTicket = requestSlot('title', `ribbon:${r.key}`, {
    priority: ATTENTION_PRIORITY.toast,
    minMs: TOAST_MIN_MS,
    maxWaitMs: TOAST_MAX_WAIT_MS,
    onGrant: holdRibbon,
    onDrop: () => { ribbonTicket = null; endRibbon(); },
  });
  if (ribbonTicket.granted) holdRibbon();
}

// --- coins into the ribbon ----------------------------------------------------------------------------------------

let coins: { sum: number; at: number } | null = null;
function onCoins(delta: number) {
  if (delta <= 0) return;
  const now = performance.now();
  const r = ribbon();
  // only beside other progress (a reward with its find / arrival) or into the arrival card: the badge pulses anyway
  const fresh = !!r && now - r.at <= RIBBON_MERGE_MS;
  if (!fresh && !titleAbsorbs()) { coins = null; return; }
  coins = coins && now - coins.at <= RIBBON_MERGE_MS ? { sum: coins.sum + delta, at: now } : { sum: delta, at: now };
  ribbonNote({ zh: `+${coins.sum} 金币`, en: `+${coins.sum} coins` });
}

// --- the modal holder ---------------------------------------------------------------------------------------------

const HOLD = new Set(BAYBAY_HOLD_OVERLAYS);
let modalTicket: SlotTicket | null = null;
/** A dialogue, a panel, the postcard reward, the goals step or a card / play panel is up (pure over the stores). */
export function modalUp(): boolean {
  const s = game.get(), f = flow.get();
  return !!s.dialogue.nodeId || !!s.panel.kind || !!f.postcardReward || !!f.postcardFly || openOverlays().some(o => o.id === GOALS_STEP_ID || HOLD.has(o.id));
}
function onModal() {
  const up = modalUp();
  if (up && !modalTicket) modalTicket = requestSlot('title', 'modal', { priority: 5, maxWaitMs: Infinity, onDrop: () => { modalTicket = null; } });
  else if (!up && modalTicket) { modalTicket.release(); modalTicket = null; }
}

// --- 我是本地人's one 今天 card ------------------------------------------------------------------------------------

/** W9-F11: after a new player's 我是本地人 (city), this long after the choice (ms): her one line has gone by. */
export const LOCAL_TODAY_AFTER_MS = 6000;
/**
 * W9-F11 (sf-w9-lead §3 F (2): 我是本地人 → quiet for 3 min for real + one 今天 card; review §4 item 1: a local wants the
 * real-SF value first) · ONE gold title message, 今天在旧金山 · <lane R's headline, else the sunset time>
 * (ui/titleToday.ts), a toast through the title level (it waits for her dialogue); nothing when the day has no line
 * (after sunset with nothing on). Not a BAYBAY line: the 3 quiet minutes stay quiet. Never in district mode.
 */
function localToday(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined, done = false, live = true;
  const go = (info: WelcomeInfo) => {
    if (done || info.kind !== 'new' || info.choice !== 'local' || game.get().worldMode !== 'city') return;
    done = true;
    timer = setTimeout(() => {
      importRetry(() => import('./titleToday')).then(m => m.titleToday()).then(line => {
        if (live && line) toast({ zh: `今天在旧金山 · ${line.zh}`, en: `Today in SF · ${line.en}` }, 'gold', 9000);
      }, () => { /* no card */ });
    }, Math.max(0, LOCAL_TODAY_AFTER_MS - (performance.now() - info.at)));
  };
  const seen = lastWelcome();
  if (seen) go(seen);
  const off = onWelcome((_kind, info) => { go(info); });
  return () => { live = false; off(); if (timer) clearTimeout(timer); };
}

// --- boot ---------------------------------------------------------------------------------------------------------

let booted = false;
/** Once per page (ui/Floating Toasts mounts it). Returns the disposer (tests). */
export function initTitleHost(): () => void {
  if (booted) return () => {};
  booted = true;
  // the toasts already up when this chunk came in (an arrival in the first moments of play) take their turn too
  let lastToasts = game.get().toasts;
  onToasts(lastToasts);
  const offGame = game.subscribe(() => {
    const s = game.get();
    if (s.toasts !== lastToasts) { lastToasts = s.toasts; onToasts(s.toasts); }
    onModal();
  });
  const offFlow = flow.subscribe(onModal);
  const offOverlays = subscribeOverlays(onModal);
  const offAttention = subscribeAttention(onAttention);
  const offEvents = onEvent(e => { if (e.type === 'coins') onCoins(e.delta); });
  const offLocal = localToday();
  onModal();
  // DEV / QA (scripts/opus-sf/qa/first-minute.mjs): who holds what; other modules re-publish __opusBay on their own
  let devId = 0;
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    const api = { snapshot: attentionSnapshot, log: attentionLog, host: titleHostState };
    const put = () => { if (!w.__opusBay) w.__opusBay = { attention: api }; else if (w.__opusBay.attention !== api) w.__opusBay.attention = api; };
    put();
    devId = window.setInterval(put, 500);
  }
  return () => {
    offGame(); offFlow(); offOverlays(); offAttention(); offEvents(); offLocal(); if (devId) window.clearInterval(devId);
    for (const key of [...timers.keys()]) endToast(key);
    endRibbon();
    modalTicket?.release(); modalTicket = null;
    booted = false;
  };
}
