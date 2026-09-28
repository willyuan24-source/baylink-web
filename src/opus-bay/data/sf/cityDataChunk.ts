/**
 * W5-V3 · the city's text tables as one lazy chunk (lane V). `data/sf/cityData.ts` imports this module dynamically,
 * in city mode only, and GameRoot's modules read the tables from its `CITY_DATA` instead of importing them statically,
 * so district mode (the default world) never downloads them and GameRoot's chunk stays small.
 *
 * **Rule (tested: tests/opus-bay-sf-budget.test.ts "W5-V3"):** nothing this module reaches at runtime may be in
 * GameRoot's static graph. `cityData.ts` awaits this chunk while GameRoot's chunk is still evaluating; a module shared
 * by both would stay in GameRoot's chunk, this chunk would import it from there, and the two would wait on each other
 * for ever. Type imports are fine. Add a table here only together with the switch of its last static importer in the
 * main graph to `CITY_DATA`.
 */
export { SF_LANDMARK_INFO } from './landmarks';
