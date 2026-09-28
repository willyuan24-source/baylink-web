import { emit } from '../core/events';
import { bitGet, bitSet, MAX_WEAR_INDEX, WEAR_SLOTS, type PlaySaveV1, type WearSlot } from '../data/playSave';
import { bitClear } from './bits';
import { commitPlay, playState } from './ledger';
import { forSale, itemAt, itemById, itemIndex, TICKET_REFUND, type ItemDef, type UseKind } from './items';

/**
 * Wave 5 · lane E · W5-E6: what the 小铺 does to the play save (the ledger stays its only writer: commitPlay). No UI, no
 * three.js — economy/Shop.tsx and economy/shopRun.ts call it, the tests drive it directly.
 *
 *   owns(id)             bought, earned, or (a convenience) one is held now
 *   wornItem(slot)       the item worn in a wear slot (null = the default look)
 *   buy(id, ctx)         pays the price, marks it owned, wears a wearable at once; 'ok' | why not
 *   wear(id) / takeOff(slot)
 *   grant(id)            an earned item (a full notebook page) or BAYBAY's gift: owned for free, once
 *   consume(id)            a held convenience is used: its bit clears (the compass found something, a ticket flew)
 *   ticketRule(unlocked) the 飞行券 after the pelican unlock: an unused ticket gives back 10 金币, once
 *
 * The ticket is on sale only before the pelican is unlocked (plan §3.4, VOICE.md 飞行券): the caller passes whether it
 * is (`ctx.pelican`). Nothing here buys speed, access or places.
 */

export type BuyResult = 'ok' | 'unknown' | 'not-for-sale' | 'owned' | 'short' | 'after-pelican';

const own = (p: Readonly<PlaySaveV1>, i: number) => i >= 0 && bitGet(p.g.own, i);

export function owns(id: string, p: Readonly<PlaySaveV1> = playState()): boolean { return own(p, itemIndex(id)); }

/** The item worn in `slot` (an owned, not retired wearable of that slot), else null. */
export function wornItem(slot: WearSlot, p: Readonly<PlaySaveV1> = playState()): ItemDef | null {
  const i = p.w?.[slot];
  const it = i === undefined ? undefined : itemAt(i);
  return it && it.slot === slot && !it.retired && own(p, i!) ? it : null;
}

/** Every slot's worn item id (null = default). */
export function wornAll(p: Readonly<PlaySaveV1> = playState()): Record<WearSlot, string | null> {
  return Object.fromEntries(WEAR_SLOTS.map(s => [s, wornItem(s, p)?.id ?? null])) as Record<WearSlot, string | null>;
}

/** Is a convenience of this kind held now (one at a time)? */
export const holds = (use: UseKind, p: Readonly<PlaySaveV1> = playState()): boolean => owns(use, p);

/** Can this item be bought right now, and if not, why not. */
export function canBuy(id: string, ctx: { pelican: boolean }, p: Readonly<PlaySaveV1> = playState()): BuyResult {
  const it = itemById(id);
  if (!it) return 'unknown';
  if (!forSale(it)) return 'not-for-sale';
  if (it.use === 'fly-ticket' && ctx.pelican) return 'after-pelican';
  if (owns(id, p)) return 'owned';
  if (p.c < it.price) return 'short';
  return 'ok';
}

/** Buy `id`: the price comes off the balance, the item is owned (a wearable is worn at once). Emits coins + shop. */
export function buy(id: string, ctx: { pelican: boolean }): BuyResult {
  const why = canBuy(id, ctx);
  if (why !== 'ok') return why;
  const it = itemById(id)!, i = itemIndex(id);
  const wearIt = it.slot !== 'use';
  const done = commitPlay(p => {
    if (canBuy(id, ctx, p) !== 'ok') return null;
    const next: PlaySaveV1 = { ...p, c: p.c - it.price, g: { ...p.g, own: bitSet(p.g.own, i) } };
    if (wearIt && i <= MAX_WEAR_INDEX) next.w = { ...(p.w ?? {}), [it.slot]: i };
    return next;
  }, `shop:${id}`);
  if (!done) return 'short';
  emit({ type: 'shop', what: 'buy', item: id });
  if (wearIt) emit({ type: 'shop', what: 'wear', item: id });
  return 'ok';
}

/** Wear an owned wearable (false: not owned / not a wearable). */
export function wear(id: string): boolean {
  const it = itemById(id), i = itemIndex(id);
  if (!it || it.slot === 'use' || it.retired || i > MAX_WEAR_INDEX) return false;
  const done = commitPlay(p => (own(p, i) && p.w?.[it.slot as WearSlot] !== i ? { ...p, w: { ...(p.w ?? {}), [it.slot]: i } } : null));
  if (done) emit({ type: 'shop', what: 'wear', item: id });
  return done || wornItem(it.slot as WearSlot)?.id === id;
}

/** Back to the default look in `slot`. */
export function takeOff(slot: WearSlot): boolean {
  const done = commitPlay(p => {
    if (p.w?.[slot] === undefined) return null;
    const w = { ...p.w };
    delete w[slot];
    const next: PlaySaveV1 = { ...p, w };
    if (!Object.keys(w).length) delete next.w;
    return next;
  });
  if (done) emit({ type: 'shop', what: 'wear', item: `${slot}:none` });
  return done;
}

/** An item given, not bought (a full page's cosmetic, BAYBAY's gift): owned once; false when already owned. */
export function grant(id: string): boolean {
  const i = itemIndex(id);
  if (i < 0) return false;
  return commitPlay(p => (own(p, i) ? null : { ...p, g: { ...p.g, own: bitSet(p.g.own, i) } }));
}

/** A held convenience is used (its bit clears); false when none was held. */
export function consume(id: string): boolean {
  const it = itemById(id), i = itemIndex(id);
  if (!it || it.slot !== 'use') return false;
  return commitPlay(p => (own(p, i) ? { ...p, g: { ...p.g, own: bitClear(p.g.own, i) } } : null));
}

/**
 * BAYBAY's first 飞行券 (plan §3.4 "BAYBAY gives the first one free"): before the pelican unlock, once per save, a ticket
 * held for free. True when it was given now (say her line); false when given before, the pelican is out, or one is held.
 */
export function giveFirstTicket(pelican: boolean): boolean {
  if (pelican) return false;
  const gift = itemIndex('fly-gift'), ticket = itemIndex('fly-ticket');
  return commitPlay(p => (own(p, gift) ? null : { ...p, g: { ...p.g, own: bitSet(bitSet(p.g.own, gift), ticket) } }));
}

/**
 * After the pelican unlock the ticket is hidden and an unused one gives back 10 金币 (once: the bit clears in the same
 * write). Returns the coins given back (0: none held, or the pelican is not out yet).
 */
export function ticketRule(pelican: boolean): number {
  if (!pelican) return 0;
  const i = itemIndex('fly-ticket');
  const done = commitPlay(p => (own(p, i) ? { ...p, c: p.c + TICKET_REFUND, g: { ...p.g, own: bitClear(p.g.own, i) } } : null), 'shop:fly-ticket');
  return done ? TICKET_REFUND : 0;
}
