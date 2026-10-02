/**
 * Wave 9 · lane C (W9-C2, w8 H-RP-5) · streets closed to the city's toy traffic while an event's kit stands on them: the
 * Chinatown Halloween Festival's lanterns, stage and line-up on Waverly Place (31 Oct 2026, 11:00–15:00,
 * halloween/worldFestival.ts) — a car drove into the alley, stopped short of the line-up and stood there among the
 * lanterns for the rest of the day. A feature registers a test while its kit is up and removes it when the kit comes
 * down; world/sf/traffic.ts never spawns on, nor turns into, a street whose middle the test closes, and a car standing on
 * one (there when the kit went up) gives way: out of sight at once, in sight with the kerb hop and shrink. Nothing registered = the traffic exactly as before.
 */
export type RoadClosure = (x: number, z: number) => boolean;

const closures = new Set<RoadClosure>();

/** Close the roads `test` answers true for (a street edge's middle, a car's position); returns the reopening. */
export function closeRoad(test: RoadClosure): () => void {
  closures.add(test);
  return () => { closures.delete(test); };
}

/** Is the road at (x, z) closed now? */
export function roadClosed(x: number, z: number): boolean {
  if (!closures.size) return false;
  for (const c of closures) if (c(x, z)) return true;
  return false;
}

/** Is any road closed now (a cheap test before the street's own)? */
export const anyRoadClosed = (): boolean => closures.size > 0;
