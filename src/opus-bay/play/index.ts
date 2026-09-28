/**
 * Wave 5 · lane A — PlayKit and the activities (emotes, pet, sit and the view spots, the first flight, slides, the
 * bell riff, stair races …).
 *
 * Day-0 stub (the lead): game/w5Features.ts loads this module lazily in city mode only and calls `init()` once
 * (the economy first). Lane A replaces the body; the signature is frozen: `init()` starts everything and returns
 * the function that undoes it. Register UI through ui/slots.ts, sounds through audio/hooks.ts, and keep every other
 * module of this folder behind this one (no static import of it from a module GameRoot loads).
 */
export function init(): () => void {
  return () => {};
}
