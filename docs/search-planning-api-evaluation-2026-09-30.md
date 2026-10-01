# BAYLINK 搜索、路线与费用能力评估

查询与代码核对日期：2026-09-30（America/Los_Angeles）。后端基线 `e89b614`，前端基线 `25ab971a`。本文区分已实现能力、此次修复和待评估接入；不代表已经启用新服务。未购买、注册、添加密钥或调用新付费 API；未接触 OPUS/3D。

## 1. 现在实际上能做什么

| 用户任务 | 当前实现与代码证据 | 可靠度边界 |
| --- | --- | --- |
| BayBay 问指南、找服务/帖子 | 后端 `server.js` 的 `/api/ai/guide-chat`；`lib/guideConversation.js`、`lib/baybaySearch.js`、`lib/postSearch.js` | 普通聊天不会自动执行站外搜索。模型回答不等于刚查过网页。 |
| BayBay 找真实小队 | `lib/outingChatIntent.js` + 签名延续 token；前端依据结构化 filters 查询 `/api/outings` | 真实人数、状态来自站内记录；不能把模糊年龄、性别、交通偏好说成已过滤。 |
| 按日期、城市、年龄、预算选活动/地点 | `lib/planner.js`、`plannerSearch.js`；`POST /api/planner/recommend` | 先按目录约束筛选，再可选模型排序。模型只能使用提供的 ID；没有密钥时仍能规则匹配。 |
| 明确查询站外 | `POST /api/planner/web-search`；`plannerWebSearch.js`、`plannerWebExtraction.js` | 已接 Responses `web_search`，仅实际工具引用可生成来源链接；无有效引用或服务不可用时明确失败。网页检索不是实时余票/营业保证。 |
| 地图与路线出口 | 前端 `PlannerMap.tsx`：MapLibre + OpenFreeMap；`planner-itinerary.ts`：地图方向链接 | 地图是已收录坐标/区域参考点。没有 Routes API，不能把直线邻近当步行可达或公交时间。 |
| 当天编排与费用 | `planner-itinerary.ts`、`planner-hours.ts`、`PlannerSchedule.tsx`；后端 `plannerRoutes.js` 保存 details | 已有停留、固定开始、交通/餐休预留、时间冲突、已知门票起价及餐饮交通分项。交通分钟是用户预留；门票起价乘人数是部分估算，未核实儿童票、税费、票档。 |
| 营业时段 | 目录 `planning.schedule` 带 sourceUrl/verifiedAt、具体日期或每周窗口；超过 45 天的资料降为待核 | 目录事实有来源与日期；没有读取实时场馆系统。不能由普通周六时段推断某个节假日照常营业。 |

现有模型配置不等于生产后台当前设置：计划默认 `OPENAI_PLANNER_MODEL || OPENAI_MODEL || gpt-4o-mini`，普通 guide-chat 默认 `OPENAI_MODEL || gpt-4o-mini`，站外搜索独立默认 `OPENAI_WEB_SEARCH_MODEL || gpt-4.1-mini`，可选二次文字抽取由 `OPENAI_WEB_EXTRACT_MODEL` 控制。此次未读取或修改真实密钥。

现有站外搜索限制：每个新搜索最多 1 次 web tool call，20 秒截止；可选候选抽取最多 6 秒且受剩余时间限制；默认共享 UTC 日限额 100、每 IP 每分钟 5 / 每日 20、并发 3、10 分钟缓存、缓存最多 200 条。缓存保留最初 checkedAt。每日 100 是调用数量限制，并非美元账单硬上限；二次模型抽取也有 token 成本。

## 2. 此次已确认并修复的真实问题

后端 `lib/planner.js` 的主地点建议已经排除已知闭馆和未开业地点，但活动建议的“附近顺路一站”使用另一套过滤，因此：

- 当活动在 10 月 3 日，附近地点已明确当天关闭或 10 月 4 日才开业，仍可被加入 `suggestions[].placeIds`。
- 用户用 `excludePlaceIds` 换掉的地点、明确排除的地点或类别，仍可能从附近地点入口重新出现。

已在该分支应用活动实际日期的可用性、排除 ID、地点名、类别和主题检查。没有时段证据的地点仍可作为注明待核的备选；不会把未知错误地判定为关闭。新增回归先复现失败，再验证修复。没有改响应字段、目录数据或新增 API 服务。

## 3. 值得借鉴的产品能力

| 产品 | 官方材料能够支持的优点 | 适合 BAYLINK 的落地点 |
| --- | --- | --- |
| Wanderboat | 开发者介绍强调按场景/氛围搜索，把餐饮与活动组合，地图和视觉内容直接进入选择流程；版本说明有地图路线标签和地点详情联动。官网本次抓取受 robots 限制，改核对开发者官方 App Store 页面，未将评论视为功能验证。 | 先让用户选“今天轻松逛/约会/朋友聚会”等，保留可编辑条件；候选卡一处展示来源、已知费用和时间、加入当天安排。不要仅增加聊天文案。 |
| Wanderlog | 官方说明把按天/类别的地图、各站距离时间、顺序调整和行程集中在一起。 | 地图点击与当天安排互相定位；真实路段时间接入后再做顺序优化；固定演出/集合时间必须作为约束保留。 |
| Rome2Rio | 官方以多交通方式 A→B 比较为核心；2026-08 的官方文章公布 Claude connector。 | 同一路段给步行/公交/驾车可比较选项。connector 的发布不等于 BAYLINK 已获商用 API；本次未找到可直接承诺的公开接入价格或通用授权。 |

来源：[Wanderboat 官方应用说明](https://apps.apple.com/us/app/wanderboat-local-guide/id6736818361)、[Wanderlog 地图与行程](https://wanderlog.com/travel-maps)、[Rome2Rio 产品](https://www.rome2rio.com/)、[Rome2Rio connector 公告](https://www.rome2rio.com/blog/2026/08/28/rome2rio-is-releasing-a-new-connector-in-claude/)。以上是产品借鉴，不是对其数据准确率或合作协议的独立认证。

## 4. API 接入优先级与真实边界

### P0：统一“当前已知、我估算的、还需核对”

继续使用现有 API，不新增供应商。计划卡将来源日期、门票起价、用户预留、实时查询结果分开；未查路线时提示用户补交通预留。BayBay 识别“查最新票价/营业时间”后给明确联网入口，传已确认城市/日期/地点，复用当前 `/planner/web-search`。检索失败仍保留站内候选。需要原始来源引用的费用不得直接写入“已验证”数字字段。

### P1：Google Routes，先做路段卡

能力：按出发时间、交通方式获得路段距离、预计耗时和公交详情。公交不支持中间 waypoints，6 站应按相邻路段分别查询；每一段的查询时刻要包括前面停留、餐休和交通。`transitFare` 仅在全部步骤票价可确定时提供，缺字段就是未知。公交查询窗口为当前时间前 7 天至后 100 天，远期班次仍可能变化，不能把 BAYLINK 的 180 天日期范围全当实时可查。[公交规则](https://developers.google.com/maps/documentation/routes/transit-route)

建议新服务接口（尚未实现）：`POST /api/planner/routes/preview`，输入公开地点 ID、确认的起点、日期/出发时刻和交通方式；返回各路段 `durationSeconds/distanceMeters/departureAt/arrivalAt/fare?`、provider、queriedAt、warnings。先显示“采用这些预估”的可审阅结果，用户确认后才更新自己预留的时间。修改地点、顺序、日期、交通后旧路段失效。无路线、超范围、超时、限额应保留手动编排。

**当前底图限制非常关键：** Google Routes 的路线如果显示在地图上，须显示在 Google Map；不应直接画到现有 OpenFreeMap。可先在独立文字卡展示并按规范署名，地图继续只画自有目录点；也可另设 Google 路线地图。Routes 内容大部分缓存受限制，place ID 有例外，不能按现有目录长期保存第三方整份响应。[Routes 展示与缓存政策](https://developers.google.com/maps/documentation/routes/policies)

配额：Compute Routes 文档上限 3,000 QPM；Matrix 为 3,000 elements/min，元素数是起点数×终点数，不能按一次 HTTP 请求估算费用。BAYLINK 应设置远低于供应商默认值的服务端配额。[用量与计费](https://developers.google.com/maps/documentation/routes/usage-and-billing)

### P1：Google Places，仅对用户选中的少量地点补查

能力：补充稳定 place ID、地址、营业状态、营业时段、价格等级等。`currentOpeningHours` 仅覆盖含今天的 7 天，不能直接回答两个月后的节假日；普通周时段与指定日期应分别显示。`priceRange/priceLevel` 不能替代特定日期、年龄、票档的门票库存与结算报价。[字段定义](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)

营业时间、priceRange/priceLevel 属于 Enterprise 字段；不能按 Essentials 的低价估算。只请求必要 field mask，先做用户点击的 1–3 个地点；不要每次输入字母或加载列表就刷新全部地点。[字段与 SKU 对应](https://developers.google.com/maps/documentation/places/web-service/data-fields)

Places 在地图上展示也有 Google Map 和归属要求；照片/评论必须显示对应署名，缓存政策需要逐项遵循。不要把 Google 照片或地点正文复制进永久自有目录。[Places 政策](https://developers.google.com/maps/documentation/places/web-service/policies)

### P2：511 湾区公共交通，优先运行异常提示

官方数据免费，需申请 token 并署名 511.org。区域 GTFS/GTFS-RT 包含时刻表、实时更新/车辆/服务告警，GTFS Fares v2 包含票价与换乘规则；默认每 key 每小时 60 请求，提高配额需申请。适合先补“BART/公交服务异常”提醒并共享缓存。它是数据源，不是已经替 BAYLINK 完成门到门寻路、步行换乘和所有优惠票规则的托管规划器；自建路由仍有计算、运维和数据更新成本。[数据入口](https://511.org/open-data)、[配额 FAQ](https://511.org/about/faq)

### P2：Ticketmaster 活动索引，保留购票跳转

Discovery API 可按城市/日期找活动、场馆、主办信息和 `priceRanges`，用于扩大演出/体育等覆盖。价格范围不等于当前可买票档或最终含费价格；免费社区活动仍需要自有官方来源目录。默认 5,000 次/日；技术页写 5 次/秒，但当前 FAQ 写 2 次/秒，两份官方材料不一致，试点应先按更低值并核实账号配额。本次未核实可承诺的每千次美元价或商业合同，不将其写成无条件免费服务。[Discovery 文档](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)、[官方 FAQ](https://developer.ticketmaster.com/support/faq/)

### P3：Viator，确有售票转化需求后再申请

适合已知产品、日期和旅客组合的旅游体验报价。官方说明 Basic access 可读部分内容/价格日历；实时 `/availability/check` 要 Full access 等更高权限，且用户先提供日期和旅客组合。Basic 的缓存日历不得被宣传成实时最终报价。API 权限、商业模式、用量与结算须经合作方确认；本次没有找到适用于 BAYLINK 的统一公开每次价格。先做有归属的外跳，暂不做收款、占库存、退款或代订。[官方技术指南](https://partnerresources.viator.com/travel-commerce/technical-guide/)、[官方 API 入口](https://docs.viator.com/partner-api/technical/)

### P3：Instagram/社交内容，只做合法授权入口

Meta 官方 Postman 集合说明 Facebook Login 路径面向 Business/Creator 账户，需要关联 Page 和相应权限，不能访问普通消费者账户；可以管理获授权媒体及限定的 hashtag/business discovery 功能。这不是“搜索全网所有 INS 帖子”的通用 API。不同登录路径能力不同，正式接入前须逐条确认权限与审核，当前未得到可承诺的全网采集配额/价格。[Meta 官方 API 集合](https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login)

本次 Meta 开发者页返回 429，自动采集条款跳转登录页，未绕过；因此不声称完整复核了最新审核细则。建议用户主动贴链接→保存原链接和用户自己的备注→经核对后关联场馆。网页能打开不等于授权批量抓取、复制图片或永久存储。完整自动采集方案须先获相应授权，再评估数据与隐私条款。[开发者入口](https://developers.facebook.com/docs/instagram-platform/)、[自动采集条款入口](https://www.facebook.com/legal/automated_data_collection_terms)

## 5. 当前公开价格与用量示例

币种 USD，全球按量计费，税费和特殊合同另计；以下是 2026-09-30 查询值，开通前再次核对。免费额度按 SKU / 账单账户使用规则计算，不能保证现有账号额度尚未消耗。

| 服务 / SKU | 月免费量 | 首个付费阶梯：每 1,000 计费事件 |
| --- | ---: | ---: |
| Routes Compute Routes Essentials | 10,000 | $5 |
| Routes Compute Routes Pro | 5,000 | $10 |
| Places Place Details Enterprise（时间/价格字段） | 1,000 | $20 |
| Places Text Search Pro | 5,000 | $32 |
| Google Dynamic Maps（若更换路线地图） | 10,000 | $7 |

这是不同 SKU 的价格，不能把一次用户搜索当一次调用，也不能假定选择了交通或排序功能仍按 Essentials 计费。[Google 官方全球价格表](https://developers.google.com/maps/billing-and-pricing/pricing)

OpenAI 已用 web_search：$10/1,000 次 tool call，另计模型 token。当前默认 gpt-4.1-mini 输入 $0.40/百万、输出 $1.60/百万；该模型非 preview 搜索每次按固定 8,000 输入 search-content tokens 计费。因此每 1,000 次新检索，仅工具和该搜索内容约 $13.20，另加提示、答案和可选二次抽取。默认每日 100 次、假设运行 30 天且全用满，前述基础部分约 $39.60；不是整月总账单上限。[工具计费](https://developers.openai.com/api/docs/pricing)、[当前默认模型价格](https://developers.openai.com/api/docs/models/gpt-4.1-mini)、[web_search 文档](https://developers.openai.com/api/docs/guides/tools-web-search)

**规模示例（推算，非报价）：** 每月 1,000 份计划，每份 4 次路段请求、3 次 Places Enterprise 详情：若独立免费额完整可用，Routes Essentials 为 $0，Places 为 $40。每月 10,000 份同样计划：Routes Essentials $150 + Places $580 = $730；若路线触发 Pro，则路线 $350，合计 $930。未包含地点搜索、地图加载、AI、重试和其他功能。由此更应该先按用户点击补查，避免对全部候选预取。

现有 Google Maps URL 外跳不需要 API key，仍可作为零新增 API 接入的路线出口；它不会将路线数据返回 BAYLINK。移动浏览器中途点上限与桌面不同，应保留逐段打开方式。[Maps URLs 官方说明](https://developers.google.com/maps/documentation/urls/get-started)

## 6. 建议用户评估的接入顺序与审批项目

1. 先完成不增加供应商的搜索入口联动、时间/费用证据展示、换地点不回流，以及手动交通预留恢复。现有联网搜索继续使用明确按钮和失败降级。
2. 首个付费试点只接 Routes 路段文字卡 + 点击查询 Places 时段。建议先评估每月 **$100 总预算级别**，这是建议上限，不是已开通套餐或最终报价。服务端按供应商/SKU设置日配额、并发、超时和停用开关；账单告警本身不当作自动停机。
3. 获得实际使用量后，再评估 511 告警及 Ticketmaster 索引。不会为了让聊天更“聪明”就换更贵的大模型；先测关键条件保留、事实引用和真实可执行路线。
4. 门票下单或 INS 自动聚合单独立项，先确认账号权限、授权内容、商业条款和维护成本。

需明确决定：Google 账单账户与每月上限、要文字路线卡还是 Google 地图、可向供应商发送的精确起点范围、第三方结果的存储/展示边界、是否申请 511/Ticketmaster/Viator/Meta 账号。密钥只放服务端，前端地图密钥单独限制域名与 API；本次未执行这些开通动作。

## 7. 新接入前必须通过的验证

- 日期：湾区跨午夜、夏令时、7 天/100 天/目录 180 天范围、节假日、临时闭馆；未知仍是未知。
- 路线：步行不能自动变驾车；公交无路线不能以驾车分钟填空；换站/调序/改日期后旧路段失效；固定活动开始前无法到达必须显式冲突。
- 费用：儿童年龄、同行人数、币种、含税与否、票档、free-entry 与免费停车分开；零值与缺值区分；起价/估算不能变成可付款报价。
- 来源：可点击原始引用、provider/queriedAt/有效期；恶意网页文本不能变系统指令，模型自己生成的 URL 不可充当来源。
- 降级与预算：429、超时、供应商字段缺失、断网、缓存过期时保留用户草稿；quota 原子领取，浏览器重试不无界放大调用；先用 mock provider 回归，再经批准做有限真实试点。

实施记录：后端修正明确日期后接星期的解析，以及附近建议对已排除／闭馆地点的过滤；前端同步日期识别，并增加月度搜索到计划的承接和站外候选的地图查找入口。相关回归覆盖日期、附近候选和地图链接编码。本文为供应商评估文档，本轮未接入新供应商；最终测试和部署结果见全站审计报告。
