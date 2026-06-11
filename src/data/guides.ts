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
    updatedAt: '2026-05-22',
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
    updatedAt: '2026-05-22',
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
    updatedAt: '2026-05-22',
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
    updatedAt: '2026-05-22',
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
    updatedAt: '2026-05-22',
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
    readMinutes: 7,
    updatedAt: '2026-05-22',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给准备在湾区签租房合同的人看的。很多人抢房时只盯着月租和入住日期，真正容易出问题的反而是合同里的细节，比如押金怎么退、室友能不能换、提前搬走怎么办、维修谁负责。',
      },
      { type: 'heading', text: '先看最核心的四项信息' },
      {
        type: 'paragraph',
        text: '合同拿到手，先不要急着翻到签字页。第一步先确认地址、租期、月租、付款时间是不是都写清楚，和你之前谈好的内容是不是一致。只要这几项有任何含糊，后面越看越容易乱。',
      },
      {
        type: 'checklist',
        items: [
          '房屋地址是否完整，房间号、车位、储物空间有没有写清楚。',
          '租期是固定租期还是 month-to-month，起止时间有没有写明。',
          '月租金额、付款日期、迟付处理方式有没有说明。',
          '押金、预留金、其他费用分别是什么性质，有没有写在同一份文件里。',
        ],
      },
      { type: 'heading', text: '不要只看月租，还要看总成本' },
      {
        type: 'paragraph',
        text: '湾区不少房子看起来月租还能接受，但真正住进去才发现停车、水电网、垃圾、公共区域、洗衣、宠物、搬入搬出相关费用都不小。签约前最好把每个月可能固定发生的支出列出来，不要靠印象判断。涉及收费规则和可收取范围，建议以合同和官方信息为准。',
      },
      {
        type: 'list',
        items: [
          '停车位是不是另外收费，访客停车是否方便。',
          '水、电、燃气、网络、垃圾是谁付，怎么算。',
          '如果是 apartment，是否有 move-in 预约、门禁、包裹或公共设施使用规则。',
          '合租情况下，公共费用是均摊还是按房间分。',
        ],
      },
      { type: 'heading', text: '提前搬走、续租、转租这些条款最容易被忽略' },
      {
        type: 'paragraph',
        text: '很多人签的时候觉得先住进去再说，后面遇到换工作、室友搬走、想换城市时，才发现限制都在合同里。你要重点看固定租期没住满怎么办、能不能找 replacement tenant、能不能转租、租满后怎么续、室友更换要不要重新审批。',
      },
      { type: 'heading', text: '维修责任和入住状态要问清楚' },
      {
        type: 'paragraph',
        text: '如果合同里对维修、报修、清洁、家电责任写得很模糊，入住后最容易来回扯。签约前最好问清楚哪些问题由房东或物业处理，哪些可能需要租客自己负责，入住时房屋现状要不要做记录。',
      },
      {
        type: 'tip',
        title: '一个很实用的做法',
        text: '把你最在意的三件事单独写下来，比如停车、提前搬走、能不能加室友。签字前只要这三件事还没讲清楚，就别让自己被“先签再说”推着走。',
      },
      { type: 'heading', text: '合租用户要额外确认的事' },
      {
        type: 'list',
        items: [
          '谁是主租人，谁直接写进合同。',
          '押金最后退给谁，室友之间怎么分。',
          '有人中途搬走时，新室友如何接替。',
          '如果其中一人晚交租，是否会影响全屋。',
        ],
      },
      {
        type: 'cta',
        title: '先把需求想清楚再找房',
        text: '如果你已经知道自己更看重预算、区域还是通勤，可以先去 BAYLINK 浏览租房分类；如果你想让房源更快匹配，也可以直接发布求租需求。',
        primaryLabel: '浏览租房分类',
        primaryAction: 'category',
        categorySlug: 'rent',
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
    readMinutes: 8,
    updatedAt: '2026-05-22',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给准备搬入新房、或者即将搬出当前住处的租客看的。很多押金和交接问题，不是因为发生了大事，而是因为当时没拍照、没留记录、没把交接讲清楚。',
      },
      { type: 'heading', text: '搬入第一天先别急着收拾' },
      {
        type: 'paragraph',
        text: '刚拿到钥匙时最重要的事不是摆家具，而是先把房屋现状记录下来。墙面、地板、窗户、浴室、厨房、电器、门锁、遥控器、停车位，只要以后可能和押金、责任有关的，都值得先留底。',
      },
      {
        type: 'checklist',
        items: [
          '拍整屋照片和视频，尽量带上时间顺序，别只拍局部。',
          '把现有划痕、污渍、松动、缺件和不能正常使用的地方单独记录。',
          '钥匙、门禁、邮箱钥匙、车库遥控器数量要确认清楚。',
          '把入住当天发现的问题尽快发给房东、物业或主租人留痕。',
        ],
      },
      { type: 'heading', text: '押金相关信息最好一开始就对清楚' },
      {
        type: 'paragraph',
        text: '很多人直到搬出前才去翻当时交了什么钱、怎么退，已经晚了。入住时就要确认哪些属于押金、哪些是租金、哪些是其他费用，搬出后由谁对接、按什么方式退。具体规则、时限和扣款标准容易变化，建议以合同、官方信息或专业意见为准。',
      },
      { type: 'heading', text: '住的过程中要把小问题养成记录习惯' },
      {
        type: 'paragraph',
        text: '住进去之后，像漏水、墙皮脱落、电器异常、门锁卡住这类问题，最好不要拖到搬出时才说。越早反馈，越容易分清是原本就有的问题，还是后续使用中发生的情况。',
      },
      {
        type: 'list',
        items: [
          '报修尽量留文字记录，不要只口头讲。',
          '如果是合租，公共区域的损耗和清洁最好平时就说清楚。',
          '自己添置或更换过的东西，搬走前要确认是不是需要恢复原状。',
          '重要沟通尽量别散落在多个聊天窗口里。',
        ],
      },
      { type: 'heading', text: '搬出前别只想着打包' },
      {
        type: 'paragraph',
        text: '真正影响交接顺不顺的，是你搬出前一周到最后一天做了什么。清洁、修补、拍照、钥匙归还、最后一次巡检，这些都比你想象中更重要。尤其是合租用户，谁负责公共区域、谁最后关电关网，也要提前安排。',
      },
      {
        type: 'checklist',
        items: [
          '把自己的物品和垃圾彻底清空，不要留下“之后再回来拿”的模糊状态。',
          '基础清洁至少要做到厨房、浴室、地面、冰箱和垃圾处理清楚。',
          '搬出当天再拍一轮全屋照片和视频，尤其是原来有争议的位置。',
          '把钥匙、门禁、停车证、包裹柜权限等交接方式提前说好。',
          '保留 forwarding address 和最后的转账、交接记录。',
        ],
      },
      { type: 'heading', text: '合租搬出时最容易卡住的地方' },
      {
        type: 'paragraph',
        text: '如果你不是整套房一起搬走，而是中途退出合租，最容易出问题的是押金怎么结、房间由谁接、公共物品怎么分。不要默认主租人会自动处理好，也不要默认下一位室友进来就能顺利接上。',
      },
      {
        type: 'tip',
        title: '照片不是为了吵架，是为了省事',
        text: '很多人觉得拍太多像不信任别人，其实完整记录往往能减少来回解释。搬入和搬出各留一套清楚的照片，比事后回忆“当时好像不是这样”有效得多。',
      },
      {
        type: 'cta',
        title: '搬家前顺手把下一步也安排好',
        text: '如果你接下来还要找新房、找室友，或者需要搬家相关帮助，可以继续浏览 BAYLINK 的租房和搬家相关分类，提前把需求发出来会轻松很多。',
        primaryLabel: '浏览搬家分类',
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
    readMinutes: 7,
    updatedAt: '2026-05-22',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给准备在湾区找搬家、清洁、维修等本地服务的人看的。很多服务不是完全做不好，而是报价不透明、沟通不清楚、临时加价、到场效果和承诺不一致，所以找之前多做一步筛选，后面会省掉很多麻烦。',
      },
      { type: 'heading', text: '先别急着找最便宜的' },
      {
        type: 'paragraph',
        text: '本地服务最常见的问题，不是价格高，而是低价把你吸引进去，后面再靠加项目、加时长、加材料费把总价拉上去。尤其是搬家、深度清洁、上门维修这种很难只靠一句话报价的服务，更要先把范围讲清楚。',
      },
      { type: 'heading', text: '问报价时要把条件说完整' },
      {
        type: 'checklist',
        items: [
          '搬家要说明起点终点、楼层、电梯、停车情况、大件家具和箱子大概数量。',
          '清洁要说明是日常清洁、搬出清洁、深度清洁，还是局部重点处理。',
          '维修要说明问题发生在哪、多久了、是否影响正常使用，最好有照片或视频。',
          '确认报价是按小时、按次、按项目，还是到场后再评估。',
        ],
      },
      { type: 'heading', text: '怎么判断对方靠不靠谱' },
      {
        type: 'paragraph',
        text: '靠谱不靠谱，很多时候不是看广告写得多好，而是看对方愿不愿意把细节讲明白。比如回复是否稳定、是否愿意确认服务范围、是否会主动问现场条件、是否能把时间和价格说清楚。信息越具体，后续扯皮通常越少。',
      },
      {
        type: 'list',
        items: [
          '报价前会先问细节，而不是上来就拍一个很低的价格。',
          '愿意把服务内容、预计时间和可能额外收费讲清楚。',
          '约时间比较稳，不是一会儿说能来一会儿又消失。',
          '对你发过去的照片、位置和问题描述有认真回应。',
        ],
      },
      { type: 'heading', text: '这些情况要特别小心' },
      {
        type: 'list',
        items: [
          '一直催你立刻付定金，但范围和价格都没写清楚。',
          '报价明显低很多，到场后却不断增加项目。',
          '沟通里承诺很多，但不愿意留下任何文字记录。',
          '上门时间模糊，只说大概某天某个时段。',
          '别人已经反馈过临时放鸽子、迟到很久或做完不收尾。',
        ],
      },
      { type: 'heading', text: '上门当天也要留一点余地' },
      {
        type: 'paragraph',
        text: '无论是搬家、清洁还是维修，到场当天都建议先做一次快速确认：今天具体做什么、不做什么、预计多久、如果现场情况和之前描述不同会怎么处理。这样不是挑剔，而是避免双方想的根本不是同一件事。',
      },
      {
        type: 'tip',
        title: '先把最怕出问题的点讲出来',
        text: '比如你最担心木地板刮伤、宠物跑出去、墙面被碰坏、维修后还要返工，就在服务开始前直接说。很多问题不是不能处理，而是你没说，对方也默认不知道。',
      },
      { type: 'heading', text: '适合在 BAYLINK 发什么样的需求' },
      {
        type: 'paragraph',
        text: '如果你要找服务，需求写得越具体，越容易遇到真正合适的人。地点、时间、房型、楼层、物品量、问题描述、有没有停车、有没有电梯，这些信息都比一句“急找搬家”更有用。',
      },
      {
        type: 'cta',
        title: '把需求写清楚，更容易找到靠谱服务',
        text: '如果你需要搬家、清洁或维修，可以先把时间、地点、房型、照片和预算范围写清楚，在 BAYLINK 发布需求，让合适的人来联系你。',
        primaryLabel: '发布服务需求',
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
    readMinutes: 8,
    updatedAt: '2026-05-22',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给准备住在 Peninsula 一带的人看的，重点放在 San Mateo、Millbrae、Burlingame 这几个常被一起比较的城市。它们都不算离旧金山太远，生活也相对成熟，但住起来的感觉、通勤方式和预算压力还是很不一样。',
      },
      { type: 'heading', text: '这几个城市大致适合什么人' },
      {
        type: 'paragraph',
        text: '如果你在旧金山和南湾之间通勤，或者想住得比市区更稳一点，但又不想离机场、Caltrain、生活配套太远，这几个地方都值得看。San Mateo 相对更综合，Millbrae 对机场和交通更敏感，Burlingame 则常被觉得生活感比较舒服、街区更整齐。',
      },
      { type: 'heading', text: '通勤方向怎么想会更实际' },
      {
        type: 'paragraph',
        text: 'Peninsula 的核心优势之一，就是夹在旧金山和南湾之间。对很多人来说，这里不是最便宜的选择，但通勤弹性通常不错。你要重点想的是自己主要往哪里跑，是进城、去 South Bay，还是常常要去机场或跨城办事。',
      },
      {
        type: 'list',
        items: [
          '如果主要靠 Caltrain，住得离站点和最后一公里顺不顺会很关键。',
          '如果平时更常开车，早晚高峰和停车会比纸面距离更影响体验。',
          '如果经常出差，Millbrae 一带对机场需求通常更友好。',
          '如果工作地点会变，住在中间地带往往比极端靠一边更稳。',
        ],
      },
      { type: 'heading', text: '租房时通常会看到什么类型的选择' },
      {
        type: 'paragraph',
        text: '这几个城市常见的租房选择包括 apartment、公寓式社区、小楼单元、独立屋分租和 ADU。对预算敏感的人来说，整租和合租体验差别会很大。你不只是要看面积和价格，也要看停车、楼层、电梯、洗衣方式和周边吃饭买菜是否方便。',
      },
      {
        type: 'checklist',
        items: [
          '先决定自己更看重通勤方便、生活便利，还是更安静的居住感。',
          '看房时确认停车条件，尤其是晚上回家后的实际可用性。',
          '如果没有车，先看离车站、超市和日常买菜点有多远。',
          '如果是合租，提前确认公共空间和储物空间够不够用。',
          '如果常点外卖、收包裹，最好看一下楼宇管理和门口环境。',
        ],
      },
      { type: 'heading', text: '生活便利度为什么很多人喜欢 Peninsula' },
      {
        type: 'paragraph',
        text: '不少华人用户会喜欢这一区域，一个现实原因就是生活过得比较顺：买菜、吃饭、接人、看医生、周末短途出门都比较方便。不是特别热闹，但也不至于太无聊，整体属于比较容易把日常过稳定的地方。',
      },
      { type: 'heading', text: '这一区域也有自己的缺点' },
      {
        type: 'paragraph',
        text: 'Peninsula 常见的压力点主要是预算和选择。你可能会发现房子不算少，但真正同时满足通勤、停车、环境和价格的并不多。部分区域晚上会安静得比较早，如果你更喜欢夜生活或非常热闹的街区，可能会觉得节奏偏平。',
      },
      {
        type: 'tip',
        title: '别只看白天的感觉',
        text: '如果你认真考虑某个区域，最好挑一个工作日晚上再去一趟。白天觉得不错的地方，晚上可能停车紧、街道太安静，或者回家路线没有你想得那么顺。',
      },
      { type: 'heading', text: '适合在 BAYLINK 发哪些需求' },
      {
        type: 'paragraph',
        text: '如果你准备住在 Peninsula，一般最适合发布的是求租、找室友、接送通勤和搬家需求。尤其是刚搬来还没完全定下长期方案的人，把预算、通勤方向和入住时间写清楚，会比只写城市名更容易匹配。',
      },
      {
        type: 'cta',
        title: '去看看 Peninsula 一带的租房信息',
        text: '如果你已经大致确定想住在 San Mateo、Millbrae 或 Burlingame 附近，可以先浏览 BAYLINK 的租房分类；如果你有明确预算和通勤方向，也可以直接发布求租需求。',
        primaryLabel: '浏览租房分类',
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
    readMinutes: 8,
    updatedAt: '2026-05-22',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '这篇文章是给准备住在南湾的人看的，重点放在 Cupertino、Sunnyvale、San Jose 这几个常被一起比较的区域。很多人一听南湾就默认是一个整体，其实住感、通勤方式、预算和生活节奏差别都不小。',
      },
      { type: 'heading', text: '这几个地方分别更适合谁' },
      {
        type: 'paragraph',
        text: '如果你重视学校、社区稳定感和相对安静的生活节奏，Cupertino 常常会进入考虑范围。Sunnyvale 对不少科技公司通勤比较友好，住感相对平衡。San Jose 范围更大，选择更多，生活半径也更分散，不同片区差异会非常明显。',
      },
      { type: 'heading', text: '通勤方向比城市名字更重要' },
      {
        type: 'paragraph',
        text: '南湾找房最容易犯的错，就是先决定城市，再勉强适应通勤。更实际的做法通常是先看你每天要去哪里，再倒推自己适合住在哪一侧。尤其是需要跨城、接送家人、偶尔去 Peninsula 或 East Bay 的人，通勤成本会很快拉开差距。',
      },
      {
        type: 'checklist',
        items: [
          '先确认自己主要通勤去公司、学校还是多个点位轮流跑。',
          '如果依赖开车，要把高峰堵车和停车难度一起算进去。',
          '如果想用轨道交通或接驳，先看最后一公里是否真的方便。',
          '如果家庭成员行程不同，优先找大家都不至于太痛苦的位置。',
        ],
      },
      { type: 'heading', text: '租房选择通常会比 Peninsula 更分层' },
      {
        type: 'paragraph',
        text: '南湾常见房型很多，从 apartment、联排、公寓、小区整租到独立屋分租都有。好处是选择面更广，坏处是同一个城市里，生活便利度、街区状态、停车体验和安静程度可能差很多。看房时不要只靠城市标签判断。',
      },
      {
        type: 'list',
        items: [
          'Cupertino 往往更容易被家庭和长期居住用户关注。',
          'Sunnyvale 常见的是通勤和生活平衡型选择。',
          'San Jose 因为范围大，预算不同的人都能找到候选，但需要更细看具体片区。',
          '如果是合租，公共空间和车位安排会很影响实际体验。',
        ],
      },
      { type: 'heading', text: '生活便利度和节奏感有什么区别' },
      {
        type: 'paragraph',
        text: '南湾整体生活便利度不低，但更多时候是开车型便利，不一定是下楼走路就能解决一切。你要想清楚自己更喜欢什么节奏：是安静、规律、偏家庭型，还是选择多、吃喝方便、活动半径更大。',
      },
      { type: 'heading', text: '可能的缺点也要提前接受' },
      {
        type: 'paragraph',
        text: '住南湾的人常见吐槽通常集中在通勤堵、生活需要车、区域差异太大、看房时很难一次判断清楚。有些地方白天看着很方便，晚上可能比较空；有些地方租房选择多，但你要花更多时间筛。',
      },
      {
        type: 'tip',
        title: '看房时顺手做一件事',
        text: '除了看房间本身，建议你从房子出发，实际开一次去公司、去超市或去接孩子的路线。南湾很多决定成败的细节，不在房子里，而在你每天要不要花很多时间在路上。',
      },
      { type: 'heading', text: '适合在 BAYLINK 发布哪些需求' },
      {
        type: 'paragraph',
        text: '如果你想住南湾，最适合发布的通常是求租、找室友、通勤接送和搬家需求。尤其是有明确公司区域、学校位置、预算上限的人，把这些信息写清楚，比只说“想住南湾”更容易遇到真正合适的选择。',
      },
      {
        type: 'cta',
        title: '开始筛选更适合你的南湾住处',
        text: '如果你正在比较 Cupertino、Sunnyvale 和 San Jose，可以先从 BAYLINK 的租房分类开始看；如果你已经确定了预算和通勤方向，也可以直接发布求租需求。',
        primaryLabel: '浏览租房分类',
        primaryAction: 'category',
        categorySlug: 'rent',
      },
    ],
  },
  {
    slug: 'bay-area-regions-explained',
    title: '湾区区域怎么分：旧金山、半岛、南湾、东湾、北湾适合谁？',
    subtitle: '先看区域，再看城市，找房和通勤都会轻松很多。',
    summary:
      '刚来湾区先别急着背城市名，先把旧金山、半岛、南湾、东湾、北湾的生活差异搞清楚，后面找房、找室友和看 City Guide 都会更有方向。',
    category: 'city',
    categoryLabel: '城市指南',
    emoji: '🗺️',
    audience: ['新移民', '留学生', '第一次在湾区找房的人', '想理解区域差异的人'],
    tags: ['湾区分区', '旧金山', '半岛', '南湾', '东湾', '北湾'],
    priority: 'P0',
    featuredOnHome: true,
    recommendedForCategories: ['rent', 'ride', 'service'],
    readMinutes: 8,
    updatedAt: '2026-06-10',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '很多人刚来湾区，先开始记城市名，结果越看越乱。更稳的办法不是先背 San Francisco、San Jose、Fremont，而是先把区域搞清楚，因为你后面找房、通勤、接机、买二手、找搬家，很多时候都不是在选一个城市，而是在选一整片生活半径。',
      },
      { type: 'heading', text: '为什么先看区域，比先看城市更重要' },
      {
        type: 'list',
        items: [
          '先看区域，能更快排除明显不适合自己的地方。',
          '先看区域，找房时不容易只被城市名字带着走。',
          '先看区域，后面再看具体 City Guide 会更有方向。',
          '先看区域，发求租或找室友时也更容易把需求写清楚。',
        ],
      },
      { type: 'heading', text: '五大片区可以先这样理解' },
      {
        type: 'list',
        items: [
          '旧金山：城市感最强，适合喜欢步行、公共交通和经典街区的人。',
          '半岛 Peninsula：通勤和生活比较平衡，适合想住得稳一点的人。',
          '南湾 South Bay：工作、学校和华人生活圈都很完整，很多科技公司用户会优先看这里。',
          '东湾 East Bay：区域差异大，预算、空间和社区感的选择面更广。',
          '北湾 North Bay：更偏自然和慢节奏，适合有车、生活半径不靠市中心的人。',
        ],
      },
      { type: 'heading', text: '不同人群，通常会先看哪一片' },
      {
        type: 'checklist',
        items: [
          '没有车、想先住得方便：优先看旧金山或交通节点强的区域。',
          '通勤在旧金山和南湾之间：优先看半岛。',
          '在 South Bay 上班或长期生活：优先看南湾。',
          '预算敏感、愿意研究路线：可以认真看东湾。',
          '喜欢自然、节奏慢、有车：可再看北湾。',
        ],
      },
      {
        type: 'tip',
        title: '提醒',
        text: '别把“地图上看起来不远”当成真实体验。跨湾、过桥、换乘、找停车位，都会把日常时间拉长。',
      },
      { type: 'heading', text: '刚来湾区，最实用的选区逻辑' },
      {
        type: 'paragraph',
        text: '不要先问“哪座城市最好”，先问这几个问题：你主要去哪里？预算大概多少？有没有车？能不能接受合租？是不是要靠公共交通？这些问题一排，很多区域会自己浮出来。',
      },
      {
        type: 'tip',
        text: '如果你现在还分不清自己该看哪一片，先把“公司或学校在哪、有没有车、预算大概多少、能不能接受合租”写下来，再去看地图，通常会快很多。',
      },
      {
        type: 'cta',
        title: '先把适合自己的区域框出来',
        text: '可以先去看租房和接送分类，感受不同区域的真实发帖密度；如果你已经有预算和通勤方向，也可以直接发求租。',
        primaryLabel: '浏览租房分类',
        primaryAction: 'category',
        categorySlug: 'rent',
      },
    ],
  },
  {
    slug: 'bay-area-where-to-live-first-month',
    title: '刚来湾区住哪里比较稳：按通勤、预算、是否有车来选区域',
    subtitle: '先把通勤、预算和有没有车想清楚，再决定住哪里。',
    summary:
      '刚来湾区别先问哪座城市最火，先按通勤、预算和有没有车，把适合自己的区域框出来，会比盲选热门城市稳得多。',
    category: 'newcomer',
    categoryLabel: '新手指南',
    emoji: '📍',
    audience: ['新移民', '留学生', '刚换工作搬来的人', '第一次在湾区独立找房的人'],
    tags: ['住哪里', '新移民', '通勤', '预算', '没有车'],
    priority: 'P0',
    featuredOnHome: true,
    recommendedForCategories: ['rent', 'roommate'],
    readMinutes: 8,
    updatedAt: '2026-06-10',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '很多人刚到湾区，最想立刻解决的问题就是“我到底该住哪”。这个问题如果只按城市名来答，通常不够准。更实用的办法是先看你每天要去哪里，再看你愿意花多少钱，最后看你有没有车。',
      },
      { type: 'heading', text: '对刚来的人来说，什么叫“住得稳”' },
      {
        type: 'list',
        items: [
          '通勤别太硬，不然每天都会被消耗。',
          '租金别把现金流压得太死。',
          '附近最好能买菜、吃饭、收快递。',
          '如果是第一套房，先给自己留一点调整空间。',
        ],
      },
      { type: 'heading', text: '如果你主要去旧金山，通常优先看旧金山或半岛北段' },
      {
        type: 'paragraph',
        text: '如果你的学校、办公室或主要活动范围在 San Francisco，最稳的通常不是住太远，而是住在能比较顺地进城的地方。旧金山市内更适合没车、喜欢步行和公共交通的人；半岛北段更适合想住得稍微平一点、生活节奏稳一点的人。',
      },
      { type: 'heading', text: '如果你主要去 South Bay，优先看南湾或半岛中南段' },
      {
        type: 'paragraph',
        text: '如果工作或学校在 San Jose、Sunnyvale、Mountain View、Santa Clara、Cupertino 一带，先从 South Bay 附近找通常更稳。很多人一开始被旧金山吸引，后来才发现每天南下太累，再搬一次成本更高。',
      },
      { type: 'heading', text: '预算和有没有车，会直接改变你的选区逻辑' },
      {
        type: 'checklist',
        items: [
          '预算紧但要去 South Bay：可以多看 North San Jose、Milpitas、Fremont 一带。',
          '没车：优先看离车站近、买菜方便、晚上回家不折腾的地方。',
          '有车：一定要把停车、保险、桥费和晚归找位一起算进去。',
          '想先落地：可优先考虑短租、转租、室友房。',
        ],
      },
      {
        type: 'tip',
        title: '提醒',
        text: '“离站点不远”最好自己在地图上走一次。很多地方纸面上 10 分钟，实际晚归、下雨、拖行李时完全不是同一个感受。',
      },
      { type: 'heading', text: '第一套房不一定要一步到位' },
      {
        type: 'paragraph',
        text: '第一套房很多时候只是落地房，不一定是你一年后最喜欢的地方。对刚来的人来说，先把通勤、预算和生活半径跑起来，比追求一步到位更重要。',
      },
      {
        type: 'tip',
        text: '如果你现在同时在看 8 个城市，不如先把它们缩成 2 到 3 个区域。区域选对了，后面的城市和房型选择会轻松很多。',
      },
      {
        type: 'cta',
        title: '先按自己的真实条件去筛区域',
        text: '如果你已经知道预算、通勤方向和有没有车，可以直接在 BayLink 发布求租；如果还在比较，也可以先去看找室友和租房分类里的真实帖子。',
        primaryLabel: '发布求租',
        primaryAction: 'post',
      },
    ],
  },
  {
    slug: 'bay-area-first-rental-process',
    title: '湾区第一次租房流程：从看区域、看房、签约到搬入',
    subtitle: '把顺序理清楚，第一次租房会稳很多。',
    summary:
      '第一次在湾区租房，不只是找房源，更是从选区域、核验信息到签约搬入的一整套流程，顺序对了会少走很多弯路。',
    category: 'rent',
    categoryLabel: '租房',
    emoji: '🔑',
    audience: ['新移民', '留学生', '第一次租房的人', '准备换房的租客'],
    tags: ['第一次租房', '看房流程', '签约', '搬入', '租房避坑'],
    priority: 'P0',
    featuredOnHome: true,
    recommendedForCategories: ['rent'],
    readMinutes: 9,
    updatedAt: '2026-06-10',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '第一次在湾区租房，最容易卡住的不是房子少，而是信息太碎：看哪个区域、怎么判断房源、什么时候打钱、什么时候签约、搬进去要拍什么。把流程顺一遍，你会发现这件事没那么神秘，只是步骤不能乱。',
      },
      { type: 'heading', text: '第一步不是刷房源，是先定区域和底线' },
      {
        type: 'checklist',
        items: [
          '主要通勤地点在哪里。',
          '月租预算上限大概多少。',
          '是否接受合租或找室友。',
          '是否需要车位、洗衣、独立卫浴。',
          '是否必须靠 BART、Caltrain、VTA 或 Muni。',
        ],
      },
      { type: 'heading', text: '看房源时，先筛掉明显不靠谱的' },
      {
        type: 'list',
        items: [
          '租金明显低得离谱，要先提高警惕。',
          '拒绝提供基本信息的，通常不值得花时间。',
          '转租、分租、找室友，要先弄清对方是房东、主租人还是室友。',
          '没看房就催打钱的，优先当高风险处理。',
        ],
      },
      {
        type: 'tip',
        title: '提醒',
        text: '常见假房源的特征就是价格太好、看不到房、催你快点决定、要求非常规付款。越急着让你跳步骤，越要慢下来。',
      },
      { type: 'heading', text: '看房时，别只看采光和面积' },
      {
        type: 'paragraph',
        text: '第一次看房的人容易只盯着房间本身。真正住进去以后，你更常面对的是厨房、浴室、洗衣、停车、噪音、快递和晚归路线这些问题。合租的话，公共空间甚至比卧室本身更影响体验。',
      },
      { type: 'heading', text: '打钱前，先分清每一笔钱是什么' },
      {
        type: 'paragraph',
        text: '申请费、holding deposit、security deposit、第一月房租，不是同一回事。你要搞清楚这笔钱为什么交、交给谁、有没有书面记录、没租成怎么办。',
      },
      {
        type: 'tip',
        title: '提醒',
        text: '没看房、没确认身份、没看到明确书面说明前，不建议直接用很难追回的方式打大额款项。',
      },
      { type: 'heading', text: '签约前和搬入当天，各有一张重点清单' },
      {
        type: 'checklist',
        items: [
          '签约前看清地址、租期、租金、押金、费用分担、维修责任和搬出规则。',
          '拿钥匙当天先拍整屋照片和视频，再开始收拾。',
          '核对钥匙、门禁、停车证、洗衣和报修联系人。',
          '保存押金、租金和重要聊天记录。',
        ],
      },
      {
        type: 'tip',
        text: '第一次租房不一定要一步到位。先把通勤、预算和生活半径跑起来，比一开始追最理想房更重要。',
      },
      {
        type: 'cta',
        title: '把租房流程拆开做，会轻松很多',
        text: '如果你已经知道想住哪一片，可以直接在 BayLink 发布求租；如果还在比较，也可以先继续看租房相关指南，把区域、合同和搬入问题都顺一遍。',
        primaryLabel: '继续看指南',
        primaryAction: 'guides',
      },
    ],
  },
  {
    slug: 'baylink-safety-guide',
    title: 'BAYLINK 安全使用指南：手机验证、官方认证、举报和屏蔽怎么用',
    subtitle: '平台工具能帮你降低风险，但判断和留痕还是要自己做。',
    summary:
      '用 BAYLINK 找房、找室友、找服务、做二手前，先把平台里的手机验证、官方认证、举报和屏蔽这些信任工具用起来。',
    category: 'safety',
    categoryLabel: '安全指南',
    emoji: '🛡️',
    audience: ['找房用户', '找室友用户', '二手买卖用户', '本地服务需求方'],
    tags: ['平台安全', '手机验证', '官方认证', '举报', '屏蔽'],
    priority: 'P0',
    featuredOnHome: false,
    recommendedForCategories: ['rent', 'used', 'service', 'ride'],
    readMinutes: 6,
    updatedAt: '2026-06-10',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: 'BAYLINK 能帮你更快接到本地信息，但它不是魔法筛子。平台能提供手机验证、官方认证、举报、屏蔽和管理员审核这些信任工具，可真正让你少踩坑的，还是“工具 + 判断”一起用。',
      },
      { type: 'heading', text: '先把平台工具理解对：它们是降低风险，不是绝对担保' },
      {
        type: 'list',
        items: [
          '手机验证：提高账号基础可信度。',
          '官方认证：帮助识别通过额外审核的账号或主体。',
          '举报：让可疑行为进入平台处理流程。',
          '屏蔽：减少骚扰和无效沟通。',
          '管理员审核：帮助清理明显违规内容。',
        ],
      },
      {
        type: 'tip',
        title: '提醒',
        text: '看到验证或认证标识，也不代表你可以跳过看房、验货、留合同、留聊天记录这些基本动作。',
      },
      { type: 'heading', text: '手机验证和官方认证，分别怎么用更实际' },
      {
        type: 'paragraph',
        text: '找房、找室友、找服务时，可以优先看已完成手机验证的账号；如果是房东、商家、本地服务方、长期发帖账号，再结合官方认证一起判断。它们更适合做第一层筛选，而不是最终结论。',
      },
      { type: 'heading', text: '举报按钮什么时候该用，不用太犹豫' },
      {
        type: 'checklist',
        items: [
          '对方身份和内容明显前后不一致。',
          '一直催你脱离平台沟通并先付款。',
          '房源、服务、二手信息疑似盗图或虚构。',
          '骚扰、辱骂、威胁或持续刷屏。',
          '同一个人换号重复发类似可疑内容。',
        ],
      },
      { type: 'heading', text: '屏蔽不是小题大做，是给自己留边界' },
      {
        type: 'paragraph',
        text: '不是所有问题都严重到必须举报，但很多沟通确实不值得继续。一直压价、反复改时间、情绪攻击、半夜骚扰、让你明显不舒服的账号，用屏蔽通常比继续纠缠更省心。',
      },
      { type: 'heading', text: '平台内留痕，比“聊得投机”更重要' },
      {
        type: 'paragraph',
        text: '不管是找房、找室友、买二手还是请服务，能在平台内或至少保留完整聊天记录，通常都更稳。真正出问题时，截图、价格说明、时间安排和对方承诺内容，都会比“当时口头说过”更有用。',
      },
      {
        type: 'tip',
        text: '如果你已经开始觉得“我是不是想太多了”，先别急着说服自己。大多数踩坑都不是因为用户太谨慎，而是为了省一步，把本来该确认的事情跳过去了。',
      },
      {
        type: 'cta',
        title: '先把信任工具用起来，再开始联系',
        text: '在 BayLink 上找房、找服务、做二手之前，先看账号信息是否完整、是否完成验证；如果你已经遇到可疑内容，也可以直接用举报和屏蔽功能保护自己。',
        primaryLabel: '继续看安全指南',
        primaryAction: 'guides',
      },
    ],
  },
  {
    slug: 'bay-area-without-car-guide',
    title: '湾区没有车怎么生活：BART、Caltrain、公交、接送和买菜怎么安排',
    subtitle: '没车在湾区不是不行，但区域和路线一定要选对。',
    summary:
      '没车在湾区不是不能生活，但区域和路线要选对，不然通勤、买菜、晚归和机场来回都会变得很累。',
    category: 'commute',
    categoryLabel: '通勤',
    emoji: '🚇',
    audience: ['留学生', '新移民', '暂时没有车的人', '依赖公共交通找房的人'],
    tags: ['没有车', 'BART', 'Caltrain', '公交', '接送', '买菜'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['ride', 'rent'],
    readMinutes: 8,
    updatedAt: '2026-06-10',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '没车在湾区不是不能生活，但你要承认一件事：这里不是每个区域都对无车用户友好。真正让无车生活舒服一点的，不只是会坐 BART 或 Caltrain，而是住的地方、常去的地方、买菜方式和晚归安排能不能接得起来。',
      },
      { type: 'heading', text: '先别问“没车行不行”，先问“你住哪、常去哪”' },
      {
        type: 'list',
        items: [
          '无车更适合住在交通节点强、生活半径集中的区域。',
          '离车站多远、最后一公里顺不顺，往往比房租差一点更重要。',
          '如果住处和日常路线不匹配，没车生活会很快变累。',
        ],
      },
      { type: 'heading', text: 'BART 和 Caltrain 各自擅长什么' },
      {
        type: 'paragraph',
        text: 'BART 更适合旧金山、东湾、部分 Peninsula 和部分 South Bay 节点之间的主干通勤；Caltrain 更适合 San Francisco 到 Peninsula、Palo Alto、Mountain View、Sunnyvale、San Jose 这条纵向路线。它们都很好用，但都不负责帮你解决所有最后一公里。',
      },
      {
        type: 'tip',
        title: '提醒',
        text: '票价、班次和中断信息会变化，尤其晚间和节假日服务更要出发前看官方信息。',
      },
      { type: 'heading', text: '公交和轻轨不一定是主角，但经常决定你累不累' },
      {
        type: 'paragraph',
        text: '很多人第一次做无车规划时，只看 BART 和 Caltrain，忽略了 Muni、VTA 和本地公交。现实里，真正影响你体感的，往往是离家最后这 10 分钟和晚上回家最后那一趟。',
      },
      { type: 'heading', text: '买菜、机场、搬东西和晚归，要提前想备用方案' },
      {
        type: 'checklist',
        items: [
          '常去超市能否步行或一趟公交到。',
          '大采购是否适合配送。',
          '机场落地时有没有更省心的接法。',
          '晚归时有没有安全可行的备用方案。',
          '临时搬桌椅、小冰箱、二手家具时怎么处理。',
        ],
      },
      { type: 'heading', text: '没有车，区域和生活方式要一起选' },
      {
        type: 'paragraph',
        text: '如果你没车，却住在一个什么都得靠开车解决的地方，日常很容易累。无车生活更适合集中型安排：住处、工作、买菜、收快递和基本服务，最好能在一个相对顺手的半径里。',
      },
      {
        type: 'tip',
        text: '如果你现在没车，找房时请把“离车站多远”和“附近能不能买菜”写在和预算同一层级。很多时候，省下来的那点房租，会被每天折腾的时间和体力慢慢吃掉。',
      },
      {
        type: 'cta',
        title: '没车用户，先把交通和生活半径一起看',
        text: '可以先浏览 BayLink 的接送和租房分类，看看哪些帖子更适合无车生活；如果你已经知道自己的通勤节点，也可以直接发布求租或接送需求。',
        primaryLabel: '浏览接送分类',
        primaryAction: 'category',
        categorySlug: 'ride',
      },
    ],
  },
  {
    slug: 'bay-area-moving-checklist',
    title: '湾区搬家怎么安排：找搬家、买二手家具、清洁、交接一次讲清',
    subtitle: '搬家不是订一辆车就结束，旧家和新家都要一起管。',
    summary:
      '在湾区搬家不只是订一辆车，还包括找搬家、补家具、做清洁、退房交接和处理二手，顺序理清了会轻松很多。',
    category: 'service',
    categoryLabel: '本地服务',
    emoji: '📦',
    audience: ['租客', '新移民', '留学生', '准备换房的家庭和室友'],
    tags: ['搬家', '清洁', '交接', '二手家具', '新家准备'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['service', 'used', 'rent'],
    readMinutes: 8,
    updatedAt: '2026-06-10',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '湾区搬家最容易乱的地方，是你以为“找个搬家公司”就够了。现实里通常是一整串事一起出现：旧家退房、新家拿钥匙、二手家具怎么处理、哪些东西值得搬、清洁谁做、钥匙怎么交，顺序理清了，搬家会轻松很多。',
      },
      { type: 'heading', text: '先决定这是整屋搬，还是轻搬' },
      {
        type: 'list',
        items: [
          '房间搬房间：重点是打包、少量家具和室友交接。',
          '整屋搬家：重点是时间协调、搬家公司、停车和楼层。',
          '首次入住：重点是家具家电、送货、安装和基础清洁。',
          '退租换房：重点是旧家交接和新家同步推进。',
        ],
      },
      { type: 'heading', text: '找搬家服务时，别只看“多少钱一小时”' },
      {
        type: 'checklist',
        items: [
          '搬家日期和时段。',
          '起点终点地址。',
          '楼层、电梯、停车条件。',
          '大件家具数量。',
          '是否需要拆装。',
          '是否需要打包材料或额外人工。',
        ],
      },
      {
        type: 'tip',
        title: '提醒',
        text: '只看一个很低的报价，后面再被加时长、加楼层、加材料费，通常不会更省。',
      },
      { type: 'heading', text: '旧家要先想“怎么退”，不是只想“怎么走”' },
      {
        type: 'paragraph',
        text: '如果你有押金、室友分账、家具转让、清洁责任，这些事最好在搬家前几天就开始收尾。把旧家拍照、清洁、钥匙交接和垃圾处理排好，后面会省很多解释。',
      },
      { type: 'heading', text: '新家别等搬进去才发现什么都没有' },
      {
        type: 'checklist',
        items: [
          '床或临时睡眠方案。',
          '桌椅和基础照明。',
          '洗漱、垃圾袋、纸巾、清洁用品。',
          '网络或手机热点备用。',
          '锅、碗、烧水壶等基础厨房用品。',
        ],
      },
      { type: 'heading', text: '二手家具很适合在搬家节点一起解决' },
      {
        type: 'paragraph',
        text: '很多东西不一定值得从旧家搬到新家，也不是所有东西都该买新的。桌子、书架、餐桌、灯这类，常常很适合通过本地二手解决；但床垫、冰箱、洗衣机这类，就要更谨慎确认。',
      },
      {
        type: 'tip',
        text: '搬家这件事，真正让人崩溃的通常不是大事，而是当晚没床、第二天没网、旧家还没拍照、新家灯也没装。把事情拆成旧家、新家、搬运、家具四条线，会稳很多。',
      },
      {
        type: 'cta',
        title: '搬家前后，最适合把需求分开发布',
        text: '在 BayLink 上，你可以分别找搬家、找清洁、收或出二手家具，也可以先看看附近帖子，了解你所在区域最常见的搬家节奏。',
        primaryLabel: '浏览本地服务分类',
        primaryAction: 'category',
        categorySlug: 'service',
      },
    ],
  },
  {
    slug: 'bay-area-used-furniture-appliance-guide',
    title: '湾区买二手家具家电指南：床、桌子、冰箱、洗衣机怎么避坑',
    subtitle: '不是所有二手都该按同一标准买，关键看尺寸、功能和搬运。',
    summary:
      '刚搬家或刚落地，二手家具家电能省很多钱，但床、桌子、冰箱、洗衣机的判断方式完全不一样。',
    category: 'used',
    categoryLabel: '二手',
    emoji: '🪑',
    audience: ['新移民', '留学生', '刚搬家的人', '准备添置基础家具的人'],
    tags: ['二手家具', '二手家电', '床桌冰箱', '洗衣机', '避坑'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['used', 'service'],
    readMinutes: 7,
    updatedAt: '2026-06-10',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '刚来湾区或者刚搬家，很多人都会先看二手。这个思路没问题，特别是桌子、椅子、书架这类，省钱又现实。真正容易踩坑的，是你把所有东西都按同一标准买：床和桌子不一样，冰箱和微波炉也不一样，洗衣机更不能只看照片。',
      },
      { type: 'heading', text: '先分清哪些东西适合买二手，哪些要更谨慎' },
      {
        type: 'list',
        items: [
          '比较适合买二手：桌子、椅子、书架、柜子、餐桌、灯。',
          '可以看情况：床架、沙发、微波炉。',
          '要更谨慎：床垫、冰箱、洗衣机、烘干机、大型电器。',
        ],
      },
      { type: 'heading', text: '床和床架，重点不一样' },
      {
        type: 'checklist',
        items: [
          '床架看稳不稳、缺不缺件、是否好拆装。',
          '床垫看卫生、异味、塌陷和来源是否清楚。',
          '尺寸要和房间、电梯、车子匹配。',
          '搬运当天谁负责下楼和装车。',
        ],
      },
      {
        type: 'tip',
        title: '提醒',
        text: '涉及贴身、清洁和卫生风险的物品，不建议只靠几张照片就决定。',
      },
      { type: 'heading', text: '桌子、椅子、书架，重点看尺寸和结构' },
      {
        type: 'paragraph',
        text: '这些通常是最适合从二手开始配的。但常见问题不是东西坏，而是买回去放不下、太重、上楼困难，或者和你的房间布局不匹配。',
      },
      { type: 'heading', text: '冰箱和洗衣机，先问功能，再问搬运' },
      {
        type: 'checklist',
        items: [
          '能不能现场通电测试。',
          '买了之后谁负责搬运。',
          '尺寸能不能进门、电梯和摆放位置。',
          '是否有明显漏水、异响、维修痕迹。',
          '插头、进出水接口、安装条件是否匹配。',
        ],
      },
      {
        type: 'tip',
        title: '提醒',
        text: '不能测试功能、来源又说不清的大件家电，通常不值得冒险。便宜不一定真的省。',
      },
      { type: 'heading', text: '搬运成本也要算进总价里' },
      {
        type: 'paragraph',
        text: '一张便宜桌子，如果你还要临时租车、找人搬、上楼费力，最后不一定真的便宜。尤其冰箱、洗衣机、沙发这类，搬运成本和时间成本往往决定它值不值得收。',
      },
      {
        type: 'tip',
        text: '如果你只能记一条：先量尺寸，再去看二手。很多好 deal 最后没成，不是东西不好，而是进不了门、上不了楼，或者放进去之后你连椅子都拉不开。',
      },
      {
        type: 'cta',
        title: '二手买卖最适合和搬家需求一起看',
        text: '你可以在 BayLink 上一边看二手家具家电，一边看搬家和短途帮忙信息；如果你正在找特定物品，也可以直接发布求购。',
        primaryLabel: '浏览二手分类',
        primaryAction: 'category',
        categorySlug: 'used',
      },
    ],
  },
  {
    slug: 'baylink-posting-guide-for-trust',
    title: '在 BAYLINK 发布房源 / 服务怎么写，更容易被信任和联系？',
    subtitle: '不是字越多越好，而是信息越清楚、越真实、越容易被信任。',
    summary:
      '在 BAYLINK 发房源、发服务、发二手，不是写得像广告就有效，而是信息越完整、越真实，越容易得到高质量联系。',
    category: 'service',
    categoryLabel: '本地服务',
    emoji: '📝',
    audience: ['房东', '服务提供者', '二手卖家', '发布求租和求服务的人'],
    tags: ['发帖技巧', '房源发布', '服务发布', '提高信任', '平台使用'],
    priority: 'P1',
    featuredOnHome: false,
    recommendedForCategories: ['service', 'rent', 'used'],
    readMinutes: 7,
    updatedAt: '2026-06-10',
    sourceNote: SOURCE_NOTE,
    blocks: [
      {
        type: 'paragraph',
        text: '很多人在平台上发帖，最大的问题不是没人需要，而是别人看不懂、看不放心，或者看完还得追着问十几个问题。你在 BayLink 上发房源、发服务、发二手，最重要的不是写得像广告，而是让人一眼知道你是谁、你提供什么、适合谁、怎么联系。',
      },
      { type: 'heading', text: '先把别人最关心的信息写前面' },
      {
        type: 'list',
        items: [
          '房源：区域、房型、租金、入住时间、是否合租、是否有车位。',
          '服务：服务内容、覆盖区域、可上门时间、报价方式、联系方式。',
          '二手：物品名称、成色、尺寸、价格、提货方式。',
        ],
      },
      { type: 'heading', text: '清楚，比热情更重要' },
      {
        type: 'paragraph',
        text: '“价格美丽”“诚心出”“靠谱服务”“欢迎咨询”这些都可以有，但必须建立在信息已经讲清楚的前提下。能写数字就写数字范围，能写时间就写时间段，能写限制条件就提前写。',
      },
      { type: 'heading', text: '照片和文字要对得上' },
      {
        type: 'paragraph',
        text: '房间长什么样、家具在不在、服务做什么、车是什么类型，能拍清楚就拍清楚。照片和文字不一致，会直接降低信任。',
      },
      {
        type: 'tip',
        title: '提醒',
        text: '用和内容不匹配的旧图、样板图、网图，短期可能吸引点击，长期反而更容易被跳过、被质疑，甚至被举报。',
      },
      { type: 'heading', text: '把“适合谁”写出来，会更容易被联系' },
      {
        type: 'list',
        items: [
          '房源可写：适合学生、实习生、South Bay 上班族、无车用户、有车用户。',
          '服务可写：适合小型搬家、同城送件、深度清洁、临时接送。',
          '二手可写：适合拎包入住、学生过渡、家庭补件。',
        ],
      },
      { type: 'heading', text: '真正让人放心的，是信息完整和边界清楚' },
      {
        type: 'checklist',
        items: [
          '标题是否一眼看懂。',
          '地区是否写清。',
          '价格或价格范围是否明确。',
          '联系方式和时间是否清楚。',
          '是否说明限制条件和注意事项。',
          '图片是否真实且近期。',
        ],
      },
      {
        type: 'tip',
        text: '发帖前先问自己一句：如果我是陌生人，只看这条内容，会不会还要追问五个最基本的问题？如果答案是会，这条帖子大概率还能再改清楚一点。',
      },
      {
        type: 'cta',
        title: '把信息写清楚，通常比把语气写热闹更有用',
        text: '如果你准备发房源、服务或二手信息，可以先参考 BayLink 上同类高质量帖子，再发布自己的内容；也可以继续看安全和租房指南，把容易被追问的点提前写明白。',
        primaryLabel: '继续看指南',
        primaryAction: 'guides',
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
