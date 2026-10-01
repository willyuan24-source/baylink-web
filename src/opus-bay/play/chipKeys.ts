/**
 * Wave 8 · lane K · W8-K8 — the keyboard on the activity chip's hold button (play/PlayChip.tsx; its own module so node
 * tests reach it without PlayChip's css). The games' own keys (play/partc.ts holdKeys) skip a focused BUTTON, so with
 * the focus on 放线 (tabbed to, or still focused after a click) the button holds on these keys itself.
 */

/** the keys that hold the chip's hold button while it has the focus */
export const CHIP_HOLD_KEYS: readonly string[] = ['Space', 'Enter', 'KeyE'];

/** What a key does to the hold: true / false to set it, null to leave the hold alone (another key, a key repeat). */
export function chipHoldKey(code: string, down: boolean, repeat: boolean): boolean | null {
  if (!CHIP_HOLD_KEYS.includes(code)) return null;
  return down && repeat ? null : down;
}
