import { createElement, useEffect, type ReactElement } from 'react';
import { routePathname } from './route-table';

// No blank frame at boot (quality lens §2.4, perf-cold `blankMainAt`): the app replaces the prerendered page in one commit,
// and the first route's lazy page can still suspend for a frame while its (already loaded) chunk settles. Until it does, the
// layout's Suspense fallback is the prerendered <main> content itself, inside the same chrome, instead of a spinner.

let boot: { path: string; html: string } | null = null;

/**
 * main.tsx, before the first render: keep the prerendered <main> when it was rendered for this URL. SiteChrome stamps
 * `data-prerender-path` on the prerendered <main> only; an SPA URL served the home page's HTML (e.g. /me) never matches.
 */
export function captureBootMain(): void {
  if (typeof document === 'undefined') return;
  const main = document.querySelector<HTMLElement>('#root main[data-prerender-path]');
  const path = routePathname(window.location.pathname);
  boot = main && main.dataset.prerenderPath === path && main.innerHTML.trim() ? { path, html: main.innerHTML } : null;
}

/** A page prerendered for this URL was captured (boot.ts keeps it on screen when only the dictionary failed). */
export function hasBootMain(): boolean {
  return boot !== null;
}

/** The prerendered content while the boot route is still suspended; null afterwards or on any other route. */
export function bootMainFallback(pathname: string): ReactElement | null {
  if (!boot) return null;
  if (routePathname(pathname) !== boot.path) { boot = null; return null; }
  return createElement('div', { className: 'site-boot-main', dangerouslySetInnerHTML: { __html: boot.html } });
}

/** The first route has rendered: from now on a suspension shows the spinner, never the (possibly stale) boot snapshot. */
export function clearBootMain(): void {
  boot = null;
}

/**
 * Rendered next to the route inside the layout's Suspense. Its effect runs only once the boundary's content commits (a
 * suspended mount commits nothing), i.e. when the first route is on screen. After that, a lazy section suspending on the
 * same path, or a language switch (the router path stays unprefixed), shows the spinner instead of the old snapshot.
 */
export function BootMainSettled(): null {
  useEffect(clearBootMain, []);
  return null;
}
