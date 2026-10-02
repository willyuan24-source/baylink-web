import { useSyncExternalStore } from 'react';
import { createStore } from '../core/store';
import type { TransitKind } from '../core/events';
import type { Bilingual } from '../core/types';
import type { WeekResult } from '../data/catalog';
import type { ArrivalBeats } from './arrival';
import type { TripState } from './tripTypes';

/**
 * Flow-UI private state (≤ 10 Hz, on change only). Complements core/store with things only the
 * flow systems and DOM UI care about: tour/week sub-phases, bubbles, mini games, cinematics.
 */

export type TourPhase = 'idle' | 'intro' | 'leading' | 'arrived' | 'await' | 'done-node' | 'card' | 'outro' | 'finished';
export type WeekStage = 'idle' | 'asking' | 'walking' | 'board';
/** 'travel' = G1's fast travel (飞过去) shots */
export type Cinematic = null | 'arrival' | 'viewpoint' | 'telescope' | 'travel';
/** HUD ride stage: waiting at the stop, riding, braking for a hop-off (E2-10 / F6), turning on a turntable (F4) */
export type RideStage = 'waiting' | 'riding' | 'braking' | 'turning';
/** The HUD's ride status (game/transit.ts writes it; ui/Hud RideBanner reads it through transit.rideLabel). */
export interface FlowRide {
  stage: RideStage;
  /** boarding / destination stop or station ids */
  from: string;
  to: string;
  eta?: number;
  /** transit line id (move.line); absent = the hero F-line streetcar */
  line?: string;
  kind?: TransitKind;
}

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
  /** transit ride status for the HUD (see FlowRide) */
  ride: null | FlowRide;
  /** the last card taken: its object URL; in the city (W5-C7) `album` with its album id as `name` */
  lastPhoto: { url: string; name: string; album?: boolean } | null;
  photoFlash: number;
  /** aria-live announcement ({ zh, en } is resolved in the current language when shown) */
  announce: string | Bilingual;
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
  /**
   * W9-F4: the welcome's hush (performance.now() ms) — 我是本地人's 3 minutes, 我自己逛逛's first 15 s. Every unprompted
   * line source that asks game/baybayHold.ts baybayHeld() waits until then, and the 飞行券 gift (quietUntil is also the
   * games' own quiet, which keeps only some sources quiet: unchanged).
   */
  hushUntil: number;
  /** F11: first visit — the world opens at golden hour (like the key art) whatever the Bay clock says */
  goldenFirstVisit: boolean;
  /** F11: the one-tap offer to switch to the real Bay time right now (this visit only) */
  timeOffer: null | 'morning' | 'day' | 'golden' | 'night';
  /**
   * Wave 4 · the running trip (跟 BAYBAY 去 / TripOptions / a tour stop / startFreeLead as a one-leg trip), null when
   * none. Lane C's game/trips.ts reducer writes it; lanes G (trip pill, waypoint), P (map route) and T (pre-filled
   * boarding) read it. The contracts test pins null at start.
   */
  trip: TripState | null;
  /**
   * Wave 4 · the arrival moment on screen: lane C's `arrivalBeats()` for an `arrival` hit, with its attraction and
   * place-index ids; null when none. Lane G's arrival toast / ArrivalCard / reveal read it. Null at start (contracts).
   */
  arrival: (ArrivalBeats & { attraction: string; place: string }) | null;
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
  hushUntil: 0,
  goldenFirstVisit: false,
  timeOffer: null,
  trip: null,
  arrival: null,
});

export const flow = createStore<FlowState>(initialFlowState());

export function useFlow<S>(selector: (state: FlowState) => S): S {
  return useSyncExternalStore(flow.subscribe, () => selector(flow.get()), () => selector(flow.get()));
}
