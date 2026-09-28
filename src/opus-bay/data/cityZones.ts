import { zoneAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
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
 * City mode only: the area at a world point (id for store.area + its name), or null. `y` (the walker's height, when the
 * caller knows it): on a span's deck anywhere along it, not under it.
 */
export function cityAreaAt(x: number, z: number, y?: number): { id: string; name: Bilingual } | null {
  const s = landmarkSpanAt(x, z, y);
  if (s) return { id: s.id, name: s.name };
  for (const a of LANDMARK_AREAS) if ((x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r) return { id: a.id, name: a.name };
  const zone = zoneAt(x, z);
  const hero = zone ? CITY_HERO_ZONE_NAMES[zone.id] : undefined;
  return hero && zone ? { id: zone.id, name: hero } : zone;
}

/** Put the 41 neighbourhood names from far.obc into AREA_NAMES (the map and place list name zones not walked yet). */
export function learnZoneNames(zones: readonly { id: string; zh: string; en: string }[]) {
  for (const z of zones) if (!AREA_NAMES.has(z.id)) AREA_NAMES.set(z.id, bi(z.zh, z.en));
}

/** Name of an area id: landmark areas and seen neighbourhoods, else 旧金山. */
export function zoneName(id: string | null | undefined): Bilingual {
  const hit = id ? CITY_HERO_ZONE_NAMES[id] ?? AREA_NAMES.get(id) ?? LANDMARK_AREAS.find(a => a.id === id)?.name ?? SPAN_AREAS.get(id)?.name : undefined;
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
