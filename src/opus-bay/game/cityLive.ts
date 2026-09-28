import { onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { zoneAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { CITY_GOAL } from '../data/sf/goals';
import { W5_DECK, w5Text } from '../data/sf/linesW5';
import { sfLandmarkInfo } from '../data/sf/landmarks';
import { GGB } from '../world/sf/landmarks/golden-gate-bridge';
import { sfLandmark, worldToLandmark } from '../world/sf/landmarks/index';
import { PAINTED_LADIES_PHOTO_R, createDeckCrossing, createSummitDetector, isNeighbourhoodId, neighbourhoodVisit, type DeckStep, type GoalSample } from './cityDetectors';
import { travelActive, travelEpoch } from './fastTravel';
import { registerSubjectResolver } from './interactables';
import { registerFrameSystem } from './systemsRegistry';

/**
 * The city content that needs the landmark library (lane G2; P7: world/sf/landmarks stays out of GameRoot). Loaded
 * lazily by game/cityContent.ts in city mode only, like game/baybayLines.ts and game/residentTasks.ts.
 *
 *   initCityGoals(hooks)   the goal detectors of game/cityGoals.ts fed from the runtime (5 Hz) and the shutter event
 *   initCityLive(hooks)    that, plus the telescope / photo subject resolver for the SF landmarks
 */

/** World y of a landmark's ground, from the placed base or the city ground. */
function landmarkY(id: string, ground: (x: number, z: number) => number): { x: number; z: number; y: number } | null {
  const l = sfLandmark(id);
  if (!l) return null;
  return { x: l.x, z: l.z, y: typeof l.base === 'number' ? l.base : ground(l.x, l.z) };
}

export interface CityGoalHooks {
  /** mark goalsDone ids (flow: set + the "goal complete" toast for FREE_GOALS ids) */
  done(ids: string[]): void;
  heightAt(x: number, z: number): number;
  /** BAYBAY says a line through her pacer (`id`: its frozen wave-5 line, for the voice); W5-C5's deck progress */
  say?(text: Bilingual, id?: string): void;
}

/**
 * Wave 5 · W5-C5 (plan MF2 "走过金门大桥 … says its progress on the deck"): what BAYBAY says for a step of the deck
 * crossing (the first tower, mid-span, done) — lane C's frozen lines (data/sf/linesW5.ts). Pure.
 */
export function deckLine(step: DeckStep): { text: Bilingual; id: string } {
  const line = step.what === 'tower' ? (step.tower < 0 ? W5_DECK.south : W5_DECK.north) : step.what === 'half' ? W5_DECK.half : W5_DECK.done;
  return { text: w5Text(line), id: line.id };
}

/** City mode: wire the detectors to the runtime (5 Hz frame system) and the shutter / transit events. */
export function initCityGoals(hooks: CityGoalHooks): () => void {
  const summitAt = landmarkY('twin-peaks', hooks.heightAt);
  const summit = summitAt ? createSummitDetector(summitAt) : null;
  const bridge = sfLandmark('golden-gate-bridge');
  const deck = createDeckCrossing({ tower: GGB.TOWER, deckY: GGB.DECK - 3.2 });
  const ladies = sfLandmark('painted-ladies');
  const has = (id: string) => game.get().goalsDone.includes(id);
  let acc = 0, lastZone: string | null = null;
  const offFrame = registerFrameSystem('g2-city-goals', dt => {
    if ((acc += dt) < 0.2) return;
    acc = 0;
    if (game.get().phase !== 'playing') return;
    const p = runtime.player;
    const s: GoalSample = { x: p.x, y: p.y, z: p.z, mode: runtime.move.mode, epoch: travelEpoch(), travelling: travelActive() };
    if (summit && !has(CITY_GOAL.twinPeaks) && summit.step(s)) hooks.done([CITY_GOAL.twinPeaks]);
    const crossing = bridge && !has(CITY_GOAL.goldenGate) ? deck.step(worldToLandmark(bridge, p), s) : null;
    if (crossing) {
      if (crossing.what === 'done') hooks.done([CITY_GOAL.goldenGate]);
      const line = deckLine(crossing);
      hooks.say?.(line.text, line.id);
    }
    const zone = s.travelling ? null : zoneAt(p.x, p.z)?.id ?? null;
    if (zone !== lastZone) {
      lastZone = zone;
      if (isNeighbourhoodId(zone)) { const ids = neighbourhoodVisit(game.get().goalsDone, zone); if (ids.length) hooks.done(ids); }
    }
  });
  const offEvents = onEvent(event => {
    if (event.type === 'shutter' && ladies && !has(CITY_GOAL.paintedLadies)) {
      const p = runtime.player;
      if (Math.hypot(p.x - ladies.x, p.z - ladies.z) <= PAINTED_LADIES_PHOTO_R) hooks.done([CITY_GOAL.paintedLadies]);
    }
  });
  return () => { offFrame(); offEvents(); };
}

/** City mode: the goal detectors and the SF landmark subjects (telescopes, photo captions). Returns the disposer. */
export function initCityLive(hooks: CityGoalHooks): () => void {
  const offGoals = initCityGoals(hooks);
  // telescope / photo subjects: an SF landmark id resolves to a point about 60 % up its model
  const offSubjects = registerSubjectResolver(subject => {
    const l = sfLandmark(subject), info = sfLandmarkInfo(subject);
    if (!l || !info) return null;
    const base = typeof l.base === 'number' ? l.base : hooks.heightAt(l.x, l.z);
    return { x: l.x, y: base + Math.max(2, info.height.u * 0.6), z: l.z };
  });
  return () => { offGoals(); offSubjects(); };
}
