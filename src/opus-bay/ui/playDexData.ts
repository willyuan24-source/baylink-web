import type { Bilingual, Vec2 } from '../core/types';

/**
 * Wave 9 · lane G · 游乐图鉴 — every mini-game of the city in one list (review 2026-10-01 R§5 #13: "约 22 个小游戏没有目录，地图
 * 没有「玩」的筛选"). Pure data and helpers, shared by the journal's 游乐 tab (ui/PlayDex.tsx), the map's 玩 filter
 * (ui/mapFilterRules.ts, ui/CityMapList.tsx, ui/mapGames.tsx) and BAYBAY's 附近能玩什么？ (play/dexEntry.ts).
 *
 * Nothing here imports play/ (tests/opus-bay-w5-play-acts: only dynamic imports reach play/ from outside the folder): the
 * spots are copies of the games' own prompt points, pinned to them by tests/opus-bay-w9-g-dex.test.ts (≤ 0.5 u). A spot is
 * where 带我去 ends — the game's prompt, not the place's centre (the review: the trip to the Musée ended 3.7 u from the claw,
 * where only 坐下 showed). Games with several spots go to the nearest; games with none can start anywhere (现在就玩).
 *
 * Played / medals are read from the save by the caller (economy/ledger isPaid on `medal:<id>:<tier>`, `play.b`): see
 * dexMedal / dexPlayed.
 */

export type DexGroup = 'waterfront' | 'cable' | 'lawns' | 'hills' | 'streets' | 'wheels' | 'anywhere';
export type DexIcon =
  | 'grab' | 'sparkles' | 'croissant' | 'paw' | 'shell' | 'megaphone' | 'bell' | 'cable' | 'rotate' | 'wind' | 'disc' | 'ball'
  | 'flame' | 'sled' | 'slide' | 'steps' | 'guitar' | 'spline' | 'mountain' | 'bird' | 'search' | 'binoculars';
/** How a game is started, when it is not a prompt at its spot (shown under the rule). */
export type DexStart = 'hide-seek' | 'skyline';

export interface DexGame {
  /** the row id = the activity id the kit keeps its medals / best under (or the first of `medals`) */
  id: string;
  /** the activity ids whose `medal:<id>:<tier>` count for this row (default [id]) */
  medals?: readonly string[];
  /** `play.b` keys that mean "played" besides the medals / best (the fortune teller has no medal) */
  playedKeys?: readonly string[];
  group: DexGroup;
  icon: DexIcon;
  name: Bilingual;
  /** where it is (and when, when it has hours) */
  where: Bilingual;
  /** the one-line rule (shown once played; with the clue before) */
  rule: Bilingual;
  /** the clue shown under the silhouette while it has never been played */
  clue: Bilingual;
  /** the game prompts' points (带我去 ends at the nearest); empty: anywhere */
  spots: readonly Vec2[];
  /** a start from anywhere (现在就玩) */
  start?: DexStart;
  /** what it needs: a ride, a vehicle, the pelican (shown as a small note) */
  needs?: Bilingual;
}

export const DEX_GROUPS: readonly { id: DexGroup; name: Bilingual }[] = [
  { id: 'waterfront', name: { zh: '海边码头', en: 'On the waterfront' } },
  { id: 'cable', name: { zh: '坐叮当车', en: 'On the cable cars' } },
  { id: 'lawns', name: { zh: '草地和沙滩', en: 'Lawns and beaches' } },
  { id: 'hills', name: { zh: '山坡和台阶', en: 'Hills and steps' } },
  { id: 'streets', name: { zh: '街头', en: 'Street corners' } },
  { id: 'wheels', name: { zh: '骑车 · 开车 · 飞', en: 'Wheels and wings' } },
  { id: 'anywhere', name: { zh: '随时随地', en: 'Anywhere' } },
];

/** The Powell & Market turntable (attractions `cable-car-powell-market` arrival): the bell, the grip and the heave-ho. */
const POWELL_MARKET: Vec2 = { x: 131.58, z: 254.17 };

/** The 12 crest hops (play/crestSpots.ts CREST_SPOTS, in its order). */
const CRESTS: readonly Vec2[] = [
  { x: -154.2, z: 240.4 }, { x: -25.1, z: 132.5 }, { x: -107.5, z: 147.4 }, { x: -206.4, z: 498.3 }, { x: -201.8, z: 351.1 }, { x: 20.6, z: 674 },
  { x: 208.9, z: 794.7 }, { x: 292.4, z: 899.2 }, { x: 424.7, z: 465.7 }, { x: 609.7, z: 871.4 }, { x: 371.1, z: 1158.7 }, { x: -616.9, z: 1218.3 },
];

/**
 * Every game, in the list's order (by group). APPEND-friendly: the ids are the kit's activity ids (the medals and bests
 * already saved keep meaning the same game).
 */
export const DEX_GAMES: readonly DexGame[] = [
  // --- on the waterfront
  {
    id: 'claw', group: 'waterfront', icon: 'grab', playedKeys: ['claw-set'],
    name: { zh: '机械博物馆抓娃娃', en: 'Musée claw machine' },
    where: { zh: '渔人码头 · 机械博物馆门口', en: 'Fisherman’s Wharf · outside the Musée Mécanique' },
    rule: { zh: '5 枚硬币：左右对准，按「抓！」放爪，抓出来的纪念品归你', en: 'Five quarters: line the claw up, press Grab, keep what it carries out' },
    clue: { zh: '渔人码头有家老游戏厅，门口的玻璃柜里装满小纪念品……', en: 'An old arcade on the Wharf keeps a glass case full of tiny souvenirs…' },
    spots: [{ x: -202.8, z: 71.8 }],
  },
  {
    id: 'fortune', group: 'waterfront', icon: 'sparkles', playedKeys: ['fortune-n'],
    name: { zh: '机械博物馆算一卦', en: 'Musée fortune teller' },
    where: { zh: '渔人码头 · 机械博物馆门口', en: 'Fisherman’s Wharf · outside the Musée Mécanique' },
    rule: { zh: '算命机器人吐出一张运势卡，背面是一个旧金山小知识', en: 'The automaton slides out a fortune with a San Francisco fact' },
    clue: { zh: '抓娃娃机旁边，坐着一位会看水晶球的机器人……', en: 'Beside the claw machine sits an automaton with a crystal ball…' },
    spots: [{ x: -199.4, z: 70.8 }],
  },
  {
    id: 'sourdough', group: 'waterfront', icon: 'croissant',
    name: { zh: '捏酸面包', en: 'Shaping sourdough' },
    where: { zh: '渔人码头 · 面包房门口', en: 'Fisherman’s Wharf · by the bakery' },
    rule: { zh: '揉面、捏成螃蟹或乌龟、划口、出炉：四步做一个酸面包', en: 'Knead, shape a crab or a turtle, score, bake: a loaf in four steps' },
    clue: { zh: '渔人码头飘着面包香，顺着味道找找看……', en: 'Follow the smell of fresh bread along the Wharf…' },
    spots: [{ x: -193.4, z: 66.4 }],
  },
  {
    id: 'sealions', group: 'waterfront', icon: 'paw',
    name: { zh: '数海狮', en: 'Counting sea lions' },
    where: { zh: '39 号码头 · K 码头栏杆边', en: 'PIER 39 · the K-Dock rail' },
    rule: { zh: '每只海狮点一下给它编号，数完点「数好了」', en: 'Tap each sea lion once to number it, then Done' },
    clue: { zh: '39 号码头有片浮台，一群大家伙整天在上面晒太阳……', en: 'A float at PIER 39 where big fellows bask all day…' },
    spots: [{ x: -202.94, z: -0.47 }],
  },
  {
    id: 'crab', group: 'waterfront', icon: 'shell',
    name: { zh: '7 号码头捞螃蟹', en: 'Crabbing off Pier 7' },
    where: { zh: '内河码头 · 7 号码头栏杆边', en: 'The Embarcadero · the Pier 7 rail' },
    rule: { zh: '放网、等、稳稳拉起；黄道蟹一律放回，石蟹满 4 英寸才算数', en: 'Drop the net, wait, haul steadily; Dungeness go back, rock crabs count from 4 in' },
    clue: { zh: '有座长长的钓鱼码头，栏杆边挂着捞网……', en: 'A long fishing pier with hoop nets by the rail…' },
    spots: [{ x: 73.6, z: -24.3 }],
  },
  {
    id: 'foghorn', group: 'waterfront', icon: 'megaphone',
    name: { zh: '金门大桥雾笛对答', en: 'Golden Gate foghorns' },
    where: { zh: 'Fort Point 炮台 · 金门大桥南端桥下', en: 'Fort Point · under the Golden Gate’s south end' },
    rule: { zh: '听大桥吹的雾笛，按顺序吹回去，船就能从雾里开过去', en: 'Blow the bridge’s horns back in order and the ship sails out of the fog' },
    clue: { zh: '起雾时大桥会「呜——」地叫，桥下面还有座老炮台……', en: 'In the fog the bridge goes “booo” — and an old fort sits right under it…' },
    spots: [{ x: -743.71, z: 590.25 }],
  },
  // --- on the cable cars
  {
    id: 'bell', group: 'cable', icon: 'bell',
    name: { zh: '缆车摇铃', en: 'Cable-car bell' },
    where: { zh: '任何一辆叮当车上（开动以后）', en: 'On any cable car, once it moves' },
    rule: { zh: '司机摇一段，你照着摇回去，最后跟着爵士节奏随便摇', en: 'The gripman rings, you ring it back, then jam along' },
    clue: { zh: '坐上叮当车，车头那只大铃铛是可以摇的……', en: 'Ride a cable car — that big bell up front can be rung…' },
    spots: [POWELL_MARKET],
    needs: { zh: '在转车台坐上叮当车', en: 'Board a cable car at the turntable' },
  },
  {
    id: 'grip', group: 'cable', icon: 'cable',
    name: { zh: '叮当车拉闸', en: 'Cable-car grip' },
    where: { zh: '鲍威尔街的叮当车上（开动以后）', en: 'On a Powell St cable car, once it moves' },
    rule: { zh: '上坡一直握紧拉闸，路口和转弯这些红色路段之前松开', en: 'Hold the grip uphill, let go before the red stretches' },
    clue: { zh: '叮当车司机手里那根长长的拉杆，是干什么用的？', en: 'What is that long lever in the gripman’s hands for?' },
    spots: [POWELL_MARKET],
    needs: { zh: '在转车台坐上鲍威尔街的叮当车', en: 'Board a Powell St car at the turntable' },
  },
  {
    id: 'heave', group: 'cable', icon: 'rotate',
    name: { zh: '嘿咻推转盘', en: 'Heave-ho turntable' },
    where: { zh: '鲍威尔街 · 市场街转车台（叮当车掉头时）', en: 'The Powell & Market turntable, while a car turns' },
    rule: { zh: '跟着 BAYBAY 的「嘿——咻！」，踩着节拍推', en: 'Push on the beat of BAYBAY’s “heave — ho!”' },
    clue: { zh: '叮当车开到终点，要靠人推着转盘掉头……', en: 'At the end of the line, people push the cable car round…' },
    spots: [POWELL_MARKET],
  },
  // --- lawns and beaches
  {
    id: 'kite', group: 'lawns', icon: 'wind',
    name: { zh: '放风筝', en: 'Kite flying' },
    where: { zh: '码头绿地 · 克里西场草坪（问 BAYBAY → 放风筝）', en: 'Marina Green · Crissy Field lawn (Ask BAYBAY → Kite flying)' },
    rule: { zh: '有阵风时按住放线，风小了就松手让它爬高', en: 'Hold to let the line out in a gust, let go to climb in a lull' },
    clue: { zh: '海边那片风很大的草地上，天上总飘着几只风筝……', en: 'Over a windy lawn by the bay, kites are always up…' },
    spots: [{ x: -382, z: 300.8 }, { x: -573.4, z: 547.6 }],
  },
  {
    id: 'frisbee', group: 'lawns', icon: 'disc',
    name: { zh: '和 BAYBAY 玩飞盘', en: 'Frisbee with BAYBAY' },
    where: { zh: '任何草地或沙滩（问 BAYBAY → 玩飞盘）', en: 'Any lawn or beach (Ask BAYBAY → Play frisbee)' },
    rule: { zh: '点地面把飞盘扔出去，BAYBAY 跑去接，一共 5 次', en: 'Tap the ground to throw; BAYBAY runs for it, five throws' },
    clue: { zh: '找片空草地，BAYBAY 包里好像有个圆圆的东西……', en: 'Find an open lawn — BAYBAY has something round in her bag…' },
    spots: [{ x: -382, z: 300 }, { x: 240, z: 696 }],
  },
  {
    id: 'beachball', group: 'lawns', icon: 'ball',
    name: { zh: '颠沙滩球', en: 'Beach-ball rally' },
    where: { zh: '沙滩上（问 BAYBAY → 玩沙滩球）', en: 'On the sand (Ask BAYBAY → Beach ball)' },
    rule: { zh: '跑到影子下面，球低的时候点一下把它颠起来', en: 'Get under the shadow and tap when the ball is low' },
    clue: { zh: '光脚踩在沙滩上的时候，问问 BAYBAY 想玩什么……', en: 'Barefoot on the sand? Ask BAYBAY what she wants to play…' },
    spots: [{ x: -565, z: 1365 }],
  },
  {
    id: 'marshmallow', group: 'lawns', icon: 'flame',
    name: { zh: '烤棉花糖', en: 'Toasting marshmallows' },
    where: { zh: '海洋海滩 · 篝火圈（3–10 月，6:00–21:30）', en: 'Ocean Beach fire rings (Mar–Oct, 6 am–9:30 pm)' },
    rule: { zh: '按住在火上烤，金黄的时候松手；烤太久会着火', en: 'Hold it in the flame, let go when golden — too long and it catches' },
    clue: { zh: '海滩上一排圆圆的篝火圈，天黑前就有人生火了……', en: 'A row of fire rings on the beach, lit before dark…' },
    spots: [{ x: -579.74, z: 1345.95 }],
  },
  {
    id: 'sled', group: 'lawns', icon: 'sled',
    name: { zh: '纸板滑草', en: 'Cardboard grass slide' },
    where: { zh: '陡草坡上（比如多洛雷斯公园）', en: 'Steep lawns (Dolores Park, say)' },
    rule: { zh: '站在陡坡上按「滑草」坐纸板滑下去，往后靠更快', en: 'On a steep lawn press Slide down; lean back to go faster' },
    clue: { zh: '公园里有片很陡的草坡，小朋友都坐着纸板往下冲……', en: 'Kids race down a steep park lawn on sheets of cardboard…' },
    spots: [{ x: 240, z: 696 }],
  },
  // --- hills and steps
  {
    id: 'slides', group: 'hills', icon: 'slide',
    name: { zh: '纸板滑梯', en: 'Cardboard slides' },
    where: { zh: '西沃德街滑梯（周二到周日 10–17 点）', en: 'Seward Street Slides (Tue–Sun, 10 to 5)' },
    rule: { zh: '和 BAYBAY 一起坐纸板滑下去，按住躺平更快', en: 'Whoosh down with BAYBAY; hold to lie back and go faster' },
    clue: { zh: '卡斯特罗区的小山上，藏着两条长长的水泥滑梯……', en: 'Two long concrete slides hide on a little hill in the Castro…' },
    spots: [{ x: 154.34, z: 838.5 }],
  },
  {
    id: 'stairs-filbert', group: 'hills', icon: 'steps',
    name: { zh: '台阶赛跑 · 菲尔伯特台阶', en: 'Stair race · Filbert Steps' },
    where: { zh: '电报山 · 菲尔伯特台阶脚下', en: 'Telegraph Hill · the foot of the Filbert Steps' },
    rule: { zh: '3 · 2 · 1 · 跑！和 BAYBAY 比谁先爬到顶', en: '3 · 2 · 1 · go! Race BAYBAY to the top' },
    clue: { zh: '通往科伊特塔的花园台阶，BAYBAY 说她爬得比你快……', en: 'The garden steps up to Coit Tower — BAYBAY says she’s faster…' },
    spots: [{ x: -23.5, z: 24.5 }],
  },
  {
    id: 'stairs-tiled', group: 'hills', icon: 'steps',
    name: { zh: '台阶赛跑 · 马赛克阶梯', en: 'Stair race · Tiled Steps' },
    where: { zh: '金门高地 · 16 大道马赛克阶梯脚下', en: 'Golden Gate Heights · the foot of the 16th Ave Tiled Steps' },
    rule: { zh: '3 · 2 · 1 · 跑！和 BAYBAY 比谁先爬到顶', en: '3 · 2 · 1 · go! Race BAYBAY to the top' },
    clue: { zh: '日落区有段台阶，每一级都贴着彩色马赛克……', en: 'In the Sunset, every step of a stairway is a mosaic…' },
    spots: [{ x: -117, z: 1147.5 }],
  },
  {
    id: 'stairs-lyon', group: 'hills', icon: 'steps',
    name: { zh: '台阶赛跑 · 里昂街台阶', en: 'Stair race · Lyon Street Steps' },
    where: { zh: '太平洋高地 · 里昂街台阶脚下', en: 'Pacific Heights · the foot of the Lyon Street Steps' },
    rule: { zh: '3 · 2 · 1 · 跑！和 BAYBAY 比谁先爬到顶', en: '3 · 2 · 1 · go! Race BAYBAY to the top' },
    clue: { zh: '要塞公园边上有段长长的白台阶，跑步的人最爱……', en: 'Long white steps by the Presidio, the joggers’ favourite…' },
    spots: [{ x: -312.49, z: 498.05 }],
  },
  // --- street corners
  {
    id: 'busk', group: 'streets', icon: 'guitar',
    name: { zh: '和街头艺人合奏', en: 'Jam with the busker' },
    where: { zh: '海特街 × 阿什伯里街 · 24 街（下午）', en: 'Haight × Ashbury · 24th St (afternoons)' },
    rule: { zh: '点子滑进圈里时点一下：海特街打手鼓，24 街摇沙锤', en: 'Tap as each dot meets the ring: tambourine on Haight, maracas on 24th' },
    clue: { zh: '下午的街角有人弹吉他，琴盒里还有空位……', en: 'An afternoon guitarist on a street corner, room in his case…' },
    spots: [{ x: -36.97, z: 757.32 }, { x: 455, z: 636.47 }],
  },
  // --- wheels and wings
  {
    id: 'crests', group: 'wheels', icon: 'mountain',
    name: { zh: '坡顶飞跃', en: 'Crest hops' },
    where: { zh: '全城 12 个插小旗的坡顶', en: 'Twelve pennanted crests across the city' },
    rule: { zh: '骑车或开车快速冲过坡顶，飞起来就算数，不比速度', en: 'Hit a crest fast on the bike or the toy car and fly — style, not speed' },
    clue: { zh: '旧金山的坡顶上插着小旗，骑快一点会怎样？', en: 'Little pennants on the city’s hilltops — what if you go fast?' },
    spots: CRESTS,
    needs: { zh: '骑车或开车（F）', en: 'A bike or the toy car (F)' },
  },
  {
    id: 'crooked', medals: ['crooked-lombard', 'crooked-vermont'], group: 'wheels', icon: 'spline',
    name: { zh: '慢慢开下弯弯街', en: 'Gently down a crooked street' },
    where: { zh: '九曲花街 · 佛蒙特街的坡顶', en: 'The top of Lombard St · Vermont St' },
    rule: { zh: '骑车或开车从坡顶开进弯道，慢慢开，别超过限速牌', en: 'Ride in at the top and keep under the speed sign, no bumps' },
    clue: { zh: '世界上最弯的街？骑车从坡顶慢慢下来试试……', en: 'The crookedest street? Ride down from the top, slowly…' },
    spots: [{ x: -163.02, z: 177.29 }, { x: 449.45, z: 500.5 }],
    needs: { zh: '骑车或开车（F）', en: 'A bike or the toy car (F)' },
  },
  {
    id: 'ggb-rings', group: 'wheels', icon: 'bird',
    name: { zh: '金门大桥金圈', en: 'Golden Gate rings' },
    where: { zh: '金门大桥上空（骑鹈鹕）', en: 'Over the Golden Gate (on the pelican)' },
    rule: { zh: '骑鹈鹕从桥边飞过，穿过 8 个金圈', en: 'Glide past the bridge on the pelican through the 8 golden rings' },
    clue: { zh: '金门大桥边的天上，挂着一串发光的圈……', en: 'A string of glowing rings hangs in the sky by the bridge…' },
    spots: [{ x: -702.4, z: 605.6 }],
    needs: { zh: '鹈鹕朋友（按 G 起飞）', en: 'Your pelican friend (G to take off)' },
  },
  // --- anywhere
  {
    id: 'hide-seek', group: 'anywhere', icon: 'search', start: 'hide-seek',
    name: { zh: '捉迷藏', en: 'Hide & seek' },
    where: { zh: '随时随地（问 BAYBAY → 捉迷藏）', en: 'Anywhere (Ask BAYBAY → Hide & seek)' },
    rule: { zh: '数三下，跟着「暖了 / 冷了」找到藏起来的 BAYBAY', en: 'Count to three, then follow warmer / colder to find her' },
    clue: { zh: 'BAYBAY 最会藏了，你找得到她吗？', en: 'BAYBAY is great at hiding — can you find her?' },
    spots: [],
  },
  {
    id: 'skyline', group: 'anywhere', icon: 'binoculars', start: 'skyline',
    name: { zh: '那是什么？认地标', en: 'What’s that? Landmarks' },
    where: { zh: '看得见风景的地方（问 BAYBAY → 那是什么？）', en: 'Anywhere with a view (Ask BAYBAY → What’s that?)' },
    rule: { zh: '镜头转向远处的地标，从三个名字里选对的', en: 'The camera turns to a landmark: pick its name from three' },
    clue: { zh: '站在高处往远看，那座塔叫什么来着？', en: 'Look out from somewhere high — what is that tower called?' },
    spots: [],
  },
];

/**
 * W9-G4 · 今日小游戏: the ledger source the first finished game of a Bay day pays (play/kit.ts todaySource, pinned equal by
 * tests/opus-bay-w9-g-play.test.ts) and its coins: the guide's header says whether today's is paid.
 */
export const TODAY_GAME_N = 4;
export const TODAY_GAME_COINS = 10;
export const todayGameSource = (dateKey: string) => `daily:${dateKey}:${TODAY_GAME_N}`;

export const dexGame = (id: string): DexGame | undefined => DEX_GAMES.find(g => g.id === id);
export const dexMedalIds = (g: Pick<DexGame, 'id' | 'medals'>): readonly string[] => g.medals ?? [g.id];

/** The nearest spot of a game from `p` and its straight distance (u); null for an anywhere game. */
export function nearestSpot(g: Pick<DexGame, 'spots'>, p: Vec2): { spot: Vec2; d: number } | null {
  let best: { spot: Vec2; d: number } | null = null;
  for (const s of g.spots) {
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (!best || d < best.d) best = { spot: s, d };
  }
  return best;
}

/** The `n` games whose nearest spot is closest to `p` (games with a spot only; ties by list order). */
export function nearestGames(p: Vec2, n = 3, list: readonly DexGame[] = DEX_GAMES): { game: DexGame; spot: Vec2; d: number }[] {
  const out: { game: DexGame; spot: Vec2; d: number; i: number }[] = [];
  list.forEach((game, i) => { const s = nearestSpot(game, p); if (s) out.push({ game, spot: s.spot, d: s.d, i }); });
  return out.sort((a, b) => a.d - b.d || a.i - b.i).slice(0, n).map(({ game, spot, d }) => ({ game, spot, d }));
}

/** The best medal tier ever paid for a game (0: none): `paid(source)` = economy/ledger isPaid. */
export function dexMedal(g: Pick<DexGame, 'id' | 'medals'>, paid: (source: string) => boolean): 0 | 1 | 2 | 3 {
  let best: 0 | 1 | 2 | 3 = 0;
  for (const id of dexMedalIds(g)) for (const t of [3, 2, 1] as const) if (t > best && paid(`medal:${id}:${t}`)) best = t;
  return best;
}

/** Played at least once: a medal, a best kept under one of its ids, or one of its own `play.b` keys. */
export function dexPlayed(g: DexGame, bests: Readonly<Record<string, unknown>>, paid: (source: string) => boolean): boolean {
  if (dexMedal(g, paid) > 0) return true;
  for (const k of [...dexMedalIds(g), ...(g.playedKeys ?? [])]) if (typeof bests[k] === 'number' && Number.isFinite(bests[k] as number)) return true;
  return false;
}

/** The map pins of the 玩 layer: one per spot (a game with several spots has several), keyed `game:<id>:<i>`. */
export interface GamePin { key: string; game: DexGame; at: Vec2 }
export function gamePins(list: readonly DexGame[] = DEX_GAMES): GamePin[] {
  return list.flatMap(game => game.spots.map((at, i) => ({ key: `game:${game.id}:${i}`, game, at })));
}

/** The goTo target of a game spot: a synthetic id (never an attraction: the trip ends at the point) and the game's name. */
export const gameGoTarget = (g: Pick<DexGame, 'id' | 'name'>, spot: Vec2) => ({ placeId: `game:${g.id}`, point: { x: spot.x, z: spot.z }, name: g.name });
