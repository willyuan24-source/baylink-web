# 长期居民内容缺口研究与三篇草稿

核验日期：2026-10-02（America/Los_Angeles）。本轮只生成研究草稿，不修改线上内容、src、public、tests 或 backend。

## 基线与方法

先审阅原工作区已有生活指南，再按主代理要求重新检查 `git ls-tree -r --name-only origin/main -- src/data`、`git show origin/main:src/data/guides.ts` 与远端全文搜索。本次对照的 origin/main 为 `417ac1bd0fb873fd569b923178574085b5724262`。远端 Guide / GuideBlock 类型与本草稿兼容。三篇使用 `../../src/data/guides` 的 type-only import，正式移入 src/data 时由集成者改为 `./guides`。

定位是已经会开户、办证与通勤的居民。研究按“想完成什么”而非景点或平台数量排序；没有用户访谈或站内行为统计，以下优先级是编辑判断，不宣称需求调查结论。主要官方页面及实际运营方页面在本轮通过 web 搜索或读取复核；从登录后才能看到的资格、个人账单、库存与余位，没有代用户核验。

## 11 项长期居民任务与缺口

| 优先级 | 用户要完成的任务 | origin/main 已有覆盖 | 本轮处理 |
| --- | --- | --- | --- |
| P1 | 自动扣款多年后，知道全年实际花了多少、哪里值得换 | guides-settling-in 讲开户、搬家与首张账单 | 新增年度复核，而非重复开户 |
| P1 | 因收入或人数变化重新检查能源优惠 | 311/211 有援助转介，没有 CARE/FERA 具体操作链 | 新增现行项目入口、日期、家庭口径与办理顺序 |
| P1 | 避免把月度广告价当作全年通信成本 | 新居民基础手机/宽带内容 | 新增可复算全年成本、现有客户/新客与设备费用问题 |
| P1 | 已领 LifeLine，续期时不意外失去另一项福利 | 未检出单独说明 | 补 2026 州/联邦分开申请与续期 |
| P1 | 工作以外有一个能反复见人的场所 | 已有当期活动、ESL 和一般图书馆介绍 | 新增六周参与路径、实际出现与回访动作 |
| P1 | 志愿服务匹配体力、交通和家庭时间 | 未检出可持续参与的完整流程 | SF、East Bay、Midpen、Marin 四个区域入口 |
| P1 | 报社区课时分清收藏、候补和真正获得名额 | 既有教育内容侧重 ESL/学区 | 补注册状态、成本算例、奖助先于付费 |
| P1 | 只用一次的工具，从查资格到归还不白跑 | guides-local-life 提到工具馆；未形成取还流程 | 新增 Berkeley/Oakland 对照与资格、人工预约、归还 |
| P1 | 给坏物件一个可执行的修理机会 | guides-services 侧重联系维修服务商 | 新增活动受理、故障卡、参与学习和未修复后续 |
| P2 | 公园/博物馆年票是否能回本 | 已有景点、免费资格、Discover & Go 等 | 暂缓；需要按家庭人数、收费入口、实际频率分母另文研究 |
| P2 | 年度家庭行政：保险、税务、受益人、重要文件 | 既有搬家、应急及防骗覆盖部分 | 暂缓；专业规则差异大，另立官方来源与适用范围更合适 |

## 选择理由与边界

1. **年度账单复核**解决重复、可衡量的支出问题。提供账单台账、用量与费用分开、费率模拟、援助申请、全成本算例、变更后两期核对。金额算例明确为假设，不列未经实测的商业促销。单独标注 SFPUC 的账户条件，不能泛化到全湾区。
2. **六周社区参与**把“找活动”推进到“持续出现”。包括报名状态、现场入口、便利安排、候补、费用援助、首次开口与轻量延续。六周和三次出现是编辑建议，不是研究证明的交友公式。
3. **借工具与修理**解决储物、偶发采购和搁置坏物件。区分借用资格与一般借书证、人工预约与在线收藏、维修人工与零件费用，以及诊断成功与真正修复。未扩写基础垃圾分类，处置只作为失败后的官方查询出口。

三文都是操作型内容，无单独 heading block 填充数量：分别 26、25、28 个有内容的 paragraph/tip/link/template blocks；来源分别 7、8、8 个。共 198 条规范化中文→英文映射，字符串键按 trim + collapse whitespace 处理。

## 草稿清单

- `bay-area-household-bills-annual-review-2026`：26 blocks，7 sources，12 分钟阅读标记。
- `bay-area-build-recurring-community-routine-2026`：25 blocks，8 sources，12 分钟阅读标记。
- `bay-area-borrow-tools-repair-before-buying-2026`：28 blocks，8 sources，12 分钟阅读标记。

阅读时间为编辑估算。文本包括逐项目入口，不需要接入用户账户或提交申请。

## 逐源事实与限制

### 账单文

| 来源 | 本轮核对到的关键点 | 使用限制 |
| --- | --- | --- |
| [PG&E Rate Plans](https://www.pge.com/en/account/rate-plans.html) | 以实际用量比较；分时、EV、电气化住宅与 tariff 入口 | 个人模拟须登录；未核验任何家庭实际节省，不代替其他市政公司的费率 |
| [CPUC CARE / FERA](https://www.cpuc.ca.gov/consumer-support/financial-assistance-savings-and-discounts/family-electric-rate-assistance-program) | 当前表明确 2026-06-01 至 2027-05-31；FERA 表有 1–2 人家庭 | 不沿用三人最低户数；未把全户收入或各类账单当作可一概判断 |
| [CPUC ESA](https://www.cpuc.ca.gov/consumer-support/financial-assistance-savings-and-discounts/energy-savings-assistance) | 免费节能措施、公用事业申请入口 | 摘要页与独立 ESA 页资格文字有差别，采用独立页；不承诺某设备必换、不抄收入门槛、不把自行购物当报销 |
| [CPUC California LifeLine](https://www.cpuc.ca.gov/lifeline) | 一般每户一项电话优惠，家用电话与手机二选一 | 特殊例外回项目；不写每人一条，不承诺套餐或手机赠送 |
| [CPUC 2026-02-18 说明](https://www.cpuc.ca.gov/news-and-updates/all-news/california-lifeline-vs-federal-lifeline) | 2026-02-01 起州与联邦分开申请/续期 | 现有参与者按年度通知办，不要求读者立刻重复申请 |
| [SFPUC CAP](https://www.sfpuc.gov/accounts-services/bill-relief/customer-assistance-program-waterwastewater) | 本人账户、独立计量单户住宅等资格；线上/邮寄/525 Golden Gate 现场；处理及重申请时程 | 不能推广为所有 SF 租客或所有湾区水费优惠；不保证当场获批 |
| [FCC 26-48A2，2026-07](https://docs.fcc.gov/public/attachments/FCC-26-48A2.pdf) | 官方声明继续提供价格、促销、速度、流量标签信息 | 官网主标签页 403、PDF 直接读取失败，但官方 PDF 搜索结果返回全文；只采用这些直接可读信息，不解释各条法规生效、旧展示义务或 ACP 资格 |

刻意未使用：2016 PG&E ESA PDF、过期 CARE/FERA 收入表、2024 FCC “不得链接展示”规则作为 2026 结论。2026 FCC 标签已有修改，文中只建议索取当前 Broadband Facts 和完整报价。免费节能评估条件由服务单位核对。账单已经逾期时的付款安排与年度优化分别处理。

### 社区文

| 来源 | 本轮核对到的关键点 | 使用限制 |
| --- | --- | --- |
| [SF Park Volunteers](https://sfrecpark.org/1665/Park-Volunteers) | 个人/最多 9 人走工作日日历；更大团体另申请 | 不把公司团建直接塞进个人场次，不假定志愿身份免停车 |
| [EBRPD Volunteer](https://www.ebparks.org/volunteer) | 查询活动、建立账户报名、记录时间 | 页面仍有 9 月已过活动，未作为未来活动推荐 |
| [Midpen Volunteer](https://www.openspace.org/get-involved/volunteer) | 单日项目与长期承诺分开 | 不许诺讲解员或巡护可直接到场，培训/筛选逐岗位问 |
| [Marin Volunteer](https://parks.marincounty.gov/discoverlearn/volunteer) | 多年龄与能力、儿童成人陪同、装备及提前便利申请 | 个别活动坡度与工作强度不同；不把全湾区公园套用同一条件 |
| [SF Rec FAQ](https://apm.activecommunities.com/sfrecpark/ActiveNet_Home?FileName=faqPage.sdi) | 收藏≠候补≠正式报名；现场协助地址 | 注册热线在不同页面版本不一致，文中不写旧热线；没有核验实时席位 |
| [SF Rec Scholarship](https://www.sfrecpark.org/408/Apply-for-a-Scholarship) | SF 居民、申请可需两周、不追溯、通常两年复核 | 页面仍有 2025 收入表，特别提示申请时确认 2026 标准；不转载旧表或许诺免费名额 |
| [SFPL Book Clubs](https://sfpl.org/books-and-media/read/book-clubs-sfpl) | 当前分馆与主题目录 | 目录读取偶发失败，官方搜索返回当前目录；不把线上/线下或报名要求一概而论 |
| [Portola 2026-10-04](https://sfpl.org/events/2026/10/04/book-club-portola-silent-book-club) | 14–16 点、380 Bacon、自选书、安静阅读后交流、默认 drop-in | 明确带日期实例；不是永久星期日排期，活动过后需要回目录 |

Marin、SF、EBRPD 与 Midpen 已覆盖 SF/东湾/半岛南湾/北湾的进入方法，但不宣称列尽九县。社区参与的“六周三次”“单程约半小时”是可调整的编辑建议。未推断社会心理疗效、孤独治疗或保证交友。

### 借用与修理文

| 来源 | 本轮核对到的关键点 | 使用限制 |
| --- | --- | --- |
| [Berkeley Borrowing Tools](https://www.berkeleypubliclibrary.org/locations/tool-lending-library/borrowing-tools) | 居民/物业所有人、官方年龄文字 over 18、单独登记、证件/近期证明、不可随意转借 | 文中用“18 岁以上”保留原文边界；不把普通证与工具资格混同；不抄有版本歧义的续借次数 |
| [Berkeley Tool Library](https://www.berkeleypubliclibrary.org/locations/tool-lending-library) | Russell Street 地点、电话、目录与假日通知 | “Currently closed”是当前时段状态，不是停办；不写库存可用 |
| [Oakland Circulation Policy](https://oaklandlibrary.org/policies/circulation-policy/) | 三市、成人有效账户/照片证件/waiver；7 天、10 件、部分不续借、工具 hold 由员工办理、原馆室内归还 | 3 周是普通图书规则，不能套工具；只使用工具对应段落 |
| [Oakland Tool Library](https://oaklandlibrary.org/otll/) | 5205 Telegraph、电话、服务入口 | 活动余位与具体库存未核验 |
| [Fixit Clinic participant page](https://www.fixitclinic.org/p/scheduled-events.html?m=1) | 参与者要动手学习、当地登记、carry-in、配件与症状 | 直接读取偶发失败，但官方搜索返回参与全文；没有把全国日历当全湾区，未列未核对本地日期 |
| [Repair Café Silicon Valley FAQ](https://repaircafesv.org/faq/) | 外市居民可来、人工免费、零件按成本、例外物件、无修好保证 | 不引用成功率作个人概率，不保证零件在场；衣物维修不含改尺寸 |
| [Repair Café Silicon Valley calendar](https://repaircafesv.org/) | 10/8 Northside 傍晚且不修自行车；10/25 Mountain View 非仅长者，收件可早停 | 两个带日期示例，活动后应移除/换日期；未来场次不能沿用当场限制 |
| [StopWaste RE:Source](https://resource.stopwaste.org/) | 覆盖 Alameda、Contra Costa、Palo Alto；按物品/位置搜索 | 目录不收件，不代表列出的商家免费或当前仍受理；电话再核对 |

额外查到但未纳入正文：SMCL 2025 年缝纫机借用博客；其当前设备预约页未可靠展示 Grab & Sew 规则，因此不把旧文列为 2026 即时可借保证。旧 repaircafemv 地址不稳定，改用已经更名合并的 Repair Café Silicon Valley 官方站。维修中的火灾风险项目等不扩写技术操作，主办方受理排除项直接引回 FAQ。

## 既有署名图片建议

从 origin/main 的 guide-media.ts 与现有 asset/credit JSON 核对 key，保留其原始 credit、creditUrl、licenseUrl 和资料图片说明。不要用图片暗示已核验某现场或服务商。

| 新文 | cover key | inline key | 署名与使用说明 |
| --- | --- | --- | --- |
| 年度账单 | `coverage-laptop` | `neighborhood` | Ryan Riggins / CC0 的笔电资料图；dconvertini / CC BY-SA 2.0 的 Alamo Square 街景。不能称作真实客服页面或补助家庭 |
| 社区参与 | `library` | `redwoods` | SparkFun Electronics / CC BY 2.0，SFPL 总馆资料图；Tbo47 / CC0，Reinhardt Redwood 实景。不是 Portola 当场，也不是志愿活动照片 |
| 借用与修理 | `repair` | `library` | Shixart1985 / CC BY 2.0 的工具工作台资料图；SFPL 总馆为借用主题辅助，不能称作 Berkeley/Oakland 工具馆内景 |

有条件可只用 `repair` 作修理文主图并减少第二张图，避免把不相关分馆影像当作定位信息。上述图片均已经在既有数据中提供署名；本轮未生成或下载图片。

## 集成及后续复核

- 合并 draft 的 type-only import 后再接 guide aggregate、locale dictionary 和媒体映射；本轮没有改这些文件。
- 翻译 JSON 覆盖所有 Guide 内中文标题、摘要、分类标签、受众、tags、sources、blocks；英文 source title 为逐条翻译，URL 原样保留。
- 10/4 读书会在日期后只留为带日期示例或改成下一场；10/8、10/25 修理活动同理。长期流程与资格可以保留。
- 2027-06-01 前重新核对 CARE/FERA 与 ESA 收入年度。SF Rec 的 2025 收入表是已明确披露的来源限制，不能据此生成 2026 收入 eligibility 卡片。
- 每轮更新检查主办方日历、馆方规则与官网迁移；同一主办方的不同活动不能共享未经核验的收件限制。
