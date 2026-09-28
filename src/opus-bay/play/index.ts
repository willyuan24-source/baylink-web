import { ensureResultOverlay, unregisterResultOverlay } from './kit';
import { registerPlaySounds } from './sounds';
import { VIEW_SPOTS } from './viewSpots';

/**
 * Wave 5 · lane A — PlayKit and the activities. game/w5Features.ts loads this module lazily in city mode only and calls
 * `init()` once (after the economy). Everything else of the folder loads behind it:
 *
 *   kit.ts         the core: activities, the rhythm judge, medals, bests, the result card (ResultCard.tsx, lazy)
 *   viewSpots.ts   the 16 看风景 spots (lane E's notebook imports the ids)
 *   firstFlight.ts + rings.ts + FlightChip.tsx   the first flight: lane C's pelican moment calls
 *                  `import('../play/firstFlight').then(m => m.startFirstFlight())`
 *
 * Nothing here changes the district (never loaded there).
 */

/** The first-flight entry for callers that hold this module (lane C may also import play/firstFlight directly). */
export const startFirstFlight = (opts?: { course?: 'coit' | 'local' }) => import('./firstFlight').then(m => m.startFirstFlight(opts));

export function init(): () => void {
  const offs: (() => void)[] = [];
  offs.push(registerPlaySounds());
  ensureResultOverlay();
  offs.push(unregisterResultOverlay);
  // DEV / QA: __opusBay.play
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), play: { startFirstFlight, flight: () => import('./firstFlight'), kit: () => import('./kit'), viewSpots: VIEW_SPOTS } };
  }
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}
