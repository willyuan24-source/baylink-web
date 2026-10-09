import { trackingAllowed } from './product-events';
import { currentRouteTemplate } from './route-template';
import type { ClientErrorKind } from './client-errors';

/**
 * The boot-time half of the error beacon: it notes the error and the page template at the moment it happens and hands
 * them to client-errors.ts (fingerprint and POST), which is not in any page's boot graph. That module is fetched when the
 * browser is idle (preloadErrorBeacon), so a tab that outlives a deploy already holds it when the new deploy's chunks
 * fail to load; an error before then loads it on demand.
 */
type PendingReport = [kind: ClientErrorKind, error: unknown, route: string];
const pending: PendingReport[] = [];
let beacon: Promise<typeof import('./client-errors')> | null = null;
const loadBeacon = () => (beacon ||= import('./client-errors').catch(error => { beacon = null; throw error; }));

/** Report one caught error; never throws and never waits. At most 8 wait for the beacon module. */
export function reportClientError(kind: ClientErrorKind, error: unknown): void {
  try {
    if (!trackingAllowed() || pending.length >= 8) return;
    pending.push([kind, error, currentRouteTemplate()]);
    loadBeacon().then(
      module => { for (const [queuedKind, queuedError, route] of pending.splice(0)) module.sendClientError(queuedKind, queuedError, route); },
      () => { pending.length = 0; /* The beacon could not load: the reports are dropped, never retried. */ },
    );
  } catch { /* Reporting an error must not cause another one. */ }
}

/** Fetch the beacon module ahead of the first error (called once the browser is idle). */
export function preloadErrorBeacon(): void {
  if (trackingAllowed()) loadBeacon().catch(() => { /* Loaded again on the first error. */ });
}
