import { lazy } from 'react';
import { emit } from '../core/events';
import { game } from '../core/store';
import { isPaid, subscribeLedger } from '../economy/ledger';
import { busy } from '../game/flow';
import { flow } from '../game/flowStore';
import { openOverlay, openOverlays, registerOverlay, subscribeOverlays } from '../ui/slots';
import { earnedHalloweenCards, newlyEarned } from './playPostcards';
import { sayLine } from './treatRun';

/**
 * Wave 7 · lane G (W7-G1) · hands a Halloween postcard over at its moment. It listens to the ledger (no hook in lane H's
 * hunt.ts / muertos.ts, nor in the treat's own code): when a card's gate (halloween/playPostcards.ts) turns true during
 * play — `hunt:all`, the first `door:<n>`, the first `night:<n>`, `muertos:12` — the card waits for BAYBAY's bubble of
 * that moment to end (the milestone line, the treat's 谢谢您！), then opens as the `h-postcard` overlay (a lazy chunk:
 * halloween/playPostcardCard.tsx). Kept (closed), BAYBAY says where it went (w7g-postcard-keep). Cards earned before
 * this shipped (or in another session) only show in the notebook and on the 万圣节 page: nothing pops up at load.
 */

export const H_POSTCARD_OVERLAY = 'h-postcard';
/** the card never opens sooner than this after its moment (s) */
export const CARD_MIN_WAIT = 1.4;
/** BAYBAY's bubble must have been gone this long (s) — the treat's thanks and its milestone line come 0.25 s apart */
export const CARD_QUIET = 0.8;
/** after this (s) the card opens even if BAYBAY keeps talking (never over a dialogue, a cinematic, another reward or
 * another lane's overlay: W7-G-review — at 14 s it opened over a running claw machine / crab net / slide chip / shop) */
export const CARD_MAX_WAIT = 14;
const TICK = 0.25;

const HalloweenPostcardCard = lazy(() => import('./playPostcardCard'));

interface Pending { id: string; at: number }

export interface CardGate {
  /** seconds since the moment */
  waited: number;
  /** seconds BAYBAY has been quiet */
  quiet: number;
  /** a dialogue, a cinematic, a city postcard reward, the goals step… (game/flow busy), or a side panel (the journal, the
   * shop, the map: the card waits until the player is back in the world) */
  busy: boolean;
  /** another lane's overlay is open */
  otherOverlay: boolean;
}

/** Pure: whether a waiting card may open now. */
export function cardMayOpen(g: CardGate): boolean {
  if (g.busy || g.otherOverlay || g.waited < CARD_MIN_WAIT) return false;
  if (g.waited >= CARD_MAX_WAIT) return true;
  return g.quiet >= CARD_QUIET;
}

export interface PostcardRun {
  /** DEV / QA: open card `id` now (as if just earned) */
  show(id: string): void;
  /** DEV / QA: the cards waiting */
  pending(): string[];
  off(): void;
}

export function initHalloweenPostcards(): PostcardRun {
  const offs: (() => void)[] = [registerOverlay({ id: H_POSTCARD_OVERLAY, Component: HalloweenPostcardCard })];
  let known = earnedHalloweenCards(isPaid) as string[];
  const queue: Pending[] = [];
  let clock = 0, quiet = 0;
  let showing: string | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
  const tick = () => {
    clock += TICK;
    quiet = flow.get().bubble ? 0 : quiet + TICK;
    if (showing || !queue.length) { if (!showing && !queue.length) stopTimer(); return; }
    const next = queue[0];
    const others = openOverlays().length > 0;
    if (!cardMayOpen({ waited: clock - next.at, quiet, busy: busy() || !!game.get().panel.kind, otherOverlay: others })) return;
    queue.shift();
    showing = next.id;
    emit({ type: 'ui', action: 'open' });
    openOverlay(H_POSTCARD_OVERLAY, { id: next.id });
  };
  const startTimer = () => { if (!timer) timer = setInterval(tick, TICK * 1000); };
  const enqueue = (id: string) => {
    if (showing === id || queue.some(p => p.id === id)) return;
    queue.push({ id, at: clock });
    startTimer();
  };

  offs.push(subscribeLedger(() => {
    const now = earnedHalloweenCards(isPaid) as string[];
    for (const id of newlyEarned(known, now)) enqueue(id);
    known = now;
    // (a Settings reset takes the cards away: drop what is waiting)
    for (let i = queue.length - 1; i >= 0; i--) if (!now.includes(queue[i].id)) queue.splice(i, 1);
  }));

  // the card was kept (closed): BAYBAY says where it went, then the next one may come
  offs.push(subscribeOverlays(() => {
    if (!showing || openOverlays().some(o => o.id === H_POSTCARD_OVERLAY)) return;
    showing = null;
    emit({ type: 'stamp' });
    try { sayLine('w7g-postcard-keep'); } catch { /* the flow is going */ }
    quiet = 0;
    if (queue.length) { for (const p of queue) p.at = clock; startTimer(); }
  }));

  return {
    show: id => enqueue(id),
    pending: () => queue.map(p => p.id),
    off: () => { stopTimer(); queue.length = 0; showing = null; for (const off of offs.splice(0).reverse()) off(); },
  };
}
