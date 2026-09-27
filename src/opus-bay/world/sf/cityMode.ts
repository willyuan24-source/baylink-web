/**
 * Entry of the lazy city chunk (lane C2, HC-2): loaded by `world/cityLoader.ts` only in city mode. Import city code
 * through here (or from inside the chunk), never from the main graph.
 */
export { CityStreamer, cityStreamer } from './stream';
export { CitySites } from './sites';
export { CityWater } from './water';
export { heroLandRaster, heroProxy } from './hero';
export { heroGroundJob, heroGroundProxy } from './heroGround';
export { attachMurals } from './murals';
export { mountCityDebug } from './stats';
export { demSample } from './format';
// for actors/moveSystem.ts (lane E2 request in docs/opus-bay/sf-w2-C2.md): once it reads the glide obstacles through
// cityModule()?.landmarkTallStructures, the landmark data and recipes (≈ 42 KB gzip) leave the main chunk too
export { landmarkTallStructures } from './landmarks/context';
