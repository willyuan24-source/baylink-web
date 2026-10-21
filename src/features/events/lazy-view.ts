import { lazy, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { chunkLoader } from '../../lib/chunk-recovery';

/**
 * A lazy view that can be loaded again: React.lazy keeps a rejected import forever, so each retry (ChunkBoundary's
 * attempt number) gets a fresh lazy component, cached so a re-render does not restart a load in flight.
 */
export function retryableLazy<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): (attempt: number) => LazyExoticComponent<ComponentType<P>> {
  const views = new Map<number, LazyExoticComponent<ComponentType<P>>>();
  return attempt => {
    if (!views.has(attempt)) views.set(attempt, lazy(load));
    return views.get(attempt)!;
  };
}

/**
 * A part the page shows only on a tap (a sheet), in its own chunk so the route's first load leaves it out. Unlike
 * React.lazy it renders at once when its module is in (no Suspense boundary to reveal). `load` is shared; after a failed
 * load the next call tries again (`importer` is a chunkLoader: a lost chunk is fetched under a new URL, and a stale deploy's
 * undefined module never settles while the page reloads).
 */
export type OnDemand<M> = { get: () => M | undefined; load: () => Promise<M> };
export function onDemand<M>(importer: () => Promise<M>): OnDemand<M> {
  let module: M | undefined;
  let pending: Promise<M> | undefined;
  return {
    get: () => module,
    load: () => pending ??= importer().then(value => (module = value), error => { pending = undefined; throw error; }),
  };
}

/**
 * The part's open state, its setter and its module: opening it loads the module first when it is not in yet (the part then
 * renders on the next render, without suspending); a failed load closes it again, so the next tap tries again.
 */
export function useOnDemand<M>(part: OnDemand<M>): readonly [boolean | undefined, (open: boolean) => void, M | undefined] {
  const [open, setOpen] = useState<boolean>();
  const [, setLoaded] = useState(0);
  const show = (value: boolean) => {
    setOpen(value);
    if (value && !part.get()) part.load().then(() => setLoaded(count => count + 1), () => setOpen(undefined));
  };
  return [open, show, part.get()];
}

/** The two sheets and the share-card strip (on-demand-parts.ts): one chunk, one dynamic import for both routes. */
export const parts = onDemand(chunkLoader(() => import('./on-demand-parts'), module => module));

/** Start loading a part once the page is idle, so a tap seldom waits for it. A failure waits for the tap (useOnDemand). */
export function loadWhenIdle(load: () => Promise<unknown>): void {
  if (typeof window === 'undefined') return;
  const start = () => { void load().catch(() => undefined); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 4000 });
  else window.setTimeout(start, 2000);
}
