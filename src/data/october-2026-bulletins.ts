import { octoberRefreshBulletins } from './october-refresh-bulletins';
import { regionalBulletins, type RegionalBulletin } from './late-september-local';

// Dates are Pacific calendar dates. These are scheduled notices, not live service status.
export const october2026Bulletins: RegionalBulletin[] = [
  {
    id: 'sf-hsb-extra-muni-oct2026', region: 'sf', label: '旧金山', imageKey: 'community-accessible-transit',
    title: '10/2–4 金门公园音乐节：先留好散场路线',
    dateLabel: '10/2–4 · Hardly Strictly Bluegrass 交通安排',
    summary: 'SFMTA 公布 N Judah 与 5R 加班，周末另有 5、28 路加班；增发车辆不一定走完整线路。每天 18:00–20:30 有从 Fulton / 30th 或 25th Avenue 返回 Civic Center 一带的 5R 服务。公园道路与网约车上下客点有调整，导航到指定站点再出发。',
    sourceLabel: 'SFMTA 音乐节交通公告', sourceUrl: 'https://www.sfmta.com/travel-updates/hardly-strictly-bluegrass-october-2-4-2026',
    verifiedAt: '2026-10-02', expiresAt: '2026-10-04',
  },
  {
    id: 'sf-fleet-week-muni-oct2026', region: 'sf', label: '旧金山', imageKey: 'community-accessible-transit',
    title: 'Fleet Week：缆车替代与海滨返程先查好',
    dateLabel: '10/9–11 · 具体调整按线路与日期',
    summary: '10/10–11 的 12:00–17:00，F 线电车在 Pier 39 折返；Powell/Mason 两天 11:00–19:00 部分改巴士，Powell/Hyde 周六同时间也有替代。28、49 路有额外服务。看飞行表演后不宜把缆车或码头叫车当作唯一返程，出门前核对临时站点。',
    sourceLabel: 'SFMTA Fleet Week 交通方案', sourceUrl: 'https://www.sfmta.com/travel-updates/fleet-week-october-9-11-2026',
    verifiedAt: '2026-10-02', expiresAt: '2026-10-11',
  },
  {
    id: 'east-bay-yellow-digital-oct2026', region: 'east-bay', label: '东湾', imageKey: 'bart',
    title: '黄线深夜光纤施工：十月三组日期',
    dateLabel: '10/5–8、10/12–14、10/20–21 · 午夜起',
    summary: 'North Concord/Martinez 至 Pittsburg/Bay Point 附近单线运行，官方预计午夜起延误 10–15 分钟，次晨正常开行前结束。BART 表示会协调 MacArthur 末班换乘及 Antioch 接驳；跨午夜出行要对照官方日期与实时到站，不能照平日时间卡点。',
    sourceLabel: 'BART 数字铁路工程公告', sourceUrl: 'https://www.bart.gov/news/articles/2026/news20260902',
    verifiedAt: '2026-10-02', expiresAt: '2026-10-22',
  },
  {
    id: 'east-bay-yellow-rail-oct2026', region: 'east-bay', label: '东湾', imageKey: 'bart',
    title: '另一项黄线夜间工程：Lafayette 至 Pleasant Hill',
    dateLabel: '十月已列日期：10/15–17、10/19、10/22–24、10/26',
    summary: '这项钢轨维护与 North Concord 光纤工程不同：官方预计午夜至次晨开行前延误 20–30 分钟。10/2 更新的公告列出上述十月日期，也列有后续月份；晚间从旧金山回 Contra Costa County 前，分别核对两项工程与末班连接。',
    sourceLabel: 'BART 黄线钢轨维护公告', sourceUrl: 'https://www.bart.gov/news/articles/2025/news20250326-1',
    verifiedAt: '2026-10-02', expiresAt: '2026-10-27',
  },
  {
    id: 'east-bay-no-green-oct18-2026', region: 'east-bay', label: '东湾', imageKey: 'bart',
    title: '10/18 绿线全天停开，跨湾改用橙线＋蓝线',
    dateLabel: '10/18 周日 · 绿线全天；施工至 18:00',
    summary: 'San Leandro 至 Bay Fair 植被维护期间，区域内预计延误 25–30 分钟；全部 50 站仍有服务。东湾去旧金山可乘橙线到 Bay Fair 换蓝线，反向同站换乘。不要把「施工至 18:00」理解成绿线当晚恢复，官方写的是全天停开。',
    sourceLabel: 'BART 10/18 换乘公告', sourceUrl: 'https://www.bart.gov/news/articles/2026/news20261001',
    verifiedAt: '2026-10-02', expiresAt: '2026-10-18',
  },
  {
    id: 'sf-mission-elevator-oct2026', region: 'sf', label: '旧金山', imageKey: 'bart',
    title: '带行李或推车去 Mission：24th St 电梯仍在维修',
    dateLabel: '计划恢复日期延至 10/23 · 以实时状态为准',
    summary: '24th St. Mission 从街面到站厅的唯一电梯暂不可用，站厅到站台电梯仍运行。需要电梯可先查 16th St. Mission 或 Glen Park，再安排地面接驳；14、14R、49 路沿 Mission Street 连接 16th 至 24th Street。出发前查 BART 电梯状态，预计日期不等于已恢复。',
    sourceLabel: 'BART 24th St. Mission 电梯公告', sourceUrl: 'https://www.bart.gov/news/articles/2026/news20260702-0',
    verifiedAt: '2026-10-02', expiresAt: '2026-10-23',
  },
];

export const currentRegionalBulletins = [...new Map([...regionalBulletins, ...octoberRefreshBulletins, ...october2026Bulletins].map(item => [item.sourceUrl, item])).values()];
export const getActiveRegionalBulletins = (today: string): RegionalBulletin[] =>
  [...new Map([...regionalBulletins, ...octoberRefreshBulletins, ...october2026Bulletins].filter(item => item.verifiedAt <= today).map(item => [item.sourceUrl, item])).values()].filter(item => item.expiresAt >= today);
