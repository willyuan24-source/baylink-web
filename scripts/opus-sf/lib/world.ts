// Shared frame for the SF build: the data domain, projection of OSM geometry into the city frame, hero slab data.
import { CHUNK, projectCity, projectRaw, unproject } from '../../../src/opus-bay/core/geo';
import { DISTRICT, hillHeight } from '../../../src/opus-bay/data/district';
import type { Ring } from './geom';
import { pointInRing, segDist2 } from './geom';
import type { OsmGeomPoint } from './io';

/** Chunk-aligned data domain (cx −8…11, cz −7…16), world units. */
export const DOMAIN = { x0: -8 * CHUNK, z0: -7 * CHUNK, x1: 12 * CHUNK, z1: 17 * CHUNK } as const;
export const inDomain = (x: number, z: number, pad = 0) => x >= DOMAIN.x0 - pad && x <= DOMAIN.x1 + pad && z >= DOMAIN.z0 - pad && z <= DOMAIN.z1 + pad;

/** OSM lat/lon list → city-frame ring / polyline (x, z pairs). */
export function projGeom(g: OsmGeomPoint[]): number[] {
  const out: number[] = [];
  for (const p of g) { const q = projectCity(p.lat, p.lon); out.push(q.x, q.z); }
  return out;
}
export const projPt = (lat: number, lon: number): [number, number] => { const q = projectCity(lat, lon); return [q.x, q.z]; };
export const projRawPt = (lat: number, lon: number): [number, number] => { const q = projectRaw(lat, lon); return [q.x, q.z]; };
export const unprojPt = (x: number, z: number) => unproject({ x, z });

/** The hero slab (district.ts), as a flat ring. */
export const SLAB: Ring = DISTRICT.slab.flatMap(p => [p.x, p.z]);
export const inSlab = (x: number, z: number) => pointInRing(x, z, SLAB);
export function slabEdgeDist(x: number, z: number): { d: number; nx: number; nz: number } {
  let best = Infinity, bx = 0, bz = 0;
  const n = SLAB.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = SLAB[j * 2], az = SLAB[j * 2 + 1], cx = SLAB[i * 2], cz = SLAB[i * 2 + 1];
    const d2 = segDist2(x, z, ax, az, cx, cz);
    if (d2 < best) {
      best = d2;
      const dx = cx - ax, dz = cz - az, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      bx = ax + dx * t; bz = az + dz * t;
    }
  }
  return { d: Math.sqrt(best), nx: bx, nz: bz };
}
export const SLAB_BBOX = (() => {
  const xs = DISTRICT.slab.map(p => p.x), zs = DISTRICT.slab.map(p => p.z);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
})();
export const heroGround = (x: number, z: number) => hillHeight(x, z);
