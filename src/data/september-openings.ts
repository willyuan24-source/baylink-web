import type { MonthlyRegion } from './monthly-types';

export type SeptemberOpening = {
  id: string;
  name: string;
  city: string;
  region: MonthlyRegion;
  category: string;
  status: 'open' | 'announced';
  openingType: 'new-restaurant' | 'relocation' | 'reopening' | 'extended-pop-up' | 'opening-celebration';
  /** Actual first public service only; a grand-opening party is not this date. */
  openedOn?: string;
  dateLabel: string;
  summary: string;
  editorTip: string;
  address: string;
  officialUrl: string;
  sourceUrl: string;
  sourceLabel: string;
  verifiedAt: string;
  imageKey: string;
};

/** Checked 2026-09-11. Dates are never promoted from announced to open by the clock. */
export const septemberOpenings: SeptemberOpening[] = [
  {
    id: 'sergeant-ma', name: 'Sergeant Ma', city: 'San Francisco', region: 'sf',
    category: '水岸餐厅', status: 'open', openingType: 'new-restaurant', openedOn: '2026-09-09',
    dateLabel: '9 月 9 日已开业',
    summary: 'China Basin 的新水岸餐厅，把加州食材和中越风味放在同一张餐桌。历史仓库、临水露台与海鲜菜式，是这次新开业的看点。',
    editorTip: '适合安排成晚餐加水边散步。先看官网菜单与订位；本文是开业资讯整理，非亲测食评。',
    address: '185 Berry Street, San Francisco, CA 94107',
    officialUrl: 'https://www.sergeantma.com/',
    sourceUrl: 'https://www.sfgate.com/food/article/sergeant-ma-china-basin-22411402.php',
    sourceLabel: 'SFGATE · 9 月 10 日开业报道', verifiedAt: '2026-09-11', imageKey: 'sep26-open-sergeant-ma',
  },
  {
    id: 'boulangerie-eria-celebration', name: 'La Boulangerie at ERIA Marina', city: 'San Francisco', region: 'sf',
    category: '开业庆祝 · 咖啡烘焙', status: 'announced', openingType: 'opening-celebration',
    dateLabel: '9 月 12 日 · 10:00–14:00 开业庆祝',
    summary: 'ERIA Marina 内的 La Boulangerie 已营业，9 月 12 日举办开业早午餐活动。活动时段购买 espresso 饮品可获赠 pastry；这不是无消费门槛的赠送。首日营业日期未核实。',
    editorTip: '把它当作本月新店庆祝活动，别把 9 月 12 日当成首次营业日。出发前打开活动原页核对。',
    address: '2300 Chestnut Street, San Francisco, CA 94123',
    officialUrl: 'https://www.laboulangeriesf.com/locations-hours',
    sourceUrl: 'https://www.sfstation.com/brunch-soir-e-e15773232',
    sourceLabel: '活动刊登 · SF Station', verifiedAt: '2026-09-11', imageKey: 'sep26-open-boulangerie-eria',
  },
  {
    id: 'florecita-mission', name: 'Florecita Panadería', city: 'San Francisco', region: 'sf',
    category: '迁址预告 · 墨西哥烘焙', status: 'announced', openingType: 'relocation',
    dateLabel: '计划 9 月 20 日 · 日期需复核',
    summary: '以 concha 甜面包为特色的烘焙店，计划迁到 Mission 更大的新址，并增加咖啡与堂食空间。属于原有品牌迁址，不是全新品牌。',
    editorTip: '早期报道写 9 月 12 日，8 月 31 日报道改为 9 月 20 日。先查看商家公告再安排，暂不标为已开。',
    address: '3349 23rd Street, San Francisco, CA 94110',
    officialUrl: 'https://www.florecitapanaderia.com/',
    sourceUrl: 'https://sfstandard.com/2026/08/31/new-sf-restaurants-bakeries/',
    sourceLabel: 'The San Francisco Standard · 8 月 31 日', verifiedAt: '2026-09-11', imageKey: 'sep26-open-florecita',
  },
  {
    id: 'handroll-hawker', name: 'Handroll Hawker', city: 'San Francisco', region: 'sf',
    category: '开业预告 · 澳式寿司卷', status: 'announced', openingType: 'new-restaurant',
    dateLabel: '计划 9 月下旬 · 未公布确切日',
    summary: '把墨尔本常见的随手带走寿司卷带到 Russian Hill。官网列出天妇罗虾、辣金枪鱼与牛油果黄瓜等口味，适合关注轻便午餐新选择。',
    editorTip: '这是可外带的寿司卷概念。具体开业日仍待公布，先收藏官网，别直接按预告日期跑空。',
    address: '2360 Polk Street, San Francisco, CA 94109',
    officialUrl: 'https://www.handrollhawker.com/',
    sourceUrl: 'https://sf.eater.com/openings/213611/san-francisco-bay-area-anticipated-fall-restaurant-bar-openings-2026',
    sourceLabel: 'Eater SF · 9 月 9 日秋季开业预告', verifiedAt: '2026-09-11', imageKey: 'sep26-open-handroll-hawker',
  },
  {
    id: 'woods-wharf', name: 'Woods Beer & Wine Co. · Fisherman’s Wharf', city: 'San Francisco', region: 'sf',
    category: '长期快闪预告 · 酒吧', status: 'announced', openingType: 'extended-pop-up',
    dateLabel: '计划 9 月下旬 · 未公布确切日',
    summary: 'Woods 计划在渔人码头做长期快闪，除了精酿啤酒与葡萄酒，还将加入鸡尾酒。它是新据点预告，目前未核实开始接客。',
    editorTip: '这里指 2847 Taylor 新址，与 Alioto’s Plaza 的临时酒饮摊位不同。先等新址确认开放，再安排到店。',
    address: '2847 Taylor Street, San Francisco, CA 94133',
    officialUrl: 'https://www.woodsbeer.com/',
    sourceUrl: 'https://sfstandard.com/2026/08/31/new-sf-restaurants-bakeries/',
    sourceLabel: 'The San Francisco Standard · 8 月 31 日', verifiedAt: '2026-09-11', imageKey: 'sep26-open-woods-wharf',
  },
  {
    id: 'hedley-club', name: 'The Hedley Club & Palm Court', city: 'San Jose', region: 'south-bay',
    category: '重开预告 · 酒店餐酒馆', status: 'announced', openingType: 'reopening',
    dateLabel: '计划 9 月重开 · 确切日待确认',
    summary: 'Hotel De Anza 的餐酒空间由 Cal-India Collective 更新：Hedley Club 保留 Art Deco 风格，旁边 Palm Court 走玻璃顶花园氛围。它是翻新重开项目。',
    editorTip: '酒店能订房不代表餐厅已开放；先向酒店核实。另一个餐厅 Tejer 计划 12 月开，不属于本月。',
    address: '233 W Santa Clara Street, San Jose, CA 95113',
    officialUrl: 'https://www.hoteldeanza.com/',
    sourceUrl: 'https://sf.eater.com/restaurant-news/213458/hedley-club-palm-court-hotel-de-anza-opening-san-jose',
    sourceLabel: 'Eater SF · Hotel De Anza 餐饮预告', verifiedAt: '2026-09-11', imageKey: 'sep26-open-hedley-club',
  },
];
