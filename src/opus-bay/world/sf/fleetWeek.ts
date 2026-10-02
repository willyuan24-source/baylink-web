import * as THREE from 'three';
import { emit, onEvent } from '../../core/events';
import { runtime } from '../../core/runtime';
import { game } from '../../core/store';
import type { Bilingual, Vec2 } from '../../core/types';
import { isPaid } from '../../economy/ledger';
import { bayNow, bayParts } from '../../game/bayNow';
import { faceCameraToward } from '../../game/cinema';
import { enterPhotoMode } from '../../game/flow';
import { flow } from '../../game/flowStore';
import { invalidateInteractables } from '../../game/interactables';
import { registerFrameSystem } from '../../game/systemsRegistry';
import { setWatchOverride, WATCH, type WatchOverride } from '../../realsf/jets';
import type { OfferedLine } from '../../realsf/lines';
import { BOX, CONE, CYL, ICO, M, Batch, extrudeXZ } from '../builder';
import { openJournal } from '../../ui/slots';
import { cityStreamerLazy } from '../cityLoader';
import { patchToyShader } from '../materials';
import { instancedWarmup, registerWarmup } from '../warmup';
import { getWorld, type WorldSystem } from '../world';
import { isParadeDay, paradeOn, paradeWatchState, paradeWindow } from './fleetWeekDay';

/**
 * Wave 8 · lane S (W8-S2) · Fleet Week: the Parade of Ships (city mode only; a lazy chunk realsf/index.ts loads on the
 * parade's Bay day, never in GameRoot, never in the district).
 *
 * "Friday 10/9 11:00 am - 12:00 pm": the ships sail "under the Golden Gate Bridge" and "can be seen from the Golden Gate
 * Bridge to the Bay Bridge", the reviewing stand is at Marina Green, and the SFFD fireboat leads "shooting jets of water
 * into the air" (https://fleetweeksf.org/events/parade-of-ships/, read 2026-09-30; world/sf/fleetWeekDay.ts).
 *
 * In the game, on 9 Oct 2026 11:00–12:00 Bay time only:
 *   - a red toy fireboat with three arcs of water, then six grey toy ships (four on phones) in line astern, 45 u apart:
 *     plain grey hulls with a dark boot-top, deckhouses, a mast and a funnel — no weapons detail, no flags, no lettering.
 *   - one path over open water (PATH_POINTS): in from outside the Golden Gate, under the bridge's main span, along the
 *     shore ≈ 80–100 u off Crissy Field, Marina Green and Fort Mason, between Aquatic Park and Alcatraz, across the
 *     Alcatraz ferry's lanes once (W8-S4: ≈ 106 u of the path within 30 u of them, then ≥ 30 u out), outside the
 *     harbour ferry's loop along the Embarcadero, and under the Bay Bridge's west span between its first two towers
 *     (the mast tops stay under the toy deck) to the open Bay beyond. The fireboat passes under the Golden Gate at 11:00;
 *     the last ship reaches the path's end at 12:00 (the path is ≈ 1,940 u: ≈ 0.56 u/s, ≈ 7.5 knots at ≈ 7 m a unit;
 *     the fireboat passes Marina Green ≈ 11:16, the last ship ≈ 11:24). A ship grows out of the water over the path's
 *     first RAMP u and sinks from view over its last RAMP u (both ends are far from any shore). The positions follow
 *     the Bay clock: every player sees the same ship at the same minute.
 *   - ≤ 2 draw calls (the grey line one InstancedMesh, the fireboat a second, ONE material keyed like TOY_INST: no new
 *     program), ≈ 3k triangles; nothing per frame but the instance matrices (≤ 7) and two bounding spheres.
 *   - BAYBAY: on the day, far from Marina Green, 今天上午十一点… (before) or 舰船巡游开始啦… (during) and the waypoint to
 *     the Marina Green spot (the jets' WATCH, the reviewing stand); near the fireboat 看，领头的消防船…; the first photo
 *     with a ship near and in frame pays the Parade of Ships stamp + 15 coins (`event:fleet-week-2026-parade`, an
 *     appended SOUVENIR_IDS entry). During the parade the Marina Green spot's E prompt is 拍舰船巡游 (photo mode facing
 *     the ships); on the parade's morning it is 舰船巡游 · 码头绿地 (the Fleet Week card; W8-S4, `paradeWatchState`).
 */

export const PARADE_SOUVENIR = 'fleet-week-2026-parade';

/** The waterline the ships ride on (the district's water level). */
const WATER = -0.6;

/**
 * The path's control points (city units, projected with core/geo.ts projectCity from the real channel: outside the Gate
 * ≈ 37.818, −122.493; the Golden Gate Bridge's main span between its towers (−796.1, 564.4) / (−935.5, 452.7); off
 * Crissy Field, Marina Green, Fort Mason and Aquatic Park; between the city and Alcatraz (−455.5, −60.0); across lane A's
 * Alcatraz ferry lanes (data/ferry.ts ALCA_OUT / ALCA_BACK) once at x ≈ −330, then ≈ 40 u outside them and outside the
 * harbour ferry's loop along the Embarcadero; under the Bay Bridge between its towers at the W2 and W3 piers).
 */
export const PATH_POINTS: readonly Vec2[] = [
  { x: -990.8, z: 664.6 }, { x: -928.3, z: 586.6 }, { x: -865.8, z: 508.6 }, { x: -797, z: 423 },
  { x: -700, z: 405 }, { x: -580, z: 378 }, { x: -456, z: 242 }, { x: -392, z: 150 }, { x: -366, z: 60 },
  { x: -356, z: -28 }, { x: -322, z: -98 }, { x: -270, z: -160 }, { x: -170, z: -176 }, { x: -40, z: -168 }, { x: 90, z: -146 },
  { x: 180, z: -110 }, { x: 229.9, z: -49.3 }, { x: 300, z: -66 }, { x: 380, z: -98 }, { x: 440, z: -124 },
];
/** the index of the control point under the Golden Gate's main span (the fireboat is there at 11:00) */
export const BRIDGE_POINT = 2;

/** ships in the line (the fireboat is ship 0), the gap between two (u, arc length), the growing / sinking stretch (u) */
export const SHIPS = 7;
export const GAP = 45;
export const RAMP = 20;
export const shipCount = (quality: 'high' | 'mid' | 'low' = game.get().settings.quality) => (quality === 'high' ? SHIPS : 5);

export interface ParadePath { length: number; n: number; step: number; pos: Float32Array; dir: Float32Array; sBridge: number }
const STEP = 2;
let pathCache: ParadePath | null = null;
/** The path sampled every STEP u of arc length: position and heading (x, z). */
export function paradePath(): ParadePath {
  if (pathCache) return pathCache;
  const curve = new THREE.CatmullRomCurve3(PATH_POINTS.map(p => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
  curve.arcLengthDivisions = 3000;
  const length = curve.getLength();
  const n = Math.max(64, Math.round(length / STEP)) + 1;
  const step = length / (n - 1);
  const pos = new Float32Array(n * 2), dir = new Float32Array(n * 2);
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  let sBridge = 0, best = Infinity;
  const b = PATH_POINTS[BRIDGE_POINT];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    curve.getPointAt(u, p); curve.getTangentAt(u, t);
    pos[i * 2] = p.x; pos[i * 2 + 1] = p.z;
    const l = Math.hypot(t.x, t.z) || 1;
    dir[i * 2] = t.x / l; dir[i * 2 + 1] = t.z / l;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (d < best) { best = d; sBridge = i * step; }
  }
  pathCache = { length, n, step, pos, dir, sBridge };
  return pathCache;
}

/** the line's speed (u/s): the fireboat under the Golden Gate at the open, the last ship at the path's end at the close */
export function paradeSpeed(path: ParadePath = paradePath()): number {
  const w = paradeWindow();
  return (path.length - path.sBridge + (SHIPS - 1) * GAP) / ((w.close - w.open) / 1000);
}

/**
 * (W8-S review, S-P4) The instant the fireboat enters at the path's start, outside the Golden Gate (≈ 6 min before 11:00):
 * the line sails in and is under the main span at the open — it no longer appears there out of nothing at 11:00:00.
 */
export function paradeEntryMs(path: ParadePath = paradePath()): number {
  return paradeWindow().open - (path.sBridge / paradeSpeed(path)) * 1000;
}

/** Ship i's arc length at `ms` (may be < 0: not in yet, or > length: gone). */
export function shipArc(i: number, ms: number, path: ParadePath = paradePath()): number {
  return path.sBridge + paradeSpeed(path) * ((ms - paradeWindow().open) / 1000) - i * GAP;
}

export interface ShipPose { x: number; z: number; hx: number; hz: number; s: number; scale: number }
/**
 * Ship i's pose at `ms`, or null when it is not on the water (before it reaches the path's start, past its end, or from
 * 12:00). (W8-S review, S-P4) Before 11:00 the ships sail in from the path's start, growing out of the water one by one
 * (paradeEntryMs): at 11:00 the fireboat is under the Golden Gate as before, with the first ships astern of it.
 */
export function shipPose(i: number, ms: number, path: ParadePath = paradePath(), out?: ShipPose): ShipPose | null {
  const w = paradeWindow();
  if (ms >= w.close) return null;
  const s = shipArc(i, ms, path);
  if (s < 0 || s > path.length) return null;
  const x = s / path.step, k = Math.min(path.n - 2, Math.floor(x)), f = x - k;
  const o = out ?? { x: 0, z: 0, hx: 0, hz: 1, s: 0, scale: 1 };
  o.x = path.pos[k * 2] + (path.pos[k * 2 + 2] - path.pos[k * 2]) * f;
  o.z = path.pos[k * 2 + 1] + (path.pos[k * 2 + 3] - path.pos[k * 2 + 1]) * f;
  const hx = path.dir[k * 2] + (path.dir[k * 2 + 2] - path.dir[k * 2]) * f, hz = path.dir[k * 2 + 1] + (path.dir[k * 2 + 3] - path.dir[k * 2 + 1]) * f;
  const l = Math.hypot(hx, hz) || 1;
  o.hx = hx / l; o.hz = hz / l; o.s = s;
  o.scale = Math.max(0, Math.min(1, Math.min(s, path.length - s) / RAMP));
  return o;
}

// ---------------------------------------------------------------------------------------------------------------
// The toy ships (local frame: +z the bow, +y up from the waterline, +x starboard)
// ---------------------------------------------------------------------------------------------------------------

const GREY = '#8e979f', GREY_LIGHT = '#b4bbc1', GREY_DECK = '#6c747b', BOOT = '#7c3a33', DARK = '#2c3236', MAST = '#596067', FOAM = '#e6f0f3';
const FIRE_RED = '#c63a2c', FIRE_WHITE = '#f3f0e8', BRASS = '#c9a23f', SPRAY = '#d9edf6';

/** the grey ship's plan (≈ 21 u long, 2.7 u in the beam: a destroyer's proportions on the city's scale, chunkier) */
const SHIP_PLAN: Vec2[] = [
  { x: -1.05, z: -10 }, { x: 1.05, z: -10 }, { x: 1.3, z: -8.6 }, { x: 1.35, z: 2.5 }, { x: 1.2, z: 5.6 }, { x: 0.85, z: 8.1 },
  { x: 0.4, z: 9.8 }, { x: 0, z: 10.6 }, { x: -0.4, z: 9.8 }, { x: -0.85, z: 8.1 }, { x: -1.2, z: 5.6 }, { x: -1.35, z: 2.5 }, { x: -1.3, z: -8.6 },
];
/** the fireboat's plan (≈ 7.4 u: about twice a real fireboat, so it reads at the head of the line) */
const FIRE_PLAN: Vec2[] = [
  { x: -1.0, z: -3.6 }, { x: 1.0, z: -3.6 }, { x: 1.15, z: -3.0 }, { x: 1.15, z: 1.4 }, { x: 0.8, z: 3.0 }, { x: 0, z: 3.8 },
  { x: -0.8, z: 3.0 }, { x: -1.15, z: 1.4 }, { x: -1.15, z: -3.0 },
];
const scalePlan = (plan: Vec2[], k: number) => plan.map(p => ({ x: p.x * k, z: p.z * k }));

/** A flat foam patch on the water: a bow wave (two arms) and a short wake behind the stern. */
function foam(b: Batch, bowZ: number, sternZ: number, beam: number) {
  for (const s of [-1, 1]) {
    b.add(BOX(), M(s * (beam * 0.75), 0.04, bowZ - 0.9, s * -0.5, 0.35, 0.05, 2.6), FOAM);
    b.add(BOX(), M(s * (beam * 0.45), 0.04, sternZ - 2.2, s * 0.12, 0.45, 0.05, 4.2), FOAM);
  }
  b.add(BOX(), M(0, 0.04, sternZ - 1.4, 0, beam * 0.9, 0.05, 2.6), FOAM);
}

export function buildShipGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const id = new THREE.Matrix4();
  b.add(extrudeXZ(SHIP_PLAN, -0.6, 0.05), id, BOOT);
  b.add(extrudeXZ(SHIP_PLAN, 0.05, 1.45), id, GREY);
  b.add(extrudeXZ(scalePlan(SHIP_PLAN, 0.95), 1.45, 1.52), id, GREY_DECK);
  // the forward deckhouse and the bridge (a dark window band), the mast, the funnel, the aft hangar
  b.add(BOX(), M(0, 1.45, 1.2, 0, 2.05, 1.7, 5.4), GREY_LIGHT);
  b.add(BOX(), M(0, 3.15, 2.3, 0, 1.75, 1.0, 2.6), GREY_LIGHT);
  b.add(BOX(), M(0, 3.45, 3.62, 0, 1.6, 0.36, 0.06), DARK);
  b.add(BOX(), M(0, 4.15, 2.3, 0, 1.85, 0.12, 2.8), GREY_DECK);
  b.add(CYL(6), M(0, 4.2, 2.0, 0, 0.1, 2.9, 0.1), MAST);
  b.add(BOX(), M(0, 6.0, 2.0, 0, 1.9, 0.08, 0.1), MAST);
  b.add(ICO(0), M(0, 7.25, 2.0, 0, 0.26, 0.26, 0.26), GREY_LIGHT);
  b.add(BOX(), M(0, 1.45, -2.6, 0, 1.3, 2.7, 1.7), GREY_LIGHT);
  b.add(BOX(), M(0, 4.15, -2.6, 0, 1.34, 0.3, 1.74), DARK);
  b.add(BOX(), M(0, 1.45, -6.4, 0, 2.2, 1.25, 3.0), GREY_LIGHT);
  // a bollard pair at the bow and the stern rail (toy detail, nothing like a weapon)
  for (const s of [-1, 1]) b.add(CYL(6), M(s * 0.45, 1.5, 7.0, 0, 0.12, 0.3, 0.12), DARK);
  b.add(BOX(), M(0, 1.5, -9.85, 0, 1.9, 0.22, 0.06), GREY_DECK);
  foam(b, 10.6, -10, 2.7);
  return b.build();
}

/** The SFFD fireboat: a red hull, a white cabin and wheelhouse, brass monitors, three arcs of water (toy beads). */
export function buildFireboatGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const id = new THREE.Matrix4();
  b.add(extrudeXZ(FIRE_PLAN, -0.5, 0.95), id, FIRE_RED);
  b.add(extrudeXZ(scalePlan(FIRE_PLAN, 0.95), 0.95, 1.0), id, '#8a2a22');
  b.add(BOX(), M(0, 1.0, -0.6, 0, 1.7, 1.1, 3.4), FIRE_WHITE);
  b.add(BOX(), M(0, 2.1, -0.2, 0, 1.45, 0.75, 1.7), FIRE_WHITE);
  b.add(BOX(), M(0, 2.42, 0.66, 0, 1.3, 0.28, 0.05), DARK);
  b.add(BOX(), M(0, 2.85, -0.2, 0, 1.6, 0.08, 1.9), FIRE_RED);
  b.add(CYL(6), M(0, 2.93, -0.6, 0, 0.07, 1.3, 0.07), MAST);
  // the monitors: one on the bow, two on the cabin roof; each throws an arc of water (beads on a parabola)
  const monitors: [number, number, number, number, number][] = [
    // x, y, z, the arc's direction (yaw: 0 = ahead), how far it climbs
    [0, 1.0, 2.4, 0, 1.15],
    [-0.55, 2.1, -1.6, -1.9, 1.0],
    [0.55, 2.1, -1.6, 1.9, 1.0],
  ];
  for (const [x, y, z, yaw, k] of monitors) {
    b.add(CYL(6), M(x, y, z, 0, 0.16, 0.42, 0.16), BRASS);
    b.add(CONE(6), M(x, y + 0.42, z, 0, 0.1, 0.3, 0.1), BRASS);
    const vx = Math.sin(yaw) * 1.6 * k, vz = Math.cos(yaw) * 1.6 * k, vy = 3.1 * k;
    for (let j = 1; j <= 8; j++) {
      const t = j * 0.26;
      const r = 0.16 + 0.05 * j;
      b.add(ICO(0), M(x + vx * t, y + 0.75 + vy * t - 2.4 * t * t, z + vz * t, j * 0.7, r, r, r), SPRAY);
    }
  }
  foam(b, 3.8, -3.6, 2.3);
  return b.build();
}

/** The ships' material: one instance for both meshes, keyed like TOY_INST (the same program as the city's toys). */
export function makeShipMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  m.name = 'ob-fleet-week-ships';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-inst';
  return m;
}

/** Per grey ship (1 … 6): length / beam scale and height scale — the same model, a little variety along the line. */
export const SHIP_SIZES: readonly (readonly [number, number])[] = [[1.12, 1.04], [0.94, 0.96], [1.0, 1.0], [1.06, 1.02], [0.9, 0.94], [1.02, 0.98]];
const FIRE_SIZE = [1, 1] as const;
/** the tallest point over the waterline (u) at the largest height scale: under the Bay Bridge's toy deck (8.7 u up) */
export const SHIP_TOP = 7.51 * 1.04;

// ---------------------------------------------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------------------------------------------

export const PARADE_DAY_LINE: Bilingual = { zh: '今天上午十一点有舰船巡游，从金门大桥下开进湾里，去码头绿地看吧！', en: 'At 11 this morning the Parade of Ships sails in under the Golden Gate — let’s watch from Marina Green!' };
export const PARADE_NOW_LINE: Bilingual = { zh: '舰船巡游开始啦，船队正沿着海边开向海湾大桥！', en: 'The Parade of Ships is on — the ships are sailing along the shore to the Bay Bridge!' };
export const PARADE_NEAR_LINE: Bilingual = { zh: '看，领头的消防船一边开一边喷水！打开拍照，把船队拍下来吧～', en: 'Look — the fireboat leads the way, spraying water! Open the camera and get the ships in a shot!' };
export const PARADE_PHOTO_LINE: Bilingual = { zh: '船队拍到啦，舰船巡游纪念章收好！', en: 'Got the ships! A Parade of Ships stamp for your journal!' };
/** the Marina Green spot's prompt while the ships sail */
export const PARADE_WATCH: { name: Bilingual; verb: Bilingual } = { name: { zh: '舰船巡游', en: 'The Parade of Ships' }, verb: { zh: '拍舰船巡游', en: 'Photograph the ships' } };
/** (W8-S4) its prompt on the parade's morning, before 11:00 (the waypoint BAYBAY's day line sets reads it): the Fleet Week card */
export const PARADE_SOON: { name: Bilingual; verb: Bilingual } = { name: { zh: '舰船巡游 · 码头绿地', en: 'Parade of Ships · Marina Green' }, verb: { zh: '看看舰船巡游', en: 'See the Parade of Ships' } };
/** (W8-S review, S-P1) its prompt once the line has passed the stand: the waypoint to the next viewing spot along the route */
export const PARADE_FOLLOW: { name: Bilingual; verb: Bilingual } = { name: { zh: '舰船巡游 · 船队开远了', en: 'The Parade of Ships · sailing on' }, verb: { zh: '跟上船队', en: 'Follow the ships' } };

/** a ship this near (u) and in frame counts for the photo; the near line within NEAR_LINE; built within BUILD_NEAR of a ship */
export const PHOTO_NEAR = 420;
export const NEAR_LINE = 260;
export const BUILD_NEAR = 1100;

// ---------------------------------------------------------------------------------------------------------------
// (W8-S review, S-P1 / S-P2) Where the line can be watched: the Marina Green spot's prompt and BAYBAY's waypoint
// ---------------------------------------------------------------------------------------------------------------

/** the Marina Green spot says 拍舰船巡游 while a ship is this near it (u): the photo camera stands ≤ 12 u behind the
 *  player, and the shutter pays for a ship within PHOTO_NEAR of the camera — a margin for the frame's edge */
export const STAND_NEAR = PHOTO_NEAR - 40;
/** a ship this near a viewing spot (u) is a good view of the line; BAYBAY sends a player to a spot the line still passes
 *  for at least VIEW_LEAD (ms) */
export const VIEW_NEAR = 250;
export const VIEW_LEAD = 5 * 60_000;
/** a player within this of a ship hears no "go and watch" line (the ships are in front of them, u) */
export const LINE_FAR = 300;

export interface ViewSpot { id: string; x: number; z: number }
/**
 * The viewing spots in route order: the reviewing stand (the jets' WATCH at Marina Green's seawall), Aquatic Park and
 * the Ferry Building (places.json `aquatic-park-hyde-pier`, `ferry-building`: their waypoint ids resolve through
 * game/discovery.ts). Pier 39 is left out: its own sheds hide the line (W8-S4).
 */
export const VIEW_SPOTS: readonly ViewSpot[] = [
  { id: WATCH.id, x: WATCH.x, z: WATCH.z },
  { id: 'place:aquatic-park-hyde-pier', x: -257.71, z: 115.81 },
  { id: 'place:ferry-building', x: 132.11, z: 19.31 },
];

/** the nearest ship on the water (scale > 0.5) to (x, z) at `ms`, among the first `count` (u; Infinity when none) */
function nearestShipTo(x: number, z: number, ms: number, path: ParadePath, count: number): number {
  let d = Infinity;
  for (let i = 0; i < count; i++) {
    const p = shipPose(i, ms, path, scratchPose);
    if (p && p.scale > 0.5) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
  }
  return d;
}
const scratchPose: ShipPose = { x: 0, z: 0, hx: 0, hz: 1, s: 0, scale: 1 };

const viewEnds = new Map<number, number[]>();
/** per spot, the last instant (ms) a ship of a `count`-ship line is within VIEW_NEAR of it (sampled every 15 s) */
function viewSpotEnds(path: ParadePath, count: number): number[] {
  const hit = viewEnds.get(count);
  if (hit) return hit;
  const w = paradeWindow();
  const ends = VIEW_SPOTS.map(spot => {
    let last = -Infinity;
    for (let ms = paradeEntryMs(path); ms < w.close; ms += 15_000) if (nearestShipTo(spot.x, spot.z, ms, path, count) < VIEW_NEAR) last = ms;
    return last;
  });
  viewEnds.set(count, ends);
  return ends;
}

/** The first viewing spot along the route the line still passes for VIEW_LEAD or more at `ms` (null near the end). */
export function viewSpotAt(ms: number, path: ParadePath = paradePath(), count: number = SHIPS): ViewSpot | null {
  if (ms >= paradeWindow().close) return null;
  const ends = viewSpotEnds(path, count);
  const i = ends.findIndex(end => end - ms >= VIEW_LEAD);
  return i < 0 ? null : VIEW_SPOTS[i];
}

let standArcCache: number | null = null;
/** the arc length (u) of the path's point nearest the reviewing stand */
function standArc(path: ParadePath): number {
  if (standArcCache !== null) return standArcCache;
  let best = Infinity, arc = 0;
  for (let i = 0; i < path.n; i++) {
    const d = Math.hypot(path.pos[i * 2] - WATCH.x, path.pos[i * 2 + 1] - WATCH.z);
    if (d < best) { best = d; arc = i * path.step; }
  }
  standArcCache = arc;
  return arc;
}

/**
 * What the Marina Green spot offers while the ships sail: 'photo' (a ship within STAND_NEAR: 拍舰船巡游 pays), 'coming'
 * (the line is still on its way from the Gate) or 'follow' (it has passed: the waypoint to the next spot along it).
 */
export function standState(ms: number, path: ParadePath = paradePath(), count: number = SHIPS): 'photo' | 'coming' | 'follow' {
  if (nearestShipTo(WATCH.x, WATCH.z, ms, path, count) < STAND_NEAR) return 'photo';
  return shipArc(0, ms, path) < standArc(path) ? 'coming' : 'follow';
}

// ---------------------------------------------------------------------------------------------------------------
// The runtime (from realsf/index.ts, on the parade's Bay day)
// ---------------------------------------------------------------------------------------------------------------

export interface FleetWeek {
  offered(): OfferedLine[];
  said(key: string): void;
  stats(): { on: boolean; built: boolean; ships: number; tris: number; calls: number; lead: { x: number; z: number } | null; nearest: number | null; stand: 'photo' | 'coming' | 'follow' | null };
  /** (W8-S review) the Marina Green spot's prompt now (null: the jets' own) — for QA and the tests */
  prompt(): WatchOverride | null;
  off(): void;
}

export function initFleetWeek(): FleetWeek {
  const path = paradePath();
  const mat = makeShipMaterial();
  const shipGeo = buildShipGeometry(), fireGeo = buildFireboatGeometry();
  const offWarm = registerWarmup('s-fleet-week', () => instancedWarmup(mat, { geometry: shipGeo, receiveShadow: true }));

  const group = new THREE.Group();
  group.name = 'fleet-week-parade';
  let line: THREE.InstancedMesh | null = null;
  let fire: THREE.InstancedMesh | null = null;
  let on = false;
  /** (W8-S4) the Marina Green spot's parade state: 'soon' (the morning), 'on' (sailing) or null */
  let watch: 'soon' | 'on' | null = paradeWatchState();
  let nearest: number | null = null;
  let nearLine = false, photoLine = false, dayLineSaid = false;
  let lineDay = '';
  /** (W8-S review) the Marina Green spot while the ships sail ('photo' / 'coming' / 'follow') and the spot 跟上船队 points to */
  let stand: 'photo' | 'coming' | 'follow' | null = null;
  let followId: string | null = null;
  const poses: (ShipPose | null)[] = [];
  const pose = (): ShipPose => ({ x: 0, z: 0, hx: 0, hz: 1, s: 0, scale: 1 });
  const slots: ShipPose[] = Array.from({ length: SHIPS }, pose);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const lineSphere = new THREE.Sphere(), fireSphere = new THREE.Sphere();
  const box = new THREE.Box3();

  const build = () => {
    line = new THREE.InstancedMesh(shipGeo, mat, SHIPS - 1);
    line.name = 'fleet-week-ships';
    fire = new THREE.InstancedMesh(fireGeo, mat, 1);
    fire.name = 'fleet-week-fireboat';
    for (const m of [line, fire]) {
      m.castShadow = false; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = true;
    }
    line.boundingSphere = lineSphere; fire.boundingSphere = fireSphere;
    group.add(line, fire);
  };
  const drop = () => {
    if (line) { group.remove(line); line.dispose(); line = null; }
    if (fire) { group.remove(fire); fire.dispose(); fire = null; }
  };

  /** every ship's pose now (slot i or null), into `poses` */
  const sample = (ms: number, count: number) => {
    poses.length = count;
    for (let i = 0; i < count; i++) poses[i] = shipPose(i, ms, path, slots[i]);
  };
  const place = () => {
    if (!line || !fire) return;
    const ms = bayNow().getTime(), t = ms / 1000;
    const count = shipCount();
    sample(ms, count);
    let k = 0;
    box.makeEmpty();
    for (let i = 0; i < count; i++) {
      const p = poses[i];
      if (!p || p.scale <= 0) continue;
      // a gentle toy bob and roll, out of step from ship to ship
      e.set(0.008 * Math.sin(t * 0.7 + i * 1.3), Math.atan2(p.hx, p.hz), 0.014 * Math.sin(t * 0.9 + i * 2.1));
      q.setFromEuler(e);
      const size = i === 0 ? FIRE_SIZE : SHIP_SIZES[(i - 1) % SHIP_SIZES.length];
      sc.set(size[0] * p.scale, size[1] * p.scale, size[0] * p.scale);
      v.set(p.x, WATER + 0.05 * Math.sin(t * 1.1 + i), p.z);
      m4.compose(v, q, sc);
      if (i === 0) { fire.setMatrixAt(0, m4); fireSphere.center.set(p.x, 2, p.z); fireSphere.radius = 9; }
      else { line.setMatrixAt(k++, m4); box.expandByPoint(v); }
    }
    fire.count = poses[0] && poses[0].scale > 0 ? 1 : 0;
    line.count = k;
    fire.visible = fire.count > 0;
    line.visible = k > 0;
    if (k) { box.getBoundingSphere(lineSphere); lineSphere.radius += 14; lineSphere.center.y = 3; }
    line.instanceMatrix.needsUpdate = true;
    fire.instanceMatrix.needsUpdate = true;
  };

  let eye: THREE.Camera | null = null;
  const system: WorldSystem = { name: 'fleet-week-parade', group, update: (_dt, _t, camera) => { eye = camera; place(); } };
  let offSystem: (() => void) | null = null;
  const attach = () => { if (!offSystem && cityStreamerLazy()) offSystem = getWorld().addSystem(system); };

  /** the nearest ship on the water (for the photo prompt's aim) */
  const nearestShip = (): ShipPose | null => {
    let best: ShipPose | null = null, d = Infinity;
    for (const p of poses) {
      if (!p || p.scale <= 0) continue;
      const dd = Math.hypot(p.x - runtime.player.x, p.z - runtime.player.z);
      if (dd < d) { d = dd; best = p; }
    }
    return best;
  };
  // (W8-S review, S-P6) the morning's 看看舰船巡游 opens the 今天 tab, where the parade's row gives its 11:00–12:00 and its
  // route (the Fleet Week card it opened names only the week and the air show's hours)
  const info: WatchOverride = { ...PARADE_SOON, action: 'info', act: () => openJournal('today') };
  const photo: WatchOverride = {
    ...PARADE_WATCH,
    act: () => {
      enterPhotoMode(WATCH.id);
      const s = nearestShip();
      if (s) faceCameraToward(s.x + s.hx * 12, s.z + s.hz * 12, { seconds: 0.8, pitch: 0.03 });
    },
  };
  const follow: WatchOverride = {
    ...PARADE_FOLLOW,
    action: 'info',
    act: () => { const spot = viewSpotAt(bayNow().getTime(), path, shipCount()); if (spot) flow.set({ mapTarget: spot.id }); },
  };
  // (W8-S review, S-P1) 拍舰船巡游 only while a ship is near enough to pay; before the line reaches the stand the info,
  // after it has passed 跟上船队 (the waypoint to the next spot along the route) or the info near the end
  const watchPrompt = (): WatchOverride | null => {
    if (watch === 'soon') return info;
    if (watch !== 'on') return null;
    if (stand === 'photo') return photo;
    return stand === 'follow' && followId && followId !== WATCH.id ? follow : info;
  };
  setWatchOverride(watchPrompt);

  const ndc = new THREE.Vector3(), probe = new THREE.Vector3();
  const inFrame = (): boolean => {
    const cam = eye;
    if (!cam || !line) return false;
    return poses.some(p => !!p && p.scale > 0.5 && (probe.set(p.x, WATER + 2.5, p.z), cam.position.distanceTo(probe) < PHOTO_NEAR) && (ndc.copy(probe).project(cam), ndc.z < 1 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1));
  };
  const offShutter = onEvent(ev => {
    // (W8-S review) any ship on the water counts (the line sails in from ≈ 10:54), not only 11:00–12:00
    if (ev.type !== 'shutter' || !inFrame()) return;
    const source = `event:${PARADE_SOUVENIR}`;
    const first = !isPaid(source);
    emit({ type: 'find', kind: 'souvenir', id: PARADE_SOUVENIR, first });
    if (first) { emit({ type: 'reward', source, coins: 15, stamp: source }); photoLine = true; }
  });

  /** the parade's state now (no world access): on, the Marina Green spot, the nearest ship, the fireboat's line */
  const measure = (now: Date) => {
    const day = bayParts(now).dateKey;
    if (day !== lineDay) { lineDay = day; photoLine = false; dayLineSaid = false; }
    on = paradeOn(now);
    const ms = now.getTime();
    const count = shipCount();
    const w = paradeWatchState(now);
    const st = w === 'on' ? standState(ms, path, count) : null;
    const fid = st === 'follow' ? viewSpotAt(ms, path, count)?.id ?? null : null;
    if (w !== watch || st !== stand || fid !== followId) { watch = w; stand = st; followId = fid; invalidateInteractables(); }
    sample(ms, count);
    let d = Infinity;
    for (const p of poses) if (p) d = Math.min(d, Math.hypot(p.x - runtime.player.x, p.z - runtime.player.z));
    nearest = Number.isFinite(d) ? Math.round(d) : null;
    // the near line talks about the fireboat: offered only while the fireboat itself is near (not the tail of the line)
    const fireboat = poses[0];
    nearLine = !!fireboat && fireboat.scale > 0 && Math.hypot(fireboat.x - runtime.player.x, fireboat.z - runtime.player.z) < NEAR_LINE;
    return d;
  };
  let acc = 1;
  const tick = () => {
    attach();
    const d = measure(bayNow());
    // (W8-S review, S-P4) built while any ship is on the water near the player (from the fireboat's entry ≈ 10:54)
    const want = d < BUILD_NEAR && !!offSystem;
    if (want && !line) build();
    if (!want && line) drop();
  };
  // (W8-S review, S-P5) the state from the first frame: realsf/index.ts asks offered() before this module's first tick
  measure(bayNow());
  const offFrame = registerFrameSystem('w8-fleet-week', dt => {
    if ((acc += dt) < 0.5) return;
    acc = 0;
    tick();
  }, 5);

  const triCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  return {
    offered: () => {
      const out: OfferedLine[] = [];
      const now = bayNow();
      if (isParadeDay(now)) {
        const w = paradeWindow(), t = now.getTime();
        const far = Math.hypot(runtime.player.x - WATCH.x, runtime.player.z - WATCH.z) > 300;
        // (W8-S review, S-P2) never "go and watch" while the ships are already in front of the player
        const shipsFar = nearest === null || nearest > LINE_FAR;
        if (far && shipsFar && t >= w.open - 6 * 3600_000 && t < w.open) out.push({ key: 'parade-day', text: PARADE_DAY_LINE });
        else if (shipsFar && on && !dayLineSaid) out.push({ key: 'parade-now', text: PARADE_NOW_LINE });
      }
      if (photoLine) out.push({ key: 'parade-photo', text: PARADE_PHOTO_LINE });
      if (nearLine) out.push({ key: 'parade-near', text: PARADE_NEAR_LINE });
      return out;
    },
    said: key => {
      if (key === 'parade-photo') photoLine = false;
      if (key !== 'parade-day' && key !== 'parade-now') return;
      if (key === 'parade-day') dayLineSaid = true;
      // the waypoint, unless the player is already on the way somewhere: the morning's line to the reviewing stand;
      // (W8-S review, S-P2) during the parade to the first viewing spot along the route the line still passes
      const target = key === 'parade-day' ? WATCH.id : viewSpotAt(bayNow().getTime(), path, shipCount())?.id;
      const f = flow.get(), s = game.get();
      if (target && !f.trip && !f.mapTarget && !s.tour.active && s.mode === 'free') flow.set({ mapTarget: target });
    },
    stats: () => {
      const lead = poses[0];
      return {
        on, built: !!line, ships: (line?.count ?? 0) + (fire?.count ?? 0),
        tris: line && fire ? triCount(shipGeo) * line.count + triCount(fireGeo) * fire.count : 0,
        calls: line && fire ? (line.count ? 1 : 0) + (fire.count ? 1 : 0) : 0,
        lead: lead ? { x: +lead.x.toFixed(1), z: +lead.z.toFixed(1) } : null, nearest, stand,
      };
    },
    prompt: watchPrompt,
    off: () => {
      offFrame(); offShutter();
      setWatchOverride(null);
      drop();
      offSystem?.(); offSystem = null;
      offWarm();
      shipGeo.dispose(); fireGeo.dispose(); mat.dispose();
    },
  };
}
