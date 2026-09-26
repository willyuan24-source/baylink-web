import { useSyncExternalStore } from 'react';
import { createStore } from '../core/store';
import type { Bilingual } from '../core/types';
import type { WeekResult } from '../data/catalog';

/**
 * Flow-UI private state (≤ 10 Hz, on change only). Complements core/store with things only the
 * flow systems and DOM UI care about: tour/week sub-phases, bubbles, mini games, cinematics.
 */

export type TourPhase = 'idle' | 'intro' | 'leading' | 'arrived' | 'await' | 'done-node' | 'card' | 'outro' | 'finished';
export type WeekStage = 'idle' | 'asking' | 'walking' | 'board';
export type Cinematic = null | 'arrival' | 'viewpoint' | 'telescope';

export interface Bubble { who: string; text: Bilingual; key: number; tone?: 'call' | 'bark' | 'npc' }

export interface FishState {
  poiId: string;
  stage: 'cast' | 'wait' | 'bite' | 'caught' | 'missed';
  catchIndex: number;
}

export interface FlowState {
  tourPhase: TourPhase;
  weekStage: WeekStage;
  weekResult: WeekResult | null;
  bubble: Bubble | null;
  fishing: FishState | null;
  postcardReward: string | null;
  /** F12: the collected card flying to the player (0.6 s) before the reward opens */
  postcardFly: { id: string; at: number } | null;
  /** true when the reward was just collected (false when viewing from the journal) */
  rewardFresh: boolean;
  cinematic: Cinematic;
  caption: Bilingual | null;
  captionSub: Bilingual | null;
  goalsCard: boolean;
  callPending: boolean;
  /** streetcar ride status for the HUD */
  ride: null | { stage: 'waiting' | 'riding'; from: string; to: string; eta?: number };
  lastPhoto: { url: string; name: string } | null;
  photoFlash: number;
  /** aria-live announcement */
  announce: string;
  debug: boolean;
  /** POI whose micro-interaction the tour is waiting for */
  awaitingPoi: string | null;
  /** event opened from the week board */
  eventId: string | null;
  mapTarget: string | null;
  /** F2: after ~20 s standing still while BAYBAY leads, offer a one-tap "take me there" */
  leadChip: boolean;
  /** F8: free roam — BAYBAY leads you to this interactable (from the call menu) */
  freeLead: string | null;
  /** F8: free roam — the soft waypoint to the nearest unfinished goal */
  freeHint: { id: string; x: number; z: number; name: Bilingual } | null;
  /** F8: the soft waypoint was dismissed until (performance.now ms) */
  freeHintOffUntil: number;
  /** F9: "I'm a local" start — no ambient barks until this time (performance.now ms) */
  quietUntil: number;
  /** F11: first visit — the world opens at golden hour (like the key art) whatever the Bay clock says */
  goldenFirstVisit: boolean;
  /** F11: the one-tap offer to switch to the real Bay time right now (this visit only) */
  timeOffer: null | 'morning' | 'day' | 'golden' | 'night';
}

export const initialFlowState = (): FlowState => ({
  tourPhase: 'idle',
  weekStage: 'idle',
  weekResult: null,
  bubble: null,
  fishing: null,
  postcardReward: null,
  postcardFly: null,
  rewardFresh: false,
  cinematic: null,
  caption: null,
  captionSub: null,
  goalsCard: false,
  callPending: false,
  ride: null,
  lastPhoto: null,
  photoFlash: 0,
  announce: '',
  debug: false,
  awaitingPoi: null,
  eventId: null,
  mapTarget: null,
  leadChip: false,
  freeLead: null,
  freeHint: null,
  freeHintOffUntil: 0,
  quietUntil: 0,
  goldenFirstVisit: false,
  timeOffer: null,
});

export const flow = createStore<FlowState>(initialFlowState());

export function useFlow<S>(selector: (state: FlowState) => S): S {
  return useSyncExternalStore(flow.subscribe, () => selector(flow.get()), () => selector(flow.get()));
}
