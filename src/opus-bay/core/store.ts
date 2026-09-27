import { useSyncExternalStore } from 'react';
import type { Vec2, WishItem } from './types';

/**
 * Low-frequency game state (≤ 10 Hz updates). Per-frame values live in core/runtime.ts.
 * Selectors passed to useGame must return primitives or references stored in state (no new objects),
 * otherwise React will re-render every time.
 */

export type Phase = 'title' | 'arrival' | 'playing';
export type Mode = 'onboarding' | 'tour' | 'week' | 'free';
export type Quality = 'low' | 'mid' | 'high';
export type TimeOfDay = 'morning' | 'day' | 'golden' | 'night';
/** 'district' = the hand-crafted Embarcadero slab only (v1); 'city' = the whole streamed San Francisco around it */
export type WorldMode = 'district' | 'city';
export type PanelKind = 'poi' | 'event' | 'week' | 'map' | 'journal' | 'settings' | 'recap' | null;
/**
 * How the newcomer moves (actors/modes.ts owns the transitions): on foot, sitting on a bench / step, riding a bike,
 * driving the toy car, on transit (a line: the F-line streetcar today), gliding on the pelican, fast travel, photo walk.
 */
export type MoveMode = 'foot' | 'sit' | 'bike' | 'car' | 'transit' | 'glide' | 'travel' | 'photo';
/** where on a transit car: holding the rail / pole, on a seat, or walking the deck (ferry) */
export type MoveSpot = 'rail' | 'seat' | 'deck';
export interface MoveState { mode: MoveMode; line?: string; spot?: MoveSpot }

export interface Toast { id: number; text: string; tone?: 'info' | 'success' | 'gold' }

export interface GameState {
  phase: Phase;
  mode: Mode;
  paused: boolean;
  settings: {
    sound: boolean;
    music: boolean;
    quality: Quality;
    /** 'auto' follows the real Bay Area clock */
    timeOfDay: TimeOfDay | 'auto';
    reducedMotion: boolean;
    cameraDistance: number;
  };
  /** resolved time of day actually rendered */
  timeOfDay: TimeOfDay;
  /** which world is built (fixed for the page lifetime; set from ?world= or the default at boot) */
  worldMode: WorldMode;
  /** id of the interactable currently in range (poi id, postcard id, 'baybay', npc id) */
  focus: string | null;
  /** interactable under the mouse (hover highlight) */
  hover: string | null;
  dialogue: { nodeId: string | null };
  /**
   * The guided tour. `id` (wave 4) names which one: DEFAULT_TOUR_ID = the district's FIRST_TOUR, or a city tour
   * ('sf-grand' …). Optional in the type so the older writers compile unchanged; the store fills it in (a patch that
   * sets `tour` without an id means the first lesson), so at runtime it is always set: read it with tourIdOf().
   */
  tour: { active: boolean; stop: number; completed: string[]; id?: string };
  week: { companions: string | null; vibe: string | null; region: string | null; results: string[]; step: number };
  panel: { kind: PanelKind; id?: string };
  photoMode: boolean;
  /**
   * Legacy "on transit" flag, mirrored from `move`: 'streetcar' exactly while move.mode is 'transit', whatever the line
   * (the F-line, a cable car, the ferry: read move.line for which). The store keeps the two consistent whichever one a
   * writer sets (game/transit.ts still writes `riding` for the hero F-line); new code reads `move`.
   */
  riding: 'streetcar' | null;
  /** movement mode (changes on transitions only, never per frame; per-frame vehicle / glide state is in runtime) */
  move: MoveState;
  wishlist: WishItem[];
  postcards: string[];
  goalsDone: string[];
  toasts: Toast[];
  /** place name shown top-left (area the player is in) */
  area: string | null;
  /** last low-frequency copy of the player position (for UI only) */
  playerPos: Vec2;
  viewpointUnlocked: boolean;
  catalogStatus: 'idle' | 'loading' | 'ready' | 'error';
}

type Listener = () => void;

export function createStore<T extends object>(initial: T, normalize?: (state: T, patch: Partial<T>) => Partial<T>) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const raw = typeof patch === 'function' ? patch(state) : patch;
      const next = normalize ? normalize(state, raw) : raw;
      let changed = false;
      for (const key in next) if (!Object.is((state as Record<string, unknown>)[key], (next as Record<string, unknown>)[key])) { changed = true; break; }
      if (!changed) return;
      state = { ...state, ...next };
      listeners.forEach(listener => listener());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/** Default world until the city passes its gates (RESUME.md); ?world=city|district overrides. */
export const DEFAULT_WORLD_MODE: WorldMode = 'district';
export function readWorldMode(search: string = typeof location !== 'undefined' ? location.search : ''): WorldMode {
  const w = new URLSearchParams(search).get('world');
  return w === 'city' || w === 'district' ? w : DEFAULT_WORLD_MODE;
}

const FOOT: MoveState = { mode: 'foot' };

/** Wave 4: the tour a `tour` without an id means (the district's first lesson, data/tours.ts FIRST_TOUR). */
export const DEFAULT_TOUR_ID = 'first-lesson';
export const tourIdOf = (tour: GameState['tour']): string => tour.id ?? DEFAULT_TOUR_ID;

export const initialGameState = (): GameState => ({
  phase: 'title',
  mode: 'onboarding',
  paused: false,
  settings: { sound: true, music: true, quality: 'high', timeOfDay: 'auto', reducedMotion: false, cameraDistance: 15 },
  timeOfDay: 'golden',
  worldMode: readWorldMode(),
  focus: null,
  hover: null,
  dialogue: { nodeId: null },
  tour: { active: false, stop: 0, completed: [], id: DEFAULT_TOUR_ID },
  week: { companions: null, vibe: null, region: null, results: [], step: 0 },
  panel: { kind: null },
  photoMode: false,
  riding: null,
  move: FOOT,
  wishlist: [],
  postcards: [],
  goalsDone: [],
  toasts: [],
  area: null,
  playerPos: { x: 0, z: 0 },
  viewpointUnlocked: false,
  catalogStatus: 'idle',
});

/**
 * Keeps `riding` (legacy) and `move` consistent: a patch that sets only one of them gets the other derived.
 * Photo mode taken on foot shows as move 'photo' (and back to 'foot'); in a vehicle it only freezes (the mode stays).
 * Wave 4: a `tour` patch without an id gets DEFAULT_TOUR_ID (the district writers predate tour ids).
 */
export function syncMovePatch(state: GameState, patch: Partial<GameState>): Partial<GameState> {
  let out = patch;
  if (patch.tour && patch.tour.id === undefined) out = { ...out, tour: { ...patch.tour, id: DEFAULT_TOUR_ID } };
  if ('riding' in patch && !('move' in patch)) {
    if (patch.riding === 'streetcar' && state.move.mode !== 'transit') out = { ...out, move: { mode: 'transit', line: 'streetcar', spot: 'rail' } };
    else if (patch.riding === null && state.move.mode === 'transit') out = { ...out, move: FOOT };
  } else if ('move' in patch && patch.move && !('riding' in patch)) {
    // day-0 contract (wave 2): any transit line locks like the F-line (cable cars, the ferry)
    const riding = patch.move.mode === 'transit' ? 'streetcar' : null;
    if (riding !== state.riding) out = { ...out, riding };
  }
  if ('photoMode' in patch && !('move' in patch)) {
    const mode = (out.move ?? state.move).mode;
    if (patch.photoMode && mode === 'foot') out = { ...out, move: { mode: 'photo' } };
    else if (!patch.photoMode && mode === 'photo') out = { ...out, move: FOOT };
  }
  return out;
}

export const game = createStore<GameState>(initialGameState(), syncMovePatch);

export function useGame<S>(selector: (state: GameState) => S): S {
  return useSyncExternalStore(game.subscribe, () => selector(game.get()), () => selector(game.get()));
}

let toastId = 0;
export function toast(text: string, tone: Toast['tone'] = 'info', ms = 2600) {
  const id = ++toastId;
  game.set(s => ({ toasts: [...s.toasts, { id, text, tone }].slice(-3) }));
  window.setTimeout(() => game.set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), ms);
}
