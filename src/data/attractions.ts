import type { PageMetadata } from '../lib/seo';

export const EXPLORE_METADATA: PageMetadata = {
  title: '湾区景点探索与出游清单｜BAYLINK',
  description: '从金门大桥到红杉森林，按旧金山、东湾、半岛、南湾和北湾发现景点攻略，筛选免费去处，保存并分享自己的出游清单。',
  path: '/explore',
};
export const ATTRACTION_REGIONS = [
  { id: 'all', label: '全部地区' }, { id: 'sf', label: '旧金山' },
  { id: 'east-bay', label: '东湾' }, { id: 'peninsula', label: '半岛' },
  { id: 'south-bay', label: '南湾' }, { id: 'north-bay', label: '北湾' },
] as const;
export const ATTRACTION_THEMES = [
  { id: 'all', label: '所有兴趣' }, { id: 'landmark', label: '经典地标' },
  { id: 'waterfront', label: '海岸与湖畔' }, { id: 'nature', label: '花园与树林' },
  { id: 'culture', label: '街区与文化' }, { id: 'museum', label: '博物馆与艺术' },
] as const;
export const ATTRACTION_COSTS = [
  { id: 'all', label: '不限门票' }, { id: 'free', label: '主体免费' },
  { id: 'mixed', label: '免费 + 付费区域' }, { id: 'paid', label: '需购门票' },
] as const;
export type Attraction = {
  id: string; slug: string; title: string; city: string;
  region: Exclude<(typeof ATTRACTION_REGIONS)[number]['id'], 'all'>;
  themes: Exclude<(typeof ATTRACTION_THEMES)[number]['id'], 'all'>[];
  cost: 'free' | 'mixed' | 'paid'; duration: string; note: string; mapQuery: string;
};

/** Cost describes admission to the featured outing, excluding transport, parking and food. */
export const ATTRACTIONS: Attraction[] = [
  { id: 'golden-gate', slug: 'sf-golden-gate-bridge-fort-point-guide', title: '金门大桥与 Fort Point', city: 'San Francisco', region: 'sf', themes: ['landmark', 'waterfront'], cost: 'free', duration: '3–4 小时', note: '把看桥和走桥分开安排，出发前确认步道与堡垒开放。', mapQuery: 'Golden Gate Bridge Welcome Center San Francisco' },
  { id: 'pier39', slug: 'sf-fishermans-wharf-pier39-guide', title: '渔人码头与 PIER 39', city: 'San Francisco', region: 'sf', themes: ['landmark', 'waterfront'], cost: 'mixed', duration: '2–3 小时', note: '海狮与滨水散步可免费欣赏，游船和馆内项目另购票。', mapQuery: 'PIER 39 San Francisco' },
  { id: 'alcatraz', slug: 'sf-alcatraz-booking-day-guide', title: '恶魔岛 Alcatraz', city: 'San Francisco', region: 'sf', themes: ['landmark', 'culture'], cost: 'paid', duration: '3–4 小时', note: '提前订含登岛的船票；地图指向 Pier 33 登船处。', mapQuery: 'Alcatraz Landing Pier 33 San Francisco' },
  { id: 'chinatown', slug: 'sf-chinatown-north-beach-walk-guide', title: '唐人街与 North Beach', city: 'San Francisco', region: 'sf', themes: ['culture', 'landmark'], cost: 'free', duration: '2–3 小时', note: '从牌楼走进街巷，把吃饭和小店停留留在行程里。', mapQuery: 'Dragon Gate Chinatown San Francisco' },
  { id: 'palace', slug: 'sf-palace-fine-arts-marina-guide', title: '艺术宫与 Marina', city: 'San Francisco', region: 'sf', themes: ['landmark', 'waterfront'], cost: 'free', duration: '2–3 小时', note: '外部环湖散步与建筑观赏免费，演出和私人活动另计。', mapQuery: 'Palace of Fine Arts San Francisco' },
  { id: 'golden-gate-park', slug: 'golden-gate-park-free-car-free-day-guide', title: '金门公园与 JFK Promenade', city: 'San Francisco', region: 'sf', themes: ['nature', 'museum'], cost: 'mixed', duration: '3–5 小时', note: '先逛免费户外区域，花园与博物馆分别查票。', mapQuery: 'Conservatory of Flowers San Francisco' },
  { id: 'presidio', slug: 'presidio-picnic-day-guide', title: 'Presidio Tunnel Tops', city: 'San Francisco', region: 'sf', themes: ['nature', 'waterfront'], cost: 'free', duration: '2–3 小时', note: '草坡、湾景和野餐；带外套，并确认餐桌使用规则。', mapQuery: 'Presidio Tunnel Tops San Francisco' },
  { id: 'berkeley', slug: 'berkeley-campus-botanical-garden-half-day', title: 'Berkeley 校园与植物园', city: 'Berkeley', region: 'east-bay', themes: ['nature', 'culture'], cost: 'mixed', duration: '3.5–4.5 小时', note: '校园和山上植物园是两个停留点，植物园需要门票。', mapQuery: 'Sather Gate Berkeley California' },
  { id: 'lake-merritt', slug: 'oakland-lake-merritt-omca-half-day', title: 'Lake Merritt 与 OMCA', city: 'Oakland', region: 'east-bay', themes: ['waterfront', 'museum'], cost: 'mixed', duration: '3–4 小时', note: '湖畔散步搭配加州故事，博物馆门票与开放日另查。', mapQuery: 'Oakland Museum of California Oakland' },
  { id: 'redwood', slug: 'reinhardt-redwood-first-walk-guide', title: 'Reinhardt Redwood 红杉林', city: 'Oakland', region: 'east-bay', themes: ['nature'], cost: 'free', duration: '2–3 小时', note: '选适合自己的短步道；停车费用和步道公告单独确认。', mapQuery: 'Redwood Gate Staging Area Oakland' },
  { id: 'stanford', slug: 'stanford-cantor-campus-art-walk', title: 'Stanford 与 Cantor 艺术馆', city: 'Stanford', region: 'peninsula', themes: ['culture', 'museum'], cost: 'free', duration: '2.5–3.5 小时', note: '校园建筑与艺术馆慢慢看，留意闭馆日和停车规则。', mapQuery: 'Cantor Arts Center Stanford' },
  { id: 'filoli', slug: 'filoli-house-garden-day-trip', title: 'Filoli 庄园与花园', city: 'Woodside', region: 'peninsula', themes: ['nature', 'culture'], cost: 'paid', duration: '2.5–4 小时', note: '按入场时段订票，花园状态随季节变化。', mapQuery: 'Filoli Historic House Garden Woodside' },
  { id: 'half-moon-bay', slug: 'half-moon-bay-coastal-half-day-guide', title: 'Half Moon Bay 海岸', city: 'Half Moon Bay', region: 'peninsula', themes: ['waterfront', 'nature'], cost: 'free', duration: '2–4 小时', note: '海风与沙滩适合留白；停车另计，下海前查海况。', mapQuery: 'Francis Beach Half Moon Bay State Beach' },
  { id: 'baylands', slug: 'palo-alto-baylands-family-walk-guide', title: 'Palo Alto Baylands 湿地', city: 'Palo Alto', region: 'peninsula', themes: ['waterfront', 'nature'], cost: 'free', duration: '1–3 小时', note: '观鸟和短途散步，先读当前部分步道封闭提醒。', mapQuery: 'Lucy Evans Baylands Nature Interpretive Center Palo Alto' },
  { id: 'san-jose', slug: 'san-jose-tech-japantown-day-trip', title: 'San Jose 科技馆与日本城', city: 'San Jose', region: 'south-bay', themes: ['museum', 'culture'], cost: 'mixed', duration: '5–6 小时', note: '科技馆需票，日本城街区可自由散步；两地间预留交通。', mapQuery: 'The Tech Interactive San Jose' },
  { id: 'hakone', slug: 'hakone-gardens-saratoga-half-day', title: 'Saratoga 的 Hakone Gardens', city: 'Saratoga', region: 'south-bay', themes: ['nature', 'culture'], cost: 'paid', duration: '1.5–2 小时', note: '日式庭园短程，先确认坡道、池塘整修与优惠资格。', mapQuery: 'Hakone Estate Gardens Saratoga' },
  { id: 'muir-woods', slug: 'muir-woods-reservation-day-trip', title: 'Muir Woods 红杉森林', city: 'Mill Valley', region: 'north-bay', themes: ['nature'], cost: 'paid', duration: '1.5–2.5 小时', note: '停车或接驳需预约，与公园门票分开；提前安排返程。', mapQuery: 'Muir Woods Visitor Center Mill Valley' },
  { id: 'sausalito', slug: 'sausalito-waterfront-ferry-half-day', title: 'Sausalito 渡轮与海滨', city: 'Sausalito', region: 'north-bay', themes: ['waterfront', 'culture'], cost: 'free', duration: '2–3 小时', note: '海滨散步免费，船票另付；先确认返程码头和班次。', mapQuery: 'Sausalito Ferry Terminal' },
];
