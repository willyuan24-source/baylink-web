import { emit, type GameEvent } from '../core/events';

/**
 * City sound hooks (lane F, wave 3 part b: F10). A tiny, dependency-light bridge from the city's moving things (the lazy
 * transit chunk: cable cars, the F-line, the ferry, the crowd, the toy traffic) to the audio rig, without widening the
 * frozen event contract:
 *
 * - `emitAt(event, x, z)` emits an ordinary game event and, for the duration of that synchronous emit, says where it
 *   happened (`soundAt`), so audio.ts can pan and attenuate a bell of a car across the street, a ferry horn out on the
 *   Bay, a hop-aside squeak. Listeners that do not care see a normal event.
 * - `cityHooks` is plain state the world writes and the ambience reads at 10 Hz: the crowd around the listener (how
 *   many walkers within 18 u, and where their middle is) and the toy cars that just passed close by (pass-by sounds).
 */

export const soundAt = { x: 0, z: 0, set: false };

/** Emit `event` located at (x, z) (audio pans / attenuates it; everyone else sees a normal event). */
export function emitAt(event: GameEvent, x: number, z: number) {
  const prev = { ...soundAt };
  soundAt.x = x; soundAt.z = z; soundAt.set = true;
  try { emit(event); } finally { soundAt.x = prev.x; soundAt.z = prev.z; soundAt.set = prev.set; }
}

/** A toy car that passed the listener: where, its heading and speed, and its closest distance. */
export interface PassSound { x: number; z: number; heading: number; v: number; d: number }

export const cityHooks = {
  /** walkers within 18 u of the listener and their centroid (world) */
  crowd: { n: 0, x: 0, z: 0 },
  /** toy cars within 40 u of the listener */
  cars: 0,
  /** pass-bys since the audio last drained them (≤ 8 kept) */
  passes: [] as PassSound[],
};

export function pushPass(p: PassSound) {
  cityHooks.passes.push(p);
  if (cityHooks.passes.length > 8) cityHooks.passes.splice(0, cityHooks.passes.length - 8);
}

/** Back to silence (the city life stopped: travel mode, disposed). */
export function clearCityHooks() {
  cityHooks.crowd.n = 0;
  cityHooks.cars = 0;
  cityHooks.passes.length = 0;
}

/**
 * Wave 4 (lane T): the recorded tour lines that may play at a loop / Metro stop and the next one ahead (game/lineRides.ts
 * installs it in city mode); the audio rig fetches those clips when the ride boards / approaches / arrives there.
 */
export const lineVoices: { ids: ((line: string, station: string, dir?: 1 | -1) => string[]) | null } = { ids: null };
