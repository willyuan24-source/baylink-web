# BAYLINK 2026 年 9 月生活专题

发布路径 `/this-month`，首页频道入口下方、生活指南开头与编辑推荐提供入口。专题含 9 场当月活动与 3 个慢游地点，编辑核对日期为 2026-09-08（湾区当地日期）。

## 内容依据

活动逐项证据见 [旧金山来源](monthly-sf-sources-2026-09.md) 和 [其他地区来源](monthly-region-sources-2026-09.md)。只采用主办方当前 2026 页面；未采纳旅游汇总中的旧届数、往年节目单和过期早鸟票价。交通、预算与半日节奏属于编辑建议时已在文案区分。

三个慢游提案均为编辑选地，不声称是九月限定活动或实地体验：

- [Filoli 官方参观说明](https://filoli.org/visit/)：预约建议、一小时报到窗口、步道提前半小时关闭、普通宠物限制、主入口附近可野餐而花园及园区内不允许。未引用页面动态“今日”开放时间作为整月承诺。配图采用原创情境插图，不假冒 Filoli 实景。
- [Foodwise 访客说明](https://foodwise.org/markets/ferry-plaza-farmers-market/visitor-info/)：常规周六 8–14 点、周二与周四 10–14 点，市场在 Ferry Building 外，室内店铺另有经营安排。两餐采购及短程湾边散步是编辑建议。
- [California State Parks](https://www.parks.ca.gov/?page_id=531)：Francis Beach 入口、Coastside Trail、步道与沙滩犬只规则。现有 Roosevelt 工程公告未当作整片海岸封闭，提案从 Francis 短程往返且要求查公园公告。配图为注明 2014 年的 Half Moon Bay 实景。

## 日期、票务与更新

- `src/data/monthly-edition.ts` 是本期期号和地点清单；活动分为 `monthly-sf-events.ts` 与 `monthly-region-events.ts`。每项保留核对日期与官方入口。
- 日期判断使用 `America/Los_Angeles`，包括跨 UTC 日期和夏冬令时。活动终日包含在日期范围内；状态仅根据日期判断，不表示主办方已确认当天照常举行。
- 当月默认隐藏已结束活动，可手动显示；实际月份与期号不一致时明确标为过期期刊，不将旧活动冒充当月最新。
- “免费入场”包括餐饮、品酒等另付的免费街区活动；Flower Piano 部分群体免费、普通游客需植物园门票，因此为混合票务。Portola 全场 21+，与艺术节仅品酒部分 21+ 区分。
- 日历下载为 `.ics` 日期提醒，采用 DATE 起止（结束日后一天为独占终点）、透明日程；不编造活动时段，不代表预约或门票。文件写明官方入口、年龄/票务说明和核对日期。UTF-8 按 75 字节折行。
- 本功能没有自动采集或自动发布任务。更新一期需重新查官方年份、日期、费用、年龄要求、入口，修改期号与数据后构建部署。后台与社区帖子无改动。

## 维护与验收

`npm run check` 包含内容、筛选、日期、日历与 SSR 验收。`npm run build` 生成专题 HTML 与 sitemap；发布时同步 `dist/sitemap.xml` 到 `public/sitemap.xml`。复用已有授权图片与原创插图，图片说明和署名保留，未取用主办方受限新闻图片。
