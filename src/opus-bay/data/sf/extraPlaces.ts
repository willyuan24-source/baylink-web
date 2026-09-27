import type { Bilingual } from '../../core/types';
import type { SfPlace, SfPlaceKindAll } from '../../world/sf/format';
import { ATTRACTION_INDEX, type AttractionIndex } from './attractions';

/**
 * Wave 4 · place-index changes as data (lane P, W4-P3; plan sf-w4-plan.md §4.1 "Data", lead note §4.6):
 *
 * - `EXTRA_PLACES`: the 47 new place rows of the attraction list (id = the attraction id; universities, Stonestown,
 *   churches, streets, small museums …). They live here at runtime, not in places.json: the frozen `sf-data` test pins
 *   every places.json row to an openstreetmap.org source, and these cite the official / reference page the scouting
 *   verified. Anchor = the attraction point (the map badge), `arrival` = the walkable spot the scouting measured (where
 *   跟 BAYBAY 去 ends). `y` / `zone` / `graphNode` come from scripts/opus-sf/places-sidecar.ts (`EXTRA_PLACE_SNAPS`,
 *   regenerated with `--snaps`, verified with `--check`), exactly as the build snaps places.json rows.
 * - `PLACE_NAME_FIXES`: map name = card name (plan §4.1 / §2.5): the rows the landmark matcher picks for the Golden
 *   Gate Bridge (`ggb-deck-mid`, "桥面中段") and Sutro Baths (`osm-w32776540`, "Main pool house"), the glossary words
 *   (叮当车 not 缆车, 双峰 not 双子峰, 迪扬 not 笛洋), Fort Point 炮台 and the 2024 rename of Stow Lake (蓝鹭湖).
 * - `PLACE_REANCHORS`: Lands End moves to the Lookout (the curated point is 143 u up the trail), Lake Merced arrives on
 *   the Harding Park shore (its point is in the lake).
 * - `PLACE_KIND_FIXES`: the zoo row becomes kind `zoo` (a wave-4 kind; `SfPlaceKind` absorbs them at the integration).
 * - `PLACE_HIDDEN`: the curated `sutro-baths` dot duplicates the landmark's own row 2 u away (it stays in places.json:
 *   the sidecar removes no ids).
 * - `attractionArrivals()` (review fix): every published row an attraction speaks for (its primary attraction) ends
 *   travel at that attraction's `arrival`, so a trip to the place ends inside lane C's 12 u arrival radius (Fort Funston's
 *   OSM centroid was 71 u from the attraction's arrival, Corona Heights 19 u, Blue Heron Lake 15 u …). The 24 landmark
 *   rows still take the landmark anchor in buildPlaceIndex, which is where their attractions arrive too.
 *
 * `applyW4Places(file)` applies all of it to the published rows (pure; node tests run it on the file on disk).
 */

export const EXTRA_VERIFIED_AT = '2026-09-27';

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

export interface ExtraPlace {
  id: string;
  name: Bilingual;
  kind: SfPlaceKindAll;
  /** anchor (map badge), world city frame */
  x: number;
  z: number;
  /** where travel ends (walkable, measured by the scouting) */
  arrival: { x: number; z: number };
  /** the page that verifies the place (the attraction's first source) */
  sourceUrl: string;
  /** the OSM building the lane-L site replaces (informational) */
  replaces?: string;
  /** OSM features that are this same place: the sidecar never adds them as rows of their own */
  osm?: readonly string[];
  /** inside the hand-made hero slab (card + badge only) */
  hero?: boolean;
}

/** The 47 new rows (from docs/opus-bay/sf-w4-attractions.json, placeMatch "NEW"). */
export const EXTRA_PLACES: readonly ExtraPlace[] = [
  { id: 'st-ignatius-church', name: bi('圣依纳爵堂', 'St Ignatius Church'), kind: 'religious', x: -150.9, z: 752.8, arrival: { x: -152.6, z: 756.4 }, sourceUrl: 'https://en.wikipedia.org/wiki/Saint_Ignatius_Church_(San_Francisco)', replaces: 'way/225193440' },
  { id: 'sf-state-university', name: bi('旧金山州立大学', 'San Francisco State University'), kind: 'campus', x: 198.2, z: 1555.6, arrival: { x: 198.4, z: 1555.9 }, sourceUrl: 'https://www.sfsu.edu/about', osm: ['way/28965902'] },
  { id: 'stonestown-galleria', name: bi('石镇购物中心', 'Stonestown Galleria'), kind: 'shopping', x: 165.9, z: 1479.9, arrival: { x: 172.1, z: 1474.1 }, sourceUrl: 'https://www.stonestowngalleria.com/en/visit/', replaces: 'way/1154799336', osm: ['way/1154799336'] },
  { id: 'ccsf-ocean-campus', name: bi('旧金山城市学院（Ocean 校区）', 'City College of San Francisco · Ocean Campus'), kind: 'campus', x: 421.9, z: 1268.3, arrival: { x: 424.9, z: 1265.6 }, sourceUrl: 'https://ccsf.libanswers.com/patrons/faq/432269', osm: ['way/39335793'] },
  { id: 'ucsf-parnassus', name: bi('加州大学旧金山分校 · 帕纳萨斯校区', 'UCSF Parnassus Heights'), kind: 'campus', x: -56.8, z: 939.6, arrival: { x: -60.4, z: 934.9 }, sourceUrl: 'https://realestate.ucsf.edu/projects/ucsf-health-helen-diller-hospital-hdh', replaces: 'way/288632172', osm: ['way/34324395', 'node/1307325427', 'node/1128423975'] },
  { id: 'university-of-san-francisco', name: bi('旧金山大学', 'University of San Francisco (USF)'), kind: 'campus', x: -188.5, z: 706.2, arrival: { x: -184.1, z: 711.4 }, sourceUrl: 'https://www.usfca.edu/about', osm: ['relation/5996294', 'node/12747187201'] },
  { id: 'ucsf-mission-bay', name: bi('加州大学旧金山分校 · 米慎湾校区', 'UCSF Mission Bay campus'), kind: 'campus', x: 441, z: 292.5, arrival: { x: 440.6, z: 292.1 }, sourceUrl: 'https://www.ucsf.edu/about/locations/mission-bay', osm: ['way/224832527'] },
  { id: 'academy-of-art-university', name: bi('旧金山艺术大学', 'Academy of Art University'), kind: 'campus', x: 154.1, z: 162, arrival: { x: 153.4, z: 162.4 }, sourceUrl: 'https://www.academyart.edu/', osm: ['node/4628353540', 'way/93420060', 'relation/15635086'] },
  { id: 'california-college-of-the-arts', name: bi('加州艺术学院', 'California College of the Arts (San Francisco campus)'), kind: 'campus', x: 394.5, z: 355.2, arrival: { x: 394.9, z: 355.1 }, sourceUrl: 'https://www.cca.edu/about/vanderbilt-agreement/', osm: ['way/184540572', 'way/1427026192'] },
  { id: 'sf-conservatory-of-music', name: bi('旧金山音乐学院', 'San Francisco Conservatory of Music (and Bowes Center)'), kind: 'campus', x: 124, z: 468.7, arrival: { x: 125.6, z: 470.6 }, sourceUrl: 'https://sfcm.edu/discover/campus-life/bowes-center' },
  { id: 'uc-law-sf', name: bi('加州大学旧金山法学院', 'UC Law San Francisco (University of California College of the Law, San Francisco)'), kind: 'campus', x: 102.7, z: 368.3, arrival: { x: 104.6, z: 366.4 }, sourceUrl: 'https://www.uclawsf.edu/2023/01/03/welcome-to-university-of-california-college-of-the-law-san-francisco/', osm: ['way/301557499'] },
  { id: 'holy-virgin-cathedral', name: bi('圣母大教堂（俄罗斯东正教）', 'Holy Virgin Cathedral (Joy of All Who Sorrow)'), kind: 'religious', x: -493.6, z: 999.4, arrival: { x: -495.4, z: 998.6 }, sourceUrl: 'https://en.wikipedia.org/wiki/Holy_Virgin_Cathedral' },
  { id: 'beach-chalet', name: bi('海滩小屋（金门公园游客中心）', 'Beach Chalet (Golden Gate Park Visitor Center)'), kind: 'historic', x: -576.9, z: 1329.5, arrival: { x: -578.6, z: 1330.9 }, sourceUrl: 'https://www.beachchalet.com/visitors-center' },
  { id: 'bison-paddock', name: bi('金门公园野牛围场', 'Golden Gate Park Bison Paddock'), kind: 'park', x: -476, z: 1219.8, arrival: { x: -475.9, z: 1219.9 }, sourceUrl: 'https://www.sfzoo.org/historic-sites-golden-gate-park-bison/' },
  { id: 'koret-carousel', name: bi('科雷特儿童乐园与旋转木马', 'Koret Children\'s Quarter & Golden Gate Park Carousel'), kind: 'park', x: -109.9, z: 873.4, arrival: { x: -109.9, z: 873.4 }, sourceUrl: 'https://sfrecpark.org/Facilities/Facility/Details/Koret-Childrens-Quarter-and-Carousel-414/' },
  { id: 'maritime-museum-bathhouse', name: bi('旧金山海事博物馆（水上公园浴场大楼）', 'San Francisco Maritime Museum (Aquatic Park Bathhouse)'), kind: 'museum', x: -249.6, z: 167.8, arrival: { x: -250.9, z: 166.1 }, sourceUrl: 'https://www.nps.gov/safr/learn/historyculture/aquatic-park-bathhouse.htm' },
  { id: 'old-st-marys-cathedral', name: bi('老圣玛利亚教堂', 'Old St. Mary\'s Cathedral'), kind: 'religious', x: 56.8, z: 153.8, arrival: { x: 55.9, z: 155.6 }, sourceUrl: 'http://www.osmsf.org/' },
  { id: 'sing-chong-sing-fat-buildings', name: bi('都板街宝塔楼', 'Sing Chong & Sing Fat pagoda buildings (Grant Ave & California St)'), kind: 'historic', x: 56.5, z: 158.7, arrival: { x: 56.6, z: 158.6 }, sourceUrl: 'https://theclio.com/entry/186932' },
  { id: 'st-marys-cathedral', name: bi('圣玛利亚大教堂', 'Cathedral of Saint Mary of the Assumption'), kind: 'religious', x: -12.8, z: 421.2, arrival: { x: -16.1, z: 426.4 }, sourceUrl: 'https://smcsf.org/visit', replaces: 'way/7814696' },
  { id: 'tiled-steps-16th-avenue', name: bi('第16大道马赛克阶梯', '16th Avenue Tiled Steps (Moraga Steps)'), kind: 'attraction', x: -113.3, z: 1143.4, arrival: { x: -113.6, z: 1143.4 }, sourceUrl: 'https://en.wikipedia.org/wiki/16th_Avenue_Tiled_Steps' },
  { id: 'clement-street', name: bi('企李街（列治文区“新华埠”）', 'Clement Street (Inner Richmond)'), kind: 'street', x: -331, z: 775.8, arrival: { x: -331.1, z: 775.9 }, sourceUrl: 'https://www.sfexaminer.com/news/the-city/how-richmond-district-became-second-san-francisco-chinatown/article_a7783c70-e034-11ef-8c71-3b9f0e67a124.html' },
  { id: 'irving-street', name: bi('尔文街（日落区华人商业街）', 'Irving Street (Sunset District)'), kind: 'street', x: -248.7, z: 1120.6, arrival: { x: -247.9, z: 1121.6 }, sourceUrl: 'https://www.sfchronicle.com/restaurants/article/The-Middle-Sunset-s-vibrant-food-scene-captures-7381518.php' },
  { id: 'national-aids-memorial-grove', name: bi('国家艾滋病纪念园', 'National AIDS Memorial Grove'), kind: 'garden', x: -168.5, z: 902.3, arrival: { x: -168.4, z: 902.6 }, sourceUrl: 'https://en.wikipedia.org/wiki/National_AIDS_Memorial_Grove' },
  { id: 'saints-peter-and-paul-church', name: bi('圣彼得圣保罗教堂（华盛顿广场）', 'Saints Peter and Paul Church & Washington Square'), kind: 'religious', x: -79.5, z: 98.2, arrival: { x: -76.1, z: 100.1 }, sourceUrl: 'https://www.salesiansspp.org/our-history', hero: true },
  { id: 'balmy-alley', name: bi('巴尔米巷壁画街', 'Balmy Alley'), kind: 'street', x: 456.8, z: 653.4, arrival: { x: 457.1, z: 653.6 }, sourceUrl: 'https://en.wikipedia.org/wiki/Balmy_Alley' },
  { id: 'ingleside-terraces-sundial', name: bi('英格塞德日晷', 'Ingleside Terraces Sundial'), kind: 'historic', x: 283.8, z: 1438, arrival: { x: 284.6, z: 1437.4 }, sourceUrl: 'https://www.outsidelands.org/sundial.php' },
  { id: 'octagon-house', name: bi('八角屋', 'Octagon House'), kind: 'historic', x: -184.1, z: 291.8, arrival: { x: -183.4, z: 290.6 }, sourceUrl: 'https://www.nscda-ca.org/octagon-house/' },
  { id: 'vermont-street-crooked-block', name: bi('佛蒙特街弯道（比九曲花街更弯）', 'Vermont Street crooked block'), kind: 'street', x: 454.3, z: 506.2, arrival: { x: 454.1, z: 505.9 }, sourceUrl: 'https://en.wikipedia.org/wiki/Vermont_Street_(San_Francisco)' },
  { id: 'wave-organ', name: bi('海浪风琴', 'Wave Organ'), kind: 'attraction', x: -412.3, z: 290, arrival: { x: -393.4, z: 303.4 }, sourceUrl: 'https://en.wikipedia.org/wiki/Wave_Organ' },
  { id: 'womens-building', name: bi('女性大楼（MaestraPeace 壁画）', 'The Women\'s Building (MaestraPeace mural)'), kind: 'historic', x: 262.1, z: 640, arrival: { x: 263.6, z: 639.4 }, sourceUrl: 'https://www.womensbuilding.org/our-building/the-mural' },
  { id: 'calle-24', name: bi('24街拉丁裔文化区（Calle 24）', 'Calle 24 Latino Cultural District (24th Street)'), kind: 'neighbourhood', x: 455.5, z: 637.1, arrival: { x: 454.9, z: 637.1 }, sourceUrl: 'https://www.calle24sf.org/ourhistory' },
  { id: 'noe-valley-town-square', name: bi('诺伊谷镇广场', 'Noe Valley Town Square'), kind: 'plaza', x: 319.4, z: 804.4, arrival: { x: 319.1, z: 804.4 }, sourceUrl: 'https://sfrecpark.org/1685/Noe-Valley-Town-Square' },
  { id: 'balboa-theatre', name: bi('巴尔博亚戏院', 'Balboa Theatre'), kind: 'historic', x: -542.6, z: 1152.9, arrival: { x: -541.9, z: 1153.1 }, sourceUrl: 'https://www.balboamovies.com/' },
  { id: 'boudin-bakery', name: bi('波丁酸面包（渔人码头旗舰店）', 'Boudin Bakery (Fisherman\'s Wharf flagship)'), kind: 'attraction', x: -196.2, z: 65.4, arrival: { x: -196.1, z: 65.6 }, sourceUrl: 'https://boudinbakery.com/our-story/', hero: true },
  { id: 'buena-vista-cafe', name: bi('Buena Vista 咖啡馆（爱尔兰咖啡）', 'The Buena Vista Cafe'), kind: 'attraction', x: -224.1, z: 138, arrival: { x: -223.9, z: 137.6 }, sourceUrl: 'https://www.thebuenavista.com/home/irishcoffee.html' },
  { id: 'glide-memorial-church', name: bi('格莱德纪念教堂', 'Glide Memorial Church'), kind: 'religious', x: 92.4, z: 285.4, arrival: { x: 94.1, z: 285.4 }, sourceUrl: 'https://www.glide.org/about/' },
  { id: 'hidden-garden-steps', name: bi('隐秘花园阶梯', 'Hidden Garden Steps'), kind: 'attraction', x: -153.9, z: 1111.5, arrival: { x: -154.1, z: 1111.9 }, sourceUrl: 'https://www.sfgate.com/local/article/hidden-garden-steps-18108794.php' },
  { id: 'india-basin-waterfront-park', name: bi('印度湾滨水公园', 'India Basin Waterfront Park'), kind: 'park', x: 988.2, z: 539.1, arrival: { x: 988.1, z: 538.9 }, sourceUrl: 'https://sfrecpark.org/1153/India-Basin-Waterfront-Park' },
  { id: 'maiden-lane', name: bi('少女巷', 'Maiden Lane (V.C. Morris Gift Shop)'), kind: 'street', x: 106.9, z: 206.1, arrival: { x: 106.9, z: 205.9 }, sourceUrl: 'https://en.wikipedia.org/wiki/Maiden_Lane_(San_Francisco)' },
  { id: 'moscone-center', name: bi('莫斯康展览中心', 'Moscone Center'), kind: 'civic', x: 194.8, z: 197.9, arrival: { x: 190.9, z: 197.6 }, sourceUrl: 'https://www.moscone.com/' },
  { id: 'palace-hotel', name: bi('皇宫酒店', 'Palace Hotel (Garden Court)'), kind: 'historic', x: 138.1, z: 167.5, arrival: { x: 138.4, z: 166.1 }, sourceUrl: 'https://www.sfpalace.com/history/' },
  { id: 'presidio-officers-club', name: bi('要塞公园军官俱乐部', 'Presidio Officers\' Club'), kind: 'historic', x: -450.9, z: 575.6, arrival: { x: -447.4, z: 576.4 }, sourceUrl: 'https://presidio.gov/explore/attractions/presidio-officers-club/' },
  { id: 'tadich-grill', name: bi('塔迪奇烧烤餐厅', 'Tadich Grill'), kind: 'attraction', x: 103.9, z: 91.1, arrival: { x: 104.6, z: 91.1 }, sourceUrl: 'https://tadichgrillsf.com/', hero: true },
  { id: 'tenderloin-museum', name: bi('田德隆博物馆', 'Tenderloin Museum'), kind: 'museum', x: 84.4, z: 323.1, arrival: { x: 84.4, z: 323.6 }, sourceUrl: 'https://www.tenderloinmuseum.org/' },
  { id: 'tin-how-temple', name: bi('天后古庙', 'Tin How Temple (Waverly Place)'), kind: 'religious', x: 26.7, z: 145.6, arrival: { x: 26.6, z: 145.1 }, sourceUrl: 'https://en.wikipedia.org/wiki/Tin_How_Temple' },
  { id: 'union-street-shopping', name: bi('联合街（牛谷购物街）', 'Union Street (Cow Hollow shopping street)'), kind: 'street', x: -221.5, z: 334.8, arrival: { x: -221.6, z: 334.9 }, sourceUrl: 'https://www.sf.gov/perfect-day-along-union-st' },
  { id: 'yoda-fountain', name: bi('尤达喷泉（卢卡斯影业园区）', 'Yoda Fountain (Letterman Digital Arts Center)'), kind: 'attraction', x: -392.6, z: 484.9, arrival: { x: -387.4, z: 484.9 }, sourceUrl: 'https://en.wikipedia.org/wiki/Yoda_Fountain' },
];

/**
 * Snapped values of the extra rows, as the build computes them for places.json rows: ground height at the anchor, the
 * DataSF neighbourhood, the nearest node of the largest walking-graph component within 60 u of the ARRIVAL (−1: none).
 * GENERATED by `npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/places-sidecar.ts --snaps` (do not edit by hand;
 * `--check` fails when these drift from the published data).
 */
export const EXTRA_PLACE_SNAPS: Readonly<Record<string, { y: number; zone: string | null; graphNode: number }>> = {
  'st-ignatius-church': { y: 23.13, zone: 'lone-mountain-usf', graphNode: 6575 },
  'sf-state-university': { y: 7.58, zone: 'lakeshore', graphNode: 31554 },
  'stonestown-galleria': { y: 11.43, zone: 'lakeshore', graphNode: 28533 },
  'ccsf-ocean-campus': { y: 23.64, zone: 'west-of-twin-peaks', graphNode: 27664 },
  'ucsf-parnassus': { y: 26.8, zone: 'inner-sunset', graphNode: 9336 },
  'university-of-san-francisco': { y: 26.5, zone: 'lone-mountain-usf', graphNode: 6486 },
  'ucsf-mission-bay': { y: 0.29, zone: 'mission-bay', graphNode: 17554 },
  'academy-of-art-university': { y: 1.16, zone: 'financial-district-south-beach', graphNode: 15018 },
  'california-college-of-the-arts': { y: 0.18, zone: 'mission-bay', graphNode: 17669 },
  'sf-conservatory-of-music': { y: 3.49, zone: 'hayes-valley', graphNode: 16892 },
  'uc-law-sf': { y: 3.53, zone: 'tenderloin', graphNode: 16332 },
  'holy-virgin-cathedral': { y: 10.28, zone: 'outer-richmond', graphNode: 7274 },
  'beach-chalet': { y: 1.39, zone: 'golden-gate-park', graphNode: 10296 },
  'bison-paddock': { y: 6.03, zone: 'golden-gate-park', graphNode: 11046 },
  'koret-carousel': { y: 16.95, zone: 'golden-gate-park', graphNode: 8157 },
  'maritime-museum-bathhouse': { y: 0.7, zone: 'russian-hill', graphNode: 1649 },
  'old-st-marys-cathedral': { y: 5.51, zone: 'chinatown', graphNode: 14616 },
  'sing-chong-sing-fat-buildings': { y: 6.5, zone: 'chinatown', graphNode: 14616 },
  'st-marys-cathedral': { y: 13.31, zone: 'western-addition', graphNode: 3595 },
  'tiled-steps-16th-avenue': { y: 30.28, zone: 'inner-sunset', graphNode: 11636 },
  'clement-street': { y: 12.89, zone: 'inner-richmond', graphNode: 7002 },
  'irving-street': { y: 15.33, zone: 'sunset-parkside', graphNode: 11488 },
  'national-aids-memorial-grove': { y: 15.79, zone: 'golden-gate-park', graphNode: 8572 },
  'saints-peter-and-paul-church': { y: 0.06, zone: 'north-beach', graphNode: 1458 },
  'balmy-alley': { y: 3.53, zone: 'mission', graphNode: 20434 },
  'ingleside-terraces-sundial': { y: 14.45, zone: 'west-of-twin-peaks', graphNode: 29266 },
  'octagon-house': { y: 6.31, zone: 'marina', graphNode: 3018 },
  'vermont-street-crooked-block': { y: 14.64, zone: 'potrero-hill', graphNode: 18071 },
  'wave-organ': { y: 0.05, zone: 'marina', graphNode: 2122 },
  'womens-building': { y: 2.47, zone: 'mission', graphNode: 20038 },
  'calle-24': { y: 3.14, zone: 'mission', graphNode: 20220 },
  'noe-valley-town-square': { y: 12.2, zone: 'noe-valley', graphNode: 21431 },
  'balboa-theatre': { y: 12.56, zone: 'outer-richmond', graphNode: 10048 },
  'boudin-bakery': { y: 0, zone: 'north-beach', graphNode: 1103 },
  'buena-vista-cafe': { y: 1.93, zone: 'russian-hill', graphNode: 1596 },
  'glide-memorial-church': { y: 3.76, zone: 'tenderloin', graphNode: 16224 },
  'hidden-garden-steps': { y: 26.33, zone: 'inner-sunset', graphNode: 11525 },
  'india-basin-waterfront-park': { y: 1.3, zone: 'bayview-hunters-point', graphNode: 23516 },
  'maiden-lane': { y: 3.77, zone: 'financial-district-south-beach', graphNode: 14910 },
  'moscone-center': { y: 2.19, zone: 'south-of-market', graphNode: 15153 },
  'palace-hotel': { y: 1.87, zone: 'financial-district-south-beach', graphNode: 15014 },
  'presidio-officers-club': { y: 7.33, zone: 'presidio', graphNode: 5324 },
  'tadich-grill': { y: 0, zone: 'financial-district-south-beach', graphNode: 14137 },
  'tenderloin-museum': { y: 4.18, zone: 'tenderloin', graphNode: 16303 },
  'tin-how-temple': { y: 5.61, zone: 'chinatown', graphNode: 14600 },
  'union-street-shopping': { y: 4.42, zone: 'marina', graphNode: 3049 },
  'yoda-fountain': { y: 3.96, zone: 'presidio', graphNode: 2822 },
};

/** Map name = card name (plan §4.1). Keyed by places.json id. */
export const PLACE_NAME_FIXES: Readonly<Record<string, Bilingual>> = {
  'ggb-deck-mid': bi('金门大桥', 'Golden Gate Bridge'),
  'osm-w32776540': bi('苏特罗浴场遗址', 'Sutro Baths ruins'),
  'cable-car-powell-market': bi('Powell & Market 叮当车转车台', 'Powell & Market cable-car turntable'),
  'cable-car-hyde-turnaround': bi('叮当车掉头点 · 海德街', 'Cable car turnaround · Hyde & Beach'),
  'cable-car-museum': bi('叮当车博物馆', 'Cable Car Museum'),
  'twin-peaks': bi('双峰', 'Twin Peaks'),
  'de-young': bi('迪扬博物馆 · 观景塔', 'de Young Museum · Hamon Tower'),
  'fort-point': bi('Fort Point 炮台', 'Fort Point'),
  'stow-lake': bi('蓝鹭湖（原斯托湖）与草莓山', 'Blue Heron Lake (formerly Stow Lake) & Strawberry Hill'),
  'lands-end': bi('天涯海角（Lands End）', 'Lands End (Lookout & Coastal Trail)'),
};

/** New anchors / arrivals (plan §4.1). `x` / `z` move the badge; `arrival` is where travel ends. */
export const PLACE_REANCHORS: Readonly<Record<string, { x?: number; z?: number; arrival: { x: number; z: number } }>> = {
  'lands-end': { x: -703.2, z: 1231.2, arrival: { x: -701.6, z: 1229.6 } },
  'lake-merced': { arrival: { x: 88.9, z: 1704.4 } },
};

/** Wave-4 kinds for existing rows (the OSM rows get theirs from the sidecar's poiKind). */
export const PLACE_KIND_FIXES: Readonly<Record<string, SfPlaceKindAll>> = {
  'sf-zoo': 'zoo',
  'grace-cathedral': 'religious',
};

/** Rows kept in places.json but not shown / searched (the duplicate curated Sutro Baths dot). */
export const PLACE_HIDDEN: ReadonlySet<string> = new Set(['sutro-baths']);

/** A place row after the wave-4 changes: places.json fields, a wave-4 kind, an optional arrival spot. */
export type W4PlaceRow = Omit<SfPlace, 'kind'> & {
  kind: SfPlaceKindAll;
  /** where travel ends, when it is not the anchor (extra rows, rows an attraction decorates, re-anchored rows) */
  arrival?: { x: number; z: number; heading?: number };
  /** an EXTRA_PLACES row */
  extra?: boolean;
};

export interface W4PlaceOptions {
  extras?: readonly ExtraPlace[];
  snaps?: Readonly<Record<string, { y: number; zone: string | null; graphNode: number }>>;
  names?: Readonly<Record<string, Bilingual>>;
  reanchors?: typeof PLACE_REANCHORS;
  kinds?: Readonly<Record<string, SfPlaceKindAll>>;
  hidden?: ReadonlySet<string>;
  /** placeId → the arrival of the attraction that speaks for it (default: attractionArrivals()) */
  arrivals?: Readonly<Record<string, { x: number; z: number; heading?: number }>>;
}

/**
 * placeId → the arrival spot of the attraction that speaks for the place (its primary attraction: `arrival`, else its
 * anchor). Non-primary attractions sharing a place (Japan Center on the Peace Pagoda's row) are not in it: a trip to
 * one of them passes the attraction's own arrival as the destination (lane G's TripDestination x / z).
 */
export function attractionArrivals(ix: AttractionIndex = ATTRACTION_INDEX): Record<string, { x: number; z: number; heading?: number }> {
  const out: Record<string, { x: number; z: number; heading?: number }> = {};
  for (const a of ix.list) {
    const id = a.placeId ?? a.id;
    if (ix.primary(id) !== a) continue;
    out[id] = a.arrival ? { ...a.arrival } : { x: a.x, z: a.z };
  }
  return out;
}

/** The row an extra place becomes (snaps default to "unknown": y 0, no zone, off the graph). */
export function extraRow(e: ExtraPlace, snap?: { y: number; zone: string | null; graphNode: number }): W4PlaceRow {
  return {
    id: e.id, name: e.name, kind: e.kind, x: e.x, z: e.z, y: snap?.y ?? 0, zone: snap?.zone ?? null, osmType: null, osmId: null,
    sourceUrl: e.sourceUrl, verifiedAt: EXTRA_VERIFIED_AT, curated: true, graphNode: snap?.graphNode ?? -1,
    ...(e.hero ? { hero: true } : {}), arrival: { ...e.arrival }, extra: true,
  };
}

/**
 * The published rows with the wave-4 changes (pure): hidden rows dropped, names / kinds / anchors fixed, the extra
 * rows appended (an extra whose id is already taken is skipped: the test pins that none is). Input rows are not mutated.
 */
export function applyW4Places(file: { places: readonly SfPlace[] }, o: W4PlaceOptions = {}): W4PlaceRow[] {
  const extras = o.extras ?? EXTRA_PLACES, snaps = o.snaps ?? EXTRA_PLACE_SNAPS, names = o.names ?? PLACE_NAME_FIXES;
  const reanchors = o.reanchors ?? PLACE_REANCHORS, kinds = o.kinds ?? PLACE_KIND_FIXES, hidden = o.hidden ?? PLACE_HIDDEN;
  const arrivals = o.arrivals ?? attractionArrivals();
  const out: W4PlaceRow[] = [];
  const ids = new Set<string>();
  for (const src of file.places) {
    ids.add(src.id);
    if (hidden.has(src.id)) continue;
    const row: W4PlaceRow = { ...src };
    const name = names[src.id];
    if (name) row.name = { ...name };
    const kind = kinds[src.id];
    if (kind) row.kind = kind;
    const arr = arrivals[src.id];
    if (arr && Math.hypot(arr.x - row.x, arr.z - row.z) > 0.05) row.arrival = { ...arr };
    const re = reanchors[src.id];
    if (re) { row.x = re.x ?? row.x; row.z = re.z ?? row.z; row.arrival = { ...re.arrival }; }
    out.push(row);
  }
  for (const e of extras) {
    if (ids.has(e.id)) continue;
    ids.add(e.id);
    out.push(extraRow(e, snaps[e.id]));
  }
  return out;
}
