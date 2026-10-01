/**
 * Wave 8 · lane H · the door-to-street rule for the trick-or-treat doors (halloween/treatDoors.ts), shared by
 * tests/opus-bay-w8-h-doors.test.ts and scripts/opus-sf/halloween-doors.mts (`--fix`). Node only (the published city
 * on disk through tests/opus-bay-sf-disk.ts, with the city terrain set).
 *
 * A door stands on its OWN street's frontage when, walking straight out of it (its facing), every step is standable
 * ground (no wall, no other house, no fence) until the roadway, the roadway comes within FRONT_MAX u of the door, and
 * the street there is the door's own (its centreline the nearest named one at the kerb). Wave 6 placed a door on any
 * face roughly parallel to the street within 7 u of its centreline: some ended on a cross street's sidewalk at a corner,
 * on the side of a house, or behind the front row (W8-H: the check over all six streets).
 */
import type { ChunkData } from '../src/opus-bay/world/sf/format';

export interface P { x: number; z: number }
export interface Road { name: string; pts: P[] }

/** the roadway must come within this of the door (u): wall → pavement (the knock spot at 0.9) → the kerb */
export const FRONT_MAX = 4.2;
/** the door's facing must be this square to its street (|cos| of the angle between the facing and the street's normal) */
export const SQUARE_MIN = 0.8;

const segNear = (p: P, a: P, b: P) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  const qx = a.x + t * dx, qz = a.z + t * dz;
  return { d: Math.hypot(p.x - qx, p.z - qz), ex: dx, ez: dz };
};

/** The nearest named road to p among `roads` (optionally only `name` / only others), with its local direction. */
export function nearestRoad(roads: readonly Road[], p: P, only?: (name: string) => boolean): { d: number; name: string; dir: P } | null {
  let best: { d: number; name: string; dir: P } | null = null;
  for (const r of roads) {
    if (only && !only(r.name)) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const s = segNear(p, r.pts[i - 1], r.pts[i]);
      if (!best || s.d < best.d) { const l = Math.hypot(s.ex, s.ez) || 1; best = { d: s.d, name: r.name, dir: { x: s.ex / l, z: s.ez / l } }; }
    }
  }
  return best;
}

/** Every named road polyline of the chunks within `radius` of (x, z). */
export function roadsOf(chunks: readonly ChunkData[], names: readonly string[]): Road[] {
  const out: Road[] = [];
  for (const ch of chunks) {
    const r = ch.roads;
    for (let i = 0; i < r.count; i++) {
      if (r.nameIdx[i] === 0xffff) continue;
      const pts: P[] = [];
      for (let p = r.pStart[i]; p < r.pStart[i + 1]; p++) pts.push({ x: r.xyz[p * 3], z: r.xyz[p * 3 + 2] });
      out.push({ name: names[r.nameIdx[i]], pts });
    }
  }
  return out;
}

export interface Ground {
  canStand(x: number, z: number, radius: number): boolean;
  surfaceAt(x: number, z: number): string | null;
}


/** the walk from the knock spot to its own street must be at most this long (u, on the 0.25 u grid, 8-connected) */
export const WALK_MAX = 18;
/** "at its own street": within this of the street's centreline (the roadway and the kerb) */
export const AT_STREET = 3.2;
/** the player's disc on the walk */
export const WALKER_R = 0.3;

/**
 * The walking distance (u) from a door's knock spot to its own street (a standable cell within AT_STREET of the
 * street's centreline), on a 0.25 u grid of standable cells for the player's disc (8-connected), or null when the
 * street is not reached within WALK_MAX: the door would stand in a back yard, inside a block or behind a wall.
 */
export function walkToStreet(knock: P, street: string, roads: readonly Road[], ground: Ground): number | null {
  const C = 0.25, R = Math.ceil(WALK_MAX / C) + 2, N = 2 * R + 1;
  const dist = new Float32Array(N * N).fill(Infinity);
  const ok = new Int8Array(N * N); // 0 unknown, 1 standable, -1 not
  const at = (i: number, j: number) => ({ x: knock.x + (i - R) * C, z: knock.z + (j - R) * C });
  const stand = (k: number) => {
    if (!ok[k]) { const p = at(k % N, Math.floor(k / N)); ok[k] = ground.canStand(p.x, p.z, WALKER_R) ? 1 : -1; }
    return ok[k] === 1;
  };
  const own = (p: P) => (nearestRoad(roads, p, n => n === street)?.d ?? Infinity) <= AT_STREET;
  // Dijkstra on a small grid (a binary heap would be faster; the grid is ≤ 147² and most cells are never reached)
  const start = R * N + R;
  dist[start] = 0;
  const open: number[] = [start];
  const steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]] as const;
  while (open.length) {
    let bi = 0;
    for (let q = 1; q < open.length; q++) if (dist[open[q]] < dist[open[bi]]) bi = q;
    const k = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    const d = dist[k];
    if (d * C > WALK_MAX) break;
    const i = k % N, j = Math.floor(k / N);
    if (own(at(i, j))) return d * C;
    for (const [di, dj, w] of steps) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = nj * N + ni;
      if (!stand(nk)) continue;
      const nd = d + w;
      if (nd < dist[nk]) { if (dist[nk] === Infinity) open.push(nk); dist[nk] = nd; }
    }
  }
  return null;
}

/** the door must face its street at least this much (cos of the angle between its facing and the way to the street) */
export const FACE_MIN = 0.5;

/**
 * Why a door is not a good trick-or-treat door of `street` (null: it is): its knock spot is not reachable from its own
 * street within WALK_MAX, or it faces away from its street, or another named street is nearer to it than its own by
 * more than 1 u (it belongs to that street's frontage — W7-G7 found a Clayton St house among Belvedere's doors).
 */
export function doorProblem(door: P & { f: number }, knockOut: number, street: string, roads: readonly Road[], ground: Ground): string | null {
  const s = Math.sin(door.f), c = Math.cos(door.f);
  const own = nearestRoad(roads, door, n => n === street);
  if (!own) return `no ${street} centreline near`;
  // another street the door FRONTS (in front of it, square to its facing) nearer than its own by more than 1 u: the
  // door belongs to that street's frontage (W7-G7: a Clayton St face among Belvedere's doors). A cross street at a corner
  // house (beside the door, along its facing) is fine.
  for (const r of roads) {
    if (r.name === street) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], ex = b.x - a.x, ez = b.z - a.z, el = Math.hypot(ex, ez) || 1;
      const t = Math.max(0, Math.min(1, ((door.x - a.x) * ex + (door.z - a.z) * ez) / (el * el)));
      const qx = a.x + t * ex, qz = a.z + t * ez, d = Math.hypot(door.x - qx, door.z - qz);
      if (d + 1 >= own.d) continue;
      const square = Math.abs(s * (-ez / el) + c * (ex / el));
      const ahead = (s * (qx - door.x) + c * (qz - door.z)) / (d || 1);
      if (square >= 0.8 && ahead > 0.5) return `fronts ${r.name} (${d.toFixed(1)} u) rather than ${street} (${own.d.toFixed(1)} u)`;
    }
  }
  // the way to the street: the normal of its local direction, pointing from the door to the centreline
  let nx = -own.dir.z, nz = own.dir.x;
  const probe = nearestRoad(roads, { x: door.x + nx * 0.5, z: door.z + nz * 0.5 }, n => n === street);
  if (probe && probe.d > own.d) { nx = -nx; nz = -nz; }
  const face = s * nx + c * nz;
  if (face < FACE_MIN) return `faces away from ${street} (${face.toFixed(2)})`;
  const walk = walkToStreet({ x: door.x + s * knockOut, z: door.z + c * knockOut }, street, roads, ground);
  if (walk === null) return `the knock spot does not reach ${street} within ${WALK_MAX} u`;
  return null;
}
