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
    readMinutes: 7,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是写给第一次在湾区找房、准备换房、找短租或转租的人。重点不是让你怀疑所有房源，而是帮你在看房、转账、签合同前三个环节少踩坑，尽量把明显有风险的情况提前筛掉。',
      },
      { type: 'heading', text: '先判断这是不是一个正常租房流程' },
      {
        type: 'paragraph',
        text: '正常流程通常是先看房或视频看房，再确认出租人身份、房屋地址、费用结构、入住时间和合同内容，最后才谈付款。只要对方一开始就催你先打钱，说不付款就立刻给别人，或者一直不愿意让你看到房子本身，就要提高警惕。',
      },
      { type: 'heading', text: '看房前先核对的几件事' },
      {
        type: 'checklist',
        items: [
          '把地址放到地图里看一遍，确认确实有这个房子，不是空地、办公楼或明显不匹配的地点。',
          '看图片和租金是否合理，如果同区域明显便宜很多，要先问原因，不要只觉得捡到便宜。',
          '要求对方说明自己是房东、物业、主租人还是室友，身份说法前后不一致就先别继续。',
          '不能线下看房时，尽量要求实时视频看房，不要只看预录视频或几张截图。',
          '先问清楚月租、押金、租期、是否包水电网、有没有停车位、能不能养宠物。',
        ],
      },
      { type: 'heading', text: '转账前最容易出事的地方' },
      {
        type: 'paragraph',
        text: '湾区很多租房纠纷不是出在合同太复杂，而是出在钱转得太早。没看房、没确认身份、没看到明确书面信息前，不建议直接转 Zelle、Cash App、Venmo 或其他很难追回的付款。尤其是对方要求你把钱打到私人账号，还催你当场完成时，更要停一下。',
      },
      {
        type: 'list',
        items: [
          '先确认这笔钱到底是什么：申请费、holding deposit、押金，还是第一月房租。',
          '先确认收款人姓名和出租人身份是否一致。',
          '先确认如果没租成，这笔钱是否可退，怎么退，最好有书面说明。',
          '不要因为对方说自己人在外州、国外、出差、钥匙托管，就跳过核验。',
        ],
      },
      { type: 'heading', text: '签合同前一定要问清楚什么' },
      {
        type: 'paragraph',
        text: '很多人抢房时只看月租和入住日期，结果后面才发现停车、清洁、续租、提前搬走、加室友这些都有限制。签字前至少要把费用、租期、维修责任、转租限制和搬出要求问清楚。涉及押金、申请费、提前解约责任等内容，建议以合同和官方信息为准。',
      },
      {
        type: 'tip',
        title: '一个简单判断方法',
        text: '如果你发现自己已经开始因为怕错过房子，而忽略了地址核验、身份核验和书面说明，这通常就是该慢下来的时候。真正靠谱的出租方，通常不怕你多问两句。',
      },
      { type: 'heading', text: '这些信号值得直接放弃' },
      {
        type: 'list',
        items: [
          '对方拒绝实时看房，只愿意发照片。',
          '一上来就要求先付全额押金或大额订金。',
          '价格特别低，但解释一直含糊。',
          '合同或付款说明迟迟不给，只让你先转钱。',
          '说房子很多人抢，但连基本信息都讲不清楚。',
        ],
      },
      {
        type: 'cta',
        title: '开始认真找房',
        text: '想找更适合自己的房源，可以先浏览 BAYLINK 租房分类；如果你有明确预算、区域和入住时间，也可以直接发布求租需求，让信息更快对上。',
        primaryLabel: '浏览租房分类',
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
    readMinutes: 8,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给刚到湾区的新移民、留学生、刚换工作搬来的人准备的。第一个月最容易乱的不是事情太难，而是事情太多：住哪里、怎么通勤、手机怎么办、日常怎么买东西。先把顺序排好，生活会轻松很多。',
      },
      { type: 'heading', text: '第一周先把住和行稳定下来' },
      {
        type: 'paragraph',
        text: '刚到湾区，不建议一开始就把所有事情一次做完。第一目标是先把住处、出行和基本通讯稳定下来。住得稳，后面办银行卡、买车、换长期租房、熟悉城市都会顺很多。',
      },
      {
        type: 'checklist',
        items: [
          '先确认临时住处或正式住处的入住安排，别落地当天才发现拿不到钥匙。',
          '把常去的地点先存好：住处、学校、公司、超市、机场、最近的车站。',
          '先下载地图和常用打车、公交、外卖类应用，避免出门时手忙脚乱。',
          '如果接下来两周都要跑看房或办事，先估一下自己更适合公交、拼车还是租车。',
        ],
      },
      { type: 'heading', text: '租房不要一上来就想一步到位' },
      {
        type: 'paragraph',
        text: '很多新来湾区的人会急着马上签长期房，但如果你对通勤、城市差异、生活圈还没感觉，先给自己一点观察时间反而更稳。第一个月最实用的目标不是找到完美房子，而是先确认自己适合哪个区域、什么通勤方式、能接受多少预算。',
      },
      {
        type: 'list',
        items: [
          '先用 1 到 2 周感受通勤，再决定是不是要住得离公司或学校更近。',
          '看房时不要只看房间本身，也要看晚上回家路线、超市距离和停车情况。',
          '合租要提前问清楚厨房、洗衣、访客、作息和分账方式。',
          '涉及押金、合同、申请流程等内容，建议以合同和官方信息为准。',
        ],
      },
      { type: 'heading', text: '手机、支付和日常采购先走简单路线' },
      {
        type: 'paragraph',
        text: '第一个月不要急着把所有生活配置拉满。手机先解决可用，支付先解决顺手，家里用品先解决够用。很多人一开始买太多、开太多、办太快，反而浪费时间和钱。',
      },
      {
        type: 'list',
        items: [
          '手机先确认本地号码和流量能正常用，方便看房、联系学校公司和收验证码。',
          '买生活用品时先从基础开始：被子、洗漱、简单厨具、转换插头、清洁用品。',
          '如果暂时没有车，优先住在买菜方便、离车站不太远的地方。',
          '第一个月先建立一个固定补货点，比如常去超市、药店和附近快递点。',
        ],
      },
      { type: 'heading', text: '通勤和生活半径要尽快摸清' },
      {
        type: 'paragraph',
        text: '湾区地图看起来不大，但城市之间通勤差异很明显。你需要尽快弄清楚自己是依赖 BART、Caltrain、开车，还是混合通勤。不要只看地图上的距离，也要看换乘、停车、晚归和最后一公里。',
      },
      {
        type: 'tip',
        title: '第一个月最值回票价的动作',
        text: '挑两个工作日，用你以后可能真的会用的路线去跑一次通勤。纸面上看 30 分钟，实际可能因为等车、走路、找停车位变成 55 分钟。这个体验比看攻略更有用。',
      },
      { type: 'heading', text: '给自己留一点缓冲' },
      {
        type: 'paragraph',
        text: '刚到湾区的前几周，很多判断都会变。你原本觉得想住市中心，可能后来更在意安静和停车；原本觉得要自己开车，后来发现通勤列车更省心。先把生活跑起来，再逐步升级，不用第一周就把一切定死。',
      },
      {
        type: 'cta',
        title: '继续把生活安排顺',
        text: '想继续补齐湾区落地信息，可以接着看 BAYLINK 的生活指南；如果你现在最急的是找房、找室友或通勤接送，也可以直接发布需求。',
        primaryLabel: '继续看指南',
        primaryAction: 'guides',
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
    readMinutes: 7,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给准备在湾区合租、找室友、接室友的人看的。找室友最怕的不是性格不一样，而是钱、作息、访客、清洁这些事一开始没讲清楚，后面越住越尴尬。',
      },
      { type: 'heading', text: '先确认你找的是室友，不是临时搭伙' },
      {
        type: 'paragraph',
        text: '合租不是只看预算合不合适，还要看生活方式能不能长期共处。有人希望家里安静、干净、规律，有人更在意地段和价格。如果一开始只聊房租，不聊生活习惯，后面冲突通常来得很快。',
      },
      { type: 'heading', text: '合租前最该提前说清楚的 5 件事' },
      {
        type: 'checklist',
        items: [
          '钱怎么分：房租、水电网、停车、清洁用品、公共开销怎么摊。',
          '谁负责和房东或物业沟通，房租由谁统一转，晚交怎么办。',
          '作息和边界：几点后尽量安静，能不能在家办公，厨房和客厅怎么用。',
          '访客规则：朋友来住多久算正常，伴侣是否常来，节假日怎么处理。',
          '搬走规则：有人提前退租怎么办，押金怎么算，替代室友谁来找。',
        ],
      },
      { type: 'heading', text: '看房和聊室友时别只问房间' },
      {
        type: 'paragraph',
        text: '很多人看房只看采光和租金，真正住进去之后才发现问题都在公共空间。冰箱怎么分、锅碗能不能共用、卫生间清洁怎么轮、洗衣时间会不会撞，都比你想象中更影响日常心情。',
      },
      {
        type: 'list',
        items: [
          '直接问现在家里最常见的矛盾是什么，比问大家相处得好不好更真实。',
          '看看厨房和卫生间状态，通常能看出家里的清洁习惯。',
          '问清楚现在住的都是什么类型的人：学生、上班族、远程办公、倒班。',
          '如果你对安静、宠物、抽烟或做饭味道比较敏感，最好提前讲。',
        ],
      },
      { type: 'heading', text: '钱的事一定要留痕' },
      {
        type: 'paragraph',
        text: '不管你是主租人还是后来加入的人，涉及房租、押金、转账和分账，都建议留书面记录。群聊里讲清楚比心里默认靠谱得多。涉及合同、押金归属和退租责任时，建议以租约内容和双方确认记录为准。',
      },
      { type: 'heading', text: '这些信号说明你要再想想' },
      {
        type: 'list',
        items: [
          '对方一直回避谈分账和押金，只说到时候再看。',
          '家里谁负责什么完全说不清楚。',
          '现有室友之间气氛明显紧张，但没人愿意说明原因。',
          '主租人要求你先转钱，但不愿意给明确的房间、入住和退租说明。',
          '你已经感觉不舒服，却还在安慰自己先住再说。',
        ],
      },
      {
        type: 'tip',
        title: '先把尴尬留在入住前',
        text: '很多话看起来不好意思问，比如伴侣留宿、爸妈来住、深夜洗衣、客厅能不能打游戏，但这些问题住进去后再聊会更难。能提前说清楚，其实是在保护彼此。',
      },
      { type: 'heading', text: '合租不是找最像自己的人' },
      {
        type: 'paragraph',
        text: '合适的室友不一定跟你兴趣相同，但最好在规则感、生活边界和沟通方式上比较接近。湾区很多合租能住得顺，不是因为大家特别熟，而是因为大家把该说的都说明白了。',
      },
      {
        type: 'cta',
        title: '开始找更合适的室友',
        text: '如果你已经想清楚预算、区域和生活习惯，可以在 BAYLINK 发布找室友或求租需求；也可以先去浏览相关分类，看看现在都有哪些房源和室友信息。',
        primaryLabel: '发布找室友需求',
        primaryAction: 'post',
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
    readMinutes: 8,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给每天要在湾区上班、上学、跨城跑的人看的。通勤方式没有标准答案，真正要比较的不是谁最快，而是谁更适合你的时间、停车条件、最后一公里和晚归安全。',
      },
      { type: 'heading', text: '先别只看地图距离' },
      {
        type: 'paragraph',
        text: '湾区通勤最容易误判的地方，就是看着地图不远，实际却要换乘、找停车、走很长一段路，或者一旦错过一班车就会多等很久。所以比较通勤方式时，最好按完整一趟门到门时间来算，不要只看车上那一段。',
      },
      { type: 'heading', text: 'BART 更适合哪些情况' },
      {
        type: 'list',
        items: [
          '起点和终点都离站点不远，或者最后一公里容易解决。',
          '你不想每天自己开车进城、找停车位、扛堵车压力。',
          '通勤路线比较稳定，主要集中在东湾、旧金山、市中心连接段。',
          '你可以接受高峰期人多，愿意用时间换掉停车和开车成本。',
        ],
      },
      { type: 'heading', text: 'Caltrain 更适合哪些情况' },
      {
        type: 'paragraph',
        text: '如果你的路线主要在 Peninsula 和 South Bay 之间，Caltrain 往往是很多通勤族会认真考虑的选项。坐车过程相对稳定，但你仍然要看站点离家和公司有多远，站点周边停车、接驳和下车后的最后一公里怎么解决。票价、班次和时刻表这类信息容易变化，建议以官方信息为准。',
      },
      { type: 'heading', text: '开车和拼车什么时候更现实' },
      {
        type: 'paragraph',
        text: '如果你的起点终点都不靠轨道交通，或者需要接送孩子、带很多东西、下班时间不固定，开车通常更有弹性。但开车不只是油费问题，还要把停车、桥费、堵车、车辆维护和下雨天通勤一起算进去。拼车适合有固定同事或同学路线的人，但前提是时间真的能对得上。',
      },
      {
        type: 'checklist',
        items: [
          '把完整门到门时间算进去，包括走到车站、等车、换乘和最后一段步行。',
          '确认目的地附近停车是否稳定，是否需要额外费用或提前到。',
          '想想你能不能接受晚归时还要再转一趟车或走一段夜路。',
          '如果一周只去办公室两三天，混合通勤可能比全程开车更省心。',
          '至少试跑一次真实路线，不要只靠导航预估。',
        ],
      },
      { type: 'heading', text: '很多人最后会选混合通勤' },
      {
        type: 'paragraph',
        text: '湾区很常见的做法不是全程只用一种方式，而是开车到站、坐车进城，或者平时坐车、需要加班时开车。你不一定非要选最省钱或最快的那个，能长期坚持、身体压力小、时间波动可控，通常更重要。',
      },
      {
        type: 'tip',
        title: '晚归安全别到最后才想',
        text: '很多路线白天看起来都没问题，真正拉开差距的是晚上。如果你经常加班、上夜课或周末回家晚，最后一公里有没有人接、车站周边安不安全、打车是否方便，都值得提前考虑。',
      },
      { type: 'heading', text: '先找到适合你当前阶段的方案' },
      {
        type: 'paragraph',
        text: '刚来湾区的人，先用能跑起来的方案就好，不一定一步到位。你住处、工作地点和生活习惯稳定后，再慢慢优化通勤方式，通常更现实。',
      },
      {
        type: 'cta',
        title: '继续找更顺手的通勤方案',
        text: '如果你在找接送、拼车或更适合自己的生活区域，可以继续浏览 BAYLINK 的通勤相关分类，看看现在有哪些本地信息和需求。',
        primaryLabel: '浏览通勤分类',
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
    readMinutes: 7,
    updatedAt: '2025-05-01',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给准备在湾区买卖二手物品的人看的。二手交易本身很正常，关键是别因为想省一点钱或想赶快出手，就把面交地点、付款方式和验货步骤都省掉。',
      },
      { type: 'heading', text: '先判断这笔交易值不值得继续聊' },
      {
        type: 'paragraph',
        text: '二手交易里最常见的问题不是假货有多高级，而是信息太少、节奏太急。价格特别低、描述特别模糊、对方一直催你先付定金，或者连基本照片和使用情况都不愿意说清楚，这种通常没必要硬聊。',
      },
      { type: 'heading', text: '聊天阶段先确认什么' },
      {
        type: 'checklist',
        items: [
          '让对方补几张当前实拍，不要只看平台封面图。',
          '问清楚成色、购买时间、有没有维修过、有没有缺件。',
          '如果是电子产品，提前问能不能现场开机、登录、测试主要功能。',
          '如果是家具，提前确认尺寸、搬运方式、电梯或楼梯情况。',
          '如果是高价值物品，先确认有没有原包装、序列号、购买凭证或保修信息。',
        ],
      },
      { type: 'heading', text: '面交地点不要随便选' },
      {
        type: 'paragraph',
        text: '公共地点面交通常比私人住址更稳，尤其是手机、电脑、相机、游戏机这类容易有争议的物品。白天、人多、好停车、附近方便继续测试或确认的地方，会比临时约在偏僻路边更安心。',
      },
      {
        type: 'list',
        items: [
          '优先选商场、咖啡店附近、超市停车场这类公开地点。',
          '第一次交易高价值物品时，不建议直接去对方家里或让对方来你家里。',
          '如果要搬大件家具，可以先小额确认，再安排正式搬运时间。',
          '晚间交易要额外考虑照明、停车和周边环境。',
        ],
      },
      { type: 'heading', text: '付款前一定先验货' },
      {
        type: 'paragraph',
        text: '很多人面交时不好意思多看，怕显得不信任，结果回家才发现问题。其实二手交易最正常的事，就是当场确认。能开机的就开机，能试功能的就试功能，能对尺寸和配件的就对清楚。没有验货就先转账，后面通常很被动。',
      },
      { type: 'heading', text: '这些情况建议直接终止交易' },
      {
        type: 'list',
        items: [
          '对方临时改地点，改到很偏或很赶的地方。',
          '说好面交验货，到现场却一直催你先付款。',
          '实物状态和聊天描述差很多，还一直解释。',
          '电子产品不让你开机、不让你检查账号锁定状态。',
          '对方要求你先付定金保留，但没有足够信息让你确认物品真实性。',
        ],
      },
      {
        type: 'tip',
        title: '别把礼貌放在安全前面',
        text: '面交时多看两分钟、多问两句，不是不信任对方，而是在保护自己。靠谱的卖家通常也希望买家现场确认清楚，省得之后反复沟通。',
      },
      { type: 'heading', text: '卖东西的人也要保护自己' },
      {
        type: 'paragraph',
        text: '如果你是卖家，也别为了快出手就什么都答应。提前说明物品情况、接受的付款方式和面交时间，能减少很多无效沟通。对方如果一直改时间、临时砍价、要求先拿走再付款，也要果断一些。',
      },
      {
        type: 'cta',
        title: '去看看更靠谱的二手信息',
        text: '想继续找本地二手信息，可以先浏览 BAYLINK 的二手分类；如果你正在找特定物品，也可以直接发布需求，让附近用户更容易看到。',
        primaryLabel: '浏览二手分类',
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
