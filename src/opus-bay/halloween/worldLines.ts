import type { Bilingual } from '../core/types';

/**
 * Wave 6 · lane H · BAYBAY's Halloween-world lines (the city dressed for the season, the pumpkin hunt, Día de los
 * Muertos): FIXED zh + en texts in ONE table, so lane X can record them (matched by text, like W5-V7). Every bubble lane
 * H shows says exactly one of these; nothing is built from pieces (the hunt's count is in the toast, never in a line).
 * zh ≤ 45 characters, 简体 (繁體 through the site's conversion). Keys are stable: a recorded clip is `<lang>-<id>`.
 *
 * Facts: the bats eat insects (every bat of the Bay Area does); marigolds "guide the souls home" is worded as what the
 * tradition says (传说 / they say); the procession is every 2 November in the evening from 22nd & Bryant (SFMTA,
 * checked 2026-09-29, the 2025 route; halloween/muertos.ts carries the sources). Wave 7: the 2026 times are not
 * published yet (checked 2026-09-29), so every line with a time or a date says 通常 / usually and 以官网为准 / check
 * the official site.
 */
export interface WorldLine { id: string; zh: string; en: string }

const l = (id: string, zh: string, en: string): WorldLine => ({ id, zh, en });

const W6_LINES = {
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

/** Wave 7 (lane H): new lines, ids `w7-h-*` — lane X records them into data/sf/voiceW7.ts (W7_WORLD_LINES below). */
const W7_LINES = {
  // finding the hidden lanterns (halloween/huntGuide.ts): which way the nearest unfound one is, seen from the camera
  huntAhead: l('w7-h-hunt-ahead', '我看到南瓜灯的光了，就在前面！', 'I can see a pumpkin glow — straight ahead!'),
  huntLeft: l('w7-h-hunt-left', '南瓜灯的光在左边！我们去看看～', 'A pumpkin glow off to the left! Let’s go and see.'),
  huntRight: l('w7-h-hunt-right', '南瓜灯的光在右边！我们去看看～', 'A pumpkin glow off to the right! Let’s go and see.'),
  huntBehind: l('w7-h-hunt-behind', '咦，南瓜灯的光在我们后面！', 'Oh — the pumpkin glow is behind us!'),
  huntWisp: l('w7-h-hunt-wisp', '看到那团橙色的小鬼火了吗？南瓜灯就藏在它下面！', 'See that little orange wisp? A lantern is hiding right under it!'),
  // Día de los Muertos, truer (halloween/muertos.ts muertosSchedule: 1 Nov the flags, 2 Nov the altars and the procession)
  muertosEve: l('w7-h-muertos-eve', '剪纸旗和万寿菊都挂好啦。明天公园里通常会摆满祭坛，以官网为准。', 'The papel picado and marigolds are up. Tomorrow the park usually fills with altars — check the official site.'),
  processionGather: l('w7-h-procession-gather', '大家戴着万寿菊花冠、捧着蜡烛在这里集合，通常七点出发，以官网为准。', 'Marigold crowns and candles — everyone gathers here. It usually sets off at seven; check the official site.'),
  processionWalk: l('w7-h-procession-walk', '游行的队伍过来了。我们在路边安静地看，好吗？', 'Here comes the procession. Let’s watch quietly from the side, okay?'),
  // pumpkins at the season's pumpkin events (halloween/worldVenues.ts; the event pages carry the times)
  venuePumpkins: l('w7-h-venue-pumpkins', '今天这里有南瓜活动，摆了好多南瓜！时间以官网为准。', 'A pumpkin party here today — pumpkins everywhere! Check the official site for times.'),
} as const satisfies Record<string, WorldLine>;

/**
 * Wave 8 (lane H): new lines, ids `w8-h-*` — lane X records them into data/sf/voiceW8.ts (W8_WORLD_LINES below).
 * The Chinatown Halloween Festival (31 Oct 2026, 11:00–15:00, Waverly Place — the Community Youth Center's page
 * https://www.cycsf.org/chinatown-halloween-festival/, checked 2026-09-30: "arts & crafts, games, a pumpkin patch", a
 * costume contest; the home page https://www.cycsf.org/ adds "cultural performances"): halloween/worldFestival.ts.
 */
const W8_LINES = {
  // the festival's kit on Waverly Place (the costume contest's line-up by the little stage; the lanterns and pumpkins)
  chinatownContest: l('w8-h-chinatown-contest', '小朋友们排队上台比变装啦！大家都好可爱～', 'The kids are lining up for the costume contest — everyone looks so cute!'),
  chinatownLanterns: l('w8-h-chinatown-lanterns', '红灯笼配南瓜，这就是唐人街的万圣节！', 'Red lanterns and pumpkins — that’s Halloween in Chinatown!'),
  // the procession walks round a player standing in its lane (halloween/muertosWalkers.ts: the walkers step aside)
  processionAside: l('w8-h-procession-aside', '队伍从我们身边绕过去了。我们站到路边吧～', 'They’re walking around us — let’s step onto the sidewalk.'),
} as const satisfies Record<string, WorldLine>;

/**
 * Wave 9 (lane H): new lines, ids `w9-h-*` — lane X records them (C:/Users/willy/opus-qa/w9/new-lines.md). BAYBAY's
 * greeting on the big days (halloween/today.ts: the 'returning' welcome through realsf/todayLine.ts, and the first visit's
 * invitation after the first minute in halloween/world.ts): the festival's hours (CYC's page, checked 2026-10-01:
 * "Saturday, October 31, 2026, from 11am-3pm", Waverly Place), the big night (every door answers, double treats:
 * halloween/treat.ts), the procession (SFMTA's 2025 route and time, the 2026 times not published: 通常 · 以官网为准).
 */
const W9_LINES = {
  todayFestival: l('w9-h-today-festival', '万圣节快乐！今天唐人街的 Waverly 巷有万圣节庆典，下午三点结束～', 'Happy Halloween! Chinatown’s Halloween Festival is on Waverly Place today, until three o’clock.'),
  todayBigNight: l('w9-h-today-big-night', '万圣节快乐！今天讨糖街家家都开门，糖果加倍，旅行本「万圣节」页能带你去～', 'Happy Halloween! Every treat-street door answers today, treats doubled — the Halloween page takes us there.'),
  todayProcession: l('w9-h-today-procession', '今晚教会区有亡灵节游行，通常七点从 22 街和布莱恩特街口出发，以官网为准。', 'The Día de los Muertos procession usually leaves 22nd & Bryant at seven tonight — check the official site.'),
} as const satisfies Record<string, WorldLine>;

export const HALLOWEEN_WORLD_LINES = { ...W6_LINES, ...W7_LINES, ...W8_LINES, ...W9_LINES } as const satisfies Record<string, WorldLine>;

export type WorldLineKey = keyof typeof HALLOWEEN_WORLD_LINES;

/** The bubble text of a line. */
export const lineText = (k: WorldLineKey): Bilingual => ({ zh: HALLOWEEN_WORLD_LINES[k].zh, en: HALLOWEEN_WORLD_LINES[k].en });

/** The wave-6 lines (recorded by lane X in wave 6: data/sf/voiceW6.ts). */
export const ALL_WORLD_LINES: readonly WorldLine[] = Object.values(W6_LINES);
/** The wave-7 lines (lane X's wave-7 recording list: data/sf/voiceW7.ts). */
export const W7_WORLD_LINES: readonly WorldLine[] = Object.values(W7_LINES);
/** The wave-8 lines (lane X's wave-8 recording list: data/sf/voiceW8.ts). */
export const W8_WORLD_LINES: readonly WorldLine[] = Object.values(W8_LINES);
/** The wave-9 lines (lane X's wave-9 recording list: C:/Users/willy/opus-qa/w9/new-lines.md). */
export const W9_WORLD_LINES: readonly WorldLine[] = Object.values(W9_LINES);
/** Every line lane H shows. */
export const EVERY_WORLD_LINE: readonly WorldLine[] = [...ALL_WORLD_LINES, ...W7_WORLD_LINES, ...W8_WORLD_LINES, ...W9_WORLD_LINES];
