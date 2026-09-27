import type { WorldSystem } from '../world';
import type { CityStreamer } from './stream';

/**
 * Mission mural panels in the streamed city (lane H2b owns this file from wave 2; plan H2b-10, optional).
 * world/world.ts enableCity calls attachMurals(streamer) once and adds the returned system (group + per-frame update:
 * show within 300 u of the Mission, dispose). Day-0 stub: no murals, null.
 */
export function attachMurals(streamer: CityStreamer): WorldSystem | null {
  if (!streamer) return null;
  return null;
}
