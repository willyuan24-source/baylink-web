/**
 * Recover from an outdated deployment's missing module (old chunks return 404 after a deploy) with one reload per page
 * per 5 minutes, without reload loops. Offline readers are not reloaded (their import fails as usual and the page shows
 * its own retry).
 */
export function installChunkRecovery(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', event => {
    if (!navigator.onLine) return;
    const key = `baylink.chunk-reload:${location.pathname}`;
    try {
      const previous = Number(sessionStorage.getItem(key));
      if (previous && Date.now() - previous < 5 * 60_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch { return; }
    event.preventDefault();
    location.reload();
  });
}

/**
 * REG-15: once the reload above is scheduled, Vite resolves the failed import with `undefined` (the prevented error), which
 * React.lazy turns into a TypeError on the error page just before the reload. Hand lazy() a promise that never settles
 * instead: the Suspense fallback stays up until the fresh page replaces this one.
 */
export function settleChunk<T>(module: T): T | Promise<T> {
  return module === undefined ? new Promise<T>(() => {}) : module;
}

/**
 * A lazy chunk loader: one retry after a second (a brief network drop or a deploy swapping files), then the REG-15 guard.
 * For React.lazy(() => …) and for on-demand overlays.
 */
export function lazyChunk<T>(load: () => Promise<T>): () => Promise<T> {
  return () => load()
    .catch(() => new Promise<void>(resolve => setTimeout(resolve, 1000)).then(load))
    .then(settleChunk);
}
