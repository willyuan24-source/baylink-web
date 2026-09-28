import type { Bilingual, DialogueAction, DialogueChoice, DialogueNode, FreeGoal, Mood, Speaker, WeekQuestions } from '../core/types';
import { byMode } from './contentMode';
import { GRAND_TOUR } from './sf/copy';
import { CITY_FREE_GOALS } from './sf/goals';

/**
 * Opus Bay dialogue (content-owned). Voice: data/VOICE.md. Facts: sources live in data/pois.ts (SRC, realInfo).
 *
 * Graph conventions (match game/flow.ts):
 * - A node advances to `next` on click / E; a choice runs its `action`, then follows its `next` if the action
 *   did not take over the dialogue.
 * - Tour nodes (FIRST_TOUR intro / arriveNode / doneNode) end with `{ type: 'end' }`: the tour system continues
 *   by itself (lead → arrive → micro-interaction → doneNode → info card → next stop). Never end them with
 *   'tour-next' — that would skip the stop's card.
 * - `poi.<id>` nodes are the free-roam reaction to a POI's micro-interaction (InteractionDef.nodeId). In tour
 *   mode the stop's doneNode already carries the fact, so the tour can skip them.
 * - NPC nodes are `npc.<key>` (keys: vendor, fisher, streetcar, family, jogger). NPCs are fictional.
 * - SCRIPT_HOOKS lists the entry node for every situation the game systems may want to voice.
 * - Every bubble: Chinese ≤ 45 characters (tested).
 */

export const NODES: Record<string, DialogueNode> = {};

type Part = [mood: Mood, zh: string, en: string];
type Tail = { action?: DialogueAction; choices?: DialogueChoice[]; next?: string };

const END: Tail = { action: { type: 'end' } };

/** Adds `id`, `id.2`, `id.3`… chained by `next`; the tail (action / choices / next) goes on the last bubble. */
function seq(id: string, parts: Part[], tail: Tail = END, speaker: Speaker = 'baybay', npcName?: Bilingual): string {
  parts.forEach(([mood, zh, en], i) => {
    const nodeId = i === 0 ? id : `${id}.${i + 1}`;
    const last = i === parts.length - 1;
    NODES[nodeId] = {
      id: nodeId,
      speaker,
      ...(npcName ? { npcName } : {}),
      mood,
      text: { zh, en },
      ...(last ? tail : { next: `${id}.${i + 2}` }),
    };
  });
  return id;
}

/** A single node with explicit fields (mixed speakers, choices). */
function one(node: DialogueNode): string {
  NODES[node.id] = node;
  return node.id;
}

const choice = (hotkey: string, zh: string, en: string, rest: Omit<DialogueChoice, 'label' | 'hotkey'>): DialogueChoice => ({ hotkey, label: { zh, en }, ...rest });

// ---------------------------------------------------------------------------
// Welcome
// ---------------------------------------------------------------------------

export const DISTRICT_START_NODE = one({
  id: 'intro.hello',
  speaker: 'baybay',
  mood: 'wave',
  text: { zh: '嗨！欢迎来到湾区～我是 BAYBAY。第一次来吗？', en: "Hi! Welcome to the Bay — I'm BAYBAY. First time here?" },
  choices: [
    choice('1', '刚来湾区，带我认识一下', "I'm new — show me around", { action: { type: 'start-tour' }, next: 'tour.intro' }),
    choice('2', '这周有什么好玩的？', "What's on this week?", { action: { type: 'start-week' }, next: 'week.intro' }),
    choice('3', '我自己逛逛', "I'll explore on my own", { action: { type: 'free-roam' }, next: 'free.intro' }),
    choice('4', '我是本地人，直接开始', "I'm a local — let's just go", { action: { type: 'skip-intro' }, next: 'local.intro' }),
  ],
});

/**
 * City mode's welcome (plan G2-8): the same four choices; "I'll explore" leads to the city goals. Wave 4 (W4-C7): "show
 * me around" is the Grand Tour 环游旧金山 · 一日游 (game/cityTour.ts; Bay 101 stays in the call menu as 海边 7 站).
 */
export const CITY_START_NODE = one({
  id: 'intro.hello.city',
  speaker: 'baybay',
  mood: 'wave',
  text: { zh: '嗨！欢迎来到旧金山～我是 BAYBAY。第一次来吗？', en: "Hi! Welcome to San Francisco — I'm BAYBAY. First time here?" },
  choices: [
    choice('1', '刚来湾区，带我认识一下', "I'm new — show me around", { action: { type: 'start-tour', tourId: GRAND_TOUR.id } }),
    choice('2', '这周有什么好玩的？', "What's on this week?", { action: { type: 'start-week' }, next: 'week.intro' }),
    choice('3', '我自己逛逛', "I'll explore on my own", { action: { type: 'free-roam' }, next: 'free.intro.city' }),
    choice('4', '我是本地人，直接开始', "I'm a local — let's just go", { action: { type: 'skip-intro' }, next: 'local.intro' }),
  ],
});

/** The welcome node of the active world (plan G2-0). */
export const START_NODE = byMode(DISTRICT_START_NODE, CITY_START_NODE);

seq('local.intro', [
  ['wave', '老湾区人你好！那我不啰嗦了，随便逛，有事随时叫我。', "Hey, local! I'll keep it short — roam freely and call me anytime."],
]);

// ---------------------------------------------------------------------------
// Tour: 湾区第一课 / Bay 101 (see data/tours.ts for the stop order)
// ---------------------------------------------------------------------------

seq('tour.intro', [
  ['excited', '好嘞！「湾区第一课」开课：从渡轮大厦沿海边走到 PIER 39，一共七站。', "Yay! Bay 101 starts now: seven stops along the water, from the Ferry Building to PIER 39."],
  ['point', '我在前面带路，你落后了我会等你。想歇会儿，随时叫我。', "I'll lead the way and wait if you fall behind. Want a break? Just call me."],
]);

// 1 · Ferry Building clock
seq('tour.ferry-building.arrive', [
  ['point', '第一站，渡轮大厦！走到钟楼下面，抬头看看它。', 'Stop one: the Ferry Building! Walk up to the clock tower and look up.'],
]);
seq('tour.ferry-building.done', [
  ['excited', '这座钟楼约 245 英尺高，1898 年起就在海边给大家看时间。', "The tower is about 245 feet tall and has kept the waterfront's time since 1898."],
  ['happy', '整点和半点它会报时——小秘密：声音来自塔里的大喇叭！', 'It chimes on the hour and half hour. Secret: the sound comes from big speakers in the tower!'],
  ['point', '楼后就是渡轮码头，去 Oakland、Sausalito 的船都从这儿开。', 'The ferry gates are right behind it — boats to Oakland, Sausalito and more leave from here.'],
]);

// 2 · Farmers market
seq('tour.farmers-market.arrive', [
  ['happy', '第二站，市集！楼里的店天天开，门外的农夫市集周二、四、六才摆摊。', 'Stop two: the market! Shops inside open daily; the farmers market outside sets up Tue, Thu and Sat.'],
]);
seq('tour.farmers-market.done', [
  ['excited', '嗯～酸面包配当季水果，这就是旧金山的早餐味道！', "Mmm — sourdough and seasonal fruit. That's a San Francisco breakfast!"],
  ['thinking', 'BAYLINK 攻略说：先问按磅、按盒还是按把卖，再决定买多少。', 'BAYLINK’s market guide says: ask if it’s by the pound, box or bunch before you decide how much.'],
]);

// 3 · Pier 7
seq('tour.pier7.arrive', [
  ['point', '第三站，Pier 7！一条专门给大家散步和钓鱼的长码头。', 'Stop three: Pier 7 — a long pier made for strolling and fishing.'],
  ['thinking', '发现没？渡轮大厦往北的码头是单号，往南是双号。', 'Notice? Piers north of the Ferry Building have odd numbers; south of it, even.'],
]);
seq('tour.pier7.done', [
  ['happy', '在加州公共码头钓鱼不用执照！但尺寸、数量和季节规定照样要守。', "No fishing license needed on a California public pier! Size limits, bag limits and seasons still apply."],
  ['thinking', '这里常有人夜里钓螃蟹。记住：每人最多用两根竿。', 'People come crabbing here at night. Remember: two rods per person, max.'],
]);

// 4 · Exploratorium
seq('tour.exploratorium.arrive', [
  ['excited', '第四站，Exploratorium！一座能动手玩的科学馆，就在 Pier 15。', 'Stop four: the Exploratorium — a hands-on science museum on Pier 15.'],
]);
seq('tour.exploratorium.done', [
  ['happy', '它 1969 年在艺术宫开馆，2013 年搬来这里，大人小孩都玩到不想走。', 'It opened in 1969 at the Palace of Fine Arts and moved here in 2013. Nobody ever wants to leave.'],
  ['thinking', '周二到周日开，周一多数闭馆；周四晚上是 18+ 的 After Dark。', 'Open Tuesday to Sunday, closed most Mondays; Thursday nights are After Dark, 18+.'],
  ['point', "下一站要爬坡啦！穿过 Levi's Plaza，去走 Filbert Steps。", "Next stop is uphill! We'll cut through Levi's Plaza to the Filbert Steps."],
]);

// 5 · Filbert Steps
seq('tour.filbert-steps.arrive', [
  ['point', '第五站，Filbert Steps！公共台阶一路穿过花园，爬上电报山。', 'Stop five: the Filbert Steps — public stairs through a garden, all the way up Telegraph Hill.'],
]);
seq('tour.filbert-steps.done', [
  ['excited', '嘘——听到叽叽喳喳了吗？可能是电报山有名的野生鹦鹉！', "Shh — hear that squawking? Could be Telegraph Hill's famous wild parrots!"],
  ['thinking', '电报山得名于 1850 年山顶的旗语电报站，用来通报进港的船。', 'The hill is named for an 1850 semaphore telegraph on top that signaled arriving ships.'],
  ['happy', '这片是 Grace Marchant Garden，两边都住着人，我们小声走。', 'This is the Grace Marchant Garden. People live right here, so let’s keep it quiet.'],
]);

// 6 · Coit Tower viewpoint
seq('tour.coit-tower.arrive', [
  ['proud', '呼——登顶！第六站，Coit Tower。到观景点看看整个海湾。', 'Phew — we made it! Stop six: Coit Tower. Step up to the viewpoint and see the whole Bay.'],
]);
seq('tour.coit-tower.done', [
  ['excited', '整片海湾都在眼前，地图也解锁啦！', 'The whole Bay at your feet — and the map is unlocked!'],
  ['happy', 'Coit Tower 1933 年建成。官方说：它可不是照着消防水枪设计的！', 'Coit Tower was finished in 1933. Officially, it was NOT designed to look like a fire hose nozzle!'],
  ['point', '最后一站去看海狮！下山会路过 Pier 33，去恶魔岛的船从那儿开。', "Last stop: sea lions! On the way we pass Pier 33, where the Alcatraz boats leave."],
]);

// 7 · Sea lions
seq('tour.sea-lions.arrive', [
  ['excited', '最后一站，PIER 39！听到了吗？海狮们正在开会。', 'Final stop: PIER 39! Hear that? The sea lions are holding a meeting.'],
]);
seq('tour.sea-lions.done', [
  ['excited', '拍得真好！1989 年地震后不久，它们就搬上了 K-Dock。', 'Great shot! They moved onto K-Dock soon after the 1989 earthquake.'],
  ['thinking', '看海狮不收门票，但它们受法律保护：不喂、不碰、不逗。', "Watching is free, but they're protected by law: no feeding, touching or teasing."],
]);

seq('tour.outro', [
  ['proud', '湾区第一课，毕业啦！从渡轮大厦到海狮，这段海滨你都认识了。', 'Bay 101 — you graduated! From the Ferry Building to the sea lions, this waterfront is yours.'],
  ['wave', '七站都在你的旅行本里啦。想真去走一趟，就用步行路线，或者把 PIER 39 排进 BAYLINK 计划！', 'All seven stops are in your journal. To walk it for real, use the walking route — or put PIER 39 in a BAYLINK plan!'],
], { action: { type: 'tour-end' } });

seq('tour.resume', [
  ['point', '走，接着上课！跟我来～', 'Back to class! Follow me~'],
]);

one({
  id: 'tour.after',
  speaker: 'baybay',
  mood: 'happy',
  text: { zh: '接下来想做什么？明信片还有几张藏在附近哦。', en: 'What next? A few postcards are still hiding nearby.' },
  choices: [
    choice('1', '我自己逛逛', "I'll explore on my own", { action: { type: 'free-roam' }, next: 'free.goals' }),
    choice('2', '这周有什么好玩的？', "What's on this week?", { action: { type: 'start-week' }, next: 'week.intro' }),
    choice('3', '先歇会儿', "I'll take a break", { action: { type: 'end' } }),
  ],
});
// city mode: the same, pointing at the whole city's goals (plan G2-8)
one({
  id: 'tour.after.city',
  speaker: 'baybay',
  mood: 'happy',
  text: { zh: '接下来想做什么？全城还藏着好多明信片哦。', en: 'What next? Plenty more postcards are hiding around the city.' },
  choices: [
    choice('1', '我自己逛逛', "I'll explore on my own", { action: { type: 'free-roam' }, next: 'free.goals.city' }),
    choice('2', '这周有什么好玩的？', "What's on this week?", { action: { type: 'start-week' }, next: 'week.intro' }),
    choice('3', '先歇会儿', "I'll take a break", { action: { type: 'end' } }),
  ],
});

// ---------------------------------------------------------------------------
// This week (values must stay in sync with data/catalog.ts filters)
// ---------------------------------------------------------------------------

export const WEEK_QUESTIONS: WeekQuestions = {
  companions: [
    { value: 'solo', label: { zh: '自己', en: 'Just me' } },
    { value: 'friends', label: { zh: '和朋友', en: 'Friends' } },
    { value: 'date', label: { zh: '约会', en: 'A date' } },
    { value: 'kids', label: { zh: '带娃', en: 'With kids' } },
  ],
  vibe: [
    { value: 'free', label: { zh: '免费就好', en: 'Free' } },
    { value: 'food', label: { zh: '吃吃喝喝', en: 'Food & drink' } },
    { value: 'outdoors', label: { zh: '户外走走', en: 'Outdoors' } },
    { value: 'culture', label: { zh: '文化活动', en: 'Culture' } },
    { value: 'any', label: { zh: '都可以', en: 'Surprise me' } },
  ],
  region: [
    { value: 'sf', label: { zh: '旧金山', en: 'San Francisco' } },
    { value: 'east-bay', label: { zh: '东湾', en: 'East Bay' } },
    { value: 'peninsula', label: { zh: '半岛', en: 'Peninsula' } },
    { value: 'south-bay', label: { zh: '南湾', en: 'South Bay' } },
    { value: 'north-bay', label: { zh: '北湾', en: 'North Bay' } },
    { value: 'any', label: { zh: '都行', en: 'Anywhere' } },
  ],
};

const weekChoices = (key: 'companions' | 'vibe' | 'region', next: string): DialogueChoice[] =>
  WEEK_QUESTIONS[key].map((option, i) => ({ hotkey: String(i + 1), label: option.label, action: { type: 'set-week-pref', key, value: option.value }, next }));

seq('week.intro', [
  ['thinking', '好呀！先问你三个小问题，我从 BAYLINK 这周的活动里帮你挑。', "Sure! Three quick questions, then I'll pick from BAYLINK's events this week."],
], { next: 'week.companions' });

one({ id: 'week.companions', speaker: 'baybay', mood: 'thinking', text: { zh: '这次和谁一起去？', en: "Who's coming along?" }, choices: weekChoices('companions', 'week.vibe') });
one({ id: 'week.vibe', speaker: 'baybay', mood: 'thinking', text: { zh: '想要什么样的感觉？', en: 'What kind of vibe?' }, choices: weekChoices('vibe', 'week.region') });
// Setting the last preference triggers the search in the flow system; this line covers the wait.
one({ id: 'week.region', speaker: 'baybay', mood: 'thinking', text: { zh: '想去湾区哪一块？', en: 'Which part of the Bay?' }, choices: weekChoices('region', 'week.searching') });
seq('week.searching', [
  ['excited', '收到！我去公告板上翻翻，跟我来～', "Got it! Let me check the board. Follow me~"],
]);

seq('week.result.found', [
  ['excited', '找到啦！这几张最合你口味，点开看看时间和地点。', 'Found some! These fit you best — open one to see when and where.'],
], { next: 'week.outro' });
seq('week.result.few', [
  ['thinking', '这周完全对上的不多，我把条件放宽了一点，一起贴上来了。', 'Only a few exact matches this week, so I loosened things a little and pinned those too.'],
], { next: 'week.outro' });
seq('week.result.none', [
  ['thinking', '这周没有完全对上的……我放宽了条件，这些是最接近的。', 'Nothing matched exactly this week... I relaxed the filters — these are the closest.'],
], { next: 'week.outro' });
seq('week.result.error', [
  ['thinking', '哎呀，这周的活动暂时没加载出来。等会儿再问我，或者直接去 BAYLINK 看看。', "Oops, this week's events didn't load. Ask me again later, or check BAYLINK directly."],
]);
seq('week.outro', [
  ['wave', '看中哪个就点「想去」，最后一起带去 BAYLINK 安排。', 'Tap “Want to go” on anything you like, then take the list to BAYLINK to plan.'],
]);

// ---------------------------------------------------------------------------
// Free roam
// ---------------------------------------------------------------------------

seq('free.intro', [
  ['happy', '好嘞，你带路，我跟着！给你几个小目标，想做就做～', "Okay, you lead and I'll follow! Here are a few little goals, if you feel like it."],
], { next: 'free.goals' });
seq('free.goals', [
  ['point', '找齐 8 张明信片、坐一次 F 线老电车、爬上 Coit Tower 看海湾。', "Find all 8 postcards, ride the vintage F-line streetcar, and climb to Coit Tower's viewpoint."],
  ['happy', '再给海狮拍张照、在市集尝一口。明信片会发金光，留意哦！', 'Then snap the sea lions and taste something at the market. Postcards glint gold — keep an eye out!'],
]);

export const DISTRICT_FREE_GOALS: FreeGoal[] = [
  { id: 'postcards', label: { zh: '找齐 8 张湾区明信片', en: 'Find all 8 Bay postcards' }, hint: { zh: '留意发金光的小东西，旅行本里有提示', en: 'Look for little golden glints — your journal has hints' } },
  { id: 'streetcar', label: { zh: '坐一次 F 线老电车', en: 'Ride the F-line streetcar' }, hint: { zh: '渡轮大厦、Green St 和 PIER 39 都有站', en: 'Stops at the Ferry Building, Green St and PIER 39' } },
  { id: 'viewpoint', label: { zh: '登上 Coit Tower 观景点', en: "Reach Coit Tower's viewpoint" }, hint: { zh: "从 Levi's Plaza 旁的 Filbert Steps 往上爬", en: "Climb the Filbert Steps by Levi's Plaza" } },
  { id: 'sea-lions', label: { zh: '给海狮拍张照', en: 'Photograph the sea lions' }, hint: { zh: '去 PIER 39，跟着「嗷嗷」声走', en: 'Head to PIER 39 and follow the barking' } },
  { id: 'taste', label: { zh: '在市集尝一口', en: 'Taste something at the market' }, hint: { zh: '渡轮大厦门前的摊位', en: 'The stalls in front of the Ferry Building' } },
];

// city mode (plan G2-5 / G2-8): the whole city's goals (data/sf/goals.ts)
seq('free.intro.city', [
  ['happy', '好嘞，整座旧金山都给你逛！我跟着你，再给你几个小目标～', "Okay — all of San Francisco is yours! I'll tag along, with a few little goals."],
], { next: 'free.goals.city' });
seq('free.goals.city', [
  ['point', '全城藏着 20 张明信片，会发金光！再坐一段真的叮当车。', 'Twenty postcards hide around the city — they glint gold! And ride a real cable car.'],
  ['excited', '自己爬上双峰看全城，走过金门大桥，再逛 8 个街区。', 'Climb Twin Peaks for the whole view, walk the Golden Gate, and wander 8 neighbourhoods.'],
  ['happy', '想去哪儿，打开地图或者叫我带路都行～', 'Want to go somewhere? Open the map, or ask me to lead the way~'],
]);
seq('guide.edge.city', [
  ['thinking', '再往外就出了我们的旧金山啦，桌子边可没有路！', "That's the edge of our San Francisco — no roads past the table!"],
]);

/** The active world's explorer goals (plan G2-0): the district's 5 or the city's 7 (data/sf/goals.ts). */
export const FREE_GOALS: FreeGoal[] = byMode(DISTRICT_FREE_GOALS, CITY_FREE_GOALS);

// ---------------------------------------------------------------------------
// POI micro-interactions (InteractionDef.nodeId, free roam)
// ---------------------------------------------------------------------------

seq('poi.ferry-building', [
  ['excited', '钟楼约 245 英尺高，1898 年起就在这儿了。整点和半点会报时哦！', "The tower is about 245 feet tall and has stood here since 1898. It chimes on the hour and half hour!"],
]);
one({
  id: 'poi.weekly-board',
  speaker: 'baybay',
  mood: 'point',
  text: { zh: '这是「这周去哪」公告板，传单都来自 BAYLINK 编辑整理的活动库。', en: "This is the “This week” board — every flyer comes from BAYLINK's curated event catalog." },
  choices: [
    choice('1', '帮我挑挑', 'Help me pick', { action: { type: 'start-week' }, next: 'week.intro' }),
    choice('2', '我自己看', "I'll browse myself", { action: { type: 'show-week-results' } }),
  ],
});
seq('poi.farmers-market', [
  ['excited', '嗯～酸面包配当季水果，这就是旧金山的早餐味道！', "Mmm — sourdough and seasonal fruit. That's a San Francisco breakfast!"],
  ['thinking', '试吃前先问问摊主，这是市集的好习惯。', "Always ask the vendor before you sample — that's good market manners."],
]);
// the market stop when the farmers market is not set up (outside Tue/Thu 10–14, Sat 8–14): no market sample claimed
seq('tour.farmers-market.closed', [
  ['happy', '门外的农夫市集现在没摆摊，楼里的面包店照样能尝一口！', "The farmers market outside isn't set up now, but the bakery inside still has a bite for you!"],
  ['thinking', '农夫市集周二、周四 10–14 点，周六 8–14 点。BAYLINK 攻略：先问按磅还是按盒卖。', 'The farmers market runs Tue & Thu 10–2, Sat 8–2. BAYLINK’s guide: ask if it’s by the pound or the box.'],
]);
seq('poi.farmers-market.closed', [
  ['thinking', '门外的农夫市集现在没摆摊（周二、四 10–14 点，周六 8–14 点），楼里的店照样能尝！', "The farmers market outside isn't set up now (Tue & Thu 10–2, Sat 8–2), but the shops inside are open for a taste!"],
]);
seq('poi.pier14', [
  ['point', '望远镜里就是海湾大桥！它 1936 年通车，比金门大桥还早半年。', "That's the Bay Bridge in the scope! It opened in 1936, six months before the Golden Gate."],
  ['happy', '脚下的 Pier 14 其实也是防波堤，替渡轮码头挡浪。', 'And Pier 14 doubles as a breakwater, shielding the ferry terminal from waves.'],
]);
seq('poi.pier7', [
  ['excited', '甩竿——！有动静！……是一只好奇的小螃蟹，放它回家吧。', "Cast! Something's biting... a curious little crab. Back home you go!"],
  ['happy', '在加州公共码头钓鱼不用执照，但尺寸和数量规定照样要守。', "No license needed on a California public pier — but size and bag limits still apply."],
]);
seq('poi.exploratorium', [
  ['happy', '隔着窗看：大家在里面转、拧、按、听，玩得停不下来！', "Peek through the windows: everyone's spinning, twisting, poking and listening!"],
  ['thinking', '馆内商店从 Embarcadero 这侧直接进，不买票也能逛。', 'The museum store opens onto The Embarcadero — no ticket needed to browse.'],
]);
seq('poi.levis-plaza', [
  ['happy', '坐下听听流水……这座广场 1982 年落成，设计师是 Lawrence Halprin。', 'Sit and listen to the water... This plaza opened in 1982, designed by Lawrence Halprin.'],
  ['point', '中间那块大石头是整块花岗岩，喷泉就绕着它流。', 'That big boulder in the middle is granite; the fountain flows around it.'],
]);
seq('poi.filbert-steps', [
  ['excited', '嘘——听！叽叽喳喳的，是电报山有名的野生鹦鹉吗？', "Shh — listen! Is that Telegraph Hill's famous wild parrots?"],
  ['happy', '它们不打卡上班，能不能遇到看缘分。2023 年还被选为旧金山官方动物呢！', "They don't keep office hours, so it's luck. In 2023 they became San Francisco's official animal!"],
]);
seq('poi.coit-tower', [
  ['excited', '看！海湾大桥、恶魔岛、刚走过的码头……地图解锁啦！', 'Look! The Bay Bridge, Alcatraz, all the piers we walked... Map unlocked!'],
  ['happy', 'Coit Tower 1933 年建成。官方说：它可不是照着消防水枪设计的！', 'Coit Tower was finished in 1933. Officially, it was NOT designed to look like a fire hose nozzle!'],
]);
seq('poi.coit-murals', [
  ['point', '塔底的壁画是 1934 年一群艺术家画的，讲大萧条时期的加州生活。', 'The murals in the base were painted in 1934 and show California life during the Depression.'],
  ['thinking', '想听完整故事可以买壁画导览；上观景台的电梯票另外买。', 'For the full story there are paid mural tours; the elevator to the deck is a separate ticket.'],
]);
seq('poi.pier33', [
  ['point', '望远镜里那座岛就是恶魔岛！看到岛上的灯塔了吗？', "That island in the scope is Alcatraz! Can you spot the lighthouse?"],
  ['thinking', '公园不收门票，但登岛只能坐官方授权的 Alcatraz City Cruises。', 'The park is free, but the only way on is Alcatraz City Cruises, the official ferry.'],
  ['thinking', 'BAYLINK 攻略提醒：只写「绕岛」的观光船，不等于登岛票！', "BAYLINK's guide warns: a cruise that only circles the island is not a landing ticket!"],
]);
seq('poi.pier39-carousel', [
  ['excited', '双层手绘旋转木马！上面画着金门大桥、Coit Tower 和海狮。', 'A double-decker, hand-painted carousel! The Golden Gate, Coit Tower, even sea lions.'],
  ['happy', '它是在意大利手工做的。每位骑乘者都要买票，2 岁及以下免费。', 'It was handcrafted in Italy. Every rider needs a ticket; kids 2 and under ride free with an adult.'],
]);
seq('poi.sea-lions', [
  ['excited', '咔嚓！完美！1989 年地震后不久，它们就搬上了 K-Dock。', 'Click! Perfect! They moved onto K-Dock soon after the 1989 earthquake.'],
  ['thinking', '看海狮免费，但它们受法律保护：不喂、不碰、不逗。', "Watching is free, but they're protected by law: no feeding, touching or teasing."],
]);
seq('poi.streetcar', [
  ['excited', '叮叮！上车啦！F 线老电车沿着海边开，窗外全是码头。', 'Ding ding! All aboard! The F-line rolls right along the water — piers out every window.'],
  ['thinking', '真实乘车：Clipper 或感应卡 $2.85，18 岁及以下免费。', 'For real rides: $2.85 with Clipper or a contactless card; 18 and under ride free.'],
]);
seq('streetcar.off', [
  ['happy', '到站啦！下车注意脚下～', 'Our stop! Watch your step~'],
]);

// ---------------------------------------------------------------------------
// Call BAYBAY (Q / 问 BAYBAY)
// ---------------------------------------------------------------------------

one({
  id: 'call.menu',
  speaker: 'baybay',
  mood: 'happy',
  text: { zh: '我在呢！想做什么？', en: "I'm here! What would you like to do?" },
  choices: [
    choice('1', '继续导览', 'Continue the tour', { action: { type: 'start-tour' } }),
    choice('2', '这周活动', "What's on this week", { action: { type: 'start-week' }, next: 'week.intro' }),
    choice('3', '自己逛', 'Explore on my own', { action: { type: 'free-roam' }, next: 'free.goals' }),
    choice('4', '打开地图', 'Open the map', { action: { type: 'open-map' } }),
    choice('5', '没事啦', 'Never mind', { action: { type: 'end' } }),
  ],
});
/** City mode's call menu (game/flow builds `flow.call` itself today; kept in step so a hook reader never lands in the district goals). */
one({
  id: 'call.menu.city',
  speaker: 'baybay',
  mood: 'happy',
  text: { zh: '我在呢！想做什么？', en: "I'm here! What would you like to do?" },
  choices: [
    choice('1', '继续导览', 'Continue the tour', { action: { type: 'start-tour' } }),
    choice('2', '这周活动', "What's on this week", { action: { type: 'start-week' }, next: 'week.intro' }),
    choice('3', '自己逛', 'Explore on my own', { action: { type: 'free-roam' }, next: 'free.goals.city' }),
    choice('4', '打开地图', 'Open the map', { action: { type: 'open-map' } }),
    choice('5', '没事啦', 'Never mind', { action: { type: 'end' } }),
  ],
});

// ---------------------------------------------------------------------------
// NPCs (fictional residents). Keys match game/interactables.ts NPC_POSTS + the jogger.
// ---------------------------------------------------------------------------

export interface NpcLine { key: string; anchor: string; name: Bilingual; nodeId: string }

export const DISTRICT_NPC_LINES: NpcLine[] = [
  { key: 'vendor', anchor: 'npc-vendor', name: { zh: '摊主 Maya', en: 'Maya, stallholder' }, nodeId: 'npc.vendor' },
  { key: 'fisher', anchor: 'npc-fisher', name: { zh: '钓鱼的老陈', en: 'Old Chen, angler' }, nodeId: 'npc.fisher' },
  { key: 'streetcar', anchor: 'npc-streetcar', name: { zh: '电车司机 Lou', en: 'Lou, streetcar operator' }, nodeId: 'npc.streetcar' },
  { key: 'family', anchor: 'npc-family', name: { zh: '来玩的 Kim 一家', en: 'The Kims, visiting' }, nodeId: 'npc.family' },
  { key: 'jogger', anchor: 'npc-jogger-a', name: { zh: '跑步的 Sam', en: 'Sam, out for a run' }, nodeId: 'npc.jogger' },
];
const npcName = (key: string): Bilingual => DISTRICT_NPC_LINES.find(item => item.key === key)!.name;

seq('npc.vendor', [
  ['happy', '尝一口吧！喜欢再买，不喜欢也没关系～', 'Have a taste! Buy it if you love it — no pressure.'],
  ['happy', '我们多数摊位能刷卡，也能用手机付，放心逛。', 'Most of us take cards and phone payments, so browse away.'],
], END, 'npc', npcName('vendor'));
seq('npc.fisher', [
  ['thinking', '嘘……鱼快上钩了。', "Shh... they're about to bite."],
  ['happy', '在这码头钓了二十年，钓到最好的东西？是日落。', 'Twenty years on this pier. Best thing I ever caught? The sunset.'],
], END, 'npc', npcName('fisher'));
seq('npc.streetcar', [
  ['wave', '叮叮！上车的朋友，每人拍自己的卡哦。', 'Ding ding! Everyone taps their own card, please.'],
  ['happy', '18 岁及以下坐 Muni 免费，大人拍卡 $2.85。', 'Riders 18 and under are free on Muni; adults tap for $2.85.'],
], END, 'npc', npcName('streetcar'));
one({
  id: 'npc.family', speaker: 'npc', npcName: npcName('family'), mood: 'thinking',
  text: { zh: '请问，去恶魔岛的船是在 PIER 39 坐吗？', en: 'Excuse me, do the Alcatraz boats leave from PIER 39?' },
  next: 'npc.family.2',
});
one({
  id: 'npc.family.2', speaker: 'baybay', mood: 'point',
  text: { zh: '不是哦，在 Pier 33 Alcatraz Landing！票最好提前在官方渠道订。', en: "Nope — it's Pier 33, Alcatraz Landing! Book ahead through the official operator." },
  next: 'npc.family.3',
});
one({
  id: 'npc.family.3', speaker: 'npc', npcName: npcName('family'), mood: 'happy',
  text: { zh: '太好了，差点排错队！谢谢小海獭～', en: 'Phew, we almost joined the wrong line! Thanks, little otter!' },
  action: { type: 'end' },
});
seq('npc.jogger', [
  ['wave', '嗨！这条海边步道一路能跑到 Oracle Park！', 'Hey! This promenade runs all the way to Oracle Park!'],
  ['happy', '它还是湾区步道 Bay Trail 的一段，慢慢跑～', "It's part of the Bay Trail, too. Pace yourself!"],
], END, 'npc', npcName('jogger'));

/**
 * City transit crews (lane F's cable cars and ferry, plan G2-4 / F's requests): fictional, no names, no fares (fares
 * change; the landmark card links the official page). `anchor` is empty: they ride with their car, not at a post.
 */
export const CITY_NPC_LINES: NpcLine[] = [
  { key: 'gripman', anchor: '', name: { zh: '叮当车司机', en: 'Gripman' }, nodeId: 'npc.gripman' },
  { key: 'deckhand', anchor: '', name: { zh: '渡轮水手', en: 'Deckhand' }, nodeId: 'npc.deckhand' },
];
/** The active world's residents with lines (city: the district's plus the transit crews). */
export const NPC_LINES: NpcLine[] = byMode(DISTRICT_NPC_LINES, [...DISTRICT_NPC_LINES, ...CITY_NPC_LINES]);
const crewName = (key: string): Bilingual => CITY_NPC_LINES.find(item => item.key === key)!.name;

seq('npc.gripman', [
  ['happy', '叮叮！这根大手柄就是「抓手」：抓住缆绳就走，松开再靠刹车停。', 'Ding ding! This big lever is the grip: grab the cable and we go, let go and the brakes stop us.'],
  ['wave', '路口我会摇铃，大家让一让～抓紧扶杆哦！', "I ring at every crossing so folks make way. Hold on tight!"],
], END, 'npc', crewName('gripman'));
seq('npc.deckhand', [
  ['happy', '欢迎上船！海上风大，扶好栏杆～', 'Welcome aboard! It gets breezy out on the water, so hold the rail~'],
  ['wave', '想看海鸥就去船尾，它们最爱跟船飞。', 'Want gulls? Head to the stern, they love to follow the boat.'],
], END, 'npc', crewName('deckhand'));

// the cable cars and the ferry (lane F reads these through content.hookText; `{station}` = the station's name).
// Glossary: 叮当车 for the cable cars in everything BAYBAY and the crews say.
one({ id: 'cablecar.station', speaker: 'npc', npcName: crewName('gripman'), mood: 'happy', text: { zh: '叮叮！这里是 {station}。抓紧扶杆，想去哪儿？', en: 'Ding-ding! This is {station}. Hold on tight, where to?' } });
seq('cablecar.board', [['excited', '上车啦！抓紧扶杆，叮当车要爬坡咯～', 'All aboard! Hold the pole, up the hill we go~']]);
// lane F counts a ride after RIDE_MIN_ODOMETER (150 u, several stops) at the next station: "a few stops", not "one"
seq('cablecar.count', [['thinking', '多坐几站再下车，才算坐过叮当车哦。', 'Ride a few stops before you hop off and it counts as a cable-car ride.']]);
seq('cablecar.off', [['happy', '叮叮！下次还坐叮当车～', 'Ding-ding! Let’s ride again soon~']]);
seq('cablecar.turned', [['proud', '转过来啦！我们是全城最棒的推车手！', 'Round she goes! Best pushers in the whole city!']]);
one({ id: 'ferry.station', speaker: 'npc', npcName: crewName('deckhand'), mood: 'happy', text: { zh: '欢迎上船！这里是 {station}，想去哪个码头？', en: 'Welcome aboard! This is {station}. Which pier are we headed to?' } });
seq('ferry.board', [['excited', '上船啦！找个靠栏杆的位置看海～', 'All aboard! Grab a spot by the rail and watch the water~']]);
seq('ferry.off', [['happy', '靠岸啦！下船小心脚下～', "We've docked! Watch your step~"]]);
// the city F-line (lane F, wave 3 a: the streetcarBoard hook; game/transit.ts keeps its inline line as the fallback)
seq('streetcar.board.city', [['excited', '上车啦！F 线的老电车，一路开过整条 Market 街～', 'All aboard! A vintage F-line car, all the way up Market Street~']]);

// ---------------------------------------------------------------------------
// Collectibles, handoff, misc
// ---------------------------------------------------------------------------

seq('postcard.first', [
  ['excited', '第一张明信片！一共藏了 8 张，旅行本里有提示。', 'Your first postcard! There are 8 hidden around — your journal has hints.'],
]);
seq('postcard.found', [
  ['excited', '又一张明信片！已经收进你的旅行本啦。', "Another postcard! It's tucked into your journal."],
]);
seq('postcard.all', [
  ['proud', '8 张全收齐了！这片海滨，你比很多本地人还熟。', 'All 8 collected! You know this waterfront better than a lot of locals.'],
], { next: 'handoff.plan' });
// city mode: 20 cards (the waterfront's 8 + 12 around the city)
seq('postcard.first.city', [
  ['excited', '第一张明信片！全城一共藏了 20 张，旅行本里有线索。', 'Your first postcard! 20 are hidden around the city — your journal has clues.'],
]);
seq('postcard.all.city', [
  ['proud', '20 张全收齐了！整座旧金山，你比很多本地人还熟。', 'All 20 collected! You know San Francisco better than a lot of locals.'],
], { next: 'handoff.plan' });

one({
  id: 'handoff.plan',
  speaker: 'baybay',
  mood: 'wave',
  text: { zh: '把想去的地方带去 BAYLINK 安排吧，下次来我还在这儿！', en: "Take the places you liked to BAYLINK and plan a real day out. I'll be here next time!" },
  choices: [
    choice('1', '打开旅行本', 'Open my journal', { action: { type: 'open-journal' } }),
    choice('2', '再逛一会儿', 'Keep exploring', { action: { type: 'end' } }),
  ],
});
seq('goodbye', [
  ['wave', '今天走得开心吗？海风、面包和海狮，都在这儿等你回来～', 'Did you have fun? The breeze, the bread and the sea lions will be here when you’re back.'],
]);
seq('guide.edge', [
  ['thinking', '前面是模型边缘啦，再走就掉到桌子上咯！', "That's the edge of the model — one more step and you're on the table!"],
]);

/** Entry nodes the game systems can play for each situation. */
export const DISTRICT_SCRIPT_HOOKS = {
  start: DISTRICT_START_NODE,
  localIntro: 'local.intro',
  tourIntro: 'tour.intro',
  tourResume: 'tour.resume',
  tourOutro: 'tour.outro',
  tourAfter: 'tour.after',
  weekIntro: 'week.intro',
  weekSearching: 'week.searching',
  weekResult: { found: 'week.result.found', few: 'week.result.few', none: 'week.result.none', error: 'week.result.error' },
  weekOutro: 'week.outro',
  freeIntro: 'free.intro',
  freeGoals: 'free.goals',
  call: 'call.menu',
  board: 'poi.weekly-board',
  marketClosed: 'poi.farmers-market.closed',
  marketClosedTour: 'tour.farmers-market.closed',
  viewpoint: 'poi.coit-tower',
  streetcarOff: 'streetcar.off',
  postcardFirst: 'postcard.first',
  postcardFound: 'postcard.found',
  postcardAll: 'postcard.all',
  handoff: 'handoff.plan',
  goodbye: 'goodbye',
  edge: 'guide.edge',
} as const;
type ScriptHooks = { readonly [K in keyof typeof DISTRICT_SCRIPT_HOOKS]: (typeof DISTRICT_SCRIPT_HOOKS)[K] extends string ? string : Readonly<Record<string, string>> };
/**
 * City-only hooks (lane F's cable cars and ferry read them with content.hookText; in district mode they resolve to
 * nothing and F keeps its inline line). `cablecarStation` / `ferryStation` carry a `{station}` placeholder.
 */
export const CITY_TRANSIT_HOOKS = {
  cablecarStation: 'cablecar.station',
  cablecarBoard: 'cablecar.board',
  cablecarCount: 'cablecar.count',
  cablecarOff: 'cablecar.off',
  turntableTurned: 'cablecar.turned',
  ferryStation: 'ferry.station',
  ferryBoard: 'ferry.board',
  ferryOff: 'ferry.off',
  streetcarBoard: 'streetcar.board.city',
} as const;
/** City mode: the city welcome, free-roam intro and goals, card counts, call menu, edge line and transit hooks. */
export const CITY_SCRIPT_HOOKS: ScriptHooks & typeof CITY_TRANSIT_HOOKS = {
  ...DISTRICT_SCRIPT_HOOKS,
  start: CITY_START_NODE,
  tourAfter: 'tour.after.city',
  freeIntro: 'free.intro.city',
  freeGoals: 'free.goals.city',
  call: 'call.menu.city',
  postcardFirst: 'postcard.first.city',
  postcardAll: 'postcard.all.city',
  edge: 'guide.edge.city',
  ...CITY_TRANSIT_HOOKS,
};
/** Entry nodes of the active world (plan G2-0). */
export const SCRIPT_HOOKS: ScriptHooks = byMode<ScriptHooks>(DISTRICT_SCRIPT_HOOKS, CITY_SCRIPT_HOOKS);

/**
 * Second line under each welcome choice, keyed `${nodeId}:${hotkey}` — sets expectations before you pick
 * (ui/Dialogue.tsx renders it; no core type change).
 */
export const CHOICE_SUBS: Record<string, Bilingual> = {
  'intro.hello:1': { zh: '7 站 · 约 5 分钟 · 我带路', en: '7 stops · ~5 min · I lead' },
  'intro.hello:2': { zh: '3 个小问题 · 这周真实活动', en: '3 quick questions · real events this week' },
  'intro.hello:3': { zh: '随便走 · 找 8 张明信片', en: 'Wander · find 8 postcards' },
  'intro.hello:4': { zh: '不打扰，直接逛', en: 'No chatter — just explore' },
  // wave 4: the Grand Tour (= data/sf/tours.ts SF_GRAND.subtitle, tested)
  'intro.hello.city:1': GRAND_TOUR.subtitle,
  'intro.hello.city:2': { zh: '3 个小问题 · 这周真实活动', en: '3 quick questions · real events this week' },
  'intro.hello.city:3': { zh: '全城 20 张明信片 · 叮当车 · 双峰', en: '20 postcards citywide · cable cars · Twin Peaks' },
  'intro.hello.city:4': { zh: '不打扰，直接逛', en: 'No chatter — just explore' },
};

/** What BAYBAY says once you arrive at a tour stop: a natural nudge toward its micro-interaction. */
export const STOP_PROMPTS: Record<string, Bilingual> = {
  'ferry-building': { zh: '站进金圈，抬头看看钟楼～', en: 'Step into the gold ring and look up at the clock~' },
  'farmers-market': { zh: '来，尝一口酸面包！', en: 'Go on — have a bite of sourdough!' },
  pier7: { zh: '走到码头边，甩一竿试试！', en: 'Walk to the rail and cast a line!' },
  exploratorium: { zh: '凑近窗户，看看里面在玩什么～', en: 'Peek through the windows — what are they playing with?' },
  'filbert-steps': { zh: '嘘——站进金圈，听听有没有鹦鹉！', en: 'Shh — step into the ring and listen for parrots!' },
  'coit-tower': { zh: '站到观景点上，看看整个海湾！', en: 'Step onto the viewpoint and take in the whole Bay!' },
  'sea-lions': { zh: '举起相机，给海狮拍一张！', en: 'Raise your camera and snap the sea lions!' },
};

/** One-off BAYBAY speech bubbles (not dialogue nodes): pick one at random. */
type BarkKind = 'wait' | 'nudge' | 'nudgeTouch' | 'called' | 'edge' | 'idle' | 'morning' | 'day' | 'golden' | 'night';
export const DISTRICT_GUIDE_BARKS: Record<BarkKind, Bilingual[]> = {
  wait: [
    { zh: '这边这边！我等你～', en: "Over here! I'll wait for you~" },
    { zh: '慢慢来，风景又不会跑。', en: "Take your time — the view isn't going anywhere." },
    { zh: '走丢了？跟着我的蓝围巾走！', en: 'Lost? Follow my teal scarf!' },
  ],
  // after ~8 s standing still while BAYBAY leads: how to move, in plain words (desktop / touch)
  nudge: [{ zh: '按 WASD 或点我旁边的地面～', en: 'Use WASD, or click the ground next to me~' }],
  nudgeTouch: [{ zh: '点我旁边的地面～', en: 'Tap the ground next to me~' }],
  called: [
    { zh: '来啦来啦！', en: 'Coming, coming!' },
    { zh: '我在这儿！', en: "I'm right here!" },
  ],
  edge: [
    { zh: '前面是模型边缘啦！', en: "That's the edge of the model!" },
    { zh: '再走就掉到桌子上咯～', en: "Careful — any further and you're on the table!" },
  ],
  idle: [
    { zh: 'Karl 今天好像请假了——雾都没来上班。', en: 'Looks like Karl the Fog called in sick today.' },
    { zh: '要是我有口袋，一定装满酸面包。', en: "If I had pockets, they'd be full of sourdough." },
    { zh: '听，海狮又在远处开会了。', en: 'Hear that? The sea lions are in a meeting again.' },
    { zh: '海边的风，是我最喜欢的背景音乐。', en: 'The sea breeze is my favorite soundtrack.' },
  ],
  morning: [{ zh: '早上好！要是再来点雾，就是最正宗的旧金山早晨。', en: 'Good morning! Add a little fog and it’s a classic San Francisco morning.' }],
  day: [{ zh: '今天海风刚刚好，适合一直走下去。', en: "Perfect breeze today — let's keep walking." }],
  golden: [{ zh: '金色时刻！这光拍什么都好看。', en: 'Golden hour! Everything looks good in this light.' }],
  night: [{ zh: '码头的灯亮起来了，好温柔。', en: 'The pier lights are on — so cozy.' }],
};

/**
 * City mode (plan G2-0, CS-9): no waterfront-only lines (sea lions, pier lights) while you stand in Dolores Park or on
 * Ocean Beach; the rest (waiting, nudges, being called, morning fog, golden hour) is shared.
 */
export const CITY_GUIDE_BARKS: Record<BarkKind, Bilingual[]> = {
  ...DISTRICT_GUIDE_BARKS,
  edge: [
    { zh: '再往外就出了我们的旧金山啦！', en: "That's the edge of our San Francisco!" },
    { zh: '前面是模型边缘，再走就到桌子上咯～', en: "Model's edge ahead — one more step and you're on the table!" },
  ],
  idle: [
    { zh: 'Karl 今天好像请假了——雾都没来上班。', en: 'Looks like Karl the Fog called in sick today.' },
    { zh: '要是我有口袋，一定装满酸面包。', en: "If I had pockets, they'd be full of sourdough." },
    { zh: '这座城的坡，走着走着就成了风景。', en: 'In this city, every hill turns into a view if you keep walking.' },
    { zh: '每个街区都有自己的颜色，慢慢看。', en: 'Every neighbourhood has its own colours — take it slow.' },
  ],
  day: [{ zh: '今天的风刚刚好，适合一直走下去。', en: "Perfect breeze today — let's keep walking." }],
  night: [{ zh: '城里的灯一盏盏亮起来了，好温柔。', en: 'The city lights are coming on, one by one — so cozy.' }],
};
/** One-off bubbles of the active world (plan G2-0). */
export const GUIDE_BARKS: Record<BarkKind, Bilingual[]> = byMode(DISTRICT_GUIDE_BARKS, CITY_GUIDE_BARKS);
