import { createElement, useEffect, useLayoutEffect, type ReactElement } from 'react';
import { matchRoute, routePathname } from './route-table';

// No blank frame at boot (quality lens §2.4, perf-cold `blankMainAt`): the app replaces the prerendered page in one commit,
// and the first route's lazy page can still suspend for a frame while its (already loaded) chunk settles. Until it does, the
// layout's Suspense fallback is the prerendered <main> content itself, inside the same chrome, instead of a spinner.

// `exact`: prerendered for this very URL. Two prerendered files stand for many URLs and are kept as the first route's
// Suspense fallback there too, so the reader never sees the layout's empty route-wait box (and the footer never jumps when
// the page arrives): account-shell.html, prerendered once for /me and served for every account page (app/account-shell.ts),
// and 404.html, prerendered for /404 and served for every URL that is not an app page. They are not those URLs' own pages,
// so boot.ts must not keep them on screen as one (hasBootMain).
let boot: { path: string; html: string; exact: boolean } | null = null;
// The account shell is a full screen tall (me-hub.css), so its footer starts below the fold. A short page replacing it (the
// guest views of /me/bookings and /messages) would pull the footer up into the window: a layout shift. So the page that
// replaces the shell keeps the shell's promise for this visit, and no more than that: <main> is at least tall enough that
// the footer starts just below the fold (100vh, as .site-route-wait in site-chrome.css: below it in every phone toolbar
// state), until the reader leaves the boot path. A page that already ends below the fold (/me) keeps its own end and its
// pre-footer gap.
let shellHold: string | null = null;
let shellHoldHeight: string | null = null;

/**
 * main.tsx, before the first render: keep the prerendered <main> when it was rendered for this URL, or when it is the
 * account shell or the 404 page standing in for it. SiteChrome stamps `data-prerender-path` on the prerendered <main> only;
 * an SPA URL served the home page's HTML (e.g. /users/1) never matches. Each stand-in is told by its own root element, as
 * prerendered: the shell's `.account-shell`, and the 404's `.nf-page` only when the route table resolves this URL to no
 * page (the router's `*` route), so a detail URL with a missing id, whose page renders the 404 itself, keeps no snapshot.
 */
export function captureBootMain(): void {
  if (typeof document === 'undefined') return;
  boot = null;
  shellHold = null;
  shellHoldHeight = null;
  const main = document.querySelector<HTMLElement>('#root main[data-prerender-path]');
  if (!main || !main.innerHTML.trim()) return;
  const path = routePathname(window.location.pathname);
  const exact = main.dataset.prerenderPath === path;
  const accountShell = !!main.querySelector(':scope > .account-shell');
  const notFound = !!main.querySelector(':scope > .nf-page') && !matchRoute(path);
  if (exact || accountShell || notFound) boot = { path, html: main.innerHTML, exact };
  if (accountShell) shellHold = path;
}

/** A page prerendered for this very URL was captured (boot.ts keeps it on screen when only the dictionary failed). */
export function hasBootMain(): boolean {
  return boot?.exact === true;
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
  useLayoutEffect(holdShellHeight);
  useEffect(clearBootMain, []);
  return null;
}

/**
 * After every commit of the layout (it re-renders on each location change), before paint: on the boot path that opened on
 * the account shell, <main> keeps the footer below the fold; on any other path the hold is gone for good. The height is
 * measured once, on the first page's commit with no hold on: 100vh less where <main> starts and the step from its end to
 * the footer's top (the 12px footer step), less 1px so rounding never lets the footer's top edge into the window.
 */
function holdShellHeight(): void {
  if (!shellHold) return;
  const main = document.querySelector<HTMLElement>('#root main');
  if (!main) return;
  if (routePathname(window.location.pathname) !== shellHold) {
    main.style.removeProperty('min-height');
    shellHold = null;
    shellHoldHeight = null;
    return;
  }
  if (!shellHoldHeight) {
    main.style.removeProperty('min-height');
    const box = main.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>('footer.site-footer');
    const step = footer ? Math.max(0, footer.getBoundingClientRect().top - box.bottom) : 0;
    shellHoldHeight = `calc(100vh - ${Math.max(0, Math.floor(box.top + window.scrollY + step) - 1)}px)`;
  }
  main.style.setProperty('min-height', shellHoldHeight);
}
