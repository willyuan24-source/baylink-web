import { bayApproach, type BayPoint } from './unified-bay-world';

export type DiscoveryText = { zh: string; en: string };
export type BayDiscoveryOption = { id: string; label: DiscoveryText; reply: DiscoveryText; memory: DiscoveryText };
export type BayDiscovery = {
  id: string; placeKey: string; position: BayPoint; radius: number;
  kind: 'observe' | 'conversation' | 'lights'; symbol: string; color: string;
  title: DiscoveryText; teaser: DiscoveryText; voice: DiscoveryText;
  options: readonly BayDiscoveryOption[]; sequence?: readonly string[];
};
const text = (zh: string, en: string): DiscoveryText => ({ zh, en });
const option = (id: string, zh: string, en: string, replyZh: string, replyEn: string, memoryZh: string, memoryEn: string): BayDiscoveryOption => ({ id, label: text(zh, en), reply: text(replyZh, replyEn), memory: text(memoryZh, memoryEn) });
const at = (value: Omit<BayDiscovery, 'position' | 'radius'>): BayDiscovery => ({ ...value, position: bayApproach(value.placeKey), radius: 2.2 });

/** Original miniature-world stories. Characters are fictional, not venue staff or real programs. */
export const BAY_DISCOVERIES: readonly BayDiscovery[] = [
  at({ id: 'pier-sea-lions', placeKey: 'sf:pier', kind: 'observe', symbol: '≈', color: '#518c91', title: text('码头上的午睡派对', 'The dockside nap club'), teaser: text('三只小海狮挤在一块浮台上。BAYBAY 安静坐下来，准备画一张观察卡。', 'Three little sea lions share a floating dock. BAYBAY sits quietly and sketches an observation card.'), voice: text('海风观察站', 'THE BREEZE WATCH'), options: [
    option('sleep', '看看正在午睡的那只', 'Watch the sleepy one', '它翻了个身，把鳍当成小枕头。BAYBAY 在画上留下一朵小小的呼噜云。', 'A flipper becomes a pillow. BAYBAY draws a tiny snoring cloud above the little sea lion.', '收下一张「午睡云」观察卡。', 'A “nap cloud” observation card, tucked away.'),
    option('wave', '看看伸着鳍的那只', 'Watch the flipper stretch', '小海狮伸了个懒腰，看起来像在和海湾打招呼。我们远远挥挥手。', 'A long stretch looks like a hello to the Bay. We wave back from a distance.', '收下一张「海湾招呼」观察卡。', 'A “hello, Bay” observation card, tucked away.'),
  ] }),
  at({ id: 'ocean-sand', placeKey: 'sf:ocean-beach', kind: 'observe', symbol: '◒', color: '#aa875d', title: text('沙上的小小宇宙', 'A little universe in the sand'), teaser: text('退去的想象潮水留下一些纹路。用眼睛寻找，把沙滩留在原处。', 'An imaginary wave leaves patterns behind. Look closely and leave the beach as you found it.'), voice: text('BAYBAY 的海岸笔记', 'BAYBAY’S COAST NOTES'), options: [
    option('spiral', '画下螺旋纹路', 'Sketch a spiral', '从小小一点开始，一圈又一圈。BAYBAY 的笔尖像在跳一支慢舞。', 'A tiny dot curls into a spiral. BAYBAY’s pencil takes a slow little dance.', '收藏一枚画出来的贝壳，不带走真的贝壳。', 'A drawn shell to keep; real shells stay on the beach.'),
    option('ripples', '描下海浪的线条', 'Trace the ripples', '一排弯弯的线，好像海给沙滩写了一封信。', 'Curving lines look like a letter the sea has written to the sand.', '收藏一页「海写的信」。', 'A page called “a letter from the sea”.'),
  ] }),
  at({ id: 'tea-gardener', placeKey: 'sf:japanese-tea-garden', kind: 'conversation', symbol: '❋', color: '#79925e', title: text('园丁的小问题', 'The gardener’s little question'), teaser: text('游戏里的园丁小叶放下扫帚：「今天想把哪一种心情带进花园？」', 'Little Leaf, our fictional gardener, puts down a broom. “What feeling shall we bring into the garden today?”'), voice: text('小叶 · 虚构花园邻居', 'LITTLE LEAF · A FICTIONAL NEIGHBOR'), options: [
    option('curiosity', '一点好奇心', 'A little curiosity', '小叶笑了：「那就看看脚边吧。很小的东西，也值得停下来。」BAYBAY 发现一片心形的想象叶子。', '“Then look near your feet,” says Little Leaf. “Small things deserve a pause.” BAYBAY notices an imaginary heart-shaped leaf.', '一枚好奇心叶签。', 'A leaf-shaped curiosity bookmark.'),
    option('quiet', '一点安静', 'A little quiet', '「那我们先不说话。」微风经过。过了一会儿，小叶递来一张空白卡片，留给今天的心情。', '“Then let us pause.” A breeze passes. Little Leaf offers a blank card for whatever today brings.', '一张装着微风的空白卡。', 'A blank card with room for a breeze.'),
  ] }),
  at({ id: 'stanford-shadows', placeKey: 'peninsula:stanford', kind: 'observe', symbol: '◐', color: '#a97559', title: text('拱廊的影子画', 'An arcade of shadows'), teaser: text('阳光把拱廊投在庭院里。BAYBAY 想从这些影子里拼出一张小画。', 'Sunlight draws arches across the courtyard. BAYBAY looks for a little picture in their shadows.'), voice: text('庭院速写角', 'THE COURTYARD SKETCHBOOK'), options: [
    option('bridge', '拼一座小桥', 'Make a little bridge', '两道弧线，一条想象的小河。BAYBAY 把校园的影子变成连接朋友的桥。', 'Two curves and an imaginary river: the courtyard shadows become a bridge between friends.', '一张「影子小桥」速写。', 'A “shadow bridge” sketch.'),
    option('door', '拼一扇新门', 'Make a new doorway', '门后是什么呢？BAYBAY 留下一个问号，等下一次旅行来回答。', 'What is through the doorway? BAYBAY leaves a question mark for the next adventure.', '一张「下一扇门」速写。', 'A “next doorway” sketch.'),
  ] }),
  at({ id: 'filoli-gardener', placeKey: 'peninsula:filoli', kind: 'conversation', symbol: '✿', color: '#a3819b', title: text('花园寄来的颜色', 'A color from the garden'), teaser: text('虚构邻居阿芽正在调一盒水彩：「送你一种今天的颜色。你想带走哪一种？」', 'Our fictional neighbor Sprout mixes watercolors. “Take a color from today. Which one would you like?”'), voice: text('阿芽 · 虚构花园邻居', 'SPROUT · A FICTIONAL NEIGHBOR'), options: [
    option('green', '雨后的叶子绿', 'Leaf green after rain', '「这是重新出发的颜色。」阿芽在卡片上点了一滴绿，把真实的花叶都留在原处。', '“The color of a fresh start.” Sprout paints a green dot, leaving every real leaf and flower in place.', '一张「重新出发」水彩卡。', 'A “fresh start” watercolor card.'),
    option('gold', '傍晚的暖金色', 'Warm evening gold', '「这是慢慢走的颜色。」阿芽画了一条金色小路，通往下一段悠闲时光。', '“The color of taking your time.” Sprout paints a golden path toward another gentle afternoon.', '一张「慢慢走」水彩卡。', 'A “take your time” watercolor card.'),
  ] }),
  at({ id: 'google-ideas', placeKey: 'south-bay:google-visitor', kind: 'conversation', symbol: '✦', color: '#728eb2', title: text('口袋里的新点子', 'A pocketful of ideas'), teaser: text('纸飞机机器人 PIP 正在收集小点子：「如果今天可以发明一样东西，你想让生活哪里方便一点？」', 'PIP, an imaginary paper-plane robot, collects little ideas. “What would you invent to make an ordinary day easier?”'), voice: text('PIP · 虚构纸飞机机器人', 'PIP · A FICTIONAL PAPER-PLANE ROBOT'), options: [
    option('weekend', '一张会帮忙的周末地图', 'A helpful weekend map', 'PIP 把点子折成一架纸飞机：「把有趣的地方连起来，再留点迷路的空间。」', 'PIP folds the idea into a plane. “Join the interesting places, and leave a little room to wander.”', '一架「周末灵感」纸飞机。', 'A “weekend idea” paper plane.'),
    option('neighbors', '一个打招呼的小按钮', 'A tiny button for saying hello', '「按下去，就有勇气说第一句你好。」PIP 在按钮旁画了两张笑脸。', '“Press it for the courage to say the first hello.” PIP draws two smiles beside the button.', '一枚「邻里你好」想象按钮。', 'An imaginary “hello, neighbor” button.'),
  ] }),
  at({ id: 'tech-light-sequence', placeKey: 'south-bay:tech', kind: 'lights', symbol: '✧', color: '#a78047', title: text('点亮湾区的小灯塔', 'Light the little Bay beacon'), teaser: text('一台想象中的光线机器在等你启动。按提示依次点亮三盏灯，让它向海湾送出一个问候。', 'An imaginary light machine awaits a spark. Follow the three-light sequence to send a little hello across the Bay.'), voice: text('BAYBAY 的灵感实验台', 'BAYBAY’S IDEA BENCH'), sequence: ['wave', 'leaf', 'sun'], options: [
    option('wave', '海浪', 'Wave', '海浪把光带到湾边。', 'A wave carries the light to shore.', '一枚亲手点亮的湾区灯塔徽记。', 'A little Bay beacon emblem, lit by you.'),
    option('leaf', '叶子', 'Leaf', '叶子把光送进花园。', 'A leaf carries the light into the garden.', '一枚亲手点亮的湾区灯塔徽记。', 'A little Bay beacon emblem, lit by you.'),
    option('sun', '太阳', 'Sun', '太阳让新的点子发亮。', 'The sun gives a new idea its glow.', '一枚亲手点亮的湾区灯塔徽记。', 'A little Bay beacon emblem, lit by you.'),
  ] }),
  at({ id: 'berkeley-bells', placeKey: 'east-bay:berkeley', kind: 'observe', symbol: '♧', color: '#948a5a', title: text('钟楼下的一分钟', 'A minute beneath the tower'), teaser: text('BAYBAY 在钟楼下停住脚步。在这个小世界里，一分钟也能装下一段旅行。', 'BAYBAY pauses beneath the tower. In this little world, a minute can hold a whole tiny journey.'), voice: text('校园慢行笔记', 'CAMPUS WANDER NOTES'), options: [
    option('cloud', '看看经过的云', 'Watch a passing cloud', '那朵云有点像 BAYBAY，又有点像一块饼干。今天不急着决定答案。', 'The cloud looks a little like BAYBAY and a little like a cookie. There is no hurry to decide.', '一张「云像什么」观察卡。', 'A “what does the cloud look like?” card.'),
    option('postcard', '给下一位旅人留句话', 'Leave a hello for a traveler', 'BAYBAY 在虚构的留言卡上写：「愿你今天，找到一个喜欢停留的地方。」', 'BAYBAY writes on an imaginary note: “May you find somewhere you love to pause today.”', '一张「愿你停留」留言卡。', 'A “somewhere to pause” note.'),
  ] }),
  at({ id: 'redwood-look-up', placeKey: 'east-bay:redwood', kind: 'observe', symbol: '♠', color: '#547e68', title: text('抬头，森林在这里', 'Look up: the forest is here'), teaser: text('小路变得安静。BAYBAY 把脚步放轻，在想象的森林里找一份不带走任何东西的纪念。', 'The trail grows quiet. BAYBAY slows down to find a forest keepsake without taking anything away.'), voice: text('红杉林观察站', 'THE REDWOOD WATCH'), options: [
    option('canopy', '描一片树冠的形状', 'Trace the shape of a canopy', '高高低低的绿，拼成一把巨大的伞。BAYBAY 在页角画上一个小小的自己。', 'Layers of green form a giant umbrella. BAYBAY draws a tiny self in the corner of the page.', '一张「森林大伞」速写。', 'A “forest umbrella” sketch.'),
    option('light', '数一数光斑', 'Follow the patches of light', '一块、两块、三块……光斑像森林留在路上的小路标。', 'One, two, three… patches of light become the forest’s little trail markers.', '一张「光斑小路」观察卡。', 'A “path of light” observation card.'),
  ] }),
];

export type BayDiscoveryContext = { position: readonly [number, number]; mode: 'walk' | 'drive' | 'overview'; arrived: boolean; proof?: readonly string[] };
export type BayDiscoveryProgress = { version: 1; memories: Record<string, { choiceId: string; collectedAt: string }> };
export const emptyBayDiscoveries = (): BayDiscoveryProgress => ({ version: 1, memories: {} });
export const bayDiscoveriesKey = (owner?: string) => `baylink.bay-discoveries.v1:${owner ? `user:${encodeURIComponent(owner)}` : 'guest'}`;
export const discoveryFor = (id: string) => BAY_DISCOVERIES.find(item => item.id === id);
export function canCollectDiscovery(item: BayDiscovery, context: BayDiscoveryContext): boolean {
  return context.arrived === true && (context.mode === 'walk' || context.mode === 'drive') && context.position.length === 2 && context.position.every(Number.isFinite) && Math.hypot(context.position[0] - item.position[0], context.position[1] - item.position[1]) <= item.radius;
}
export function discoverySequenceMatches(item: BayDiscovery, proof: readonly string[] | undefined): boolean {
  return !!item.sequence && !!proof && proof.length === item.sequence.length && item.sequence.every((value, index) => value === proof[index]);
}
export function collectBayDiscovery(progress: BayDiscoveryProgress, id: string, choiceId: string, context: BayDiscoveryContext, now = new Date()): BayDiscoveryProgress {
  const item = discoveryFor(id);
  if (!item || progress.memories[id] || !canCollectDiscovery(item, context) || !Number.isFinite(now.getTime()) || !item.options.some(choice => choice.id === choiceId)) return progress;
  if (item.kind === 'lights' && (choiceId !== item.sequence?.at(-1) || !discoverySequenceMatches(item, context.proof))) return progress;
  return { version: 1, memories: { ...progress.memories, [id]: { choiceId, collectedAt: now.toISOString() } } };
}
export function parseBayDiscoveries(raw: string | null): BayDiscoveryProgress {
  const empty = emptyBayDiscoveries();
  if (!raw || raw.length > 12_000) return empty;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.memories || typeof data.memories !== 'object' || Array.isArray(data.memories)) return empty;
    for (const item of BAY_DISCOVERIES) {
      const saved = data.memories[item.id];
      if (!saved || typeof saved.choiceId !== 'string' || !item.options.some(choice => choice.id === saved.choiceId) || typeof saved.collectedAt !== 'string' || saved.collectedAt.length > 40 || !Number.isFinite(Date.parse(saved.collectedAt))) continue;
      if (item.kind === 'lights' && saved.choiceId !== item.sequence?.at(-1)) continue;
      empty.memories[item.id] = { choiceId: saved.choiceId, collectedAt: new Date(saved.collectedAt).toISOString() };
    }
    return empty;
  } catch { return empty; }
}
