// N24: a dialog closed from inside plays its exit before it unmounts (UI9-R1-OVERLAYS). Kept out of Modal.tsx so that
// module exports components only (react-refresh); every dialog, the toast and the confirm card import it from here.
import { useEffect, useRef, useState } from 'react';

/**
 * N24: how long a dialog's exit plays before it unmounts: --dur-2, the Tailwind dialogs' `duration-150` (tailwind.config.js)
 * and the feedback sheet's exit (feedback.css), so nothing invisible stays over the page after its exit has played.
 */
export const EXIT_MS = 160;
/** Nothing to wait for: reduced motion and 简洁显示 set every --dur-* to 0 (tokens.css); so does a page without matchMedia. */
export const instantExit = () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-simple');

/**
 * N24: a dialog closed from inside (✕, Esc, the scrim, 取消) plays its exit before it goes. `close()` turns `closing` on (the
 * caller adds .is-closing or its animate-out classes) and calls onClose `ms` later; at once when instantExit(). Calls while
 * it is leaving do nothing.
 */
export function useClosing(onClose: () => void, ms = EXIT_MS): [closing: boolean, close: () => void] {
  const [closing, setClosing] = useState(false);
  const latest = useRef(onClose);
  useEffect(() => { latest.current = onClose; });
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [closing, () => {
    if (timer.current !== undefined) return;
    if (instantExit()) { latest.current(); return; }
    setClosing(true);
    timer.current = window.setTimeout(() => latest.current(), ms);
  }];
}
