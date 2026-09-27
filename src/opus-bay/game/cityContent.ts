import type { Bilingual } from '../core/types';

/**
 * City content entry (lane G2 owns this file from wave 2). Day-0 stub: nothing happens until G2 fills it in.
 *
 *   initCityContent()   called once per page by game/flow.ts initFlowListeners (the Overlay's boot), in BOTH world
 *                       modes: return early in district mode. Register residents' interactables
 *                       (game/interactables registerInteractables), subject resolvers, frame systems
 *                       (game/systemsRegistry), event listeners (BAYBAY lines, goal detectors). Returns a disposer.
 *   goalTargets()       soft waypoints for unfinished city goals, read by flow.nextFreeGoal (free roam hint and the
 *                       call menu's "take me to the next goal"). `goal` is the goalsDone id that hides the target once
 *                       done; `id` must resolve through interactables.interactableById (an interactable id, or a G1
 *                       `place:<id>`) so BAYBAY can lead there.
 */

export interface GoalTarget {
  /** interactable / place id the waypoint and "take me there" resolve */
  id: string;
  /** goalsDone id: the target disappears once it is done */
  goal: string;
  x: number;
  z: number;
  name: Bilingual;
  /** arrival radius (u); default 3 */
  radius?: number;
}

export function initCityContent(): () => void { return () => {}; }

export function goalTargets(): GoalTarget[] { return []; }
