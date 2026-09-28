import type { Bilingual } from '../core/types';
import type { EggArea, EggSource } from './registry';

/**
 * Wave 5 · lane D (W5-D6, should) · 城市之声 — twelve real San Francisco sounds collected by listening where (and when)
 * they happen: tap 听一听 (E on desktop) and stand still for LISTEN_S seconds; a few are collected by the moment that
 * plays them (the foghorn duet heard on the deck, the Tiled Steps climbed in one go, the laughing lady's door and the
 * Wave Organ's pipes, whose egg prompts already listen). Pure data: the card chunk and lane E's notebook read it.
 *
 * APPEND-ONLY. `SOUND_IDS[i]` is bit `i` of `play.g.sound`; the reward source is `sound:<id>` (5 金币, paid once by lane
 * E's ledger). Every fact was read on its page on `verifiedAt`. The sounds themselves are synthesized in our own toy
 * voice (eggs/sounds.ts): no recording, no real laugh, no real song, no copied bell pattern.
 */

export interface CitySoundDef {
  /** append-only id (the reward source is `sound:<id>`) */
  id: string;
  /** 1-based, the notebook's order */
  n: number;
  area: EggArea;
  name: Bilingual;
  /** the notebook's silhouette caption before it is heard (≤ 20 in zh) */
  riddle: Bilingual;
  /** where and when to listen, in the player's words */
  how: Bilingual;
  /** where the 听一听 prompt stands (city frame, standable) */
  at: { x: number; z: number };
  /** the prompt's reach (u) */
  radius: number;
  /** how it is collected: the prompt, or the moment that plays it (an egg's host calls `heard`) */
  by: 'listen' | 'moment';
  /** BAYBAY's line when it is collected (≤ 45 in zh) */
  line: Bilingual;
  /** the card's text (zh ≤ 64) */
  fact: Bilingual;
  sources: readonly EggSource[];
}

/** Coins a sound pays the first time (lane E's ledger caps `sound` at 5). */
export const SOUND_COINS = 5;
/** Seconds of standing still that collect a sound. */
export const LISTEN_S = 3;
export const SOUNDS_VERIFIED_AT = '2026-09-28';
const V = SOUNDS_VERIFIED_AT;
const src = (url: string, note?: string): EggSource => (note ? { url, verifiedAt: V, note } : { url, verifiedAt: V });

export const CITY_SOUNDS: readonly CitySoundDef[] = [
  {
    id: 'ggb-foghorns', n: 1, area: 'marina-presidio',
    name: { zh: '金门大桥的雾笛', en: 'The Golden Gate foghorns' },
    riddle: { zh: '大雾里，一低一高两种呜呜', en: 'In fog: one low hoot, one high' },
    how: { zh: '起雾时在金门大桥桥面上，两种雾笛都听到', en: 'In fog on the Golden Gate deck, hear both kinds of horn' },
    at: { x: -865.8, z: 508.6 }, radius: 0, by: 'moment',
    line: { zh: '一长一短两种雾笛，都收进城市之声啦！', en: 'The long one and the short ones — both in our city sounds now!' },
    fact: {
      zh: '雾天里，南塔桥墩的雾笛一次响 2 秒；桥中间的雾笛一秒一响，隔 2 秒再响一下，然后停 36 秒。',
      en: 'In fog the south tower pier’s horns sound for 2 seconds; mid-span’s give a 1-second blast, then another 2 seconds later, then rest 36 seconds.',
    },
    sources: [src('https://www.goldengate.org/bridge/history-research/bridge-features/foghorns-beacons/')],
  },
  {
    id: 'cable-car-bell', n: 2, area: 'downtown',
    name: { zh: '缆车的铃', en: 'The cable car bell' },
    riddle: { zh: '转车台边，叮叮当当', en: 'Ding-ding by the turntable' },
    how: { zh: '在鲍威尔街和市场街口的缆车转车台旁听一听', en: 'Listen by the cable car turntable at Powell & Market' },
    at: { x: 128.9, z: 263.9 }, radius: 4.5, by: 'listen',
    line: { zh: '叮叮——当当！这铃声一响，就知道是旧金山。', en: 'Ding-ding, clang! One ring and you know you’re in San Francisco.' },
    fact: {
      zh: '1955 年 4 月，第一届现在这样的缆车摇铃比赛在联合广场举行；此后的比赛几乎都在那里办。',
      en: 'The first cable car bell-ringing contest as we know it today was held in Union Square in April 1955; almost every contest since has been held there.',
    },
    sources: [src('https://archives.sfmta.com/cms/apress/SFMuniHistoryoftheCableCarBell-RingingCompetition.htm')],
  },
  {
    id: 'ferry-horn', n: 3, area: 'downtown',
    name: { zh: '渡轮离港的长笛', en: 'A ferry leaving the dock' },
    riddle: { zh: '渡轮大厦后面，一声长长的笛', en: 'One long blast behind the Ferry Building' },
    how: { zh: '白天在渡轮大厦 E 号登船口旁听一听', en: 'Listen by the Ferry Building’s Gate E by day' },
    at: { x: 157, z: -21 }, radius: 5, by: 'listen',
    line: { zh: '呜——！船离开码头要鸣一长声，这是航行规矩。', en: 'Hooonk! A boat leaving the dock sounds one long blast — that’s the rule.' },
    fact: {
      zh: '按美国内河航行规则，机动船离开码头要鸣一长声，长 4 到 6 秒。渡轮大厦 1898 年启用。',
      en: 'Under the US Inland Navigation Rules a power-driven vessel leaving a dock sounds one prolonged blast, 4 to 6 seconds long. The Ferry Building opened in 1898.',
    },
    sources: [
      src('https://www.law.cornell.edu/cfr/text/33/83.34', 'Rule 34(g): one prolonged blast leaving a dock or berth'),
      src('https://www.law.cornell.edu/cfr/text/33/83.32', 'a prolonged blast lasts 4 to 6 seconds'),
      src('https://en.wikipedia.org/wiki/San_Francisco_Ferry_Building', 'opened 13 July 1898'),
    ],
  },
  {
    id: 'sea-lions', n: 4, area: 'wharf',
    name: { zh: '海狮的"汪汪"', en: 'The sea lions’ barking' },
    riddle: { zh: '码头边，谁在汪汪叫？', en: 'Who’s barking by the pier?' },
    how: { zh: '在 39 号码头西边的栏杆旁听一听', en: 'Listen at the rail on PIER 39’s west side' },
    at: { x: -198.7, z: 3.8 }, radius: 4, by: 'listen',
    line: { zh: '听这嗓门！海狮叫起来可比小狗响多了。', en: 'Listen to that! Sea lions bark far louder than puppies.' },
    fact: {
      zh: '加州海狮聪明、爱玩，出了名地爱大声叫。它们受法律保护：不能喂，也不能碰。',
      en: 'California sea lions are known for their intelligence, playfulness and noisy barking. The law protects them: no feeding, no touching.',
    },
    sources: [src('https://www.pier39.com/sealions/', 'noisy barking; unlawful to feed, handle or harass them')],
  },
  {
    id: 'parrots', n: 5, area: 'north-beach',
    name: { zh: '野鹦鹉的叽叽喳喳', en: 'The wild parrots’ chatter' },
    riddle: { zh: '台阶花园上空，叽叽喳喳', en: 'Chatter over the stair gardens' },
    how: { zh: '白天在电报山的台阶花园里听一听', en: 'Listen in the Telegraph Hill stair gardens by day' },
    at: { x: -30.5, z: 37.7 }, radius: 4, by: 'listen',
    line: { zh: '叽叽喳喳——是野鹦鹉在聊天呢！', en: 'Chitter-chatter — the wild parrots are gossiping!' },
    fact: {
      zh: '这群野鹦鹉以樱桃头锥尾鹦鹉为主，在旧金山满城飞；2023 年成了旧金山的官方动物。',
      en: 'The flock is mostly cherry-headed conures that range across the city; in 2023 they became San Francisco’s official animal.',
    },
    sources: [src('https://en.wikipedia.org/wiki/The_Wild_Parrots_of_Telegraph_Hill')],
  },
  {
    id: 'wave-organ', n: 6, area: 'marina-presidio',
    name: { zh: '海浪风琴', en: 'The Wave Organ' },
    riddle: { zh: '防波堤尽头，海在管子里唱', en: 'The sea sings in pipes at the jetty’s end' },
    how: { zh: '在马里纳区防波堤尽头，把耳朵凑近管口', en: 'Put your ear to a pipe at the end of the Marina jetty' },
    at: { x: -413, z: 289.8 }, radius: 0, by: 'moment',
    line: { zh: '咕噜咕噜……海浪在管子里唱歌，涨潮时最响。', en: 'Gurgle, gurgle… the waves sing in the pipes — loudest at high tide.' },
    fact: {
      zh: '海浪风琴有 25 根管子，浪涌进管口，发出隆隆、咕噜、嘶嘶声，涨潮时最好听。1986 年由探索馆建成。',
      en: 'The Wave Organ’s 25 pipes turn the waves into rumbles, gurgles and hisses, best heard at high tide. The Exploratorium built it in 1986.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Wave_Organ')],
  },
  {
    id: 'laughing-lady', n: 7, area: 'wharf',
    name: { zh: '大笑女士的笑声', en: 'The laughing lady' },
    riddle: { zh: '老游戏厅门口，哈哈哈哈', en: 'Ha-ha-ha at the old arcade door' },
    how: { zh: '在 45 号码头老游戏厅门口听一听', en: 'Listen at the old arcade’s door on Pier 45' },
    at: { x: -214.7, z: 71.3 }, radius: 0, by: 'moment',
    line: { zh: '哈哈哈……这笑声会传染，我收起来啦！', en: 'Ha ha ha… that laugh is catching — I’ve kept it!' },
    fact: {
      zh: '这是我们自己做的笑声，不是原来的录音。"大笑女士"原在海边乐园门口；如今 45 号码头的机械博物馆也有一位。',
      en: 'This laugh is our own, not the original recording. Laffing Sal once laughed at Playland-at-the-Beach; one now laughs at the Musée Mécanique on Pier 45.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Laffing_Sal'), src('https://en.wikipedia.org/wiki/Mus%C3%A9e_M%C3%A9canique')],
  },
  {
    id: 'sea-cave', n: 8, area: 'west-coast',
    name: { zh: '苏特罗浴场的石洞', en: 'The Sutro Baths tunnel' },
    riddle: { zh: '浴场废墟边，石洞在轰隆', en: 'A rock tunnel booms by the ruins' },
    how: { zh: '在苏特罗浴场废墟的隧道口听一听', en: 'Listen at the tunnel mouth by the Sutro Baths ruins' },
    at: { x: -738.5, z: 1239.6 }, radius: 5, by: 'listen',
    line: { zh: '轰——隆——浪打到隧道那头了！浪大时别往里走哦。', en: 'Boom… the waves hit the far end! In big surf, we don’t go in.' },
    fact: {
      zh: '这条隧道是修浴场时运石头挖的，1892 年完工，约 46 米长；那头就是大海。',
      en: 'The tunnel was dug to haul rock while the baths were built and was finished in 1892, about 152 feet long; the ocean is at its far end.',
    },
    sources: [
      src('https://www.sfgate.com/obscuresf/article/historic-tunnel-at-SF-Sutro-Baths-16988820.php', 'SFGATE, 2022-03-14: a quarry tunnel, completed 1892, about 10 ft wide and 152 ft long'),
      src('https://en.wikipedia.org/wiki/Sutro_Baths', 'the ruins: walls, stairs and a tunnel with a deep crevice'),
    ],
  },
  {
    id: 'tiled-steps', n: 9, area: 'golden-gate-park',
    name: { zh: '从海到星星的台阶', en: 'Steps from sea to stars' },
    riddle: { zh: '一口气爬完，听见三种声音', en: 'Climb in one go, hear three sounds' },
    how: { zh: '一口气爬完第 16 大道的马赛克台阶', en: 'Climb the 16th Avenue mosaic steps in one go' },
    at: { x: -109.8, z: 1139.9 }, radius: 0, by: 'moment',
    line: { zh: '泡泡、鸟叫、星星叮——从海底爬到天上啦！', en: 'Bubbles, birdsong, star chimes — from the seabed to the sky!' },
    fact: {
      zh: '第 16 大道马赛克台阶共 163 级，高约 27 米，图案从大海一路铺到天空；2005 年由街坊们一起完成。',
      en: 'The 16th Avenue Tiled Steps: 163 steps rising 90 feet, a mosaic running from the sea to the sky, opened in 2005 with the neighbours.',
    },
    sources: [src('https://en.wikipedia.org/wiki/16th_Avenue_Tiled_Steps')],
  },
  {
    id: 'festival-banjos', n: 10, area: 'golden-gate-park',
    name: { zh: '音乐节的班卓琴', en: 'Festival banjos' },
    riddle: { zh: '十月初的周末，草地上弹琴', en: 'Strings on the grass, early October' },
    how: { zh: '十月第一个周末，在金门公园 Hellman Hollow 听一听', en: 'Listen at Hellman Hollow in Golden Gate Park on the first weekend of October' },
    at: { x: -366.5, z: 1117.5 }, radius: 14, by: 'listen',
    line: { zh: '班卓琴一响，脚就想跟着打拍子！', en: 'When the banjo rolls, your feet start tapping!' },
    fact: {
      zh: '蓝草音乐节 2001 年起每年十月第一个周末在金门公园 Hellman Hollow 举办，免费。我们的琴声是自己弹的。',
      en: 'Hardly Strictly Bluegrass has filled Hellman Hollow in Golden Gate Park, free, on the first weekend of October since 2001. Our banjo tune is our own.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Hardly_Strictly_Bluegrass')],
  },
  {
    id: 'taiko', n: 11, area: 'marina-presidio',
    name: { zh: '樱花节的太鼓', en: 'Cherry blossom taiko' },
    riddle: { zh: '四月周末，日本城咚咚响', en: 'April weekends: drums in Japantown' },
    how: { zh: '四月樱花节的周末，在日本城和平广场听一听', en: 'Listen at Japantown’s Peace Plaza on the April festival weekends' },
    at: { x: -65.5, z: 446.3 }, radius: 10, by: 'listen',
    line: { zh: '咚！咚咚！太鼓的声音从脚底震上来！', en: 'Don! Don-don! The taiko shakes you from the feet up!' },
    fact: {
      zh: '北加州樱花节每年四月在日本城办两个周末（2026 年是 11–12 日和 18–19 日），太鼓是节日和游行的重头戏。',
      en: 'The Northern California Cherry Blossom Festival fills Japantown over two weekends each April (in 2026: the 11th–12th and 18th–19th); taiko drumming is at the heart of it.',
    },
    sources: [src('https://www.sftravel.com/article/everything-you-need-to-know-about-cherry-blossom-festival', 'annual, in April, two weekends; taiko integral to the parade and festivities')],
  },
  {
    id: 'karl-wind', n: 12, area: 'mission-castro',
    name: { zh: 'Karl 的风', en: 'Karl’s wind' },
    riddle: { zh: '起雾的山顶，风在呼呼吹', en: 'Wind whistling on a foggy summit' },
    how: { zh: 'Karl 来的时候，在双峰顶上听一听', en: 'Listen on top of Twin Peaks when Karl rolls in' },
    at: { x: 125.7, z: 937.8 }, radius: 12, by: 'listen',
    line: { zh: '呼——呼——这是 Karl 从海上带来的风。', en: 'Whooo — that’s the wind Karl brings in from the sea.' },
    fact: {
      zh: '双峰海拔约 282 米，朝西的山坡常有雾和大风；它挡住夏天从太平洋推过来的雾。',
      en: 'Twin Peaks rise about 925 feet; their west slopes often get fog and strong winds, and they hold back the summer fog pushed in from the Pacific.',
    },
    sources: [src('https://en.wikipedia.org/wiki/Twin_Peaks_(San_Francisco)')],
  },
];

/** The append-only id list: `SOUND_IDS[i]` is bit `i` of `play.g.sound`. */
export const SOUND_IDS: readonly string[] = CITY_SOUNDS.map(s => s.id);
const BY_ID = new Map(CITY_SOUNDS.map(s => [s.id, s] as const));
export const soundById = (id: string): CitySoundDef | undefined => BY_ID.get(id);
export const soundRewardSource = (id: string): string => `sound:${id}`;
