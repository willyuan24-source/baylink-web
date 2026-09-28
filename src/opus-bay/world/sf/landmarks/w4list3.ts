import type { W4Site } from './siteKit';
import { balmyAlley } from './balmy-alley';
import { bayviewOperaHouse } from './bayview-opera-house';
import { craneCovePark } from './crane-cove-park';
import { haasLilienthalHouse } from './haas-lilienthal-house';
import { inglesideTerracesSundial } from './ingleside-terraces-sundial';
import { lyonStreetSteps } from './lyon-street-steps';
import { octagonHouse } from './octagon-house';
import { sewardStreetSlides } from './seward-street-slides';
import { vermontStreetCrookedBlock } from './vermont-street-crooked-block';
import { waveOrgan } from './wave-organ';
import { womensBuilding } from './womens-building';
import { altaPlazaPark } from './alta-plaza-park';
import { buenaVistaPark } from './buena-vista-park';
import { calle24 } from './calle-24';
import { chinaBeach } from './china-beach';
import { glenCanyonPark } from './glen-canyon-park';
import { inaCoolbrithPark } from './ina-coolbrith-park';
import { lafayettePark } from './lafayette-park';
import { mclarenPark } from './mclaren-park';
import { mountSutroOpenSpace } from './mount-sutro-open-space';
import { mountainLakePark } from './mountain-lake-park';
import { noeValleyTownSquare } from './noe-valley-town-square';
import { patriciasGreen } from './patricias-green';
import { sutroHeightsPark } from './sutro-heights-park';

/**
 * The wave-4 tier-3 site records (lane L3, W4-L9: plan §2.4 "Priority 4", in the table's order), and nothing else.
 *
 * `W4_SITES_T3` is REGISTERED since the integration (W4-IL1: landmarks/index.ts SF_SITES = the 24 landmarks, w4list.ts,
 * this list; w4sites.ts W4_ALL_SITES): the city draws, excludes and walks these, and landmarks/tops.ts has a row for
 * each. `W4_SITES_T3_NEXT` holds the tier-3 sites built after that, which wait for their tops rows: the integration
 * moves them into `W4_SITES_T3` and re-runs scripts/opus-sf/assets/landmark-tops.ts in the same commit
 * (docs/opus-bay/sf-w4-L3.md "Integration"; lane L3 edits no existing file in its early phase). `W4_SITES_T3_ALL` is
 * both, for the tests and the tier-3 scripts.
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
  vermontStreetCrookedBlock,
];

/** built after the registration: not drawn by the city until the integration moves them (with their tops rows) */
export const W4_SITES_T3_NEXT: readonly W4Site[] = [
  waveOrgan,
  womensBuilding,
  altaPlazaPark,
  buenaVistaPark,
  calle24,
  chinaBeach,
  glenCanyonPark,
  inaCoolbrithPark,
  lafayettePark,
  mclarenPark,
  mountSutroOpenSpace,
  mountainLakePark,
  noeValleyTownSquare,
  patriciasGreen,
  sutroHeightsPark,
];

export const W4_SITES_T3_ALL: readonly W4Site[] = [...W4_SITES_T3, ...W4_SITES_T3_NEXT];
