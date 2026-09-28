/**
 * Wave 5 · lane D — the 24 real San Francisco easter eggs (小发现), their hosts, fact cards and rumours.
 *
 * Day-0 stub (the lead): game/w5Features.ts loads this module lazily in city mode only and calls `init()` once
 * (the economy first). Lane D replaces the body; the signature is frozen: `init()` starts everything and returns
 * the function that undoes it. Register UI through ui/slots.ts, sounds through audio/hooks.ts, and keep every other
 * module of this folder behind this one (no static import of it from a module GameRoot loads).
 */
export function init(): () => void {
  return () => {};
}
