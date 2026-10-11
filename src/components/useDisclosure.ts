import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A header menu built on <details> (更多, language, the desktop account menu). The panel stays in the DOM while closed,
 * so the prerendered header and the OPUS contract can read it (RC-8 ii), and it opens natively before the app boots.
 * It closes after a navigation, on a pointer or focus outside it, and on Escape (focus returns to its summary).
 */
export function useDisclosure() {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const dismissOutside = (event: Event) => {
      const menu = details.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const dismissWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.current?.open) return;
      event.preventDefault();
      details.current.open = false;
      summary.current?.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissWithKeyboard);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissWithKeyboard);
    };
  }, []);

  /** Closes the menu; focus goes back to the summary when it was inside the menu (a keyboard or screen-reader choice). */
  const close = () => {
    const menu = details.current;
    if (!menu) return;
    const focusInside = menu.contains(document.activeElement) && document.activeElement !== summary.current;
    if (focusInside) summary.current?.focus({ preventScroll: true });
    menu.open = false;
  };
  /** Closes the menu and puts focus on its summary first, so focus never stays inside a collapsed panel. */
  const closeToSummary = () => {
    summary.current?.focus({ preventScroll: true });
    if (details.current) details.current.open = false;
  };
  return { details, summary, close, closeToSummary };
}
