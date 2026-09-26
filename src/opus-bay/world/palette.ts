import type { TimeOfDay } from '../core/store';

/** DESIGN.md §6 palette (sRGB hex). */
export const PAL = {
  table: '#f3ecdf',
  land: '#ebe2cf',
  sidewalk: '#e9dfca',
  plaza: '#efe6d5',
  pavers: '#e2d6c0',
  wood: '#b98a5a',
  woodDark: '#8a6440',
  concrete: '#cfc5b3',
  concreteDark: '#a99f8e',
  asphalt: '#a29d96',
  asphaltLight: '#b3aea6',
  median: '#b7ab98',
  rail: '#6f7479',
  grass: '#9fbf7a',
  grassDark: '#86a866',
  tree: '#6f9a5b',
  treeDark: '#557f47',
  pine: '#4d7247',
  shedWall: '#e9e0cf',
  shedTrim: '#7f9c8f',
  shedRoof: '#a7b3aa',
  roof: '#d07a55',
  roofDark: '#b8674a',
  victorian: ['#f2c9b1', '#cfe0d0', '#f4e2a8', '#c9d6e8', '#e8c6cf'],
  trimWhite: '#fbf6ec',
  bridge: '#b8c0c4',
  bridgeDark: '#8f989d',
  sun: '#ffd9a3',
  gold: '#e0a94a',
  teal: '#2f8f88',
  terracotta: '#d8744a',
  lampPost: '#3f5a50',
  lampGlass: '#fff1cf',
  strataTop: '#7e6446',
  strata: ['#a98160', '#c49d73', '#9c8a78', '#b3a08a', '#857465'],
  waterDeep: '#3f8f95',
  waterShallow: '#79c1bb',
  foam: '#f4f1e6',
} as const;

export interface TimePreset {
  skyTop: string;
  skyHorizon: string;
  /** below-horizon tint (table far field) */
  skyBottom: string;
  sunColor: string;
  sunIntensity: number;
  /** direction the light comes FROM (unnormalised) */
  sunDir: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  fogDensity: number;
  waterDeep: string;
  waterShallow: string;
  table: string;
  night: number;
  /** sun disc visibility (0 at night) */
  sunDisc: number;
  sparkle: number;
  exposure: number;
  /** 1 at golden hour: anti-solar pink "Belt of Venus" band in the sky */
  golden: number;
  /** post grade: warm (> 0) … cool (< 0) */
  warm: number;
  /** post vignette strength */
  vignette: number;
}

/**
 * Moon direction (world space, toward the moon). Low over the Bay toward Angel Island, so the default night
 * camera at the ferry gate has it in frame and the water under it carries a glitter path.
 */
export const MOON_DIR: [number, number, number] = [-0.389, 0.045, -0.921];

// Sun directions are in world space: the map is rotated 46° (real north = (−0.72, −0.69), east = (0.69, −0.72),
// south = (0.72, 0.69), west = (−0.69, 0.72)), so the golden-hour sun comes from +z behind the default camera.
export const TIME_PRESETS: Record<TimeOfDay, TimePreset> = {
  morning: {
    // low sun from the south-east (along the Ferry Building's long axis): the promenade in front of it is sunlit
    skyTop: '#aecde0', skyHorizon: '#f6e6d3', skyBottom: '#f0e4d4',
    sunColor: '#ffe6c4', sunIntensity: 2.6, sunDir: [0.85, 0.42, 0.22],
    hemiSky: '#cfe0ee', hemiGround: '#dacbb0', hemiIntensity: 1.0,
    fog: '#e9edee', fogDensity: 0.0022,
    waterDeep: '#468f98', waterShallow: '#82c3bf', table: '#e4d8c6',
    night: 0, sunDisc: 0.9, sparkle: 0.55, exposure: 1.0, golden: 0, warm: 0.2, vignette: 0.35,
  },
  day: {
    skyTop: '#98c6e0', skyHorizon: '#f1ebdd', skyBottom: '#efe8da',
    sunColor: '#fff4e2', sunIntensity: 2.6, sunDir: [0.3, 0.79, 0.54],
    hemiSky: '#e6f0f4', hemiGround: '#dccfb6', hemiIntensity: 1.3,
    fog: '#eee9de', fogDensity: 0.0011,
    waterDeep: '#3f8f95', waterShallow: '#79c1bb', table: '#e6d8c0',
    night: 0, sunDisc: 0.7, sparkle: 0.35, exposure: 1.0, golden: 0, warm: 0.25, vignette: 0.35,
  },
  golden: {
    // warm low key light, cool-violet sky fill: the key-art look
    skyTop: '#8fb3d6', skyHorizon: '#ffd9ae', skyBottom: '#f4e2cc',
    sunColor: '#ffc88e', sunIntensity: 3.1, sunDir: [-0.36, 0.34, 0.9],
    hemiSky: '#c4d2e6', hemiGround: '#e3bf96', hemiIntensity: 0.85,
    fog: '#f6dcc0', fogDensity: 0.0012,
    waterDeep: '#3d8b94', waterShallow: '#7fc4ba', table: '#e2cfb2',
    night: 0.05, sunDisc: 1, sparkle: 1, exposure: 1.0, golden: 1, warm: 0.6, vignette: 0.4,
  },
  night: {
    skyTop: '#0f1a33', skyHorizon: '#3a4775', skyBottom: '#1f2336',
    // moonlit blue hour: a soft cool key (weak moon shadows) so the warm lamp pools and windows carry the scene
    sunColor: '#9fb4e0', sunIntensity: 0.38, sunDir: [0.5, 0.75, -0.25],
    hemiSky: '#4a5c8c', hemiGround: '#3a2f35', hemiIntensity: 0.8,
    fog: '#27314f', fogDensity: 0.0018,
    waterDeep: '#1d3f55', waterShallow: '#2e5f6c', table: '#34333d',
    night: 1, sunDisc: 0, sparkle: 0.25, exposure: 1.1, golden: 0, warm: -0.3, vignette: 0.55,
  },
};

/**
 * Streamed-city ground and street colours (sRGB hex), city mode only. Same family as PAL: warm cream paving,
 * lavender-grey asphalt, soft greens; parks and beaches read from Twin Peaks, streets stay quieter than buildings.
 */
export const CITY_PAL = {
  land: PAL.land,
  landShade: '#dfd3bb',
  park: '#9fbf7a',
  grass: '#a8c683',
  forest: '#7ea463',
  golf: '#abcd86',
  pitch: '#95c070',
  sand: '#eedcb0',
  scrub: '#b8b98a',
  rock: '#bba88c',
  plaza: '#ede3d0',
  parking: '#d2cabd',
  earth: '#c9b391',
  lip: '#b8a384',
  sidewalk: '#ece2cd',
  curb: '#d4c9b5',
  asphalt: '#a7a29b',
  asphaltMajor: '#9e9992',
  motorway: '#97928b',
  dash: '#f4efe2',
  footway: '#e3d7c1',
  path: '#d9c7a3',
  steps: '#d8cebb',
  pedestrian: '#eee5d3',
  cycleway: '#d1c2a6',
  track: '#cdba95',
  rail: '#6d665e',
  railTop: '#c9ccce',
  ballast: '#b6aa96',
  deck: '#c8c0b2',
  deckSide: '#b2aa9c',
  pillar: '#d6cebf',
  pier: '#b98a5a',
  pierSide: '#8a6440',
  /** the Pacific (deeper and cooler than the Bay) */
  pacificDeep: '#2f6f82',
} as const;
