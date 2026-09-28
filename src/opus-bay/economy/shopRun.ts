import { createElement } from 'react';
import { Compass, Store, Ticket } from 'lucide-react';
import { glideUnlocked, subscribeGlide } from '../actors/moveApi';
import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { DISTRICT } from '../data/district';
import { POSTCARDS } from '../data/postcards';
import { readSave } from '../data/save';
import { startTravel, travelActive } from '../game/fastTravel';
import { closePanel } from '../game/flow';
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
import { giveFirstTicket, holds, ticketRule, consume } from './wallet';

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

  // the 飞行券: BAYBAY's first one (once per save, before the pelican), the refund after the unlock
  const ticketCheck = () => {
    const out = pelicanOut();
    if (ticketRule(out) > 0) sayWhenFree('ticketRefund');
  };
  if (giveFirstTicket(pelicanOut())) sayWhenFree('ticketGift', 300, 5200);
  ticketCheck();
  offs.push(subscribeGlide(ticketCheck));
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
