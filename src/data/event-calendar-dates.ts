/**
 * Calendar-day exceptions, reviewed 2026-09-23 in America/Los_Angeles.
 *
 * An omitted id uses the catalog's inclusive startDate/endDate range.
 * A listed id uses only these confirmed local dates; [] means none confirmed.
 * Dates describe a program occurring that day, never continuous/all-day access.
 * Sources: docs/event-calendar-schedule-sources-2026-09-23.md
 */
export const EVENT_DATE_OVERRIDES: Record<string, string[]> = {
  "san-francisco-fleet-week-2026": [
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
    "2026-10-12"
  ],
  "silicon-valley-african-film-festival-2026": [
    "2026-10-10",
    "2026-10-11"
  ]
};

export const EVENT_SCHEDULE_NOTES: Record<string, string> = {
  "petaluma-pumpkin-patch-2026": "园区每日开放，天气可能影响；夜间迷宫仅周五、周六，部分游乐项目另有时段。",
  "redwood-oktoberfest-closing-weekend-2026": "仅列 9 月 25–27 日收官周末；每天按所购场次入场。",
  "pacific-coast-fog-fest-2026": "两天均为 10:00–18:00；巡游仅周六 10:00。",
  "portola-2026": "9 月 26、27 日均有演出；按所购日期及官方舞台时刻安排，限 21 岁以上。",
  "sonoma-farm-trails-fall-tour-2026": "两天均有农场开放，但部分站点仅开一天；先登记获取目录，逐站核对日期和地址。",
  "ai-conference-sf-2026": "9 月 29 日为 Day ZERØ，9 月 30 日–10 月 1 日为大会；时段和票种分别核对。",
  "mill-valley-film-festival-2026": "10 月 1–11 日每日有场次；影院分布在多个城市，按所选影片核对时间和地点。",
  "santa-rosa-pumpkins-parks-2026": "指定公园每日可寻宝；10 月 23 日后不再补藏，领奖只在工作日，10 月 30 日截止。",
  "hardly-strictly-bluegrass-2026": "连续三天，周五 11:00、周末 09:00 开门，每天演出至 19:00。",
  "rio-vista-bass-derby-2026": "钓鱼比赛连续三天；市区车展仅周六，音乐另按当天节目表。",
  "clayton-oktoberfest-2026": "周六 11:00–20:00，周日 11:00–18:00；嘉年华项目另有开放时段。",
  "oakland-oaktoberfest-2026": "周六 11:00–19:00，周日 10:00–17:00；每天节目不同。",
  "san-francisco-fleet-week-2026": "仅列已公布节目的 10 月 6–12 日；航空表演仅 9–11 日，各项目地点不同。4–5 日暂未公布场次。",
  "silicon-valley-african-film-festival-2026": "日历先列官方已公布放映的 10 月 10–11 日；完整节期为 8–11 日，8–9 日具体公开场次待确认。",
  "san-carlos-art-wine-faire-2026": "两天均为 10:00–18:00；沿 Laurel Street 与 San Carlos Avenue 举行。",
  "oakland-autumn-lights-festival-2026": "10 月 15–17 日均为夜场；按所购日期及票面入场时刻参加。",
  "walnut-creek-diablo-improv-2026": "周五晚演出与即兴互动；周末另有白天工作坊和演出，各场分别核对门票。",
  "campbell-oktoberfest-2026": "周六 10:00–18:00，周日 10:00–17:00；舞台和儿童项目另按日程。",
  "half-moon-bay-pumpkin-festival-2026": "两天均为 09:00–17:00；10 月 12 日南瓜称重是另一场活动。",
  "bay-area-musical-improv-festival-2026": "10 月 22–25 日每天有演出；开幕夜、工作坊和各演出分别按场次参加。",
  "san-jose-short-film-festival-2026": "10 月 22–25 日每日均有放映；按单元核对开场时间、影厅及票种。",
  "emeryville-art-exhibition-closing-2026": "本条仅列 10 月 23–25 日闭幕周末，三天均为 11:00–18:00。",
  "palo-alto-addams-family-opening-2026": "本条仅列 10 月 30、31 日 19:30 两场；其余演出在 11 月，须另查剧院日程。",
  "oakland-omca-friday-finale-2026": "本条仅列 10 月 30 日的季末周五夜，17:00–21:00。"
};
