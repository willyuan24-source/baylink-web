import { sfLandmarkInfo } from '../../../data/sf/landmarks';
import { GGB } from './golden-gate-bridge';
import { SF_LANDMARKS, type SfLandmark, landmarkToWorld, sfLandmark } from './index';

/**
 * Landmark helpers other lanes code against (lane D2 owns this file from wave 2; plan D2-01 / D2-10 / D2-12, landed as
 * day-0 contracts by the day-0 review). DECLARATIVE like the registry: data and maths only, no loader or material
 * imports (actors/moveSystem.ts and node tests import it). D2 refines the answers; the signatures stay.
 *
 *   landmarkTallStructures(baseOf)   glide obstacles in world space (E2 switches moveSystem's city list to it). Day 0:
 *                                    exactly what moveSystem.cityTallStructures computes today (landmarks ≥ 10 u from
 *                                    data/sf/landmarks height.u, overlooks skipped, the Golden Gate Bridge as its two
 *                                    towers, r 4, top + 2); D2-10 adds per-part radii and tops (Sutro r ≈ 6, …)
 *   sfLandmarkAnchor(id)             the world arrival spot of a landmark (data/sf/landmarks `arrival`, placed with
 *                                    landmarkToWorld; heading in world yaw) for G1's `?at=lm-<id>`, fast travel and G2
 *   landmarkPlazaSpots()             world points on landmark plazas where F's crowd may stand / walk. Day 0: none
 *                                    (D2-09 dressing fills it)
 */

/** A vertical obstacle for the pelican glide: world centre, radius and top (world y). */
export interface LandmarkTall { id: string; x: number; z: number; r: number; top: number }

export function landmarkTallStructures(baseOf: (l: SfLandmark) => number): LandmarkTall[] {
  const out: LandmarkTall[] = [];
  for (const l of SF_LANDMARKS) {
    const h = sfLandmarkInfo(l.id)?.height;
    if (!h || h.rule === 'overlook' || h.u < 10) continue;
    if (l.id === 'golden-gate-bridge') {
      for (const x of [-GGB.TOWER, GGB.TOWER]) { const p = landmarkToWorld(l, { x, z: 0 }); out.push({ id: l.id, x: p.x, z: p.z, r: 4, top: GGB.TOP + 2 }); }
      continue;
    }
    out.push({ id: l.id, x: l.x, z: l.z, r: 4, top: baseOf(l) + h.u + 2 });
  }
  return out;
}

/** World arrival spot of landmark `id` (walkable, outside its blockers), or null for an unknown id. */
export function sfLandmarkAnchor(id: string): { x: number; z: number; heading: number } | null {
  const l = sfLandmark(id), info = sfLandmarkInfo(id);
  if (!l || !info) return null;
  const p = landmarkToWorld(l, info.arrival);
  return { x: p.x, z: p.z, heading: info.arrival.heading + l.yaw };
}

/** A spot on a landmark plaza (world), for crowds and props. */
export interface LandmarkPlazaSpot { id: string; x: number; z: number }

/** Every landmark's plaza spots in world space. Day 0: none. */
export function landmarkPlazaSpots(): LandmarkPlazaSpot[] {
  return [];
}
