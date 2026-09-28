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

type StartFlight = (opts?: { course?: 'coit' | 'local' }) => Promise<boolean>;
const startFlight: StartFlight = opts => import('./firstFlight').then(m => m.startFirstFlight(opts));
/**
 * The first-flight entry lane C's pelican moment calls (game/pelicanFirst.ts: 试试起飞 → `startFirstFlight()`); set
 * while this feature runs (init → teardown), so a play chunk that failed to start leaves lane C its plain take-off.
 * Resolves false when the flight cannot start (not unlocked, a dialogue open, riding).
 */
export let startFirstFlight: StartFlight | undefined;

export function init(): () => void {
  const offs: (() => void)[] = [];
  startFirstFlight = startFlight;
  offs.push(() => { startFirstFlight = undefined; });
  offs.push(registerPlaySounds());
  ensureResultOverlay();
  offs.push(unregisterResultOverlay);
  // DEV / QA: __opusBay.play
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), play: { startFirstFlight: startFlight, flight: () => import('./firstFlight'), kit: () => import('./kit'), viewSpots: VIEW_SPOTS } };
  }
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}
