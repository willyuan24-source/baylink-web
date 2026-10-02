/**
 * Wave 8 · lane H · the door-to-street rule for the trick-or-treat doors (halloween/treatDoors.ts), shared by
 * tests/opus-bay-w8-h-doors.test.ts and scripts/opus-sf/halloween-doors.mts (`--fix`). Node only (the published city
 * on disk through tests/opus-bay-sf-disk.ts, with the city terrain set).
 *
 * A door stands on its OWN street's frontage (doorProblem) when:
 *   - it does not front another named street that is nearer to it than its own by more than 1 u (square to its facing
 *     — SQUARE_MIN — and in front of it);
 *   - it faces its street (FACE_MIN);
 *   - its knock spot reaches its street on foot (walkToStreet: a shortest walk on a 0.25 u grid of cells where the
 *     player's disc stands, ≤ WALK_MAX, to within AT_STREET of the centreline);
 *   - (W8-H-review) that walk is the way out of the door, not round another house: at most DETOUR_MAX longer than the
 *     straight distance from the knock spot to AT_STREET of the centreline (W8-H's 18 u let four doors through that sit
 *     behind a neighbour's house, a 6.5–12.8 u walk round it);
 *   - (W8-H-review) straight out of the door (its facing) there is a roadway within RAY_MAX of the knock spot, and that
 *     roadway is not a cross street's corner the door belongs to (its nearest centreline another street that is nearer
 *     the door than its own by more than CORNER_GAP): a door facing a gap between two houses, or diagonally into a
 *     junction from a cross street's face, is not its street's door.
 * Not a straight standable line to the kerb: toy houses have porches, stoops and parked cars at the kerb, and 32 of 53
 * doors failed such a ray while plainly reachable round a step or a car (W8-H decisions). Wave 6 placed a door on any
 * face roughly parallel to the street within 7 u of its centreline: some ended on a cross street's sidewalk at a corner,
 * on the side of a house, or behind the front row (W8-H: the check over all six streets).
 */
import type { ChunkData } from '../src/opus-bay/world/sf/format';

export interface P { x: number; z: number }
export interface Road { name: string; pts: P[] }

/** another street counts as one the door FRONTS when it is this square to the door's facing (|cos| of the angle) */
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
      if (square >= SQUARE_MIN && ahead > 0.5) return `fronts ${r.name} (${d.toFixed(1)} u) rather than ${street} (${own.d.toFixed(1)} u)`;
    }
  }
  // the way to the street: the normal of its local direction, pointing from the door to the centreline
  let nx = -own.dir.z, nz = own.dir.x;
  const probe = nearestRoad(roads, { x: door.x + nx * 0.5, z: door.z + nz * 0.5 }, n => n === street);
  if (probe && probe.d > own.d) { nx = -nx; nz = -nz; }
  const face = s * nx + c * nz;
  if (face < FACE_MIN) return `faces away from ${street} (${face.toFixed(2)})`;
  const knock = { x: door.x + s * knockOut, z: door.z + c * knockOut };
  const walk = walkToStreet(knock, street, roads, ground);
  if (walk === null) return `the knock spot does not reach ${street} within ${WALK_MAX} u`;
  // W8-H-review: the walk is the way out of the door, not round a neighbour's house
  const straight = Math.max(0, (nearestRoad(roads, knock, n => n === street)?.d ?? 0) - AT_STREET);
  if (walk - straight > DETOUR_MAX) return `the knock spot reaches ${street} only round another house (a ${walk.toFixed(1)} u walk for ${straight.toFixed(1)} u straight)`;
  // W8-H-review: straight out of the door, a roadway — its own street's, not a cross street's corner
  const road = firstRoadway(knock, s, c, ground);
  if (!road) return `no roadway within ${RAY_MAX} u straight out of the door (the side of a house, a gap between two)`;
  const there = nearestRoad(roads, road);
  if (there && there.name !== street) {
    const other = nearestRoad(roads, door, n => n === there.name);
    if (other && other.d + CORNER_GAP < own.d) return `faces ${there.name}'s roadway, its corner (${other.d.toFixed(1)} u from ${there.name}, ${own.d.toFixed(1)} u from ${street})`;
  }
  return null;
}

/** (W8-H-review) the walk to the street may be at most this much longer than the straight distance (u) */
export const DETOUR_MAX = 3.5;
/** (W8-H-review) straight out of the door a roadway within this of the knock spot (u) */
export const RAY_MAX = 6;
/** (W8-H-review) a cross street the door's roadway belongs to, nearer the door than its own by more than this (u) */
export const CORNER_GAP = 2;

/** (W8-H-review) the first roadway point straight out from (x, z) along (dx, dz), 0.1 u steps up to RAY_MAX, or null */
export function firstRoadway(from: P, dx: number, dz: number, ground: Ground): P | null {
  for (let t = 0; t <= RAY_MAX + 1e-6; t += 0.1) {
    const p = { x: from.x + dx * t, z: from.z + dz * t };
    if (ground.surfaceAt(p.x, p.z) === 'road') return p;
  }
  return null;
}
