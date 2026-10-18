import { createElement, lazy, useState, type ComponentProps, type ComponentType } from 'react';

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
 *
 * It must see the module itself: in `import(…).then(m => ({ default: m.X }))` the mapping reads `undefined.X` and throws
 * first, so a loader that picks a named export settles the raw module before picking (`chunkLoader`, or
 * `import(…).then(settleChunk).then(…)`).
 */
export function settleChunk<T>(module: T): T | Promise<T> {
  return module === undefined ? new Promise<T>(() => {}) : module;
}

/** Errors that came from loading code (the chunk is unreachable), as opposed to code that loaded and then threw. */
const loadFailures = new WeakSet<object>();
export const isChunkLoadFailure = (error: unknown): boolean => typeof error === 'object' && error !== null && loadFailures.has(error);

/**
 * The chunk named in a failed dynamic import, when the browser says which (Chrome and Firefox put the URL in the message;
 * Safari does not). Only this site's own built scripts qualify.
 */
export function lostChunkUrl(error: unknown): string | null {
  if (typeof location === 'undefined') return null;
  const named = String((error as { message?: unknown } | null)?.message ?? '').match(/https?:\/\/[^\s'"]+?\.js(?=[?#\s'"]|$)/)?.[0];
  if (!named) return null;
  try {
    const url = new URL(named);
    return url.origin === location.origin && url.pathname.startsWith('/assets/') ? url.origin + url.pathname : null;
  } catch { return null; }
}

/** How a lost chunk is fetched again under a new URL (tests replace it: Node cannot import over https). */
export const chunkRefetch = { import: (url: string): Promise<unknown> => import(/* @vite-ignore */ url) };

/**
 * A guarded chunk loader: one retry after a second (a brief network drop or a deploy swapping files), then the REG-15
 * guard on the module itself, then `pick` (a named export, or the module). A load that still fails is marked
 * (`isChunkLoadFailure`) and rejects with its first error (one fingerprint for the beacon).
 *
 * The browser keeps a failed `import()` for the page's lifetime: asking for the same URL again rejects at once, without a
 * request. So when the error names the lost chunk, the retry asks for it under a new URL (`?retry=<time>`: the same file,
 * a fresh module record), and a dialog opened again after a failure really loads again. Without a URL (Safari) the retry
 * calls `load` again.
 */
export function chunkLoader<M, T>(load: () => Promise<M>, pick: (module: M) => T, retryMs = 1000): () => Promise<T> {
  const retry = (error: unknown) => new Promise<void>(resolve => setTimeout(resolve, retryMs)).then(() => {
    const url = lostChunkUrl(error);
    return (url ? chunkRefetch.import(`${url}?retry=${Date.now()}`) as Promise<M> : load()).catch(() => { throw error; });
  });
  return () => load()
    .catch(retry)
    .catch((error: unknown) => {
      const failure = typeof error === 'object' && error !== null ? error : new Error(String(error));
      loadFailures.add(failure);
      throw failure;
    })
    .then(settleChunk)
    .then(pick);
}

/** Lost dialog chunks waiting to be asked for again (see lazyChunk). */
const lost = new Set<() => void>();

/**
 * Forget every dialog whose chunk failed to load, so the next time it opens it loads again. OverlayBoundary calls this once
 * it has caught the failure: React.lazy keeps a rejected load for good, and forgetting any earlier (while the failed
 * dialog is still re-rendering to throw) would start a fresh load from that very render, over and over while offline.
 */
export function forgetLostChunks(): void {
  for (const forget of lost) forget();
  lost.clear();
}

/**
 * React.lazy for an on-demand dialog: the chunk loads through chunkLoader (retry, REG-15, the named export picked after the
 * guard), and a load that failed is not kept for good — once forgetLostChunks() runs, the next mount (the dialog opened
 * again) asks again with a fresh lazy().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own constraint
export function lazyChunk<M, C extends ComponentType<any>>(load: () => Promise<M>, pick: (module: M) => C, retryMs = 1000): C {
  const loader = chunkLoader(load, module => ({ default: pick(module) }), retryMs);
  const make = () => lazy(() => loader().catch((error: unknown) => {
    lost.add(() => { current = make(); });
    throw error;
  }));
  let current = make();
  function LazyChunk(props: ComponentProps<C>) {
    // The lazy current at mount: a re-render never restarts a load; a new mount after forgetLostChunks() does.
    const [Lazy] = useState(() => current);
    return createElement(Lazy, props);
  }
  return LazyChunk as unknown as C;
}
