import { registerHalloweenRewards } from './rewards';
import { initHalloweenPlay } from './play';
import { initHalloweenWorld } from './world';

/**
 * Wave 6 day 0 (FROZEN glue, docs/opus-bay/sf-w6-lead.md §4) · the Halloween feature: a lazy chunk started once in city
 * mode by game/w5Features.ts after the economy (district mode never loads it).
 *
 *   world.ts   lane H · the season in the world: dressing, night light, the pumpkin hunt, Día de los Muertos
 *   play.ts    lane G · the games: trick-or-treat, costumes, BAYBAY's Halloween lines, the season's goals / notebook
 *
 * Each side's init returns its undo; a failure on one side never stops the other.
 */
export function init(): () => void {
  const offs: (() => void)[] = [registerHalloweenRewards()];
  for (const start of [initHalloweenWorld, initHalloweenPlay]) {
    try { offs.push(start()); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay halloween] init', error); }
  }
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay halloween] teardown', error); } } };
}
