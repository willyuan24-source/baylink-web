import * as THREE from 'three';
import type { SurfaceKind, Vec2 } from '../../../core/types';
import { Batch, type BatchLike } from '../../builder';
import { cableCarTurntable } from './cable-car-turntable';
import { castroTheatre } from './castro-theatre';
import { chaseCenter } from './chase-center';
import { cityHall } from './city-hall';
import { cliffHouse } from './cliff-house';
import { conservatoryOfFlowers } from './conservatory-of-flowers';
import { deYoungTower } from './de-young-tower';
import { dragonGate } from './dragon-gate';
import { dutchWindmill } from './dutch-windmill';
import { fishermansWharf } from './fishermans-wharf';
import { fortPoint } from './fort-point';
import { ghirardelliSquare } from './ghirardelli-square';
import { goldenGateBridge } from './golden-gate-bridge';
import { graceCathedral } from './grace-cathedral';
import { legionOfHonor } from './legion-of-honor';
import { lombardCrookedStreet } from './lombard-crooked-street';
import { missionDolores } from './mission-dolores';
import { oraclePark } from './oracle-park';
import { paintedLadies } from './painted-ladies';
import { palaceOfFineArts } from './palace-of-fine-arts';
import { peacePagoda } from './peace-pagoda';
import { sutroBaths } from './sutro-baths';
import { sutroTower } from './sutro-tower';
import { twinPeaks } from './twin-peaks';

/**
 * San Francisco landmark registry (lane D). Each record is a procedural toy model authored in LOCAL space plus the
 * placement the streamed city needs. Positions come from opus-qa/sf-data/landmarks.json and OSM footprints
 * (district.ts project(), K = 0.14 u/m); heights follow plan §2.2/§2.3 (H = 3.2 + 0.155·h_m for buildings,
 * terrainY for structures tied to the water such as the Golden Gate Bridge). The info side (names, real info,
 * BAYLINK links, arrival anchors, photo poses) lives in data/sf/landmarks.ts under the same ids.
 *
 * Contract for the city (lane C):
 * - local → world: translate to (x, baseY, z) and rotate by `yaw` about +y (three.js: local +z → (sin yaw, cos yaw)).
 *   `landmarkMatrix()` does exactly that.
 * - baseY: `base` when it is a number; for 'terrain', the lowest city ground inside `exclude`. Walls reach ~1.2 u
 *   below local 0, so a slightly lower real ground never shows a gap.
 * - aInfo.y (TOY window floors / contact AO / lit-opening gradient) is authored local: use `buildLandmark()` (or
 *   add baseY to aInfo.y yourself) so night windows and wall AO line up once the mesh is lifted.
 * - lod 0 = full model (T1 ≤ 6k triangles, the Golden Gate Bridge ≤ 12k, T2 ≤ 2.5k, T3 ≤ 800), lod 2 = far
 *   silhouette (≤ 10 % of lod 0). Both use the TOY material with vertex colours (one draw call each).
 * - animate: an extra mesh (TOY_DYN) parented to the placed landmark; update() sets its local transform.
 * - walk: LOCAL-space collision (blockers) and walkable decks (surfaces) for the terrain provider (lane B). A numeric
 *   surface y is local (world = baseY + y, see landmarkWalkWorld); 'terrain' follows the city ground. Surfaces are
 *   listed most specific first — where two overlap, the first one wins (e.g. the turntable disc over its apron).
 */

export type LandmarkTier = 1 | 2 | 3;
export type LandmarkLod = 0 | 2;
export type WalkBlocker = { x: number; z: number; r: number } | { poly: Vec2[] };
export interface WalkSurface { poly: Vec2[]; y: number | 'terrain'; surface: SurfaceKind }

/**
 * One AI mesh (lane D2, D2-06/07) placed in the landmark's LOCAL frame: `model` is an ASSETS.models id (SF_MODELS /
 * SF_KIT, data/assets.ts), at (x, y, z) with a local yaw and a per-axis scale (the GLB's origin is its ground centre,
 * front +z). Declarative only: world/sf/sites.ts and SoloView load and draw it (world/models.ts, world/modelMaterial.ts).
 */
export interface LandmarkSwapPart {
  model: string;
  x: number; y: number; z: number;
  yaw?: number;
  scale: readonly [number, number, number];
  /** wall tint (mask.g) as an sRGB hex, e.g. a Painted Lady's body colour */
  tint?: string;
  /** night windows lit (mask.r), 0…1 (default 0.55) */
  occupancy?: number;
  /** night glass as one steady colour instead of windows (a greenhouse lit from inside) */
  glass?: { color: string; strength: number };
  /** TOY glow code (world/materials.ts aInfo.w): (0, 1] floodlit at night, like the procedural stone's GLOW() */
  glow?: number;
  castShadow?: boolean;
}

/**
 * The AI version of a landmark (lane D2's decision gate in SoloView `?solo=<id>&ai=0|1`): the AI parts plus the
 * procedural remainder they sit in. `ship` = the city uses it (the walk data is then authored to the AI layout, and the
 * full procedural model is only the fallback while the GLB loads or when it fails).
 */
export interface LandmarkSwap {
  parts: LandmarkSwapPart[];
  /** lod-0 procedural remainder drawn with the AI parts (everything they do not replace) */
  build(b: BatchLike): void;
  ship: boolean;
  /** why the gate went this way (QA note, shown in SoloView) */
  note?: string;
}

/**
 * Whole-landmark hero fade (TOY OB_HERO): it thins as one while it stands between the camera and the player instead of
 * getting occlusion dither holes. `r` = radius around the origin (local), `y1` = top (local y); `procedural: false` =
 * only the AI parts fade (a large landmark whose procedural wings keep the per-fragment dither).
 */
export interface LandmarkFade { r: number; y1: number; procedural?: boolean }

/** Street / plaza ground drawn by the landmark with the city GROUND material (local polygon at local height y). */
export interface LandmarkGround { poly: Vec2[]; y: number; color: string; pattern: number }

export interface SfLandmark {
  id: string;                       // kebab-case, e.g. 'golden-gate-bridge'
  tier: 1 | 2 | 3;
  x: number; z: number;             // world position (from C:/Users/willy/opus-qa/sf-data/landmarks.json)
  yaw: number;                      // radians, three.js convention (faces (sin yaw, cos yaw))
  base: 'terrain' | number;         // 'terrain' = stand on the city ground (lowest point under the footprint), or explicit world y
  exclude: { r: number } | { poly: Vec2[] };   // generated city buildings inside are dropped (poly in world coords)
  build(b: BatchLike, lod: 0 | 2): void;       // LOCAL space: origin at ground centre, +y up, front faces +z; lod 2 = silhouette version ≤ 10 % triangles for far view
  castShadow?: boolean;             // T1 only
  animate?: { update(obj: THREE.Object3D, t: number): void; build(b: BatchLike): void };  // optional separately-built moving parts (windmill sails, flags)
  walk?: { blockers: ({ x: number; z: number; r: number } | { poly: Vec2[] })[]; surfaces?: { poly: Vec2[]; y: number | 'terrain'; surface: SurfaceKind }[] };  // LOCAL-space collision + walkable decks for lane B
  swap?: LandmarkSwap;              // lane D2: AI mesh version (see LandmarkSwap)
  fade?: LandmarkFade;              // lane D2: whole-mesh hero fade radius (local, around the origin) and top (local y)
  ground?: LandmarkGround[];        // lane D2: street strips / plazas in GROUND (lod 0)
}

/** Does the city draw landmark `l` with its AI parts (`swap.ship`), unless `ai` overrides it (SoloView ?ai=0|1)? */
export const usesAi = (l: SfLandmark, ai?: boolean | null) => !!l.swap && (ai ?? l.swap.ship);

/** Triangle budgets per tier (plan §7); the Golden Gate Bridge has its own. */
export const TIER_TRIANGLES: Record<LandmarkTier, number> = { 1: 6000, 2: 2500, 3: 800 };
export const BUDGET_OVERRIDE: Record<string, number> = { 'golden-gate-bridge': 12000 };
export const triangleBudget = (l: SfLandmark) => BUDGET_OVERRIDE[l.id] ?? TIER_TRIANGLES[l.tier];

export const SF_LANDMARKS: SfLandmark[] = [
  // ---- T1: read from several districts
  goldenGateBridge,
  sutroTower,
  cityHall,
  deYoungTower,
  palaceOfFineArts,
  twinPeaks,
  // ---- T2: neighbourhood anchors
  paintedLadies,
  dragonGate,
  conservatoryOfFlowers,
  dutchWindmill,
  missionDolores,
  graceCathedral,
  legionOfHonor,
  fortPoint,
  castroTheatre,
  oraclePark,
  peacePagoda,
  ghirardelliSquare,
  fishermansWharf,
  sutroBaths,
  cliffHouse,
  cableCarTurntable,
  lombardCrookedStreet,
  // ---- T3: flavour
  chaseCenter,
];

const byId = new Map(SF_LANDMARKS.map(l => [l.id, l]));
export function sfLandmark(id: string): SfLandmark | undefined { return byId.get(id); }

/** Local → world placement matrix. */
export function landmarkMatrix(l: SfLandmark, baseY: number): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(l.x, baseY, l.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.yaw), new THREE.Vector3(1, 1, 1));
}

/** Local (x, z) → world (x, z). */
export function landmarkToWorld(l: SfLandmark, p: Vec2): Vec2 {
  const c = Math.cos(l.yaw), s = Math.sin(l.yaw);
  return { x: l.x + p.x * c + p.z * s, z: l.z - p.x * s + p.z * c };
}

/** World (x, z) → local (x, z). */
export function worldToLandmark(l: SfLandmark, p: Vec2): Vec2 {
  const dx = p.x - l.x, dz = p.z - l.z, c = Math.cos(l.yaw), s = Math.sin(l.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** Shift aInfo.y (TOY base height) of a local batch by the placed base height. */
function liftInfo(b: Batch, baseY: number) {
  if (!baseY) return;
  for (let i = 1; i < b.inf.length; i += 4) b.inf[i] += baseY;
}

/**
 * Build one landmark as a LOCAL-space geometry (place it with `landmarkMatrix`, or mesh.position/rotation.y).
 * aInfo.y is already shifted by baseY, so windows and contact AO match the ground it stands on.
 */
export function buildLandmark(l: SfLandmark, lod: LandmarkLod, baseY = typeof l.base === 'number' ? l.base : 0): THREE.BufferGeometry {
  const b = new Batch();
  l.build(b, lod);
  liftInfo(b, baseY);
  return b.build();
}

/** The moving part (if any), local to the landmark, aInfo.y shifted like buildLandmark. */
export function buildLandmarkAnimated(l: SfLandmark, baseY = typeof l.base === 'number' ? l.base : 0): THREE.BufferGeometry | null {
  if (!l.animate) return null;
  const b = new Batch();
  l.animate.build(b);
  liftInfo(b, baseY);
  return b.build();
}

/** Same as buildLandmark but baked to world space (for merging into a static city batch). */
export function buildLandmarkWorld(l: SfLandmark, lod: LandmarkLod, baseY: number): THREE.BufferGeometry {
  return buildLandmark(l, lod, baseY).applyMatrix4(landmarkMatrix(l, baseY));
}

/** Blockers and walkable surfaces in WORLD space (base 'terrain' surfaces keep 'terrain'; numeric y gets baseY added). */
export function landmarkWalkWorld(l: SfLandmark, baseY: number) {
  const w = l.walk;
  if (!w) return { blockers: [] as WalkBlocker[], surfaces: [] as WalkSurface[] };
  const P = (p: Vec2) => landmarkToWorld(l, p);
  return {
    blockers: w.blockers.map((bl): WalkBlocker => ('poly' in bl ? { poly: bl.poly.map(P) } : { ...P(bl), r: bl.r })),
    surfaces: (w.surfaces ?? []).map((s): WalkSurface => ({ poly: s.poly.map(P), y: s.y === 'terrain' ? 'terrain' : s.y + baseY, surface: s.surface })),
  };
}
