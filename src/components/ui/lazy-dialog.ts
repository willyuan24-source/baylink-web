// A dialog whose code loads on first use, without a tap that looks ignored (UI9-R1-OVERLAYS): `warm()` fetches its chunk
// once the page is idle, after first paint, so the first open is usually instant; an open before that shows DialogWait
// (DialogWait.tsx) until the chunk arrives. The static route graph does not change: the chunk is still a dynamic import.
import type { ComponentType } from 'react';
import { lazyChunk } from '../../lib/chunk-recovery';

type IdleWindow = Window & { requestIdleCallback?: (task: () => void, options?: { timeout: number }) => number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own constraint
export function lazyDialog<M, C extends ComponentType<any>>(load: () => Promise<M>, pick: (module: M) => C) {
  let ready: C | null = null;
  // `undefined` is REG-15's "reload scheduled" (chunk-recovery.ts): nothing to keep.
  const keep = (module: M) => { if (module) ready = pick(module); return module; };
  const Lazy = lazyChunk(() => load().then(keep), pick);
  let warmed = false;
  return {
    /**
     * The dialog once its chunk is here (it renders at once, no Suspense round; `waits` false), else the lazy one, which
     * shows the Suspense fallback (DialogWait) first (`waits` true). Read it once per open (useState): switching type while
     * open would remount the dialog.
     */
    current: (): { Dialog: C; waits: boolean } => ready ? { Dialog: ready, waits: false } : { Dialog: Lazy, waits: true },
    /** Fetch the chunk when the page is next idle; once per page. A failure is left to the open (lazyChunk retries). */
    warm: () => {
      if (warmed || typeof window === 'undefined') return;
      warmed = true;
      const get = () => { load().then(keep, () => {}); };
      const idle = (window as IdleWindow).requestIdleCallback;
      if (idle) idle(get, { timeout: 4000 }); else window.setTimeout(get, 2000);
    },
  };
}
