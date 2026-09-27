import { zoneAt } from '../core/terrain';
import type { Bilingual } from '../core/types';

/**
 * City neighbourhood names for the HUD (lane G1 owns this file from wave 2; plan G1-2). Day 0 moved AREA_NAMES here from
 * game/brain.ts (brain re-exports it) and routes brain's city-mode area lookup through cityAreaAt, so G1 can change how
 * areas are named (hero zones → DataSF neighbourhood → 旧金山, landmark names inside a landmark radius, CS-8) without
 * editing brain.ts.
 */

/** City-mode area names by zone id (the DataSF neighbourhoods are not in DISTRICT.zones); the HUD label reads it. */
export const AREA_NAMES = new Map<string, Bilingual>();

/** City mode only: the area at a world point (id for store.area + its name), or null. Day 0: core/terrain zoneAt. */
export function cityAreaAt(x: number, z: number): { id: string; name: Bilingual } | null {
  return zoneAt(x, z);
}
