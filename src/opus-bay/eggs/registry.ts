import type { Bilingual } from '../core/types';

/**
 * Wave 5 · lane D (W5-D1) · the registry of the real San Francisco easter eggs (小发现): batch 1 of plan sf-w5-plan.md
 * §3.1 (24) and (part c, W5-D6) nine of batch 2 (25–33). Pure data and helpers, no game imports: lane E's notebook
 * (the 小发现 page, the `egg` bitset) and lane C's rumours read it; lane D's hosts (eggs/hosts.ts and the area modules) play them.
 *
 * APPEND-ONLY. `ALL_EGG_IDS[i]` is bit `i` of the save's `play.g.egg` bitset (data/playSave.ts): an egg's index never
 * moves; a later batch appends (batch 1 = `EGGS` / `EGG_IDS`, bits 0–23; batch 2 = `EGGS_BATCH_2`, bits 24–32). The reward source of an egg is `egg:<id>` (core/events.ts REWARD_SOURCE), paid once, 10 金币.
 *
 * Every fact a line or a card states was checked on the web on `verifiedAt` (the page is `sources[].url`); wording
 * follows data/VOICE.md (≤ 45 characters a bubble, 据说 / 通常 where the source hedges, wildlife never guaranteed,
 * never feed, respectful at Alcatraz and with colonial history, Emperor Norton affectionate). Nothing here quotes a
 * real letter, a film, a mural or a brand: the proclamation, the 1861 note and the fortunes are our own words.
 */

/** The eight areas of plan MF8 ("something to do everywhere"): the notebook groups the finds by them. */
export const EGG_AREAS = ['north-beach', 'wharf', 'downtown', 'marina-presidio', 'golden-gate-park', 'west-coast', 'mission-castro', 'south'] as const;
export type EggArea = (typeof EGG_AREAS)[number];

export const EGG_AREA_NAMES: Readonly<Record<EggArea, Bilingual>> = {
  'north-beach': { zh: '北滩 · 电报山', en: 'North Beach & Telegraph Hill' },
  wharf: { zh: '渔人码头 · 海湾', en: 'The Wharf & the Bay' },
  downtown: { zh: '唐人街 · 市中心', en: 'Chinatown & downtown' },
  'marina-presidio': { zh: '马里纳区 · 要塞', en: 'The Marina & the Presidio' },
  'golden-gate-park': { zh: '金门公园 · 日落区', en: 'Golden Gate Park & the Sunset' },
  'west-coast': { zh: '西海岸', en: 'The west coast' },
  'mission-castro': { zh: '教会区 · 卡斯特罗 · 双峰', en: 'The Mission, the Castro & Twin Peaks' },
  south: { zh: '城南 · 湾景', en: 'The south & Bayview' },
};

/** A fact's page and the day it was read (Bay date). `note` says what the page backs when it backs only part. */
export interface EggSource { url: string; verifiedAt: string; note?: string }

/**
 * Where the egg happens (city frame, u): `ground` = a standable spot the player walks to (the sweep checks it);
 * `water` = over the water (seen from a deck, a ferry or the pelican); `air` = the centre of something flown round.
 */
export type EggSpotKind = 'ground' | 'water' | 'air';

export interface EggDef {
  /** append-only id (the reward source is `egg:<id>`) */
  id: string;
  /** 1-based number in the plan's table (the notebook's order) */
  n: number;
  area: EggArea;
  /** the notebook title and the fact card's heading */
  name: Bilingual;
  /** the notebook's silhouette caption before it is found (≤ 20 characters in zh) */
  riddle: Bilingual;
  /** a resident's or BAYBAY's 听说… about it while it is unfound (≤ 45 in zh; lane C's rumour source) */
  rumour: Bilingual;
  /** the host spot (city frame) and its kind; `also` = other spots of the same egg (the second cookie, the three 1776 stops) */
  at: { x: number; z: number };
  kind: EggSpotKind;
  also?: readonly { x: number; z: number }[];
  /** true until the spot is snapped from OpenStreetMap / the published city (part b eggs; the sweep lists them) */
  approx?: boolean;
  /** what makes it happen, in the player's words (the notebook's hint once a rumour was heard) */
  how: Bilingual;
  /** BAYBAY's lines at the reveal (each ≤ 45 in zh), in order */
  lines: readonly Bilingual[];
  /** the fact card's text (zh ≤ 64, en ≤ 170) */
  fact: Bilingual;
  sources: readonly EggSource[];
  /** the stamp's label on the 小发现 page */
  stamp: Bilingual;
}

/** Coins an egg pays the first time (the ledger may clamp to its own table). */
export const EGG_COINS = 10;
/** The day the batch-1 facts were read on the web (Bay date). */
export const EGGS_VERIFIED_AT = '2026-09-28';

const V = EGGS_VERIFIED_AT;
const src = (url: string, note?: string): EggSource => (note ? { url, verifiedAt: V, note } : { url, verifiedAt: V });

export const EGGS: readonly EggDef[] = [
  // --- 1–12: the north and the waterfront (W5-D3) -----------------------------------------------------------------
  {
    id: 'telegraph-hill-parrots', n: 1, area: 'north-beach',
    name: { zh: '电报山的野鹦鹉', en: 'The wild parrots' },
    riddle: { zh: '台阶花园里，谁穿绿衣戴红帽？', en: 'Who wears green and a red cap in the stair gardens?' },
    rumour: { zh: '听说电报山台阶的花园里，早上常有一群吵吵闹闹的绿鹦鹉。', en: 'They say a noisy green flock visits the Telegraph Hill stair gardens in the mornings.' },
    at: { x: -30.5, z: 37.7 }, kind: 'ground',
    how: { zh: '早上或傍晚，在台阶花园里站着别动', en: 'Stand still in the stair gardens, morning or late afternoon' },
    lines: [
      { zh: '看！红脸蛋的小绿鹦鹉！2023 年它们成了旧金山的官方动物。', en: 'Look — red-faced green parrots! In 2023 they became San Francisco’s official animal.' },
      { zh: '它们是野生的，看看就好，别喂哦。', en: 'They’re wild — just watch, no feeding.' },
    ],
    fact: {
      zh: '这群野生锥尾鹦鹉满城飞，常在渡轮大厦旁的公园筑巢。2023 年市议会把它们定为旧金山官方动物。',
      en: 'The wild conures range across the city and often nest in the park by the Ferry Building. In 2023 the Board of Supervisors named them San Francisco’s official animal.',
    },
    sources: [src('https://en.wikipedia.org/wiki/The_Wild_Parrots_of_Telegraph_Hill')],
    stamp: { zh: '鹦鹉羽毛', en: 'Parrot feather' },
  },
  {
    id: 'pier39-sea-lion-season', n: 2, area: 'wharf',
    name: { zh: '海狮的季节', en: 'Sea lion season' },
    riddle: { zh: '浮台上的邻居，这个月在家吗？', en: 'The dock neighbours: home this month?' },
    rumour: { zh: '听说 39 号码头的海狮，每个季节来的数量都不一样。', en: 'They say the PIER 39 sea lions come and go with the seasons.' },
    at: { x: -198.7, z: 3.8 }, kind: 'ground',
    how: { zh: '在 39 号码头西边的栏杆旁看海狮', en: 'Watch the sea lions from the rail on PIER 39’s west side' },
    lines: [
      // (review, re-read 2026-09-28) PIER 39 says "shortly after the Loma Prieta earthquake" (October 1989); Wikipedia's
      // Pier 39 page says the first hauled out in September 1989, before the quake: the line claims only the autumn
      { zh: '1989 年秋天起，海狮陆续搬到这片浮台上来了。', en: 'From the autumn of 1989 the sea lions began moving onto these docks.' },
      { zh: '看就好，别喂——喂海狮是违法的哦。', en: 'Just watch — feeding them is against the law.' },
    ],
    fact: {
      zh: '1989 年秋天起，海狮开始在 K 号浮台上岸（码头说是在洛马普列塔地震后不久）；数量随季节涨落，六七月大多南下繁殖。',
      en: 'Sea lions began hauling out on K-Dock in autumn 1989 (PIER 39 says shortly after the Loma Prieta quake). Numbers rise and fall with the seasons; in June and July most head south to breed.',
    },
    sources: [src('https://www.pier39.com/sealions/', 'K-Dock shortly after the October 1989 quake; seasonal numbers; feeding unlawful'), src('https://en.wikipedia.org/wiki/Pier_39', 'first haul-outs in September 1989, before the quake; June–July: most leave for the Channel Islands to breed')],
    stamp: { zh: '海狮季节', en: 'Sea lion season' },
  },
  {
    id: 'musee-laughing-lady', n: 3, area: 'wharf',
    name: { zh: '游戏厅里的大笑女士', en: 'The laughing lady of the arcade' },
    riddle: { zh: '码头边的老游戏厅，谁笑个不停？', en: 'Who can’t stop laughing in the old arcade?' },
    rumour: { zh: '听说 45 号码头那家老游戏厅门口，总能听见有人哈哈大笑。', en: 'They say you can hear someone laughing at the old arcade on Pier 45.' },
    at: { x: -214.7, z: 71.3 }, kind: 'ground',
    how: { zh: '在 45 号码头的老游戏厅门口听一听', en: 'Listen at the old arcade’s door on Pier 45' },
    lines: [
      { zh: '海边乐园 1972 年关门后，这家游戏厅买下了一位"大笑女士"。', en: 'When the beach amusement park closed in 1972, this arcade bought a “laughing lady”.' },
      { zh: '哈哈……她一笑，我也忍不住了！', en: 'Ha ha… when she laughs, I can’t help it either!' },
    ],
    fact: {
      zh: '"大笑女士"原本在海边的 Playland 乐园门口笑，乐园 1972 年关门；机械博物馆拍下了一位，如今在 45 号码头。',
      en: 'Laffing Sal laughed at Playland-at-the-Beach until it closed in 1972. The Musée Mécanique bought one at auction; it now laughs on Pier 45.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Laffing_Sal'), src('https://en.wikipedia.org/wiki/Mus%C3%A9e_M%C3%A9canique')],
    stamp: { zh: '大笑女士', en: 'Laughing lady' },
  },
  {
    id: 'chinatown-telephone-exchange', n: 4, area: 'downtown',
    name: { zh: '老电话局的电话', en: 'The old exchange’s phone' },
    riddle: { zh: '宝塔屋顶的门口，电话在响……', en: 'A phone rings by the pagoda-roofed door…' },
    rumour: { zh: '听说唐人街那座宝塔屋顶的老房子门口，每天会响一次电话。', en: 'They say a phone rings once a day by the pagoda-roofed house in Chinatown.' },
    at: { x: 26.3, z: 133.6 }, kind: 'ground',
    how: { zh: '路过华盛顿街的宝塔屋顶小楼时，接起电话', en: 'Answer the phone at the pagoda-roofed house on Washington St' },
    lines: [
      { zh: '以前这里的接线员要背下几千个号码，还会说好几种方言！', en: 'The operators here knew thousands of numbers by heart — in several dialects!' },
      { zh: '1949 年大家能自己拨号了，电话局就关门了。', en: 'In 1949, when people could dial for themselves, the exchange closed.' },
    ],
    fact: {
      zh: '华人电话局在华盛顿街 743 号：接线员要背下成百上千个号码，而且用好几种方言；1949 年自动拨号普及后关闭。',
      en: 'At the Chinese Telephone Exchange, 743 Washington St, operators memorised hundreds, later thousands, of numbers in several dialects. It closed in 1949 as self-dial phones spread.',
    },
    sources: [src('https://www.kqed.org/arts/13960573/chinese-telephone-exchange-san-francisco-chinatown-history')],
    stamp: { zh: '接线员', en: 'Operator' },
  },
  {
    id: 'fortune-cookie-trail', n: 5, area: 'golden-gate-park',
    name: { zh: '幸运饼干两站路', en: 'The fortune-cookie trail' },
    riddle: { zh: '茶园和小巷，各藏一张小纸条。', en: 'A tea garden and an alley each hide a slip.' },
    rumour: { zh: '听说日本茶园和唐人街的小巷里，每天都有一块新的幸运饼干。', en: 'They say the Tea Garden and a Chinatown alley each keep a fresh fortune cookie every day.' },
    at: { x: -239.2, z: 963.3 }, kind: 'ground', also: [{ x: 10.6, z: 136.7 }],
    how: { zh: '在日本茶园门口，或唐人街罗斯巷的饼干铺，拿一块饼干', en: 'Take a cookie at the Tea Garden gate or in Ross Alley, Chinatown' },
    lines: [
      { zh: '据说美国最早的幸运饼干，1900 年代初就在这座茶园端上了桌。', en: 'They say America’s first fortune cookies were served in this tea garden in the early 1900s.' },
      { zh: '这家小饼干铺 1962 年就在这条小巷里开张了。', en: 'This little cookie bakery opened in this alley in 1962.' },
    ],
    fact: {
      zh: '据记载，日本茶园的萩原真在 1900 年代初最早在美国端出现代的幸运饼干（洛杉矶也有说法）。罗斯巷的饼干铺 1962 年开张。',
      en: 'Makoto Hagiwara of the Japanese Tea Garden is reported to have served the modern fortune cookie in the early 1900s (Los Angeles has a rival claim). The Ross Alley bakery opened in 1962.',
    },
    sources: [
      src('https://en.wikipedia.org/wiki/Fortune_cookie'),
      src('https://en.wikipedia.org/wiki/Golden_Gate_Fortune_Cookie_Company', 'opened in 1962; entrance off Ross Alley'),
      // (review) Wikipedia gives the year, not the alley: "It opened in 1962 in Ross Alley" (The Takeout, 2026-01-05)
      src('https://www.thetakeout.com/2064004/san-francisco-golden-gate-fortune-cookie-factory-handmade/', 'opened in 1962 in Ross Alley'),
    ],
    stamp: { zh: '签语', en: 'Fortune' },
  },
  {
    id: 'emperor-norton-bridge-decree', n: 6, area: 'downtown',
    name: { zh: '诺顿皇帝的造桥圣旨', en: 'Emperor Norton’s bridge decree' },
    riddle: { zh: '大桥脚下，谁贴了一道圣旨？', en: 'Who pinned a decree at the bridge’s foot?' },
    rumour: { zh: '听说海湾大桥脚下的灯柱上，卷着一张"圣旨"。', en: 'They say a rolled-up “decree” hangs on a lamppost by the Bay Bridge.' },
    at: { x: 238.9, z: 17.1 }, kind: 'ground',
    how: { zh: '在海湾大桥下的内河码头大道，读一读灯柱上的纸卷', en: 'Read the scroll on a lamppost where the Bay Bridge meets the Embarcadero' },
    lines: [
      { zh: '1872 年，诺顿"皇帝"下令修一座跨湾大桥——64 年后真修好了！', en: 'In 1872 “Emperor” Norton decreed a bridge across the Bay — 64 years later, it opened!' },
    ],
    fact: {
      zh: '自称"美国皇帝"的诺顿在 1872 年发过几道"圣旨"，要修一座经羊岛到奥克兰的大桥；海湾大桥 1936 年 11 月 12 日通车。',
      en: 'Joshua Norton, self-styled Emperor of the United States, issued proclamations in 1872 for a bridge to Oakland via Goat Island. The Bay Bridge opened on 12 November 1936.',
    },
    sources: [src('https://emperornortontrust.org/bridge/proclamations')],
    stamp: { zh: '圣旨', en: 'Imperial decree' },
  },
  {
    id: 'wave-organ-high-tide', n: 7, area: 'marina-presidio',
    name: { zh: '会唱歌的海浪风琴', en: 'The singing Wave Organ' },
    riddle: { zh: '防波堤的尽头，石头会唱歌。', en: 'At the jetty’s end, the stones sing.' },
    rumour: { zh: '听说马里纳区防波堤的尽头，把耳朵贴近管口能听见海在唱歌。', en: 'They say that at the end of the Marina jetty, the sea sings into the pipes.' },
    at: { x: -413, z: 289.8 }, kind: 'ground',
    how: { zh: '走到防波堤尽头，把耳朵凑近管口', en: 'Walk to the jetty’s end and put your ear to a pipe' },
    lines: [
      { zh: '把耳朵凑近管口听听——涨潮的时候，它唱得最响！', en: 'Put your ear to a pipe — it sings loudest at high tide!' },
    ],
    fact: {
      zh: '海浪风琴 1986 年由探索馆建成，25 根管子接着海浪发声；雕花石料来自一座拆除的老墓园。涨潮时最好听。',
      en: 'The Exploratorium built the Wave Organ in 1986: 25 pipes sound with the waves, among carved stone salvaged from a demolished cemetery. It is best heard at high tide.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Wave_Organ')],
    stamp: { zh: '海浪风琴', en: 'Wave Organ' },
  },
  {
    id: 'crissy-field-dusk-landing', n: 8, area: 'marina-presidio',
    name: { zh: '赶在天黑前降落', en: 'Land before dusk' },
    riddle: { zh: '黄昏时，让鹈鹕落在草坪上。', en: 'At dusk, land the pelican on the lawn.' },
    rumour: { zh: '听说有人黄昏时骑鹈鹕降落在克里西场的草坪上，会有惊喜。', en: 'They say landing the pelican on the Crissy Field lawn at dusk brings a surprise.' },
    at: { x: -566, z: 536 }, kind: 'ground',
    how: { zh: '黄昏时骑着鹈鹕，降落在克里西场的草坪上', en: 'Glide the pelican down onto the Crissy Field lawn at dusk' },
    lines: [
      { zh: '1924 年，一架飞机天亮从纽约起飞，据说天黑前一分钟落在这里！', en: 'In 1924 a plane left New York at dawn and landed here, reportedly a minute before dusk!' },
    ],
    fact: {
      zh: '克里西场以前是陆军机场。1924 年 6 月 23 日，莫恩中尉清晨从纽约起飞，晚上 9:46 降落在这里，据说离天黑只差一分钟。',
      en: 'Crissy Field was an Army airfield. On 23 June 1924 Lt. Russell Maughan left New York at dawn and landed here at 9:46 pm, reportedly a minute before dusk.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Dawn-to-dusk_transcontinental_flight_across_the_United_States')],
    stamp: { zh: '日出到日落', en: 'Dawn to dusk' },
  },
  {
    id: 'baybay-otter-roots', n: 9, area: 'marina-presidio',
    name: { zh: 'BAYBAY 的远房亲戚', en: 'BAYBAY’s distant cousins' },
    riddle: { zh: '大桥下的水边，BAYBAY 想起了谁？', en: 'By the water under the bridge, who does BAYBAY remember?' },
    rumour: { zh: '听说 BAYBAY 一到大桥下的炮台水边，就会想起她的亲戚。', en: 'They say BAYBAY remembers her family at the water by the fort under the bridge.' },
    at: { x: -747.3, z: 595.5 }, kind: 'ground',
    how: { zh: '和 BAYBAY 一起走到金门大桥下炮台旁的水边', en: 'Walk with BAYBAY to the water by the fort under the Golden Gate Bridge' },
    lines: [
      { zh: '很久以前，旧金山湾里也住着海獭——是我的远房亲戚！', en: 'Long ago, sea otters lived in San Francisco Bay too — my distant cousins!' },
      { zh: '后来它们被猎皮毛的人抓得越来越少，现在还没回到湾里。', en: 'Fur hunters took most of them, and they haven’t come back to the Bay yet.' },
    ],
    fact: {
      zh: '海獭曾从墨西哥分布到阿拉斯加，旧金山湾里也有。它们因毛皮被大量猎杀，至今还没回到湾里；科学家正在研究它们回来的可能。',
      en: 'Sea otters once ranged from Mexico to Alaska, San Francisco Bay included. Hunted for their fur, they are still absent from the Bay; scientists are studying their return.',
    },
    sources: [src('https://www.marinemammalcenter.org/publications/marine-mammal-monday-sea-otters-and-san-francisco')],
    stamp: { zh: '海獭一家', en: 'Otter family' },
  },
  {
    id: 'octagon-house-time-capsule', n: 10, area: 'marina-presidio',
    name: { zh: '八角屋的时间胶囊', en: 'The Octagon House time capsule' },
    riddle: { zh: '八个角的房子，门口藏着铁盒。', en: 'An eight-sided house hides a tin by its door.' },
    rumour: { zh: '听说牛谷那座八角形的老房子旁边，藏着一个小铁盒。', en: 'They say a little tin is tucked by the eight-sided house in Cow Hollow.' },
    at: { x: -184.6, z: 290.1 }, kind: 'ground',
    how: { zh: '在牛谷的八角屋门口，打开小铁盒', en: 'Open the tin by the Octagon House in Cow Hollow' },
    lines: [
      { zh: '1953 年修房子时，电工在楼梯边找到一个 1861 年的铁盒！', en: 'In 1953 an electrician found an 1861 tin by the stairs!' },
    ],
    fact: {
      zh: '1953 年 3 月，一位电工在通往屋顶小阁楼的楼梯旁找到一个圆铁盒，里面有剪报、老照片和一封 1861 年 7 月 14 日的信。',
      en: 'In March 1953 an electrician found a round tin by the stairs to the cupola, left by the builders: clippings, a family photograph and a letter dated 14 July 1861.',
    },
    sources: [src('https://nscda-ca.org/octagon-house/octagon-house-article/history-uncovered/')],
    stamp: { zh: '时间胶囊', en: 'Time capsule' },
  },
  {
    id: 'alcatraz-pelican-island', n: 11, area: 'wharf',
    name: { zh: '鹈鹕的岛', en: 'The pelicans’ island' },
    riddle: { zh: '骑着鹈鹕，绕那座岛飞一圈。', en: 'Ride the pelican once round that island.' },
    rumour: { zh: '听说骑鹈鹕绕着湾里那座小岛飞一整圈，会有朋友来陪你。', en: 'They say if you fly the pelican right round the island in the Bay, friends join you.' },
    at: { x: -468.2, z: -58.5 }, kind: 'air',
    how: { zh: '骑着鹈鹕绕恶魔岛飞一整圈（不用降落）', en: 'Fly the pelican in a full circle round Alcatraz (no landing)' },
    lines: [
      { zh: '"Alcatraz"一般认为来自老西班牙语的"鹈鹕"——你飞回老家啦！', en: '“Alcatraz” is usually traced to old Spanish for “pelican” — you’re flying home!' },
      { zh: '水塔上的字，是 1969 到 1971 年原住民占领这座岛时写的。', en: 'The words on the water tower date from the Native American occupation of 1969–71.' },
    ],
    fact: {
      zh: '1775 年阿亚拉把湾里一座岛叫作"鹈鹕岛"，名字后来落到这座岛上。1969–71 年原住民占领此岛时写在水塔上的字，2012 年重新漆过。',
      en: 'In 1775 Ayala named an island “Isla de los Alcatraces”, usually read as pelicans; the name later moved to this rock. The water-tower words of the 1969–71 occupation were repainted in 2012.',
    },
    sources: [src('https://www.parksconservancy.org/our-work/alcatraz-glance'), src('https://en.wikipedia.org/wiki/Alcatraz_Island', 'the name first given to Yerba Buena Island; archaic alcatraz = pelican'), src('https://en.wikipedia.org/wiki/Alcatraz_water_tower', 'the occupation graffiti repainted in the 2011–12 restoration')],
    stamp: { zh: '鹈鹕岛', en: 'Isla de los Alcatraces' },
  },
  {
    id: 'ggb-foghorn-duet', n: 12, area: 'marina-presidio',
    name: { zh: '金门大桥的雾笛二重唱', en: 'The foghorn duet' },
    riddle: { zh: '雾里的大桥，有两种声音。', en: 'In fog, the bridge has two voices.' },
    rumour: { zh: '听说起雾的时候站在金门大桥上，能听见两种不一样的雾笛。', en: 'They say that on the Golden Gate Bridge in fog you can hear two different foghorns.' },
    at: { x: -865.8, z: 508.6 }, kind: 'ground', also: [{ x: -796.1, z: 564.4 }],
    how: { zh: '雾天走上金门大桥，听南塔和桥中间的两种雾笛', en: 'On the bridge in fog, hear both horns: the south tower’s and mid-span’s' },
    lines: [
      { zh: '听！"呜——"一长声是南塔，"呜、呜"两声一组的在桥中间。', en: 'Hear that? The long low one is the south tower; the double one is mid-span.' },
      { zh: '起雾挡住船的视线时，大桥的工作人员会亲手打开雾笛。', en: 'When fog hides the water from ships, bridge workers switch the horns on by hand.' },
    ],
    fact: {
      zh: '南塔桥墩的雾笛：响 2 秒、停 18 秒；桥中间的三只雾笛：停 9 秒，响 1 秒、停 2 秒、再响 1 秒，停 36 秒。一年平均每天响约两个半小时。',
      en: 'South tower pier: a 2-second blast, then 18 seconds off. Mid-span: a 9-second pause, 1-second blast, 2-second pause, 1-second blast, 36 seconds off. On average they sound about 2.5 hours a day.',
    },
    sources: [src('https://www.goldengate.org/bridge/history-research/bridge-features/foghorns-beacons/')],
    stamp: { zh: '雾笛听众', en: 'Foghorn listener' },
  },
  // --- 13–24: the west, the south and the east (W5-D4; spots snapped from OSM on 2026-09-28 and checked standable) ---
  {
    id: 'golden-gate-humpback', n: 13, area: 'marina-presidio',
    name: { zh: '海峡里的座头鲸', en: 'A humpback in the Golden Gate' },
    riddle: { zh: '海峡里，有时冒出一股水柱。', en: 'Sometimes a spout rises in the strait.' },
    rumour: { zh: '听说春天到秋天，金门海峡里偶尔能看见座头鲸喷水。', en: 'They say that from spring to autumn a humpback sometimes spouts in the Golden Gate.' },
    at: { x: -822, z: 454 }, kind: 'water',
    how: { zh: '四到十一月，过金门海峡时看看海面（看缘分）', en: 'April to November, watch the water as you cross the Gate (if you’re lucky)' },
    lines: [
      { zh: '是座头鲸！2016 年起它们常游进湾里觅食，看缘分哦。', en: 'A humpback! Since 2016 they often come into the Bay to feed — if you’re lucky.' },
    ],
    fact: {
      zh: '2016 年 4 月起，座头鲸开始成群游过金门大桥进湾觅食；之后几年常从四月待到十一月。',
      en: 'From April 2016 humpbacks began coming under the Golden Gate Bridge into the Bay to feed; in later years they often stayed from April to November.',
    },
    sources: [src('https://baynature.org/2018/11/13/humpback-whales-feed-in-san-francisco-bay-through-november/')],
    stamp: { zh: '座头鲸', en: 'Whale' },
  },
  {
    id: 'lands-end-labyrinth', n: 14, area: 'west-coast',
    name: { zh: '时有时无的石头迷宫', en: 'The labyrinth that comes and goes' },
    riddle: { zh: '悬崖上的石圈，有时在有时不在。', en: 'A stone ring on the cliff: some days there, some not.' },
    rumour: { zh: '听说天涯海角的海边，有个用石头摆的迷宫，但不是每天都在。', en: 'They say there’s a stone labyrinth at Lands End — but not every day.' },
    at: { x: -743, z: 1093.7 }, kind: 'ground',
    how: { zh: '在天涯海角找到石头迷宫，沿着小路走到中心', en: 'Find the stone labyrinth at Lands End and walk its path to the centre' },
    lines: [
      { zh: '这个石头迷宫被弄乱过好几次，每次都有人把它重新摆好。', en: 'This stone labyrinth has been scattered many times — and someone always rebuilds it.' },
    ],
    fact: {
      // (review, richmondsfblog.com 2015-08-18 re-read 2026-09-28: its keeper rebuilds it, a few helpers with her)
      zh: '天涯海角的石头迷宫由艺术家爱德华多·阿吉莱拉在 2004 年摆成，多次被破坏，守护它的人和帮手一次次把它重新摆好。',
      en: 'Artist Eduardo Aguilera laid the Lands End labyrinth in 2004. It has been vandalised several times and rebuilt again and again by its keeper and helpers.',
    },
    sources: [src('https://localwiki.org/sf/Land%27s_End_Labyrinth'), src('https://richmondsfblog.com/2015/08/18/photo-lands-end-labyrinth-erased/', 'vandalised several times; rebuilt by its keeper')],
    stamp: { zh: '石头迷宫', en: 'Labyrinth' },
  },
  {
    id: 'china-beach-fishermen', n: 15, area: 'west-coast',
    name: { zh: '中国海滩的由来', en: 'Why it’s called China Beach' },
    riddle: { zh: '金色傍晚的小海湾，看看海面。', en: 'A small cove at golden hour: watch the water.' },
    rumour: { zh: '听说海崖区那个小海湾，傍晚的海面上会出现旧时的帆影。', en: 'They say old sails appear on the water of the Sea Cliff cove at golden hour.' },
    at: { x: -614.8, z: 969 }, kind: 'ground',
    how: { zh: '黄金时刻到中国海滩，看看小海湾', en: 'Come to China Beach at golden hour and look over the cove' },
    lines: [
      { zh: '据说以前华人渔民在这个小湾停船扎营，所以叫"中国海滩"。', en: 'They say Chinese fishermen once anchored and camped in this cove — hence China Beach.' },
    ],
    fact: {
      zh: '名字的来历多靠口述：一说华人渔民曾在这个避风小湾停船扎营。1974 年成为国家公园后，名字改回"中国海滩"，以纪念华人移民。',
      en: 'The name’s origin rests mostly on oral history: one account says Chinese fishermen anchored and camped here. After 1974 the National Park Service restored the name China Beach.',
    },
    sources: [src('https://www.nps.gov/goga/learn/historyculture/the-history-of-china-beach.htm')],
    stamp: { zh: '中国海滩', en: 'China Beach' },
  },
  {
    id: 'dahlia-dell-100', n: 16, area: 'golden-gate-park',
    name: { zh: '市花大丽花 100 岁', en: 'The dahlia turns 100' },
    riddle: { zh: '温室东边的花圃，今年一百岁。', en: 'The bed east of the glasshouse is 100 this year.' },
    rumour: { zh: '听说花卉温室东边的大丽花圃，今年有个特别的生日。', en: 'They say the dahlia bed east of the Conservatory has a special birthday this year.' },
    at: { x: -174.2, z: 845.3 }, kind: 'ground',
    how: { zh: '到花卉温室东边的大丽花圃看看', en: 'Visit the dahlia bed just east of the Conservatory of Flowers' },
    lines: [
      { zh: '大丽花是旧金山的市花，2026 年正好满一百年！', en: 'The dahlia is San Francisco’s official flower — 100 years in 2026!' },
    ],
    fact: {
      zh: '1926 年大丽花被定为旧金山市花。花卉温室东边的大丽花圃有 700 多株，六月到十月开花，八九月最盛。',
      en: 'The dahlia became San Francisco’s official flower in 1926. The Dahlia Dell just east of the Conservatory has 700+ plants, blooming June to October, peaking in August or September.',
    },
    sources: [src('https://abc7news.com/post/flower-enthusiasts-celebrate-100th-anniversary-dahlias-being-designated-official-san-francisco/19638309/'), src('https://www.sfdahlias.org/dahlia-dell')],
    stamp: { zh: '大丽花 100', en: 'Dahlia 100' },
  },
  {
    id: 'tiled-steps-sea-to-stars', n: 17, area: 'golden-gate-park',
    name: { zh: '从海底爬到星空', en: 'From the sea to the stars' },
    riddle: { zh: '一口气，从海底爬到星空。', en: 'In one go, from the sea floor to the stars.' },
    rumour: { zh: '听说第 16 大道的马赛克台阶，一口气爬到顶，会听见不一样的声音。', en: 'They say that if you climb the 16th Avenue mosaic steps in one go, you’ll hear something.' },
    at: { x: -115.9, z: 1147 }, kind: 'ground', also: [{ x: -109.8, z: 1139.9 }],
    how: { zh: '一口气爬完第 16 大道的马赛克台阶', en: 'Climb the 16th Avenue Tiled Steps in one go' },
    lines: [
      { zh: '从海底一路爬到星空——163 级台阶全是马赛克！', en: 'From the sea floor up to the stars — 163 steps of mosaic!' },
    ],
    fact: {
      zh: '第 16 大道马赛克台阶共 163 级，图案从大海画到天空，由艾琳·巴尔和科莉特·克鲁彻设计、街坊一起完成，2005 年 8 月 27 日揭幕。',
      en: 'The 16th Avenue Tiled Steps: 163 steps whose mosaic runs from the sea to the sky, designed by Aileen Barr and Colette Crutcher with the neighbours, opened on 27 August 2005.',
    },
    sources: [src('https://en.wikipedia.org/wiki/16th_Avenue_Tiled_Steps')],
    stamp: { zh: '海到星空', en: 'Sea to stars' },
  },
  {
    id: 'karl-the-fog-diary', n: 18, area: 'mission-castro',
    name: { zh: 'Karl 的小秘密', en: 'Karl the Fog’s secrets' },
    riddle: { zh: '雾来的时候，站到双峰顶上。', en: 'When the fog comes, stand on Twin Peaks.' },
    rumour: { zh: '听说起雾时站在双峰顶上，能看见 Karl 的小秘密。', en: 'They say Twin Peaks in fog shows you a secret or two about Karl.' },
    at: { x: 125.7, z: 937.8 }, kind: 'ground',
    how: { zh: '雾天站在双峰顶上', en: 'Stand on Twin Peaks when the fog is in' },
    lines: [
      { zh: 'Karl 这个名字，是 2010 年一个社交账号带火的。', en: 'The name Karl caught on from a social account started in 2010.' },
      { zh: '九月通常是旧金山最暖和的月份，Karl 常常请假。', en: 'September is usually San Francisco’s warmest month — Karl often takes time off.' },
      { zh: '"最冷的冬天是旧金山的夏天"？其实马克·吐温没说过。', en: '“The coldest winter I ever spent was a summer in San Francisco”? Twain never said it.' },
    ],
    fact: {
      zh: '雾被叫作 Karl，源于 2010 年 8 月出现的 @KarlTheFog 账号。按 1991–2020 年平均，九月是旧金山白天最暖的月份。',
      en: 'The fog’s name spread from the @KarlTheFog account, started in August 2010. By the 1991–2020 normals, September has San Francisco’s warmest afternoons.',
    },
    sources: [
      src('https://www.kqed.org/news/11682057/how-the-bay-areas-fog-came-to-be-named-karl'),
      src('https://www.currentresults.com/Weather/California/Places/san-francisco-temperatures-by-month-average.php', 'September average high 70°F, the highest (1991–2020)'),
      src('https://quoteinvestigator.com/2011/11/30/coldest-winter/', 'the quip is not Twain’s'),
      src('https://www.sfbayweather.com/learn/when-does-sf-fog-peak', 'July is usually the foggiest month; September–October the clearest'),
    ],
    stamp: { zh: '遇见 Karl', en: 'Karl sighting' },
  },
  {
    id: 'ingleside-sundial-real-time', n: 19, area: 'south',
    name: { zh: '会报真实时间的日晷', en: 'The sundial that tells real time' },
    riddle: { zh: '这个大日晷，听谁的时间？', en: 'Whose time does the giant sundial keep?' },
    rumour: { zh: '听说英格塞德那座大日晷的影子，跟着真的太阳走。', en: 'They say the Ingleside sundial’s shadow follows the real sun.' },
    at: { x: 277, z: 1442.9 }, kind: 'ground',
    how: { zh: '白天去英格塞德的大日晷，看看影子', en: 'Visit the Ingleside sundial by day and read its shadow' },
    lines: [
      { zh: '日晷的影子，指着旧金山现在的真实时间！', en: 'The sundial’s shadow shows the real time in San Francisco right now!' },
      { zh: '1913 年 10 月 10 日它揭幕那天，巴拿马运河也接通了两大洋。', en: 'It opened on 10 Oct 1913 — the day the Panama Canal first joined the two oceans.' },
    ],
    fact: {
      zh: '英格塞德日晷 1913 年落成，晷针长 28 英尺。10 月 10 日的揭幕礼有一千五百人参加，同一天巴拿马运河两洋首次相通。',
      en: 'The Ingleside sundial was completed in 1913 with a 28-foot gnomon. 1,500 people came to its opening on 10 October, the day the Atlantic and Pacific first met in the Panama Canal.',
    },
    sources: [src('https://www.outsidelands.org/sundial.php'), src('https://noehill.com/sf/landmarks/sf293.asp')],
    stamp: { zh: '日晷', en: 'Sundial' },
  },
  {
    id: 'golden-hydrant-1906', n: 20, area: 'mission-castro',
    name: { zh: '金色消防栓', en: 'The golden fire hydrant' },
    riddle: { zh: '公园坡顶，有个金色的小家伙。', en: 'A little golden fellow at the top of the park.' },
    rumour: { zh: '听说多洛雷斯公园坡顶有个金色的消防栓，救过整个教会区。', en: 'They say a golden hydrant at the top of Dolores Park once saved the Mission.' },
    at: { x: 256.6, z: 724.3 }, kind: 'ground',
    how: { zh: '在多洛雷斯公园西南角，找到那个金色的消防栓', en: 'Find the golden hydrant at Dolores Park’s south-west corner' },
    lines: [
      { zh: '1906 年大火时，消防员靠这个消防栓挡住了火，救下了教会区！', en: 'In the 1906 fire, firefighters used this hydrant to stop the flames reaching the Mission!' },
      { zh: '每年 4 月 18 日一大早，大家会给它刷一层新金漆。', en: 'Every 18 April, early in the morning, people give it a fresh coat of gold.' },
    ],
    fact: {
      zh: '20 街和教堂街路口的这个消防栓，在 1906 年大火中帮消防员挡住了蔓延到教会区的火。每年 4 月 18 日大家会给它重新刷金漆。',
      en: 'At 20th and Church, this hydrant helped firefighters stop the 1906 fire from spreading through the Mission. It is repainted gold every 18 April.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Golden_Fire_Hydrant'), src('https://sfstandard.com/2022/09/15/the-story-behind-san-franciscos-golden-fire-hydrant-that-could/')],
    stamp: { zh: '小金栓', en: 'Little giant' },
  },
  {
    id: 'castro-rainbow-steps', n: 21, area: 'mission-castro',
    name: { zh: '彩虹脚印', en: 'Rainbow footsteps' },
    riddle: { zh: '走过彩虹，看看脚下。', en: 'Cross the rainbow and look at your feet.' },
    rumour: { zh: '听说走过卡斯特罗街口的彩虹斑马线，脚印会变成彩色的。', en: 'They say your footprints turn rainbow after the Castro’s rainbow crosswalk.' },
    at: { x: 161.7, z: 755.8 }, kind: 'ground',
    how: { zh: '走过 18 街和卡斯特罗街路口的彩虹斑马线', en: 'Cross the rainbow crosswalk at 18th and Castro' },
    lines: [
      { zh: '2014 年，这个路口铺上了彩虹斑马线！', en: 'This crossing got its rainbow crosswalks in 2014!' },
      { zh: '人行道上的铜牌，纪念为世界做出贡献的 LGBTQ 人士。', en: 'The bronze plaques in the sidewalk honour LGBTQ people who made a difference.' },
    ],
    fact: {
      zh: '18 街和卡斯特罗街路口的彩虹斑马线随 2014 年的街道改造铺成。人行道上的"彩虹荣誉步道"铜牌，第一批 20 块于 2014 年揭幕。',
      en: 'The rainbow crosswalks at 18th and Castro came with the 2014 street redesign. The Rainbow Honor Walk’s bronze sidewalk plaques began with 20 unveiled in 2014.',
    },
    sources: [src('https://sf.streetsblog.org/2014/03/13/castro-street-redesign-breaks-ground-rainbow-crosswalks-unveiled/'), src('https://en.wikipedia.org/wiki/Rainbow_Honor_Walk')],
    stamp: { zh: '彩虹脚印', en: 'Rainbow steps' },
  },
  {
    id: 'herons-head-from-above', n: 22, area: 'south',
    name: { zh: '从天上看"鹭鸟头"', en: 'The heron’s head from above' },
    riddle: { zh: '从天上看，那个公园像谁的头？', en: 'From the sky, whose head is that park?' },
    rumour: { zh: '听说从天上看湾景区海边那个公园，形状特别有意思。', en: 'They say a park on the Bayview shore has a funny shape from the sky.' },
    at: { x: 923.3, z: 457.4 }, kind: 'air',
    how: { zh: '骑着鹈鹕飞过苍鹭头公园上空', en: 'Fly the pelican over Heron’s Head Park' },
    lines: [
      { zh: '从天上看，这座公园真的像一只大蓝鹭的脑袋！', en: 'From up here the park really looks like a great blue heron’s head!' },
    ],
    fact: {
      zh: '苍鹭头公园占地 22 英亩，名字来自它的形状——从天上看像一只大蓝鹭的头。这里能见到一百多种鸟。',
      en: 'Heron’s Head Park (22 acres) is named for its shape: from above it looks like the head of a great blue heron. More than a hundred bird species visit.',
    },
    sources: [src('https://www.sfport.com/heronsheadpark'), src('https://en.wikipedia.org/wiki/Heron%27s_Head_Park')],
    stamp: { zh: '苍鹭头', en: 'Heron’s Head' },
  },
  {
    id: 'sf-250-birthday-trail', n: 23, area: 'marina-presidio',
    name: { zh: '旧金山 250 岁生日小路', en: 'San Francisco’s 250th birthday trail' },
    riddle: { zh: '三个 1776 年的地方，在哪里？', en: 'Three places from 1776: where are they?' },
    rumour: { zh: '听说要塞、山湖和多洛雷斯教堂，藏着同一个 1776 年的故事。', en: 'They say the Presidio, Mountain Lake and Mission Dolores share one story from 1776.' },
    at: { x: -446.7, z: 576.3 }, kind: 'ground', also: [{ x: -434, z: 777 }, { x: 199.3, z: 646.9 }],
    how: { zh: '走访要塞军官俱乐部、山湖和多洛雷斯教堂（顺序随意）', en: 'Visit the Presidio Officers’ Club, Mountain Lake and Mission Dolores, in any order' },
    lines: [
      { zh: '1776 年 9 月 17 日，西班牙人在这里建起了要塞。', en: 'On 17 September 1776 the Spanish founded the presidio here.' },
      { zh: '在那之前的几千年，这里一直是拉迈图什奥隆尼人的家园。', en: 'For thousands of years before that, this was Ramaytush Ohlone land.' },
      { zh: '1776 年，安萨的探险队在这附近扎营，为要塞找地方。', en: 'In 1776 Anza’s expedition camped near here, scouting a site for the fort.' },
      { zh: '多洛雷斯教堂是旧金山最古老的完整建筑。', en: 'Mission Dolores is the oldest intact building in San Francisco.' },
    ],
    fact: {
      zh: '要塞建于 1776 年 9 月 17 日，2026 年满 250 年；多洛雷斯传教会同年 10 月 9 日创立。此前数千年，这里是拉迈图什奥隆尼人的家园。',
      en: 'El Presidio de San Francisco was founded on 17 September 1776 — 250 years in 2026 — and the mission on 9 October 1776. The Ramaytush Ohlone had lived on this land for thousands of years.',
    },
    sources: [
      src('https://presidio.gov/about/press/whats-new-at-the-presidio-of-san-francisco-in-2026'),
      src('https://presidio.gov/explore/attractions/mountain-lake', 'Anza’s party camped nearby in 1776'),
      src('https://www.missiondolores.org/old-mission', 'founded 9 Oct 1776; the oldest intact building in the city'),
    ],
    stamp: { zh: '旧金山 250', en: 'SF 250' },
  },
  {
    id: 'alta-plaza-chipped-steps', n: 24, area: 'marina-presidio',
    name: { zh: '被电影飞车磕坏的台阶', en: 'The steps a movie chase chipped' },
    riddle: { zh: '开小车到台阶顶，停一停。', en: 'Drive the toy car to the top step, then stop.' },
    rumour: { zh: '听说太平洋高地公园的大台阶上，还留着一场老电影的印子。', en: 'They say the grand steps of Alta Plaza still carry marks from an old movie.' },
    at: { x: -194.1, z: 456.3 }, kind: 'ground',
    how: { zh: '开玩具小车（或骑单车）到阿尔塔广场公园南边台阶顶上', en: 'Drive the toy car (or ride a bike) to the top of Alta Plaza’s south steps' },
    lines: [
      { zh: '别开下去！1972 年一场电影飞车把台阶磕坏了，印子还在呢。', en: 'Not down the steps! A 1972 movie chase chipped them, and the marks are still there.' },
    ],
    fact: {
      zh: '1972 年一部喜剧片未经许可在这里拍飞车戏，几辆车冲下台阶，把台阶磕坏了，痕迹至今还看得到。',
      en: 'In 1972 a comedy filmed its car chase down these steps without permission; the cars badly damaged them, and the marks can still be seen.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Alta_Plaza_Park')],
    stamp: { zh: '电影台阶', en: 'Film steps' },
  },];

/**
 * (part c, W5-D6) Batch 2: eggs 25–33, appended after batch 1 in the same bitset (`ALL_EGG_IDS[i]` is bit `i` of
 * `play.g.egg`: batch 1 keeps bits 0–23). A list of their own so lane E's 小发现 page (and its tests) keep batch 1's 24
 * until E adds these; everything of lane D's (the hosts, the ledger's ids, the rumours, the compass) reads `ALL_EGGS`.
 */
export const EGGS_BATCH_2: readonly EggDef[] = [
  {
    id: 'mt-davidson-top-of-sf', n: 25, area: 'south',
    name: { zh: '旧金山最高的山顶', en: 'The top of San Francisco' },
    riddle: { zh: '全城最高的天然山顶在哪？', en: 'Where is the city’s highest natural top?' },
    rumour: { zh: '听说城西南有座山，比双峰还高一点，是旧金山最高的地方。', en: 'They say a hill in the south-west, a little higher than Twin Peaks, is the top of San Francisco.' },
    at: { x: 256.9, z: 1160.9 }, kind: 'ground',
    how: { zh: '爬上戴维森山的山顶，站一会儿', en: 'Climb to the top of Mount Davidson and stand a while' },
    lines: [
      { zh: '登顶！这是旧金山最高的天然山顶，海拔 928 英尺（283 米）。', en: 'We made it! San Francisco’s highest natural point: 928 feet (283 m).' },
      { zh: '比双峰还高一点点呢。', en: 'Just a little higher than Twin Peaks.' },
    ],
    fact: {
      zh: '戴维森山海拔 928 英尺（283 米），是旧金山最高的天然山顶；双峰约 925 英尺。山顶一带是 38 英亩的公园。',
      en: 'Mount Davidson, 928 ft (283 m), is San Francisco’s highest natural point; Twin Peaks rise about 925 ft. The top is a 38-acre park.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Mount_Davidson_(California)'), src('https://en.wikipedia.org/wiki/Twin_Peaks_(San_Francisco)', 'about 925 ft')],
    stamp: { zh: '最高点', en: 'Top of SF' },
  },
  {
    id: 'telegraph-hill-semaphore', n: 26, area: 'north-beach',
    name: { zh: '电报山的信号杆', en: 'The Telegraph Hill semaphore' },
    riddle: { zh: '山顶的木杆，为什么举起手？', en: 'Why does the hilltop pole raise its arms?' },
    rumour: { zh: '听说电报山顶上，从前有根会举手臂的木杆。', en: 'They say a pole on top of Telegraph Hill used to raise its arms.' },
    at: { x: -51.7, z: 46.1 }, kind: 'ground',
    how: { zh: '在科伊特塔前的小广场，站到木杆旁边', en: 'Stand by the pole on the plaza before Coit Tower' },
    lines: [
      { zh: '1849 年这里立过信号杆：船一进金门，就举起手臂告诉全城。', en: 'In 1849 a signal pole stood here: when a ship came through the Gate, its arms told the city.' },
      { zh: '后来山顶架了电报，这座山就叫"电报山"了。', en: 'Later a telegraph went up here — and the hill became Telegraph Hill.' },
    ],
    fact: {
      zh: '1849 年 9 月，山顶立起一根有两条活动手臂的信号杆，用不同姿势告诉全城驶进金门的是轮船还是帆船；1853 年换成电报，山因此得名。',
      en: 'In September 1849 a pole with two movable arms on the hilltop told the city whether a steamer or a sailing ship was entering the Golden Gate; a telegraph replaced it in 1853 and named the hill.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Telegraph_Hill,_San_Francisco')],
    stamp: { zh: '信号杆', en: 'Semaphore' },
  },
  {
    id: 'sutro-baths-tunnel', n: 27, area: 'west-coast',
    name: { zh: '浴场废墟的隧道', en: 'The tunnel at the Sutro Baths' },
    riddle: { zh: '废墟边的石洞，浪从哪来？', en: 'The tunnel by the ruins — where do the waves come from?' },
    rumour: { zh: '听说苏特罗浴场废墟边有条石头隧道，那头就是大海。', en: 'They say a rock tunnel by the Sutro Baths ruins opens onto the sea.' },
    at: { x: -738.5, z: 1239.6 }, kind: 'ground',
    how: { zh: '走到苏特罗浴场废墟的隧道口', en: 'Walk to the tunnel mouth by the Sutro Baths ruins' },
    lines: [
      { zh: '哇，浪花从石缝里喷出来了！这条隧道 1892 年就挖好了。', en: 'Whoa — spray through the rocks! This tunnel was dug by 1892.' },
      { zh: '浪大的时候，我们在这儿看看就好，别往里走。', en: 'In big surf we just watch from here — we don’t go in.' },
    ],
    fact: {
      zh: '苏特罗浴场 1896 年开张，是当时世界上最大的室内游泳场，1966 年大火后只剩废墟；旁边的隧道原是运石头的采石道，1892 年完工，约 46 米长。',
      en: 'The Sutro Baths opened in 1896 as the world’s largest indoor swimming establishment and burned in 1966; the tunnel beside them, a quarry passage about 152 ft long, was finished in 1892.',
    },
    sources: [
      src('https://en.wikipedia.org/wiki/Sutro_Baths'),
      src('https://www.sfgate.com/obscuresf/article/historic-tunnel-at-SF-Sutro-Baths-16988820.php', 'SFGATE, 2022-03-14: a quarry tunnel, completed 1892, about 152 ft long'),
    ],
    stamp: { zh: '海边石洞', en: 'Sea tunnel' },
  },
  {
    id: 'spreckels-lake-model-yachts', n: 28, area: 'golden-gate-park',
    name: { zh: '湖上的模型帆船', en: 'Model yachts on Spreckels Lake' },
    riddle: { zh: '公园的湖上，谁的船这么小？', en: 'Whose boats are so small on the park lake?' },
    rumour: { zh: '听说金门公园有片湖，是专门给模型船修的。', en: 'They say a lake in Golden Gate Park was built just for model boats.' },
    at: { x: -461.6, z: 1163.9 }, kind: 'ground',
    how: { zh: '白天在斯普雷克尔斯湖边站一会儿', en: 'Stand by Spreckels Lake a while, by day' },
    lines: [
      { zh: '这片湖 1904 年专门为模型船修好，模型游艇俱乐部就在湖边。', en: 'This lake was finished in 1904 just for model boats — the model yacht club is right here.' },
      { zh: '周二、四、六的 10 点到 13 点是动力船时间，其他时候湖面归帆船。', en: 'Tuesday, Thursday and Saturday, 10 to 1, are for powered boats; the rest of the time, the sailboats’.' },
    ],
    fact: {
      zh: '斯普雷克尔斯湖 1904 年 3 月建成，专供模型船使用；旧金山模型游艇俱乐部 1892 年成立，湖边会所 1937–1939 年由公共事业振兴署建成。',
      en: 'Spreckels Lake was completed in March 1904 for model boaters; the San Francisco Model Yacht Club formed in 1892, and its WPA clubhouse by the lake was built in 1937–39.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Spreckels_Lake', 'powered boats Tue / Thu / Sat 10:00–13:00; sailboats the rest of the time')],
    stamp: { zh: '模型帆船', en: 'Model yacht' },
  },
  {
    id: 'fort-funston-hang-gliders', n: 29, area: 'west-coast',
    name: { zh: '沙崖上的滑翔翼', en: 'Hang gliders at Fort Funston' },
    riddle: { zh: '海边沙崖上，谁在风里飞？', en: 'Who flies in the wind over the sandy cliffs?' },
    rumour: { zh: '听说城西南海边的沙崖上，常有人乘着风滑翔。', en: 'They say people ride the wind off the sandy cliffs on the south-west coast.' },
    at: { x: 100.4, z: 1846.3 }, kind: 'ground',
    how: { zh: '走到芬斯顿堡的观景台，或者骑鹈鹕飞过沙崖', en: 'Walk to the Fort Funston deck, or fly the pelican past the cliffs' },
    lines: [
      { zh: '看，滑翔翼！这片悬崖上的风又强又稳，最适合滑翔。', en: 'Look — hang gliders! The wind on these cliffs is strong and steady, perfect for gliding.' },
      { zh: '它们乘着海上吹来的风，在崖边飘来飘去。', en: 'They ride the sea wind back and forth along the cliffs.' },
    ],
    fact: {
      zh: '芬斯顿堡 1963 年停用后交给国家公园管理局；悬崖上又强又稳的风，让这里成了热门的滑翔翼场地。',
      en: 'Fort Funston was inactivated in 1963 and passed to the National Park Service; the strong, steady winds on its cliffs make it a popular hang-gliding site.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Fort_Funston')],
    stamp: { zh: '乘风', en: 'Ridge rider' },
  },
  {
    id: 'castro-theatre-organ', n: 30, area: 'mission-castro',
    name: { zh: '卡斯特罗剧院的管风琴', en: 'The Castro Theatre organ' },
    riddle: { zh: '招牌下的琴声，傍晚才响', en: 'Music under the marquee, after dusk' },
    rumour: { zh: '听说卡斯特罗剧院今年重新开门了，还搬来一台新管风琴。', en: 'They say the Castro Theatre reopened this year — with a new organ.' },
    at: { x: 154.5, z: 747 }, kind: 'ground',
    how: { zh: '傍晚或晚上，站到卡斯特罗剧院的招牌下', en: 'At golden hour or night, stand under the Castro Theatre’s marquee' },
    lines: [
      { zh: '剧院 2026 年 2 月重新开门啦，新管风琴也搬进来了！', en: 'The theatre reopened in February 2026 — and a new organ moved in!' },
      { zh: '这段琴声是我们自己编的小曲，欢迎回来！', en: 'That tune is our own little piece — welcome back!' },
    ],
    fact: {
      zh: '卡斯特罗剧院 1922 年开业；整修两年、花费 4100 万美元后，2026 年 2 月 6 日重新开放，新管风琴在开放前运到。',
      en: 'The Castro Theatre opened in 1922. After two years and a $41 million renovation it reopened on 6 February 2026; its new organ arrived just before.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Castro_Theatre')],
    stamp: { zh: '管风琴之夜', en: 'Organ night' },
  },
  {
    id: 'presidio-pet-cemetery', n: 31, area: 'marina-presidio',
    name: { zh: '要塞的宠物墓园', en: 'The Presidio pet cemetery' },
    riddle: { zh: '白栅栏里，住着谁的老朋友？', en: 'Whose old friends rest inside the white fence?' },
    rumour: { zh: '听说克里西场附近有个小小的宠物墓园，很安静。', en: 'They say there’s a small, quiet pet cemetery near Crissy Field.' },
    at: { x: -584, z: 601 }, kind: 'ground',
    how: { zh: '走到宠物墓园边，安静地待一会儿', en: 'Walk to the little pet cemetery and stay quietly a while' },
    lines: [
      { zh: '这是要塞的军人家庭给宠物建的小墓园，我们轻声点。', en: 'Army families at the Presidio made this little cemetery for their pets. Let’s be quiet.' },
      { zh: '我放一朵小花在这儿吧。', en: 'I’ll leave a little flower here.' },
    ],
    fact: {
      zh: '墓园始于 1950 年代初，安葬着要塞军人家庭的宠物；白色尖桩篱笆里有 424 块手做的墓碑，现在不再接收新的安葬。',
      en: 'Begun in the early 1950s for the pets of the Presidio’s Army families, the cemetery holds 424 handmade headstones inside a white picket fence; it no longer takes new burials.',
    },
    sources: [src('https://presidio.gov/explore/attractions/presidio-pet-cemetery')],
    stamp: { zh: '一朵小花', en: 'A flower' },
  },
  {
    id: 'grace-outdoor-labyrinth', n: 32, area: 'downtown',
    name: { zh: '大教堂门前的迷宫', en: 'Grace Cathedral’s outdoor labyrinth' },
    riddle: { zh: '山顶教堂的露台上，也有迷宫', en: 'A labyrinth on the hilltop church’s terrace' },
    rumour: { zh: '听说诺布山的大教堂门前有座迷宫，白天晚上都开着。', en: 'They say the cathedral on Nob Hill has a labyrinth outside, open day and night.' },
    at: { x: 8.2, z: 228.3 }, kind: 'ground',
    how: { zh: '在格雷斯大教堂门前露台的迷宫边，静静站一会儿', en: 'Stand quietly by the labyrinth on Grace Cathedral’s terrace' },
    lines: [
      { zh: '这座户外迷宫全天开放，图案照着法国沙特尔大教堂的老迷宫。', en: 'This outdoor labyrinth is open all day and night; its pattern follows the old one at Chartres.' },
    ],
    fact: {
      zh: '格雷斯大教堂有室内、室外两座沙特尔式迷宫；室外那座全天 24 小时开放。',
      en: 'Grace Cathedral has two Chartres-style labyrinths, one indoors and one outdoors; the outdoor one is open 24/7.',
    },
    sources: [src('https://gracecathedral.org/our-labyrinths/')],
    stamp: { zh: '第二座迷宫', en: 'Labyrinth two' },
  },
  {
    id: 'bay-lights', n: 33, area: 'downtown',
    name: { zh: '海湾大桥的灯', en: 'The Bay Lights' },
    riddle: { zh: '天黑以后，大桥在眨眼', en: 'After dark, the bridge twinkles' },
    rumour: { zh: '听说海湾大桥的灯今年又亮起来了，天黑后去内河码头看看。', en: 'They say the Bay Bridge lights are back this year — see them from the Embarcadero after dark.' },
    at: { x: 208.3, z: 10.4 }, kind: 'ground',
    how: { zh: '天黑后，在内河码头 14 号码头一带站着看海湾大桥', en: 'After dark, stand by Pier 14 on the Embarcadero and watch the Bay Bridge' },
    lines: [
      { zh: '海湾大桥的灯 2026 年 3 月又亮了，每晚从黄昏亮到天亮！', en: 'The Bay Bridge lights came back in March 2026 — every night from dusk to dawn!' },
      { zh: '这些闪闪的光是我们学着做的，真的灯更好看哦。', en: 'These twinkles are our own imitation — the real lights are lovelier.' },
    ],
    fact: {
      zh: '"海湾灯光"装在海湾大桥西段北侧的钢索上，共 48,000 颗 LED；2023 年熄灭，重建后于 2026 年 3 月 20 日重新点亮，每晚从黄昏亮到天亮。',
      en: 'The Bay Lights: 48,000 LEDs on the northern cable plane of the Bay Bridge’s western span. Dark from 2023, rebuilt and relit on 20 March 2026, they shine nightly from dusk to dawn.',
    },
    sources: [src('https://illuminate.org/2026/02/19/the-bay-lights-to-return-friday-march-20-2026/', 'relit 20 Mar 2026; 48,000 LEDs; northern cable plane of the western span; dusk to dawn')],
    stamp: { zh: '大桥的灯', en: 'Bay Lights' },
  },
];

/** Batch 1's append-only id list: `EGG_IDS[i]` is bit `i` of `play.g.egg` (lane E's 小发现 page). */
export const EGG_IDS: readonly string[] = EGGS.map(e => e.id);
/** Every egg, batch 1 then batch 2 (the whole bitset order: `ALL_EGG_IDS[i]` is bit `i` of `play.g.egg`). */
export const ALL_EGGS: readonly EggDef[] = [...EGGS, ...EGGS_BATCH_2];
export const ALL_EGG_IDS: readonly string[] = ALL_EGGS.map(e => e.id);

const BY_ID = new Map(ALL_EGGS.map(e => [e.id, e] as const));
export const eggById = (id: string): EggDef | undefined => BY_ID.get(id);
/** The egg's bit in `play.g.egg` (its index in ALL_EGG_IDS), or −1. */
export const eggIndex = (id: string): number => ALL_EGG_IDS.indexOf(id);
/** The ledger's pay-once key for an egg. */
export const eggRewardSource = (id: string): string => `egg:${id}`;
/** The eggs of an area (both batches), in the notebook's order. */
export const eggsInArea = (area: EggArea): EggDef[] => ALL_EGGS.filter(e => e.area === area);
/** Every spot of an egg (the main one first). */
export const eggSpots = (e: EggDef): { x: number; z: number }[] => [e.at, ...(e.also ?? [])];

/**
 * The fortune slips of the cookie trail (egg 5): one per Bay day, BAYBAY's own suggestions. The ones that state a fact
 * carry its source (walking the bridge is free: goldengate.org; never feed the sea lions: pier39.com; the Wave Organ is
 * best at high tide: Wikipedia), the rest are gentle nudges with no claim.
 */
export const FORTUNES: readonly Bilingual[] = [
  { zh: '今日签：走一段金门大桥的人行道——走路过桥不收费。', en: 'Today’s fortune: walk part of the Golden Gate Bridge — it’s free on foot.' },
  { zh: '今日签：去 39 号码头看看海狮，看就好，别喂。', en: 'Today’s fortune: visit the PIER 39 sea lions — watch, never feed.' },
  { zh: '今日签：找张长椅坐五分钟，什么都不用做。', en: 'Today’s fortune: find a bench and sit five minutes, doing nothing at all.' },
  { zh: '今日签：和 BAYBAY 爬一段台阶，数数有多少级。', en: 'Today’s fortune: climb some steps with BAYBAY and count them.' },
  { zh: '今日签：上双峰看看，Karl 今天在不在家。', en: 'Today’s fortune: go up Twin Peaks and see if Karl is home.' },
  { zh: '今日签：涨潮时去海浪风琴，把耳朵凑近听听。', en: 'Today’s fortune: visit the Wave Organ at high tide and listen close.' },
  { zh: '今日签：坐一次缆车，听听叮叮当当的铃声。', en: 'Today’s fortune: ride a cable car and listen for the bell.' },
];
export const FORTUNE_SOURCES: readonly EggSource[] = [
  src('https://www.goldengate.org/bridge/visiting-the-bridge/bikes-pedestrians/', 'no toll or fee for pedestrians'),
  src('https://www.pier39.com/sealions/', 'feeding is prohibited'),
  src('https://en.wikipedia.org/wiki/Wave_Organ', 'best heard at high tide'),
];
