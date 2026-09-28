import { CONTENT_MODE } from '../contentMode';

/**
 * W5-V3 · the city's text tables out of GameRoot's chunk (lane V; plan MF9 "move the city-only data out of the GameRoot
 * graph").
 *
 * The content modules resolve their tables at import time (`data/contentMode.ts`: the world mode is fixed for the page),
 * so the city's data has to be there before they evaluate. This module awaits the data chunk at the top level: in city
 * mode GameRoot's chunk pauses here until `cityDataChunk.ts` has arrived (one small request, in parallel with nothing
 * else the game needs yet), then every table resolves exactly as before. District mode never fetches it: `CITY_DATA`
 * is null and the city tables built from it are empty (district mode never reads them: `byMode`).
 *
 * Node (tests, QA scripts: no `import.meta.env`) always loads it, so `CITY_*` exports and `contentFor('city')` stay
 * whole there.
 */
export type CityDataChunk = typeof import('./cityDataChunk');

/**
 * Whether this page needs the city's data: city mode in the game, always outside a Vite build (node tests and QA
 * scripts: `import.meta.env` is undefined there; `document` is not a test, several tests fake it).
 */
export function cityDataWanted(mode: string = CONTENT_MODE, bundled: boolean = (import.meta.env as object | undefined) !== undefined): boolean {
  return mode === 'city' || !bundled;
}

export const CITY_DATA: CityDataChunk | null = cityDataWanted() ? await import('./cityDataChunk') : null;
