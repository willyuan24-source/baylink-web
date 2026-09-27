import type { Bilingual, DialogueNode, Mood } from '../../core/types';
import type { LineSource } from './lines';
import { RESIDENTS, type ResidentDef, type ResidentKey } from './residents';

/**
 * What the six city residents say (lane G2, plan G2-6). Loaded with game/residentTasks.ts (its own chunk, city mode
 * only), which defines these nodes at runtime (flow.defineNode) and picks the entry node from the favour's state.
 *
 * Nodes per resident `k` (ids `npc.<k>.*`, so ui/Dialogue.tsx shows the `npc-<k>` portrait):
 *   hi → ask          the first meeting: who they are (one sourced fact), then the favour with 接受 / 下次吧
 *   yes · no          the answer; residentTasks marks the favour accepted when `npc.<k>.yes` is shown
 *   remind            the favour is on: where to go, 带我去 (→ go: the walk starts when the dialogue closes) / 好的
 *   thanks → fact     the favour is done: thanks and a second sourced fact (every later chat replays it)
 *   gripman.bread → bread2   Rosa's loaf delivered (the baker's favour finishes when `npc.gripman.bread` is shown)
 *
 * Voice: data/VOICE.md ("Transit crews and residents"). zh ≤ 45 bubble width, en ≤ 120, no key names (tested).
 */

const V = '2026-09-27';
const src = (url: string): LineSource => ({ url, verifiedAt: V });

/** The facts residents say, by node id, with where they were checked (tests: every fact node has one). */
export const RESIDENT_SOURCES: Record<string, LineSource> = {
  'npc.gripman.hi': src('https://www.sfmta.com/getting-around/muni/cable-cars'),
  'npc.gripman.thanks': src('https://en.wikipedia.org/wiki/San_Francisco_cable_car_system'),
  'npc.gripman.fact': src('https://en.wikipedia.org/wiki/San_Francisco_cable_car_system'),
  'npc.baker.fact': src('https://en.wikipedia.org/wiki/Fructilactobacillus_sanfranciscensis'),
  'npc.muralist.hi': src('https://en.wikipedia.org/wiki/Balmy_Alley'),
  'npc.muralist.thanks': src('https://en.wikipedia.org/wiki/Clarion_Alley'),
  'npc.gardener.hi': src('https://en.wikipedia.org/wiki/Conservatory_of_Flowers'),
  'npc.gardener.thanks': src('https://sfrecpark.org/908/Golden-Gate-Park---Queen-Wilhelmina-Gard'),
  'npc.gardener.fact': src('https://en.wikipedia.org/wiki/Dutch_Windmill_(Golden_Gate_Park)'),
  'npc.ranger.hi': src('https://en.wikipedia.org/wiki/Crissy_Field'),
  'npc.ranger.thanks': src('https://en.wikipedia.org/wiki/Golden_Gate_Bridge'),
  'npc.ranger.fact': src('https://en.wikipedia.org/wiki/Crissy_Field'),
  'npc.record-store.hi': src('https://en.wikipedia.org/wiki/Haight-Ashbury'),
  'npc.record-store.thanks': src('https://www.kqed.org/news/11682057/how-the-bay-areas-fog-came-to-be-named-karl'),
};

type Say = [Mood, string, string];
interface Script {
  hi: Say; ask: Say; accept: Bilingual; yes: Say; no: Say; remind: Say; go: Say; thanks: Say; fact: Say;
}

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

const SCRIPTS: Record<ResidentKey, Script> = {
  gripman: {
    hi: ['wave', '嘿，我是叮当车司机 Ray！转车台上的车，都是我们用手推着掉头的。', "Hey, I'm Ray, a gripman! We turn the cars on this turntable by hand — we push them round."],
    ask: ['happy', '帮我个忙？坐一段叮当车，告诉我今天抓手稳不稳～', 'Do me a favour? Take a ride and tell me how the grip feels today~'],
    accept: bi('包在我身上', "I'm on it"),
    yes: ['excited', '好嘞！在转车台上车，抓紧扶杆，多坐几站再下哦。', 'Great! Board at the turntable, hold the pole and ride a few stops before you hop off.'],
    no: ['happy', '没关系，叮叮——我一直在这儿！', "No worries — ding ding, I'm always here!"],
    remind: ['thinking', '还没坐吧？在转车台上车，多坐几站就行。', 'Not yet? Board at the turntable and ride a few stops.'],
    go: ['wave', '去吧，跟着路标走就到！', 'Off you go — follow the marker!'],
    thanks: ['excited', '坐过啦？地下的缆绳一直以每小时 9.5 英里在跑，抓手一抓车就走！', 'Rode it? The cable under the street runs at a steady 9.5 mph — grab it and the car goes!'],
    fact: ['proud', '全世界只剩旧金山的叮当车还靠人手开。谢谢你陪我试车！', "Ours are the world's last manually operated cable cars. Thanks for the test ride!"],
  },
  baker: {
    // no "早呀 / Morning": the chat can happen at any hour of the Bay's clock (night included)
    hi: ['wave', '哈喽，我是面包师 Rosa！刚出炉的酸面包，闻到了吗？', "Hiya, I'm Rosa, the baker! Smell that? Sourdough, fresh from the oven."],
    ask: ['happy', '能帮我把这个面包送给叮当车司机 Ray 吗？他在 Powell & Market 转车台。', "Could you take this loaf to Ray the gripman? He's at the Powell & Market turntable."],
    accept: bi('交给我吧', 'Leave it to me'),
    yes: ['excited', '谢谢！趁热送去，他最爱这一口～', "Thank you! Take it while it's warm — it's his favourite~"],
    no: ['happy', '好，面包我先给他留着～', "Okay, I'll keep it for him~"],
    remind: ['thinking', '面包还热着呢！Ray 在 Powell & Market 转车台旁。', "The bread's still warm! Ray's by the Powell & Market turntable."],
    go: ['wave', '快去快回～', 'Off you go~'],
    thanks: ['excited', '送到啦？谢谢你！Ray 每天早上都等着这一口。', 'Delivered? Thank you! Ray waits for that loaf every morning.'],
    fact: ['happy', '告诉你个秘密：酸面包里有种乳酸菌，学名就叫 sanfranciscensis！', "Here's a secret: a bacterium in sourdough is named after this city — sanfranciscensis!"],
  },
  muralist: {
    hi: ['wave', '嗨！我是画壁画的 Luz。Balmy 巷最早的壁画，是 1972 年画的。', "Hi! I'm Luz, I paint murals. The first murals in Balmy Alley went up in 1972."],
    ask: ['happy', 'Clarion 巷也全是壁画，那儿藏着一张明信片——帮我找回来好吗？', "Clarion Alley is full of murals too, and there's a postcard hidden there — could you find it for me?"],
    accept: bi('我去找', "I'll find it"),
    yes: ['excited', '它就在两块壁画之间，找发金光的小卡片！', "It's between two of the murals — look for the little golden glint!"],
    no: ['happy', '好呀，壁画又不会跑～', "Sure — the murals aren't going anywhere~"],
    remind: ['thinking', 'Clarion 巷在 17 街和 18 街之间，明信片就在巷子里。', "Clarion Alley runs between 17th and 18th Streets — the postcard's in the alley."],
    go: ['wave', '去吧，顺便看看那几面墙！', 'Go on — and take a good look at those walls!'],
    thanks: ['excited', '找到啦！Clarion 巷的壁画计划从 1992 年开始，一直画到今天。', "You found it! The Clarion Alley Mural Project started in 1992 and it's still painting."],
    fact: ['happy', '下次来，墙上说不定又换了新画。谢谢你！', 'Next time you come, the walls might have new paintings. Thank you!'],
  },
  gardener: {
    hi: ['wave', '你好，我是园丁 Hank。身后的花卉温室，1879 年就建好了。', "Hello, I'm Hank, a gardener. The Conservatory behind me was finished in 1879."],
    ask: ['happy', '公园西头的荷兰风车下有个郁金香花园，能帮我去看一眼吗？', "There's a tulip garden under the Dutch Windmill at the park's west end — could you check on it?"],
    accept: bi('我去看看', "I'll check"),
    yes: ['excited', '一直往西走，看到大风车就到啦。骑车更快哦～', 'Head west until you see the big windmill. A bike is quicker~'],
    no: ['happy', '不急，花儿慢慢长～', 'No rush — flowers take their time~'],
    remind: ['thinking', '风车在公园最西边，挨着大海。', "The windmill is at the park's far west end, by the ocean."],
    go: ['wave', '路上慢慢逛，公园很大哦！', "Enjoy the walk — it's a big park!"],
    thanks: ['excited', '花园还好吧？郁金香一般三月开得最旺。', "How's the garden? The tulips are usually in full bloom in March."],
    fact: ['proud', '那架风车 1903 年建成，以前是给公园抽水浇地的。谢谢你！', 'That windmill went up in 1903 to pump water for the park. Thanks for going!'],
  },
  ranger: {
    hi: ['wave', '嗨，我是巡护员 Dana！这片草地以前是陆军的飞机场。', "Hi, I'm Ranger Dana! This lawn used to be an Army airfield."],
    ask: ['happy', '今天风好，想不想走上金门大桥，一直走到南塔？', 'Nice breeze today — fancy walking out onto the Golden Gate Bridge to the south tower?'],
    accept: bi('走起', "Let's go"),
    yes: ['excited', '从桥头走上桥面，到第一座桥塔就好。记得看海！', "Get onto the deck at the bridge's end and walk to the first tower. Watch the water!"],
    no: ['happy', '好，桥一直都在～', 'Sure — the bridge will still be there~'],
    remind: ['thinking', '南塔就是离城最近的那座塔，走上桥面就到。', 'The south tower is the one nearest the city — just walk the deck.'],
    go: ['wave', '出发！桥上风大，抓好帽子～', "Off you go! It's windy up there — hold on to your hat~"],
    thanks: ['excited', '走到南塔啦？1937 年通车前一天，约 20 万人走路或溜冰过桥！', 'Made it to the tower? The day before cars were allowed in 1937, about 200,000 people crossed on foot or skates!'],
    fact: ['proud', '这片草地 1974 年才停飞，现在是大家的公园。谢谢你！', 'Planes stopped using this field in 1974 — now it’s a park for everyone. Thank you!'],
  },
  'record-store': {
    hi: ['wave', '嘿，我是开唱片店的 Marcus。1967 年「爱之夏」，这条街满是音乐。', "Hey, I'm Marcus, I run a record shop. In the 1967 Summer of Love, this street was full of music."],
    ask: ['happy', '帮我爬上双峰看看：我们的雾 Karl 今天来了没？', 'Could you climb Twin Peaks and see if Karl — our fog — has rolled in today?'],
    accept: bi('我去看看', "I'll go look"),
    yes: ['excited', '双峰就在城中间，两座挨着的山。山顶风大，慢慢爬！', 'Twin Peaks are the two hills side by side mid-city. Windy on top — take it easy!'],
    no: ['happy', '好，我先放张唱片～', "Okay, I'll put a record on~"],
    remind: ['thinking', '双峰在城中间，山顶有个观景台。', 'Twin Peaks is mid-city, with a lookout at the top.'],
    go: ['wave', '去吧，看完回来告诉我！', 'Go on — come back and tell me!'],
    thanks: ['excited', '看到 Karl 了吗？管雾叫 Karl，是从 2010 年一个推特账号开始的。', 'Did you see Karl? Calling the fog Karl started with a Twitter account in 2010.'],
    fact: ['happy', '下次来店里，我给你放张老唱片！谢谢你～', "Drop by the shop next time — I'll spin you an old record. Thanks~"],
  },
};

/** Rosa's loaf reaches Ray (the baker's favour, spoken by Ray). */
const BREAD: [Say, Say] = [
  ['excited', 'Rosa 的酸面包？还热乎呢！替我谢谢她～', 'Sourdough from Rosa? Still warm! Tell her thanks~'],
  ['happy', '我们推车推一上午，就靠这口面包撑着！', 'We push cars all morning — this bread keeps us going!'],
];

export const nodeIds = (key: ResidentKey) => ({
  hi: `npc.${key}.hi`, ask: `npc.${key}.ask`, yes: `npc.${key}.yes`, no: `npc.${key}.no`,
  remind: `npc.${key}.remind`, go: `npc.${key}.go`, thanks: `npc.${key}.thanks`, fact: `npc.${key}.fact`,
});
export const BREAD_NODE = 'npc.gripman.bread';

const END = { type: 'end' } as const;

function residentNodes(r: ResidentDef): DialogueNode[] {
  const s = SCRIPTS[r.key], id = nodeIds(r.key);
  const say = (nodeId: string, [mood, zh, en]: Say, more: Partial<DialogueNode> = {}): DialogueNode => ({
    id: nodeId, speaker: 'npc', npcName: r.name, mood, text: { zh, en }, ...(more.next || more.choices ? {} : { action: END }), ...more,
  });
  return [
    say(id.hi, s.hi, { next: id.ask }),
    say(id.ask, s.ask, {
      choices: [
        { hotkey: '1', label: s.accept, next: id.yes },
        { hotkey: '2', label: bi('下次吧', 'Maybe later'), next: id.no },
      ],
    }),
    say(id.yes, s.yes),
    say(id.no, s.no),
    say(id.remind, s.remind, {
      choices: [
        { hotkey: '1', label: bi('带我去', 'Take me there'), next: id.go },
        { hotkey: '2', label: bi('好的', 'Okay'), action: END },
      ],
    }),
    say(id.go, s.go),
    say(id.thanks, s.thanks, { next: id.fact }),
    say(id.fact, s.fact),
  ];
}

/** Every resident node (residentTasks defines them once per page). */
export function residentDialogue(): DialogueNode[] {
  const nodes = RESIDENTS.flatMap(residentNodes);
  const ray = RESIDENTS.find(r => r.key === 'gripman')!;
  nodes.push(
    { id: BREAD_NODE, speaker: 'npc', npcName: ray.name, mood: BREAD[0][0], text: { zh: BREAD[0][1], en: BREAD[0][2] }, next: `${BREAD_NODE}2` },
    { id: `${BREAD_NODE}2`, speaker: 'npc', npcName: ray.name, mood: BREAD[1][0], text: { zh: BREAD[1][1], en: BREAD[1][2] }, action: END },
  );
  return nodes;
}

/** Toasts and BAYBAY's bubble around a favour. */
export const TASK_TEXT = {
  accepted: (title: Bilingual): Bilingual => bi(`新的小忙：${title.zh}`, `New favour: ${title.en}`),
  done: (title: Bilingual): Bilingual => bi(`小忙完成：${title.zh}`, `Favour done: ${title.en}`),
  /** BAYBAY, right after the deed (not for a delivery: the thanks is already on screen) */
  tellThem: (short: Bilingual): Bilingual => bi(`完成啦！回去告诉 ${short.zh} 吧～`, `Done! Let's go tell ${short.en}~`),
  allDone: bi('六个邻居都帮过啦——你真像个旧金山人了！', "You've helped all six neighbours — you're a real San Franciscan now!"),
} as const;
