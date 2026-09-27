import type { TripMode } from '../game/tripTypes';
import type { InteractionKind, SurfaceKind } from './types';

/** Typed fire-and-forget event bus: gameplay → audio / fx / analytics. */
export type GameEvent =
  | { type: 'start' }
  | { type: 'footstep'; surface: SurfaceKind; run: boolean }
  | { type: 'jump' }
  | { type: 'land'; impact: number }
  | { type: 'bump'; kind: string; strength: number }
  | { type: 'interact'; id: string; kind: InteractionKind }
  | { type: 'dialogue'; speaker: string; nodeId: string }
  | { type: 'choice' }
  | { type: 'ui'; action: 'open' | 'close' | 'hover' | 'select' | 'error' }
  | { type: 'stamp' }
  | { type: 'postcard'; id: string }
  | { type: 'goal'; id: string }
  | { type: 'wish'; added: boolean }
  | { type: 'bell' }
  | { type: 'streetcar-bell' }
  | { type: 'foghorn' }
  | { type: 'sea-lion'; intensity: number }
  | { type: 'gull' }
  | { type: 'shutter' }
  | { type: 'arrive'; poiId: string }
  | { type: 'area'; name: string }
  | { type: 'guide-call' }
  | { type: 'emote'; who: 'player' | 'baybay'; emote: string }
  // --- movement & vehicles (actors/moveSystem.ts). `vehicle` is the kind, `id` the parked-vehicle id (data/vehicles.ts).
  /** the newcomer got in (after the 0.45 s board); `baybay` = she hopped in too ('hop') or popped in from afar ('pop') */
  | { type: 'vehicle:enter'; vehicle: 'bike' | 'car'; id: string; baybay: 'hop' | 'pop' }
  /** the newcomer got out (after auto-brake + 0.4 s alight) */
  | { type: 'vehicle:exit'; vehicle: 'bike' | 'car'; id: string }
  /** F pressed but no door slot is clear (toast "这里下不了车") */
  | { type: 'vehicle:blocked'; vehicle: 'bike' | 'car'; reason: 'no-slot' | 'moving' }
  /** hit a wall / edge; strength = |normal speed| / vmax (0..1); hard = |v_n| > 5 (the car squashes; BAYBAY "哎呀") */
  | { type: 'vehicle:bump'; vehicle: 'bike' | 'car'; strength: number; hard: boolean; kind: 'wall' | 'edge' | 'stairs' | 'water' }
  /** the bike met a flight of stairs (hint "楼梯要走上去 · F 下车"), or the car an off-limits surface */
  | { type: 'vehicle:refuse'; vehicle: 'bike' | 'car'; surface: 'stairs' | 'water' | 'wood' | 'dirt' | 'other' }
  /** Space hop, or an SF hill-crest hop (crest: true); land fires as vehicle:land */
  | { type: 'vehicle:hop'; vehicle: 'bike' | 'car'; crest: boolean }
  | { type: 'vehicle:land'; vehicle: 'bike' | 'car'; impact: number }
  /** H: bike bell / toy horn */
  | { type: 'vehicle:horn'; vehicle: 'bike' | 'car' }
  /** hold F: your vehicle rolls up to you */
  | { type: 'vehicle:call'; vehicle: 'bike' | 'car'; id: string }
  /** first time on a grade > 0.4 in this session (on foot or riding) — BAYBAY line hook */
  | { type: 'hill'; grade: number; mode: 'foot' | 'bike' | 'car' }
  /** reached a crest after ≥ 10 s running uphill: the newcomer pants for 2 s (no stamina) */
  | { type: 'pant' }
  /** sat down on a bench / step (seat id), or stood up again */
  | { type: 'sit'; seat: string }
  | { type: 'stand'; seat: string }
  /** pelican: glide unlocked (Coit viewpoint or ?debug=1), take-off swoop started, landed (hop + squash) */
  | { type: 'glide:unlock' }
  | { type: 'glide:start' }
  | { type: 'glide:land'; x: number; z: number }
  /** G pressed with no safe landing within 40 u (never water) — keep flying */
  | { type: 'glide:no-landing' }
  /** transit: E switched rail ↔ seat */
  | { type: 'transit:spot'; line: string; spot: 'rail' | 'seat' | 'deck' }
  /**
   * Transit (wave 2, lane F emits; audio, G2 lines and goals, H2b listen). One member for every line kind:
   * - bell: the gripman's / motorman's bell (H on a cable car too); `streetcar-bell` above stays for the hero F-line
   * - board / depart / arrive: at a station (`line` = transit line id, e.g. 'powell-hyde', 'f-line', 'ferry')
   * - ride: one real stop-to-stop segment finished; `real` = it counts (not fast travel, odometer rule met), never
   *   emitted in travel mode
   * - grip / push / turned: cable grip clank, a push on a turntable, the car finished turning
   * - horn: ferry horn; hop-aside: a crowd walker stepped out of a vehicle's way
   * - approach (wave 4): the vehicle the player rides is ≈ 60 u before its next stop (the loop narration's look-at
   *   bias, "下一站" barks); arrive / depart / approach may carry the stop and its attraction
   * `strength` 0..1 is an optional loudness / intensity hint.
   * `station` (wave 4) = the TransitStop id (transit.json) the event is about; `attraction` = the attraction id the stop
   * serves (data/sf/attractionTypes.ts `Attraction.id`), when it serves one.
   * `dir` (wave 4, lane C's request) = the ridden vehicle's direction along the line's arc: 1 = increasing `at` (the
   * path order: outbound from Embarcadero on the N / M), −1 = decreasing (inbound); absent when unknown (a loop runs
   * one way). Lane C's `metroNarration` says a portal line ("钻出日落隧道") only with an explicit `dir`.
   */
  | { type: 'transit'; what: TransitWhat; line: string; kind: TransitKind; real?: boolean; strength?: number; station?: string; attraction?: string; dir?: 1 | -1 }
  /** play a recorded BAYBAY line (H2b's data/voiceLinesSf.ts ids); the bubble text is shown by the caller (G2) */
  | { type: 'voice-line'; id: string }
  /** tap-to-drive autopilot (E2): started, arrived, gave up (stuck) or cancelled by manual input */
  | { type: 'vehicle:auto'; vehicle: 'bike' | 'car'; state: 'start' | 'arrive' | 'stuck' | 'cancel' }
  /** fast travel (G1): lift-off, the cloud cut on long trips, touch-down at the destination (place / landmark id) */
  | { type: 'travel'; what: 'start' | 'cloud' | 'land'; to: string }
  /** a place or neighbourhood seen for the first time (G1 discovery); `id` is the place / zone id */
  | { type: 'discover'; id: string; kind: 'place' | 'zone' | 'landmark' }
  /**
   * Wave 4 · arrival moment (lane C's game/arrival.ts emits; lane G shows the toast / reveal / ArrivalCard, audio plays
   * the stamp). `place` = the place-index id arrived at; `attraction` = its Attraction id when that differs or is
   * known; `tier` = the attraction's map rank (AttractionRank: 1 = T1 … 3 = T3); `first` = the first arrival ever
   * (the full moment); later arrivals only emit with first: false (quiet, no reveal).
   */
  | { type: 'arrival'; place: string; tier: 1 | 2 | 3; first: boolean; attraction?: string }
  /**
   * Wave 4 · a trip (跟 BAYBAY 去 / TripOptions; lane C's flow.trip emits, lanes G / P / T / audio listen):
   * start = a trip option was chosen; leg = leg `leg` (0-based index into TripOption.legs) just started; end = arrived
   * at `place`; cancel = ended early (结束, a new trip, a tour taking over). `mode` = the chosen TripOption.mode.
   */
  | { type: 'trip'; what: 'start' | 'leg' | 'end' | 'cancel'; place: string; mode: TripMode; leg?: number };

/** Transit line kinds (the store's move.line holds the line id; this is its vehicle kind). Wave 4 adds the sightseeing
 * bus loop ('bus') and the Muni Metro lines ('light-rail'). The lists are runtime values so the contracts test pins them. */
export const TRANSIT_KINDS = ['streetcar', 'cable-car', 'ferry', 'bus', 'light-rail'] as const;
export type TransitKind = (typeof TRANSIT_KINDS)[number];
export const TRANSIT_WHATS = ['bell', 'board', 'depart', 'arrive', 'ride', 'grip', 'push', 'turned', 'horn', 'hop-aside', 'approach'] as const;
export type TransitWhat = (typeof TRANSIT_WHATS)[number];

type Handler = (event: GameEvent) => void;
const handlers = new Set<Handler>();

export function emit(event: GameEvent) {
  handlers.forEach(handler => {
    try { handler(event); } catch (error) { if (import.meta.env.DEV) console.error('[opus-bay event]', error); }
  });
}

export function onEvent(handler: Handler) {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}
