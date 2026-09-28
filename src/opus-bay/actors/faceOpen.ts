import { runtime } from '../core/runtime';
import { canStand, heightAt, inWorld } from '../core/terrain';
import { faceCameraToward } from '../game/cinema';

/**
 * Wave 5 · W5-F7 (plan §2 MF2 "arrivals face open ground") — after a landing or an arrival the player and the camera
 * turn to the longest run of walkable ground, so the first push of the stick walks somewhere instead of into a wall,
 * a railing or the Bay (owner F2: 走不动). Used by the glide landing (actors/moveSystem), lane N's fastTravel landing
 * and arrivals (`faceOpen(x, z)` right after the player is placed), lane T's hop-offs.
 *
 *   openHeading(x, z)   pure: the heading (the controller's convention: forward = (sin h, cos h)) of the most open
 *                       ground round (x, z) and its run; each of 24 rays walks 1.4 u steps up to 28 u while the
 *                       ground is standable (core/terrain canStand, a 0.45 u disc; water, walls, unstreamed city
 *                       chunks end a ray); a ray's score adds half of each neighbour's run, so a wide opening beats a
 *                       narrow gap; ties go to the heading nearest `prefer`.
 *   faceOpen(x, z)      turns the player (when they stand there) and asks the follow camera to swing behind them
 *                       (game/cinema faceCameraToward, `open`: it outranks the camera's own arrival yaw for 3 s).
 */

export const FACE_OPEN = { dirs: 24, reach: 28, step: 1.4, radius: 0.45 } as const;

/** Run of standable ground (u) along each of `dirs` headings from (x, z); ray i has heading 2πi / dirs. */
export function openRuns(x: number, z: number, o: { dirs: number; reach: number; step: number; radius: number } = FACE_OPEN, block?: (x: number, z: number) => boolean): number[] {
  const runs: number[] = [];
  for (let i = 0; i < o.dirs; i++) {
    const a = (i / o.dirs) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    let run = 0;
    for (let d = o.step; d <= o.reach + 1e-6; d += o.step) {
      const px = x + dx * d, pz = z + dz * d;
      if (!inWorld(px, pz) || !canStand(px, pz, o.radius) || block?.(px, pz)) break;
      run = d;
    }
    runs.push(run);
  }
  return runs;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The heading facing the most open ground round (x, z) and that ray's run (0 everywhere: `prefer` or 0, run 0). */
export function openHeading(x: number, z: number, prefer = 0, block?: (x: number, z: number) => boolean): { heading: number; run: number } {
  const runs = openRuns(x, z, FACE_OPEN, block);
  const n = runs.length;
  let best = -1, bestScore = 0, bestTurn = Infinity;
  for (let i = 0; i < n; i++) {
    const score = runs[i] + 0.5 * (runs[(i + n - 1) % n] + runs[(i + 1) % n]);
    const turn = Math.abs(wrap((i / n) * Math.PI * 2 - prefer));
    if (score > bestScore + 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && best >= 0 && turn < bestTurn)) { best = i; bestScore = score; bestTurn = turn; }
  }
  if (best < 0) return { heading: wrap(prefer), run: 0 };
  return { heading: wrap((best / n) * Math.PI * 2), run: runs[best] };
}

/**
 * Turn the player at (x, z) toward the most open ground and swing the camera behind them. `block` (optional) marks
 * what the ground does not know about (the bus or train just left, still at the stop: W5-F11). The player turns only when
 * they stand within 3 u of (x, z) (a landing hands over the spot it put them on). Returns the heading chosen.
 */
export function faceOpen(x: number, z: number, block?: (x: number, z: number) => boolean): number {
  const p = runtime.player;
  const { heading } = openHeading(x, z, p.heading, block);
  if (Math.hypot(p.x - x, p.z - z) < 3) p.heading = heading;
  faceCameraToward(x + Math.sin(heading) * 12, z + Math.cos(heading) * 12, { uncapped: true, open: true });
  return heading;
}

/**
 * openSpot's numbers: each of 3 directions needs this much walkable ground (u, the sweep's 3 u), searched this far (u),
 * no uphill step steeper than this (rise / run; the controller refuses above WALL_GRADE 0.9).
 */
export const OPEN_SPOT = { run: 3, maxR: 6, grade: 0.85 } as const;

/**
 * Walkable ground (standable, and never steeper uphill than the feet climb: OPEN_SPOT.grade) along each of 24 headings
 * from (x, z), up to OPEN_SPOT.run u in 0.5 u steps (pure).
 */
function walkRuns(x: number, z: number): number[] {
  const runs: number[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    let run = 0, h = heightAt(x, z);
    for (let d = 0.5; d <= OPEN_SPOT.run + 1e-6; d += 0.5) {
      const px = x + dx * d, pz = z + dz * d;
      if (!inWorld(px, pz) || !canStand(px, pz, FACE_OPEN.radius)) break;
      const hn = heightAt(px, pz);
      if ((hn - h) / 0.5 > OPEN_SPOT.grade) break;
      h = hn; run = d;
    }
    runs.push(run);
  }
  return runs;
}

/**
 * Walkable ground in at least 3 of 4 directions 90° apart, ≥ OPEN_SPOT.run u each (pure). The four start from the way a
 * landing faces (openHeading) — the sweep's own axes, so a spot this passes is one the sweep passes.
 */
export function openAround(x: number, z: number): boolean {
  if (!inWorld(x, z) || !canStand(x, z, FACE_OPEN.radius)) return false;
  const runs = walkRuns(x, z);
  const h = openHeading(x, z, 0).heading;
  const best = ((Math.round(h / ((Math.PI * 2) / 24)) % 24) + 24) % 24;
  let open = 0;
  for (let k = 0; k < 4; k++) if (runs[(best + k * 6) % 24] >= OPEN_SPOT.run - 1e-6) open++;
  return open >= 3;
}

/**
 * Wave 5 · W5-F11 (the sweep's stuck stops): where to set a rider down near (x, z) — (x, z) itself when it is open
 * (openAround), else the nearest open spot within `maxR` (rings 0.75 u apart), else null (leave them there: BAYBAY's
 * pull and R still help). A Muni Metro pole on a boarding island or a kiosk against a wall boxed the rider in after
 * 直接到站 or an arrival (19 of the 26 surface stops in sweep run 2).
 */
export function openSpot(x: number, z: number, maxR = OPEN_SPOT.maxR): { x: number; z: number } | null {
  if (openAround(x, z)) return { x, z };
  for (let r = 0.75; r <= maxR + 1e-6; r += 0.75) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.75));
    let best: { x: number; z: number } | null = null;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      if (openAround(px, pz)) { best = { x: px, z: pz }; break; }
    }
    if (best) return best;
  }
  return null;
}

