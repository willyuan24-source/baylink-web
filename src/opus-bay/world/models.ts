import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSETS, type ModelAsset, SF_DRACO_DECODER_PATH } from '../data/assets';

/**
 * Shared GLB loading for the AI meshes (lane D2, plan §8 "runtime for AI assets", checkpoint D2-02).
 *
 *   one GLTFLoader + one DRACOLoader (decoder from SF_DRACO_DECODER_PATH, 2 workers), created on first use
 *   preloadDraco()          fetch the decoder and start its workers early (city mode, before the first landmark swap)
 *   loadModel(id)           id of ASSETS.models (SF_MODELS, SF_KIT, MODELS) → { geometry, map, mask, … }, cached:
 *                           concurrent calls share one request, a failure is remembered (the caller keeps its fallback)
 *   peekModel(id)           the loaded model or null, synchronously (never starts a load)
 *   retainModel / releaseModel   reference counts; models nobody holds stay cached (LRU) up to KEEP_UNUSED, the
 *                           least recently used beyond that are disposed (geometry + textures)
 *   loadMask(url)           a mask texture (flipY false like the GLB's own map, linear data), cached with its model
 *
 * NODE-SAFE: importing this module touches no DOM; without a browser (no Worker / document) every load resolves null.
 * The geometry is returned in the model's own frame (origin at the ground centre, front +z) with the node transform
 * applied; the caller places it (world/sf/sites.ts, SoloView) and builds the material (world/modelMaterial.ts).
 */

export interface LoadedModel {
  id: string;
  asset: ModelAsset;
  /** position, normal, uv (Draco-decoded), bounding box computed */
  geometry: THREE.BufferGeometry;
  /** the GLB's base colour (sRGB, flipY false), null if the file has none */
  map: THREE.Texture | null;
  /** the asset's mask (R night glass, G wall tint region), null when it has none or it failed to load */
  mask: THREE.Texture | null;
  triangles: number;
}

type EntryState = 'loading' | 'ready' | 'failed';
interface Entry {
  id: string;
  state: EntryState;
  promise: Promise<LoadedModel | null>;
  model: LoadedModel | null;
  refs: number;
  /** last retain / release / load tick (LRU order) */
  used: number;
}

/** Unreferenced models kept decoded for a quick return (a landmark re-entering its lod-0 ring, kit houses). */
export const KEEP_UNUSED = 6;
const DRACO_WORKERS = 2;

let gltf: GLTFLoader | null = null;
let draco: DRACOLoader | null = null;
let texLoader: THREE.TextureLoader | null = null;
const entries = new Map<string, Entry>();
let tick = 0;
let failures = 0;

/** A browser that can fetch, decode Draco in workers and load images. */
export function canLoadModels(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof fetch === 'function'
    && typeof document !== 'undefined' && typeof document.createElementNS === 'function';
}

function loaders(): { gltf: GLTFLoader; draco: DRACOLoader } {
  if (!draco) {
    draco = new DRACOLoader();
    draco.setDecoderPath(SF_DRACO_DECODER_PATH);
    draco.setWorkerLimit(DRACO_WORKERS);
  }
  if (!gltf) {
    gltf = new GLTFLoader();
    gltf.setDRACOLoader(draco);
  }
  return { gltf, draco };
}

/**
 * The shared Draco-capable GLTFLoader (HC-4): for lanes that load their own GLBs (actors/system.ts BAYBAY, world/life.ts
 * the district heroes) once those files move to Draco. Import this module dynamically (`await import('../world/models')`)
 * so district mode keeps DRACOLoader out of its first load.
 */
export function heroGltfLoader(): GLTFLoader { return loaders().gltf; }

/** Fetch the Draco decoder and prepare its worker source (idempotent; a no-op outside a browser). */
export function preloadDraco(): void {
  if (!canLoadModels()) return;
  try { loaders().draco.preload(); } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay models] draco preload', error); }
}

/** Mask texture: same UVs as the base colour, so flipY false like glTF textures; data, not colour. */
export function loadMask(url: string): Promise<THREE.Texture | null> {
  if (!canLoadModels()) return Promise.resolve(null);
  texLoader ??= new THREE.TextureLoader();
  return texLoader.loadAsync(url).then(t => {
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, error => {
    if (import.meta.env?.DEV) console.warn(`[opus-bay models] mask ${url}`, error);
    return null;
  });
}

async function fetchModel(id: string, asset: ModelAsset): Promise<LoadedModel | null> {
  const { gltf: loader } = loaders();
  const maskUrl = (asset as ModelAsset & { mask?: string }).mask;
  const [file, mask] = await Promise.all([loader.loadAsync(asset.url), maskUrl ? loadMask(maskUrl) : Promise.resolve(null)]);
  let mesh: THREE.Mesh | null = null;
  file.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) { mask?.dispose(); return null; }
  const found = mesh as THREE.Mesh;
  found.updateWorldMatrix(true, false);
  const geometry = found.geometry.clone().applyMatrix4(found.matrixWorld);
  found.geometry.dispose();
  for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const source = (Array.isArray(found.material) ? found.material[0] : found.material) as THREE.MeshStandardMaterial;
  const map = source.map ?? null;
  source.dispose();
  const index = geometry.getIndex();
  return { id, asset, geometry, map, mask, triangles: (index ? index.count : geometry.getAttribute('position').count) / 3 };
}

/** Load (or return the cached) model `id` of ASSETS.models; null when unknown, outside a browser, or on failure. */
export function loadModel(id: string): Promise<LoadedModel | null> {
  const hit = entries.get(id);
  if (hit) { hit.used = ++tick; return hit.promise; }
  const asset = ASSETS.models[id];
  if (!asset || !canLoadModels()) return Promise.resolve(null);
  const entry: Entry = { id, state: 'loading', promise: Promise.resolve(null), model: null, refs: 0, used: ++tick };
  entry.promise = fetchModel(id, asset).then(model => {
    // disposed (disposeModels) while loading: drop the result
    if (entries.get(id) !== entry) { if (model) disposeLoaded(model); return null; }
    entry.model = model;
    entry.state = model ? 'ready' : 'failed';
    if (!model) failures++;
    trim();
    return model;
  }, error => {
    if (import.meta.env?.DEV) console.warn(`[opus-bay models] ${id}`, error);
    if (entries.get(id) === entry) { entry.state = 'failed'; failures++; }
    return null;
  });
  entries.set(id, entry);
  return entry.promise;
}

/** The loaded model, or null (still loading, failed, unknown). Never starts a load. */
export function peekModel(id: string): LoadedModel | null {
  const e = entries.get(id);
  if (!e || e.state !== 'ready') return null;
  e.used = ++tick;
  return e.model;
}

/** 'loading' | 'ready' | 'failed', or null when never requested (or evicted). */
export function modelState(id: string): EntryState | null {
  return entries.get(id)?.state ?? null;
}

/** Hold `id` (its geometry / textures are in use): never evicted while retained. Starts the load if needed. */
export function retainModel(id: string): Promise<LoadedModel | null> {
  const p = loadModel(id);
  const e = entries.get(id);
  if (e) { e.refs++; e.used = ++tick; }
  return p;
}

/** Undo one retainModel; the model stays cached until KEEP_UNUSED newer unused models push it out. */
export function releaseModel(id: string): void {
  const e = entries.get(id);
  if (!e) return;
  e.refs = Math.max(0, e.refs - 1);
  e.used = ++tick;
  trim();
}

function disposeLoaded(m: LoadedModel) {
  m.geometry.dispose();
  m.map?.dispose();
  m.mask?.dispose();
}

/** Dispose the least recently used unreferenced models beyond KEEP_UNUSED (failed entries are kept: no retry storm). */
function trim() {
  const unused = [...entries.values()].filter(e => e.state === 'ready' && e.refs === 0).sort((a, b) => a.used - b.used);
  for (let i = 0; i < unused.length - KEEP_UNUSED; i++) {
    const e = unused[i];
    if (e.model) disposeLoaded(e.model);
    entries.delete(e.id);
  }
}

export interface ModelCacheStats { ready: number; loading: number; failed: number; retained: number; triangles: number; failures: number }

export function modelStats(): ModelCacheStats {
  const s: ModelCacheStats = { ready: 0, loading: 0, failed: 0, retained: 0, triangles: 0, failures };
  for (const e of entries.values()) {
    s[e.state]++;
    if (e.refs > 0) s.retained++;
    if (e.model) s.triangles += e.model.triangles;
  }
  return s;
}

/** Dispose every cached model and the Draco workers (world teardown). Pending loads resolve null. */
export function disposeModels(): void {
  for (const e of entries.values()) if (e.model) disposeLoaded(e.model);
  entries.clear();
  draco?.dispose();
  draco = null;
  gltf = null;
}
