import * as THREE from 'three';
import type { LandmarkWalkInput } from '../../core/sfTerrain';
import type { SurfaceKind, Vec2 } from '../../core/types';
import { TOY, TOY_DYN } from '../materials';
import { TypedBatch } from '../typedBatch';
import type { Exclude } from './build';
import { SF_LANDMARKS, type SfLandmark, landmarkMatrix } from './landmarks';
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
 */

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
    this.sites = SF_LANDMARKS.map((l, i) => ({ l, i, baseY: typeof l.base === 'number' ? l.base : 0, refined: typeof l.base === 'number', mesh: null, anim: null, near: false, lod2: false, tris: 0, unmount: null }));
  }

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

  private buildMesh(s: Site) {
    const g = new THREE.Group();
    g.name = `sf:${s.l.id}`;
    const b = new TypedBatch(8192);
    s.l.build(b, 0);
    const a = b.toArrays();
    for (let i = 0; i < a.vertexCount; i++) a.info[i * 4 + 1] += s.baseY;
    const m = new THREE.Mesh(TypedBatch.toGeometry(a), TOY);
    m.name = `sf:${s.l.id}:lod0`;
    m.castShadow = !!s.l.castShadow;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    g.add(m);
    s.tris = a.indexCount / 3;
    this.triangles += s.tris;
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
    g.matrixAutoUpdate = false;
    g.matrix.copy(landmarkMatrix(s.l, s.baseY));
    // SiteHooks.mount (GLB swaps, dressing): extra objects in the landmark's local frame
    const hooks = s.l as SfLandmark & SiteHooks;
    if (hooks.mount) { const off = hooks.mount(g, s.baseY); s.unmount = typeof off === 'function' ? off : null; }
    this.group.add(g);
    g.updateMatrixWorld(true);
    s.mesh = g;
  }

  private dropMesh(s: Site) {
    if (!s.mesh) return;
    s.unmount?.();
    s.unmount = null;
    this.group.remove(s.mesh);
    s.mesh.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.triangles -= s.tris;
    s.tris = 0;
    s.mesh = null;
    s.anim = null;
    s.near = false;
    this.pool?.setVisible(SITE_ID0 + s.i, true);
  }

  /** At most one lod-0 build per frame (they cost 2–12k triangles to write). */
  update(fx: number, fz: number, t: number) {
    let built = false;
    for (const s of this.sites) {
      const d = Math.hypot(s.l.x - fx, s.l.z - fz), r = LOD0[s.l.tier];
      const near = s.near ? d < r + HYST : d < r;
      if (near && !s.mesh && !built && (s.refined || this.pool)) { this.buildMesh(s); built = true; }
      if (near && s.mesh && !s.near) { s.near = true; this.pool?.setVisible(SITE_ID0 + s.i, false); }
      if (!near && s.mesh) this.dropMesh(s);
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
    for (const s of this.sites) if (s.near) near++;
    return { sites: this.sites.length, near, triangles: this.triangles };
  }

  dispose() {
    for (const s of this.sites) this.dropMesh(s);
  }
}
