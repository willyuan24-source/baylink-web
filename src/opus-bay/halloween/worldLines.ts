import type { Bilingual } from '../core/types';

/**
 * Wave 6 · lane H · BAYBAY's Halloween-world lines (the city dressed for the season, the pumpkin hunt, Día de los
 * Muertos): FIXED zh + en texts in ONE table, so lane X can record them (matched by text, like W5-V7). Every bubble lane
 * H shows says exactly one of these; nothing is built from pieces (the hunt's count is in the toast, never in a line).
 * zh ≤ 45 characters, 简体 (繁體 through the site's conversion). Keys are stable: a recorded clip is `<lang>-<id>`.
 *
 * Facts: the bats eat insects (every bat of the Bay Area does); marigolds "guide the souls home" is worded as what the
 * tradition says (传说 / they say); the procession is every 2 November in the evening from 22nd & Bryant (SFMTA,
 * checked 2026-09-29, the 2025 route; halloween/muertos.ts carries the sources).
 */
export interface WorldLine { id: string; zh: string; en: string }

const l = (id: string, zh: string, en: string): WorldLine => ({ id, zh, en });

export const HALLOWEEN_WORLD_LINES = {
  // the city dressed (halloween/worldDress.ts)
  seasonHello: l('w6-h-season-hello', '十月啦！家家门口都摆上了南瓜灯～', 'It’s October! There are pumpkins on every doorstep.'),
  nightGlow: l('w6-h-night-glow', '天黑了，门口的南瓜灯都亮起来啦，好温暖。', 'It’s dark now — all the jack-o’-lanterns are glowing. So cosy.'),
  bats: l('w6-h-bats', '看天上！小蝙蝠在绕圈圈～别怕，它们只爱吃虫子。', 'Look up! Little bats circling. Don’t worry — they only eat bugs.'),
  ghosts: l('w6-h-ghosts', '那边有小幽灵和小南瓜！是邻居家的小朋友扮的吧～', 'A little ghost and a little pumpkin! The neighbours’ kids dressed up.'),
  bigNight: l('w6-h-big-night', '今晚是万圣节大夜晚！整条街都亮着南瓜灯。', 'Tonight’s the big Halloween night! The whole street is glowing.'),
  dusk: l('w6-h-dusk', '南瓜色的黄昏，有一点点神秘，又很温柔～', 'A pumpkin-coloured dusk — a little spooky, and very cosy.'),
  // the pumpkin hunt (halloween/hunt.ts)
  huntFirst: l('w6-h-hunt-first', '找到一个藏起来的南瓜灯！全城还藏着好多个呢～', 'A hidden jack-o’-lantern! There are lots more hiding around the city.'),
  huntFound: l('w6-h-hunt-found', '又找到一个南瓜灯！', 'Another jack-o’-lantern!'),
  huntSniff: l('w6-h-hunt-sniff', '咦，附近好像有南瓜灯的光……', 'Hm — I can see a pumpkin glow somewhere near…'),
  huntNight: l('w6-h-hunt-night', '藏起来的南瓜灯晚上会发光，天黑了更好找哦。', 'The hidden lanterns glow at night — they’re easier to spot after dark.'),
  hunt10: l('w6-h-hunt-10', '十个南瓜灯啦！你是寻宝高手！', 'Ten jack-o’-lanterns! You’re a real treasure hunter!'),
  hunt20: l('w6-h-hunt-20', '二十个了！已经找到一半啦～', 'Twenty! That’s half of them found.'),
  huntAll: l('w6-h-hunt-all', '四十个全找齐啦！今年的南瓜王就是你！', 'All forty! You’re this year’s Pumpkin King!'),
  // Día de los Muertos, 1–2 November (halloween/muertos.ts)
  muertosHello: l('w6-h-muertos-hello', '今天是亡灵节！教会区挂满了彩色剪纸旗，还有万寿菊。', 'It’s Día de los Muertos! The Mission is full of papel picado and marigolds.'),
  muertosAltar: l('w6-h-muertos-altar', '这是纪念亲人的祭坛，有照片、蜡烛和万寿菊。我们轻轻地看。', 'An altar for loved ones — photos, candles, marigolds. Let’s look quietly.'),
  muertosMarigold: l('w6-h-muertos-marigold', '传说万寿菊的橙色和香味，能给思念的人照亮回家的路。', 'They say the marigolds’ colour and scent light the way home for those we miss.'),
  muertosProcession: l('w6-h-muertos-procession', '每年 11 月 2 日晚上，大家从 22 街和布莱恩特街口出发游行。', 'Every 2 November, in the evening, a procession sets off from 22nd and Bryant.'),
  muertosAll: l('w6-h-muertos-all', '每个祭坛都看过啦。谢谢你陪我一起记住大家。', 'We’ve seen every altar. Thank you for remembering with me.'),
} as const satisfies Record<string, WorldLine>;

export type WorldLineKey = keyof typeof HALLOWEEN_WORLD_LINES;

/** The bubble text of a line. */
export const lineText = (k: WorldLineKey): Bilingual => ({ zh: HALLOWEEN_WORLD_LINES[k].zh, en: HALLOWEEN_WORLD_LINES[k].en });

/** Every line (lane X's recording list). */
export const ALL_WORLD_LINES: readonly WorldLine[] = Object.values(HALLOWEEN_WORLD_LINES);
