# 湾区优惠复核与扩充记录

基准日期：2026-09-23（America/Los_Angeles）。覆盖至 2026-10-31。仅使用实际读取的主办方、场馆、图书馆、政府或商家页面作为新增依据。

## 数量与文件

- 新增 18 条：3 条明确日期或年度规则换算（9/29、10/22、10/27），15 条现行常设福利；常设政策没有伪造 10/31 截止日。
- 删除 1 张确实过期的卡片：`yogurtland-anniversary-sep20`（9/20 结束）。十月的 `yogurtland-anniversary-oct20` 保留。
- 更新 2 张既有卡片：SVMA 删除已过期的 9/8–19 换展闭馆提示，改为现展截至 2027/1/24；Santa Clara 县公园通行证补入官网现已列出的 Mountain View 图书馆。
- 更新九月优惠攻略的标题、摘要、核验说明、时间表与过期 Yogurtland 正文；替换为官方新公布的 9/29 Peet’s 25¢ 滴滤咖啡。未将九月咖啡优惠延展成十月促销。
- 新增导出：`autumnRefreshOffers`，类型 `(FreebieOffer & { verifiedAt: string })[]`；`autumnRefreshOfferSources`，类型 `GuideSource[]`。
- 新增中英字符串映射 `src/data/autumn-refresh-offers-en.json`，含新卡片、动态来源说明和本次既有攻略改文。主代理负责在全站入口合并。

## 新增的官方依据

| # | 卡片 ID | 日期性质 | 证据 |
|---|---|---|---|
| 1 | peets-coffee-day-sep29 | 2026-09-29 | [官方来源](https://www.peets.com/pages/current-offers) |
| 2 | happy-hollow-senior-safari-oct22 | 2026-10-22 | [官方来源](https://happyhollow.org/seniorsafari/) |
| 3 | muir-woods-fee-free-oct27 | 2026-10-27 | [官方来源](https://www.nps.gov/muwo/planyourvisit/fees.htm) |
| 4 | chabot-free-telescopes | 现行常设政策 | [官方来源](https://chabotspace.org/programs/free-telescope-viewings/) |
| 5 | randall-museum-free | 现行常设政策 | [官方来源](https://randallmuseum.org/faqs/) |
| 6 | triton-museum-free | 现行常设政策 | [官方来源](https://www.tritonmuseum.org/visit) |
| 7 | anderson-stanford-free | 现行常设政策 | [官方来源](https://anderson.stanford.edu/visit/) |
| 8 | curiodyssey-museums-for-all | 现行常设政策 | [官方来源](https://curiodyssey.org/visit/museums-for-all/) |
| 9 | exploratorium-for-all-five | 现行常设政策 | [官方来源](https://www.exploratorium.edu/visit/reduced-rates) |
| 10 | lawrence-museums-for-all | 现行常设政策 | [官方来源](https://lawrencehallofscience.org/visitors/plan-your-visit/museums-for-all/) |
| 11 | sonoma-library-regional-parks | 现行常设政策 | [官方来源](https://sonomalibrary.org/browse/libraryofthings/socoparkspass) |
| 12 | sonoma-library-discover-go | 现行常设政策 | [官方来源](https://sonomalibrary.org/node/130) |
| 13 | muni-youth-free | 现行常设政策 | [官方来源](https://www.sfmta.com/fares/free-muni-all-youth-18-years-and-younger) |
| 14 | clipper-start-half-fares | 现行常设政策 | [官方来源](https://mtc.ca.gov/planning/transportation/access-equity-mobility/clipperr-startsm) |
| 15 | sfmoma-museums-for-all | 现行常设政策 | [官方来源](https://www.sfmoma.org/deals-discounts/) |
| 16 | cable-car-museum-free | 现行常设政策 | [官方来源](https://www.cablecarmuseum.org/info.html) |
| 17 | oakland-tool-library | 现行常设政策 | [官方来源](https://oaklandlibrary.org/otll/lending/) |
| 18 | rosie-riveter-richmond-free | 现行常设政策 | [官方来源](https://www.nps.gov/rori/planyourvisit/fees.htm) |

补充核验：

- [CuriOdyssey 时间页](https://curiodyssey.org/visit/hours-admission/)列出 10/19 维护闭馆和 10/31 15:00 提前关闭。此页面一处仍写 reduced admission，但独立 [Museums for All 专页](https://curiodyssey.org/visit/museums-for-all/)明确是最多四人免费，因此正文按专页政策写，不沿用旧 $1 说法。
- [VTA 当前票价页](https://www.vta.gov/go/fares)补足 Clipper START 年龄、收入、居住和不同时持 RTC 卡资格；[MTC 现行项目页](https://mtc.ca.gov/planning/transportation/access-equity-mobility/clipperr-startsm)确认所有接受 Clipper 的湾区交通机构现为单程五折，未把早年的 pilot 截止日当作现行失效日。
- [SFMTA 英文官方页](https://www.sfmta.com/fares/free-muni-all-youth-18-years-and-younger)已实际打开，替换先前搜索返回的越南语路径。
- Happy Hollow 10/22 是依据 2026 May–October 第四个周四规则换算；免费入园窗口 09:00–10:00。停车处 748 Story Road 的免费规则保留，但没有把官网针对 8/27 的免停车凭证通知套用至十月。
- Muir Woods 的 10/27 由该园 NPS 官方费用页面明确列出；免费仅限 U.S. citizens and residents，停车和接驳预约费另收。

## 原有 33 条优惠的本轮复核覆盖

原有去重卡片共 33 条。最终完成 24 条主要规则重读、3 条部分复核、1 条到期删除；另外 5 条官方抓取受限。所有 33 条均进行了日期与现行推荐检查，不把官方抓取失败或部分复核冒称为完整核验。

### 首批 11 条主要规则重新读取并保留

| 既有 ID | 本轮结果 | 官方页面 |
|---|---|---|
| peets-orange-friday-sep25 | 确认 9/25/26 12:00 至打烊、$1 small Cold Brew、北加州参与店与排除项；没有 10 月日期 | [Peet’s](https://www.peets.com/pages/current-offers) |
| peets-cold-brew-pass-september | 确认 9/1–9/30 可购买，$30、购买日起连续 30 天、不累计、不退不转 | [Peet’s](https://www.peets.com/pages/current-offers) |
| 85c-september-cake | 确认九月指定咖啡加 $1 蛋糕，App 单次使用及指定品类；未延长至十月 | [85°C](https://www.85cbakerycafe.com/menu_tag/top-picks/) |
| yogurtland-anniversary-oct20 | 确认 2026 每月 20 日会员到店八折，渠道与叠加排除项 | [Yogurtland](https://www.yogurtland.com/news_posts/view/86/celebrating-20-years-of-yogurtland-anniversary-promo-how-you-can-join-the-fun) |
| chm-museums-on-us-oct3-4 | 确认首个完整周末、仅持卡人、带卡与照片证件、特展等除外；银行具体日历本轮未另开 | [CHM](https://computerhistory.org/plan-your-visit/discounts/) |
| omca-free-oct4 | 确认首个周日免费含特别展览，建议预约、现场票先到先得 | [OMCA](https://museumca.org/first-sundays/) |
| asian-art-free-oct4 | 确认首个周日普通入场免费，特展 $10 | [Asian Art](https://about.asianart.org/ticketing/) |
| svma-free-wednesdays-october | 确认周三 11:00–17:00 免费、须前台登记；删除旧换展闭馆提示 | [SVMA](https://svma.org/visit/) |
| sfmoma-family-oct25 | 确认 10/25，每一位 18 岁及以下儿童或青少年最多带两位成人免费；加价展另付 | [SFMOMA](https://www.sfmoma.org/free-days/) |
| ikea-emeryville-as-is-wednesdays | 确认每周三、该店实体 As-is、Family 额外 10%、不可退且不叠加 | [IKEA Emeryville](https://www.ikea.com/us/en/stores/emeryville/) |
| poppy-claro-doggie-dinners-fall | 确认延长至秋季，每周五露台 17:00–20:00、狗用三道菜 $6、天气允许 | [Poppy & Claro](https://www.poppyandclaro.com/) |

### 3 条只完成部分复核

- `target-beauty-sep26`：已读取 [Target 活动主页面](https://www.target.com/c/target-beauty-studio-event/-/N-140b1)，确认 9/26 12:00–16:00、指定店样品盒、前 100 人、16+、每人一次；门店名单附件本轮没有重新打开，保留此前核验记录。
- `homedepot-october-preview`：重新读取 [Home Depot 工作坊页](https://www.homedepot.com/c/kids-workshop)，确认首个周六 09:00 起免费、材料有限与登记入口；本轮提取正文没有具体 Witch Candy Box 名称，项目名称沿用原官方宣传图与 9 月核验记录。
- `alameda-county-discover-go`：[AC Library FAQ](https://aclibrary.org/faqs/)完整正文遇机器人验证；官方搜索索引仍支持服务区居民、15+ 与免费或优惠门票，eCard 排除项沿用原记录。没有越过验证或更改资格。

### 1 条到期删除

- `yogurtland-anniversary-sep20`：endDate 2026-09-20 早于基准日；从源数组删除，并删除九月指南中的对应当前推荐。月份周期政策保留在十月卡片。

### 5 条本轮尝试读取受限，未更新核验日期

- `michaels-ghosts-sep26`：指定 Michaels 场次页返回 403。
- `bampfa-free-oct1`：BAMPFA 指定页面返回 403。
- `conservatory-free-oct6`、`botanical-free-oct13`：GGGP admissions-hours 页面超出工具可读取长度。
- `japanese-tea-garden-free-hour`：[GGGP tickets](https://gggp.org/tickets/)也超出工具长度限制，未反复强试。

上述条目没有因一次读取受限就被误判为活动取消，沿用原 9 月核验记录和原始期限。

### 收尾再完成的 13 条主要规则复核

下表包括前述待复核的 12 条及 Lowe’s 消防飞机（从部分复核提升）；与首批 11 条合计 24 条。

| 既有 ID | 本轮确认 | 官方来源 |
|---|---|---|
| lowes-kids-lollipop | Rewards + Kids Profile、每次到店有机棒棒糖、送完为止；客服协助领取 | [Lowe’s Kids Club](https://www.lowes.com/diy-projects-and-ideas/workshops) |
| lowes-firefighting-plane-oct17 | 总页明确 10/17/2026 10:00–13:00，提前登记、4–11 岁建议与成人陪同；没有把收费 MrBeast 9/26 场次写成免费 | [Lowe’s Kids Club](https://www.lowes.com/diy-projects-and-ideas/workshops) |
| ikea-family-hot-drink | Family 免费咖啡/茶，Swedish Restaurant；FAQ 提到通常工作日，所以保留周末须向门店确认 | [Family](https://www.ikea.com/us/en/ikea-family/)、[官方 FAQ](https://www.ikea.com/us/en/customer-service/knowledge/articles/f26bebdc-91f3-488c-927e-8e8631e9cc48.html) |
| sephora-birthday | 每年一次生日礼、店内无消费、sephora.com 折后税前 $25，库存限制；生日页官方索引支持前后两周窗口 | [生日礼](https://www.sephora.com/beauty/birthday-gift)、[会员条款](https://www.sephora.com/beauty/terms-conditions-beauty-insider) |
| starbucks-cafe-refills | 同次堂食免费续指定冲煮咖啡/茶；Cold Brew、Nitro、调味冰茶、柠檬水和 Refreshers 排除项吻合 | [官方堂食政策](https://about.starbucks.com/back-to-starbucks/) |
| sjma-free-oct2 | 首周五 18:00 后免费；当前页面也明确列出 10/2 18:00 New Ballet Season Preview | [SJMA](https://sjmusart.org/programs-at-sjma/first-fridays) |
| sfpl-discover-go | SF 居民图书证、网上预约免费场馆票与图书馆可协助打印 | [SFPL](https://sfpl.org/discover-and-go) |
| smcl-discover-go | 服务区、16+、有效卡、无 eCard/机构卡、最多两项、打印后不可取消；29041/29731 入口规则 | [FAQ](https://smcl.org/faq/museum-passes-discover-go/)、[卡号入口](https://smcl.org/blogs/post/explore-today-with-discover-go/) |
| santa-clara-library-parks-pass | 三周实体借用、核载 15 人以内单车/合法摩托；排除 Uvas/Baylands/露营/其他系统。主页面新增 Mountain View，已补卡片 | [主页面](https://parks.santaclaracounty.gov/library-parks-pass)、[限制 FAQ](https://parks.santaclaracounty.gov/library-parks-pass/faq) |
| sonoma-county-museum-family-oct10 | 当前日历明确 10/10/2026 Free Family Day 11:00–13:00；未编造其他时段免费 | [馆方日历](https://museumsc.org/events/) |
| cantor-stanford-free | 免费，周一/五 11–18、四 11–20、周末 10–17、二/三闭馆；10+ 团体登记与停车另计 | [Cantor](https://museum.stanford.edu/visit) |
| sfpl-radon-detector-loan | 免费借用最多 21 天、可预约、各分馆办理/归还，设备有限；未重复推送已过期 8/17 讲座 | [SFPL 2026 公告](https://sfpl.org/releases/2026/07/15/free-radon-detector-loan-program-promote-home-safety) |
| berkeley-tool-lending | Berkeley 居民/物业业主且超过 18 岁、独立地址审核、最多 10 件；普通图书证不替代资格 | [工具馆规则](https://www.berkeleypubliclibrary.org/locations/tool-lending-library/borrowing-tools) |

### 集成与日期审阅

- 新增 18 条所有中文文案及动态 `${offer.brand}：${offer.sourceLabel}` 标题有英文映射；来源描述也有映射。
- Peet’s 9/29 更换为独立咖啡情境图 `neighborhood-table`，与 9/25 冷萃封面区分。保留“示意，非成品”说明，未降低独立封面校验。
- 全体指南与新增活动、优惠的英文转换检查没有剩余汉字；活动翻译中五项简略条款已发给活动代理补齐。
- 日期换算：2026/9/25 周五、9/26 周六、9/29 周二；10/1 周四、10/2 周五、10/3 周六、10/4 周日、10/6 和 10/13 周二、10/17 周六、10/20 周二、10/22 第四个周四、10/25 周日、10/27 周二。十月周三为 7/14/21/28，周五为 2/9/16/23/30，周六为 3/10/17/24/31，周日为 4/11/18/25。
- 收尾前优惠测试 11/11、FreebieBoard 7/7 通过；后续完整检查由主代理统一运行，未改弱业务断言。

## 未采用与后续确认项

- 没有新增 SFMOMA Free First Thursday：旧项目在 2026 年 2 月起暂停；本轮官方免费日页仅明确家庭日 10/25 和 community days TBD，不能把首周四直接推算成 10/1 免费。
- 没有新增 de Young/Legion Saturdays 或 San Mateo County History Museum 免费日：本轮未能取得可用的场馆官方页面正文，未把第三方日历当作足够证据。
- 没有把 UC Berkeley Botanical Garden 历史上的首周三免费作为现行规则；当前官方参观页面没有支持该普惠免费日。
- 场馆票库存、临时停场、门店参与与工具借用库存无法保证；卡片均保留实际限制。没有注册、购买、预约、部署或提交 commit。
- 跨站审计线索：[MuniMobile 官方通知](https://www.sfmta.com/getting-around/muni/fares/munimobile)显示自 2026-09-01 不再售单程票，已告知主代理排查旧交通攻略。
