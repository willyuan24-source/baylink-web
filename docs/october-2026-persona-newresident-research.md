# 新居民任务缺口研究与三篇指南草稿

核验日期：2026-10-02，America/Los_Angeles。本轮只交付 output 内三份草稿，不修改 src、public、tests 或 backend，不发布、不生成图片。

## 基线和选题方法

先读原工作区的新人、搬家、交通、租房、图书馆、补助与日常生活指南；收到基线更新后，用 `git ls-tree -r --name-only origin/main -- src/data` 和 `git show` 重新检查远端指南清单、Guide 类型及五篇学校指南。对照的 origin/main 为 `417ac1bd0fb873fd569b923178574085b5724262`。本轮优先级是按办事影响与现有内容缺口作出的编辑判断，并非用户访谈或访问统计结论。

最新远端已经有 SF、East Bay、Peninsula、South Bay、North Bay 学校指南，见 guides-schools-sf-east.ts 与 guides-schools-peninsula-south-north.ts。它们已覆盖学区定位、区域学校、招生总览和学校参访；本轮不再写一篇泛化选校文。学年中转入文在开头链接五篇区域指南，专注旧校档案、当前学年材料审核、实际学校分配、健康资料、课程和第一天到校的衔接。

既有首次 7/30 天、机场第一晚、跨湾通勤、租房、开户和水电地址变更提供宏观顺序；图书馆、托育转介、食物银行、经济适用房、辅助交通、防骗和 311/211 已有独立内容。新文从这些概览中读者最容易卡住的具体环节继续往下走。

## 12 项具体需求与缺口

| 优先级 | 新居民要完成的任务 | 已有覆盖 | 本轮选择与边界 |
| --- | --- | --- | --- |
| P0 | 有了保险卡，但要找到实际接收新病人的医生 | 第一个月任务仅提醒建立医疗联系 | 新增精确计划、网络、接诊名额、PCP 指派分别确认的步骤 |
| P0 | 把旧病历、转诊、授权和口译送到正确接收方 | 未检出完整操作链 | 医疗文提供材料清单和追踪方法，不判断病情或治疗 |
| P1 | 找不到医生或暂未接上保险时知道下一步找谁 | 泛办事资源不能替代医疗渠道 | DMHC、Covered California、HRSA 各自分流，不判定资格或免费服务 |
| P1 | 看懂首次 EOB 与诊所账单为什么不同 | 防骗指南侧重诈骗，不是正常医疗计费 | 医疗文区分估算、EOB、账单与申诉，不计算个人应付额 |
| P0 | 学年中搬家，让旧校记录与新校报到接上 | 五篇区域学校指南已有总览 | 新增记录交接、当前学年选择、完成审核和正式分配的状态检查 |
| P0 | 让高中课程、IEP/504 和语言支持继续衔接 | 地区总览介绍项目，缺少交接清单 | 给家长向 registrar、counselor、support team 提问的具体事项，不承诺学分或服务决定 |
| P0 | 缺地址或健康材料时避免自己判断不能入学 | 一般材料清单不足以处理失败路径 | 各学区官方替代材料入口、合资格无家可归学生 liaison；不把某区或特定法律规则套全湾区 |
| P1 | 手机能否用、能否保留号码、实际住处有无服务 | 新人总览只列开通手机 | 新增兼容性、转号、开通验证、地点实测和标签比较，不排行运营商 |
| P1 | 开户身份核验卡住、账户开好但尚不能付款 | 宏观开户提醒 | FDIC 流程、具体机构材料、近期搬家线上失败后转人工；不保证无 SSN/ITIN 的开户结果 |
| P1 | 第一张账单、自动扣款、退订与退设备不一致 | 防骗和年度账单复核与初次开通不同 | 新增合同、扣款授权和设备归还的独立确认，FCC/CPUC/CFPB 分流 |
| P1 | 租房、通勤、7/30 天安排、图书馆与生活补助 | 已有多篇独立指南 | 保留现有覆盖，避免第三次写同一大清单 |
| P2 | 个体诊疗、移民身份、税务、投资和法律争议结果 | 不适合作为统一新居民承诺 | 不在这三文中推断，保留机构或专业人员判断 |

## 三文选择理由和交付清单

1. `bay-area-first-doctor-insurance-network-guide`：把“有卡”推进到“诊所、计划、时间和资料已分别确认”。28 blocks，其中 20 个非 heading 实用块，8 个来源；9 分钟为编辑阅读估算。
2. `bay-area-k12-midyear-enrollment-guide`：把“网上已提交”推进到“记录、分配、支持和到校时间已接上”。35 blocks，其中 27 个非 heading 块，8 个来源；10 分钟为编辑估算。五个地区内链用于分工，不重复现有选校内容。
3. `bay-area-phone-bank-first-bill-guide`：把“账户已开”推进到“确实可用、费用对得上、问题有可追踪入口”。30 blocks，其中 23 个非 heading 块，8 个来源；9 分钟为编辑估算。

三文共 93 blocks、70 个非 heading 实用块、24 条来源、220 条中文到英文映射。正文使用具体材料、电话提问、状态区别、失败后入口与私人追踪模板；未用大量标题凑 18 块。没有虚构价格、剩余名额、资格结论或个人账单结果。

## 来源核验记录

以下均在 2026-10-02 本轮查询。写明“官方搜索全文/摘要”的项目表示搜索工具实际返回了该机构页面的内容；不声称已完整打开网站或 PDF。所有关键规则尽量缩小到来源可支持的范围，不能把搜索摘要当个人资格判定。

### 首次医疗联系：8 个来源

| 官方来源 | 已核对事实与访问方式 | 本文采用范围与限制 |
| --- | --- | --- |
| [DMHC：You and Your Doctor](https://www.dmhc.ca.gov/HealthCareinCalifornia/YourHealthCareRights/YouandYourDoctor.aspx) | 直接读取；PCP、medical group、医生名单、接收新病人、语言协助、就诊准备 | 不把 HMO 的 PCP 规则当作所有计划共同规则；有网络名单不等于当前有名额 |
| [DMHC：Timely Access](https://www.dmhc.ca.gov/HealthCareinCalifornia/YourHealthCareRights/TimelyAccesstoCare.aspx) | 直接读取；适用计划非急诊基层医生 10 工作日、专科 15 工作日；有例外及计划协助 | 写明监管适用范围和例外，不用行政时限判断读者可以安全等待多久 |
| [DMHC：File a Complaint](https://www.dmhc.ca.gov/FileaComplaint.aspx) | 直接读取；一般先走计划 grievance，30 天未解决或不满意答复可按流程求助，紧急问题另有途径 | 不保证每个保险计划都归 DMHC、不承诺申诉结果；协助人使用授权而非共享密码 |
| [CMS：Health Insurance Terms](https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/get-help/medical-bill-guides-resources/health-insurance-terms-you-should-know) | 官方搜索内容；copay、deductible、coinsurance、EOB 不是账单及 Good Faith Estimate | 只教核对和提问；不算个人应付，不保证所有场景都有同一估算权利 |
| [UCSF：Primary Care](https://www.ucsfhealth.org/care/services/primary-care) | 直接读取；基层医疗、地点、提供方和预约入口 | 是本地实际机构示例，不是医院排名或接受读者计划的保证，也未查实时余位 |
| [SCVMC：Phone Directory](https://scvmc.scvh.org/contact-us/phone-directory) | 直接读取；Appointments & Advice 为 888-334-1000；账单和费用协助分设联系 | 按正确部门联络，不承诺 South Bay 居民一律可登记或免费 |
| [Covered California：Find an Enroller](https://www.coveredca.com/get-help/find-an-enroller) | 直接读取；按位置搜索免费申请/选计划帮助，含语言相关查询 | 免费的是官方所述帮助，不等于保险或就医免费；身份、收入、窗口与资格由申请流程确认 |
| [HRSA：Find a Health Center](https://findahealthcenter.hrsa.gov/) | 动态主页直接读取无正文；官方搜索结果确认城市、州、邮编和半径搜索 | 只作为社区健康中心定位入口；逐机构问新病人、语言、费用和材料，不承诺即日或免费 |

医疗导航还包括编辑整理的“双向网络确认”“三家可达候选”“预约后剩余事项”模板。这些是办事方法，不冒充某机构的强制材料表。急诊仅指向 911，未扩写症状分诊或诊疗建议。

### 学年中入学交接：8 个来源

| 官方来源 | 已核对事实与访问方式 | 本文采用范围与限制 |
| --- | --- | --- |
| [SFUSD：Apply](https://www.sfusd.edu/schools/enroll/apply) | 直接及官方搜索读取；当前 2026–27 学年申请、ParentVUE/纸表/现场与 Enrollment Center | 不把未来 2027–28 招生时间当当前转入截止；不保证首选学校 |
| [SFUSD：Requirements](https://www.sfusd.edu/schools/enroll/apply/requirements) | 直接读取；出生和居住材料、部分近期证明 45 天、手机账单不被接受、无法取得材料时的 affidavit 入口 | “45 天”只修饰该页对应材料，不延伸到所有证明或所有学区；健康资料由校方审核 |
| [SMFCSD：2026–27 New Student Registration](https://www.smfcsd.net/district-departments/student-services/enrollment/2026-2027-new-student-registration-process) | 直接读取；四步流程，第 4 步文件核验；Aeries Registration 与 Parent Portal 账户不同 | 优先报名已过不代表整个学年停止注册；容量与 overflow 个案核查，不承诺邻近校有位 |
| [SJUSD：Enrollment](https://www.sjusd.org/enrollment) | 直接读取；2026–27 与 2027–28 onward 的 locator 不同；材料审核、邮件确认、线上或现场入口 | 不给未核对的 processing days；“提交”与“确认完整”不同；按所需学年看边界 |
| [SMUHSD：Enroll a New Student](https://www.smuhsd.org/departments/student-services/enroll-a-new-student) | 直接读取；当前学年 Schoolmint、材料与 placement 确认；650-558-2251、enrollment@smuhsd.org | 此处是高中学区，不当作 Peninsula 所有 K–12 流程；未来年级与开窗时间不混用 |
| [CDPH：School Immunization FAQs](https://www.cdph.ca.gov/Programs/CID/DCDC/Pages/Immunization/School/laws-requirement-faqs.aspx) | 官方搜索内容及现行学校免疫手册交叉核对；FAQ 直接读取失败 | 只要求交原始记录、问校方/临床方审核及缺件路径；没有复制剂次表、豁免判断或有条件 30 日规则 |
| [CDE：Homeless Youth](https://www.cde.ca.gov/ds/sg/homelessyouth.asp) | 官方搜索内容；符合范围的学生即使缺少普通注册材料也有立即入学保护与 liaison | 不把所有住酒店或短租的家庭自动判为符合范围；让学区 liaison 判断与协助 |
| [SJUSD：Health Information](https://www.sjusd.org/resources/health-information) | 直接读取；学校健康联系、表格、用药与免疫咨询入口 | 用于问清校园健康安排；不建议药物、不替代诊疗或校方审批 |

旧校 registrar 记录请求、高中 counselor 课程衔接、IEP/504 交接、第一天交通餐食与课后照护是编辑流程清单。学分、服务方案、年龄、课后项目费用和实际开学日均由接收方确认。第 3 天、第一周回查是编辑建议，不是全湾区法定时限。

### 手机、银行、第一张账单：8 个来源

| 官方来源 | 已核对事实与访问方式 | 本文采用范围与限制 |
| --- | --- | --- |
| [FCC：Consumer Complaints Center](https://consumercomplaints.fcc.gov/hc/en-us) | 直接读取；电话/网络账单、转号、解锁等入口；Share Your Story 不走正式投诉流程 | 导航到对应分类，不承诺运营商退款或某时限完成转号；手机解锁不等于设备必兼容 |
| [FCC 26-48A2：2026 年 7 月声明](https://docs.fcc.gov/public/attachments/FCC-26-48A2.pdf) | 官方搜索返回全文，2026-07-22 Report and Order 相关声明；直接 PDF 返回 403。声明明确保留价格、促销、速度与流量信息；另查 2026-08-13 Federal Register 官方文本交叉核对 | 已替换原草稿 2024 DA-24-1276A1 来源和英译。只采用仍保留的信息字段；不沿用 2024 展示形式/机器可读/存档义务，也不解释各条生效日期或已结束 ACP 资格 |
| [CPUC：Utility Complaint](https://www.cpuc.ca.gov/consumer-support/file-a-complaint/utility-complaint) | 直接读取；先联系服务方，CAB 材料和正式入口；不受理市营公用服务投诉 | 按监管对象分流，不把所有家庭账单交 CPUC；不建议因申诉而自行停止付款 |
| [FDIC：How to Open a Bank Account](https://www.fdic.gov/getbanked/pdf/how-to-open-a-bank-account.pdf) | 官方搜索 PDF 内容；选择、准备身份证明、申请、存款、条款和启用；近期搬家可能造成线上核验失败。直接 PDF 读取失败 | 只列询问材料和失败后转人工/分行；银行决定可接受材料，不保证特定国籍证件、SSN/ITIN 状态必获开户 |
| [CFPB：Automatic Payments](https://www.consumerfinance.gov/ask-cfpb/how-do-automatic-payments-from-a-bank-account-work-en-2021/) | 官方搜索全文，页面复核日期 2026-08-28；商家自动扣款与银行 bill pay 不同、授权与余额管理 | 不推荐具体账户，不把 pending 入账当 available balance，不假定任何具体费用 |
| [CFPB：Stop Automatic Payments](https://www.consumerfinance.gov/ask-cfpb/how-do-i-stop-automatic-payments-from-my-bank-account-en-2023/) | 官方搜索全文，页面复核日期 2026-08-28；分别联系商家与银行；停止扣款不取消合同或已欠款 | 不承诺退款、不断言特定 stop-payment 费用；提示及时询问本人交易适用期限 |
| [CFPB：Submit a Complaint](https://www.consumerfinance.gov/complaint/) | 直接读取；金融产品/服务投诉与处理分流 | 不把常见答复时间当必然时限或退款承诺；敏感材料仅交官方安全渠道 |
| [FTC：Free Trials and Subscriptions](https://consumer.ftc.gov/articles/getting-and-out-free-trials-auto-renewals-and-negative-option-subscriptions) | 官方搜索全文，页面原发布于 2024-09；条款、试用结束、取消记录、继续收费后及时联系发卡方 | 使用仍适用的一般操作说明，不声称 2024 click-to-cancel 规则在 2026 全面有效，不保证 chargeback 结果 |

手机转号顺序另用 FCC 官方 porting 指南及官方资料交叉核对，未照搬旧文件的小时/天数承诺。首次必要的小额支付验证、家里/工作地/通勤点实测和四份账户文件是编辑工具，不是银行或运营商统一要求。

## 排除和不确定性处理

- 搜索中出现的异州、同缩写学区（例如 St. Johns、San Diego）未使用。没有拿一个学区的身份证明或学校容量规则当全湾区规定。
- SF 历年旧健康资料 PDF、论坛推荐、未核实的商业开户奖励和实时预约库存未用于“最新”结论。
- 已读取 2026 FCC 官方声明；旧 2024 来源不再作为当前展示义务依据。标签是比较工具，家庭实际合同、设备分期和语音服务要分别核对。
- 需要登录的个人计划网络、订单、余额、资格、转学申请状态不在公开核验范围内；每篇把确认对象写给读者，而非假装已经代查。
- 医疗、教育、金融部分仅作操作导航，涉及具体受理资格、时限适用、服务方案和应付金额时引回主管机构或实际提供方。

## 已有署名图片复用建议

已读原工作区及 origin/main 的 guide-media.ts、content-coverage-media.json、art-media-assets.json 和 schools-media.json。学校图片 key 来自最新远端，本地旧基线可能没有。集成时保持 asset 记录原来的 caption、credit、creditUrl、licenseUrl，不复制图片或改造署名。

| 新文 | cover key | inline key | 使用说明 |
| --- | --- | --- | --- |
| 首次医生与保险网络 | `settling` | `coverage-laptop` | settling 为 BAYLINK AI 原创安顿主题插图，不当真实诊所；笔电为 Ryan Riggins / CC0 资料照片，不当作某医疗门户截图或保险合作背书 |
| 学年中转入 | `school-east` | `school-south` | BAYLINK AI 原创学校插图；原 caption 明确校园人物虚构，不代表学校、学区边界或招生承诺；适合作材料交接场景 |
| 手机、银行与账单 | `coverage-laptop` | `digital-safety` | 笔电为 2017 年 CC0 资料照片；digital-safety 为 BAYLINK AI 原创隐私主题插图，不当金融机构标识或真实账户界面 |

coverage-laptop 原署名为 “Ryan Riggins / CC0 · 已缩放压缩，卡片可能裁切”，原来源为 Wikimedia Commons Laptop and a mug (Unsplash)，许可链接为 CC0。学校和 digital-safety 原署名为 “BAYLINK · AI 原创插图”。未建议把成人学院/图书馆照片充作 K–12 学校或诊所内景。

## 验证与集成说明

- Type-only import 为 `../../src/data/guides`；由 root 正式移入 src/data 时改为 `./guides`。Guide 对象为静态字面量，无生成器、运行时翻译注册或新依赖。
- 对全部 Guide 对象递归采集中文字符串，与 en.json 检查：220 个规范化唯一中文字符串、220 个英文条目、0 缺失、0 未归一化 key、0 含中文的英文 value。key 使用与 locale.normalizeText 一致的 trim + 空白折叠；模板英文 value 保留实际换行。
- 三个 slug 在 origin/main 的全部 guides*.ts 中没有冲突。每篇 8 个来源，28/35/30 blocks，去掉 heading 后仍为 20/27/23 个。
- 定向 TypeScript 检查已加载项目既有 opencc-search.d.ts，通过，0 errors；未改已有类型声明。翻译在正式接入 locale dictionary 后由 root 做运行时界面检查，本草稿不擅改聚合入口。
- 正式接入时仍需核验官方入口未迁移，并保留目前的来源访问限制说明；当前 2026–27 学年示例在换学年时应整体复核。
