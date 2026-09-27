import { cableLine, transitStation } from '../data/transit';

/**
 * The glyph of a transit prompt (lane F's request to G1, wave 3): `source: 'transit'` interactables are stations
 * (refId = station id), the turntable push (refId = turntable id) and, later, ferry gangways. The kind comes from the
 * lines stopping at the station in lane F's data/transit.ts; an id or line with "ferry" in it is a ferry. Pure apart
 * from F's loaded transit data (null → the cable car, the only city line kind today).
 */
export type TransitGlyph = 'cable-car' | 'ferry' | 'streetcar';

export function transitGlyph(it: { id: string; source: string; refId?: string }): TransitGlyph | undefined {
  if (it.source !== 'transit') return undefined;
  if (/ferry/.test(it.id) || /ferry/.test(it.refId ?? '')) return 'ferry';
  const st = it.refId ? transitStation(it.refId) : undefined;
  const kinds = (st?.lines ?? []).map(l => {
    const kind = (cableLine(l.line) as { kind?: string } | undefined)?.kind;
    return kind ?? (/ferry/.test(l.line) ? 'ferry' : /^f-line|streetcar/.test(l.line) ? 'streetcar' : 'cable-car');
  });
  if (kinds.includes('ferry')) return 'ferry';
  if (kinds.length && kinds.every(k => k === 'streetcar')) return 'streetcar';
  return 'cable-car';
}
