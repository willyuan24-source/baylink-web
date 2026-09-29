import { registerRewardIds } from '../economy/ledger';

/**
 * Wave 6 day 0 (FROZEN, APPEND-ONLY) · the `halloween:` reward ids. `HALLOWEEN_REWARD_IDS[i]` owns bit i of the save's
 * `halloween` bitset (data/playSave.ts), so an id never moves and the list only grows at its end.
 *
 *   pumpkin:1 … pumpkin:40   lane H · a hidden jack-o'-lantern found (H numbers its spots; unused numbers stay unused)
 *   hunt:10 · hunt:20 · hunt:all   lane H · the hunt's milestones
 *   door:1 … door:60         lane G · a door's first treat of the season (G numbers its doors)
 *   night:1 … night:60       lane G · the same door's treat on 31 October (the big night)
 *   costume:first            lane G · the first costume worn
 *   muertos:1 … muertos:12   lane H · Día de los Muertos (marigold altars / papel picado finds, 1–2 November)
 *   spare:1 … spare:20       whoever the lead gives them to (write it in the lead note first)
 *
 * The ledger pays each id once per save, capped at REWARD_CAPS.halloween (25).
 */
const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}:${i + 1}`);

export const HALLOWEEN_REWARD_IDS: readonly string[] = [
  ...range('pumpkin', 40),
  'hunt:10', 'hunt:20', 'hunt:all',
  ...range('door', 60),
  ...range('night', 60),
  'costume:first',
  ...range('muertos', 12),
  ...range('spare', 20),
];

/** `halloween:<id>` for an id of the list (throws on an id the list does not hold: a typo would never be paid). */
export function halloweenSource(id: string): string {
  if (!HALLOWEEN_REWARD_IDS.includes(id)) throw new Error(`[opus-bay halloween] not a reward id: ${id}`);
  return `halloween:${id}`;
}

/** Register the list with the ledger (halloween/index.ts, once); returns the undo. */
export const registerHalloweenRewards = (): (() => void) => registerRewardIds('halloween', HALLOWEEN_REWARD_IDS);
