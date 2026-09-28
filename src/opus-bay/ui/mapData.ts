import { useEffect, useMemo, useState } from 'react';
import { MAP_STICKERS_T1 } from '../data/sf/mapStickers';
import { type MapW4, loadMapW4, mapW4 } from '../data/sf/mapTransit';
import { flineJson, onTransitData, transitData } from '../data/transit';
import { type MapLine, type MapStation, mapLinesFrom, mapStations } from './mapLines';

/**
 * Wave 4 · the transit lines and stations the city map draws (lane P, integration): the wave-2 cable cars and the
 * F-line from data/transit.ts, lane T's sightseeing loop, N and M from the published file (data/sf/mapTransit.ts).
 */

/** Every line the map draws (cable cars, the F-line, the loop, N, M), re-built when the data arrives. */
export function useMapLines(): MapLine[] {
  const [cable, setCable] = useState(() => transitData());
  const [w4, setW4] = useState<MapW4 | null>(() => mapW4());
  useEffect(() => onTransitData(setCable), []);
  useEffect(() => {
    if (w4) return;
    let live = true;
    void loadMapW4().then(l => { if (live) setW4(l); });
    return () => { live = false; };
  }, [w4]);
  return useMemo(() => mapLinesFrom(cable, flineJson(), w4?.lines ?? []), [cable, w4]);
}

/** The stop ids at the two ends of every line that is not a loop (their names show from s 0.45). */
export function lineTermini(lines: readonly MapLine[]): Set<string> {
  const out = new Set<string>();
  for (const l of lines) if (!l.loop && l.stops.length) { out.add(l.stops[0].id); out.add(l.stops[l.stops.length - 1].id); }
  return out;
}

/** The map's stations (transfers merged by distance) and the stop ids at the ends of each line. */
export function useMapStations(lines: readonly MapLine[]): { stations: MapStation[]; termini: Set<string> } {
  return useMemo(() => ({ stations: mapStations(lines), termini: lineTermini(lines) }), [lines]);
}

let stickerState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
let stickerLoad: Promise<void> | null = null;

/**
 * Lane V's T1 sticker atlas (data/sf/mapStickers.ts, 74 KB WebP) decoded once per page: the badges draw the lucide
 * glyph until then, and always under `?stickers=0` (plan §4.1 "Badges").
 */
export function useStickersReady(): boolean {
  const off = typeof location !== 'undefined' && /[?&]stickers=0(?:&|$)/.test(location.search);
  const [ready, setReady] = useState(stickerState === 'ready');
  useEffect(() => {
    if (off || ready || typeof Image === 'undefined') return;
    let live = true;
    if (stickerState === 'idle' || stickerState === 'failed') {
      stickerState = 'loading';
      const img = new Image();
      img.decoding = 'async';
      img.src = MAP_STICKERS_T1.url;
      stickerLoad = img.decode().then(() => { stickerState = 'ready'; }, () => { stickerState = 'failed'; });
    }
    void stickerLoad?.then(() => { if (live && stickerState === 'ready') setReady(true); });
    return () => { live = false; };
  }, [off, ready]);
  return !off && ready;
}
