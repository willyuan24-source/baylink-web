import type { ComponentType } from 'react';
import type { Bilingual } from '../core/types';

/**
 * Wave 5 (FROZEN at day 0, plan sf-w5-plan.md §4.2 W5-0d) · UI slots: how the new lanes (E economy, A play, D eggs,
 * R real SF, and N / C for their additions) put DOM on screen without editing the HUD's files. The lead wired the
 * render points on day 0:
 *
 *   registerJournalTab   → ui/Journal.tsx: a tab (lazy body) merged with the built-in tabs by `order`
 *   registerMoreItem     → ui/Hud.tsx: phones in the bottom bar's 更多 menu; desktop in a 更多 round button that
 *                          exists only while at least one item is registered (district mode: never)
 *   registerPillBadge    → ui/Hud.tsx: inside the free-roam objective pill, after 明信片 n/m (`明信片 3/24 · 🪙 42`)
 *   registerOverlay      → ui/Overlay.tsx: rendered while open (openOverlay / closeOverlay), above the HUD and panels,
 *                          under the dialogue box; Escape closes the most recently opened one
 *   registerAskItem      → game/flow.ts openCallMenu (问 BAYBAY): `order < 0` above BAYBAY's own choices, `order ≥ 0`
 *                          after them, before 打开地图 / 没事，继续逛; `visible()` is asked each time the menu opens
 *   openJournal(tab?)    opens the Journal on that tab (a registered id, or 'cards' · 'goals' · 'wish' · 'steps')
 *
 * Built-in orders (so a registered tab / item can sit between them): Journal tabs cards 10 · goals 20 · wish 30 ·
 * steps 40; More items 拍照 10 · 设置 90.
 *
 * Every register* returns its unregister; registering an id again replaces the earlier entry (last wins) and the
 * earlier unregister then does nothing. Components come from the lanes' lazy chunks: register them from `init()`
 * (game/w5Features.ts), never from a module GameRoot imports statically.
 *
 * Dependency-free apart from types: game/flow.ts imports it for the ask items, so it must not import game modules
 * (flow binds openJournal through `bindJournalOpener`).
 */

export interface JournalTabSlot { id: string; order: number; label: Bilingual; icon: ComponentType; count?: () => string | undefined; load: () => Promise<{ default: ComponentType }> }
export interface MoreItemSlot { id: string; order: number; label: Bilingual; icon: ComponentType; onSelect: () => void }
export interface PillBadgeSlot { id: string; order: number; Component: ComponentType }
export interface OverlayProps { props?: unknown; close: () => void }
export interface OverlaySlot { id: string; Component: ComponentType<OverlayProps> }
/** W7-G8 (lane G, surgical): a block in the journal's 目标 tab in the city, after the explorer goals (the Halloween goals in the season). */
export interface GoalsRowSlot { id: string; order: number; Component: ComponentType }
export interface AskItemSlot { id: string; order: number; label: Bilingual; icon: ComponentType; onSelect: () => void; visible?: () => boolean }

/** Built-in Journal tab ids and orders (ui/Journal.tsx). */
export const JOURNAL_BUILTIN_ORDER = { cards: 10, goals: 20, wish: 30, steps: 40 } as const;
/** Built-in More item orders (ui/Hud.tsx). */
export const MORE_BUILTIN_ORDER = { photo: 10, settings: 90 } as const;

type Listener = () => void;

/** A keyed registry with a stable sorted snapshot (useSyncExternalStore-friendly). */
class Registry<T extends { id: string; order?: number }> {
  private items = new Map<string, T>();
  private snap: readonly T[] = [];
  private listeners = new Set<Listener>();
  add(item: T): () => void {
    this.items.set(item.id, item);
    this.changed();
    return () => { if (this.items.get(item.id) === item) { this.items.delete(item.id); this.changed(); } };
  }
  get(id: string): T | undefined { return this.items.get(id); }
  list = (): readonly T[] => this.snap;
  subscribe = (fn: Listener): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private changed() {
    this.snap = [...this.items.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const fn of [...this.listeners]) fn();
  }
}

export const journalTabs = new Registry<JournalTabSlot>();
export const moreItems = new Registry<MoreItemSlot>();
export const pillBadges = new Registry<PillBadgeSlot>();
export const overlays = new Registry<OverlaySlot>();
export const askItems = new Registry<AskItemSlot>();
export const goalsRows = new Registry<GoalsRowSlot>();

export function registerJournalTab(t: JournalTabSlot): () => void { return journalTabs.add(t); }
export function registerMoreItem(m: MoreItemSlot): () => void { return moreItems.add(m); }
export function registerPillBadge(p: PillBadgeSlot): () => void { return pillBadges.add(p); }
export function registerAskItem(a: AskItemSlot): () => void { return askItems.add(a); }
export function registerGoalsRow(r: GoalsRowSlot): () => void { return goalsRows.add(r); }
export function registerOverlay(o: OverlaySlot): () => void {
  const off = overlays.add(o);
  return () => { off(); if (!overlays.get(o.id)) closeOverlay(o.id); };
}

// --- open overlays (most recent last) ---------------------------------------------------------------------------

export interface OpenOverlay { id: string; props?: unknown }
let open: readonly OpenOverlay[] = [];
const openListeners = new Set<Listener>();
const openChanged = () => { for (const fn of [...openListeners]) fn(); };

/** Show a registered overlay (again: it moves to the top with the new props). An unknown id does nothing. */
export function openOverlay(id: string, props?: unknown): void {
  if (!overlays.get(id)) { if (import.meta.env?.DEV) console.warn(`[opus-bay slots] openOverlay: no overlay "${id}" registered`); return; }
  open = [...open.filter(o => o.id !== id), props === undefined ? { id } : { id, props }];
  openChanged();
}

export function closeOverlay(id: string): void {
  if (!open.some(o => o.id === id)) return;
  open = open.filter(o => o.id !== id);
  openChanged();
}

/** The open overlays, oldest first (the render point and Escape read it). */
export const openOverlays = (): readonly OpenOverlay[] => open;
export const subscribeOverlays = (fn: Listener): (() => void) => { openListeners.add(fn); return () => { openListeners.delete(fn); }; };
/** Escape: close the most recently opened overlay; false when none is open. */
export function closeTopOverlay(): boolean {
  const top = open[open.length - 1];
  if (!top) return false;
  closeOverlay(top.id);
  return true;
}

// --- the Journal ------------------------------------------------------------------------------------------------

let journalOpener: ((tab?: string) => void) | null = null;
/** game/flow.ts binds `openPanel('journal', tab)` (no import cycle: this module imports no game code). */
export function bindJournalOpener(fn: ((tab?: string) => void) | null): void { journalOpener = fn; }

/** The last openJournal request (the open Journal follows `seq`: a second request for the same tab still switches). */
export interface JournalRequest { tab?: string; seq: number }
let journalRequest: JournalRequest = { seq: 0 };
const journalListeners = new Set<Listener>();
export const lastJournalRequest = (): JournalRequest => journalRequest;
export const subscribeJournalRequest = (fn: Listener): (() => void) => { journalListeners.add(fn); return () => { journalListeners.delete(fn); }; };

/** Open the Journal, on `tab` when given (a registered tab id or a built-in one); on it already: switch tab. */
export function openJournal(tab?: string): void {
  journalRequest = tab === undefined ? { seq: journalRequest.seq + 1 } : { tab, seq: journalRequest.seq + 1 };
  for (const fn of [...journalListeners]) fn();
  journalOpener?.(tab);
}

// --- the ask items (flow's call menu) --------------------------------------------------------------------------

/** The ask items to offer now (visible() asked; a throwing visible() hides its item). */
export function visibleAskItems(): AskItemSlot[] {
  return askItems.list().filter(a => {
    try { return a.visible ? a.visible() : true; } catch { return false; }
  });
}

/** Run an ask item's onSelect (flow's runAction 'ask'); false when the id is not registered. */
export function runAskItem(id: string): boolean {
  const a = askItems.get(id);
  if (!a) return false;
  try { a.onSelect(); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay slots] ask item', id, error); }
  return true;
}

/** Run a More item's onSelect (the Hud menus). */
export function runMoreItem(id: string): void {
  const m = moreItems.get(id);
  if (!m) return;
  try { m.onSelect(); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay slots] more item', id, error); }
}
