import { sfLandmarkInfo } from '../../../data/sf/landmarks';
import { SF_LANDMARKS, type SfLandmark, landmarkToWorld, sfLandmark, tallParts } from './index';

/**
 * Landmark helpers other lanes code against (lane D2 owns this file from wave 2; plan D2-01 / D2-10 / D2-12, landed as
 * day-0 contracts by the day-0 review). DECLARATIVE like the registry: data and maths only, no loader or material
 * imports (actors/moveSystem.ts and node tests import it). D2 refines the answers; the signatures stay.
 *
 *   landmarkTallStructures(baseOf)   glide obstacles in world space (E2's moveSystem city list). D2-10: every landmark's
 *                                    `tall` parts with the tops measured on the drawn lod 0 (landmarks/tops.ts): the
 *                                    Golden Gate Bridge's four legs (42.5 u) and its cables anchorage to anchorage, Sutro
 *                                    r 6, City Hall's drum and dome, the rotunda, Grace's flèche and towers, the de Young
 *                                    tower, Oracle's light standards, the Legion's dome, the windmill's sail disc,
 *                                    Ghirardelli's clock tower. A landmark ≥ 10 u tall (data/sf/landmarks height.u,
 *                                    overlooks skipped) without tall parts keeps the day-0 circle (r 4, top + 2). The
 *                                    blockers themselves carry measured tops too (core/terrain Blocker.top, via
 *                                    sites.walkInputs), so low landmarks no longer read as 20–24 u walls to the glide
 *   sfLandmarkAnchor(id)             the world arrival spot of a landmark (data/sf/landmarks `arrival`, placed with
 *                                    landmarkToWorld; heading in world yaw) for G1's `?at=lm-<id>`, fast travel and G2
 *   landmarkPlazaSpots()             world points on landmark plazas where F's crowd may stand / walk. Day 0: none
 *                                    (D2-09 dressing fills it)
 */

/** A vertical obstacle for the pelican glide: world centre, radius and top (world y). */
export interface LandmarkTall { id: string; x: number; z: number; r: number; top: number }

/** Clearance added to a measured tall-part top (u): sway of the sails, rounding; the glide keeps its own clearances. */
export const TALL_MARGIN = 0.5;

export function landmarkTallStructures(baseOf: (l: SfLandmark) => number): LandmarkTall[] {
  const out: LandmarkTall[] = [];
  for (const l of SF_LANDMARKS) {
    const parts = tallParts(l);
    if (parts.length) {
      const base = baseOf(l);
      for (const t of parts) { const p = landmarkToWorld(l, t); out.push({ id: l.id, x: p.x, z: p.z, r: t.r, top: base + t.top + TALL_MARGIN }); }
      continue;
    }
    const h = sfLandmarkInfo(l.id)?.height;
    if (!h || h.rule === 'overlook' || h.u < 10) continue;
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
