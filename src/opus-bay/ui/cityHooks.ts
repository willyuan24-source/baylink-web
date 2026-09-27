import { useEffect, useState } from 'react';
import { learnZoneNames } from '../data/cityZones';
import { type PlaceIndex, loadPlaces, onPlaces, placeIndex } from '../data/sf/places';
import { cityStreamerLazy } from '../world/cityLoader';
import type { FarData } from '../world/sf/format';

/**
 * City UI hooks shared by the map (ui/CityMap.tsx) and the Journal's 足迹 tab (ui/Footprints.tsx), lane G1.
 */

/** far.obc once the streamer has it (polled until then); neighbourhood names are learned before the render that uses it. */
export function useFar(): FarData | null {
  const [far, setFar] = useState<FarData | null>(() => { const f = cityStreamerLazy()?.far ?? null; if (f) learnZoneNames(f.zones); return f; });
  useEffect(() => {
    if (far) return;
    const id = window.setInterval(() => { const f = cityStreamerLazy()?.far; if (f) { learnZoneNames(f.zones); setFar(f); } }, 400);
    return () => window.clearInterval(id);
  }, [far]);
  return far;
}

/** The city place index (loaded on first use). */
export function usePlaceIndex(): PlaceIndex | null {
  const [ix, setIx] = useState<PlaceIndex | null>(() => placeIndex());
  useEffect(() => { void loadPlaces(); return onPlaces(setIx); }, []);
  return ix;
}
