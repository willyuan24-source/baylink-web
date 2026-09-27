import type { FreebieOffer } from '../components/FreebieBoard';
import type { MonthlyRegion } from './monthly-types';

export type RegionalBulletin = { id: string; region: MonthlyRegion; label: string; title: string; dateLabel: string; summary: string; sourceLabel: string; sourceUrl: string; verifiedAt: string; expiresAt: string };

export const regionalBulletins: RegionalBulletin[] = [
  {
    "id": "sf-corbett-service-sep28",
    "region": "sf",
    "label": "旧金山",
    "title": "37 Corbett：9/28 起恢复原进城路线",
    "dateLabel": "官方安排 · 9/28 起",
    "summary": "SFMTA 公告恢复 30 英尺车辆和经过 Buena Vista 的全部进城方向站点。此前因车辆调整改道的乘客，出发前重新查站位与实时到站。",
    "sourceLabel": "SFMTA",
    "sourceUrl": "https://www.sfmta.com/travel-updates/37-corbett-resumes-30-foot-bus-service-monday-september-28-2026",
    "verifiedAt": "2026-09-27",
    "expiresAt": "2026-10-31"
  },
  {
    "id": "peninsula-smcl-tutoring-september",
    "region": "peninsula",
    "label": "半岛",
    "title": "县图书馆新增 Tutor.com 学习资源",
    "dateLabel": "9 月新增资源 · 先核对图书证入口",
    "summary": "SMCL 9/3 公告介绍新的免费辅导、写作与求职支持。通过县图书馆资源页进入，按平台核对登录和可用时段；别把其他城市图书证默认当作同一入口。",
    "sourceLabel": "San Mateo County Libraries",
    "sourceUrl": "https://smcl.org/blogs/post/homework-help-and-learning-resources/",
    "verifiedAt": "2026-09-27",
    "expiresAt": "2026-10-31"
  },
  {
    "id": "south-bay-wolfe-ramp-oct2",
    "region": "south-bay",
    "label": "南湾",
    "title": "Wolfe Road：近 Marriott 的北向 I-280 上匝道将关闭",
    "dateLabel": "预计 10/2 晚 20:00 起 · 约一年",
    "summary": "VTA 公告关闭 Marriott 附近的北向 I-280 上匝道，施工预计约一年。请按现场指示使用现有环形上匝道并多留车程；施工安排可能调整，出门前查项目绕行图。",
    "sourceLabel": "VTA",
    "sourceUrl": "https://www.vta.org/projects/notices/upcoming-long-term-wolfe-road-northbound-i-280-ramp-closure-beginning-october-2",
    "verifiedAt": "2026-09-27",
    "expiresAt": "2026-10-31"
  },
  {
    "id": "east-bay-yellow-line-sep29",
    "region": "east-bay",
    "label": "东湾",
    "title": "9/29–10/1 黄线深夜施工，预留换乘时间",
    "dateLabel": "9/29、9/30、10/1 · 午夜至次晨开行前",
    "summary": "BART 公告 Lafayette 至 Pleasant Hill 区间单线运行，工程夜晚预计延误 20–30 分钟。跨午夜的行程请核对官方日期、末班车与后续换乘，十月后续工期另查更新。",
    "sourceLabel": "BART",
    "sourceUrl": "https://www.bart.gov/news/articles/2025/news20250326-1",
    "verifiedAt": "2026-09-27",
    "expiresAt": "2026-10-01"
  },
  {
    "id": "north-bay-rohnert-library-to-go",
    "region": "north-bay",
    "label": "北湾",
    "title": "Rohnert Park–Cotati 图书馆改到临时取书点",
    "dateLabel": "9/8 起提供 Library To Go",
    "summary": "馆舍自 9/1 起暂闭更新，预约取书改到总部大厅 6135 State Farm Drive。可取预约书、浏览小型馆藏和还书；打印、复印与该馆 BiblioBox 当前不可用，先查临时开放时段。",
    "sourceLabel": "Sonoma County Library",
    "sourceUrl": "https://sonomalibrary.org/visit/locations/rohnertparkcotati",
    "verifiedAt": "2026-09-27",
    "expiresAt": "2026-10-31"
  }
];

export const lateSeptemberLocalOffers: FreebieOffer[] = [
  {
    "id": "museo-italo-free-days",
    "region": "sf",
    "brand": "MUSEO ITALO AMERICANO · SF",
    "title": "Fort Mason：周四与首个周日免费普通入馆",
    "dateLabel": "常设福利 · 特别节目另查票价",
    "availability": "ongoing",
    "kind": "no-purchase",
    "requirement": "官网列周四及每月首个周日普通入场免费；18 岁以下亦免费。课程、讲座与特别晚间节目可能另收费或需预约。",
    "description": "前往 Fort Mason Center 的 Building C，先看当天展览及开放公告。十月首个周日为 10/4；不要把普通入馆免费套用到语言课程或特别演出。",
    "imageKey": "culture-visit",
    "imageNote": "看展主题插图，非该馆实景",
    "sourceUrl": "https://sfmuseo.org/",
    "sourceLabel": "Museo 官方入场规则",
    "storeUrl": "https://sfmuseo.org/",
    "verifiedAt": "2026-09-27"
  },
  {
    "id": "history-smc-free-oct2",
    "region": "peninsula",
    "brand": "SAN MATEO COUNTY HISTORY MUSEUM",
    "title": "10/2 Redwood City 历史博物馆免费入场",
    "dateLabel": "10/2 周五 · 10:00–16:00 免费入馆",
    "startDate": "2026-10-02",
    "endDate": "2026-10-02",
    "availability": "dated",
    "kind": "no-purchase",
    "requirement": "馆方现行 Free First Fridays 规则提供当日免费入场，不需消费或居民资格；特别活动与团体预约另查。",
    "description": "馆方已公布 10/2 免费日，地址 2200 Broadway, Redwood City。适合搭配市中心半日散步；导览、儿童项目及临时调整另查当天公告。",
    "imageKey": "culture-visit",
    "imageNote": "看展主题插图，非该馆实景",
    "sourceUrl": "https://historysmc.org/free-first-fridays/",
    "sourceLabel": "SMCHA 官方 10/2 免费日公告",
    "storeUrl": "https://historysmc.org/",
    "verifiedAt": "2026-09-27"
  },
  {
    "id": "sjpl-booktacular-oct24-31",
    "region": "south-bay",
    "brand": "SAN JOSÉ PUBLIC LIBRARY",
    "title": "10/24–31：0–18 岁到馆免费选一本书",
    "dateLabel": "10/24–31 · 各分馆开放时段，送完为止",
    "startDate": "2026-10-24",
    "endDate": "2026-10-31",
    "availability": "dated",
    "kind": "no-purchase",
    "requirement": "0–18 岁本人到 SJPL 分馆领取，每人限一本；家长不能代领。无需图书证、报名或参加活动，也不必穿变装。",
    "description": "官方 2026 Booktacular 已公布领取周。可选书不限万圣节题材，库存依现场；先查分馆营业与临时关闭，不保证每一馆都剩同样书目。",
    "imageKey": "library",
    "sourceUrl": "https://www.sjpl.org/news/halloween-booktacular-giveaway-2026/",
    "sourceLabel": "SJPL 2026 赠书公告与领取条件",
    "storeUrl": "https://www.sjpl.org/locations-table/",
    "verifiedAt": "2026-09-27"
  },
  {
    "id": "oakland-zoo-resident-discount",
    "region": "east-bay",
    "brand": "OAKLAND ZOO",
    "title": "Oakland 居民预约动物园日间优惠票",
    "dateLabel": "常设居民优惠 · 票价随日期变化",
    "availability": "ongoing",
    "kind": "purchase",
    "requirement": "购票时选择 Oakland Resident Discount，入场带显示本人姓名及 Oakland 住址的证明。非 Oakland 同行者另选普通票；不适用会员费或特别活动。",
    "description": "必须先选日期和入场时段；费用与名额看官方结账。居民优惠票仍需付费，停车另核对，不把它和 EBT／WIC 的 Bay to Zoo 计划混为一项。",
    "imageKey": "family-workshop",
    "imageNote": "亲子出游主题插图，非动物园实景",
    "sourceUrl": "https://www.oaklandzoo.org/tickets/",
    "sourceLabel": "Oakland Zoo 官方居民优惠条款",
    "storeUrl": "https://ticket.oaklandzoo.org/oakland-resident",
    "verifiedAt": "2026-09-27"
  }
];
