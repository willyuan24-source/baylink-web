import { project } from '../core/geo';
import { pointInPolygon, zoneAt } from '../core/terrain';
import type { Bilingual, Polygon } from '../core/types';
import type { FarData } from '../world/sf/format';

/**
 * City neighbourhood names for the HUD and the map (lane G1, plan §5.9 / G1-2). brain.ts re-exports AREA_NAMES and asks
 * cityAreaAt for the city-mode area label: a landmark area first (CS-8: inside its radius you are "in Chinatown" at the
 * Dragon Gate, not "Financial District / South Beach"), then the hero zones, then the 41 DataSF neighbourhoods
 * (core/terrain zoneAt), else null (the HUD says 旧金山). District mode never calls it.
 */

/** City-mode area names by area id (DataSF neighbourhoods, landmark areas); the HUD label reads it. */
export const AREA_NAMES = new Map<string, Bilingual>();

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

export interface LandmarkArea { id: string; name: Bilingual; x: number; z: number; r: number }

/**
 * CS-8: the area a landmark stands for, inside its radius (world u; positions are the places.json anchors, checked by
 * tests/opus-bay-sf-places.test.ts). First match wins.
 */
export const LANDMARK_AREAS: readonly LandmarkArea[] = [
  { id: 'chinatown', name: bi('唐人街', 'Chinatown'), x: 81.92, z: 174.7, r: 30 },                 // Dragon Gate
  { id: 'civic-center', name: bi('市政中心', 'Civic Center'), x: 92.31, z: 418.18, r: 45 },        // City Hall
  { id: 'dolores-park', name: bi('多洛雷斯公园', 'Dolores Park'), x: 241.96, z: 697.95, r: 40 },
  { id: 'alamo-square', name: bi('阿拉莫广场', 'Alamo Square'), x: -7.52, z: 586.51, r: 34 },      // Painted Ladies
  { id: 'twin-peaks', name: bi('双峰', 'Twin Peaks'), x: 73.19, z: 973.68, r: 40 },                // Sutro Tower
  { id: 'twin-peaks', name: bi('双峰', 'Twin Peaks'), x: 140.08, z: 946.9, r: 40 },                // the summits
  // (W8-I, W8I-P-2 / D-4) wave 8 made the island walkable: its quay, stair and cellhouse said 旧金山 (water all round:
  // the radius takes the dock's berth, AL(18.65, -21.31) ≈ 28 u from the anchor, and nothing else)
  { id: 'alcatraz', name: bi('恶魔岛', 'Alcatraz Island'), x: -468.22, z: -58.53, r: 34 },          // places.json 'alcatraz'
  // (W8-I, W8I-P-8, lane Q's open request) the Powell & Market turntable and the square said 金融区 (the DataSF zone
  // grid) and BAYBAY greeted the Transamerica Pyramid 1 km away; after Chinatown, so the Dragon Gate stays Chinatown.
  // The turntable (places.json cable-car-powell-market, 129.28, 257.51) is 49 u from the square's anchor
  { id: 'union-square', name: bi('联合广场', 'Union Square'), x: 96.13, z: 221.34, r: 52 },        // places.json 'union-square'
];

/**
 * W5-N7 (plan MF2 "the area chip says 金门大桥 on the deck"): landmarks the player walks ALONG — the Golden Gate deck,
 * the brain's elevated walkway (game/brain.ts ELEVATED_WALKS 'ggb-deck': its south end, local x END_S + 4, to its north
 * end). Inside `half` of the a → b segment and, when the height is known, above `minY` (the deck at 15.2: Fort Point
 * sits under its south end); without a height only from `from2d` of the way on (over the water, nothing walkable under
 * it, so nobody down there).
 */
export interface LandmarkSpan { id: string; name: Bilingual; a: { x: number; z: number }; b: { x: number; z: number }; half: number; minY: number; from2d: number }
export const LANDMARK_SPANS: readonly LandmarkSpan[] = [
  { id: 'golden-gate-bridge', name: bi('金门大桥', 'Golden Gate Bridge'), a: { x: -689.35, z: 649.76 }, b: { x: -1015.73, z: 388.59 }, half: 10, minY: 12, from2d: 0.25 },
];
const SPAN_AREAS: ReadonlyMap<string, LandmarkArea> = new Map(LANDMARK_SPANS.map(s => [s.id, { id: s.id, name: s.name, x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2, r: 0 }]));

/** The span a point is on (see LANDMARK_SPANS), or null. `y` = the walker's height when known. */
export function landmarkSpanAt(x: number, z: number, y?: number): LandmarkSpan | null {
  for (const s of LANDMARK_SPANS) {
    const ax = s.b.x - s.a.x, az = s.b.z - s.a.z, L2 = ax * ax + az * az;
    const t = ((x - s.a.x) * ax + (z - s.a.z) * az) / L2;
    if (t < 0 || t > 1) continue;
    if (Math.hypot(x - (s.a.x + ax * t), z - (s.a.z + az * t)) > s.half) continue;
    if (y !== undefined && Number.isFinite(y) ? y < s.minY : t < s.from2d) continue;
    return s;
  }
  return null;
}

/** The landmark area at a point (CS-8; W5-N7: the spans first, over the water), or null. */
export function landmarkAreaAt(x: number, z: number): LandmarkArea | null {
  const s = landmarkSpanAt(x, z);
  if (s) return SPAN_AREAS.get(s.id)!;
  for (const a of LANDMARK_AREAS) if ((x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r) return a;
  return null;
}

/**
 * CP-13 (the mid-wave checkpoint: "English names in the zh HUD"): the hero waterfront's zones keep the district's own
 * frozen names in district mode (data/district.ts: 'Coit Tower · 电报山', 'Exploratorium · Pier 15', 'Embarcadero 海滨大道'
 * …); the city's area pill names them in zh as the rest of the city does (data/VOICE.md glossary: 科伊特塔 ·
 * 菲尔伯特台阶, 33 号码头, 内河码头; the attraction names for the piers and the Exploratorium).
 */
export const CITY_HERO_ZONE_NAMES: Readonly<Record<string, Bilingual>> = {
  coit: bi('科伊特塔 · 电报山', 'Coit Tower · Telegraph Hill'),
  filbert: bi('菲尔伯特台阶', 'Filbert Steps'),
  levis: bi('李维斯广场', "Levi's Plaza"),
  pier14: bi('14 号码头', 'Pier 14'),
  ferry: bi('渡轮大厦', 'Ferry Building'),
  pier7: bi('7 号码头', 'Pier 7'),
  exploratorium: bi('探索馆 · 15 号码头', 'Exploratorium · Pier 15'),
  pier33: bi('33 号码头', 'Pier 33 · Alcatraz Landing'),
  pier39: bi('39 号码头', 'Pier 39'),
  embarcadero: bi('内河码头', 'The Embarcadero'),
};

/**
 * W7-K4 · Fisherman's Wharf (the loop bus on Jefferson St said 北滩 and BAYBAY greeted 你好，北滩！): DataSF has no such
 * neighbourhood — the strip is North Beach and Russian Hill there. Its extent (Wikipedia, "Fisherman's Wharf, San
 * Francisco", checked 2026-09-29: "from Pier 35 and the intersection of The Embarcadero and Bay Street westward to Hyde
 * Street and Aquatic Park", north of Russian Hill / North Beach; the benefit district's southern line Bay St from Powell)
 * as a polygon on the street grid (lat / lng of the corners from the OSM street grid; the edge is a label's, not a
 * surveyor's). Checked after the hero's own places, so 39 号码头 / 33 号码头 keep their names; the hero's catch-all 内河码头
 * (which covers Jefferson St east of Taylor) gives way to it.
 */
export const WHARF_AREA: { id: string; name: Bilingual; polygon: Polygon } = {
  id: 'fishermans-wharf',
  name: bi('渔人码头', "Fisherman's Wharf"),
  polygon: ([
    [37.8095, -122.4226], // Aquatic Park's east shore, the Hyde Street Pier root
    [37.8122, -122.4205], // off the Hyde Street Pier
    [37.8122, -122.4080], // off Pier 39
    [37.8095, -122.4045], // Pier 35
    [37.8061, -122.4065], // The Embarcadero & Bay St
    [37.8052, -122.4155], // Bay & Taylor
    [37.8059, -122.4211], // Hyde & North Point
  ] as const).map(([lat, lng]) => { const p = project(lat, lng); return { x: p.x, z: p.z }; }),
};

/**
 * City mode only: the area at a world point (id for store.area + its name), or null. `y` (the walker's height, when the
 * caller knows it): on a span's deck anywhere along it, not under it.
 */
export function cityAreaAt(x: number, z: number, y?: number): { id: string; name: Bilingual } | null {
  const s = landmarkSpanAt(x, z, y);
  if (s) return { id: s.id, name: s.name };
  for (const a of LANDMARK_AREAS) if ((x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r) return { id: a.id, name: a.name };
  const zone = zoneAt(x, z);
  const hero = zone ? CITY_HERO_ZONE_NAMES[zone.id] : undefined;
  // (the hero's own places first — 39 号码头, 33 号码头 …; its catch-all 内河码头 reaches along Jefferson St: the Wharf wins)
  if (hero && zone && zone.id !== HERO_CATCH_ALL) return { id: zone.id, name: hero };
  if (pointInPolygon({ x, z }, WHARF_AREA.polygon)) return { id: WHARF_AREA.id, name: WHARF_AREA.name };
  if (hero && zone) return { id: zone.id, name: hero };
  return zone ? exactZone(zone, x, z) : null;
}
/** the hero waterfront's catch-all zone (data/district.ts, the last zone: the whole hero core) */
const HERO_CATCH_ALL = 'embarcadero';

/**
 * W7-K4 (lane W: the pill said 唐人街 at Washington Square): the city provider answers from far.zoneGrid, 16 u cells,
 * so a cell on a border names the neighbour — Washington Square's cell is Chinatown's though the square lies inside
 * North Beach's polygon. When the point is outside the answer's own polygon, the zone of a neighbouring cell whose
 * polygon holds it wins (none does: the grid's answer stands).
 */
function exactZone<Z extends { id: string; polygon: Polygon }>(zone: Z, x: number, z: number): Z {
  const p = { x, z };
  if (!zone.polygon.length || pointInPolygon(p, zone.polygon)) return zone;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue;
    const o = zoneAt(x + dx * ZONE_CELL, z + dz * ZONE_CELL) as Z | null;
    if (o && o.id !== zone.id && !CITY_HERO_ZONE_NAMES[o.id] && pointInPolygon(p, o.polygon)) return o;
  }
  return zone;
}
/** far.zoneGrid's cell (u; world/sf/format FarData.zoneGrid.step as published) */
const ZONE_CELL = 16;

/** Put the 41 neighbourhood names from far.obc into AREA_NAMES (the map and place list name zones not walked yet). */
export function learnZoneNames(zones: readonly { id: string; zh: string; en: string }[]) {
  for (const z of zones) if (!AREA_NAMES.has(z.id)) AREA_NAMES.set(z.id, bi(z.zh, z.en));
}

/** Name of an area id: landmark areas and seen neighbourhoods, else 旧金山. */
export function zoneName(id: string | null | undefined): Bilingual {
  const hit = id ? CITY_HERO_ZONE_NAMES[id] ?? AREA_NAMES.get(id) ?? LANDMARK_AREAS.find(a => a.id === id)?.name ?? SPAN_AREAS.get(id)?.name ?? (id === WHARF_AREA.id ? WHARF_AREA.name : undefined) : undefined;
  return hit ?? SF_NAME;
}
export const SF_NAME: Bilingual = bi('旧金山', 'San Francisco');

// ---------------------------------------------------------------------------
// DataSF neighbourhoods from far.obc (map fog, zone visits, map labels)
// ---------------------------------------------------------------------------

/** The DataSF neighbourhood index (into far.zones) at a point via far.zoneGrid, or −1. */
export function farZoneIndexAt(far: Pick<FarData, 'zoneGrid'>, x: number, z: number): number {
  const g = far.zoneGrid;
  const i = Math.floor((x - g.originX) / g.step), j = Math.floor((z - g.originZ) / g.step);
  if (i < 0 || j < 0 || i >= g.cols || j >= g.rows) return -1;
  return g.idx[j * g.cols + i] - 1;
}

/** Label anchor of a neighbourhood: the area-weighted centroid of its largest outer ring (world). */
export function zoneLabelAnchor(zone: FarData['zones'][number]): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null, bestA = 0;
  for (const ring of zone.rings) {
    if (ring.hole) continue;
    const xz = ring.xz, n = xz.length / 2;
    let a = 0, cx = 0, cz = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const f = xz[j * 2] * xz[i * 2 + 1] - xz[i * 2] * xz[j * 2 + 1];
      a += f; cx += (xz[j * 2] + xz[i * 2]) * f; cz += (xz[j * 2 + 1] + xz[i * 2 + 1]) * f;
    }
    if (Math.abs(a) > bestA && a !== 0) { bestA = Math.abs(a); best = { x: cx / (3 * a), z: cz / (3 * a) }; }
  }
  return best;
}
