import type { Bilingual, Vec2 } from '../../core/types';
import type { SfPostcardArtId } from '../assets';

/**
 * The 12 whole-San-Francisco postcards' texts (lane G2 / lane C, unchanged; the rules are in data/sf/postcards.ts).
 * W5-V3 (lane V): moved out of data/sf/postcards.ts into the city's data chunk (data/sf/cityDataChunk.ts), so district
 * mode never downloads them; data/sf/postcards.ts reads them from `CITY_DATA`.
 */

export interface SfCard { title: Bilingual; fact: Bilingual; hint: Bilingual; sourceUrl: string; position: Vec2; near: string }

const bi = (zh: string, en: string): Bilingual => ({ zh, en });
const W = {
  ggb: 'https://en.wikipedia.org/wiki/Golden_Gate_Bridge',
  painted: 'https://en.wikipedia.org/wiki/Painted_ladies',
  palace: 'https://en.wikipedia.org/wiki/Palace_of_Fine_Arts',
  cableCars: 'https://www.sfmta.com/getting-around/muni/cable-cars',
  dragonGate: 'https://en.wikipedia.org/wiki/Dragon_Gate_(San_Francisco)',
  lombard: 'https://en.wikipedia.org/wiki/Lombard_Street_(San_Francisco)',
  missionDolores: 'https://en.wikipedia.org/wiki/Mission_San_Francisco_de_As%C3%ADs',
  windmill: 'https://en.wikipedia.org/wiki/Dutch_Windmill_(Golden_Gate_Park)',
  cityHall: 'https://www.sf.gov/location/san-francisco-city-hall',
  twinPeaks: 'https://en.wikipedia.org/wiki/Twin_Peaks_(San_Francisco)',
  cliffHouse: 'https://en.wikipedia.org/wiki/Cliff_House,_San_Francisco',
} as const;

/**
 * `near`: the card the postcard belongs to, as the suffix of its POI id (`sf:<near>`): a landmark id (world/sf/landmarks)
 * or a wave-4 place card's `cardPoiId` suffix; that card shows the art once the postcard is found.
 */
export const SF_POSTCARD_CARDS: Record<SfPostcardArtId, SfCard> = {
  'sf-golden-gate-fog': {
    title: bi('雾里的金门大桥', 'The Golden Gate in the Fog'),
    fact: bi('金门大桥的“国际橙”是建筑师 Irving Morrow 选的：既配海岬的颜色，雾里也看得清。', 'Architect Irving Morrow picked “International Orange” for the bridge: it suits the headlands and stays visible in fog.'),
    hint: bi('大桥南端的观景草坡上，雾散时找找。', 'On the grassy overlook at the bridge’s south end.'),
    sourceUrl: W.ggb, position: { x: -683.8, z: 670.4 }, near: 'golden-gate-bridge',
  },
  'sf-painted-ladies': {
    title: bi('阿拉莫广场的彩绘女士', 'The Painted Ladies'),
    fact: bi('Steiner 街 710–720 号这排维多利亚老房子建于 1892–1896 年，开发商就住在隔壁 722 号。', 'The Victorians at 710–720 Steiner Street went up in 1892–1896; their developer lived next door at 722.'),
    hint: bi('阿拉莫广场的坡顶，正对那排彩色老房子。', 'At the top of Alamo Square, facing the row of colourful houses.'),
    sourceUrl: W.painted, position: { x: -2, z: 593.6 }, near: 'painted-ladies',
  },
  'sf-palace-fine-arts': {
    title: bi('艺术宫的湖边', 'By the Palace Lagoon'),
    fact: bi('艺术宫是 Bernard Maybeck 为 1915 年万国博览会设计的，1964–1974 年整体重建。', 'Bernard Maybeck designed the Palace for the 1915 Panama–Pacific Exposition; it was fully rebuilt in 1964–1974.'),
    hint: bi('绕着艺术宫的湖边小路走一走。', 'Take the path around the Palace’s lagoon.'),
    sourceUrl: W.palace, position: { x: -403.6, z: 426.4 }, near: 'palace-of-fine-arts',
  },
  'sf-cable-car-hill': {
    title: bi('爬坡的叮当车', 'A Cable Car Climbing'),
    fact: bi('叮当车到了线路起终点，要开上木转盘，靠人力推着掉头。', 'At the ends of the line, cable cars roll onto a wooden turntable and are turned around by hand.'),
    hint: bi('诺布山上，两条叮当车线交叉的路口。', 'On Nob Hill, where two cable-car lines cross.'),
    sourceUrl: W.cableCars, position: { x: 35.2, z: 188.9 }, near: 'cable-car-turntable',
  },
  'sf-chinatown-lanterns': {
    title: bi('唐人街的红灯笼', 'Lanterns over Chinatown'),
    fact: bi('唐人街龙门 1970 年落成，绿色琉璃瓦和门口的石狮都是台湾捐赠的。', 'Chinatown’s Dragon Gate was dedicated in 1970; its green glazed tiles and guardian lions were donated from Taiwan.'),
    hint: bi('进了龙门，沿 Grant Avenue 往北走几个路口。', 'Through the Dragon Gate, a few blocks north up Grant Avenue.'),
    sourceUrl: W.dragonGate, position: { x: 31.8, z: 146.0 }, near: 'dragon-gate',
  },
  'sf-lombard-street': {
    title: bi('九曲花街', 'Lombard’s Crooked Block'),
    fact: bi('九曲花街 1922 年修成八个急弯，把原本 27% 的陡坡化开，只能单行下坡。', 'Lombard’s block got its eight hairpins in 1922 to tame a 27 % grade; cars may only drive down it.'),
    hint: bi('九曲花街的坡顶，Hyde 街那头。', 'At the top of the crooked block, the Hyde Street end.'),
    sourceUrl: W.lombard, position: { x: -163.1, z: 180.1 }, near: 'lombard-crooked-street',
  },
  'sf-mission-murals': {
    title: bi('教会区的壁画小巷', 'A Mission Mural Alley'),
    fact: bi('教会区的老邻居多洛雷斯传教站：土坯老教堂 1791 年完工，是全城最老的完整建筑。', 'The Mission’s old neighbour, Mission Dolores: its adobe church, finished in 1791, is the city’s oldest intact building.'),
    hint: bi('教会区一条画满墙的小巷里。', 'In a Mission alley painted wall to wall.'),
    sourceUrl: W.missionDolores, position: { x: 261.4, z: 606 }, near: 'mission-dolores',
  },
  'sf-dolores-park': {
    title: bi('多洛雷斯公园的午后', 'An Afternoon in Dolores Park'),
    fact: bi('往北两个路口的多洛雷斯传教站，老教堂天花板的图案是奥隆人用植物染料画的。', 'Two blocks north, the ceiling designs of Mission Dolores’s old church were painted by Ohlone people with vegetable dyes.'),
    hint: bi('多洛雷斯公园的草坡上，找个晒太阳的地方。', 'On the lawns of Dolores Park — find a sunny spot.'),
    sourceUrl: W.missionDolores, position: { x: 242, z: 698 }, near: 'mission-dolores',
  },
  'sf-windmill': {
    title: bi('金门公园的荷兰风车', 'The Dutch Windmill'),
    fact: bi('这座风车 1903 年建成，是给金门公园抽水灌溉的，风叶长 102 英尺。', 'The windmill was built in 1903 to pump irrigation water for Golden Gate Park; its sails are 102 ft long.'),
    hint: bi('金门公园西头，风车脚下的郁金香花园。', 'At the west end of Golden Gate Park, in the tulip garden by the windmill.'),
    sourceUrl: W.windmill, position: { x: -579.7, z: 1320.3 }, near: 'dutch-windmill',
  },
  'sf-city-hall': {
    title: bi('市政厅的金顶', 'City Hall’s Golden Dome'),
    fact: bi('市政厅在 1906 年地震后重建，圆顶高 307 英尺（约 94 米）。', 'City Hall was rebuilt after the 1906 earthquake; its dome rises 307 ft (about 94 m).'),
    hint: bi('市政厅东边的广场上。', 'On the plaza east of City Hall.'),
    sourceUrl: W.cityHall, position: { x: 111.7, z: 417.0 }, near: 'city-hall',
  },
  'sf-twin-peaks-view': {
    title: bi('双峰看全城', 'The City from Twin Peaks'),
    fact: bi('双峰的两座山峰都约 925 英尺高，北峰叫 Eureka，南峰叫 Noe。', 'Both of Twin Peaks’ summits stand about 925 ft; the north one is Eureka, the south one Noe.'),
    hint: bi('爬上双峰，观景台边上。', 'Climb Twin Peaks — by the overlook.'),
    sourceUrl: W.twinPeaks, position: { x: 133.5, z: 926.9 }, near: 'twin-peaks',
  },
  'sf-ocean-beach': {
    title: bi('海洋海滩的日落', 'Sunset at Ocean Beach'),
    fact: bi('海滩北端的悬崖屋现在是第三代，1909 年建成；前两座都毁于火灾。', 'The Cliff House at the beach’s north end is the third on the site, built in 1909 — the first two burned.'),
    hint: bi('城市最西边的长沙滩上，踩着浪花找找。', 'On the long beach at the city’s western edge — look along the surf.'),
    sourceUrl: W.cliffHouse, position: { x: -431, z: 1475 }, near: 'cliff-house',
  },
};
