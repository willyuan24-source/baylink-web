import type { Bilingual, Vec2 } from '../core/types';
import { LOMBARD, lombardCrookedStreet } from '../world/sf/landmarks/lombard-crooked-street';
import { vermontStreetCrookedBlock } from '../world/sf/landmarks/vermont-street-crooked-block';

/**
 * Wave 5 · lane A · the two crooked blocks for the gentle descent (W5-A9, plan §3.2 A-toys): Lombard Street between Hyde
 * and Leavenworth (lane L's landmark: its lane, local +z downhill) and Vermont Street between 20th and 22nd (lane L3's
 * site: its lane, the OSM line; copied here top → bottom, the site keeps it private). World polylines, top first.
 *
 * Facts (Wikipedia, checked 2026-09-28): Lombard's crooked block has eight hairpin turns, is one-way downhill, and "the
 * sign at the top recommends 5 mph" (https://en.wikipedia.org/wiki/Lombard_Street_(San_Francisco)); Vermont Street has
 * seven sharp turns between 20th and 22nd and was measured more crooked, "a sinuosity of 1.56 versus 1.2 for Lombard"
 * (https://en.wikipedia.org/wiki/Vermont_Street_(San_Francisco)).
 */

export interface CrookedCourse { id: 'lombard' | 'vermont'; name: Bilingual; line: Vec2[] }

function toWorld(o: { x: number; z: number; yaw: number }, p: Vec2): Vec2 {
  const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
  return { x: +(o.x + p.x * c + p.z * s).toFixed(2), z: +(o.z - p.x * s + p.z * c).toFixed(2) };
}

const VERMONT_PATH: Vec2[] = [[0, -7.82], [-0.25, -7.05], [-1.77, -6.59], [-2.1, -5.81], [-1.74, -5.06], [-0.4, -4.75], [0.1, -4.05], [-0.12, -3.36], [-1.76, -2.79], [-2.07, -2.02], [-1.81, -1.45], [-0.05, -0.9], [0.21, -0.5], [0.17, 0.18], [-0.1, 0.58], [-1.62, 1.02], [-1.95, 1.74], [-1.59, 2.49], [-0.25, 2.83], [0.1, 3.14], [0.16, 3.48], [0.1, 4.94], [0.05, 6.38], [0, 7.82]].map(([x, z]) => ({ x, z }));

export const CROOKED: readonly CrookedCourse[] = [
  { id: 'lombard', name: { zh: '九曲花街', en: 'Lombard Street' }, line: LOMBARD.PATH.filter(p => p.z >= LOMBARD.Z_TOP - 0.2 && p.z <= LOMBARD.Z_BOT + 0.2).map(p => toWorld(lombardCrookedStreet, p)) },
  { id: 'vermont', name: { zh: '佛蒙特街', en: 'Vermont Street' }, line: VERMONT_PATH.map(p => toWorld(vermontStreetCrookedBlock, p)) },
];

export const crookedTop = (c: CrookedCourse) => c.line[0];
export const crookedBottom = (c: CrookedCourse) => c.line[c.line.length - 1];
/** Distance from (x, z) to the course's line. */
export function offLine(c: CrookedCourse, x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < c.line.length; i++) {
    const a = c.line[i - 1], b = c.line[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return best;
}
/** How far down the course (0 … 1) the nearest point of its line is. */
export function progressOn(c: CrookedCourse, x: number, z: number): number {
  let best = Infinity, at = 0, run = 0, total = 0;
  for (let i = 1; i < c.line.length; i++) total += Math.hypot(c.line[i].x - c.line[i - 1].x, c.line[i].z - c.line[i - 1].z);
  for (let i = 1; i < c.line.length; i++) {
    const a = c.line[i - 1], b = c.line[i], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), l2 = L * L;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0;
    const d = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
    if (d < best) { best = d; at = run + t * L; }
    run += L;
  }
  return total ? at / total : 0;
}
