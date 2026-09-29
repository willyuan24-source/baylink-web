import { registerPillBadge } from '../ui/slots';
import { CandyBadge } from './treatBadge';
import { initTreat } from './treatRun';

/**
 * Wave 6 · lane G · the Halloween games (started by halloween/index.ts, city mode only, after the economy):
 *
 *   trick-or-treat   halloween/treatRun.ts — the decorated doors on six real trick-or-treat streets (treatStreets.ts,
 *                    treatDoors.ts), the 敲门 / Knock prompt, treats → coins (`halloween:door:<n>` / `night:<n>`), the
 *                    candy bag (treatBadge.tsx), BAYBAY's lines (lines.ts)
 *
 * DEV / QA: `__opusBay.g` — `knock(n)` knocks on door n from anywhere, `look(n, out)` stands in front of it, `stats()` (phase, built streets, triangles, the
 * door answering, the bag).
 */
export function initHalloweenPlay(): () => void {
  const treat = initTreat();
  const offs: (() => void)[] = [treat.off, registerPillBadge({ id: 'g-candy', order: 11, Component: CandyBadge })];
  if (typeof window !== 'undefined' && (import.meta.env?.DEV || import.meta.env?.VITE_OPUS_QA === '1')) {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), g: { knock: treat.knock, look: treat.look, stats: treat.stats } };
  }
  return () => { for (const off of offs.splice(0).reverse()) off(); };
}
