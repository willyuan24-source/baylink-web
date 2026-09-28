/**
 * Wave 5 · lane R — the real San Francisco: the sun, events at their venues, 今天 · SF Today, 今日三件小事, Fleet Week.
 *
 * Day-0 stub (the lead): game/w5Features.ts loads this module lazily in city mode only and calls `init()` once
 * (the economy first). Lane R replaces the body; the signature is frozen: `init()` starts everything and returns
 * the function that undoes it. Register UI through ui/slots.ts, sounds through audio/hooks.ts, and keep every other
 * module of this folder behind this one (no static import of it from a module GameRoot loads).
 */
export function init(): () => void {
  return () => {};
}
