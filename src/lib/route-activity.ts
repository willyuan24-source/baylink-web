import { unprefixedPath } from './language-path';

/**
 * Route feedback state (UI9-F): the route on screen and the route the address bar asks for. React Router runs navigations
 * in a transition, so once a page is up a lazy page never shows the layout's Suspense fallback: the old page stays until
 * the new one commits. While a page is on screen and the address bar asks for another one, <html data-route-wait> is set
 * and the layout's bar shows (site-chrome.css: 150ms later, 15s at most); no React state is involved.
 */
let shown: string | null = null;     // the route on screen (router path + search); null until the first route commits
let requested: string | null = null; // the address bar's route after the last click, submit, history step or commit

/** One form for both sides: the path without its language prefix, decoded where possible, no trailing slash, + search. */
export const routeKey = (pathname: string, search = ''): string => {
  let path = unprefixedPath(pathname);
  try { path = decodeURI(path); } catch { /* keep the encoded form */ }
  return `${path.replace(/\/+$/, '') || '/'}${search}`;
};

/** The route the address bar asks for now (pushState runs before React Router's transition renders the page). */
export const addressKey = (): string => typeof window === 'undefined' ? '/' : routeKey(window.location.pathname, window.location.search);

const paint = () => { if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-route-wait', routeActivity.navigating()); };

export const routeActivity = {
  /** A route committed (RouteSettled, inside the layout's Suspense): `key` is on screen, the address bar asks for `address`. */
  settle(key: string, address: string = addressKey()): void { shown = key; requested = address; paint(); },
  /** A click, a submit or a history step just ran: the address bar may now ask for another route. */
  request(address: string = addressKey()): void { requested = address; paint(); },
  /**
   * The document listeners that ask again (RouteSettled installs them once the first route is up). A click or a submit is
   * read after the router's own handler (React listens on the root, below document); the capture fallback covers a handler
   * that stops propagation. Returns the cleanup.
   */
  listen(): () => void {
    const request = () => routeActivity.request();
    const later = () => { window.setTimeout(request, 0); };
    const listeners: Array<[EventTarget, string, () => void, boolean]> = [[document, 'click', request, false], [document, 'submit', request, false], [window, 'click', later, true], [window, 'popstate', request, false]];
    for (const [target, type, listener, capture] of listeners) target.addEventListener(type, listener, capture);
    return () => { for (const [target, type, listener, capture] of listeners) target.removeEventListener(type, listener, capture); };
  },
  /** A page is on screen and the address bar asks for another one: the next page is loading. */
  navigating(): boolean { return shown !== null && requested !== null && requested !== shown; },
  /** Forget both routes and clear <html data-route-wait> (RouteSettled unmounted; tests). */
  reset(): void { shown = null; requested = null; paint(); },
};
