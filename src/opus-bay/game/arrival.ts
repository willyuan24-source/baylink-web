import type { GameEvent } from '../core/events';
import type { Bilingual, Mood } from '../core/types';
import { CITY_DISTRICT_POIS } from '../data/pois';
import type { Attraction, AttractionRank } from '../data/sf/attractionTypes';
import { CITY_SUBJECT_FACTS } from '../data/sf/cityPois';
import { placeCardNow } from '../data/sf/placeCardTypes';
import { ARRIVAL_LINES, QUIET_LINES } from '../data/sf/tourLines';
import { LINE_TTL, type PacedLine } from './linePacer';
import { arrivalToast } from './tripText';

/**
 * Wave 4 · lane C · W4-C6: arrival moments (plan sf-w4-plan.md §4.2 "Arrival moments"). PURE: no store, no runtime, no
 * three.js — the city chunk feeds samples in and gets hits out; lane G shows the beats (toast, reveal camera, peek
 * card), audio stamps, the flow marks the place discovered.
 *
 * Trigger (plan): the first arrival within max(12, radius) u of a tier-1 / tier-2 arrival anchor, on foot or right
 * after hopping off, with no dialogue or panel open. Later arrivals emit the event with `first: false` (quiet: no
 * reveal, no toast). Tier-3 attractions emit the event too (discovery, journal) but get no moment.
 *
 *   const watcher = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS), savedSeenIds);
 *   // ≈ 4–10 Hz from the city systems:
 *   const hit = watcher.step({ x, z, now, onFoot, hoppedOffAt, busy, travelling });
 *   if (hit) { emit(hit.event); const beats = arrivalBeats(hit, { reducedMotion, qualityLow, postcardNear }); … }
 *   watcher.hintSuppressed(now)   // the soft free hint stays off for 60 s after an arrival (plan §4.2 waypoint)
 *
 * Re-arming: an anchor fires again (first: false) only after the player has left it beyond 1.6 × its radius, so
 * standing on the edge never repeats. When several anchors overlap, the higher tier wins, then the nearest (the Music
 * Concourse: de Young, Cal Academy, Tea Garden; Coit Tower over the Greenwich Steps 8 u away, whose T3 hit would
 * otherwise swallow Coit's T1 moment and panorama). Fast travel never counts; a busy moment (dialogue, panel,
 * cinematic) holds the arrival until it is free, as long as the player is still inside.
 *
 * Places you cannot walk to (`Attraction.offWalk`: Alcatraz, Treasure Island, whose "arrival" spot is a telescope on
 * the waterfront) get no anchor: standing at Pier 33 is not arriving at Alcatraz (no toast, no reveal, no fly unlock).
 *
 * Panorama spots (`PANORAMA_SPOTS`, part 2): the panorama plays where the VIEW is. When a viewpoint's arrival spot is
 * the view (Corona Heights since lane P's ARRIVAL_OVERRIDES put its arrival on the summit), the arrival anchor carries
 * the panorama. When the arrival spot is elsewhere (more than 12 u away: e.g. the Randall Museum door, 18 u east and
 * 6 u below the summit, where the attraction arrived before), the view gets a small spot of its own: the door fires the
 * moment without the panorama, the summit fires the panorama (and the whole moment, when the player climbs there
 * first). Spots neither swallow nor get swallowed by the arrival anchors around them; their seen key is
 * `<attraction>@<spot>` (the save's `arrivals` keeps it).
 */

export const ARRIVAL_MIN_R = 12;
export const ARRIVAL_REARM_FACTOR = 1.6;
/** an arrival right after getting off a vehicle / transit counts as "on foot" for this long (ms) */
export const HOP_OFF_GRACE_MS = 8000;
/** the soft free hint (and the waypoint's own hint) stays quiet this long after an arrival (ms) */
export const HINT_QUIET_MS = 60000;
/** an unfound postcard this close to the arrival spot gets BAYBAY's "这附近藏着一张明信片哦" (u) */
export const POSTCARD_NEAR_R = 60;

export interface ArrivalAnchor {
  /** Attraction id */
  attraction: string;
  /** place-index id (the arrival event's `place`) */
  place: string;
  rank: AttractionRank;
  /** the arrival spot (Attraction.arrival, else its anchor) */
  x: number;
  z: number;
  /** trigger radius (u); the trigger uses max(12, radius) */
  radius?: number;
  name: Bilingual;
  quiet?: boolean;
  panorama?: boolean;
  /** the SF landmark registry id (Attraction.landmarkId): its card bark is the arrival line of a built landmark */
  landmark?: string;
  /** a panorama spot (PANORAMA_SPOTS): fires the panorama on its own, never counts as a neighbour's visit */
  spot?: 'panorama';
  /** unique key of the anchor in the seen / inside sets (default: `attraction`; spots: `<attraction>@<spot>`) */
  key?: string;
}

export interface ArrivalSample {
  x: number;
  z: number;
  /** performance.now() ms */
  now: number;
  /** walking / running / photo walk (not on a bike, in a car, on transit or gliding) */
  onFoot: boolean;
  /** ms when the player last got off a bike, car or transit (arrivals within HOP_OFF_GRACE_MS count) */
  hoppedOffAt?: number;
  /** a dialogue, a panel or a cinematic is open: hold the arrival */
  busy: boolean;
  /** fast travel is running (never counts) */
  travelling: boolean;
}

export type ArrivalEvent = Extract<GameEvent, { type: 'arrival' }>;

export interface ArrivalHit {
  anchor: ArrivalAnchor;
  /** the first arrival ever at this attraction (the full moment) */
  first: boolean;
  /** how the player came: on foot, or just hopped off a vehicle / transit */
  via: 'foot' | 'hop-off';
  event: ArrivalEvent;
  /** a panorama spot's hit: the first time at this spot (the panorama plays); undefined for an arrival anchor */
  panorama?: boolean;
}

/**
 * Where the view of a viewpoint is (attraction id → the spot), used when the attraction's arrival is more than 12 u
 * from it. Corona Heights: the summit of Corona Heights Park, Wikipedia 37.7646522, −122.4391379 (checked 2026-09-27:
 * "an unobstructed panoramic view of the city of San Francisco from downtown to the Twin Peaks"), projectCity → (84.8,
 * 751.7); the spot is the highest node of the published walking graph next to it, (81.0, 749.0) at y 29.8 (the
 * Randall Museum door's node: y 23.6, 18.4 u east). Lane P's ARRIVAL_OVERRIDES now put the arrival itself there (the
 * same point), so today the arrival anchor carries the panorama; the spot keeps the view at the top if the arrival
 * ever moves back to the door. Radius 7: the panorama waits for the top, not the path half-way up.
 */
export const PANORAMA_SPOTS: Readonly<Record<string, { spot: string; x: number; z: number; radius: number; name: Bilingual }>> = {
  'corona-heights-randall-museum': { spot: 'summit', x: 81.0, z: 749.0, radius: 7, name: { zh: '科罗娜高地山顶', en: 'Corona Heights summit' } },
};

/**
 * Anchors from lane P's ATTRACTIONS (data/sf/attractions.ts): the arrival spot, rank, tone, place id, landmark. Places
 * off the walkable city (`offWalk`) are left out: their arrival spot is a viewpoint elsewhere, not the place.
 */
export function arrivalAnchors(attractions: readonly Attraction[]): ArrivalAnchor[] {
  return attractions.filter(a => !a.offWalk).flatMap(a => {
    const x0 = a.arrival?.x ?? a.x, z0 = a.arrival?.z ?? a.z;
    // a spot of its own only when the arrival is not already at the view
    const def = a.panorama ? PANORAMA_SPOTS[a.id] : undefined;
    const spot = def && Math.hypot(def.x - x0, def.z - z0) > ARRIVAL_MIN_R ? def : undefined;
    const anchor: ArrivalAnchor = {
      attraction: a.id,
      place: a.placeId ?? a.id,
      rank: a.rank,
      x: x0,
      z: z0,
      name: a.name,
      ...(a.quiet ? { quiet: true } : {}),
      // a viewpoint with a spot of its own: the panorama plays there, not at the door
      ...(a.panorama && !spot ? { panorama: true } : {}),
      ...(a.landmarkId ? { landmark: a.landmarkId } : {}),
    };
    if (!spot) return [anchor];
    const { x, z, radius } = spot;
    return [anchor, { ...anchor, x, z, radius, panorama: true, spot: 'panorama' as const, key: `${a.id}@${spot.spot}` }];
  });
}

/** Trigger radius: max(12, radius) for arrival anchors; a panorama spot's own (small) radius. */
const radiusOf = (a: ArrivalAnchor) => (a.spot ? a.radius ?? 7 : Math.max(ARRIVAL_MIN_R, a.radius ?? 0));
const keyOf = (a: ArrivalAnchor) => a.key ?? a.attraction;

/** Save v2 `arrivals` (untrusted): well-formed seen keys only (attraction ids, `<attraction>@<spot>`), unique, ≤ 512. */
export const ARRIVAL_SAVE_MAX = 512;
const SEEN_RE = /^[a-z0-9][a-z0-9-]{0,63}(@[a-z0-9-]{1,24})?$/;
export function decodeArrivalSeen(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((k): k is string => typeof k === 'string' && SEEN_RE.test(k)))].slice(0, ARRIVAL_SAVE_MAX);
}
const CELL = 64;
const key = (cx: number, cz: number) => `${cx},${cz}`;

export class ArrivalWatcher {
  private anchors: ArrivalAnchor[] = [];
  private grid = new Map<string, ArrivalAnchor[]>();
  private maxR = ARRIVAL_MIN_R;
  private seenIds: Set<string>;
  /** attraction ids the player is inside (fired) and has not left yet */
  private inside = new Set<string>();
  /** ms of the last arrival (0 = none) */
  lastArrivalAt = 0;

  constructor(anchors: readonly ArrivalAnchor[], seen: Iterable<string> = []) {
    this.seenIds = new Set(seen);
    this.setAnchors(anchors);
  }

  setAnchors(anchors: readonly ArrivalAnchor[]) {
    this.anchors = [...anchors];
    this.grid.clear();
    this.maxR = this.anchors.reduce((m, a) => Math.max(m, radiusOf(a) * ARRIVAL_REARM_FACTOR), ARRIVAL_MIN_R);
    for (const a of this.anchors) {
      const k = key(Math.floor(a.x / CELL), Math.floor(a.z / CELL));
      const list = this.grid.get(k);
      if (list) list.push(a); else this.grid.set(k, [a]);
    }
    for (const k of [...this.inside]) if (!this.anchors.some(a => keyOf(a) === k)) this.inside.delete(k);
  }

  /**
   * Attraction ids arrived at so far, plus the panorama spots reached (`<attraction>@<spot>`); the save keeps them
   * (`first: false` from then on) and reads them back with `decodeArrivalSeen`.
   */
  seen(): string[] { return [...this.seenIds]; }
  hasSeen(attraction: string): boolean { return this.seenIds.has(attraction); }

  /**
   * Wave 5 (W5-C3): the player reappeared here (a resume) rather than arrived: every anchor around (x, z) counts as
   * already entered — no moment until they leave it (1.6 × its radius) and come back. Nothing is marked seen.
   */
  settle(x: number, z: number): number {
    let n = 0;
    for (const a of this.near(x, z)) if (Math.hypot(a.x - x, a.z - z) <= radiusOf(a) && !this.inside.has(keyOf(a))) { this.inside.add(keyOf(a)); n++; }
    return n;
  }

  /** The soft hint stays off for HINT_QUIET_MS after an arrival. */
  hintSuppressed(now: number): boolean { return this.lastArrivalAt > 0 && now - this.lastArrivalAt < HINT_QUIET_MS; }

  private near(x: number, z: number): ArrivalAnchor[] {
    const out: ArrivalAnchor[] = [];
    const span = Math.ceil(this.maxR / CELL);
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let i = cx - span; i <= cx + span; i++) for (let j = cz - span; j <= cz + span; j++) {
      const list = this.grid.get(key(i, j));
      if (list) out.push(...list);
    }
    return out;
  }

  /** One sample: returns the arrival that happens now, or null. */
  step(s: ArrivalSample): ArrivalHit | null {
    const candidates = this.near(s.x, s.z);
    // re-arm the anchors the player has left
    for (const k of [...this.inside]) {
      const a = candidates.find(c => keyOf(c) === k) ?? this.anchors.find(c => keyOf(c) === k);
      if (!a || Math.hypot(a.x - s.x, a.z - s.z) > radiusOf(a) * ARRIVAL_REARM_FACTOR) this.inside.delete(k);
    }
    if (s.travelling || s.busy) return null;
    const hopOff = s.hoppedOffAt !== undefined && s.now - s.hoppedOffAt >= 0 && s.now - s.hoppedOffAt <= HOP_OFF_GRACE_MS;
    if (!s.onFoot && !hopOff) return null;
    const via = s.onFoot && !hopOff ? 'foot' : 'hop-off';
    // the higher tier first (T1 over T3), then the nearest; panorama spots stand apart
    let best: ArrivalAnchor | null = null, bestD = Infinity;
    for (const a of candidates) {
      if (a.spot || this.inside.has(keyOf(a))) continue;
      const d = Math.hypot(a.x - s.x, a.z - s.z);
      if (d > radiusOf(a)) continue;
      if (!best || a.rank < best.rank || (a.rank === best.rank && d < bestD)) { best = a; bestD = d; }
    }
    if (best) {
      // every anchor the player stands in now counts as visited-inside (no second hit from an overlapping neighbour)
      for (const a of candidates) if (!a.spot && Math.hypot(a.x - s.x, a.z - s.z) <= radiusOf(a)) this.inside.add(keyOf(a));
      const first = !this.seenIds.has(best.attraction);
      this.seenIds.add(best.attraction);
      this.lastArrivalAt = s.now;
      return { anchor: best, first, via, event: { type: 'arrival', place: best.place, tier: best.rank, first, attraction: best.attraction } };
    }
    // a panorama spot: its own seen key; the attraction's first arrival too when the player climbed here first
    for (const a of candidates) {
      if (!a.spot || this.inside.has(keyOf(a)) || Math.hypot(a.x - s.x, a.z - s.z) > radiusOf(a)) continue;
      this.inside.add(keyOf(a));
      const first = !this.seenIds.has(a.attraction);
      const panorama = !this.seenIds.has(keyOf(a));
      this.seenIds.add(a.attraction);
      this.seenIds.add(keyOf(a));
      this.lastArrivalAt = s.now;
      return { anchor: a, first, via, panorama, event: { type: 'arrival', place: a.place, tier: a.rank, first, attraction: a.attraction } };
    }
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The beats of a moment
// ---------------------------------------------------------------------------------------------------------------

export interface ArrivalContext {
  reducedMotion?: boolean;
  /** quality 'low' (no reveal camera) */
  qualityLow?: boolean;
  /** an unfound postcard lies within POSTCARD_NEAR_R u of the arrival spot */
  postcardNear?: boolean;
  /** the line resolver (default `defaultArrivalLine`: frozen lines, the card's bark, the landmark / district card's bark) */
  lineFor?: (attraction: string, anchor: ArrivalAnchor) => { text: Bilingual; voice?: string; mood?: Mood } | null;
}

export interface ArrivalBeats {
  /** the gold toast, larger than the discovery toast (null: none) */
  toast: Bilingual | null;
  /** BAYBAY's line (null: none) and the voice-line id to play with it (tourLines id) */
  line: Bilingual | null;
  voice: string | null;
  mood: Mood;
  /** the 2.4 s reveal camera (T1, on foot, first, motion allowed, quality not low, not quiet) */
  reveal: boolean;
  /** the peek card above the PhoneBar: photo, name, [看介绍] [拍照] [下一站] (6 s) */
  peek: boolean;
  /** a journal stamp; `stampSound` false in quiet places */
  stamp: boolean;
  stampSound: boolean;
  /** "这附近藏着一张明信片哦" (and the glint brightens) */
  postcardHint: Bilingual | null;
  /** the viewpoint panorama: BAYBAY points out the landmarks in view (first arrival at a panorama point) */
  panorama: boolean;
  /** the place becomes discovered (fast travel unlocked) */
  discover: true;
}

export const POSTCARD_HINT: Bilingual = { zh: '这附近藏着一张明信片哦', en: 'There\'s a postcard hiding somewhere near here' };

/**
 * The default line: the frozen arrival line (recorded), a quiet line, the wave-4 card's bark once the cards are loaded,
 * else the bark of the card the place already has — a built landmark's (data/sf/landmarks.ts via cityPois, glossed:
 * Golden Gate Bridge, Palace, Painted Ladies …) or the district POI's (Coit Tower, the Exploratorium). Null only for
 * the few places with no card at all (text-free toast + peek).
 */
export function defaultArrivalLine(attraction: string, anchor?: Pick<ArrivalAnchor, 'landmark' | 'place' | 'quiet'>): { text: Bilingual; voice?: string; mood?: Mood } | null {
  const frozen = ARRIVAL_LINES[attraction] ?? QUIET_LINES[attraction];
  if (frozen) return { text: { zh: frozen.zh, en: frozen.en }, voice: frozen.id, mood: frozen.mood };
  const mood: Mood = anchor?.quiet ? 'thinking' : 'point';
  const card = placeCardNow(attraction);
  if (card) return { text: card.bark, mood: card.quiet ? 'thinking' : mood };
  const landmark = anchor?.landmark ? CITY_SUBJECT_FACTS[anchor.landmark] : undefined;
  if (landmark) return { text: landmark.fact, mood };
  const poi = anchor?.place ? CITY_DISTRICT_POIS.find(p => p.id === anchor.place) : undefined;
  return poi?.bark ? { text: poi.bark, mood } : null;
}

/** What an arrival shows (pure). Tier 3 and later arrivals are quiet: discovery only. */
export function arrivalBeats(hit: ArrivalHit, ctx: ArrivalContext = {}): ArrivalBeats {
  const { anchor, first } = hit;
  const moment = first && anchor.rank <= 2;
  const quiet = !!anchor.quiet;
  const line = moment ? (ctx.lineFor ?? defaultArrivalLine)(anchor.attraction, anchor) : null;
  return {
    toast: moment ? arrivalToast(anchor.name, quiet) : null,
    line: line?.text ?? null,
    voice: line?.voice ?? null,
    mood: quiet ? 'thinking' : line?.mood ?? 'happy',
    reveal: moment && anchor.rank === 1 && hit.via === 'foot' && !quiet && !ctx.reducedMotion && !ctx.qualityLow,
    peek: moment,
    stamp: first,
    stampSound: first && !quiet,
    postcardHint: moment && ctx.postcardNear ? POSTCARD_HINT : null,
    panorama: hit.panorama ?? (first && !!anchor.panorama),
    discover: true,
  };
}

/**
 * The arrival line as a paced line (game/linePacer.ts): it waits for the tour clip that is still playing (lane V's
 * rule) and is dropped after LINE_TTL.arrival seconds rather than said long after the moment. The postcard hint
 * follows it as its own text bubble. Empty when the moment says nothing.
 */
export function arrivalPaced(beats: Pick<ArrivalBeats, 'line' | 'voice' | 'mood' | 'postcardHint'>, attraction: string): PacedLine[] {
  const out: PacedLine[] = [];
  if (beats.line) out.push({ text: beats.line, voice: beats.voice, mood: beats.mood, ttl: LINE_TTL.arrival, key: beats.voice ?? `arrive:${attraction}` });
  if (beats.postcardHint) out.push({ text: beats.postcardHint, mood: 'point', ttl: LINE_TTL.arrival, key: `postcard-near:${attraction}` });
  return out;
}
