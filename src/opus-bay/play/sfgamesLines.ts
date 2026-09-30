import type { Bilingual } from '../core/types';

/**
 * Wave 7 · lane M · the San Francisco mini-games' names and BAYBAY's FIXED lines (zh + en, never templated: lane X
 * voices lines by their exact text — a count or a score goes on the chip or the card, never into a bubble). One small
 * module the zones chunk (play/sfgames.ts) and each game's chunk import.
 *
 *   claw       the Musée Mécanique at Pier 45: a toy claw machine full of San Francisco souvenirs, and the fortune-teller
 *              automaton beside it (a fortune is a real San Francisco fact)
 *   crab       crabbing off Pier 7 with a hoop net: drop it, wait, pull at the right moment, measure, and let them go
 *   sourdough  shaping a sourdough loaf at a Wharf bakery: knead, score, bake
 *
 * Facts (checked on the web 2026-09-29): the Musée Mécanique — Pier 45 since 2002 (the Cliff House basement before,
 * Playland before that), over 300 coin-operated machines, free to walk in, most games a quarter or two, the oldest a
 * praxinoscope from 1884, Laffing Sal (https://en.wikipedia.org/wiki/Mus%C3%A9e_M%C3%A9canique,
 * https://www.sanfranciscobay.com/museums/musee-mecanique/); crabbing — "Dungeness crab … may not be taken from, or
 * possessed if taken from, San Francisco and San Pablo bays at any time", rock crab 35 a day, 4 inches at least
 * (https://wildlife.ca.gov/Fishing/Ocean/Regulations/Fishing-Map/sf-bay), no licence on a public pier, two nets each
 * (https://cdfwmarine.wordpress.com/2025/02/21/public-ocean-fishing-piers-know-before-you-go/), a hoop net checked at
 * least every 2 hours (https://wildlife.ca.gov/Fishing/Ocean/Regulations/Sport-Fishing/Invertebrate-Fishing-Regs/Crab),
 * Pier 7 is an 840 ft public fishing pier, good for rock crabs (https://www.pierfishing.com/pier-7-san-francisco/);
 * sourdough — a San Francisco staple since the Gold Rush of 1849 (https://en.wikipedia.org/wiki/History_of_bread_in_California),
 * its starter's bacterium named after the city (https://en.wikipedia.org/wiki/Fructilactobacillus_sanfranciscensis), the
 * Wharf's bakers shape loaves into crabs, turtles, teddy bears and alligators (https://kirbiecravings.com/sculpted-bread-animals-at-boudin-in-sf/).
 */

// --- the Musée Mécanique claw machine and the fortune teller ------------------------------------------------------------

export const CLAW_ID = 'claw';
export const CLAW_NAME: Bilingual = { zh: '机械博物馆 · 抓娃娃机', en: 'Musée Mécanique · claw machine' };
export const FORTUNE_NAME: Bilingual = { zh: '算命婆婆', en: 'The fortune teller' };

export const CLAW_LINES = {
  invite: { zh: '机械博物馆！三百多台老游戏机，玩一台抓娃娃？', en: 'The Musée Mécanique! Over 300 old machines — try the claw?' },
  start: { zh: '五枚硬币，看准了再抓！', en: 'Five quarters. Line it up, then grab!' },
  got: { zh: '抓到啦！掉进出口了！', en: 'Got it! Down the chute!' },
  slip: { zh: '哎呀，滑掉了！', en: 'Oops, it slipped!' },
  miss: { zh: '差一点点！再对准一些～', en: 'So close! Line it up a bit more.' },
  newKind: { zh: '新的纪念品！又多收集了一种！', en: 'A new souvenir for the collection!' },
  allKinds: { zh: '八种纪念品全抓齐了！你是抓娃娃大师！', en: 'All eight souvenirs! You’re a claw master!' },
  fortuneInvite: { zh: '旁边的算命婆婆也想跟你说句话～', en: 'The fortune teller next door wants a word too!' },
  factQuarters: { zh: '这里的机器都吃 25 美分硬币，进门不要钱！', en: 'The machines here take quarters — and walking in is free!' },
  factOld: { zh: '最老的一台是 1884 年的，比金门大桥还老！', en: 'The oldest machine here is from 1884 — older than the Golden Gate Bridge!' },
  factMove: { zh: '这些机器 2002 年才从海边的悬崖屋搬到 45 号码头。', en: 'These machines moved from the Cliff House to Pier 45 in 2002.' },
} satisfies Record<string, Bilingual>;

// --- crabbing off Pier 7 --------------------------------------------------------------------------------------------------

export const CRAB_ID = 'crab';
export const CRAB_NAME: Bilingual = { zh: '7 号码头 · 捞螃蟹', en: 'Pier 7 · crabbing' };

export const CRAB_LINES = {
  invite: { zh: '好多人在 7 号码头捞螃蟹！我们也放个网试试？', en: 'People crab off Pier 7! Shall we drop a net?' },
  drop: { zh: '放网！等螃蟹闻到饵爬进来～', en: 'Net down! Wait for the crabs to smell the bait…' },
  tug: { zh: '绳子在动！螃蟹进网啦，快拉！', en: 'The rope’s twitching — crabs in the net, pull!' },
  early: { zh: '拉早啦，螃蟹还没进来呢～', en: 'Too early — no crabs in yet.' },
  late: { zh: '拉晚了，饵被吃光，螃蟹走掉了～', en: 'Too late — the bait’s gone and so are the crabs.' },
  escape: { zh: '拉慢了，有螃蟹从网边溜走了！', en: 'Too slow — one scuttled off the net!' },
  measure: { zh: '量一量：够大的留下，太小的放回去！', en: 'Measure them: keepers stay, small ones go back!' },
  dungeness: { zh: '这是珍宝蟹！在旧金山湾里一只都不能带走，放回去！', en: 'A Dungeness! In San Francisco Bay they always go back!' },
  small: { zh: '石蟹不到 4 英寸，放回去长大吧～', en: 'A rock crab under 4 inches goes back to grow!' },
  keeper: { zh: '这只石蟹够 4 英寸了！', en: 'This rock crab is over 4 inches!' },
  wrong: { zh: '再看看尺子哦～', en: 'Check the gauge again!' },
  bye: { zh: '量好了，拍张照——都放回海里啦！', en: 'Measured and photographed — and all back in the bay!' },
  fact: { zh: '在加州的公共码头钓鱼捞螃蟹，不用执照！', en: 'On a California public pier, you don’t need a fishing licence!' },
} satisfies Record<string, Bilingual>;

// --- shaping sourdough at a Wharf bakery ----------------------------------------------------------------------------------

export const DOUGH_ID = 'sourdough';
export const DOUGH_NAME: Bilingual = { zh: '渔人码头 · 捏酸面包', en: 'Wharf bakery · shape a sourdough' };

export const DOUGH_LINES = {
  invite: { zh: '闻到酸面包的香味了！我们也来捏一个？', en: 'Smell that sourdough! Shall we shape one?' },
  knead: { zh: '先揉面：跟着节拍折过来、压下去！', en: 'Knead first: fold and press on the beat!' },
  shape: { zh: '选个形状！码头的面包师会捏螃蟹和乌龟！', en: 'Pick a shape! The Wharf bakers make crabs and turtles!' },
  score: { zh: '划几刀，面包才会漂亮地裂开！', en: 'Score it, so it opens up nicely in the oven!' },
  bake: { zh: '进烤箱！颜色金黄就拿出来！', en: 'Into the oven! Out when it’s golden!' },
  pale: { zh: '还有点白，再烤一会儿就好了～', en: 'A little pale — a bit longer next time.' },
  dark: { zh: '烤得有点黑啦，不过闻着好香！', en: 'A bit dark — but it smells great!' },
  golden: { zh: '金黄酥脆！完美！', en: 'Golden and crackly! Perfect!' },
  factGold: { zh: '1849 年淘金热的时候，酸面包就是旧金山的日常面包了。', en: 'Since the 1849 Gold Rush, sourdough has been San Francisco’s everyday bread.' },
  factBug: { zh: '酸面包里有一种细菌，名字就叫“旧金山”！', en: 'There’s a bacterium in sourdough named after San Francisco!' },
} satisfies Record<string, Bilingual>;
