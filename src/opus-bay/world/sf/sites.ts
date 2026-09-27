import * as THREE from 'three';
import type { LandmarkWalkInput } from '../../core/sfTerrain';
import type { SurfaceKind, Vec2 } from '../../core/types';
import { C } from '../builder';
import { GROUND, GROUND_CITY, TOY, TOY_DYN, U, makeHeroMaterial } from '../materials';
import { type ModelMaterial, makeModelMaterial, modelInstanceGeometry, setModelInstance } from '../modelMaterial';
import type { LoadedModel } from '../models';
import { TypedBatch } from '../typedBatch';
import type { Exclude } from './build';
import { type LandmarkFade, type LandmarkSwapPart, SF_LANDMARKS, type SfLandmark, landmarkMatrix, usesAi } from './landmarks';
import { CityBatch, type PoolArrays } from './mesh';
import type { CellPool } from './pools';

/**
 * The San Francisco landmarks (lane D's registry, world/sf/landmarks) placed in the streamed city:
 *
 *   base    a number, or 'terrain' = the lowest city ground inside the exclusion: first estimated from the far
 *           16 u DEM, then refined when the landmark's chunk arrives (buildL1 bases)
 *   lod 0   the full model as its own mesh (TOY; T1 cast shadows near the player), within 520 / 340 / 220 u of the
 *           focus for tiers 1 / 2 / 3; animated parts (windmill sails, lane D's buildLandmarkAnimated part) ride on it
 *           and move within 150 u
 *   lod 2   the far silhouette as an item of the far pool (one draw call for all of them), shown otherwise
 *
 * Exclusions go to the stream workers (city buildings inside are dropped) and the walk data to lane B's rasters.
 *
 * Lane D2 (wave 2, checkpoint D2-05):
 *   AI swaps   a landmark whose `swap.ship` is set draws its lod 0 as the procedural remainder (`swap.build`) plus the
 *              AI parts (world/models.ts GLBs with world/modelMaterial.ts). The GLBs start loading PRELOAD u before the
 *              lod-0 ring; until they are decoded (or if they fail) the full procedural model stands in, and the site
 *              is rebuilt once they arrive (still at most one lod-0 build per frame). The loader module (DRACOLoader)
 *              is imported lazily, so district mode never loads it; the Draco decoder is preloaded when the far city
 *              attaches. Models are retained while mounted and released (LRU-cached) when the lod 0 is dropped.
 *   hero fade  a landmark with `fade` thins as a whole (TOY OB_HERO, one uniform per landmark, the same program as the
 *              district's heroes) while it stands between the camera and the player, instead of getting occlusion
 *              dither holes (the Dragon Gate, the rotunda). `fade.procedural === false` fades only the AI parts.
 *   ground     `ground` polygons (street strips, plazas) are drawn with the city GROUND material inside the lod 0.
 *   counts     counts().ai: AI parts drawn, pending, failed, their triangles and draw calls.
 */

/** GLB loads start this much before a landmark's lod-0 ring (u). */
const PRELOAD = 150;
/** hero fade strength (world.ts HERO_FADE: the district heroes thin the same way) */
const HERO_FADE = 0.35;

type ModelsModule = typeof import('../models');
let modelsMod: ModelsModule | null = null;
let modelsP: Promise<ModelsModule> | null = null;
/** world/models.ts, imported on first use (keeps DRACOLoader out of district mode). */
function modelsModule(): Promise<ModelsModule> {
  return (modelsP ??= import('../models').then(m => (modelsMod = m)));
}

/**
 * Day-0 contract (wave 2): optional per-landmark hooks, read structurally from the registry records (lane D2 types its
 * records as `SfLandmark & SiteHooks` in world/sf/landmarks/**; this file is D2's from wave 2 and keeps the CitySites API
 * that world/sf/stream.ts calls). Local space = the landmark's (origin at the ground centre, front +z); y is above baseY.
 *
 *   lights   night light points (lane C2's world/sf/lights.ts light field reads them through CitySites.siteLights())
 *   mount    called when the lod-0 mesh is built: add extra objects to its group (GLB swaps, dressing); return an
 *            unmount function (called when the lod-0 mesh is dropped)
 *   plaza    walkable plaza polygons around the landmark (lane D2's dressing; lane F's crowd reads plazaSpots)
 */
export interface SiteHooks {
  lights?: { x: number; y: number; z: number; size: number; color: string }[];
  mount?(group: THREE.Group, baseY: number): void | (() => void);
  plaza?: { poly: Vec2[]; surface: SurfaceKind }[];
}

/** lod-0 radius per tier (lane D: inside the L1 ring; tier 1 a little beyond it, they read from several districts) */
const LOD0: Record<1 | 2 | 3, number> = { 1: 520, 2: 340, 3: 220 };
const HYST = 40;
/** animated parts move only this close to the focus */
const ANIM_R = 150;
export const SITE_ID0 = 9_000_000;
/**
 * The city ground sinks this much inside a landmark's footprint (lane D 7.6: Lombard's lane, Ghirardelli's terraces
 * and the Painted Ladies' stoops follow the same DEM grade as the city ground, and must stay on top of it). Not under
 * the Golden Gate Bridge: its deck meets the ground at the south end (ground 15.0 u vs deck 15.2 u, measured).
 */
const SINK = 0.2;
const NO_SINK = new Set(['golden-gate-bridge']);

interface Site {
  l: SfLandmark;
  i: number;
  baseY: number;
  refined: boolean;
  mesh: THREE.Group | null;
  anim: THREE.Mesh | null;
  near: boolean;
  lod2: boolean;
  tris: number;
  /** SiteHooks.mount's unmount */
  unmount: (() => void) | null;
  /** the landmark's hero fade uniform (null without `fade`); its TOY hero material while the lod 0 is built */
  fade: { value: number } | null;
  heroMat: THREE.Material | null;
  /** lod 0 currently drawn with the AI parts; AI triangles / draw calls in it */
  ai: boolean;
  aiTris: number;
  aiDraws: number;
  /** models retained by the mounted lod 0 */
  retained: string[] | null;
  /** GLB loads requested (preload ring) */
  requested: boolean;
  /** the AI models arrived after a procedural fallback build: rebuild the lod 0 */
  rebuild: boolean;
}

/** Group the AI parts by model (one InstancedMesh per model with several parts, else a plain Mesh). */
function partsByModel(parts: readonly LandmarkSwapPart[]): Map<string, LandmarkSwapPart[]> {
  const out = new Map<string, LandmarkSwapPart[]>();
  for (const p of parts) out.set(p.model, [...(out.get(p.model) ?? []), p]);
  return out;
}

/** Model geometry with a per-axis scale baked in (normals through the normal matrix: TOY's vWN stays right). */
function scaledGeometry(g: THREE.BufferGeometry, s: readonly [number, number, number]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) { const a = g.getAttribute(name); if (a) out.setAttribute(name, a.clone()); }
  out.setIndex(g.getIndex()?.clone() ?? null);
  out.applyMatrix4(new THREE.Matrix4().makeScale(s[0], s[1], s[2]));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/**
 * The AI parts of a landmark as objects in its local frame (shared by sites.ts and SoloView). One plain Mesh
 * ('ob-model-hero', sharing `fade`) per single part, one InstancedMesh ('ob-model-inst', tint and occupancy per
 * instance) per model with several parts. Geometry and materials are the caller's to dispose (disposeSwapObjects).
 */
export function buildSwapObjects(parts: readonly LandmarkSwapPart[], models: ReadonlyMap<string, LoadedModel>, fade: { value: number } | null, name: string): { objects: THREE.Mesh[]; triangles: number } {
  const objects: THREE.Mesh[] = [];
  let triangles = 0;
  for (const [id, group] of partsByModel(parts)) {
    const model = models.get(id);
    if (!model) continue;
    const s = group[0].scale;
    const geo = scaledGeometry(model.geometry, s);
    const tintKey = (model.asset as { tintKey?: string | null }).tintKey ?? null;
    if (group.length === 1) {
      const p = group[0];
      const mat = makeModelMaterial({
        map: model.map, mask: model.mask, variant: 'ob-model-hero', fade: fade ?? { value: 0 }, tintKey,
        tint: p.tint ? [...C(p.tint).toArray(), 1] as [number, number, number, number] : undefined,
        inst: [p.occupancy ?? 0.55, 1, 0, p.glow ?? 0], glass: p.glass, name: `ob-model:${name}:${id}`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = p.yaw ?? 0;
      m.castShadow = !!p.castShadow;
      m.receiveShadow = true;
      m.name = `${name}:ai:${id}`;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      objects.push(m);
    } else {
      const ig = modelInstanceGeometry(geo, group.length);
      const mat = makeModelMaterial({ map: model.map, mask: model.mask, variant: 'ob-model-inst', tintKey, name: `ob-model:${name}:${id}` });
      const m = new THREE.InstancedMesh(ig, mat, group.length);
      const o = new THREE.Object3D();
      group.forEach((p, i) => {
        o.position.set(p.x, p.y, p.z);
        o.rotation.set(0, p.yaw ?? 0, 0);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        setModelInstance(ig, i, p.tint ?? null, p.tint ? 1 : 0, p.occupancy ?? 0.55, 1, 0.1 + 0.8 * ((i * 0.618) % 1), p.glow ?? 0);
      });
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.castShadow = group.some(p => p.castShadow);
      m.receiveShadow = true;
      m.name = `${name}:ai:${id}`;
      m.userData.obShared = geo;
      objects.push(m);
    }
    triangles += model.triangles * group.length;
  }
  return { objects, triangles };
}

/** Dispose what buildSwapObjects made (not the cached model's own geometry / textures). */
export function disposeSwapObjects(objects: readonly THREE.Object3D[]) {
  for (const o of objects) {
    const m = o as THREE.Mesh;
    if (!m.isMesh) continue;
    m.geometry.dispose();
    (m.userData.obShared as THREE.BufferGeometry | undefined)?.dispose();
    (m.material as ModelMaterial).dispose();
    if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
  }
}

/**
 * Does the landmark stand between the camera and the player? The camera → player segment, stopped 0.6 u short of the
 * player (a landmark behind the player never fades), is clipped against the fade footprint in the landmark's local
 * frame (`box` half extents, else the circle `r`) and the height band baseY − 1 … baseY + y1 over that stretch.
 */
export function fadeOccludes(l: SfLandmark, cfg: LandmarkFade, baseY: number, cam: THREE.Vector3, player: THREE.Vector3): boolean {
  const cs = Math.cos(l.yaw), sn = Math.sin(l.yaw);
  const ax = (cam.x - l.x) * cs - (cam.z - l.z) * sn, az = (cam.x - l.x) * sn + (cam.z - l.z) * cs;
  const bx = (player.x - l.x) * cs - (player.z - l.z) * sn, bz = (player.x - l.x) * sn + (player.z - l.z) * cs;
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
  if (L < 0.8) return false;
  let t0 = 0, t1 = 1 - 0.6 / L;
  if (cfg.box) {
    // slab clip against |x| <= hx, |z| <= hz
    for (const [o, d, h] of [[ax, dx, cfg.box[0]], [az, dz, cfg.box[1]]] as const) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(o) > h) return false; continue; }
      const u = (-h - o) / d, v = (h - o) / d;
      t0 = Math.max(t0, Math.min(u, v));
      t1 = Math.min(t1, Math.max(u, v));
    }
  } else {
    // |a + t d| = r
    const A = dx * dx + dz * dz, B = 2 * (ax * dx + az * dz), C = ax * ax + az * az - cfg.r * cfg.r, D = B * B - 4 * A * C;
    if (D < 0) return false;
    const q = Math.sqrt(D);
    t0 = Math.max(t0, (-B - q) / (2 * A));
    t1 = Math.min(t1, (-B + q) / (2 * A));
  }
  if (t0 >= t1) return false;
  const y = (t: number) => cam.y + (player.y + 0.2 - cam.y) * t;
  const ya = y(t0), yb = y(t1);
  return Math.min(ya, yb) < baseY + cfg.y1 && Math.max(ya, yb) > baseY - 1;
}

/** A landmark's `ground` polygons as one GROUND mesh (city-flagged: the L0 ground program), local frame. */
export function buildGroundMesh(l: SfLandmark): THREE.Mesh | null {
  if (!l.ground?.length) return null;
  const b = new TypedBatch(256);
  for (const g of l.ground) b.polygon(g.poly, g.y, C(g.color), [g.pattern, l.yaw, 0, GROUND_CITY]);
  const m = new THREE.Mesh(TypedBatch.toGeometry(b.toArrays()), GROUND);
  m.name = `sf:${l.id}:ground`;
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  return m;
}

/** Local batch → world-space pool arrays (identity instance matrix), aInfo.y lifted by the base. */
function toWorld(a: PoolArrays, m: THREE.Matrix4, baseY: number): PoolArrays {
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
  const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < a.vertexCount; i++) {
    v.fromArray(a.position, i * 3).applyMatrix4(m);
    v.toArray(a.position, i * 3);
    n.set(a.normal[i * 4] / 127, a.normal[i * 4 + 1] / 127, a.normal[i * 4 + 2] / 127).applyMatrix3(nm).normalize();
    a.normal[i * 4] = Math.round(n.x * 127); a.normal[i * 4 + 1] = Math.round(n.y * 127); a.normal[i * 4 + 2] = Math.round(n.z * 127);
    a.info[i * 4 + 1] += baseY;
    for (let k = 0; k < 3; k++) { const c = a.position[i * 3 + k]; if (c < box[k]) box[k] = c; if (c > box[k + 3]) box[k + 3] = c; }
  }
  a.bounds = box;
  return a;
}


export class CitySites {
  readonly group = new THREE.Group();
  private sites: Site[];
  private pool: CellPool | null = null;
  triangles = 0;

  constructor() {
    this.group.name = 'city-landmarks';
    this.sites = SF_LANDMARKS.map((l, i) => ({
      l, i, baseY: typeof l.base === 'number' ? l.base : 0, refined: typeof l.base === 'number', mesh: null, anim: null, near: false, lod2: false, tris: 0, unmount: null,
      fade: l.fade ? { value: 0 } : null, heroMat: null, ai: false, aiTris: 0, aiDraws: 0, retained: null, requested: false, rebuild: false,
    }));
  }

  /** false: every landmark stays procedural (QA A/B: `?ai=0` in the URL; the default follows each swap's `ship`). */
  aiEnabled = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('ai') === '0');
  private aiFailed = new Set<string>();

  /** Exclusion shapes for the stream workers (city buildings / props inside are dropped). */
  excludes(): Exclude[] {
    return this.sites.map(({ l }) => {
      const e = l.exclude, sink = NO_SINK.has(l.id) ? 0 : SINK;
      if ('r' in e) return { id: l.id, x: l.x, z: l.z, r: e.r, base: l.base, sink };
      let r = 0;
      for (const p of e.poly) r = Math.max(r, Math.hypot(p.x - l.x, p.z - l.z));
      return { id: l.id, x: l.x, z: l.z, poly: e.poly.map(p => ({ x: p.x, z: p.z })), r, base: l.base, sink };
    });
  }

  /** Walk data for lane B's rasteriser (plain data, structured-cloneable), with the same exclusion the renderer uses. */
  walkInputs(): LandmarkWalkInput[] {
    return this.sites.map(s => {
      const e = s.l.exclude;
      return {
        id: s.l.id, x: s.l.x, z: s.l.z, yaw: s.l.yaw, base: s.l.base, baseY: s.baseY,
        exclude: 'r' in e ? { r: e.r } : { poly: e.poly.map(p => ({ x: p.x, z: p.z })) },
        // collision follows the drawn ground's sink inside the exclusion (lane B's LandmarkWalkInput.sink)
        sink: NO_SINK.has(s.l.id) ? 0 : SINK,
        walk: s.l.walk ? JSON.parse(JSON.stringify(s.l.walk)) : undefined,
      };
    });
  }

  /** A 'terrain' landmark's base changed (far estimate, then its chunk): lane B pins its decks to it (setLandmarkBase). */
  onBase: ((id: string, y: number) => void) | null = null;

  /** Far pool ready: estimate 'terrain' bases from the far DEM, add every lod-2 silhouette. */
  attach(pool: CellPool, farGround: (x: number, z: number) => number) {
    this.pool = pool;
    if (this.aiEnabled && this.sites.some(s => usesAi(s.l))) void modelsModule().then(m => m.preloadDraco(), () => undefined);
    for (const s of this.sites) {
      if (!s.refined) {
        const e = s.l.exclude, r = 'r' in e ? e.r : Math.max(...e.poly.map(p => Math.hypot(p.x - s.l.x, p.z - s.l.z)));
        let lo = Infinity;
        for (let dz = -r; dz <= r; dz += 4) for (let dx = -r; dx <= r; dx += 4) if (dx * dx + dz * dz <= r * r) lo = Math.min(lo, farGround(s.l.x + dx, s.l.z + dz));
        s.baseY = Number.isFinite(lo) ? lo : 0;
        this.onBase?.(s.l.id, s.baseY);
      }
      this.addLod2(s);
    }
  }

  private addLod2(s: Site) {
    if (!this.pool) return;
    const b = new CityBatch(1024);
    s.l.build(b, 2);
    const a = b.toPool();
    if (!a) return;
    this.pool.add(SITE_ID0 + s.i, { toy: toWorld(a, landmarkMatrix(s.l, s.baseY), s.baseY), ground: null }, true, !s.near);
    s.lod2 = true;
  }

  /** A chunk measured the ground under a 'terrain' landmark. */
  setBase(id: string, y: number) {
    const s = this.sites.find(q => q.l.id === id);
    if (!s || s.refined) return;
    s.refined = true;
    if (Math.abs(s.baseY - y) < 0.05) return;
    s.baseY = y;
    this.onBase?.(id, y);
    this.addLod2(s);
    if (s.mesh) { this.dropMesh(s); }
  }

  /** The AI parts' models when every one is decoded (null: not all ready yet, or no swap / AI off / failed). */
  private readyModels(s: Site): Map<string, LoadedModel> | null {
    if (!this.aiEnabled || !usesAi(s.l) || this.aiFailed.has(s.l.id) || !modelsMod) return null;
    const out = new Map<string, LoadedModel>();
    for (const p of s.l.swap!.parts) {
      const m = modelsMod.peekModel(p.model);
      if (!m) return null;
      out.set(p.model, m);
    }
    return out;
  }

  /** Start the GLB loads of an AI landmark (once); a failure keeps it procedural for this session. */
  private requestModels(s: Site) {
    if (s.requested || !this.aiEnabled || !usesAi(s.l)) return;
    s.requested = true;
    const ids = [...new Set(s.l.swap!.parts.map(p => p.model))];
    void modelsModule().then(m => Promise.all(ids.map(id => m.loadModel(id)))).then(list => {
      if (list.some(x => !x)) { this.aiFailed.add(s.l.id); return; }
      // decoded after a procedural fallback build: swap it in (update() rebuilds, one lod-0 build per frame)
      if (s.mesh && !s.ai) s.rebuild = true;
    }, () => { this.aiFailed.add(s.l.id); });
  }

  private buildMesh(s: Site) {
    const g = new THREE.Group();
    g.name = `sf:${s.l.id}`;
    const models = this.readyModels(s);
    const b = new TypedBatch(8192);
    if (models) s.l.swap!.build(b);
    else s.l.build(b, 0);
    const a = b.toArrays();
    for (let i = 0; i < a.vertexCount; i++) a.info[i * 4 + 1] += s.baseY;
    // the landmark's own hero material when it fades as a whole (one per landmark, the shared 'ob-toy-hero' program)
    if (s.l.fade && s.l.fade.procedural !== false) {
      const hero = makeHeroMaterial(`sf:${s.l.id}`);
      s.heroMat = hero.material;
      s.fade = hero.fade;
    }
    const m = new THREE.Mesh(TypedBatch.toGeometry(a), s.heroMat ?? TOY);
    m.name = `sf:${s.l.id}:lod0`;
    m.castShadow = !!s.l.castShadow;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    g.add(m);
    s.tris = a.indexCount / 3;
    if (s.l.animate) {
      const ab = new TypedBatch(1024);
      s.l.animate.build(ab);
      const aa = ab.toArrays();
      for (let i = 0; i < aa.vertexCount; i++) aa.info[i * 4 + 1] += s.baseY;
      s.anim = new THREE.Mesh(TypedBatch.toGeometry(aa), TOY_DYN);
      s.anim.name = `sf:${s.l.id}:anim`;
      s.anim.receiveShadow = true;
      g.add(s.anim);
    }
    const ground = buildGroundMesh(s.l);
    if (ground) { g.add(ground); s.tris += (ground.geometry.getIndex()?.count ?? 0) / 3; }
    s.ai = false;
    s.aiTris = 0;
    s.aiDraws = 0;
    if (models) {
      const swap = buildSwapObjects(s.l.swap!.parts, models, s.fade, `sf:${s.l.id}`);
      for (const o of swap.objects) { g.add(o); s.aiDraws += o.castShadow ? 2 : 1; }
      s.ai = true;
      s.aiTris = swap.triangles;
      s.tris += swap.triangles;
    }
    // hold the models while mounted (LRU-cached after the drop); an AI landmark not decoded yet starts loading here
    if (usesAi(s.l) && this.aiEnabled && !s.retained && modelsMod) {
      s.retained = [...new Set(s.l.swap!.parts.map(p => p.model))];
      for (const id of s.retained) void modelsMod.retainModel(id);
    }
    this.requestModels(s);
    this.triangles += s.tris;
    g.matrixAutoUpdate = false;
    g.matrix.copy(landmarkMatrix(s.l, s.baseY));
    // SiteHooks.mount (GLB swaps, dressing): extra objects in the landmark's local frame
    const hooks = s.l as SfLandmark & SiteHooks;
    if (hooks.mount) { const off = hooks.mount(g, s.baseY); s.unmount = typeof off === 'function' ? off : null; }
    this.group.add(g);
    g.updateMatrixWorld(true);
    s.mesh = g;
  }

  /** Drop the lod 0 (`rebuild`: it is rebuilt right away, so the far silhouette stays hidden and the models held). */
  private dropMesh(s: Site, rebuild = false) {
    if (!s.mesh) return;
    s.unmount?.();
    s.unmount = null;
    this.group.remove(s.mesh);
    const ai: THREE.Object3D[] = [];
    s.mesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.name.includes(':ai:')) ai.push(m);
      else m.geometry.dispose();
    });
    disposeSwapObjects(ai);
    s.heroMat?.dispose();
    s.heroMat = null;
    if (s.fade) s.fade.value = 0;
    this.triangles -= s.tris;
    s.tris = 0;
    s.mesh = null;
    s.anim = null;
    s.ai = false;
    s.aiTris = 0;
    s.aiDraws = 0;
    s.rebuild = false;
    if (rebuild) return;
    if (s.retained && modelsMod) for (const id of s.retained) modelsMod.releaseModel(id);
    s.retained = null;
    s.near = false;
    this.pool?.setVisible(SITE_ID0 + s.i, true);
  }

  /** Whole-landmark fades (world.ts updateHeroFades, per city landmark): see fadeOccludes. */
  private updateFade(s: Site, dt: number) {
    const f = s.fade, cfg = s.l.fade;
    if (!f || !cfg) return;
    const on = U.uFade.value > 0.5 && fadeOccludes(s.l, cfg, s.baseY, U.uCam.value, U.uPlayer.value);
    f.value += ((on ? HERO_FADE : 0) - f.value) * (1 - Math.exp(-dt * 8));
    if (f.value < 0.002) f.value = 0;
  }

  private lastT = 0;

  /** At most one lod-0 build per frame (they cost 2–12k triangles to write). */
  update(fx: number, fz: number, t: number) {
    let built = false;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    for (const s of this.sites) {
      const d = Math.hypot(s.l.x - fx, s.l.z - fz), r = LOD0[s.l.tier];
      const near = s.near ? d < r + HYST : d < r;
      if (!s.requested && s.l.swap && d < r + PRELOAD) this.requestModels(s);
      if (near && !s.mesh && !built && (s.refined || this.pool)) { this.buildMesh(s); built = true; }
      if (near && s.mesh && s.rebuild && !built) { this.dropMesh(s, true); this.buildMesh(s); built = true; }
      if (near && s.mesh && !s.near) { s.near = true; this.pool?.setVisible(SITE_ID0 + s.i, false); }
      if (!near && s.mesh) this.dropMesh(s);
      if (s.mesh && s.fade) this.updateFade(s, dt);
      if (s.anim && s.l.animate && s.near && d < ANIM_R) {
        s.l.animate.update(s.anim, t);
        s.anim.updateMatrix();
        s.anim.updateMatrixWorld(true);
      }
    }
  }

  /** Every landmark's SiteHooks.lights in world space (lane C2's night light field; call after the bases settle). */
  siteLights(): { x: number; y: number; z: number; size: number; color: string }[] {
    const out: { x: number; y: number; z: number; size: number; color: string }[] = [];
    for (const s of this.sites) {
      const lights = (s.l as SfLandmark & SiteHooks).lights;
      if (!lights?.length) continue;
      const c = Math.cos(s.l.yaw), sn = Math.sin(s.l.yaw);
      for (const p of lights) out.push({ x: s.l.x + p.x * c + p.z * sn, y: s.baseY + p.y, z: s.l.z - p.x * sn + p.z * c, size: p.size, color: p.color });
    }
    return out;
  }

  counts() {
    let near = 0;
    const ai = { on: 0, pending: 0, failed: this.aiFailed.size, triangles: 0, draws: 0 };
    for (const s of this.sites) {
      if (s.near) near++;
      if (s.ai) { ai.on++; ai.triangles += s.aiTris; ai.draws += s.aiDraws; } else if (s.mesh && usesAi(s.l) && this.aiEnabled && !this.aiFailed.has(s.l.id)) ai.pending++;
    }
    return { sites: this.sites.length, near, triangles: this.triangles, ai };
  }

  /** City teardown (World.disableCity): drop every lod 0, then the decoded models and the Draco workers. */
  dispose() {
    for (const s of this.sites) this.dropMesh(s);
    modelsMod?.disposeModels();
  }
}
