import { unprefixedPath } from './language-path';

/**
 * Route feedback state (UI9-F): the route on screen, the route the address bar asks for, and the quiet chunk warms in
 * flight (app/route-warm.ts). React Router runs navigations in a transition, so once a page is up a lazy page never shows
 * the layout's Suspense fallback: the old page stays until the new one commits. RouteProgress draws the top bar from
 * `navigating()`; chunk recovery and the error beacon ask `quietFailure()`, so a warm that fails (a chunk lost to a newer
 * deploy, a dropped connection) neither reloads the page nor reports an error. A real navigation still does both.
 */
type Listener = () => void;
let shown: string | null = null;     // the route on screen (router path + search); null until the first route commits
let requested: string | null = null; // the address bar's route after the last click, submit, history step or commit
let quiet = 0;
const listeners = new Set<Listener>();
const emit = () => { for (const listener of listeners) listener(); };

/** One form for both sides: the path without its language prefix, decoded where possible, no trailing slash, + search. */
export const routeKey = (pathname: string, search = ''): string => {
  let path = unprefixedPath(pathname);
  try { path = decodeURI(path); } catch { /* keep the encoded form */ }
  return `${path.replace(/\/+$/, '') || '/'}${search}`;
};

/** The route the address bar asks for now (pushState runs before React Router's transition renders the page). */
export const addressKey = (): string => typeof window === 'undefined' ? '/' : routeKey(window.location.pathname, window.location.search);

export const routeActivity = {
  subscribe(listener: Listener): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },
  /** A route committed (RouteSettled, inside the layout's Suspense): `key` is on screen, the address bar asks for `address`. */
  settle(key: string, address: string = addressKey()): void {
    if (shown === key && requested === address) return;
    shown = key; requested = address; emit();
  },
  /** A click, a submit or a history step just ran: the address bar may now ask for another route. */
  request(address: string = addressKey()): void {
    if (requested === address) return;
    requested = address; emit();
  },
  /** A page is on screen and the address bar asks for another one: the next page is loading. */
  navigating(): boolean { return shown !== null && requested !== null && requested !== shown; },
  beginQuietWarm(): void { quiet++; },
  endQuietWarm(): void { quiet = Math.max(0, quiet - 1); },
  /** A chunk failed while only a warm wanted it: no navigation is waiting and the first route is up. */
  quietFailure(): boolean { return quiet > 0 && shown !== null && !this.navigating(); },
  /** Tests only. */
  reset(): void { shown = null; requested = null; quiet = 0; emit(); },
};
