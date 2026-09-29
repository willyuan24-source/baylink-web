import { unprojectCity } from '../core/geo';
import type { Bilingual, Catalog, CatalogEvent } from '../core/types';
import { eventById, getCatalog } from '../data/catalog';

/**
 * Wave 5 · lane R (W5-R2) · where BAYLINK's San Francisco events happen in the toy city (plan §3.3 item 1).
 *
 * The table only POSITIONS catalog events (DESIGN §8: events come only from /planner-catalog.json, dates from the
 * catalog at runtime). W6-S added the autumn catalog's San Francisco venues (Thrive City, Chase Center, the Opera House,
 * Davies Symphony Hall, the Exploratorium, Arc Gallery; the Ferry Plaza market at the Ferry Building). An event's own `location` is used for "附近这周" when it has one; an event whose venue is not in
 * this table gets no pin, never a guess. Every point is a real place (OpenStreetMap, looked up 2026-09-28) projected into
 * the city frame (core/geo.ts projectCity), and stands on the published city's walking network
 * (tests/opus-bay-w5-events.test.ts).
 *
 *   eventVenue(id)       the venue row of a catalog event (by the ids listed here, else by the catalog's venue text)
 *   venueForEvent(e)     the same for an event object
 *   EVENT_VENUES         the rows
 *
 * `hours` (optional) are an organiser's verified per-day hours for one event, where the catalog's date label has none;
 * a date the table does not list is not shown in the world (the catalog still lists the event).
 */

/** music → toy stage + speakers · fair → stall tents · festival → bunting + tents · parade → bunting at the route
 *  start · street → a tall festival arch over a narrow street (a street fair where the toy street has no room for stalls;
 *  traffic passes under it) · board → a sandwich board at the door (indoor events, and downtown until lane V publishes
 *  the headroom) */
export type KitKind = 'music' | 'fair' | 'festival' | 'parade' | 'street' | 'board';

export interface EventVenue {
  id: string;
  name: Bilingual;
  /** the venue point (world units, city frame): the pennant, 带我去, eventsNear */
  x: number;
  z: number;
  /** the city place it belongs to (public/opus-bay/sf/v1/places.json), when there is one */
  placeId?: string;
  /** the catalog's venue text for this place */
  match: RegExp;
  /** catalog ids held here (the 2026-09-27 catalog); the catalog's dates always rule */
  events: readonly string[];
  kit: KitKind;
  /** where the kit stands (world units; default: the venue point) and which way it faces (rad) */
  kitAt?: { x: number; z: number; yaw: number };
  /** Ferry gate / Chinatown / FiDi / Union Square: pennant + crowd only (plan MF9, D15) */
  downtown?: boolean;
  /** per event: Bay date → [open, close] minutes after midnight (organiser pages, verified) */
  hours?: Readonly<Record<string, Readonly<Record<string, readonly [number, number]>>>>;
  /** the place's own source (OpenStreetMap) and the day it was checked */
  sourceUrl: string;
  verifiedAt: string;
  /** where the hours came from */
  hoursSource?: string;
}

const H = (h: number, m = 0) => h * 60 + m;
/** kit spots and facings: chosen so the kit and its crowd stand on open ground, clear of the streamed trees, lamps and
 *  benches (a probe over the published city, 2026-09-28) */
const deg = (d: number) => (d * Math.PI) / 180;

export const EVENT_VENUES: readonly EventVenue[] = [
  {
    id: 'hellman-hollow',
    name: { zh: '金门公园 Hellman Hollow', en: 'Hellman Hollow, Golden Gate Park' },
    x: -370.5, z: 1117.5,
    match: /Hellman Hollow|Lindley|Marx Meadow/i,
    events: ['hardly-strictly-bluegrass-2026'],
    kit: 'music',
    kitAt: { x: -366.5, z: 1117.5, yaw: deg(255) },
    // gates 11:00 on Friday, 9:00 on Saturday and Sunday; performances end at 19:00 daily
    hours: { 'hardly-strictly-bluegrass-2026': { '2026-10-02': [H(11), H(19)], '2026-10-03': [H(9), H(19)], '2026-10-04': [H(9), H(19)] } },
    hoursSource: 'https://hardlystrictlybluegrass.com/info-faq-2026/',
    sourceUrl: 'https://www.openstreetmap.org/way/417407488',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'yerba-buena-gardens',
    name: { zh: '芳草地花园大草坪', en: 'Yerba Buena Gardens · Great Lawn' },
    x: 176.9, z: 210.8,
    placeId: 'yerba-buena-gardens',
    match: /Yerba Buena Gardens/i,
    events: ['sf-african-arts-festival-2026', 'litquake-out-loud-2026', 'sf-quinteto-latino-lunchtime-2026', 'sf-ybg-dance-day-2026', 'sf-indigenous-peoples-day-2026', 'sf-halloween-hoopla-2026'],
    kit: 'festival',
    kitAt: { x: 168.9, z: 210.8, yaw: deg(105) },
    sourceUrl: 'https://www.openstreetmap.org/way/28842443',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'castro-market',
    name: { zh: '卡斯特罗街 · 18 街口', en: 'Castro St at 18th' },
    // the fair fills Market, Castro and 18th Streets (castrostreetfair.org, checked 2026-09-28). Castro & Market itself
    // carries the F-line terminal and the sightseeing loop, and the toy Castro St is ≈ 3 u of roadway between building
    // fronts: the arch spans Castro St just south of 18th (24 u from any line), the pennant stands on its east sidewalk
    x: 164.7, z: 760.1,
    match: /Castro/i,
    events: ['sf-castro-street-fair-2026'],
    kit: 'street',
    kitAt: { x: 165.5, z: 758.2, yaw: deg(231.9) },
    sourceUrl: 'https://www.openstreetmap.org/node/6376930275',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'marina-green',
    name: { zh: '码头绿地', en: 'Marina Green' },
    x: -382.1, z: 300.7,
    placeId: 'marina-green',
    match: /Marina Green/i,
    events: ['san-francisco-fleet-week-2026'],
    kit: 'festival',
    kitAt: { x: -388.1, z: 306.7, yaw: deg(0) },
    // the air show days (12:00–16:00) with the Marina Green festival centre; the week's other programmes vary
    hours: { 'san-francisco-fleet-week-2026': { '2026-10-09': [H(12), H(16)], '2026-10-10': [H(12), H(16)], '2026-10-11': [H(12), H(16)] } },
    hoursSource: 'https://fleetweeksf.org/air-show/',
    sourceUrl: 'https://www.openstreetmap.org/way/16761472',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'jefferson-powell',
    name: { zh: 'Jefferson 街 · Powell 街口', en: 'Jefferson & Powell' },
    x: -184.0, z: 51.0,
    match: /Jefferson & Powell/i,
    events: ['sf-italian-heritage-parade-2026'],
    kit: 'parade',
    kitAt: { x: -180.0, z: 51.0, yaw: deg(240) },
    sourceUrl: 'https://www.openstreetmap.org/node/6371296695',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'fishermans-wharf',
    name: { zh: '渔人码头', en: 'Fisherman’s Wharf' },
    x: -206.3, z: 84.6,
    placeId: 'fishermans-wharf',
    match: /Little Embarcadero|Fisherman/i,
    events: ['sf-fishermans-wharf-chowder-fest-2026'],
    kit: 'fair',
    kitAt: { x: -206.3, z: 92.6, yaw: deg(30) },
    sourceUrl: 'https://www.openstreetmap.org/node/11283438662',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'ferry-building',
    name: { zh: '渡轮大厦', en: 'Ferry Building' },
    x: 131.5, z: 15.1,
    placeId: 'ferry-building',
    match: /Ferry Building/i,
    // W6-S: the autumn catalog lists the Ferry Plaza market as an event (its Tue / Thu / Sat hours from the label)
    events: ['sf-world-of-dumplings-2026', 'ferry-plaza-farmers-market-2026-autumn'],
    kit: 'board',
    kitAt: { x: 131.5, z: 15.1, yaw: deg(165) },
    downtown: true,
    sourceUrl: 'https://www.openstreetmap.org/way/558731934',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'ucsf-koret-quad',
    name: { zh: 'UCSF Mission Bay · Koret Quad', en: 'UCSF Mission Bay · Koret Quad' },
    x: 440.6, z: 292.1,
    match: /UCSF|Koret/i,
    events: ['sf-bay-area-science-festival-2026'],
    kit: 'fair',
    kitAt: { x: 448.6, z: 292.1, yaw: deg(135) },
    sourceUrl: 'https://www.openstreetmap.org/way/84821725',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'main-library',
    name: { zh: '旧金山总图书馆', en: 'SF Main Library' },
    // beside the building, off the street (its centre is at 122.8, 388.6; the doors face Larkin St, a car street here)
    x: 117.1, z: 382.1,
    match: /Main Library|100 Larkin/i,
    events: ['sf-filbookfest-2026'],
    kit: 'board',
    kitAt: { x: 117.1, z: 382.1, yaw: deg(195) },
    sourceUrl: 'https://www.openstreetmap.org/way/24446086',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'roxie',
    name: { zh: 'Roxie 影院', en: 'Roxie Theater' },
    x: 225.5, z: 594.8,
    match: /Roxie/i,
    events: ['sf-apature-film-2026'],
    kit: 'board',
    kitAt: { x: 225.5, z: 594.8, yaw: deg(135) },
    sourceUrl: 'https://www.openstreetmap.org/node/2042397283',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'sunnydale-hub',
    name: { zh: 'Sunnydale · The Hub', en: 'The Hub, Sunnydale' },
    x: 863.9, z: 1115.8,
    match: /Sunnydale/i,
    events: ['sf-sunnydale-pumpkin-fest-2026'],
    kit: 'fair',
    kitAt: { x: 857.9, z: 1109.8, yaw: deg(210) },
    sourceUrl: 'https://www.openstreetmap.org/way/254299137',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'portola-family-connections',
    name: { zh: 'Portola 家庭中心', en: 'Family Connections, Portola' },
    x: 771.4, z: 822.6,
    match: /Family Connections|2565 San Bruno/i,
    events: ['sf-family-connections-halloween-2026'],
    kit: 'board',
    kitAt: { x: 771.4, z: 822.6, yaw: deg(120) },
    sourceUrl: 'https://www.openstreetmap.org/way/254299130',
    verifiedAt: '2026-09-28',
  },
  // ---- W6-S: GPT's autumn catalog (2026-09-29, 267 events). Points from OpenStreetMap (the API's way / node, read on
  // 2026-09-29), the board or kit on the published city's pavement next to it (a probe over the walking network) ----
  {
    id: 'thrive-city',
    name: { zh: '大通中心 · Thrive City 广场', en: 'Thrive City, Chase Center' },
    // the plaza around Chase Center (1 Warriors Way): its north-east corner by Terry A. Francois Blvd, where OSM names a
    // shop "at Thrive City" (node 11149187371, 37.7684244, -122.3864865); the stage on the open ground there, the crowd
    // towards the Bay (the arena itself: way 579646390)
    x: 493.4, z: 242.6,
    match: /Thrive City/i,
    events: ['sf-thrive-thrill-o-ween-2026', 'sf-thrive-football-sunday-2026'],
    kit: 'festival',
    kitAt: { x: 496.2, z: 239.8, yaw: deg(135) },
    sourceUrl: 'https://www.openstreetmap.org/node/11149187371',
    verifiedAt: '2026-09-29',
  },
  {
    id: 'chase-center',
    name: { zh: '大通中心', en: 'Chase Center' },
    // the arena (way 579646390); the board on the plaza by its box office (node 7101767044, 37.7682516, -122.3881064)
    x: 479.3, z: 264.0,
    placeId: 'chase-center',
    match: /Chase Center/i,
    events: [
      'sf-disney-worlds-collide-2026', 'sf-warriors-lakers-preseason-2026', 'sf-rod-wave-2026', 'sf-warriors-kings-preseason-2026',
      'sf-chayanne-2026', 'sf-young-miko-2026', 'sf-warriors-blazers-preseason-2026', 'sf-doja-cat-2026', 'sf-warriors-grizzlies-2026',
      'sf-phoebe-bridgers-2026',
    ],
    kit: 'board',
    kitAt: { x: 479.3, z: 264.0, yaw: deg(294) },
    sourceUrl: 'https://www.openstreetmap.org/way/579646390',
    verifiedAt: '2026-09-29',
  },
  {
    id: 'war-memorial-opera-house',
    name: { zh: '战争纪念歌剧院', en: 'War Memorial Opera House' },
    // 301 Van Ness Ave (way 32865161); the board on the pavement at its main entrance (node 10091282494, 37.7786463, -122.4203527)
    x: 89.7, z: 433.9,
    match: /War Memorial Opera House|301 Van Ness/i,
    events: ['sf-opera-mary-queen-scots-2026', 'sf-opera-manon-2026', 'sf-opera-figaro-opening-2026'],
    kit: 'board',
    kitAt: { x: 89.7, z: 433.9, yaw: deg(144) },
    sourceUrl: 'https://www.openstreetmap.org/way/32865161',
    verifiedAt: '2026-09-29',
  },
  {
    id: 'davies-symphony-hall',
    name: { zh: '戴维斯交响音乐厅', en: 'Davies Symphony Hall' },
    // 201 Van Ness Ave (way 32865746); the board by its entrance (node 7191732934, 37.7779807, -122.4211034)
    x: 91.7, z: 446.7,
    match: /Davies Symphony Hall|201 Van Ness/i,
    events: ['sf-symphony-fleming-strauss-2026', 'sf-symphony-ring-film-2026', 'sf-symphony-hisaishi-2026'],
    kit: 'board',
    kitAt: { x: 91.7, z: 446.7, yaw: deg(271) },
    sourceUrl: 'https://www.openstreetmap.org/way/32865746',
    verifiedAt: '2026-09-29',
  },
  {
    id: 'exploratorium',
    name: { zh: '探索馆（15 号码头）', en: 'Exploratorium, Pier 15' },
    x: 29.0, z: 4.3,
    placeId: 'exploratorium',
    // the museum's own events; its 18+ After Dark nights never show in the world (realsf/events.ts worldEvent)
    match: /Exploratorium/i,
    events: ['sf-exploratorium-family-science-oct24-2026'],
    kit: 'board',
    kitAt: { x: 29.0, z: 4.3, yaw: deg(90) },
    // the Embarcadero by the Ferry gate: pennant + crowd only, like the Ferry Building
    downtown: true,
    sourceUrl: 'https://www.openstreetmap.org/node/621529017',
    verifiedAt: '2026-09-29',
  },
  {
    id: 'arc-gallery',
    name: { zh: 'Arc 画廊', en: 'Arc Gallery & Studios' },
    // 1246 Folsom St (node 3789606760); the board on the pavement in front
    x: 210.2, z: 395.1,
    match: /Arc Gallery|1246 Folsom/i,
    events: ['sf-apature-literary-2026'],
    kit: 'board',
    kitAt: { x: 210.2, z: 395.1, yaw: deg(270) },
    sourceUrl: 'https://www.openstreetmap.org/node/3789606760',
    verifiedAt: '2026-09-29',
  },
];

/**
 * The event souvenirs' ids for lane E's ledger (`registerRewardIds('event', …)`: bit i of `play.g.souvenir` is id i).
 * APPEND-ONLY: never reorder or remove an id (a moved id would read another event's souvenir); add new events at the end.
 */
export const SOUVENIR_IDS: readonly string[] = [
  'hardly-strictly-bluegrass-2026', 'sf-african-arts-festival-2026', 'litquake-out-loud-2026', 'sf-castro-street-fair-2026',
  'san-francisco-fleet-week-2026', 'sf-quinteto-latino-lunchtime-2026', 'sf-italian-heritage-parade-2026', 'sf-ybg-dance-day-2026',
  'sf-indigenous-peoples-day-2026', 'sf-bay-area-science-festival-2026', 'sf-filbookfest-2026', 'sf-sunnydale-pumpkin-fest-2026',
  'sf-family-connections-halloween-2026', 'sf-fishermans-wharf-chowder-fest-2026', 'sf-world-of-dumplings-2026', 'sf-apature-film-2026',
  'sf-halloween-hoopla-2026',
  // W5-R6: the Fleet Week jets' photo (realsf/jets.ts), not a catalog id
  'fleet-week-2026-jets',
  // W6-S: the autumn catalog (2026-09-29)
  'sf-thrive-thrill-o-ween-2026', 'sf-thrive-football-sunday-2026', 'sf-disney-worlds-collide-2026', 'sf-warriors-lakers-preseason-2026',
  'sf-rod-wave-2026', 'sf-warriors-kings-preseason-2026', 'sf-chayanne-2026', 'sf-young-miko-2026', 'sf-warriors-blazers-preseason-2026',
  'sf-doja-cat-2026', 'sf-warriors-grizzlies-2026', 'sf-phoebe-bridgers-2026', 'sf-opera-mary-queen-scots-2026', 'sf-opera-manon-2026',
  'sf-opera-figaro-opening-2026', 'sf-symphony-fleming-strauss-2026', 'sf-symphony-ring-film-2026', 'sf-symphony-hisaishi-2026',
  'sf-exploratorium-family-science-oct24-2026', 'sf-apature-literary-2026', 'ferry-plaza-farmers-market-2026-autumn',
];

/** How BAYBAY names a venue in a sentence (今天<place>有…). */
export const VENUE_SAY: Readonly<Record<string, { zh: string; en: string }>> = {
  'hellman-hollow': { zh: '金门公园', en: 'Golden Gate Park' },
  'yerba-buena-gardens': { zh: '芳草地花园', en: 'Yerba Buena Gardens' },
  'castro-market': { zh: '卡斯特罗', en: 'the Castro' },
  'marina-green': { zh: '码头绿地', en: 'Marina Green' },
  'jefferson-powell': { zh: '渔人码头', en: 'Fisherman’s Wharf' },
  'fishermans-wharf': { zh: '渔人码头', en: 'Fisherman’s Wharf' },
  'ferry-building': { zh: '渡轮大厦', en: 'the Ferry Building' },
  'ucsf-koret-quad': { zh: 'UCSF 校园', en: 'UCSF Mission Bay' },
  'main-library': { zh: '总图书馆', en: 'the Main Library' },
  roxie: { zh: 'Roxie 影院', en: 'the Roxie' },
  'sunnydale-hub': { zh: 'Sunnydale', en: 'Sunnydale' },
  'portola-family-connections': { zh: 'Portola', en: 'Portola' },
  'thrive-city': { zh: '大通中心广场', en: 'Thrive City' },
  'chase-center': { zh: '大通中心', en: 'Chase Center' },
  'war-memorial-opera-house': { zh: '歌剧院', en: 'the Opera House' },
  'davies-symphony-hall': { zh: '交响音乐厅', en: 'Davies Symphony Hall' },
  exploratorium: { zh: '探索馆', en: 'the Exploratorium' },
  'arc-gallery': { zh: 'Arc 画廊', en: 'Arc Gallery' },
};

/** Short event names for BAYBAY's lines (catalog titles are long); an event missing here is named by its venue. */
export const EVENT_SAY: Readonly<Record<string, { zh: string; en: string }>> = {
  'hardly-strictly-bluegrass-2026': { zh: '蓝草音乐节', en: 'the bluegrass festival' },
  'sf-african-arts-festival-2026': { zh: '非洲艺术节', en: 'the African Arts Festival' },
  'litquake-out-loud-2026': { zh: '读书会和书市', en: 'Litquake’s book fair' },
  'sf-quinteto-latino-lunchtime-2026': { zh: '午间木管五重奏', en: 'a lunchtime wind quintet' },
  'sf-ybg-dance-day-2026': { zh: '舞蹈日', en: 'Dance Day' },
  'sf-indigenous-peoples-day-2026': { zh: '原住民日聚会', en: 'Indigenous Peoples’ Day' },
  'sf-halloween-hoopla-2026': { zh: '万圣节儿童游行', en: 'the Halloween Hoopla' },
  'sf-castro-street-fair-2026': { zh: '街区节', en: 'the Castro Street Fair' },
  'san-francisco-fleet-week-2026': { zh: '舰队周飞行表演', en: 'the Fleet Week air show' },
  'sf-italian-heritage-parade-2026': { zh: '意大利文化游行', en: 'the Italian Heritage Parade' },
  'sf-fishermans-wharf-chowder-fest-2026': { zh: '浓汤节', en: 'Chowder Fest' },
  'sf-world-of-dumplings-2026': { zh: '世界饺子节', en: 'World of Dumplings' },
  'sf-bay-area-science-festival-2026': { zh: '湾区科学节', en: 'the Science Festival' },
  'sf-filbookfest-2026': { zh: '菲律宾裔书展', en: 'FilBookFest' },
  'sf-apature-film-2026': { zh: 'APAture 电影夜', en: 'APAture film night' },
  'sf-sunnydale-pumpkin-fest-2026': { zh: '南瓜节', en: 'the Pumpkin Fest' },
  'sf-family-connections-halloween-2026': { zh: '万圣节手工和游戏', en: 'Halloween crafts and games' },
  'fleet-week-2026-jets': { zh: '舰队周飞机编队', en: 'the Fleet Week jets' },
  // W6-S
  'sf-thrive-thrill-o-ween-2026': { zh: '万圣节亲子庆典', en: 'Thrill-O-Ween' },
  'sf-thrive-football-sunday-2026': { zh: '橄榄球观赛', en: 'a football watch party' },
  'sf-disney-worlds-collide-2026': { zh: '迪士尼演唱会', en: 'the Disney concert' },
  'sf-warriors-lakers-preseason-2026': { zh: '勇士对湖人季前赛', en: 'Warriors vs Lakers' },
  'sf-rod-wave-2026': { zh: 'Rod Wave 演唱会', en: 'Rod Wave' },
  'sf-warriors-kings-preseason-2026': { zh: '勇士对国王季前赛', en: 'Warriors vs Kings' },
  'sf-chayanne-2026': { zh: 'Chayanne 演唱会', en: 'Chayanne' },
  'sf-young-miko-2026': { zh: 'Young Miko 演唱会', en: 'Young Miko' },
  'sf-warriors-blazers-preseason-2026': { zh: '勇士对开拓者季前赛', en: 'Warriors vs Trail Blazers' },
  'sf-doja-cat-2026': { zh: 'Doja Cat 演唱会', en: 'Doja Cat' },
  'sf-warriors-grizzlies-2026': { zh: '勇士对灰熊', en: 'Warriors vs Grizzlies' },
  'sf-phoebe-bridgers-2026': { zh: 'Phoebe Bridgers', en: 'Phoebe Bridgers' },
  'sf-opera-mary-queen-scots-2026': { zh: '歌剧《苏格兰女王玛丽》', en: 'the opera Mary, Queen of Scots' },
  'sf-opera-manon-2026': { zh: '歌剧《曼侬》', en: 'the opera Manon' },
  'sf-opera-figaro-opening-2026': { zh: '《费加罗的婚礼》首演', en: 'The Marriage of Figaro' },
  'sf-symphony-fleming-strauss-2026': { zh: '弗莱明唱施特劳斯', en: 'Renée Fleming singing Strauss' },
  'sf-symphony-ring-film-2026': { zh: '《午夜凶铃》电影配乐会', en: 'The Ring with a live orchestra' },
  'sf-symphony-hisaishi-2026': { zh: '久石让音乐会', en: 'Joe Hisaishi’s concert' },
  'sf-exploratorium-family-science-oct24-2026': { zh: '家庭科学日', en: 'a family science day' },
  'sf-apature-literary-2026': { zh: 'APAture 文学夜', en: 'APAture’s literary night' },
  'ferry-plaza-farmers-market-2026-autumn': { zh: '农夫市集', en: 'the farmers market' },
};

const byId = new Map(EVENT_VENUES.map(v => [v.id, v]));
export const venueById = (id: string): EventVenue | undefined => byId.get(id);

/** The venue row of an event: a row that lists its id, else (San Francisco only) a row matching its venue text. */
export function venueForEvent(event: Pick<CatalogEvent, 'id' | 'region' | 'venue'>): EventVenue | null {
  const listed = EVENT_VENUES.find(v => v.events.includes(event.id));
  if (listed) return listed;
  if (event.region !== 'sf' || !event.venue) return null;
  return EVENT_VENUES.find(v => v.match.test(event.venue!)) ?? null;
}

/** The venue of a catalog event id (null: not in San Francisco's table, or the catalog does not know the id). */
export function eventVenue(id: string, catalog: Catalog | null = getCatalog()): EventVenue | null {
  const event = eventById(catalog, id);
  if (event) return venueForEvent(event);
  return EVENT_VENUES.find(v => v.events.includes(id)) ?? null;
}

/** A venue's real coordinates (the city frame back to lat / lng; used by "附近这周"). */
export function venueLatLng(v: Pick<EventVenue, 'x' | 'z'>): { lat: number; lng: number } {
  return unprojectCity({ x: v.x, z: v.z });
}
