import { hopOffStatus } from '../actors/moveSystem';
import type { Bilingual } from '../core/types';
import type { FlowRide } from '../game/flowStore';

/**
 * Whether 提前下车 is possible right now, and the note when it is not (wave 4, lane G; the same rule as actors/moveSystem's
 * hop-off): a ferry under way lets you off only at a dock (lane F's review request: "到站再下"); lane T's Metro train in a
 * tunnel or under a portal hood never (review open 1: "隧道里不能下车" / "马上出隧道…", or the line's own note from
 * game/lineChoices lineRideLabel). Null = the button is offered.
 */
export function hopOffNote(ride: FlowRide, label: { canHopOff?: boolean; hopOffNote?: Bilingual | null }): Bilingual | null {
  if (!ride.line) return null;
  const st = hopOffStatus(ride.line);
  if (ride.kind === 'ferry' && st && st.station == null) return { zh: '到站再下', en: 'Off at the next dock' };
  if (label.canHopOff === false || st?.canHopOff === false) {
    return label.hopOffNote ?? (st?.portalWait ? { zh: '马上出隧道…', en: 'Coming out of the tunnel…' } : { zh: '隧道里不能下车', en: 'No getting off inside the tunnel' });
  }
  return null;
}
