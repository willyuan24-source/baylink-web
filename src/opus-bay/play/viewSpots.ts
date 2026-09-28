import type { Bilingual } from '../core/types';

/**
 * Wave 5 · lane A (W5-A1 hook, W5-A4 content) · the 16 看风景 view spots: sit there for 5 s and the camera takes a slow
 * 20 s look (play/sit.ts). Lane E's notebook builds its 看风景 page from this registry and pays `reward view:<id>`
 * (5 coins, stamp `view:<id>`); the `view` bitset of the play save is indexed by VIEW_SPOT_IDS.
 *
 * APPEND-ONLY: an id's index never moves (it is its bit in `play.g.view`); a spot that has to go stays in the list with
 * `retired: true`. DEPENDENCY-FREE (types only): lane E's chunk imports it statically.
 *
 * City frame (projectCity: x east-ish, z south-ish, u). `x, z` is where the player sits (standable, found with the
 * published city on 2026-09-28: tests/opus-bay-w5-play-acts.test.ts checks it); `look` is what the spot faces (the seat
 * heading points at it and the slow look's camera aims there). `area` = the attraction area the spot belongs to (the
 * MF8 "something in every part of the city" count). Facts in `line` were checked on the web on `verifiedAt` (`source`).
 */

export interface ViewSpot {
  id: string;
  name: Bilingual;
  /** one short line for the slow look's caption (zh ≤ 20 characters) */
  line: Bilingual;
  x: number;
  z: number;
  look: { x: number; z: number };
  area: 'north-downtown' | 'bridge-presidio' | 'coast' | 'twin-peaks-mission' | 'park-sunset';
  /** the attraction id it sits in (data/sf/attractions.ts), when there is one */
  attraction?: string;
  source: string;
  verifiedAt: string;
  retired?: true;
}

/** What the spots look at (city frame): kept as names so the list reads. */
const DOWNTOWN = { x: 150, z: 250 };
const GOLDEN_GATE = { x: -796, z: 564 };
const BAY_BRIDGE = { x: 278, z: 72 };
const ALCATRAZ = { x: -468, z: -58 };
const PACIFIC = { x: -1000, z: 1260 };
const BAY_NORTH = { x: -260, z: 150 };
/** the Wave Organ's terraces at the end of its spit (the site's origin) */
const WAVE_ORGAN = { x: -412.3, z: 290 };

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

export const VIEW_SPOTS: readonly ViewSpot[] = [
  { id: 'twin-peaks', name: bi('双峰', 'Twin Peaks'), line: bi('湾区风景尽收眼底', 'The Bay Area spread out below'), x: 128.9, z: 929.3, look: DOWNTOWN, area: 'twin-peaks-mission', attraction: 'twin-peaks', source: 'https://sfrecpark.org/facilities/facility/details/twin-peaks-384', verifiedAt: '2026-09-28' },
  { id: 'bernal-heights', name: bi('伯纳尔高地', 'Bernal Heights'), line: bi('山顶一圈都是风景', 'Views all the way round'), x: 530.6, z: 776.9, look: DOWNTOWN, area: 'twin-peaks-mission', attraction: 'bernal-heights-park', source: 'https://sfrecpark.org/facilities/facility/details/Bernal-Heights-Park-151', verifiedAt: '2026-09-28' },
  { id: 'grand-view', name: bi('龟山', 'Grand View Park'), line: bi('远处是大海和金门大桥', 'The ocean and the Golden Gate beyond'), x: -99.6, z: 1132.6, look: GOLDEN_GATE, area: 'park-sunset', attraction: 'grand-view-park', source: 'https://www.sfgate.com/local/article/grandview-park-18090645.php', verifiedAt: '2026-09-28' },
  { id: 'ina-coolbrith', name: bi('伊娜·库尔布里斯公园', 'Ina Coolbrith Park'), line: bi('城市和海湾都在眼前', 'The city and the Bay in view'), x: -69.7, z: 169.7, look: BAY_BRIDGE, area: 'north-downtown', attraction: 'ina-coolbrith-park', source: 'https://sfrecpark.org/Facilities/Facility/Details/Ina-Coolbrith-Park-175', verifiedAt: '2026-09-28' },
  { id: 'alta-plaza', name: bi('阿尔塔广场公园', 'Alta Plaza Park'), line: bi('往北望向海湾', 'Looking north to the Bay'), x: -213, z: 447.6, look: BAY_NORTH, area: 'bridge-presidio', attraction: 'alta-plaza-park', source: 'https://sfrecpark.org/facilities/facility/details/Alta-Plaza-Park-147', verifiedAt: '2026-09-28' },
  { id: 'dolores-park', name: bi('多洛雷斯公园坡顶', 'Dolores Park, the top'), line: bi('草坡上看市中心', 'Downtown from the lawn'), x: 248, z: 717, look: DOWNTOWN, area: 'twin-peaks-mission', attraction: 'dolores-park', source: 'https://en.wikipedia.org/wiki/Mission_Dolores_Park', verifiedAt: '2026-09-28' },
  { id: 'lands-end', name: bi('天涯海角步道', 'Lands End trail'), line: bi('悬崖外就是金门海峡', 'The Golden Gate past the cliffs'), x: -707, z: 1170, look: GOLDEN_GATE, area: 'coast', attraction: 'lands-end', source: 'https://www.nps.gov/goga/planyourvisit/landsend.htm', verifiedAt: '2026-09-28' },
  { id: 'sutro-heights', name: bi('苏特罗高地', 'Sutro Heights'), line: bi('俯看太平洋和海滩', 'The Pacific and Ocean Beach below'), x: -688.1, z: 1256.1, look: PACIFIC, area: 'coast', attraction: 'sutro-heights-park', source: 'https://www.nps.gov/places/000/sutro-heights-park.htm', verifiedAt: '2026-09-28' },
  // (the mid-wave checkpoint's CP-9: the tip of the spit is a 3 u walk the nav graph does not reach, and the sweep's
  // walker moved only 2 of 4 ways there; the spot sits on the lawn at the spit's root on Yacht Road, looking out along
  // the breakwater to the organ's terraces at its end — reached on foot, all four ways open)
  { id: 'wave-organ', name: bi('海浪风琴', 'Wave Organ'), line: bi('防波堤尽头，海浪会唱歌', 'Waves sing at the jetty’s end'), x: -444, z: 346.8, look: WAVE_ORGAN, area: 'bridge-presidio', attraction: 'wave-organ', source: 'https://en.wikipedia.org/wiki/Wave_Organ', verifiedAt: '2026-09-28' },
  { id: 'crissy-beach', name: bi('克里西场海滩', 'Crissy Field beach'), line: bi('沙滩正对金门大桥', 'A beach facing the Golden Gate'), x: -581, z: 538, look: GOLDEN_GATE, area: 'bridge-presidio', attraction: 'crissy-field', source: 'https://presidio.gov/explore/attractions/crissy-field-east-beach', verifiedAt: '2026-09-28' },
  // (CP-9 follow-up, 2026-09-28: coit and corona-heights moved a few steps onto open ground — the sweep's CORRIDOR rows,
  // where only 2 of 4 ways moved: 3 u west on the plaza, 3.6 u down the summit's grass)
  { id: 'coit', name: bi('科伊特塔下', 'Below Coit Tower'), line: bi('东边是海湾大桥', 'The Bay Bridge to the east'), x: -46.5, z: 49.5, look: BAY_BRIDGE, area: 'north-downtown', attraction: 'coit-tower', source: 'https://sfrecpark.org/Facilities/Facility/Details/Pioneer-Park-381', verifiedAt: '2026-09-28' },
  { id: 'buena-vista', name: bi('布埃纳维斯塔公园', 'Buena Vista Park'), line: bi('林间远望金门大桥', 'The Golden Gate through the trees'), x: 31, z: 739.2, look: GOLDEN_GATE, area: 'twin-peaks-mission', attraction: 'buena-vista-park', source: 'https://www.lonelyplanet.com/usa/san-francisco/the-haight-and-hayes-valley/attractions/buena-vista-park/a/poi-sig/383857/1329645', verifiedAt: '2026-09-28' },
  { id: 'mount-davidson', name: bi('戴维森山', 'Mount Davidson'), line: bi('全城最高的天然山顶', 'The highest natural point in the city'), x: 245.5, z: 1170.9, look: DOWNTOWN, area: 'twin-peaks-mission', attraction: 'mount-davidson', source: 'https://en.wikipedia.org/wiki/Mount_Davidson_(California)', verifiedAt: '2026-09-28' },
  { id: 'corona-heights', name: bi('科罗娜高地', 'Corona Heights'), line: bi('红岩山顶看市中心', 'Downtown from the red rocks'), x: 79, z: 745, look: DOWNTOWN, area: 'twin-peaks-mission', attraction: 'corona-heights-randall-museum', source: 'https://en.wikipedia.org/wiki/Corona_Heights_Park', verifiedAt: '2026-09-28' },
  { id: 'marina-green', name: bi('码头绿地', 'Marina Green'), line: bi('草地尽头就是海湾', 'Where the lawn meets the Bay'), x: -382.1, z: 300.7, look: GOLDEN_GATE, area: 'bridge-presidio', attraction: 'marina-green', source: 'https://goldengatepark.com/marina-green-park.html', verifiedAt: '2026-09-28' },
  { id: 'aquatic-park', name: bi('水上公园', 'Aquatic Park'), line: bi('小海湾外是恶魔岛', 'Alcatraz beyond the cove'), x: -243, z: 140, look: ALCATRAZ, area: 'north-downtown', source: 'https://www.sfgate.com/local/article/aquatic-park-17860469.php', verifiedAt: '2026-09-28' },
];

/** The registry order (a spot's bit in `play.g.view`). Append only. */
export const VIEW_SPOT_IDS: readonly string[] = VIEW_SPOTS.map(s => s.id);

/** Seconds of sitting at a spot before the slow look starts; the look's length; the coins it pays once. */
export const VIEW_SIT_SECONDS = 5;
export const VIEW_LOOK_SECONDS = 20;
export const VIEW_COINS = 5;
/** How close to the spot the 坐下看风景 prompt shows (u). */
export const VIEW_RADIUS = 3;

export const viewSpotById = (id: string): ViewSpot | undefined => VIEW_SPOTS.find(s => s.id === id);
/** The registry index of a spot (its bit), or −1. */
export const viewSpotIndex = (id: string): number => VIEW_SPOT_IDS.indexOf(id);
/** The seat heading (three.js: faces (sin h, cos h)) that looks at the spot's view. */
export const viewHeading = (s: Pick<ViewSpot, 'x' | 'z' | 'look'>): number => Math.atan2(s.look.x - s.x, s.look.z - s.z);
/** The reward source lane E pays once. */
export const viewReward = (id: string): string => `view:${id}`;
