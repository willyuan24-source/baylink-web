import { useEffect, useRef } from 'react';
import { subscribeLocale } from '../../i18n/locale';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { createStore, game } from '../core/store';
import { cityTerrain, groundPending, heightAt } from '../core/terrain';
import type { Bilingual, Vec2 } from '../core/types';
import { ATTRACTIONS, ATTRACTION_INDEX, attractionColor, tripDestination, withSiteFlags } from '../data/sf/attractions';
import type { Attraction } from '../data/sf/attractionTypes';
import { patchToyShader } from '../world/materials';
import { FlagLayer, flagScaleDistance } from '../world/sf/flags';
import { lateWarmups } from '../world/warmup';
import { rideLookAt } from '../actors/cameraModes';
import { landmarkBaseY } from '../actors/glideTall';
import { emit, onEvent } from '../core/events';
import { activeLineFleet } from '../data/transit';
import { REVEAL_VIEWS, planReveal, photoPose, revealShots, revealSight, revealView, type CamPose, type PhotoSpec } from '../actors/reveal';
import { faceAfterLanding } from '../actors/arrivalFace';
import { faceCameraToward, playShots } from './cinema';
import { registerFocusHook } from './brain';
import { isDiscovered, setDiscoveryAnnouncer } from './discovery';
import { type FlagSource, type FlagTarget, type PanoramaTag, extraFlags, flagMax, layoutPanoramaTags, pickFlags, pickPanoramaTags, tagWidth, type TagInput, PANORAMA } from './flags';
import { flow } from './flowStore';
import { landmarkFlagsPref } from './guidePrefs';
import type { Box } from './hudLayout';
import { tickStreet } from './streets';
import { registerSceneSystem } from './systemsRegistry';
import { timeLabel } from './tripText';
import { ALIGHT_S, TRIP_SPEED, autoTravelSeconds, tripRemainingSeconds, STREET_FACTOR } from './tripPlan';
import { isScenicLeg, scenicSecondsLeft } from './scenicTrip';
import { liveRideEta, liveWaitLeft } from './tripProviders';
import { autoOn } from './autoTravel';
import type { TripLeg, TripState } from './tripTypes';
import { CHEVRONS, WAYPOINT, acrossWaterLabel, chevronPoses, layoutWaypoint, occludedByTerrain, routeRemaining, waypointSafeArea } from './waypoint';
// the waypoint's label / notch / arrow rules (data-label, --ob-label-dy …) come with the layout that writes them
import '../ui/guide-ui.css';
import { importRetry } from './importRetry';

/**
 * Wave 4 · lane G's guidance in the city (integration phase; plan sf-w4-plan.md §4.2, §5.5). LAZY and CITY-ONLY:
 * game/Systems.tsx imports this module dynamically when the page runs in city mode (never in the district, never in
 * GameRoot's static graph: the P7 guard), and ui/GuideLayer.tsx (the Overlay's city-only lazy layer) renders from its
 * store. Nothing here runs in district mode, so the district is unchanged.
 *
 *   flags      world/sf/flags FlagLayer (1 InstancedMesh, 1 draw call, 1 program 'g-flags'): picks at 4 Hz from
 *              game/flags pickFlags — the objective / trip target first (gold), undiscovered T1 in view, and during a
 *              panorama every T1 / T2 in view; 3 on phones / quality mid, 6 on desktop
 *   waypoint   `cityWaypoint()`, called by the projector (Systems.tsx project()) instead of the district rule: the
 *              safe area, the fixed HUD, BAYBAY's bubble (label drops below it, else time only, else the pin alone:
 *              M1), the trip's own remaining time, the occluded notch
 *   arrival    lane C's `flow.arrival` → the gold toast, the 6 s peek card, the 2.4 s reveal camera (T1 on foot) and the
 *              viewpoint panorama (10 s of name tags over the flags)
 *   chevrons   three gold chevrons 2–6 u ahead on the trip route while the player walks by hand (1 call, the TOY_INST
 *              program)
 */

// ---------------------------------------------------------------------------------------------------------------
// The UI store (ui/GuideLayer.tsx renders it)
// ---------------------------------------------------------------------------------------------------------------

export interface ArrivalCardView {
  key: number;
  place: string;
  attraction: string;
  name: Bilingual;
  tier: 1 | 2 | 3;
  quiet: boolean;
  color: string;
  photo: string | null;
  /** where the 拍照 button turns the camera */
  x: number;
  z: number;
}

export interface GuideUiState {
  /** the gold arrival toast (3.2 s) */
  toast: { key: number; text: Bilingual; name: Bilingual; quiet: boolean } | null;
  /** the peek card (6 s; shown after the reveal) */
  card: ArrivalCardView | null;
  /** the viewpoint panorama's tags (10 s) */
  panorama: { key: number; tags: PanoramaTag[] } | null;
  /** W5-N7: the quiet discovery chip under the area pill ("+3 个地点"; one find: "+1 · 名称") */
  found: FoundChip | null;
  /** the trip card is open (tap on the trip pill) */
  tripCard: boolean;
}

export const guideUi = createStore<GuideUiState>({ toast: null, card: null, panorama: null, found: null, tripCard: false });

/** ARRIVAL_TOAST_MS of ui/guideText (kept here as a number: this module does not import the UI words) */
export const TOAST_MS = 3200;

// ---------------------------------------------------------------------------------------------------------------
// W5-N7 · the quiet HUD: finds batch into one chip; only the attractions' arrival moments toast
// ---------------------------------------------------------------------------------------------------------------

export interface FoundChip { key: number; n: number; first: Bilingual }
/** the chip stays this long after its last find (ms); a find while it shows adds to it */
export const FOUND_CHIP_MS = 4500;

/**
 * Which finds the chip counts (pure; plan MF6 "minor discoveries batch into one +N 个地点 chip; only attractions
 * toast"): every place, except a tier-1 / tier-2 attraction's while the player is on foot — its arrival moment (lane
 * C's gold toast, the peek card) says it (they came together at the Ferry start: 抵达 + 发现新地点). Tier-3 attractions
 * have no moment: they join the chip. `rankOf` = the attraction rank that speaks for a place, undefined for none.
 */
export function chipFinds<P extends { id: string }>(found: readonly P[], onFoot: boolean, rankOf: (placeId: string) => number | undefined): P[] {
  return found.filter(p => { const r = rankOf(p.id); return !(onFoot && r !== undefined && r <= 2); });
}

/** Has the text a CJK character (a real zh name, not an English one copied into zh)? */
export const hasCjk = (s: string): boolean => /[㐀-鿿豈-﫿]/.test(s);

/**
 * The chip's words (pure): "+1 · 名称" for one find, "+3 个地点" for more. CP-13: a find whose zh name is only its
 * English one (most OSM places: 'Golden White House', 'Boiler rooms') says "+1 个地点" in zh, never English in the zh HUD.
 */
export function foundChipText(found: Pick<FoundChip, 'n' | 'first'>): Bilingual {
  if (found.n !== 1) return { zh: `+${found.n} 个地点`, en: `+${found.n} places` };
  return { zh: hasCjk(found.first.zh) ? `+1 · ${found.first.zh}` : '+1 个地点', en: `+1 · ${found.first.en}` };
}

/** The chip after `add` finds (pure): a showing chip grows, else a new one (key + 1). */
export function bumpFound(cur: FoundChip | null, add: readonly { name: Bilingual }[], key: number): FoundChip | null {
  if (!add.length) return cur;
  return cur ? { ...cur, n: cur.n + add.length } : { key, n: add.length, first: add[0].name };
}

let foundKey = 0;
let foundTimer = 0;
/** discovery.ts announces its finds here in the city (setDiscoveryAnnouncer): the chip, and one stamp per chip. */
export function announceFinds(found: readonly { id: string; name: Bilingual }[]) {
  const s = game.get();
  const onFoot = s.move.mode === 'foot' && !s.riding;
  const add = chipFinds(found, onFoot, id => ATTRACTION_INDEX.primary(id)?.rank);
  if (!add.length) return;
  const cur = guideUi.get().found;
  guideUi.set({ found: bumpFound(cur, add, cur ? cur.key : ++foundKey) });
  // the stamp (a soft sound + sparkles) once per chip, not per find
  if (!cur) emit({ type: 'stamp' });
  window.clearTimeout(foundTimer);
  foundTimer = window.setTimeout(() => guideUi.set({ found: null }), FOUND_CHIP_MS);
}

// ---------------------------------------------------------------------------------------------------------------
// Shared inputs
// ---------------------------------------------------------------------------------------------------------------

export interface ObjectiveLike extends Vec2 { id: string; name: Bilingual; soft?: boolean }

let objective: ObjectiveLike | null = null;
/** The projector's objective (Systems.tsx refreshObjective, 10 Hz): the flag target and the waypoint's target. */
export function noteObjective(o: ObjectiveLike | null) { objective = o; }

/** The attraction list with lane L's real flag poles (world/sf/landmarks/w4sites siteFlagTop, city-only code). */
let sources: readonly Attraction[] | null = null;
async function flagSources(): Promise<readonly Attraction[]> {
  if (sources) return sources;
  try {
    const { siteFlagTop } = await importRetry(() => import('../world/sf/landmarks/context'));
    sources = withSiteFlags(ATTRACTIONS, siteFlagTop);
  } catch {
    sources = ATTRACTIONS;
  }
  return sources;
}

const groundOrNull = (x: number, z: number): number | null => (groundPending(x, z) ? null : heightAt(x, z));
/**
 * A flag's foot: the streamed ground, else the far city's elevation there (the DEM the far layer draws; null only before
 * it loads). Flags stand 150–3,000 u away, mostly beyond the streamed chunks: with the streamed ground alone every far
 * flag waited hidden (seen: City Hall's gold target flag from the Ferry Building never showed).
 */
const flagGround = (x: number, z: number): number | null => (groundPending(x, z) ? cityTerrain()?.heightAt(x, z) ?? null : heightAt(x, z));

/** The attraction a target stands for: the running trip's, else a place / landmark id's primary attraction. */
function targetAttraction(o: ObjectiveLike | null): Attraction | undefined {
  const trip = flow.get().trip;
  if (trip?.attraction) return ATTRACTION_INDEX.get(trip.attraction);
  if (!o) return undefined;
  const id = o.id.replace(/^(?:place:|sf:)/, '');
  return ATTRACTION_INDEX.resolve(id) ?? ATTRACTION_INDEX.primary(id);
}

// ---------------------------------------------------------------------------------------------------------------
// Trip time (the pill, the card, the waypoint)
// ---------------------------------------------------------------------------------------------------------------

const legSpeed = (leg: TripLeg): number => (leg.via === 'run' ? TRIP_SPEED.run : leg.via === 'bike' ? TRIP_SPEED.bike : leg.via === 'car' ? TRIP_SPEED.car : TRIP_SPEED.walk);

/**
 * The current leg's seconds left from `pos`: along its route when it has one (plus the way back onto it), else the
 * straight line × 1.25 at the leg's pace; a ride counts its share of the ride left once aboard (the wait is gone then);
 * a flight its own time. Never more than the leg's planned seconds by more than the way back onto the route.
 * `waitLeft` (not aboard yet): the vehicle's live ETA while the rider waits at the stop, in place of the planned wait.
 */
export function legSecondsLeft(leg: TripLeg, pos: Vec2, riding = false, waitLeft?: number, pace: LegPace = {}): number {
  // (W5-N9: a scenic flight counts down from where the pelican is; the fast hop is its own few seconds)
  if (leg.via === 'fly') return isScenicLeg(leg) ? scenicSecondsLeft(leg, pos) : leg.seconds;
  if (leg.via === 'line') {
    const ride = Math.max(0, leg.seconds - leg.wait);
    if (!riding) return waitLeft === undefined ? leg.seconds : ride + Math.max(0, waitLeft);
    // W5-N2: lane T's ETA from the vehicle's real progress, when it gives one (+ stepping off)
    if (pace.rideEta !== undefined) return Math.max(0, pace.rideEta) + ALIGHT_S;
    const all = Math.hypot(leg.to.x - leg.from.x, leg.to.z - leg.from.z);
    const left = Math.hypot(leg.to.x - pos.x, leg.to.z - pos.z);
    const k = all > 1 ? Math.min(1, left / all) : 0;
    return ride * k;
  }
  const length = leg.path && leg.path.length >= 4
    ? (() => { const r = routeRemaining(leg.path, pos); return r.length + r.off; })()
    : Math.hypot(leg.to.x - pos.x, leg.to.z - pos.z) * STREET_FACTOR;
  // W5-N3: BAYBAY carries the player (auto-travel): the auto-walk's pace, the same the planner quoted
  if (pace.auto && leg.via === 'walk') return autoTravelSeconds(length);
  return length / legSpeed(leg);
}

/**
 * How the current leg is travelled (W5-N2 / N3): `auto` = BAYBAY's auto-travel carries the player (on-foot legs at
 * autoTravelSeconds); `rideEta` = lane T's live seconds to the alighting stop while aboard.
 */
export interface LegPace { auto?: boolean; rideEta?: number }

/**
 * (integration review) The rider now: aboard a vehicle under way, or waiting at its stop with its live ETA. A ride in
 * its waiting stage is not "aboard": counting it as aboard dropped the whole wait from the pill the moment the rider
 * started waiting (a ferry 80–140 s away) and froze the time until the boat came.
 */
export interface RideNow { aboard: boolean; waitLeft?: number; eta?: number }
export function rideNow(): RideNow {
  const r = flow.get().ride;
  if (!r) return { aboard: false };
  // (W9-N2) the number the ride banner shows: the bus / Metro's live ETA (lane T's rideStatus), the other lines' quote
  if (r.stage === 'waiting') return { aboard: false, waitLeft: (r.kind === 'bus' || r.kind === 'light-rail' ? liveWaitLeft() : undefined) ?? r.eta };
  // W5-N2: lane T's live ETA to the alighting stop, when it gives one
  const eta = liveRideEta();
  return eta === undefined ? { aboard: true } : { aboard: true, eta };
}

/**
 * The whole trip's seconds left from `pos` (the pill, the card, the waypoint). `auto` (W5-N3): BAYBAY carries the
 * player, so the on-foot part counts at the auto-walk's pace (the planner's number when the trip started).
 */
export function tripSecondsLeft(trip: TripState, pos: Vec2, ride: boolean | RideNow = rideNow(), auto: boolean = autoOn()): number {
  if (trip.leg >= trip.legs.length) return 0;
  const r = typeof ride === 'boolean' ? { aboard: ride } : ride;
  return tripRemainingSeconds(trip, legSecondsLeft(trip.legs[trip.leg], pos, r.aboard, r.waitLeft, { auto, ...(r.eta !== undefined ? { rideEta: r.eta } : {}) }));
}

/**
 * (W9-N2, review R§5 #6: the walking ETA rose 9 → 25 s) the ETA a reader sees, per slot (the pill, the card, the
 * waypoint): it only goes down — a raw value up to ETA_RISE_K × + ETA_RISE_S above holds the shown one — and rises only
 * when the way really turned longer (above that band for ETA_RISE_HOLD_MS), then says so for ETA_DETOUR_MS (绕一下).
 * A new trip / leg starts afresh.
 */
export const ETA_RISE_K = 1.15;
export const ETA_RISE_S = 3;
export const ETA_RISE_HOLD_MS = 3000;
export const ETA_DETOUR_MS = 5000;
export interface EtaSmooth { key: string; shown: number; riseSince: number; detourAt: number }
export function smoothEta(prev: EtaSmooth | null, key: string, raw: number, now: number): EtaSmooth {
  if (!Number.isFinite(raw) || !prev || prev.key !== key || !Number.isFinite(prev.shown)) return { key, shown: raw, riseSince: 0, detourAt: 0 };
  if (raw <= prev.shown) return { ...prev, shown: raw, riseSince: 0 };
  if (raw <= prev.shown * ETA_RISE_K + ETA_RISE_S) return prev.riseSince ? { ...prev, riseSince: 0 } : prev;
  const since = prev.riseSince || now;
  if (now - since < ETA_RISE_HOLD_MS) return prev.riseSince === since ? prev : { ...prev, riseSince: since };
  return { key, shown: raw, riseSince: 0, detourAt: now };
}
const etaSlots = new Map<string, EtaSmooth>();
/** The smoothed seconds for `slot` (key = the trip and its leg) and whether a detour is being said. */
export function shownEta(slot: string, key: string, raw: number, now: number = performance.now()): { seconds: number; detour: boolean } {
  const s = smoothEta(etaSlots.get(slot) ?? null, key, raw, now);
  etaSlots.set(slot, s);
  return { seconds: s.shown, detour: s.detourAt > 0 && now - s.detourAt < ETA_DETOUR_MS };
}
/** The trip's seconds left as the pill / the card show them (smoothed per slot). */
export function tripEtaShown(slot: string, trip: TripState, pos: Vec2): { seconds: number; detour: boolean } {
  return shownEta(slot, `${trip.startedAt}:${trip.leg}:${trip.legs.length}`, tripSecondsLeft(trip, pos));
}

/** The pill's destination words for a trip: lane P's `tripDestination` name and, on foot, the attraction's short name. */
export function tripNames(trip: TripState): { destination?: Bilingual; short: Bilingual | null } {
  const a = trip.attraction ? ATTRACTION_INDEX.get(trip.attraction) : undefined;
  if (!a) return { short: null };
  // lane P's trip destination: an island's pier by its own name and short name, never the island's
  const d = tripDestination(a);
  return { destination: d.name, short: d.short ?? null };
}

// ---------------------------------------------------------------------------------------------------------------
// The waypoint (Systems.tsx project() calls this in city mode)
// ---------------------------------------------------------------------------------------------------------------

export interface WaypointFrame {
  camera: THREE.Camera;
  /** the visible width (left of an open side sheet), the full canvas width and the height (CSS px) */
  w: number;
  fullW: number;
  h: number;
  mobile: boolean;
  now: number;
  target: ObjectiveLike;
  /** the fixed HUD (hudLayout scanHudBoxes) and BAYBAY's bubble this frame */
  boxes: readonly Box[];
  bubble: Box | null;
  wp: HTMLElement;
  lab: HTMLElement | null;
  /** the district's label time for a target outside a trip (G1: the map's route, the auto-walk pace) */
  plainTime: (target: ObjectiveLike, d: number) => Bilingual;
  /** the text of a Bilingual in the current locale */
  pick: (b: Bilingual) => string;
}

const wpProj = new THREE.Vector3();
const eyeTmp = { x: 0, y: 0, z: 0 };
const tgtTmp = { x: 0, y: 0, z: 0 };
const wpState = { textAt: 0, full: '', name: '', short: '', shown: '', fullW: 120, shortW: WAYPOINT.shortW as number, measured: false, occluded: false, occAt: 0, occKey: '' };
// a language switch (ui/LangPills): the label's words are due at once and measured again on the next projection (a
// waypoint hidden at that moment — a dialogue, a target in reach — gets its new words before it shows again)
subscribeLocale(() => { wpState.textAt = 0; wpState.full = ''; wpState.measured = false; });
const lastWrites = new WeakMap<HTMLElement, string>();
const writeTransform = (el: HTMLElement, v: string) => { if (lastWrites.get(el) !== v) { lastWrites.set(el, v); el.style.transform = v; } };
const writeProp = (el: HTMLElement, name: string, v: string) => { if (el.style.getPropertyValue(name) !== v) el.style.setProperty(name, v); };
const writeData = (el: HTMLElement, key: string, v: string) => { if (el.dataset[key] !== v) el.dataset[key] = v; };

/** Display width estimate of a short label (the time alone): 12.5 px a CJK character, 7 a Latin one, + padding. */
function shortWidth(text: string): number {
  let w = 0;
  for (const ch of text) { const c = ch.codePointAt(0) ?? 0; w += (c >= 0x3000 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) ? 12.5 : 7; }
  return Math.ceil(w + 20);
}

/**
 * The label as two parts (verify-content C14): the name, which gives way with an ellipsis when the label meets the
 * screen's width, and the time, which always shows ("Postcard clue · near Ferry Building clock tower · …" lost the
 * ETA at 375 px). textContent stays "name · time" (the layout compares it); `name` null = the time alone.
 */
function writeLabel(lab: HTMLElement, name: string | null, time: string) {
  const doc = lab.ownerDocument;
  lab.textContent = '';
  if (name) {
    const n = doc.createElement('span');
    n.className = 'ob-wl-name';
    n.textContent = name;
    lab.appendChild(n);
  }
  const tm = doc.createElement('span');
  tm.className = 'ob-wl-time';
  tm.textContent = name ? ` · ${time}` : time;
  lab.appendChild(tm);
}

/** The seconds to the waypoint's target: the current trip leg's (when the target is where the leg ends), else null. */
function tripTargetSeconds(target: Vec2, pos: Vec2): number | null {
  const trip = flow.get().trip;
  if (!trip || trip.leg >= trip.legs.length) return null;
  const leg = trip.legs[trip.leg];
  if (Math.hypot(leg.to.x - target.x, leg.to.z - target.z) > 3) return null;
  const r = rideNow();
  // (W9-N2) the waypoint's own smoothed slot: never rising without a detour, like the pill
  return shownEta('wp', `${trip.startedAt}:${trip.leg}:${trip.legs.length}`, legSecondsLeft(leg, pos, r.aboard, r.waitLeft, { auto: autoOn(), ...(r.eta !== undefined ? { rideEta: r.eta } : {}) })).seconds;
}

/**
 * W4-G2 · a tap on the edge arrow turns the camera to the target over 0.6 s ("转过去"). Wired here (city only) on the
 * projector's waypoint element, so the district's arrow stays exactly the picture it was; it takes pointer events only
 * under guide-ui.css's edge rule.
 */
const turnWired = new WeakSet<HTMLElement>();
function wireTurn(wp: HTMLElement, label: string) {
  const arrow = wp.querySelector<HTMLElement>('.ob-waypoint-arrow');
  if (!arrow) return;
  if (arrow.getAttribute('aria-label') !== label) { arrow.setAttribute('aria-label', label); arrow.title = label; }
  if (turnWired.has(arrow)) return;
  turnWired.add(arrow);
  arrow.setAttribute('role', 'button');
  arrow.tabIndex = -1;
  arrow.addEventListener('click', () => {
    const t = objective;
    if (!t) return;
    emit({ type: 'ui', action: 'select' });
    faceCameraToward(t.x, t.z, { seconds: WAYPOINT.turnSeconds, uncapped: true });
  });
}

/**
 * Lay out and write the waypoint (plan §4.2 "Waypoint (edge compass)"). Returns `recheck` when the label could not be
 * measured yet or its text is due (the projector runs once more even while nothing moves).
 */
// (W9-Q, lane Q) the device's left / right safe-area insets (opus-bay.css --ob-sl / --ob-sr = env(safe-area-inset-*)), read
// once per canvas size (a rotation changes it), not every frame
let safeKey = '';
const safeLR = { l: 0, r: 0 };
function safeInsetsLR(el: HTMLElement, w: number, h: number): { l: number; r: number } {
  const key = `${w}x${h}`;
  if (key !== safeKey) {
    safeKey = key;
    try {
      const cs = getComputedStyle(el);
      safeLR.l = parseFloat(cs.getPropertyValue('--ob-sl')) || 0;
      safeLR.r = parseFloat(cs.getPropertyValue('--ob-sr')) || 0;
    } catch { safeLR.l = 0; safeLR.r = 0; } // (node tests: no computed style)
  }
  return safeLR;
}

export function cityWaypoint(fr: WaypointFrame): { recheck: boolean } {
  const { wp, lab, target, camera, w, h, now } = fr;
  wireTurn(wp, fr.pick({ zh: '转过去', en: 'Turn to it' }));
  const p = runtime.player;
  const d = Math.hypot(target.x - p.x, target.z - p.z);
  if (d < 6) { writeData(wp, 'show', '0'); return { recheck: false }; }
  writeData(wp, 'soft', target.soft ? '1' : '0');
  writeData(wp, 'covered', '0');
  const gy = heightAt(target.x, target.z);
  wpProj.set(target.x, gy + 3.2, target.z).project(camera);
  const behind = wpProj.z > 1;
  // the raw projection over the full canvas (layoutWaypoint mirrors a target behind the camera itself); `w` only
  // narrows the safe area to the part left of an open side sheet
  const rawX = (wpProj.x + 1) / 2 * fr.fullW, rawY = (1 - wpProj.y) / 2 * h;
  // the words (4 Hz): "名称 · 约 N 分钟" and the time alone
  let recheck = false;
  if (lab) {
    if (now - wpState.textAt > 250) {
      wpState.textAt = now;
      const trip = tripTargetSeconds(target, p);
      const time = trip === null ? acrossWaterLabel(p, target) ?? fr.plainTime(target, d) : timeLabel(trip);
      const full = `${fr.pick(target.name)} · ${fr.pick(time)}`;
      if (full !== wpState.full) { wpState.full = full; wpState.name = fr.pick(target.name); wpState.measured = false; }
      wpState.short = fr.pick(time);
      wpState.shortW = Math.max(WAYPOINT.shortW * 0.6, shortWidth(wpState.short));
    } else recheck = true;
  }
  // the ground between the camera and an on-screen target (≤ 4 Hz)
  if (now - wpState.occAt > 250) {
    wpState.occAt = now;
    eyeTmp.x = camera.position.x; eyeTmp.y = camera.position.y; eyeTmp.z = camera.position.z;
    tgtTmp.x = target.x; tgtTmp.y = gy + 3.2; tgtTmp.z = target.z;
    wpState.occluded = !behind && occludedByTerrain(eyeTmp, tgtTmp, groundOrNull);
  }
  // measure the full label once per text (one layout read per change)
  if (lab && !wpState.measured) {
    if (lab.textContent !== wpState.full) writeLabel(lab, wpState.name, wpState.short);
    wpState.shown = wpState.full;
    const lw = lab.offsetWidth;
    if (lw) { wpState.fullW = lw; wpState.measured = true; } else recheck = true;
  }
  const area = waypointSafeArea({ w, h, phone: fr.mobile, inset: safeInsetsLR(wp, fr.fullW, h) });
  const L = layoutWaypoint({ x: rawX, y: rawY, behind, area, labelW: wpState.fullW, shortW: wpState.shortW, bubble: fr.bubble, boxes: fr.boxes, occluded: wpState.occluded });
  writeData(wp, 'show', L.hidden ? '0' : '1');
  if (L.hidden) return { recheck };
  writeTransform(wp, `translate3d(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px, 0)`);
  writeData(wp, 'edge', L.edge ? '1' : '0');
  writeData(wp, 'label', L.label.mode);
  writeData(wp, 'notch', L.notch ? '1' : '0');
  writeProp(wp, '--ob-angle', `${L.angle.toFixed(3)}rad`);
  if (lab) {
    const text = L.label.mode === 'short' ? wpState.short : wpState.full;
    if (L.label.mode !== 'none' && wpState.shown !== text) { if (L.label.mode === 'short') writeLabel(lab, null, text); else writeLabel(lab, wpState.name, wpState.short); wpState.shown = text; }
    const box = L.label.box;
    if (box) {
      const cx = (box.l + box.r) / 2;
      writeProp(wp, '--ob-label-dx', `${(cx - L.x).toFixed(0)}px`);
      writeProp(wp, '--ob-label-dy', `${(box.t - L.y).toFixed(0)}px`);
      writeProp(wp, '--ob-label-half', `${((box.r - box.l) / 2).toFixed(0)}px`);
    }
  }
  return { recheck };
}

// ---------------------------------------------------------------------------------------------------------------
// Chevrons (W4-G6): the TOY_INST program (same onBeforeCompile and cache key), our own material instance
// ---------------------------------------------------------------------------------------------------------------

function chevronGeometry(): THREE.BufferGeometry {
  // a flat "^" pointing +z (heading 0 faces +z), 1.3 u wide, 0.9 u deep, arms 0.32 u thick
  const pts: [number, number][] = [[-0.65, -0.35], [0, 0.45], [0.65, -0.35], [0.42, -0.5], [0, 0.12], [-0.42, -0.5]];
  const pos: number[] = [], col: number[] = [], info: number[] = [];
  const gold = new THREE.Color('#e7b04e');
  for (const [x, z] of pts) { pos.push(x, 0, z); col.push(gold.r, gold.g, gold.b); info.push(0, 0, 0, 1.35); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pts.flatMap(() => [0, 1, 0]), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
  g.setIndex([0, 1, 4, 0, 4, 5, 1, 2, 3, 1, 3, 4]);
  return g;
}

function chevronMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  m.name = 'ob-chevrons';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  // the TOY_INST program (world/materials makeToy 'ob-toy-inst'): warmed by the boot warm-up, no new program
  m.customProgramCacheKey = () => 'ob-toy-inst';
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// The scene system: flags, chevrons, the panorama projection, the reveal
// ---------------------------------------------------------------------------------------------------------------

/** QA (DEV): what the layer drew last. */
export const guideStats = { flags: 0, chevrons: 0, picks: [] as string[], panoramaPlaced: 0 };

let panoramaRoot: HTMLElement | null = null;
/** ui/PanoramaTags registers its root (the projector writes the tags). */
export function registerPanoramaRoot(el: HTMLElement | null) { panoramaRoot = el; }

let panoramaUntil = 0;
const panoramaAnchors = new Map<string, { x: number; y: number }>();
const panoramaInputs: TagInput[] = [];

function GuideScene() {
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const layer = useRef<FlagLayer | null>(null);
  const chev = useRef<THREE.InstancedMesh | null>(null);
  /** `warm`: the flag program is linked (no flag draws before, so the first one never compiles on a frame) */
  const tick = useRef({ picksAt: 0, sources: null as readonly FlagSource[] | null, warm: false });

  useEffect(() => {
    const flags = new FlagLayer({ ground: flagGround });
    scene.add(flags.mesh);
    layer.current = flags;
    revealCamera = camera;
    const geo = chevronGeometry(), mat = chevronMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, CHEVRONS.count);
    mesh.name = 'ob-chevrons';
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    chev.current = mesh;
    let gone = false;
    void flagSources().then(list => { if (!gone) tick.current.sources = list; });
    // the flag program: registered at this module's load ('g-flags'). Before the boot warm-up (GameRoot, 250 ms after
    // the canvas) it is in that pass; after it, lane V's late warm-up (world/warmup, W4-V-I5) compiles it by itself
    // ≈ 30 ms later. The first flag waits for that pass (or 3 s), so no flag draw ever links a program on a frame.
    const t0 = performance.now();
    const t = window.setInterval(() => {
      if (lateWarmups.some(w => w.keys.includes('g-flags')) || performance.now() - t0 > 3000) { tick.current.warm = true; window.clearInterval(t); }
    }, 100);
    return () => {
      gone = true;
      window.clearInterval(t);
      flags.dispose();
      layer.current = null;
      mesh.removeFromParent(); geo.dispose(); mat.dispose(); mesh.dispose();
      chev.current = null;
      if (revealCamera === camera) revealCamera = null;
    };
  }, [scene, camera]);

  useFrame((state) => {
    const now = performance.now();
    const secs = now / 1000;
    const size = state.size;
    const s = game.get();
    const panorama = now < panoramaUntil;
    // flags: the picks at 4 Hz
    const L = layer.current, t = tick.current;
    if (L && t.sources && t.warm && now - t.picksAt > 250) {
      t.picksAt = now;
      const phone = size.width <= 720;
      const o = objective && !objective.soft ? objective : null;
      const a = o ? targetAttraction(o) : undefined;
      const target: FlagTarget | null = o ? { x: o.x, z: o.z, ...(a ? { attraction: a.id } : {}) } : null;
      const hide = s.photoMode || s.phase !== 'playing';
      const player = { x: runtime.player.x, z: runtime.player.z };
      const picks = hide ? [] : pickFlags({
        player, yaw: runtime.camera.yaw, attractions: t.sources, discovered: src => isDiscovered(src.placeId ?? src.id),
        target, max: flagMax({ phone, quality: s.settings.quality, panorama }), showDiscovered: landmarkFlagsPref(), panorama, phone,
        // W5-N1: the registered sources' pennants (R's events …)
        extras: extraFlags({ player, target, phone }),
      });
      L.setPicks(picks, secs);
      guideStats.picks = picks.map(p => `${p.role}:${p.key}`);
    }
    if (L) { L.update(camera, secs, size.height, s.timeOfDay === 'night' ? 0.85 : 1); guideStats.flags = L.mesh.visible ? L.mesh.count : 0; }
    stepChevrons(chev.current);
    if (panorama) projectPanorama(camera, size.width, size.height);
    else if (guideUi.get().panorama && now >= panoramaUntil) guideUi.set({ panorama: null });
  });
  return null;
}

const chevM = new THREE.Matrix4();
const chevQ = new THREE.Quaternion();
const chevP = new THREE.Vector3();
const chevS = new THREE.Vector3(1, 1, 1);
const chevUp = new THREE.Vector3(0, 1, 0);
let chevSeg = 0;

/** Three gold chevrons ahead on the current walking leg's route while the player walks by hand (not auto-walking). */
function stepChevrons(mesh: THREE.InstancedMesh | null) {
  if (!mesh) return;
  const f = flow.get(), s = game.get(), p = runtime.player;
  const trip = f.trip;
  const leg = trip && trip.leg < trip.legs.length ? trip.legs[trip.leg] : null;
  const manual = p.moving && !p.pathTarget && s.move.mode === 'foot' && !s.photoMode && !f.cinematic;
  const path = leg && (leg.via === 'walk' || leg.via === 'run') ? leg.path : undefined;
  if (!manual || !path || path.length < 4) { mesh.visible = false; mesh.count = 0; guideStats.chevrons = 0; return; }
  const r = routeRemaining(path, p, chevSeg);
  chevSeg = r.off < 12 ? r.seg : 0;
  // off the route (a shortcut, a wrong turn): no chevrons rather than arrows pointing back to it
  if (r.off > 8) { mesh.visible = false; mesh.count = 0; guideStats.chevrons = 0; return; }
  const poses = chevronPoses(path, p, chevSeg);
  const t = performance.now() / 1000;
  for (let i = 0; i < poses.length; i++) {
    const c = poses[i];
    chevQ.setFromAxisAngle(chevUp, c.heading);
    // a soft pulse running forward along the three
    const k = 0.92 + 0.12 * Math.max(0, Math.sin(t * 5 - i * 1.1));
    chevP.set(c.x, heightAt(c.x, c.z) + 0.07, c.z);
    chevS.set(k, 1, k);
    mesh.setMatrixAt(i, chevM.compose(chevP, chevQ, chevS));
  }
  mesh.count = poses.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = poses.length > 0;
  guideStats.chevrons = poses.length;
}

const panoProj = new THREE.Vector3();

/** Project the panorama tags over their flags and lay them out clear of the fixed HUD (plan §4.2). */
function projectPanorama(camera: THREE.PerspectiveCamera, w: number, h: number) {
  const pano = guideUi.get().panorama;
  const root = panoramaRoot;
  if (!pano || !root) return;
  const scaleDist = flagScaleDistance(h, camera.fov);
  panoramaInputs.length = 0;
  panoramaAnchors.clear();
  for (const tag of pano.tags) {
    const g = groundOrNull(tag.x, tag.z) ?? heightAt(tag.x, tag.z);
    const d = Math.hypot(camera.position.x - tag.x, camera.position.z - tag.z);
    // the flag's top as the vertex shader draws it (world/sf/flags VERT: the pole rises with a far pennant)
    const k = Math.max(1, d / scaleDist), kp = Math.min(k, 6);
    const top = Math.max(tag.h, 4.5 * k + 1.6 * kp + 4) + 1.4 * kp;
    panoProj.set(tag.x, g + top, tag.z).project(camera);
    const x = (panoProj.x + 1) / 2 * w, y = (1 - panoProj.y) / 2 * h;
    panoramaAnchors.set(tag.id, { x, y });
    panoramaInputs.push({ id: tag.id, x, y, w: tagWidth(pickName(tag.name)), h: 26, rank: tag.rank, behind: panoProj.z > 1 });
  }
  const phone = w <= 720;
  const area = { l: 8, t: phone ? 64 : 76, r: w - 8, b: h - (phone ? 150 : 110) };
  const placed = layoutPanoramaTags(panoramaInputs, area, fixedBoxes());
  placePanoramaWrite(root, placed);
  guideStats.panoramaPlaced = placed.length;
}

/** the fixed HUD boxes (hudLayout, the projector's last scan) — set by Systems through `noteHudBoxes` */
let hudBoxesNow: readonly Box[] = [];
export function noteHudBoxes(b: readonly Box[]) { hudBoxesNow = b; }
const fixedBoxes = () => hudBoxesNow;

/** The locale's pick for tag widths (set by ui/GuideLayer, which knows the locale). */
let pickName: (b: Bilingual) => string = b => b.zh;
export function setGuideLocalePick(fn: (b: Bilingual) => string) { pickName = fn; }

let placeWrite: ((root: HTMLElement, placed: ReturnType<typeof layoutPanoramaTags>, anchors: ReadonlyMap<string, { x: number; y: number }>) => void) | null = null;
/** ui/GuideLayer hands in ui/panoramaPlace placePanoramaTags (DOM writes stay in the UI module). */
export function setPanoramaWriter(fn: typeof placeWrite) { placeWrite = fn; }
function placePanoramaWrite(root: HTMLElement, placed: ReturnType<typeof layoutPanoramaTags>) { placeWrite?.(root, placed, panoramaAnchors); }

// ---------------------------------------------------------------------------------------------------------------
// Panorama (W4-G8) and arrival (W4-G10)
// ---------------------------------------------------------------------------------------------------------------

let panoramaKey = 0;
/**
 * Start the viewpoint panorama from where the player stands (lane C's arrival beats, or E at an overlook): every T1 /
 * T2 in view within 2,000 u gets its flag and a name tag for 10 s (at most 8). Returns false when nothing is in view.
 */
export function startPanorama(eye: Vec2 = runtime.player, yaw: number = runtime.camera.yaw): boolean {
  const list = sources ?? ATTRACTIONS;
  const tags = pickPanoramaTags(eye, yaw, list);
  if (!tags.length) return false;
  panoramaUntil = performance.now() + PANORAMA.seconds * 1000;
  guideUi.set({ panorama: { key: ++panoramaKey, tags } });
  return true;
}
export const panoramaActive = () => performance.now() < panoramaUntil;

const photoOf = (key?: string): string | null => (key ? photoSmall(key) : null);
let photoSmall: (key: string) => string | null = () => null;
/** ui/GuideLayer hands in the licensed-photo lookup (src/data/sf-landmark-photo-assets.json, loaded with the layer). */
export function setPhotoLookup(fn: (key: string) => string | null) { photoSmall = fn; }

let arrivalKey = 0;
let lastArrival: unknown = null;
let revealCamera: THREE.PerspectiveCamera | null = null;

/** A trip end this close to an attraction's arrival spot is that attraction (u): an island's pier, a stop beside it. */
export const TRIP_END_R = 40;

/**
 * W5-N7 · an attraction passed on the way (pure): a trip is running and ends somewhere else. BAYBAY carries the player
 * past it: its moment goes quiet — the discovery chip names it ("+1 · 泛美金字塔"), her line still says it — with no
 * gold toast, no peek card, no reveal camera swinging away mid-walk (Ferry → Coit fired 4 toasts: the Ferry start, the
 * Transamerica Pyramid on the way, Coit, the pelican; now Coit and the pelican). The trip's own end keeps its moment.
 */
export function arrivalPassBy(a: { attraction: string; place: string }, trip: Pick<TripState, 'placeId' | 'attraction' | 'legs' | 'leg'> | null, at?: Vec2 | null): boolean {
  if (!trip || trip.leg >= trip.legs.length) return false;
  if (trip.attraction === a.attraction || trip.placeId === a.place || trip.placeId === a.attraction) return false;
  const end = trip.legs[trip.legs.length - 1]?.to;
  return !(end && at && Math.hypot(end.x - at.x, end.z - at.z) <= TRIP_END_R);
}

/** A new `flow.arrival` (lane C): the toast now, the reveal (T1 on foot), then the card; the panorama after. */
function onArrival(a: NonNullable<ReturnType<typeof flow.get>['arrival']>) {
  const attr = ATTRACTION_INDEX.get(a.attraction);
  const name = attr?.name ?? { zh: a.place, en: a.place };
  const quiet = !!attr?.quiet;
  const key = ++arrivalKey;
  // (W5-N7) passed on the way of a trip: the quiet chip only
  if (arrivalPassBy(a, flow.get().trip, attr?.arrival ?? attr ?? null)) {
    if (a.toast || a.peek) announceFinds([{ id: `arrival:${a.attraction}`, name: attr?.short ?? name }]);
    return;
  }
  if (a.toast) {
    // (ui/GuideLayer GuideToasts times the 3.2 s from when it is on screen — the layer's chunk may still be coming in;
    // this is only the fallback that clears a toast nobody showed)
    guideUi.set({ toast: { key, text: a.toast, name, quiet } });
    window.setTimeout(() => { if (guideUi.get().toast?.key === key) guideUi.set({ toast: null }); }, TOAST_MS * 3);
  }
  const card: ArrivalCardView | null = a.peek && attr ? {
    key, place: a.place, attraction: attr.id, name, tier: attr.rank, quiet, color: attractionColor(attr), photo: photoOf(attr.photoKey), x: attr.x, z: attr.z,
  } : null;
  // after the reveal (or at once): the card, then the panorama (its tags wait for the card's first beat)
  const after = () => {
    if (card) guideUi.set({ card });
    if (a.panorama) window.setTimeout(() => { if (arrivalKey === key) startPanorama(); }, 400);
  };
  if (a.reveal && attr && revealCamera && reveal(attr, revealCamera, after)) return;
  // (W9-C3, lane C surgical) off the pelican with no reveal: face the arrival's heading (actors/arrivalFace)
  if (attr) faceAfterLanding(attr);
  after();
}

/** The 2.4 s reveal from the landmark's photo pose (game/cinema shots; skippable with Esc / E / Enter / Space). */
function reveal(a: Attraction, camera: THREE.PerspectiveCamera, done: () => void): boolean {
  // (W9-C3, lane C surgical) an overlook looks out at its view and Coit Tower at the tower (actors/reveal REVEAL_VIEWS)
  const own = !!REVEAL_VIEWS[a.id];
  const spec = own ? null : revealSpec(a);
  if (!spec && !own) return false;
  const p = runtime.player;
  // the city around the player still streaming in (an arrival right after ?at= / a resume): no stage for a reveal
  const g = groundOrNull(p.x, p.z);
  if (g === null) return false;
  // (the feet as the ground has them: right after a teleport runtime.player.y can still be 0, and the follow pose the
  // reveal hands back to would sit inside the hill — seen at Twin Peaks: the camera at y 4.6 under the 46 u summit)
  const feet = Math.max(p.y, g);
  const start: CamPose = { pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, target: { x: p.x, y: feet + 1.6, z: p.z } };
  const player = { x: p.x, y: feet, z: p.z }, view = spec ? null : revealView(a.id, player);
  if (!spec && !view) return false;
  // (W9-C3) a photo line through a street tree or a roof turns / rises / comes in to a clear one (revealSight)
  const plan = planReveal(start, spec ? photoPose(spec.frame, spec.photo) : view!.photo, player, groundOrNull, { pivot: view?.pivot, sight: revealSight });
  playShots('arrival', revealShots(plan), done);
  return true;
}

/**
 * The site's frame and photo pose: lane L's world/sf/landmarks/context `siteFrame` / `sitePhoto` over every registered
 * site (the 24 SF landmarks and the wave-4 sites). The attraction names its landmark, else its place row's main site.
 */
let siteContext: typeof import('../world/sf/landmarks/context') | null = null;
function revealSpec(a: Attraction): { frame: { x: number; y: number; z: number; yaw: number }; photo: PhotoSpec } | null {
  const ctx = siteContext;
  if (!ctx) return null;
  const id = a.landmarkId ?? ctx.w4SiteOf(a.placeId ?? a.id)?.id ?? a.siteId;
  if (!id) return null;
  const frame = ctx.siteFrame(id, landmarkBaseY), photo = ctx.sitePhoto(id);
  return frame && photo ? { frame, photo } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------------------------------------------

/**
 * DEV / QA only (`__opusBay.guide.qaTrip('palace-of-fine-arts', 'walk')`): plan a trip from where the player stands with
 * the live providers and start it through lane C's startTrip (source 'qa': BAYBAY leads it like any trip), for shots of
 * the pill, the card, the waypoint and the chevrons. Resolves the option taken (the mode asked for, else the recommended one).
 */
async function qaTrip(attraction: string, mode?: string) {
  const a = ATTRACTION_INDEX.get(attraction);
  if (!a) return null;
  const [{ planTrips }, { tripProviders }, { startTrip }] = await Promise.all([importRetry(() => import('./tripPlan')), importRetry(() => import('./tripProviders')), importRetry(() => import('./flow'))]);
  const d = tripDestination(a);
  let options = planTrips(runtime.player, { placeId: d.placeId, x: d.x, z: d.z, name: d.name, attraction: a.id }, tripProviders());
  // the walking routes land a moment later: plan again once they did
  for (let i = 0; i < 20 && options.some(o => o.legs.some(l => l.estimate)); i++) {
    await new Promise(r => setTimeout(r, 250));
    options = planTrips(runtime.player, { placeId: d.placeId, x: d.x, z: d.z, name: d.name, attraction: a.id }, tripProviders());
  }
  const option = options.find(o => o.mode === mode) ?? options.find(o => o.recommended) ?? options[0];
  if (!option) return null;
  startTrip(option, { placeId: d.placeId, attraction: a.id, name: d.name, x: d.x, z: d.z }, 'qa');
  return option;
}

/**
 * W4-G9 · the ride camera's looks (actors/cameraModes rideLookAt): lane T's 'approach' of the ridden bus / train turns
 * the view toward the stop's attraction for 4 s (the flag foot: the landmark's tall part), and the rider's train coming
 * out of a portal ('portal-out', LineFleet.onPortal) looks back at the mouth for 3.2 s, pulled back and wider (part b:
 * the train comes out whole with the portal behind it). Only for the ride you are on.
 */
function watchRideLooks(): () => void {
  const offEvents = onEvent(e => {
    if (e.type !== 'transit' || e.what !== 'approach' || !e.attraction) return;
    const ride = flow.get().ride;
    if (!ride || ride.line !== e.line || ride.stage === 'waiting') return;
    const a = ATTRACTION_INDEX.resolve(e.attraction);
    if (!a) return;
    const f = a.flag ?? a;
    const d = Math.hypot(f.x - runtime.player.x, f.z - runtime.player.z);
    if (d > 25 && d < 700) rideLookAt(f.x, f.z, 4);
  });
  // the fleet comes with lane T's lazy transit layer: attach once it is there (and again if it is rebuilt)
  let fleet: ReturnType<typeof activeLineFleet> = null;
  let offPortal: (() => void) | null = null;
  const poll = window.setInterval(() => {
    const now = activeLineFleet();
    if (now === fleet) return;
    offPortal?.();
    fleet = now;
    offPortal = now ? now.onPortal(ev => {
      const ride = flow.get().ride;
      if (ev.what === 'portal-out' && ev.portal && ride && ride.line === ev.line) rideLookAt(ev.portal.x, ev.portal.z, 3.2, true);
    }) : null;
  }, 1000);
  return () => { offEvents(); window.clearInterval(poll); offPortal?.(); };
}

let inited = false;
/** Once per page, city mode only (Systems.tsx after the dynamic import). Returns the disposer. */
export function initGuideCity(): () => void {
  if (inited) return () => {};
  inited = true;
  const offScene = registerSceneSystem('g-guide', GuideScene);
  const offRide = watchRideLooks();
  // the HUD's street name (lane G1, G1-9) ticks here, city only, so GameRoot does not carry game/streets
  const offStreet = registerFocusHook('g-street', { tick: tickStreet });
  // W5-N7: the finds go to the quiet chip (the attractions keep their arrival moment)
  setDiscoveryAnnouncer(announceFinds);
  lastArrival = flow.get().arrival;
  const offFlow = flow.subscribe(() => {
    const a = flow.get().arrival;
    if (a === lastArrival) return;
    lastArrival = a;
    if (a) onArrival(a);
  });
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), guide: { stats: guideStats, ui: guideUi, startPanorama, flow, qaTrip } };
  }
  void importRetry(() => import('../world/sf/landmarks/context')).then(m => { siteContext = m; }, () => { /* no reveal without the site data */ });
  return () => { offScene(); offFlow(); offRide(); offStreet(); setDiscoveryAnnouncer(null); window.clearTimeout(foundTimer); inited = false; };
}
