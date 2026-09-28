import { openPanel } from './flow';

/**
 * Open the city map on something (lane P, wave 4 integration). The map panel's id says what it opens on:
 *   '<placeId>'             a place (the Journal's 足迹 rows, G1-11): its attraction's badge when one speaks for it
 *   'attraction:<id>'       an attraction's badge (an attraction or SF landmark id)
 *   'station:<stopId>'      a station (any of its stop ids: loop-…, muni-…, a cable-car station, f-line-…)
 *   'line:<lineId>'         the 线路 tab with that line highlighted and framed (lane T's 看线路图 choice)
 * Light on purpose (flow's openPanel only): any lane may import it.
 */

export type MapPanelTarget = { kind: 'place' | 'attraction' | 'station' | 'line'; id: string };

const TAGGED = /^(attraction|station|line):(.+)$/;

/** The panel id for a target (a place is its bare id, as G1's 足迹 rows write it). */
export function mapPanelId(t: MapPanelTarget): string {
  return t.kind === 'place' ? t.id : `${t.kind}:${t.id}`;
}

/** What a map panel id opens on (null for an empty id). */
export function parseMapPanelId(id: string | null | undefined): MapPanelTarget | null {
  if (!id) return null;
  const m = TAGGED.exec(id);
  return m ? { kind: m[1] as MapPanelTarget['kind'], id: m[2] } : { kind: 'place', id };
}

/** Open the city map on a place, an attraction, a station or a line. */
export function openMapOn(t: MapPanelTarget) { openPanel('map', mapPanelId(t)); }

/** Lane T's 看线路图: the map's 线路 tab with `lineId` highlighted (sf-loop, n-judah, m-ocean-view, a cable line, f-line). */
export const openMapLine = (lineId: string) => openMapOn({ kind: 'line', id: lineId });
