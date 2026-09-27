import type { AttractionFlag } from '../../../data/sf/attractionTypes';
import type { Vec2 } from '../../../core/types';
import { type SfLandmark, landmarkToWorld, sfLandmark } from './index';
import type { W4Site } from './siteKit';
import { W4_SITES } from './w4list';

/**
 * Wave-4 landmark sites (lane L, plan §2.3 / §5.4): lookups over the new site records, NOT registered yet. The
 * records themselves are listed in w4list.ts, which is what the registry imports at the integration
 * (`SF_LANDMARKS = [...existing, ...W4_SITES]` in landmarks/index.ts): this file reads the registry (sfLandmark,
 * landmarkToWorld), so index.ts must never import it (a cycle that throws at load; see w4list.ts). See
 * docs/opus-bay/sf-w4-L.md "Integration".
 *
 *   W4_SITES                 the records (re-exported from w4list.ts; SfLandmark + SiteHooks + `w4` metadata: placeId,
 *                            attractions, arrival, photo, flag, lod0R, budget, terrain box, AI slot)
 *   w4Site(id)               by site id
 *   w4SiteOf(id)             the site that models an attraction id or a place id
 *   w4SiteByPlace(placeId)   the MAIN record of a place row (several records may share one: CCSF), isMainSite(s)
 *   siteFlagTop(id)          plan §4.2 flag pole for a site, an existing landmark, a district hero (coit-tower,
 *                            ferry-building), an attraction or a place id: WORLD pole foot and pole top over the
 *                            ground there (h 28–70); null when unknown (lane P then uses a 30 u pole at the attraction)
 *   siteLod0R(l)             the lod-0 ring override of a record (undefined: the tier's ring)
 *   siteBudget(l)            its lod-0 triangle cap when tighter than the tier's (downtown diet)
 *
 * Every record carries `sink: 0` (SfLandmark.sink, read by sites.ts landmarkSink): its ground is draped on the unsunk
 * city ground (see siteKit W4Site).
 */

export { W4_SITES };

const byId = new Map(W4_SITES.map(s => [s.id, s]));
const byRef = new Map<string, W4Site>();
for (const s of W4_SITES) {
  for (const a of s.w4.attractions) if (!byRef.has(a)) byRef.set(a, s);
  if (!byRef.has(s.w4.placeId)) byRef.set(s.w4.placeId, s);
}

export const W4_SITE_IDS: readonly string[] = W4_SITES.map(s => s.id);
export function w4Site(id: string): W4Site | undefined { return byId.get(id); }
export function w4SiteOf(ref: string): W4Site | undefined { return byId.get(ref) ?? byRef.get(ref); }

/**
 * The MAIN record of a place row: the first site (build order) that names `placeId`. Places shared by several records
 * (the CCSF Ocean campus: Science Hall `ccsf-ocean` and the arts-center lot `ccsf-drpac`) answer with one record, so a
 * place → landmark-info lookup (data/sf/landmarks sfLandmarkInfoByPlace at the integration) keys on it alone.
 */
export function w4SiteByPlace(placeId: string): W4Site | undefined { return byPlace.get(placeId); }
const byPlace = new Map<string, W4Site>();
for (const s of W4_SITES) if (!byPlace.has(s.w4.placeId)) byPlace.set(s.w4.placeId, s);
/** is this record the main one of its place row (see w4SiteByPlace)? */
export const isMainSite = (s: W4Site) => byPlace.get(s.w4.placeId) === s;

/** plan §4.2: pole top = skyline + 10 u clamped to 70; a site lower than that reads with a 30 u pole */
export const flagHeight = (skylineU: number) => (skylineU + 10 >= 28 ? Math.min(70, +(skylineU + 10).toFixed(2)) : 30);

/**
 * Flag poles of the existing landmarks (LOCAL foot + h), measured on their lod-0 models (the highest vertex; the
 * test re-measures): the Golden Gate Bridge on its south tower top + 8, City Hall over its dome, the de Young over the
 * Hamon tower, Sutro Tower over its mast; the low ones a 30 u pole at the model.
 */
export const LANDMARK_FLAGS: Readonly<Record<string, { x: number; z: number; h: number }>> = {
  'golden-gate-bridge': { x: -89.2, z: 0, h: 50.2 },
  'sutro-tower': { x: 0.1, z: 2.6, h: 59.65 },
  'city-hall': { x: 0, z: 0.3, h: 30 },
  'de-young-tower': { x: 2.4, z: 2.2, h: 30 },
  'palace-of-fine-arts': { x: 0, z: 0, h: 30 },
  'twin-peaks': { x: 4.8, z: -1.5, h: 30 },
  'painted-ladies': { x: 4.8, z: 1.5, h: 30 },
  'dragon-gate': { x: 0, z: 0, h: 30 },
  'conservatory-of-flowers': { x: 0, z: 0, h: 30 },
  'dutch-windmill': { x: 0, z: 0, h: 30 },
  'mission-dolores': { x: 0.3, z: 3.0, h: 30 },
  'grace-cathedral': { x: 0, z: -1.8, h: 30 },
  'legion-of-honor': { x: 0, z: -2.5, h: 30 },
  'fort-point': { x: -5.2, z: 3.2, h: 30 },
  'castro-theatre': { x: 0.2, z: 4.1, h: 30 },
  'oracle-park': { x: -13.3, z: 4.2, h: 30 },
  'peace-pagoda': { x: 0, z: 0, h: 30 },
  'ghirardelli-square': { x: -7.1, z: -4.1, h: 30 },
  'fishermans-wharf': { x: 0, z: 0, h: 30 },
  'sutro-baths': { x: -7.3, z: -0.5, h: 30 },
  'cliff-house': { x: -3.5, z: 0.2, h: 30 },
  'cable-car-turntable': { x: 0, z: 0, h: 30 },
  'lombard-crooked-street': { x: -4.4, z: -10.1, h: 30 },
  'chase-center': { x: 0, z: 0, h: 30 },
};

/** The district heroes lane P shows as T1 (WORLD foot): Coit Tower (summit ground 20, top + 18.5), the Ferry clock tower (top 36). */
export const HERO_FLAGS: Readonly<Record<string, AttractionFlag>> = {
  'coit-tower': { x: -50.25, z: 51.1, h: 28.5 },
  'ferry-building': { x: 133.51, z: -8.87, h: 46 },
};

/** The places.json rows the existing landmarks answer to (data/sf/landmarks placeId, D2-12) where they differ from the id. */
const LANDMARK_PLACE: Readonly<Record<string, string>> = {
  'ggb-south-tower': 'golden-gate-bridge', 'de-young': 'de-young-tower', 'alamo-square-painted-ladies': 'painted-ladies',
  'chinatown-dragon-gate': 'dragon-gate', 'japantown-peace-pagoda': 'peace-pagoda', 'cable-car-powell-market': 'cable-car-turntable',
  'lombard-crooked': 'lombard-crooked-street',
};

const toWorld = (l: SfLandmark, p: Vec2 & { h: number }): AttractionFlag => {
  const w = landmarkToWorld(l, p);
  return { x: +w.x.toFixed(2), z: +w.z.toFixed(2), h: p.h };
};

export function siteFlagTop(ref: string): AttractionFlag | null {
  const site = w4SiteOf(ref);
  if (site) return toWorld(site, site.w4.flag);
  if (HERO_FLAGS[ref]) return { ...HERO_FLAGS[ref] };
  const id = LANDMARK_PLACE[ref] ?? ref, l = sfLandmark(id), f = LANDMARK_FLAGS[id];
  return l && f ? toWorld(l, f) : null;
}

export function siteLod0R(l: SfLandmark): number | undefined { return (l as Partial<W4Site>).w4?.lod0R; }
export function siteBudget(l: SfLandmark): number | undefined { return (l as Partial<W4Site>).w4?.budget; }
