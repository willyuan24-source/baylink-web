/**
 * Wave 7 · lane H (W7-H6) · people on the roadway that another feature puts there, for the city's toy traffic to stop
 * short of (world/sf/cityLife.ts TrafficEnv.people adds them after the player, BAYBAY and the crossing walkers): the
 * Día de los Muertos procession walking the curb lane on 2 November (halloween/muertosWalkers.ts). A feature adds a
 * provider and removes it on teardown; nothing registered = the traffic exactly as before.
 */
export type RoadPeopleProvider = (put: (x: number, z: number, r: number) => void) => void;

const providers = new Set<RoadPeopleProvider>();

/** Register a provider (called every traffic step); returns the undo. */
export function addRoadPeople(p: RoadPeopleProvider): () => void {
  providers.add(p);
  return () => { providers.delete(p); };
}

/** Every registered person on the roadway (cityLife's TrafficEnv.people). */
export function eachRoadPerson(put: (x: number, z: number, r: number) => void): void {
  for (const p of providers) p(put);
}
