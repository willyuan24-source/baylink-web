import type { W4Site } from './siteKit';
import { balmyAlley } from './balmy-alley';
import { bayviewOperaHouse } from './bayview-opera-house';
import { craneCovePark } from './crane-cove-park';
import { haasLilienthalHouse } from './haas-lilienthal-house';
import { inglesideTerracesSundial } from './ingleside-terraces-sundial';
import { lyonStreetSteps } from './lyon-street-steps';
import { octagonHouse } from './octagon-house';
import { sewardStreetSlides } from './seward-street-slides';

/**
 * The wave-4 tier-3 site records (lane L3, W4-L9: plan §2.4 "Priority 4", in the table's order), and nothing else:
 * the integration imports this list next to w4list.ts (`SF_LANDMARKS = [...existing, ...W4_SITES, ...W4_SITES_T3]`
 * in landmarks/index.ts) and w4sites.ts builds its lookups over both lists (docs/opus-bay/sf-w4-L3.md "Integration").
 *
 * Same rule as w4list.ts: this module, the site modules, siteKit3.ts and siteTerrain3.ts never import './index',
 * './w4sites', './context' or '../sites' at runtime (type imports are erased); tests/opus-bay-sf-sites-w4t3.test.ts
 * walks the import graph.
 */
export const W4_SITES_T3: readonly W4Site[] = [
  balmyAlley,
  bayviewOperaHouse,
  craneCovePark,
  haasLilienthalHouse,
  inglesideTerracesSundial,
  lyonStreetSteps,
  octagonHouse,
  sewardStreetSlides,
];
