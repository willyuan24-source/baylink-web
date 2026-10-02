# 游客视角补充研究与草稿台账

核验日期：2026-10-02（America/Los_Angeles）。交付仅为暂存草稿，未接入站点、未发布、未改 src/public/tests。本轮事实优先使用实际打开的官方或运营机构页面；不依据搜索摘要制造实时余位、价格或设施可用承诺。

## 先做任务缺口，而不是再加景点名单

已读本地 `guides-october-2026-visit.ts`、`guides-october-2026-newcomer.ts` 以及攻略清单。后按根任务指示补查 `origin/main`（读取时 commit `417ac1bd0fb873fd569b923178574085b5724262`）的 `src/data` 清单、`guides.ts` 类型、现有攻略和 planning 文件关键字。远端已有学校等更新，以下缺口对照其已有单景点、农夫市集和通用服务文章；本地刚完成的 72 小时、机场、门票及亲子文章视为本轮已有内容，不再重复写。

|游客需要完成的任务|优先级|已有覆盖|剩余缺口／本次处理|
|---|---|---|---|
|选一处远郊，判断今天能否去且能返回|P0|Muir Woods、Point Reyes、Half Moon Bay 单点介绍|缺跨目的地取舍和出发否决条件；新增远郊决策文|
|无车订到红木林并完成返程|P0|单点预约文章及北湾无车概述|补十月周末规则、两方向预约、渡轮与接驳分账|
|识别“公交到公园”与“公交游公园”的区别|P0|Bear Valley 景点路线|补 Stagecoach 覆盖界限和远端景点交通缺口|
|退房后存包，取包后赶上出发|P0|机场到达、景点大箱提醒|缺按取包点倒推的流程和 SFO 按 24 小时收费边界|
|散步途中有厕所可用，同行者设施需求被满足|P0|单景点卫生间提示|缺沿线主备选地点、时段和具体设施询问|
|轮椅或低体力游客完成每段交通|P0|雨雾亲子文章、通用通勤|补地面站与地下电梯逐段确认，缆车不能替代|
|丢了物品，联系正确机构|P0|诈骗及通用求助文章|缺 Muni/BART/SFO 飞机、公共区、安检分流|
|外国护照丢失或被盗，正确报案|P0|通用 311/211 与身份诈骗|补 SFPD 线上排除情况、先警局后签发国领事机构；不作补证时间承诺|
|订一顿能满足全组需求的餐|P1|唐人街散步仅提示问店家|缺人数、座位、取消条件、饮食确认和无位备选|
|区分食物过敏与偏好，正确问配料|P0|零散过敏提醒|补具体食材、厨房交叉接触与包装标签边界；不认证商家|
|住短租或酒店，合理买少量菜|P1|通用农夫市集购物文|补住宿设备、冷藏能力、当天返程和市集日期取舍|
|吃饭结账不超预算、不误解附加费用|P1|72 小时预算提过税费|补菜单→税→披露费用→自愿小费核对；不提供统一小费比例或商家排名|

三篇的增量分别是“选择并完成一段远郊行程”“一天现场问题的处理顺序”“一顿符合需求且看懂账单的饭”，不是另写三个景点或餐厅榜单。相关单景点和既有通用文可由根任务在整合时交叉链接。

## 文件与结构

- `visitor-guides.ts`：3 篇，26 / 27 / 28 个 blocks；除 heading 外为 22 / 22 / 23 个可执行内容块。每篇有 7–8 个主来源，全部保留官方入口与核验日期。
- `visitor-en.json`：每个含中文的字符串以 trim + 连续空白合并后的键提供英文映射；包括来源标题/描述、元数据、路线节点、清单和模板。
- 草稿导入为 `../../src/data/guides`，放入 src/data 时改为 `./guides`。仅 type import，不引入运行时依赖。
- 未写死动态班次、余票、餐厅席位、租车价格、行李寄存金额、税率、停车空位或保障性赔付。官方确有固定金额的项目以“当前列”注明，另写适用边界。

## 远郊文章：逐源证据

所有以下页面于 2026-10-02 实际打开。

|官方来源|确认事实及使用边界|
|---|---|
|[NPS Muir Woods Directions](https://www.nps.gov/muwo/planyourvisit/directions.htm)|无手机信号，游客中心仅有限 Wi-Fi；自驾要停车预约；61 路涉及约 1.3 英里下坡及相应上坡返程。页面标最后更新 2025-11-04，不把它当当日班表。|
|[NPS Muir Woods Fees](https://www.nps.gov/muwo/planyourvisit/fees.htm)|普通票 $15，16 岁及以上；未满 16 岁免入园费；停车/接驳另计。页面有一段 over 16，但重复明确条款是 16 and older，采用后者。2026 通票/免费日资格不扩写为所有外国游客都免费。|
|[授权接驳预约页](https://gomuirwoods.com/muir/shuttleInfo)|Larkspur 上车；成人往返 $4、15 岁及以下免费；十月具体运营段写周六周日；去程与回程都预约；提前 15 分钟，ADA 服务预订。页首泛称 Fri–Sun 与十月段不同，按具体月份段解释；未进入结账、无实时余位。|
|[NPS Point Reyes Getting Around](https://www.nps.gov/pore/planyourvisit/gettingaround.htm)|Stagecoach 连接 San Rafael/Bear Valley 一带，向西不超过 Inverness；园内没有公共游览交通，园内没有加油/汽车服务站。2025-07-12 页面提供结构性边界，不承诺当日每站每班。|
|[NPS Point Reyes Fees](https://www.nps.gov/pore/planyourvisit/fees.htm)|普通入园、日间活动和游客中心/海滩/步道口停车免费；露营、特许活动等不同。不能据免费推断全部设施开放。|
|[NPS Point Reyes Current Conditions](https://www.nps.gov/pore/planyourvisit/conditions.htm)|页面主体能读取并指向 Alerts、Park Roads 等；动态警报正文未展示完整。本稿只把它作为行前检查入口，没有宣布“无关闭”。|
|[SamTrans 294](https://www.samtrans.com/routes/294)|标题 Hillsdale–Half Moon Bay；官方分东西向、工作日/周六/周日链接。没有在稿中抄精确发车时刻，也未把 Hillsdale 商场与 Caltrain 站混为一个点。|
|[Half Moon Bay State Beach](https://www.parks.ca.gov/?page_id=531)|车辆日间 $10，可能有旺季/节日/周末变化；08:00–日落；Francis Beach 95 Kelly Ave、卫生间；免费沙滩轮椅；海水冷且有离岸流。页面现有 Roosevelt 工程提示，未假设所有入口均畅通；露营余位不是日间入园余位。|

另实际读过 [Point Reyes Directions](https://www.nps.gov/pore/planyourvisit/directions.htm)，用于理解区域交通，未增加第九个主来源。曾尝试的 `/publictransportation.htm` 返回读取错误，后从 Directions 的正式链接进入 `gettingaround.htm` 成功。

## 现场问题文章：逐源证据

|官方来源（均访问于 2026-10-02）|确认事实及使用边界|
|---|---|
|[SFO FAQ](https://www.flysfo.com/faqs)|Airport Travel Agency 寄存；国际航站楼出发层 G1–G14 附近，06:00–23:00、无需预约、X 光；每件每 24 小时、按大小计费，不足一天也按一天。无固定金额，未保证容量。|
|[SF Public Works Pit Stop](https://sfpublicworks.org/pitstop)|读取地点表：Embarcadero Plaza 09–17、Grove/Larkin 07–19、Market/Castro 08–20；有人值守。表是常规时段，未核验现场临时开放。|
|[Muni Lost and Found](https://www.sfmta.com/getting-around/muni/muni-lost-found)|重要物品最近四小时遗留时联系 311；其他情况线上；通知后领取、不接受直接现场询问。页面仍保留 COVID 减班说明，因此未把 2–3/5 个工作日写成当前服务承诺。|
|[BART Lost and Found](https://www.bart.gov/guide/lostandfound)|独立表格、不要重复报失；12th St/Oakland City Center 领取；510-464-7090 核对开放。页面说排班可变，未保证当日取回或写死领取时间。|
|[SFO Lost and Found](https://www.flysfo.com/services-amenities/lost-and-found)|机上找航空公司；公共航站楼/车库/AirTrain 找机场警察失物，650-821-7014；安检找 Covenant，650-457-2670。仅提供联系入口，未提交任何报告。|
|[SFPD Police Reports](https://www.sanfranciscopolice.org/get-service/police-reports)|911 与非紧急 415-553-0123；外国护照丢失/被盗不在线上受理、到警局。中文入口与语言帮助可用；不保证补证、报案审核或保险结果。|
|[SFMTA Access on Muni Metro](https://www.sfmta.com/getting-around/accessibility/muni-accessibility/muni-access-guide/access-muni-metro)|地下电梯与地面特定无障碍站的区别；页内有电梯状态及 311 查询入口。未推断实时电梯均正常。|
|[SFMTA Cable Cars](https://www.sfmta.com/getting-around/muni/cable-cars)|明确 cable cars 无无障碍上车设备。没有扩写为所有游客都不能乘或把它与历史 F 线混淆。|

读取限制：泛入口 `https://www.sfmta.com/getting-around/accessibility/muni-accessibility` 返回工具错误，改用实际可读的分主题官方页面。SFO FAQ 与搜索发现的服务商目录有不同联系电话，所以寄存段使用 FAQ 和官方联系页入口，没有猜测哪个号码最新。酒店寄存、备用商家、具体轮椅尺寸需求都明确为向服务方询问，不声称统一免费或无条件提供。

## 用餐文章：逐源证据

|官方/机构一次来源（均访问于 2026-10-02）|确认事实及使用边界|
|---|---|
|[Ferry Building Visit](https://www.ferrybuildingmarketplace.com/visit/)|建筑常规 06–22，商户单独营业；无储物柜；有座位信息。不把整栋开放时段当厨房营业。|
|[Foodwise Ferry Plaza Visitor Info](https://foodwise.org/markets/ferry-plaza-farmers-market/visitor-info/)|周六 08–14、周二周四 10–14；多数摊位可卡/非接触支付；南北通道公共无障碍厕所。未承诺每一摊支付方式、菜单、价格或余货。|
|[Foodwise Markets](https://foodwise.org/markets/)|Mission Community Market 三月至十一月、周四 15–19、Bartlett/22nd；不是每日活动。|
|[Japantown Japan Center Malls](https://www.sfjapantown.org/japan-center-malls/)|1737 Post St，公共时段 08:30–22:00；明确商户各自时间。页面有历史年份文字不一致，未使用其创立年份；只用场地与访客入口。|
|[FDA Food Allergies](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies)|九大过敏原含芝麻，包装标签、Contains 与交叉接触说明；不能把联邦包装标签规则变成餐厅已确认无过敏原。无个人诊断、无用药剂量。|
|[California DOJ Hidden Fees](https://oag.ca.gov/hiddenfees)|餐饮强制费用在明确披露条件下有例外；自愿小费不属于强制费用。没有把 SB 478 概括成菜单数字必然最终实付。|
|[DLSE Tips and Gratuities](https://www.dir.ca.gov/dlse/FAQ_TipsAndGratuities.html)|小费自愿；FAQ 第 6 问指出某些 service charge 情况可能构成 gratuity，所以不一概宣称“服务费永远不是小费”。|

同时实际打开 [Japantown 首页](https://www.sfjapantown.org/) 与 [Dining 目录](https://www.sfjapantown.org/dining/)了解机构信息，但未选择、排序或认证具体商户。尝试 [SF 餐厅卫生牌说明](https://www.sf.gov/information--restaurant-health-inspection-posters-and-what-they-mean) 返回仅三行 JavaScript/机器人验证；搜索摘要虽给颜色解释，本稿 **未采用为复核事实、未加入主来源、未给任何店当前卫生评级**。餐厅预约条款、取消费与菜单由各店确认，稿中步骤属于编辑建议。

## 图片建议（复用现有署名图片，不生成）

只建议键；未改 `guide-media.ts`、图片资源或发布页面。以下来自现有媒体登记，沿用原 caption、credit、creditUrl、licenseUrl，不暗示图片反映 2026 当天状态。

|新稿|cover / inline 建议|现有署名与边界|
|---|---|---|
|远郊日|`region-muir-boardwalk` / `coast`|Sarbjit Bahga，CC BY-SA 4.0，2018 木栈道；Runner1928，CC BY-SA 3.0，2014 Half Moon Bay。不是实时路况。|
|行李与现场问题|`sfo` / `bart`|Antony-22，CC BY-SA 4.0，2025 SFO；Insightwm，CC BY-SA 4.0，2024 Coliseum BART。不是失物领取办公室照片。|
|用餐与买菜|`ferry-market` / `produce`|Suiren2022，CC BY-SA 4.0，2022 市集；Daderot，CC0，2014 蔬菜。不是当前商品、菜单或价格。|

## 验证范围

静态检查通过：3 个唯一 slug；每篇至少 18 个非标题块；来源分别为 8 / 8 / 7 个 HTTPS 官方或运营机构入口。递归提取含中文字符串、trim 后合并连续空白，得到 218 个唯一键；英文映射 218 条，无缺失、无多余键、无残留中文译文。使用现有 tsconfig.app.json 与项目的 opencc-search.d.ts 对草稿执行 TypeScript noEmit 检查，0 个诊断（初次仅传草稿时缺少项目 ambient 声明，补入现有声明后通过，未修改声明）。本轮不跑全站构建，不生成 public 导出，不发送消息给商户、不订位、不提交失物或警方案件。
