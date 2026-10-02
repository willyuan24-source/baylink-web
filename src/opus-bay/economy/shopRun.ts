import { createElement } from 'react';
import { Compass, Store, Ticket } from 'lucide-react';
import { glideUnlocked, subscribeGlide } from '../actors/moveApi';
import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { DISTRICT } from '../data/district';
import { POSTCARDS } from '../data/postcards';
import { onSaveCleared, readSave } from '../data/save';
import { startTravel, travelActive } from '../game/fastTravel';
import { PELICAN_TARGET } from '../game/cityGoals';
import { closePanel, goalsStepOpen } from '../game/flow';
import { flow } from '../game/flowStore';
import { FLAG_RULES, registerFlagSource } from '../game/flags';
import { invalidateInteractables, registerInteractables, type Interactable } from '../game/interactables';
import { isDiscovered } from '../game/discovery';
import { requestHopOff } from '../game/transit';
import { closeOverlay, openOverlay, registerAskItem, registerMoreItem, registerPillBadge } from '../ui/slots';
import { isMarketOpen } from '../world/clock';
import { COMPASS_KINDS, hintTarget, type HintTarget } from './hints';
import { subscribeLedger } from './ledger';
import { dropLines, sayWhenFree } from './lines';
import { giveFirstTicket, holds, owns, ticketRule, consume } from './wallet';

/**
 * Wave 5 · lane E · W5-E6: the 小铺 in the game — where it opens, the stall, the 飞行券 rule and the two conveniences.
 *
 *   openShop(from)      the sheet (overlay 'e-shop'): More → 小铺 (phones: the bar's 更多; desktop: the 更多 button), the
 *                       stall, the ticket's ask item. Closes an open panel first.
 *   the stall           one farmers-market stall of the Ferry Plaza (the south plaza's, the one nearest the Ferry gate):
 *                       while the market is not on (world/clock isMarketOpen: the stall is tarped) its prompt is
 *                       「逛逛小铺」; 0 new geometry.
 *   飞行券              BAYBAY gives the first one before the pelican unlock (once per save); 问 BAYBAY → 用飞行券飞一次
 *                       while one is held; after the unlock it is hidden and an unused one gives back 10 金币.
 *   寻宝罗盘            bought = on for one outing: a pill badge points to the nearest unfound cache / egg / pebble
 *                       (economy/hints.ts); the first such find ends it.
 *   明信片放大镜        bought = on for one outing: the two nearest unfound postcards get a gold pennant (lane N's flag
 *                       layer, no new draw call); the next postcard ends it.
 */

export type ShopFrom = 'more' | 'stall' | 'ask' | 'ticket';
export interface ShopProps { from?: ShopFrom; shelf?: string }

/** Is the pelican out (the glide unlocked, in the moveApi or in the save while the world mounts)? */
export const pelicanOut = (): boolean => glideUnlocked() || !!readSave()?.unlocked?.glide;

export function openShop(from: ShopFrom = 'more', shelf?: string): void {
  if (game.get().panel.kind) closePanel();
  // the goals card folds away (it would sit beside the sheet; the pill brings it back)
  if (flow.get().goalsCard) flow.set({ goalsCard: false });
  closeOverlay('e-ticket');
  openOverlay('e-shop', { from, ...(shelf ? { shelf } : {}) } satisfies ShopProps);
}

// --- the stall -----------------------------------------------------------------------------------------------------

/** The stall the shop borrows: the Ferry Plaza south stall nearest the Ferry gate (district props, city frame). */
export function stallSpot(): { x: number; z: number; heading: number } | null {
  const gate = DISTRICT.anchors?.['ferry-gate'] ?? DISTRICT.spawn;
  let best: { x: number; z: number; heading: number } | null = null, bd = Infinity;
  for (const p of DISTRICT.props) {
    if (p.kind !== 'stall') continue;
    const d = Math.hypot(p.x - gate.x, p.z - gate.z);
    if (d < bd) { bd = d; best = { x: p.x, z: p.z, heading: p.rotationY ?? 0 }; }
  }
  return best;
}

const STALL_NAME: Bilingual = { zh: 'BAYBAY 小铺', en: 'BAYBAY’s shop' };

function stallInteractable(): Interactable | null {
  const s = stallSpot();
  if (!s) return null;
  return { id: 'e-shop-stall', source: 'shop', action: 'info', verb: { zh: '逛逛小铺', en: 'Browse the shop' }, name: STALL_NAME, x: s.x, z: s.z, radius: 3.4, act: () => openShop('stall') };
}

// --- the 飞行券 -----------------------------------------------------------------------------------------------------

/**
 * W6-K2 (lane C's wave-5 review: 送你一张飞行券！ a second after 跟 BAYBAY 去找鹈鹕, then 有鹈鹕啦，飞行券用不上了，还你 10 金币。
 * 40 s later at Coit — two lines about a ticket the player never used): goal #1's lead is on — the game is not playing
 * yet, a dialogue (the welcome) or the goals step is open, or BAYBAY leads to the pelican (`freeLead` = pelican:coit).
 * W6-K2-review: or a city tour runs — the welcome's first choice (刚来湾区 → the Grand Tour) meets the pelican at the
 * tour's first stop (game/cityTour arrived → unlockPelican('tour')), so a gift there was refunded seconds later (played
 * on the phone, a new player: 送你一张飞行券！ at 31 s, 送你一位鹈鹕朋友！ at 34 s, 还你 10 金币。 at 44 s). A tour ended
 * before its first stop lets the gift come TICKET_QUIET_MS later; one that reached a stop has the pelican out (no gift).
 * And while the game is still `onboarding` (the welcome is pending or open): Settings → reset progress sets the gate to
 * "at once" and restarts the welcome (flow restartOnboarding), whose dialogue opens a moment later — the ticket was given
 * in that gap, its line lost under the welcome, and the refund came after the pelican for a ticket never announced.
 */
export function ticketGiftWaits(): boolean {
  const s = game.get(), f = flow.get();
  // (W8-I, W8I-WS-2) nor under a panel (a place card: the voiced line played with its bubble off screen on the phone)
  return s.phase !== 'playing' || s.mode === 'onboarding' || !!s.dialogue.nodeId || s.panel.kind !== null || goalsStepOpen() || f.freeLead === PELICAN_TARGET || s.tour.active;
}
/** the gift comes this long (ms) after goal #1's lead is over (the goals step's close → the lead start is not a gap) */
export const TICKET_QUIET_MS = 4000;
/** quiet since (performance.now() ms); -Infinity: nothing has been busy since the start (a resumed player: at once) */
export const ticketGate = { quietSince: -Infinity };
/** The first 飞行券 may be given now (`now` = performance.now()): TICKET_QUIET_MS without ticketGiftWaits(). */
export function ticketGiftReady(now: number): boolean {
  if (ticketGiftWaits()) { ticketGate.quietSince = NaN; return false; }
  if (Number.isNaN(ticketGate.quietSince)) ticketGate.quietSince = now;
  return now - ticketGate.quietSince >= TICKET_QUIET_MS;
}

/** Fly once with a held ticket to `dest` (the ticket picker). False: none held, the pelican is out, or no flight began. */
export function flyWithTicket(dest: { id: string; name: Bilingual; x: number; z: number; look?: { x: number; z: number } }): boolean {
  if (!holds('fly-ticket') || pelicanOut() || travelActive()) return false;
  const s = game.get();
  if (s.phase !== 'playing') return false;
  if (s.move.mode === 'transit' || s.riding) requestHopOff();
  closePanel();
  closeOverlay('e-ticket');
  closeOverlay('e-shop');
  const look = dest.look && !isDiscovered(dest.id) ? { look: dest.look } : {};
  if (!startTravel({ id: dest.id, name: dest.name, x: dest.x, z: dest.z, ...look })) return false;
  consume('fly-ticket');
  emit({ type: 'shop', what: 'close', item: 'fly-ticket' });
  sayWhenFree('ticketFly', 8);
  return true;
}

export interface TicketDest { id: string; name: Bilingual; x: number; z: number; look: { x: number; z: number }; seen: boolean; d: number }

/**
 * The must-sees a ticket flies to from `from` (not within 60 u), the ones not visited first, then the farthest first (a
 * ticket is for going far). All 16: W5-E-review — `!offWalk` dropped Alcatraz, yet tripDestination already gives its
 * Pier 33 landing (where you stand and look at the island), so the picker showed 15 of the "16 must-sees". `m` is
 * data/sf/attractions (the picker loads it lazily).
 */
export function ticketDestinations(m: Pick<typeof import('../data/sf/attractions'), 'ATTRACTIONS' | 'tripDestination'>, from: { x: number; z: number }, seen: (placeId: string) => boolean = isDiscovered): TicketDest[] {
  const out = m.ATTRACTIONS.filter(a => a.rank === 1).map(a => {
    const d = m.tripDestination(a);
    return { id: d.placeId, name: d.name, x: d.x, z: d.z, look: { x: a.x, z: a.z }, seen: seen(d.placeId), d: Math.hypot(d.x - from.x, d.z - from.z) };
  }).filter(d => d.d > 60);
  out.sort((a, b) => Number(a.seen) - Number(b.seen) || b.d - a.d);
  return out;
}

// --- the compass -----------------------------------------------------------------------------------------------------

/** The compass's target now (null: nothing left to find, or the compass is off). */
export function compassTarget(from = { x: runtime.player.x, z: runtime.player.z }): HintTarget | null {
  if (!holds('compass')) return null;
  let best: HintTarget | null = null;
  for (const k of COMPASS_KINDS) { const t = hintTarget(k, from); if (t && (!best || t.dist < best.dist)) best = t; }
  return best;
}

// --- the magnifier ------------------------------------------------------------------------------------------------

/**
 * The nearest unfound postcards for the magnifier's pennants: the ones past the flag layer's near ring (FLAG_RULES.near,
 * 60 u — a pennant is for finding your way from afar; a closer postcard already glints gold in view).
 */
export function magnifierSpots(n = 2, from = { x: runtime.player.x, z: runtime.player.z }): { id: string; x: number; z: number }[] {
  const got = new Set(game.get().postcards);
  return POSTCARDS.filter(c => !got.has(c.id))
    .map(c => ({ id: c.id, x: c.position.x, z: c.position.z, d: Math.hypot(c.position.x - from.x, c.position.z - from.z) }))
    .filter(c => c.d >= FLAG_RULES.near)
    .sort((a, b) => a.d - b.d).slice(0, n).map(({ id, x, z }) => ({ id, x, z }));
}

// --- init ------------------------------------------------------------------------------------------------------------

const ShopIcon = () => createElement(Store, { size: 18, 'aria-hidden': true });
const TicketIcon = () => createElement(Ticket, { size: 16, 'aria-hidden': true });

/** Start the shop's world side. `Badge` = the compass badge component (economy/extras.ts passes it). */
export function initShop(CompassBadge: () => ReturnType<typeof createElement> | null): () => void {
  const offs: (() => void)[] = [];
  offs.push(registerMoreItem({ id: 'e-shop', order: 50, label: { zh: '小铺', en: 'Shop' }, icon: ShopIcon, onSelect: () => openShop('more') }));

  // the stall: offered while the market is not on (checked every 30 s: the canopies swap on the same clock)
  let market = isMarketOpen();
  offs.push(registerInteractables('e-shop', () => { const it = market ? null : stallInteractable(); return it ? [it] : []; }));
  const marketTimer = setInterval(() => { const m = isMarketOpen(); if (m !== market) { market = m; invalidateInteractables(); } }, 30_000);
  offs.push(() => clearInterval(marketTimer));

  // the 飞行券: BAYBAY's first one (once per save, before the pelican), the refund after the unlock. W5-E-review: also
  // after Settings → reset progress (a new save starts; before, the gift waited for the next page load): the reset
  // clears the save, then the glide — so the check runs once that click is over
  // W6-K2 (lane C's review request): the gift waits while goal #1 is being led — the welcome, the goals step, BAYBAY's
  // lead to the pelican — and TICKET_QUIET_MS after (ticketGiftReady, polled 1 Hz until given): a player who follows
  // 跟 BAYBAY 去找鹈鹕 meets the pelican first and never hears about a ticket (no gift, no refund line 40 s later)
  let gone = false;
  const ticketCheck = () => {
    if (gone) return;
    const out = pelicanOut();
    if (ticketRule(out) > 0) sayWhenFree('ticketRefund');
    if (out || owns('fly-gift') || !ticketGiftReady(performance.now())) return;
    if (giveFirstTicket(out)) sayWhenFree('ticketGift', 300, 5200);
  };
  ticketGate.quietSince = -Infinity;
  ticketCheck();
  const ticketTimer = setInterval(ticketCheck, 1000);
  offs.push(() => clearInterval(ticketTimer));
  offs.push(subscribeGlide(ticketCheck));
  // W6-K2-review: a reset is not "quiet since the start": Settings' reset clears the save, then turns the glide off
  // (subscribeGlide runs the check at once, the player still in free roam), then restarts the welcome — with the gate at
  // "at once" the ticket was given inside that click (played on the phone: held 150 ms after the reset, before the new
  // welcome's first line; 有鹈鹕啦…还你 10 金币。 after its lead). The new save's gift comes TICKET_QUIET_MS after its
  // welcome and lead are over, like a new player's
  offs.push(onSaveCleared(() => { ticketGate.quietSince = NaN; queueMicrotask(ticketCheck); }));
  offs.push(() => { gone = true; });
  offs.push(registerAskItem({
    id: 'e-ticket', order: 20, label: { zh: '用飞行券飞一次', en: 'Use my flight ticket' }, icon: TicketIcon,
    visible: () => holds('fly-ticket') && !pelicanOut(), onSelect: () => openOverlay('e-ticket'),
  }));

  // the conveniences: a badge / pennants while held; the first matching find ends them
  let badgeOff: (() => void) | null = null, flagsOff: (() => void) | null = null;
  const syncHelpers = () => {
    const c = holds('compass'), m = holds('magnifier');
    if (c && !badgeOff) badgeOff = registerPillBadge({ id: 'e-compass', order: 12, Component: CompassBadge });
    if (!c && badgeOff) { badgeOff(); badgeOff = null; }
    if (m && !flagsOff) flagsOff = registerFlagSource('e-magnifier', () => magnifierSpots().map(p => ({ key: p.id, x: p.x, z: p.z, color: '#e0a94a', glyph: 'Sparkles' as const, priority: 2, far: 900 })));
    if (!m && flagsOff) { flagsOff(); flagsOff = null; }
  };
  syncHelpers();
  offs.push(subscribeLedger(syncHelpers));
  offs.push(onEvent(e => {
    if (e.type === 'find' && e.first && (COMPASS_KINDS as readonly string[]).includes(e.kind) && holds('compass')) {
      if (consume('compass')) sayWhenFree('compassDone', 30);
    }
    if (e.type === 'postcard' && holds('magnifier')) {
      if (consume('magnifier')) sayWhenFree('magnifierDone', 30);
    }
  }));
  offs.push(() => { badgeOff?.(); badgeOff = null; flagsOff?.(); flagsOff = null; dropLines(); });
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* keep tearing down */ } } };
}

/** The compass was just bought: BAYBAY sniffs and points the way. */
export function compassStarted(): void {
  sayWhenFree('compassOn', 20);
}
/** The magnifier was just bought. */
export function magnifierStarted(): void {
  sayWhenFree('magnifierOn', 20);
}

/** The compass arrow's icon (the badge draws it rotated). */
export const CompassGlyph = Compass;
