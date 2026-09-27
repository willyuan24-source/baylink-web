import type { W4Site } from './siteKit';
import { beachChalet } from './beach-chalet';
import { bisonPaddock } from './bison-paddock';
import { blueHeronLake } from './blue-heron-lake';
import { calAcademy } from './cal-academy';
import { ccsfDrpac } from './ccsf-drpac';
import { ccsfOcean } from './ccsf-ocean';
import { doloresPark } from './dolores-park';
import { gearyWest } from './geary-west';
import { haightAshbury } from './haight-ashbury';
import { hippieHill } from './hippie-hill';
import { japaneseTeaGarden } from './japanese-tea-garden';
import { kezarStadium } from './kezar-stadium';
import { koretCarousel } from './koret-carousel';
import { landsEnd } from './lands-end';
import { murphyWindmill } from './murphy-windmill';
import { musicConcourse } from './music-concourse';
import { oceanBeach } from './ocean-beach';
import { sfState } from './sf-state';
import { sfZoo } from './sf-zoo';
import { sfmoma } from './sfmoma';
import { stIgnatius } from './st-ignatius';
import { stonestown } from './stonestown';
import { ucsfMissionBay } from './ucsf-mission-bay';
import { unionSquare } from './union-square';
import { ucsfParnassus } from './ucsf-parnassus';
import { usfLoneMountain } from './usf-lone-mountain';
import { yerbaBuenaGardens } from './yerba-buena-gardens';

/**
 * The wave-4 site records in the plan's build order (§2.3), and nothing else: the ONE module the registry
 * (landmarks/index.ts) imports at the integration (`SF_LANDMARKS = [...existing, ...W4_SITES]`).
 *
 * It must never import './index', './w4sites' or './context' at runtime (type imports are erased), and neither may
 * the site modules, siteKit.ts or siteTerrain.ts: w4sites.ts reads the registry (sfLandmark, landmarkToWorld), so an
 * index.ts → w4sites.ts import would close a cycle, and whichever module loads w4sites.ts first (lane V's
 * opus-bay-w4-assets test, lane P's flag lookup) would meet `W4_SITES` in its temporal dead zone (ReferenceError at
 * load). tests/opus-bay-sf-sites-w4.test.ts checks the import graph of this file.
 */
export const W4_SITES: readonly W4Site[] = [
  // P1 · owner requests
  stonestown,
  sfState,
  ucsfParnassus,
  usfLoneMountain,
  stIgnatius,
  ccsfOcean,
  ccsfDrpac,
  ucsfMissionBay,
  // P2 · tier-1 attractions
  calAcademy,
  musicConcourse,
  japaneseTeaGarden,
  unionSquare,
  sfmoma,
  yerbaBuenaGardens,
  haightAshbury,
  doloresPark,
  landsEnd,
  oceanBeach,
  sfZoo,
  murphyWindmill,
  beachChalet,
  // P3 · tier 2 on the lines
  bisonPaddock,
  blueHeronLake,
  kezarStadium,
  koretCarousel,
  hippieHill,
  gearyWest,
];
