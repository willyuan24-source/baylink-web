# 活动日历发生日期核查 · 2026-09-23

基准日：2026-09-23，日期按 America/Los_Angeles 本地日历理解。审阅当时发布的 MONTHLY_EVENTS 共 73 条：50 条单日、23 条多日。

## 数据规则与结果

- 新增 src/data/event-calendar-dates.ts：EVENT_DATE_OVERRIDES 共 2 条，EVENT_SCHEDULE_NOTES 共 24 条。
- 单日活动只在该日显示；明确每日营业或连续数日均有节目者不写冗余 override。
- override 是完整的可用日期集合，不与原区间叠加。空数组约定为尚无可确认日期；当前没有需要空数组的记录。
- Fleet Week 原始总节期 10/4–12 不等于每一天已有活动，日历仅使用已公布的 10/6–12。
- SVAFF 保守使用已公布现场放映表中的 10/10–11；10/8–9 的总节期有效，但当前可读取的公开资料不足以确认面向公众的具体场次。未把“缺乏证据”写成取消。
- 所有 override 日期均在原 startDate/endDate 范围内。没有修改 catalog 原始日期，也没有发现必须更正的日期区间。
- 50 条单日逐条检查 startDate/endDate、dateLabel 和 plan；单日沿用已有核验，不把本次日期审计宣称为所有价格、余票、年龄条件重新联网核验。23 条多日中模糊项目追加查看官方逐日日程；此前同轮已验证的明确两日/三日街庆沿用记录（见 autumn-events-research-2026-09-23.md）。
- 日历中的某日有活动不代表全天开放、每个分会场都开放、尚有票，或可使用同一张票参加全部项目。日程说明保留这些边界。

## 23 条多日活动逐项依据

| ID | 原始日期范围 | 日历处理 | 日期依据 | 官方来源 |
| --- | --- | --- | --- | --- |
| petaluma-pumpkin-patch-2026 | 2026-09-25 — 2026-10-31 | 原区间每天 | 2026 价格/时段页列周日至周四和周五、六的开放时段，日间迷宫为周一至周日；夜间迷宫只在周五、六。首日 9/25 沿用本轮原有首页核验，10/31 为最后营业日。 | [官方页面](https://petalumapumpkinpatch.com/pricing-hours/) |
| redwood-oktoberfest-closing-weekend-2026 | 2026-09-25 — 2026-09-27 | 原区间每天 | 沿用本轮官方索引核验和卡片逐日场次：周五一场、周六两场、周日两场。全活动的 9/21 休场不在本条范围内；该市官网正文曾返回 403。 | [官方页面](https://www.redwoodcity.org/residents/redwood-city-events/oktoberfest) |
| pacific-coast-fog-fest-2026 | 2026-09-26 — 2026-09-27 | 原区间每天 | 本轮官方核验与 dateLabel 均明确 9/26、27 两天 10–18 时；巡游只在周六，不把巡游单独扩成两天。 | [官方页面](https://pacificcoastfogfest.com/) |
| portola-2026 | 2026-09-26 — 2026-09-27 | 原区间每天 | 官方 2026 两日音乐节及原目录明确 9/26、27；单日票仅对应所购日期，具体演出须看舞台时刻。 | [官方页面](https://www.portolamusicfestival.com/general-info/) |
| sonoma-farm-trails-fall-tour-2026 | 2026-09-26 — 2026-09-27 | 原区间每天 | 本次重新打开官方页面明确两日巡游，且警示有农场仅开一天。活动级别保留两天；不能据此把同一农场地址视作两日均开放，地图只能作地区线索。 | [官方页面](https://www.farmtrails.org/experience/weekend-along-the-farm-trails/) |
| ai-conference-sf-2026 | 2026-09-29 — 2026-10-01 | 原区间每天 | 本次打开官方页面明确 9/29 Day ZERØ 和 9/30–10/1 Full Conference。三个日历日均有活动，但票种和每天时段不同；卡片的非连续开放指非全天候。 | [官方页面](https://aiconference.com/) |
| mill-valley-film-festival-2026 | 2026-10-01 — 2026-10-11 | 原区间每天 | 本次逐日节目页列出 10/1–11 的所有日期及影片场次，包括工作日；不是仅周末。多城市影院须逐场核对，不能用一个城市坐标作确切影厅。 | [官方页面](https://app.mvff.com/schedule) |
| santa-rosa-pumpkins-parks-2026 | 2026-10-01 — 2026-10-30 | 原区间每天 | 本次市府正文明确 10/1–30 公园寻宝、日出至日落开放。10/23 只是不再补藏的日期，不是闭园日期；领奖限工作日 8–18 时，10/30 截止，故不删除周末寻宝日期。 | [官方页面](https://www.srcity.org/Calendar.aspx?EID=2289&calType=0&day=23&month=10&year=2026) |
| hardly-strictly-bluegrass-2026 | 2026-10-02 — 2026-10-04 | 原区间每天 | 官方及本轮复核明确 10/2–4 连续三天。周五 11 时、周末 9 时开门，每天 19 时结束，不作全天开放处理。 | [官方页面](https://hardlystrictlybluegrass.com/info-faq-2026/) |
| rio-vista-bass-derby-2026 | 2026-10-02 — 2026-10-04 | 原区间每天 | 本次官方活动页支持 10/2–4 比赛和分日市区节目；周六车展仅 10/3，连续三日指综合活动/钓鱼比赛，不代表车展连续三日。 | [官方页面](https://www.bassfestival.com/bass-festival) |
| clayton-oktoberfest-2026 | 2026-10-03 — 2026-10-04 | 原区间每天 | 本轮官方信息及原目录明确周六 11–20 时、周日 11–18 时。独立嘉年华时刻不扩成全天。 | [官方页面](https://claytonoktoberfest.com/info/) |
| oakland-oaktoberfest-2026 | 2026-10-03 — 2026-10-04 | 原区间每天 | 本轮官方信息及原目录明确周六 11–19 时、周日 10–17 时；两天均有节庆。 | [官方页面](https://www.oaktoberfest.org/) |
| san-francisco-fleet-week-2026 | 2026-10-04 — 2026-10-12 | override：10/6–12 | 本次官方逐日日历：10/4、5 尚无公布项目；10/6 两场乐队，10/7–8 舰艇/乐队，10/9–11 航空及其他项目，10/12 舰艇/乐队。只使用 10/6–12 七天；10/4–5 是未公布而非宣告取消。 | [官方页面](https://fleetweeksf.org/calendar-of-events/) |
| silicon-valley-african-film-festival-2026 | 2026-10-08 — 2026-10-11 | override：10/10、11 | 本次官网直接链接的 2026 四页 PDF 仅列 10/10、11 现场放映；10/8–9 在官网只有总节期，完整 Box Office 须登录。本日历保守收录有明确公开放映表的两天；不推测前两天公众场次。 | [官方页面](https://boxoffice.svaff.org/downloads/SVAFF2026-screening-schedule.pdf) |
| san-carlos-art-wine-faire-2026 | 2026-10-10 — 2026-10-11 | 原区间每天 | 本轮官方合作方及原目录明确 10/10、11 两天 10–18 时。 | [官方页面](https://pacificfinearts.com/festival/san-carlos-art-wine-faire/) |
| oakland-autumn-lights-festival-2026 | 2026-10-15 — 2026-10-17 | 原区间每天 | 本轮主办方确认 10/15–17 三个夜场；按票面时段进入，不当作白天开放活动。 | [官方页面](https://gardensatlakemerritt.org/autumn-lights-festival-2026/) |
| walnut-creek-diablo-improv-2026 | 2026-10-16 — 2026-10-18 | 原区间每天 | 本次取得已更新的 2026 逐日表：10/16 晚演出/jam，10/17 工作坊/演出，10/18 工作坊/演出/jam。官网首页残留 2025 内容不作依据。 | [官方页面](https://diabloimprovfestival.org/schedule) |
| campbell-oktoberfest-2026 | 2026-10-17 — 2026-10-18 | 原区间每天 | 本轮官方核验与目录明确 10/17 10–18 时、10/18 10–17 时；连续两天。 | [官方页面](https://campbelloktoberfest.com/) |
| half-moon-bay-pumpkin-festival-2026 | 2026-10-17 — 2026-10-18 | 原区间每天 | 本轮官方核验与目录明确 10/17、18 9–17 时。10/12 称重活动是范围之外另一项目，不加到本条日期。 | [官方页面](https://www.hmbpumpkinfest.com/) |
| bay-area-musical-improv-festival-2026 | 2026-10-22 — 2026-10-25 | 原区间每天 | 本次 2026 演出页分别列 10/22 开幕/晚场、10/23 晚场、10/24 下午及晚场、10/25 下午及闭幕；四天都确有项目。工作坊不意味着每场票含全部节目。 | [官方页面](https://bayareamusicalimprov.com/shows) |
| san-jose-short-film-festival-2026 | 2026-10-22 — 2026-10-25 | 原区间每天 | 本次取得完整 2026 片单，周四 10/22 14 时起，周五 10/23 11 时起，周六、周日亦逐场列出；官方首页确认连续四日，故无缺日。 | [官方页面](https://sjsff.com/2026-film-schedule/) |
| emeryville-art-exhibition-closing-2026 | 2026-10-23 — 2026-10-25 | 原区间每天 | 本次官方展览页完整展期 10/3–25 为每周三至周日；本目录只选 10/23（周五）–25（周日），三天均开放 11–18 时。不把完整展期改成每天。 | [官方页面](https://www.emeryarts.org/) |
| palo-alto-addams-family-opening-2026 | 2026-10-30 — 2026-10-31 | 原区间每天 | 本次剧院页明确 10/30 预演、10/31 开幕，周五、周六 19:30。完整剧期到 11/15；卡片只选两场十月晚场，不能按完整剧期每日扩展。 | [官方页面](https://paplayers.org/show/the-addams-family/) |

## 两项例外的补充来源与边界

1. Fleet Week：
   - [官方日历](https://fleetweeksf.org/calendar-of-events/)是逐日发生日期的主要依据；10/4 和 10/5 明确尚未发布项目。
   - [航空表演](https://fleetweeksf.org/air-show/)只有 10/9、10、11。
   - [舰艇参观](https://fleetweeksf.org/events/ship-tours/)目前明确 10/7、8、10、11、12，并非七天都有。此综合活动 override 纳入 10/6 乐队与 10/9 航空/舰队巡游，但不代表当天一定有舰艇参观。
   - 活动位置分散；单个 Marina Green 标记不能代表 10/6 乐队或 10/12 舰艇参观的确切地点。地图应保留地区/多场地提示，并让读者进入官方分日地图。

2. Silicon Valley African Film Festival：
   - [官方总节期](https://svaff.org/programs/annual-film-festival)和[官方票务入口](https://www.zeffy.com/en-US/ticketing/17th-annual-silicon-valley-african-film-festival-svaff)仍保留 10/8–11 的完整节庆信息。
   - [官网链接的 2026 放映 PDF](https://boxoffice.svaff.org/downloads/SVAFF2026-screening-schedule.pdf)四页分为 10/10 和 10/11；10/11 有闭幕典礼。完整 Box Office 日程需登录，本次没有登录或注册。
   - PDF 另列 10/4 线上放映日，不在原记录日期范围内，也不是当天本地实体地图活动，因此不加入此记录。
   - 若主办方稍后公开 10/8–9 的对外场次，应核实后补充 override，而非按范围自动加入。

## 50 条单日记录

以下记录在数据中已是单日，不展开为系列或重复规则。特别是 OMCA 周五夜只选 10/30、Benicia 农夫市集只选 10/29、YBG 午间音乐只选 10/8；名称中的系列含义不产生额外日期。

| ID | 唯一日期 | 原有时段说明 | 官方来源 |
| --- | --- | --- | --- |
| cupertino-fall-bike-fest-2026 | 2026-09-26 | 9 月 26 日 · 09:00–13:00 | [官方页面](https://www.cupertino.gov/Events-directory/Bike-Fest-2026) |
| presidio-chuseok-festival-2026 | 2026-09-26 | 9 月 26 日 · 11:00–16:00 | [官方页面](https://presidio.gov/explore/events/chuseok-festival-2026) |
| novato-youth-folk-dance-2026 | 2026-09-27 | 9 月 27 日 · 11:30 开始 | [官方页面](https://www.minoans.com/youth-festival) |
| petaluma-fall-antique-faire-2026 | 2026-09-27 | 9 月 27 日 · 08:00–16:00 | [官方页面](https://petalumadowntown.com/antique-show) |
| pyladies-snowflake-ai-data-2026 | 2026-09-30 | 9 月 30 日 · 18:00–20:30 PDT | [官方页面](https://luma.com/693643qu) |
| llmday-san-francisco-q4-2026 | 2026-10-01 | 10 月 1 日 · 09:00–17:30 PDT 议程 | [官方页面](https://llmday.com/2026-san-francisco-q4/) |
| runtime-modal-sf-2026 | 2026-10-01 | 10 月 1 日 · 08:30–18:30 PDT | [官方页面](https://luma.com/runtime-by-modal) |
| fremont-finding-nemo-outdoor-movie-2026 | 2026-10-02 | 10 月 2 日 · 活动 18:00–22:00，日落后放映 | [官方页面](https://www.fremont.gov/government/departments/parks-recreation/events/movies-under-the-stars) |
| oakland-civic-ai-design-sprint-2026 | 2026-10-02 | 10 月 2 日 · 13:00–17:00 PDT | [官方页面](https://luma.com/cgx812ka) |
| redwood-city-portfest-2026 | 2026-10-03 | 10 月 3 日 · 10:30–15:30 | [官方页面](https://www.redwoodcityport.com/portfest2026) |
| sf-african-arts-festival-2026 | 2026-10-03 | 10 月 3 日 · 11:00–16:00 | [官方页面](https://ybgfestival.org/event/african-arts-festival-2026/) |
| sunnyvale-diwali-2026 | 2026-10-03 | 10 月 3 日 · 11:30–19:30 | [官方页面](https://www.sacas.org/) |
| tiburon-wine-festival-2026 | 2026-10-03 | 10 月 3 日 · 13:00–16:00 | [官方页面](https://www.tiburonchamber.org/tiburon-wine-festival/) |
| vacaville-learn-your-colors-run-2026 | 2026-10-03 | 10 月 3 日 · 09:00–12:00 | [官方页面](https://color-run.vacavillekiwanis.org/) |
| litquake-out-loud-2026 | 2026-10-04 | 10 月 4 日 · 11:00–16:00 | [官方页面](https://www.litquake.org/events-1/litquake-out-loud-1) |
| little-italy-san-jose-festival-2026 | 2026-10-04 | 10 月 4 日 · 11:00–19:00 | [官方页面](https://www.littleitalysj.com/little-italy-san-jose-festival) |
| n8n-sf-tech-week-workshop-2026 | 2026-10-05 | 10 月 5 日 · 18:00–21:00 PDT | [官方页面](https://luma.com/n8n-ntlt) |
| surrealdb-mastra-shared-memory-2026 | 2026-10-05 | 10 月 5 日 · 17:00–20:30 PDT | [官方页面](https://luma.com/surrealdb-gs07) |
| sf-quinteto-latino-lunchtime-2026 | 2026-10-08 | 10 月 8 日 · 12:30–13:30 | [官方页面](https://ybgfestival.org/event/quinteto-latino-2026/) |
| marinwood-halloween-harvest-2026 | 2026-10-09 | 10 月 9 日 · 17:00–18:30 | [官方页面](https://www.marinwood.org/event/halloween-harvest-festival) |
| oss4ai-agent-day-menlo-park-2026 | 2026-10-09 | 10 月 9 日 · 12:00–18:00 PDT | [官方页面](https://luma.com/7wn8tsf7) |
| burlingame-mandarin-storytime-2026 | 2026-10-10 | 10 月 10 日 · 11:00 开始 | [官方页面](https://burlingame.org/356/Events) |
| cupertino-pooch-plunge-2026 | 2026-10-10 | 10 月 10 日 · 09:00–12:45，按 45 分钟场次 | [官方页面](https://www.cupertino.gov/Parks-Recreation/Events/Pooch-Plunge) |
| napa-musictime-halloween-2026 | 2026-10-10 | 10 月 10 日 · 10:30 开始 | [官方页面](https://www.festivalnapavalley.org/calendar/musictime-napa-jay-benson-jesse-micek/) |
| novato-nostalgia-days-2026 | 2026-10-10 | 10 月 10 日 · 10:00–16:00 | [官方页面](https://www.downtownnovato.com/events) |
| palo-alto-scare-faire-2026 | 2026-10-10 | 10 月 10 日 · 13:00–15:00 | [官方页面](https://transitionpaloalto.org/2026/08/18/sunday-october-10-2026-1-3pm-scare-faire-and-costume-swap/) |
| sonoma-harvest-fair-gala-2026 | 2026-10-10 | 10 月 10 日 · 入场时刻见官方门票 | [官方页面](https://harvestfair.org/) |
| sf-ybg-dance-day-2026 | 2026-10-11 | 10 月 11 日 · 10:00–16:00 | [官方页面](https://ybgfestival.org/event/ybg-dance-day-2026/) |
| sf-indigenous-peoples-day-2026 | 2026-10-12 | 10 月 12 日 · 12:00–16:00 | [官方页面](https://ybgfestival.org/event/sf-indigenous-peoples-day-2026/) |
| piedmont-wonka-outdoor-movie-2026 | 2026-10-16 | 10 月 16 日 · 约 18:40、日落后放映 | [官方页面](https://piedmont.ca.gov/cms/One.aspx?pageId=21392954&portalId=13659823) |
| berkeley-harvest-festival-2026 | 2026-10-17 | 10 月 17 日 · 11:00–16:00 | [官方页面](https://berkeleyca.gov/community-recreation/events/harvest-festival-1) |
| sf-bay-area-science-festival-2026 | 2026-10-17 | 10 月 17 日 · 11:00–16:00 | [官方页面](https://bayareasciencefestival.org/) |
| cupertino-hidden-treasures-2026 | 2026-10-22 | 10 月 22 日 · 09:00–14:00 | [官方页面](https://www.cupertino.gov/Parks-Recreation/Events/Hidden-Treasures/Hidden-Treasures-Event) |
| calistoga-eleanor-alberga-2026 | 2026-10-23 | 10 月 23 日 · 19:30 开演 | [官方页面](https://www.brannancenter.org/events/eleanor-alberga-the-green-room-ensemble) |
| fremont-trick-or-treat-2026 | 2026-10-23 | 10 月 23 日 · 17:00–21:00 | [官方页面](https://www.fremont.gov/government/departments/parks-recreation/events/trick-or-treat-event) |
| sf-family-connections-halloween-2026 | 2026-10-23 | 10 月 23 日 · 16:30–18:00 | [官方页面](https://fccenters.org/event/halloween-2026/) |
| cupertino-monster-mash-2026 | 2026-10-24 | 10 月 24 日 · 17:00–20:00 | [官方页面](https://www.cupertino.gov/Parks-Recreation/Events/Monster-Mash/Monster-Mash-Event) |
| foster-city-halloween-festival-2026 | 2026-10-24 | 10 月 24 日 · 11:00–14:00，讨糖至 13:00 | [官方页面](https://www.fostercity.org/1248/2026-Halloween-Festival) |
| menlo-park-halloween-hoopla-2026 | 2026-10-24 | 10 月 24 日 · 11:00–14:00 | [官方页面](https://www.menlopark.gov/Citywide-calendar/Community-events/20261024-Halloween-Hoopla-Parade-and-Carnival) |
| petaluma-witches-wizards-water-2026 | 2026-10-24 | 10 月 24 日 · 11:00–14:00 | [官方页面](https://www.thefloathousepetaluma.org/events/witches-wizards-on-the-water-2026) |
| santa-rosa-halloween-howarth-2026 | 2026-10-24 | 10 月 24 日 · 11:30–14:30 分时签到 | [官方页面](https://www.srcity.org/2164/Halloween-at-Howarth) |
| windsor-trick-or-treat-trail-2026 | 2026-10-24 | 10 月 24 日 · 12:00–16:00，按预约入场 | [官方页面](https://www.townofwindsor.com/trickortreat) |
| oakland-omca-dia-muertos-2026 | 2026-10-25 | 10 月 25 日 · 11:00–16:00 | [官方页面](https://museumca.org/press/omca-announces-public-programs-and-events-for-october-2026/) |
| menlo-park-trunk-or-treat-2026 | 2026-10-28 | 10 月 28 日 · 16:30–18:00 | [官方页面](https://www.menlopark.gov/Citywide-calendar/Community-events/20261028-Trunk-or-Treat) |
| sunnyvale-spooky-storywalk-2026 | 2026-10-28 | 10 月 28 日 · 16:00–18:00 | [官方页面](https://www.library.sunnyvale.ca.gov/Home/Components/Calendar/Event/12565/74?curm=10&cury=2026) |
| benicia-farmers-market-final-2026 | 2026-10-29 | 10 月 29 日 · 16:00–19:00 | [官方页面](https://www.beniciamainstreet.org/event-details/benicia-certified-farmers-market-2) |
| napa-harvest-after-dark-2026 | 2026-10-30 | 10 月 30 日 · 18:00–21:00 | [官方页面](https://www.theduckhorncollection.com/blogs/events/harvest-after-dark-a-halloween-masquerade-dinner) |
| oakland-omca-friday-finale-2026 | 2026-10-30 | 10 月 30 日 · 17:00–21:00 | [官方页面](https://museumca.org/event/friday-nights-at-omca-with-la-gente-sf/) |
| san-jose-avenida-altares-2026 | 2026-10-31 | 10 月 31 日 · 17:30–22:30 | [官方页面](https://mhplaza.org/allevents/avenida26) |
| sf-halloween-hoopla-2026 | 2026-10-31 | 10 月 31 日 · 12:00–15:00 | [官方页面](https://ybgfestival.org/event/halloween-hoopla-2026/) |

## 校验

- 覆盖清单：23 条多日 + 50 条单日 = 73 条，ID 无遗漏和重复。
- 2 个 override 的 9 个日期均为有效 ISO 日期，按升序排列，无重复，均在对应原区间内。
- 24 个说明键均对应发布中的活动；既有 verifiedAt/updatedAt 不因增加日历说明而改写。
- 日历和当天地图须使用同一发生日期函数；日期字符串按本地日期处理，避免 UTC 解析在加州回退到前一天。
