// Step 9b: places.json — the 69 curated landmarks (sf-data/landmarks.json) plus named OSM POIs (viewpoints,
// attractions, museums, peaks, parks, gardens, historic sites, neighbourhoods …). Names and positions only: the
// fact source is the OSM element (sourceUrl); nothing is invented. BAYLINK planner ids only where they exist.
import fs from 'node:fs';
import path from 'node:path';
import * as OpenCC from 'opencc-js';
import type { PlacesFile, SfPlace, SfPlaceKind } from '../../../src/opus-bay/world/sf/format';
import { SF_DATA, elements } from './io';
import { type Land } from './land';
import { type Terrain, heightAt } from './terrain';
import { type Zones, zoneIndexAt } from './zones';
import { inSlab, projPt } from './world';

/** landmarks.json id → planner place id (public/planner-catalog.json `places`) */
const PLANNER: Record<string, string> = {
  'ggb-south-tower': 'golden-gate', 'pier-39': 'pier39', alcatraz: 'alcatraz', 'chinatown-dragon-gate': 'chinatown',
  'palace-of-fine-arts': 'palace', 'golden-gate-park': 'golden-gate-park', presidio: 'presidio',
};

function poiKind(t: Record<string, string>): SfPlaceKind | null {
  if (t.tourism === 'viewpoint') return 'viewpoint';
  if (t.tourism === 'museum' || t.tourism === 'gallery') return 'museum';
  if (t.tourism === 'attraction' || t.tourism === 'zoo' || t.tourism === 'aquarium' || t.tourism === 'theme_park') return 'attraction';
  if (t.natural === 'peak') return 'peak';
  if (t.natural === 'beach') return 'beach';
  if (t.leisure === 'park' || t.leisure === 'nature_reserve') return 'park';
  if (t.leisure === 'garden') return 'garden';
  if (t.leisure === 'stadium') return 'stadium';
  if (t.historic && ['monument', 'ruins', 'building', 'naval', 'fort', 'lighthouse', 'ship', 'castle', 'district'].includes(t.historic)) return 'historic';
  if (t.place === 'neighbourhood' || t.place === 'quarter') return 'neighbourhood';
  if (t.place === 'square') return 'plaza';
  if (t.amenity === 'theatre' || t.amenity === 'marketplace' || t.amenity === 'arts_centre') return 'attraction';
  return null;
}

/**
 * Anchors must stand clearly on SF land or a pier deck (a 1.2 u disc): beach centroids, cliff-edge viewpoints and
 * ruins at the shore move to the nearest such spot within 20 u.
 */
function snapToLand(land: Land, onDeck: (x: number, z: number) => boolean, x: number, z: number, lake: (x: number, z: number) => boolean): [number, number, boolean] {
  const at = (px: number, pz: number) => (land.grid.at(px, pz) === 1 && !lake(px, pz)) || onDeck(px, pz);
  const solid = (px: number, pz: number) => {
    if (!at(px, pz)) return false;
    for (let k = 0; k < 8; k++) if (!at(px + Math.cos(k * 0.785) * 1.2, pz + Math.sin(k * 0.785) * 1.2)) return false;
    return true;
  };
  if (solid(x, z)) return [x, z, false];
  for (let r = 0.5; r <= 20; r += 0.5) {
    const n = Math.ceil((2 * Math.PI * r) / 0.5);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (solid(px, pz)) return [px, pz, true];
    }
  }
  return [x, z, false];
}

export function buildPlaces(o: { terrain: Terrain; land: Land; zones: Zones; version: string; verifiedAt: string; plannerGuides: Map<string, string>; onDeck: (x: number, z: number) => boolean; inLake: (x: number, z: number) => boolean; log: (s: string) => void }): PlacesFile {
  const { terrain, land, zones, log } = o;
  const toHans = OpenCC.Converter({ from: 'hk', to: 'cn' });
  const zoneAt = (x: number, z: number) => { const i = zoneIndexAt(zones, x, z); return i >= 0 ? zones.list[i].id : null; };
  const places: SfPlace[] = [];
  const doc = JSON.parse(fs.readFileSync(path.join(SF_DATA, 'landmarks.json'), 'utf8')) as {
    landmarks: { id: string; name: { en: string; zh: string }; category: string; lat: number; lng: number; osm: { type: 'node' | 'way' | 'relation'; id: number; url: string } | null }[];
  };
  const r2 = (v: number) => Math.round(v * 100) / 100;
  let snapped = 0;
  for (const l of doc.landmarks) {
    let [x, z] = projPt(l.lat, l.lng);
    if (l.category !== 'bridge' && l.category !== 'water') { const s = snapToLand(land, o.onDeck, x, z, o.inLake); if (s[2]) snapped++; [x, z] = s; }
    const p: SfPlace = {
      id: l.id, name: l.name, kind: l.category as SfPlaceKind, x: r2(x), z: r2(z), y: r2(heightAt(terrain, x, z)), zone: zoneAt(x, z),
      osmType: l.osm?.type ?? null, osmId: l.osm?.id ?? null, sourceUrl: l.osm?.url ?? `https://www.openstreetmap.org/#map=18/${l.lat}/${l.lng}`,
      verifiedAt: o.verifiedAt, curated: true, graphNode: -1,
    };
    const planner = PLANNER[l.id];
    if (planner && o.plannerGuides.has(planner)) { p.plannerId = planner; const g = o.plannerGuides.get(planner); if (g) p.guideSlug = g; }
    if (inSlab(x, z)) p.hero = true;
    places.push(p);
  }
  const curatedOsm = new Set(places.filter(p => p.osmId !== null).map(p => `${p.osmType}/${p.osmId}`));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let pois = 0, dupes = 0;
  for (const e of elements('pois')) {
    const t = e.tags ?? {};
    if (!t.name) continue;
    const kind = poiKind(t);
    if (!kind) continue;
    const c = e.center ?? (e.lat !== undefined ? { lat: e.lat, lon: e.lon! } : null);
    if (!c) continue;
    if (curatedOsm.has(`${e.type}/${e.id}`)) { dupes++; continue; }
    const [x, z] = projPt(c.lat, c.lon);
    // SF only: on land, or within 3 u of it (piers, cliff-edge viewpoints), inside the county boundary
    if (land.inside.at(x, z) !== 1) continue;
    let nearLand = land.grid.at(x, z) === 1;
    for (let k = 0; k < 8 && !nearLand; k++) nearLand = land.grid.at(x + Math.cos(k * 0.785) * 3, z + Math.sin(k * 0.785) * 3) === 1;
    if (!nearLand) continue;
    let [sx, sz] = [x, z];
    if (kind !== 'peak') { const s = snapToLand(land, o.onDeck, x, z, o.inLake); if (s[2]) snapped++; [sx, sz] = s; }
    const n = norm(t.name);
    if (places.some(p => Math.hypot(p.x - x, p.z - z) < (p.curated ? 25 : 40) && (norm(p.name.en).includes(n) || n.includes(norm(p.name.en))))) { dupes++; continue; }
    const zhRaw = t['name:zh-Hans'] ?? t['name:zh'] ?? t['name:zh-Hant'] ?? '';
    const p: SfPlace = {
      id: `osm-${e.type[0]}${e.id}`, name: { zh: zhRaw ? toHans(zhRaw) : t.name, en: t['name:en'] ?? t.name }, kind, x: r2(sx), z: r2(sz), y: r2(heightAt(terrain, sx, sz)),
      zone: zoneAt(sx, sz), osmType: e.type, osmId: e.id, sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`, verifiedAt: o.verifiedAt, curated: false, graphNode: -1,
    };
    if (inSlab(sx, sz)) p.hero = true;
    places.push(p);
    pois++;
  }
  log(`places: ${places.length} (${doc.landmarks.length} curated + ${pois} OSM POIs, ${dupes} duplicates skipped, ${snapped} anchors moved onto solid land)`);
  return { version: o.version, verifiedAt: o.verifiedAt, places };
}
