# 2026 年 10–11 月旧金山／东湾活动补充：来源与口径

核验日期：2026-10-07（America/Los_Angeles）。本轮网页／公开接口实读截至 2026-10-07 09:55 UTC（02:55 PDT）。只读官方活动网页、官方公开日历和该网页使用的匿名活动详情 GET；没有登录、报名、购票、发信或修改外部系统。

交付包：`src/data/octnov-2026-sf-east-events.json`；英文：`src/data/octnov-2026-sf-east-en.json`；配套事实：`src/data/octnov-2026-sf-east-planning.json`。中央目录、语言注册、生成文件由集成方处理，本包没有修改它们。

## 数量与日期

- 15 个新增活动／系列：SF 8、East Bay 7；无旧 ID 更新。与当时的 `MONTHLY_EVENTS` 和已合入的 `november-refresh-east-sf-events.json` 逐项查重，ID 与官方 URL 均无冲突；同时按标题、场馆和项目语义查重。
- 46 个活动日期（event × Pacific calendar date）；14 个活动至少有一个日期在 11/16–11/30。系列依活动身份合并，不把每个日期创建为新的活动 ID。
- 每条都有显式 `occurrenceDates`，`startDate`、`endDate` 仅是该数组边界。Arion 一天两场、Fort Point 一天三场，日历各只计一天；具体时段写在 `dateLabel` 和计划里。
- 本次重点补 11 月目录。常设系列只列本包核验的 11 月场次；没有把 2025 年或“往年通常”推算成 2026 年，亦未推算 12 月。
- 英文 123 个字典键，覆盖数据中所有 132 处含汉字字符串（重复字符串复用键）；繁体继续使用现有转换链，未加入第三套不一致日期。
- `cost: free` 指活动／入场本身免费，另收停车费、购买商品明确写出；Ardenwood 两天收费不同使用 `mixed`。预约要求不从“免费”推断。
- Planning 独立包逐条保留固定场次、开放窗口、预约、已公布的最低年龄；Fort Point 的三场各15分钟，Arion的两场分别建session，但不增加活动日期数。市集使用开放窗口而不强制统一起步时间。Crab Cove明确 `minAge: 6`／`reservation: required`；瑜伽与Arion须预订；未说明报名方式的Presidio短讲／步行用 `unknown`。Redwood官方全年龄不等于幼儿适合，未填一个虚构最低年龄，保留山路难度文字。Ardenwood入场费随日期改变，而现有模型没有按日期价格字段，故 `admissionUsd: null`，费用说明仍完整；不把免费日误扩至收费日。室内外位置证据不足的手作／厨房／Fort Point不猜setting。

## 逐条证据

### nov2026-foodwise-market-memories-demo

[Foodwise 活动页](https://foodwise.org/events/ann-m-evans-and-georgeanne-brennan-market-memories-cookbook/)明确 2026-11-21 11:00–11:45，地点为 Ferry Building 前绿色帐篷 Foodwise Classroom；烹饪示范、食谱、试吃免费，随后签书，书另售。核验了日期、地点、收费和项目内容，没有声称已预留座位。
图片：`verified-ferry-building`，Ferry Building 外市集 2022 年资料实拍；对应同一前广场环境，不称为本次示范现场。

### nov2026-arion-press-public-tours

[11/12 场次](https://fortmason.org/event/arion-press-public-tours-2026/2026-11-12/1/)与[11/21 场次](https://fortmason.org/event/arion-press-public-tours-2026/2026-11-21/1/)明确列出 2026 年日期。11/12 为 15:00、17:30；11/21 为 13:00、15:00；每张票 $15，官方页提供购票链接。地点是 Fort Mason **Building B 一楼**。正文称导览约 45 分钟，票面窗口为一小时，数据保留这个区别。未将笼统“第二个周四”套用到 10 月；本包只收录两天。
图片暂为 `november-community` 明示主题插画；交给媒体补充任务选择 Fort Mason 园区实拍或 Arion 本馆来源。Festival Pavilion 外观不能称为 B 栋。

### nov2026-sf-renegade-craft-winter

[Renegade 主办方页](https://www.renegadecraft.com/event/san-francisco-winter/)实读 2026-11-14、15，均 11:00–17:00；Fort Mason Festival Pavilion，250+ 创作者；建议自愿 $5 支持，不写成强制票价；商品／食物另付。室内为主、风雨照常；官网另列周日 Marina Boulevard 6:30–11:30 封路提醒。未依据第三方活动汇总站定价。
图片暂为 `november-community`；下文 Commons Festival Pavilion 候选可替换。

### nov2026-fort-mason-farmers-market

[2026 年 11 月官方日历](https://fortmason.org/events/month/2026-11/)逐项列出 11/1、8、15、22、29；[11/29 场次页](https://fortmason.org/event/sunday-farmers-market/2026-11-29/)明确 9:30–13:30、免费入场、风雨照常、园区停车场（2 Marina Boulevard），50+ 农场与食品商。免费不包括购物与停车；未把所有餐饮标为免费。
图片暂为 `november-community`；下文 Fort Mason 园区总景候选须明确是园区环境，不是市集当天摊位。

### nov2026-presidio-free-yoga

[官方 11/22 页](https://presidio.gov/explore/events/free-yoga-in-the-park/2026-11-22/)及[2026 年 11 月日历](https://wp.presidio.gov/events/month/2026-11/)确认 11/1、8、15、22，10:00–11:00。Outpost Meadow，609 Mason Street；课程免费但须预约，限 50 人，提前 15 分钟签到，自备垫子。雨天可能转至 Sports Basement Community Room，已预约者会收到通知。官网明确本轮至 11/22，故**不增加 11/29**。
图片：`presidio`，Tunnel Tops 2023 年资料实拍；园区环境图，不表示瑜伽课或具体垫子布置。

### nov2026-presidio-250-years-walk

[官方 11/22 页](https://presidio.gov/explore/events/presidio-guided-walk-250-years-on-the-presidio/2026-11-22/)与[2026 年 11 月日历](https://wp.presidio.gov/events/month/2026-11/)确认 11/8、22，11:00–12:00。从 210 Lincoln Boulevard 的游客中心出发，经过 Tunnel Tops 与 Main Post，平坦半英里，全年龄，免费；周边停车另付。数据不将通用周日模式扩成五个日期。
图片：`presidio`，路线实际经过 Tunnel Tops，2023 年资料图，非当天导览或游客中心正门。

### nov2026-fort-point-history-talks

[官方 11/29 页](https://presidio.gov/explore/events/fort-point-history-2-2/2026-11-29/)和[11 月日历](https://wp.presidio.gov/events/month/2026-11/)明确晚月两组周五至周日 11/20–22、27–29。201 Marine Drive；每日 11:30、13:30、14:30，每次 **15 分钟**，免费、无需登记、项目可无障碍参加。页面日期头把三个时段包成 11:30–14:45，数据没有误写成三小时连续导览。
图片：`sf-fort-point`，2023 年 Fort Point 庭院实拍，场馆真实对应。出发前仍需看 NPS 开放／取消通知。

### nov2026-presidio-campfire-history-talks

[官方 11/30 页](https://presidio.gov/explore/events/park-ranger-campfire-talks-2/2026-11-30/)及[2026 年 11 月日历](https://wp.presidio.gov/events/month/2026-11/)公开每日 15:00–15:30；本包选择 11/16–30，共 15 个日期。地点为 Tunnel Tops Campfire Circle，免费、全年龄；主题是人物与历史。没有从名称推出一定点火或烤棉花糖，也不保证节假日临时安排不变。
图片：`presidio`，同园区资料实拍，不声称画面是营火圈或当场短讲。

### nov2026-redwood-green-friday-hike

[官方活动详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60899)，[园区官方页](https://www.ebparks.org/parks/reinhardt-redwood)与[2026 年 11 月日历](https://www.ebparks.org/calendar/month/202611?age=All&category=All&city=All&park=All&terms=)核验。2026-11-27 9:00–12:00；集合 **Trudeau Training Center**；5.25 英里起伏山路，drop-in，无需登记，大雨取消。免费活动与当日 [Green Friday](https://www.ebparks.org/we-celebrate/green-friday) 有依据；这是具体带队徒步，不重复建立通用免票优惠。
图片：`redwoods`，Reinhardt Redwood 本园 2026 年实景，不能据图判断步道实时开放。

### nov2026-redwood-saturday-stroll

[官方活动详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60894)，2026-11-28 9:30–12:00；集合 **Canyon Meadow Staging Area**；4 英里中等强度环线，半英里陡上坡后下坡，无须报名。与前一天活动不同集合点、路线、时间，故是另一活动。园区页说明停车收费季为 4–10 月，数据仍仅承诺活动免费。
图片：`redwoods`，同园实拍；不代表具体集合点。

### nov2026-tilden-good-night-farm

[11/20 官方详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60543)与[11/27 官方详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60546)，均 15:30–16:00；Little Farm 猪栏集合。全年龄、家长须参与、无需登记、免费。只喂工作人员提供的食物；项目按天气、动物与季节需要调整。
图片：`community-tilden-little-farm`，2013 年 Little Farm 实拍，场地准确；不承诺当前动物配置。

### nov2026-big-break-accessible-winter-birding

[官方活动详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60936)，2026-11-19 9:00–10:30；Big Break Visitor Center；0.5–2 英里、铺装／通常平坦、官方高度变化分档 0–500 英尺，观鸟听声与辅助望远镜设备，成人须参与，无须报名，免费。[公园页](https://www.ebparks.org/parks/big-break)确认 69 Big Break Road、停车免费。数据没有把“accessible”解读为对任何辅助需求都保证适配，建议先确认设备。
图片暂为 `november-community`；下文 Big Break 鸟实拍候选地点已核，不保证本次必能看到该物种。

### nov2026-coyote-hills-tule-work-play

[官方活动详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60474)，2026-11-21 10:00–11:30；Coyote Hills Visitor Center；湿地植物生态／材料使用与手作；全年龄、家长参与、无须报名、活动免费。[公园页](https://www.ebparks.org/parks/coyote-hills)实读停车每车 $5、8000 Patterson Ranch Road。未擅自承诺具体原住民讲者或文化表演。
图片：`verified-coyote-hills`，2005 年本园湿地实拍；不代表游客中心室内，也不表示要登图中山脊。

### nov2026-ardenwood-chestnut-treats

[11/22 官方详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60614)与[11/27 官方详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60615)，均 11:30–12:30；农场 country kitchen；烤栗子与植物／传统介绍，无须登记。活动模板写农场入场费适用，结合[农场当季收费页](https://www.ebparks.org/parks/ardenwood)（感恩节前周日仍属 historic season；周日成人 $6／62+ $5／4–17 $4／未满 4 免费）及[2026 Green Friday 专页](https://www.ebparks.org/we-celebrate/green-friday)（明确 11/27 Ardenwood 免入场）处理日期例外。收费日仅非现金付款；停车免费。
图片：`verified-ardenwood-farm`，Deane Little／EBRPD 官方本园实拍，年份未注明；不称为烤栗子或11月现场。

### nov2026-crab-cove-bay-bird-morning

[官方活动详情](https://anc.apm.activecommunities.com/ebparks/activity/search/detail/60889)，2026-11-22 8:00–10:00，Doug Siden Visitor Center at Crab Cove；6岁起、免费但须报名、有望远镜可借、大雨取消。官方报名窗口 10/6 9:00 至 11/21 16:00；未承诺还有名额。[Crown Beach 公园页](https://www.ebparks.org/parks/crown-beach)确认收费停车场每车 $5；文案区分具体停车入口与 Crab Cove 集合点。
图片：`expanded-east-bay-alameda-beach`，2010 年 Crown Beach 本园海湾实拍；不是游客中心门口，也不是本场观鸟。

## 官方动态详情的读取边界

EBRPD 旧 `/events/...` 目前把不少项目重定向到 Active Communities。web 阅读器返回不可渲染／重定向错误，没有把这些空壳视为详情核验成功；对同一公开页面使用普通匿名 GET（HTTP 200），并读取该页面脚本公布的以下只读端点，实际取到活动文字、日期和价格：

- `https://anc.apm.activecommunities.com/ebparks/rest/activity/detail/{id}`
- `https://anc.apm.activecommunities.com/ebparks/rest/activity/detail/meetingandregistrationdates/{id}`
- `https://anc.apm.activecommunities.com/ebparks/rest/activity/detail/estimateprice/{id}`

本包 ID：60899、60894、60543、60546、60936、60474、60614、60615、60889。这些是公开目录数据，不读取账号、家庭、订单或报名人数据。`estimateprice.free` 只说明项目价格，不能覆盖描述中的农场门票或停车费；收费文案同时核对主办方公园页。Presidio 个别现代页面 web 阅读器也无法解析，普通匿名 GET 得到完整正文及 2026 日期后才收录。

排除而未冒充完成：SF Symphony 票务页进入 waiting room，未绕过，也未用季刊日期填入不完整价格；Tilden “Fascinating World of Birds” 官方同页正文与 accessibility 区的距离分别 1–3 与 2–5 英里，未纳入本包。没有把旧 2025 年 EBRPD November PDF 的场次挪到 2026 年。

## 图片候选与复用边界

现有 11 条活动使用 `GUIDE_IMAGES` 已有同地点实拍与现有署名／许可；保留资料年份，不把地点图称为活动实况。余下 4 条在本包写入时使用 `november-community`（明确的原创主题插画），由独立媒体任务在中央 alias 集成后替换，不能把插画计入实拍率。

候选来源已实际打开并核验地点、作者、拍摄日期和许可；**尚未在本包下载、裁剪、注册或称为已上线**：

| 用途 | 候选与已核信息 | 使用限制 |
| --- | --- | --- |
| Renegade／Festival Pavilion | [Festival Pavilion — DSC02365](https://commons.wikimedia.org/wiki/File:Festival_Pavilion_-_Fort_Mason_Center_-_San_Francisco,_CA_-_DSC02365.jpg)，Daderot，2017-12-08，CC0 1.0 | 真实建筑外观；非2026市集现场，不能充当Arion B栋 |
| Fort Mason 市集／Arion 的园区环境 | [SF FtMason 20150918](https://commons.wikimedia.org/wiki/File:SF_FtMason_20150918.jpg)，Niranjan Arminius，2015-09-18，CC BY-SA 4.0 | 图为园区pavilion与码头总景；caption必须说明不是活动现场或B栋室内 |
| Big Break 观鸟地点图（优先） | [USGS: SF Bay-Delta at Big Break Visitor Center, Oakley, CA](https://www.usgs.gov/media/images/sf-bay-delta-big-break-visitor-center-oakley-ca)，Steve Ackley，约2018年5月，页面明确 Public Domain | 同地点环境实拍；日期只精确到约月份，不称为本次观鸟或保证鸟种出现；由媒体任务下载并核对画面 |
| Big Break 旧候选（不推荐接入） | [Say's Phoebe (24691191368)](https://commons.wikimedia.org/wiki/File:Say%27s_Phoebe_(24691191368).jpg)，Becky Matsubara，2017-11-19，拍于Big Break Regional Shoreline，Commons正文CC BY2.0 | 原图EXIF另含BY4.0链接，改优先使用上述授权无分歧的USGS地点图；未把本候选视为已获一致许可 |

## 完成的本地数据检查

独立只读脚本检查：15条数据可解析；ID与主目录不冲突；官方URL无重复；46个日期均处于2026-10-07至11-30窗口、无重复日期、起止与数组边界一致；所有 imageKey 在现有 GUIDE_IMAGES 存在；123个英文键覆盖所有含汉字字段，无缺译。没有运行生成器、全量测试、提交、推送或发布。中央集成后仍应走项目已有内容与本地化检查。

独立 planning 配套覆盖全部15个ID、46个日期与53个明确固定场次；市集开市时间只记为开放窗口，不充当固定场次。每个场次落在对应日期窗口内。Crab Cove 的6岁下限与报名要求、Arion/Yoga 预约，以及各场费用边界均保留；Ardenwood 因不同日期的农场入园费不同，未强填统一 admissionUsd。规划说明复用本包已有英文键，没有新增未翻译中文。
