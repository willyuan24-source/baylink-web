/**
 * W8-P-review (Ultra, P-RP-1) · React.lazy for a part that loads through game/importRetry.ts.
 *
 * A React.lazy whose chunk is still lost after importRetry's 1 + 3 + 8 s rejected into the site's root ErrorBoundary
 * (src/components/ErrorBoundary.tsx): the whole game — and W8-P5's reload card with it — was replaced by the site's
 * generic English "Something went wrong on this page", 12 s after the player pressed M, opened a game panel or resumed
 * with a lost shared chunk. `lazyChunk(load)` is React.lazy with one difference: a *loading* failure (importRetry has
 * already told game/chunkLost.ts, which shows 有一部分没加载好 · 重新载入 / 先继续玩) renders nothing in place of the
 * part, and the next mount of the part asks again (a new React.lazy: React keeps a lazy's first result for good;
 * importRetry asks under a URL the page has not tried, so a panel opened again after the network came back loads).
 * An error the module's own code threw still reaches the error boundary, as before.
 *
 * In GameRoot's chunk (like chunkLost.ts): the parts it guards are the ones being lost.
 */
import { createElement, lazy, useState, type ComponentType } from 'react';
import { isLoadFailure } from './importRetry';

/** a part whose chunk is lost for good: nothing in its place (the reload card says why) */
const Nothing = (): null => null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own constraint
type AnyComponent = ComponentType<any>;

type MakeLazy = (factory: () => Promise<{ default: AnyComponent }>) => AnyComponent;

/**
 * React.lazy(load), but a chunk lost for good renders nothing and the next mount retries. The second argument: tests'
 * `makeLazy`, or (W9-P4, w8 NEXT #11) `{ onLost }` — called once the part is lost for good (a panel closes itself: the
 * HUD rail no longer stays shifted for an empty panel, and the next press opens it again on a fresh URL).
 */
export function lazyChunk<C extends AnyComponent>(
  load: () => Promise<{ default: C }>,
  opts: MakeLazy | { onLost?: () => void; makeLazy?: MakeLazy } = lazy,
): C {
  const makeLazy: MakeLazy = typeof opts === 'function' ? opts : opts.makeLazy ?? lazy;
  const onLost = typeof opts === 'function' ? undefined : opts.onLost;
  let current: AnyComponent;
  const make = (): AnyComponent => makeLazy(() => load().catch((e: unknown) => {
    if (!isLoadFailure(e)) throw e;
    current = make(); // the next mount asks again
    onLost?.();
    return { default: Nothing };
  }));
  current = make();
  function LazyChunk(props: object) {
    // the lazy current at mount: a re-render never restarts a load, a new mount (the panel opened again) may
    const [C] = useState(() => current);
    return createElement(C, props);
  }
  return LazyChunk as unknown as C;
}
