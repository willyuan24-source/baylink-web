import type { Attraction } from './attractions';

type RegionIntro = { title: string; text: string; planning: string };

/** Editorial orientation, not a promise about travel times or current access. */
export const ATTRACTION_REGION_INTROS: Record<Attraction['region'], RegionIntro> = {
  sf: {
    title: '旧金山：海岸步道与街区文化',
    text: '想看海，就从金门大桥、Presidio 或 Lands End 选一段；想看城市日常，就把唐人街、North Beach 或 Mission 留给步行和吃饭。半天先选一个片区，更能留下停坐的时间。',
    planning: '海岸常有风雾，山坡和阶梯也多。坐公共交通走单向路线时，先查终点的回程；带推车可优先选平缓海滨，并阅读每篇攻略的路面提示。',
  },
  'east-bay': {
    title: '东湾：从湖畔和航母走到湿地与红杉',
    text: 'Berkeley 的校园、Oakland 的湖畔和红杉林、Alameda 的航母、Fremont 的湿地，各有不同节奏。喜欢展馆与水岸可选 Lake Merritt 或 Alameda；想安静看自然，就选红杉林或 Coyote Hills。',
    planning: 'BART 适合连接城市，但车站到山中步道、航母和湿地通常还有最后一段交通。把一个城市或公园作为当天主站，回程安排和停车点一起保存。',
  },
  peninsula: {
    title: '半岛：花园、航空故事与两种海岸',
    text: '湾岸有 Coyote Point 和 Baylands，山脚有 Filoli 与 Stanford，太平洋一侧则是 Half Moon Bay。Hiller 航空博物馆适合给亲子半日安排一个室内主站，再按体力决定是否加一段散步。',
    planning: '湾岸和太平洋海岸之间需要跨山交通；不要把地图上相近的点当成步行可达。Caltrain 下车后的接驳、花园入场时段与停车分别确认。',
  },
  'south-bay': {
    title: '南湾：科技、历史与庭园慢游',
    text: 'San Jose 可选 The Tech、日本城，或埃及博物馆与玫瑰园；Mountain View 可把计算机历史馆作为主站，天气适合再去 Shoreline。Saratoga 的 Hakone 则适合单独留一个安静下午。',
    planning: '先按城市选主站，再加附近的一处。展馆和户外庭园的开放规则不同，停车、闭馆日和互动项目需分开查；雨天可缩短户外段，把时间留给馆内。',
  },
  'north-bay': {
    title: '北湾：坐船看海湾，沿公路走进山林',
    text: 'Sausalito 适合海滨散步，Angel Island 适合围绕渡轮安排一日；Muir Woods 看红杉，Point Reyes 的 Bear Valley 则从游客中心开始认识海岸山谷。先选一种节奏，再决定要不要加站。',
    planning: '渡轮目的地先锁定返程，公路目的地先确认停车和接驳。Point Reyes 范围很大，灯塔不在 Bear Valley 旁边；无车行程也不要默认能顺路接上 Muir Woods。',
  },
};
