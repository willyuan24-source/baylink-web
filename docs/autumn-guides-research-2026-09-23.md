# 2026-09-23 秋季本地攻略补充与审查

核验基准：2026-09-23，湾区当地日期；规划范围：2026-10-01 至 2026-10-31。只修改新攻略、独立英译字典和本记录；目录集成、旧文删除及页面更新由主任务处理。

## 新增内容

新增 `src/data/guides-autumn-refresh.ts`，导出 `autumnRefreshGuides: Guide[]`，共 11 篇。`src/data/autumn-refresh-guides-en.json` 提供 246 条中文文案的对应英译（含图片说明与交通迁移补充）。

10 篇地域攻略覆盖旧金山、San Mateo、Santa Clara、Alameda、Contra Costa、Marin、Sonoma、Napa 八个县；第 11 篇交通更新覆盖湾区跨机构出行。未声称覆盖 Solano County。路线组合、建议停留时间与观察任务均明确标注为编辑建议，不冒充官方活动。

| 攻略 slug | 地域 | 新增实际用途 |
| --- | --- | --- |
| bay-area-october-muni-clipper-payment-update-2026 | 湾区交通 | 9/1 起 MuniMobile 停售单程票；感应银行卡、同卡同设备、优惠卡与两小时换乘 |
| sf-sunset-dunes-october-coastal-walk-2026 | San Francisco | 从 Noriega 起步的海滨短线、公共艺术与返程 |
| san-mateo-japanese-garden-october-guide-2026 | San Mateo | 日本花园周末 11 点开门；游乐场和野餐区施工关闭 |
| alviso-marina-october-birdwatching-guide-2026 | San José / Santa Clara | 县公园与国家保护区边界、观鸟短线、间歇施工关闭 |
| fremont-ardenwood-october-farm-guide-2026 | Fremont / Alameda | 周六与周日项目不同；常规历史季火车和老屋开放日 |
| richmond-rosie-free-history-october-guide-2026 | Richmond / Contra Costa | 免费室内历史中心、影片与停车；独立船舶收费另查 |
| martinez-shoreline-october-short-walk-guide-2026 | Martinez / Contra Costa | 0.95 英里短线、十月不同入口关门时间、当前蓝绿藻警报 |
| pleasanton-saturday-market-museum-guide-october-2026 | Pleasanton / Alameda | 周六市集 + 免费 Museum on Main，覆盖 10/3、10、17、24、31 |
| marin-sunday-market-october-local-guide-2026 | San Rafael / Marin | 周日市集、SMART 到达与返程采购，覆盖 10/4、11、18、25 |
| sonoma-plaza-history-october-day-guide-2026 | Sonoma | 分散历史场馆的步行组合、低额门票与跨城边界 |
| napa-bothe-october-redwood-picnic-guide-2026 | Napa | 红杉与野餐半日、车辆费和图书馆公园通行证、季节泳池边界 |

## 官方来源与核验事实

- [SFMTA MuniMobile](https://www.sfmta.com/getting-around/muni/fares/munimobile)：2026-09-01 起停止销售新单程票；2026 年 Muni-only Day Pass、cable car tickets、Visitor Passports 仍售。本文未把拟议的 2027 退场计划写成十月已发生。
- [Clipper Ways to Pay](https://www.clippercard.com/ways-to-pay)、[Getting Started](https://www.clippercard.com/ClipperWeb/new-to-clipper)、[Discounts](https://www.clippercard.com/discounts)：实体银行卡须支持 contactless；普通银行卡付成人价；青年、长者、Access、START 需对应优惠 Clipper；每人自己的卡/设备；进出站保持同一媒介。换乘写为符合条件的两小时内最高 $2.85，未写成保证全额返现。
- [SF Rec & Parks Sunset Dunes](https://www.sfrecpark.org/1555/Sunset-Dunes)：Lincoln Way 至 Sloat 两英里公园、公共艺术与 Noriega 临时卫生间。没有把新游乐设施预告写成已确认开放，也没有编造十月课程表。
- [San Mateo Central Park / Japanese Garden](https://cityofsanmateo.org/3319/Central-Park-Japanese-Garden)：平日 10:00–16:00、周末 11:00–16:00；2026-05-01 更新写游乐场与野餐区施工关闭，施工估计 18–24 个月。旧设施列表仍在页面下方，因此攻略以关闭公告为准；未保证十月喂鱼。
- [County of Santa Clara Alviso Marina](https://d3.santaclaracounty.gov/alviso-marina-county-park)、[Closures and Alerts](https://parks.santaclaracounty.gov/closures-and-alerts)、[FWS Don Edwards](https://www.fws.gov/refuge/don-edwards-san-francisco-bay/visit-us)：县公园地址、8 点至日落，Mallard Slough 与 Alviso Slough 东段间歇施工关闭。未引用十多年前 PDF 推定全线畅通。
- [EBRPD Ardenwood](https://www.ebparks.org/parks/ardenwood)：周二至周日 10:00–16:00，周一例外规则；十月历史季常规周四、周五、周日有火车/老屋，周六没有；停车免费、入口现金不收、特别活动费用可能不同。未承诺具体未核对的十月 Harvest Festival 日期。
- [NPS Rosie Hours](https://www.nps.gov/rori/planyourvisit/hours.htm)、[Things to Do](https://www.nps.gov/rori/planyourvisit/things2do.htm)：每日 10:00–17:00、游客中心与停车免费；Red Oak Victory 独立管理；不保证特定亲历者到场。
- [EBRPD Radke Martinez](https://www.ebparks.org/parks/radke-martinez)、[Northern Short Loops](https://www.ebparks.org/trails/short-loop/northern)：Killdeer/Duckpond 0.95 英里，十月主草坪/野餐区 18 点结束、Grangers’ Wharf 17:30 结束；现行页面明确 Danger Advisory for blue-green algae。正文提示岸上观察、不接触水体与湿地禁犬。
- [PCFMA Pleasanton](https://www.pcfma.org/market/pleasanton-farmers-market)、[Museum on Main](https://www.museumonmain.org/visitcontact.html)：市集全年周六 9–13 点；博物馆周二至周六 10–16 点、免费、主要节假日闭馆。十月日期按周历推算，明确不是新增特别活动。
- [AIM Sunday Marin](https://www.agriculturalinstitute.org/sunday-marin)：每周日 8–13 点、Civic Center、SMART 站与支付项目。使用现行页，不用 `/sunday-marin-old` 中过期人员与假日信息；不承诺每人均可获 Market Match。
- [California State Parks Sonoma](https://www.parks.ca.gov/?page_id=479)、[Tours and Activities](https://www.parks.ca.gov/?page_id=31901)：每日 10–17 点；成人 $3，6–17 岁 $2，5 岁及以下免费。页面 PDF 和正文对停车入口 East/West 的写法有差异，正文不提供争议方向，改用官方地图。
- [California State Parks Bothe](https://www.parks.ca.gov/?page_id=477)、[Napa Open Space District](https://napaoutdoors.org/parks/bothe-napa-valley-state-park/)：8 点至日落，车辆日间费当前 $10，接受图书馆公园通行证；狗不可上步道。泳池为季节设施，未按夏季周末时段承诺十月开放。

## 已有指南审计建议（交主任务处理）

1. 删除 `bay-area-coastal-cleanup-2026-guide` 的有效内容：核心日期是 2026-09-19，已过期。主任务已接手物理删除。
2. `bay-area-freebies-deals-2026-09` 需逐条处理截止日期，不能整个九月一刀切：9/23 以后优惠仍可能有效。优惠代理已接手。
3. `bay-area-new-openings-2026-09` 不应继续占十月首页推荐位；但已开店不因月份变动而“过期”。保留档案与仍有效商家入口，当前月刊过滤需要主任务处理。
4. `half-moon-bay-pumpkin-season-2026-guide` 核心十月南瓜节仍未来，不建议因标题有“九月”直接删除。其来源核验日期保留 9/9，未假装本次完整重审。
5. `guides-october-local.ts` 六篇并未因 9/23 到来过期；新的十篇地域内容避开重复的 Tilden、China Camp、History Park、Half Moon Bay 和图书馆通行证主题。旧文核验日期未批量修改。
6. 已检索已有攻略，未发现正文旧版 MuniMobile 单程购买指示；新增首篇用于集中解释已生效变化。

## 未采用或需谨慎的研究结果

- John Muir NHS：官方 Basic Information 写每日 10–17 点、午间关闭，FAQ 却写周二至周六 10–12 点并同时出现 16:30 老屋关闭，信息冲突。没有用其中一页自行推定时段，改写 Martinez 海岸攻略。
- Sonoma State Historic Park 主页面列 10/1 Gallery & Sketch Evening、10/10 女性选举权主题活动、10/17 Día de los Muertos Movie Night。已给主任务提示，活动代理应打开具体详情后才能入月刊；本攻略不复制未经详情确认的时段或价格。
- 公园、博物馆和市场的固定开放安排只是常规参观来源，不能替代某一天特别活动的单独证据。

## 验证

- 11 个 slug 互不重复；篇章含非空来源、正文与编辑提示。
- 所有新增含中文的可见字符串均有独立英文映射；固定日期、专有名称、emoji、结构字段不需要翻译。
- 只为交通更新设置首页 featured，其他新攻略不强占首页。主任务可以通过十月目录展示所有新内容。
- `npx eslint src/data/guides-autumn-refresh.ts` 通过；`npx tsc --noEmit -p tsconfig.app.json` 通过（2026-09-23，媒体集成前）。

## 独立图片资产与集成映射

新增 `src/data/autumn-guide-media.json`，共 11 个 `GuideImage & { key }` 记录；文件保存在 `public/guides/autumn-refresh/`，每张含主图和 480 px 响应式版本。照片均已视觉检查，未用其他城市或其他公园冒充目的地。只按比例缩放、编码为 WebP，没有合成、重绘、移除元素或改变画面含义。

官方图片用于对应参观与交通报道的编辑展示，保留机构/已标明作者及原出处。公开展示本身不等于 CC 授权，因此官方图片未编造许可链接；Alviso 的 CC BY-SA 3.0 许可与作者保留在元数据中。日期没有明确确认的图统一称“资料照片”，不冒充 2026 年十月现场。

| 攻略 slug | cover key | 建议 inline key（现有主题插图/对应交通照片） |
| --- | --- | --- |
| bay-area-october-muni-clipper-payment-update-2026 | autumn-clipper | train |
| sf-sunset-dunes-october-coastal-walk-2026 | autumn-sunset | weekend |
| san-mateo-japanese-garden-october-guide-2026 | autumn-sanmateo | garden-walk |
| alviso-marina-october-birdwatching-guide-2026 | autumn-alviso | weekend |
| fremont-ardenwood-october-farm-guide-2026 | autumn-ardenwood | october-family-nature |
| richmond-rosie-free-history-october-guide-2026 | autumn-rosie | culture-visit |
| martinez-shoreline-october-short-walk-guide-2026 | autumn-martinez | weekend |
| pleasanton-saturday-market-museum-guide-october-2026 | autumn-pleasanton | everyday |
| marin-sunday-market-october-local-guide-2026 | autumn-marin | neighborhood-table |
| sonoma-plaza-history-october-day-guide-2026 | autumn-sonoma | culture-visit |
| napa-bothe-october-redwood-picnic-guide-2026 | autumn-napa | weekend |

原图与出处（全部在本轮官方页面或对应 Commons 说明页中观察到后下载）：

- `autumn-clipper`：[MTC 原图](https://mtc.ca.gov/sites/default/files/styles/whole_max/public/images/2025_Berger_bih_560a.jpg.jpg?itok=BsMJJ8-F&cb=06cde1b0)，[出处](https://mtc.ca.gov/news/commission-gets-fresh-update-next-generation-clipper-transition)，署名 Noah Berger。照片屏幕金额明确不作为现行票价依据。
- `autumn-sunset`：[原图](https://images.squarespace-cdn.com/content/v1/674762d32e3d592ae6aa6d61/6b165c82-41f8-4031-a90d-356f63a67ee6/7.8%2B-%2B1%2B%2845%29.jpeg)，[Friends of Sunset Dunes 参观页](https://sunsetdunes.org/visit)。这是公园朋友组织的参观宣传照片。
- `autumn-sanmateo`：[市府原图](https://cityofsanmateo.org/ImageRepository/Document?documentID=57510)，[出处](https://cityofsanmateo.org/3319/Central-Park-Japanese-Garden)。实际图为日本花园池塘与木桥，未用目前关闭的游乐场照片。
- `autumn-alviso`：[原图](https://upload.wikimedia.org/wikipedia/commons/9/92/Alviso_Marina_County_Park_View_At_Sunset.jpg)，[Commons 授权页](https://commons.wikimedia.org/wiki/File:Alviso_Marina_County_Park_View_At_Sunset.jpg)。Wanderenvy / Niranjan Vaidya，2013-09-22，CC BY-SA 3.0；对应 WebP 衍生图沿用该许可。
- `autumn-ardenwood`：[EBRPD 原图](https://www.ebparks.org/sites/default/files/16x9_Ardenwood_Deane%20Little.jpg)，[出处](https://www.ebparks.org/parks/ardenwood)，Deane Little。图片含农具与花朵，未声称为十月花况。
- `autumn-rosie`：[NPS 原图](https://www.nps.gov/rori/planyourvisit/images/RORI_Rosie-The-Riveter-WWII-Home-Front-National-Historical-Park_1_2.jpg?maxwidth=1300&autorotate=false)，[出处](https://www.nps.gov/rori/planyourvisit/things2do.htm)，NPS / Luther Bailey。
- `autumn-martinez`：[EBRPD 原图](https://www.ebparks.org/sites/default/files/Radke-Martinez-Shoreline-Justin-Jarratt-16x9-Meta.png)，[出处](https://www.ebparks.org/parks/radke-martinez)，Justin Jarratt。照片不得被解读为水质安全证据。
- `autumn-pleasanton`：[PCFMA 原图](https://www.pcfma.org/sites/default/files/styles/xl_image/public/2019-11/Pleasanton.jpg)，[出处](https://www.pcfma.org/market/pleasanton-farmers-market)。市场自己的参观宣传图，不保证当日摊商。
- `autumn-marin`：[AIM 原图](https://images.squarespace-cdn.com/content/v1/5fd7b5e8b59b81291926f482/f5a873d6-79bc-4345-8129-91b9606c213f/096_Marin_Market_AIM_10202024_paigegreen_U6A0893.jpeg)，[出处](https://www.agriculturalinstitute.org/sunday-marin)。文件作者标记 Paige Green；不以文件名推定十月当日商品。
- `autumn-sonoma`：[州公园原图](https://www.parks.ca.gov/pages/479/images/barracks_5.5.17_jo.jpg)，[出处](https://www.parks.ca.gov/?page_id=479)。Sonoma Barracks 室内资料照片。
- `autumn-napa`：[运营方原图](https://napaoutdoors.org/wp-content/uploads/2024/03/Bothe-Creek.jpg)，[出处](https://napaoutdoors.org/parks/bothe-napa-valley-state-park/)。Bothe 林地溪流资料照片，不保证十月水量。

集成时需将 `autumn-guide-media` 加入 `guide-media.ts` 的注册集与 `tests/guide-journal.test.tsx` 的 `distinctAssets` 来源记录集；保持独立封面路径/字节及来源一致性测试，不降低断言。

交通补充：另核对 [MTC 9/23 报告](https://mtc.ca.gov/news/report-commission-september-23-2026)，旧 Clipper 卡迁移仍在进行；交通文已明确要求旧卡持有人核对账户升级状态，未宣称所有既有卡自动获得新换乘优惠。
