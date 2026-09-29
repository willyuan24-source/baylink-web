import { useSyncExternalStore } from 'react';

/**
 * W6-K2 · "the More menu is open" for the rest of the HUD (the wave-4 / wave-5 open item: on a 390 × 844 phone the
 * ARRIVED card, 72 px above the phone bar, covered the 更多 menu's upper rows — 拍照 / 小铺 under the card). The menu
 * wins: while any More menu is open (the phone bar's ··· and the desktop 更多 button) the arrival card steps back and its
 * 6 s timer waits; it comes back with the time it had left when the menu closes.
 *
 *   useEffect(() => (open ? holdMoreMenu() : undefined), [open]);   // the menu's owner
 *   const menuOpen = useMoreMenuOpen();                               // a card that must give way
 */

let open = 0;
const subs = new Set<() => void>();
const notify = () => { for (const fn of [...subs]) fn(); };

/** A More menu opened: returns its close (idempotent). */
export function holdMoreMenu(): () => void {
  open++;
  notify();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    open = Math.max(0, open - 1);
    notify();
  };
}

/** Is a More menu open now? */
export const moreMenuOpen = (): boolean => open > 0;

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

/** React: true while a More menu is open. */
export function useMoreMenuOpen(): boolean {
  return useSyncExternalStore(subscribe, moreMenuOpen, moreMenuOpen);
}
