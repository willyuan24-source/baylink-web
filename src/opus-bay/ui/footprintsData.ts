import type { Bilingual } from '../core/types';
import type { CityPlace, PlaceIndex } from '../data/sf/places';

/**
 * 足迹 (lane G1, G1-11): what the Journal's footprints tab counts, pure so the node tests can check it.
 *   地标  the 24 SF landmarks found / all
 *   景点  the other curated places found / all
 *   地点  every place found (landmarks, curated, and the OSM places you walked past)
 *   街区  DataSF neighbourhoods visited / all (far.zones)
 *   坐车  counted stop-to-stop rides (save v2 `rides`), per line
 */

export interface FootprintsSummary {
  landmarks: { found: number; total: number };
  sights: { found: number; total: number };
  places: number;
  zones: { visited: number; total: number };
  rides: { lineId: string; name: Bilingual; count: number }[];
  ridesTotal: number;
  /** the latest finds, newest first */
  recent: CityPlace[];
}

export function footprintsSummary(
  ix: Pick<PlaceIndex, 'list' | 'get'> | null,
  found: readonly string[],
  zonesVisited: number,
  zonesTotal: number,
  rides: Record<string, number>,
  lineName: (lineId: string) => Bilingual | null,
  recentMax = 8,
): FootprintsSummary {
  const has = new Set(found);
  let lm = 0, lmFound = 0, sights = 0, sightsFound = 0;
  for (const p of ix?.list ?? []) {
    if (p.landmark) { lm++; if (has.has(p.id)) lmFound++; } else if (p.curated) { sights++; if (has.has(p.id)) sightsFound++; }
  }
  const recent: CityPlace[] = [];
  for (let i = found.length - 1; i >= 0 && recent.length < recentMax; i--) { const p = ix?.get(found[i]); if (p) recent.push(p); }
  const rideRows = Object.entries(rides).filter(([, n]) => n > 0).map(([lineId, count]) => ({ lineId, count, name: lineName(lineId) ?? { zh: lineId, en: lineId } })).sort((a, b) => b.count - a.count);
  return {
    landmarks: { found: lmFound, total: lm },
    sights: { found: sightsFound, total: sights },
    // ids of places no longer in the index (an older save) are not counted
    places: ix ? found.filter(id => ix.get(id)).length : found.length,
    zones: { visited: Math.min(zonesVisited, zonesTotal || zonesVisited), total: zonesTotal },
    rides: rideRows,
    ridesTotal: rideRows.reduce((n, r) => n + r.count, 0),
    recent,
  };
}
