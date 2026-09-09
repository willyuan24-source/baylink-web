import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Location } from 'react-router-dom';

/** Page navigation resets scroll; browser Back and modal backgrounds retain their place. */
export function usePageScroll(location: Location) {
  const background = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;
  const page = background || location;
  // Native hash entries can share the router's "default" key. Keep their URLs distinct.
  const pageKey = `${page.key}:${page.pathname}${page.search}${page.hash}`;
  const hash = page.hash;
  const currentKey = useRef<string | null>(null);
  const positions = useRef(new Map<string, number>());
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    const original = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const save = () => {
      // A short loading placeholder may clamp scrollY. Keep the requested saved position.
      if (currentKey.current && !pending.current) positions.current.set(currentKey.current, window.scrollY);
    };
    const stopForUser = () => { pending.current?.(); save(); };
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('wheel', stopForUser, { passive: true });
    window.addEventListener('touchstart', stopForUser, { passive: true });
    window.addEventListener('pointerdown', stopForUser, { passive: true });
    window.addEventListener('keydown', stopForUser);
    return () => {
      pending.current?.();
      window.removeEventListener('scroll', save);
      window.removeEventListener('wheel', stopForUser);
      window.removeEventListener('touchstart', stopForUser);
      window.removeEventListener('pointerdown', stopForUser);
      window.removeEventListener('keydown', stopForUser);
      window.history.scrollRestoration = original;
    };
  }, []);

  useLayoutEffect(() => {
    // StrictMode restarts effects; an unresolved initial hash still needs its observer.
    if (currentKey.current === pageKey && positions.current.has(pageKey)) return;
    const initial = currentKey.current === null;
    currentKey.current = pageKey;
    if (initial && !hash) {
      positions.current.set(pageKey, window.scrollY);
      return;
    }

    // The nested <Routes location={background}> reports POP even for pushes.
    // New entries have new keys; only returning to a previously visited entry restores it.
    const saved = positions.current.get(pageKey);
    let resizeObserver: ResizeObserver | undefined;
    let mutationObserver: MutationObserver | undefined;
    const stop = () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (pending.current === stop) pending.current = null;
    };
    const restore = () => {
      if (pending.current !== stop) return;
      if (saved == null && hash) {
        let id = hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* A malformed hash is still a valid literal id. */ }
        const target = document.getElementById(id);
        if (!target) return;
        // Honor the page's scroll-margin and the shell's scroll-padding.
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else {
        const top = saved ?? 0;
        window.scrollTo({ top, behavior: 'instant' });
        if (Math.abs(window.scrollY - top) > 1) return;
      }
      positions.current.set(pageKey, window.scrollY);
      stop();
    };
    pending.current = stop;
    restore();
    if (pending.current === stop) {
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(restore);
        resizeObserver.observe(document.body);
        resizeObserver.observe(document.documentElement);
      }
      if (typeof MutationObserver !== 'undefined') {
        mutationObserver = new MutationObserver(restore);
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      }
    }
    return stop;
  }, [pageKey, hash]);
}
