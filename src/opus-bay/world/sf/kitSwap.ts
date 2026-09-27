import * as THREE from 'three';
import { SF_KIT, SF_KIT_IDS, type SfKitId } from '../../data/assets';
import { type ModelMaterial, makeModelMaterial, modelInstanceGeometry, setModelInstance } from '../modelMaterial';
import type { LoadedModel } from '../models';
import { CITY_STYLES } from '../recipes/city';
import type { L0BuildingView } from './l0index';

/**
 * Near-player house-kit swap (lane D2, D2-08; plan §8 "runtime for AI assets", the day-0 L0 index route of
 * checkpoint §5.1). Within KIT_SWAP.rIn of the player, up to `max` of the streamed city's toy L0 houses give way to
 * the SAM house kit (data/assets.ts SF_KIT: 11 Draco GLBs with a wall-tint / night-glass mask), fitted to the house:
 *
 *   style    the building's recipe style picks the kit models that may stand in for it (SF_KIT styles: victorian →
 *            stick-victorian / queen-anne-corner, edwardian → edwardian-flats / richmond-flats, marina, sunset,
 *            chinatown, residential → north-beach corner / mission mural, brick / industrial → SoMa warehouse,
 *            deco); the best facade fit wins, a hash of the OSM id varies neighbouring lots
 *   facade   width : height (to the roof, H + roof) within ±facadeTol of the kit's, so windows and doors keep their
 *            proportions. The depth scales freely within `depth` × the facade scale: SF's toy lots are wider than
 *            deep (median 3.7 × 2.7 u at five neighbourhoods) and a row house shows its front, not its party walls
 *   slope    the footprint's ground range ≤ `slope` (the kit's base is flat; it stands on the lot's lowest ground,
 *            like the recipe's walls)
 *   front    the lot's street edge (l0index frontYaw) within 15° of its box axes; the kit's +z faces the street
 *   tint     the wall colour the recipe drew (the L0 descriptor), through the kit's mask.g (modelMaterial.ts)
 *
 * Hysteresis: a house joins within rIn and stays until rOut (8 u further); a change of mind must hold for `dwell`
 * (1.5 s) before it happens. A joining kit house fades in by ordered dither over `fade` (0.3 s), a hair larger than
 * the toy house (`grow`) so it covers it without z-fighting, then the toy house's index range is hidden (degenerate
 * triangles, stream.setL0BuildingHidden); leaving restores the range first and fades the kit out. A dropped L0 cell
 * releases its swaps at once (onL0Drop). Budget: ≤ max instances (12; 8 at quality mid, none at low), ≤ maxModels
 * (6) models = draw calls, ≤ maxTris (35k), no shadows; one InstancedMesh per model on the warmed 'ob-model-inst'
 * program (modelMaterial.ts registers it). Off above camH (a high camera sees no kit detail). The kit only fills the
 * frame's room: with the last frames' triangles (`frameTriangles`, the renderer's whole-frame count) it keeps the
 * view ≤ frameBudget (400k, plan §5.10) − frameMargin — where the city alone is already at the budget, the toy houses
 * stay (the hidden toy ranges still count: they are degenerate, not removed).
 *
 * Pure selection (kitFit, kitChoices) is separate from the three objects so node tests drive it with a fake L0 source
 * and fake models (tests/opus-bay-sf-kit-swap.test.ts). world/sf/sites.ts runs it from CitySites.update.
 */

export const KIT_SWAP = {
  rIn: 40,
  rOut: 48,
  dwell: 1.5,
  fade: 0.3,
  /** instances by quality */
  max: { high: 12, mid: 8, low: 0 } as Record<string, number>,
  maxModels: 6,
  maxTris: 35_000,
  slope: 0.8,
  facadeTol: 0.25,
  depth: [0.3, 1.25] as const,
  /** the kit house stands this much larger (x, z) than the toy house while both show (no z-fight) */
  grow: 1.02,
  /** the kit reaches to the toy house's wall top + this (its parapet / roof) */
  roof: 0.35,
  /** reselect period (s) */
  tick: 0.25,
  /** no swaps with the camera higher than this above the ground (u) */
  camH: 40,
  /** the street edge's normal must lie within this of the box axes (rad) */
  skew: 0.26,
  /** the view's triangle budget (incl. shadows) the kit fills up to, and the room it leaves */
  frameBudget: 400_000,
  frameMargin: 4_000,
} as const;

/** What the kit swap needs from the city streamer (world/sf/stream.ts CityStreamer, day-0 L0 building API). */
export interface L0Source {
  forEachL0Building(x: number, z: number, r: number, fn: (cellKey: number, k: number, b: L0BuildingView) => void): void;
  setL0BuildingHidden(cellKey: number, k: number, hidden: boolean): boolean;
  onL0Drop(fn: (cellKey: number) => void): () => void;
  quality?: string;
}

/**
 * Options: the renderer's triangles of the last whole frame (null while unknown: no frame limit); `onRender` goes on the
 * kit meshes' onBeforeRender (sites.ts catches the renderer there too, so the frame budget holds even before a landmark
 * lod 0 has been drawn).
 */
export interface KitSwapOptions { frameTriangles?: () => number | null; onRender?: (renderer: THREE.WebGLRenderer) => void }

/**
 * Instance slots per kit model (D2-review): the cap counts the houses fading in or on, and the ones fading out still hold
 * a slot for 0.3 s, so a street of one model (the Sunset's sunset-doelger) reached 13 instances in a 12-slot mesh while
 * a house left and the next one joined (mesh.count past the instance buffer). Twice the cap: every house of the cap
 * fading out while as many fade in.
 */
export const KIT_SLOTS = KIT_SWAP.max.high * 2;

/** The decoded kit models (world/models.ts in the city; fakes in the tests). */
export interface KitModels {
  peek(id: string): LoadedModel | null;
  retain(id: string): void;
  release(id: string): void;
}

export interface KitFit {
  id: SfKitId;
  x: number; y: number; z: number;
  /** world yaw of the kit's +z (the street side) */
  yaw: number;
  /** the kit's scale (x across the facade, y up, z into the lot) */
  sx: number; sy: number; sz: number;
  /** the L0 wall colour (linear rgb) */
  tint: readonly [number, number, number];
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** 0…1 hash of an OSM id and a kit id (neighbouring lots vary between equally good kits) */
function lotHash(osmId: number, id: string): number {
  let h = 2166136261 ^ (osmId % 2147483647);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

/** The kit models that may stand in for a recipe style (SF_KIT styles). */
export function kitChoices(style: string): SfKitId[] {
  return SF_KIT_IDS.filter(id => (SF_KIT[id].styles as readonly string[]).includes(style));
}

/** The lot's facade width (along its street edge) and depth, or null when the street edge is skewed to its box. */
export function lotFrame(b: Pick<L0BuildingView, 'hx' | 'hz' | 'yaw' | 'frontYaw' | 'hasFront'>): { w: number; d: number } | null {
  if (!b.hasFront) return null;
  const a = Math.abs(wrap(b.frontYaw - b.yaw));
  if (Math.min(a, Math.PI - a) < KIT_SWAP.skew) return { w: 2 * b.hx, d: 2 * b.hz };
  if (Math.abs(a - Math.PI / 2) < KIT_SWAP.skew) return { w: 2 * b.hz, d: 2 * b.hx };
  return null;
}

/** The kit house for an L0 building (filters, model, placement, scale, tint), or null when none fits. */
export function kitFit(b: L0BuildingView): KitFit | null {
  if (b.slope > KIT_SWAP.slope) return null;
  const style = CITY_STYLES[b.style];
  const f = lotFrame(b);
  if (!style || !f) return null;
  const hk = b.H + KIT_SWAP.roof;
  let best: KitFit | null = null, bestScore = Infinity;
  for (const id of kitChoices(style)) {
    const [kw, kh, kd] = SF_KIT[id].size;
    const err = Math.abs(f.w / hk / (kw / kh) - 1);
    if (err > KIT_SWAP.facadeTol) continue;
    const sx = f.w / kw, sy = hk / kh, sz = f.d / kd, s = (sx + sy) / 2;
    if (sz / s < KIT_SWAP.depth[0] || sz / s > KIT_SWAP.depth[1]) continue;
    const score = err + 0.15 * lotHash(b.osmId, id);
    if (score >= bestScore) continue;
    bestScore = score;
    best = { id, x: b.cx, y: b.baseY, z: b.cz, yaw: b.frontYaw, sx: sx * KIT_SWAP.grow, sy, sz: sz * KIT_SWAP.grow, tint: b.wall };
  }
  return best;
}

type Phase = 'in' | 'on' | 'out';
interface Entry { key: string; cell: number; k: number; fit: KitFit; phase: Phase; f: number; hidden: boolean; lostAt: number; slot: number }
interface Holder { id: SfKitId; mesh: THREE.InstancedMesh; geo: THREE.BufferGeometry; mat: ModelMaterial; entries: Entry[]; triangles: number }

const _o = new THREE.Object3D();

export class KitSwap {
  readonly group = new THREE.Group();
  private readonly src: L0Source;
  private readonly models: KitModels;
  private readonly offDrop: () => void;
  private readonly entries = new Map<string, Entry>();
  /** chosen keys not active yet: when they were first chosen */
  private readonly pending = new Map<string, { since: number; cell: number; k: number; fit: KitFit }>();
  private readonly fits = new Map<string, KitFit | null>();
  private readonly holders = new Map<SfKitId, Holder>();
  private readonly retained = new Set<SfKitId>();
  private lastTick = -Infinity;
  private lastT = 0;
  /** paused (camera high, quality low): everything fades out */
  private off = false;
  private readonly frameTriangles: () => number | null;
  private readonly onRender: ((renderer: THREE.WebGLRenderer) => void) | null;
  /** the frame's triangles without the kit, smoothed (−1 = unknown) */
  private baseTris = -1;

  constructor(src: L0Source, models: KitModels, opts: KitSwapOptions = {}) {
    this.src = src;
    this.models = models;
    this.frameTriangles = opts.frameTriangles ?? (() => null);
    this.onRender = opts.onRender ?? null;
    this.group.name = 'city-kit-swap';
    this.offDrop = src.onL0Drop(cell => this.dropCell(cell));
  }

  private cap(): number { return KIT_SWAP.max[this.src.quality ?? 'high'] ?? KIT_SWAP.max.high; }

  /** Once a frame: fx, fz = the streaming focus (the player), t = seconds, camH = the camera's height above the ground. */
  update(fx: number, fz: number, t: number, camH = 0) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.off = camH > KIT_SWAP.camH || this.cap() === 0;
    if (t - this.lastTick >= KIT_SWAP.tick) { this.lastTick = t; this.reselect(fx, fz, t); }
    this.step(dt);
  }

  private fitOf(key: string, b: L0BuildingView): KitFit | null {
    let f = this.fits.get(key);
    if (f === undefined) { f = kitFit(b); this.fits.set(key, f); }
    return f;
  }

  /** Kit triangles the view has room for: the frame budget minus the frame without the kit (smoothed ~1 s). */
  room(): number {
    const ft = this.frameTriangles();
    if (ft !== null) {
      const base = Math.max(0, ft - this.counts().triangles);
      this.baseTris = this.baseTris < 0 ? base : this.baseTris + (base - this.baseTris) * 0.3;
    }
    if (this.baseTris < 0) return KIT_SWAP.maxTris;
    return Math.max(0, Math.min(KIT_SWAP.maxTris, KIT_SWAP.frameBudget - KIT_SWAP.frameMargin - this.baseTris));
  }

  /** Pick the swaps near (fx, fz): active ones hold until rOut (and an 8 u head start), new ones join within rIn. */
  private reselect(fx: number, fz: number, t: number) {
    const cands: { key: string; cell: number; k: number; fit: KitFit; score: number }[] = [];
    if (!this.off) {
      this.src.forEachL0Building(fx, fz, KIT_SWAP.rOut, (cell, k, b) => {
        const key = `${cell}:${k}`, d = Math.hypot(b.cx - fx, b.cz - fz), cur = this.entries.get(key);
        if (!cur && d > KIT_SWAP.rIn) return;
        const fit = this.fitOf(key, b);
        if (fit) cands.push({ key, cell, k, fit, score: cur && cur.phase !== 'out' ? d - (KIT_SWAP.rOut - KIT_SWAP.rIn) : d });
      });
    }
    cands.sort((a, b) => a.score - b.score);
    const chosen = new Set<string>(), models = new Set<SfKitId>();
    let tris = 0;
    const cap = this.cap(), room = this.room();
    for (const c of cands) {
      if (chosen.size >= cap) break;
      if (!models.has(c.fit.id) && models.size >= KIT_SWAP.maxModels) continue;
      const tr = SF_KIT[c.fit.id].triangles;
      if (tris + tr > room) continue;
      chosen.add(c.key);
      models.add(c.fit.id);
      tris += tr;
      if (!this.entries.has(c.key) && !this.pending.has(c.key)) this.pending.set(c.key, { since: t, cell: c.cell, k: c.k, fit: c.fit });
    }
    for (const key of [...this.pending.keys()]) if (!chosen.has(key)) this.pending.delete(key);
    // models for every chosen house (retained while needed)
    for (const id of models) if (!this.retained.has(id)) { this.retained.add(id); this.models.retain(id); }
    // joins: chosen for a dwell, model decoded
    let active = 0;
    for (const e of this.entries.values()) if (e.phase !== 'out') active++;
    for (const [key, p] of this.pending) {
      if (t - p.since < KIT_SWAP.dwell || active >= cap) continue;
      // never more instances than the model's mesh has slots (the leaving ones free theirs within the fade)
      if ((this.holders.get(p.fit.id)?.entries.length ?? 0) >= KIT_SLOTS) continue;
      const model = this.models.peek(p.fit.id);
      if (!model) continue;
      this.pending.delete(key);
      this.add(key, p.cell, p.k, p.fit, model);
      active++;
    }
    // leaves: not chosen for a dwell (or everything, when paused)
    for (const e of this.entries.values()) {
      if (chosen.has(e.key)) {
        e.lostAt = NaN;
        if (e.phase === 'out') e.phase = 'in';
        continue;
      }
      if (Number.isNaN(e.lostAt)) e.lostAt = t;
      if (e.phase !== 'out' && (this.off || t - e.lostAt >= KIT_SWAP.dwell)) this.leave(e);
    }
    // models nobody uses any more
    for (const id of [...this.retained]) {
      const h = this.holders.get(id);
      if (models.has(id) || (h && h.entries.length)) continue;
      if (h) this.disposeHolder(h);
      this.retained.delete(id);
      this.models.release(id);
    }
  }

  private holder(id: SfKitId, model: LoadedModel): Holder {
    let h = this.holders.get(id);
    if (h) return h;
    const max = KIT_SLOTS;
    const geo = modelInstanceGeometry(model.geometry, max);
    const mat = makeModelMaterial({ map: model.map, mask: model.mask, variant: 'ob-model-inst', tintKey: SF_KIT[id].tintKey, name: `ob-model:kit:${id}` });
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.count = 0;
    mesh.visible = false;
    mesh.name = `kit:${id}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.onRender) { const grab = this.onRender; mesh.onBeforeRender = r => grab(r); }
    this.group.add(mesh);
    h = { id, mesh, geo, mat, entries: [], triangles: model.triangles };
    this.holders.set(id, h);
    return h;
  }

  private disposeHolder(h: Holder) {
    this.group.remove(h.mesh);
    h.geo.dispose();
    h.mat.dispose();
    h.mesh.dispose();
    this.holders.delete(h.id);
  }

  private writeSlot(h: Holder, e: Entry) {
    const f = e.fit;
    _o.position.set(f.x, f.y, f.z);
    _o.rotation.set(0, f.yaw, 0);
    _o.scale.set(f.sx, f.sy, f.sz);
    _o.updateMatrix();
    h.mesh.setMatrixAt(e.slot, _o.matrix);
    h.mesh.instanceMatrix.needsUpdate = true;
    const seed = 0.05 + 0.9 * lotHash(e.k * 7919 + e.cell, f.id);
    setModelInstance(h.geo, e.slot, f.tint, 1, 0.55, e.f, seed, 0);
  }

  private add(key: string, cell: number, k: number, fit: KitFit, model: LoadedModel) {
    const h = this.holder(fit.id, model);
    const e: Entry = { key, cell, k, fit, phase: 'in', f: 0, hidden: false, lostAt: NaN, slot: h.entries.length };
    h.entries.push(e);
    h.mesh.count = h.entries.length;
    h.mesh.visible = true;
    this.writeSlot(h, e);
    h.mesh.computeBoundingSphere();
    this.entries.set(key, e);
  }

  /** Start a fade-out: the toy house comes back first (the kit, a hair larger, dithers away over it). */
  private leave(e: Entry) {
    if (e.hidden) { this.src.setL0BuildingHidden(e.cell, e.k, false); e.hidden = false; }
    e.phase = 'out';
  }

  /** Free an entry's instance (the last one moves into its slot). */
  private remove(e: Entry) {
    const h = this.holders.get(e.fit.id);
    this.entries.delete(e.key);
    if (!h) return;
    const last = h.entries.pop()!;
    if (last !== e) {
      last.slot = e.slot;
      h.entries[e.slot] = last;
      this.writeSlot(h, last);
    }
    h.mesh.count = h.entries.length;
    h.mesh.visible = h.entries.length > 0;
    if (h.entries.length) h.mesh.computeBoundingSphere();
  }

  /** Fades (per frame): a finished fade-in hides the toy house, a finished fade-out frees the instance. */
  private step(dt: number) {
    const k = dt / KIT_SWAP.fade;
    // straight over the map (remove() deletes the entry being visited, which a Map iteration allows): no per-frame array
    for (const e of this.entries.values()) {
      if (e.phase === 'on') continue;
      e.f = e.phase === 'in' ? Math.min(1, e.f + k) : Math.max(0, e.f - k);
      const h = this.holders.get(e.fit.id);
      if (h) this.writeFade(h, e);
      if (e.phase === 'in' && e.f >= 1) {
        e.phase = 'on';
        e.hidden = this.src.setL0BuildingHidden(e.cell, e.k, true);
      } else if (e.phase === 'out' && e.f <= 0) this.remove(e);
    }
  }

  private writeFade(h: Holder, e: Entry) {
    const a = h.geo.getAttribute('aObInst') as THREE.InstancedBufferAttribute;
    a.setY(e.slot, e.f);
    a.needsUpdate = true;
  }

  /** An L0 cell goes away (streamed out, a quality change): its swaps go at once, their ranges die with the mesh. */
  private dropCell(cell: number) {
    for (const e of [...this.entries.values()]) if (e.cell === cell) { e.hidden = false; this.remove(e); }
    for (const [key, p] of [...this.pending]) if (p.cell === cell) this.pending.delete(key);
    const pre = `${cell}:`;
    for (const key of [...this.fits.keys()]) if (key.startsWith(pre)) this.fits.delete(key);
  }

  counts() {
    let on = 0, fading = 0, hidden = 0, triangles = 0, draws = 0;
    for (const e of this.entries.values()) {
      if (e.phase === 'on') on++; else fading++;
      if (e.hidden) hidden++;
    }
    for (const h of this.holders.values()) if (h.entries.length) { draws++; triangles += h.triangles * h.entries.length; }
    return { on, fading, pending: this.pending.size, hidden, models: [...this.holders.values()].filter(h => h.entries.length).map(h => h.id), triangles, draws };
  }

  /** The swaps (QA / tests): key, kit id, phase, fade. */
  list() {
    return [...this.entries.values()].map(e => ({ key: e.key, cell: e.cell, k: e.k, id: e.fit.id, phase: e.phase, f: e.f, hidden: e.hidden }));
  }

  /** Restore every hidden toy house and free everything (world teardown, `?kit=0` toggles). */
  dispose() {
    this.offDrop();
    for (const e of this.entries.values()) if (e.hidden) this.src.setL0BuildingHidden(e.cell, e.k, false);
    this.entries.clear();
    this.pending.clear();
    for (const h of [...this.holders.values()]) this.disposeHolder(h);
    for (const id of this.retained) this.models.release(id);
    this.retained.clear();
  }
}
