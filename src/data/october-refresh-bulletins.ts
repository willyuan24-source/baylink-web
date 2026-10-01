import type { RegionalBulletin } from './late-september-local';

// Dates are source-confirmed; expiresAt is the editorial display cutoff, not a reopening promise.
export const octoberRefreshBulletins: RegionalBulletin[] = [
  {
    "id": "bart-yellow-line-digital-railway-october-2026",
    "region": "east-bay",
    "label": "东湾",
    "title": "BART 黄线：十月指定夜晚预留10–15分钟",
    "dateLabel": "10/5–8、12–14、20–21 · 午夜前开工，午夜起可能延误",
    "summary": "North Concord/Martinez 至 Pittsburg/Bay Point 区间为通信设备施工单线运行，预计次日正常开行前结束。这是10–15分钟延误的独立工程；不要与另一段黄线20–30分钟工程混为一谈。晚间换乘请查 BART 当日公告。",
    "sourceLabel": "BART",
    "sourceUrl": "https://www.bart.gov/news/articles/2026/news20260902",
    "expiresAt": "2026-10-21",
    "imageKey": "bart",
    "verifiedAt": "2026-09-30"
  },
  {
    "id": "woodside-library-october-closures-2026",
    "region": "peninsula",
    "label": "半岛",
    "title": "Woodside 图书馆：十月出发前先看闭馆日",
    "dateLabel": "10/1 培训闭馆；10/11–12 节日闭馆",
    "summary": "Woodside 分馆官方页面列出这三个全天闭馆日期。预约取书、活动和借还书请按该馆实际时段安排；这些日期不代表湾区所有城市图书馆都闭馆，其他分馆另查。",
    "sourceLabel": "San Mateo County Libraries · Woodside",
    "sourceUrl": "https://smcl.org/locations/1W/",
    "expiresAt": "2026-10-12",
    "imageKey": "community-library-card",
    "verifiedAt": "2026-09-30"
  },
  {
    "id": "mechanics-institute-october-renovation-2026",
    "region": "sf",
    "label": "旧金山",
    "title": "Mechanics’ Institute 装修：先查楼层与活动地点",
    "dateLabel": "10/1–3 图书馆二、三楼关闭；10/5 二楼重开",
    "summary": "三楼预计十二月中旬重开，部分节目会移址或线上举行；预计时间仍可能调整。这是机构服务公告，不是免费公共图书馆福利。前往57 Post Street前，先查当日开放楼层和参加资格。",
    "sourceLabel": "Mechanics’ Institute",
    "sourceUrl": "https://www.milibrary.org/about-us/renovation/",
    "expiresAt": "2026-10-31",
    "imageKey": "culture-visit",
    "verifiedAt": "2026-09-30"
  }
];
