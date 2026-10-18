import { pageLoaders } from '../route-loaders';
import { matchRoute, type PageKey } from './route-table';
import { unprefixedPath } from '../lib/language-path';
import { routeActivity } from '../lib/route-activity';

/**
 * Route feedback (UI9-F): start a page's chunk a moment before the tap lands. A mouse warms after resting 80ms on an
 * in-site link (a pass over the nav warms nothing) or at once on press; a finger or pen warms when it has stayed 80ms on
 * the link without the browser taking it for a scroll (pointercancel). Nothing is warmed offline or with Save-Data, the 3D
 * world (a full page load) never is, and a warm that fails is quiet (lib/route-activity.ts): no reload, no error beacon,
 * and no second try for that page in this tab. The loaders are the app's cached promises, so a warmed page costs nothing
 * when it is opened.
 */
const INTENT_MS = 80;
const failed = new Set<PageKey>();

/** The page an in-site link opens, when it may be warmed: same origin, same tab, not a download, not the 3D world. */
export function warmablePage(target: EventTarget | null): PageKey | null {
  const link = typeof Element !== 'undefined' && target instanceof Element ? target.closest('a[href]') as HTMLAnchorElement | null : null;
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download') || link.origin !== window.location.origin) return null;
  const page = matchRoute(unprefixedPath(link.pathname))?.page;
  return page && page !== 'opus' ? page : null;
}

const connectionAllows = () => {
  if (typeof navigator === 'undefined' || navigator.onLine === false) return false;
  return !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
};

/** Load a page chunk quietly. A failure is remembered for this tab and reported nowhere. */
export function warmPage(page: PageKey, load: () => Promise<unknown> = pageLoaders[page]): void {
  if (failed.has(page) || !connectionAllows()) return;
  routeActivity.beginQuietWarm();
  let pending: Promise<unknown>;
  try { pending = load(); } catch (error) { pending = Promise.reject(error); }
  void pending.catch(() => { failed.add(page); }).finally(() => routeActivity.endQuietWarm());
}

/** Tests only. */
export const forgetFailedWarms = () => failed.clear();

/** The document-level listeners (AppLayout). Returns the cleanup. */
export function installRouteWarm(): () => void {
  let timer: number | undefined;
  const cancel = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
  const later = (page: PageKey) => { cancel(); timer = window.setTimeout(() => { timer = undefined; warmPage(page); }, INTENT_MS); };
  const over = (event: PointerEvent) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const page = warmablePage(event.target);
    if (page) later(page); else cancel();
  };
  const down = (event: PointerEvent) => {
    const page = warmablePage(event.target);
    if (!page) return;
    if (!event.pointerType || event.pointerType === 'mouse') { cancel(); warmPage(page); } else later(page);
  };
  const options = { passive: true, capture: true } as const;
  document.addEventListener('pointerover', over, options);
  document.addEventListener('pointerdown', down, options);
  document.addEventListener('pointercancel', cancel, options);
  return () => {
    cancel();
    document.removeEventListener('pointerover', over, options);
    document.removeEventListener('pointerdown', down, options);
    document.removeEventListener('pointercancel', cancel, options);
  };
}
