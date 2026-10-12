import { useEffect, useState } from 'react';

/** The answer cards' chunk: loaded once (the panel starts it on open), then rendered synchronously. */
export type BayBayCardsModule = typeof import('./BayBayCards');
export let bayBayCardsModule: BayBayCardsModule | null = null;
let pending: Promise<BayBayCardsModule> | null = null;
const listeners = new Set<(module: BayBayCardsModule) => void>();
const importCards = () => import('./BayBayCards');
const RETRY_MS = 1000;

/**
 * Loads the card chunk once. A failed fetch (the reader went offline, or a deploy renamed the chunk while the panel was
 * open) retries once after a second, like the app's lazy panels; if that fails too the promise rejects and the next
 * call starts again.
 */
export function loadBayBayCards(): Promise<BayBayCardsModule> {
  pending ||= importCards()
    .catch(() => new Promise<void>(resolve => setTimeout(resolve, RETRY_MS)).then(importCards))
    .then(module => {
      bayBayCardsModule = module;
      for (const listener of listeners) listener(module);
      return module;
    }, error => { pending = null; throw error; });
  return pending;
}

/**
 * The card chunk for a component that needs it. `failed` turns true once loading has failed, so the caller shows a
 * plain fallback instead of a placeholder that never fills. It tries again when the component mounts again (the panel
 * reopens) or the browser comes back online, and it picks up a load that succeeds elsewhere.
 */
export function useBayBayCardsModule(wanted: boolean): { module: BayBayCardsModule | null; failed: boolean } {
  const [module, setModule] = useState(bayBayCardsModule);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!wanted || module) return;
    let live = true;
    const ready = (loaded: BayBayCardsModule) => { if (live) { setModule(loaded); setFailed(false); } };
    const attempt = () => { loadBayBayCards().then(ready, () => { if (live) setFailed(true); }); };
    listeners.add(ready);
    attempt();
    window.addEventListener('online', attempt);
    return () => { live = false; listeners.delete(ready); window.removeEventListener('online', attempt); };
  }, [wanted, module]);
  return { module, failed };
}
