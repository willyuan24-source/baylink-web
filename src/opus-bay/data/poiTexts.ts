import type { Bilingual, RealInfo } from '../core/types';

/**
 * W7-P2 · the district POI cards' texts (lane P, sf-w6-P.md Request 2: GameRoot ≤ 265 KB gzip).
 *
 * The summary, hours, cost and tips of the waterfront's cards (data/pois.ts DISTRICT_POIS, ≈ 7 KB gzip) are read only
 * by the card's body (ui/PoiCardBody.tsx, a lazy chunk), so they live here and come with it: the body's module fills
 * the POIs' `realInfo` in place (data/pois.ts `fillPoiTexts`) before it renders — in the district as the district wrote
 * them, in the city in the city's words (data/sf/cityPois cityDistrictZh), exactly as before. Node (tests, scripts)
 * fills them when data/pois.ts loads. Sources and dates stay with each POI in data/pois.ts (`sourceUrl`, `verifiedAt`).
 * Keyed by POI id; an id here must be a DISTRICT_POIS entry with a `realInfo` (tests/opus-bay-w7-p.test.ts).
 */
export type PoiText = Pick<RealInfo, 'summary' | 'tips' | 'hours' | 'cost'>;

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

const F_LINE: PoiText = {
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
};

export const DISTRICT_POI_TEXTS: Readonly<Record<string, PoiText>> = {
  'ferry-building': {
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
  },
  'farmers-market': {
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
  },
  'pier14': {
    summary: bi(
      '渡轮大厦南边的公共码头，也是一道伸进海湾 600 多英尺的防波堤，替渡轮码头挡浪。',
      'A public pier just south of the Ferry Building that doubles as a 600-foot-plus breakwater, shielding the ferry terminal from waves.',
    ),
    cost: bi('免费。', 'Free.'),
    tips: [
      bi('码头上有几块讲未来海平面上升防护的科普标牌，值得停下来读读。', 'Look for the educational markers about future sea-level-rise protection.'),
      bi('渡轮大厦以南是双号码头，以北是单号码头。', 'Even-numbered piers are south of the Ferry Building, odd-numbered ones north.'),
    ],
  },
  'pier7': {
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
  },
  'exploratorium': {
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
  },
  'levis-plaza': {
    summary: bi(
      '景观设计师 Lawrence Halprin 设计、1982 年落成的开放广场：花岗岩喷泉、小瀑布和蜿蜒的小溪。',
      'An open plaza by landscape architect Lawrence Halprin, dedicated in 1982: a granite fountain, cascading waterfalls and a meandering stream.',
    ),
    cost: bi('免费。', 'Free.'),
    tips: [
      bi('它既是公司园区，也向社区开放，适合爬坡前歇一歇。', 'It’s a company campus that is also open to the neighborhood — a good rest stop before the climb.'),
      bi('从广场往山上走，就是 Filbert Steps。', 'Head uphill from the plaza to reach the Filbert Steps.'),
    ],
  },
  'filbert-steps': {
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
  },
  'coit-tower': {
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
  },
  'coit-murals': {
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
  },
  'pier33': {
    summary: bi(
      '去恶魔岛的渡轮从 Pier 33 Alcatraz Landing 出发；Alcatraz City Cruises 是 NPS 唯一授权的登岛渡轮。',
      'Ferries to Alcatraz leave from Pier 33 Alcatraz Landing; Alcatraz City Cruises is the only NPS-authorized ferry to the island.',
    ),
    hours: bi('按船票上的班次；NPS 强烈建议提前订票。', 'Follow the sailing on your ticket; the NPS strongly recommends booking ahead.'),
    cost: bi('NPS 不收入岛门票，但必须买渡轮票（含往返船和牢房语音导览）。', 'No NPS entrance fee, but you need a ferry ticket (round trip plus the cellhouse audio tour).'),
    tips: [
      bi('BAYLINK 攻略：只写「绕行恶魔岛」的观光船不等于登岛票。', 'BAYLINK guide: a cruise that only circles the island is not a landing ticket.'),
      bi('BAYLINK 攻略：按票面时间提前到 Pier 33，别去 PIER 39 排队。', 'BAYLINK guide: arrive at Pier 33 as your ticket says — don’t queue at PIER 39.'),
      bi('BAYLINK 攻略：岛上码头到监狱约 0.4 公里、爬升约 40 米，穿好走的鞋。', 'BAYLINK guide: it’s about 0.4 km and 40 m uphill from the island dock to the prison — wear good shoes.'),
    ],
  },
  'pier39-carousel': {
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
  },
  'sea-lions': {
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
  },
  'streetcar-ferry': F_LINE,
  'streetcar-green': F_LINE,
  'streetcar-pier39': F_LINE,
};
