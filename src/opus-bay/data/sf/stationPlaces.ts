import { mapLinesFrom, mapStations, type MapStation } from '../../ui/mapLines';
import { flineJson, loadTransit } from '../transit';
import { loadMapW4 } from './mapTransit';
import type { PlaceRow } from './places';

/**
 * Wave 4 · stations as places (lane P, W4-P7; plan §3.6 "Stations join the place index: searchable (zh + en),
 * discovered when you stand at them, flyable once discovered"; save v2 keeps them among `discovered`, ≈ 140 rows inside
 * the 2,000 cap). One row per map station (ui/mapLines `mapStations`: the loop, N, M, the cable cars and the F-line,
 * transfers merged by distance): id = the station's primary stop id (loop-…, muni-…, a cable-car station, f-line-…),
 * kind 'transit', anchor = the stop, arrival = where its pole / kiosk stands (lane T's placed props: you board there).
 * Loaded lazily with the place index (data/sf/places.ts loadPlaces).
 */

export const STATION_SOURCE_URL = 'https://www.sfmta.com/getting-around/muni';

/** The place rows of the stations (pure). Ids already taken by a place row are skipped (none are today). */
export function stationRows(stations: readonly MapStation[], props: Readonly<Record<string, readonly [number, number]>>, taken: ReadonlySet<string>, verifiedAt: string): PlaceRow[] {
  const out: PlaceRow[] = [];
  for (const st of stations) {
    if (taken.has(st.id)) continue;
    const prop = st.ids.map(id => props[id]).find(p => !!p);
    out.push({
      id: st.id, name: st.name, kind: 'transit', x: st.x, z: st.z, y: 0, zone: null, osmType: null, osmId: null, sourceUrl: STATION_SOURCE_URL,
      verifiedAt, curated: false, graphNode: -1, walkable: true, station: true,
      ...(prop ? { arrival: { x: prop[0], z: prop[1] } } : {}),
    });
  }
  return out;
}

/** The stations of every published line (the transit data, the F-line and lane T's lines), as place rows. */
export async function loadStationRows(taken: ReadonlySet<string>, verifiedAt: string): Promise<PlaceRow[]> {
  const [cable, w4] = await Promise.all([loadTransit(), loadMapW4()]);
  if (!cable && !w4.lines.length) return [];
  return stationRows(mapStations(mapLinesFrom(cable, flineJson(), w4.lines)), w4.props, taken, verifiedAt);
}
