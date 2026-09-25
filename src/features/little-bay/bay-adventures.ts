import { validJourneyPlace } from './bay-journey';

export type AdventureText = { zh: string; en: string };
export type BayAdventureStep = { key: string; title: AdventureText; action: AdventureText; memory: AdventureText };
export type BayAdventure = { id: string; title: AdventureText; description: AdventureText; badge: AdventureText; symbol: string; color: string; steps: readonly BayAdventureStep[] };
const words = (zh: string, en: string): AdventureText => ({ zh, en });
const step = (key: string, zh: string, en: string, actionZh: string, actionEn: string, memoryZh: string, memoryEn: string): BayAdventureStep => ({ key, title: words(zh, en), action: words(actionZh, actionEn), memory: words(memoryZh, memoryEn) });

/** Authored game stories, deliberately separate from real event listings and prize claims. */
export const BAY_ADVENTURES: readonly BayAdventure[] = [
  {
    id: 'bay-postcard', title: words('送一张跨湾明信片', 'A postcard across the Bay'), symbol: '✉', color: '#739fa0',
    description: words('在钟楼写一句问候，穿过海湾，把它送到另一边的校园。', 'Write a hello beneath the clock tower, cross the Bay and deliver it to a campus on the other side.'), badge: words('海风邮差', 'Bay breeze postie'),
    steps: [
      step('sf:ferry', 'Ferry Building', 'Ferry Building', '写好明信片', 'Write the postcard', 'BAYBAY 写下：海湾很大，问候可以很近。', 'BAYBAY writes: a wide bay, a little hello.'),
      step('east-bay:jack-london', 'Jack London Square', 'Jack London Square', '盖上港口邮戳', 'Add the harbor postmark', '港口邮戳像一朵小小的浪花，落在明信片角落。', 'A harbor postmark lands like a tiny wave in the corner.'),
      step('east-bay:berkeley', 'UC Berkeley', 'UC Berkeley', '投递明信片', 'Deliver the postcard', '钟声响起。BAYBAY 把跨湾的问候放进想象中的校园信箱。', 'The bells ring as BAYBAY delivers a cross-bay hello to an imaginary campus mailbox.'),
    ],
  },
  {
    id: 'bright-ideas', title: words('灵感寻宝路线', 'A trail of bright ideas'), symbol: '✦', color: '#b59861',
    description: words('红瓦下找问题，在计算机故事中找线索，把灵感带到科学馆。', 'Find a question under red tiles, a clue in computing history and an idea to bring to the science museum.'), badge: words('湾区灵感家', 'Bay idea collector'),
    steps: [
      step('peninsula:stanford', 'Stanford 校园', 'Stanford campus', '收下好奇心纸飞机', 'Collect a curiosity plane', '纸飞机上写着：如果今天试一种新办法呢？', 'The paper plane asks: what if we try a new way today?'),
      step('south-bay:computer-history', 'Computer History Museum', 'Computer History Museum', '找到一枚灵感芯片', 'Find an idea chip', '一枚想象中的芯片，装着许多还没被问过的问题。', 'An imaginary chip holds a pocketful of questions waiting to be asked.'),
      step('south-bay:tech', 'The Tech Interactive', 'The Tech Interactive', '点亮灵感徽章', 'Light the idea badge', 'BAYBAY 把问题、故事和想象拼成一束光。', 'BAYBAY turns a question, a story and a little imagination into a spark.'),
    ],
  },
  {
    id: 'coastal-collection', title: words('收集三种海风', 'Three kinds of sea breeze'), symbol: '≈', color: '#889a70',
    description: words('从城市沙滩到海岸小镇，再到南湾湿地，装满一本海风旅行册。', 'From a city beach to a coastal town and South Bay marshes, fill a little book with sea breezes.'), badge: words('海岸收藏家', 'Coast collector'),
    steps: [
      step('sf:ocean-beach', 'Ocean Beach', 'Ocean Beach', '记录城市海风', 'Collect the city breeze', '沙上的小脚印，把城市的声音留在身后。', 'Tiny footprints in the sand leave the city sounds behind.'),
      step('peninsula:half-moon-bay', 'Half Moon Bay', 'Half Moon Bay', '记录小镇海风', 'Collect the coastal breeze', 'BAYBAY 的旅行册里，多了一页太平洋蓝。', 'BAYBAY adds a page of Pacific blue to the journal.'),
      step('south-bay:alviso', 'Alviso Marina', 'Alviso Marina', '记录湿地微风', 'Collect the marsh breeze', '放轻脚步，留下一页安静的湿地回忆。', 'Soft footsteps leave a quiet marshland memory.'),
    ],
  },
  {
    id: 'around-the-bay', title: words('BAYBAY 的全湾环游', 'BAYBAY’s grand Bay loop'), symbol: '⌁', color: '#a48da8',
    description: words('经过大桥、花园、创意街区与湖岸，把四片湾区连成一段故事。', 'A bridge, a garden, a place for ideas and a lakeshore: four parts of the Bay, one little story.'), badge: words('环湾探险家', 'Around-the-Bay explorer'),
    steps: [
      step('sf:bridge', '金门大桥', 'Golden Gate Bridge', '领取环湾旅行册', 'Pick up the Bay journal', '红色大桥是旅程的书签。下一页，去找花园。', 'The red bridge marks the first page. Next, a garden.'),
      step('peninsula:filoli', 'Filoli 花园', 'Filoli House & Garden', '画下一片花园绿', 'Sketch a garden green', 'BAYBAY 画了一片想象中的叶子，把花留在花园里。', 'BAYBAY sketches an imaginary leaf, leaving the flowers in the garden.'),
      step('south-bay:google-visitor', 'Google 访客空间', 'Google Visitor Experience', '写下一个新点子', 'Write down a bright idea', '新点子是：把每一段小旅行，变成认识邻里的开始。', 'A bright idea: let each little journey begin a new neighborhood connection.'),
      step('east-bay:lake-merritt', 'Lake Merritt', 'Lake Merritt', '完成全湾旅行册', 'Complete the Bay journal', '四区的风景装进一本小册子。BAYBAY 还想继续走下去。', 'Four parts of the Bay fit into one little journal. BAYBAY is ready to keep exploring.'),
    ],
  },
  {
    id: 'peninsula-small-stops', title: words('半岛小城慢游', 'Little Peninsula stops'), symbol: '⌂', color: '#a58b64',
    description: words('从 Millbrae 的换乘站出发，串起 Belmont 与 Menlo Park 的两片社区绿地。', 'Begin at Millbrae’s interchange, then connect two neighbourhood parks in Belmont and Menlo Park.'), badge: words('小城观察家', 'Neighbourhood observer'),
    steps: [
      step('peninsula:millbrae-transit', 'Millbrae 换乘枢纽', 'Millbrae Transit Center', '画一枚出发印章', 'Draw a departure stamp', 'BAYBAY 画了一枚小车票：下一站，去认识一座小城。', 'BAYBAY sketches a little ticket: next stop, a new neighbourhood.'),
      step('peninsula:twin-pines', 'Twin Pines Park', 'Twin Pines Park', '记下溪边的绿意', 'Note a creekside green', '把树影画进旅行册，给匆忙的旅程留一点慢时光。', 'A sketch of leafy shadows leaves room for a slower moment in the journal.'),
      step('peninsula:burgess-park', 'Burgess Park', 'Burgess Park', '完成小城观察页', 'Finish the neighbourhood page', '车站、溪边与社区公园，变成三枚只属于这次游戏旅程的小印章。', 'A station, a creekside pause and a neighbourhood park become three imaginary stamps from this game journey.'),
    ],
  },
  {
    id: 'east-bay-green-pages', title: words('东湾的三页绿意', 'Three green East Bay pages'), symbol: '♧', color: '#789879',
    description: words('从 Hayward 的庭园到 Fremont 的湖畔，再去 Ardenwood 看看农场的故事。', 'From Hayward’s garden to Fremont’s lakeside, then on to the farm stories at Ardenwood.'), badge: words('东湾绿意收藏家', 'East Bay green collector'),
    steps: [
      step('east-bay:hayward-garden', 'Hayward 日本庭园', 'Hayward Japanese Gardens', '描下一片庭园绿', 'Sketch a garden green', 'BAYBAY 在纸上描下一片想象中的叶子，把真正的叶子留在树上。', 'BAYBAY sketches an imaginary leaf, leaving the real leaves on their branches.'),
      step('east-bay:fremont-central-park', 'Central Park · Lake Elizabeth', 'Central Park · Lake Elizabeth', '收下湖畔的倒影', 'Keep a lakeside reflection', '旅行册多了一道蓝绿的波纹，那是 BAYBAY 画下的湖畔回忆。', 'A blue-green ripple joins the journal: BAYBAY’s little drawing of a lakeside memory.'),
      step('east-bay:ardenwood', 'Ardenwood 历史农场', 'Ardenwood Historic Farm', '完成绿意旅行页', 'Complete the green pages', '庭园、湖岸与农场凑成三页绿意。游戏徽章已经夹进旅行册。', 'A garden, a lakeshore and a farm fill three green pages. An imaginary game badge marks the journal.'),
    ],
  },
];

export type BayAdventureProgress = { version: 1; activeId: string | null; stamps: Record<string, string[]> };
export const emptyBayAdventures = (): BayAdventureProgress => ({ version: 1, activeId: null, stamps: {} });
export const bayAdventuresKey = (owner?: string) => `baylink.bay-adventures.v1:${owner ? `user:${encodeURIComponent(owner)}` : 'guest'}`;
export const adventureFor = (id: string | null) => BAY_ADVENTURES.find(quest => quest.id === id);
export const adventureCount = (progress: BayAdventureProgress, quest: BayAdventure) => Math.min(quest.steps.length, progress.stamps[quest.id]?.length || 0);
export const adventureNextKey = (progress: BayAdventureProgress): string | null => {
  const quest = adventureFor(progress.activeId);
  return quest?.steps[adventureCount(progress, quest)]?.key || null;
};

export function parseBayAdventures(raw: string | null): BayAdventureProgress {
  const empty = emptyBayAdventures();
  if (!raw || raw.length > 20_000) return empty;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.stamps || typeof data.stamps !== 'object' || Array.isArray(data.stamps)) return empty;
    const stamps: Record<string, string[]> = {};
    for (const quest of BAY_ADVENTURES) {
      const saved = data.stamps[quest.id];
      if (!Array.isArray(saved)) continue;
      const clean: string[] = [];
      for (const date of saved.slice(0, quest.steps.length)) {
        if (typeof date !== 'string' || date.length > 40 || !Number.isFinite(Date.parse(date))) break;
        clean.push(new Date(date).toISOString());
      }
      if (clean.length) stamps[quest.id] = clean;
    }
    return { version: 1, activeId: typeof data.activeId === 'string' && adventureFor(data.activeId) ? data.activeId : null, stamps };
  } catch { return empty; }
}

export function acceptBayAdventure(progress: BayAdventureProgress, id: string): BayAdventureProgress {
  return adventureFor(id) && progress.activeId !== id ? { ...progress, activeId: id } : progress;
}

/** The caller supplies the physical nearby place, never the map selection or navigation destination. */
export function checkInBayAdventure(progress: BayAdventureProgress, nearKey: string | null, now = new Date()): BayAdventureProgress {
  const quest = adventureFor(progress.activeId), nextKey = adventureNextKey(progress);
  if (!quest || !nearKey || nearKey !== nextKey || !validJourneyPlace(nearKey) || !Number.isFinite(now.getTime())) return progress;
  return { ...progress, stamps: { ...progress.stamps, [quest.id]: [...(progress.stamps[quest.id] || []), now.toISOString()] } };
}
