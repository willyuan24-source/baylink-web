import { sfSeptemberEvents } from './monthly-sf-events';
import { regionalSeptemberEvents } from './monthly-region-events';
import type { MonthlyPlace } from './monthly-types';

export const MONTHLY_EDITION = {
  month: '2026-09',
  label: '2026 年 9 月',
  checkedAt: '2026-09-08',
  title: '九月，把周末留给湾区。',
  intro: '花园里的钢琴、街头的中秋、红杉下的艺术。先挑一个想去的地方，再把这一天慢慢展开。',
};

export const MONTHLY_EVENTS = [...sfSeptemberEvents, ...regionalSeptemberEvents]
  .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));

export const MONTHLY_PLACES: MonthlyPlace[] = [
  {
    id: 'filoli-garden', title: 'Filoli：把半天交给花园', area: '半岛 · Woodside', imageKey: 'filoli',
    summary: '想避开赶场，就选宅邸与花园慢慢看。先订好入园时段，把走自然步道留作体力允许时的加项。',
    plan: ['编辑建议：先看宅邸，再在花园选一条轻松步线，留一点坐下休息的时间。', '官方建议提前订票，按所选一小时入园窗口报到；步道比庄园提前半小时关闭。', '普通宠物不能入内；野餐长椅在主入口附近，花园和园区内不能铺开野餐。'],
    officialUrl: 'https://filoli.org/visit/', sourceLabel: 'Filoli 参观说明', relatedGuideSlug: 'peninsula-living-guide',
  },
  {
    id: 'ferry-plaza-morning', title: 'Ferry Plaza：采购之后，去海边走走', area: '旧金山 · Embarcadero', imageKey: 'ferry-market',
    summary: '把周六的一餐交给农夫市集：先看看摊位，再按两餐清单买东西。买得少一点，回家也更容易安排。',
    plan: ['官方常规安排为周六 8:00–14:00，周二、周四 10:00–14:00；出发前另查临时公告。', '编辑建议：早餐、买菜与短程湾边散步选两项就够；不要提着易腐食品逛一整天。', '市集在 Ferry Building 外，室内商店有各自时间；带可重复使用的购物袋和合适保冷用品。'],
    officialUrl: 'https://foodwise.org/markets/ferry-plaza-farmers-market/visitor-info/', sourceLabel: 'Foodwise 市集访客说明', relatedGuideSlug: 'bay-area-farmers-market-shopping-guide',
  },
  {
    id: 'half-moon-bay-coast', title: 'Half Moon Bay：只安排一段海风', area: '半岛海岸 · Half Moon Bay', imageKey: 'coast',
    summary: '没有必须追到的终点。从 Francis Beach 起步，沿 Coastside Trail 短程往返，看天气和体力决定走多远。',
    plan: ['编辑建议：到海边、走一小段、休息后原路返回，把堵车和找停车位也算进行程。', '海滩不允许普通宠物犬；Coastside Trail 可牵绳遛狗，步道与沙滩规则分开核对。', '带防风外套，出发前查公园与天气公告；看海留在合适的岸上位置，不把下水列入计划。'],
    officialUrl: 'https://www.parks.ca.gov/?page_id=531', sourceLabel: 'California State Parks 公园说明', relatedGuideSlug: 'half-moon-bay-coastal-half-day-guide',
  },
];
