import { PAL } from '../palette';

/**
 * Building colours (sRGB hex). District sets are the hand-tuned key-art pastels (moved from world/city.ts);
 * city pools follow the neighbourhood families of sf-research-gta-visuals §3.2: high chroma only for Victorian,
 * Sunset stucco and the Mission; FiDi / SoMa stay neutral.
 */

// --- district (world/city.ts lots) ---
/** Downtown facade set (key-art pastels), ±4 % per building; roofs 8 % darker than their walls. */
export const FACADES = ['#e8dcc4', '#d3dccb', '#ecc9b4', '#cdd5dc', '#e2cfae'];
export const RESID = ['#efe4d0', '#e6d6bd', '#f3e9d7', '#e1d9cc', '#ecdcc6', '#e0d3bf', '#f0e0cc'];
/** Telegraph Hill roofs: terracotta and slate, never charcoal. */
export const ROOF_VIC = ['#d07a55', '#b8674a', '#8c9aa6', '#c47252'];
/** Pier 39 timber shops: weathered wood, cream trim; colour only on signage and awnings. */
export const SHOP_WALL = '#b09677', SHOP_TRIM = '#efe4cf', SHOP_ROOF = '#94806c';

// --- streamed city: body pools per style (index = CityBuildingSpec.palette % length) ---
export const CITY_WALLS = {
  /** PAL.victorian + two more; the last two are the Mission's warm pair (lane A: palette 7 / 8 for the Mission) */
  victorian: [...PAL.victorian, '#d9c8e6', '#b9d3cf', '#f0b15a', '#e57b5e'],
  edwardian: ['#efe4d0', '#e6d6bd', '#dfe3dc', '#e9d5c9'],
  /** Sunset / Parkside / Richmond "Doelger" stucco */
  sunset: ['#cfe6d8', '#f6d7c3', '#cfe0ee', '#f4e7b8', '#f1d0d6', '#efe7da'],
  marina: ['#f3ead8', '#f1dcc8', '#e9e1d3'],
  chinatown: ['#ece2cf', '#e6d0b8'],
  brick: ['#b56e55', '#a8644c', '#9b5b47', '#c08463'],
  deco: ['#efe6d6', '#e6dccb', '#e9e2d4'],
  office: FACADES,
  tower: [...FACADES, '#d8dcd6'],
  industrial: ['#cfc5b3', '#bdb6a8', '#d8cfbf', '#b9a58f'],
  civic: ['#ece5d6', '#e4dccb', '#efe9dc'],
  pier: ['#e7ddca', '#e9e0cf'],
  residential: RESID,
} as const;

/** Accents: Victorian trim paint, Chinatown balconies / parapets. */
export const VIC_ACCENT = ['#2f8f88', '#d8744a', '#7a5a8c', '#c9a14a'];
export const CHINATOWN_ACCENT = ['#b8463c', '#2f7d5a', '#d9a441'];
export const SLATE = ['#8c9aa6', '#9aa3a4', '#7f8b93'];
export const TILE = '#c46a4a';
export const IRON = '#3b3f3c';
export const RELIEF = '#f6efe1';
export const STONE = '#dcc6a8';
export const GLASS_WALL = '#bccaca';
