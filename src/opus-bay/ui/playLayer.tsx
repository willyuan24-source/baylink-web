import { useSyncExternalStore, type ComponentType } from 'react';
import { importRetry } from '../game/importRetry';

/**
 * W6-P1 · the loader of the play layer's chunk (`ui/playParts.tsx`; lane P, plan MF9 / D16).
 *
 *   loadPlayParts()   fetch the chunk once (a failed fetch reloads the page once per session: see reloadOnce);
 *                     GameRoot starts it as soon as its own chunk runs, in both world modes
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

/** sessionStorage key: set when a failed fetch of the chunk has reloaded the page, cleared once the chunk is in. */
export const PLAY_PARTS_RELOAD_KEY = 'opus-bay:play-parts-reload';

/**
 * (W6-P review) Chrome keeps a failed `import()` failed for the page's life: once the chunk's request is lost (a network
 * blip, a deploy between GameRoot's request and this one), calling again never fetches it, and Start would spin for
 * ever. So the first failure reloads the page, once per session: this runs at the title (GameRoot holds Start until the
 * chunk is in), where a reload loses nothing. Offline, the reloaded page's failure does not reload again; no storage,
 * no reload (never a loop).
 */
function reloadOnce(): void {
  try {
    if (typeof location === 'undefined' || typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(PLAY_PARTS_RELOAD_KEY)) return;
    sessionStorage.setItem(PLAY_PARTS_RELOAD_KEY, '1');
    location.reload();
  } catch { /* storage blocked: no reload */ }
}

/** (W7-P3) the play layer's own retries are quick: at the title a reload is the next step and loses nothing */
export const PLAY_PARTS_RETRY_MS = [500, 2000] as const;

export function loadPlayParts(load: () => Promise<PlayParts> = () => importRetry(() => import('./playParts'), { waits: PLAY_PARTS_RETRY_MS })): Promise<PlayParts> {
  loading ??= load().then(
    m => {
      parts = m;
      try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(PLAY_PARTS_RELOAD_KEY); } catch { /* storage blocked */ }
      for (const fn of [...listeners]) fn();
      return m;
    },
    (e: unknown) => { loading = null; reloadOnce(); throw e; },
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
