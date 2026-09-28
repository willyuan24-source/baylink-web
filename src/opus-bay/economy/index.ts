/**
 * Wave 5 · lane E — the ledger (listens to `reward`, pays once, writes save v2 `play`, emits `coins`), coins in the
 * world, the 小铺, the 手帐 notebook.
 *
 * game/w5Features.ts loads this module lazily in city mode only and calls `init()` once, before the other three
 * features (so the ledger's `reward` listener is live before anyone can emit). `init()` starts everything and returns
 * the function that undoes it. UI goes through ui/slots.ts, sounds through audio/hooks.ts; every other module of this
 * folder stays behind this one (no static import of it from a module GameRoot loads).
 *
 * The public API for other lanes (import it from your own lazy chunk, never from the GameRoot graph):
 *   economy/ledger.ts  coinsTotal() · isPaid(source) · registerRewardIds(prefix, ids) · subscribeLedger(fn)
 *   economy/hints.ts   registerHintSource(kind, fn) · hintTarget(kind, from)
 * and emit `{ type: 'reward', source, coins }` (core/events) to be paid.
 */
import * as ledger from './ledger';

export function init(): () => void {
  const offs: (() => void)[] = [ledger.initLedger()];
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    // DEV / QA: the ledger as `__opusBay.e.ledger` (QA scripts read the balance, pay a test source, check a source)
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), e: { ledger } };
  }
  return () => { for (const off of offs.splice(0).reverse()) off(); };
}
