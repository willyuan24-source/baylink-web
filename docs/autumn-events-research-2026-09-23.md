# 湾区活动补充与复核记录 · 2026-09-23

基准日：2026-09-23（America/Los_Angeles），内容范围至 2026-10-31。

## 变更范围

- 新增 20 条有明确 2026 日期的活动：旧金山 5、东湾 3、南湾 5、半岛 4、北湾 3。
- 更新 4 条现有活动：修正 HSB 日程已上线、Bay Area Musical Improv 演出票已开售/部分工作坊已满两处过时状态；补齐 Fremont 讨糖票价与年龄/预约条件、Family Connections 儿童成人陪同条件。此四条 verifiedAt 更新为 9/23。
- 新增文件：src/data/autumn-refresh-events.ts（refreshedAutumnEvents）、src/data/autumn-refresh-events-en.json（全部新增中文字段与修订句的英文映射）。
- 新增卡片初始 imageKey 全部留空，集成可配通用插图，不借其他活动实景/海报。未提交、未部署。
- 原有 55 条活动逐条进行静态日期审计：10 条 endDate 在 9/23 之前，由主代理从发布集合过滤；历史源记录保留。
- 剩余 45 条均已联网复核核心日期，最初重点 15 条后追加其余 30 条。核验深度逐项写在下表：票务动态页面、实时名额、部分旧详情未完全重核，不等同于所有字段都获 9/23 新证据。41 条未修改卡片保留原 verifiedAt（9/8、9/11 或 9/15），不是把它们说成仅做了静态检查。
- Palo Alto Players 的完整演期至 11/15；本条只选 10/30–31 两个开演夜，卡片与 startDate/endDate 均明确限定十月。

## 新增活动官方来源

| ID | 2026 日期 | 地区 | 官方来源 | 费用及参加边界 |
| --- | --- | --- | --- | --- |
| cupertino-fall-bike-fest-2026 | 2026-09-26 | south-bay | [City of Cupertino](https://www.cupertino.gov/Events-directory/Bike-Fest-2026) | 免费参加 · 餐饮另付 |
| redwood-city-portfest-2026 | 2026-10-03 | peninsula | [Port of Redwood City](https://www.redwoodcityport.com/portfest2026) | 免费社区节庆 · 餐饮购物另付，研究船参观需预约 |
| sf-african-arts-festival-2026 | 2026-10-03 | sf | [Yerba Buena Gardens Festival / Duniya Dance and Drum Company](https://ybgfestival.org/event/african-arts-festival-2026/) | 免费入场 · 官网有 RSVP，食品和商品另付 |
| sf-quinteto-latino-lunchtime-2026 | 2026-10-08 | sf | [Yerba Buena Gardens Festival](https://ybgfestival.org/event/quinteto-latino-2026/) | 免费户外演出 |
| marinwood-halloween-harvest-2026 | 2026-10-09 | north-bay | [Marinwood Community Services District](https://www.marinwood.org/event/halloween-harvest-festival) | 儿童 $25 · 成人免费 · 兄弟姐妹优惠 $5 |
| cupertino-pooch-plunge-2026 | 2026-10-10 | south-bay | [City of Cupertino](https://www.cupertino.gov/Parks-Recreation/Events/Pooch-Plunge) | 每只狗单独付费报名 · 按居民资格核对当前票价 |
| palo-alto-scare-faire-2026 | 2026-10-10 | peninsula | [Transition Palo Alto / Museum of American Heritage](https://transitionpaloalto.org/2026/08/18/sunday-october-10-2026-1-3pm-scare-faire-and-costume-swap/) | 免费 · 欢迎自愿捐款 |
| sf-ybg-dance-day-2026 | 2026-10-11 | sf | [Yerba Buena Gardens Festival / Rhythm & Motion](https://ybgfestival.org/event/ybg-dance-day-2026/) | 免费参加 · 官网提供 RSVP |
| sf-indigenous-peoples-day-2026 | 2026-10-12 | sf | [Yerba Buena Gardens Festival](https://ybgfestival.org/event/sf-indigenous-peoples-day-2026/) | 免费活动 · 官网有 RSVP，摊位消费另付 |
| walnut-creek-diablo-improv-2026 | 2026-10-16 — 2026-10-18 | east-bay | [Diablo Improv Festival / Lesher Center for the Arts](https://diabloimprovfestival.org/) | 演出、工作坊及套票分别购票 |
| sf-bay-area-science-festival-2026 | 2026-10-17 | sf | [UCSF Science & Health Education Partnership](https://bayareasciencefestival.org/) | 免费科学节 · 具体参观项目按官方安排 |
| cupertino-hidden-treasures-2026 | 2026-10-22 | south-bay | [City of Cupertino](https://www.cupertino.gov/Parks-Recreation/Events/Hidden-Treasures/Hidden-Treasures-Event) | 免费入场 · 商品另购 |
| calistoga-eleanor-alberga-2026 | 2026-10-23 | north-bay | [Brannan Center / Festival Napa Valley](https://www.brannancenter.org/events/eleanor-alberga-the-green-room-ensemble) | 自选票价，$5 起 · 需购票 |
| cupertino-monster-mash-2026 | 2026-10-24 | south-bay | [City of Cupertino](https://www.cupertino.gov/Parks-Recreation/Events/Monster-Mash/Monster-Mash-Event) | 10 月 19 日前居民 $17／非居民 $21 · 每份含一名儿童及两位成人 |
| foster-city-halloween-festival-2026 | 2026-10-24 | peninsula | [City of Foster City](https://www.fostercity.org/1248/2026-Halloween-Festival) | 儿童居民 $10／非居民 $12 · 成人 $5／$7，须预登记 |
| oakland-omca-dia-muertos-2026 | 2026-10-25 | east-bay | [Oakland Museum of California](https://museumca.org/press/omca-announces-public-programs-and-events-for-october-2026/) | 活动及展厅通票 $10 · 会员免费，需按官方票种预约 |
| sunnyvale-spooky-storywalk-2026 | 2026-10-28 | south-bay | [Sunnyvale Public Library](https://www.library.sunnyvale.ca.gov/Home/Components/Calendar/Event/12565/74?curm=10&cury=2026) | 免费图书馆活动 · 无需报名，材料有限 |
| napa-harvest-after-dark-2026 | 2026-10-30 | north-bay | [The Duckhorn Collection](https://www.theduckhorncollection.com/blogs/events/harvest-after-dark-a-halloween-masquerade-dinner) | 普通票 $175 加税 · 会员票 $150 加税，限会员权益范围 |
| oakland-omca-friday-finale-2026 | 2026-10-30 | east-bay | [Oakland Museum of California](https://museumca.org/event/friday-nights-at-omca-with-la-gente-sf/) | 户外音乐免费 · 展厅门票、餐饮和停车另付 |
| palo-alto-addams-family-opening-2026 | 2026-10-30 — 2026-10-31 | peninsula | [Palo Alto Players](https://paplayers.org/show/the-addams-family/) | 按场次购票 · 10 月 30 日预演为自选票价夜 |

## 重要核验细节

- PortFest：港务局独立 2026 页明确 10/3 10:30–15:30、475 Seaport Court、免费；研究船另按时段预约。
- YBG：使用当前[十月月历](https://ybgfestival.org/events/month/2026-10/)及各独立页。African Arts 为 11–16 时，不沿用四月新闻稿 14 时；不填入相互冲突的“第几届”。Quinteto Latino 的座席规则由[午间系列说明](https://ybgfestival.org/thursday-lunchtime/)支持。Indigenous Peoples Day 核心日期、时刻、免费 RSVP 与表演者由当前月历支持。
- Cupertino Pooch Plunge：[主页面](https://www.cupertino.gov/Parks-Recreation/Events/Pooch-Plunge)为非居民 $13，但[事件页](https://www.cupertino.gov/Parks-Recreation/Events/Pooch-Plunge/Pooch-Plunge-Event)仍写 $12。两者均确认 10/10 及四个 45 分钟场次；不选择性使用较低价格，卡片要求按报名页当前价购买。
- Cupertino Monster Mash：市府明确 10/19 前 $17/$21、后 $22/$26；10/19 当天没有单独明确定义，不编造该日适用价。每份含一名 2+ 儿童及两位成人，户外雨天照常。
- Hidden Treasures：独立事件页明确免费；[主页面](https://www.cupertino.gov/Parks-Recreation/Events/Hidden-Treasures)确认 2026 捐赠截止为 10/2，不把购物也写成免费。
- Foster City：此前 9/15 未明确费用，本轮官方已新增儿童 $10/$12、成人 $5/$7，9/28 才开放登记，10/24 11–14 时；讨糖只到 13 时且每孩一次。未声称现在已可报名。
- Scare Faire：主办方 URL 仍含 sunday，但正文标题已改为 Saturday；[场地方](https://www.moah.org/moahevents/scare-faire)也确认 10/10 周六 13–15 时。官方明确免费、自愿捐款。
- Sunnyvale：独立[StoryWalk 页面](https://www.library.sunnyvale.ca.gov/Home/Components/Calendar/Event/12565/74?curm=10&cury=2026)确认 10/28 16–18 时、Columbia Park、无须报名及材料有限；近期[市图书馆项目说明](https://www.library.sunnyvale.ca.gov/Home/Components/Calendar/Event/12401/74?curm=9&cury=2026)明确全馆项目免费。没有把 2025 的书名或项目内容套到 2026。
- OMCA：亡灵节费用是 $10 含节庆与展厅，会员使用免费会员票；10/30 周五夜的免费范围是户外演出，Gallery Chats 随展厅门票，餐饮停车另付。只精选 10/30，不把整个十月的五个周五错误表示成每日活动。
- Diablo Improv：官网首页同时残留 2025 区块，取顶部 2026 10/16–18 日期，并与场地方[10/18 Open Jam](https://www.lesherartscenter.org/Home/Components/Calendar/Event/21341/4124)及[10/17 演出](https://www.lesherartscenter.org/Home/Components/Calendar/Event/21333/4124)交叉核对。$35 只对应 Open Jam。
- Calistoga：采用[场地方](https://www.brannancenter.org/events/eleanor-alberga-the-green-room-ensemble)明确的 10/23 19:30 与 Choose Your Price $5 起；不沿用第三方估计的 20:30 结束时间。
- Duckhorn：仅限 21+、含税前普通 $175/会员 $150（每份会员最多四票）、不退款、不允许宠物；未自动购票或查询实时余票。

## 现有未结束活动复核清单

verifiedAt 是实际保留在数据中的日期；只有本轮更新正文的 HSB、BAMIF、Fremont Trick-or-Treat、Family Connections 四条更新为 9/23。其余保留原日期；本轮联网复核的覆盖与限制按下表记录。

| ID | 数据核验日期 | 本轮覆盖范围 | 来源 |
| --- | --- | --- | --- |
| petaluma-pumpkin-patch-2026 | 2026-09-15 | 复核 2026 时间/价格页：Halloween 最后一天、日–周四至 19 时、周五六至 22 时、基础免费与迷宫另付。开幕日期沿用 9/15 首页核验。 | [官方入口](https://petalumapumpkinpatch.com/pricing-hours/) |
| redwood-oktoberfest-closing-weekend-2026 | 2026-09-11 | 复核官方索引的 9/25–27 逐场时刻和 Festival 票价；完整正文 open 被 403 拒绝，官方日历交叉支持。 | [官方入口](https://www.redwoodcity.org/residents/redwood-city-events/oktoberfest) |
| pacific-coast-fog-fest-2026 | 2026-09-11 | 复核 9/26–27、10–18 时、Palmetto Avenue、免费；周六 10 时巡游。 | [官方入口](https://pacificcoastfogfest.com/) |
| portola-2026 | 2026-09-08 | 复核 9/26–27、Pier 80、21+、实体证件、无重入及停车；未查实时票库存。 | [官方入口](https://www.portolamusicfestival.com/general-info/) |
| presidio-chuseok-festival-2026 | 2026-09-11 | 复核 9/26、11–16 时、Main Parade Lawn、全年龄免费及交通入口。 | [官方入口](https://presidio.gov/explore/events/chuseok-festival-2026) |
| sonoma-farm-trails-fall-tour-2026 | 2026-09-11 | 复核 9/26–27、免费强制登记及单独农场的收费/预约边界。 | [官方入口](https://www.farmtrails.org/experience/weekend-along-the-farm-trails/) |
| novato-youth-folk-dance-2026 | 2026-09-15 | 复核 9/27、11:30 开始、1110 Highland Drive、免费及餐饮另售。 | [官方入口](https://www.minoans.com/youth-festival) |
| petaluma-fall-antique-faire-2026 | 2026-09-11 | 官方索引确认 9/27、8–16 时、免费及雨天照常；直接 open 曾 502。 | [官方入口](https://petalumadowntown.com/antique-show) |
| mill-valley-film-festival-2026 | 2026-09-15 | 官方 press 页复核第 49 届 10/1–11、Marin 三处影院及 Berkeley BAMPFA；未逐场核票价/余票。 | [官方入口](https://www.mvff.com/press-info/) |
| santa-rosa-pumpkins-parks-2026 | 2026-09-15 | 市历复核 10/1–30、免费、日出至日落、10/23 前重新藏石及 10/30 兑奖截止；限定奖品不保证领取。 | [官方入口](https://www.srcity.org/Calendar.aspx?EID=2289&calType=0&day=23&month=10&year=2026) |
| fremont-finding-nemo-outdoor-movie-2026 | 2026-09-15 | 市府官方索引及 7/24、9/11 新闻稿交叉复核 10/2、18–22 时、日落放映、Central Park、字幕、免费、自带食物及无餐车；直接 open 403。 | [官方入口](https://www.fremont.gov/government/departments/parks-recreation/events/movies-under-the-stars) |
| hardly-strictly-bluegrass-2026 | 2026-09-23 | 复核 10/2–4、免费、入口与结束时刻、携物及交通；修正日程已上线。 | [官方入口](https://hardlystrictlybluegrass.com/info-faq-2026/) |
| rio-vista-bass-derby-2026 | 2026-09-15 | 活动页复核 10/2–4 与周六 9–15 时车展；2026 公告确认不含商会烟花，buy 页确认成人 $55/儿童 $10；未查报名库存。 | [官方入口](https://www.bassfestival.com/bass-festival) |
| clayton-oktoberfest-2026 | 2026-09-15 | 复核 10/3 11–20 时、10/4 11–18 时、免费入场、酒票仅现场及 Diablo View 免费停车接驳；嘉年华独立细则仍须另查。 | [官方入口](https://claytonoktoberfest.com/info/) |
| oakland-oaktoberfest-2026 | 2026-09-15 | 复核 10/3 11–19 时、10/4 10–17 时、Fruitvale/MacArthur、全年龄免费；饮品套餐单独收费，未核当前套餐金额。 | [官方入口](https://www.oaktoberfest.org/) |
| sunnyvale-diwali-2026 | 2026-09-15 | 主办方复核 10/3 11:30–19:30、230 S. Murphy、全员免费基础入场；不把餐饮和摊位体验当免费。 | [官方入口](https://www.sacas.org/) |
| tiburon-wine-festival-2026 | 2026-09-15 | 复核 10/3 13–16 时、21+照片证件、禁止婴儿/推车/动物、风雨照常及不退款；未查实时票价、余票或当日渡轮。 | [官方入口](https://www.tiburonchamber.org/tiburon-wine-festival/) |
| vacaville-learn-your-colors-run-2026 | 2026-09-15 | 复核 10/3 9–12 时、Will C. Wood、1 英里/5K 不计时及 6 岁以下免费；其余价格仍留市府报名页核价，未用赞助礼包 $35 倒推票价。 | [官方入口](https://color-run.vacavillekiwanis.org/) |
| litquake-out-loud-2026 | 2026-09-15 | YBG 当前月历及独立页确认 10/4、11–16 时；原 Litquake 报名规则保留 9/15 记录。 | [官方入口](https://www.litquake.org/events-1/litquake-out-loud-1) |
| little-italy-san-jose-festival-2026 | 2026-09-15 | 复核 10/4、11–19 时及免费现场演出；本轮不逐项重核餐饮价格。 | [官方入口](https://www.littleitalysj.com/little-italy-san-jose-festival) |
| san-francisco-fleet-week-2026 | 2026-09-15 | 复核总日期 10/4–12 和 10/10–11 Fleet Fest 免费；不声称全周每日都有飞行。 | [官方入口](https://fleetweeksf.org/) |
| silicon-valley-african-film-festival-2026 | 2026-09-15 | 主办方仍确认 10/8–11、Historic Hoover Theater；不补写未核验票价。 | [官方入口](https://svaff.org/programs/annual-film-festival) |
| burlingame-mandarin-storytime-2026 | 2026-09-15 | 市图书馆最新正文复核 10/10 11 时、Children’s Room、中英双语、0–6 岁及照顾者；无随行儿童的成人不得入场。 | [官方入口](https://burlingame.org/356/Events) |
| napa-musictime-halloween-2026 | 2026-09-15 | 活动页复核 10/10 10:30、580 Coombs Street、免费及所有儿童须成人陪同；未擅加结束时刻。 | [官方入口](https://www.festivalnapavalley.org/calendar/musictime-napa-jay-benson-jesse-micek/) |
| novato-nostalgia-days-2026 | 2026-09-15 | Downtown Novato 复核 10/10 10–16 时、Grant Avenue 经典车展与音乐；不把未列明的前夜巡游加进本条。 | [官方入口](https://www.downtownnovato.com/events) |
| san-carlos-art-wine-faire-2026 | 2026-09-15 | 官方合作方复核 10/10–11 每日 10–18 时、Laurel/San Carlos Avenue、亲子区及 310 Industrial Road 免费停车接驳；餐饮酒饮购物另付。 | [官方入口](https://pacificfinearts.com/festival/san-carlos-art-wine-faire/) |
| sonoma-harvest-fair-gala-2026 | 2026-09-15 | 主办方首页复核 10/10 Awards Gala；Etix 链接只返回 JavaScript 占位，未确认票价、年龄、时刻及余票，卡片继续要求官方购票页核对。 | [官方入口](https://harvestfair.org/) |
| oakland-autumn-lights-festival-2026 | 2026-09-15 | 花园官网复核 10/15–17、付费募款性质及 Get Tickets 入口；票务抓取失败，夜场时刻、票价/余票不宣称已核；2025 装置图仍为回顾。 | [官方入口](https://gardensatlakemerritt.org/autumn-lights-festival-2026/) |
| piedmont-wonka-outdoor-movie-2026 | 2026-09-15 | 市府复核 10/16 18:40（日落）、Piedmont Park 主草坪、免费、全年龄及毯子/低椅规则。 | [官方入口](https://piedmont.ca.gov/cms/One.aspx?pageId=21392954&portalId=13659823) |
| berkeley-harvest-festival-2026 | 2026-09-15 | 市府复核 10/17 11–16 时、Cedar Rose、免费、自行车寄存/交通、餐车另付；比赛 9–11:30 送件/12 时评审，志愿者需预登记。 | [官方入口](https://berkeleyca.gov/community-recreation/events/harvest-festival-1) |
| campbell-oktoberfest-2026 | 2026-09-15 | 主办方复核 10/17 10–18 时、10/18 10–17 时及全年龄免费；饮品、杯具、Kinderplatz 与比赛票分开，未查实时售价。 | [官方入口](https://campbelloktoberfest.com/) |
| half-moon-bay-pumpkin-festival-2026 | 2026-09-15 | 主站复核 10/17–18 9–17 时及另场 10/12 称重；FAQ 免费说明仍附 2025 旧日期，卡片已提示旧详情边界，未把旧节目当 2026。 | [官方入口](https://www.hmbpumpkinfest.com/) |
| bay-area-musical-improv-festival-2026 | 2026-09-23 | 主站/Shows/Workshops 复核 10/22–25、All Out Comedy、九场演出；修正演出票已经开售及部分工作坊售罄，未保证任意场次仍有票。 | [官方入口](https://bayareamusicalimprov.com/festival) |
| san-jose-short-film-festival-2026 | 2026-09-15 | 主办方首页仍确认第 18 届 10/22–25；首页旧新闻中的 10/17 不当今年日期。 | [官方入口](https://sjsff.com/tickets/) |
| emeryville-art-exhibition-closing-2026 | 2026-09-15 | 主办方复核完整展期 10/3–25、周三至周日 11–18 时、5905 Shellmound、免费；本卡仍只精选闭幕三日 10/23–25。 | [官方入口](https://www.emeryarts.org/) |
| fremont-trick-or-treat-2026 | 2026-09-23 | 市府 9/11 新闻稿及日历交叉复核 10/23 17–21 时；补 $15、2–10 岁、成人陪同、30 分钟、20 站/10 游戏、9/21 9 时起仅预售；直接 open 403，未查余票。 | [官方入口](https://www.fremont.gov/government/departments/parks-recreation/events/trick-or-treat-event) |
| sf-family-connections-halloween-2026 | 2026-09-23 | 机构独立页复核 10/23 16:30–18 时、Portola 2565 San Bruno、免费及官方报名入口；补全儿童须成人陪同，不保证报名名额。 | [官方入口](https://fccenters.org/event/halloween-2026/) |
| menlo-park-halloween-hoopla-2026 | 2026-09-15 | 市府复核 10/24 11–14 时、10:45 Parking Lot #1 集合、Santa Cruz Avenue 至 Fremont Park、宠物牵绳及免费；不混淆次日收费 Pumpkin Splash。 | [官方入口](https://www.menlopark.gov/Citywide-calendar/Community-events/20261024-Halloween-Hoopla-Parade-and-Carnival) |
| petaluma-witches-wizards-water-2026 | 2026-09-15 | 活动页复核 10/24 11–14 时、免费自备船板/租赁另付；Contact 页再次确认 Turning Basin 的 Weller/River Plaza 坡道，未沿用日历旧 50 Water Street。 | [官方入口](https://www.thefloathousepetaluma.org/events/witches-wizards-on-the-water-2026) |
| santa-rosa-halloween-howarth-2026 | 2026-09-15 | 市府复核 10/24 分时签到、12 岁以下、基础 $7/豪华 $25、两名成人随乘范围及额外收费、7/30 开售；未查余票。 | [官方入口](https://www.srcity.org/2164/Halloween-at-Howarth) |
| windsor-trick-or-treat-trail-2026 | 2026-09-15 | 市府复核 10/24 12–16 时、Keiser Park、12 岁以下、免费需预约、9/15/16 居民/非居民开放及儿童账户 waiver；未确认当前名额。 | [官方入口](https://www.townofwindsor.com/trickortreat) |
| menlo-park-trunk-or-treat-2026 | 2026-09-15 | 市府独立页索引及 Hoopla 页面交叉复核 10/28 16:30–18 时、100 Terminal、免费及提供糖袋；直接 open 失败，不沿用旧日期。 | [官方入口](https://www.menlopark.gov/Citywide-calendar/Community-events/20261028-Trunk-or-Treat) |
| benicia-farmers-market-final-2026 | 2026-09-15 | 主办方复核 2026 季至 10/29；正文 New Fall Hours 明确周四 16–19 时，优先于日历横幅残留的 20 时；未查各摊位付款方式。 | [官方入口](https://www.beniciamainstreet.org/event-details/benicia-certified-farmers-market-2) |
| san-jose-avenida-altares-2026 | 2026-09-15 | 机构页复核 10/31 17:30–22:30、1700 Alum Rock、免费标签、主要户外及第十届；表演阵容仍待公布。 | [官方入口](https://mhplaza.org/allevents/avenida26) |
| sf-halloween-hoopla-2026 | 2026-09-15 | YBG 当前首页及十月月历确认 10/31、12–15 时、免费 RSVP 与儿童定位。 | [官方入口](https://ybgfestival.org/event/halloween-hoopla-2026/) |

## 追加复核的来源与边界

- BAMIF：[演出页](https://bayareamusicalimprov.com/shows)明确已开售；[工作坊页](https://bayareamusicalimprov.com/workshops)列出部分 Sold Out，故删除旧的“10/1 开售”预告。未进入购买流程保证余票。
- Fremont：主站直接访问 403，使用官方[7/24 新闻稿](https://content.govdelivery.com/accounts/CAFREMONT/bulletins/421ce7c)、[9/11 新闻稿](https://content.govdelivery.com/accounts/CAFREMONT/bulletins/429d29d)与主站搜索索引。9/11 讨糖段误夹入一行电影地点，本文不采用该行，地点用同段头尾均一致的 Downtown Event Center；室内活动价、年龄、时间槽来自该公告。
- Rio Vista：[2026 调整公告](https://www.bassfestival.com/2026-event-press-release)再次确认无商会烟花，[票价页](https://www.bassfestival.com/buy)确认钓鱼成人 $55/儿童 $10。
- The Floathouse：[Contact 页](https://www.thefloathousepetaluma.org/contact)是现用码头坡道依据；活动页日历地址仍含旧的 50 Water Street，保留卡片已有的 Turning Basin 入口提醒。
- Harvest Gala 的 Etix 只返回动态占位；Autumn Lights 的 Eventbrite 获取失败。两者 2026 日期有主办方明确支持，仍不补未经核实的票价/入场时刻。
- 英文映射另外补全 Marinwood 年龄上限、Monster Mash 成人无需另登记、Foster City 指定工作日取腕带、Hidden Treasures 大件捐赠限制及 Addams 内容提示，避免中文条件在英语模式中丢失。

## 暂不新增

- YBG Joe Bataan（10/17）、Afro-Filipino Jazz Project（10/24）：当前月历仍未列出。Follow the Music（10/10）在首页/部分月历摘要可见，但当前 Weekend Sessions 列表及日历下半部不一致，本轮不录入。
- Sonoma State Historic Park：官方主页已列 10/1 Gallery & Sketch、10/10 Women's Suffrage、10/17 Día de los Muertos Movie Night。详情进入动态事件门户未能取得具体费用/参与信息；合作协会新条目多为海报，未把相邻 2025 正文的免费、时刻和电影名称套到 2026。商会条目头部误为 9/17、正文为 10/17，因此不用它单独定日期。
- St. Helena Harvest Festival：2026 日期与时刻已确认，未充分确认基本入场及各体验收费，暂未录入。
- Half Moon Bay Weigh-Off：10/12 与 7–14 时已确认，未充分确认观众收费规则，暂不另建条目；既有南瓜节保留。
- Everybody Eats：官方索引确认 10/10 Alameda，但独立页正文未能取得完整购票/费用信息，暂未录入。
- 没有把财政年度 2025–26 的预算文件、旧 2025 活动文章、网页抓取时间当作 2026 日期依据。

## 验证

- 新条目全部使用唯一 ID、官方 HTTPS 来源、三个具体计划、完整英文映射和 9/23 核验日期。
- 静态边界：20 条均未在 9/23 前结束，且 startDate/endDate 不晚于 10/31。
- TypeScript 初次全仓检查遇到主代理同时编辑的 HomeDiscovery.tsx 中 freshCleanup 残留引用；已向主代理报告，由集成检查最终复跑。该错误不在本代理改动文件中。
