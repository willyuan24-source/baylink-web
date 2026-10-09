import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

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
