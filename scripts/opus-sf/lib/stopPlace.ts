// Wave 4 · lane T: where stop poles and Metro kiosks can stand in the built city (the published chunks + the hero).
// The toy streets are narrow (a residential right-of-way is 3.6 u, buildings close behind the kerb), so a prop placed at
// a fixed offset lands in a house or in the next street. This index answers "how far is (x, z) from the nearest building
// footprint / car-road edge" from exactly what the game draws: the chunk buildings and roads of
// public/opus-bay/sf/<v>/c/*.obc and, inside the hero slab, DISTRICT's lots and roadways.
import fs from 'node:fs';
import path from 'node:path';
import { CHUNK } from '../../../src/opus-bay/core/geo';
import { DISTRICT } from '../../../src/opus-bay/data/district';
import { ROAD_CLASSES, decodeChunkFile } from '../../../src/opus-bay/world/sf/format';

const CAR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service']);

interface Ring { x0: number; z0: number; x1: number; z1: number; xz: number[] }
interface Seg { ax: number; az: number; bx: number; bz: number; half: number; cls: string }

export class Clearance {
  private rings: Ring[] = [];
  private segs: Seg[] = [];
  /** street furniture of the chunks (trees, lamps, benches, racks, stop signs), x, z pairs */
  private furn: number[] = [];
  private loaded = new Set<string>();
  private readonly dir: string;

  constructor(chunkDir: string) {
    this.dir = chunkDir;
    // the hero: lots and roadways (the slab's streets are 3.2 u wide in DISTRICT)
    for (const b of DISTRICT.blocks) this.addRing(b.footprint.flatMap(p => [p.x, p.z]));
    for (const r of DISTRICT.roads) {
      if (r.kind !== 'roadway') continue;
      for (let i = 1; i < r.points.length; i++) this.segs.push({ ax: r.points[i - 1].x, az: r.points[i - 1].z, bx: r.points[i].x, bz: r.points[i].z, half: r.width / 2, cls: 'hero' });
    }
  }

  private addRing(xz: number[]) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < xz.length; i += 2) { x0 = Math.min(x0, xz[i]); x1 = Math.max(x1, xz[i]); z0 = Math.min(z0, xz[i + 1]); z1 = Math.max(z1, xz[i + 1]); }
    this.rings.push({ x0, z0, x1, z1, xz });
  }

  /** Load the chunks within `r` u of each point (async: the files are gzipped). */
  async prepare(points: { x: number; z: number }[], r = 40): Promise<void> {
    const want = new Set<string>();
    for (const p of points) for (let dx = -r; dx <= r; dx += r) for (let dz = -r; dz <= r; dz += r) want.add(`${Math.floor((p.x + dx) / CHUNK)}_${Math.floor((p.z + dz) / CHUNK)}`);
    for (const k of [...want].sort()) {
      if (this.loaded.has(k)) continue;
      this.loaded.add(k);
      const file = path.join(this.dir, `${k}.obc`);
      if (!fs.existsSync(file)) continue;
      const c = await decodeChunkFile(new Uint8Array(fs.readFileSync(file)));
      const B = c.buildings;
      for (let i = 0; i < B.count; i++) {
        const a = B.vStart[i], b = i + 1 < B.count ? B.vStart[i + 1] : B.xz.length / 2;
        this.addRing(Array.from(B.xz.subarray(a * 2, b * 2)));
      }
      for (let i = 0; i < c.props.count; i++) this.furn.push(c.props.xz[i * 2], c.props.xz[i * 2 + 1]);
      const R = c.roads;
      for (let i = 0; i < R.count; i++) {
        const cls = ROAD_CLASSES[R.cls[i]];
        if (!CAR.has(cls)) continue;
        const a = R.pStart[i], b = i + 1 < R.count ? R.pStart[i + 1] : R.xyz.length / 3;
        for (let k2 = a + 1; k2 < b; k2++) this.segs.push({ ax: R.xyz[k2 * 3 - 3], az: R.xyz[k2 * 3 - 1], bx: R.xyz[k2 * 3], bz: R.xyz[k2 * 3 + 2], half: R.width[i] / 2, cls });
      }
    }
  }

  /** Distance from (x, z) to the nearest building footprint (negative inside one), up to `max`. */
  building(x: number, z: number, max = 12): number {
    let best = max;
    for (const r of this.rings) {
      if (x < r.x0 - max || x > r.x1 + max || z < r.z0 - max || z > r.z1 + max) continue;
      const xz = r.xz, n = xz.length / 2;
      let inside = false, d = Infinity;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = xz[i * 2], zi = xz[i * 2 + 1], xj = xz[j * 2], zj = xz[j * 2 + 1];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
        d = Math.min(d, segDist(x, z, xi, zi, xj, zj));
      }
      best = Math.min(best, inside ? -d : d);
    }
    return best;
  }

  /** Distance from (x, z) to the nearest piece of street furniture (a tree trunk, a lamp, a bench …), up to `max`. */
  furniture(x: number, z: number, max = 8): number {
    let best = max;
    const f = this.furn;
    for (let i = 0; i < f.length; i += 2) {
      const dx = f[i] - x, dz = f[i + 1] - z;
      if (dx > max || dx < -max || dz > max || dz < -max) continue;
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  }

  /** Distance from (x, z) to the nearest car-road EDGE (negative on a roadway), and that road's half width. */
  road(x: number, z: number, max = 12): { d: number; half: number } {
    let best = { d: max, half: 0 };
    for (const s of this.segs) {
      if (Math.min(s.ax, s.bx) - max > x || Math.max(s.ax, s.bx) + max < x || Math.min(s.az, s.bz) - max > z || Math.max(s.az, s.bz) + max < z) continue;
      const d = segDist(x, z, s.ax, s.az, s.bx, s.bz) - s.half;
      if (d < best.d) best = { d, half: s.half };
    }
    return best;
  }

  /** Nearest point on a car road's centreline (for facing a prop to the street). */
  nearestRoadPoint(x: number, z: number): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null, bd = Infinity;
    for (const s of this.segs) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
      const px = s.ax + dx * t, pz = s.az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; best = { x: px, z: pz }; }
    }
    return best;
  }
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

/**
 * A pole beside a vehicle stopped at arc `at` of a path: right of the path direction (`side` 1) or left (−1), just
 * outside the road the vehicle is on, clear of buildings and other roads. Tries shifts along the path (near-side first)
 * and offsets outward; returns null when nothing within ±12 u fits. `ok` (integration review): the spot must also be
 * ground the player can walk to from the street (transit-sidecar.ts floods the game's own walk terrain): a gap between
 * two building footprints behind the kerb passed the clearances and walled the pole in (21 of the 60 wave-4 stops).
 */
export function placePole(c: Clearance, at: (s: number) => { x: number; z: number; heading: number }, s0: number, side: 1 | -1, r = 0.3, minOff = 1.4, ok?: (x: number, z: number) => boolean): { x: number; z: number; shift: number } | null {
  for (const shift of [0, -2, 2, -4, 4, -6, 6, -8, 8, -10, 10, -12, 12]) {
    const p = at(s0 + shift);
    const nx = -Math.cos(p.heading) * side, nz = Math.sin(p.heading) * side;
    for (let off = minOff; off <= 7; off += 0.2) {
      const x = p.x + nx * off, z = p.z + nz * off;
      if (c.road(x, z).d >= r && c.building(x, z) >= r + 0.15 && c.furniture(x, z) >= r + 0.35 && (!ok || ok(x, z))) return { x, z, shift };
    }
  }
  return null;
}

/**
 * A free spot for a kiosk of radius `r` near (x0, z0) (≤ `maxR` u), by a sidewalk: closest first, near a street. `ok`: as
 * placePole's (the best-scoring spots are tried in turn until one is joined to the street; the Castro kiosk stood in a
 * walled courtyard).
 */
export function placeKiosk(c: Clearance, x0: number, z0: number, r = 1.45, maxR = 30, ok?: (x: number, z: number) => boolean): { x: number; z: number; d: number; heading: number } | null {
  const all: { x: number; z: number; d: number; score: number }[] = [];
  const step = maxR > 32 ? 1 : 0.5;
  for (let dx = -maxR; dx <= maxR; dx += step) {
    for (let dz = -maxR; dz <= maxR; dz += step) {
      const d = Math.hypot(dx, dz);
      if (d > maxR) continue;
      const x = x0 + dx, z = z0 + dz;
      const road = c.road(x, z);
      if (road.d < r + 0.1 || road.d > r + 4) continue;
      if (c.building(x, z) < r + 0.15) continue;
      // tree trunks / lamps: their canopies and heads would cut through the kiosk's canopy
      if (c.furniture(x, z) < r + 0.8) continue;
      const score = d + 0.6 * Math.max(0, road.d - r - 0.6);
      all.push({ x, z, d, score });
    }
  }
  all.sort((a, b) => a.score - b.score || a.x - b.x || a.z - b.z);
  const best = ok ? all.find(q => ok(q.x, q.z)) : all[0];
  if (!best) return null;
  const q = c.nearestRoadPoint(best.x, best.z);
  const heading = q ? Math.atan2(q.x - best.x, q.z - best.z) : 0;
  return { x: best.x, z: best.z, d: best.d, heading };
}

/**
 * (integration review) The fallback when no spot off the road is joined to the street (the toy streets' buildings stand
 * right at the kerb: the Haight, the Painted Ladies, Duboce & Church and the outer Judah stops had none): the nearest
 * spot within `maxR` of (x0, z0) that `ok` accepts (joined walkable ground, the roadway included), at least `clear` u
 * from every vehicle path (`paths`: the vehicle's body and the prop's radius), clear of buildings and street furniture.
 */
export function placeOnStreet(c: Clearance, x0: number, z0: number, r: number, clear: number, paths: readonly (readonly number[])[], ok: (x: number, z: number) => boolean, maxR = 12, canopy = 0.35): { x: number; z: number } | null {
  // the path segments near (x0, z0), as [ax, az, bx, bz] quads
  const m = maxR + clear + 1, near: number[] = [];
  for (const p of paths) {
    for (let i = 3; i + 2 < p.length; i += 3) {
      const ax = p[i - 3], az = p[i - 1], bx = p[i], bz = p[i + 2];
      if (Math.max(ax, bx) < x0 - m || Math.min(ax, bx) > x0 + m || Math.max(az, bz) < z0 - m || Math.min(az, bz) > z0 + m) continue;
      near.push(ax, az, bx, bz);
    }
  }
  const toPath = (x: number, z: number) => { let d = Infinity; for (let i = 0; i < near.length; i += 4) d = Math.min(d, segDist(x, z, near[i], near[i + 1], near[i + 2], near[i + 3])); return d; };
  const cands: { x: number; z: number; d: number }[] = [];
  for (let dx = -maxR; dx <= maxR; dx += 0.5) for (let dz = -maxR; dz <= maxR; dz += 0.5) { const d = Math.hypot(dx, dz); if (d <= maxR) cands.push({ x: x0 + dx, z: z0 + dz, d }); }
  cands.sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z);
  for (const q of cands) {
    if (toPath(q.x, q.z) < clear || c.building(q.x, q.z) < r + 0.15 || c.furniture(q.x, q.z) < r + canopy || !ok(q.x, q.z)) continue;
    return { x: q.x, z: q.z };
  }
  return null;
}
