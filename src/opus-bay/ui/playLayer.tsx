import { useSyncExternalStore, type ComponentType } from 'react';

/**
 * W6-P1 · the loader of the play layer's chunk (`ui/playParts.tsx`; lane P, plan MF9 / D16).
 *
 *   loadPlayParts()   fetch the chunk once (a failed fetch can be retried by calling again); GameRoot starts it as
 *                     soon as its own chunk runs, in both world modes
 *   usePlayParts()    the loaded module, or null while it is on its way (re-renders once it lands)
 *   lazyPart('Hud')   a stand-in component with the part's own props: renders nothing until the chunk is in, then the
 *                     part itself, as a plain child (no Suspense, so a part that mounts later never flashes a fallback)
 *
 * GameRoot passes the page's Start to the Overlay only once the chunk is in (and the world has drawn), so no part is
 * ever missing in play; before that only the title shows (OpusBayPage), which renders none of them.
 */
export type PlayParts = typeof import('./playParts');

let parts: PlayParts | null = null;
let loading: Promise<PlayParts> | null = null;
const listeners = new Set<() => void>();

export function loadPlayParts(): Promise<PlayParts> {
  loading ??= import('./playParts').then(
    m => { parts = m; for (const fn of [...listeners]) fn(); return m; },
    (e: unknown) => { loading = null; throw e; },
  );
  return loading;
}

export const playParts = (): PlayParts | null => parts;

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function usePlayParts(): PlayParts | null {
  return useSyncExternalStore(subscribe, playParts, playParts);
}

/** A stand-in for one exported part of the chunk, with the same props (the Overlay's JSX stays as it was). */
export function lazyPart<K extends keyof PlayParts>(key: K): PlayParts[K] {
  function Part(props: object) {
    const loaded = usePlayParts();
    const Real = loaded?.[key] as ComponentType<object> | undefined;
    return Real ? <Real {...props} /> : null;
  }
  Part.displayName = `PlayPart(${String(key)})`;
  return Part as unknown as PlayParts[K];
}
