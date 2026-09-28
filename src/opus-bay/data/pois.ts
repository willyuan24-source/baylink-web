import type { Bilingual, PoiDef, RealInfo, Vec2 } from '../core/types';
import { byMode } from './contentMode';
import { DISTRICT } from './district';
import { CITY_PHOTO_SOURCE_PAGES, CITY_POIS, CITY_POI_EXTRA_SOURCES, CITY_POI_OFFICIAL_URLS, CITY_SUBJECT_FACTS, cityDistrictPoi } from './sf/cityPois';

/**
 * Opus Bay points of interest (content-owned).
 *
 * - Positions are never hard-coded: every POI sits on a named anchor from `DISTRICT.anchors` (DESIGN.md §11).
 *   Until the district defines an anchor, a rough fallback on the same orientation contract is used and the
 *   name is recorded in `missingAnchors` (see ?debug=1 / tests).
 * - Every real fact has a `sourceUrl` + `verifiedAt` (DESIGN.md §8). Hours and prices are phrased cautiously.
 * - `plannerPlaceId` / `guideSlug` only use ids that exist in /planner-catalog.json and /baybay-guides.json
 *   (enforced by tests/opus-bay-content.test.ts).
 * - Tips credited "BAYLINK 攻略" are taken from the linked BAYLINK guide.
 * - `landmarkId` names the DISTRICT.landmarks entry whose model also acts as a click target for the POI
 *   (game/Systems.tsx); at most one POI per landmark.
 */

export const VERIFIED_AT = '2026-09-25';

// ---------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------

/**
 * Rough fallback spots (orientation contract: promenade along x, Ferry Building east/+x, PIER 39 west/−x,
 * Bay north/−z, Telegraph Hill south/+z). Only used while the district has not defined the anchor yet.
 */
const FALLBACK_ANCHORS: Record<string, Vec2> = {
  'ferry-gate': { x: 158, z: -28 },
  'ferry-clock': { x: 150, z: -2 },
  'weekly-board': { x: 144, z: 2 },
  'farmers-market': { x: 136, z: 0 },
  'ferry-back-plaza': { x: 154, z: -30 },
  'pier14-end': { x: 178, z: -40 },
  'pier7-end': { x: 92, z: -44 },
  'exploratorium-front': { x: 60, z: -2 },
  'levis-plaza': { x: 30, z: 24 },
  'filbert-steps-bottom': { x: 16, z: 34 },
  'filbert-steps-mid': { x: 2, z: 46 },
  'coit-summit': { x: -30, z: 66 },
  'coit-view': { x: -24, z: 58 },
  'pier33-landing': { x: -60, z: -8 },
  'pier39-entrance': { x: -128, z: 0 },
  'pier39-carousel': { x: -140, z: -24 },
  'sea-lion-viewpoint': { x: -152, z: -38 },
  'streetcar-ferry': { x: 140, z: 9 },
  'streetcar-green': { x: 56, z: 9 },
  'streetcar-pier39': { x: -126, z: 9 },
  'npc-vendor': { x: 132, z: -2 },
  'npc-fisher': { x: 90, z: -48 },
  'npc-jogger-a': { x: 110, z: 4 },
  'npc-jogger-b': { x: -40, z: 4 },
  'npc-family': { x: -132, z: -8 },
  'npc-streetcar': { x: 138, z: 10 },
  'postcard-ferry-building-dawn': { x: 164, z: -22 },
  'postcard-pier7-sunset': { x: 86, z: -50 },
  'postcard-exploratorium': { x: 64, z: -12 },
  'postcard-filbert-steps': { x: 8, z: 42 },
  'postcard-coit-tower': { x: -36, z: 70 },
  'postcard-bay-bridge-night': { x: 180, z: -46 },
  'postcard-sea-lions': { x: -156, z: -34 },
  'postcard-streetcar': { x: 50, z: 8 },
};

/** Anchor names content asked for that the district has not defined yet (fallback used). */
export const missingAnchors = new Set<string>();

/** Resolve a DESIGN.md §11 anchor to a world position (copy), falling back gracefully while the district is WIP. */
export function anchorAt(name: string): Vec2 {
  const found = DISTRICT.anchors?.[name];
  if (found) return { x: found.x, z: found.z };
  missingAnchors.add(name);
  const fallback = FALLBACK_ANCHORS[name];
  return fallback ? { ...fallback } : { x: DISTRICT.spawn.x, z: DISTRICT.spawn.z };
}

// ---------------------------------------------------------------------------
// Sources & reused photos
// ---------------------------------------------------------------------------

export const SRC = {
  ferryVisit: 'https://www.ferrybuildingmarketplace.com/visit/',
  ferryAbout: 'https://www.ferrybuildingmarketplace.com/about/',
  ferryChime: 'https://www.sfgate.com/local/article/ferry-building-clock-tower-inside-tour-14801561.php',
  foodwise: 'https://foodwise.org/markets/ferry-plaza-farmers-market/visitor-info/',
  portFerryArea: 'https://www.sfport.com/files/resiliance-pdf/POOCC_Ferry_Building.pdf',
  portGettingAround: 'https://www.sfport.com/visit/getting-around',
  portParks: 'https://www.sfport.com/parks-open-spaces',
  cdfwPiers: 'https://wildlife.ca.gov/Fishing/Ocean/Piers',
  cdfwPierRules: 'https://cdfwmarine.wordpress.com/2025/02/21/public-ocean-fishing-piers-know-before-you-go/',
  exploratoriumVisit: 'https://www.exploratorium.edu/visit',
  exploratoriumHours: 'https://www.exploratorium.edu/hours',
  exploratoriumHistory: 'https://www.exploratorium.edu/about/history',
  levisPlaza: 'https://www.tclf.org/landscapes/levis-plaza',
  coitTower: 'https://sfrecpark.org/facilities/facility/details/Coit-Tower-290',
  parrotsOfficialAnimal: 'https://www.sfchronicle.com/bayarea/article/wild-parrots-official-animal-san-francisco-18172009.php',
  npsAlcatrazFees: 'https://www.nps.gov/alca/planyourvisit/fees.htm',
  alcatrazCruises: 'https://www.alcatrazcitycruises.com/',
  pier39Faq: 'https://www.pier39.com/frequently-asked-questions/',
  pier39Carousel: 'https://www.pier39.com/san-francisco-carousel/',
  pier39SeaLions: 'https://www.pier39.com/sealions/',
  sfmtaFLine: 'https://www.sfmta.com/routes/f-market-wharves',
  sfmtaFares: 'https://www.sfmta.com/getting-around/muni/fares',
  sfmtaHistoric: 'https://www.sfmta.com/getting-around/muni/historic-streetcars',
  mtcBayBridge: 'https://blog.bayareametro.gov/posts/happy-85th-bay-bridge',
} as const;

type Photo = NonNullable<RealInfo['photo']>;
/** Licensed photos the site already ships (read-only reuse, see src/data/sf-landmark-photo-assets.json). */
const PHOTOS = {
  ferryMarket: { src: '/guides/distinct/ferry-market-small.webp', credit: 'Suiren2022 / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  exploratorium: { src: '/guides/sf-map/exploratorium-small.webp', credit: 'Fabrice Florin / Wikimedia Commons (resized)', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  coit: { src: '/guides/sf-map/coit-small.webp', credit: 'Ryan Schwark / Wikimedia Commons (resized)', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en' },
  seaLions: { src: '/guides/attractions/sf-pier39-small.webp', credit: 'Jennyhjert / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  alcatraz: { src: '/guides/attractions/sf-alcatraz-small.webp', credit: '© Radomianin / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
} satisfies Record<string, Photo>;

/** Original file pages for the reused photos (RealInfo.photo has no creditUrl field). Keyed by photo src. */
export const DISTRICT_PHOTO_SOURCE_PAGES: Record<string, string> = {
  [PHOTOS.ferryMarket.src]: 'https://commons.wikimedia.org/wiki/File:Farmers_Market_at_the_Ferry_Building_20220528_-_1.jpg',
  [PHOTOS.exploratorium.src]: 'https://commons.wikimedia.org/wiki/File:San_Francisco_Exploratorium_-_South_Side.jpg',
  [PHOTOS.coit.src]: 'https://commons.wikimedia.org/wiki/File:Coit_Tower_1.jpg',
  [PHOTOS.seaLions.src]: 'https://commons.wikimedia.org/wiki/File:California,_San_Francisco,_Pier_39,_sea_lions.jpg',
  [PHOTOS.alcatraz.src]: 'https://commons.wikimedia.org/wiki/File:Alcatraz_recreation_yard,_NW_view.jpg',
};
/** Active world's photo pages (city mode adds the SF landmark photos, data/sf/cityPois.ts). */
export const PHOTO_SOURCE_PAGES: Record<string, string> = byMode(DISTRICT_PHOTO_SOURCE_PAGES, { ...DISTRICT_PHOTO_SOURCE_PAGES, ...CITY_PHOTO_SOURCE_PAGES });

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

// ---------------------------------------------------------------------------
// Shared real info
// ---------------------------------------------------------------------------

const F_LINE_INFO = (lat: number, lng: number): RealInfo => ({
  summary: bi(
    'F Market & Wharves 老式有轨电车沿 Embarcadero 连接渡轮大厦和渔人码头，车辆来自旧金山和世界各地。',
    'The F Market & Wharves historic streetcar runs along The Embarcadero between the Ferry Building and Fisherman’s Wharf, with vintage cars from San Francisco and around the world.',
  ),
  hours: bi('约每天 7:00–24:00，每 12–20 分钟一班；以 SFMTA 发布的到站信息为准。', 'Roughly 7am–midnight daily, every 12–20 minutes; check SFMTA’s arrival times.'),
  cost: bi('普通 Muni 票价：Clipper 或感应银行卡 $2.85，现金 $3；18 岁及以下免费。', 'Regular Muni fare: $2.85 with Clipper or a contactless card, $3 cash; 18 and under ride free.'),
  tips: [
    bi('海边沿线有 8 个站，这张小地图里做了其中 3 个：Ferry Building、Green St（Exploratorium 门口）、Stockton St（PIER 39）。', 'Eight Embarcadero stops; this little map has three of them: Ferry Building, Green St (by the Exploratorium) and Stockton St (PIER 39).'),
    bi('BAYLINK 攻略：每位乘客各用自己的卡或设备拍卡；MuniMobile 自 2026 年 9 月 1 日起停售新单程票。', 'BAYLINK guide: every rider taps their own card or device; MuniMobile stopped selling new single rides on Sept 1, 2026.'),
    bi('这条线上还跑着 1928 年造的米兰「Peter Witt」老电车。', 'Some cars on this line are 1928 “Peter Witt” streetcars from Milan.'),
  ],
  sourceUrl: SRC.sfmtaFLine,
  verifiedAt: VERIFIED_AT,
  lat,
  lng,
});

/** The Embarcadero itself (default zone / map panel). */
export const EMBARCADERO_INFO: RealInfo = {
  summary: bi(
    'Embarcadero 海滨步道从渔人码头一直延伸到 Oracle Park，也是湾区步道 Bay Trail 的一段。',
    'The Embarcadero Promenade stretches from Fisherman’s Wharf to Oracle Park and is part of the San Francisco Bay Trail.',
  ),
  tips: [
    bi('渡轮大厦以北是单号码头，以南是双号码头。', 'Odd-numbered piers are north of the Ferry Building, even-numbered piers are south.'),
    bi('1989 年地震后，挡在海边的双层高架路被拆除，才有了今天地面上的海滨大道。', 'After the 1989 earthquake the double-deck freeway was torn down and replaced by today’s street-level Embarcadero.'),
  ],
  cost: bi('步道免费。', 'The promenade is free.'),
  sourceUrl: SRC.portParks,
  verifiedAt: VERIFIED_AT,
  lat: 37.7995,
  lng: -122.3975,
};

// ---------------------------------------------------------------------------
// POIs (walking order along the waterfront, then the hill, then PIER 39)
// ---------------------------------------------------------------------------

export const DISTRICT_POIS: PoiDef[] = [
  {
    id: 'ferry-building',
    name: bi('渡轮大厦钟楼', 'Ferry Building clock tower'),
    position: anchorAt('ferry-clock'),
    radius: 3.5,
    landmarkId: 'ferry-building',
    guideSlug: 'sausalito-waterfront-ferry-half-day',
    interaction: { kind: 'bell', verb: bi('抬头看钟楼', 'Look up at the clock'), nodeId: 'poi.ferry-building' },
    bark: bi('钟楼整点和半点会报时，我每次都跟着数：当——当——', 'The tower chimes on the hour and half hour. I always count along: dong, dong!'),
    realInfo: {
      summary: bi(
        '1898 年启用的渡轮总站，钟楼约 245 英尺高。楼里是美食市场，楼后是去湾区各地的渡轮码头。',
        'Opened in 1898, this ferry terminal has a 245-foot clock tower, a food marketplace inside and ferry gates out back.',
      ),
      hours: bi('大楼每天 6:00–22:00，各店营业时间不同；感恩节和圣诞节休息。', 'Building open daily 6am–10pm; each business keeps its own hours. Closed Thanksgiving and Christmas.'),
      cost: bi('进楼免费，吃喝和船票另付。', 'Free to walk in; food and ferry tickets are extra.'),
      tips: [
        bi('楼后的渡轮可去 Oakland、Alameda、Vallejo、Sausalito、Larkspur、Tiburon 等地，班次以运营方为准。', 'Ferries out back serve Oakland, Alameda, Vallejo, Sausalito, Larkspur, Tiburon and more — check each operator’s schedule.'),
        bi('BAYLINK 攻略：坐 Golden Gate Ferry 去 Sausalito 就从这里出发，别导航去 Pier 41。', 'BAYLINK guide: Golden Gate Ferry to Sausalito leaves from here — don’t navigate to Pier 41.'),
        bi('楼内只允许服务犬，宠物请另作安排。', 'Only service animals are allowed inside; plan ahead for pets.'),
      ],
      sourceUrl: SRC.ferryVisit,
      verifiedAt: VERIFIED_AT,
      lat: 37.79555,
      lng: -122.39347,
    },
  },
  {
    id: 'weekly-board',
    name: bi('这周去哪 · 公告板', 'This-week board'),
    position: anchorAt('weekly-board'),
    radius: 3,
    landmarkId: 'weekly-board',
    interaction: { kind: 'board', verb: bi('看看这周去哪', 'See what’s on this week'), nodeId: 'poi.weekly-board' },
    bark: bi('公告板上贴着这周湾区的真实活动，来挑一张？', 'The board has real Bay Area events for this week. Pick a flyer?'),
  },
  {
    id: 'farmers-market',
    name: bi('Ferry Plaza 农夫市集', 'Ferry Plaza Farmers Market'),
    position: anchorAt('farmers-market'),
    radius: 4,
    landmarkId: 'farmers-market',
    guideSlug: 'bay-area-farmers-market-shopping-guide',
    interaction: { kind: 'taste', verb: bi('尝一口', 'Have a taste'), nodeId: 'poi.farmers-market' },
    bark: bi('闻到了吗？酸面包的香味！周二、四、六门外还有农夫市集。', 'Smell that sourdough? The farmers market sets up outside on Tue, Thu and Sat.'),
    realInfo: {
      summary: bi(
        'Foodwise 运营的 Ferry Plaza 农夫市集就在渡轮大厦外：当季蔬果、面包和熟食摊。',
        'Run by Foodwise, the Ferry Plaza Farmers Market sets up right outside the Ferry Building: seasonal produce, bread and prepared food.',
      ),
      hours: bi('周二、周四 10:00–14:00；周六 8:00–14:00。出发前查 Foodwise 确认。', 'Tue & Thu 10am–2pm; Sat 8am–2pm. Check Foodwise before you go.'),
      cost: bi('逛市集免费；多数摊位可刷卡或手机支付。', 'Free to browse; most sellers take cards and contactless payments.'),
      tips: [
        bi('BAYLINK 攻略：先为两顿饭列清单，再留一个尝新名额。', 'BAYLINK guide: shop for two meals, plus one thing you’ve never tried.'),
        bi('BAYLINK 攻略：先问按磅、按盒还是按把卖，确认总价再付款。', 'BAYLINK guide: ask whether it’s priced by the pound, box or bunch before you pay.'),
        bi('买多了可以用免费的 Veggie Valet 先寄存。', 'Bought too much? The free Veggie Valet can hold your bags.'),
        bi('认证市集区除服务动物外不能带宠物。', 'No pets in the certified market area, except service animals.'),
      ],
      sourceUrl: SRC.foodwise,
      verifiedAt: VERIFIED_AT,
      lat: 37.7952,
      lng: -122.394,
      photo: PHOTOS.ferryMarket,
    },
  },
  {
    id: 'pier14',
    name: bi('Pier 14', 'Pier 14'),
    position: anchorAt('pier14-end'),
    radius: 3.5,
    landmarkId: 'pier14',
    interaction: { kind: 'telescope', verb: bi('用望远镜看海湾大桥', 'Look at the Bay Bridge'), nodeId: 'poi.pier14', targets: ['bay-bridge', 'yerba-buena'] },
    bark: bi('Pier 14 的尽头看海湾大桥，视野超好！', 'The end of Pier 14 has a front-row view of the Bay Bridge!'),
    realInfo: {
      summary: bi(
        '渡轮大厦南边的公共码头，也是一道伸进海湾 600 多英尺的防波堤，替渡轮码头挡浪。',
        'A public pier just south of the Ferry Building that doubles as a 600-foot-plus breakwater, shielding the ferry terminal from waves.',
      ),
      cost: bi('免费。', 'Free.'),
      tips: [
        bi('码头上有几块讲未来海平面上升防护的科普标牌，值得停下来读读。', 'Look for the educational markers about future sea-level-rise protection.'),
        bi('渡轮大厦以南是双号码头，以北是单号码头。', 'Even-numbered piers are south of the Ferry Building, odd-numbered ones north.'),
      ],
      sourceUrl: SRC.portFerryArea,
      verifiedAt: VERIFIED_AT,
      lat: 37.79399,
      lng: -122.39061,
    },
  },
  {
    id: 'pier7',
    name: bi('Pier 7 钓鱼码头', 'Pier 7 fishing pier'),
    position: anchorAt('pier7-end'),
    radius: 3.5,
    landmarkId: 'pier7',
    interaction: { kind: 'fish', verb: bi('甩一竿', 'Cast a line'), nodeId: 'poi.pier7' },
    bark: bi('Pier 7 钓鱼不用执照，要不要甩一竿？', 'No license needed to fish off Pier 7. Want to cast a line?'),
    realInfo: {
      summary: bi(
        '一条细长的公共散步与钓鱼码头，两旁是长椅，一边看海湾，一边看城市。',
        'A long, slim public pier for strolling and fishing, lined with benches and views of both the Bay and the city.',
      ),
      cost: bi('免费。', 'Free.'),
      tips: [
        bi('在加州公共码头钓鱼不需要钓鱼执照，但尺寸、数量、季节等规定照样适用。', 'No fishing license is needed on a California public pier, but size limits, bag limits and seasons still apply.'),
        bi('每人最多用两根竿（或两套捕蟹工具）；捕蟹笼另有要求。', 'Two rods (or two crab nets or traps) per person at most; crab traps need a validation.'),
        bi('这里常有人夜里钓螃蟹，也有人钓鲨鱼和 perch。', 'People crab here mostly at night, and fish for sharks and perch.'),
      ],
      sourceUrl: SRC.cdfwPiers,
      verifiedAt: VERIFIED_AT,
      lat: 37.79944,
      lng: -122.39553,
    },
  },
  {
    id: 'exploratorium',
    name: bi('Exploratorium 探索馆', 'Exploratorium'),
    position: anchorAt('exploratorium-front'),
    radius: 4,
    landmarkId: 'exploratorium',
    interaction: { kind: 'info', verb: bi('隔窗看看', 'Peek inside'), nodeId: 'poi.exploratorium' },
    bark: bi('Exploratorium 里全是能动手玩的实验，我每次进去都出不来。', 'The Exploratorium is all hands-on experiments. I get lost in there every time.'),
    realInfo: {
      summary: bi(
        '1969 年开馆的动手玩科学馆，2013 年 4 月从艺术宫搬到 Pier 15。',
        'A hands-on science museum that opened in 1969 and moved from the Palace of Fine Arts to Pier 15 in April 2013.',
      ),
      hours: bi('周二至周六 10:00–17:00，周日 12:00–17:00，周一多数闭馆；周四 18:00–22:00 为 18+ After Dark。', 'Tue–Sat 10am–5pm, Sun noon–5pm, closed most Mondays; Thursday 6–10pm is After Dark (18+).'),
      cost: bi('成人 $39.95；4–17 岁、65+ 等 $29.95；3 岁及以下免费；After Dark $22.95。以官网为准。', 'Adults $39.95; ages 4–17, 65+ and others $29.95; 3 and under free; After Dark $22.95. Check the official site.'),
      tips: [
        bi('馆内商店从 Embarcadero 直接进，不买票也能逛。', 'The store opens onto The Embarcadero — no museum ticket needed to shop.'),
        bi('可以自带食物，在户外桌吃。', 'You can bring your own food and eat at an outdoor table.'),
        bi('持 EBT、Medi-Cal、WIC 等指定福利卡，现场购票每张 $5（最多四张）；以官网为准。', 'With EBT, Medi-Cal, WIC and similar cards, tickets are $5 each on site (up to four) — confirm on the official site.'),
      ],
      sourceUrl: SRC.exploratoriumVisit,
      verifiedAt: VERIFIED_AT,
      lat: 37.8009,
      lng: -122.39853,
      photo: PHOTOS.exploratorium,
    },
  },
  {
    id: 'levis-plaza',
    name: bi("Levi's Plaza 广场", "Levi's Plaza"),
    position: anchorAt('levis-plaza'),
    radius: 4,
    landmarkId: 'levis-plaza',
    interaction: { kind: 'info', verb: bi('坐下听听流水', 'Sit by the stream'), nodeId: 'poi.levis-plaza' },
    bark: bi("走累了？Levi's Plaza 的小溪边很适合歇歇脚。", "Tired? The stream in Levi's Plaza is a great place for a breather."),
    realInfo: {
      summary: bi(
        '景观设计师 Lawrence Halprin 设计、1982 年落成的开放广场：花岗岩喷泉、小瀑布和蜿蜒的小溪。',
        'An open plaza by landscape architect Lawrence Halprin, dedicated in 1982: a granite fountain, cascading waterfalls and a meandering stream.',
      ),
      cost: bi('免费。', 'Free.'),
      tips: [
        bi('它既是公司园区，也向社区开放，适合爬坡前歇一歇。', 'It’s a company campus that is also open to the neighborhood — a good rest stop before the climb.'),
        bi('从广场往山上走，就是 Filbert Steps。', 'Head uphill from the plaza to reach the Filbert Steps.'),
      ],
      sourceUrl: SRC.levisPlaza,
      verifiedAt: VERIFIED_AT,
      lat: 37.80284,
      lng: -122.4015,
    },
  },
  {
    id: 'filbert-steps',
    name: bi('Filbert Steps 台阶', 'Filbert Steps'),
    position: anchorAt('filbert-steps-mid'),
    radius: 3.5,
    landmarkId: 'filbert-steps',
    interaction: { kind: 'info', verb: bi('听听鹦鹉', 'Listen for parrots'), nodeId: 'poi.filbert-steps' },
    bark: bi('再爬一段就到 Coit Tower 啦。听，好像有鹦鹉！', 'A little more and we’re at Coit Tower. Listen — parrots?'),
    realInfo: {
      summary: bi(
        '沿电报山东坡而上的公共台阶，穿过 Grace Marchant Garden，是走去 Coit Tower 的风景路线。',
        'Public stairs up the eastern slope of Telegraph Hill, through the Grace Marchant Garden — the scenic way up to Coit Tower.',
      ),
      cost: bi('免费。', 'Free.'),
      tips: [
        bi('山坡上常能听到野生鹦鹉的叫声，能不能看到要看缘分。', 'You may hear the hill’s wild parrots — seeing them is down to luck.'),
        bi('台阶两旁是住家：请小声，别走进私人小路和院子。', 'People live along the steps: keep it quiet and stay off private paths and gardens.'),
        bi('台阶很陡，穿好走的鞋；不想爬可以坐 Muni 39 路到塔下。', 'The steps are steep — wear good shoes, or take Muni’s 39 Coit bus to the top.'),
      ],
      sourceUrl: SRC.coitTower,
      verifiedAt: VERIFIED_AT,
      lat: 37.80206,
      lng: -122.40394,
    },
  },
  {
    id: 'coit-tower',
    name: bi('Coit Tower 观景点', 'Coit Tower viewpoint'),
    position: anchorAt('coit-view'),
    radius: 3.5,
    landmarkId: 'coit-tower',
    guideSlug: 'sf-chinatown-north-beach-walk-guide',
    interaction: { kind: 'viewpoint', verb: bi('眺望海湾', 'Take in the view'), nodeId: 'poi.coit-tower' },
    bark: bi('山顶观景点能看到整个海湾，快去看看！', 'The hilltop viewpoint shows off the whole Bay. Go look!'),
    realInfo: {
      summary: bi(
        '1933 年建成的白色高塔，立在电报山顶；塔底有 1934 年的壁画，坐电梯可到 360 度观景台。',
        'A white tower atop Telegraph Hill, finished in 1933, with 1934 murals at its base and an elevator up to a 360-degree observation deck.',
      ),
      hours: bi('每天 10:00–18:00（4–10 月），10:00–17:00（11–3 月）；感恩节、圣诞、元旦闭馆。', 'Daily 10am–6pm (Apr–Oct), 10am–5pm (Nov–Mar); closed Thanksgiving, Christmas and New Year’s Day.'),
      cost: bi('电梯：非旧金山居民成人 $11，居民 $8；长者、青少年、儿童有优惠，4 岁以下免费。', 'Elevator: adults $11 (non-residents) or $8 (SF residents); discounts for seniors, youth and kids; under 4 free.'),
      tips: [
        bi('近 90 年的老电梯偶尔停用，那时要爬 13 层楼梯到观景层。', 'The nearly 90-year-old elevator is sometimes out; then it’s 13 flights of stairs to the top.'),
        bi('山顶停车位很少，建议走 Filbert Steps，或坐 Muni 39 路。', 'Parking up top is very limited — walk the Filbert Steps or take Muni’s 39 Coit.'),
        bi('BAYLINK 的唐人街 → North Beach 步行攻略在山脚的 Washington Square 收尾，可以顺路连起来。', 'BAYLINK’s Chinatown → North Beach walk ends at Washington Square at the foot of the hill — easy to combine.'),
      ],
      sourceUrl: SRC.coitTower,
      verifiedAt: VERIFIED_AT,
      lat: 37.80238,
      lng: -122.40583,
      photo: PHOTOS.coit,
    },
  },
  {
    id: 'coit-murals',
    name: bi('Coit Tower 壁画', 'Coit Tower murals'),
    position: anchorAt('coit-summit'),
    radius: 3,
    interaction: { kind: 'info', verb: bi('看看壁画', 'See the murals'), nodeId: 'poi.coit-murals' },
    bark: bi('塔底的壁画画的是 1930 年代的加州生活，值得进去看看。', 'The murals inside show 1930s California life. Worth a look.'),
    realInfo: {
      summary: bi(
        '塔底壁画由一群受「公共艺术工程」（PWAP）资助的艺术家在 1934 年完成，描绘大萧条时期的加州生活。',
        'The murals in the tower’s base were painted in 1934 by artists of the Public Works of Art Project and depict California life during the Depression.',
      ),
      hours: bi('随塔开放：每天 10:00 起，4–10 月到 18:00，11–3 月到 17:00。', 'Same as the tower: daily from 10am, until 6pm (Apr–Oct) or 5pm (Nov–Mar).'),
      cost: bi('壁画导览：完整导览每人 $10，只看二楼 $5；电梯票另买。', 'Mural tours: $10 for the full tour, $5 for the second floor only; elevator tickets are separate.'),
      tips: [
        bi('导览面向 4–6 人的小团，约 30–40 分钟，在塔里买票。', 'Docent tours are for groups of 4–6 and take about 30–40 minutes; buy tickets at the tower.'),
        bi('官方特别说明：Coit Tower 不是照着消防水枪喷嘴设计的。', 'Officially: Coit Tower was not designed to look like a fire hose nozzle.'),
      ],
      sourceUrl: SRC.coitTower,
      verifiedAt: VERIFIED_AT,
      lat: 37.80238,
      lng: -122.40583,
    },
  },
  {
    id: 'pier33',
    name: bi('Pier 33 恶魔岛码头', 'Pier 33 · Alcatraz Landing'),
    position: anchorAt('pier33-landing'),
    radius: 3.5,
    landmarkId: 'pier33',
    plannerPlaceId: 'alcatraz',
    guideSlug: 'sf-alcatraz-booking-day-guide',
    interaction: { kind: 'telescope', verb: bi('用望远镜看恶魔岛', 'Look at Alcatraz'), nodeId: 'poi.pier33', targets: ['alcatraz', 'angel-island'] },
    bark: bi('去恶魔岛的船从 Pier 33 开，不是 PIER 39 哦。', 'Boats to Alcatraz leave from Pier 33 — not PIER 39!'),
    realInfo: {
      summary: bi(
        '去恶魔岛的渡轮从 Pier 33 Alcatraz Landing 出发；Alcatraz City Cruises 是 NPS 唯一授权的登岛渡轮。',
        'Ferries to Alcatraz leave from Pier 33 Alcatraz Landing; Alcatraz City Cruises is the only NPS-authorized ferry to the island.',
      ),
      cost: bi('NPS 不收入岛门票，但必须买渡轮票（含往返船和牢房语音导览）。', 'No NPS entrance fee, but you need a ferry ticket (round trip plus the cellhouse audio tour).'),
      hours: bi('按船票上的班次；NPS 强烈建议提前订票。', 'Follow the sailing on your ticket; the NPS strongly recommends booking ahead.'),
      tips: [
        bi('BAYLINK 攻略：只写「绕行恶魔岛」的观光船不等于登岛票。', 'BAYLINK guide: a cruise that only circles the island is not a landing ticket.'),
        bi('BAYLINK 攻略：按票面时间提前到 Pier 33，别去 PIER 39 排队。', 'BAYLINK guide: arrive at Pier 33 as your ticket says — don’t queue at PIER 39.'),
        bi('BAYLINK 攻略：岛上码头到监狱约 0.4 公里、爬升约 40 米，穿好走的鞋。', 'BAYLINK guide: it’s about 0.4 km and 40 m uphill from the island dock to the prison — wear good shoes.'),
      ],
      sourceUrl: SRC.npsAlcatrazFees,
      verifiedAt: VERIFIED_AT,
      lat: 37.80767,
      lng: -122.404663,
      photo: PHOTOS.alcatraz,
    },
  },
  {
    id: 'pier39-carousel',
    name: bi('PIER 39 旋转木马', 'PIER 39 carousel'),
    position: anchorAt('pier39-carousel'),
    radius: 4,
    landmarkId: 'pier39-carousel',
    plannerPlaceId: 'pier39',
    guideSlug: 'sf-fishermans-wharf-pier39-guide',
    interaction: { kind: 'info', verb: bi('看旋转木马', 'Watch the carousel'), nodeId: 'poi.pier39-carousel' },
    bark: bi('双层旋转木马！上面还画着海狮呢。', 'A double-decker carousel — with sea lions painted on it!'),
    realInfo: {
      summary: bi(
        'PIER 39 尽头的双层旋转木马，在意大利手工制作，手绘金门大桥、Coit Tower、恶魔岛和海狮等旧金山地标。',
        'A double-decker carousel at the end of PIER 39, handcrafted in Italy and hand-painted with the Golden Gate, Coit Tower, Alcatraz, sea lions and more.',
      ),
      hours: bi('约 10:00–20:00，恶劣天气可能停运；以现场为准。', 'About 10am–8pm; may stop in bad weather. Check on site.'),
      cost: bi('PIER 39 不收门票；木马每位骑乘者都要买票，2 岁及以下免费但须由买票的成人陪同。', 'PIER 39 has no admission; every carousel rider needs a ticket; kids 2 and under ride free with a paying adult.'),
      tips: [
        bi('身高不到 43 英寸的小朋友要由买票的成人陪乘。', 'Riders under 43 inches must ride with a paying adult.'),
        bi('BAYLINK 攻略：PIER 39 是渔人码头的一部分，也不是去恶魔岛的 Pier 33。', 'BAYLINK guide: PIER 39 is one part of Fisherman’s Wharf — and not Pier 33, where the Alcatraz boats leave.'),
        bi('BAYLINK 攻略：给小朋友约好走散后的集合点。', 'BAYLINK guide: agree on a meeting spot with kids in case you get separated.'),
      ],
      sourceUrl: SRC.pier39Carousel,
      verifiedAt: VERIFIED_AT,
      lat: 37.8098,
      lng: -122.4101,
    },
  },
  {
    id: 'sea-lions',
    name: bi('PIER 39 海狮观景处', 'PIER 39 sea lions'),
    position: anchorAt('sea-lion-viewpoint'),
    radius: 4,
    landmarkId: 'sea-lion-docks',
    plannerPlaceId: 'pier39',
    guideSlug: 'sf-fishermans-wharf-pier39-guide',
    interaction: { kind: 'photo', verb: bi('给海狮拍照', 'Photograph the sea lions'), nodeId: 'poi.sea-lions', targets: ['sea-lion-docks'] },
    bark: bi('听到「嗷嗷」声没？海狮就在前面！', 'Hear that barking? The sea lions are just ahead!'),
    realInfo: {
      summary: bi(
        '1989 年 Loma Prieta 地震后不久，加州海狮开始爬上 PIER 39 的 K-Dock 浮台，从此在这里安了家。',
        'Soon after the 1989 Loma Prieta earthquake, California sea lions began hauling out on PIER 39’s K-Dock — and they never really left.',
      ),
      cost: bi('观看免费：PIER 39 不收门票。', 'Free to watch — PIER 39 has no admission fee.'),
      tips: [
        bi('数量随季节、食物和迁徙变化；2024 年 5–6 月曾创下 2,100 多只的纪录。', 'Numbers change with seasons, food and migration; the record is over 2,100 in May–June 2024.'),
        bi('海狮受《海洋哺乳动物保护法》保护：不喂、不碰、不骚扰。', 'Sea lions are protected by the Marine Mammal Protection Act: no feeding, handling or harassing.'),
        bi('BAYLINK 攻略：在公共观景处看，别靠近浮台，也别学叫声逗它们。', 'BAYLINK guide: watch from the public viewing area, keep off the floats and don’t bark back at them.'),
      ],
      sourceUrl: SRC.pier39SeaLions,
      verifiedAt: VERIFIED_AT,
      lat: 37.8101,
      lng: -122.4107,
      photo: PHOTOS.seaLions,
    },
  },
  {
    id: 'streetcar-ferry',
    name: bi('F 线 · 渡轮大厦站', 'F-line · Ferry Building stop'),
    position: anchorAt('streetcar-ferry'),
    radius: 3,
    guideSlug: 'bay-area-october-muni-clipper-payment-update-2026',
    interaction: { kind: 'streetcar', verb: bi('上电车', 'Board the streetcar'), nodeId: 'poi.streetcar', refId: 'ferry' },
    bark: bi('叮叮！F 线老电车来了，要不要坐一段？', 'Ding ding! The F-line is here. Hop on for a stretch?'),
    realInfo: F_LINE_INFO(37.7947, -122.3943),
  },
  {
    id: 'streetcar-green',
    name: bi('F 线 · Green St 站', 'F-line · Green St stop'),
    position: anchorAt('streetcar-green'),
    radius: 3,
    guideSlug: 'bay-area-october-muni-clipper-payment-update-2026',
    interaction: { kind: 'streetcar', verb: bi('上电车', 'Board the streetcar'), nodeId: 'poi.streetcar', refId: 'green' },
    bark: bi('这一站就在 Exploratorium 门口，坐电车很方便。', 'This stop is right by the Exploratorium — handy!'),
    realInfo: F_LINE_INFO(37.8013, -122.3985),
  },
  {
    id: 'streetcar-pier39',
    name: bi('F 线 · PIER 39 站', 'F-line · PIER 39 stop'),
    position: anchorAt('streetcar-pier39'),
    radius: 3,
    guideSlug: 'bay-area-october-muni-clipper-payment-update-2026',
    interaction: { kind: 'streetcar', verb: bi('上电车', 'Board the streetcar'), nodeId: 'poi.streetcar', refId: 'pier39' },
    bark: bi('走累了？坐 F 线电车沿海边回渡轮大厦吧。', 'Tired? Ride the F-line back along the water to the Ferry Building.'),
    realInfo: F_LINE_INFO(37.8081, -122.4097),
  },
];

/**
 * The district's POIs as the city shows them (wave 5, CP-14: the same ids, spots and facts; the zh names and card text
 * in the city's words — 科伊特塔壁画, not Coit Tower 壁画; data/sf/cityPois.ts cityDistrictPoi).
 */
export const CITY_DISTRICT_POIS: PoiDef[] = DISTRICT_POIS.map(cityDistrictPoi);

/**
 * The active world's POIs (plan G2-0): the district's in district mode (v1, unchanged); in city mode the district's
 * (the hero waterfront is part of the city, named the city's way) plus the 24 SF landmark cards (data/sf/cityPois.ts,
 * ids `sf:<landmarkId>`).
 */
export const POIS: PoiDef[] = byMode(DISTRICT_POIS, [...CITY_DISTRICT_POIS, ...CITY_POIS]);

/**
 * The places' own official sites (shown as 官网). Only real official homes — a fact-check source (a Port PDF, the
 * CDFW pier list, a landscape archive) is never labelled 官网. POIs without an entry simply have no 官网 button.
 */
export const DISTRICT_POI_OFFICIAL_URLS: Record<string, string> = {
  'ferry-building': 'https://www.ferrybuildingmarketplace.com/',
  'farmers-market': 'https://foodwise.org/markets/ferry-plaza-farmers-market/',
  exploratorium: 'https://www.exploratorium.edu/',
  'coit-tower': SRC.coitTower,
  'coit-murals': SRC.coitTower,
  pier33: 'https://www.nps.gov/alca/',
  'pier39-carousel': 'https://www.pier39.com/',
  'sea-lions': 'https://www.pier39.com/',
  'streetcar-ferry': SRC.sfmtaFLine,
  'streetcar-green': SRC.sfmtaFLine,
  'streetcar-pier39': SRC.sfmtaFLine,
};
export const POI_OFFICIAL_URLS: Record<string, string> = byMode(DISTRICT_POI_OFFICIAL_URLS, { ...DISTRICT_POI_OFFICIAL_URLS, ...CITY_POI_OFFICIAL_URLS });

/** Secondary sources behind a POI's summary/tips (the primary one is realInfo.sourceUrl). */
export const DISTRICT_POI_EXTRA_SOURCES: Record<string, string[]> = {
  'ferry-building': [SRC.ferryAbout, SRC.ferryChime, SRC.portGettingAround],
  'farmers-market': [SRC.ferryVisit],
  pier14: [SRC.portGettingAround, SRC.mtcBayBridge],
  pier7: [SRC.cdfwPierRules, SRC.portFerryArea],
  exploratorium: [SRC.exploratoriumHours, SRC.exploratoriumHistory, 'https://www.exploratorium.edu/visit/faq'],
  'filbert-steps': [SRC.parrotsOfficialAnimal],
  'pier33': [SRC.alcatrazCruises],
  'pier39-carousel': [SRC.pier39Faq],
  'sea-lions': [SRC.pier39Faq],
  'streetcar-ferry': [SRC.sfmtaFares, SRC.sfmtaHistoric],
  'streetcar-green': [SRC.sfmtaFares, SRC.sfmtaHistoric],
  'streetcar-pier39': [SRC.sfmtaFares, SRC.sfmtaHistoric],
};
export const POI_EXTRA_SOURCES: Record<string, string[]> = byMode(DISTRICT_POI_EXTRA_SOURCES, { ...DISTRICT_POI_EXTRA_SOURCES, ...CITY_POI_EXTRA_SOURCES });

export const POI_BY_ID: Record<string, PoiDef> = Object.fromEntries(POIS.map(poi => [poi.id, poi]));
export const getPoi = (id: string | null | undefined): PoiDef | undefined => (id ? POI_BY_ID[id] : undefined);

/** Every anchor name content positions things on (tested against DESIGN.md §11). */
export const CONTENT_POI_ANCHORS = [
  'ferry-clock', 'weekly-board', 'farmers-market', 'pier14-end', 'pier7-end', 'exploratorium-front', 'levis-plaza',
  'filbert-steps-mid', 'coit-view', 'coit-summit', 'pier33-landing', 'pier39-carousel', 'sea-lion-viewpoint',
  'streetcar-ferry', 'streetcar-green', 'streetcar-pier39',
] as const;

// ---------------------------------------------------------------------------
// Telescope / photo subjects: a verified one-liner per subject for captions and cards.
// Keys match InteractionDef.targets and district backdrop/landmark kinds.
// ---------------------------------------------------------------------------

export interface SubjectFact {
  name: Bilingual;
  fact: Bilingual;
  sourceUrl: string;
  verifiedAt: string;
}

export const DISTRICT_SUBJECT_FACTS: Record<string, SubjectFact> = {
  'bay-bridge': {
    name: bi('海湾大桥', 'Bay Bridge'),
    fact: bi('1936 年 11 月 12 日通车，比金门大桥早半年。', 'Opened on Nov 12, 1936 — six months before the Golden Gate Bridge.'),
    sourceUrl: SRC.mtcBayBridge,
    verifiedAt: VERIFIED_AT,
  },
  alcatraz: {
    name: bi('恶魔岛', 'Alcatraz'),
    fact: bi('公园不收入岛门票，但登岛只能坐 NPS 授权的 Alcatraz City Cruises。', 'No park entrance fee, but the only way on is Alcatraz City Cruises, the NPS-authorized ferry.'),
    sourceUrl: SRC.npsAlcatrazFees,
    verifiedAt: VERIFIED_AT,
  },
  'sea-lion-docks': {
    name: bi('PIER 39 海狮', 'PIER 39 sea lions'),
    fact: bi('海狮有外耳廓，海豹没有——这是分辨它们的小窍门。PIER 39 的海狮大多是雄性。', 'Sea lions have external ear flaps; seals don’t. Most of the PIER 39 sea lions are male.'),
    sourceUrl: SRC.pier39SeaLions,
    verifiedAt: VERIFIED_AT,
  },
  'coit-tower': {
    name: bi('Coit Tower', 'Coit Tower'),
    fact: bi('电报山得名于 1850 年山顶的旗语电报站，用来通报进港的船。', 'Telegraph Hill is named for an 1850 semaphore telegraph on its summit that announced arriving ships.'),
    sourceUrl: SRC.coitTower,
    verifiedAt: VERIFIED_AT,
  },
  'ferry-building': {
    name: bi('渡轮大厦', 'Ferry Building'),
    fact: bi('1898 年 7 月 13 日开张，钟楼约 245 英尺高。', 'Opened July 13, 1898; the clock tower is 245 feet tall.'),
    sourceUrl: SRC.ferryAbout,
    verifiedAt: VERIFIED_AT,
  },
};
/** Active world's subject facts: city mode adds a caption per SF landmark (keyed by landmark id). */
export const SUBJECT_FACTS: Record<string, SubjectFact> = byMode(DISTRICT_SUBJECT_FACTS, { ...DISTRICT_SUBJECT_FACTS, ...CITY_SUBJECT_FACTS });

// ---------------------------------------------------------------------------
// Farmers market days (the world shows stalls only on these days)
// ---------------------------------------------------------------------------

/** Day-of-week numbers (0 = Sunday) of the Ferry Plaza Farmers Market, per Foodwise. */
export const FARMERS_MARKET_DAYS = [2, 4, 6] as const;

/** True if `date` is a Ferry Plaza Farmers Market day in San Francisco (America/Los_Angeles). */
export function isFarmersMarketDay(date: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }).format(date);
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return (FARMERS_MARKET_DAYS as readonly number[]).includes(index);
}
