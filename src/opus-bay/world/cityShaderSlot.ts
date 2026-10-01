import { CITY_DATA } from '../data/sf/cityData';
import type { CityShaders } from '../data/sf/cityShaders';

/**
 * W8-P1 · the city-only GLSL blocks of `world/materials.ts` and `world/environment.ts` (lane P; GameRoot ≤ 255 KB gzip).
 *
 * The blocks live in `data/sf/cityShaders.ts`, which rides with the city's data chunk: `data/sf/cityData.ts` awaits that
 * chunk at the top level in city mode (and always in node), before any module that imports this slot evaluates, so
 * the shader strings built at module load have them in city mode exactly as before. District mode never fetches the
 * chunk: every block is empty there, and the district's programs lose only branches its geometry never takes
 * (window styles 9 / 10, ground pattern 9, the city streets' glow, the city's day sky: tests/opus-bay-w8-p.test.ts).
 */
const NONE: CityShaders = { groundTown: '', groundStreetGlow: '', toyFacades: '', skyPuffs: '', skyCityDay: '' };

export const CITY_SHADERS: CityShaders = CITY_DATA?.CITY_SHADERS ?? NONE;
