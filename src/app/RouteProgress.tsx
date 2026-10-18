import { useEffect, useState, useSyncExternalStore, type ReactElement } from 'react';
import { routeActivity, routeKey } from '../lib/route-activity';

/**
 * Rendered next to the route inside the layout's Suspense: its effect runs only when the route's content commits (a
 * suspended mount commits nothing, and a transition keeps the old page until the new one is ready), so it marks what is on
 * screen.
 */
export function RouteSettled({ pathname, search }: { pathname: string; search: string }): null {
  const key = routeKey(pathname, search);
  useEffect(() => { routeActivity.settle(key); }, [key]);
  return null;
}

const STALE_MS = 15_000;

/**
 * The route feedback bar (UI9-F): a brand bar at the top while the next page loads, drawn 150ms after the click (the
 * site-route-progress CSS delay), so a page that is already loaded never flashes it. React Router keeps the old page up
 * during the transition, so the bar is driven by the address bar (pushState runs at once) against the route on screen,
 * not by a Suspense fallback. A click, a submit or a history step asks again; a navigation that never commits stops
 * drawing the bar after 15s.
 */
export function RouteProgress(): ReactElement | null {
  const navigating = useSyncExternalStore(routeActivity.subscribe, () => routeActivity.navigating(), () => false);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const request = () => routeActivity.request();
    // After the router's own handler (React listens on the root, below document); the capture fallback covers a handler
    // that stops propagation.
    const later = () => { window.setTimeout(request, 0); };
    document.addEventListener('click', request);
    document.addEventListener('submit', request);
    window.addEventListener('click', later, true);
    window.addEventListener('popstate', request);
    return () => {
      document.removeEventListener('click', request);
      document.removeEventListener('submit', request);
      window.removeEventListener('click', later, true);
      window.removeEventListener('popstate', request);
    };
  }, []);
  useEffect(() => {
    setStale(false);
    if (!navigating) return;
    const timer = window.setTimeout(() => setStale(true), STALE_MS);
    return () => window.clearTimeout(timer);
  }, [navigating]);
  return navigating && !stale ? <div className="site-route-progress" aria-hidden="true" data-testid="route-progress" /> : null;
}
