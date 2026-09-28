import { runtime } from '../core/runtime';
import { canStand, inWorld } from '../core/terrain';
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
export function openRuns(x: number, z: number, o: { dirs: number; reach: number; step: number; radius: number } = FACE_OPEN): number[] {
  const runs: number[] = [];
  for (let i = 0; i < o.dirs; i++) {
    const a = (i / o.dirs) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    let run = 0;
    for (let d = o.step; d <= o.reach + 1e-6; d += o.step) {
      const px = x + dx * d, pz = z + dz * d;
      if (!inWorld(px, pz) || !canStand(px, pz, o.radius)) break;
      run = d;
    }
    runs.push(run);
  }
  return runs;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The heading facing the most open ground round (x, z) and that ray's run (0 everywhere: `prefer` or 0, run 0). */
export function openHeading(x: number, z: number, prefer = 0): { heading: number; run: number } {
  const runs = openRuns(x, z);
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
 * Turn the player at (x, z) toward the most open ground and swing the camera behind them. The player turns only when
 * they stand within 3 u of (x, z) (a landing hands over the spot it put them on). Returns the heading chosen.
 */
export function faceOpen(x: number, z: number): number {
  const p = runtime.player;
  const { heading } = openHeading(x, z, p.heading);
  if (Math.hypot(p.x - x, p.z - z) < 3) p.heading = heading;
  faceCameraToward(x + Math.sin(heading) * 12, z + Math.cos(heading) * 12, { uncapped: true, open: true });
  return heading;
}
