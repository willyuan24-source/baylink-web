import type { Bilingual } from '../../core/types';
import type { SfPlaceKindAll } from '../../world/sf/format';
import {
  ATTRACTION_CAT_STYLE, ATTRACTION_FLAG_H, type Attraction, type AttractionCat, type AttractionFlag, type AttractionGlyph, type AttractionRank,
  type AttractionStop,
} from './attractionTypes';
import { SITE_ARRIVALS } from './siteArrivals';
import { ALCA_LINES } from '../../world/sf/alcatrazLines';

/**
 * Wave 4 · the big attractions of San Francisco (lane P, W4-P2; plan sf-w4-plan.md §2.4 and §4.1, types in the frozen
 * attractionTypes.ts). One row per attraction: the 134 of docs/opus-bay/sf-w4-attractions.json (ids, names, positions,
 * map ranks, treatments, sites and priorities copied from it; tests/opus-bay-sf-attractions.test.ts keeps the two in
 * sync) plus the 24 existing landmarks and famous curated places the plan's T1 / T2 lists name (positions = their
 * places.json rows). 16 T1 (always shown and labelled, flags), 48 T2, 94 T3.
 *
 * What lane P added on top of the JSON (editorial, checked against its facts / cautions):
 * - `cat` (+ `glyph` where the category default does not fit: PawPrint for the zoo and the bison, Sailboat for islands,
 *   piers and ships, Church for places of worship, Theater for stages, Castle for the Palace / Fort Point, Binoculars for
 *   lookouts), `short` (≤ 5 CJK / 14 Latin: the map label), `fame` (label priority inside a rank), `area` (the 景点 list
 *   groups), `aliases` (search words zh + en: 州大 / SFSU / 石镇 / 石头城 / UCSF / 加大旧金山 …), `photoKey` (a licensed
 *   photo of src/data/sf-landmark-photo-assets.json that shows the place), `visitNote` (closures and days only, from the
 *   JSON facts; the card adds "出发前查官网确认"), `quiet` (churches, memorials), `panorama` (the six viewpoints);
 * - `placeId`: the place-index row the attraction decorates. New rows (47) are data/sf/extraPlaces.ts rows with the
 *   attraction's id. Existing landmarks use the row the place index matched to them at runtime (the Golden Gate Bridge
 *   → `ggb-deck-mid`, Sutro Baths → `osm-w32776540`, whose names data/sf/extraPlaces.ts fixes). The Golden Gate
 *   Bridge's badge stands on its SOUTH TOWER (the `ggb-south-tower` row), not mid-span: on a phone's whole-city view the
 *   mid-span point sits on the frame edge and loses its label;
 * - `flag` for every T1 / T2 (the in-world pennant, plan §4.2): foot = the anchor unless `FLAG_TOPS` moves it, pole top =
 *   `FLAG_TOPS[id].h` or 30 u. PLACEHOLDERS until lane L's `siteFlagTop(id)` lands (L fills `FLAG_TOPS` or the
 *   integration reads siteFlagTop first); every value is clamped to ATTRACTION_FLAG_H (28–70).
 * - `near` is not stored: `nearStops()` measures it from the published transit lines (lane T's stop ids stay the truth).
 * - `arrival` of the 24 existing SF landmarks = the landmark's walkable anchor (`LANDMARK_ARRIVALS`, review fix): the
 *   place index already ends every trip, fly and discovery there, so lane C's arrival moment and lane G's trip
 *   destination use the same spot. The other attractions keep the scouting's measured arrival, and
 *   data/sf/extraPlaces.ts `applyW4Places` gives the place rows they decorate that same arrival. `ARRIVAL_OVERRIDES`
 *   (lane P2) moves three on purpose: the Golden Gate Bridge to the Welcome Center plaza (the loop stop's), Corona
 *   Heights to its summit (the panorama), the Botanical Garden to its main gate;
 * - `ARRIVAL_PLACES` + `tripDestination(a)` (lane P2): the islands' trips end at a named place of their own (恶魔岛渡轮码头
 *   · 33 号码头, 14 号码头), so no row says "步行到恶魔岛".
 *
 * Coordinates are the world city frame (x, z in u, `projectCity`). Facts checked on 2026-09-27 (the scouting's date).
 */

export const ATTRACTIONS_VERIFIED_AT = '2026-09-27';

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

/** The rows (generated once from the JSON + lane P's editorial table, then maintained here). */
const ROWS: Attraction[] = [
  { id: 'st-ignatius-church', placeId: 'st-ignatius-church', name: bi('圣依纳爵堂', 'St Ignatius Church'), short: bi('圣依纳爵堂', 'St Ignatius'), cat: 'culture', glyph: 'Church', rank: 2, fame: 48, x: -150.9, z: 752.8, arrival: { x: -152.6, z: 756.4 }, area: 'park-sunset', aliases: ['USF', '圣依纳爵', 'St. Ignatius', '教堂', 'church'], siteId: 'usf-lone-mountain', treatment: 'ai', priority: 1, quiet: true },
  { id: 'sf-state-university', placeId: 'sf-state-university', name: bi('旧金山州立大学', 'San Francisco State University'), short: bi('州立大学', 'SF State'), cat: 'campus', rank: 1, fame: 66, x: 198.2, z: 1555.6, area: 'south', aliases: ['SFSU', 'SF State', '州大', '旧金山州立', '旧金山州大', '州立大学', 'San Francisco State', 'SF State University'], photoKey: 'sf-state', siteId: 'sfsu', treatment: 'proc', priority: 1, officialUrl: 'https://www.sfsu.edu/about' },
  { id: 'stonestown-galleria', placeId: 'stonestown-galleria', name: bi('石镇购物中心', 'Stonestown Galleria'), short: bi('石镇', 'Stonestown'), cat: 'shopping', rank: 1, fame: 64, x: 165.9, z: 1479.9, arrival: { x: 172.1, z: 1474.1 }, area: 'south', aliases: ['石镇', '石头城', 'Stonestown', '石镇商场', '商场', 'mall', 'Stonestown Galleria'], photoKey: 'stonestown', siteId: 'stonestown', treatment: 'proc', priority: 1, officialUrl: 'https://www.stonestowngalleria.com/en/visit/' },
  { id: 'ccsf-ocean-campus', placeId: 'ccsf-ocean-campus', name: bi('旧金山城市学院（Ocean 校区）', 'City College of San Francisco · Ocean Campus'), short: bi('城市学院', 'City College'), cat: 'campus', rank: 2, fame: 46, x: 421.9, z: 1268.3, arrival: { x: 424.9, z: 1265.6 }, area: 'south', aliases: ['CCSF', '城市学院', 'City College', '旧金山城市大学', 'Ocean Campus'], siteId: 'ccsf-ocean', treatment: 'proc', priority: 1, officialUrl: 'https://www.ccsf.edu/news/diego-rivera-performing-arts-center-groundbreaking', visitNote: bi('里维拉壁画预计 2028 年起展出', 'The Rivera mural goes on view about 2028') },
  { id: 'ucsf-parnassus', placeId: 'ucsf-parnassus', name: bi('加州大学旧金山分校 · 帕纳萨斯校区', 'UCSF Parnassus Heights'), short: bi('UCSF', 'UCSF Parnassus'), cat: 'campus', rank: 2, fame: 55, x: -56.8, z: 939.6, arrival: { x: -60.4, z: 934.9 }, area: 'park-sunset', aliases: ['UCSF', '加大旧金山', '加州大学旧金山', '加州大学旧金山分校', '帕纳萨斯', 'Parnassus'], photoKey: 'ucsf-parnassus', siteId: 'ucsf-parnassus', treatment: 'proc', priority: 1, officialUrl: 'https://realestate.ucsf.edu/projects/ucsf-health-helen-diller-hospital-hdh' },
  { id: 'university-of-san-francisco', placeId: 'university-of-san-francisco', name: bi('旧金山大学', 'University of San Francisco (USF)'), short: bi('旧金山大学', 'USF'), cat: 'campus', rank: 2, fame: 54, x: -188.5, z: 706.2, arrival: { x: -184.1, z: 711.4 }, area: 'park-sunset', aliases: ['USF', '旧金山大学', 'Lone Mountain', 'University of SF'], siteId: 'usf-lone-mountain', treatment: 'proc', priority: 1, officialUrl: 'https://www.usfca.edu/about' },
  { id: 'ucsf-mission-bay', placeId: 'ucsf-mission-bay', name: bi('加州大学旧金山分校 · 米慎湾校区', 'UCSF Mission Bay campus'), short: bi('米慎湾校区', 'UCSF Mis. Bay'), cat: 'campus', rank: 2, fame: 50, x: 441, z: 292.5, arrival: { x: 440.6, z: 292.1 }, area: 'north-downtown', aliases: ['UCSF', '加大旧金山', '加州大学旧金山', '加州大学旧金山分校', '米慎湾', 'Mission Bay'], photoKey: 'ucsf-mission-bay', siteId: 'ucsf-mission-bay', treatment: 'plaza', priority: 1, officialUrl: 'https://www.ucsf.edu/about/locations/mission-bay' },
  { id: 'academy-of-art-university', placeId: 'academy-of-art-university', name: bi('旧金山艺术大学', 'Academy of Art University'), short: bi('艺术大学', 'Academy of Art'), cat: 'campus', rank: 3, fame: 30, x: 154.1, z: 162, arrival: { x: 153.4, z: 162.4 }, area: 'north-downtown', aliases: ['Academy of Art', 'AAU', '艺术大学'], treatment: 'card', priority: 1, officialUrl: 'https://www.academyart.edu/' },
  { id: 'california-college-of-the-arts', placeId: 'california-college-of-the-arts', name: bi('加州艺术学院', 'California College of the Arts (San Francisco campus)'), short: bi('CCA', 'CCA'), cat: 'campus', rank: 3, fame: 26, x: 394.5, z: 355.2, area: 'north-downtown', aliases: ['CCA', '加州艺术学院'], treatment: 'card', priority: 1, officialUrl: 'https://www.cca.edu/about/vanderbilt-agreement/', visitNote: bi('2026-27 学年后停办', 'Closes after the 2026-27 academic year') },
  { id: 'sf-conservatory-of-music', placeId: 'sf-conservatory-of-music', name: bi('旧金山音乐学院', 'San Francisco Conservatory of Music (and Bowes Center)'), short: bi('音乐学院', 'SFCM'), cat: 'campus', rank: 3, fame: 28, x: 124, z: 468.7, arrival: { x: 125.6, z: 470.6 }, area: 'north-downtown', aliases: ['SFCM', 'Bowes Center', '音乐学院', 'Conservatory of Music'], treatment: 'card', priority: 1, officialUrl: 'https://sfcm.edu/discover/campus-life/bowes-center' },
  { id: 'uc-law-sf', placeId: 'uc-law-sf', name: bi('加州大学旧金山法学院', 'UC Law San Francisco (University of California College of the Law, San Francisco)'), short: bi('法学院', 'UC Law SF'), cat: 'campus', rank: 3, fame: 28, x: 102.7, z: 368.3, arrival: { x: 104.6, z: 366.4 }, area: 'north-downtown', aliases: ['UC Law', '法学院', '加州大学法学院'], treatment: 'card', priority: 1, officialUrl: 'https://www.uclawsf.edu/2023/01/03/welcome-to-university-of-california-college-of-the-law-san-francisco/' },
  { id: 'cal-academy', placeId: 'cal-academy', name: bi('加州科学院', 'California Academy of Sciences'), short: bi('加州科学院', 'Cal Academy'), cat: 'museum', rank: 2, fame: 70, x: -203.7, z: 934.5, arrival: { x: -211.1, z: 934.1 }, area: 'park-sunset', aliases: ['科学院', '水族馆', '天文馆', '雨林', 'Cal Academy', 'Academy of Sciences'], photoKey: 'academy', siteId: 'music-concourse', treatment: 'ai', priority: 2, officialUrl: 'https://www.calacademy.org/visit' },
  { id: 'japanese-tea-garden', placeId: 'japanese-tea-garden', name: bi('日本茶园', 'Japanese Tea Garden'), short: bi('日本茶园', 'Tea Garden'), cat: 'park', rank: 2, fame: 64, x: -242.9, z: 964.4, area: 'park-sunset', aliases: ['茶园', '日本茶园', 'Tea Garden', '宝塔'], photoKey: 'japanese-tea-garden', siteId: 'music-concourse', treatment: 'proc', priority: 2, officialUrl: 'https://gggp.org/visit' },
  { id: 'sf-zoo', placeId: 'sf-zoo', name: bi('旧金山动物园', 'San Francisco Zoo & Gardens'), short: bi('动物园', 'SF Zoo'), cat: 'park', glyph: 'PawPrint', rank: 2, fame: 60, x: -110.3, z: 1657.6, arrival: { x: -109.9, z: 1657.9 }, area: 'south', aliases: ['动物园', 'zoo', 'SF Zoo'], siteId: 'sf-zoo', treatment: 'proc', priority: 2, officialUrl: 'https://www.sfzoo.org/' },
  { id: 'sfmoma', placeId: 'sfmoma', name: bi('旧金山现代艺术博物馆', 'SFMOMA (San Francisco Museum of Modern Art)'), short: bi('现代艺术馆', 'SFMOMA'), cat: 'museum', rank: 2, fame: 68, x: 176.6, z: 183, arrival: { x: 171.4, z: 182.6 }, area: 'north-downtown', aliases: ['SFMOMA', 'MOMA', '现代艺术博物馆', '现代美术馆'], siteId: 'yerba-buena', treatment: 'proc', priority: 2, officialUrl: 'https://www.sfmoma.org/visit/', visitNote: bi('周三闭馆；18 岁以下免费', 'Closed Wednesdays; free for 18 and under') },
  { id: 'union-square', placeId: 'union-square', name: bi('联合广场', 'Union Square'), short: bi('联合广场', 'Union Square'), cat: 'shopping', rank: 1, fame: 77, x: 96.1, z: 221.3, area: 'north-downtown', aliases: ['联合广场', 'Union Sq', 'Union Square', '购物'], photoKey: 'union-square', siteId: 'union-square', treatment: 'plaza', priority: 2 },
  { id: 'dolores-park', placeId: 'dolores-park', name: bi('多洛雷斯公园', 'Mission Dolores Park'), short: bi('多洛雷斯', 'Dolores Park'), cat: 'park', rank: 2, fame: 62, x: 242, z: 698, area: 'twin-peaks-mission', aliases: ['多洛雷斯', 'Dolores Park', 'Dolores'], siteId: 'mission-dolores', treatment: 'plaza', priority: 2 },
  { id: 'haight-ashbury', placeId: 'haight-ashbury', name: bi('海特-阿什伯里（嬉皮区）', 'Haight-Ashbury'), short: bi('海特街', 'Haight-Ashbury'), cat: 'neighbourhood', rank: 2, fame: 70, x: -41.3, z: 763.5, area: 'twin-peaks-mission', aliases: ['海特', '嬉皮', 'Haight', 'Haight St', 'Summer of Love'], siteId: 'haight', treatment: 'plaza', priority: 2 },
  { id: 'lands-end', placeId: 'lands-end', name: bi('天涯海角（Lands End）', 'Lands End (Lookout & Coastal Trail)'), short: bi('天涯海角', 'Lands End'), cat: 'viewpoint', glyph: 'Binoculars', rank: 2, fame: 65, x: -703.2, z: 1231.2, arrival: { x: -701.6, z: 1229.6 }, area: 'coast', aliases: ['天涯海角', 'Lands End', '海岸步道'], photoKey: 'lands-end', siteId: 'lands-end', treatment: 'plaza', priority: 2, officialUrl: 'https://www.nps.gov/goga/planyourvisit/landsend.htm' },
  { id: 'ocean-beach', placeId: 'ocean-beach', name: bi('海洋海滩', 'Ocean Beach'), short: bi('海洋海滩', 'Ocean Beach'), cat: 'coast', rank: 2, fame: 66, x: -431, z: 1475, area: 'coast', aliases: ['海滩', 'Ocean Beach', '海边', '日落'], photoKey: 'ocean-beach', siteId: 'ocean-beach-west', treatment: 'plaza', priority: 2, officialUrl: 'https://www.nps.gov/places/000/ocean-beach.htm' },
  { id: 'yerba-buena-gardens', placeId: 'yerba-buena-gardens', name: bi('芳草地花园', 'Yerba Buena Gardens (MLK Memorial, YBCA, carousel)'), short: bi('芳草地花园', 'Yerba Buena'), cat: 'park', rank: 2, fame: 50, x: 176.9, z: 210.8, area: 'north-downtown', aliases: ['芳草地', 'Yerba Buena', 'YBCA'], siteId: 'yerba-buena', treatment: 'plaza', priority: 2, officialUrl: 'https://yerbabuenagardens.org/' },
  { id: 'sutro-baths', placeId: 'osm-w32776540', name: bi('苏特罗浴场遗址', 'Sutro Baths ruins'), short: bi('苏特罗浴场', 'Sutro Baths'), cat: 'landmark', rank: 1, fame: 68, x: -726.2, z: 1246.5, arrival: { x: -720.4, z: 1240.9 }, area: 'coast', aliases: ['苏特罗浴场', 'Sutro Baths', '浴场遗址'], photoKey: 'sutro', landmarkId: 'sutro-baths', siteId: 'lands-end', treatment: 'stop', priority: 2 },
  { id: 'twin-peaks', placeId: 'twin-peaks', name: bi('双峰观景台', 'Twin Peaks overlook'), short: bi('双峰', 'Twin Peaks'), cat: 'viewpoint', rank: 1, fame: 78, x: 125.7, z: 937.8, area: 'twin-peaks-mission', aliases: ['双峰', '双子峰', 'Twin Peaks', '观景台'], photoKey: 'twin-peaks', landmarkId: 'twin-peaks', siteId: 'twin-peaks', treatment: 'stop', priority: 2, visitNote: bi('步道施工中，观景台照常开放', 'Promenade works under way; the overlook stays open'), panorama: true },
  { id: 'castro-theatre', placeId: 'castro-theatre', name: bi('卡斯特罗剧院', 'The Castro Theatre'), short: bi('卡斯特罗', 'Castro Theatre'), cat: 'culture', glyph: 'Theater', rank: 2, fame: 56, x: 151.9, z: 741.4, arrival: { x: 151.9, z: 745.9 }, area: 'twin-peaks-mission', aliases: ['卡斯特罗', 'Castro', '剧院'], landmarkId: 'castro-theatre', siteId: 'castro', treatment: 'stop', priority: 2, visitNote: bi('2026 年 2 月翻修后重开', 'Reopened in Feb 2026 after its renovation') },
  { id: 'conservatory-of-flowers', placeId: 'conservatory-of-flowers', name: bi('花卉温室', 'Conservatory of Flowers'), short: bi('花卉温室', 'Conservatory'), cat: 'park', rank: 2, fame: 60, x: -184.2, z: 852.9, arrival: { x: -184.1, z: 856.1 }, area: 'park-sunset', aliases: ['温室', '花卉温室', 'Conservatory of Flowers'], photoKey: 'park', landmarkId: 'conservatory-of-flowers', siteId: 'park-east', treatment: 'stop', priority: 2, visitNote: bi('周三闭馆', 'Closed Wednesdays') },
  { id: 'de-young-tower', placeId: 'de-young', name: bi('迪扬博物馆 · 观景塔', 'de Young Museum · Hamon Observation Tower'), short: bi('迪扬博物馆', 'de Young'), cat: 'museum', rank: 2, fame: 66, x: -244.4, z: 940.2, arrival: { x: -250.1, z: 940.1 }, area: 'park-sunset', aliases: ['迪扬', '笛洋', 'de Young', '观景塔', 'Hamon Tower'], photoKey: 'de-young', landmarkId: 'de-young-tower', siteId: 'music-concourse', treatment: 'stop', priority: 2, visitNote: bi('观景层免费；周一闭馆', 'The tower is free; closed Mondays'), panorama: true },
  { id: 'dutch-windmill', placeId: 'dutch-windmill', name: bi('荷兰风车与威廉明娜女王郁金香花园', 'Dutch Windmill & Queen Wilhelmina Tulip Garden'), short: bi('荷兰风车', 'Dutch Windmill'), cat: 'landmark', rank: 2, fame: 57, x: -580.7, z: 1311.9, arrival: { x: -579.4, z: 1313.6 }, area: 'coast', aliases: ['风车', 'windmill', '郁金香', 'tulip'], landmarkId: 'dutch-windmill', siteId: 'ocean-beach-west', treatment: 'stop', priority: 2, visitNote: bi('郁金香约三月开；风车内部不开放', 'Tulips bloom about March; the mill is closed inside') },
  { id: 'legion-of-honor', placeId: 'legion-of-honor', name: bi('荣勋宫美术馆', 'Legion of Honor'), short: bi('荣勋宫', 'The Legion'), cat: 'museum', rank: 2, fame: 58, x: -663.6, z: 1083.4, arrival: { x: -658.9, z: 1083.4 }, area: 'coast', aliases: ['荣勋宫', 'Legion of Honor', 'Legion'], landmarkId: 'legion-of-honor', siteId: 'legion', treatment: 'stop', priority: 2, visitNote: bi('周一闭馆', 'Closed Mondays') },
  { id: 'mission-dolores', placeId: 'mission-dolores', name: bi('多洛雷斯传教站', 'Mission Dolores (Mission San Francisco de Asís)'), short: bi('传教站', 'Old Mission'), cat: 'culture', glyph: 'Church', rank: 2, fame: 60, x: 195.5, z: 647.6, arrival: { x: 199.1, z: 646.9 }, area: 'twin-peaks-mission', aliases: ['传教站', 'Mission Dolores', '多洛雷斯', '教会区'], landmarkId: 'mission-dolores', siteId: 'mission-dolores', treatment: 'stop', priority: 2, visitNote: bi('每天开放；导览暂停，可自助参观', 'Open daily; guided tours paused, self-guided visits'), quiet: true },
  { id: 'sutro-tower', placeId: 'sutro-tower', name: bi('苏特罗塔', 'Sutro Tower'), short: bi('苏特罗塔', 'Sutro Tower'), cat: 'landmark', rank: 2, fame: 60, x: 73.2, z: 973.7, area: 'twin-peaks-mission', aliases: ['苏特罗塔', 'Sutro Tower', '电视塔'], landmarkId: 'sutro-tower', siteId: 'twin-peaks', treatment: 'stop', priority: 2, visitNote: bi('私人设施，不对外开放', 'Private: no public access') },
  { id: 'ferry-building-marketplace', placeId: 'ferry-building', name: bi('渡轮大厦市集', 'Ferry Building Marketplace & Ferry Plaza Farmers Market'), short: bi('渡轮大厦', 'Ferry Building'), cat: 'landmark', rank: 1, fame: 88, x: 131.5, z: 15.1, area: 'north-downtown', aliases: ['渡轮大厦', 'Ferry Building', '农夫市集', 'farmers market', 'Ferry Plaza', '钟楼'], photoKey: 'ferry', treatment: 'card', priority: 2, officialUrl: 'https://www.ferrybuildingmarketplace.com/', hero: true },
  { id: 'salesforce-tower', placeId: 'salesforce-tower', name: bi('Salesforce 大楼', 'Salesforce Tower'), short: bi('Salesforce', 'Salesforce'), cat: 'landmark', rank: 2, fame: 62, x: 166.2, z: 107.8, arrival: { x: 166.1, z: 112.1 }, area: 'north-downtown', aliases: ['最高楼', 'tallest', 'Salesforce'], photoKey: 'salesforce', treatment: 'card', priority: 2, hero: true },
  { id: 'transamerica-pyramid', placeId: 'transamerica-pyramid', name: bi('泛美金字塔', 'Transamerica Pyramid'), short: bi('泛美金字塔', 'Transamerica'), cat: 'landmark', rank: 2, fame: 66, x: 55.8, z: 101.5, arrival: { x: 51.4, z: 99.4 }, area: 'north-downtown', aliases: ['金字塔', 'Transamerica', 'pyramid'], photoKey: 'transamerica', treatment: 'card', priority: 2, hero: true },
  { id: 'holy-virgin-cathedral', placeId: 'holy-virgin-cathedral', name: bi('圣母大教堂（俄罗斯东正教）', 'Holy Virgin Cathedral (Joy of All Who Sorrow)'), short: bi('圣母大教堂', 'Holy Virgin'), cat: 'culture', glyph: 'Church', rank: 3, fame: 36, x: -493.6, z: 999.4, arrival: { x: -495.4, z: 998.6 }, area: 'park-sunset', aliases: ['东正教', '俄罗斯教堂', 'Holy Virgin', 'onion domes'], siteId: 'geary-west', treatment: 'ai', priority: 3, quiet: true },
  { id: 'cable-car-museum', placeId: 'cable-car-museum', name: bi('叮当车博物馆', 'Cable Car Museum (Washington-Mason powerhouse)'), short: bi('叮当车馆', 'Cable Car Mus.'), cat: 'museum', rank: 2, fame: 57, x: -16.9, z: 186.4, arrival: { x: -13.9, z: 183.4 }, area: 'north-downtown', aliases: ['叮当车', '缆车', 'cable car', '缆车博物馆', 'powerhouse'], siteId: 'cable-car-museum', treatment: 'proc', priority: 3, officialUrl: 'https://www.cablecarmuseum.org/', visitNote: bi('免费参观；周一闭馆', 'Free; closed Mondays') },
  { id: 'mount-davidson', placeId: 'mount-davidson', name: bi('戴维森山', 'Mount Davidson'), short: bi('戴维森山', 'Mt Davidson'), cat: 'viewpoint', rank: 2, fame: 44, x: 257.5, z: 1160.9, area: 'twin-peaks-mission', aliases: ['戴维森山', 'Mount Davidson', '最高点'], siteId: 'mount-davidson', treatment: 'proc', priority: 3, quiet: true },
  { id: 'asian-art-museum', placeId: 'osm-w24588037', name: bi('亚洲艺术博物馆', 'Asian Art Museum'), short: bi('亚洲艺术馆', 'Asian Art Mus.'), cat: 'museum', rank: 3, fame: 44, x: 108.5, z: 378.3, arrival: { x: 106.1, z: 375.4 }, area: 'north-downtown', aliases: ['亚洲艺术', 'Asian Art'], siteId: 'civic-center', treatment: 'proc', priority: 3, officialUrl: 'https://asianart.org/', visitNote: bi('周二、周三闭馆', 'Closed Tuesdays and Wednesdays') },
  { id: 'beach-chalet', placeId: 'beach-chalet', name: bi('海滩小屋（金门公园游客中心）', 'Beach Chalet (Golden Gate Park Visitor Center)'), short: bi('海滩小屋', 'Beach Chalet'), cat: 'landmark', rank: 3, fame: 34, x: -576.9, z: 1329.5, arrival: { x: -578.6, z: 1330.9 }, area: 'coast', aliases: ['Beach Chalet', '游客中心', 'visitor center'], siteId: 'ocean-beach-west', treatment: 'proc', priority: 3, officialUrl: 'https://www.beachchalet.com/visitors-center' },
  { id: 'bison-paddock', placeId: 'bison-paddock', name: bi('金门公园野牛围场', 'Golden Gate Park Bison Paddock'), short: bi('野牛围场', 'Bison Paddock'), cat: 'park', glyph: 'PawPrint', rank: 3, fame: 38, x: -476, z: 1219.8, area: 'park-sunset', aliases: ['野牛', 'bison', 'buffalo'], siteId: 'park-west', treatment: 'proc', priority: 3, officialUrl: 'https://www.sfzoo.org/historic-sites-golden-gate-park-bison/' },
  { id: 'kezar-stadium', placeId: 'osm-w30675203', name: bi('基泽体育场', 'Kezar Stadium'), short: bi('基泽体育场', 'Kezar Stadium'), cat: 'sports', rank: 3, fame: 34, x: -84.4, z: 877.1, area: 'park-sunset', aliases: ['Kezar', '体育场', 'stadium'], siteId: 'park-east', treatment: 'proc', priority: 3 },
  { id: 'koret-carousel', placeId: 'koret-carousel', name: bi('科雷特儿童乐园与旋转木马', 'Koret Children\'s Quarter & Golden Gate Park Carousel'), short: bi('旋转木马', 'Koret Carousel'), cat: 'park', rank: 3, fame: 36, x: -109.9, z: 873.4, area: 'park-sunset', aliases: ['旋转木马', 'carousel', '儿童乐园', 'playground'], siteId: 'park-east', treatment: 'proc', priority: 3, officialUrl: 'https://sfrecpark.org/Facilities/Facility/Details/Koret-Childrens-Quarter-and-Carousel-414/' },
  { id: 'maritime-museum-bathhouse', placeId: 'maritime-museum-bathhouse', name: bi('旧金山海事博物馆（水上公园浴场大楼）', 'San Francisco Maritime Museum (Aquatic Park Bathhouse)'), short: bi('海事博物馆', 'Maritime Mus.'), cat: 'museum', glyph: 'Sailboat', rank: 3, fame: 34, x: -249.6, z: 167.8, arrival: { x: -250.9, z: 166.1 }, area: 'north-downtown', aliases: ['海事博物馆', 'Maritime Museum', 'Aquatic Park'], siteId: 'wharf-west', treatment: 'proc', priority: 3, officialUrl: 'https://www.nps.gov/safr/learn/historyculture/aquatic-park-bathhouse.htm', visitNote: bi('免费；周三至周日开放', 'Free; open Wednesday to Sunday') },
  { id: 'murphy-windmill', placeId: 'murphy-windmill', name: bi('墨菲风车', 'Murphy Windmill'), short: bi('墨菲风车', 'Murphy Mill'), cat: 'landmark', rank: 3, fame: 30, x: -514.1, z: 1364.2, arrival: { x: -514.1, z: 1366.1 }, area: 'coast', aliases: ['风车', 'windmill'], siteId: 'ocean-beach-west', treatment: 'proc', priority: 3 },
  { id: 'old-st-marys-cathedral', placeId: 'old-st-marys-cathedral', name: bi('老圣玛利亚教堂', 'Old St. Mary\'s Cathedral'), short: bi('老圣玛利亚', 'Old St Mary\'s'), cat: 'culture', glyph: 'Church', rank: 3, fame: 36, x: 56.8, z: 153.8, arrival: { x: 55.9, z: 155.6 }, area: 'north-downtown', aliases: ['老圣玛利亚', 'Old St. Mary\'s', '钟楼'], siteId: 'chinatown-pagodas', treatment: 'proc', priority: 3, officialUrl: 'https://www.osmsf.org/', quiet: true },
  { id: 'sing-chong-sing-fat-buildings', placeId: 'sing-chong-sing-fat-buildings', name: bi('都板街宝塔楼', 'Sing Chong & Sing Fat pagoda buildings (Grant Ave & California St)'), short: bi('宝塔楼', 'Pagoda Corner'), cat: 'landmark', rank: 3, fame: 34, x: 56.5, z: 158.7, area: 'north-downtown', aliases: ['宝塔', 'pagoda', '都板街', 'Grant Ave', 'Sing Chong', 'Sing Fat'], siteId: 'chinatown-pagodas', treatment: 'proc', priority: 3 },
  { id: 'st-marys-cathedral', placeId: 'st-marys-cathedral', name: bi('圣玛利亚大教堂', 'Cathedral of Saint Mary of the Assumption'), short: bi('圣玛利亚堂', 'St Mary\'s'), cat: 'culture', glyph: 'Church', rank: 3, fame: 38, x: -12.8, z: 421.2, arrival: { x: -16.1, z: 426.4 }, area: 'north-downtown', aliases: ['圣玛利亚', 'St. Mary\'s Cathedral', '大教堂'], siteId: 'cathedral-hill', treatment: 'proc', priority: 3, officialUrl: 'https://smcsf.org/visit', quiet: true },
  { id: 'tiled-steps-16th-avenue', placeId: 'tiled-steps-16th-avenue', name: bi('第16大道马赛克阶梯', '16th Avenue Tiled Steps (Moraga Steps)'), short: bi('马赛克阶梯', 'Tiled Steps'), cat: 'viewpoint', rank: 3, fame: 42, x: -113.3, z: 1143.4, area: 'park-sunset', aliases: ['马赛克', '阶梯', 'Tiled Steps', 'Moraga Steps', '16th Avenue'], siteId: 'golden-gate-heights', treatment: 'proc', priority: 3 },
  { id: 'uss-pampanito', placeId: 'osm-w165601339', name: bi('潘帕尼托号潜艇', 'USS Pampanito'), short: bi('潘帕尼托号', 'USS Pampanito'), cat: 'museum', glyph: 'Sailboat', rank: 3, fame: 36, x: -225.8, z: 63.3, arrival: { x: -205.9, z: 73.9 }, area: 'north-downtown', aliases: ['潜艇', 'submarine', 'Pampanito'], siteId: 'wharf-west', treatment: 'proc', priority: 3, officialUrl: 'https://maritime.org/' },
  { id: 'war-memorial-opera-house', placeId: 'osm-w32865161', name: bi('战争纪念歌剧院', 'War Memorial Opera House (with Davies Symphony Hall)'), short: bi('歌剧院', 'Opera House'), cat: 'culture', glyph: 'Theater', rank: 3, fame: 42, x: 86, z: 441.2, arrival: { x: 89.6, z: 442.9 }, area: 'north-downtown', aliases: ['歌剧院', 'opera', 'ballet', '芭蕾', 'Davies'], siteId: 'civic-center', treatment: 'proc', priority: 3, officialUrl: 'https://www.sfwarmemorial.org/' },
  { id: 'west-portal', placeId: 'osm-n2094547200', name: bi('西门站（West Portal）', 'West Portal (Twin Peaks Tunnel)'), short: bi('西门站', 'West Portal'), cat: 'neighbourhood', rank: 3, fame: 30, x: 119.4, z: 1244.9, area: 'south', aliases: ['西门', 'West Portal', 'M 线', 'Twin Peaks Tunnel'], siteId: 'west-portal', treatment: 'proc', priority: 3 },
  { id: 'baker-beach', placeId: 'baker-beach', name: bi('贝克海滩', 'Baker Beach'), short: bi('贝克海滩', 'Baker Beach'), cat: 'coast', rank: 2, fame: 58, x: -614, z: 849.3, area: 'coast', aliases: ['贝克海滩', 'Baker Beach', '海滩'], photoKey: 'baker-beach', siteId: 'baker-beach', treatment: 'plaza', priority: 3 },
  { id: 'bernal-heights-park', placeId: 'bernal-heights', name: bi('伯纳尔高地公园', 'Bernal Heights Park'), short: bi('伯纳尔高地', 'Bernal Heights'), cat: 'viewpoint', rank: 2, fame: 47, x: 525.6, z: 777.9, area: 'twin-peaks-mission', aliases: ['伯纳尔', 'Bernal', '观景'], siteId: 'bernal', treatment: 'plaza', priority: 3, panorama: true },
  { id: 'blue-heron-lake', placeId: 'stow-lake', name: bi('蓝鹭湖（原斯托湖）与草莓山', 'Blue Heron Lake (formerly Stow Lake) & Strawberry Hill'), short: bi('蓝鹭湖', 'Blue Heron'), cat: 'park', rank: 2, fame: 52, x: -269.8, z: 1032.3, arrival: { x: -262.1, z: 1045.1 }, area: 'park-sunset', aliases: ['斯托湖', 'Stow Lake', '蓝鹭湖', '草莓山', 'Strawberry Hill', '划船'], siteId: 'blue-heron-lake', treatment: 'plaza', priority: 3, officialUrl: 'https://sfrecpark.org/facilities/facility/details/Stow-Lake-410' },
  { id: 'corona-heights-randall-museum', placeId: 'corona-heights', name: bi('科罗娜高地与兰德尔博物馆', 'Corona Heights Park & Randall Museum'), short: bi('科罗娜高地', 'Corona Heights'), cat: 'viewpoint', rank: 2, fame: 45, x: 95.9, z: 746.1, arrival: { x: 99.4, z: 748.1 }, area: 'twin-peaks-mission', aliases: ['科罗娜', 'Corona Heights', '兰德尔', 'Randall Museum'], siteId: 'corona-heights', treatment: 'plaza', priority: 3, officialUrl: 'https://randallmuseum.org/about-us/directions-hours/', panorama: true },
  { id: 'harvey-milk-plaza', placeId: 'osm-w225526801', name: bi('哈维·米尔克广场与彩虹斑马线', 'Harvey Milk Plaza & Castro rainbow crosswalks'), short: bi('米尔克广场', 'Harvey Milk'), cat: 'neighbourhood', rank: 2, fame: 55, x: 140.7, z: 746.7, area: 'twin-peaks-mission', aliases: ['彩虹', 'rainbow', '卡斯特罗', 'Castro', '米尔克', 'Harvey Milk'], photoKey: 'castro', siteId: 'castro', treatment: 'plaza', priority: 3, officialUrl: 'https://sfpublicworks.org/index.php/HarveyMilkPlaza' },
  { id: 'lake-merced', placeId: 'lake-merced', name: bi('默塞德湖', 'Lake Merced'), short: bi('默塞德湖', 'Lake Merced'), cat: 'park', glyph: 'Waves', rank: 2, fame: 46, x: 104.1, z: 1726.6, arrival: { x: 88.9, z: 1704.4 }, area: 'south', aliases: ['默塞德湖', 'Lake Merced', '湖'], siteId: 'lake-merced', treatment: 'plaza', priority: 3 },
  { id: 'presidio-tunnel-tops', placeId: 'osm-w91114607', name: bi('要塞公园隧道顶公园', 'Presidio Tunnel Tops & Presidio Visitor Center'), short: bi('隧道顶公园', 'Tunnel Tops'), cat: 'park', rank: 2, fame: 55, x: -484.4, z: 489.1, area: 'bridge-presidio', aliases: ['隧道顶', 'Tunnel Tops', '要塞公园', 'Presidio'], photoKey: 'presidio', siteId: 'presidio', treatment: 'plaza', priority: 3, officialUrl: 'https://presidio.gov/explore/attractions/presidio-tunnel-tops/' },
  { id: 'stern-grove', placeId: 'osm-w103637554', name: bi('斯特恩林（Stern Grove）', 'Stern Grove (Sigmund Stern Recreation Grove)'), short: bi('斯特恩林', 'Stern Grove'), cat: 'park', rank: 2, fame: 45, x: 65.6, z: 1408.4, area: 'south', aliases: ['斯特恩', 'Stern Grove', '音乐节'], siteId: 'stern-grove', treatment: 'plaza', priority: 3 },
  { id: 'clement-street', placeId: 'clement-street', name: bi('克莱门街（列治文区“新华埠”）', 'Clement Street (Inner Richmond)'), short: bi('克莱门街', 'Clement St'), cat: 'neighbourhood', rank: 3, fame: 34, x: -331, z: 775.8, area: 'park-sunset', aliases: ['克莱门街', '克莱门', 'Clement', 'Clement Street', '新华埠', '列治文', 'Richmond'], siteId: 'clement', treatment: 'plaza', priority: 3 },
  { id: 'fort-funston', placeId: 'osm-w404851503', name: bi('芬斯顿堡', 'Fort Funston'), short: bi('芬斯顿堡', 'Fort Funston'), cat: 'coast', rank: 3, fame: 36, x: 101, z: 1842, area: 'south', aliases: ['滑翔伞', 'hang glider', 'Fort Funston'], siteId: 'fort-funston', treatment: 'plaza', priority: 3 },
  { id: 'fort-mason-center', placeId: 'fort-mason', name: bi('梅森堡艺术文化中心', 'Fort Mason Center for Arts & Culture'), short: bi('梅森堡', 'Fort Mason'), cat: 'culture', glyph: 'Theater', rank: 3, fame: 40, x: -320.8, z: 234.6, arrival: { x: -319.1, z: 238.9 }, area: 'bridge-presidio', aliases: ['梅森堡', 'Fort Mason', '艺术中心'], siteId: 'fort-mason', treatment: 'plaza', priority: 3, officialUrl: 'https://fortmason.org/' },
  { id: 'grand-view-park', placeId: 'osm-n7707827583', name: bi('格兰维尤公园（龟山）', 'Grand View Park (Turtle Hill)'), short: bi('龟山', 'Grand View'), cat: 'viewpoint', rank: 3, fame: 34, x: -103.6, z: 1129.6, area: 'park-sunset', aliases: ['龟山', '格兰维尤', 'Grand View', 'Turtle Hill'], siteId: 'golden-gate-heights', treatment: 'plaza', priority: 3, panorama: true },
  { id: 'hippie-hill', placeId: 'osm-w272711313', name: bi('嬉皮山', 'Hippie Hill'), short: bi('嬉皮山', 'Hippie Hill'), cat: 'park', rank: 3, fame: 38, x: -141.8, z: 852.7, arrival: { x: -141.4, z: 852.4 }, area: 'park-sunset', aliases: ['嬉皮山', 'Hippie Hill', '鼓圈'], siteId: 'park-east', treatment: 'plaza', priority: 3 },
  { id: 'irving-street', placeId: 'irving-street', name: bi('尔文街（日落区华人商业街）', 'Irving Street (Sunset District)'), short: bi('尔文街', 'Irving St'), cat: 'neighbourhood', rank: 3, fame: 30, x: -248.7, z: 1120.6, arrival: { x: -247.9, z: 1121.6 }, area: 'park-sunset', aliases: ['尔文街', 'Irving', '日落区', 'Sunset'], siteId: 'irving', treatment: 'plaza', priority: 3 },
  { id: 'japan-center', placeId: 'japantown-peace-pagoda', name: bi('日本城购物中心', 'Japan Center Malls (Japantown)'), short: bi('日本城商场', 'Japan Center'), cat: 'shopping', rank: 3, fame: 42, x: -69.2, z: 454.7, arrival: { x: -73.1, z: 453.4 }, area: 'north-downtown', aliases: ['日本城', 'Japantown', '商场', 'mall'], siteId: 'japantown', treatment: 'plaza', priority: 3, officialUrl: 'https://www.sfjapantown.org/japan-center-malls/' },
  { id: 'sf-botanical-garden', placeId: 'osm-w120480164', name: bi('旧金山植物园', 'San Francisco Botanical Garden'), short: bi('植物园', 'Botanical Gdn'), cat: 'park', rank: 3, fame: 40, x: -223.4, z: 1010.3, area: 'park-sunset', aliases: ['植物园', 'Botanical Garden'], siteId: 'music-concourse', treatment: 'plaza', priority: 3, officialUrl: 'https://gggp.org/visit' },
  { id: 'sunset-dunes', placeId: 'osm-w609650218', name: bi('日落沙丘公园', 'Sunset Dunes'), short: bi('日落沙丘', 'Sunset Dunes'), cat: 'coast', rank: 3, fame: 32, x: -341.7, z: 1525, area: 'coast', aliases: ['沙丘', 'Sunset Dunes', 'Great Highway'], siteId: 'ocean-beach-west', treatment: 'plaza', priority: 3 },
  { id: 'cliff-house', placeId: 'cliff-house', name: bi('悬崖屋与暗箱相机', 'Cliff House & Camera Obscura'), short: bi('悬崖屋', 'Cliff House'), cat: 'landmark', rank: 3, fame: 42, x: -710.1, z: 1265.2, arrival: { x: -709.9, z: 1263.4 }, area: 'coast', aliases: ['悬崖屋', 'Cliff House', 'Camera Obscura', '暗箱'], landmarkId: 'cliff-house', siteId: 'lands-end', treatment: 'stop', priority: 3, visitNote: bi('2020 年起关闭，翻修中，重开未定', 'Closed since 2020; being restored, no reopening date') },
  { id: 'city-lights-bookstore', placeId: 'osm-w32858754', name: bi('城市之光书店', 'City Lights Booksellers & Publishers'), short: bi('城市之光', 'City Lights'), cat: 'culture', rank: 3, fame: 45, x: -4.3, z: 108.9, area: 'north-downtown', aliases: ['书店', 'bookstore', 'City Lights', '垮掉的一代', 'Beat'], treatment: 'card', priority: 3, hero: true },
  { id: 'musee-mecanique', placeId: 'osm-n368166365', name: bi('机械博物馆（古董投币游戏机）', 'Musée Mécanique'), short: bi('机械博物馆', 'Mécanique'), cat: 'museum', rank: 3, fame: 42, x: -211.9, z: 65.5, arrival: { x: -205.9, z: 73.9 }, area: 'north-downtown', aliases: ['投币游戏机', 'arcade', 'Musee Mecanique'], treatment: 'card', priority: 3, hero: true },
  { id: 'national-aids-memorial-grove', placeId: 'national-aids-memorial-grove', name: bi('国家艾滋病纪念园', 'National AIDS Memorial Grove'), short: bi('艾滋纪念园', 'AIDS Memorial'), cat: 'park', rank: 3, fame: 30, x: -168.5, z: 902.3, area: 'park-sunset', aliases: ['纪念园', 'AIDS Memorial Grove'], siteId: 'park-east', treatment: 'card', priority: 3, quiet: true },
  { id: 'walt-disney-family-museum', placeId: 'osm-w288340246', name: bi('华特·迪士尼家族博物馆', 'The Walt Disney Family Museum'), short: bi('迪士尼馆', 'Disney Museum'), cat: 'museum', rank: 3, fame: 40, x: -491.4, z: 530.5, arrival: { x: -494.6, z: 530.6 }, area: 'bridge-presidio', aliases: ['迪士尼', 'Disney'], siteId: 'presidio', treatment: 'card', priority: 3, officialUrl: 'https://www.waltdisney.org/visit', visitNote: bi('周四至周日开放', 'Open Thursday to Sunday') },
  { id: 'salesforce-park', placeId: 'salesforce-park', name: bi('Salesforce 屋顶公园', 'Salesforce Park'), short: bi('屋顶公园', 'Rooftop Park'), cat: 'park', rank: 2, fame: 48, x: 175.9, z: 112.4, area: 'north-downtown', aliases: ['屋顶公园', 'rooftop park', 'Transit Center'], treatment: 'defer', priority: 3, officialUrl: 'https://www.tjpa.org/salesforce-park/', hero: true },
  { id: 'saints-peter-and-paul-church', placeId: 'saints-peter-and-paul-church', name: bi('圣彼得圣保罗教堂（华盛顿广场）', 'Saints Peter and Paul Church & Washington Square'), short: bi('圣彼得保罗', 'Peter & Paul'), cat: 'culture', glyph: 'Church', rank: 3, fame: 38, x: -79.5, z: 98.2, arrival: { x: -76.1, z: 100.1 }, area: 'north-downtown', aliases: ['华盛顿广场', 'Washington Square', '北滩', 'North Beach'], treatment: 'defer', priority: 3, officialUrl: 'https://www.salesiansspp.org/our-history', quiet: true, hero: true },
  { id: 'balmy-alley', placeId: 'balmy-alley', name: bi('巴尔米巷壁画街', 'Balmy Alley'), short: bi('巴尔米巷', 'Balmy Alley'), cat: 'culture', glyph: 'Palette', rank: 3, fame: 32, x: 456.8, z: 653.4, area: 'twin-peaks-mission', aliases: ['壁画', 'murals', 'Balmy'], siteId: 'mission-24th', treatment: 'proc', priority: 4 },
  { id: 'bayview-opera-house', placeId: 'osm-w288836717', name: bi('湾景歌剧院', 'Bayview Opera House (Ruth Williams Memorial Theatre)'), short: bi('湾景歌剧院', 'Bayview Opera'), cat: 'culture', glyph: 'Theater', rank: 3, fame: 24, x: 832.4, z: 635.3, arrival: { x: 834.4, z: 634.1 }, area: 'south', aliases: ['湾景', 'Bayview'], siteId: 'bayview', treatment: 'proc', priority: 4 },
  { id: 'chinese-telephone-exchange', placeId: 'osm-n2579643653', name: bi('华人电话局旧址', 'Chinese Telephone Exchange building (743 Washington St)'), short: bi('华人电话局', 'Phone Exchange'), cat: 'landmark', rank: 3, fame: 24, x: 27.4, z: 133.5, area: 'north-downtown', aliases: ['电话局', 'Telephone Exchange', '宝塔'], siteId: 'chinatown-pagodas', treatment: 'proc', priority: 4 },
  { id: 'crane-cove-park', placeId: 'osm-w853562207', name: bi('鹤湾公园', 'Crane Cove Park'), short: bi('鹤湾公园', 'Crane Cove'), cat: 'park', rank: 3, fame: 26, x: 553.3, z: 313.5, area: 'north-downtown', aliases: ['鹤湾', 'Crane Cove', '吊车'], siteId: 'dogpatch', treatment: 'proc', priority: 4 },
  { id: 'haas-lilienthal-house', placeId: 'osm-w256993595', name: bi('哈斯-利连塔尔故居', 'Haas-Lilienthal House'), short: bi('哈斯故居', 'Haas House'), cat: 'landmark', glyph: 'Castle', rank: 3, fame: 28, x: -112.8, z: 318.6, arrival: { x: -111.4, z: 318.4 }, area: 'north-downtown', aliases: ['维多利亚', 'Victorian', 'Haas-Lilienthal'], siteId: 'pacific-heights', treatment: 'proc', priority: 4, officialUrl: 'https://www.haas-lilienthalhouse.org/house-tours' },
  { id: 'ingleside-terraces-sundial', placeId: 'ingleside-terraces-sundial', name: bi('英格塞德日晷', 'Ingleside Terraces Sundial'), short: bi('日晷', 'Sundial'), cat: 'landmark', rank: 3, fame: 22, x: 283.8, z: 1438, arrival: { x: 284.6, z: 1437.4 }, area: 'south', aliases: ['日晷', 'sundial', 'Ingleside'], siteId: 'ingleside', treatment: 'proc', priority: 4 },
  { id: 'lyon-street-steps', placeId: 'osm-n7221410485', name: bi('里昂街台阶', 'Lyon Street Steps'), short: bi('里昂街台阶', 'Lyon St Steps'), cat: 'viewpoint', glyph: 'Binoculars', rank: 3, fame: 30, x: -291.8, z: 513.8, area: 'bridge-presidio', aliases: ['台阶', 'steps', 'Lyon Street'], siteId: 'pacific-heights', treatment: 'proc', priority: 4 },
  { id: 'octagon-house', placeId: 'octagon-house', name: bi('八角屋', 'Octagon House'), short: bi('八角屋', 'Octagon House'), cat: 'landmark', rank: 3, fame: 22, x: -184.1, z: 291.8, arrival: { x: -183.4, z: 290.6 }, area: 'bridge-presidio', aliases: ['八角屋', 'Octagon'], siteId: 'cow-hollow', treatment: 'proc', priority: 4, officialUrl: 'https://www.nscda-ca.org/octagon-house/' },
  { id: 'seward-street-slides', placeId: 'osm-w1364891448', name: bi('西沃德街滑梯', 'Seward Street Slides'), short: bi('西沃德滑梯', 'Seward Slides'), cat: 'park', rank: 3, fame: 30, x: 154.7, z: 832.4, area: 'twin-peaks-mission', aliases: ['滑梯', 'slides', 'Seward'], siteId: 'castro', treatment: 'proc', priority: 4, officialUrl: 'https://sfrecpark.org/facilities/facility/details/sewardminipark-203' },
  { id: 'vermont-street-crooked-block', placeId: 'vermont-street-crooked-block', name: bi('佛蒙特街弯道（比九曲花街更弯）', 'Vermont Street crooked block'), short: bi('佛蒙特街', 'Vermont St'), cat: 'neighbourhood', rank: 3, fame: 28, x: 454.3, z: 506.2, area: 'twin-peaks-mission', aliases: ['弯道', 'crooked', 'Vermont Street', '九曲'], siteId: 'potrero', treatment: 'proc', priority: 4 },
  { id: 'wave-organ', placeId: 'wave-organ', name: bi('海浪风琴', 'Wave Organ'), short: bi('海浪风琴', 'Wave Organ'), cat: 'culture', glyph: 'Waves', rank: 3, fame: 32, x: -412.3, z: 290, arrival: { x: -393.4, z: 303.4 }, area: 'bridge-presidio', aliases: ['海浪风琴', 'Wave Organ'], siteId: 'marina', treatment: 'proc', priority: 4, officialUrl: 'https://www.exploratorium.edu/visit/wave-organ' },
  { id: 'womens-building', placeId: 'womens-building', name: bi('女性大楼（MaestraPeace 壁画）', 'The Women\'s Building (MaestraPeace mural)'), short: bi('女性大楼', 'Women\'s Bldg'), cat: 'culture', glyph: 'Palette', rank: 3, fame: 26, x: 262.1, z: 640, arrival: { x: 263.6, z: 639.4 }, area: 'twin-peaks-mission', aliases: ['壁画', 'mural', 'MaestraPeace', 'Women\'s Building'], siteId: 'mission-18th', treatment: 'proc', priority: 4, officialUrl: 'https://www.womensbuilding.org/our-building/the-mural' },
  { id: 'alta-plaza-park', placeId: 'osm-w16751737', name: bi('阿尔塔广场公园', 'Alta Plaza Park'), short: bi('阿尔塔公园', 'Alta Plaza'), cat: 'park', rank: 3, fame: 26, x: -198, z: 453.6, area: 'north-downtown', aliases: ['Alta Plaza', '太平洋高地'], siteId: 'pacific-heights', treatment: 'plaza', priority: 4 },
  { id: 'buena-vista-park', placeId: 'osm-w7459901', name: bi('布埃纳维斯塔公园', 'Buena Vista Park'), short: bi('布埃纳公园', 'Buena Vista Pk'), cat: 'park', rank: 3, fame: 28, x: 30, z: 727.2, area: 'twin-peaks-mission', aliases: ['Buena Vista Park'], siteId: 'haight', treatment: 'plaza', priority: 4 },
  { id: 'calle-24', placeId: 'calle-24', name: bi('24街拉丁裔文化区（Calle 24）', 'Calle 24 Latino Cultural District (24th Street)'), short: bi('24街', 'Calle 24'), cat: 'neighbourhood', rank: 3, fame: 30, x: 455.5, z: 637.1, arrival: { x: 454.9, z: 637.1 }, area: 'twin-peaks-mission', aliases: ['拉丁', 'Latino', '24th Street', 'Calle 24'], siteId: 'mission-24th', treatment: 'plaza', priority: 4, officialUrl: 'https://www.calle24sf.org/ourhistory' },
  { id: 'china-beach', placeId: 'osm-r2142591', name: bi('中国海滩', 'China Beach'), short: bi('中国海滩', 'China Beach'), cat: 'coast', rank: 3, fame: 30, x: -622.3, z: 960.9, arrival: { x: -616.1, z: 961.1 }, area: 'coast', aliases: ['中国海滩', 'China Beach'], siteId: 'china-beach', treatment: 'plaza', priority: 4, officialUrl: 'https://www.parksconservancy.org/parks/china-beach' },
  { id: 'glen-canyon-park', placeId: 'osm-w35800082', name: bi('格伦峡谷公园', 'Glen Canyon Park'), short: bi('格伦峡谷', 'Glen Canyon'), cat: 'park', rank: 3, fame: 24, x: 347.9, z: 1053, arrival: { x: 347.6, z: 1053.4 }, area: 'twin-peaks-mission', aliases: ['峡谷', 'Glen Canyon'], siteId: 'glen-park', treatment: 'plaza', priority: 4 },
  { id: 'huntington-park', placeId: 'osm-w32946958', name: bi('亨廷顿公园', 'Huntington Park'), short: bi('亨廷顿公园', 'Huntington Pk'), cat: 'park', rank: 3, fame: 26, x: 9.1, z: 217, area: 'north-downtown', aliases: ['喷泉', 'Huntington', '诺布山', 'Nob Hill'], siteId: 'nob-hill', treatment: 'plaza', priority: 4, officialUrl: 'https://sfrecpark.org/Facilities/Facility/Details/Huntington-Park-438' },
  { id: 'ina-coolbrith-park', placeId: 'osm-w114151121', name: bi('伊娜·库尔布里斯公园', 'Ina Coolbrith Park'), short: bi('伊娜公园', 'Ina Coolbrith'), cat: 'viewpoint', glyph: 'Binoculars', rank: 3, fame: 24, x: -68.7, z: 162.7, area: 'north-downtown', aliases: ['Ina Coolbrith', '俄罗斯山', 'Russian Hill'], siteId: 'russian-hill', treatment: 'plaza', priority: 4, officialUrl: 'https://sfrecpark.org/Facilities/Facility/Details/Ina-Coolbrith-Park-175' },
  { id: 'lafayette-park', placeId: 'osm-w16751838', name: bi('拉法叶公园', 'Lafayette Park'), short: bi('拉法叶公园', 'Lafayette Park'), cat: 'park', rank: 3, fame: 24, x: -117.1, z: 363.7, area: 'north-downtown', aliases: ['Lafayette'], siteId: 'pacific-heights', treatment: 'plaza', priority: 4, officialUrl: 'https://sfrecpark.org/facilities/facility/details/Lafayette-Park-182' },
  { id: 'mclaren-park', placeId: 'osm-w28716696', name: bi('麦克拉伦公园', 'John McLaren Park'), short: bi('麦克拉伦', 'McLaren Park'), cat: 'park', rank: 3, fame: 24, x: 773.6, z: 1075.6, area: 'south', aliases: ['McLaren', '麦克拉伦'], siteId: 'mclaren', treatment: 'plaza', priority: 4 },
  { id: 'mount-sutro-open-space', placeId: 'osm-n12056865382', name: bi('苏特罗山森林保护区', 'Mount Sutro Open Space Reserve'), short: bi('苏特罗山', 'Mount Sutro'), cat: 'park', rank: 3, fame: 26, x: 3.3, z: 981.9, area: 'park-sunset', aliases: ['苏特罗山', 'Mount Sutro', '森林'], siteId: 'ucsf-parnassus', treatment: 'plaza', priority: 4 },
  { id: 'mountain-lake-park', placeId: 'osm-w401354283', name: bi('山湖公园', 'Mountain Lake Park'), short: bi('山湖公园', 'Mountain Lake'), cat: 'park', rank: 3, fame: 22, x: -410.6, z: 769.1, area: 'park-sunset', aliases: ['Mountain Lake'], siteId: 'presidio', treatment: 'plaza', priority: 4 },
  { id: 'noe-valley-town-square', placeId: 'noe-valley-town-square', name: bi('诺伊谷镇广场', 'Noe Valley Town Square'), short: bi('诺伊谷广场', 'Noe Valley Sq'), cat: 'neighbourhood', rank: 3, fame: 22, x: 319.4, z: 804.4, area: 'twin-peaks-mission', aliases: ['诺伊谷', 'Noe Valley', '农夫市集'], siteId: 'noe', treatment: 'plaza', priority: 4, officialUrl: 'https://sfrecpark.org/1685/Noe-Valley-Town-Square' },
  { id: 'patricias-green', placeId: 'osm-w28015862', name: bi('帕特里夏绿地（海斯谷）', 'Patricia\'s Green (Hayes Valley)'), short: bi('海斯谷绿地', 'Hayes Valley'), cat: 'park', rank: 3, fame: 26, x: 81.7, z: 497, area: 'north-downtown', aliases: ['海斯谷', 'Hayes Valley'], siteId: 'hayes-valley', treatment: 'plaza', priority: 4 },
  { id: 'sutro-heights-park', placeId: 'osm-w160025743', name: bi('苏特罗高地公园', 'Sutro Heights Park'), short: bi('苏特罗高地', 'Sutro Heights'), cat: 'viewpoint', glyph: 'Binoculars', rank: 3, fame: 28, x: -676.1, z: 1254.1, area: 'coast', aliases: ['Sutro Heights', '苏特罗高地'], siteId: 'lands-end', treatment: 'plaza', priority: 4, officialUrl: 'https://www.nps.gov/goga/planyourvisit/landsend.htm' },
  { id: 'aquarium-of-the-bay', placeId: 'osm-w288396169', name: bi('海湾水族馆', 'Aquarium of the Bay'), short: bi('海湾水族馆', 'Aquarium'), cat: 'museum', rank: 3, fame: 40, x: -151.1, z: 13.2, area: 'north-downtown', aliases: ['水族馆', 'aquarium', 'PIER 39'], treatment: 'card', priority: 4, officialUrl: 'https://www.aquariumofthebay.org/', hero: true },
  { id: 'balboa-theatre', placeId: 'balboa-theatre', name: bi('巴尔博亚戏院', 'Balboa Theatre'), short: bi('巴尔博亚', 'Balboa Theatre'), cat: 'culture', glyph: 'Theater', rank: 3, fame: 22, x: -542.6, z: 1152.9, arrival: { x: -541.9, z: 1153.1 }, area: 'park-sunset', aliases: ['电影院', 'cinema', 'Balboa'], siteId: 'outer-richmond', treatment: 'card', priority: 4, officialUrl: 'https://www.balboamovies.com/' },
  { id: 'boudin-bakery', placeId: 'boudin-bakery', name: bi('波丁酸面包（渔人码头旗舰店）', 'Boudin Bakery (Fisherman\'s Wharf flagship)'), short: bi('波丁酸面包', 'Boudin'), cat: 'shopping', rank: 3, fame: 32, x: -196.2, z: 65.4, area: 'north-downtown', aliases: ['酸面包', 'sourdough', 'Boudin'], treatment: 'card', priority: 4, officialUrl: 'https://boudinbakery.com/our-story/', hero: true },
  { id: 'buena-vista-cafe', placeId: 'buena-vista-cafe', name: bi('Buena Vista 咖啡馆（爱尔兰咖啡）', 'The Buena Vista Cafe'), short: bi('布埃纳咖啡', 'Buena Vista'), cat: 'shopping', rank: 3, fame: 28, x: -224.1, z: 138, area: 'north-downtown', aliases: ['爱尔兰咖啡', 'Irish coffee', 'Buena Vista Cafe'], siteId: 'wharf-west', treatment: 'card', priority: 4, officialUrl: 'https://www.thebuenavista.com/home/irishcoffee.html' },
  { id: 'candlestick-point-sra', placeId: 'osm-w40060675', name: bi('烛台角州立休闲区', 'Candlestick Point State Recreation Area'), short: bi('烛台角', 'Candlestick Pt'), cat: 'park', rank: 3, fame: 22, x: 1093.8, z: 765.1, area: 'south', aliases: ['烛台角', 'Candlestick'], siteId: 'bayview', treatment: 'card', priority: 4, officialUrl: 'https://www.parks.ca.gov/candlestickpoint/' },
  { id: 'childrens-creativity-museum', placeId: 'osm-w288716388', name: bi('儿童创意博物馆与旋转木马', 'Children\'s Creativity Museum & LeRoy King Carousel'), short: bi('儿童创意馆', 'Creativity'), cat: 'museum', rank: 3, fame: 26, x: 200.2, z: 221.8, arrival: { x: 199.9, z: 218.6 }, area: 'north-downtown', aliases: ['旋转木马', 'carousel', '儿童', 'kids'], siteId: 'yerba-buena', treatment: 'card', priority: 4, officialUrl: 'https://creativity.org/hours-admission/' },
  { id: 'chinese-historical-society-of-america', placeId: 'osm-n806240639', name: bi('美国华人历史学会博物馆', 'Chinese Historical Society of America Museum'), short: bi('华人历史馆', 'CHSA Museum'), cat: 'museum', rank: 3, fame: 30, x: 19.1, z: 169.2, arrival: { x: 18.4, z: 169.1 }, area: 'north-downtown', aliases: ['华人历史', 'CHSA', 'Chinese American'], siteId: 'chinatown', treatment: 'card', priority: 4, officialUrl: 'https://chsa.org/visit/', visitNote: bi('只在周三、周六开放', 'Open Wednesdays and Saturdays only') },
  { id: 'clarion-alley', placeId: 'osm-w8916752', name: bi('克拉里恩巷壁画', 'Clarion Alley'), short: bi('克拉里恩巷', 'Clarion Alley'), cat: 'culture', glyph: 'Palette', rank: 3, fame: 28, x: 261.4, z: 605.9, arrival: { x: 258.4, z: 602.6 }, area: 'twin-peaks-mission', aliases: ['壁画', 'murals', 'Clarion'], siteId: 'mission-18th', treatment: 'card', priority: 4 },
  { id: 'cupids-span', placeId: 'osm-w32862802', name: bi('丘比特之箭', 'Cupid\'s Span (Rincon Park)'), short: bi('丘比特之箭', 'Cupid\'s Span'), cat: 'culture', glyph: 'Palette', rank: 3, fame: 30, x: 205.8, z: 27.7, arrival: { x: 205.9, z: 35.6 }, area: 'north-downtown', aliases: ['丘比特', 'Cupid', '弓箭', 'Rincon Park'], treatment: 'card', priority: 4, hero: true },
  { id: 'glide-memorial-church', placeId: 'glide-memorial-church', name: bi('格莱德纪念教堂', 'Glide Memorial Church'), short: bi('格莱德教堂', 'Glide'), cat: 'culture', glyph: 'Church', rank: 3, fame: 26, x: 92.4, z: 285.4, arrival: { x: 94.1, z: 285.4 }, area: 'north-downtown', aliases: ['Glide', '格莱德'], siteId: 'tenderloin', treatment: 'card', priority: 4, officialUrl: 'https://www.glide.org/about/', quiet: true },
  { id: 'golden-gate-fortune-cookie-factory', placeId: 'osm-n1308317902', name: bi('金门签语饼厂', 'Golden Gate Fortune Cookie Factory (Ross Alley)'), short: bi('签语饼厂', 'Fortune Cookie'), cat: 'shopping', rank: 3, fame: 30, x: 11.1, z: 136.4, arrival: { x: 10.9, z: 136.9 }, area: 'north-downtown', aliases: ['签语饼', 'fortune cookie', 'Ross Alley'], siteId: 'chinatown', treatment: 'card', priority: 4, officialUrl: 'https://www.goldengatefortunecookies.com/visit' },
  { id: 'greenwich-steps', placeId: 'osm-w28839856', name: bi('格林威治台阶', 'Greenwich Steps'), short: bi('电报山台阶', 'Greenwich'), cat: 'viewpoint', glyph: 'Binoculars', rank: 3, fame: 24, x: -51.7, z: 42.1, arrival: { x: -51.4, z: 43.1 }, area: 'north-downtown', aliases: ['台阶', 'steps', '电报山', 'Telegraph Hill'], treatment: 'card', priority: 4, hero: true },
  { id: 'herons-head-park', placeId: 'osm-n1306296013', name: bi('苍鹭头公园', 'Heron\'s Head Park'), short: bi('苍鹭头公园', 'Heron\'s Head'), cat: 'park', rank: 3, fame: 20, x: 923.3, z: 457.4, area: 'south', aliases: ['Heron\'s Head', '湿地'], siteId: 'bayview', treatment: 'card', priority: 4 },
  { id: 'hidden-garden-steps', placeId: 'hidden-garden-steps', name: bi('隐秘花园阶梯', 'Hidden Garden Steps'), short: bi('花园阶梯', 'Hidden Garden'), cat: 'viewpoint', rank: 3, fame: 24, x: -153.9, z: 1111.5, area: 'park-sunset', aliases: ['花园阶梯', 'Hidden Garden Steps', '马赛克'], siteId: 'golden-gate-heights', treatment: 'card', priority: 4 },
  { id: 'hyde-street-pier', placeId: 'aquatic-park-hyde-pier', name: bi('海德街码头（历史船只）', 'Hyde Street Pier (historic ships)'), short: bi('海德街码头', 'Hyde St Pier'), cat: 'museum', glyph: 'Sailboat', rank: 3, fame: 30, x: -267.4, z: 116.7, arrival: { x: -248.6, z: 119.6 }, area: 'north-downtown', aliases: ['历史船只', 'historic ships', 'Hyde Street Pier'], siteId: 'wharf-west', treatment: 'card', priority: 4, officialUrl: 'https://www.nps.gov/safr/planyourvisit/basicinfo.htm', visitNote: bi('2024 年 11 月起关闭，暂无重开日期', 'Closed since Nov 2024; no reopening date yet') },
  { id: 'india-basin-waterfront-park', placeId: 'india-basin-waterfront-park', name: bi('印度湾滨水公园', 'India Basin Waterfront Park'), short: bi('印度湾公园', 'India Basin'), cat: 'park', rank: 3, fame: 20, x: 988.2, z: 539.1, area: 'south', aliases: ['India Basin', '印度湾'], siteId: 'bayview', treatment: 'card', priority: 4, officialUrl: 'https://sfrecpark.org/1153/India-Basin-Waterfront-Park', visitNote: bi('部分区域施工围挡，约到 2028 年初', 'Parts fenced for works until early 2028') },
  { id: 'macondray-lane', placeId: 'osm-n358805395', name: bi('麦康德雷巷', 'Macondray Lane'), short: bi('麦康德雷巷', 'Macondray Ln'), cat: 'neighbourhood', rank: 3, fame: 20, x: -94.9, z: 168, area: 'north-downtown', aliases: ['Macondray'], siteId: 'russian-hill', treatment: 'card', priority: 4 },
  { id: 'maiden-lane', placeId: 'maiden-lane', name: bi('少女巷', 'Maiden Lane (V.C. Morris Gift Shop)'), short: bi('少女巷', 'Maiden Lane'), cat: 'shopping', rank: 3, fame: 28, x: 106.9, z: 206.1, area: 'north-downtown', aliases: ['Maiden Lane', '赖特', 'Frank Lloyd Wright'], siteId: 'union-square', treatment: 'card', priority: 4 },
  { id: 'moad', placeId: 'osm-n415567060', name: bi('非洲侨民博物馆', 'Museum of the African Diaspora (MoAD)'), short: bi('非洲侨民馆', 'MoAD'), cat: 'museum', rank: 3, fame: 26, x: 164.1, z: 183.6, arrival: { x: 162.4, z: 183.4 }, area: 'north-downtown', aliases: ['MoAD', 'African Diaspora'], siteId: 'yerba-buena', treatment: 'card', priority: 4, officialUrl: 'https://www.moadsf.org/visit' },
  { id: 'moscone-center', placeId: 'moscone-center', name: bi('莫斯康展览中心', 'Moscone Center'), short: bi('莫斯康中心', 'Moscone'), cat: 'landmark', rank: 3, fame: 30, x: 194.8, z: 197.9, arrival: { x: 190.9, z: 197.6 }, area: 'north-downtown', aliases: ['展览中心', 'convention', 'Moscone'], siteId: 'yerba-buena', treatment: 'card', priority: 4, officialUrl: 'https://www.moscone.com/' },
  { id: 'palace-hotel', placeId: 'palace-hotel', name: bi('皇宫酒店', 'Palace Hotel (Garden Court)'), short: bi('皇宫酒店', 'Palace Hotel'), cat: 'landmark', glyph: 'Castle', rank: 3, fame: 28, x: 138.1, z: 167.5, arrival: { x: 138.4, z: 166.1 }, area: 'north-downtown', aliases: ['Palace Hotel', 'Garden Court'], siteId: 'market-st', treatment: 'card', priority: 4, officialUrl: 'https://www.sfpalace.com/history/' },
  { id: 'portsmouth-square', placeId: 'osm-r14547583', name: bi('花园角', 'Portsmouth Square'), short: bi('花园角', 'Portsmouth Sq'), cat: 'park', rank: 3, fame: 34, x: 37.2, z: 128.7, area: 'north-downtown', aliases: ['花园角', 'Portsmouth', '唐人街'], siteId: 'chinatown', treatment: 'card', priority: 4, officialUrl: 'https://sfrecpark.org/1166/Portsmouth-Square-Improvement-Project', visitNote: bi('改建施工中，预计 2028 年重开', 'Closed for rebuilding; reopening expected 2028') },
  { id: 'presidio-officers-club', placeId: 'presidio-officers-club', name: bi('要塞公园军官俱乐部', 'Presidio Officers\' Club'), short: bi('军官俱乐部', 'Officers\' Club'), cat: 'museum', rank: 3, fame: 26, x: -450.9, z: 575.6, arrival: { x: -447.4, z: 576.4 }, area: 'bridge-presidio', aliases: ['Officers\' Club', '要塞'], siteId: 'presidio', treatment: 'card', priority: 4, officialUrl: 'https://presidio.gov/explore/attractions/presidio-officers-club/', visitNote: bi('展馆周五至周日开放', 'Gallery open Friday to Sunday') },
  { id: 'sf-railway-museum', placeId: 'osm-n386591692', name: bi('旧金山铁路博物馆', 'San Francisco Railway Museum'), short: bi('铁路博物馆', 'Railway Museum'), cat: 'museum', rank: 3, fame: 26, x: 149.2, z: 35.6, area: 'north-downtown', aliases: ['电车', 'streetcar', 'F 线', 'Railway Museum'], treatment: 'card', priority: 4, officialUrl: 'https://www.streetcar.org/museum/', hero: true },
  { id: 'sfjazz-center', placeId: 'osm-w256720482', name: bi('旧金山爵士中心', 'SFJAZZ Center'), short: bi('爵士中心', 'SFJAZZ'), cat: 'culture', glyph: 'Theater', rank: 3, fame: 30, x: 104.6, z: 470.1, arrival: { x: 102.4, z: 469.1 }, area: 'north-downtown', aliases: ['爵士', 'jazz', 'SFJAZZ'], siteId: 'hayes-valley', treatment: 'card', priority: 4, officialUrl: 'https://www.sfjazz.org/tickets/productions/26-27/season-preview-party/' },
  { id: 'tadich-grill', placeId: 'tadich-grill', name: bi('塔迪奇烧烤餐厅', 'Tadich Grill'), short: bi('塔迪奇餐厅', 'Tadich Grill'), cat: 'shopping', rank: 3, fame: 24, x: 103.9, z: 91.1, arrival: { x: 104.6, z: 91.1 }, area: 'north-downtown', aliases: ['Tadich', '老餐厅'], treatment: 'card', priority: 4, officialUrl: 'https://tadichgrillsf.com/', hero: true },
  { id: 'tenderloin-museum', placeId: 'tenderloin-museum', name: bi('田德隆博物馆', 'Tenderloin Museum'), short: bi('田德隆馆', 'Tenderloin'), cat: 'museum', rank: 3, fame: 22, x: 84.4, z: 323.1, area: 'north-downtown', aliases: ['田德隆', 'Tenderloin'], siteId: 'tenderloin', treatment: 'card', priority: 4, officialUrl: 'https://www.tenderloinmuseum.org/' },
  { id: 'the-fillmore', placeId: 'osm-n368171371', name: bi('菲尔莫尔音乐厅', 'The Fillmore'), short: bi('菲尔莫尔', 'The Fillmore'), cat: 'culture', glyph: 'Theater', rank: 3, fame: 32, x: -80.5, z: 490, area: 'north-downtown', aliases: ['Fillmore', '音乐厅', 'concert'], siteId: 'fillmore', treatment: 'card', priority: 4, officialUrl: 'https://www.thefillmore.com/shows' },
  { id: 'tin-how-temple', placeId: 'tin-how-temple', name: bi('天后古庙', 'Tin How Temple (Waverly Place)'), short: bi('天后古庙', 'Tin How Temple'), cat: 'culture', glyph: 'Church', rank: 3, fame: 30, x: 26.7, z: 145.6, arrival: { x: 26.6, z: 145.1 }, area: 'north-downtown', aliases: ['天后', '妈祖', 'Waverly Place', 'temple'], siteId: 'chinatown', treatment: 'card', priority: 4, officialUrl: 'https://chsa.org/wp-content/uploads/2022/08/CHSA-ChinatownWalkingTourMap.pdf', quiet: true },
  { id: 'union-street-shopping', placeId: 'union-street-shopping', name: bi('联合街（牛谷购物街）', 'Union Street (Cow Hollow shopping street)'), short: bi('联合街', 'Union St'), cat: 'shopping', rank: 3, fame: 30, x: -221.5, z: 334.8, area: 'bridge-presidio', aliases: ['Union Street', 'Cow Hollow', '牛谷'], siteId: 'cow-hollow', treatment: 'card', priority: 4 },
  { id: 'visitacion-valley-greenway', placeId: 'osm-w257182717', name: bi('访谷绿道', 'Visitacion Valley Greenway'), short: bi('访谷绿道', 'Vis Valley'), cat: 'park', rank: 3, fame: 20, x: 934.6, z: 1000.8, area: 'south', aliases: ['Visitacion Valley', '访谷'], siteId: 'visitacion', treatment: 'card', priority: 4, officialUrl: 'https://visvalleygreenway.com/visitacion-valley' },
  { id: 'yoda-fountain', placeId: 'yoda-fountain', name: bi('尤达喷泉（卢卡斯影业园区）', 'Yoda Fountain (Letterman Digital Arts Center)'), short: bi('尤达喷泉', 'Yoda Fountain'), cat: 'culture', rank: 3, fame: 30, x: -392.6, z: 484.9, arrival: { x: -387.4, z: 484.9 }, area: 'bridge-presidio', aliases: ['尤达', 'Yoda', '星球大战', 'Star Wars', 'Lucasfilm'], siteId: 'presidio', treatment: 'card', priority: 4 },
  { id: 'sentinel-building', placeId: 'osm-w288485994', name: bi('哨兵大厦（哥伦布塔）', 'Sentinel Building (Columbus Tower)'), short: bi('哨兵大厦', 'Columbus Tower'), cat: 'landmark', rank: 3, fame: 32, x: 21.3, z: 106.9, arrival: { x: 20.6, z: 106.9 }, area: 'north-downtown', aliases: ['Sentinel', 'Columbus Tower', '绿色大楼'], treatment: 'defer', priority: 4, hero: true },
  { id: 'ss-jeremiah-obrien', placeId: 'osm-w1280748838', name: bi('奥布莱恩号自由轮', 'SS Jeremiah O\'Brien'), short: bi('奥布莱恩号', 'SS O\'Brien'), cat: 'museum', glyph: 'Sailboat', rank: 3, fame: 28, x: -130.1, z: -8.3, area: 'north-downtown', aliases: ['自由轮', 'Liberty ship', 'O\'Brien'], treatment: 'defer', priority: 4, officialUrl: 'https://ssjeremiahobrien.org/visit-us/', hero: true },
  { id: 'golden-gate-bridge', placeId: 'ggb-deck-mid', name: bi('金门大桥', 'Golden Gate Bridge'), short: bi('金门大桥', 'Golden Gate'), cat: 'landmark', rank: 1, fame: 100, x: -796.1, z: 564.4, area: 'bridge-presidio', aliases: ['金门桥', 'GGB', 'Golden Gate', '大桥', 'bridge'], photoKey: 'bridge', landmarkId: 'golden-gate-bridge', treatment: 'stop', priority: 2 },
  { id: 'alcatraz', placeId: 'alcatraz', name: bi('恶魔岛', 'Alcatraz Island'), short: bi('恶魔岛', 'Alcatraz'), cat: 'coast', glyph: 'Sailboat', rank: 1, fame: 95, x: -468.2, z: -58.5, arrival: { x: -97.68, z: -21.16 }, offWalk: 'island: the ferries leave from Pier 33 (ARRIVAL_PLACES: 恶魔岛渡轮码头 · 33 号码头, its telescope)', area: 'north-downtown', aliases: ['恶魔岛', '恶魔岛监狱', 'Alcatraz', '阿尔卡特拉斯', 'prison'], photoKey: 'alcatraz', treatment: 'card', priority: 2, siteId: 'alcatraz' },
  { id: 'fishermans-wharf', placeId: 'fishermans-wharf', name: bi('渔人码头', 'Fisherman\'s Wharf'), short: bi('渔人码头', 'The Wharf'), cat: 'coast', rank: 1, fame: 90, x: -206.3, z: 84.6, area: 'north-downtown', aliases: ['渔人码头', 'Fisherman\'s Wharf', 'Wharf', '螃蟹'], landmarkId: 'fishermans-wharf', treatment: 'stop', priority: 2 },
  { id: 'coit-tower', placeId: 'coit-tower', name: bi('科伊特塔', 'Coit Tower'), short: bi('科伊特塔', 'Coit Tower'), cat: 'landmark', rank: 1, fame: 80, x: -50.2, z: 51.1, area: 'north-downtown', aliases: ['科伊特', 'Coit', '电报山', 'Telegraph Hill'], photoKey: 'coit', treatment: 'card', priority: 2, hero: true, panorama: true },
  { id: 'chinatown-dragon-gate', placeId: 'chinatown-dragon-gate', name: bi('唐人街龙门', 'Chinatown Dragon Gate'), short: bi('唐人街', 'Chinatown'), cat: 'landmark', rank: 1, fame: 86, x: 81.9, z: 174.7, area: 'north-downtown', aliases: ['唐人街', '中国城', '华埠', 'Chinatown', '龙门', 'Dragon Gate'], photoKey: 'chinatown', landmarkId: 'dragon-gate', treatment: 'stop', priority: 2 },
  { id: 'lombard-crooked', placeId: 'lombard-crooked', name: bi('九曲花街（伦巴底街）', 'Lombard Street (the crooked block)'), short: bi('九曲花街', 'Lombard St'), cat: 'landmark', glyph: 'Signpost', rank: 1, fame: 85, x: -157.6, z: 168, area: 'north-downtown', aliases: ['九曲花街', '伦巴底街', '花街', 'Lombard', 'crooked street'], photoKey: 'lombard', landmarkId: 'lombard-crooked-street', treatment: 'stop', priority: 2 },
  { id: 'palace-of-fine-arts', placeId: 'palace-of-fine-arts', name: bi('艺术宫', 'Palace of Fine Arts'), short: bi('艺术宫', 'The Palace'), cat: 'landmark', glyph: 'Castle', rank: 1, fame: 83, x: -420.3, z: 422.3, area: 'bridge-presidio', aliases: ['艺术宫', 'Palace of Fine Arts', 'Palace'], photoKey: 'palace', landmarkId: 'palace-of-fine-arts', treatment: 'stop', priority: 2 },
  { id: 'golden-gate-park', placeId: 'golden-gate-park', name: bi('金门公园', 'Golden Gate Park'), short: bi('金门公园', 'GG Park'), cat: 'park', rank: 1, fame: 82, x: -334.8, z: 1080.6, area: 'park-sunset', aliases: ['金门公园', 'GG Park', 'Golden Gate Park', '公园'], photoKey: 'park', treatment: 'card', priority: 2 },
  { id: 'alamo-square-painted-ladies', placeId: 'alamo-square-painted-ladies', name: bi('彩绘女士（明信片排屋）', 'Painted Ladies (Postcard Row)'), short: bi('彩绘女士', 'Painted Ladies'), cat: 'landmark', rank: 1, fame: 84, x: -7.5, z: 586.5, area: 'north-downtown', aliases: ['彩绘女士', '阿拉莫广场', 'Alamo Square', '明信片排屋', 'Postcard Row', '维多利亚'], photoKey: 'painted-ladies', landmarkId: 'painted-ladies', treatment: 'stop', priority: 2 },
  { id: 'city-hall', placeId: 'city-hall', name: bi('旧金山市政厅', 'San Francisco City Hall'), short: bi('市政厅', 'City Hall'), cat: 'landmark', rank: 1, fame: 72, x: 92.3, z: 418.2, area: 'north-downtown', aliases: ['市政厅', 'City Hall', '市政中心', 'Civic Center'], photoKey: 'city-hall', landmarkId: 'city-hall', treatment: 'stop', priority: 2 },
  { id: 'fort-point', placeId: 'fort-point', name: bi('Fort Point 炮台', 'Fort Point'), short: bi('Fort Point', 'Fort Point'), cat: 'landmark', glyph: 'Castle', rank: 2, fame: 57, x: -750.4, z: 595.1, area: 'bridge-presidio', aliases: ['炮台', 'Fort Point', '波因特堡'], landmarkId: 'fort-point', treatment: 'stop', priority: 2 },
  { id: 'oracle-park', placeId: 'oracle-park', name: bi('甲骨文球场', 'Oracle Park'), short: bi('甲骨文球场', 'Oracle Park'), cat: 'sports', rank: 2, fame: 64, x: 353, z: 162.3, area: 'north-downtown', aliases: ['甲骨文', '棒球场', 'ballpark', 'Oracle Park'], photoKey: 'oracle-park', landmarkId: 'oracle-park', treatment: 'stop', priority: 2 },
  { id: 'chase-center', placeId: 'chase-center', name: bi('大通中心', 'Chase Center'), short: bi('大通中心', 'Chase Center'), cat: 'sports', rank: 2, fame: 52, x: 491.2, z: 258.8, area: 'north-downtown', aliases: ['大通中心', '篮球', 'arena', 'Chase Center'], landmarkId: 'chase-center', treatment: 'stop', priority: 2 },
  { id: 'ghirardelli-square', placeId: 'ghirardelli-square', name: bi('吉尔德利广场', 'Ghirardelli Square'), short: bi('吉尔德利', 'Ghirardelli'), cat: 'shopping', rank: 2, fame: 63, x: -235.5, z: 165.2, area: 'north-downtown', aliases: ['巧克力', 'chocolate', 'Ghirardelli'], landmarkId: 'ghirardelli-square', treatment: 'stop', priority: 2 },
  { id: 'grace-cathedral', placeId: 'grace-cathedral', name: bi('慈恩堂（格雷斯大教堂）', 'Grace Cathedral'), short: bi('慈恩堂', 'Grace Cath.'), cat: 'culture', glyph: 'Church', rank: 2, fame: 55, x: 1.6, z: 232.4, area: 'north-downtown', aliases: ['格雷斯', '慈恩堂', 'Grace Cathedral', '诺布山', 'Nob Hill'], landmarkId: 'grace-cathedral', treatment: 'stop', priority: 2, quiet: true },
  { id: 'japantown-peace-pagoda', placeId: 'japantown-peace-pagoda', name: bi('日本城和平塔', 'Japantown Peace Pagoda'), short: bi('日本城', 'Japantown'), cat: 'landmark', rank: 2, fame: 54, x: -63.1, z: 450, area: 'north-downtown', aliases: ['日本城', 'Japantown', '和平塔', 'Peace Pagoda'], landmarkId: 'peace-pagoda', treatment: 'stop', priority: 2 },
  { id: 'cable-car-powell-market', placeId: 'cable-car-powell-market', name: bi('鲍威尔街 · 市场街叮当车转车台', 'Powell & Market cable-car turntable'), short: bi('转车台', 'Turntable'), cat: 'landmark', rank: 2, fame: 67, x: 129.3, z: 257.5, area: 'north-downtown', aliases: ['叮当车', '缆车', 'cable car', '转车台', 'turntable', 'Powell'], photoKey: 'cable-car', landmarkId: 'cable-car-turntable', treatment: 'stop', priority: 2 },
  { id: 'presidio', placeId: 'presidio', name: bi('要塞公园', 'Presidio'), short: bi('要塞公园', 'Presidio'), cat: 'park', rank: 2, fame: 63, x: -527.9, z: 622.9, area: 'bridge-presidio', aliases: ['要塞', 'Presidio'], photoKey: 'presidio', treatment: 'card', priority: 2 },
  { id: 'crissy-field', placeId: 'crissy-field', name: bi('克里西场', 'Crissy Field'), short: bi('克里西场', 'Crissy Field'), cat: 'park', rank: 2, fame: 58, x: -576.1, z: 546.4, area: 'bridge-presidio', aliases: ['克里西', 'Crissy Field', '海滨草地'], treatment: 'card', priority: 2 },
  { id: 'pier-39', placeId: 'pier-39', name: bi('39 号码头', 'Pier 39'), short: bi('39 号码头', 'PIER 39'), cat: 'coast', glyph: 'Sailboat', rank: 2, fame: 74, x: -154.6, z: 26.6, area: 'north-downtown', aliases: ['39号码头', 'PIER 39', '海狮', 'sea lions'], photoKey: 'pier', treatment: 'card', priority: 2, hero: true },
  { id: 'exploratorium', placeId: 'exploratorium', name: bi('探索馆（15 号码头）', 'Exploratorium (Pier 15)'), short: bi('探索馆', 'Exploratorium'), cat: 'museum', rank: 2, fame: 62, x: 29, z: 4.3, area: 'north-downtown', aliases: ['探索馆', '科学馆', 'Exploratorium'], photoKey: 'exploratorium', treatment: 'card', priority: 2, hero: true },
  { id: 'bay-bridge', placeId: 'bay-bridge-sf-anchorage', name: bi('海湾大桥', 'Bay Bridge'), short: bi('海湾大桥', 'Bay Bridge'), cat: 'landmark', rank: 2, fame: 70, x: 278, z: 71.7, area: 'north-downtown', aliases: ['海湾大桥', 'Bay Bridge', '奥克兰大桥'], treatment: 'card', priority: 2 },
  { id: 'treasure-island', placeId: 'treasure-island', name: bi('金银岛', 'Treasure Island'), short: bi('金银岛', 'Treasure Is.'), cat: 'coast', glyph: 'Sailboat', rank: 2, fame: 40, x: 9.7, z: -487.4, arrival: { x: 183.1, z: -22.68 }, offWalk: 'island: no walking link in the game; trips end on Pier 14 (ARRIVAL_PLACES), its telescope looks at it', area: 'north-downtown', aliases: ['金银岛', 'Treasure Island'], treatment: 'card', priority: 2 },
  { id: 'marina-green', placeId: 'marina-green', name: bi('码头绿地', 'Marina Green'), short: bi('码头绿地', 'Marina Green'), cat: 'park', rank: 2, fame: 45, x: -382.1, z: 300.7, area: 'bridge-presidio', aliases: ['Marina', '马里纳', '放风筝', 'kites'], treatment: 'card', priority: 2 },
];

/**
 * In-world flag poles (plan §4.2): pole top `h` above the ground at the foot (skyline + 10 u, clamped 28–70; the
 * Golden Gate Bridge on its south tower top + 8), foot moved off the anchor where the tall part stands elsewhere.
 * PLACEHOLDERS from the modelled heights (data/sf/landmarks.ts `height.u` + 10, the hero towers' real heights with
 * H = 3.2 + 0.155·h): lane L owns the real numbers (`siteFlagTop(id)`), and may fill this table directly.
 */
export const FLAG_TOPS: Readonly<Record<string, { h: number; x?: number; z?: number }>> = {
  'golden-gate-bridge': { h: 50, x: -796.12, z: 564.38 },
  'sutro-tower': { h: 59, x: 72.9, z: 974.5 },
  'de-young-tower': { h: 28, x: -247.1, z: 930.6 },
  'city-hall': { h: 28, x: 92.1, z: 418.4 },
  'salesforce-tower': { h: 64 },
  'transamerica-pyramid': { h: 54 },
  'grace-cathedral': { h: 28 },
  'coit-tower': { h: 28 },
};
/** A low site's pole (plan §4.2 "low sites a 30 u pole"). */
export const DEFAULT_FLAG_H = 30;

const clampFlag = (h: number) => Math.min(ATTRACTION_FLAG_H.max, Math.max(ATTRACTION_FLAG_H.min, h));
/** The flag of a T1 / T2 attraction (T3 have none). */
export function flagFor(a: Pick<Attraction, 'id' | 'x' | 'z' | 'rank'>, tops: Readonly<Record<string, { h: number; x?: number; z?: number }>> = FLAG_TOPS): AttractionFlag | undefined {
  if (a.rank > 2) return undefined;
  const t = tops[a.id];
  return { x: t?.x ?? a.x, z: t?.z ?? a.z, h: clampFlag(t?.h ?? DEFAULT_FLAG_H) };
}

/**
 * Where the 24 existing SF landmarks' attractions arrive (review fix): the landmark's walkable anchor with its facing,
 * keyed by SF landmark id — world/sf/landmarks/context.ts `sfLandmarkAnchor(id)` (city-only code with the recipes, so
 * the numbers are copied here; tests/opus-bay-sf-attractions.test.ts fails with the new values when an anchor moves).
 * Why: data/sf/places.ts sends every trip, fly and discovery of a landmark row to that anchor, while the scouting's own
 * arrival points sat 2–19 u away (the Golden Gate Bridge 147 u: its badge stands on the south tower) — outside lane C's
 * 12 u arrival radius, so the arrival moment would not fire where 跟 BAYBAY 去 ends. `ARRIVAL_OVERRIDES` wins over this
 * table (the bridge arrives at the Welcome Center; its place row then ends travel there too, see extraPlaces.ts).
 */
export const LANDMARK_ARRIVALS: Readonly<Record<string, { x: number; z: number; heading: number }>> = {
  'golden-gate-bridge': { x: -678.75, z: 652.51, heading: 4.037 },
  'fishermans-wharf': { x: -198.51, z: 76.63, heading: 4.109 },
  'dragon-gate': { x: 86.7, z: 177.11, heading: -2.015 },
  'lombard-crooked-street': { x: -155.89, z: 158.94, heading: -0.228 },
  'painted-ladies': { x: 4.38, z: 577.87, heading: 2.484 },
  'palace-of-fine-arts': { x: -409.64, z: 409.63, heading: 5.498 },
  'twin-peaks': { x: 128.86, z: 922.32, heading: 3.142 },
  'city-hall': { x: 99.29, z: 408.19, heading: 5.672 },
  'sutro-baths': { x: -717.26, z: 1246.05, heading: -0.352 },
  'cable-car-turntable': { x: 131.58, z: 254.17, heading: -1.424 },
  'de-young-tower': { x: -243.9, z: 928.6, heading: -1.01 },
  'oracle-park': { x: 345.02, z: 177.19, heading: 2.421 },
  'ghirardelli-square': { x: -243.12, z: 160, heading: 0.967 },
  'conservatory-of-flowers': { x: -177.51, z: 858.11, heading: 4.049 },
  'mission-dolores': { x: 198.99, z: 638.96, heading: 5.655 },
  'sutro-tower': { x: 68.43, z: 980.61, heading: 2.443 },
  'legion-of-honor': { x: -663.12, z: 1074.83, heading: 6.229 },
  'dutch-windmill': { x: -584.3, z: 1315.67, heading: 2.374 },
  'fort-point': { x: -747.66, z: 598.89, heading: -2.147 },
  'castro-theatre': { x: 154.1, z: 747.12, heading: -2.443 },
  'grace-cathedral': { x: 8.92, z: 218.02, heading: 5.544 },
  'peace-pagoda': { x: -66.46, z: 447.02, heading: 0.85 },
  'chase-center': { x: 499.66, z: 241.83, heading: -0.461 },
  'cliff-house': { x: -702.21, z: 1268.05, heading: -1.464 },
};

/**
 * Arrivals moved on purpose (lane P2, the early reviews' open items): they win over LANDMARK_ARRIVALS and over the
 * scouting's point. `why` says what stands there; tests/opus-bay-sf-attractions.test.ts checks each one is walkable and
 * that the place row the attraction speaks for ends travel there too (data/sf/extraPlaces.ts `applyW4Places`).
 */
export const ARRIVAL_OVERRIDES: Readonly<Record<string, { x: number; z: number; heading?: number; why: string }>> = {
  // lane G's review O1: the bridge's trips ended at the landmark anchor (the Golden Gate Overlook, 31 u south of the
  // loop's stop, across Lincoln Blvd) and before that at mid-span. The Welcome Center plaza at the south end (OSM way
  // 164569681 "Welcome Center", 37.80765, −122.47494) is what the loop stop 5 "金门大桥 · 游客中心" names: 25 u from
  // the stop, the south tower in view (heading = towards it). Walking-graph node 3970.
  'golden-gate-bridge': { x: -702.4, z: 605.6, heading: 4.3, why: 'the Welcome Center plaza at the south end: the loop stop 金门大桥 · 游客中心 serves it' },
  // lane G's review O3: the panorama belongs at the summit (the DEM's highest cell (79, 749); Wikipedia's summit
  // 37.76465, −122.43914 is 6 u east), not at the Randall Museum door 19 u down the east slope. Walking-graph node
  // 19640, facing downtown and the bay.
  'corona-heights-randall-museum': { x: 81, z: 749, heading: 3.01, why: 'the summit (the view), not the Randall Museum door' },
  // lane L2 builds the gate plaza here; OSM node 7838369891 (entrance=main, 37.76705, −122.46679), the main gate on
  // MLK Dr reached from 9th Ave & Lincoln Way (gggp.org); the JSON point is the garden's centre, 58 u inside
  'sf-botanical-garden': { x: -178.3, z: 970.9, heading: 5.43, why: 'the main gate (MLK Dr at 9th Ave), not the middle of the garden' },
  // W5-N (lane F's sweep run 1, plan MF2: no T1 / T2 trip end may be stuck): each moved to the nearest open, reachable
  // ground off the carriageway, found with the sweep's own judge (four pushes of 1.5 s, three move ≥ 3 u; a nav path from
  // the walking graph's main component ends on it), heading toward the landmark; each looked at in the game.
  // Part c (the mid-wave checkpoint's CP-7: Fort Point BOXED live, W D S A 2.4 / 4.5 / 1.1 / 0.1 u): the same search, at
  // the fort's own level only (under 4 u: the bridge deck is 15 u up). (The bison paddock, OFF at its anchor, takes lane
  // L's site arrival now that lane E's coins keep 4 u from it: 88722c2.)
  'fort-point': { x: -744.81, z: 588.26, heading: -0.685, why: 'the seawall promenade by the fort\'s east wall, the bridge overhead: the door end was boxed against the wall and the slope (1 of 4 ways)' },
  'lombard-crooked': { x: -158.44, z: 153.14, heading: 0.056, why: 'the pavement at the crooked block\'s foot (Leavenworth St), the zigzag up ahead: the old end stood in Lombard St\'s lane, boxed (1 of 4 ways open)' },
  'sutro-baths': { x: -718.13, z: 1243.55, heading: -1.22, why: 'the ruins\' overlook path: the old end snagged (a wall 0.4 u ahead that the map does not draw)' },
  'pier-39': { x: -160.66, z: 24.1, heading: 1.18, why: 'the pier\'s gate plaza: the anchor is in The Embarcadero\'s roadway (not standable)' },
  // W7-W1 (lane W1's row): the East Cut corner (world/sf/cornersEastCut.ts) built the Sentinel's toy in the
  // district's own Kearny / Jackson corner (cornersNB.ts SENTINEL_RING): the old end was 0.6 u off its wall, in the
  // carriageway; the new one faces its rounded tip and dome.
  'sentinel-building': { x: 24.2, z: 109.4, heading: -2.88, why: 'the corner in front of the rounded tip and the dome (the toy stands in the corner the district draws)' },
  // W8-W1 (lane W1's row): the Dragon Gate site draws the Chinese Telephone Exchange's three tiers on its lot
  // (world/sf/cornersChinatown.ts); the old end (OSM's tiny footprint's middle) stood 0.1 u in front of the new front.
  // Washington St's sidewalk in front of the red columns, 2.8 u from the walking graph's nearest node.
  'chinese-telephone-exchange': { x: 27.11, z: 133.46, heading: 0.96, why: 'Washington St\'s sidewalk in front of the pagoda\'s red columns: the old end was 0.1 u from its new front wall' },
  // W8-W1 (lane W1's row): the O'Brien now lies in the water along the toy Pier 35's west face (world/sf/wharfShips.ts
  // OBRIEN). The old end (−130.1, −8.3) stood on the promenade apron, which the walking graph never reaches (its nodes
  // there run under the Embarcadero roadway, not standable): the static sweep's one UNREACHABLE. The new end is the same
  // apron's west end by the seawall, where the nearest graph node (992, the Embarcadero / North Point crossing) stands and
  // a nav path reaches it; the ship 26 u ahead across the water. 9.8 u from that node: tests/opus-bay-sf-attractions
  // waives the 3 u rule for this row (recorded there).
  'ss-jeremiah-obrien': { x: -148, z: 1, heading: 2.46, why: 'the promenade by the seawall west of Pier 35, the Liberty ship across the water: the old end was on an apron no walk reaches' },
  'greenwich-steps': { x: -52.27, z: 43.6, heading: 2.78, why: 'the landing beside the top step: the old end was boxed between the stair rails (3 of 4 ways under 0.3 u)' },
  'hyde-street-pier': { x: -247.56, z: 115.74, heading: -1.52, why: 'the pier\'s gate on Jefferson St: the old end was 3.2 u beyond where the walk can reach' },
};

/**
 * A place of its own where an off-walk attraction's trips end (lane G's review O2: the rows said "步行到恶魔岛 约 1
 * 分钟" when the walk really ends at the Pier 33 ferry landing). data/sf/extraPlaces.ts turns each into a runtime place
 * row (`ARRIVAL_PLACE_ROWS`: discoverable, searchable, a T3 dot; its English name contains the district POI's, so
 * buildPlaceIndex merges that POI — its telescope, BAYBAY's bark — into the row); `tripDestination(a)` names it.
 */
export interface ArrivalPlace {
  /** place-index id of the new row */
  id: string;
  name: Bilingual;
  /**
   * the short name for tight spots (lane G's phone trip pill: "下一站 33 号码头" instead of "下一站 恶魔岛渡轮…"; lane C's
   * request, review 2): ≤ 5 CJK / 14 Latin like Attraction.short, and never the island's own short
   */
  short: Bilingual;
  /** anchor = arrival spot: the district POI's point (its telescope) */
  x: number;
  z: number;
  kind: SfPlaceKindAll;
  sourceUrl: string;
  /** inside the hand-made hero slab (the sidecar's `--check` pins it) */
  hero?: boolean;
}
/** Keyed by attraction id. */
export const ARRIVAL_PLACES: Readonly<Record<string, ArrivalPlace>> = {
  // Alcatraz City Cruises: every ferry leaves from "Pier 33 Alcatraz Landing" on the Embarcadero (near Bay St); the
  // point is the district POI pier33 (its telescope, 37.80783, −122.40428)
  alcatraz: {
    id: 'alcatraz-landing', name: bi('恶魔岛渡轮码头 · 33 号码头', 'Pier 33 · Alcatraz Landing'), short: bi('33 号码头', 'Pier 33'), x: -97.68, z: -21.16, kind: 'transit',
    sourceUrl: 'https://alcatrazcitycruises.com/plan-your-visit/directions', hero: true,
  },
  // Pier 14: the 637-foot public pier / breakwater at the foot of Mission St; its end looks at the Bay Bridge and
  // Treasure Island (no walking link to the island in the game); the district POI pier14's point (its telescope)
  'treasure-island': {
    id: 'pier-14', name: bi('14 号码头', 'Pier 14'), short: bi('14 号码头', 'Pier 14'), x: 183.1, z: -22.68, kind: 'waterfront',
    sourceUrl: 'https://www.romacollaborative.com/pier-14', hero: true,
  },
};

/**
 * Where 跟 BAYBAY 去 goes for an attraction: lane G's `TripDestination` (game/tripPlan.ts), structurally, plus the
 * `short` name for lane G's pill (`tripPillText(…, { destination: d.name, short: d.short })`): the pier's for an island
 * (never the island's own, which would say "下一站 恶魔岛"), else the attraction's `short` when it has one.
 */
export interface AttractionDestination { placeId: string; x: number; z: number; name: Bilingual; attraction: string; short?: Bilingual }
/**
 * The trip destination of an attraction (lane G's planTrips, lane C's startTrip): its own named arrival place when it
 * has one (Alcatraz → 恶魔岛渡轮码头 · 33 号码头: the rows read "步行到恶魔岛渡轮码头 · 33 号码头", the phone pill "下一站
 * 33 号码头"), else the place it decorates, at its `arrival` (else its anchor), under its own name.
 */
export function tripDestination(a: Pick<Attraction, 'id' | 'name' | 'placeId' | 'x' | 'z' | 'arrival' | 'short'>): AttractionDestination {
  const spot = ARRIVAL_PLACES[a.id];
  if (spot) return { placeId: spot.id, x: spot.x, z: spot.z, name: spot.name, attraction: a.id, short: spot.short };
  const at = a.arrival ?? a;
  return { placeId: a.placeId ?? a.id, x: at.x, z: at.z, name: a.name, attraction: a.id, ...(a.short ? { short: a.short } : {}) };
}

/**
 * Wave 8 (lane A): an island you can land on by ferry now (Alcatraz: world/sf/alcatrazFerry.ts, the boat from Pier 33).
 * Its row stays off the walkable city (`offWalk`: the trips still end at its pier, ARRIVAL_PLACES; standing at the pier
 * is not arriving), but the island has an arrival moment of its own at `x, z` — the cellhouse front at the top of the
 * island's walk (world/sf/alcatrazWalk.ts ALCA_ARRIVAL; tests/opus-bay-w8-a-island keeps them equal) — with BAYBAY's
 * fixed `line` (game/arrival.ts arrivalAnchors / defaultArrivalLine). The row's `siteId` names the island's landmark,
 * whose photo pose plays the reveal (world/sf/landmarks/context sitePhoto).
 */
export interface IslandLanding {
  x: number;
  z: number;
  line: Bilingual;
  /**
   * the trigger radius (u), its own rather than game/arrival's 12 u floor (W8-A review, A-RC-2): Alcatraz's 12 u reached
   * down to the dock road under Building 64, 8 u below the plateau — the moment ("This is Alcatraz's cellhouse") fired at
   * the water's edge, before the stair's "the cellhouse is up the hill". 5 u: the top third of the stair and the plateau.
   */
  radius: number;
}
export const ISLAND_LANDINGS: Readonly<Record<string, IslandLanding>> = {
  alcatraz: { x: -460.96, z: -62.95, line: ALCA_LINES.arrive, radius: 5 },
};

/**
 * Lane L's site arrivals not taken yet, with the reason: the ones lane F's sweep judges worse than the old end. (Part c:
 * four of the five that waited for lane E's coins — the bison paddock, Buena Vista Park, Sutro Heights, the Seward
 * slides — are wired since lane E keeps every coin 4 u from them, 88722c2; Haight & Ashbury's snags in the sweep.)
 */
export const SITE_ARRIVALS_WAITING: Readonly<Record<string, string>> = {
  'haight-ashbury': 'the sweep (part c): SNAG on the site arrival (one way stopped at once by a wall the map does not draw); the old end is ok',
  'irving-street': 'the sweep: BOXED on the new pavement spot (1 of 4 ways), the old end is a CORRIDOR',
};
/** The site arrival an attraction takes (lane L's data/sf/siteArrivals.ts, less the waiting ones). */
export const siteArrivalFor = (id: string) => (SITE_ARRIVALS_WAITING[id] ? undefined : SITE_ARRIVALS[id]);
/** The attraction ids with a site arrival in use. */
export const SITE_ARRIVAL_IDS: readonly string[] = Object.keys(SITE_ARRIVALS).filter(id => !SITE_ARRIVALS_WAITING[id]);

/** Every attraction, T1 and T2 with their flag. Sorted by map priority (rank, then fame). */
export const ATTRACTIONS: readonly Attraction[] = ROWS.map(row => {
  const o = ARRIVAL_OVERRIDES[row.id];
  // W5-N5 (lane L's W5-L1 table, plan MF2): a wave-4 site's own arrival where the row's trip end failed the walk sweep
  // (inside a blocker, in a driven lane, off the graph, a tier-3 end > 8 u from its feature); after the overrides and
  // the landmark anchors
  const site = siteArrivalFor(row.id);
  const arr = o ? { x: o.x, z: o.z, ...(o.heading !== undefined ? { heading: o.heading } : {}) }
    : (row.landmarkId ? LANDMARK_ARRIVALS[row.landmarkId] : undefined) ?? (site ? { x: site.x, z: site.z, heading: site.heading } : undefined);
  const a = arr ? { ...row, arrival: { ...arr } } : row;
  const flag = flagFor(a);
  return flag ? { ...a, flag } : a;
}).sort((a, b) => byMapPriority(a, b));

/**
 * Place rows an attraction's badge stands for besides its `placeId` (review fix): the Golden Gate Bridge's badge is
 * drawn on the south tower, whose curated row (`ggb-south-tower`, "金门大桥 · 南塔") would otherwise draw a second
 * dot under it (a "+1" pip below s 1.2, two overlapping badges above). The map's plain-place dots and the search's
 * 地点 group skip every id of `coveredPlaceIds()`.
 */
export const BADGE_ALSO_COVERS: Readonly<Record<string, readonly string[]>> = {
  'golden-gate-bridge': ['ggb-south-tower'],
};
/** Every place id an attraction badge stands for: the placeIds plus BADGE_ALSO_COVERS. */
export function coveredPlaceIds(list: readonly Attraction[] = ATTRACTIONS): Set<string> {
  const out = new Set<string>();
  for (const a of list) { out.add(a.placeId ?? a.id); for (const id of BADGE_ALSO_COVERS[a.id] ?? []) out.add(id); }
  return out;
}

/** Map / list priority: rank first (T1 before T2 before T3), then fame (higher first), then id (stable). */
export function byMapPriority(a: Pick<Attraction, 'id' | 'rank' | 'fame'>, b: Pick<Attraction, 'id' | 'rank' | 'fame'>): number {
  return a.rank - b.rank || (b.fame ?? 50) - (a.fame ?? 50) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Lookups over a list of attractions (the module's own list by default; tests pass their own). */
export class AttractionIndex {
  readonly list: readonly Attraction[];
  private readonly ids = new Map<string, Attraction>();
  private readonly places = new Map<string, Attraction[]>();
  private readonly landmarks = new Map<string, Attraction>();
  constructor(list: readonly Attraction[]) {
    this.list = list;
    for (const a of list) {
      this.ids.set(a.id, a);
      if (a.landmarkId && !this.landmarks.has(a.landmarkId)) this.landmarks.set(a.landmarkId, a);
      const key = a.placeId ?? a.id;
      const arr = this.places.get(key);
      if (arr) arr.push(a); else this.places.set(key, [a]);
    }
    for (const arr of this.places.values()) arr.sort(byMapPriority);
  }
  get(id: string): Attraction | undefined { return this.ids.get(id); }
  /**
   * The attraction for an attraction id, else for an SF landmark registry id (`dragon-gate` → `chinatown-dragon-gate`,
   * `painted-ladies`, `lombard-crooked-street`, `cable-car-turntable`): data written against landmark ids still
   * resolves. Events, flags and cards use the canonical `Attraction.id`.
   */
  resolve(id: string): Attraction | undefined { return this.ids.get(id) ?? this.landmarks.get(id); }
  /** the attraction standing for SF landmark `landmarkId` */
  ofLandmark(landmarkId: string): Attraction | undefined { return this.landmarks.get(landmarkId); }
  /** the attractions decorating place `placeId`, most important first */
  ofPlace(placeId: string): readonly Attraction[] { return this.places.get(placeId) ?? []; }
  /** the attraction that speaks for place `placeId` on the map (badge, label, tier), if any */
  primary(placeId: string): Attraction | undefined { return this.places.get(placeId)?.[0]; }
  byRank(rank: AttractionRank): Attraction[] { return this.list.filter(a => a.rank === rank); }
  byCat(cat: AttractionCat): Attraction[] { return this.list.filter(a => a.cat === cat); }
}

export const ATTRACTION_INDEX = new AttractionIndex(ATTRACTIONS);
export const attractionById = (id: string) => ATTRACTION_INDEX.get(id);
/** Canonical attraction id of an attraction id or an SF landmark id (undefined when neither). */
export const canonicalAttractionId = (id: string): string | undefined => ATTRACTION_INDEX.resolve(id)?.id;
/** The 16 T1 ids (flags, stickers, "必看"). */
export const T1_IDS: readonly string[] = ATTRACTIONS.filter(a => a.rank === 1).map(a => a.id);

/** Badge glyph (lucide-react name): the attraction's own, else its category's. */
export const attractionGlyph = (a: Pick<Attraction, 'cat' | 'glyph'>): AttractionGlyph => a.glyph ?? ATTRACTION_CAT_STYLE[a.cat].glyph;
/** Badge / pennant colour (the category's). */
export const attractionColor = (a: Pick<Attraction, 'cat'>): string => ATTRACTION_CAT_STYLE[a.cat].color;
/** The map label: `short` when there is one, else the full name. */
export const attractionShort = (a: Pick<Attraction, 'name' | 'short'>): Bilingual => a.short ?? a.name;

/**
 * Map tier of a place-index row (plan §4.1): its primary attraction's rank (T1 / T2 / T3), else 3 for the other
 * curated places and the landmarks, else 4 (discovered OSM places, 3.5 px dots).
 */
export type MapTier = 1 | 2 | 3 | 4;
export function placeTier(p: { id: string; curated?: boolean; landmark?: string }, ix: AttractionIndex = ATTRACTION_INDEX): MapTier {
  const a = ix.primary(p.id);
  if (a) return a.rank;
  return p.curated || p.landmark ? 3 : 4;
}

/** A transit line as nearStops() needs it (TransitLine / TransitLineJson fit). */
export interface NearLine { id: string; stops: readonly { id: string; x: number; z: number }[] }
/**
 * The nearest stop of each line within `maxD` u (straight line) of the attraction's arrival spot (else its anchor),
 * nearest first, `d` rounded to 1 u. Plan §2.4 "nearest stops" (≤ 200 u).
 */
export function nearStops(a: Pick<Attraction, 'x' | 'z' | 'arrival'>, lines: readonly NearLine[], maxD = 200): AttractionStop[] {
  const px = a.arrival?.x ?? a.x, pz = a.arrival?.z ?? a.z;
  const out: AttractionStop[] = [];
  for (const line of lines) {
    let best: { id: string; d: number } | null = null;
    for (const s of line.stops) {
      const d = Math.hypot(s.x - px, s.z - pz);
      if (d <= maxD && (!best || d < best.d)) best = { id: s.id, d };
    }
    if (best) out.push({ line: line.id, stop: best.id, d: Math.round(best.d) });
  }
  return out.sort((p, q) => p.d - q.d || (p.line < q.line ? -1 : 1));
}
/** A copy of `list` with `near` filled from the published lines (call once the transit data is in). */
export const withNearStops = (list: readonly Attraction[], lines: readonly NearLine[], maxD = 200): Attraction[] =>
  list.map(a => { const near = nearStops(a, lines, maxD); return near.length ? { ...a, near } : a; });

/**
 * The list with lane L's real flag poles: `top(id)` (world/sf/landmarks/w4sites.ts `siteFlagTop`, city-only code:
 * call this in the city chunk), else `top(placeId)`, else the placeholder above; h clamped to 28–70. T3 get none.
 */
export function withSiteFlags(list: readonly Attraction[], top: (ref: string) => AttractionFlag | null): Attraction[] {
  return list.map(a => {
    if (a.rank > 2) return a;
    const f = top(a.id) ?? (a.placeId ? top(a.placeId) : null);
    return f ? { ...a, flag: { x: f.x, z: f.z, h: clampFlag(f.h) } } : a;
  });
}
