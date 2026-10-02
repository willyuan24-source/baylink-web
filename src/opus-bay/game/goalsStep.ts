import { lazyChunk } from './lazyChunk';
import { game } from '../core/store';
import { CITY_GOAL, GOALS_STEP_ID, GOALS_STEP_SEEN } from '../data/sf/goals';
import { registerOverlay } from '../ui/slots';
import { goalTargets } from './cityContent';
import { sayFreeLine, startFreeLead } from './flow';
import { flow } from './flowStore';
import { STREET_FACTOR, autoTravelSeconds } from './tripPlan';
import { timeLabel } from './tripText';
import { importRetry } from './importRetry';

/**
 * Wave 5 · lane C · W5-C3 (plan sf-w5-plan.md MF6 "goals once", MF3 "the pelican first"): the goals step.
 *
 * City mode, once per player: after the welcome choice 我自己逛逛 (and the first later free roam of a player who never
 * saw it), the explorer goals open as a modal step — the pelican first, with its reward text and one big button to go
 * and meet it — while BAYBAY's bubbles wait (flow.bubble and her pacer hold while it is open). game/flow.ts
 * `openGoalsStep()` opens it and marks it seen (goalsDone `seen:goals-step`; reset progress clears it). Afterwards free
 * roam starts without a card (the top-right pill opens the journal: lanes F / R).
 *
 * This module registers the overlay (ui/slots.ts registerOverlay) from game/cityContent.ts' city init; the body is
 * ui/GoalsStep.tsx, its own chunk, prefetched here (the city boot, long before the welcome choice) while the player
 * has not seen the step, so it never opens on an empty frame.
 */

const load = () => importRetry(() => import('../ui/GoalsStep'));

/**
 * The big button's time over a straight distance d (u). The button carries you (a free lead is one of lane N's
 * auto-travel trips), so it is BAYBAY's auto-travel pace over the street distance — what the trip pill and the call
 * menu's 带我去下一个目标 say (cityMoments carriedTime) — not the straight walk (review: it said 约 50 秒 at the Ferry
 * Building while the trip it started showed the carried time).
 */
export const goalsStepEta = (d: number) => timeLabel(autoTravelSeconds(d * STREET_FACTOR));
const GoalsStep = lazyChunk(load);

export function initGoalsStep(): () => void {
  if (!game.get().goalsDone.includes(GOALS_STEP_SEEN)) void load().catch(() => { /* offline: it loads when it opens */ });
  return registerOverlay({ id: GOALS_STEP_ID, Component: GoalsStep });
}

/**
 * The step closed; free roam begins (ui/GoalsStep.tsx calls it once the overlay is really gone). 'lead' (the big
 * button): BAYBAY leads to the pelican at once (a walking trip with the pill and the route). 'self' (我自己逛, Escape,
 * the backdrop): her goal #1 line and the soft waypoint on Coit right away (the brain keeps it: nextFreeGoal puts the
 * pelican first). With the pelican already met: just her "you lead" line.
 */
export function afterGoalsStep(how: 'lead' | 'self', pelicanTarget: string | null) {
  if (how === 'lead' && pelicanTarget) { startFreeLead(pelicanTarget); return; }
  if (!pelicanTarget || game.get().goalsDone.includes(CITY_GOAL.pelican)) { sayFreeLine(false, 4200); return; }
  sayFreeLine(true, 4600);
  const t = goalTargets().find(g => g.goal === CITY_GOAL.pelican);
  if (t && !flow.get().freeHint) flow.set({ freeHint: { id: t.id, x: t.x, z: t.z, name: t.name } });
}
