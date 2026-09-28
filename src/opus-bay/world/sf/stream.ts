import * as THREE from 'three';
import { CELL } from '../../core/geo';
import { runtime } from '../../core/runtime';
import { type ChunkRasters, type CityTerrainProvider, createCityTerrain } from '../../core/sfTerrain';
import type { Quality } from '../../core/store';
import { setCityTerrain } from '../../core/terrain';
import type { Vec2 } from '../../core/types';
import { GROUND, TOY, type TierFadePair, makeTierFadePair, tierFadeIn, tierFadeOut } from '../materials';
import { freezeStatic } from '../builder';
import { TypedBatch } from '../typedBatch';
import { BOARD_LOD, BOARD_POOL } from './boardData';
import type { BoardsBuild, BoardsData } from './boards';
import type { CityInit, L0Result, L1Result } from './build';
import { ATTACH_BUDGET, type CellInfo, CellTable, type ChunkInfo, type Focus, type Job, RESELECT_MOVE, RESELECT_YAW, type Radii, cellKey, chunkKeyN, radiiFor } from './cell';
import type { FarCell, FarInit, FarResult } from './far';
import type { HeroTile } from './farHero';
import { type FarData, SF_ROOT, type SfManifest, demSample, loadManifest } from './format';
import type { PoolArrays } from './mesh';
import { type CellPool, boundsSphere, createCellPool, hazeCullDepth } from './pools';
import { CityProps } from './props';
import { type L0BuildingView, type L0Buildings, type L0Hidden, l0Building, l0Near, setRangeHidden } from './l0index';
import { lookZones } from './look';
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
  /**
   * the satellite boards are in the pools (lane C2-7b; null when the data has none or they failed to load): the world
   * builds the water's edge with their ground, drops the water under their land and lights them at night
   */
  onBoards?(r: BoardsBuild | null): void;
  /**
   * the hero's own buildings + props (hidden beyond HERO_NEAR) and their L1 stand-in (plan §5.1); `ground`: the hero
   * ground chunks and the job that resamples them into a ground-pool stand-in (lane C2-5; run in 2 ms frame slices
   * once streaming starts; until it is done the hand-made ground stays on screen when far)
   */
  hero?: { meshes: THREE.Object3D[]; proxy: () => PoolArrays | null; ground?: { meshes: THREE.Object3D[]; job: () => Generator<void, PoolArrays | null> }; tiles?: readonly HeroTile[] };
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
  /** W5-V2: the hero's 150 u tiles showing their far detail now, of all tiles with a far chunk */
  heroTiles: { far: number; of: number };
  /** camera height above the ground (u) that sized the radii and prop caps this frame (lane C2-5) */
  camH: number;
  farMs: number;
  focus: Vec2;
  /** the satellite boards (C2-7b): load / build state, items and triangles in the pools */
  boards: { status: string; items: number; triangles: number; ms: number; nearTiles: number; tiles: number };
  /** the haze cull's view depth this frame (pools.ts hazeCullDepth; null = off) */
  hazeDepth: number | null;
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
/** prefetch(): the soft radius (u) around each point, and at most this many points */
export const PREFETCH_R = 120;
export const PREFETCH_MAX = 3;
const HERO_HYST = 24;
/**
 * W5-V2 (plan MF9): a hero tile (150 u of the hand-made district) shows its far detail (world/sf/farHero.ts: the same
 * buildings, the planting simplified, no street furniture) while the focus is farther than this from the tile's bounds
 * (u; back to the near chunk HERO_TILE_HYST closer). About the streamed city's own L0 → L1 distance at each quality.
 */
export const HERO_TILE_FAR: Record<Quality, number> = { high: 155, mid: 140, low: 125 };
export const HERO_TILE_HYST = 20;
/** re-run the tiles' test after the focus moved this far (u) */
const HERO_TILE_STEP = 4;
/** fading bookkeeping keys of the hero tiles (never a cell key: those are positive) */
const heroTileKey = (i: number) => -1 - i;
const HERO_ID = 8_999_999;
/** the hero ground stand-in (≡ 3 mod 4 like HERO_ID: never an l1Id / l2Id) */
const HERO_GROUND_ID = 9_000_003;
const FOCUS_AHEAD = 20;
const INFLIGHT = 3;
/**
 * Tier cross-fade (lane C2-10): when a cell switches tier, the outgoing tier stays TIER_FADE s under the complementary
 * dither of the incoming one (materials.ts TIER_FADE_FRAG; plain L0 meshes through one of FADE_PAIRS fade materials,
 * pool items through their batching colour). Batched pool only: on the tile path tiers switch at once.
 */
export const TIER_FADE = 0.3;
const FADE_PAIRS = 6;
type L0Rec = { toy: THREE.Mesh | null; ground: THREE.Mesh | null; tris: number; buildings: L0Buildings | null; hidden: L0Hidden };
/** what a fade pair dresses: an L0 cell's toy + ground meshes, or a hero tile's chunk (W5-V2: toy only) */
type FadeMeshes = Pick<L0Rec, 'toy' | 'ground'>;
interface FadePart { t0: number; out: boolean; l0?: FadeMeshes; pair?: TierFadePair | null; pool?: number; end?: () => void }
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
  /** the scene's live FogExp2 density, set by the world before update(): pool items past its haze depth are not drawn */
  haze = 0;
  private hazeDepth = Infinity;
  manifest: SfManifest | null = null;
  /** the data version's base URL (manifest, chunks, boards) */
  base = '';
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
  private l0 = new Map<number, L0Rec>();
  /** C2-10: the parts of each cell (key) fading right now, the free fade material pairs, whether the pool can fade */
  private fading = new Map<number, FadePart[]>();
  private pairs: TierFadePair[] = [];
  private pairsMade = 0;
  private canFade = false;
  private l0Ready = new Map<number, L0Result>();
  private l1Ready = new Map<number, { toy: L1Result['cells'][number]['toy']; ground: L1Result['cells'][number]['ground'] }>();
  private shown = new Map<number, number>();
  private farQueue: FarCell[] = [];
  private farCells = new Set<number>();
  private waits: { p: Vec2; r: number; resolve: () => void }[] = [];
  private prefetchFoci: Focus[] = [];
  private focus = { x: 0, z: 0, vx: 0, vz: 0 };
  private selAt = { x: Infinity, z: Infinity, yaw: 0, t: -1, radii: '' };
  /** the cell table changed (a worker result, a re-selection, far cells, an attach / drop last frame): walk it again */
  private visDirty = true;
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
  private _heroFar = false;
  private heroGroundDone = false;
  private heroGroundJob: Generator<void, PoolArrays | null> | null = null;
  private camH = 0;
  private heroFarListeners = new Set<(far: boolean) => void>();
  /** C2-7b: the satellite boards, loaded (their own lazy chunk) once the far city is in, built in ≈ 2 ms slices */
  private boards: { status: 'none' | 'loading' | 'building' | 'done' | 'error'; job: Generator<'frame' | void, BoardsBuild> | null; result: BoardsBuild | null } = { status: 'none', job: null, result: null };
  /** the boards' near / far tiles (BOARD_LOD): one sphere per 256 u tile, its near and far item ids, near on? */
  private boardLod: { x: number; y: number; z: number; r: number; near: number[]; far: number[]; on: boolean }[] = [];
  /** camera position at the last near / far pass (re-run after 16 u of camera travel) */
  private boardLodAt = new THREE.Vector3(Infinity, 0, 0);
  private l0DropListeners = new Set<(cellKey: number) => void>();
  /** W5-V2: the hero's tiles and which of them show their far detail (hero near only) */
  private heroTiles: { tile: HeroTile; far: boolean }[] = [];
  private heroTilesAt = { x: Infinity, z: Infinity, q: '' };
  quality: Quality;

  /** The hero's hand-made buildings are replaced by their L1 boxes (focus beyond HERO_NEAR of the slab). Day-0 API. */
  get heroFar(): boolean { return this._heroFar; }
  /** Called with the new value whenever heroFar flips (lane F's hero-life pause, C2's hero-far budget). Returns the unsubscribe. */
  onHeroFar(fn: (far: boolean) => void): () => void { this.heroFarListeners.add(fn); return () => { this.heroFarListeners.delete(fn); }; }

  /**
   * Day-0 L0 building API (lane D2's kit swap; world/sf/l0index.ts): every attached L0 cell's building whose centre is
   * within r of (x, z). `fn(cellKey, k, view)`; cellKey identifies the cell for setL0BuildingHidden / onL0Drop.
   */
  forEachL0Building(x: number, z: number, r: number, fn: (cellKey: number, k: number, b: L0BuildingView) => void) {
    for (const [key, rec] of this.l0) {
      const b = rec.buildings;
      if (!b || !rec.toy) continue;
      const bb = rec.toy.geometry.boundingBox;
      if (bb && (x + r < bb.min.x || x - r > bb.max.x || z + r < bb.min.z || z - r > bb.max.z)) continue;
      l0Near(b, x, z, r, k => fn(key, k, l0Building(b, k)));
    }
  }
  /** Hide (or restore) building k of an attached L0 cell; false when the cell is gone or nothing changed. */
  setL0BuildingHidden(cellKey: number, k: number, hidden: boolean): boolean {
    const rec = this.l0.get(cellKey);
    return !!rec?.toy && !!rec.buildings && setRangeHidden(rec.toy.geometry, rec.buildings, k, hidden, rec.hidden);
  }
  /** Called with the cell key just before an L0 cell's meshes are dropped (its hidden ranges die with it). */
  onL0Drop(fn: (cellKey: number) => void): () => void { this.l0DropListeners.add(fn); return () => { this.l0DropListeners.delete(fn); }; }

  constructor(opts: StreamOptions) {
    this.opts = opts;
    this.quality = opts.quality;
    this.group.name = 'city';
    this.l0Group.name = 'city-l0';
    // the city graph never moves (everything is built in world space): without these, three recomposes the groups'
    // matrices every frame and so recomputes the world matrix of every city object under them (wave 3, P2)
    freezeStatic(this.group);
    freezeStatic(this.l0Group);
    freezeStatic(opts.sites.group);
    // reserved up front (grows if needed): far city ≈ 123k toy + 79k ground vertices, the L1 ring ≈ 2.2–4k + 0.7k per
    // cell (measured: ≤ 460k toy / 170k ground live on high), plus the satellite boards' static items at every quality
    // (BOARD_POOL: without it the ground pool grew mid-walk at `mid`)
    const scale = opts.quality === 'high' ? 1 : opts.quality === 'mid' ? 0.8 : 0.7;
    this.pool = createCellPool(opts.renderer, { toyVerts: Math.round(600_000 * scale) + BOARD_POOL.toy, groundVerts: Math.round(260_000 * scale) + BOARD_POOL.ground, instances: 3000 }, opts.pool);
    this.canFade = this.pool.setFade(-1, 1);
    this.group.add(this.pool.group, this.l0Group, this.props.group, opts.sites.group);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of opts.slab) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    this.slabBox = { x0, z0, x1, z1 };
    const proxy = opts.hero?.proxy();
    if (proxy) this.pool.add(HERO_ID, { toy: proxy, ground: null }, false, false);
    this.heroTiles = (opts.hero?.tiles ?? []).filter(t => t.far && t.near).map(tile => ({ tile, far: false }));
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
      this.base = base;
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
    this.visDirty = true;
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
    // the SF look needs the neighbourhoods, the ponds the far water rings: every chunk job is dispatched after this
    // (status 'streaming' below)
    const zones: WorkerIn = { t: 'zones', zones: lookZones(far), farWater: r.farWater };
    for (const w of this.workers) w.postMessage(zones);
    this.farMs = r.ms;
    this.farQueue = r.cells;
    this.terrain?.setFar(far);
    this.opts.onFar(r, far);
    this.opts.sites.attach(this.pool, (x, z) => demSample(far.dem, x, z));
    this.status = 'streaming';
    this.jobsDirty = true;
    this.loadBoards();
  }

  /** C2-7b: fetch the boards (their own lazy chunk); the build runs in frame slices (stepBoards). */
  private loadBoards() {
    if (this.boards.status !== 'none') return;
    this.boards.status = 'loading';
    import('./boards').then(async m => {
      const data: BoardsData | null = await m.loadBoards(this.base);
      if (this.disposed) return;
      if (!data) { this.boards.status = 'error'; this.opts.onBoards?.(null); return; }
      this.boards.job = this.boardsRun(m.boardsJob(data));
      this.boards.status = 'building';
    }).catch(e => {
      this.boards.status = 'error';
      if (import.meta.env.DEV) console.warn('[opus-bay city] boards', e);
      this.opts.onBoards?.(null);
    });
  }

  /**
   * The build (boards.ts boardsJob), then its items into the pools a few at a time, then the world's part (onBoards: the
   * water's edge, the light field) on a frame of its own. Wave-3 review: the 294 adds and onBoards ran in the frame that
   * finished the build (28–56 ms at 1× CPU on the RTX laptop, ≈ 4× that on a phone).
   */
  private *boardsRun(build: Generator<void, BoardsBuild>): Generator<'frame' | void, BoardsBuild> {
    const r: BoardsBuild = yield* build;
    // static items (the pools cull them per item; the tile pool merges them into a few bins): the dressing always on,
    // the near / far ground switched per tile by updateBoardLod (far to begin with)
    const tiles = new Map<number, { near: number[]; far: number[]; parts: (PoolArrays | null)[] }>();
    let n = 0;
    for (const it of r.items) {
      this.pool.add(it.id, { toy: it.toy, ground: it.ground, bin: it.bin }, false, it.lod !== 'near');
      if (it.lod !== 'all') {
        let t = tiles.get(it.tile);
        if (!t) tiles.set(it.tile, (t = { near: [], far: [], parts: [] }));
        (it.lod === 'near' ? t.near : t.far).push(it.id);
        t.parts.push(it.toy, it.ground);
      }
      if (++n % 32 === 0) yield;
    }
    const sph = new Float32Array(4);
    this.boardLod = [...tiles.values()].map(t => { boundsSphere(t.parts, sph); return { x: sph[0], y: sph[1], z: sph[2], r: Math.max(0, sph[3]), near: t.near, far: t.far, on: false }; });
    this.boardLodAt.set(Infinity, 0, 0);
    yield 'frame';
    return r;
  }

  private stepBoards() {
    const b = this.boards;
    if (b.status !== 'building' || !b.job || this.farQueue.length) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 2) {
      const r = b.job.next();
      if (!r.done) { if (r.value === 'frame') return; continue; }
      b.job = null;
      b.result = r.value;
      b.status = 'done';
      this.opts.onBoards?.(r.value);
      return;
    }
  }

  /**
   * C2-7b: the boards' near / far ground (BOARD_LOD), per 256 u tile by the camera's distance to its bounds, with
   * hysteresis; re-run after 16 u of camera travel (a few hundred sphere distances, a switch is a setVisible).
   */
  private updateBoardLod(camera: THREE.Camera) {
    if (!this.boardLod.length) return;
    const m = camera.matrixWorld.elements, cx = m[12], cy = m[13], cz = m[14];
    if (Math.hypot(cx - this.boardLodAt.x, cy - this.boardLodAt.y, cz - this.boardLodAt.z) < 16) return;
    this.boardLodAt.set(cx, cy, cz);
    for (const t of this.boardLod) {
      const d = Math.max(0, Math.hypot(t.x - cx, t.y - cy, t.z - cz) - t.r);
      const on = t.on ? d < BOARD_LOD.near + BOARD_LOD.hyst : d < BOARD_LOD.near - BOARD_LOD.hyst;
      if (on === t.on) continue;
      t.on = on;
      for (const id of t.near) this.pool.setVisible(id, on);
      for (const id of t.far) this.pool.setVisible(id, !on);
    }
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
      this.visDirty = true;
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
    const far = this._heroFar ? d > HERO_NEAR - HERO_HYST : d > HERO_NEAR + HERO_HYST;
    if (far === this._heroFar) return;
    this._heroFar = far;
    for (const m of hero.meshes) m.visible = !far;
    this.pool.setVisible(HERO_ID, far);
    this.swapHeroGround();
    this.applyHeroTiles();
    for (const fn of this.heroFarListeners) fn(far);
  }

  /**
   * W5-V2: the hero tiles as they stand, at once (no fade): hero far → every tile's near and far chunk hidden (the L1
   * boxes stand in); hero near → each tile's near or far chunk by its state. Settles the tiles' running fades first.
   */
  private applyHeroTiles() {
    this.heroTiles.forEach((h, i) => {
      this.finishFades(heroTileKey(i), true);
      if (h.tile.near) h.tile.near.visible = !this._heroFar && !h.far;
      if (h.tile.far) h.tile.far.visible = !this._heroFar && h.far;
    });
    this.heroTilesAt.x = Infinity;
  }

  /**
   * W5-V2: per hero tile, the near chunk within HERO_TILE_FAR of the focus, its far detail beyond (± HERO_TILE_HYST),
   * switched with the C2-10 dither cross-fade (the incoming chunk dithers in over TIER_FADE, the outgoing one out under
   * it). Re-run after HERO_TILE_STEP u of focus travel or a quality change; nothing while the whole hero is far.
   */
  private updateHeroTiles() {
    if (!this.heroTiles.length || this._heroFar) return;
    const f = this.focus, at = this.heroTilesAt;
    if (Math.hypot(f.x - at.x, f.z - at.z) < HERO_TILE_STEP && at.q === this.quality) return;
    at.x = f.x; at.z = f.z; at.q = this.quality;
    const R = HERO_TILE_FAR[this.quality];
    this.heroTiles.forEach((h, i) => {
      const b = h.tile.box;
      const d = Math.hypot(Math.max(b.x0 - f.x, 0, f.x - b.x1), Math.max(b.z0 - f.z, 0, f.z - b.z1));
      const far = h.far ? d > R - HERO_TILE_HYST : d > R;
      if (far === h.far) return;
      h.far = far;
      const key = heroTileKey(i);
      this.finishFades(key, true);
      const incoming = far ? h.tile.far! : h.tile.near!, outgoing = far ? h.tile.near! : h.tile.far!;
      incoming.visible = true;
      this.fadeL0(key, { toy: incoming, ground: null }, false);
      this.fadeL0(key, { toy: outgoing, ground: null }, true, () => { if (h.far !== far || this._heroFar) return; outgoing.visible = false; });
      if (!this.canFade) outgoing.visible = false;
    });
  }

  /** The hero ground or its stand-in (only once the stand-in exists). */
  private swapHeroGround() {
    const g = this.opts.hero?.ground;
    if (!g || !this.pool.has(HERO_GROUND_ID)) return;
    for (const m of g.meshes) m.visible = !this._heroFar;
    this.pool.setVisible(HERO_GROUND_ID, this._heroFar);
  }

  /** Advance the hero ground stand-in job by one ≈ 2 ms slice (from the first streaming frame on, once). */
  private stepHeroGround() {
    const g = this.opts.hero?.ground;
    if (!g || this.heroGroundDone || this.status !== 'streaming') return;
    this.heroGroundJob ??= g.job();
    const t0 = performance.now();
    while (performance.now() - t0 < 2) {
      const r = this.heroGroundJob.next();
      if (!r.done) continue;
      this.heroGroundDone = true;
      this.heroGroundJob = null;
      if (r.value) { this.pool.add(HERO_GROUND_ID, { toy: null, ground: r.value }, false, false); this.swapHeroGround(); }
      return;
    }
  }

  private radii(): Radii {
    return radiiFor(this.quality, { heroNear: this.heroDist() < HERO_NEAR, camH: this.camH, glideH: runtime.glide.active ? runtime.glide.height : null });
  }

  /** Camera height above the ground under it (the far DEM; sea level before it arrives). */
  private cameraHeight(camera: THREE.Camera) {
    const p = camera.position;
    const g = this.far ? demSample(this.far.dem, p.x, p.z) : 0;
    return Math.max(0, p.y - (Number.isFinite(g) ? g : 0));
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
      freezeStatic(m);
      m.receiveShadow = true;
      m.castShadow = false;
      m.visible = false;
      this.l0Group.add(m);
      return m;
    };
    const rec = { toy: mk(r.toy, TOY, 'city-l0-toy'), ground: mk(r.ground, GROUND, 'city-l0-ground'), tris: r.triangles, buildings: r.buildings ?? null, hidden: new Map() as L0Hidden };
    this.l0.set(c.key, rec);
    c.l0 = 'attached';
  }

  private dropL0(c: CellInfo, fade = true) {
    this.l0Ready.delete(c.key);
    const rec = this.l0.get(c.key);
    if (rec) {
      for (const fn of this.l0DropListeners) fn(c.key);
      this.l0.delete(c.key);
      const free = () => { for (const m of [rec.toy, rec.ground]) if (m) { this.l0Group.remove(m); m.geometry.dispose(); } };
      // on screen: it fades out under the tier that replaces it (C2-10), then goes
      if (fade && this.shown.get(c.key) === 0 && (rec.toy?.visible || rec.ground?.visible)) this.fadeL0(c.key, rec, true, free);
      else free();
    }
    c.l0 = 'none';
  }

  /** L1 arrays stay in l1Ready while the chunk is wanted (a cell swinging L1 → L2 → L1 re-attaches without a job). */
  private attachL1(c: CellInfo) {
    const r = this.l1Ready.get(c.key);
    if (!r) { c.l1 = 'none'; return; }
    this.dropPoolFade(c.key, l1Id(c.key)); // its old copy may still be fading out
    this.pool.add(l1Id(c.key), r, true, false);
    c.l1 = 'attached';
  }

  private dropL1(c: CellInfo) {
    const id = l1Id(c.key);
    // on screen: it fades out under the far tier first (C2-10)
    if (this.shown.get(c.key) === 1) this.fadePool(c.key, id, true, () => this.pool.remove(id));
    else this.pool.remove(id);
    c.l1 = this.l1Ready.has(c.key) ? 'ready' : 'none';
  }

  // --- tier cross-fade (C2-10) ---

  private fadeL0(key: number, rec: FadeMeshes, out: boolean, end?: () => void) {
    const pair = this.canFade ? this.pairs.pop() ?? (this.pairsMade < FADE_PAIRS ? (this.pairsMade++, makeTierFadePair()) : null) : null;
    if (!pair) { end?.(); return; }
    if (rec.toy) rec.toy.material = pair.toy;
    if (rec.ground) rec.ground.material = pair.ground;
    pair.fade.value = out ? tierFadeOut(0) : tierFadeIn(0);
    this.addPart(key, { t0: this.time, out, l0: rec, pair, end });
  }

  private fadePool(key: number, id: number, out: boolean, end?: () => void) {
    if (!this.canFade || !this.pool.has(id)) { end?.(); return; }
    this.pool.setVisible(id, true);
    this.pool.setFade(id, out ? tierFadeOut(0) : tierFadeIn(0));
    this.addPart(key, { t0: this.time, out, pool: id, end });
  }

  private addPart(key: number, p: FadePart) {
    let list = this.fading.get(key);
    if (!list) { list = []; this.fading.set(key, list); }
    list.push(p);
  }

  /** a pool item that comes back while its old copy fades out: forget that fade (the item is replaced) */
  private dropPoolFade(key: number, id: number) {
    const list = this.fading.get(key);
    if (!list) return;
    const i = list.findIndex(p => p.pool === id);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this.fading.delete(key);
  }

  private endPart(p: FadePart) {
    if (p.pair && p.l0) {
      // only while the mesh still wears this pair: a quick flip (in, then out within TIER_FADE) has put the newer fade's
      // pair on it, and settling the older fade here must not make the fading-out cell solid (wave-3 review)
      if (p.l0.toy && p.l0.toy.material === p.pair.toy) p.l0.toy.material = TOY;
      if (p.l0.ground && p.l0.ground.material === p.pair.ground) p.l0.ground.material = GROUND;
      this.pairs.push(p.pair);
    } else if (p.pool !== undefined) this.pool.setFade(p.pool, 1);
    p.end?.();
  }

  /** settle a cell's earlier fades at once (a new switch starts); `all` also ends the ones started this frame */
  private finishFades(key: number, all = false) {
    const list = this.fading.get(key);
    if (!list) return;
    const keep: FadePart[] = [];
    for (const p of list) { if (!all && p.t0 === this.time) keep.push(p); else this.endPart(p); }
    if (keep.length) this.fading.set(key, keep); else this.fading.delete(key);
  }

  private stepFades() {
    for (const [key, list] of this.fading) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i], t = (this.time - p.t0) / TIER_FADE;
        if (t >= 1) { list.splice(i, 1); this.endPart(p); continue; }
        const v = p.out ? tierFadeOut(t) : tierFadeIn(t);
        if (p.pair) p.pair.fade.value = v; else if (p.pool !== undefined) this.pool.setFade(p.pool, v);
      }
      if (!list.length) this.fading.delete(key);
    }
  }

  /** Cells fading right now (QA / tests). */
  get fadingCells(): number { return this.fading.size; }

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
      const prev = this.shown.get(c.key);
      if (prev === s) continue;
      this.shown.set(c.key, s);
      if (rec) { if (rec.toy) rec.toy.visible = s === 0; if (rec.ground) rec.ground.visible = s === 0; }
      if (c.l1 === 'attached') this.pool.setVisible(l1Id(c.key), s === 1);
      if (this.farCells.has(c.key)) this.pool.setVisible(l2Id(c.key), s === 2);
      // C2-10: the new tier dithers in over TIER_FADE s, the old one (when it is still there) dithers out under it
      if (prev === undefined || !this.canFade) continue;
      this.finishFades(c.key);
      if (s === 0 && rec) this.fadeL0(c.key, rec, false);
      else if (s === 1 && c.l1 === 'attached') this.fadePool(c.key, l1Id(c.key), false);
      else if (s === 2 && this.farCells.has(c.key)) this.fadePool(c.key, l2Id(c.key), false);
      const key = c.key;
      if (prev === 1 && c.l1 === 'attached') this.fadePool(key, l1Id(key), true, () => { if (this.shown.get(key) !== 1) this.pool.setVisible(l1Id(key), false); });
      else if (prev === 2 && this.farCells.has(key)) this.fadePool(key, l2Id(key), true, () => { if (this.shown.get(key) !== 2) this.pool.setVisible(l2Id(key), false); });
      else if (prev === 0 && rec) this.fadeL0(key, rec, true, () => { if (this.shown.get(key) !== 0) { if (rec.toy) rec.toy.visible = false; if (rec.ground) rec.ground.visible = false; } });
    }
    this.l0Tris = tris;
    this.l1Tris = t1;
    this.l2Tris = t2 + this.l2Static;
  }

  /** Per frame (world.update). */
  update(dt: number, camera: THREE.Camera) {
    this.time += dt;
    if (this.farQueue.length) this.drainFar(3);
    this.stepBoards();
    const t = this.table;
    if (!t || this.status === 'error') return;
    this.updateFocus(dt, camera);
    this.camH = this.cameraHeight(camera);
    this.updateHero();
    this.updateHeroTiles();
    this.stepHeroGround();
    // re-select
    const radii = this.radii();
    const rk = `${radii.l0In}/${radii.l1In}`;
    camera.getWorldDirection(this.fwd);
    const yaw = Math.atan2(this.fwd.x, this.fwd.z);
    const dyaw = Math.abs(((yaw - this.selAt.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (Math.hypot(this.focus.x - this.selAt.x, this.focus.z - this.selAt.z) > RESELECT_MOVE || dyaw > RESELECT_YAW || rk !== this.selAt.radii || this.time - this.selAt.t > 0.5 || this.waits.length) {
      this.selAt = { x: this.focus.x, z: this.focus.z, yaw, t: this.time, radii: rk };
      const foci: Focus[] = [this.focus, ...this.waits.map(w => ({ x: w.p.x, z: w.p.z })), ...this.prefetchFoci];
      t.select(foci, radii);
      this.visDirty = true;
      this.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.m4);
      this.jobsDirty = true;
    }
    if (this.status === 'streaming' && (this.jobsDirty || this.inflight.size < 2)) this.dispatch();
    // the three walks over every cell (attaches, drops, tiers on screen) only when the table changed (wave 3, P2: ≈ 0.5 ms
    // a frame at 4× CPU on a standing camera); a frame that attached or dropped something looks again the next frame
    if (this.visDirty) {
      this.visDirty = false;
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
      if (a.l0.length || a.l1.length || d.l0.length || d.l1.length || d.chunks.length || d.rasters.length) this.visDirty = true;
    }
    this.stepFades();
    // tile rebuilds and the per-item frustum cull of the L1 / L2 pools (the camera's matrices are current: read above),
    // the items lost in the haze included (the far city and the boards behind the skyline at walking height)
    this.hazeDepth = hazeCullDepth(this.haze, (camera as THREE.PerspectiveCamera).far ?? Infinity);
    this.updateBoardLod(camera);
    this.pool.update(camera, this.hazeDepth);
    this.props.update(this.focus.x, this.focus.z, this.time, this.camH, camera);
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

  /**
   * Stream ahead of a moving ride (wave 4, W4-V8; lane T's rides): the points (e.g. the track 200 u ahead of the rider,
   * refreshed every 0.5 s) become soft foci: the L1 tier within `radius` and the walking rasters there, queued behind
   * the player's own jobs, never L0. Unlike whenReady (a full focus until ready, then gone) they stay until replaced;
   * `prefetch([])` when the ride ends. At most PREFETCH_MAX points.
   */
  prefetch(points: readonly Vec2[], radius = PREFETCH_R) {
    const next = points.slice(0, PREFETCH_MAX).map(p => ({ x: p.x, z: p.z, soft: radius }));
    if (next.length === 0 && this.prefetchFoci.length === 0) return;
    this.prefetchFoci = next;
    this.selAt.t = -Infinity;
  }

  /** the soft foci of prefetch() (QA) */
  get prefetching(): readonly Focus[] { return this.prefetchFoci; }

  setQuality(q: Quality) { this.quality = q; }

  /** Chunk info at a world point (QA). */
  chunkAt(x: number, z: number): ChunkInfo | undefined { return this.table?.chunk(Math.floor(x / 128), Math.floor(z / 128)); }

  stats(): CityStats {
    const n = this.table?.counts() ?? { l0: 0, l1: 0, l2: 0, want0: 0, want1: 0, resident: 0 };
    return {
      status: this.status, ...n, queued: this.queued, inflight: this.inflight.size,
      workerMs: +this.workerMs.toFixed(1), attachMs: +this.attachMs.toFixed(2), attachMaxMs: +this.attachMax.toFixed(2),
      jobs: this.jobsDone, errors: this.errors, props: this.props.counts(), sites: this.opts.sites.counts(), pool: this.pool.stats(),
      l0Triangles: this.l0Tris, l1Triangles: Math.round(this.l1Tris), l2Triangles: Math.round(this.l2Tris), heroFar: this._heroFar, heroTiles: { far: this.heroTiles.filter(h => h.far).length, of: this.heroTiles.length }, camH: Math.round(this.camH), farMs: Math.round(this.farMs), focus: { x: Math.round(this.focus.x), z: Math.round(this.focus.z) },
      boards: { status: this.boards.status, items: this.boards.result?.items.length ?? 0, triangles: this.boards.result?.triangles.total ?? 0, ms: Math.round(this.boards.result?.ms ?? 0), nearTiles: this.boardLod.filter(t => t.on).length, tiles: this.boardLod.length },
      hazeDepth: Number.isFinite(this.hazeDepth) ? this.hazeDepth : null,
    };
  }

  private disposed = false;

  dispose() {
    this.disposed = true;
    this.boards.job = null;
    for (const key of [...this.fading.keys()]) this.finishFades(key, true);
    // the fade pairs are this streamer's own material instances (the next city makes its own)
    for (const p of this.pairs) { p.toy.dispose(); p.ground.dispose(); }
    this.pairs = [];
    for (const w of this.workers) w.terminate();
    this.workers = [];
    setCityTerrain(null);
    if (this.table) for (const c of this.table.cells) this.dropL0(c, false);
    if (this._heroFar) for (const m of [...(this.opts.hero?.meshes ?? []), ...(this.opts.hero?.ground?.meshes ?? [])]) m.visible = true;
    // the hero tiles back to their near chunks (the fades above put the plain materials back)
    for (const h of this.heroTiles) { if (h.tile.near) h.tile.near.visible = true; if (h.tile.far) h.tile.far.visible = false; h.far = false; }
    this.pool.dispose();
    this.props.dispose();
    this.opts.sites.dispose();
    if (CURRENT === this) publish(null);
  }
}

/** Chunk key helper for QA. */
export { chunkKeyN };
