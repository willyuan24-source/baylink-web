/// <reference lib="webworker" />
import { type ChunkRasters, type LandmarkWalkInput, rasterizeChunk, transferables as rasterTransferables } from '../../core/sfTerrain';
import { TypedBatch } from '../typedBatch';
import { type ChunkContext, type CityInit, buildL0, buildL1, chunkContext, dropSeamBuildings } from './build';
import { Lru } from './cell';
import { l0Transferables } from './l0index';
import { buildFar, type FarInit, type FarWater } from './far';
import { type ChunkData, decodeChunk, decodeFar, gunzip, chunkPath } from './format';
import type { LookZones } from './look';
import { poolTransferables } from './mesh';

/**
 * City stream worker (plan §5.4). Two of these run as module workers (stream.ts); chunk jobs are routed by chunk so
 * each worker keeps its own caches warm:
 *   - compressed chunk bytes, LRU ≤ 4 MB per worker (walking back never re-downloads),
 *   - decoded chunk contexts (rasters + street index), the last 10.
 * Every result is transferred (no copies): render arrays, props, the walking rasters of lane B's rasterizeChunk.
 *
 * Messages in:  init { init, base, far?, farInit?, landmarks } · zones { zones, farWater } (the DataSF neighbourhoods for
 *               the SF look and far.obc's water rings for the ponds, posted by stream.ts once far.obc is in, before any
 *               chunk job) · l1 { id, cx, cz } · l0 { id, cx, cz, sub }
 *               · raster { id, cx, cz }
 * Messages out: ready · far { result, far } · l1 { id, cx, cz, result } · l0 { id, cx, cz, result } · raster { id, cx, cz, r }
 *               · error { id, message }
 */

export type WorkerIn =
  | { t: 'init'; init: CityInit; base: string; far?: string; farInit?: FarInit; landmarks: LandmarkWalkInput[] }
  | { t: 'zones'; zones: LookZones; farWater?: FarWater[] }
  | { t: 'l1'; id: number; cx: number; cz: number }
  | { t: 'l0'; id: number; cx: number; cz: number; sub: number }
  | { t: 'raster'; id: number; cx: number; cz: number };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let INIT: CityInit | null = null;
let BASE = '';
let LANDMARKS: LandmarkWalkInput[] = [];
let SLAB = new Float32Array(0);
const bytes = new Lru<string, Uint8Array>(4 << 20);
const contexts = new Lru<string, ChunkContext>(10);
const decoded = new Map<string, Promise<ChunkData>>();

async function chunkData(cx: number, cz: number): Promise<ChunkData> {
  const k = `${cx}_${cz}`;
  const hit = contexts.get(k);
  if (hit) return hit.chunk;
  let p = decoded.get(k);
  if (!p) {
    p = (async () => {
      let raw = bytes.get(k);
      if (!raw) {
        const res = await fetch(`${BASE}/${chunkPath(cx, cz)}`);
        if (!res.ok) throw new Error(`chunk ${k}: HTTP ${res.status}`);
        raw = new Uint8Array(await res.arrayBuffer());
        bytes.set(k, raw, raw.byteLength);
      }
      // seam buildings standing in the hero's water go before anything reads the chunk: no drawing, no collision
      const chunk = decodeChunk(await gunzip(raw));
      if (INIT) dropSeamBuildings(chunk, INIT);
      return chunk;
    })();
    decoded.set(k, p);
    p.finally(() => decoded.delete(k)).catch(() => {});
  }
  return p;
}

async function context(cx: number, cz: number): Promise<ChunkContext> {
  const k = `${cx}_${cz}`;
  const hit = contexts.get(k);
  if (hit) return hit;
  const c = chunkContext(await chunkData(cx, cz), INIT!);
  contexts.set(k, c, 1);
  return c;
}

async function loadFar(url: string, farInit: FarInit) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`far: HTTP ${res.status}`);
  const far = decodeFar(await gunzip(new Uint8Array(await res.arrayBuffer())));
  const result = buildFar(far, farInit);
  const list: ArrayBuffer[] = [result.shore.data.buffer as ArrayBuffer];
  for (const c of result.cells) list.push(...poolTransferables(c.toy), ...poolTransferables(c.ground));
  if (result.lakes) list.push(result.lakes.position.buffer as ArrayBuffer, result.lakes.index.buffer as ArrayBuffer);
  // far itself is copied (not transferred): the main thread keeps it for the terrain provider / map
  ctx.postMessage({ t: 'far', result, far }, list);
}

ctx.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const m = ev.data;
  if (m.t === 'init') {
    INIT = m.init;
    BASE = m.base;
    LANDMARKS = m.landmarks;
    SLAB = new Float32Array(m.init.slab.flatMap(p => [p.x, p.z]));
    ctx.postMessage({ t: 'ready' });
    if (m.far && m.farInit) loadFar(m.far, m.farInit).catch(e => ctx.postMessage({ t: 'error', id: -1, message: String(e) }));
    return;
  }
  if (m.t === 'zones') { if (INIT) { INIT.zones = m.zones; INIT.farWater = m.farWater ?? null; } return; }
  try {
    if (m.t === 'l1') {
      const result = buildL1(await context(m.cx, m.cz));
      const list: ArrayBuffer[] = [result.props.kind.buffer, result.props.variant.buffer, result.props.xyzr.buffer] as ArrayBuffer[];
      for (const c of result.cells) list.push(...poolTransferables(c.toy), ...poolTransferables(c.ground));
      ctx.postMessage({ t: 'l1', id: m.id, cx: m.cx, cz: m.cz, result }, list);
    } else if (m.t === 'l0') {
      const result = buildL0(await context(m.cx, m.cz), m.sub);
      const list: ArrayBuffer[] = [];
      if (result.toy) list.push(...TypedBatch.transferables(result.toy));
      if (result.ground) list.push(...TypedBatch.transferables(result.ground));
      list.push(...l0Transferables(result.buildings));
      ctx.postMessage({ t: 'l0', id: m.id, cx: m.cx, cz: m.cz, result }, list);
    } else if (m.t === 'raster') {
      const t0 = performance.now();
      const r: ChunkRasters = rasterizeChunk(await chunkData(m.cx, m.cz), { landmarks: LANDMARKS, heroMask: { slab: SLAB } });
      ctx.postMessage({ t: 'raster', id: m.id, cx: m.cx, cz: m.cz, r, ms: performance.now() - t0 }, rasterTransferables(r));
    }
  } catch (e) {
    ctx.postMessage({ t: 'error', id: m.id, message: String(e) });
  }
};
