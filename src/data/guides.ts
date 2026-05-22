export type GuideCategory =
  | 'rent'
  | 'roommate'
  | 'used'
  | 'service'
  | 'commute'
  | 'newcomer'
  | 'city'
  | 'safety'
  | 'events';

export type GuideBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'checklist'; items: string[] }
  | { type: 'tip'; title?: string; text: string }
  | {
      type: 'cta';
      title: string;
      text: string;
      primaryLabel: string;
      primaryAction: 'post' | 'category' | 'guides';
      categorySlug?: string;
    };

export type Guide = {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  category: GuideCategory;
  categoryLabel: string;
  emoji: string;
  audience: string[];
  tags: string[];
  priority: 'P0' | 'P1' | 'P2';
  featuredOnHome: boolean;
  recommendedForCategories: string[];
  cover?: string;
  readMinutes: number;
  updatedAt: string;
  sourceNote?: string;
  blocks: GuideBlock[];
};

const SOURCE_NOTE =
  'BayLink 本地生活整理，仅供参考，不构成法律、财务或专业建议。';

export const guides: Guide[] = [
  {
    slug: 'bay-area-rental-scam-guide',
    title: '湾区租房防骗指南：看房、转账、签合同前先检查什么',
    subtitle: '常见套路与可执行的看房 checklist',
    summary: '识别假房源、假房东与异常转账要求，看房与签约前逐项核对。',
    category: 'rent',
    categoryLabel: '租房',
    emoji: '🏠',
    audience: ['准备租房', '新来湾区'],
    tags: ['防骗', '看房', '合同'],
    priority: 'P0',
    featuredOnHome: true,
    recommendedForCategories: ['rent'],
    readMinutes: 6,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'heading', text: '最常见的三类租房骗局' },
      {
        type: 'list',
        items: [
          '假房源：图片精美、租金明显低于同区，催促尽快转账锁房',
          '假房东：无法出示产权或授权证明，只接受 Zelle / 礼品卡 / 加密货币',
          '转租陷阱：原租客未获房东书面同意就私下转租',
        ],
      },
      { type: 'heading', text: '看房当天建议核对' },
      {
        type: 'checklist',
        items: [
          '实地看房，确认地址与门牌一致',
          '要求查看房东身份证明与房产相关信息（可打码）',
          '问清押金、租期、涨租条款、维修责任',
          '拒绝在未签合同前付大额「订金」到个人账户',
        ],
      },
      {
        type: 'tip',
        title: '小提示',
        text: '可要求视频通话在房内走一圈，并让对方出示当天报纸或门牌同框，降低盗图房源风险。',
      },
      {
        type: 'cta',
        title: '准备租房？',
        text: '在 BayLink 发布你的租房需求，让邻居帮你避雷、推荐靠谱区域。',
        primaryLabel: '发布租房需求',
        primaryAction: 'post',
      },
      {
        type: 'cta',
        title: '浏览租屋信息',
        text: '看看社区里最新的租屋帖与合租信息。',
        primaryLabel: '去看租屋分类',
        primaryAction: 'category',
        categorySlug: 'rent',
      },
    ],
  },
  {
    slug: 'bay-area-newcomer-first-month-checklist',
    title: '新来湾区第一个月 checklist：租房、交通、手机、生活怎么安排',
    subtitle: '落地第一周优先办什么',
    summary: '从 SSN、手机卡、银行账户到通勤与租房顺序，帮新移民少走弯路。',
    category: 'newcomer',
    categoryLabel: '新手指南',
    emoji: '🧳',
    audience: ['新移民', '留学生', '刚落地'],
    tags: ['checklist', '落地', '生活'],
    priority: 'P0',
    featuredOnHome: true,
    recommendedForCategories: ['rent', 'other'],
    readMinutes: 7,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'paragraph', text: '刚到湾区，建议按「住下来 → 能通勤 → 能办事」的顺序推进，不要第一天就签长期租约。' },
      { type: 'heading', text: '第一周优先事项' },
      {
        type: 'checklist',
        items: [
          '确定短期住宿（Airbnb / 朋友家 / 短租）',
          '办手机卡与银行借记卡，保留账单地址',
          '了解公司或学校通勤路线（BART / Caltrain / 开车时间）',
          '在可信平台浏览租房，先线下看房再签约',
        ],
      },
      { type: 'heading', text: '第二至四周' },
      {
        type: 'list',
        items: [
          '若需 SSN，按合法身份准备材料预约办理',
          '熟悉附近超市、医疗 urgent care、DMV 预约方式',
          '加入本地社群获取二手家具、拼车信息',
        ],
      },
      {
        type: 'tip',
        title: '租房提醒',
        text: '没有实地看房、没有书面合同，不要付大额押金。',
      },
      {
        type: 'cta',
        title: '需要邻居帮忙？',
        text: '发布你的落地需求（租房、接送、代购等），湾区用户会看到。',
        primaryLabel: '发布需求',
        primaryAction: 'post',
      },
    ],
  },
  {
    slug: 'bay-area-roommate-guide',
    title: '湾区找室友避坑指南：合租前先讲清楚这些事',
    subtitle: '合租规则、押金与退租',
    summary: '合租前把费用、作息、押金分摊和退租流程写清楚，减少日后纠纷。',
    category: 'roommate',
    categoryLabel: '找室友',
    emoji: '👥',
    audience: ['合租', '分租'],
    tags: ['室友', '合租', '押金'],
    priority: 'P0',
    featuredOnHome: true,
    recommendedForCategories: ['rent'],
    readMinutes: 5,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'heading', text: '合租前必须谈妥' },
      {
        type: 'checklist',
        items: [
          '租金、水电网如何分摊，谁主签租约',
          '押金总额、每人份额、退租如何退还',
          '是否允许过夜客人、宠物、吸烟',
          '公共区域清洁轮值或外包费用',
        ],
      },
      {
        type: 'paragraph',
        text: '建议用简单书面协议（可中英文）记录主租客与次租客关系；若从二房东转租，务必确认房东是否允许分租。',
      },
      {
        type: 'tip',
        text: '看房时同时见室友与主租客，避免只跟中介沟通、不见真人。',
      },
      {
        type: 'cta',
        title: '找室友或分租',
        text: '在 BayLink 租屋分类发布合租信息，写清预算与区域。',
        primaryLabel: '去租屋分类',
        primaryAction: 'category',
        categorySlug: 'rent',
      },
    ],
  },
  {
    slug: 'bay-area-commute-guide',
    title: '湾区通勤方式全对比：BART、Caltrain、开车、拼车怎么选',
    subtitle: '按居住与工作地选交通',
    summary: '半岛、南湾、东湾通勤差异大，先搞清时间与成本再决定住哪。',
    category: 'commute',
    categoryLabel: '通勤',
    emoji: '🚆',
    audience: ['上班族', '留学生'],
    tags: ['BART', 'Caltrain', '拼车'],
    priority: 'P0',
    featuredOnHome: true,
    recommendedForCategories: ['ride'],
    readMinutes: 6,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'heading', text: '常见方式一览' },
      {
        type: 'list',
        items: [
          'BART：适合东湾 ↔ 旧金山 / 部分半岛站点',
          'Caltrain：半岛南北向（SF ↔ San Jose）主力',
          '开车：灵活但 101/880/237 高峰拥堵，需算停车与 FasTrak',
          '拼车 / Vanpool：适合固定路线，可分摊油费与 HOV',
        ],
      },
      {
        type: 'paragraph',
        text: '选房时先用 Google Maps 设「工作日 8:30 到达」看三种模式耗时，再决定预算；很多「租金便宜」的区域通勤成本更高。',
      },
      {
        type: 'tip',
        title: 'Clipper 卡',
        text: '一张 Clipper 可绑 BART、Caltrain、公交，记得 tap 进出站避免罚款。',
      },
      {
        type: 'cta',
        title: '需要接送或拼车？',
        text: '在接送分类发布行程或找顺路邻居。',
        primaryLabel: '去看接送分类',
        primaryAction: 'category',
        categorySlug: 'ride',
      },
    ],
  },
  {
    slug: 'bay-area-used-trading-safety-guide',
    title: '湾区二手交易安全指南：面交、转账、验货怎么做',
    subtitle: '面交地点与付款顺序',
    summary: '二手买卖优先公共场所面交，验货后再付款，警惕假付款截图。',
    category: 'used',
    categoryLabel: '二手',
    emoji: '📦',
    audience: ['买二手', '卖闲置'],
    tags: ['二手', '面交', '安全'],
    priority: 'P0',
    featuredOnHome: true,
    recommendedForCategories: ['used'],
    readMinutes: 5,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'heading', text: '面交建议' },
      {
        type: 'checklist',
        items: [
          '选警察局 safe trade zone、商场、咖啡店等人流多的地方',
          '白天交易，避免单独去对方住处取货',
          '电子产品当场开机验功能；大件约两人同行',
        ],
      },
      { type: 'heading', text: '付款顺序' },
      {
        type: 'paragraph',
        text: '优先当面现金或现场 Venmo / Zelle 确认到账后再交货。拒绝「先发货后付款」或来历不明的支票。',
      },
      {
        type: 'tip',
        text: '保留聊天记录与物品照片；价格明显异常的好货多一层警惕。',
      },
      {
        type: 'cta',
        title: '发布或浏览闲置',
        text: '在 BayLink 闲置分类找邻居的二手好物。',
        primaryLabel: '去看闲置分类',
        primaryAction: 'category',
        categorySlug: 'used',
      },
    ],
  },
  {
    slug: 'rental-lease-checklist-before-signing',
    title: '租房合同签字前 checklist：哪些条款一定要看',
    subtitle: '租约关键条款速查',
    summary: '签字前确认租期、押金退还、维修责任与提前解约条款。',
    category: 'rent',
    categoryLabel: '租房',
    emoji: '📋',
    audience: ['签约前', '租客'],
    tags: ['合同', '租约'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['rent'],
    readMinutes: 5,
    updatedAt: '2025-04-20',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'heading', text: '签字前逐项看' },
      {
        type: 'checklist',
        items: [
          '租期起止、自动续约（auto-renew）条款',
          '押金金额、退还条件、扣款明细（清洁 / 损坏）',
          '涨租限制、通知期（30/60 天）',
          '谁负责家电维修、害虫、草坪',
          '能否转租、提前解约违约金',
        ],
      },
      {
        type: 'paragraph',
        text: '不懂的英文条款可请朋友帮忙或咨询社区法律资源；不要只看第一页租金数字。',
      },
      {
        type: 'cta',
        title: '还在找房？',
        text: '发布需求让邻居推荐区域与房源线索。',
        primaryLabel: '发布租房需求',
        primaryAction: 'post',
      },
    ],
  },
  {
    slug: 'move-in-move-out-checklist',
    title: '租客搬入搬出 checklist：押金、拍照、交接怎么做',
    subtitle: '保护押金的记录习惯',
    summary: '入住与搬出时拍照留档、抄表、书面交接，减少押金纠纷。',
    category: 'rent',
    categoryLabel: '租房',
    emoji: '📸',
    audience: ['租客', '搬家中'],
    tags: ['押金', '搬家'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['rent', 'moving'],
    readMinutes: 4,
    updatedAt: '2025-04-20',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'heading', text: '搬入当天' },
      {
        type: 'checklist',
        items: [
          '全屋视频/照片（墙面划痕、地板、厨卫、门窗）',
          '记录水电煤气表读数',
          '确认钥匙数量、邮箱、车位、垃圾日',
        ],
      },
      { type: 'heading', text: '搬出前' },
      {
        type: 'list',
        items: [
          '专业清洁或按合同要求打扫，保留收据',
          '再次拍照对比入住记录',
          '书面通知房东退押金账户与地址',
        ],
      },
      {
        type: 'cta',
        title: '需要搬家服务？',
        text: '在搬家分类找本地搬家师傅或拼车搬物。',
        primaryLabel: '去看搬家分类',
        primaryAction: 'category',
        categorySlug: 'moving',
      },
    ],
  },
  {
    slug: 'local-service-safety-guide',
    title: '湾区找搬家、清洁、维修服务，怎么判断靠不靠谱',
    subtitle: '本地服务避坑',
    summary: '看评价、报价明细、是否愿意书面确认，避免先付全款。',
    category: 'service',
    categoryLabel: '本地服务',
    emoji: '🔧',
    audience: ['找服务', '房东'],
    tags: ['搬家', '清洁', '维修'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['moving', 'cleaning', 'repair'],
    readMinutes: 5,
    updatedAt: '2025-04-20',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'heading', text: '下单前建议' },
      {
        type: 'list',
        items: [
          '问清报价是否含里程、楼梯费、垃圾费',
          '是否购买保险 / 损坏如何赔',
          '能否提供过往案例或 BayLink 历史评价',
          '大额服务分期付款，完工验收后再结清',
        ],
      },
      {
        type: 'tip',
        text: '同一服务多问 2–3 家比价，异常低价往往隐藏追加费用。',
      },
      {
        type: 'cta',
        title: '发布服务需求',
        text: '写清地址、时间、预算，方便服务商报价。',
        primaryLabel: '发布需求',
        primaryAction: 'post',
      },
    ],
  },
  {
    slug: 'peninsula-living-guide',
    title: 'Peninsula 生活指南：San Mateo、Millbrae、Burlingame 怎么选',
    subtitle: '半岛居住速览',
    summary: '半岛靠近 SF 与机场，适合 Caltrain 通勤，租金通常高于南湾部分区域。',
    category: 'city',
    categoryLabel: '城市指南',
    emoji: '🌉',
    audience: ['找房', '通勤 SF'],
    tags: ['Peninsula', 'San Mateo'],
    priority: 'P2',
    featuredOnHome: false,
    recommendedForCategories: ['rent', 'other'],
    readMinutes: 5,
    updatedAt: '2025-04-15',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'paragraph', text: 'Peninsula 沿 Caltrain 主线，Millbrae / Burlingame / San Mateo 生活便利，华人超市与餐饮选择多，适合在 SF 或半岛上班的家庭。' },
      {
        type: 'list',
        items: [
          '优点：通勤 SF 方便、气候温和、学区资源好（因城市而异）',
          '注意：租金与停车成本高，旺季房源紧',
          '交通：Caltrain + 101；靠近 SFO 有航班噪音区域',
        ],
      },
      {
        type: 'cta',
        title: '找半岛房源',
        text: '在租屋分类筛选城市名或发帖说明预算。',
        primaryLabel: '去看租屋分类',
        primaryAction: 'category',
        categorySlug: 'rent',
      },
    ],
  },
  {
    slug: 'south-bay-living-guide',
    title: '南湾居住指南：Cupertino、Sunnyvale、San Jose 怎么选',
    subtitle: '南湾科技圈居住',
    summary: '南湾工作机会多，区间差异大，选房时重点看通勤与学区需求。',
    category: 'city',
    categoryLabel: '城市指南',
    emoji: '🌴',
    audience: ['科技从业', '家庭'],
    tags: ['南湾', 'San Jose', 'Cupertino'],
    priority: 'P2',
    featuredOnHome: false,
    recommendedForCategories: ['rent', 'other'],
    readMinutes: 5,
    updatedAt: '2025-04-15',
    sourceNote: SOURCE_NOTE,
    blocks: [
      { type: 'paragraph', text: 'Cupertino / Sunnyvale / Santa Clara 靠近科技公司，租金较高；San Jose 城区范围大，需按街区甄别。' },
      {
        type: 'list',
        items: [
          '通勤：多数靠开车；VTA 轻轨覆盖部分路线',
          '生活：大华、99 Ranch 等华人超市齐全',
          '气候：夏季较热，注意空调与电费',
        ],
      },
      {
        type: 'cta',
        title: '在南湾找房或服务',
        text: '发布带城市与预算的帖子，更快获得邻居回复。',
        primaryLabel: '发布需求',
        primaryAction: 'post',
      },
    ],
  },
];

export const getGuideBySlug = (slug: string): Guide | undefined =>
  guides.find((g) => g.slug === slug);

export const getFeaturedGuides = (limit = 4): Guide[] =>
  guides
    .filter((g) => g.featuredOnHome)
    .sort((a, b) => (a.priority === 'P0' ? -1 : 1) - (b.priority === 'P0' ? -1 : 1))
    .slice(0, limit);

const CATEGORY_SLUG_RECOMMENDED: Record<string, string[]> = {
  rent: ['rent'],
  used: ['used'],
  moving: ['moving'],
  cleaning: ['cleaning'],
  ride: ['ride'],
  repair: ['repair'],
  translation: ['service', 'other'],
  'part-time': ['other'],
  other: ['other'],
};

export const getGuidesByCategory = (
  category: GuideCategory,
  limit?: number
): Guide[] => {
  const list = guides.filter((g) => g.category === category);
  return limit ? list.slice(0, limit) : list;
};

export const getGuidesForCategorySlug = (
  categorySlug: string,
  limit = 3
): Guide[] => {
  const keys = CATEGORY_SLUG_RECOMMENDED[categorySlug] ?? ['other'];
  const matched = guides.filter((g) =>
    g.recommendedForCategories.some((c) => keys.includes(c))
  );
  const order = (g: Guide) =>
    (g.priority === 'P0' ? 0 : g.priority === 'P1' ? 1 : 2);
  return [...matched]
    .sort((a, b) => order(a) - order(b))
    .slice(0, limit);
};

export const GUIDE_CATEGORY_TABS: { id: 'all' | GuideCategory; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'rent', label: '租房' },
  { id: 'roommate', label: '找室友' },
  { id: 'used', label: '二手' },
  { id: 'service', label: '本地服务' },
  { id: 'commute', label: '通勤' },
  { id: 'newcomer', label: '新手' },
  { id: 'city', label: '城市指南' },
];

export const CATEGORY_STRIP_TITLES: Record<string, string> = {
  rent: '租房前先看',
  used: '二手交易先看',
  moving: '找本地服务先看',
  cleaning: '找本地服务先看',
  ride: '接送通勤先看',
  repair: '找本地服务先看',
  translation: '相关生活指南',
  'part-time': '相关生活指南',
  other: '相关生活指南',
};

export const getRelatedGuides = (guide: Guide, limit = 3): Guide[] =>
  guides
    .filter(
      (g) =>
        g.slug !== guide.slug &&
        (g.category === guide.category ||
          g.recommendedForCategories.some((c) =>
            guide.recommendedForCategories.includes(c)
          ))
    )
    .slice(0, limit);
