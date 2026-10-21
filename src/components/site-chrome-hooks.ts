// Chrome behaviour shared by the header (SiteNavigation) and the phone tab bar (SiteMobileNavigation), UI9-NAV.
import { useEffect, useState, type PointerEvent } from 'react';
import { preloadBayBay } from '../app/baybay-preload';

/** Warm the BayBay panel's chunk as soon as a pointer or the keyboard reaches a 问 BayBay trigger (BB launcher item d). */
export const bayBayWarmup = { onPointerEnter: preloadBayBay, onPointerDown: preloadBayBay, onFocus: preloadBayBay };

/**
 * The tapped primary link answers at once (G21): it takes a pending look on pointerdown and keeps it until the route
 * changes (aria-current still comes from the pathname). A press that leaves the link without a click lets go, and a
 * ctrl / ⌘ / shift / alt press (a new tab or window, a download) never takes it: this page does not change.
 */
export function usePendingLink(pathname: string) {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { setPending(null); }, [pathname]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(null), 15000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  const release = (href: string) => setPending(value => value === href ? null : value);
  return (href: string, current: boolean) => current ? {} : {
    'data-pending': pending === href ? '' : undefined,
    onPointerDown: (event: PointerEvent) => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) setPending(href); },
    onPointerCancel: () => release(href),
    // Still pressed while leaving: a drag away, not a tap (a finger lifts before its pointerleave).
    onPointerLeave: (event: PointerEvent) => { if (event.buttons) release(href); },
  };
}
