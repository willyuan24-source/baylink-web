import type { MoveSpot } from '../core/store';
import type { Bilingual } from '../core/types';

/**
 * What E / pad A / the touch button does on board, in words (wave 4, lane G integration review). The movement FSM
 * (actors/modes.ts switchSpot) goes rail → seat, seat → rail and deck → rail: the ferry boards onto its sun deck and the
 * stick walks any car's deck / aisle, so on the deck the key takes the rider back to the rail, not to a seat. Both the
 * keyboard chip (ui/MoveChip) and the touch button (actors/TouchControls) said 坐下 there, and the tap stood the rider
 * at the rail instead. `short`: the 56 px round touch button (11 px type, ≤ 4 characters / one short word).
 */
export function spotActionLabel(spot: MoveSpot | undefined, kind: string | undefined, short = false): Bilingual {
  if (spot === 'seat') return { zh: '站起来', en: 'Stand' };
  if (spot === 'deck') {
    if (kind === 'ferry') return short ? { zh: '扶栏杆', en: 'Rail' } : { zh: '扶好栏杆', en: 'Hold the rail' };
    return short ? { zh: '抓扶杆', en: 'Pole' } : { zh: '抓紧扶杆', en: 'Hold the pole' };
  }
  return { zh: '坐下', en: 'Sit down' };
}
