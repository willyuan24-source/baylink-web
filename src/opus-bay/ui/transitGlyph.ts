import { activeStreetcarSystem, cableLine, ferryTerminal, transitStation } from '../data/transit';

/**
 * The glyph of a transit prompt (lane F's request to G1, wave 3): `source: 'transit'` interactables are stations
 * (refId = station id), the turntable push (refId = turntable id) and the ferry gangways. The kind comes from the
 * lines stopping at the station in lane F's data/transit.ts; an id or line with "ferry" in it is a ferry. Pure apart
 * from F's loaded transit data (null → the cable car).
 *
 * Wave 4 (lane G, routed F w3 a / b): city F-line stations (`f-…`; the four hero stops keep their district
 * interactables) answer 'streetcar' — they fell to the cable-car glyph because `transitStation` knows only the
 * cable-car stations; ferry terminals are found by `ferryTerminal(refId)` (Pier 41 has no "ferry" in its id); lane T's
 * sightseeing-loop stops (`loop-…`) are 'bus' and its Metro stations (`muni-…`) 'metro', checked first (the loop's
 * `loop-ferry-building` must not read as a ferry). Ids only: no wave-4 line data enters the main graph.
 */
export type TransitGlyph = 'cable-car' | 'ferry' | 'streetcar' | 'bus' | 'metro';

export function transitGlyph(it: { id: string; source: string; refId?: string }): TransitGlyph | undefined {
  if (it.source !== 'transit') return undefined;
  const ref = it.refId ?? '';
  if (ref.startsWith('loop-')) return 'bus';
  if (ref.startsWith('muni-')) return 'metro';
  if (ref && (activeStreetcarSystem()?.line.stations.some(st => st.id === ref) || (ref.startsWith('f-') && !transitStation(ref)))) return 'streetcar';
  if ((ref && ferryTerminal(ref)) || /ferry/.test(it.id) || /ferry/.test(ref)) return 'ferry';
  const st = ref ? transitStation(ref) : undefined;
  const kinds = (st?.lines ?? []).map(l => {
    const kind = (cableLine(l.line) as { kind?: string } | undefined)?.kind;
    return kind ?? (/ferry/.test(l.line) ? 'ferry' : /^f-line|streetcar/.test(l.line) ? 'streetcar' : 'cable-car');
  });
  if (kinds.includes('ferry')) return 'ferry';
  if (kinds.length && kinds.every(k => k === 'streetcar')) return 'streetcar';
  return 'cable-car';
}
