import * as THREE from 'three';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { blockersNear, canStand, cityEpoch, cityTerrain, forEachBlockerNear, heightAt, inWorld, type Blocker } from '../core/terrain';
import { DISTRICT, frameAt, stationOf } from '../data/district';
import { cinemaKind, currentFraming, measureBottomCover, takeFaceRequest, type Framing } from '../game/cinema';
import { RideCamera, rideCamInfo, type RideCamMode, type RidePose } from './cameraModes';
import { deckAt, deckCameraYaw, heroRelaxed, type DeckAt } from './deckSteer';
import { BAYBAY_HEIGHT, CHAR_SCALE, PLAYER_HEIGHT } from './dims';
import { platforms, toLocal } from './platform';
import { heroView, preferredCameraYaw, preferredViewDir } from './viewField';
import { collectObstacles, moveBasis, residents, view } from './view';
import type { Obstacle } from './controller';

/**
 * Third-person follow camera (polish round 1): yaw / pitch / distance with smoothed springs, drag / pinch / wheel /
 * right-stick control. Pitch is coupled to zoom (zoomed in = over the shoulder with sky and skyline, zoomed out =
 * the diorama top view), look-ahead, lazy re-centring behind the direction of travel, per-zone preferred views that
 * show the landmark (never from behind a hero landmark), conversation two-shots, the C1 Framing API
 * (game/cinema.ts holdFraming) with a view offset that lifts the framed pair above the dialogue card, cinematic
 * shot override with eased hand-off both ways, photo-mode free orbit, shake. Writes runtime.camera.yaw/pitch/distance.
 *
 * Priority: photo mode → runtime.camera.shot (cinematics) → currentFraming() → automatic dialogue two-shot → follow.
 * While the newcomer is carried (bike, toy car, pelican, streetcar, bench) the follow pose comes from the per-mode
 * rig in cameraModes.ts instead (framings and two-shots wait until you are on foot). The near plane rides with the
 * camera's height: near = clamp(0.5 + 0.02·(camY − ground), 0.5, 8) (GTA_SZ's cure for land / sea z-fighting from
 * high up); camera.far is set by GameRoot per world mode.
 *
 * City mode (lane E2, wave 3, E2-5 / E2-6): the arrival yaw starts from the view field (actors/viewField.ts: out over
 * the Bay on the hero slab as before, the city's openness field elsewhere); the hero points add the Golden Gate
 * Bridge's towers, Sutro and Salesforce and every landmark's arrival spot has a zone view built from its photo pose
 * (actors/cityViews.ts, loaded lazily: the landmark library stays out of the main graph); occlusion reads the blockers'
 * tops (a roof below the sight line does not hide the player); a fast-travel landing hands over at the descent's yaw.
 *
 * Wave 5 · W5-F6 (plan §2 MF2 "The GGB deck"): on a bridge deck (actors/deckSteer) the follow camera stays behind the
 * player along the deck's axis (the alignment nearest the current view, the one behind the player on a tie), the
 * towers' hero points are relaxed (you walk through the portals) and the occlusion swing waits: it used to turn the
 * camera 83° across the deck at the south end, so holding forward walked into the rail.
 */

export const DIST_MIN = 7, DIST_MAX = 30;
const PITCH_MIN = 0.1, PITCH_MAX = 1.22;
const PHOTO_PITCH_MIN = 0.04, PHOTO_PITCH_MAX = 1.45, PHOTO_DIST_MIN = 3.5, PHOTO_DIST_MAX = 46;
const FOV_BASE = 42, FOV_MAX = 62, MIN_HFOV = (36 * Math.PI) / 180;
/** zoom → pitch keys (distance u, pitch rad): 7 = over the shoulder, 15 = default, 30 = diorama top view */
const PITCH_KEYS: readonly (readonly [number, number])[] = [[7, 0.14], [15, 0.28], [22, 0.5], [30, 0.88]];
/** portrait phones: a touch closer (the character stays readable on a narrow screen) and a touch steeper */
const PORTRAIT_DIST = 0.8, PORTRAIT_PITCH = 0.07;
/** camera focus: the player's chest */
const FOCUS_Y = 0.77 * PLAYER_HEIGHT;
const RUN_DIST = 1.5, RUN_FOV = 3;
/** framing hand-offs (C1): in 0.8 s, out 0.9 s */
const FRAME_IN = 0.8, FRAME_OUT = 0.9;
/** a hero landmark never sits on the camera → player line (A2) */
const HERO_CLEAR = 4;
/** automatic conversation two-shot (A3): distance from the pair's midpoint, height, angle off the player → speaker axis */
const TWO_DIST = 8, TWO_HEIGHT = 2.3, TWO_ANGLE = 0.66;
/** the two-shot's candidate angles (part b: + 1.9× for a pair standing close, where the smaller ones overlap the two) */
const TWO_ANGLES = [TWO_ANGLE, TWO_ANGLE * 0.65, TWO_ANGLE * 1.5, TWO_ANGLE * 1.9] as const;
/** city: after an arrival the yaw is chosen again (as the ground streams in) for this long (s), while nobody moves */
const SETTLE_S = 8;
/** W5-F7: how long an arrival's open-ground turn outranks the snap / settle yaw (s) */
const OPEN_HOLD_S = 3;
/** W5-F6: on a deck, a camera more than this off the axis turns firmly (rate DECK_TURN), else it follows gently */
const DECK_FAR = 0.44, DECK_TURN = 3, DECK_FOLLOW = 2.2;
/** city: the follow camera clears roofs by this much (u), lifting at most this share of its distance */
const ROOF_CLEAR = 1.2, ROOF_LIFT_MAX = 0.6;
// (roofLiftStep's blocker test writes here: module state, no closure per sample)
let roofTopMax = -Infinity;
const roofMax = (b: Blocker) => { if (b.top !== undefined && b.top > roofTopMax) roofTopMax = b.top; };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Pitch for a camera distance (piecewise linear through PITCH_KEYS). */
export function basePitch(dist: number): number {
  const K = PITCH_KEYS;
  if (dist <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) {
    if (dist <= K[i][0]) { const [d0, p0] = K[i - 1], [d1, p1] = K[i]; return p0 + ((dist - d0) / (d1 - d0)) * (p1 - p0); }
  }
  return K[K.length - 1][1];
}
export const PITCH_DEFAULT = basePitch(15);

// ---------------------------------------------------------------------------
// Hero landmarks and preferred zone views (A2)
// ---------------------------------------------------------------------------

/** A point the camera never looks at the player through; `r` = keep-out radius (default HERO_CLEAR). */
export interface HeroPoint { id: string; x: number; z: number; r?: number }
let heroCache: HeroPoint[] | null = null;
let heroKey = '';

// --- city-mode camera data (actors/cityViews.ts): a dynamic import, so the landmark library stays out of GameRoot
type CityViews = typeof import('./cityViews');
let cityViews: CityViews | null = null;
let cityViewsLoad: Promise<CityViews> | null = null;
/** Load the city camera data (camera.ts starts it on its own in city mode; tests await it). */
export function loadCityViews(): Promise<CityViews> {
  cityViewsLoad ??= import('./cityViews').then(m => { cityViews = m; return m; }, e => { cityViewsLoad = null; throw e; });
  return cityViewsLoad;
}
/** The city camera data in city mode once loaded (null in district mode / while loading). */
function cityViewsNow(): CityViews | null {
  if (game.get().worldMode !== 'city') return null;
  if (!cityViews) void loadCityViews().catch(() => { /* retried on the next call */ });
  return cityViews;
}

/**
 * Coit Tower, the Ferry Building clock tower and Transamerica: the camera never looks at the player through them.
 * City mode adds Salesforce Tower, the Golden Gate Bridge's two towers and Sutro Tower (E2-6).
 */
export function heroPoints(): HeroPoint[] {
  const cv = cityViewsNow(), city = game.get().worldMode === 'city';
  const key = city ? (cv ? 'city' : 'city-') : 'district';
  if (heroCache && heroKey === key) return heroCache;
  const out: HeroPoint[] = [];
  for (const l of DISTRICT.landmarks) {
    if (l.kind === 'coit-tower' || l.kind === 'transamerica') out.push({ id: l.kind, x: l.position.x, z: l.position.z });
    if (l.kind === 'ferry-building') {
      // clock tower: local z = 2.9 toward the promenade (world/landmarks.ts)
      const k = 2.9 * (l.scale || 1);
      out.push({ id: 'ferry-clock-tower', x: l.position.x + Math.sin(l.rotationY) * k, z: l.position.z + Math.cos(l.rotationY) * k });
    }
    if (city && l.kind === 'salesforce-tower') out.push({ id: l.kind, x: l.position.x, z: l.position.z, r: 5 });
  }
  if (cv) out.push(...cv.cityHeroPoints());
  heroKey = key;
  return (heroCache = out);
}

function segDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1);
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}

/** True when a camera at `yaw` / `dist` behind (x, z) sees the player without a hero landmark in between. */
export function heroClear(x: number, z: number, yaw: number, dist: number): boolean {
  const cx = x + Math.sin(yaw) * dist, cz = z + Math.cos(yaw) * dist;
  for (const h of heroPoints()) {
    // (W5-F6: on the bridge deck its towers are what you walk through, not what hides you)
    if (heroRelaxed(h.id, x, z)) continue;
    // standing right beside a hero: only the part of the line away from the player counts
    const r = Math.min(h.r ?? HERO_CLEAR, Math.hypot(h.x - x, h.z - z) * 0.8);
    if (segDist(cx, cz, x, z, h.x, h.z) < r) return false;
  }
  return true;
}

export interface ZoneView {
  anchor: string;
  x: number;
  z: number;
  /** orbit yaw (camera sits at (sin yaw, cos yaw) · dist from the player) */
  yaw: number;
  pitch?: number;
  dist?: number;
  lookUp?: number;
  /** enter radius (u; default 10), left 4 u farther out */
  r?: number;
  /** a blocked view may turn up to this far (rad) to a clearer yaw instead of giving the zone up (city landmarks) */
  near?: number;
  /**
   * city landmarks: the line from the subject through the arrival spot (`axis`, a yaw) and the lean toward the photo's
   * side (`yaw` = axis + lean on a desktop view); on a narrower view the lean shrinks (zoneYaw)
   */
  axis?: number;
  lean?: number;
  /** re-solve pitch / dist / lookUp from the ground heights (city landmarks: called on entering the zone) */
  frame?: (ground: (x: number, z: number) => number) => void;
  /** what should be in frame (QA / docs) */
  subject: string;
}

const yawToward = (from: { x: number; z: number }, to: { x: number; z: number }) => Math.atan2(from.x - to.x, from.z - to.z);

/**
 * The follow camera's horizontal half field of view (rad), set each frame by CameraController.update: ≈ 0.55 on a
 * 16:10 desktop, ≈ 0.31 (MIN_HFOV / 2) on a portrait phone. A city landmark zone leans its camera up to 0.35 rad off the
 * subject's line (the subject then sits that far off the frame's middle) — tuned on the desktop; on a portrait phone the
 * lean shrinks with the view, so the subject stays in frame (E2-review).
 */
let viewHalfH = 0.55;
const DESK_HALF_H = 0.55, ZONE_EDGE = 0.12;
const zoneScale = () => clamp((viewHalfH - ZONE_EDGE) / (DESK_HALF_H - ZONE_EDGE), 0.25, 1);
/** A zone's view yaw on this screen (district zones and desktops: `yaw` itself). */
export function zoneYaw(z: ZoneView): number {
  return z.axis !== undefined && z.lean ? z.axis + z.lean * zoneScale() : z.yaw;
}
/**
 * A city landmark zone's search width (0: none). Not narrowed on a portrait view: a blocked zone that finds no clear yaw
 * within it falls back to the plain chooser, which ignores the subject (tried: at 375 × 667 the Powell & Market
 * turntable then left the frame).
 */
function zoneNear(z: ZoneView): number { return z.near ?? 0; }
/** QA / tests: the horizontal half field of view the zone views assume (the camera sets it every frame). */
export function setViewHalfH(rad: number) { if (Number.isFinite(rad) && rad > 0) viewHalfH = rad; }

let zoneCache: ZoneView[] | null = null;
let zoneKey = '';
/** Preferred views per anchor, active within 10–14 u (hysteresis); city mode adds one per landmark arrival (E2-6). */
export function zoneViews(): ZoneView[] {
  const cv = cityViewsNow();
  const key = cv ? 'city' : 'district';
  if (zoneCache && zoneKey === key) return zoneCache;
  zoneKey = key;
  zoneCache = districtZoneViews();
  if (cv) zoneCache = [...zoneCache, ...cv.cityZoneViews(heightAt)];
  return zoneCache;
}

function districtZoneViews(): ZoneView[] {
  const A = DISTRICT.anchors;
  const bridgeA = DISTRICT.backdrop.find(b => b.kind === 'bay-bridge')?.position, ybi = DISTRICT.backdrop.find(b => b.kind === 'yerba-buena')?.position;
  const span = bridgeA && ybi ? { x: bridgeA.x + (ybi.x - bridgeA.x) * 0.55, z: bridgeA.z + (ybi.z - bridgeA.z) * 0.55 } : null;
  const table: Omit<ZoneView, 'x' | 'z'>[] = [
    { anchor: 'coit-view', yaw: -0.95, pitch: 0.26, dist: 18, subject: 'bay + Bay Bridge' },
    { anchor: 'coit-summit', yaw: -0.95, pitch: 0.26, dist: 18, subject: 'bay + Bay Bridge' },
    { anchor: 'ferry-clock', yaw: -0.55, pitch: 0.2, dist: 15, subject: 'clock tower + Bay Bridge' },
    { anchor: 'sea-lion-viewpoint', yaw: 0.98, subject: 'K-dock + Alcatraz' },
    { anchor: 'pier14-end', yaw: span && A['pier14-end'] ? yawToward(A['pier14-end'], span) : -1.0, subject: 'Bay Bridge main span' },
    { anchor: 'pier7-end', yaw: ybi && A['pier7-end'] ? yawToward(A['pier7-end'], ybi) + 0.25 : -0.4, subject: 'Treasure Island + Bay Bridge' },
    { anchor: 'exploratorium-front', yaw: -0.62, subject: 'Exploratorium facade (three-quarters)' },
  ];
  return table.filter(v => !!A[v.anchor]).map(v => ({ ...v, x: A[v.anchor].x, z: A[v.anchor].z }));
}

// ---------------------------------------------------------------------------
// Occlusion
// ---------------------------------------------------------------------------

let bwMax = 0, bwBelow = -Infinity;
const weighBlocker = (b: Blocker) => {
  // a roof below the sight line hides nothing (E2-6; blockers without a known top — the hero's — always count)
  if (b.top !== undefined && b.top < bwBelow) return;
  const w = b.kind === 'polygon' ? 1 : 1 + 0.2 * b.r;
  if (w > bwMax) bwMax = w;
};
/**
 * Weight of the static blocker at (x, z): buildings 1, round colliders (towers, kiosks, palms) 1 + 0.2 r; one whose
 * known top (Blocker.top: city buildings, landmarks) is below `below` does not count. No allocation.
 */
function blockWeight(x: number, z: number, below = -Infinity): number {
  bwMax = 0; bwBelow = below;
  forEachBlockerNear(x, z, 0.25, weighBlocker);
  return bwMax;
}

/**
 * The line from the player's chest up to a follow camera `dist` away at that zoom's pitch, as world y at horizontal
 * distance d from the player: `sightY0 + sightK·d` (set by sightLine). A roof under it does not hide the player.
 */
let sightY0 = 0, sightK = 0;
function sightLine(x: number, z: number, dist: number) {
  const p = basePitch(dist), rise = 0.13 * dist + Math.sin(p) * dist;
  sightY0 = heightAt(x, z) + FOCUS_Y;
  sightK = rise / Math.max(1, Math.cos(p) * dist);
}

/** How much mass sits between the player at (x, z) and a camera at yaw (plus a wall right in front of the player). */
function occlusion(x: number, z: number, yaw: number, dist: number): number {
  const dx = Math.sin(yaw), dz = Math.cos(yaw), reach = Math.min(dist * 0.9, 16);
  sightLine(x, z, dist);
  const y0 = sightY0, k = sightK;
  let hits = 0;
  for (let d = 1.2; d <= reach; d += 1.2) { const w = blockWeight(x + dx * d, z + dz * d, y0 + k * d - 0.3); if (w) hits += w * (1 + (reach - d) * 0.15); }
  // (in front of the player: anything taller than a low wall blocks the view past them)
  for (let d = 1.5; d <= 7.5; d += 1.5) { const w = blockWeight(x - dx * d, z - dz * d, y0 - FOCUS_Y + 1.5); if (w) hits += w * (0.5 + (7.5 - d) * 0.08); }
  return hits + (heroClear(x, z, yaw, dist) ? 0 : 6);
}

/** Mass between the player at (x, z) and a camera at yaw (camera side only, for the auto-turn). */
function occlusionBehind(x: number, z: number, yaw: number, dist: number): number {
  const dx = Math.sin(yaw), dz = Math.cos(yaw), reach = Math.min(dist * 0.9, 16);
  sightLine(x, z, dist);
  const y0 = sightY0, k = sightK;
  let hits = 0;
  for (let d = 1.2; d <= reach; d += 1.2) { const w = blockWeight(x + dx * d, z + dz * d, y0 + k * d - 0.3); if (w) hits += w * (1 + (reach - d) * 0.15); }
  return hits + (heroClear(x, z, yaw, dist) ? 0 : 6);
}

/**
 * Residents in the way of a camera at (cx, cz) looking at the pair's midpoint (mx, mz): one standing in the lens
 * (3 each) or on the sight line short of the pair (1.5 each). The talking resident stands at the pair, so never counts.
 */
function residentsInView(cx: number, cz: number, mx: number, mz: number): number {
  const dx = mx - cx, dz = mz - cz, L = Math.hypot(dx, dz) || 1;
  let hits = 0;
  const weigh = (x: number, z: number) => {
    const vx = x - cx, vz = z - cz;
    if (Math.hypot(vx, vz) < 1.8) { hits += 3; return; }
    const along = (vx * dx + vz * dz) / L;
    if (along > 0 && along < L - 1.6 && Math.abs(vx * dz - vz * dx) / L < 0.9) hits += 1.5;
  };
  for (const r of residents) weigh(r.x, r.z);
  // (part b, verify-desktop D10) the city's walkers too (lane T's crowd, actors/view registerObstacleSource): a
  // sightseer who stood in the lens filled a quarter of the ranger's two-shot
  const obs = crowdScratch;
  obs.length = 0;
  collectObstacles(obs, (cx + mx) / 2, (cz + mz) / 2, L / 2 + 2);
  for (const o of obs) if (o.kind === 'crowd' || o.kind === 'person') weigh(o.x, o.z);
  return hits;
}
const crowdScratch: Obstacle[] = [];

/** half widths (u) of the player (with the backpack) and a speaker, as the two-shot sees them */
const PLAYER_HALF = 0.8, SPEAKER_HALF = 0.55;
/**
 * (part b, verify-desktop D10) A two-shot where the player's back hides the speaker: from the camera at (cx, cz) the two
 * bodies' angular widths overlap. Luz and Dana stood 2.4–2.9 u from the player; at 0.65 × the two-shot angle (the
 * candidate that won when the 38° one had a little occlusion) they are ≈ 7.6° apart and need ≈ 10°. 0 when clear.
 */
export function pairOverlap(cx: number, cz: number, px: number, pz: number, sx: number, sz: number): number {
  const dp = Math.max(0.5, Math.hypot(px - cx, pz - cz)), ds = Math.max(0.5, Math.hypot(sx - cx, sz - cz));
  const sep = Math.abs(Math.atan2(Math.sin(Math.atan2(px - cx, pz - cz) - Math.atan2(sx - cx, sz - cz)), Math.cos(Math.atan2(px - cx, pz - cz) - Math.atan2(sx - cx, sz - cz))));
  const need = Math.atan(PLAYER_HALF / dp) + Math.atan(SPEAKER_HALF / ds);
  return sep >= need ? 0 : 2 + (need - sep) * 20;
}

/** Line of sight between two points (horizontal samples through blockers). */
function segmentBlocked(ax: number, az: number, bx: number, bz: number, skipEnd = 0.8): number {
  const L = Math.hypot(bx - ax, bz - az);
  let hits = 0;
  for (let d = 0.6; d < L - skipEnd; d += 0.9) { const k = d / L; hits += blockWeight(ax + (bx - ax) * k, az + (bz - az) * k); }
  return hits;
}

/**
 * Best orbit yaw at (x, z): the zone's preferred view, else toward the view (the hero slab: out over the Bay; the city:
 * the openness field, actors/viewField.ts), never from behind a building or hero.
 */
export function chooseYaw(x: number, z: number, fallback: number, dist: number): number {
  // W5-F6: on a bridge deck, along the axis (behind the player: `fallback` is the yaw behind them)
  const deck = deckAt(x, z);
  if (deck) return deckYaw(deck, fallback, fallback);
  const zone = zoneAt(x, z, null);
  if (zone) {
    zone.frame?.(heightAt);
    const zy = zoneYaw(zone);
    if (occlusionBehind(x, z, zy, dist) < 2) return zy;
    // a landmark's zone (city): the clearest yaw near its view keeps the subject in frame (CS-10: it used to lose to
    // the occlusion rule and the camera turned away from City Hall / the rotunda)
    if (zone.near) {
      const near = zoneNear(zone);
      let best = zy, bestScore = Infinity;
      for (let k = -4; k <= 4; k++) {
        const yaw = zy + (k / 4) * near;
        const score = occlusionBehind(x, z, yaw, dist) * 3 + Math.abs(k) * 0.75;
        if (score < bestScore) { bestScore = score; best = yaw; }
      }
      if (bestScore < 9) return best;
      // (part b, E2 w3 review open "blocked zone arrivals swing", verify-visual F6) nothing near the view is clear: stay
      // with the subject rather than the plain chooser, which ignores it (the turntable came in 2.75 rad off its axis,
      // then the entry assist swung back over 4–8 s). Twice the width, each step past the width priced like losing the
      // subject; the camera's own dither / roof lift thins what is left in between.
      for (let k = -8; k <= 8; k++) {
        if (Math.abs(k) <= 4) continue;
        const yaw = zy + (k / 4) * near;
        const score = occlusionBehind(x, z, yaw, dist) * 3 + Math.abs(k) * 0.75 + (Math.abs(k) - 4) * 3;
        if (score < bestScore) { bestScore = score; best = yaw; }
      }
      return best;
    }
  }
  let best = fallback, bestScore = Infinity;
  for (const c of yawCandidates(x, z, fallback, dist)) if (c.score < bestScore) { bestScore = c.score; best = c.yaw; }
  return best;
}

/**
 * The yaws chooseYaw weighs when no zone view applies, with their occlusion and score (lowest wins): toward the view
 * first, the fallback second, then ±0.5 rad steps round the view. Exported for tests / QA.
 */
export function yawCandidates(x: number, z: number, fallback: number, dist: number): { yaw: number; occ: number; score: number }[] {
  const bay = preferredCameraYaw(x, z); // camera on the far side, looking along the view past the player
  const candidates = [bay, fallback];
  for (let k = 1; k <= 6; k++) candidates.push(bay + k * 0.5, bay - k * 0.5);
  return candidates.map((yaw, i) => { const occ = occlusion(x, z, yaw, dist); return { yaw, occ, score: occ * 3 + i * 0.12 }; });
}

/**
 * W5-F6: the deck-aligned camera yaw for a player on a deck — of the two alignments (behind a walk one way or the other)
 * the one nearest `yaw`, the one behind the player (`behind` = heading + π) winning unless the other is ≥ 0.7 rad nearer.
 */
export function deckYaw(at: DeckAt, yaw: number, behind: number): number {
  const a = deckCameraYaw(at.deck, 1), b = deckCameraYaw(at.deck, -1);
  const score = (c: number) => Math.abs(wrap(c - yaw)) + (Math.abs(wrap(c - behind)) < Math.PI / 2 ? 0 : 0.7);
  return score(a) <= score(b) ? a : b;
}

function zoneAt(x: number, z: number, current: ZoneView | null): ZoneView | null {
  if (current && Math.hypot(current.x - x, current.z - z) < (current.r ?? 10) + 4) return current;
  let best: ZoneView | null = null, bestD = Infinity;
  for (const v of zoneViews()) { const d = Math.hypot(v.x - x, v.z - z); if (d < (v.r ?? 10) && d < bestD) { bestD = d; best = v; } }
  return best;
}

/** Unity-style critically damped SmoothDamp on a vector. */
function smoothDamp(cur: THREE.Vector3, target: THREE.Vector3, vel: THREE.Vector3, smoothTime: number, dt: number) {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const cx = cur.x - target.x, cy = cur.y - target.y, cz = cur.z - target.z;
  const tx = (vel.x + omega * cx) * dt, ty = (vel.y + omega * cy) * dt, tz = (vel.z + omega * cz) * dt;
  vel.set((vel.x - omega * tx) * exp, (vel.y - omega * ty) * exp, (vel.z - omega * tz) * exp);
  cur.set(target.x + (cx + tx) * exp, target.y + (cy + ty) * exp, target.z + (cz + tz) * exp);
}

const near3 = (a?: readonly number[] | null, b?: readonly number[] | null) => (!a && !b) || (!!a && !!b && a.every((v, i) => Math.abs(v - b[i]) < 0.5));
/** Same shot apart from the bottom cover (so a re-hold does not restart the blend). */
function sameFraming(a: Framing | null, b: Framing | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'two-shot' && b.kind === 'two-shot') return near3(a.subject, b.subject);
  if (a.kind === 'over-shoulder' && b.kind === 'over-shoulder') return Math.hypot(a.toward.x - b.toward.x, a.toward.z - b.toward.z) < 0.5 && a.dist === b.dist && a.pitch === b.pitch;
  if (a.kind === 'view' && b.kind === 'view') return a.yaw === b.yaw && a.pitch === b.pitch && a.dist === b.dist && a.lookUp === b.lookUp && a.fov === b.fov;
  return false;
}

/** A full camera pose (what the framing blends interpolate). */
interface Pose { pos: THREE.Vector3; target: THREE.Vector3; fov: number; cover: number }
const newPose = (): Pose => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: FOV_BASE, cover: 0 });
const copyPose = (out: Pose, p: Pose) => { out.pos.copy(p.pos); out.target.copy(p.target); out.fov = p.fov; out.cover = p.cover; return out; };

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

export class CameraController {
  yaw = DISTRICT.spawn.heading + Math.PI;
  /** photo mode: absolute pitch; otherwise unused (pitch = basePitch(distance) + pitchOffset) */
  pitch = PITCH_DEFAULT;
  /** manual pitch on top of the zoom-coupled base pitch (drag / right stick); R resets it */
  pitchOffset = 0;
  distance = 15;
  private yawS = this.yaw;
  private pitchS = this.pitch;
  private distS = this.distance;
  private focus = new THREE.Vector3();
  private focusVel = new THREE.Vector3();
  private groundY = 0;
  private ahead = new THREE.Vector3();
  private lift = 0;
  private initialized = false;
  private resetSeen = input.resetCount;
  private lastDistanceWrite = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private runW = 0;
  private stairsW = 0;
  private stairsSideAt = 0;
  private portrait = false;
  // cinematic
  private shotRef: unknown = null;
  private shotFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private shotTo = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private shotT = 0;
  private shotDur = 1;
  private shotKind: string | null = null;
  private returnT = 1;
  private returnDur = 0.9;
  private returnFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  // framing (C1 / A3): the desired pose, the pose we blend from, and which framing is active
  private follow = newPose();
  private framed = newPose();
  private framedSmooth = newPose();
  private framedReady = false;
  private desired = newPose();
  private blendFrom = newPose();
  private blendT = 1;
  private blendDur = FRAME_IN;
  private modeKey = 'follow';
  private frameRef: Framing | null = null;
  private frameSeq = 0;
  private frameSolved: { key: string; mx: number; mz: number; camX: number; camZ: number; camY: number; fov: number; sideSign: number; back: number } | null = null;
  private twoSide = 1;
  private coverAt = 0;
  private coverNow = 0.3;
  private appliedCover = -1;
  private appliedSize = '';
  // outputs of the last frame (for hand-offs)
  readonly pos = new THREE.Vector3();
  readonly target = new THREE.Vector3();
  /** the last output field of view (deg) and the bottom cover (0..1) applied as a view offset */
  outFov = FOV_BASE;
  outCover = 0;
  private tmpTarget = new THREE.Vector3();
  private wasPhoto = false;
  private savedPhoto = { yaw: 0, pitchOffset: 0, distance: 15 };
  // zone views (A2)
  private zone: ZoneView | null = null;
  private zoneLeftAt = -100;
  private zoneW = 0;
  private zoneZoomed = false;
  private zoneIdleSince = 0;
  // A7
  private lockYaw = 0;
  private lockUntil = 0;
  private lockRelease = 1;
  // per-mode ride rigs (plan §6.8)
  private rideCam = new RideCamera();
  private ridePose: RidePose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: FOV_BASE };
  private presetSeen = input.camPresetCount;
  private footPreset = 0;

  update(camera: THREE.PerspectiveCamera, dt: number, now: number, viewportH: number, viewportW = 0) {
    const s = game.get();
    const reduced = s.settings.reducedMotion;
    const photo = s.photoMode;
    const cam = runtime.camera;
    const p = runtime.player;

    // portrait screens: widen the vertical FOV so the horizontal view is not a keyhole (phones ≈ 19° → 31°)
    const aspect = camera.aspect || 1;
    this.portrait = aspect < 1;
    const baseFov = aspect >= 1 ? FOV_BASE : clamp((2 * Math.atan(Math.tan(MIN_HFOV / 2) / aspect) * 180) / Math.PI, FOV_BASE, FOV_MAX);
    viewHalfH = Math.atan(Math.tan((baseFov * Math.PI) / 360) * aspect);

    if (!this.initialized) {
      this.initialized = true;
      this.distance = this.distS = clamp(cam.distance || s.settings.cameraDistance || 15, DIST_MIN, DIST_MAX);
      this.focus.set(view.x, view.ground + FOCUS_Y, view.z);
      this.groundY = view.ground;
      this.pitchS = this.effectivePitch(false);
    }

    // photo mode keeps its own orbit and restores the follow camera afterwards
    if (photo !== this.wasPhoto) {
      if (photo) {
        this.savedPhoto = { yaw: this.yaw, pitchOffset: this.pitchOffset, distance: this.distance };
        this.pitch = this.pitchS;
        this.distance = Math.min(this.distance, 12);
      } else { this.pitchOffset = this.savedPhoto.pitchOffset; this.distance = this.savedPhoto.distance; }
      this.wasPhoto = photo;
    }

    // --- manual input (carried: the ride rig orbits instead)
    const h = Math.max(320, viewportH);
    const rideMode = photo || cam.shot ? null : rideCamMode();
    if (rideMode) {
      if (input.dragX || input.dragY) { this.rideCam.orbit(-(input.dragX * Math.PI * 1.15) / h, (input.dragY * Math.PI * 0.7) / h, now); input.dragX = 0; input.dragY = 0; }
      if (input.lookX || input.lookY) this.rideCam.orbit(-input.lookX * 2.6 * dt, input.lookY * 1.3 * dt, now);
      input.lookX = 0; input.lookY = 0;
    }
    // C: near / far preset (on foot: 9 / 15 / 24 u)
    if (input.camPresetCount !== this.presetSeen) {
      this.presetSeen = input.camPresetCount;
      if (rideMode) this.rideCam.cyclePreset();
      else if (!photo) { this.footPreset = (this.footPreset + 1) % 3; this.distance = [15, 9, 24][this.footPreset]; this.persistDistance(false); this.zoneZoomed = true; }
    }
    if (input.dragX || input.dragY) {
      this.yaw -= (input.dragX * Math.PI * 1.15) / h;
      const dp = (input.dragY * Math.PI * 0.7) / h;
      if (photo) this.pitch += dp; else this.pitchOffset += dp;
      input.dragX = 0; input.dragY = 0;
    }
    if (input.lookX || input.lookY) {
      this.yaw -= input.lookX * 2.6 * dt;
      if (photo) this.pitch += input.lookY * 1.3 * dt; else this.pitchOffset += input.lookY * 1.3 * dt;
    }
    // external distance writes (settings slider) win over our smoothed copy
    if (Math.abs(cam.distance - this.lastDistanceWrite) > 1e-3 && !photo) this.distance = clamp(cam.distance, DIST_MIN, DIST_MAX);
    if (input.wheel) { this.distance *= Math.exp(input.wheel * 0.0011); input.wheel = 0; this.persistDistance(photo); this.zoneZoomed = true; }
    if (input.pinch !== 1) { this.distance *= input.pinch; input.pinch = 1; this.persistDistance(photo); this.zoneZoomed = true; }
    if (photo) {
      // keyboard orbit in photo mode (movement is frozen there)
      const k = input.keys;
      const ox = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const oy = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      this.yaw -= ox * 1.4 * dt;
      this.pitch -= oy * 0.8 * dt;
    }
    if (input.resetCount !== this.resetSeen) {
      this.resetSeen = input.resetCount;
      this.yaw = p.heading + Math.PI;
      this.deckDir = 0; // (W5-F6: on a deck, R lines the camera up behind the heading too)
      this.pitchOffset = 0;
      if (photo) this.pitch = PITCH_DEFAULT;
      else this.distance = clamp(s.settings.cameraDistance || 15, DIST_MIN, DIST_MAX);
      this.zoneZoomed = false;
    }
    this.distance = clamp(this.distance, photo ? PHOTO_DIST_MIN : DIST_MIN, photo ? PHOTO_DIST_MAX : DIST_MAX);
    if (photo) this.pitch = clamp(this.pitch, PHOTO_PITCH_MIN, PHOTO_PITCH_MAX);
    else {
      // keep the offset inside the total pitch range for this zoom
      const bp = basePitch(this.distance);
      this.pitchOffset = clamp(this.pitchOffset, PITCH_MIN - bp - 0.1, PITCH_MAX - bp);
    }

    // --- zone views (A2)
    const idleMs = performance.now() - input.lastCameraInputAt;
    const talking = !!s.dialogue.nodeId;
    this.updateZone(now, dt, idleMs, photo || !!cam.shot);

    // --- assists, lazy re-centre behind the direction of travel
    const idleCam = idleMs > 1800;
    if (!cam.shot) {
      const face = takeFaceRequest();
      if (face && face.pitch !== undefined && Number.isFinite(face.pitch)) {
        // (lane R's request 3) the pitch it asks for: the photo orbit's own, or the follow camera's offset on its zoom
        if (photo) this.pitch = clamp(face.pitch, PHOTO_PITCH_MIN, PHOTO_PITCH_MAX);
        else { const bp = basePitch(this.distance); this.pitchOffset = clamp(face.pitch - bp, PITCH_MIN - bp - 0.1, PITCH_MAX - bp); }
      }
      if (face) {
        const dx = face.x - view.x, dz = face.z - view.z;
        const want = Math.atan2(-dx, -dz); // camera behind the player, looking at the subject
        // a timed turn (the waypoint's 转过去: 0.6 s) eases at 3 / seconds (≈ 95 % of the way in that time)
        const rate = face.seconds ? 3 / Math.max(0.1, face.seconds) : 1.0;
        if (Math.hypot(dx, dz) > 1) {
          const yaw = photo ? want : this.clearYaw(view.x, view.z, want, false);
          this.startAssist(yaw, now, reduced ? 6 : rate, photo || !!face.uncapped);
          // an arrival's open-ground turn (W5-F7) outranks the arrival yaw the snap / the settle look would choose; the
          // movement basis goes there at once (updateMoveBasis: the first push walks the open way while the camera swings)
          if (face.open) { this.openYaw = yaw; this.openUntil = now + OPEN_HOLD_S; this.settleUntil = 0; this.openBasis = want; this.openAt = performance.now(); }
        }
      }
      if (!photo) this.assists(now, talking, idleMs);
      this.applyAssist(now, dt, idleMs);
    } else this.assist = null;
    // W5-F6: on a bridge deck the camera stays behind the player along the axis (hands off while the player turns it).
    // Which way: behind the heading when the player comes onto the deck (walking on, or once the deck's chunk is in
    // after a landing / teleport); then that alignment holds (walking back toward the camera never flips it) until the
    // player turns the camera themselves: it then keeps the alignment nearest their view.
    const deck = !photo && !cam.shot && !rideMode && !talking ? deckAt(view.x, view.z, view.ground, this.deckOut) : null;
    if (deck) {
      const ax = Math.sin(deck.deck.heading), az = Math.cos(deck.deck.heading);
      // (a jump of more than 1.2 u in a frame is a teleport or a landing: behind the heading again)
      const jumped = Math.hypot(view.x - this.deckX, view.z - this.deckZ) > 1.2;
      if (!this.onDeck || this.deckDir === 0 || jumped) this.deckDir = Math.sin(p.heading) * ax + Math.cos(p.heading) * az >= 0 ? 1 : -1;
      if (idleMs <= 1800) this.deckManual = true;
      else {
        if (this.deckManual) {
          this.deckManual = false;
          this.deckDir = Math.abs(wrap(deckCameraYaw(deck.deck, 1) - this.yaw)) <= Math.abs(wrap(deckCameraYaw(deck.deck, -1) - this.yaw)) ? 1 : -1;
        }
        const d = wrap(deckCameraYaw(deck.deck, this.deckDir) - this.yaw);
        this.assist = null;
        this.yaw += d * Math.min(1, dt * (Math.abs(d) > DECK_FAR ? (reduced ? 6 : DECK_TURN) : DECK_FOLLOW));
      }
    } else { this.deckDir = 0; this.deckManual = false; }
    this.onDeck = !!deck;
    this.deckX = view.x; this.deckZ = view.z;
    if (!deck && !photo && idleCam && p.moving && !talking && p.speed > 1.2 && this.zoneW < 0.5) {
      const behind = p.heading + Math.PI;
      const d = wrap(behind - this.yaw);
      // only while travelling mostly away from the camera: strafing must not spiral, walking toward the
      // camera must not swing it round; auto-walks (click / tap) re-centre a little more eagerly
      const auto = !!p.pathTarget;
      const cone = auto ? 1.5 : 0.95;
      if (Math.abs(d) < cone) {
        const fade = 1 - Math.abs(d) / cone;
        const rate = (reduced ? 0.3 : auto ? 0.8 : 0.5) * Math.min(1, p.speed / 4.2) * fade;
        this.yaw += d * Math.min(1, dt * rate);
      }
    }

    // --- smoothing of the orbit parameters
    const rot = 1 - Math.exp(-(reduced ? 22 : 12) * dt);
    this.yawS += wrap(this.yaw - this.yawS) * rot;
    this.pitchS += (this.effectivePitch(photo) - this.pitchS) * rot;
    this.distS += (this.zoneDistance(photo) - this.distS) * (1 - Math.exp(-8 * dt));
    this.runW += ((p.running && !reduced && !photo && !talking ? 1 : 0) - this.runW) * (1 - Math.exp(-1.5 * dt));
    // A13: on a flight of stairs look a little flatter so the steps read (and, on click-to-walk, from the side)
    const onStairs = p.surface === 'stairs' && !photo && !s.riding;
    this.stairsW += ((onStairs ? 1 : 0) - this.stairsW) * (1 - Math.exp(-2 * dt));
    if (onStairs && p.pathTarget && p.moving && idleMs > 2500 && this.assist === null && now > this.stairsSideAt) {
      this.stairsSideAt = now + 1.5;
      const s1 = p.heading + Math.PI / 2, s2 = p.heading - Math.PI / 2;
      const want = Math.abs(wrap(s1 - this.yaw)) < Math.abs(wrap(s2 - this.yaw)) ? s1 : s2;
      // three-quarter side view (not fully side-on, the player still reads walking into the frame)
      const target = this.yaw + wrap(want - this.yaw) * 0.5;
      if (Math.abs(wrap(target - this.yaw)) > 0.25) this.startAssist(this.clearYaw(view.x, view.z, target, false), now, reduced ? 6 : 0.8);
    }

    // --- focus point: player (ground-stable), look-ahead
    const vx = view.x, vz = view.z;
    this.groundY += (view.ground - this.groundY) * (1 - Math.exp(-6 * dt));
    const jump = Math.max(0, view.y - view.ground);
    const aheadK = photo ? 0 : reduced ? 0.15 : 0.42;
    const ax = clamp(view.vx * aheadK, -3.5, 3.5), az = clamp(view.vz * aheadK, -3.5, 3.5);
    this.ahead.x += (ax - this.ahead.x) * (1 - Math.exp(-2.4 * dt));
    this.ahead.z += (az - this.ahead.z) * (1 - Math.exp(-2.4 * dt));
    const want = this.tmpTarget.set(vx + this.ahead.x, this.groundY + FOCUS_Y + jump * 0.3, vz + this.ahead.z);
    if (photo) want.set(vx, view.y + 0.9 * CHAR_SCALE, vz);
    const snap = this.focus.distanceToSquared(want) > 256 || !this.placed; // teleports: cut, don't swoop across the map
    if (snap) {
      this.focus.copy(want); this.focusVel.set(0, 0, 0);
      this.ahead.set(0, 0, 0);
      this.groundY = view.ground;
      want.y = this.groundY + FOCUS_Y;
      this.focus.y = want.y;
      if (!cam.shot && !photo) {
        this.zone = zoneAt(vx, vz, null);
        this.yaw = this.yawS = this.openUntil > now ? this.openYaw : chooseYaw(vx, vz, p.heading + Math.PI, this.distance);
        this.zoneW = this.zone ? 1 : 0;
        this.zoneZoomed = false;
        this.pitchS = this.effectivePitch(false);
        this.distS = this.zoneDistance(false);
      }
      // city: that yaw was chosen before the ground there streamed in (?at=, resume, a teleport) — look again as it does
      this.roofCut = true;
      if (cityTerrain() && this.openUntil <= now) { this.settleUntil = now + SETTLE_S; this.settleEpoch = cityEpoch(); this.settleAt = now; this.settleX = vx; this.settleZ = vz; }
      this.placed = true;
      this.blendT = 1;
      this.returnT = 1;
    }
    else smoothDamp(this.focus, want, this.focusVel, reduced ? 0.08 : 0.2, dt);
    if (this.settleUntil > now) this.settleCheck(now, idleMs, !!cam.shot || photo || talking, reduced);

    // --- follow pose
    const riding = !!rideMode;
    const dist = (this.distS + RUN_DIST * this.runW) * (this.portrait && !photo ? PORTRAIT_DIST : 1);
    const pitch = Math.max(PITCH_MIN, this.pitchS + (this.portrait && !photo ? PORTRAIT_PITCH : 0) - 0.12 * this.stairsW);
    const yaw = this.yawS;
    const dFollow = dist;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const offX = Math.sin(yaw) * cp * dFollow, offY = sp * dFollow, offZ = Math.cos(yaw) * cp * dFollow;
    const zoneLook = this.zone && this.zone.lookUp ? this.zone.lookUp * this.zoneW : 0;
    const lookUp = photo ? 0 : (this.portrait ? 0.1 : 0.13) * dFollow + zoneLook;
    const fp = this.follow;
    if (rideMode) {
      // carried: the per-mode rig (cameraModes.ts), handed back to the foot rig at its yaw
      this.rideCam.update(rideSubject(rideMode, now), dt, now, this.ridePose, baseFov - FOV_BASE);
      fp.target.copy(this.ridePose.target);
      fp.pos.copy(this.ridePose.pos);
      if (rideMode !== 'glide' && rideMode !== 'transit') this.avoidTerrain(fp.target, fp.pos, dt);
      fp.fov = this.ridePose.fov;
      fp.cover = 0;
      this.yaw = this.yawS = wrap(this.rideCam.worldYaw);
      this.focus.copy(fp.target); this.focusVel.set(0, 0, 0);
      this.groundY = view.ground;
    } else {
      this.rideCam.reset();
      fp.target.set(this.focus.x, this.focus.y + lookUp, this.focus.z);
      fp.pos.set(fp.target.x + offX, fp.target.y + offY, fp.target.z + offZ);
      this.roofLiftStep(fp.target, fp.pos, dt);
      this.avoidTerrain(fp.target, fp.pos, dt);
      fp.fov = baseFov + RUN_FOV * this.runW;
      fp.cover = 0;
    }

    // --- framing (C1) / automatic two-shot (A3) / follow: pick the desired pose, blend on changes
    const framing = !photo && !cam.shot && !riding ? currentFraming() : null;
    if (framing !== this.frameRef) {
      // a re-hold of the same framing (e.g. the flow refining bottomCover once the card has rendered) keeps the shot
      if (!sameFraming(framing, this.frameRef)) { this.frameSeq++; this.frameSolved = null; this.framedReady = false; }
      this.frameRef = framing;
    }
    let key = 'follow';
    if (rideMode) key = `ride:${rideMode}`;
    else if (framing) key = `frame:${this.frameSeq}`;
    else if (!photo && !riding && talking && view.speaker && Math.hypot(view.speakerX - vx, view.speakerZ - vz) < 7) key = `two:${view.speaker}`;
    else if (!photo && talking) key = 'talk-follow';
    if (talking && (key.startsWith('two') || key === 'talk-follow' || (framing && framing.kind === 'two-shot'))) {
      if (now > this.coverAt) { this.coverAt = now + 0.5; this.coverNow = measureBottomCover(); }
    } else if (!talking) this.coverNow = this.portrait ? 0.42 : 0.3; // a card is about to open (welcome hold)
    const d = this.desired;
    if (key === 'follow' || key.startsWith('ride:')) copyPose(d, fp);
    else if (key === 'talk-follow') { copyPose(d, fp); d.cover = this.coverNow; }
    else {
      if (framing) this.framingPose(framing, baseFov, this.framed);
      else this.twoShotPose(view.speakerX, view.speakerZ, view.speakerY, baseFov, this.framed, key !== this.modeKey);
      if (!this.framedReady) { copyPose(this.framedSmooth, this.framed); this.framedReady = true; }
      else {
        const k = reduced ? 1 : 1 - Math.exp(-4 * dt);
        const fs = this.framedSmooth;
        fs.pos.lerp(this.framed.pos, k); fs.target.lerp(this.framed.target, k);
        fs.fov = lerp(fs.fov, this.framed.fov, k); fs.cover = lerp(fs.cover, this.framed.cover, k);
      }
      copyPose(d, this.framedSmooth);
    }
    if (key !== this.modeKey) {
      const entering = key !== 'follow' && key !== 'talk-follow' && !key.startsWith('ride:');
      copyPose(this.blendFrom, this.lastOut);
      if (!this.initializedPose) copyPose(this.blendFrom, d);
      this.blendT = 0;
      this.blendDur = reduced ? 1e-3 : entering ? FRAME_IN : this.modeKey === 'talk-follow' ? 0.5 : key.startsWith('ride:') || this.modeKey.startsWith('ride:') ? 0.7 : FRAME_OUT;
      if (!entering) this.framedReady = false;
      this.modeKey = key;
    }
    const resolved = this.resolved;
    if (this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / this.blendDur);
      const k = easeInOut(this.blendT);
      resolved.pos.lerpVectors(this.blendFrom.pos, d.pos, k);
      resolved.target.lerpVectors(this.blendFrom.target, d.target, k);
      resolved.fov = lerp(this.blendFrom.fov, d.fov, k);
      resolved.cover = lerp(this.blendFrom.cover, d.cover, k);
    } else copyPose(resolved, d);

    // --- cinematic override / hand-back
    const shot = cam.shot;
    if (shot && shot !== this.shotRef) {
      this.shotRef = shot;
      // (G1's fast travel sets its shots directly: its descent ends behind the player facing the destination)
      this.shotKind = cinemaKind() ?? (s.move.mode === 'travel' && s.worldMode === 'city' ? 'travel' : null);
      this.shotFrom.pos.copy(this.initializedPose ? this.pos : resolved.pos);
      this.shotFrom.target.copy(this.initializedPose ? this.target : resolved.target);
      this.shotTo.pos.set(shot.position[0], shot.position[1], shot.position[2]);
      this.shotTo.target.set(shot.target[0], shot.target[1], shot.target[2]);
      this.shotT = 0;
      this.shotDur = Math.max(0.001, reduced ? Math.min(shot.duration, 0.35) : shot.duration);
      this.inShot = true;
    }
    if (!shot && this.inShot) {
      this.inShot = false;
      this.shotRef = null;
      this.returnT = 0;
      this.returnDur = reduced ? 0.3 : 0.95;
      this.returnFrom.pos.copy(this.pos);
      this.returnFrom.target.copy(this.target);
      if (this.shotKind === 'arrival' || this.shotKind === 'travel') {
        // adopt the closing shot's heading so the hand-off is a gentle push-in, not a swing
        const dx = this.pos.x - this.target.x, dz = this.pos.z - this.target.z;
        if (Math.hypot(dx, dz) > 1) this.yaw = this.yawS = Math.atan2(dx, dz);
      }
      this.focus.set(view.x, view.ground + FOCUS_Y, view.z);
      this.focusVel.set(0, 0, 0);
    }

    const outPos = this.pos, outTarget = this.target;
    let fov = resolved.fov, cover = resolved.cover;
    if (this.inShot) {
      this.shotT += dt;
      const k = easeInOut(clamp(this.shotT / this.shotDur, 0, 1));
      outPos.lerpVectors(this.shotFrom.pos, this.shotTo.pos, k);
      outTarget.lerpVectors(this.shotFrom.target, this.shotTo.target, k);
      fov = baseFov; cover = 0;
    } else if (this.returnT < 1) {
      this.returnT = Math.min(1, this.returnT + dt / this.returnDur);
      const k = easeInOut(this.returnT);
      outPos.lerpVectors(this.returnFrom.pos, resolved.pos, k);
      outTarget.lerpVectors(this.returnFrom.target, resolved.target, k);
      fov = lerp(baseFov, resolved.fov, k); cover = resolved.cover * k;
    } else {
      outPos.copy(resolved.pos);
      outTarget.copy(resolved.target);
    }
    this.initializedPose = true;
    this.lastOut.pos.copy(outPos); this.lastOut.target.copy(outTarget); this.lastOut.fov = fov; this.lastOut.cover = cover;

    // --- lens: fov + view offset (lifts the framed pair above the dialogue card, C1); near plane rides with height
    this.outFov = fov; this.outCover = cover;
    let dirty = false;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; dirty = true; }
    const near = nearPlane(outPos.y, inWorld(outPos.x, outPos.z) ? heightAt(outPos.x, outPos.z) : 0);
    if (Math.abs(camera.near - near) > 0.02) { camera.near = near; dirty = true; }
    const W = Math.max(1, Math.round(viewportW || viewportH * aspect)), H = Math.max(1, Math.round(viewportH));
    const size = `${W}x${H}`;
    const viewOffY = Math.round(H * cover * 0.5);
    if (viewOffY !== this.appliedCover || size !== this.appliedSize) {
      this.appliedCover = viewOffY; this.appliedSize = size;
      if (viewOffY > 0) camera.setViewOffset(W, H, 0, viewOffY, W, H); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      dirty = false;
    }
    if (dirty) camera.updateProjectionMatrix();

    // --- shake (bell, bumps) — never with reduced motion
    let shake = cam.shake;
    if (reduced) shake = 0;
    cam.shake = Math.max(0, cam.shake - dt * 1.6);
    camera.position.copy(outPos);
    if (shake > 0.001) {
      const a = shake * 0.22;
      camera.position.x += Math.sin(now * 47.3) * a;
      camera.position.y += Math.sin(now * 39.1 + 1.3) * a * 0.7;
      camera.position.z += Math.sin(now * 43.7 + 2.1) * a;
    }
    camera.lookAt(outTarget);

    cam.yaw = this.yawS;
    cam.pitch = this.pitchS;
    if (!photo) { cam.distance = this.distance; this.lastDistanceWrite = this.distance; }
    this.updateMoveBasis(now, dt);
  }

  private inShot = false;
  private initializedPose = false;
  private placed = false;
  private resolved = newPose();
  private lastOut = newPose();

  /** Pitch for the current zoom: zoom-coupled base + manual offset (zone view blended in), or photo pitch. */
  private effectivePitch(photo: boolean): number {
    if (photo) return this.pitch;
    let base = basePitch(this.distance);
    const z = this.zone;
    if (z && z.pitch !== undefined && this.zoneW > 0) base = lerp(base, z.pitch, this.zoneW);
    return clamp(base + this.pitchOffset, PITCH_MIN, PITCH_MAX);
  }

  /** Distance with the zone view blended in (until the player zooms in that zone). */
  private zoneDistance(photo: boolean): number {
    const z = this.zone;
    if (photo || !z || z.dist === undefined || this.zoneW <= 0) return this.distance;
    return lerp(this.distance, z.dist, this.zoneW);
  }

  private updateZone(now: number, dt: number, idleMs: number, off: boolean) {
    const p = runtime.player;
    const zone = off ? this.zone : zoneAt(view.x, view.z, this.zone);
    if (zone !== this.zone) {
      if (zone) {
        zone.frame?.(heightAt);
        this.zoneZoomed = false;
        this.zoneIdleSince = 0;
        // (b) entering after ≥ 10 s away: a gentle, non-locking turn toward the zone's view
        if (now - this.zoneLeftAt > 10 && idleMs > 2500 && !game.get().dialogue.nodeId) {
          const reduced = game.get().settings.reducedMotion;
          this.startAssist(zone.near ? this.clearYawNear(view.x, view.z, zoneYaw(zone), zoneNear(zone)) : this.heroSafe(view.x, view.z, zone.yaw), now, reduced ? 6 : 1.2);
        }
      } else this.zoneLeftAt = now;
      this.zone = zone;
    }
    const wantW = zone && !this.zoneZoomed && !off ? 1 : 0;
    this.zoneW += (wantW - this.zoneW) * (1 - Math.exp(-1.6 * dt));
    if (Math.abs(wantW - this.zoneW) < 1e-3) this.zoneW = wantW;
    // (c) idle in the zone for 3 s: a weak bias toward its view
    if (zone && !p.moving) { if (!this.zoneIdleSince) this.zoneIdleSince = now; }
    else this.zoneIdleSince = 0;
    // (a city landmark zone: only from outside its search width — inside it the clear yaw it chose stands)
    const settled = !!zone?.near && Math.abs(wrap(zoneYaw(zone) - this.yaw)) < zoneNear(zone);
    if (zone && !settled && this.zoneIdleSince && now - this.zoneIdleSince > 3 && idleMs > 2500 && this.assist === null && !game.get().dialogue.nodeId) {
      this.yaw += wrap(zoneYaw(zone) - this.yaw) * Math.min(1, dt * 0.3);
    }
  }

  /** The zone yaw if it clears the hero landmarks, else the nearest yaw that does. */
  private heroSafe(x: number, z: number, want: number): number {
    if (heroClear(x, z, want, this.distance)) return want;
    for (let k = 1; k <= 12; k++) for (const sgn of [1, -1]) { const y = want + sgn * k * 0.2; if (heroClear(x, z, y, this.distance)) return y; }
    return want;
  }

  // --- camera assists: gentle automatic yaw turns, never while the player steers the camera
  private assist: number | null = null;
  private assistRate = 1;
  private assistEnd = 0;
  private prevGuideState: string = 'idle';
  private talkEndedAt = -100;
  private occlSince = 0;
  private occlCheckAt = 0;
  // the arrival look-again (city, E2-6)
  private settleUntil = 0;
  /** W5-F6: the player was on a bridge deck last frame; the alignment the camera keeps there (±1 along the axis, 0 none) */
  private onDeck = false;
  private deckDir = 0;
  private deckManual = false;
  private deckX = NaN;
  private deckZ = NaN;
  /** (W6-K1) the per-frame deck query's output, reused */
  private readonly deckOut: DeckAt = { deck: null as unknown as DeckAt['deck'], s: 0, l: 0 };
  /** W5-F7: the open-ground yaw an arrival asked for (faceCameraToward open) and until when it outranks the arrival yaw */
  private openYaw = 0;
  private openUntil = 0;
  /** (W5-F review) the movement basis of that turn (the player walks the open way) and when it was asked (performance ms) */
  private openBasis = 0;
  private openAt = -Infinity;
  private settleEpoch = -1;
  private settleAt = 0;
  private settleCheckAt = 0;
  private settleX = 0;
  private settleZ = 0;

  /**
   * City arrivals (?at=, resume, a teleport): the snap chose the yaw before the chunks there were resident (no roofs,
   * rough heights). Every 0.5 s while chunks keep attaching (cityEpoch), the player stands where they arrived and nobody
   * touched the camera, choose again and turn there (a zone's landmark view, a clear street).
   */
  private settleCheck(now: number, idleMs: number, busy: boolean, reduced: boolean) {
    const p = runtime.player;
    const touched = idleMs < (now - this.settleAt) * 1000;
    if (busy || touched || p.moving || Math.hypot(view.x - this.settleX, view.z - this.settleZ) > 2) { this.settleUntil = 0; return; }
    if (now < this.settleCheckAt) return;
    this.settleCheckAt = now + 0.5;
    const e = cityEpoch();
    if (e === this.settleEpoch) return;
    this.settleEpoch = e;
    const yaw = chooseYaw(view.x, view.z, p.heading + Math.PI, this.distance);
    if (Math.abs(wrap(yaw - (this.assist ?? this.yaw))) > 0.3) this.startAssist(yaw, now, reduced ? 6 : 2, true);
  }

  private assists(now: number, talking: boolean, idleMs: number) {
    const p = runtime.player, g = runtime.guide;
    const reduced = game.get().settings.reducedMotion;
    const manualRecently = idleMs < 2500;
    // 1) a guided walk starts (tour stop / this-week board): face where BAYBAY is heading
    const leading = g.state === 'lead' || g.state === 'wait';
    const wasLeading = this.prevGuideState === 'lead' || this.prevGuideState === 'wait';
    this.prevGuideState = g.state;
    if (leading && !wasLeading && !manualRecently) {
      const t = g.target && Math.hypot(g.x - p.x, g.z - p.z) < 4 ? g.target : { x: g.x, z: g.z };
      const dx = t.x - p.x, dz = t.z - p.z;
      if (Math.hypot(dx, dz) > 3) {
        const want = Math.atan2(-dx, -dz); // camera behind the player, looking toward BAYBAY
        if (Math.abs(wrap(want - this.yaw)) > 0.9) {
          const yaw = this.clearYaw(p.x, p.z, want, false);
          if (now - this.talkEndedAt < 0.8) {
            // A7: the walk starts as a conversation ends — make the turn inside the blend out of the two-shot, and
            // point the movement basis there at once, so a held key walks straight toward BAYBAY
            this.yaw = this.yawS = yaw;
            this.assist = null;
            moveBasis.locked = true; this.lockYaw = yaw; this.lockUntil = now + 1.5; moveBasis.yaw = yaw;
          } else this.startAssist(yaw, now, reduced ? 6 : 1.0);
        }
      }
    }
    if (talking) this.talkEndedAt = Infinity;
    else if (this.talkEndedAt === Infinity) this.talkEndedAt = now;
    // 2) a building / hero landmark has sat between the camera and the player for a moment: swing to a clear view
    //    (not on a bridge deck: the deck rule keeps the camera on the axis, W5-F6)
    if (!talking && !manualRecently && this.assist === null && !this.onDeck && now >= this.occlCheckAt) {
      this.occlCheckAt = now + 0.3;
      const occ = occlusionBehind(view.x, view.z, this.yaw, this.distance);
      if (occ > 2.5) {
        if (!this.occlSince) this.occlSince = now;
        if (now - this.occlSince > 0.6) {
          // a landmark's zone (city): only within its search width, the subject stays in frame (the dither thins what
          // is left in between)
          const z = this.zone && this.zone.near && this.zoneW > 0.5 ? this.zone : null;
          const best = z ? this.clearYawNear(view.x, view.z, zoneYaw(z), zoneNear(z)) : this.clearYaw(view.x, view.z, this.yaw, true);
          if (occlusionBehind(view.x, view.z, best, this.distance) < occ * 0.5) this.startAssist(best, now, reduced ? 6 : 1.0);
          this.occlSince = 0;
        }
      } else this.occlSince = 0;
    }
  }

  private applyAssist(now: number, dt: number, idleMs: number) {
    if (idleMs < 1200) this.assist = null; // hands off while the player is turning the camera
    if (this.assist === null) return;
    const d = wrap(this.assist - this.yaw);
    if (Math.abs(d) < 0.02 || now > this.assistEnd) this.assist = null;
    else this.yaw += d * Math.min(1, dt * this.assistRate);
  }

  /** Start an automatic turn: capped at 100°, and the movement basis is held while a movement input is down (A7). */
  private startAssist(yaw: number, now: number, rate: number, uncapped = false) {
    let d = wrap(yaw - this.yaw);
    const cap = (100 * Math.PI) / 180;
    if (!uncapped && Math.abs(d) > cap) d = Math.sign(d) * cap;
    this.assist = this.yaw + d;
    this.assistRate = rate;
    this.assistEnd = now + 4;
    if (input.manualMove && !moveBasis.locked) {
      moveBasis.locked = true;
      this.lockYaw = moveBasis.yaw;
      this.lockUntil = now + 1.5;
    }
  }

  private updateMoveBasis(now: number, dt: number) {
    // W5-F7 (review): after an arrival's open-ground turn the stick and the keys walk the open way at once — the camera
    // takes a second or two to swing behind, and a push meanwhile went along the old view: off a glide landing by the
    // Ferry Building's seawall the first push walked into the rail. Until the camera is there, the hold ends or the
    // player turns the camera themselves; then the basis blends back to the camera's (0.3 s).
    if (this.openUntil > now && input.lastCameraInputAt <= this.openAt && Math.abs(wrap(this.openBasis - this.yawS)) > 0.05) {
      moveBasis.locked = false;
      moveBasis.yaw = this.lockYaw = this.openBasis;
      this.lockRelease = 0;
      return;
    }
    if (moveBasis.locked) {
      if (!input.manualMove || now > this.lockUntil) { moveBasis.locked = false; this.lockRelease = 0; }
      else { moveBasis.yaw = this.lockYaw; return; }
    }
    if (this.lockRelease < 1) {
      // blend back to the camera yaw over 0.3 s
      this.lockRelease = Math.min(1, this.lockRelease + dt / 0.3);
      this.lockYaw += wrap(this.yawS - this.lockYaw) * this.lockRelease;
      moveBasis.yaw = this.lockRelease >= 1 ? this.yawS : this.lockYaw;
      return;
    }
    moveBasis.yaw = this.yawS;
  }

  /** The clearest yaw within ±`near` of `centre` (a city landmark zone's view). */
  private clearYawNear(x: number, z: number, centre: number, near: number): number {
    let best = centre, bestScore = Infinity;
    for (let k = -4; k <= 4; k++) {
      const yaw = centre + (k / 4) * near;
      const score = occlusionBehind(x, z, yaw, this.distance) * 3 + Math.abs(k) * 0.75;
      if (score < bestScore) { bestScore = score; best = yaw; }
    }
    return best;
  }

  /** The yaw nearest to `want` whose view of (x, z) is not blocked by buildings / heroes (wide: search further). */
  private clearYaw(x: number, z: number, want: number, wide: boolean): number {
    let best = want, bestScore = Infinity;
    const steps = wide ? 9 : 4;
    for (let k = -steps; k <= steps; k++) {
      const yaw = want + k * 0.35;
      const score = occlusionBehind(x, z, yaw, this.distance) * 3 + Math.abs(k) * (wide ? 0.25 : 0.4);
      if (score < bestScore) { bestScore = score; best = yaw; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Framing poses (C1 + A3)
  // ---------------------------------------------------------------------------

  /** Automatic conversation two-shot: camera 30–40° off the player → speaker axis, behind the player, clear side. */
  private twoShotPose(sx: number, sz: number, sy: number, baseFov: number, out: Pose, fresh: boolean) {
    const px = view.x, pz = view.z;
    let ax = sx - px, az = sz - pz;
    const L = Math.hypot(ax, az) || 1;
    ax /= L; az /= L;
    const mx = (px + sx) / 2, mz = (pz + sz) / 2, gy = Math.min(view.ground, sy);
    const R = (this.portrait ? TWO_DIST * 0.8 : TWO_DIST) + Math.max(0, L - 2.5) * 0.6, H = TWO_HEIGHT;
    const camAt = (angle: number, o: THREE.Vector3) => {
      // rotate "behind the player" (−axis) by the signed angle around the pair's midpoint
      const c = Math.cos(angle), s2 = Math.sin(angle);
      const dx = -ax * c + az * s2, dz = -ax * s2 - az * c;
      return o.set(mx + dx * R, gy + H, mz + dz * R);
    };
    if (fresh || !this.frameSolved || this.frameSolved.key !== 'two') {
      // the clearest of a few angles around 38° either side (occlusion incl. round colliders; a camera standing over
      // walkable ground beats one hanging over the water behind a railing) — kept for the whole conversation.
      // G2 w3 request 5: in a resident's chat BAYBAY waits beside the resident (game/flow talkMark) on the side she was
      // on when the chat began: prefer her side so she is in the shot, not hidden behind the player (occlusion still
      // wins). The sign matches camAt: a positive angle puts the camera on the (az, −ax) side, the side asideMark calls +1.
      const gs = view.speaker === 2 ? Math.sign((runtime.guide.x - sx) * az - (runtime.guide.z - sz) * ax) : 0;
      const prefer = gs || this.twoSide;
      let best = prefer * TWO_ANGLE, bestScore = Infinity;
      for (const sign of [prefer, -prefer]) {
        for (const a of TWO_ANGLES) {
          const c = camAt(sign * a, tmpA);
          const ground = canStand(c.x, c.z, 0.3) ? 0 : inWorld(c.x, c.z) ? 1.5 : 0.6;
          const score = segmentBlocked(c.x, c.z, px, pz) + segmentBlocked(c.x, c.z, sx, sz) * 1.2 + ground + residentsInView(c.x, c.z, mx, mz)
            + pairOverlap(c.x, c.z, px, pz, sx, sz) + (sign === prefer ? 0 : 0.3) + Math.abs(a - TWO_ANGLE) * 0.8;
          if (score < bestScore) { bestScore = score; best = sign * a; }
        }
      }
      this.twoSide = best >= 0 ? 1 : -1;
      this.frameSolved = { key: 'two', mx, mz, camX: 0, camZ: 0, camY: 0, fov: 0, sideSign: best, back: R };
    }
    const c = camAt(this.frameSolved.sideSign, out.pos);
    c.y = Math.max(c.y, (inWorld(c.x, c.z) ? heightAt(c.x, c.z) : gy) + 0.9);
    out.fov = this.portrait ? baseFov : 38;
    out.cover = this.coverNow;
    // aim: the nearer character's feet (lowest on screen) just above the card, heads well inside the frame
    const tanHalf = Math.tan(((out.fov / 2) * Math.PI) / 180);
    const feetY = 1 - out.cover - 0.05;
    const pNear = Math.hypot(px - c.x, pz - c.z) <= Math.hypot(sx - c.x, sz - c.z);
    this.aimAt(out, mx, mz, pNear ? px : sx, pNear ? pz : sz, gy, feetY, tanHalf, gy + 0.5 * CHAR_SCALE);
  }

  /**
   * Point the camera (pos fixed) horizontally at (mx, mz) and pitch it so that the ground point (lx, lowY, lz) lands at
   * screen y `yPost` (0 = top, after the view offset), but never so far that `midY` rises above the frame centre band.
   */
  private aimAt(out: Pose, mx: number, mz: number, lx: number, lz: number, lowY: number, yPost: number, tanHalf: number, midY: number) {
    const c = out.pos;
    const hx = mx - c.x, hz = mz - c.z, hd = Math.hypot(hx, hz) || 1;
    const yPre = yPost + out.cover * 0.5;
    // depth of the low point along the view direction
    const ld = Math.max(0.5, ((lx - c.x) * hx + (lz - c.z) * hz) / hd);
    const eLow = Math.atan2(lowY - c.y, ld);
    let alpha = eLow - Math.atan((1 - 2 * yPre) * tanHalf);
    // keep the characters' middle from drifting above y ≈ 0.42 (post)
    const eMid = Math.atan2(midY - c.y, hd);
    const alphaMin = eMid - Math.atan((1 - 2 * (0.42 + out.cover * 0.5)) * tanHalf);
    alpha = Math.max(alpha, alphaMin);
    out.target.set(c.x + (hx / hd) * Math.cos(alpha) * 10, c.y + Math.sin(alpha) * 10, c.z + (hz / hd) * Math.cos(alpha) * 10);
  }

  /** Poses for the C1 framings held by game flow. */
  private framingPose(f: Framing, baseFov: number, out: Pose) {
    const px = view.x, pz = view.z, py = view.ground;
    if (f.kind === 'view') {
      const d = f.dist, pt = f.pitch, yw = f.yaw;
      const look = f.lookUp ?? 0.12 * d;
      out.target.set(px, py + FOCUS_Y + look, pz);
      out.pos.set(out.target.x + Math.sin(yw) * Math.cos(pt) * d, out.target.y + Math.sin(pt) * d, out.target.z + Math.cos(yw) * Math.cos(pt) * d);
      out.fov = f.fov ?? baseFov;
      out.cover = 0;
      this.floorPose(out);
      return;
    }
    if (f.kind === 'over-shoulder') {
      const tx = f.toward.x - px, tz = f.toward.z - pz, L = Math.hypot(tx, tz) || 1;
      const ux = tx / L, uz = tz / L;
      const d = f.dist ?? 6, pt = f.pitch ?? 0.3;
      // behind the player, a shoulder's width to the right, looking past them toward the subject
      const rx = -uz, rz = ux;
      out.target.set(px + ux * 3 + rx * 0.4, py + FOCUS_Y + 0.2, pz + uz * 3 + rz * 0.4);
      out.pos.set(px - ux * Math.cos(pt) * d + rx * 0.9, py + FOCUS_Y + Math.sin(pt) * d, pz - uz * Math.cos(pt) * d + rz * 0.9);
      out.fov = baseFov;
      out.cover = 0;
      this.floorPose(out);
      return;
    }
    // two-shot: the speaker (BAYBAY / NPC) + the player; an optional subject rising behind the speaker.
    // The card may still be sliding in when the flow measured it: never frame for less than it covers now.
    out.cover = Math.max(f.bottomCover ?? 0, this.coverNow);
    const sx = view.speaker ? view.speakerX : runtime.guide.x, sz = view.speaker ? view.speakerZ : runtime.guide.z;
    const sy = view.speaker ? view.speakerY : runtime.guide.y;
    if (!f.subject) {
      // same as the automatic two-shot, with the flow's card cover
      const cover = out.cover;
      this.twoShotPose(sx, sz, sy, baseFov, out, !this.frameSolved);
      out.cover = cover;
      return;
    }
    this.subjectTwoShot(f.subject, px, pz, py, sx, sz, sy, out);
  }

  /**
   * Subject two-shot (welcome under the clock tower, tour stops): the camera on the subject → speaker line, ~10 u past
   * the pair, 1.2 u toward the player so BAYBAY shows three-quarters; low and looking up so the subject rises behind
   * her. A small search picks distance, height and lens so the subject stays in the top of the frame while both
   * characters stand above the dialogue card, as large as possible.
   */
  private subjectTwoShot(subject: [number, number, number], px: number, pz: number, py: number, sx: number, sz: number, sy: number, out: Pose) {
    const mx = (px + sx) / 2, mz = (pz + sz) / 2;
    const cover = out.cover;
    const fs = this.frameSolved;
    const moved = !fs || fs.key !== 'subject' || Math.hypot(fs.mx - mx, fs.mz - mz) > 1.5;
    if (moved) {
      let dx = sx - subject[0], dz = sz - subject[2];
      const L = Math.hypot(dx, dz) || 1;
      dx /= L; dz /= L;
      // lateral: toward the player's side of the line
      let rx = -dz, rz = dx;
      if ((px - sx) * rx + (pz - sz) * rz < 0) { rx = -rx; rz = -rz; }
      const fovs = this.portrait ? [58, 64, 70, 76] : [46, 52, 58, 66];
      const lowY = Math.min(py, sy);
      let best: { score: number; x: number; y: number; z: number; fov: number; back: number } | null = null;
      for (const fov of fovs) {
        const t = Math.tan(((fov / 2) * Math.PI) / 180);
        // (a subject right above the pair — the clock tower from its foot — needs the camera much further back)
        for (let back = 7; back <= 30; back += back < 18 ? 1 : 2) {
          // (±2: a wider step off the line when the pair stands along it — a narrow pier, a stop dead ahead)
          for (const [hgt, lat] of [[0.9, 1], [1.4, 1], [2.2, 1], [0.9, -1], [1.4, -1], [1.4, 2], [2.2, 2], [1.4, -2], [2.2, -2]] as const) {
            // lateral offset grows with distance so the two never stack up behind each other
            const off = Math.max(1.2, back * 0.1) * lat;
            const cx = mx + dx * back + rx * off, cz = mz + dz * back + rz * off;
            const cy = lowY + hgt;
            const r = this.scoreSubject(cx, cy, cz, subject, px, py, pz, sx, sy, sz, cover, t) - (fov - fovs[0]) * 0.0006;
            if (best && r <= best.score) continue;
            // penalties: a camera inside a building, a building between camera and BAYBAY
            // (and a lamp post / palm right in front of the lens)
            const near = blockersNear(cx, cz, 1.3);
            const blocked = segmentBlocked(cx, cz, sx, sz) + (near.some(b => b.kind === 'polygon') ? 3 : 0) + (near.some(b => b.kind === 'circle') ? 0.6 : 0)
              + residentsInView(cx, cz, mx, mz);
            const score = r - blocked * 0.2;
            if (!best || score > best.score) best = { score, x: cx, y: cy, z: cz, fov, back };
          }
        }
      }
      this.frameSolved = { key: 'subject', mx, mz, camX: best!.x, camZ: best!.z, camY: best!.y, fov: best!.fov, sideSign: 1, back: best!.back };
    }
    const sol = this.frameSolved!;
    out.pos.set(sol.camX, sol.camY, sol.camZ);
    out.fov = sol.fov;
    const t = Math.tan(((sol.fov / 2) * Math.PI) / 180);
    const a = this.subjectPitch(sol.camX, sol.camY, sol.camZ, subject, px, py, pz, sx, sy, sz, cover, t);
    const hx = mx - sol.camX, hz = mz - sol.camZ, hd = Math.hypot(hx, hz) || 1;
    out.target.set(sol.camX + (hx / hd) * Math.cos(a) * 10, sol.camY + Math.sin(a) * 10, sol.camZ + (hz / hd) * Math.cos(a) * 10);
  }

  /** Camera pitch that puts the subject at y ≈ 0.10 (post offset) unless that pushes the feet under the card. */
  private subjectPitch(cx: number, cy: number, cz: number, subject: [number, number, number], px: number, py: number, pz: number, sx: number, sy: number, sz: number, cover: number, t: number): number {
    const mx = (px + sx) / 2, mz = (pz + sz) / 2;
    const hd = Math.hypot(mx - cx, mz - cz) || 1;
    const along = (x: number, z: number) => ((x - cx) * (mx - cx) + (z - cz) * (mz - cz)) / hd;
    const eSub = Math.atan2(subject[1] - cy, Math.max(1, along(subject[0], subject[2])));
    const aSub = eSub - Math.atan((1 - 2 * (0.1 + cover * 0.5)) * t);
    const feetLimit = 1 - cover - 0.03;
    const eFeet = Math.min(Math.atan2(py - cy, Math.max(0.5, along(px, pz))), Math.atan2(sy - cy, Math.max(0.5, along(sx, sz))));
    const aFeet = eFeet - Math.atan((1 - 2 * (feetLimit + cover * 0.5)) * t);
    // pitch up toward the subject, but never past the angle that drops the feet under the card
    return Math.min(aSub, aFeet);
  }

  /** Projected BAYBAY height when the subject fits; negative when it does not. */
  private scoreSubject(cx: number, cy: number, cz: number, subject: [number, number, number], px: number, py: number, pz: number, sx: number, sy: number, sz: number, cover: number, t: number): number {
    const a = this.subjectPitch(cx, cy, cz, subject, px, py, pz, sx, sy, sz, cover, t);
    const mx = (px + sx) / 2, mz = (pz + sz) / 2;
    const hx = mx - cx, hz = mz - cz, hd = Math.hypot(hx, hz) || 1;
    const fx = (hx / hd) * Math.cos(a), fy = Math.sin(a), fz = (hz / hd) * Math.cos(a);
    const ux = -(hx / hd) * Math.sin(a), uy = Math.cos(a), uz = -(hz / hd) * Math.sin(a);
    const proj = (x: number, y: number, z: number) => {
      const vx = x - cx, vy = y - cy, vz = z - cz;
      const depth = vx * fx + vy * fy + vz * fz;
      if (depth < 0.3) return 9;
      return 0.5 - (0.5 * (vx * ux + vy * uy + vz * uz)) / (depth * t) - cover * 0.5;
    };
    const ySub = proj(subject[0], subject[1], subject[2]);
    const gTop = proj(sx, sy + BAYBAY_HEIGHT, sz), gBot = proj(sx, sy, sz), pBot = proj(px, py, pz);
    let score = gBot - gTop;
    // the two must not stand in front of each other: horizontal separation of their centres (normalised, ~aspect-free)
    const side = (x: number, z: number) => { const vx = x - cx, vz = z - cz; const depth = vx * (hx / hd) + vz * (hz / hd); return depth > 0.3 ? (vx * (hz / hd) - vz * (hx / hd)) / (depth * t) : 0; };
    const sep = Math.abs(side(px, pz) - side(sx, sz)), need = (gBot - gTop) * 0.55;
    if (sep < need) score -= (need - sep) * 3;
    // subject (clock face …) should sit in the top band; trading a little of it for bigger characters is fine,
    // losing it off the top is not
    if (ySub < 0.07) score -= (0.07 - ySub) * 1.5;
    if (ySub < 0.02) score -= 0.5;
    if (ySub > 0.3) score -= (ySub - 0.3) * 2;
    if (Math.max(gBot, pBot) > 1 - cover) score -= 1;
    // both heads inside the frame: from a low lens the near player can tower out of the top (Pier 7's narrow deck)
    const topMin = Math.min(gTop, proj(px, py + PLAYER_HEIGHT + 0.15, pz));
    if (topMin < 0.04) score -= (0.04 - topMin) * 3;
    return score;
  }

  /** Keep a framing camera above the ground / water. */
  private floorPose(out: Pose) {
    const c = out.pos;
    const floor = (inWorld(c.x, c.z) ? heightAt(c.x, c.z) : 0) + 0.8;
    if (c.y < floor) c.y = floor;
  }

  /**
   * City (E2-6, CS-10): lift the follow camera over the roofs the ray from the focus would pass below (Blocker.top:
   * city buildings and landmarks) — the diorama view down onto a narrow Sunset or Mission street instead of a camera
   * among the roofs. Only buildings ≥ 35 % of the way out count (next to the player the dither and the occlusion turn
   * handle it), at most ROOF_LIFT_MAX of the distance; rises fast, settles slowly. District mode and the hero slab's
   * blockers carry no tops: nothing changes there.
   */
  private roofLiftStep(target: THREE.Vector3, pos: THREE.Vector3, dt: number) {
    let need = 0;
    if (cityTerrain()) {
      const dx = pos.x - target.x, dy = pos.y - target.y, dz = pos.z - target.z, L = Math.hypot(dx, dz);
      const n = Math.ceil(L / 0.8);
      for (let i = Math.ceil(n * 0.35); i <= n; i++) {
        const f = i / n;
        roofTopMax = -Infinity;
        forEachBlockerNear(target.x + dx * f, target.z + dz * f, 0.4, roofMax);
        if (roofTopMax === -Infinity) continue;
        const clear = roofTopMax + ROOF_CLEAR;
        if (target.y + dy * f < clear) need = Math.max(need, (clear - target.y) / f - dy);
      }
      // the camera itself between two houses (the ray clear down the gap): above their roofs too
      roofTopMax = -Infinity;
      forEachBlockerNear(pos.x, pos.z, 1.8, roofMax);
      if (roofTopMax > -Infinity) need = Math.max(need, roofTopMax + ROOF_CLEAR - pos.y);
      need = Math.min(need, L * ROOF_LIFT_MAX);
    }
    const k = this.roofCut ? 1 : need > this.roofLift ? 1 - Math.exp(-8 * dt) : 1 - Math.exp(-1.5 * dt);
    this.roofCut = false;
    this.roofLift += (need - this.roofLift) * k;
    if (this.roofLift < 1e-3) { this.roofLift = 0; return; }
    pos.y += this.roofLift;
  }
  private roofLift = 0;
  /** a cut (teleport): the next roof lift applies at once */
  private roofCut = false;

  /** Raise the camera when Telegraph Hill (or any terrain) would sit between it and the player. */
  private avoidTerrain(target: THREE.Vector3, pos: THREE.Vector3, dt: number) {
    let need = 0;
    const n = 14;
    for (let i = 2; i <= n; i++) {
      const f = i / n;
      const x = target.x + (pos.x - target.x) * f, z = target.z + (pos.z - target.z) * f;
      if (!inWorld(x, z)) continue;
      const clearance = 0.9 + f * 0.9;
      const ground = heightAt(x, z) + clearance;
      const rayY = target.y + (pos.y - target.y) * f;
      if (rayY < ground) need = Math.max(need, (ground - target.y) / f - (pos.y - target.y));
    }
    // camera itself above the ground / table
    const floor = (inWorld(pos.x, pos.z) ? heightAt(pos.x, pos.z) : 0) + 1.4;
    need = Math.max(need, floor - pos.y);
    // rise fast, settle slowly
    const k = need > this.lift ? 1 - Math.exp(-14 * dt) : 1 - Math.exp(-2.2 * dt);
    this.lift += (Math.max(0, need) - this.lift) * k;
    pos.y += this.lift;
  }

  /** Wheel / pinch changes become the saved camera distance (debounced; photo mode zoom is temporary). */
  private persistDistance(photo: boolean) {
    if (photo) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      const d = Math.round(clamp(this.distance, DIST_MIN, DIST_MAX));
      game.set(st => (st.settings.cameraDistance === d ? {} : { settings: { ...st.settings, cameraDistance: d } }));
    }, 450);
  }

  dispose() { if (this.persistTimer) clearTimeout(this.persistTimer); }
}

/** Project a world point with the camera's current matrices → canvas-normalised (0..1 from top-left), or null behind. */
export function projectNorm(camera: THREE.PerspectiveCamera, x: number, y: number, z: number): { x: number; y: number } | null {
  const v = tmpC.set(x, y, z);
  const rel = tmpB.copy(v).sub(camera.position);
  camera.getWorldDirection(tmpA);
  if (rel.dot(tmpA) <= 0.05) return null;
  v.project(camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
}

/** Near plane for a camera `camY` over ground `groundY` (plan §5.8): clamp(0.5 + 0.02·height, 0.5, 8). */
export function nearPlane(camY: number, groundY: number): number {
  return clamp(0.5 + 0.02 * (camY - groundY), 0.5, 8);
}

/** The platform of the transit ride (the hero F-line 'streetcar', else the city line's car: `move.line`). */
function transitPlatform() { return platforms.get(game.get().move.line ?? 'streetcar'); }
/** the side a city line's ride camera keeps (+1 = the car's left), per platform, re-chosen after a break of > 1 s */
const transitSide = { id: '', side: 1 as 1 | -1, t: -9 };

/** Which ride rig applies right now (null = on foot / photo / travel: the follow rig). */
export function rideCamMode(): RideCamMode | null {
  const m = runtime.move;
  switch (m.mode) {
    case 'bike': case 'car': return m.phase === 'boarding' && m.progress < 0.5 ? null : m.mode;
    case 'glide': return 'glide';
    case 'sit': return m.phase === 'steady' ? 'sit' : null;
    // (the ride's own car: lane F publishes cable cars as platforms.get(move.line); stepping down hands back to the follow rig)
    case 'transit': return runtime.move.spot && m.phase !== 'alighting' && transitPlatform()?.live ? 'transit' : null;
    default: return null;
  }
}

/** The subject the ride rig frames this frame (from the runtime vehicle / glide / platform state). */
function rideSubject(mode: RideCamMode, now: number): import('./cameraModes').RideSubject {
  void now;
  const v = runtime.vehicle, g = runtime.glide, p = runtime.player;
  if (mode === 'bike' || mode === 'car') {
    const ax = v.x + Math.sin(v.heading) * 8, az = v.z + Math.cos(v.heading) * 8;
    const gradeAhead = inWorld(ax, az) ? (heightAt(ax + Math.sin(v.heading), az + Math.cos(v.heading)) - heightAt(ax - Math.sin(v.heading), az - Math.cos(v.heading))) / 2 : 0;
    return { mode, x: v.x, y: v.y + (mode === 'bike' ? 1.1 : 0.8), z: v.z, heading: v.heading, speed: v.speed, gradeAhead };
  }
  if (mode === 'glide') return { mode, x: g.x, y: g.y, z: g.z, heading: g.heading, speed: g.speed, gradeAhead: 0 };
  if (mode === 'transit') {
    const plat = transitPlatform()!;
    const seated = runtime.move.spot === 'seat';
    if (plat.id !== 'streetcar') {
      // a city line (cable car): the side toward the view (actors/viewField, E2-5: as the F-line's water side), chosen
      // when the ride starts and kept for it; the rider hangs off the running board on that side (lane F railMirror)
      // and the rig pulls in before a building (occlude)
      if (transitSide.id !== plat.id || now - transitSide.t > 1) {
        const dir = preferredViewDir(p.x, p.z);
        transitSide.side = toLocal(plat, p.x + Math.sin(dir) * 10, p.z + Math.cos(dir) * 10).x >= 0 ? 1 : -1;
        transitSide.id = plat.id;
      }
      transitSide.t = now;
      rideCamInfo.side = transitSide.side;
      return { mode, x: view.x, y: view.y + (seated ? 0.9 : 1.35), z: view.z, heading: plat.heading, speed: 0, gradeAhead: 0, side: transitSide.side, seated, occlude: true, kind: plat.kind };
    }
    // camera on the water side of the car, as the old side-on ride shot (the promenade normal points to the Bay)
    const f = frameAt(stationOf({ x: p.x, z: p.z }).st);
    const local = toLocal(plat, plat.x + f.nx, plat.z + f.nz);
    const side: 1 | -1 = local.x >= 0 ? 1 : -1;
    rideCamInfo.side = side;
    return { mode, x: view.x, y: view.y + (seated ? 0.9 : 1.35), z: view.z, heading: plat.heading, speed: 0, gradeAhead: 0, side, seated };
  }
  // sit: over the shoulder toward the view the bench faces (city: turned up to 0.6 rad toward the view field's
  // direction, E2-5 — a street bench faces the kerb, the Bay may be off to one side)
  let h = p.heading;
  if (!heroView(view.x, view.z)) { const d = wrap(preferredViewDir(view.x, view.z) - h); if (Math.abs(d) < 2) h += clamp(d, -0.6, 0.6); }
  return { mode, x: view.x, y: view.y + 0.3, z: view.z, heading: h, speed: 0, gradeAhead: 0 };
}
