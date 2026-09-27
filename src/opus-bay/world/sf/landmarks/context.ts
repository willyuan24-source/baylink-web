import { sfLandmarkInfo } from '../../../data/sf/landmarks';
import type { SiteHooks } from '../sites';
import { SF_LANDMARKS, type SfLandmark, landmarkToWorld, sfLandmark, tallParts } from './index';
import { plazaSpots } from './setting';

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
 *   landmarkPlazaSpots()             world points on landmark plazas where F's crowd may stand / walk (D2-09): each
 *                                    landmark's SiteHooks `plaza` polygons sampled on a PLAZA_SPACING grid, at most
 *                                    PLAZA_MAX per landmark, spread over its plazas
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

const inside = (p: { x: number; z: number }, poly: readonly { x: number; z: number }[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};
const nearEdge = (p: { x: number; z: number }, poly: readonly { x: number; z: number }[], d: number) => poly.some((a, i) => {
  const b = poly[(i + 1) % poly.length], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t) < d;
});

/** crowd spots on a landmark's plazas: grid spacing (u) and the most per landmark */
export const PLAZA_SPACING = 2.5, PLAZA_MAX = 8;

let spots: LandmarkPlazaSpot[] | null = null;

/** Every landmark's plaza spots in world space (computed once). */
export function landmarkPlazaSpots(): LandmarkPlazaSpot[] {
  if (spots) return spots;
  spots = [];
  for (const l of SF_LANDMARKS) {
    const plaza = (l as SfLandmark & SiteHooks).plaza;
    if (!plaza?.length) continue;
    // never inside the landmark's own blockers (a bench, a bed, the mill's foot), with 0.25 u to spare
    const clear = (p: { x: number; z: number }) => !(l.walk?.blockers ?? []).some(b => ('poly' in b ? inside(p, b.poly) || nearEdge(p, b.poly, 0.25) : Math.hypot(p.x - b.x, p.z - b.z) < b.r + 0.25));
    const all = plazaSpots(plaza.map(q => q.poly), PLAZA_SPACING, 400).filter(clear);
    const n = Math.min(PLAZA_MAX, all.length);
    for (let k = 0; k < n; k++) spots.push({ id: l.id, ...landmarkToWorld(l, all[Math.floor(((k + 0.5) * all.length) / n)]) });
  }
  return spots;
}
