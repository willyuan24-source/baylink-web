import type { Guide } from './guides';

/** Official facts checked 2026-10-02; the linked research ledger records boundaries. */
export const establishedResidentPersonaGuides: Guide[] = [
  {
    "slug": "bay-area-household-bills-annual-review-2026",
    "title": "湾区住久了，账单也该重算：水电、宽带与手机年度复核",
    "subtitle": "用过去 12 个月的真实支出，决定换费率、申请减免还是保持现状",
    "summary": "适合已经开户、却多年没重新比较费用的家庭。从全年账单与用量复盘，到 CARE、FERA、节能服务、LifeLine 分开续期和 SFPUC 水费资格，完成一次有记录、有后续检查的年度复核。",
    "category": "service",
    "categoryLabel": "长期居民 · 家庭支出",
    "emoji": "🧾",
    "audience": [
      "已在湾区稳定居住的家庭",
      "远程工作、添置电车或家庭人数变化的人"
    ],
    "tags": [
      "年度账单",
      "CARE / FERA",
      "LifeLine",
      "水电网"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "service",
      "other"
    ],
    "readMinutes": 12,
    "updatedAt": "2026-10-02",
    "sourceNote": "官方项目资料核验于 2026 年 10 月 2 日。下列复核顺序、时间预算和算例是编辑建议；优惠须由实际服务商按当前家庭与账户资料审核，本文不保证获批或节省金额。",
    "sources": [
      {
        "title": "PG&E：按实际用量比较费率",
        "url": "https://www.pge.com/en/account/rate-plans.html",
        "description": "费率比较、分时、电车与电气化住宅方案的官方入口。"
      },
      {
        "title": "CPUC：2026–2027 CARE / FERA",
        "url": "https://www.cpuc.ca.gov/consumer-support/financial-assistance-savings-and-discounts/family-electric-rate-assistance-program",
        "description": "核对折扣、家庭人数与当期收入表，向实际公用事业公司申请。"
      },
      {
        "title": "CPUC：Energy Savings Assistance",
        "url": "https://www.cpuc.ca.gov/consumer-support/financial-assistance-savings-and-discounts/energy-savings-assistance",
        "description": "核对免费节能服务及公用事业公司联系入口。"
      },
      {
        "title": "CPUC：California LifeLine 资格",
        "url": "https://www.cpuc.ca.gov/lifeline",
        "description": "核对每户电话优惠限制与资格申请资料。"
      },
      {
        "title": "CPUC：2026 LifeLine 州与联邦流程",
        "url": "https://www.cpuc.ca.gov/news-and-updates/all-news/california-lifeline-vs-federal-lifeline",
        "description": "2026 年 2 月起两项计划须分别申请、分别续期。"
      },
      {
        "title": "SFPUC：水与污水 CAP",
        "url": "https://www.sfpuc.gov/accounts-services/bill-relief/customer-assistance-program-waterwastewater",
        "description": "核对账户类型、收入、现场入口、处理时间与重新申请要求。"
      },
      {
        "title": "FCC：2026 宽带标签说明",
        "url": "https://docs.fcc.gov/public/attachments/FCC-26-48A2.pdf",
        "description": "7 月官方声明确认继续提供价格、促销期、速度与流量信息；本文不解读各项规则生效日。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "这篇适合“每月自动扣款都正常，但越来越贵”的家庭。编辑建议一年做一次，另在添置电车、开始居家办公、室友搬走或促销到期时加做一次。目标是找出可执行的变化，而不是把每个最低广告价都换一遍。"
      },
      {
        "type": "heading",
        "text": "先整理一年的账单与用量"
      },
      {
        "type": "tip",
        "title": "先安排两段时间",
        "text": "编辑建议先用 45 分钟整理，再用 30 分钟联系服务商；这只是工作量预算。涉及身份核验、上门评估或安装的项目另约时间，不把它们压进同一下午。"
      },
      {
        "type": "paragraph",
        "text": "把电、燃气、水、污水、宽带和每条手机线路各列一行：实际公司、户名、服务地址、当前方案、自动扣款方式、优惠结束日、租赁设备。水费若由物业分摊，先标明“非本人直接账户”，再问可查看哪份原始账单。"
      },
      {
        "type": "paragraph",
        "text": "下载过去 12 个月账单，分别记总金额和用量。电看 kWh，燃气看 therms，水看账单的计量单位；不要把总额上升直接解释成单价上涨。新添设备、计费天数和家庭人数都可能改变比较结果。"
      },
      {
        "type": "tip",
        "title": "只比较同样服务范围的数字",
        "text": "先把常规费用、一次性费用和欠款补缴分开，再比较。客服给出预计节省时，请确认是否包含所有账单项目、税费、固定费及现有优惠；不把某一行费用下降当作全账单下降。"
      },
      {
        "type": "heading",
        "text": "电与燃气：比较费率，再核对援助"
      },
      {
        "type": "link",
        "title": "打开 PG&E 费率比较",
        "text": "在官方 Rate Plans 页选择按实际用量比较并登录自己的账户。保存当前方案、候选方案与估算日期；具体价格继续查看该页连接的现行 tariff。",
        "url": "https://www.pge.com/en/account/rate-plans.html"
      },
      {
        "type": "paragraph",
        "text": "看到分时或电车方案时，先写出家里确实能移动的用电：洗衣、充电或其他大用量设备。编辑建议按实际生活作息比较，不能挪动的晚餐和照护需求照旧计入，不用理想化的作息证明某方案划算。"
      },
      {
        "type": "paragraph",
        "text": "如果过去一年只有部分月份有电车、太阳能或热泵，历史用量未必代表下一年。切换前问服务商：估算用了多久的数据，是否涵盖新设备，何时生效，多久可再次切换，以及哪些原方案条件可能失去。把答复写进记录。"
      },
      {
        "type": "tip",
        "title": "先认清自己的供电单位",
        "text": "PG&E 的比较工具只用于对应账户。若账单来自其他市政公用事业或有其他供电项目，向账单所列单位问可选方案和援助入口，不套用 PG&E 的费率、折扣比例或申请结果。"
      },
      {
        "type": "paragraph",
        "text": "CPUC 当前 CARE 页面说明：符合资格者可获得电费约 30%–35%、燃气费 20% 的项目折扣，具体适用由公用事业公司确认。核验到的收入表有效期为 2026 年 6 月 1 日至 2027 年 5 月 31 日；参加列明公共援助项目也可能是资格路径。"
      },
      {
        "type": "paragraph",
        "text": "CARE 不符合时，再看 FERA，不自行判断“收入差一点就没帮助”。CPUC 列明 FERA 电费折扣为 18%，覆盖 PG&E 等指定公司；2026–2027 表也列有 1–2 人家庭。按当期表和真实家庭资料咨询，别继续沿用“必须三人以上”的旧说法。"
      },
      {
        "type": "link",
        "title": "从 CPUC 进入 CARE / FERA 申请单位",
        "text": "先核对当期家庭人数和收入口径，再使用页面中的本公司链接或联系电话。账单减免与费用分摊问题分开处理；合租者不要只填自己的工资就认定全户合格。",
        "url": "https://www.cpuc.ca.gov/consumer-support/financial-assistance-savings-and-discounts/family-electric-rate-assistance-program"
      },
      {
        "type": "paragraph",
        "text": "如果问题是房屋漏风或旧设备耗能，另查 Energy Savings Assistance。CPUC 列有符合条件家庭可获的免费节能服务，例如密封和保温改善；这不是先自行买电器、再保证报销的购物券。先走公用事业公司的评估入口，再决定工程。"
      },
      {
        "type": "tip",
        "title": "租客先确认房屋与施工条件",
        "text": "询问项目人员是否适用你的房屋类型、需要谁同意、是否需房东或物业配合入户。即使收入条件看似符合，也先拿到具体措施和安排；没有核准的项目不计入家庭预计收益。"
      },
      {
        "type": "heading",
        "text": "宽带与手机：按全年成本比较"
      },
      {
        "type": "paragraph",
        "text": "宽带先用完整地址和单元号向服务商确认可安装，再比较方案。FCC 2026 年说明仍保留价格、促销价格、速度和流量信息；在运营商页面找 Broadband Facts，并另问设备租金、安装、自动扣款条件和促销结束价。不要只截首页大字价格。"
      },
      {
        "type": "tip",
        "title": "用 12 个月总额比较宽带",
        "text": "编辑算例，非真实报价：A 前 6 个月 $40、后 6 个月 $70，加设备每月 $10、安装 $50，首年为 $830；B 每月 $60、设备包含且无安装费，首年为 $720。A 的广告月价低，按这些假设首年仍贵 $110。第二年要另外重算。"
      },
      {
        "type": "paragraph",
        "text": "向当前宽带商问“现有客户能转的方案”，向新公司问“这个地址的新客户资格”。把合同期、取消费、设备退还地点和最终账单处理写入比较表。编辑建议先确认新服务可用，再安排旧服务结束；短暂重叠费用也算进成本。"
      },
      {
        "type": "paragraph",
        "text": "手机按全家所有线路加总：服务费、分期手机、保险、附加订阅和国际使用需求分别列出。减少线路或换公司前，要求书面说明未付设备款与剩余促销抵扣会怎样变化。编辑建议在家、工作地和常走路线验证信号后再做长期承诺。"
      },
      {
        "type": "paragraph",
        "text": "California LifeLine 是符合资格家庭的电话服务优惠。官方限制通常每户一项优惠电话服务，在家用电话与手机之间选择；特殊例外由项目核对。不要把“每个人都可领一条”或普通运营商促销当成同一计划。"
      },
      {
        "type": "tip",
        "title": "2026 年续期最容易漏的一步",
        "text": "CPUC 确认自 2026 年 2 月 1 日起，California LifeLine 与 federal Lifeline 要分别申请和续期。已同时参加者按收到的年度续期要求办理；把两项状态分别记录，不把完成其中一个当作两个都完成。"
      },
      {
        "type": "link",
        "title": "核对 LifeLine 资格与办理入口",
        "text": "从 CPUC 页面进入当前项目网站，核对参与公司、家庭定义及所需材料；已有服务者直接向自己的参与公司确认续期状态和保号安排。",
        "url": "https://www.cpuc.ca.gov/lifeline"
      },
      {
        "type": "heading",
        "text": "水费：按账户类型核对资格"
      },
      {
        "type": "paragraph",
        "text": "水费按实际账单单位查，不按邮寄城市名猜。以 SFPUC 为例，CAP 可能减免 25% 或 40%，但须同时满足本人名下唯一 SFPUC 水污水账户、全职住在该址、独立计量的单户住宅账户、非他人税表被扶养人，以及项目家庭总收入要求。整栋共表或物业统一分摊不能直接套用。"
      },
      {
        "type": "link",
        "title": "SFPUC CAP：网上或现场申请",
        "text": "官方页提供网上与邮寄方式，现场入口为 525 Golden Gate Avenue 一楼客服。资料写明处理约 3–4 周，获批后第一个完整账单周期开始，通常 36 个月需重新申请；前往前核对服务时间。",
        "url": "https://www.sfpuc.gov/accounts-services/bill-relief/customer-assistance-program-waterwastewater"
      },
      {
        "type": "tip",
        "title": "不获批、共表或材料不齐时",
        "text": "先让机构说明具体原因：收入、账户类型、证明还是现有申请状态。水费共表者向物业问分摊账单；账单已逾期者向原公司另问付款安排。年度省钱计划和正在处理的到期账单分开追踪，申请中不等于付款已暂停。"
      },
      {
        "type": "heading",
        "text": "落实变更，并检查后续账单"
      },
      {
        "type": "template",
        "title": "给客服的一段复核请求",
        "text": "我正在复核家庭年度支出。请按我的服务地址与现有客户身份确认：当前方案和优惠何时结束；有哪些可转方案；所有固定费、设备费与一次性费用是多少；变更何时生效；我可能适用哪些援助及续期步骤。请提供书面方案和确认编号，我会比较完整年度费用后决定。"
      },
      {
        "type": "paragraph",
        "text": "最后只挑一到两项收益最清楚、执行最容易的变化。设提醒检查变更后的首个完整账单及再下一期：方案名称、设备费、优惠和服务是否一致。把优惠结束前 30 天设为编辑建议的复查点；只有账单确认的差额才记为实际节省。"
      }
    ]
  },
  {
    "slug": "bay-area-build-recurring-community-routine-2026",
    "title": "在湾区住了几年，怎样认识固定见面的人：六周社区参与计划",
    "subtitle": "从一次报名走到第二次、第三次出现，给日历留一个可持续的位置",
    "summary": "围绕公园志愿、图书馆读书会与社区课程，按旧金山、东湾、半岛南湾和 Marin 找入口。把交通、强度、报名、候补、费用援助和现场开口具体化，帮助长期居民建立能重复参加的线下生活。",
    "category": "events",
    "categoryLabel": "长期居民 · 社区参与",
    "emoji": "🤝",
    "audience": [
      "想扩大同事之外社交圈的居民",
      "独居、远程工作或孩子长大后的家庭"
    ],
    "tags": [
      "志愿服务",
      "社区课程",
      "读书会",
      "线下社交"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 12,
    "updatedAt": "2026-10-02",
    "sourceNote": "入口与规则核验于 2026 年 10 月 2 日。六周安排、对话示例和时间分配是编辑建议，不保证特定社交结果。活动日期、年龄、场地、余位和取消通知以每场官方页面为准；文中 10 月活动是带日期示例。",
    "sources": [
      {
        "title": "SF Rec & Park：公园志愿者",
        "url": "https://sfrecpark.org/1665/Park-Volunteers",
        "description": "个人与小组报名、较大团体申请周期和联系方式。"
      },
      {
        "title": "East Bay Regional Parks：志愿者入口",
        "url": "https://www.ebparks.org/volunteer",
        "description": "查活动、建立志愿账户并记录服务时间。"
      },
      {
        "title": "Midpen：单日与长期志愿项目",
        "url": "https://www.openspace.org/get-involved/volunteer",
        "description": "区分体验型工作日与需长期投入的岗位。"
      },
      {
        "title": "Marin County Parks：社区志愿日",
        "url": "https://parks.marincounty.gov/discoverlearn/volunteer",
        "description": "核对体力要求、儿童陪同、装备与便利安排申请。"
      },
      {
        "title": "SF Rec：网上报名常见问题",
        "url": "https://apm.activecommunities.com/sfrecpark/ActiveNet_Home?FileName=faqPage.sdi",
        "description": "区分收藏、候补与正式报名，确认费用及现场协助入口。"
      },
      {
        "title": "SF Rec & Park：课程奖助申请",
        "url": "https://www.sfrecpark.org/408/Apply-for-a-Scholarship",
        "description": "SF 居住要求、申请资料、最长两周处理与不追溯优惠。"
      },
      {
        "title": "SFPL：读书会目录",
        "url": "https://sfpl.org/books-and-media/read/book-clubs-sfpl",
        "description": "按当前分馆活动寻找讨论型或安静阅读型聚会。"
      },
      {
        "title": "SFPL：2026 年 10 月 4 日 Portola Silent Book Club",
        "url": "https://sfpl.org/events/2026/10/04/book-club-portola-silent-book-club",
        "description": "当期实例的地点、自选阅读形式、登记规则和便利安排。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "如果你已经熟悉通勤和生活手续，却发现周末总是自己过，可以先试一个很小的目标：六周内，在同一个地方出现三次。这里的“三次”是编辑建议，目的是让报名变成习惯；它不保证交到朋友，也不要求你把空闲时间全填满。"
      },
      {
        "type": "heading",
        "text": "先选能持续参加的形式与地点"
      },
      {
        "type": "tip",
        "title": "先选你能长期到达的地方",
        "text": "编辑建议从单程约 30 分钟以内找起；把真实下班时间、接孩子和回家交通算进去。一个名气普通但能持续参加的项目，通常更适合建立日常联系。跨湾活动先做一次试走，再承诺整期课程。"
      },
      {
        "type": "paragraph",
        "text": "先选一种相处方式：喜欢边做边聊，选植栽或园务工作日；愿意围绕明确话题交谈，选读书会；希望固定时间见同一批人，选多周课程。暂时不想大量说话的人，可先选安静阅读或任务明确的活动。"
      },
      {
        "type": "paragraph",
        "text": "做一个只有三项的候选表，每项记下一场确切日期、单程时间、预计花费、体力要求和报名截止。最后保留一个主项目、一个室内替补；不要把订阅十个邮件列表误当成已经开始参与。"
      },
      {
        "type": "heading",
        "text": "公园志愿：按地区找到合适场次"
      },
      {
        "type": "link",
        "title": "旧金山：从公园工作日选择具体场次",
        "text": "SF Rec & Park 将个人及最多 9 人的小组引向志愿日历。打开场次核对集合点、所需准备和报名，而不是只收藏公园名称；有疑问可用页面的志愿办公室联系方式。",
        "url": "https://sfrecpark.org/1665/Park-Volunteers"
      },
      {
        "type": "tip",
        "title": "十个人以上，改走团体申请",
        "text": "官方对 10–99 人团体要求预留最多五周处理，100 人以上最多三个月。想约同事一起做志愿，先统计人数并走团体表单，不把十几个人直接带进个人报名场次。"
      },
      {
        "type": "link",
        "title": "东湾：报名账户与服务时间放在一起",
        "text": "East Bay Regional Parks 的官方流程是先找 Volunteer Events，再建志愿账户报名与记录时间。按离家近的公园筛选恢复栖地、园务或步道项目，逐场核对年龄和工作强度。",
        "url": "https://www.ebparks.org/volunteer"
      },
      {
        "type": "link",
        "title": "半岛与南湾：先试 Midpen 单日项目",
        "text": "Midpen 同时提供单日土地照护项目和长期岗位。第一次先走 single-day 入口；若喜欢，再问长期岗位的培训与承诺。不要把导览员或巡护岗位理解成随到随做。",
        "url": "https://www.openspace.org/get-involved/volunteer"
      },
      {
        "type": "link",
        "title": "Marin：先匹配体力，再带家人参加",
        "text": "Marin County Parks 欢迎不同年龄与能力的参与者，儿童须成人陪同；多数活动提供工具、手套和训练。仍需看具体场次的坡度与重体力提示，自带水瓶、结实鞋和分层衣物。",
        "url": "https://parks.marincounty.gov/discoverlearn/volunteer"
      },
      {
        "type": "paragraph",
        "text": "公园活动当天的现场入口是该场“集合点”，不一定是游客中心或公园主门。出发前保存负责人联系方式、停车或公交下车点、卫生间和回程安排。志愿身份是否免停车或其他费用需要逐场问，不自行推定。"
      },
      {
        "type": "tip",
        "title": "有行动或沟通需求，提前写清楚",
        "text": "用具体需求提问，例如能否坐着操作、是否有平路任务、能否听到现场说明。Marin 官方建议便利安排至少提前五个工作日申请；SFPL 的对应活动页建议至少三个工作日联系。其他主办方按自己的流程处理。"
      },
      {
        "type": "heading",
        "text": "图书馆读书会：找到舒服的交流方式"
      },
      {
        "type": "link",
        "title": "图书馆：用阅读形式筛选，而非只看书名",
        "text": "SFPL 目录有不同分馆与主题。打开单场看是否指定书、是否线上、语言、年龄及登记要求；没有读完指定书时，先问是否欢迎旁听，不把讨论型读书会当成自由阅读场。",
        "url": "https://sfpl.org/books-and-media/read/book-clubs-sfpl"
      },
      {
        "type": "tip",
        "title": "带日期的入门实例：Portola 安静读书会",
        "text": "2026 年 10 月 4 日 14:00–16:00，Portola 分馆 380 Bacon Street，可自带或借一本喜欢的书，先安静阅读再轻松交流。该页说明未另注时不需报名。日期过后请回目录找下一场，不将这个周日当作永久固定排期。"
      },
      {
        "type": "paragraph",
        "text": "不方便提前读完一本书的人，可以优先自选书的安静阅读形式；希望练表达的人，再选讨论型。第一次的目标可以只是听清活动流程、和一人交换书名、问下一次日期。你不需要先证明自己“很会聊天”。"
      },
      {
        "type": "heading",
        "text": "社区课程：确认名额、费用与援助"
      },
      {
        "type": "link",
        "title": "课程：先读活动详情，再完成结算",
        "text": "SF Rec 报名 FAQ 连接活动搜索与账户流程。按年龄、上课地点、时间和课程说明筛选；核对整期费用、材料和缺课规则，再完成报名确认。现场需要协助，可先向 McLaren Lodge Annex（501 Stanyan Street）核对接待时间。",
        "url": "https://apm.activecommunities.com/sfrecpark/ActiveNet_Home?FileName=faqPage.sdi"
      },
      {
        "type": "tip",
        "title": "爱心收藏、候补、正式报名是三个状态",
        "text": "SF Rec 的爱心是 wish list，方便之后再找；候补成功会有邮件，空出位置后还需要处理正式邀请。保存最终报名确认和收据，没收到确认就登录账户查，不凭“已经点过一次”判断有名额。"
      },
      {
        "type": "paragraph",
        "text": "编辑建议用“实际会参加的次数”比较课程成本。假设整期 $120，另需 $30 材料，但你只能去五次，则每次实际成本为 $30，再加交通；这是算例，不是 SF Rec 报价。先标出旅行和加班日期，再决定整期课还是单次活动。"
      },
      {
        "type": "link",
        "title": "SF 居民课程援助：先申请，再付费",
        "text": "符合条件的 SF 居民可申请 Recreation Scholarship，审核可能需两周，优惠不追溯。官方说明资格通常两年复核一次；页面仍含 2025 收入表，2026 申请请让工作人员确认当前标准，不在这里据旧表判定资格。",
        "url": "https://www.sfrecpark.org/408/Apply-for-a-Scholarship"
      },
      {
        "type": "paragraph",
        "text": "免费或获资助也要留下交通、材料、吃饭和照护预算。不能按时到场时，按报名页规则退出或告知主办方，让名额能给下一位。补助不代表每场都有名额，候补期间用室内替补活动维持习惯。"
      },
      {
        "type": "template",
        "title": "报名以前，发给主办方的五个问题",
        "text": "您好，我想第一次参加 [活动／日期]。请问现在还能报名吗？集合点和最晚到达时间是什么？这场的体力、年龄或经验要求是什么？是否需要自带材料或支付其他费用？我有 [具体便利需求]，这次能否安排，或有没有更适合的新手场次？"
      },
      {
        "type": "heading",
        "text": "六周实践：从第一次参加到再次见面"
      },
      {
        "type": "paragraph",
        "text": "第 1–2 周：完成一次主项目和一次备选体验。活动后各记三件事：回家是否太晚、任务或话题是否舒服、是否愿意再见这群人。先根据真实体验删掉不合适的候选，不因一次紧张就认定自己不适合社区活动。"
      },
      {
        "type": "paragraph",
        "text": "第 3–4 周：回到较合适的那个场所，尽量选相同时间或同类任务。编辑建议认住负责人和一两位参与者的名字，问一个与现场有关的问题，例如“你上次种的这块后来怎么样”。共同做的事比重复自我介绍更容易接续。"
      },
      {
        "type": "paragraph",
        "text": "第 5–6 周：再参加一次，并做一个轻量的延续动作：询问下月日期、申请同一班次，或邀请愿意的人活动后一起走到车站。联系方式只在对方同意时交换。六周后保留一个能持续的项目就够了，不必把认识人数作为成绩。"
      },
      {
        "type": "tip",
        "title": "满员、下雨或现场不适合时，怎么继续",
        "text": "满员就完成正式候补并准备另一个日期；天气取消先看主办方通知，不自行去现场开工。觉得太累可问较轻的任务，觉得话题不合可换形式。替补是为了保住参与节奏，不是硬撑着完成不合适的活动。"
      },
      {
        "type": "paragraph",
        "text": "准备转向长期志愿岗位时，再问最低服务频率、培训、筛选程序和退出方式。把自己的工作与家庭日历一起看；先确认能履行，再承诺负责一片花园或固定班次。长期参与的价值在于可靠出现，而不是一开始答应最多。"
      }
    ]
  },
  {
    "slug": "bay-area-borrow-tools-repair-before-buying-2026",
    "title": "先借工具、再学修理：湾区家庭少买一次的完整流程",
    "subtitle": "从资格、取还与现场收件，到修不好时的下一步",
    "summary": "围绕 Berkeley 与 Oakland 工具图书馆、Fixit Clinic 和南湾 Repair Café，解决只用一次的工具、坏了但舍不得扔的小物件。附住址资格、现场登记、费用边界、10 月实例与修理预算算例。",
    "category": "used",
    "categoryLabel": "长期居民 · 借用与修理",
    "emoji": "🧰",
    "audience": [
      "住处空间有限的家庭",
      "想减少重复购物、学习维护物品的人"
    ],
    "tags": [
      "工具图书馆",
      "Repair Café",
      "Fixit Clinic",
      "家庭维修"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "used",
      "repair",
      "other"
    ],
    "readMinutes": 12,
    "updatedAt": "2026-10-02",
    "sourceNote": "官方规则与主办方日历核验于 2026 年 10 月 2 日。时间安排和经济比较为编辑建议；馆藏可借状态、现场容量与能否修复需当次确认。10 月活动仅适用于列明日期，过期后回主办方日历选择新场次。",
    "sources": [
      {
        "title": "Berkeley：工具借用资格",
        "url": "https://www.berkeleypubliclibrary.org/locations/tool-lending-library/borrowing-tools",
        "description": "核对年龄、住址或物业证明、单独登记与使用责任。"
      },
      {
        "title": "Berkeley：工具馆地点与目录",
        "url": "https://www.berkeleypubliclibrary.org/locations/tool-lending-library",
        "description": "确认 Russell Street 入口、工具目录与假日开放变动。"
      },
      {
        "title": "Oakland：借阅政策中的工具例外",
        "url": "https://oaklandlibrary.org/policies/circulation-policy/",
        "description": "核对三市资格、7 天期限、人工预约与原馆现场归还。"
      },
      {
        "title": "Oakland：Tool Lending Library",
        "url": "https://oaklandlibrary.org/otll/",
        "description": "工具馆现场地址、联系方式与相关活动入口。"
      },
      {
        "title": "Fixit Clinic：携物参与方法",
        "url": "https://www.fixitclinic.org/p/scheduled-events.html?m=1",
        "description": "参与者要动手学习；确认地区场次、物品登记与配件准备。"
      },
      {
        "title": "Repair Café Silicon Valley：常见问题",
        "url": "https://repaircafesv.org/faq/",
        "description": "受理范围、免费人工与零件费用、物品限制及无修复保证。"
      },
      {
        "title": "Repair Café Silicon Valley：当前日历",
        "url": "https://repaircafesv.org/",
        "description": "核对 2026 年 10 月南湾具体场次与停止收件条件。"
      },
      {
        "title": "StopWaste RE:Source：修理与再使用查询",
        "url": "https://resource.stopwaste.org/",
        "description": "按物品与城市搜索；覆盖 Alameda、Contra Costa 与 Palo Alto，目录本身不收物品。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "住久以后，家里容易同时积累两种东西：只用过一次的工具，和“等有空再修”的坏物件。编辑建议每月挑一件处理，先判断是缺工具、缺知识，还是已经需要专业服务，再选择借用或修理活动。"
      },
      {
        "type": "heading",
        "text": "先判断该借工具、学修理还是找专业人员"
      },
      {
        "type": "tip",
        "title": "先做一个三选一判断",
        "text": "知道怎么做、只缺工具：查工具馆；不知道哪里坏、愿意一起学习：查 Fixit Clinic 或 Repair Café；涉及保修、固定建筑系统或你无法安全处理的项目：先联系制造商、物业或合适的专业人员。"
      },
      {
        "type": "paragraph",
        "text": "把本月项目写成一件具体事，例如“修好台灯开关”或“组装一个书架”，再列物件型号、已知问题、尺寸、所需工具和可工作日期。不要先借一整套设备，再想能拿它们做什么。"
      },
      {
        "type": "heading",
        "text": "工具馆：先核对资格，再预约取件"
      },
      {
        "type": "tip",
        "title": "普通借书证不等于工具借用资格",
        "text": "工具馆通常另有登记和住址规则。先核对你实际居住或持有住宅物业的城市，再看馆方资格；不会因为办到一张跨城市借书证，就自动获得所有工具借用权。"
      },
      {
        "type": "link",
        "title": "Berkeley：先核对住址，再现场登记",
        "text": "官网写明服务 Berkeley 居民或市内物业所有人，年龄为 18 岁以上，并须在工具馆核实后登记。外市居民不能只凭 Berkeley 普通借书证取工具；物业所有人走对应证明路径。",
        "url": "https://www.berkeleypubliclibrary.org/locations/tool-lending-library/borrowing-tools"
      },
      {
        "type": "paragraph",
        "text": "Berkeley 首次登记前，按官方清单准备自己的有效证明，例如现租约、房产税单或近 30 天公用事业账单。该馆特别注明不接受数码版加州身份证或驾照。编辑建议出门前致电确认你准备的材料组合，避免拿一张旧地址截图白跑。"
      },
      {
        "type": "link",
        "title": "Berkeley：取工具去 Russell Street",
        "text": "工具馆在 1901 Russell Street，电话 510-981-6101。从馆页进入工具目录与预约说明，确认具体物品、借期和取件准备好后再出发；不要去总馆找工具柜台。",
        "url": "https://www.berkeleypubliclibrary.org/locations/tool-lending-library"
      },
      {
        "type": "tip",
        "title": "借给你使用，不是转借给邻居",
        "text": "Berkeley 规则只允许登记借用者使用，除非工具馆明确许可。朋友不符合资格时，替他借再交给他并不是合规替代；可以一起查其本市服务或商业租赁。"
      },
      {
        "type": "link",
        "title": "Oakland：三市范围和单独登记",
        "text": "Oakland 工具馆要求有效成人 OPL 账户、信息一致的带照片证件、Oakland／Emeryville／Piedmont 居住或住宅物业证明，以及签署 waiver。先按工具馆条款核对，不照普通借书条件推断。",
        "url": "https://oaklandlibrary.org/policies/circulation-policy/"
      },
      {
        "type": "link",
        "title": "Oakland：让工作人员帮你预约",
        "text": "工具馆位于 5205 Telegraph Avenue，电话 510-597-5089。馆藏政策写明工具预约须由工作人员办理；说明所需工具及计划日期，问清是否已经备妥，而不是只在普通目录点收藏。",
        "url": "https://oaklandlibrary.org/otll/"
      },
      {
        "type": "paragraph",
        "text": "Oakland 工具通常借 7 天、最多 10 件，部分工具不能续借；这些是工具条款，不是普通书籍的三周规则。还工具须在开放时间内到原属馆内部办理，不放进还书箱。先把取与还的两次交通排进日历。"
      },
      {
        "type": "heading",
        "text": "借到之后：安排使用、清点与归还"
      },
      {
        "type": "tip",
        "title": "把归还日期倒推成施工日期",
        "text": "编辑建议在借期前半段完成主要工作，留一两天清洁、补齐配件和归还。若项目要等另一件材料到货，先别取工具。续借次数、收费与个别工具限制，以取件时的记录为准。"
      },
      {
        "type": "paragraph",
        "text": "取件时和工作人员一起确认配件数量、现有损伤、使用说明和防护需求。拍下附件摆放，回家后按说明使用；发现故障就停用并联系工具馆，不擅自拆修馆藏，也不把不熟悉的电动工具当成可以边猜边试的普通家用品。"
      },
      {
        "type": "paragraph",
        "text": "离馆太远、资格不符或工具被借走时，先算两次往返的时间。编辑建议比较附近商业租赁、请人完成单项工作，或推迟到可借日期。即使馆方不收租金，交通、耗材和损坏责任也不会自动消失。"
      },
      {
        "type": "heading",
        "text": "修理活动：确认受理、备齐配件再参加"
      },
      {
        "type": "link",
        "title": "Fixit Clinic：这是一起诊断和学习的活动",
        "text": "主办方要求参与者积极参与拆解、排查与修理。进入当地场次登记物品，带齐可重现故障的配件和已知信息；仅接可携入的物件。日历含多个州，必须核对城市与当场主办单位。",
        "url": "https://www.fixitclinic.org/p/scheduled-events.html?m=1"
      },
      {
        "type": "link",
        "title": "南湾 Repair Café：先看受理规则",
        "text": "Repair Café Silicon Valley 对外市居民也开放。维修人工免费、捐款自愿；若需要且现场有零件，按成本支付。通常每户最多两件，具体场次可不同，修复结果不保证。",
        "url": "https://repaircafesv.org/faq/"
      },
      {
        "type": "paragraph",
        "text": "先排除主办方明确不收的东西，例如儿童安全座椅、医疗设备、燃气器具、电车或电动滑板车电池，以及大型家电或已召回物件。衣物维修也不等同提供改尺寸服务。不是所有写着 repair 的活动都能接同一种物品。"
      },
      {
        "type": "tip",
        "title": "不用先买一袋猜测中的零件",
        "text": "先带型号、故障视频和已经拥有的配件，询问能否初步判断。没有把握时，先诊断再采购；不可退的零件和重复跑一趟都应计入成本。笨重物件可先询问是否能用照片评估值不值得携入。"
      },
      {
        "type": "paragraph",
        "text": "准备一张故障卡：品牌型号、何时开始、怎样触发、是否间歇发生、已经尝试过什么。带电源适配器、专用线、说明书和相关零件；只带机器本体却不能复现问题，很容易让现场时间花在找缺失配件上。"
      },
      {
        "type": "tip",
        "title": "2026 年 10 月 8 日：下班后的 Santa Clara 场",
        "text": "官方日历列 Northside Branch，695 Moreland Way，16:30–18:30，提供缝补、首饰与一般维修，这场不修自行车。适合只能平日傍晚参加的人；出发前再看是否调整或有特别登记安排。"
      },
      {
        "type": "tip",
        "title": "2026 年 10 月 25 日：Mountain View 场",
        "text": "地点为 Senior Center，266 Escuela Avenue，11:00–15:00；主办方写明所有人可带物品参加，并非只限长者。每户最多两件，预计 14:30 停止登记，满员时可能更早；不要按结束时间倒推到场。"
      },
      {
        "type": "link",
        "title": "日期过后，回主办方日历找下一场",
        "text": "逐场核对地点、受理种类、家庭件数和最晚登记时间。同一组织不同场地也可能不修自行车，或有不同容量；上个月的海报不能替代本次说明。",
        "url": "https://repaircafesv.org/"
      },
      {
        "type": "paragraph",
        "text": "现场先登记并接受说明，等与物件匹配的志愿者，再一起观察或动手。编辑建议为排队和诊断留出完整活动时段中的一段宽裕时间，别把“免费维修”安排成 15 分钟取货。询问前先取得同意，再拍照记录关键步骤。"
      },
      {
        "type": "heading",
        "text": "修理之后：记录结果，决定下一步"
      },
      {
        "type": "tip",
        "title": "没修好，也要带走明确下一步",
        "text": "请把诊断、需要的零件型号、是否值得继续、下一次应带什么写下来。若涉及专门设备或超出现场能力，询问应找哪类专业店；若不再修，带回全部物件，再安排合适去向，别留给志愿者处理。"
      },
      {
        "type": "tip",
        "title": "设一个修理预算，避免越修越买",
        "text": "编辑算例：同等替代品 $80，零件 $15、来回交通 $10，再跑一趟 $10，则现金成本 $35；另计你自己的时间。这些是假设价格。若要继续买不确定的零件，先重新比较剩余寿命、保修和替代品，不把沉没成本当作必须继续的理由。"
      },
      {
        "type": "link",
        "title": "修理之外的下一步：RE:Source 按物品查询",
        "text": "这个官方目录覆盖 Alameda County、Contra Costa County 与 Palo Alto，输入物品及城市或 ZIP 找修理、再使用或合适处置。目录本身不收东西；出门前向列出的单位确认受理、费用与预约，其他城市找本地对应资源。",
        "url": "https://resource.stopwaste.org/"
      },
      {
        "type": "template",
        "title": "联系工具馆或修理活动的简短说明",
        "text": "您好，我在 [城市]，想处理 [具体项目／物件与型号]。我已有 [相关资格证明／配件]，希望在 [日期] 参加或取件。请确认是否符合资格、是否受理或有库存、需要预约吗、最晚到达时间、可能费用，以及工具应何时到哪里归还。我可以先提供故障描述或照片。"
      },
      {
        "type": "paragraph",
        "text": "一个项目结束后，把工具清洁归还、配件清点、维修记录和实际费用一起结案。下月再选一件；经常用、每次借还都麻烦的工具，再考虑购买。编辑建议用一年内真正使用的次数决定是否值得拥有，而不是因为终于修好一次就买全套。"
      }
    ]
  }
];
