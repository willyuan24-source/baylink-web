import * as THREE from 'three';
import { CELL } from '../../core/geo';
import { runtime } from '../../core/runtime';
import { type ChunkRasters, type CityTerrainProvider, createCityTerrain } from '../../core/sfTerrain';
import type { Quality } from '../../core/store';
import { setCityTerrain } from '../../core/terrain';
import type { Vec2 } from '../../core/types';
import { GROUND, TOY } from '../materials';
import { TypedBatch } from '../typedBatch';
import type { CityInit, L0Result, L1Result } from './build';
import { ATTACH_BUDGET, type CellInfo, CellTable, type ChunkInfo, type Focus, type Job, LOWER_QUALITY, RADII, RESELECT_MOVE, RESELECT_YAW, type Radii, cellKey, chunkKeyN } from './cell';
import type { FarCell, FarInit, FarResult } from './far';
import { type FarData, SF_ROOT, type SfManifest, demSample, loadManifest } from './format';
import type { PoolArrays } from './mesh';
import { type CellPool, createCellPool } from './pools';
import { CityProps } from './props';
import { CitySites } from './sites';
import type { WorkerIn } from './worker';

/**
 * CityStreamer (plan §5.4): streams the whole of San Francisco around the hero district in city mode.
 *
 *   start()                 manifest (main thread) → two module workers; worker 0 builds the far city (L2) right away
 *                           (it lands during the arrival cinematic), then chunk jobs stream by priority
 *   update(dt, camera)      per frame: re-select tiers when the focus moved > 16 u / the view turned > 20°, dispatch
 *                           jobs (≤ 3 in flight per worker), attach ≤ 1 L0 + 2 L1 cells, drop what left, toggle tiers,
 *                           props nearest-N, landmark LODs, walking rasters (lane B's provider) in / out by residency
 *   whenReady(p, r)         resolves when every cell within r of p shows its tier and the rasters there are in
 *   stats()                 {l0, l1, l2, queued, inflight, workerMs, …} (?debug overlay, window.__opusBay.city)
 *
 * Focus = the player + 20 u along the camera's forward direction (gliding high: the ground 60 u ahead). While the
 * focus is within 300 u of the hero slab, the L1 ring drops one quality step (the hand-made district is ~200k
 * triangles on its own).
 */

export interface StreamOptions {
  renderer: THREE.WebGLRenderer;
  quality: Quality;
  slab: Vec2[];
  sites: CitySites;
  farInit: Omit<FarInit, 'slab' | 'excludes'>;
  /** far arrived: shore texture, lakes, board edge (world wires them into the water) */
  onFar(r: FarResult, far: FarData): void;
  /** the hero's own buildings + props (hidden beyond HERO_NEAR) and their L1 stand-in (plan §5.1) */
  hero?: { meshes: THREE.Object3D[]; proxy: () => PoolArrays | null };
  pool?: 'batched' | 'tile';
  root?: string;
}

export interface CityStats {
  status: string;
  l0: number; l1: number; l2: number;
  want0: number; want1: number;
  queued: number; inflight: number;
  workerMs: number; attachMs: number; attachMaxMs: number;
  jobs: number; errors: number;
  resident: number;
  props: Record<string, number>;
  sites: { near: number; triangles: number };
  pool: ReturnType<CellPool['stats']>;
  l0Triangles: number;
  l1Triangles: number;
  l2Triangles: number;
  /** the hero's hand-made buildings are replaced by their L1 boxes (player far away) */
  heroFar: boolean;
  farMs: number;
  focus: Vec2;
}

type WorkerOut =
  | { t: 'ready' }
  | { t: 'far'; result: FarResult; far: FarData }
  | { t: 'l1'; id: number; cx: number; cz: number; result: L1Result }
  | { t: 'l0'; id: number; cx: number; cz: number; result: L0Result }
  | { t: 'raster'; id: number; cx: number; cz: number; r: ChunkRasters; ms: number }
  | { t: 'error'; id: number; message: string };

/** beyond this distance (focus → hero slab bbox) the hero's buildings give way to L1 boxes; ± HERO_HYST */
const HERO_NEAR = 300;
const HERO_HYST = 24;
const HERO_ID = 8_999_999;
const FOCUS_AHEAD = 20;
const INFLIGHT = 3;
const l1Id = (key: number) => key * 4 + 1;
const l2Id = (key: number) => key * 4 + 2;

let CURRENT: CityStreamer | null = null;
/** The running city streamer (city mode), for other lanes: whenReady for fast travel, far data for the map. */
export function cityStreamer(): CityStreamer | null { return CURRENT; }
function publish(s: CityStreamer | null) { CURRENT = s; }

export class CityStreamer {
  readonly group = new THREE.Group();
  readonly l0Group = new THREE.Group();
  readonly props = new CityProps();
  readonly pool: CellPool;
  manifest: SfManifest | null = null;
  far: FarData | null = null;
  table: CellTable | null = null;
  terrain: CityTerrainProvider | null = null;
  status: 'idle' | 'loading' | 'far' | 'streaming' | 'error' = 'idle';
  error = '';
  /** QA: focus here instead of the player (world.cam() views) */
  focusOverride: Vec2 | null = null;

  private opts: StreamOptions;
  private workers: Worker[] = [];
  private inflight = new Map<number, { job: Job; w: number }>();
  private perWorker = [0, 0];
  private nextId = 1;
  private l0 = new Map<number, { toy: THREE.Mesh | null; ground: THREE.Mesh | null; tris: number }>();
  private l0Ready = new Map<number, L0Result>();
  private l1Ready = new Map<number, { toy: L1Result['cells'][number]['toy']; ground: L1Result['cells'][number]['ground'] }>();
  private shown = new Map<number, number>();
  private farQueue: FarCell[] = [];
  private farCells = new Set<number>();
  private waits: { p: Vec2; r: number; resolve: () => void }[] = [];
  private focus = { x: 0, z: 0, vx: 0, vz: 0 };
  private selAt = { x: Infinity, z: Infinity, yaw: 0, t: -1, radii: '' };
  private jobsDirty = true;
  private queued = 0;
  private workerMs = 0;
  private attachMs = 0;
  private attachMax = 0;
  private jobsDone = 0;
  private errors = 0;
  private farMs = 0;
  private retry = new Map<string, number>();
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private box = new THREE.Box3();
  private fwd = new THREE.Vector3();
  private l0Tris = 0;
  private l1Tris = 0;
  private l2Tris = 0;
  /** far cells outside the chunk table (always on) */
  private l2Static = 0;
  private time = 0;
  private slabBox: { x0: number; z0: number; x1: number; z1: number };
  private heroFar = false;
  quality: Quality;

  constructor(opts: StreamOptions) {
    this.opts = opts;
    this.quality = opts.quality;
    this.group.name = 'city';
    this.l0Group.name = 'city-l0';
    // reserved up front (grows if needed): far city ≈ 123k toy + 79k ground vertices, the L1 ring ≈ 2.2–4k + 0.7k per
    // cell (measured: ≤ 460k toy / 170k ground live on high)
    const scale = opts.quality === 'high' ? 1 : opts.quality === 'mid' ? 0.8 : 0.7;
    this.pool = createCellPool(opts.renderer, { toyVerts: Math.round(600_000 * scale), groundVerts: Math.round(260_000 * scale), instances: 3000 }, opts.pool);
    this.group.add(this.pool.group, this.l0Group, this.props.group, opts.sites.group);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of opts.slab) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    this.slabBox = { x0, z0, x1, z1 };
    const proxy = opts.hero?.proxy();
    if (proxy) this.pool.add(HERO_ID, { toy: proxy, ground: null }, false, false);
    publish(this);
  }

  /** Load the manifest, register the walking provider, spawn the workers (worker 0 builds the far city first). */
  async start(): Promise<void> {
    if (this.status !== 'idle') return;
    this.status = 'loading';
    try {
      const root = this.opts.root ?? SF_ROOT;
      const { base, manifest } = await loadManifest(root);
      this.manifest = manifest;
      this.table = new CellTable(manifest.chunks.map(c => ({ cx: c.cx, cz: c.cz, hero: c.hero })));
      const sites = this.opts.sites;
      this.terrain = createCityTerrain(manifest, { landmarks: sites.walkInputs() });
      setCityTerrain(this.terrain, { heroDropLots: new Set(manifest.heroDropLots) });
      // collision decks of 'terrain' landmarks sit exactly under the drawn model
      sites.onBase = (id, y) => { this.terrain?.setLandmarkBase(id, y); };
      const abs = new URL(base, location.href).href;
      const init: CityInit = { palettes: manifest.palettes, slab: this.opts.slab, excludes: sites.excludes(), heroLand: this.opts.farInit.heroLand };
      const farInit: FarInit = { ...this.opts.farInit, slab: this.opts.slab, excludes: init.excludes };
      for (let w = 0; w < 2; w++) {
        const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: `opus-city-${w}` });
        worker.onmessage = (ev: MessageEvent<WorkerOut>) => this.onMessage(w, ev.data);
        worker.onerror = ev => { this.errors++; this.error = String(ev.message); };
        const msg: WorkerIn = { t: 'init', init, base: abs, landmarks: sites.walkInputs(), ...(w === 0 ? { far: `${abs}/${manifest.far.file}`, farInit } : {}) };
        worker.postMessage(msg);
        this.workers.push(worker);
      }
      this.status = 'far';
    } catch (e) {
      this.status = 'error';
      this.error = String(e);
      if (import.meta.env.DEV) console.warn('[opus-bay city]', e);
    }
  }

  private onMessage(w: number, m: WorkerOut) {
    if (m.t === 'ready') return;
    if (m.t === 'far') { this.onFar(m.result, m.far); return; }
    const rec = this.inflight.get(m.id);
    if (rec) { this.inflight.delete(m.id); this.perWorker[w]--; }
    this.jobsDirty = true;
    const t = this.table;
    if (!t) return;
    if (m.t === 'error') {
      this.errors++;
      this.error = m.message;
      if (rec) this.resetJob(rec.job);
      return;
    }
    this.jobsDone++;
    if (m.t === 'l1') {
      const ch = t.chunk(m.cx, m.cz);
      if (!ch) return;
      this.workerMs += (m.result.ms - this.workerMs) * 0.1;
      ch.l1 = 'ready';
      for (const c of m.result.cells) {
        const cell = ch.cells[c.sub];
        if (cell.l1 === 'attached' || (cell.l1 === 'ready' && this.l1Ready.has(cell.key))) continue; // a re-ask: keep what is there
        if (!c.toy && !c.ground) { cell.empty = true; cell.l1 = 'none'; continue; }
        this.l1Ready.set(cell.key, { toy: c.toy, ground: c.ground });
        cell.l1 = 'ready';
      }
      this.props.setSource(ch.key, m.result.props);
      for (const b of m.result.bases) this.opts.sites.setBase(b.id, b.y);
    } else if (m.t === 'l0') {
      const ch = t.chunk(m.cx, m.cz);
      if (!ch) return;
      this.workerMs += (m.result.ms - this.workerMs) * 0.1;
      const cell = ch.cells[m.result.sub];
      if (!m.result.toy && !m.result.ground) { cell.l0 = 'none'; cell.empty = true; return; }
      this.l0Ready.set(cell.key, m.result);
      cell.l0 = 'ready';
    } else if (m.t === 'raster') {
      const ch = t.chunk(m.cx, m.cz);
      if (!ch) return;
      if (ch.dist > 256) { ch.raster = 'none'; return; }
      this.terrain?.attach(m.r);
      ch.raster = 'attached';
    }
  }

  private resetJob(j: Job) {
    const key = j.kind === 'l0' ? `l0:${j.cell.key}` : `${j.kind}:${j.chunk.key}`;
    this.retry.set(key, this.time + 3);
    if (j.kind === 'raster') j.chunk.raster = 'none';
    else if (j.kind === 'l1') { j.chunk.l1 = 'none'; for (const c of j.chunk.cells) if (c.l1 === 'queued') c.l1 = 'none'; }
    else j.cell.l0 = 'none';
  }

  private onFar(r: FarResult, far: FarData) {
    this.far = far;
    this.farMs = r.ms;
    this.farQueue = r.cells;
    this.terrain?.setFar(far);
    this.opts.onFar(r, far);
    this.opts.sites.attach(this.pool, (x, z) => demSample(far.dem, x, z));
    this.status = 'streaming';
    this.jobsDirty = true;
  }

  /** L2 cells into the pool, a few ms per frame (static slots). */
  private drainFar(budgetMs: number) {
    const t0 = performance.now();
    while (this.farQueue.length && performance.now() - t0 < budgetMs) {
      const c = this.farQueue.shift()!;
      const key = cellKey(c.ix, c.iz);
      const cell = this.table?.cell(c.ix, c.iz);
      this.pool.add(l2Id(key), { toy: c.toy, ground: c.ground }, false, !cell || CellTable.shownFor(cell) === 2);
      this.farCells.add(key);
      if (!cell) this.l2Static += this.pool.trianglesOf(l2Id(key));
    }
  }

  /** distance from the focus to the hero slab's bbox (0 inside) */
  private heroDist() {
    const b = this.slabBox, f = this.focus;
    return Math.hypot(Math.max(b.x0 - f.x, 0, f.x - b.x1), Math.max(b.z0 - f.z, 0, f.z - b.z1));
  }

  /** Hero near ↔ far: its buildings and props, or their L1 boxes (landmarks, ground and labels always stay). */
  private updateHero() {
    const hero = this.opts.hero;
    if (!hero) return;
    const d = this.heroDist();
    const far = this.heroFar ? d > HERO_NEAR - HERO_HYST : d > HERO_NEAR + HERO_HYST;
    if (far === this.heroFar) return;
    this.heroFar = far;
    for (const m of hero.meshes) m.visible = !far;
    this.pool.setVisible(HERO_ID, far);
  }

  private radii(): Radii {
    let q = this.quality;
    if (this.heroDist() < HERO_NEAR) q = LOWER_QUALITY[q];
    const r = { ...RADII[q] };
    if (runtime.glide.active && runtime.glide.height > 40) { r.l0In = 60; r.l0Out = 90; }
    return r;
  }

  private updateFocus(dt: number, camera: THREE.Camera) {
    camera.getWorldDirection(this.fwd);
    this.fwd.y = 0;
    if (this.fwd.lengthSq() > 1e-6) this.fwd.normalize();
    let x: number, z: number;
    if (this.focusOverride) { x = this.focusOverride.x; z = this.focusOverride.z; }
    else if (runtime.glide.active) { x = runtime.glide.x + Math.sin(runtime.glide.heading) * 60; z = runtime.glide.z + Math.cos(runtime.glide.heading) * 60; }
    else { x = runtime.player.x + this.fwd.x * FOCUS_AHEAD; z = runtime.player.z + this.fwd.z * FOCUS_AHEAD; }
    const k = dt > 0 ? Math.min(1, dt * 4) : 1;
    if (dt > 0 && Number.isFinite(this.focus.x)) {
      const jump = Math.hypot(x - this.focus.x, z - this.focus.z);
      const vx = jump > 60 ? 0 : (x - this.focus.x) / dt, vz = jump > 60 ? 0 : (z - this.focus.z) / dt;
      this.focus.vx += (vx - this.focus.vx) * k; this.focus.vz += (vz - this.focus.vz) * k;
    }
    this.focus.x = x; this.focus.z = z;
  }

  private inView = (c: CellInfo) => {
    this.box.min.set(c.x - CELL / 2, -2, c.z - CELL / 2);
    this.box.max.set(c.x + CELL / 2, 40, c.z + CELL / 2);
    return this.frustum.intersectsBox(this.box);
  };

  private dispatch() {
    const t = this.table;
    if (!t || !this.workers.length) return;
    const jobs = t.jobs(this.inView);
    this.queued = jobs.length;
    for (const j of jobs) {
      const key = j.kind === 'l0' ? `l0:${j.cell.key}` : `${j.kind}:${j.chunk.key}`;
      if ((this.retry.get(key) ?? -1) > this.time) continue;
      const w = Math.abs(j.chunk.cx * 7 + j.chunk.cz * 13) % 2;
      if (this.perWorker[w] >= INFLIGHT) continue;
      const id = this.nextId++;
      let msg: WorkerIn;
      if (j.kind === 'raster') { j.chunk.raster = 'queued'; msg = { t: 'raster', id, cx: j.chunk.cx, cz: j.chunk.cz }; }
      else if (j.kind === 'l1') { j.chunk.l1 = 'queued'; for (const c of j.chunk.cells) if (c.l1 === 'none') c.l1 = 'queued'; msg = { t: 'l1', id, cx: j.chunk.cx, cz: j.chunk.cz }; }
      else { j.cell.l0 = 'queued'; msg = { t: 'l0', id, cx: j.chunk.cx, cz: j.chunk.cz, sub: j.cell.sub }; }
      this.inflight.set(id, { job: j, w });
      this.perWorker[w]++;
      this.workers[w].postMessage(msg);
      this.queued--;
    }
    this.jobsDirty = false;
  }

  private attachL0(c: CellInfo) {
    const r = this.l0Ready.get(c.key);
    this.l0Ready.delete(c.key);
    if (!r) { c.l0 = 'none'; return; }
    const mk = (a: L0Result['toy'], mat: THREE.Material, name: string) => {
      if (!a) return null;
      const m = new THREE.Mesh(TypedBatch.toGeometry(a), mat);
      m.name = `${name}:${c.ix},${c.iz}`;
      m.matrixAutoUpdate = false;
      m.receiveShadow = true;
      m.castShadow = false;
      m.visible = false;
      this.l0Group.add(m);
      return m;
    };
    const rec = { toy: mk(r.toy, TOY, 'city-l0-toy'), ground: mk(r.ground, GROUND, 'city-l0-ground'), tris: r.triangles };
    this.l0.set(c.key, rec);
    c.l0 = 'attached';
  }

  private dropL0(c: CellInfo) {
    this.l0Ready.delete(c.key);
    const rec = this.l0.get(c.key);
    if (rec) {
      for (const m of [rec.toy, rec.ground]) if (m) { this.l0Group.remove(m); m.geometry.dispose(); }
      this.l0.delete(c.key);
    }
    c.l0 = 'none';
  }

  /** L1 arrays stay in l1Ready while the chunk is wanted (a cell swinging L1 → L2 → L1 re-attaches without a job). */
  private attachL1(c: CellInfo) {
    const r = this.l1Ready.get(c.key);
    if (!r) { c.l1 = 'none'; return; }
    this.pool.add(l1Id(c.key), r, true, false);
    c.l1 = 'attached';
  }

  private dropL1(c: CellInfo) {
    this.pool.remove(l1Id(c.key));
    c.l1 = this.l1Ready.has(c.key) ? 'ready' : 'none';
  }

  /** A chunk left the L1 ring for good: free its cells' arrays and props. */
  private dropChunk(ch: ChunkInfo) {
    for (const c of ch.cells) {
      if (c.l1 === 'attached') this.pool.remove(l1Id(c.key));
      this.l1Ready.delete(c.key);
      if (c.l1 !== 'queued') c.l1 = 'none';
    }
    ch.l1 = 'none';
    this.props.setSource(ch.key, null);
  }

  private applyVisibility() {
    const t = this.table!;
    let tris = 0, t1 = 0, t2 = 0;
    for (const c of t.cells) {
      const s = CellTable.shownFor(c);
      const rec = this.l0.get(c.key);
      if (rec && s === 0) tris += rec.tris;
      else if (s === 1) t1 += this.pool.trianglesOf(l1Id(c.key));
      else if (s === 2) t2 += this.pool.trianglesOf(l2Id(c.key));
      if (this.shown.get(c.key) === s) continue;
      this.shown.set(c.key, s);
      if (rec) { if (rec.toy) rec.toy.visible = s === 0; if (rec.ground) rec.ground.visible = s === 0; }
      if (c.l1 === 'attached') this.pool.setVisible(l1Id(c.key), s === 1);
      if (this.farCells.has(c.key)) this.pool.setVisible(l2Id(c.key), s === 2);
    }
    this.l0Tris = tris;
    this.l1Tris = t1;
    this.l2Tris = t2 + this.l2Static;
  }

  /** Per frame (world.update). */
  update(dt: number, camera: THREE.Camera) {
    this.time += dt;
    if (this.farQueue.length) this.drainFar(3);
    const t = this.table;
    if (!t || this.status === 'error') return;
    this.updateFocus(dt, camera);
    this.updateHero();
    // re-select
    const radii = this.radii();
    const rk = `${radii.l0In}/${radii.l1In}`;
    camera.getWorldDirection(this.fwd);
    const yaw = Math.atan2(this.fwd.x, this.fwd.z);
    const dyaw = Math.abs(((yaw - this.selAt.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (Math.hypot(this.focus.x - this.selAt.x, this.focus.z - this.selAt.z) > RESELECT_MOVE || dyaw > RESELECT_YAW || rk !== this.selAt.radii || this.time - this.selAt.t > 0.5 || this.waits.length) {
      this.selAt = { x: this.focus.x, z: this.focus.z, yaw, t: this.time, radii: rk };
      const foci: Focus[] = [this.focus, ...this.waits.map(w => ({ x: w.p.x, z: w.p.z }))];
      t.select(foci, radii);
      this.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.m4);
      this.jobsDirty = true;
    }
    if (this.status === 'streaming' && (this.jobsDirty || this.inflight.size < 2)) this.dispatch();
    // attach within budget (timed)
    const a = t.nextAttaches(ATTACH_BUDGET);
    for (const c of a.l0) { const t0 = performance.now(); this.attachL0(c); this.timeAttach(performance.now() - t0); }
    for (const c of a.l1) { const t0 = performance.now(); this.attachL1(c); this.timeAttach(performance.now() - t0); }
    // drop what left (after the replacement is on screen)
    const d = t.drops();
    for (const c of d.l0) this.dropL0(c);
    for (const c of d.l1) this.dropL1(c);
    for (const ch of d.chunks) this.dropChunk(ch);
    for (const ch of d.rasters) { this.terrain?.detach(ch.cx, ch.cz); ch.raster = 'none'; }
    this.applyVisibility();
    this.pool.update();
    this.props.update(this.focus.x, this.focus.z, this.time);
    this.opts.sites.update(this.focus.x, this.focus.z, this.time);
    // teleport / fast-travel waits
    if (this.waits.length) this.waits = this.waits.filter(w => { if (t.ready(w.p.x, w.p.z, w.r)) { w.resolve(); return false; } return true; });
  }

  private timeAttach(ms: number) {
    this.attachMs += (ms - this.attachMs) * 0.1;
    this.attachMax = Math.max(this.attachMax * 0.995, ms);
  }

  /** Resolves once everything within r of p is on screen at its tier and walkable (callers cut in after 8 s anyway). */
  whenReady(p: Vec2, r = 150): Promise<void> {
    if (this.table?.ready(p.x, p.z, r)) return Promise.resolve();
    return new Promise(resolve => this.waits.push({ p: { x: p.x, z: p.z }, r, resolve }));
  }

  setQuality(q: Quality) { this.quality = q; }

  /** Chunk info at a world point (QA). */
  chunkAt(x: number, z: number): ChunkInfo | undefined { return this.table?.chunk(Math.floor(x / 128), Math.floor(z / 128)); }

  stats(): CityStats {
    const n = this.table?.counts() ?? { l0: 0, l1: 0, l2: 0, want0: 0, want1: 0, resident: 0 };
    return {
      status: this.status, ...n, queued: this.queued, inflight: this.inflight.size,
      workerMs: +this.workerMs.toFixed(1), attachMs: +this.attachMs.toFixed(2), attachMaxMs: +this.attachMax.toFixed(2),
      jobs: this.jobsDone, errors: this.errors, props: this.props.counts(), sites: this.opts.sites.counts(), pool: this.pool.stats(),
      l0Triangles: this.l0Tris, l1Triangles: Math.round(this.l1Tris), l2Triangles: Math.round(this.l2Tris), heroFar: this.heroFar, farMs: Math.round(this.farMs), focus: { x: Math.round(this.focus.x), z: Math.round(this.focus.z) },
    };
  }

  dispose() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    setCityTerrain(null);
    if (this.table) for (const c of this.table.cells) this.dropL0(c);
    if (this.heroFar) for (const m of this.opts.hero?.meshes ?? []) m.visible = true;
    this.pool.dispose();
    this.props.dispose();
    this.opts.sites.dispose();
    if (CURRENT === this) publish(null);
  }
}

/** Chunk key helper for QA. */
export { chunkKeyN };
