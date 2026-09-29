# 2026-09-29 内容补充发布记录

状态：**发布前检查完成；生产验收结果见独立发布记录**

内容核对日期：2026-09-29；活动日期与时间均使用 America/Los_Angeles。

工作目录：`C:/Users/willy/.codex/worktrees/autumn-content-release/baylink-web`。

## 发布范围

本轮新增 **35 项独立内容＝26 个活动＋9 个优惠/常设福利**，不把同一活动的多日期、赠品或入口链接重复计数。合并后的目录为 293 个活动、95 个优惠。本轮新活动发生于 2026-10-03 至 2026-10-30；检索窗口为 9 月余下日期至 10 月底。9 个常设福利保留 `availability: ongoing`，没有把核对日或 10/31 写成商家的统一生效/结束日期。

同时补充 **7 张 BAYLINK AI 原创主题插图**、英文内容、行程日期/时间约束，以及现有十月优惠攻略的 9/29 补充入口。原攻略 URL 与唯一优惠主板保留，没有新增第二个主板或重复攻略。

| 地区 | 新增活动 | 新增优惠/福利 |
| --- | ---: | ---: |
| 旧金山 | 5 | 4 |
| 东湾 | 5 | 0 |
| 半岛 | 5 | 1 |
| 南湾 | 3 | 2 |
| 北湾 | 8 | 2 |
| 合计 | 26 | 9 |

优惠的地区是展示归类：Caltrain 的实际适用范围包括旧金山、半岛和南湾；有具体门店条目的全国商家政策仍保留参与门店条件。

## 成本与资格边界

- 活动分类：**18 项 free、2 项 mixed、1 项 paid、5 项 unknown**。免费入场不表示免费餐饮、停车、商家商品或全部子项目。
- `mixed`：Stanford Halloween Concert 公众 $32、65+ 与非 Stanford 学生 $27；只有 Stanford 学生凭 ID 一证一票免费。Sonoma 书展为到场儿童每人一本免费书、教育工作者购书半价，普通购书付费。
- `paid`：Santa Rosa 书展 10/4 半价，10/5 $5/袋；袋价为购书价，不当作每人门票或无限量领取。
- 9 个优惠中，**5 项 purchase**（Noah’s、Ike’s、Jamba、Caltrain、Chase Center 附带 Muni）与 **4 项 no-purchase**（生日 Bundtlet、合资格长者 Muni、The Shop、The Lab）。no-purchase 不等于无年龄、会员、居住地或申请条件。
- Ike’s 欢迎奖励须先消费至少 $10，最高抵 $18；Jamba 是两张一次性半价券，不是免费饮品。Noah’s 须账户提前点单、另购餐食并应用奖励。
- Bundtlet 生日领取限 18+ 合资格会员及有效个人券，不承诺当天注册即到账。SF 老年免费 Muni 须 65+、SF 居民、收入合资格及事先获批。
- Chase Center 活动票附带当天 Muni 公交/轻轨至次日 02:00，不含活动票价、缆车、BART 或 Caltrain。Caltrain 青少年 $1/$2 票限 5–18 岁，幼童免费须遵守陪同与人数条件。

### 5 项保留未知费用

以下页面没有足够明确的入场费证据；赠书、印张或材料提供不被推断成整场免费。行程 `admissionUsd` 保持 null：

- `sf-marina-library-open-house-oct17-2026` — Marina 图书馆开放日：音乐、手工与赠书
- `sf-halloween-broadside-printing-oct17-2026` — 万圣节活版印刷：体验 1909 年手压印刷机
- `sf-main-halloween-costume-swap-oct15-2026` — SF Main Library 儿童万圣节服装交换
- `san-lorenzo-banned-books-storytime-oct7-2026` — San Lorenzo 阅读自由故事会与赠书
- `san-lorenzo-metal-milagros-oct10-2026` — San Lorenzo 墨西哥 Milagros 金属浮雕手工

Sonoma 与 Santa Rosa 书展另有明确购书优惠，但入场费没有单独确认，因此两项行程门票估算也保留 null。**5 项 unknown 指活动成本标签数量，不等于所有 null 门票估算的数量。**

## 日期、年龄、预约与行程处理

- 26 项活动都记录明确 occurrenceDates；两日活动分别保留各自窗口。Sonoma 10/3 11:00–16:00 与 10/4 13:00–16:00、Santa Rosa 10/4 10:00–16:00 与 10/5 14:00–18:00 不合并成统一时段。
- Stanford Art for All 10/11 为 10:00–12:00 或 13:00–15:00，只登记一场；不把午间间隔当作开放时间。午间吉他、Halloween Concert、儿童手作、蝙蝠科普及青少年 AI 活动使用固定场次。
- Cal Sailing 为 5+，儿童须成人陪同、签免责文件并穿救生衣。现场登记 13:00–14:30，先到先得；13:00–15:00 是通常整体窗口，天气、潮汐、排队与船位有变化。
- Crowden 整体音乐日不设虚构年龄上限；3+ 弦乐示范和婴儿至 7 岁短音乐会的年龄只适用于对应子项目。BORP 的运动场地与时段分开，交通和攀岩需登记。
- Corte Madera 木制彩绘为 5–14 岁；Novato AI 活动为 11–18 岁。图书馆“家庭/儿童/成人”栏目标签没有擅自变成数字入场年龄限制。
- Point Reyes 接受成人、儿童及宠物服装；Fairfax 只接收合适儿童的非恐怖服装。两场都允许没有可捐物的人来选，尺寸和余量不保证。
- SF 财务咨询的预约和线下讲座/Zoom 条件分别说明；San Lorenzo 的前台限额入场票不写成网上预约。Ameswell 普通观看不需票，装扮比赛另登记且有截止日期。
- 5 个新增城市标记为 city 级参考点，不冒充真实场馆入口或已验证导航路线。

## 图像记录

以下新资源均为 1280×853 WebP，配 480px 小图；声明为 AI 原创主题插图，保留中英文 alt、caption 与 credit。逐张视觉核查显示主题与用途相符：帆船乘员有救生衣、宠物活动有牵绳、蝙蝠隔着展示箱观察。图中湾景、人物、设备、食物与场景不代表实际地点、当日活动、库存或获奖/领取保证。

| 图键 | 主题 |
| --- | --- |
| `refresh-community-swap` | 邻居与亲子在图书、拼图和儿童服装交换桌旁挑选物品 |
| `refresh-makers` | 邻居在手作空间修理台灯、缝补衣物，背景设有创作设备 |
| `refresh-pets` | 主人牵着穿简单万圣节服饰的狗参加秋日社区聚会 |
| `refresh-sailing` | 穿救生衣的成人与儿童乘小帆船体验海湾航行 |
| `refresh-smoothie-rewards` | 咖啡桌上的两杯水果冰沙、芒果、草莓与会员卡示意 |
| `refresh-bats` | 讲解员陪伴家庭隔着展示箱观察蝙蝠与翼部示意图 |
| `refresh-music` | 吉他与小提琴演奏者为社区家庭和轮椅使用者演出 |

已有餐饮插图、阅读插图与 Caltrain/Muni 资料照片按原有说明复用。未把未经授权的官方活动海报直接复制为本站图片，也未把生成插图标为活动实拍。

## 数据与入口

- `src/data/september-refresh-regional-events.json`：半岛/南湾 8 项、北湾 8 项。
- `src/data/september-refresh-sf-east-events.json`：旧金山/东湾 10 项。
- `src/data/september-refresh-offers.json`：7 项商家/交通福利、2 项免费创作空间。
- `src/data/september-refresh-planning.ts`：26 项行程费用、年龄、预约与日期/场次。
- `src/data/september-refresh-city-locations.json`：新增城市级定位。
- `src/data/september-refresh-media.json` 与 `public/guides/september-refresh/`：7 张新插图。
- 各 `september-refresh-*-en.json`：活动、优惠、图片、行程说明及攻略英文，已在 locale 加载。
- `src/data/guides-october-deals.ts`：原有攻略主板前新增介绍与 4 个内部链接；updatedAt 为 9/29，sourceNote 保留旧条目 9/8–27 原核查日，并非宣称全目录重新验证。

## 活动清单

| ID | 地区 | 官方发布时段 | 成本标签 | 来源 |
| --- | --- | --- | --- | --- |
| `redwood-city-fixit-clinic-oct-2026` | 半岛 | 10 月 3 日 · 10:30–12:30 | 免费入场/活动 | [官方来源](https://www.redwoodcity.org/Home/Components/Calendar/Event/95144/2638?curdate=8-28-2026&curm=10&cury=2026&widgetId=5678) |
| `stanford-noon-guitar-oct-2026` | 半岛 | 10 月 7 日 · 12:30–14:00 | 免费入场/活动 | [官方来源](https://music.stanford.edu/events/noon-concert-guitar-students-charles-ferguson) |
| `mountain-view-oktoberfest-2026` | 南湾 | 10 月 10、11 日 · 每天 11:00–19:00 | 免费入场/活动 | [官方来源](https://www.mvoktoberfest.com/) |
| `stanford-art-for-all-oct-2026` | 半岛 | 10 月 11 日 · 10:00–12:00 或 13:00–15:00 | 免费入场/活动 | [官方来源](https://museum.stanford.edu/events/family-programs) |
| `springline-barks-boos-2026` | 半岛 | 10 月 23 日 · 17:00–19:30 | 免费入场/活动 | [官方来源](https://www.eventbrite.com/e/barks-boos-tickets-2002304500662) |
| `mountain-view-monster-bash-2026` | 南湾 | 10 月 24 日 · 10:00–14:00 | 免费入场/活动 | [官方来源](https://www.mountainview.gov/our-city/departments/community-services/special-events/monster-bash) |
| `ameswell-barks-boos-2026` | 南湾 | 10 月 25 日 · 11:00–14:00 | 免费入场/活动 | [官方来源](https://www.theameswellhotel.com/experiences/happenings/barks-boos/) |
| `stanford-halloween-concert-2026` | 半岛 | 10 月 30 日 · 19:30–21:00 | 免费与付费条件并存 | [官方来源](https://events.stanford.edu/event/2026-halloween-concert) |
| `sonoma-valley-book-sale-free-child-book-2026` | 北湾 | 10 月 3 日 11:00–16:00；10 月 4 日 13:00–16:00 | 免费与付费条件并存 | [官方来源](https://events.sonomalibrary.org/event/friends-library-book-sale-120268) |
| `santa-rosa-big-book-sale-discount-days-2026` | 北湾 | 10 月 4 日 10:00–16:00；10 月 5 日 14:00–18:00 | 付费折扣 | [官方来源](https://events.sonomalibrary.org/event/friends-santa-rosa-libraries-big-book-sale-veterans-memorial-hall-120393) |
| `san-rafael-civic-center-puzzle-swap-2026` | 北湾 | 10 月 8 日 · 13:00–16:00 | 免费入场/活动 | [官方来源](https://marinlibrary.bibliocommons.com/events/6a0c9526c7d3cd58005a3480) |
| `corte-madera-wooden-sugar-skull-painting-2026` | 北湾 | 10 月 8 日 · 15:30–16:30 | 免费入场/活动 | [官方来源](https://marinlibrary.bibliocommons.com/events/6ab577fe001a4a0e055bd0a9) |
| `san-rafael-norcal-bats-library-2026` | 北湾 | 10 月 14 日 · 14:30–15:30 | 免费入场/活动 | [官方来源](https://marinlibrary.bibliocommons.com/events/6a3af9e8f56bd86e00b8a467) |
| `novato-teen-ai-literacy-escape-room-2026` | 北湾 | 10 月 15 日 · 17:00–18:30 | 免费入场/活动 | [官方来源](https://marinlibrary.bibliocommons.com/events/6aa31dedca248a002914f7c5) |
| `point-reyes-halloween-clothing-swap-2026` | 北湾 | 10 月 17 日 · 10:00–12:00 | 免费入场/活动 | [官方来源](https://marinlibrary.bibliocommons.com/events/69b1b1b1cd3d863bd924a338) |
| `fairfax-kids-halloween-costume-swap-2026` | 北湾 | 10 月 17 日 · 14:00–16:00 | 免费入场/活动 | [官方来源](https://marinlibrary.bibliocommons.com/events/6aa9d3b6ab7a8e0037c21af9) |
| `berkeley-crowden-community-music-day-oct4-2026` | 东湾 | 10/4（日）10:00–14:00 | 免费入场/活动 | [官方来源](https://www.crowden.org/community-music-day/) |
| `berkeley-cal-sailing-open-house-oct4-2026` | 东湾 | 10/4（日）一般为 13:00–15:00；13:00–14:30 现场登记 | 免费入场/活动 | [官方来源](https://www.cal-sailing.org/activities/csc-open-house) |
| `berkeley-borp-adaptive-sports-expo-oct17-2026` | 东湾 | 10/17（六）主场 10:00–15:00；社区庆祝 15:30–17:30 | 免费入场/活动 | [官方来源](https://www.borp.org/expo/) |
| `sf-bay-beats-bandshell-oct24-2026` | 旧金山 | 10/24（六）14:00–18:00 | 免费入场/活动 | [官方来源](https://illuminate.org/event/bay-beats-at-the-bandshell-october-24/) |
| `sf-financial-planning-day-oct24-2026` | 旧金山 | 10/24（六）10:00–17:00；部分讲座同步 Zoom | 免费入场/活动 | [官方来源](https://sfpl.org/events/2026/10/24/workshops-financial-planning-day) |
| `sf-marina-library-open-house-oct17-2026` | 旧金山 | 10/17（六）11:00–15:00 | 费用待核 | [官方来源](https://sfpl.org/events/2026/10/17/celebration-open-house) |
| `sf-halloween-broadside-printing-oct17-2026` | 旧金山 | 10/17（六）14:00–16:00 | 费用待核 | [官方来源](https://sfpl.org/events/2026/10/17/activity-halloween-broadside-printing-event) |
| `sf-main-halloween-costume-swap-oct15-2026` | 旧金山 | 10/15（四）16:00–17:30 | 费用待核 | [官方来源](https://sfpl.org/events/2026/10/15/activity-halloween-costume-swap) |
| `san-lorenzo-banned-books-storytime-oct7-2026` | 东湾 | 10/7（三）11:00–11:30；活动室提前 10 分钟开放 | 费用待核 | [官方来源](https://aclibrary.bibliocommons.com/events/6a8e1732392e9c02993c8c9a) |
| `san-lorenzo-metal-milagros-oct10-2026` | 东湾 | 10/10（六）15:00–16:00；14:30 开始发入场票 | 费用待核 | [官方来源](https://aclibrary.bibliocommons.com/events/6a8e175a392e9c02993c8cd5) |

## 优惠/常设福利清单

全部为 ongoing；实际使用受门店、账户券、申请和设备可用性约束。

| ID | 展示地区 | 成本类型 | 来源 |
| --- | --- | --- | --- |
| `noahs-rewards-order-ahead-coffee` | 旧金山 | 须消费/付费关联 | [官方来源](https://www.noahs.com/free-coffee) |
| `ikes-love-welcome-sandwich` | 旧金山 | 须消费/付费关联 | [官方来源](https://www.ikessandwich.com/rewards/rewards-faq/) |
| `nothing-bundt-cakes-birthday-bundtlet` | 南湾 | 无额外购买；保留资格条件 | [官方来源](https://www.nothingbundtcakes.com/faqs/) |
| `jamba-welcome-half-price` | 南湾 | 须消费/付费关联 | [官方来源](https://www.jamba.com/about/faq) |
| `caltrain-youth-dollar-fare` | 半岛 | 须消费/付费关联 | [官方来源](https://www.caltrain.com/fares) |
| `sfmta-free-muni-seniors` | 旧金山 | 无额外购买；保留资格条件 | [官方来源](https://www.sfmta.com/vi/node/12193) |
| `chase-center-ticket-muni-included` | 旧金山 | 须消费/付费关联 | [官方来源](https://www.sfmta.com/fares/your-chase-center-event-ticket-your-muni-fare) |
| `south-novato-the-shop-free-makerspace` | 北湾 | 无额外购买；保留资格条件 | [官方来源](https://marinlibrary.org/the-shop/) |
| `marin-city-the-lab-free-makerspace` | 北湾 | 无额外购买；保留资格条件 | [官方来源](https://marinlibrary.org/the-lab/) |

## OPUS 世界覆盖边界

本轮新增的 5 个旧金山活动已进入网站、活动日历和计划目录。实际复核显示其中 3 项被既有 Main Library 场馆文本匹配规则自动归入世界，另外 2 项没有匹配场馆。不能把网站发布统一说成全部已经或尚未进入世界。

以下 2 项尚未完成 OPUS 世界的场馆导入与导航点验收，在 `tests/opus-bay-w6-s-venues.test.ts` 的 `NOT_PLACED` 中逐项记录原因：

- `sf-bay-beats-bandshell-oct24-2026`：Golden Gate Bandshell 音乐会。
- `sf-marina-library-open-house-oct17-2026`：Marina Branch 开放日。

以下 3 项通过原有 `/Main Library|100 Larkin/i` 规则映射到 `main-library`，已可见；此次没有新增世界场馆、导航点或世界功能：

- `sf-financial-planning-day-oct24-2026`：Main Library 财务讲座与咨询。
- `sf-halloween-broadside-printing-oct17-2026`：Main Library Book Arts 活版印刷。
- `sf-main-halloween-costume-swap-oct15-2026`：Main Library 儿童创意中心服装交换。

审计窗口内的旧金山目录数量由 57 更新为 62，世界内显示数量为 **41＝原 38＋既有 Main Library 规则自动匹配的 3 项**。保留逐项“已放入世界／18+ 或专业活动／明确未放置原因”的覆盖断言，对这 3 项明确断言 `main-library` 映射，对另外 2 项明确断言未放置，并确认全部 5 项均未被成人限制或专业活动规则意外排除。本次只更新清单审计，不更改世界功能、场馆、导航或原有 deadlock 测试；此前 deadlock 29/30 的失败需由主流程独立记录和处理。

## 官方信息与未纳入内容

核对的是政府、图书馆、大学、主办方以及品牌官方已经发布的日期/政策；主办方自有 Eventbrite 页面也用于票价、年份和报名规则。该核对**不保证实时库存、余票、奖励到账、门店参与、天气或临时开放**，也未代用户报名、购买或兑换。

Mountain View Monster Bash 官方直接读取仍返回 403；本轮重新读取搜索引擎收录的官方正文，与市政府日期记录一致（10/24 10:00–14:00、公众活动、餐饮另购）。此为访问限制，不冒充已经成功抓取实时页面。

Panera 本地参与店待核、Krispy Kreme 本地参与店待核、Ike’s catering 完整条款、FAMSF 当前规则等 hold 项没有进入 35 项。已过期活动、其他地区同名项目和既有重复优惠不新增计数。

## 最终审阅与验证记录

内容独立审阅：已核对 35 项的分类、日期、年龄/参加条件、图片匹配和英文；未发现新的来源事实冲突。定位的结构化时间边界已由主流程补齐，内容审阅放行：

- **回归通过**：Cal Sailing 的 14:30 现场登记截止已写入对应 dated window 的 `lastEntry: '14:30'`；14:45 到达会被拒绝，14:30 加半小时停留的边界通过。官网通常结束时段仍为 15:00，登记后能否获得船位仍不保证。

发布前验证如下；生产发布结果另存于 `output/september-refresh-release-verification.md`，以实际部署和线上检查结果填写。

| 验证项 | 状态 | 结果/命令/证据 |
| --- | --- | --- |
| 内容、路由、SEO、英文、详情页与时间回归 | PASS | 最终定向 61/61；日志 `output/september-refresh-release-tests.log` |
| Cal Sailing 最晚登记边界回归 | PASS | 包含在上述 61 项；费用未知、双场午休间隔及商品售价不当门票也通过 |
| OPUS 场馆目录覆盖审计 | PASS | 5/5；仅同步审计清单，没有改世界规则和导航 |
| 全套测试与 lint | 已记录限制 | 初次全套 2363 项：2356 通过、7 失败。本轮引入的 6 个路由/来源英文/站内链接/目录审计问题均已修复并分别回归通过。剩余为既有 W5 forced-blocker 29/最低30；未改该逻辑或断言。Lint 0 errors、43 个既有 warnings；最后变更文件独立 lint 通过。 |
| 后端检索 | PASS | 268/268；9 条中文与 9 条英文品牌查询实际选中正确段落、保留条件和官方链接；模型摘录仍限制为 9000 字符 |
| 构建、导出与预渲染 | PASS | TypeScript 与最终 production build 通过；293 events、77 places、97 guides；554 公开 HTML 页面；529 分享卡图片和二维码通过独立解码验证 |
| 图片与页面在桌面/移动端呈现 | PASS | 1280 桌面英文、390×844 手机中文检查；图片正常，无横向溢出；四个新入口在优惠主板之前且可点击；北湾 10/17 的 Fairfax/Point Reyes 活动及城市参考标记可见 |
| 部署及线上 smoke check | 发布后记录 | 最终版本、URL、35 条详情与 14 个图片文件检查以及生产截图见独立发布验收记录 |

本轮同时修复：长攻略超过 24,000 字后末尾优惠无法被 BAYBAY 检索；攻略中的相对站内链接未变成可点击入口；新增内容说明被整个优惠主板挤到后面。检索只扩大本地排名读取范围，未增加外部模型调用或上传额度。
