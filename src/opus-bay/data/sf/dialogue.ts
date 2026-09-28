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
 *   wave 5 (W5-C7) the second favour: ask2 (after the first favour's thanks → fact, or straight away once declined) →
 *   yes2 · no2; remind2 → go2; thanks2 → fact2 (fact2's words follow the real day where the mark does: Rosa's Saturday
 *   market, Hank's tulips in spring, Marcus's weekend drums — fact2For)
 *
 * Voice: data/VOICE.md ("Transit crews and residents"). zh ≤ 45 bubble width, en ≤ 120, no key names (tested).
 */

const V = '2026-09-27';
const src = (url: string): LineSource => ({ url, verifiedAt: V });
/** wave 5 (W5-C7): the second favours' facts, checked on the web on this date */
const V5 = '2026-09-28';
const src5 = (url: string): LineSource => ({ url, verifiedAt: V5 });
export const W5_SOURCES = {
  bellContest: 'https://www.sfmta.com/press-releases/sfmta-announces-winners-55th-cable-car-bell-ringing-contest',
  ferryMarket: 'https://foodwise.org/markets/ferry-plaza-farmers-market/',
  tulipGarden: 'https://sfrecpark.org/908/Golden-Gate-Park---Queen-Wilhelmina-Gard',
  crissyMarsh: 'https://home.nps.gov/articles/crissy-field-restoration.htm',
  hippieHill: 'https://en.wikipedia.org/wiki/Hippie_Hill',
} as const;

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
  // wave 5 (W5-C7): the second favours
  'npc.gripman.fact2': src5(W5_SOURCES.bellContest),
  'npc.baker.ask2': src5(W5_SOURCES.ferryMarket),
  'npc.baker.fact2': src5(W5_SOURCES.ferryMarket),
  'npc.gardener.ask2': src5(W5_SOURCES.tulipGarden),
  'npc.gardener.fact2': src5(W5_SOURCES.tulipGarden),
  'npc.ranger.fact2': src5(W5_SOURCES.crissyMarsh),
  'npc.record-store.ask2': src5(W5_SOURCES.hippieHill),
  'npc.record-store.remind2': src5(W5_SOURCES.hippieHill),
  'npc.record-store.fact2': src5(W5_SOURCES.hippieHill),
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
    hi: ['wave', '嗨！我是画壁画的 Luz。巴尔米巷最早的壁画，是 1972 年画的。', "Hi! I'm Luz, I paint murals. The first murals in Balmy Alley went up in 1972."],
    ask: ['happy', '克拉里恩巷也全是壁画，那儿藏着一张明信片——帮我找回来好吗？', "Clarion Alley is full of murals too, and there's a postcard hidden there — could you find it for me?"],
    accept: bi('我去找', "I'll find it"),
    yes: ['excited', '它就在两块壁画之间，找发金光的小卡片！', "It's between two of the murals — look for the little golden glint!"],
    no: ['happy', '好呀，壁画又不会跑～', "Sure — the murals aren't going anywhere~"],
    remind: ['thinking', '克拉里恩巷在 17 街和 18 街之间，明信片就在巷子里。', "Clarion Alley runs between 17th and 18th Streets — the postcard's in the alley."],
    go: ['wave', '去吧，顺便看看那几面墙！', 'Go on — and take a good look at those walls!'],
    thanks: ['excited', '找到啦！克拉里恩巷的壁画计划从 1992 年开始，一直画到今天。', "You found it! The Clarion Alley Mural Project started in 1992 and it's still painting."],
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

/** Wave 5 (W5-C7): the second favour's words. */
interface Script2 { ask: Say; accept: Bilingual; yes: Say; no: Say; remind: Say; go: Say; thanks: Say; fact: Say }

const SCRIPTS2: Record<ResidentKey, Script2> = {
  gripman: {
    ask: ['happy', '你上次坐得真稳！再帮个忙？坐车时摇摇铃，跟我来段铃声对答～', 'You rode like a pro! One more? Ring the bell on a ride — answer my riff~'],
    accept: bi('来一段', "Let's ring"),
    yes: ['excited', '车一开，铃铛就归你啦。我摇一句，你学一句！', 'Once the car rolls, the bell is yours. I ring, you copy!'],
    no: ['happy', '好嘞，铃铛随时等你～', 'Sure — the bell will wait for you~'],
    remind: ['thinking', '坐上叮当车，车开起来就能摇铃啦。', 'Hop on a cable car — once it rolls you can ring the bell.'],
    go: ['wave', '转车台就在前面，叮叮！', 'The turntable is just ahead — ding ding!'],
    thanks: ['excited', '叮叮叮——就是这个节奏！你摇得比我徒弟还好。', 'Ding-ding-ding — that’s the rhythm! Better than my apprentice.'],
    fact: ['proud', '真有叮当车摇铃比赛！在联合广场，已经比了五十多届。', 'There really is a cable car bell ringing contest — in Union Square, more than fifty so far!'],
  },
  baker: {
    ask: ['happy', '周六我在渡轮大厦的农夫市集摆摊。帮我拍张钟楼做招牌好吗？', 'On Saturdays I sell at the Ferry Building farmers market. Could you photograph the clock tower for my sign?'],
    accept: bi('我去拍', "I'll take it"),
    yes: ['excited', '到渡轮大厦拍一张，把钟楼拍进去就行！', 'Take one at the Ferry Building — just get the clock tower in!'],
    no: ['happy', '好，招牌先空着～', 'Okay, the sign can wait~'],
    remind: ['thinking', '渡轮大厦在内河码头边上，钟楼老远就能看见。', 'The Ferry Building is on the Embarcadero — you can see its clock tower from far off.'],
    go: ['wave', '拍得好看点哦～', 'Make it a pretty one~'],
    thanks: ['excited', '拍得真好！这周六就挂上招牌，大家一眼就能找到我。', 'Lovely shot! It goes on my sign this Saturday — everyone will find me.'],
    fact: ['happy', '渡轮大厦的农夫市集，周六早上 8 点开到下午 2 点，来找我呀！', 'The Ferry Building farmers market runs 8 to 2 on Saturdays — come find me!'],
  },
  muralist: {
    ask: ['happy', '帮我收集颜色吧！去巴尔米巷、克拉里恩巷和女性大楼，各拍一张壁画。', "Help me collect colours! Take a mural photo in Balmy Alley, Clarion Alley and at the Women's Building."],
    accept: bi('我去拍', "I'm on it"),
    yes: ['excited', '拍的时候看看墙上的颜色，回来讲给我听！', 'Look at the colours on the walls while you shoot, then tell me!'],
    no: ['happy', '好呀，颜色一直都在墙上～', 'Sure — the colours will still be on the walls~'],
    remind: ['thinking', '三处壁画各拍一张：巴尔米巷、克拉里恩巷、女性大楼。', "One photo at each: Balmy Alley, Clarion Alley, the Women's Building."],
    go: ['wave', '去吧，找找最亮的那面墙！', 'Go on — find the brightest wall!'],
    thanks: ['excited', '三处的颜色都齐啦！我在巷子里给你画了个小东西～', 'All three sets of colours! I painted a little something for you in the alley~'],
    fact: ['happy', '去巷子中间的围栏上找找——有一只小海獭哦！', 'Look on the fence halfway down the alley — there’s a little otter!'],
  },
  gardener: {
    ask: ['happy', '花园每年十月重新种球根。帮我拍张风车吧，开花了好对比！', 'The garden replants its bulbs every October. Photograph the windmill for me — so we can compare when they bloom!'],
    accept: bi('我去拍', "I'll go"),
    yes: ['excited', '风车在公园最西边，挨着海滩。骑车更快哦～', "The windmill is at the park's far west end by the beach. A bike is quicker~"],
    no: ['happy', '不急，风车天天都在～', "No rush — the windmill's there every day~"],
    remind: ['thinking', '走到荷兰风车附近，拍一张就好。', 'Get near the Dutch Windmill and take one photo.'],
    go: ['wave', '路上看看公园的湖～', "Say hi to the park's lakes on the way~"],
    thanks: ['excited', '拍得真清楚！等到三月，咱们再拍一张比比看。', "So clear! Come March, we'll take another and compare."],
    fact: ['proud', '威廉明娜女王郁金香花园的郁金香，一般三月开得最旺。', 'The tulips in the Queen Wilhelmina garden are usually at their best in March.'],
  },
  ranger: {
    ask: ['happy', '巡护员的秘密：去克里西场海滩坐一会儿，看看金门大桥。', "A ranger's secret: sit a while on Crissy Field beach and watch the Golden Gate Bridge."],
    accept: bi('去坐坐', "I'll go sit"),
    yes: ['excited', '海滩上有个看风景的好位置，坐下来慢慢看！', "There's a good view spot on the beach — sit down and take your time!"],
    no: ['happy', '好，大桥和海都不会走～', "Sure — the bridge and the bay aren't going anywhere~"],
    remind: ['thinking', '在克里西场海滩找到看风景的位置，坐下看一会儿。', 'Find the view spot on Crissy Field beach and sit for a look.'],
    go: ['wave', '慢慢走，海风很舒服～', 'Take it slow — the sea breeze is lovely~'],
    thanks: ['excited', '看到了吧？这就是我每天巡完一圈后的奖励！', "See? That's my reward after every patrol!"],
    fact: ['proud', '1999 年 11 月，海水重新流进这里的湿地，湿地又活过来了。', 'In November 1999 the tide flowed back into the marsh here, and it came back to life.'],
  },
  'record-store': {
    ask: ['happy', '替我去嬉皮山拍张照？1967 年爱之夏，那儿到处是音乐。', 'Take a photo of Hippie Hill for me? In the 1967 Summer of Love it was full of music.'],
    accept: bi('我去拍', "I'll go"),
    yes: ['excited', '从海特街往公园里走，那片草坡就是！', "Walk into the park from Haight Street — it's that grassy slope!"],
    no: ['happy', '好，我再放一首～', "Okay, I'll play another track~"],
    remind: ['thinking', '嬉皮山在花卉温室和海特街之间，拍一张就好。', 'Hippie Hill is between the Conservatory of Flowers and Haight Street — one photo will do.'],
    go: ['wave', '顺着音乐走就对啦～', 'Just follow the music~'],
    thanks: ['excited', '就是这片草坡！我要把它印在店里的海报上。', "That's the slope! It's going on a poster in my shop."],
    fact: ['happy', '现在周末还常有人在嬉皮山围成圈打鼓，谁都能加入！', "On weekends there's often a drum circle on Hippie Hill — anyone can join!"],
  },
};

/**
 * fact2 on the real day (the marks that follow the calendar; `month` 1–12, `weekday` 0 = Sunday, Bay time): Rosa on a
 * Saturday market morning, Hank's tulips (sfrecpark: "usually in full bloom in March"; Feb–Apr counts as their
 * season here), Marcus on a weekend. Null = the plain fact2.
 */
export function fact2For(key: ResidentKey, d: { month: number; weekday: number; hour: number }): Say | null {
  if (key === 'baker' && d.weekday === 6 && d.hour >= 8 && d.hour < 14) return ['excited', '今天周六，市集开着呢！我的招牌就是你拍的那张钟楼～', "It's Saturday and the market's on! My sign is your clock tower photo~"];
  if (key === 'gardener') {
    // (review: the bulbs are only "asleep in the soil" once October's replanting is done — sfrecpark: the garden closes
    // all of May and October for re-planting; from May to September Hank says when they go in, as his ask2 does)
    if (d.month >= 2 && d.month <= 4) return ['excited', '郁金香开啦！快去风车下看看，比你那张照片热闹多了～', 'The tulips are out! Go and see the windmill — much livelier than your photo~'];
    if (d.month === 10) return ['happy', '这个月花园关门种新球根，郁金香一般三月开得最旺，到时候来看！', "The garden's closed this month while the new bulbs go in — the tulips are usually best in March. Come and see!"];
    if (d.month >= 5 && d.month <= 9) return ['happy', '花园每年十月种新球根，郁金香一般三月开得最旺，到时候来看！', 'New bulbs go in every October — the tulips are usually best in March. Come and see!'];
    return ['happy', '新球根在土里睡觉呢，郁金香一般三月开得最旺，到时候来看！', 'The new bulbs are asleep in the soil — the tulips are usually best in March. Come and see!'];
  }
  if (key === 'record-store' && (d.weekday === 0 || d.weekday === 6)) return ['excited', '今天周末！嬉皮山上说不定正有人围成圈打鼓呢～', "It's the weekend — there may be a drum circle on Hippie Hill right now~"];
  return null;
}

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
/** Wave 5 (W5-C7): the second favour's nodes. */
export const nodeIds2 = (key: ResidentKey) => ({
  ask: `npc.${key}.ask2`, yes: `npc.${key}.yes2`, no: `npc.${key}.no2`, remind: `npc.${key}.remind2`, go: `npc.${key}.go2`,
  thanks: `npc.${key}.thanks2`, fact: `npc.${key}.fact2`,
});

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

/** Wave 5 (W5-C7): the second favour's nodes; `fact` = fact2 in the words of the real day (fact2For), when given. */
export function residentNodes2(r: ResidentDef, fact: Say | null = null): DialogueNode[] {
  const s = SCRIPTS2[r.key], id = nodeIds2(r.key);
  const say = (nodeId: string, [mood, zh, en]: Say, more: Partial<DialogueNode> = {}): DialogueNode => ({
    id: nodeId, speaker: 'npc', npcName: r.name, mood, text: { zh, en }, ...(more.next || more.choices ? {} : { action: END }), ...more,
  });
  return [
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
    say(id.fact, fact ?? s.fact),
  ];
}

/** Every resident node (residentTasks defines them once per page). */
export function residentDialogue(): DialogueNode[] {
  const nodes = RESIDENTS.flatMap(r => [...residentNodes(r), ...residentNodes2(r)]);
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
  /** wave 5 (W5-C7): a photo favour's spot photographed (toast), the letters */
  photoSpot: (n: number, need: number, spot: Bilingual): Bilingual => bi(`拍到啦 ${n}/${need} · ${spot.zh}`, `Got it ${n}/${need} · ${spot.en}`),
  letter: (short: Bilingual): Bilingual => bi(`收到一封信 · 来自 ${short.zh}`, `A letter for you · from ${short.en}`),
  /** BAYBAY, when a letter arrives (the Journal's 目标 tab has the letters) */
  letterLine: bi('有你的信！在旅行本的「目标」里～', "You've got a letter! It's in your journal, under Goals~"),
  allLetters: bi('六个邻居都给你写了信——你是大家的好朋友啦！', 'All six neighbours have written to you — you’re everyone’s friend now!'),
  /** Ray's riff when you walk past him after his second favour (his bubble) */
  rayRiff: bi('叮叮——叮叮叮！你教我的那段～', 'Ding-ding — ding-ding-ding! Your riff~'),
} as const;
