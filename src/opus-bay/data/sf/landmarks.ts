import type { Bilingual, RealInfo } from '../../core/types';

/**
 * San Francisco landmarks — the info side (lane D). One record per id in world/sf/landmarks/index.ts:
 * names, neighbourhood, where the player arrives, a flattering photo pose, BAYLINK links and verified real info.
 *
 * Rules (DESIGN §8):
 * - every real fact carries `sourceUrl` + `verifiedAt` (facts spot-checked on 2026-09-26; secondary sources in
 *   `sources`); hours and prices are phrased cautiously ("出发前查官网确认");
 * - `plannerPlaceId` only uses ids in /planner-catalog.json `places`, `guideSlug` only slugs in /baybay-guides.json
 *   (checked by tests/opus-bay-sf-landmarks.test.ts); the UI builds the plan / guide / Google Maps links from them
 *   with data/links.ts (planUrl, guideUrl, mapsUrl). A planner place is the landmark itself or the area it stands in
 *   (Ghirardelli Square has none: PIER 39 is a different spot), and a guide is never tied to one month (those go
 *   stale: the turntable links the general SF guide);
 * - no invented events; no brand text anywhere in the models.
 *
 * Poses are LOCAL to the landmark frame (origin at its ground centre, +z = its front, yaw as in the registry):
 * - `arrival`: a walkable spot outside the blockers where travel / "带我去" ends, facing `heading` (local yaw);
 * - `photo`: camera = target + distance · (sin(bearing)·cos(elevation), sin(elevation), cos(bearing)·cos(elevation)).
 */

export const SF_VERIFIED_AT = '2026-09-26';

export interface SfLandmarkInfo {
  id: string;
  /**
   * the landmark's row in public/opus-bay/sf/v1/places.json (lane G1's place index, map, discovery, fast travel; G2's
   * cards): the registry id where places.json uses the same one, else the place it names (7 differ, D2-12)
   */
  placeId: string;
  name: Bilingual;
  /** neighbourhood / area label (zh follows the city glossary: 双峰, 马里纳区, 要塞公园, 叮当车, 卡斯特罗) */
  zone: Bilingual;
  /** the named public space in front of / around the landmark, where one exists (plaza labels, crowd copy) */
  plaza?: Bilingual;
  lat: number;
  lng: number;
  arrival: { x: number; z: number; heading: number };
  photo: { target: [number, number, number]; distance: number; elevation: number; bearing: number };
  /** height policy actually used by the model (plan §2.2/§2.3) */
  height: { realM: number; u: number; rule: 'H = 3.2 + 0.155·h' | 'terrainY' | 'overlook' };
  plannerPlaceId?: string;
  guideSlug?: string;
  officialUrl?: string;
  /** OSM features the model replaces / was measured from */
  osm: string[];
  /** secondary sources for facts in realInfo (the primary one is realInfo.sourceUrl) */
  sources: string[];
  /** one line BAYBAY says on arrival */
  bark: Bilingual;
  realInfo: RealInfo;
}

const bi = (zh: string, en: string): Bilingual => ({ zh, en });
const V = SF_VERIFIED_AT;
/** BAYLINK's general San Francisco guide (lists the landmark routes: bridge, Palace, Lombard, Painted Ladies, Twin Peaks, cable cars, Lands End) */
const SF_GUIDE = 'san-francisco-guide';

export const SF_LANDMARK_INFO: SfLandmarkInfo[] = [
  {
    id: 'golden-gate-bridge',
    placeId: 'ggb-south-tower',
    name: bi('金门大桥', 'Golden Gate Bridge'),
    zone: bi('金门海峡 · 要塞公园', 'The Golden Gate · Presidio'),
    lat: 37.81976, lng: -122.47856,
    arrival: { x: -236, z: 2.5, heading: Math.PI / 2 },
    photo: { target: [-40, 22, 0], distance: 240, elevation: 0.1, bearing: -0.55 },
    height: { realM: 227, u: 42.2, rule: 'terrainY' },
    plannerPlaceId: 'golden-gate',
    guideSlug: 'sf-golden-gate-bridge-fort-point-guide',
    officialUrl: 'https://www.goldengate.org/',
    osm: ['relation/21407754', 'way/1330586852', 'way/1330832666', 'way/1560010162', 'way/1560010163', 'way/1560010164', 'way/1560010165'],
    sources: ['https://www.goldengate.org/bridge/visiting-the-bridge/bikes-pedestrians/', 'https://en.wikipedia.org/wiki/Golden_Gate_Bridge'],
    bark: bi('这就是金门大桥！桥塔离水面 227 米，颜色叫“国际橙”。', 'The Golden Gate Bridge! The towers stand 227 m above the water, painted "International Orange".'),
    realInfo: {
      summary: bi('1937 年通车的悬索桥，两座桥塔之间的主跨 1,280 米，全长约 2.7 公里；桥塔高出水面 227 米，桥面中段离水约 67 米。', 'Opened in 1937, the suspension bridge has a 1,280 m main span between its towers and runs 2.7 km end to end; the towers rise 227 m above the water and the mid-span deck clears it by about 67 m.'),
      hours: bi('行人走东侧人行道，免费；冬令时约 5:00–18:30，夏令时约 5:00–21:00，出发前查官网确认。', 'Pedestrians use the free east sidewalk: about 5am–6:30pm in winter (PST) and 5am–9pm in summer (PDT); check the official site before you go.'),
      cost: bi('步行、骑车过桥免费；开车往南进城收过桥费。', 'Free on foot or by bike; driving southbound into the city is tolled.'),
      tips: [
        bi('“国际橙”是建筑师 Irving Morrow 选的：既配海岬的颜色，雾里也看得清。', 'Architect Irving Morrow picked "International Orange" to suit the headlands and stay visible in fog.'),
        bi('南端桥下的钢拱是为了保住 Fort Point 特意设计的。', 'The steel arch at the south end was designed to leave Fort Point standing beneath it.'),
        bi('BAYLINK 攻略：从南端 Welcome Center 出发，先分清人行道开放时间和停车收费。', 'BAYLINK guide: start at the south-end Welcome Center and check sidewalk hours and parking fees first.'),
      ],
      sourceUrl: 'https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/',
      verifiedAt: V, lat: 37.81976, lng: -122.47856,
    },
  },
  {
    id: 'sutro-tower',
    placeId: 'sutro-tower',
    name: bi('苏特罗塔', 'Sutro Tower'),
    zone: bi('苏特罗山 · 双峰旁', 'Mt Sutro · by Twin Peaks'),
    lat: 37.75523, lng: -122.45276,
    arrival: { x: 0.5, z: 7.5, heading: Math.PI },
    photo: { target: [0, 24, 0], distance: 95, elevation: 0.12, bearing: 0.35 },
    height: { realM: 298, u: 49.4, rule: 'H = 3.2 + 0.155·h' },
    officialUrl: 'https://sutrotower.com/',
    guideSlug: SF_GUIDE,
    osm: ['relation/3829019'],
    sources: ['https://en.wikipedia.org/wiki/Sutro_Tower'],
    bark: bi('三条腿的红白铁塔——迷路了就抬头找它，它在城市正中间的山上。', 'The three-legged red-and-white tower — lost? Look up for it on the hill in the middle of the city.'),
    realInfo: {
      summary: bi('三脚电视/电台发射塔，高 977 英尺（约 298 米），立在海拔约 834 英尺的 Mount Sutro 上，1973 年启用。', 'A three-legged TV and radio mast, 977 ft (≈298 m) tall on Mount Sutro, its base at about 834 ft; it went on air in 1973.'),
      tips: [
        bi('塔身不对外开放，最好的观景点在旁边的 Twin Peaks。', 'The tower itself is closed to visitors; nearby Twin Peaks is the place to see it.'),
        bi('三条腿在腰部收窄、顶部张开，远看像一只爪子，本地人也叫它 “Space Claw”。', 'The legs pinch at the waist and splay at the top — locals call it the "Space Claw".'),
      ],
      sourceUrl: 'https://sutrotower.com/about/',
      verifiedAt: V, lat: 37.75523, lng: -122.45276,
    },
  },
  {
    id: 'city-hall',
    placeId: 'city-hall',
    name: bi('旧金山市政厅', 'San Francisco City Hall'),
    zone: bi('市政中心', 'Civic Center'),
    plaza: bi('市政中心广场', 'Civic Center Plaza'),
    lat: 37.779276, lng: -122.419231,
    arrival: { x: 0, z: 12.5, heading: Math.PI },
    photo: { target: [0, 9, 0], distance: 42, elevation: 0.12, bearing: 0.35 },
    height: { realM: 94, u: 17.8, rule: 'H = 3.2 + 0.155·h' },
    officialUrl: 'https://www.sf.gov/location/san-francisco-city-hall',
    guideSlug: SF_GUIDE,
    osm: ['relation/7261820'],
    sources: [],
    bark: bi('市政厅的圆顶比美国国会大厦还高 42 英尺，很多新人在这里的大台阶拍婚照。', 'City Hall\'s dome is 42 ft taller than the U.S. Capitol\'s — and its grand staircase is a wedding-photo favourite.'),
    realInfo: {
      summary: bi('1906 年地震后重建的布杂艺术风格市政厅，圆顶 1913 年动工，高 307 英尺（约 94 米）。', 'The Beaux-Arts City Hall rebuilt after the 1906 earthquake; its dome, begun in 1913, rises 307 ft (≈94 m).'),
      hours: bi('周一至周五 8:00–18:00 对公众开放（以官网为准）。', 'Open to the public Monday–Friday, 8am–6pm (check the official page).'),
      cost: bi('进楼免费；周五 11:00、13:00 有免费讲解导览，约 45–60 分钟。', 'Free to enter; free docent tours Fridays at 11am and 1pm, about 45–60 minutes.'),
      tips: [
        bi('8 人以上团体导览需要提前预约并付费。', 'Groups of 8 or more must book ahead and pay for a tour.'),
        bi('进门有安检，别带大件行李。', 'There is a security check at the door — travel light.'),
      ],
      sourceUrl: 'https://www.sf.gov/location/san-francisco-city-hall',
      verifiedAt: V, lat: 37.779276, lng: -122.419231,
    },
  },
  {
    id: 'de-young-tower',
    placeId: 'de-young',
    name: bi('迪扬博物馆 · 观景塔', 'de Young Museum · Hamon Tower'),
    zone: bi('金门公园 · 音乐广场', 'Golden Gate Park · Music Concourse'),
    plaza: bi('音乐广场', 'Music Concourse'),
    lat: 37.771498, lng: -122.46872,
    arrival: { x: 11.5, z: 8, heading: -Math.PI / 2 },
    photo: { target: [1, 6, 3], distance: 36, elevation: 0.18, bearing: 1.25 },
    height: { realM: 51, u: 11.2, rule: 'H = 3.2 + 0.155·h' },
    plannerPlaceId: 'golden-gate-park',
    guideSlug: 'golden-gate-park-free-car-free-day-guide',
    officialUrl: 'https://www.famsf.org/visit/de-young',
    osm: ['relation/1652482', 'way/444230154', 'way/1418972816'],
    sources: [],
    bark: bi('铜皮大楼会慢慢氧化变绿；那座扭着的塔顶楼可以免费上去看公园。', 'The copper skin is slowly turning green — and the twisting tower\'s top floor is free to visit.'),
    realInfo: {
      summary: bi('Herzog & de Meuron 设计的新馆 2005 年开放，外墙包了约 15,000 平方米铜板；144 英尺（约 44 米）的 Hamon 观景塔可以俯瞰整个金门公园。', 'Herzog & de Meuron\'s museum opened in 2005, wrapped in about 15,000 m² of copper; the 144-ft (≈44 m) Hamon Observation Tower looks out over Golden Gate Park.'),
      cost: bi('观景塔免费进入；看展要买票，价格和开放时间以官网为准。', 'The observation tower is free; exhibitions are ticketed — check the official site for prices and hours.'),
      tips: [
        bi('塔身从底部顺着博物馆、到顶部对齐城市街网，是一路“扭”上去的。', 'The tower twists from the museum\'s alignment at its base to the city street grid at the top.'),
        bi('BAYLINK 攻略：JFK Promenade 无车路线会走到它门口的 Music Concourse。', 'BAYLINK guide: the car-free JFK Promenade walk ends at the Music Concourse right outside.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/De_Young_Museum',
      verifiedAt: V, lat: 37.771498, lng: -122.46872,
    },
  },
  {
    id: 'palace-of-fine-arts',
    placeId: 'palace-of-fine-arts',
    name: bi('艺术宫', 'Palace of Fine Arts'),
    zone: bi('马里纳区', 'The Marina'),
    lat: 37.802918, lng: -122.448385,
    arrival: { x: 3, z: 18.5, heading: Math.PI },
    photo: { target: [0, 5, 0], distance: 58, elevation: 0.1, bearing: 0.15 },
    height: { realM: 49, u: 10.8, rule: 'H = 3.2 + 0.155·h' },
    plannerPlaceId: 'palace',
    guideSlug: 'sf-palace-fine-arts-marina-guide',
    officialUrl: 'https://palaceoffinearts.com/',
    osm: ['way/288371295', 'way/456820271', 'way/288371306', 'way/288371310', 'way/1550664399', 'way/1550664400', 'relation/7471537'],
    sources: [],
    bark: bi('1915 年世博会留下来的圆顶，站在湖对岸看倒影最好看。', 'A rotunda left from the 1915 World\'s Fair — the reflection is best from across the lagoon.'),
    realInfo: {
      summary: bi('Bernard Maybeck 为 1915 年巴拿马–太平洋万国博览会设计，49 米高的圆顶亭一边是泻湖，一边是弧形展厅，中间隔着柱廊；1964–1974 年整体重建。', 'Bernard Maybeck designed it for the 1915 Panama–Pacific International Exposition: a 49 m rotunda between a lagoon and a curved exhibition hall, separated by colonnades; fully rebuilt 1964–1974.'),
      cost: bi('圆顶与湖边步道免费开放。', 'The rotunda and lagoon paths are free to walk.'),
      tips: [
        bi('BAYLINK 攻略：先绕湖看柱廊，再去 Marina Green 海边坐一会儿。', 'BAYLINK guide: loop the lagoon for the colonnades, then sit by the water at Marina Green.'),
        bi('柱顶那些“花箱”上有背对着人的女子雕像，据说是在为艺术哭泣。', 'The planter boxes on the columns carry figures facing away from you — "weeping" for art, legend says.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Palace_of_Fine_Arts',
      verifiedAt: V, lat: 37.802918, lng: -122.448385,
    },
  },
  {
    id: 'twin-peaks',
    placeId: 'twin-peaks',
    name: bi('双峰观景台', 'Twin Peaks overlook'),
    zone: bi('双峰', 'Twin Peaks'),
    plaza: bi('圣诞树观景点', 'Christmas Tree Point'),
    lat: 37.7544, lng: -122.4477,
    arrival: { x: 0, z: 0.4, heading: 0 },
    photo: { target: [0, 2, 6], distance: 18, elevation: 0.32, bearing: Math.PI },
    height: { realM: 282, u: 47.2, rule: 'overlook' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://sfrecpark.org/',
    osm: ['node/599157316', 'node/11778387241'],
    sources: [],
    bark: bi('整个旧金山都在脚下！找找看：金门大桥、市中心、还有海湾大桥。', 'All of San Francisco below you! Spot the Golden Gate, downtown and the Bay Bridge.'),
    realInfo: {
      summary: bi('两座约 925 英尺（282 米）的山峰，北峰 Eureka、南峰 Noe；观景台 Christmas Tree Point 在北峰下约 20 米，能看到全城和海湾。', 'Two peaks of about 925 ft (282 m) — Eureka to the north and Noe to the south; the Christmas Tree Point overlook, some 20 m below the north peak, takes in the whole city and the Bay.'),
      tips: [
        bi('Twin Peaks Boulevard 东侧一段只让行人和自行车通行。', 'One side of Twin Peaks Boulevard is reserved for walkers and bikes.'),
        bi('山顶风大、常有雾，带件外套；天气好时往东南能看很远。', 'It is windy and often foggy up here — bring a layer; on clear days the view runs far down the Peninsula.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Twin_Peaks_(San_Francisco)',
      verifiedAt: V, lat: 37.7544, lng: -122.4477,
    },
  },
  {
    id: 'painted-ladies',
    placeId: 'alamo-square-painted-ladies',
    name: bi('彩绘女士（明信片排屋）', 'Painted Ladies (Postcard Row)'),
    zone: bi('阿拉莫广场', 'Alamo Square'),
    plaza: bi('阿拉莫广场公园', 'Alamo Square park'),
    lat: 37.7762, lng: -122.4329,
    arrival: { x: 0, z: 9.5, heading: Math.PI },
    photo: { target: [0, 4, 0], distance: 30, elevation: 0.1, bearing: 0 },
    height: { realM: 12, u: 5.1, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    osm: ['way/261412896', 'way/261412895', 'way/261412900', 'way/261412894', 'way/261412879', 'way/261412899', 'way/261412887', 'node/822484002'],
    sources: [],
    bark: bi('一排维多利亚小楼，背后就是市中心——站在公园草坡上拍最经典。', 'A row of Victorians with downtown behind — the classic shot is from the park lawn.'),
    realInfo: {
      summary: bi('Steiner 街 710–720 号这排维多利亚式住宅由开发商 Matthew Kavanaugh 在 1892–1896 年建成，他自己住在隔壁 722 号；因为出现在《Full House》片头而闻名。', 'The Victorians at 710–720 Steiner Street were built in 1892–1896 by developer Matthew Kavanaugh, who lived next door at 722; the opening credits of "Full House" made them famous.'),
      cost: bi('从 Alamo Square 公园看是免费的。', 'Free to see from Alamo Square park.'),
      tips: [
        bi('这些都是私人住宅，请在人行道和公园里拍照，不要上门廊。', 'They are private homes — photograph from the sidewalk or the park, not the porches.'),
        bi('也叫 “Seven Sisters”（七姐妹）。', 'They are also called the "Seven Sisters".'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Painted_ladies',
      verifiedAt: V, lat: 37.7762, lng: -122.4329,
    },
  },
  {
    id: 'dragon-gate',
    placeId: 'chinatown-dragon-gate',
    name: bi('唐人街龙门', 'Chinatown Dragon Gate'),
    zone: bi('唐人街', 'Chinatown'),
    lat: 37.790688, lng: -122.405594,
    arrival: { x: 0, z: 5.5, heading: Math.PI },
    photo: { target: [0, 3, 0], distance: 17, elevation: 0.08, bearing: 0 },
    height: { realM: 11, u: 5.8, rule: 'H = 3.2 + 0.155·h' },
    plannerPlaceId: 'chinatown',
    guideSlug: 'sf-chinatown-north-beach-walk-guide',
    osm: ['node/65328703'],
    sources: [],
    bark: bi('穿过龙门就是 Grant Avenue——中门走车，两边小门走人。', 'Through the gate is Grant Avenue — cars take the middle arch, people the side ones.'),
    realInfo: {
      summary: bi('1970 年落成的唐人街牌楼，由 Clayton Lee 设计，绿色琉璃瓦和石狮由台湾捐赠；中门写着孙中山题的“天下为公”。', 'The Chinatown gateway, dedicated in 1970 and designed by Clayton Lee, with green glazed tiles and guardian lions donated from Taiwan; the central portal carries Sun Yat-sen\'s motto "All under heaven is for the good of the people".'),
      cost: bi('免费。', 'Free.'),
      tips: [
        bi('屋脊上有龙和鱼：鱼代表富足，龙代表力量。', 'Dragons and fish ride the ridges: fish for prosperity, dragons for power.'),
        bi('BAYLINK 攻略：从龙门沿 Grant Avenue 一路走到 North Beach 的 Washington Square。', 'BAYLINK guide: walk from the gate up Grant Avenue to Washington Square in North Beach.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Dragon_Gate_(San_Francisco)',
      verifiedAt: V, lat: 37.790688, lng: -122.405594,
    },
  },
  {
    id: 'conservatory-of-flowers',
    placeId: 'conservatory-of-flowers',
    name: bi('花卉温室', 'Conservatory of Flowers'),
    zone: bi('金门公园', 'Golden Gate Park'),
    lat: 37.772615, lng: -122.460224,
    arrival: { x: 0, z: 8.5, heading: Math.PI },
    photo: { target: [0, 3, 0], distance: 27, elevation: 0.12, bearing: 0 },
    height: { realM: 15, u: 5.5, rule: 'H = 3.2 + 0.155·h' },
    plannerPlaceId: 'golden-gate-park',
    guideSlug: 'golden-gate-park-free-car-free-day-guide',
    officialUrl: 'https://conservatoryofflowers.org/',
    osm: ['way/30675038', 'way/120480366'],
    sources: [],
    bark: bi('白色的玻璃温室，是金门公园里最老的建筑。', 'The white glasshouse — the oldest building in Golden Gate Park.'),
    realInfo: {
      summary: bi('1879 年建成的木框玻璃温室，是金门公园最老的建筑，也是北美仍对公众开放的最古老的木与玻璃温室。', 'Completed in 1879, the wood-and-glass greenhouse is the oldest building in Golden Gate Park and the oldest wood-and-glass conservatory in North America still open to the public.'),
      cost: bi('进温室要买票，价格和开放时间以官网为准；外面的花坛草坡免费。', 'Entry is ticketed — see the official site for prices and hours; the flower beds and lawns outside are free.'),
      tips: [
        bi('BAYLINK 攻略：把白色温室当背景，沿无车的 JFK Promenade 慢慢走。', 'BAYLINK guide: keep the white glasshouse as your backdrop and stroll the car-free JFK Promenade.'),
        bi('骨架用的是加州海岸红杉木。', 'Its frame is California coast redwood.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Conservatory_of_Flowers',
      verifiedAt: V, lat: 37.772615, lng: -122.460224,
    },
  },
  {
    id: 'dutch-windmill',
    placeId: 'dutch-windmill',
    name: bi('荷兰风车', 'Dutch Windmill'),
    zone: bi('金门公园 · 海洋海滩', 'Golden Gate Park · Ocean Beach'),
    plaza: bi('威廉明娜女王郁金香花园', 'Queen Wilhelmina Tulip Garden'),
    lat: 37.770441, lng: -122.509406,
    arrival: { x: 0, z: 5.2, heading: Math.PI },
    photo: { target: [0, 4, 1], distance: 20, elevation: 0.1, bearing: 0.4 },
    height: { realM: 23, u: 6.8, rule: 'H = 3.2 + 0.155·h' },
    plannerPlaceId: 'golden-gate-park',
    guideSlug: 'golden-gate-park-free-car-free-day-guide',
    osm: ['way/287921407', 'way/120483945'],
    sources: [],
    bark: bi('当年它是用来抽水浇公园的！春天旁边的郁金香开得最好。', 'It once pumped water for the park! The tulips next to it are best in spring.'),
    realInfo: {
      summary: bi('1903 年建成、给金门公园抽水灌溉的风车，风叶长 102 英尺；旁边是 Queen Wilhelmina 郁金香花园。', 'Built in 1903 to pump irrigation water for Golden Gate Park, with 102-ft sails; the Queen Wilhelmina Tulip Garden grows beside it.'),
      cost: bi('免费。', 'Free.'),
      tips: [
        bi('郁金香一般在春天（约 2–4 月）开，具体花期看天气。', 'The tulips usually bloom in spring (roughly February–April), depending on the weather.'),
        bi('过一条马路就是 Ocean Beach。', 'Ocean Beach is just across the road.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Dutch_Windmill_(Golden_Gate_Park)',
      verifiedAt: V, lat: 37.770441, lng: -122.509406,
    },
  },
  {
    id: 'mission-dolores',
    placeId: 'mission-dolores',
    name: bi('多洛雷斯传教站', 'Mission Dolores'),
    zone: bi('教会区', 'The Mission'),
    lat: 37.764185, lng: -122.426812,
    arrival: { x: -0.5, z: 7.2, heading: Math.PI },
    photo: { target: [1, 3.5, 2], distance: 21, elevation: 0.08, bearing: 0.2 },
    height: { realM: 8, u: 4.4, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.missiondolores.org/',
    osm: ['way/256442765', 'way/256442760', 'way/1421390128'],
    sources: [],
    bark: bi('左边这座白色小教堂是旧金山最古老的完整建筑，墙有四英尺厚。', 'The little white church on the left is the oldest intact building in San Francisco — its walls are four feet thick.'),
    realInfo: {
      summary: bi('传教站 1776 年创立，现存的土坯教堂 1791 年完工，是旧金山最古老的完整建筑；旁边的大教堂建于 1918 年，墓园是城里最老的墓地。', 'The mission was founded in 1776; its adobe church, finished in 1791, is the oldest intact structure in San Francisco. The basilica beside it dates from 1918 and the cemetery is the city\'s oldest.'),
      cost: bi('参观老教堂和墓园需要付费或捐款，金额和开放时间以官网为准。', 'Visiting the old church and cemetery asks a fee or donation — check the official site for the amount and hours.'),
      tips: [
        bi('老教堂天花板上的图案是奥隆人（Ohlone）用植物染料画的。', 'The old church\'s ceiling designs were painted by Ohlone people with vegetable dyes.'),
        bi('往南走两个路口就是 Dolores Park 草坡。', 'Dolores Park\'s lawns are two blocks south.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Mission_San_Francisco_de_As%C3%ADs',
      verifiedAt: V, lat: 37.764185, lng: -122.426812,
    },
  },
  {
    id: 'grace-cathedral',
    placeId: 'grace-cathedral',
    name: bi('慈恩堂（格雷斯大教堂）', 'Grace Cathedral'),
    zone: bi('诺布山', 'Nob Hill'),
    plaza: bi('亨廷顿公园', 'Huntington Park'),
    lat: 37.791833, lng: -122.413497,
    arrival: { x: 0, z: 10.5, heading: Math.PI },
    photo: { target: [0, 6, 2], distance: 33, elevation: 0.1, bearing: 0.25 },
    height: { realM: 75, u: 14.8, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://gracecathedral.org/',
    osm: ['way/32946942'],
    sources: [],
    bark: bi('门口的铜门是佛罗伦萨“天堂之门”的翻模，里面地上还有一个可以走的迷宫。', 'The bronze doors are casts of Florence\'s "Gates of Paradise" — and inside there\'s a labyrinth you can walk.'),
    realInfo: {
      summary: bi('法国哥特式的圣公会大教堂，1927 年动工、1964 年祝圣；钟楼高 174 英尺（53 米），中央尖塔 247 英尺（75 米）。', 'The French-Gothic Episcopal cathedral was begun in 1927 and consecrated in 1964; its towers rise 174 ft (53 m) and its central spire 247 ft (75 m).'),
      cost: bi('开放时间和参观方式以官网为准。', 'Check the official site for opening hours and visits.'),
      tips: [
        bi('室内和室外各有一座迷宫，室内那座仿照法国沙特尔大教堂。', 'There are two labyrinths — one indoors modelled on Chartres Cathedral, one in the outdoor courtyard.'),
        bi('正门铜门 1956 年用吉贝尔蒂原作的模子翻铸。', 'The front doors were cast in 1956 from molds of Ghiberti\'s originals.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Grace_Cathedral,_San_Francisco',
      verifiedAt: V, lat: 37.791833, lng: -122.413497,
    },
  },
  {
    id: 'legion-of-honor',
    placeId: 'legion-of-honor',
    name: bi('荣勋宫美术馆', 'Legion of Honor'),
    zone: bi('林肯公园 · 海角', 'Lincoln Park · Lands End'),
    plaza: bi('荣誉庭院', 'Court of Honor'),
    lat: 37.78455, lng: -122.500735,
    arrival: { x: 0, z: 9, heading: Math.PI },
    photo: { target: [0, 3, 2], distance: 27, elevation: 0.15, bearing: 0 },
    height: { realM: 20, u: 5.7, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.famsf.org/visit/legion-of-honor',
    osm: ['relation/21115818', 'node/2567140420'],
    sources: [],
    bark: bi('院子里那位托着下巴的，就是罗丹的《思想者》。', 'The man with his chin on his hand in the courtyard? Rodin\'s "The Thinker".'),
    realInfo: {
      summary: bi('1924 年 11 月 11 日开馆，按原尺寸复制了 1915 年博览会的法国馆（巴黎荣誉军团宫的 3/4 比例版）；荣誉庭院里摆着罗丹的《思想者》。', 'Opened on November 11, 1924, a full-scale copy of the French Pavilion from the 1915 Exposition (itself a 3/4-scale Palais de la Légion d\'Honneur); Rodin\'s "The Thinker" sits in the Court of Honor.'),
      cost: bi('看展要买票，价格、免费日和开放时间以官网为准。', 'Exhibitions are ticketed — check the official site for prices, free days and hours.'),
      tips: [
        bi('门口就是 Lands End 步道，可以一路走到 Sutro Baths。', 'The Lands End trail starts right outside and runs to Sutro Baths.'),
        bi('天气好时从停车场能看到金门大桥。', 'On clear days you can see the Golden Gate Bridge from the car park.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/California_Palace_of_the_Legion_of_Honor',
      verifiedAt: V, lat: 37.78455, lng: -122.500735,
    },
  },
  {
    id: 'fort-point',
    placeId: 'fort-point',
    name: bi('Fort Point 炮台', 'Fort Point'),
    zone: bi('要塞公园 · 金门大桥南端', 'Presidio · south end of the bridge'),
    lat: 37.810509, lng: -122.477104,
    arrival: { x: 0.5, z: -8, heading: 0 },
    photo: { target: [0, 4, 0], distance: 32, elevation: 0.22, bearing: 1.35 },
    height: { realM: 15, u: 5.5, rule: 'H = 3.2 + 0.155·h' },
    plannerPlaceId: 'golden-gate',
    guideSlug: 'sf-golden-gate-bridge-fort-point-guide',
    officialUrl: 'https://www.nps.gov/fopo/',
    osm: ['relation/5504536'],
    sources: ['https://en.wikipedia.org/wiki/Fort_Point,_San_Francisco'],
    bark: bi('抬头！金门大桥就在头顶——当年设计师专门加了一道拱把炮台留下来。', 'Look up! The bridge is right overhead — its engineers added an arch just to keep this fort.'),
    realInfo: {
      summary: bi('1853 年开工、1861 年装上第一门炮的砖石炮台，墙厚七英尺；金门大桥南端引桥用一道钢拱跨过它，把它完整保留下来。', 'A masonry fort begun in 1853 with its first cannon mounted in 1861, its walls seven feet thick; the bridge\'s southern approach vaults over it on a steel arch to keep it intact.'),
      hours: bi('国家公园管理局网站列出周四至周一 10:00–17:00 开放，屋顶 16:30 关闭；出发前再确认。', 'The National Park Service lists Thursday–Monday, 10am–5pm, with the roof closing at 4:30pm; confirm before you go.'),
      tips: [
        bi('BAYLINK 攻略：桥上看结构，Fort Point 看尺度，Crissy Field 看海。', 'BAYLINK guide: see the structure from the bridge, its scale from Fort Point, and the sea from Crissy Field.'),
        bi('炮台外墙每天都能走到，海风很大。', 'You can reach the outside walls any day — it is very windy.'),
      ],
      sourceUrl: 'https://www.nps.gov/fopo/planyourvisit/hours.htm',
      verifiedAt: V, lat: 37.810509, lng: -122.477104,
    },
  },
  {
    id: 'castro-theatre',
    placeId: 'castro-theatre',
    name: bi('卡斯特罗剧院', 'Castro Theatre'),
    zone: bi('卡斯特罗', 'The Castro'),
    plaza: bi('哈维·米尔克广场', 'Harvey Milk Plaza'),
    lat: 37.762, lng: -122.434748,
    arrival: { x: 0, z: 8.5, heading: Math.PI },
    photo: { target: [0, 4, 3], distance: 17, elevation: 0.1, bearing: 0.3 },
    height: { realM: 21.7, u: 6.6, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.castrotheatre.com/',
    osm: ['way/1206216224'],
    sources: [],
    bark: bi('那块竖招牌是 1937 年加上去的，晚上亮灯最好看。', 'The vertical sign was added in 1937 — it\'s best lit up at night.'),
    realInfo: {
      summary: bi('Timothy Pflueger 设计的电影宫，1922 年开幕，立面融合布杂与西班牙巴洛克风格；装饰艺术风格的招牌 1937 年加上。经过两年、约 4,100 万美元的整修，2026 年 2 月重新开放。', 'Timothy Pflueger\'s movie palace opened in 1922 with a Beaux-Arts and Spanish Baroque facade; the Art Deco marquee came in 1937. After a two-year, $41 million renovation it reopened in February 2026.'),
      cost: bi('演出和放映票价以官网为准。', 'Check the official site for show and screening tickets.'),
      tips: [
        bi('模型里的招牌故意没有字，真正的招牌写着剧院名字。', 'Our toy sign is blank on purpose — the real one spells the theatre\'s name.'),
        bi('旁边的 Harvey Milk Plaza 是 Muni 地铁 Castro 站。', 'Harvey Milk Plaza next door is the Muni Metro Castro station.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Castro_Theatre',
      verifiedAt: V, lat: 37.762, lng: -122.434748,
    },
  },
  {
    id: 'oracle-park',
    placeId: 'oracle-park',
    name: bi('甲骨文球场', 'Oracle Park'),
    zone: bi('南滩 · McCovey Cove', 'South Beach · McCovey Cove'),
    plaza: bi('威利·梅斯广场', 'Willie Mays Plaza'),
    lat: 37.778646, lng: -122.38958,
    arrival: { x: 1, z: 21.5, heading: Math.PI },
    photo: { target: [0, 5, 0], distance: 58, elevation: 0.22, bearing: 2.3 },
    height: { realM: 45, u: 10.2, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.mlb.com/giants/ballpark',
    osm: ['relation/7325085', 'way/500283910'],
    sources: [],
    bark: bi('右外野外面那片水叫 McCovey Cove，全垒打会直接“扑通”掉进海里！', 'That water past right field is McCovey Cove — home runs splash straight into the Bay!'),
    realInfo: {
      summary: bi('巨人队主场，2000 年 3 月 31 日开幕，约 41,000 个座位；右外野是面向海湾的砖墙，墙外的 McCovey Cove 已收下 110 次“水花全垒打”（截至 2026 年 8 月）。', 'Home of the Giants, opened on March 31, 2000, seating about 41,000; the brick right-field wall looks onto McCovey Cove, which had caught 110 "splash hits" by August 2026.'),
      cost: bi('比赛与参观导览票价以官网为准。', 'Check the official site for game and tour tickets.'),
      tips: [
        bi('左外野那只巨型手套是钢和玻璃钢做的老式四指手套。', 'The giant left-field mitt is a steel-and-fiberglass old-time four-fingered glove.'),
        bi('从 Ferry Building 沿 Embarcadero 海滨步道一路往南就能走到。', 'Follow the Embarcadero promenade south from the Ferry Building to walk here.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Oracle_Park',
      verifiedAt: V, lat: 37.778646, lng: -122.38958,
    },
  },
  {
    id: 'peace-pagoda',
    placeId: 'japantown-peace-pagoda',
    name: bi('日本城和平塔', 'Japantown Peace Pagoda'),
    zone: bi('日本城', 'Japantown'),
    plaza: bi('和平广场', 'Peace Plaza'),
    lat: 37.78507, lng: -122.429855,
    arrival: { x: 0, z: 4.2, heading: Math.PI },
    photo: { target: [0, 4, 0], distance: 18, elevation: 0.12, bearing: 0.3 },
    height: { realM: 30, u: 7.85, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    osm: ['way/1458363734', 'way/546510348'],
    sources: ['https://default.sfplanning.org/Preservation/peacepagoda/PeacePagodaDraftLandmarkDesignationReport_4-13-15.pdf'],
    bark: bi('五层的混凝土塔，是姐妹城市大阪送的礼物。', 'A five-tier concrete pagoda — a gift from sister city Osaka.'),
    realInfo: {
      summary: bi('姐妹城市大阪 1968 年赠送、谷口吉郎设计的五层混凝土佛塔，高约 100 英尺（30 米），立在日本中心的和平广场上。', 'A five-tiered concrete pagoda about 100 ft (30 m) tall, designed by Yoshirō Taniguchi and given by sister city Osaka in 1968; it stands on the Peace Plaza at Japan Center.'),
      cost: bi('广场免费。', 'The plaza is free.'),
      tips: [
        bi('1968 年 3 月由大阪赠送，同年 9 月 15 日落成。', 'Osaka presented it in March 1968; it was completed on September 15 that year.'),
        bi('广场两边就是日本中心商场，可以找地方吃拉面。', 'The Japan Center malls flank the plaza — good for a bowl of ramen.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/San_Francisco_Peace_Pagoda',
      verifiedAt: V, lat: 37.78507, lng: -122.429855,
    },
  },
  {
    id: 'ghirardelli-square',
    placeId: 'ghirardelli-square',
    name: bi('吉尔德利广场', 'Ghirardelli Square'),
    zone: bi('渔人码头西端', 'West end of Fisherman\'s Wharf'),
    lat: 37.805871, lng: -122.422949,
    arrival: { x: 0, z: 8.2, heading: Math.PI },
    photo: { target: [0, 5, 0], distance: 34, elevation: 0.15, bearing: 0.2 },
    height: { realM: 22, u: 6.6, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.ghirardellisq.com/',
    osm: ['way/27104863', 'way/939539785', 'way/288388853', 'way/939539794'],
    sources: [],
    bark: bi('红砖老厂房改成的广场——屋顶那块大招牌以前朝着住宅区，后来被转过来对着海。', 'An old red-brick factory turned into a square — its big rooftop sign was turned around to face the water.'),
    realInfo: {
      summary: bi('1893 年起是巧克力公司总部的红砖厂房，1964 年改造成商店和餐厅，被认为是美国第一个大型“旧建筑再利用”项目；1982 年列入国家史迹名录。', 'The red-brick block was a chocolate company\'s headquarters from 1893; converted to shops and restaurants in 1964, it is called the first major adaptive re-use project in the United States, and joined the National Register in 1982.'),
      cost: bi('进广场免费，店铺各自营业。', 'Free to wander; shops keep their own hours.'),
      tips: [
        bi('为了不打扰对面山坡的住户，景观设计师 Lawrence Halprin 让屋顶大招牌转向海边。', 'To spare the neighbours uphill, landscape architect Lawrence Halprin had the rooftop sign turned to face the waterfront.'),
        bi('往下走就是 Aquatic Park 和 Hyde St 叮当车终点站。', 'Downhill are Aquatic Park and the Hyde St cable-car turnaround.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Ghirardelli_Square',
      verifiedAt: V, lat: 37.805871, lng: -122.422949,
    },
  },
  {
    id: 'fishermans-wharf',
    placeId: 'fishermans-wharf',
    name: bi('渔人码头螃蟹舵轮牌', 'Fisherman\'s Wharf wheel sign'),
    zone: bi('渔人码头', 'Fisherman\'s Wharf'),
    lat: 37.8079, lng: -122.4159,
    arrival: { x: 0, z: 3.2, heading: Math.PI },
    photo: { target: [0, 3, 0], distance: 10, elevation: 0.06, bearing: 0 },
    height: { realM: 6, u: 4.5, rule: 'H = 3.2 + 0.155·h' },
    plannerPlaceId: 'pier39',
    guideSlug: 'sf-fishermans-wharf-pier39-guide',
    officialUrl: 'https://www.fishermanswharf.org/',
    osm: ['node/5455630121', 'node/11283438662'],
    sources: ['https://www.sfexaminer.com/news/new-fishermans-wharf-sign-a-near-replica-of-old-crab-wheel/'],
    bark: bi('舵轮中间一只大螃蟹——到渔人码头的第一张照片就在这儿拍。', 'A crab in a ship\'s wheel — the first photo everyone takes at the Wharf.'),
    realInfo: {
      summary: bi('Jefferson 街和 Taylor 街口的舵轮螃蟹招牌 1968 年首次立起，2013 年花约 11.5 万美元按原样翻新。', 'The ship\'s-wheel crab sign at Jefferson and Taylor went up in 1968 and was rebuilt close to the original in 2013 for about $115,000.'),
      cost: bi('免费。', 'Free.'),
      tips: [
        bi('BAYLINK 攻略：看海狮、走海滨，把付费项目留作选择。', 'BAYLINK guide: see the sea lions, walk the waterfront, keep the paid attractions optional.'),
        bi('冬季是邓杰内斯蟹的季节，沿街的蟹摊会更热闹。', 'Dungeness crab season (winter) makes the street-side crab stands busier.'),
      ],
      sourceUrl: 'https://www.fishermanswharf.org/about-us/faqs/',
      verifiedAt: V, lat: 37.8079, lng: -122.4159,
    },
  },
  {
    id: 'sutro-baths',
    placeId: 'sutro-baths',
    name: bi('苏特罗浴场遗址', 'Sutro Baths ruins'),
    zone: bi('海角 Lands End', 'Lands End'),
    lat: 37.780142, lng: -122.513796,
    arrival: { x: 4.6, z: -6.2, heading: 0.4 },
    photo: { target: [0, 0.5, 1], distance: 24, elevation: 0.35, bearing: Math.PI },
    height: { realM: 5, u: 2, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.nps.gov/goga/',
    osm: ['way/32776540', 'way/32776568'],
    sources: [],
    bark: bi('这里曾经是世界最大的室内泳池，现在只剩下泡在海水里的地基。', 'This was once the world\'s largest indoor swimming complex — now just its footings in the sea.'),
    realInfo: {
      summary: bi('前市长 Adolph Sutro 修建、1896 年 3 月 14 日开放，号称当时世界最大的室内泳池馆，有六个海水池和一个淡水池；1966 年拆除期间被纵火烧毁，遗址今属金门国家休闲区。', 'Built by former mayor Adolph Sutro and opened on March 14, 1896 as the world\'s largest indoor swimming establishment — six saltwater pools and one freshwater pool; it burned in 1966 during demolition, and the ruins now belong to the Golden Gate National Recreation Area.'),
      cost: bi('免费。', 'Free.'),
      tips: [
        bi('遗址边缘湿滑、浪大，别靠近水边的墙。', 'The edges are slippery and the surf is strong — keep off the seaward walls.'),
        bi('北边岩石里有一条海蚀洞隧道，涨潮时别进去。', 'A sea-cave tunnel cuts through the rocks to the north — stay out at high tide.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Sutro_Baths',
      verifiedAt: V, lat: 37.780142, lng: -122.513796,
    },
  },
  {
    id: 'cliff-house',
    placeId: 'cliff-house',
    name: bi('悬崖屋', 'Cliff House'),
    zone: bi('海角 Lands End · 海洋海滩北端', 'Lands End · north end of Ocean Beach'),
    lat: 37.778557, lng: -122.513978,
    arrival: { x: -2, z: -4.2, heading: 0 },
    photo: { target: [0, 2, 1], distance: 25, elevation: 0.12, bearing: 0.6 },
    height: { realM: 7, u: 4.3, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.nps.gov/goga/',
    osm: ['way/168942988'],
    sources: [],
    bark: bi('露台上那个像大相机的小房子，就是会“投影”外面海景的暗箱。', 'That little camera-shaped hut on the deck is a camera obscura that projects the sea view inside.'),
    realInfo: {
      summary: bi('这里的第三座悬崖屋，1909 年建成的新古典建筑（前两座都毁于火灾）；餐厅 2020 年底停业，新经营方正在修复，计划 2026 年先开街面咖啡馆、年底全部开放。', 'The third Cliff House on the site, a neo-classical building of 1909 (the first two burned); its restaurant closed at the end of 2020 and a new operator is restoring it, planning a street-level café in 2026 and the whole building by the end of the year.'),
      cost: bi('开放情况以国家公园管理局和经营方公告为准。', 'Check the National Park Service and the operator for what is open.'),
      tips: [
        bi('观景台的暗箱（Camera Obscura）仍可参观。', 'The Camera Obscura on the deck is still open to visitors.'),
        bi('往北走几分钟就是 Sutro Baths 遗址。', 'Sutro Baths ruins are a few minutes\' walk north.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Cliff_House,_San_Francisco',
      verifiedAt: V, lat: 37.778557, lng: -122.513978,
    },
  },
  {
    id: 'cable-car-turntable',
    placeId: 'cable-car-powell-market',
    name: bi('Powell & Market 叮当车转车台', 'Powell & Market cable-car turntable'),
    zone: bi('联合广场 · 市场街', 'Union Square · Market St'),
    plaza: bi('哈勒迪广场', 'Hallidie Plaza'),
    lat: 37.78477, lng: -122.40776,
    arrival: { x: 0, z: 5.6, heading: Math.PI },
    photo: { target: [0, 1, -1], distance: 15, elevation: 0.35, bearing: 0.4 },
    height: { realM: 0, u: 0.12, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.sfmta.com/getting-around/muni/cable-cars',
    osm: ['node/8641952045', 'node/1578907655'],
    sources: ['https://www.sfmta.com/getting-around/muni/fares'],
    bark: bi('看！司机和乘客会一起推着车在木转盘上掉头。', 'Watch — the crew push the car round on the wooden turntable!'),
    realInfo: {
      summary: bi('Powell-Hyde 和 Powell-Mason 两条叮当车线从这里出发，开往渔人码头一带；车在木转盘上人工掉头。', 'The Powell-Hyde and Powell-Mason cable-car lines start here and run to the Fisherman\'s Wharf area; the cars are turned by hand on the wooden turntable.'),
      cost: bi('单程成人 $9，老人/残障在早 7 点前或晚 9 点后 $4，4 岁及以下免费（以 SFMTA 公布为准）。', 'Single ride $9 for adults; $4 for seniors/disabled before 7am or after 9pm; free for 4 and under (per SFMTA).'),
      tips: [
        bi('BAYLINK 攻略：Muni-only 一日票不含叮当车，Visitor Passport 的适用范围不同，出发前先看清。', 'BAYLINK guide: the Muni-only Day Pass does not include cable cars, while the Visitor Passport differs — check before you ride.'),
        bi('在转车台（线路起终点）上车比中途站容易排到。', 'Boarding at a turntable (the ends of the line) is easier than mid-route.'),
      ],
      sourceUrl: 'https://www.sfmta.com/getting-around/muni/cable-cars',
      verifiedAt: V, lat: 37.78477, lng: -122.40776,
    },
  },
  {
    id: 'lombard-crooked-street',
    placeId: 'lombard-crooked',
    name: bi('九曲花街（伦巴底街）', 'Lombard Street (the crooked block)'),
    zone: bi('俄罗斯山', 'Russian Hill'),
    lat: 37.80212, lng: -122.418716,
    arrival: { x: 0, z: 10.6, heading: Math.PI },
    photo: { target: [0, 3.5, -1], distance: 27, elevation: 0.12, bearing: 0 },
    height: { realM: 0, u: 7.8, rule: 'terrainY' },
    guideSlug: SF_GUIDE,
    osm: ['way/402111597', 'node/4972243722'],
    sources: [],
    bark: bi('八个急弯！车子限速 5 英里，我们走两边的台阶下去。', 'Eight hairpins! Cars crawl at 5 mph — we\'ll take the stairs down the sides.'),
    realInfo: {
      summary: bi('Hyde 街到 Leavenworth 街这一段 1922 年修成八个急弯，把原本 27% 的坡度化开；弯道全长约 600 英尺（180 米），直线只有约 126 米，单行下坡。', 'The Hyde-to-Leavenworth block was built in 1922 with eight hairpin turns to tame a natural 27 % grade: about 600 ft (180 m) of switchbacks over a 126 m straight line, one-way downhill.'),
      cost: bi('步行免费；开车高峰时可能要排队 20 分钟。', 'Free on foot; at peak times cars may queue up to 20 minutes.'),
      tips: [
        bi('两侧是台阶人行道，比挤在车道上安全。', 'Use the stair sidewalks on both sides — safer than the lane.'),
        bi('Powell-Hyde 叮当车在坡顶的 Hyde & Lombard 停。', 'The Powell-Hyde cable car stops at Hyde & Lombard, at the top.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Lombard_Street_(San_Francisco)',
      verifiedAt: V, lat: 37.80212, lng: -122.418716,
    },
  },
  {
    id: 'chase-center',
    placeId: 'chase-center',
    name: bi('大通中心', 'Chase Center'),
    zone: bi('米慎湾', 'Mission Bay'),
    plaza: bi('Thrive City 广场', 'Thrive City'),
    lat: 37.767888, lng: -122.387421,
    arrival: { x: 0, z: 14, heading: Math.PI },
    photo: { target: [0, 4.5, 0], distance: 42, elevation: 0.15, bearing: 0.4 },
    height: { realM: 38.1, u: 9.1, rule: 'H = 3.2 + 0.155·h' },
    guideSlug: SF_GUIDE,
    officialUrl: 'https://www.chasecenter.com/',
    osm: ['way/579646390'],
    sources: [],
    bark: bi('勇士队和女篮女武神队的主场，门口的广场平时也可以逛。', 'Home of the Warriors and the Valkyries — the plaza outside is open to wander.'),
    realInfo: {
      summary: bi('2019 年 9 月 6 日开幕的室内球馆，篮球赛约 18,000 座，是 NBA 金州勇士队和 WNBA 金州女武神队的主场。', 'The arena opened on September 6, 2019, seats about 18,000 for basketball and is home to the NBA\'s Golden State Warriors and the WNBA\'s Golden State Valkyries.'),
      cost: bi('比赛和演出票价以官网为准。', 'Check the official site for games and concerts.'),
      tips: [
        bi('Muni T 线在门口有站。', 'The Muni T line stops right outside.'),
        bi('模型里没有任何名字和标志，只有它的白色鳍片外墙。', 'No names or logos on our model — just its white finned skin.'),
      ],
      sourceUrl: 'https://en.wikipedia.org/wiki/Chase_Center',
      verifiedAt: V, lat: 37.767888, lng: -122.387421,
    },
  },
];

const byId = new Map(SF_LANDMARK_INFO.map(i => [i.id, i]));
export function sfLandmarkInfo(id: string): SfLandmarkInfo | undefined { return byId.get(id); }
const byPlace = new Map(SF_LANDMARK_INFO.map(i => [i.placeId, i]));
/** The landmark whose places.json row is `placeId` (lane G1's place index), if any. */
export function sfLandmarkInfoByPlace(placeId: string): SfLandmarkInfo | undefined { return byPlace.get(placeId); }
