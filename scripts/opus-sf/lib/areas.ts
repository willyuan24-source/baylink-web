// Landcover (parks, grass, woods, sand, lakes, piers, plazas, parking, golf …) as classified city-frame polygons.
import { AREA_CLASSES, type AreaClass } from '../../../src/opus-bay/world/sf/format';
import { type Ring, centroid, ringArea, simplifyRing, pointInRing, SpatialHash, bbox } from './geom';
import { elements, joinRings, type OsmElement } from './io';
import { type Land } from './land';
import { type PlazaArea } from './roads';
import { inDomain, inSlab, projGeom } from './world';

export interface AreaPoly {
  cls: AreaClass;
  /** outer ring first, then holes */
  rings: Ring[];
  area: number;
  osmId: number;
  name: string;
}

function classify(t: Record<string, string>): AreaClass | null {
  if (t.man_made === 'pier') return 'pier';
  if (t.leisure === 'golf_course') return 'golf';
  if (t.natural === 'water' || t.landuse === 'reservoir' || t.landuse === 'basin' || (t.water && t.natural !== 'wetland')) return 'water';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'forest';
  if (t.natural === 'sand' || t.natural === 'beach') return 'sand';
  if (t.natural === 'scrub' || t.natural === 'heath' || t.natural === 'shrubbery' || t.natural === 'wetland') return 'scrub';
  if (t.natural === 'bare_rock' || t.natural === 'scree') return 'rock';
  if (t.leisure === 'park' || t.leisure === 'nature_reserve' || t.leisure === 'recreation_ground' || t.landuse === 'recreation_ground' || t.leisure === 'common' || t.leisure === 'dog_park') return 'park';
  if (t.leisure === 'pitch' || t.leisure === 'track' || t.leisure === 'playground' || t.leisure === 'sports_centre' && !t.building) return 'pitch';
  if (t.landuse === 'grass' || t.landuse === 'meadow' || t.landuse === 'village_green' || t.landuse === 'flowerbed' || t.natural === 'grassland' || t.leisure === 'garden') return 'grass';
  if (t.amenity === 'parking' && (t.parking === undefined || t.parking === 'surface') && !t.building) return 'parking';
  if (t.place === 'square' || t['area:highway'] === 'pedestrian' || t.highway === 'pedestrian') return 'plaza';
  return null;
}

function ringsOf(e: OsmElement): { outer: Ring[]; inner: Ring[] } {
  if (e.type === 'way' && e.geometry && e.geometry.length >= 4) {
    const g = e.geometry;
    const closed = g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
    return closed ? { outer: [projGeom(g.slice(0, -1))], inner: [] } : { outer: [], inner: [] };
  }
  if (e.type === 'relation' && e.members) {
    const outer = joinRings(e.members.filter(m => m.type === 'way' && m.role === 'outer' && m.geometry).map(m => m.geometry!)).map(projGeom);
    const inner = joinRings(e.members.filter(m => m.type === 'way' && m.role === 'inner' && m.geometry).map(m => m.geometry!)).map(projGeom);
    return { outer, inner };
  }
  return { outer: [], inner: [] };
}

export interface Areas { list: AreaPoly[]; pierHash: SpatialHash; piers: AreaPoly[]; lakeHash?: SpatialHash; lakes?: AreaPoly[] }

export function loadAreas(land: Land, plazas: PlazaArea[], log: (s: string) => void): Areas {
  const list: AreaPoly[] = [];
  const counts: Record<string, number> = {};
  const add = (cls: AreaClass, outer: Ring, inner: Ring[], osmId: number, name: string) => {
    const r = simplifyRing(outer, 0.2);
    if (r.length < 6) return;
    const a = ringArea(r);
    if (a < (cls === 'pier' ? 2 : 6)) return;
    const [cx, cz] = centroid(r);
    if (!inDomain(cx, cz)) return;
    // the hero slab owns everything inside it (its own piers, plazas and water)
    if (inSlab(cx, cz)) return;
    // SF only: land classes need land under the centroid (or most of the ring); piers need to touch SF land or the boundary
    if (cls === 'pier') {
      let near = false;
      for (let k = 0; k < r.length && !near; k += 2) if (land.inside.at(r[k], r[k + 1]) === 1) near = true;
      if (!near) return;
    } else {
      let onLand = 0, n = 0;
      for (let k = 0; k < r.length; k += 2) { n++; if (land.grid.at(r[k], r[k + 1]) === 1) onLand++; }
      if (land.grid.at(cx, cz) !== 1 && onLand < n * 0.5) return;
    }
    const holes = inner.filter(h => h.length >= 6 && pointInRing(h[0], h[1], outer)).map(h => simplifyRing(h, 0.2)).filter(h => h.length >= 6 && ringArea(h) > 2);
    list.push({ cls, rings: [r, ...holes], area: a, osmId, name });
    counts[cls] = (counts[cls] ?? 0) + 1;
  };
  for (const e of elements('landcover')) {
    const t = e.tags ?? {};
    const cls = classify(t);
    if (!cls) continue;
    const { outer, inner } = ringsOf(e);
    for (const o of outer) add(cls, o, inner, e.id, t.name ?? '');
  }
  for (const p of plazas) add('plaza', p.xz, [], p.id, '');
  const piers = list.filter(a => a.cls === 'pier');
  const pierHash = new SpatialHash(16);
  piers.forEach((p, i) => { const [x0, z0, x1, z1] = bbox(p.rings[0]); pierHash.insert(i, x0, z0, x1, z1); });
  log(`areas: ${list.length} polygons ${JSON.stringify(counts)}`);
  return { list, pierHash, piers };
}

/** Inside a lake / pool / reservoir polygon (landcover water on SF land). */
export function inLake(a: Areas, x: number, z: number): boolean {
  if (!a.lakeHash) {
    a.lakeHash = new SpatialHash(16);
    a.lakes = a.list.filter(p => p.cls === 'water');
    a.lakes.forEach((p, i) => { const [x0, z0, x1, z1] = bbox(p.rings[0]); a.lakeHash!.insert(i, x0, z0, x1, z1); });
  }
  for (const i of a.lakeHash.query(x, z, x, z)) { const p = a.lakes![i]; if (pointInRing(x, z, p.rings[0]) && !p.rings.slice(1).some(h => pointInRing(x, z, h))) return true; }
  return false;
}

export function onPier(a: Areas, x: number, z: number): boolean {
  for (const i of a.pierHash.query(x, z, x, z)) if (pointInRing(x, z, a.piers[i].rings[0])) return true;
  return false;
}

/** Paint order of area classes after land / water (later paints over earlier). */
export const AREA_ORDER: AreaClass[] = ['park', 'golf', 'forest', 'scrub', 'grass', 'pitch', 'sand', 'rock', 'parking', 'plaza', 'water', 'pier'];
export const areaCode = (c: AreaClass) => AREA_CLASSES.indexOf(c);
