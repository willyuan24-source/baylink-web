/**
 * Wave 5 · lane E — the ledger (listens to `reward`, pays once, writes save v2 `play`, emits `coins`), coins in the
 * world, the 小铺, the 手帐 notebook.
 *
 * Day-0 stub (the lead): game/w5Features.ts loads this module lazily in city mode only and calls `init()` once
 * (the economy first). Lane E replaces the body; the signature is frozen: `init()` starts everything and returns
 * the function that undoes it. Register UI through ui/slots.ts, sounds through audio/hooks.ts, and keep every other
 * module of this folder behind this one (no static import of it from a module GameRoot loads).
 */
export function init(): () => void {
  return () => {};
}
