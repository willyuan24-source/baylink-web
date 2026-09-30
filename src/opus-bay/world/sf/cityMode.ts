/**
 * Entry of the lazy city chunk (lane C2, HC-2): loaded by `world/cityLoader.ts` only in city mode. Import city code
 * through here (or from inside the chunk), never from the main graph.
 */
// W7-P1 (lane P): the city's view field for the follow camera rides with this chunk (it registers itself with
// actors/citySlots.ts, before the city terrain exists; district mode answers the hero rule without it)
import '../../actors/viewField';
export { CityStreamer, cityStreamer } from './stream';
export { CitySites } from './sites';
export { CityWater } from './water';
export { heroLandRaster, heroProxy } from './hero';
// the hero's far detail tiles (W5-V2)
export { heroFarChunks, pairHeroTiles } from './farHero';
export { heroGroundJob, heroGroundProxy } from './heroGround';
export { attachMurals } from './murals';
export { CloudBank } from './cloudBank';
// Karl's live state and the city haze factor (world/environment.ts takes them in city mode; wave 3, P7)
export { KarlState, cityFogK } from './fog';
export { LightField, siteLightSpecs } from './lights';
export { mountCityDebug } from './stats';
// the World's city part (world/world.ts enableCity / the constructor's city branch)
export { angelIslandBoard, heroGroundOf, startCityWorld, westSeawall, wharfPoles } from './cityWorld';
export { demSample } from './format';
// for actors/moveSystem.ts (lane E2 request in docs/opus-bay/sf-w2-C2.md): once it reads the glide obstacles through
// cityModule()?.landmarkTallStructures, the landmark data and recipes (≈ 42 KB gzip) leave the main chunk too
export { landmarkTallStructures } from './landmarks/context';
