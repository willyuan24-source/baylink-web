/**
 * Wave 5 · lane E — the ledger (listens to `reward`, pays once, writes save v2 `play`, emits `coins`), coins in the
 * world, the 小铺, the 手帐 notebook.
 *
 * game/w5Features.ts loads this module lazily in city mode only and calls `init()` once, before the other three
 * features (so the ledger's `reward` listener is live before anyone can emit). `init()` starts everything and returns
 * the function that undoes it. UI goes through ui/slots.ts, sounds through audio/hooks.ts; every other module of this
 * folder stays behind this one (no static import of it from a module GameRoot loads).
 *
 * This chunk stays small (the ledger and the pill badge): the coins in the world (their spots, the pickup, the layer)
 * are a chunk of their own, loaded right after.
 *
 * The public API for other lanes (import it from your own lazy chunk, never from the GameRoot graph):
 *   economy/ledger.ts  coinsTotal() · isPaid(source) · registerRewardIds(prefix, ids) · subscribeLedger(fn)
 *   economy/hints.ts   registerHintSource(kind, fn) · hintTarget(kind, from)
 * and emit `{ type: 'reward', source, coins }` (core/events) to be paid.
 */
import { registerPillBadge } from '../ui/slots';
import { CoinBadge } from './CoinBadge';
import * as hints from './hints';
import * as ledger from './ledger';

/** Lane A's PlayKit looks for this export (play/kit.ts writeBest): an activity best into save v2 `play.b`. */
export const recordBest = (key: string, value: number): void => { ledger.recordBest(key, value); };

export function init(): () => void {
  let gone = false;
  const offs: (() => void)[] = [
    ledger.initLedger(),
    registerPillBadge({ id: 'e-coins', order: 10, Component: CoinBadge }),
  ];
  // the styles (a dynamic import: node — the contracts test loads this module — cannot load .css)
  void import('./economy.css').catch(() => undefined);
  const qa = import.meta.env?.DEV && typeof window !== 'undefined' ? (window as unknown as { __opusBay?: Record<string, unknown> }) : null;
  // DEV / QA: `__opusBay.e` (the ledger, the hints, the coins once loaded)
  const expose = (extra: Record<string, unknown> = {}) => { if (qa) qa.__opusBay = { ...(qa.__opusBay ?? {}), e: { ...((qa.__opusBay?.e as object) ?? {}), ledger, hints, ...extra } }; };
  expose();
  void import('./coins').then(coins => {
    if (gone) return;
    offs.push(coins.initCoins());
    expose({ coins });
  }).catch(error => { if (import.meta.env?.DEV) console.error('[opus-bay economy] coins', error); });
  return () => { gone = true; for (const off of offs.splice(0).reverse()) off(); };
}
