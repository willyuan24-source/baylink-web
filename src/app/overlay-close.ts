import { useRef } from 'react';
import type { Location, NavigateFunction } from 'react-router-dom';

/**
 * G4 / N3: closing an overlay (/posts/:id, /users/:id and the post's loading, not-found and error shells) must never leave
 * BAYLINK and must not lose the post editor. History −1 is safe only when the overlay's entry was created by this document,
 * because then the entry before it belongs to this document too. The entry a document opens on is different: after a
 * reload, or arriving from WeChat or another site, −1 is a cross-document load (the editor state is gone) or another site.
 * There the overlay is replaced by its background page, or by `fallback` when it has none. `history.state` (with
 * `backgroundLocation` and the router key) survives a reload, so it cannot tell on its own; the layout remembers the first
 * entry it rendered. (A layout that remounts later treats its first entry the same way, which is only more careful.)
 */
export function overlayCloseTarget(location: Pick<Location, 'key' | 'state'>, openingEntryKey: string, fallback: string): -1 | string {
  if (location.key !== openingEntryKey) return -1;
  const background = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;
  return background ? background.pathname + background.search : fallback;
}

/** `closeOverlay(fallback)` for the layout that renders the overlays (AppLayout). */
export function useCloseOverlay(location: Location, navigate: NavigateFunction) {
  const openingEntryKey = useRef(location.key);
  return (fallback: string) => {
    const target = overlayCloseTarget(location, openingEntryKey.current, fallback);
    if (target === -1) navigate(-1);
    else navigate(target, { replace: true });
  };
}
