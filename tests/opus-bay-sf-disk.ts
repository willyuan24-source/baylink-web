import fs from 'node:fs';
import path from 'node:path';
import { type ChunkRasters, type LandmarkWalkInput, type CityTerrainProvider, createCityTerrain, rasterizeChunk } from '../src/opus-bay/core/sfTerrain';
import { WalkGraphIndex } from '../src/opus-bay/core/walkGraph';
import {
  type ChunkData, type FarData, type SfCurrent, type SfManifest, type WalkGraph,
  decodeChunkFile, decodeFarFile, decodeGraphFile,
} from '../src/opus-bay/world/sf/format';
import { addSeamFill } from '../src/opus-bay/world/sf/build';
import { SEAM_FILL } from '../src/opus-bay/world/sf/cornersSeamData';

/**
 * Node helper (tests / QA tools, lane B): load the published San Francisco from public/opus-bay/sf/<current> on disk,
 * rasterise chunks and register them with a city terrain provider — what lane C's streamer does in the browser.
 *
 *   const sf = sfDisk();
 *   const city = createCityTerrain(sf.manifest, { landmarks });
 *   city.setFar(await sf.far());
 *   await sf.attachAround(city, x, z, 192);          // every manifest chunk within 192 u
 *   setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
 */

export interface SfDisk {
  root: string;
  base: string;
  version: string;
  manifest: SfManifest;
  chunk(cx: number, cz: number): Promise<ChunkData | null>;
  rasters(cx: number, cz: number, landmarks?: readonly LandmarkWalkInput[]): Promise<ChunkRasters | null>;
  far(): Promise<FarData>;
  graph(): Promise<WalkGraph>;
  graphIndex(): Promise<WalkGraphIndex>;
  /** attach every manifest chunk whose square comes within `radius` of (x, z); returns the attached keys */
  attachAround(city: CityTerrainProvider, x: number, z: number, radius: number, landmarks?: readonly LandmarkWalkInput[]): Promise<string[]>;
  /** attach every manifest chunk */
  attachAll(city: CityTerrainProvider, landmarks?: readonly LandmarkWalkInput[]): Promise<void>;
}

const rasterCache = new Map<string, ChunkRasters>();
const listIds = new WeakMap<readonly LandmarkWalkInput[], number>();
let listSeq = 0;
const listId = (l?: readonly LandmarkWalkInput[]) => { if (!l) return 0; let id = listIds.get(l); if (!id) listIds.set(l, (id = ++listSeq)); return id; };

export function sfDisk(root = path.resolve(import.meta.dirname, '../public/opus-bay/sf')): SfDisk {
  const current = JSON.parse(fs.readFileSync(path.join(root, 'current.json'), 'utf8')) as SfCurrent;
  const base = path.join(root, current.version);
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8')) as SfManifest;
  const keys = new Set(manifest.chunks.map(c => c.k));
  const file = (f: string) => new Uint8Array(fs.readFileSync(path.join(base, f)));
  let farP: Promise<FarData> | null = null, graphP: Promise<WalkGraph> | null = null, indexP: Promise<WalkGraphIndex> | null = null;
  const self: SfDisk = {
    root, base, version: current.version, manifest,
    async chunk(cx, cz) {
      const k = `${cx}_${cz}`;
      if (!keys.has(k)) return null;
      // W6-W1: the stream worker appends the North Beach seam fill to the decoded chunk (world/sf/worker.ts)
      const c = await decodeChunkFile(file(`c/${k}.obc`));
      addSeamFill(c, SEAM_FILL);
      return c;
    },
    async rasters(cx, cz, landmarks) {
      const k = `${root}:${cx}_${cz}:${listId(landmarks)}`;
      const hit = rasterCache.get(k);
      if (hit) return cloneRasters(hit);
      const c = await self.chunk(cx, cz);
      if (!c) return null;
      const r = rasterizeChunk(c, landmarks ? { landmarks } : {});
      rasterCache.set(k, r);
      return cloneRasters(r);
    },
    far: () => (farP ??= decodeFarFile(file(manifest.far.file))),
    graph: () => (graphP ??= decodeGraphFile(file(manifest.graph.file))),
    graphIndex: () => (indexP ??= self.graph().then(g => new WalkGraphIndex(g))),
    async attachAround(city, x, z, radius, landmarks) {
      const out: string[] = [];
      for (const c of manifest.chunks) {
        const x0 = c.cx * 128, z0 = c.cz * 128;
        const dx = Math.max(x0 - x, 0, x - (x0 + 128)), dz = Math.max(z0 - z, 0, z - (z0 + 128));
        if (dx * dx + dz * dz > radius * radius || city.rasters(c.cx, c.cz)) continue;
        const r = await self.rasters(c.cx, c.cz, landmarks);
        if (r) { city.attach(r); out.push(c.k); }
      }
      return out;
    },
    async attachAll(city, landmarks) {
      for (const c of manifest.chunks) {
        if (city.rasters(c.cx, c.cz)) continue;
        const r = await self.rasters(c.cx, c.cz, landmarks);
        if (r) city.attach(r);
      }
    },
  };
  return self;
}

/** Rasters are patched in place on attach, so every provider gets its own copy of the cached arrays. */
function cloneRasters(r: ChunkRasters): ChunkRasters {
  return { ...r, h: r.h.slice(), surf: r.surf.slice(), kind: r.kind.slice(), stand: r.stand.slice() };
}

export { createCityTerrain };
