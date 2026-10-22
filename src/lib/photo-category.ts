import overrideFile from '../data/photo-category-overrides.json';

/**
 * Photo categories (UI9-IMAGES, DECISIONS 22 tier ③ and 24): which pool of licensed stock photos a record falls back to
 * when it has no official image (①) and no approved venue photo (②). Inferred from fields every record already has —
 * an event's category / kind / title / venue / setting, an offer's brand and title, a new shop's own category text and
 * opening type, a guide's slug and category — so no record needs a new field. A record the rules put in the wrong pool
 * goes into the small override table src/data/photo-category-overrides.json (filled by the B lanes), keyed `kind:id`.
 *
 * Categories are shared across kinds where the picture is the same (a museum free day and a museum exhibition both show a
 * gallery; a transit discount, a transit guide and a route-change bulletin all show a bus or train). Pool sizes and the
 * stock search hints live in opus-qa/overhaul/lanes/UI9-IMAGES/CATEGORIES.json (the B1a contract).
 *
 * Build-time only: nothing on a page imports this module yet (A0 keeps every page's chosen image unchanged).
 */

export const PHOTO_CATEGORY_IDS = [
  // seasonal (a seasonal event never gets another season's picture, DECISIONS 24)
  'halloween', 'dia-de-muertos', 'diwali', 'thanksgiving', 'winter-holidays', 'ice-skating', 'lunar-new-year', 'pumpkin-harvest',
  // what an event is
  'storytime', 'kids-craft', 'kids-play', 'family-outdoor', 'nature-walk', 'night-sky', 'garden-zoo', 'farmers-market',
  'food-festival', 'wine-beer', 'concert', 'classical-music', 'stage-show', 'film', 'museum', 'art-craft-market', 'book-sale',
  'swap-meet', 'sports-basketball', 'sports-hockey', 'sports-football', 'sports-game', 'fun-run', 'taichi-fitness', 'dance',
  'talk-bookclub', 'class-workshop', 'tech-help', 'chinese-culture', 'community-festival', 'history-heritage', 'tech-meetup',
  'green-volunteer', 'pets', 'library', 'seniors',
  // shops and deals
  'dining', 'cafe-tea', 'bakery-dessert', 'shopping', 'birthday-perk', 'transit',
  // guides
  'guide-documents', 'guide-housing', 'guide-health', 'guide-newcomer', 'guide-school', 'guide-safety', 'city-sights',
] as const;

export type PhotoCategoryId = typeof PHOTO_CATEGORY_IDS[number];

export type PhotoCategory = {
  id: PhotoCategoryId;
  zh: string;
  zhHant: string;
  en: string;
  /** Month-day range the pictures are seasonal to (inclusive, may wrap the year), or null for all-year pools. */
  season: { from: string; through: string } | null;
};

const all = null;
const C = (id: PhotoCategoryId, zh: string, zhHant: string, en: string, season: PhotoCategory['season'] = all): PhotoCategory =>
  ({ id, zh, zhHant, en, season });

export const PHOTO_CATEGORIES: readonly PhotoCategory[] = [
  C('halloween', '万圣节', '萬聖節', 'Halloween', { from: '10-01', through: '11-01' }),
  C('dia-de-muertos', '亡灵节', '亡靈節', 'Día de los Muertos', { from: '10-01', through: '11-15' }),
  C('diwali', '排灯节', '排燈節', 'Diwali', { from: '10-10', through: '11-20' }),
  C('thanksgiving', '感恩节', '感恩節', 'Thanksgiving', { from: '11-01', through: '11-30' }),
  C('winter-holidays', '冬季灯会 · 圣诞', '冬季燈會 · 聖誕', 'Winter lights & holidays', { from: '11-01', through: '01-06' }),
  C('ice-skating', '溜冰', '溜冰', 'Ice skating', { from: '11-01', through: '02-28' }),
  C('lunar-new-year', '农历新年', '農曆新年', 'Lunar New Year', { from: '01-01', through: '03-15' }),
  C('pumpkin-harvest', '南瓜园 · 丰收节', '南瓜園 · 豐收節', 'Pumpkins & harvest', { from: '09-15', through: '11-15' }),
  C('storytime', '图书馆故事会', '圖書館故事會', 'Library storytime'),
  C('kids-craft', '儿童手作 · STEM', '兒童手作 · STEM', "Kids' crafts & STEM"),
  C('kids-play', '亲子游戏 · 桌游', '親子遊戲 · 桌遊', 'Family games & play'),
  C('family-outdoor', '亲子户外', '親子戶外', 'Family outdoors'),
  C('nature-walk', '自然步道 · 观鸟', '自然步道 · 觀鳥', 'Nature walks & birding'),
  C('night-sky', '观星', '觀星', 'Stargazing'),
  C('garden-zoo', '植物园 · 动物园', '植物園 · 動物園', 'Gardens & zoos'),
  C('farmers-market', '农夫市集', '農夫市集', "Farmers' market"),
  C('food-festival', '美食节 · 夜市', '美食節 · 夜市', 'Food festivals & night markets'),
  C('wine-beer', '品酒 · 啤酒（21+）', '品酒 · 啤酒（21+）', 'Wine & beer (21+)'),
  C('concert', '演唱会 · 现场音乐', '演唱會 · 現場音樂', 'Live music'),
  C('classical-music', '古典音乐会', '古典音樂會', 'Classical concert'),
  C('stage-show', '戏剧 · 舞蹈 · 喜剧', '戲劇 · 舞蹈 · 喜劇', 'Theatre, dance & comedy'),
  C('film', '电影放映', '電影放映', 'Film screening'),
  C('museum', '博物馆 · 展览', '博物館 · 展覽', 'Museums & exhibitions'),
  C('art-craft-market', '艺术节 · 手作市集', '藝術節 · 手作市集', 'Art walks & craft fairs'),
  C('book-sale', '旧书义卖', '舊書義賣', 'Library book sale'),
  C('swap-meet', '交换会', '交換會', 'Swap meet'),
  C('sports-basketball', '篮球赛', '籃球賽', 'Basketball game'),
  C('sports-hockey', '冰球赛', '冰球賽', 'Hockey game'),
  C('sports-football', '橄榄球赛', '橄欖球賽', 'Football game'),
  C('sports-game', '体育赛事', '體育賽事', 'Sports event'),
  C('fun-run', '社区跑', '社區跑', 'Fun run'),
  C('taichi-fitness', '太极 · 长辈健身', '太極 · 長輩健身', 'Tai chi & gentle fitness'),
  C('dance', '跳舞', '跳舞', 'Social dance'),
  C('talk-bookclub', '讲座 · 读书会', '講座 · 讀書會', 'Talks & book clubs'),
  C('class-workshop', '课程 · 工作坊', '課程 · 工作坊', 'Classes & workshops'),
  C('tech-help', '电脑手机帮助', '電腦手機幫助', 'Tech help'),
  C('chinese-culture', '华人文化 · 书法 · 茶', '華人文化 · 書法 · 茶', 'Chinese culture'),
  C('community-festival', '社区节庆 · 游行', '社區節慶 · 遊行', 'Community festivals & parades'),
  C('history-heritage', '历史导览', '歷史導覽', 'History & heritage'),
  C('tech-meetup', '科技 · AI 聚会', '科技 · AI 聚會', 'Tech & AI meetups'),
  C('green-volunteer', '环保 · 园艺 · 志愿', '環保 · 園藝 · 志願', 'Green living, gardening & volunteering'),
  C('pets', '宠物', '寵物', 'Pets'),
  C('library', '图书馆', '圖書館', 'Library'),
  C('seniors', '长辈活动 · 服务', '長輩活動 · 服務', 'Senior activities & services'),
  C('dining', '餐厅 · 美食', '餐廳 · 美食', 'Dining'),
  C('cafe-tea', '咖啡 · 茶饮', '咖啡 · 茶飲', 'Coffee & tea'),
  C('bakery-dessert', '烘焙 · 甜品', '烘焙 · 甜品', 'Bakery & dessert'),
  C('shopping', '购物 · 零售', '購物 · 零售', 'Shopping'),
  C('birthday-perk', '生日福利', '生日福利', 'Birthday perks'),
  C('transit', '交通出行', '交通出行', 'Getting around'),
  C('guide-documents', '证件 · 办事', '證件 · 辦事', 'Documents & paperwork'),
  C('guide-housing', '住房 · 租房', '住房 · 租房', 'Housing'),
  C('guide-health', '医疗 · 保险', '醫療 · 保險', 'Health care'),
  C('guide-newcomer', '新移民入门', '新移民入門', 'Newcomer basics'),
  C('guide-school', '学校 · 学区', '學校 · 學區', 'Schools'),
  C('guide-safety', '安全 · 防骗', '安全 · 防騙', 'Safety & scams'),
  C('city-sights', '城市观光', '城市觀光', 'City sights'),
];

export const PHOTO_CATEGORY_BY_ID: ReadonlyMap<PhotoCategoryId, PhotoCategory> = new Map(PHOTO_CATEGORIES.map(c => [c.id, c]));

export const isPhotoCategoryId = (value: unknown): value is PhotoCategoryId =>
  typeof value === 'string' && PHOTO_CATEGORY_BY_ID.has(value as PhotoCategoryId);

/** The record kinds that carry a card picture (cover.ts CoverKind, less 'place': /explore keeps its own photos). */
export type PhotoCategoryKind = 'event' | 'offer' | 'opening' | 'guide' | 'bulletin';

/** The fields the rules read; the index shapes (events-index-types.ts) satisfy these structurally. */
export type EventFields = {
  id: string; title: string; venue?: string; category?: string; kind?: string; audience?: readonly string[];
  planning?: { setting?: string };
};
export type OfferFields = { id: string; brand?: string; title: string; kind?: string };
export type OpeningFields = { id: string; name: string; category?: string; openingType?: string };
export type GuideFields = { slug: string; title?: string; category?: string };
export type BulletinFields = { id: string; title: string; label?: string };

type OverrideFile = { overrides: Record<string, string> };
const OVERRIDES: Readonly<Record<string, string>> = (overrideFile as OverrideFile).overrides;

/** The override table's key for a record. */
export const overrideKey = (kind: PhotoCategoryKind, id: string) => `${kind}:${id}`;

const override = (kind: PhotoCategoryKind, id: string): PhotoCategoryId | undefined => {
  const value = OVERRIDES[overrideKey(kind, id)];
  return isPhotoCategoryId(value) ? value : undefined;
};

type Rule = readonly [PhotoCategoryId, RegExp];
const firstMatch = (rules: readonly Rule[], text: string): PhotoCategoryId | undefined =>
  rules.find(([, re]) => re.test(text))?.[0];

// ---------- shared keyword sets ----------
const HALLOWEEN = /万圣|讨糖|trick|\btreats?\b|halloween|o-?ween|\bboos?\b|spooky|scare|monster|鬼屋|goblin|女巫|巫师|haunt|鬼故事|恐怖|creepatorium|吓人/i;
/** Checked before what an event is: a seasonal event never gets another season's picture, and a Turkey Trot is a run. */
const PRIORITY: readonly Rule[] = [
  ['fun-run', /社区跑|越野跑|turkey trot|\b5k\b|\brun\b|路跑|长跑/i],
  ['lunar-new-year', /春节|农历新年|财神|花市|春晚|羊年|lunar new year|新春/i],
  ['dia-de-muertos', /亡灵节|muertos|糖骷髅|altares|day of the dead/i],
  ['diwali', /排灯节|diwali|mela\b|指甲花/i],
  ['halloween', HALLOWEEN],
  ['thanksgiving', /感恩节|thanksgiving/i],
  ['ice-skating', /溜冰|冰场/],
  ['winter-holidays', /圣诞|christmas|节日灯|灯光|灯饰|灯会|lights|lightscape|glow|winterfest|winterland|姜饼|宽扎|光明节|parol|星灯|节日季|节日游行|点灯|dickens|冬日派对|冬日魔术|节日手作|冬季花环|节日包装|节日绿植|holiday|revels|冬至/i],
  ['night-sky', /观星|星空|starlight|observatory|天文/i],
  ['wine-beer', /品酒|葡萄酒|啤酒|wine walk|oktoberfest|crush|21\+|21岁以上|cider|鸡尾酒|brew|酒庄|面具晚宴/i],
  ['pumpkin-harvest', /南瓜|pumpkin|丰收|harvest|玉米迷宫|收获|hay day|稻草人|烤栗子|old mill/i],
];

const KIDSISH = /儿童|亲子|孩子|幼儿|少年|小小|宝宝|\d+\s*岁|kids|家庭|全家|family|学龄/i;
const LIBRARY_VENUE = /图书馆|分馆|总馆|library/i;
const PARK_VENUE = /公园|park|plaza|grove|lawn|草坪|meadow|campus/i;

const EARLY: readonly Rule[] = [
  ['tech-meetup', /黑客松|hackathon|开发者|tech week|开源|ai 基础设施|开放权重|\bai\b.*(聚会|晚餐|辩论)/i],
  ['farmers-market', /农夫市集|农贸市场|农夫市场|farmers market|community market|周日市集|丰收市集/i],
];

/** What a craft keyword must not override: a farmers' market that adds a craft fair is still a market, a talk on quilters a talk. */
const PRE_CRAFT: readonly Rule[] = [
  ['museum', /exploratorium after dark/i],
  ['shopping', /试驾|品牌展售|volvo/i],
  ['art-craft-market', /手作市集|手作展|crafts? (show|fair)|renegade|艺术开放日/i],
  ['chinese-culture', /书法|茶文化|麻将/],
  ['community-festival', /powwow|原住民日/i],
  ['talk-bookclub', /讲座|论坛/],
];

const EVENT_RULES: readonly Rule[] = [
  ['pets', /宠物|狗狗|pooch|\bpets?\b|barks|陪读犬/i],
  ['storytime', /故事会|故事时间|故事時間|讲故事|story ?time|story ?walk|故事音乐会|故事夜|musictime|儿童读书会|民间故事/i],
  ['sports-basketball', /勇士|warriors 主场|篮球|\bnba\b/i],
  ['sports-hockey', /sharks|冰球|\bnhl\b/i],
  ['sports-football', /49ers|橄榄球|stanford 主场|sjsu|观赛/i],
  ['tech-help', /科技答疑|科技协助|数字帮助|数字生活|手机课|电脑|维修咨询|ai 工具/i],
  ...EARLY,
  ...PRE_CRAFT,
  ['book-sale', /旧书|书店半价/],
  ['swap-meet', /交换|swap/i],
  ['taichi-fitness', /太极|气功|大雁功|瑜伽|yoga|健身|晨练/i],
  ['seniors', /长者|长辈|老年|senior/i],
  ['film', /电影|影展|film|放映|cinema|短片/i],
  ['talk-bookclub', /讲座|读书会|对谈|签书|签名|作家|书展|分享会|论坛|说明会|交流会|咖啡谈|下午会|讲法|知识问答|问答夜|信息日|文学|写作|writing|talk|lecture/i],
  ['chinese-culture', /华人|华埠|中华|寻根|佛七|禅七|法藏寺/],
  ['classical-music', /交响|室内乐|管乐|木管|五重奏|symphony|合唱|choir|久石让|配乐|吉他|recital/i],
  ['stage-show', /音乐剧|芭蕾|ballet|胡桃夹子|歌剧|opera|首演|喜剧|脱口秀|comedy|improv|即兴|魔术|木偶剧|提线木偶|马戏|circus|on ice|舞台秀|百老汇|神韵|disney/i],
  ['garden-zoo', /植物园|动物园|\bzoo\b|温室|little farm|农场动物/i],
  ['museum', /博物馆|美术馆|艺术馆|展览|展厅|设计展|艺术展|挂毯展|光影展|museum|exploratorium|curiodyssey|gallery|画廊|omca|numu|the mac\b|航空馆|hiller/i],
  ['art-craft-market', /艺术节|艺术漫步|artwalk|art walk|art trails|art & wine|艺术街区|艺术晚宴|艺术夜|开放工作室|复古|vintage|flea|跳蚤|旧物|快闪市集|车展|fall show/i],
  ['dance', /舞蹈|跳舞|舞会|dance|宝莱坞|摇摆/i],
  ['concert', /演唱会|巡演|\btour\b|音乐节|民谣|摇滚|致敬|现场音乐|音乐夜|音乐会|music hall|乐队|乐团|beats|rocks|音乐日|音乐与故事|演出/i],
  ['green-volunteer', /志愿服务|清洁|回收|堆肥|电子垃圾|碎纸|气候|节水|种植|绿桶|recycl|cleanup|植物交换/i],
  ['nature-walk', /徒步|步道|观鸟|湿地|红杉|登高|登山|山径|自然|植物导览|蕨类|野火鸡|浆果|古树|林地|动物科普|redwood|hike|trail|钓鱼|营火/i],
  ['history-heritage', /历史|导览|古迹|档案|history|historic|故居|heritage|揭幕|victory|铸字|锻造|fort point/i],
  ['food-festival', /饺子|chowder|餐车|夜市|night market|煎饼|烹饪|烘焙|美食|食物|street eats|taco|晚宴|晚餐|品尝|零食|午间聚会/i],
  ['class-workshop', /课|工作坊|workshop|咨询|辅导|示范|入门|学唱|印刷|规划|英语|会话|esl|cpr|shakealert|地震/i],
  ['community-festival', /节|庆典|游行|嘉年华|街区|festival|fair|days\b|sunday streets|开放日|百年|周年|社区聚会|社区日|原住民|fleet week|退伍军人|游园|jamboree|游乐|集市|市集/i],
];

const BEFORE_CRAFT_RULES: readonly Rule[] = [...EARLY, ...PRE_CRAFT];
const ADULT = /成人|成年|adult|21\+|after dark/i;

const KIDS_CRAFT = /手工|手作|创作|创客|stem|steam|乐高|lego|美术课|美术工作坊|缝纫|版画|彩绘|画法|儿童画|木偶电影|科学节|科学日|动手|实验|3d 打印|机器人|art for all|paint|木工|diy|hands on the arts|工作坊|做.{0,8}(灯|帽|偶|饰|纸)/i;
const KIDS_PLAY = /桌游|象棋|棋|玩耍|游戏|乐园|派对|音乐|唱跳|comic con|泡泡|开放日|魔术|律动/i;

/**
 * An event's photo category: seasonal first (a Halloween storytime shows Halloween), then what the event is, then where it
 * is (a library, a park), then its catalog category. A culture event no rule reads stays uncategorised — the coverage test
 * fails until the override table names it.
 */
export function eventPhotoCategory(event: EventFields): PhotoCategoryId | undefined {
  const fixed = override('event', event.id);
  if (fixed) return fixed;
  const title = event.title;
  const venue = event.venue ?? '';
  const text = `${title} @ ${venue}`;
  const kidsish = !ADULT.test(title) && (event.category === 'family' || KIDSISH.test(title) || (event.audience ?? []).some(a => KIDSISH.test(a)));
  // A band name is not a season (The Smashing Pumpkins); no regex look-behind (Safari < 16.4, opus-bay-w9-e-lookbehind).
  const first = firstMatch(PRIORITY, title.replace(/smashing pumpkins/gi, ''));
  // A family event is never a 21+ picture (a cider fair with a kids' circus): it goes on to what the event is.
  if (first && !(first === 'wine-beer' && kidsish)) return first;
  if (event.kind === 'sports') {
    const sport = firstMatch(EVENT_RULES.filter(([id]) => id.startsWith('sports-')), text);
    if (sport) return sport;
    if (/stadium/i.test(venue)) return 'sports-football';
    return 'sports-game';
  }
  const early = firstMatch(BEFORE_CRAFT_RULES, title);
  if (early) return early;
  if (KIDS_CRAFT.test(title)) {
    if (/故事/.test(title) && LIBRARY_VENUE.test(venue)) return 'storytime';
    return kidsish ? 'kids-craft' : 'class-workshop';
  }
  if (/故事/.test(title) && LIBRARY_VENUE.test(venue)) return 'storytime';
  const byTitle = firstMatch(EVENT_RULES, title);
  if (byTitle === 'nature-walk' && kidsish) return 'family-outdoor';
  if (byTitle === 'concert' && kidsish && LIBRARY_VENUE.test(venue)) return 'kids-play';
  if (byTitle === 'community-festival' && kidsish && !/游行|parade/i.test(title)) return PARK_VENUE.test(venue) ? 'family-outdoor' : 'community-festival';
  if (byTitle) return byTitle;
  if (kidsish && KIDS_PLAY.test(title)) return 'kids-play';
  if (event.kind === 'performance') return 'concert';
  if (event.kind === 'meetup') return LIBRARY_VENUE.test(venue) ? 'talk-bookclub' : 'tech-meetup';
  const byVenue = firstMatch(EVENT_RULES, venue);
  if (byVenue === 'museum' || byVenue === 'garden-zoo' || byVenue === 'seniors') return byVenue;
  if (LIBRARY_VENUE.test(venue)) return kidsish ? 'kids-play' : 'library';
  const setting = event.planning?.setting;
  if (event.category === 'outdoors') return kidsish ? 'family-outdoor' : 'nature-walk';
  if (event.category === 'food') return 'food-festival';
  if (event.category === 'family') return setting === 'outdoor' || PARK_VENUE.test(venue) ? 'family-outdoor' : 'kids-play';
  // UI9-IMG-A1b: every event has a ③ category (DECISIONS 21: no information card, past listings' detail pages included):
  // the rest by what they are — music or a night out, else a community gathering.
  if (/音乐|音樂|music|party|派对|派對|夜生活|nightlife|dj\b/i.test(`${text} ${(event.audience ?? []).join(' ')}`)) return 'concert';
  if (event.category === 'seniors') return 'seniors';
  return 'community-festival';
}

const OFFER_RULES: readonly Rule[] = [
  ['transit', /sfmta|muni|caltrain|clipper|\bsmart\b|marin transit|\bbart\b|公交|乘车|单程|ac transit|\bvta\b/i],
  ['birthday-perk', /生日|birthday/i],
  ['halloween', HALLOWEEN],
  ['fun-run', /社区跑|\brun\b/i],
  ['night-sky', /观星|星空|chabot/i],
  ['library', /library|图书馆|图书证|sfpl|kanopy|linkedin learning/i],
  ['class-workshop', /the lab\b|the shop\b|创作空间|手作空间/i],
  ['kids-craft', /lakeshore|michaels|lowe.s kids|home depot|\blego\b|today at apple|儿童工作坊|手作|拼搭|little builder|木工|kids club|课后活动|做.{0,8}(小屋|火车|电车|挂饰|卡车|飞机|相框|城堡)/i],
  ['garden-zoo', /botanica|植物园|garden|温室|conservatory|茶园|\bzoo\b|动物园|happy hollow|little farm|marine mammal|海洋哺乳/i],
  ['museum', /museum|museo|博物馆|美术馆|art center|sfmoma|omca|bampfa|ybca|moad|cantor|anderson|exploratorium|curiodyssey|lawrence|tech interactive|intel|computer history|triton|randall|展厅|画廊|field station|自然探索站/i],
  ['history-heritage', /winchester|rosie|city guides|导览/i],
  ['nature-walk', /\bparks?\b|公园|muir woods|green friday|入园|入口费/i],
  ['film', /\bamc\b|cinema|电影|影院|rialto/i],
  ['stage-show', /opera|歌剧|performances|演出票/i],
  ['pets', /petco|petsmart|宠物|带狗/i],
  ['green-volunteer', /堆肥|回收|种子|compost/i],
  ['wine-beer', /happy hour|葡萄酒|开瓶费|问答夜|第二杯|\bbar\b/i],
  ['dining', /主餐|鸡肉餐|鸡块/],
  ['cafe-tea', /starbucks|peet|dunkin|dutch bros|咖啡|茶|coffee|chicha|奶茶|饮品|jamba|冰沙/i],
  ['bakery-dessert', /cinnabon|krispy|cold stone|crumbl|yogurtland|paris baguette|85°c|bundt|ben & jerry|甜甜圈|冰淇淋|蛋糕|甜点|pretzel|椒盐卷饼|冰酸奶|frosty|bonbites|bagel|贝果|肉桂卷/i],
  ['dining', /餐|堡|burger|pizza|披萨|三明治|sandwich|ihop|煎饼|chipotle|taco|mcdonald|麦乐鸡|wendy|chili|benihana|\bbj|red robin|el pollo|panera|habit|shake shack|smashburger|\bmod\b|jersey mike|ike.s|chick-fil-a|restaurant|grill|osteria|pacific catch|eureka|stella|鸡/i],
  ['shopping', /ikea|target|world market|sephora|ulta|safeway|lowe|staples|registry|eos|购物|折|volvo|赠品|会员/i],
];

/** UI9-IMG-A1b: the offers OFFER_RULES leave out still get a picture of what they are (DECISIONS 21), never none. */
const OFFER_FALLBACK_RULES: readonly Rule[] = [
  ['dining', /便当|bento|餐|饭|寿司|拉面|onigil/i],
  ['swap-meet', /换装|換裝|交换|交換|swap|exchange/i],
  ['green-volunteer', /粉碎|shred|回收|recycl/i],
];
/** An offer's photo category: transit and birthday perks by what they are, then by brand and title. */
export function offerPhotoCategory(offer: OfferFields): PhotoCategoryId | undefined {
  const text = `${offer.brand ?? ''} | ${offer.title}`;
  return override('offer', offer.id) ?? firstMatch(OFFER_RULES, text) ?? firstMatch(OFFER_FALLBACK_RULES, text)
    ?? (offer.kind === 'purchase' ? 'shopping' : 'community-festival');
}

const OPENING_RULES: readonly Rule[] = [
  ['wine-beer', /啤酒与葡萄酒|葡萄酒|酒吧|wine bar/i],
  ['cafe-tea', /咖啡|茶|coffee|\btea\b|果汁|巴西莓/i],
  ['bakery-dessert', /面包|烘焙|甜品|甜点|贝果|bagel|蛋糕|布丁|华夫|冰沙|冰淇淋|bakery|donut|dessert/i],
  ['shopping', /鞋|女装|服|珠宝|首饰|家居|床垫|礼品|皮包|内衣|零售|钻石|艺术|store|shop\b/i],
  ['dining', /菜|料理|拉面|寿司|手卷|披萨|意面|三明治|汉堡|热狗|鸡|烤|啤酒馆|小馆|酒廊|餐|饭|面|串|kitchen|restaurant/i],
];

/** A new shop's photo category, from its own category text, then its opening type. */
export function openingPhotoCategory(opening: OpeningFields): PhotoCategoryId | undefined {
  const fixed = override('opening', opening.id);
  if (fixed) return fixed;
  const byText = firstMatch(OPENING_RULES, `${opening.category ?? ''} ${opening.name}`);
  if (byText) return byText;
  if (opening.openingType === 'new-restaurant') return 'dining';
  if (opening.openingType === 'new-store') return 'shopping';
  return undefined;
}

const GUIDE_RULES: readonly Rule[] = [
  ['guide-school', /school|k12|enrollment/],
  ['guide-safety', /scam|safety|alerts-outages/],
  ['seniors', /senior|elder|retirement|social-security/],
  ['guide-health', /medicare|medi-cal|doctor|dental|insurance|health/],
  ['green-volunteer', /cleanup|ewaste|bulky|recycl/],
  ['birthday-perk', /birthday/],
  ['farmers-market', /farmers-market|markets?(-|$)/],
  ['dining', /new-openings/],
  ['shopping', /freebies|free-perks|deals|outlets|malls|shopping/],
  ['library', /library/],
  ['guide-documents', /naturalization|driver-license|id-preparation|tax|vita|calfile|311|211|translation|holiday-hours|digital-help|language-resource|posting-guide|household-bills/],
  ['guide-housing', /rental|lease|move-in|moving|tenant|roommate|utilities|furniture|cleaning|repair|where-to-live|borrow-tools|used-trading/],
  ['tech-meetup', /ai-week|tech-week/],
  ['pumpkin-harvest', /pumpkin|farm-guide|harvest/],
  ['pets', /dog-park/],
  ['museum', /museum|(^|-)art(-|$)|fine-arts|omca|cantor|hiller|computer-history|hornet|rosie|free-culture/],
  ['history-heritage', /history|alcatraz|fort-point|mission-dolores|china-camp|chinatown/],
  ['garden-zoo', /garden|botanical|filoli|hakone|zoo/],
  ['nature-walk', /redwood|coast|wetlands|walk|trail|baylands|birdwatching|point-reyes|muir-woods|lands-end|coyote|angel-island|tilden|shoreline|nature|dunes|picnic|bothe|alviso|half-moon-bay/],
  ['transit', /commute|transit|clipper|(^|-)muni(-|$)|(^|-)bart(-|$)|airport|parking|fastrak|car-free|without-car|luggage/],
  ['guide-newcomer', /newcomer|first-month|first-7-30|apps|phone-bank|esl|resident-dates|first-rental/],
];

const GUIDE_CATEGORY_FALLBACK: Readonly<Record<string, PhotoCategoryId>> = {
  rent: 'guide-housing', roommate: 'guide-housing', used: 'guide-housing', commute: 'transit', newcomer: 'guide-newcomer',
  education: 'guide-school', safety: 'guide-safety', service: 'guide-documents', city: 'city-sights', events: 'community-festival',
};

/** A guide's photo category, from its slug, then its guide category. */
export function guidePhotoCategory(guide: GuideFields): PhotoCategoryId | undefined {
  return override('guide', guide.slug) ?? firstMatch(GUIDE_RULES, guide.slug)
    ?? (guide.category ? GUIDE_CATEGORY_FALLBACK[guide.category] : undefined);
}

const BULLETIN_RULES: readonly Rule[] = [
  ['transit', /缆车|返程|行李|推车|匝道|路线|muni|bart|公交|caltrain|交通|道路|高速|i-\d|改道|车站|巴士|轮渡|渡轮|clipper|停车|封路|vta|ac transit|samtrans|线/i],
  ['library', /图书馆|library|图书证|mechanics/i],
  ['museum', /sfmoma|博物馆|美术馆|museum/i],
  ['guide-safety', /停电|预警|安全|诈骗|空气|火/],
];

/**
 * UI9-IMG-A1b: a planner place's photo category, for a place with no picture of its own and no 3D postcard (its row then
 * shows a ③ 示意图 of the kind of place, never an information card): a library or museum by its name, else a restaurant,
 * café or shop by its planner category. A landmark gets none (city-sights shows real landmarks: never on a specific venue).
 */
export function placePhotoCategory(place: { id: string; title?: string; category?: string }): PhotoCategoryId | undefined {
  const text = `${place.id} ${place.title ?? ''}`.toLowerCase();
  if (/library|图书馆|圖書館/.test(text)) return 'library';
  if (/museum|moma|sjma|omca|exploratorium|博物馆|博物館|美术馆|美術館/.test(text)) return 'museum';
  if (place.category === 'restaurant') return 'dining';
  if (place.category === 'cafe') return 'cafe-tea';
  if (place.category === 'shop' || /ferry-building/.test(text)) return 'shopping';
  return undefined;
}

/** The neighbourhood board's categories (community-copy.ts CATEGORY_NAMES) by the kind of picture that fits them. */
const POST_CATEGORIES: Readonly<Record<string, PhotoCategoryId>> = {
  租屋: 'guide-housing', 搬家: 'guide-housing', 维修: 'guide-housing', 清洁: 'guide-housing', 闲置: 'swap-meet', 接送: 'transit', 翻译: 'guide-documents',
};

/**
 * A neighbourhood post's photo category (UI9-IMG-A1b, captain 10-22 02:50): a saved post carries no photo of its own, so
 * its 我的收藏 row shows a ③ 示意图 of its kind (a home for 租屋, a ride for 接送), else the newcomer basics, never an empty frame.
 */
export const postPhotoCategory = (category?: string): PhotoCategoryId => POST_CATEGORIES[category ?? ''] ?? 'guide-newcomer';

/** A regional bulletin's photo category (most are route changes or library services). */
export function bulletinPhotoCategory(bulletin: BulletinFields): PhotoCategoryId | undefined {
  return override('bulletin', bulletin.id) ?? firstMatch(BULLETIN_RULES, `${bulletin.label ?? ''} ${bulletin.title}`);
}

/** Any record's photo category, by kind ('place' has none: /explore keeps its own photos and postcards). */
export function photoCategoryOf(kind: string, record: Record<string, unknown>): PhotoCategoryId | undefined {
  const r = record as never;
  if (kind === 'event') return eventPhotoCategory(r);
  if (kind === 'offer') return offerPhotoCategory(r);
  if (kind === 'opening') return openingPhotoCategory(r);
  // A guide's id is its slug: the candidate records, report:covers and the home rail pass `id`, the guide index `slug`.
  if (kind === 'guide') return guidePhotoCategory({ ...record, slug: String(record.slug ?? record.id) } as never);
  if (kind === 'bulletin') return bulletinPhotoCategory(r);
  return undefined;
}
