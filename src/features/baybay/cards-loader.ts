/** The answer cards' chunk: loaded once (the panel starts it on open), then rendered synchronously. */
export type BayBayCardsModule = typeof import('./BayBayCards');
export let bayBayCardsModule: BayBayCardsModule | null = null;
let pending: Promise<BayBayCardsModule> | null = null;
export function loadBayBayCards(): Promise<BayBayCardsModule> {
  pending ||= import('./BayBayCards').then(module => (bayBayCardsModule = module), error => { pending = null; throw error; });
  return pending;
}
