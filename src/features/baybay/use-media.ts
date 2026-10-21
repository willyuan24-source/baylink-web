import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query matches now (false without matchMedia: tests, old browsers, prerender). */
export function useMedia(query: string): boolean {
  const list = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
  const subscribe = useCallback((notify: () => void) => {
    const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
    media?.addEventListener?.('change', notify);
    return () => media?.removeEventListener?.('change', notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => !!list()?.matches, () => false);
}
