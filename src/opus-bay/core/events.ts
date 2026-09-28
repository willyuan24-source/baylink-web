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
  | { type: 'trip'; what: 'start' | 'leg' | 'end' | 'cancel'; place: string; mode: TripMode; leg?: number }
  /**
   * Wave 5 (frozen, plan sf-w5-plan.md §4.2) · the player was stuck at (x, z): `watchdog` = game/lockWatchdog freed a
   * lock nothing explained (W5-0b; `source` names the holds left, else 'unknown'), `pull` = BAYBAY pulled the player
   * free (lane F), `sweep` = the QA sweep's report. A DEV log: every one is a bug with a source, not a fix.
   */
  | { type: 'stuck'; x: number; z: number; what: 'pull' | 'watchdog' | 'sweep'; source?: string }
  // --- Wave 5 day 0 (frozen, plan sf-w5-plan.md §4.2 W5-0d; the lead note sf-w5-lead.md §4) ---
  /**
   * Any lane → lane E's ledger (economy/ledger.ts): "this happened, pay it". `source` follows REWARD_SOURCE below
   * (`<prefix>:<id>`, e.g. `arrive:coit-tower`, `egg:telegraph-hill-parrots`, `daily:2026-10-03:2`); the ledger pays each
   * source ONCE per save (bitsets / play.e) and ignores a source outside the grammar. `coins` is what the emitter asks
   * for (the ledger may clamp it to its own table); `stamp` (optional) names the notebook stamp it also earns.
   */
  | { type: 'reward'; source: string; coins: number; stamp?: string }
  /** lane E, after paying a reward (or a purchase: negative delta, source `shop:<item>`): the pill badge and the chime */
  | { type: 'coins'; total: number; delta: number; source: string }
  /** a find (FIND_KINDS): D eggs / pebbles / sounds, A view spots, E caches, R event souvenirs; `first` = never found before */
  | { type: 'find'; kind: FindKind; id: string; first: boolean }
  /** lane A's PlayKit: an activity started, ended (with the medal tier reached, if any) or was cancelled (moving away: free) */
  | { type: 'play'; activity: string; what: 'start' | 'end' | 'cancel'; tier?: 1 | 2 | 3 }
  /** lane E's 小铺: the sheet opened / closed, an item bought or worn */
  | { type: 'shop'; what: 'open' | 'buy' | 'wear' | 'close'; item?: string }
  /** lane R: the player entered / left a live event's venue zone; an event's real window opened / closed (Bay time) */
  | { type: 'realsf'; what: 'event-enter' | 'event-leave' | 'window-open' | 'window-close'; id: string }
  /** lane F's pointer: the player tapped their own character or BAYBAY (`double` = a double tap) → lane A's emote wheel / pet */
  | { type: 'self-tap'; who: 'player' | 'baybay'; double: boolean };

/** Wave 5 (frozen): what a `find` event can be. The notebook's pages and the ledger's bitsets are keyed by these. */
export const FIND_KINDS = ['egg', 'view', 'sound', 'pebble', 'cache', 'souvenir', 'nature'] as const;
export type FindKind = (typeof FIND_KINDS)[number];

/** Wave 5 (frozen): the prefixes a `reward` source may start with (the ledger's pay-once key space). */
export const REWARD_PREFIXES = ['arrive', 'postcard', 'favour', 'goal', 'egg', 'view', 'sound', 'pebble', 'cache', 'trail', 'ring', 'event', 'daily', 'page', 'medal', 'pelican'] as const;
export type RewardPrefix = (typeof REWARD_PREFIXES)[number];
/**
 * Wave 5 (frozen): the reward source grammar, `<prefix>:<id>` with a lower-case id of 1–80 characters from `a-z 0-9 : @ -`.
 * Examples: `arrive:coit-tower`, `postcard:sf-painted-ladies`, `trail:filbert-steps:3`, `medal:slides:2`,
 * `event:hardly-strictly-bluegrass-2026`, `daily:2026-10-03:1`, `pelican:unlock`. Anything else is not paid.
 */
export const REWARD_SOURCE = /^(arrive|postcard|favour|goal|egg|view|sound|pebble|cache|trail|ring|event|daily|page|medal|pelican):[a-z0-9:@-]{1,80}$/;
/** The prefix of a well-formed reward source, or null (ledger, tests). */
export function rewardPrefix(source: string): RewardPrefix | null {
  return REWARD_SOURCE.test(source) ? (source.slice(0, source.indexOf(':')) as RewardPrefix) : null;
}

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
