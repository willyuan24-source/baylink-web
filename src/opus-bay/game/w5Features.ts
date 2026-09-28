/**
 * Wave 5 (FROZEN list at day 0, plan sf-w5-plan.md §4.2 W5-0d) · the four new feature folders, started once in city
 * mode by game/cityContent.ts initCityContent (district mode never loads them).
 *
 *   economy/index.ts  lane E · the ledger, coins, the 小铺, the notebook — initialised FIRST, so its `reward` listener is
 *                     live before any other feature can emit
 *   play/index.ts     lane A · PlayKit and the activities
 *   eggs/index.ts     lane D · the easter eggs
 *   realsf/index.ts   lane R · the real San Francisco (sun, events, SF Today)
 *
 * Each exports `init(): () => void` (the returned function undoes everything init did). Each is its own lazy chunk:
 * only these dynamic imports reach them, never a static import from a module GameRoot loads (the P7 walk in
 * tests/opus-bay-sf-budget.test.ts and the contracts test). The three others are fetched in parallel with the economy
 * but initialised only after it (or after it failed: one feature's failure never stops another).
 */

export interface W5Feature { init(): () => void }
export type W5Loader = () => Promise<W5Feature>;

/** The frozen order: the economy first. */
export const W5_FEATURES = ['economy', 'play', 'eggs', 'realsf'] as const;
export type W5FeatureId = (typeof W5_FEATURES)[number];

export const W5_LOADERS: Readonly<Record<W5FeatureId, W5Loader>> = {
  economy: () => import('../economy/index'),
  play: () => import('../play/index'),
  eggs: () => import('../eggs/index'),
  realsf: () => import('../realsf/index'),
};

/**
 * Load and start the four features; returns the teardown (every started feature's off, the last started first; a
 * feature still loading when torn down never starts). Resolves `ready` once every feature has started or failed.
 */
export function initW5Features(loaders: Readonly<Record<W5FeatureId, W5Loader>> = W5_LOADERS): { off: () => void; ready: Promise<void> } {
  let disposed = false;
  const offs: (() => void)[] = [];
  const start = (id: W5FeatureId, mod: W5Feature) => {
    if (disposed) return;
    try { offs.push(mod.init()); } catch (error) { if (import.meta.env?.DEV) console.error(`[opus-bay w5] ${id} init`, error); }
  };
  const fail = (id: W5FeatureId) => (error: unknown) => { if (import.meta.env?.DEV) console.error(`[opus-bay w5] ${id} load`, error); };
  const load = (id: W5FeatureId): Promise<W5Feature | null> => {
    try { return loaders[id]().catch(e => { fail(id)(e); return null; }); } catch (e) { fail(id)(e); return Promise.resolve(null); }
  };
  const economy = load('economy').then(m => { if (m) start('economy', m); });
  const rest = W5_FEATURES.filter(id => id !== 'economy').map(id => {
    const mod = load(id);
    return economy.then(() => mod).then(m => { if (m) start(id, m); });
  });
  const ready = Promise.all([economy, ...rest]).then(() => undefined);
  return {
    off: () => {
      disposed = true;
      for (const off of offs.splice(0).reverse()) { try { off(); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay w5] teardown', error); } }
    },
    ready,
  };
}
