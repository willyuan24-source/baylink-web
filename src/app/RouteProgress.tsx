import { useEffect } from 'react';
import { routeActivity, routeKey } from '../lib/route-activity';

/**
 * Route feedback (UI9-F). Rendered next to the route inside the layout's Suspense: its effect runs only when the route's
 * content commits (a suspended mount commits nothing, and a transition keeps the old page until the new one is ready), so
 * it marks what is on screen, and once the first route is up it listens for the clicks, submits and history steps that
 * may ask for another one (lib/route-activity.ts). The bar itself is the layout's `.site-route-bar`, shown by CSS while
 * <html data-route-wait> is set: a brand bar at the top 150ms after the click (so a page that is already loaded never
 * flashes it), gone when the next page commits, and hidden after 15s if it never does (site-chrome.css).
 */
export function RouteSettled({ pathname, search }: { pathname: string; search: string }): null {
  const key = routeKey(pathname, search);
  // Unmounted (a link out of the layout to the 3D world, or the root error page after a page's code failed to load):
  // nothing of the layout is loading any more, so <html data-route-wait> goes with it.
  useEffect(() => { const stop = routeActivity.listen(); return () => { stop(); routeActivity.reset(); }; }, []);
  useEffect(() => { routeActivity.settle(key); }, [key]);
  return null;
}
