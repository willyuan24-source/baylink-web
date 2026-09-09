import type { Guide } from './guides';

const SERVICE_SOURCE_NOTE =
  'BAYLINK 编辑整理，官方资料核验于 2026 年 9 月 8 日。报价、服务范围与交付时间需双方确认；涉及安全、执照或机构要求，请查阅下方对应官方入口。';

export const serviceGuides: Guide[] = [
  {
    slug: 'bay-area-cleaning-quote-checklist',
    title: '在湾区找清洁：把工作范围写清楚，报价才有得比',
    subtitle: '从第一次询价到离场验收，一张清单减少来回沟通',
    summary:
      '日常保洁、深度清洁和搬出清洁怎么描述？整理房屋信息、逐项比较报价，再按约定验收。附可复制的需求模板。',
    category: 'service',
    categoryLabel: '本地服务',
    emoji: '🧹',
    audience: ['准备预约清洁', '即将搬家', '第一次找上门服务'],
    tags: ['清洁', '报价', '搬出清洁', '需求模板'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['cleaning', 'service'],
    readMinutes: 6,
    updatedAt: '2026-09-08',
    sourceNote: SERVICE_SOURCE_NOTE,
    sources: [
      {
        title: 'CDC：家庭清洁与消毒指南',
        url: 'https://www.cdc.gov/hygiene/about/when-and-how-to-clean-and-disinfect-your-home.html',
        description: '区分清洁与消毒，核对表面适用产品、通风和标签使用要求。',
      },
      {
        title: 'EPA：Safer Choice 常见问题',
        url: 'https://www.epa.gov/saferchoice/frequently-asked-questions-safer-choice',
        description: '了解清洁产品的 Safer Choice 标签及成分审查含义。',
      },
    ],
    blocks: [
      {
        type: 'paragraph',
        text: '“两房一卫，打扫一下多少钱？”能换来一个数字，却未必能换来你想要的服务。对方不知道厨房油污程度，也不知道你期待擦完窗槽和烤箱内壁。先花十分钟把范围写具体，既便于比较，也让上门的人更容易把时间用在你最在意的地方。',
      },
      { type: 'heading', text: '先列房间和任务，再选服务名称' },
      {
        type: 'paragraph',
        text: '“深度清洁”“搬出清洁”没有在所有商家之间统一的项目表。写明房屋类型、面积及单位、卧室和卫生间数量、是否空屋，并按房间列任务。厨房写台面、灶台、橱柜外侧还是内部；浴室写水垢、玻璃隔断或普通擦洗；客厅写吸尘、拖地还是地毯专项处理。',
      },
      {
        type: 'list',
        items: [
          '把冰箱和烤箱内部、窗户内外侧、窗槽、百叶窗、踢脚线列为单独询问项。',
          '说明宠物、楼梯、停车及电梯预约；发几张能反映实际状况的照片，避开证件与贵重物品。',
          '搬出清洁先看物业提供的交房清单；清洁服务的验收结果不等于物业承诺退还押金。',
        ],
      },
      { type: 'heading', text: '用同一份范围对比报价' },
      {
        type: 'paragraph',
        text: '向不同服务方发送同一份说明，要求书面列出包含项、排除项、耗材和设备由谁提供。按小时收费时，问清是一人的工时，还是整支团队的到场时间；固定总价则问哪些现场情况会触发加价。另核对最低预约时长、停车费、取消或改期安排，以及增加工作前如何征得你同意。',
      },
      { type: 'heading', text: '把清洁剂偏好说到产品层面' },
      {
        type: 'paragraph',
        text: '提前告知对香味的偏好、家中儿童和宠物的活动安排，以及石材、木地板等材质限制。CDC 建议按表面选择适用产品并遵循标签，清洁和消毒是不同步骤，不要混合清洁剂。想筛选产品成分时，可查看 EPA 的 Safer Choice 标签说明；这个标签用于产品，不是对清洁公司的服务认证，也不能保证每个人都不会过敏。',
      },
      { type: 'heading', text: '上门前，留好工作空间和边界' },
      {
        type: 'paragraph',
        text: '提前收好散落物品、现金和私人文件，标出不进入的房间与不移动的物件。需要门禁时，确认具体到场人员再私下安排，不在公开帖子里放密码。开工前共同走一遍，指出旧划痕和重点区域；对无法处理的污渍先确认预期，不要求靠加大药剂强度冒险去除。',
      },
      { type: 'heading', text: '趁人还在，按约定逐项验收' },
      {
        type: 'checklist',
        items: [
          '按报价单查看厨房、浴室和地面的约定项目，不临时把未购买的项目算作漏做。',
          '检查同意清洁的边角、设备内部和玻璃，区分残留污物与原有损伤。',
          '发现遗漏时当面指出位置，确认能否补做以及双方约定的返工窗口。',
          '确认物品归位、垃圾处理、门窗关闭和钥匙交接，保存完成照片与收据。',
        ],
      },
      { type: 'heading', text: '复制这段，写一条清楚的清洁需求' },
      {
        type: 'template',
        title: '清洁需求模板 · 请替换方括号',
        text: '【清洁需求】\n城市/片区：[城市或片区]\n房屋类型、面积及单位：[房屋情况]\n卧室/卫生间：[数量]\n空屋或有人居住：[居住情况]\n希望日期与时间段：[日期和时间]\n重点项目：[逐项列出]\n额外项目：[另行报价的项目]\n材质、宠物及清洁剂偏好：[特殊需求]\n楼梯/电梯/停车：[进场条件]\n请说明包含项、排除项、计费方式、可能加价和改期安排。详细地址确认预约后私下提供。',
      },
      {
        type: 'cta',
        title: '把需求发到清洁分类',
        text: '用同一份范围接收回复，再比较项目和报价。上门时间以双方确认结果为准。',
        primaryLabel: '发布清洁需求',
        primaryAction: 'post',
        postType: 'client',
        postCategorySlug: 'cleaning',
      },
    ],
  },
  {
    slug: 'bay-area-repair-request-guide',
    title: '家里东西坏了，怎么报修才少跑一趟？',
    subtitle: '先判断紧急程度，再准备型号、现象和可核对的报价',
    summary:
      '把“坏了”变成维修人员能判断的信息：安全边界、照片与型号、适用承包商核验、报价拆分和完工留档。',
    category: 'service',
    categoryLabel: '本地服务',
    emoji: '🔧',
    audience: ['需要家庭维修', '租客', '屋主'],
    tags: ['维修', '报修', '承包商', '需求模板'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['repair', 'service'],
    readMinutes: 6,
    updatedAt: '2026-09-08',
    sourceNote: SERVICE_SOURCE_NOTE,
    sources: [
      {
        title: 'PG&E：燃气泄漏安全行动',
        url: 'https://www.pge.com/en/newsroom/safety-action-center/safety-resources/keep-yourself-safe-from-a-gas-leak.html',
        description: '疑似燃气泄漏时先撤离，到安全位置联系紧急服务和公用事业公司。',
      },
      {
        title: 'CSLB：查询承包商执照',
        url: 'https://web.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx',
        description: '按执照号码或经营名称核对执照状态及公开披露信息。',
      },
      {
        title: 'CSLB：选择合适的承包商',
        url: 'https://web.cslb.ca.gov/Consumers/Hire_A_Contractor/Finding_The_Right_Contractor.aspx',
        description: '按相同工作范围比较书面报价，并核对身份和保险资料。',
      },
    ],
    blocks: [
      {
        type: 'paragraph',
        text: '好的报修说明不是先猜零件坏在哪里，而是让对方知道发生了什么、目前是否安全、到场需要准备什么。一个错误代码、一张型号标签照，往往比“应该是马达坏了”更有用。以下流程适合安排一般家庭维修；出现危险时，先处理安全问题。',
      },
      { type: 'heading', text: '遇到危险，停止排查和等待报价' },
      {
        type: 'tip',
        title: '疑似燃气泄漏先离开现场',
        text: 'PG&E 的安全指南要求：闻到燃气味或怀疑泄漏时，立即远离现场，到安全位置拨打 911，再联系 PG&E（其服务范围内）。避免火源，不要为了拍照、反复试机或找漏点继续停留。冒烟、火花、裸露电线附近积水等情况，也不要继续使用或拆机；有即时危险时联系紧急服务。',
      },
      { type: 'heading', text: '用现象、时间线和型号描述问题' },
      {
        type: 'paragraph',
        text: '在安全情况下，记录设备品牌、型号、错误代码、问题第一次出现的时间，以及持续发生还是偶发。例如描述“运行到排水时停止并显示代码”，比直接断定水泵故障更准确。拍整体、异常部位和型号标签，不拆保护外壳，也不为录视频重现危险现象。公开发布前遮住家庭地址、订单号码等信息。',
      },
      {
        type: 'list',
        items: [
          '写出已经观察到的现象与采取过的操作；不确定的部分直接标注“不确定”。',
          '查找购买记录和保修资料，先问厂家指定的维修渠道是否适用，避免重复预约。',
          '租住住房时先向房东或物业报修，保留通知时间，确认谁安排进场和谁批准费用。',
        ],
      },
      { type: 'heading', text: '核验服务方，也核验工作范围' },
      {
        type: 'paragraph',
        text: '家电检修与涉及建筑系统的施工，可能适用不同要求。需要承包商执照的项目，使用 CSLB 官方查询入口核对经营名称、号码、状态及对应分类，不只收一张“有执照”的截图。不确定项目是否需要执照或许可时，向 CSLB 或当地建筑部门说明具体工作。CSLB 的消费者指南也建议核对实际到场身份与保险资料；平台资料和评价不能代替这些核验。',
      },
      { type: 'heading', text: '把诊断费和维修费拆开问' },
      {
        type: 'paragraph',
        text: '确认上门或诊断收费、是否抵扣后续维修、人工和零件分别如何计算，以及找不到故障或缺件时如何处理。对适用的承包工程，CSLB 建议按相同范围取得多份书面报价。把新增工作须先确认、谁采购零件、旧件如何处理和预计到货时间写下来；“预计”不等于承诺，当天修复也不应被默认。',
      },
      { type: 'heading', text: '完工后，留下别人接手也看得懂的记录' },
      {
        type: 'checklist',
        items: [
          '请维修人员说明确认的故障、实际处理内容与更换零件，保存工单和型号。',
          '在对方确认安全后演示相关功能，核对原先的问题是否仍然出现。',
          '记录尚未解决的问题、使用限制、下次到场条件和双方确认的后续安排。',
          '保存报价、追加确认、收据及保修说明，问清保修范围、期限和联系渠道。',
        ],
      },
      { type: 'heading', text: '复制这段，提交一份有效报修' },
      {
        type: 'template',
        title: '一般维修需求模板 · 请替换方括号',
        text: '【一般维修需求】\n城市/片区：[城市或片区]\n设备或位置：[需要维修的对象]\n品牌/型号：[品牌型号或未知]\n现象及错误代码：[实际观察]\n出现时间和频率：[问题时间线]\n已采取操作：[已做的操作]\n照片：[可安全提供的内容]\n保修/物业安排：[已确认的安排]\n可进场时间和停车条件：[日期与进场条件]\n请说明能否处理、诊断收费、人工与零件计费及追加确认方式。紧急危险不通过此帖等待处理。',
      },
      {
        type: 'cta',
        title: '需要安排一般维修？',
        text: '先确认现场安全，再发布现象和设备信息，详细地址私下提供。',
        primaryLabel: '发布维修需求',
        primaryAction: 'post',
        postType: 'client',
        postCategorySlug: 'repair',
      },
    ],
  },
  {
    slug: 'bay-area-translation-service-guide',
    title: '在湾区找翻译：先确认用途，再谈报价和交付',
    subtitle: '笔译、口译、机构要求和隐私材料，一次说清楚',
    summary:
      '“帮我翻译一下”还缺哪些信息？从语言方向、接收机构要求到交付格式和材料保密，附一份能直接填写的需求模板。',
    category: 'service',
    categoryLabel: '本地服务',
    emoji: '🗣️',
    audience: ['需要文件翻译', '需要现场口译', '准备向机构交材料'],
    tags: ['翻译', '口译', '隐私', '需求模板'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['translation', 'service'],
    readMinutes: 6,
    updatedAt: '2026-09-08',
    sourceNote: SERVICE_SOURCE_NOTE,
    sources: [
      {
        title: '加州法院：查找口译员',
        url: 'https://languageaccess.courts.ca.gov/court-interpreters-resources/search-interpreter',
        description: '查询法院认证或注册口译员，并了解法院口译资质与书面翻译能力的区别。',
      },
      {
        title: '加州法院：申请口译服务',
        url: 'https://selfhelp.courts.ca.gov/ask-interpreter',
        description: '了解法院口译申请流程，以及向法院语言服务联系人确认安排的方法。',
      },
      {
        title: 'FTC：保护个人信息的商家指南',
        url: 'https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business',
        description: '了解最少收集、限制访问、安全保存与妥善处置敏感材料的原则。',
      },
    ],
    blocks: [
      {
        type: 'paragraph',
        text: '同样是中英翻译，学校材料、产品介绍、会议陪同和法院口译，需要的准备可能完全不同。先把“给谁用、怎么用、何时交”说清楚，比先问每页多少钱更有效。本文帮助你组织需求与比较交付内容；是否接受材料，应由接收机构确认。',
      },
      { type: 'heading', text: '先分清笔译和口译' },
      {
        type: 'paragraph',
        text: '笔译交付文字，需要说明原文语言、目标语言、简体或繁体、文件类型和可编辑程度。口译处理现场交流，需要说明普通话、粤语等具体语言、线上还是线下、地点、时区、参与人数和交流方式。会议是否要边听边译、是否有演示资料，都应在报价前说明，不把会说两种语言直接等同于适合所有专业场景。',
      },
      { type: 'heading', text: '向接收方要一份明确要求' },
      {
        type: 'paragraph',
        text: '联系学校、法院或其他接收机构，询问其接受的语言、译者资格或声明、签字形式、文件格式，以及是否需要特定认证或公证程序。保存官方说明链接或书面回复，再交给服务方确认。不要把一家机构的要求套用到另一家，也不要只凭广告中的“认证翻译”四个字判断合适。',
      },
      {
        type: 'paragraph',
        text: '加州法院的口译员查询页明确说明，司法委员会的法院口译认证或注册，并不代表它另行测试或认证了书面翻译能力。需要法院口译时，可先查看加州法院“申请口译服务”页面，向对应法院联系人确认流程；不要先自行聘人再默认法院会接受或承担费用。',
      },
      { type: 'heading', text: '让报价对应可检查的交付物' },
      {
        type: 'paragraph',
        text: '笔译说明页数或字数、扫描件是否清晰、是否有表格和手写内容，问清版式还原、校对、译者声明和修改轮次是否包含。口译确认预约时长、最低计费、准备时间、交通、设备、延时及取消安排。给出真正的使用日期，并把初稿、核对和终稿时间分开；临近截止才发现漏页，会比提前补资料更难处理。',
      },
      { type: 'heading', text: '询价阶段只提供必要信息' },
      {
        type: 'paragraph',
        text: '公开帖子不附完整护照、成绩单、病历或账户资料。询价先描述文件类型和工作量，必要时提供遮盖无关敏感内容的样页；正式翻译所需的完整材料，通过双方确认的受限渠道发送，不删改需要被准确翻译的原始内容。',
      },
      {
        type: 'paragraph',
        text: 'FTC 的商家资料保护指南强调只保留必要数据、限制访问并妥善处置。把这些原则变成具体问题：谁能看到文件，是否转交其他译者或上传第三方 AI 工具，保存多久，结束后如何处理。资料处理约定应在发出完整文件前确认，不能只依赖一句“绝对保密”。',
      },
      { type: 'heading', text: '交付时，优先核对不能错的细节' },
      {
        type: 'checklist',
        items: [
          '逐页确认是否完整，姓名拼写、日期、金额和编号是否与原文一致。',
          '确认章戳、手写内容及无法辨认处已按约定处理，没有把不确定内容猜成事实。',
          '对照接收机构要求检查格式、签字或附加文件，保存最终版本与原文对应关系。',
          '有疑问时标注具体页码和位置让译者复核，确认终稿后再提交给接收方。',
        ],
      },
      { type: 'heading', text: '复制这段，发布翻译需求' },
      {
        type: 'template',
        title: '翻译需求模板 · 请替换方括号',
        text: '【翻译需求】\n服务类型：[笔译或口译]\n语言方向及方言：[所需语言]\n用途和接收机构：[材料用途]\n机构要求链接或摘要：[官方要求]\n文件类型、工作量或预约时长：[工作范围]\n交付格式或现场安排：[交付要求]\n城市/线上平台：[服务地点]\n使用日期、时区与希望交付时间：[日期和时间]\n请说明经验、报价包含项、修改或取消安排及资料处理方式。公开附件仅提供必要的脱敏样页。',
      },
      {
        type: 'cta',
        title: '用清楚的需求寻找合适的译者',
        text: '发布用途、语言和时间要求，完整私人材料在确认服务安排后私下传递。',
        primaryLabel: '发布翻译需求',
        primaryAction: 'post',
        postType: 'client',
        postCategorySlug: 'translation',
      },
    ],
  },
];
