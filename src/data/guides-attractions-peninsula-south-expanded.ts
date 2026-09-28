import type { Guide } from './guides';
import type { Attraction } from './attractions';

const sourceNote = '官方资料核验于 2026 年 9 月 26 日。路线顺序与时长为 BAYLINK 编辑建议；开放、票价、预约、施工与交通请在出发前复核。';
const map = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const base = { category: 'city' as const, categoryLabel: '城市指南', priority: 'P1' as const, featuredOnHome: false, recommendedForCategories: ['other', 'ride'], readMinutes: 6, updatedAt: '2026-09-26', sourceNote };
const cta = { type: 'cta' as const, title: '继续安排湾区半日游', text: '按所在地区选择下一站，把交通和休息一起放进行程。', primaryLabel: '查看更多本地攻略', primaryAction: 'guides' as const };

export const peninsulaSouthExpandedGuides: Guide[] = [
  {
    ...base,
    slug: 'san-carlos-hiller-aviation-half-day-guide',
    title: 'San Carlos 航空半日游：在 Hiller 看飞机如何飞起来',
    subtitle: '从飞机结构看到驾驶舱，把互动项目留作当日加选',
    summary: '用三段馆内路线认识半岛航空史，说明门票、火车最后一段、轮椅动线和带娃节奏。',
    emoji: '✈️', audience: ['亲子与航空爱好者', '半岛半日出游'], tags: ['半岛', 'San Carlos', '航空博物馆', '室内备选'],
    sources: [
      { title: 'Hiller：参观、交通与无障碍', url: 'https://www.hiller.org/visit/general-information/', description: '查看收费、停车、车站步行接驳及电梯信息。' },
      { title: 'Hiller：展览介绍', url: 'https://www.hiller.org/museum/exhibits/', description: '认识早期飞行、客机驾驶舱与航空人物展览。' },
      { title: 'Hiller：馆内导览图', url: 'https://www.hiller.org/visitors-guide/', description: '用馆方导览图定位展区，现场开放以工作人员说明为准。' },
    ],
    blocks: [
      { type: 'paragraph', text: 'Hiller Aviation Museum 紧邻 San Carlos Airport，适合把平日从头顶飞过的飞机变成看得懂的结构。建议用“机翼如何承重、驾驶员如何观察、不同飞机为何长得不同”三个问题串起参观；不懂型号也能看得有意思。馆内为主要停留点，机场作业区域不属于参观路线。' },
      { type: 'heading', text: '先把门票、交通和体力安排好' },
      { type: 'list', items: [
        '费用：博物馆需门票；互动体验是否另收费、是否开放，按当天项目说明确认，餐饮另算。',
        '时长：建议馆内 2–3 小时，互动排队与往返车站另留余量；无需为了凑半天逐件读完。',
        '到达：导航 601 Skyway Rd；馆方列有免费停车。San Carlos Caltrain 站到馆仍有步行接驳，带幼儿可预先安排短程接送。',
        '行动需求：馆方说明展馆可供轮椅通行，夹层可乘电梯；个别机舱和互动设施能否进入，请单独询问。',
      ] },
      { type: 'heading', text: '按观察、比较、互动的顺序逛' },
      { type: 'route', title: '同一场馆里的三段慢看路线', text: '地图都定位到博物馆；馆内依导览图和工作人员指示移动。', stops: [
        { title: '第一站：主展厅看飞机轮廓', text: '入馆先问当天哪些机舱或活动开放，再挑一架直升机和一架固定翼飞机比较。带孩子时让他们找旋翼、机翼和起落架，先描述看到的东西，再读说明牌；轮椅与推车靠通道一侧停留，给其他观众留下通过空间。', mapUrl: map('Hiller Aviation Museum San Carlos') },
        { title: '第二站：早期飞行与客机展陈', text: '沿导览图挑早期飞行与客机展陈各看一段，留意材料、座舱视野和控制装置的变化。客机机头或驾驶舱的进入条件以现场为准，不能进入时从外侧观察也有收获；不用把排队当成必完成项目，可回到喜欢的飞机旁再看细节。', mapUrl: map('Hiller Aviation Museum 601 Skyway Road San Carlos') },
        { title: '第三站：互动加选与返程集合', text: '最后按当天开放和排队情况选择一个互动项目；预约、年龄要求和额外费用先向工作人员问清。孩子疲倦就把这一段改成复看最喜欢的展品，在入口集合后再离馆用餐；乘火车者提前确认回站路线，别把闭馆时间当成到站时间。', mapUrl: map('Hiller Aviation Museum Main Entrance San Carlos') },
      ] },
      { type: 'heading', text: '带娃、雨天与返程的小调整' },
      { type: 'paragraph', text: '带娃把一轮观察控制得短一些，每人选一架最想记住的飞机，比拍完所有展品更容易保持兴趣。雨天可集中看室内展览，离馆和接送仍需外套。走车站路线前查看过街与步行导航；不愿走最后一段就提前确定接送点，任何时候都不要进入跑道或机场限制区。' },
      { type: 'checklist', items: ['查看参观日历，排除私人活动或临时闭馆。', '分别核对门票与想参加的互动项目。', '需要电梯或机舱协助时，出发前联系馆方。', '保存入口与返程车站，预留吃饭和接驳时间。'] },
      { type: 'link', title: '打开 Hiller 官方参观信息', text: '从馆方页面核对票价、日历和到达方式。', url: 'https://www.hiller.org/visit/general-information/' }, cta,
    ],
  },
  {
    ...base,
    slug: 'san-mateo-coyote-point-bayfront-guide',
    title: 'Coyote Point 湾边半日：看飞机、走海滨，再选科学馆',
    subtitle: '把海滨散步作为主线，CuriOdyssey 单独查票',
    summary: '从海滨长廊到码头，安排适合家庭的短路线，交代车辆入园费、游乐场施工与海风下的退路。',
    emoji: '🌊', audience: ['想轻松看海湾的家庭', 'San Mateo 周边居民'], tags: ['半岛', 'San Mateo', '海滨散步', '科学与自然'],
    sources: [
      { title: 'San Mateo County：Coyote Point 公园', url: 'https://www.smcgov.org/parks/coyote-point-recreation-area', description: '查入口、地图、开放与公园公告。' },
      { title: 'San Mateo County：海滨与活动', url: 'https://www.smcgov.org/parks/coyote-point-recreation-area-activities', description: '核对海滨通行设施、野餐与水上活动信息。' },
      { title: 'San Mateo County：当前封闭', url: 'https://www.smcgov.org/parks/coyote-point-closures', description: '施工公告优先于介绍页中的游乐设施描述。' },
      { title: 'CuriOdyssey：开放与门票', url: 'https://curiodyssey.org/visit/hours-admission/', description: '科学与动物展馆单独售票，车辆入园费用也需核对。' },
    ],
    blocks: [
      { type: 'paragraph', text: 'Coyote Point 的乐趣是同一片湾景里同时看到帆、鸟和飞往 SFO 的飞机。这里适合边走边停，不必把整座公园走完。先选海滨长廊的一段，再根据风力、孩子状态和余下时间决定去码头，或进入另售门票的 CuriOdyssey；两种玩法可以独立完成。' },
      { type: 'heading', text: '先区分公园费用与展馆门票' },
      { type: 'list', items: [
        '费用：户外散步没有展馆门票，开车入园另有车辆费用；CuriOdyssey、租赁与课程分别付费。',
        '时长：户外主线建议 2–3 小时；若认真逛 CuriOdyssey，另外留时间并缩短步行。',
        '到达：导航 Coyote Point Recreation Area 后按停车区标志进入；乘公交先查到园门后的步行距离和回程站点。',
        '通行：海滨有铺装长廊和便于进入沙滩的设施，但沙面、坡路和码头边并非同样好走，按需要缩短线路。',
      ] },
      { type: 'tip', title: '出发前先看游乐场施工公告', text: '截至 2026 年 9 月 26 日，Magic Mountain 游乐场及周边野餐区、相邻停车区正在施工封闭。本路线不以游乐场开放为前提；后续是否重开请查官方封闭页面。' },
      { type: 'heading', text: '三站可缩短，不必走完整圈' },
      { type: 'route', title: '海滨、码头与可选科学馆', text: '先对照公园地图看停车点，三站之间可原路返回；展馆是独立加选。', stops: [
        { title: '第一站：Coyote Point Promenade', text: '从海滨长廊开始，在铺装路面上找一段视野开阔的位置看飞机和湾面。先走短程感受风，再决定往前多远；带孩子可观察船帆方向和鸟的动作，但不要把浅水当成适合随意下水，沙滩停留与水上活动要分别评估当天条件。', mapUrl: map('Coyote Point Promenade San Mateo') },
        { title: '第二站：Coyote Point Marina', text: '沿开放路径往码头方向走，看桅杆、船只和岸边水鸟，把这一段当作慢观察而非一定要走到防波堤尽头。轮椅或推车遇到不适合的路面就折返，不追鸟也不靠近水边拍照；海风明显增强时，直接回停车区休息最省力。', mapUrl: map('Coyote Point Marina San Mateo') },
        { title: '第三站：CuriOdyssey 加选或返程', text: '仍有精神且已核对票务，就把 CuriOdyssey 作为单独一段科学与动物观察；先确认开放、入场与剩余参观时间，再移动过去。没有购票计划则在开放的休息区补水后返程，别把会员停车优惠默认套用到全园停车区，也别穿越施工围挡抄近路。', mapUrl: map('CuriOdyssey San Mateo') },
      ] },
      { type: 'heading', text: '风、亲子节奏与回程出口' },
      { type: 'paragraph', text: '海滨遮挡有限，带防风外套、饮水和防晒，野餐选择现场允许使用的区域。雨天或风大时可只保留已经确认开放的展馆；CuriOdyssey 有户外部分，也要准备外套。返程以园门关闭和公交班次倒推，留出从水边走回停车处的时间，不把晚霞停留排到最后一分钟。' },
      { type: 'checklist', items: ['查封闭地图，确认所选停车区和野餐区可用。', '分清车辆入园费与 CuriOdyssey 门票。', '带外套、饮水，并查看天气与水域公告。', '保存回程站点或停车位置，预留步行返回时间。'] },
      { type: 'link', title: '打开 Coyote Point 官方公告', text: '先查封闭与公园地图，再选择当天的停留点。', url: 'https://www.smcgov.org/parks/coyote-point-recreation-area' }, cta,
    ],
  },
  {
    ...base,
    slug: 'mountain-view-computer-history-shoreline-guide',
    title: 'Mountain View 科技半日：计算机历史馆与可选湖边散步',
    subtitle: '先读懂一段计算史，Shoreline 另留交通和步行时间',
    summary: '从早期计算工具走到软件故事，把演示排期、门票、无障碍与湖边加选拆开安排。',
    emoji: '💻', audience: ['科技好奇者', '带学龄孩子的家庭'], tags: ['南湾', 'Mountain View', '计算机历史', '室内备选'],
    sources: [
      { title: 'CHM：参观规划', url: 'https://computerhistory.org/plan-your-visit/', description: '查开放与主要展览，门票从官方入口进入。' },
      { title: 'CHM：Revolution 常设展', url: 'https://computerhistory.org/exhibits/revolution/', description: '了解从早期计算到现代电脑的展览主题。' },
      { title: 'CHM：观众常见问题', url: 'https://computerhistory.org/plan-your-visit/visitor-faq/', description: '查停车、轮椅、包袋与参观准备。' },
      { title: 'CHM：导览与机器演示', url: 'https://computerhistory.org/tours/', description: '机器演示有独立排期，不代表每日都有。' },
      { title: 'Mountain View：Shoreline 设施', url: 'https://www.mountainview.gov/our-city/departments/community-services/shoreline-at-mountain-view/facilities-and-amenities', description: '核对湖边设施与户外规则，作为独立加选目的地。' },
    ],
    blocks: [
      { type: 'paragraph', text: 'Computer History Museum 适合带着日常问题来逛：购物、工作和联系朋友，是怎样一步步进入计算机的？Revolution 展览把计算工具与人物故事放在一起，非技术背景也能找到入口。建议把博物馆当作半日主角，Shoreline Lake 只在天气、体力与交通都合适时追加。' },
      { type: 'heading', text: '用主题选展，不用逐件看完' },
      { type: 'list', items: [
        '费用：展览需门票，商店和咖啡馆消费另算；优惠资格、儿童票与演示安排查当天官网。',
        '时长：馆内建议 2.5–4 小时；加湖边需另算转场和散步，不把两地当成一座连续园区。',
        '到达：导航 1401 N Shoreline Blvd；馆方列有免费停车。从 Mountain View 车站出发仍需查询末段公交、骑行或接送。',
        '行动需求：馆方说明展览可供轮椅通行，借用轮椅数量有限；大包进入展厅的规则提前确认。',
      ] },
      { type: 'heading', text: '馆内两段，再决定是否去湖边' },
      { type: 'route', title: '计算工具、软件与湖边加选', text: '前两站都在计算机历史馆，第三站是需另行安排交通的公园。', stops: [
        { title: '第一站：Revolution 的计算故事', text: '先在入口取图并看当天演示表，再从计算工具或早期机器选择一个主题。带孩子可以比较设备大小、输入方法和用途，问“这台机器帮谁解决了什么问题”；成年人则挑感兴趣的展柜细读，给同伴约好下一次集合的位置。', mapUrl: map('Computer History Museum Mountain View') },
        { title: '第二站：软件展或当日机器演示', text: '第二段选择软件主题，或参加已经核实排期的机器演示；演示不是随到随开的项目。看完一段就休息，讨论眼前设备与自己手机有什么相同和不同；若排期不合适，继续自主看展即可，不必为等一场活动压缩所有参观时间。', mapUrl: map('Computer History Museum 1401 North Shoreline Boulevard') },
        { title: '第三站：Shoreline Lake 可选短走', text: '离馆前先检查湖边天气和到达路线，再安排到 Shoreline Lake 的独立交通；不要把公园入口当成已经到湖边。抵达后只走体力允许的一小段并原路返回，观察水鸟而不投喂；风大、太热或天色将晚，就取消加选直接返程。', mapUrl: map('Shoreline Lake Mountain View') },
      ] },
      { type: 'heading', text: '给不同年龄和天气留出选择' },
      { type: 'paragraph', text: '学龄孩子可用“找一件比自己大、比自己老的机器”开始，幼儿则适合短看与多休息，不把历史展当作全天游乐场。雨天保留馆内路线；晴天去湖边仍带防晒和外套。返程从博物馆或湖边分别重新规划，乘公共交通者确认最后一段接驳，不假定两处都能方便叫到车。' },
      { type: 'checklist', items: ['核对参观日期、门票和闭馆公告。', '想看机器运行时，单独确认演示排期。', '需要轮椅或其他协助，提前联系前台。', '加湖边前保存独立导航和返程方式。'] },
      { type: 'link', title: '打开 CHM 官方参观规划', text: '核对展览、门票与导览，再决定当天重点。', url: 'https://computerhistory.org/plan-your-visit/' }, cta,
    ],
  },
  {
    ...base,
    slug: 'san-jose-egyptian-museum-rose-garden-guide',
    title: 'San Jose 慢半日：埃及博物馆与市立玫瑰园',
    subtitle: '把古代故事和花园散步分成两段，先核对开放与台阶',
    summary: '以 Rosicrucian Egyptian Museum 为主，走到独立的 Municipal Rose Garden 放松，讲清儿童、推车、施工和季节差异。',
    emoji: '🏺', audience: ['喜欢历史与花园的人', '南湾半日出游'], tags: ['南湾', 'San Jose', '埃及博物馆', '花园散步'],
    sources: [
      { title: '埃及博物馆：开放、门票与施工', url: 'https://egyptianmuseum.org/admissions-hours', description: '核对开放日期、售票、支付和园区施工公告。' },
      { title: '埃及博物馆：无障碍说明', url: 'https://www.egyptianmuseum.org/accessibility', description: '入口坡道、多层展厅及升降平台限制。' },
      { title: '埃及博物馆：到达路线', url: 'https://egyptianmuseum.org/directions', description: '查看入口与停车位置，公交班次另向 VTA 复核。' },
      { title: 'San Jose：市立玫瑰园', url: 'https://www.sanjoseca.gov/Home/Components/FacilityDirectory/FacilityDirectory/2295/2051?npage=3', description: '确认免费入园、位置、花季与步道规则。' },
    ],
    blocks: [
      { type: 'paragraph', text: '这条路线把需要认真阅读的古代展品，与可以慢慢走的花园放在同一天。Rosicrucian Egyptian Museum 和 Municipal Rose Garden 是两个独立地点；先给博物馆完整时间，再沿街区接到花园，比一开始就追着所有拍照点走更从容。玫瑰多少随季节变化，花园也适合短坐休息。' },
      { type: 'heading', text: '先定博物馆，再安排花园' },
      { type: 'list', items: [
        '费用：博物馆需门票，市立玫瑰园普通散步免费；餐饮与交通另算，购票前阅读退改规则。',
        '时长：建议合计 3–4 小时，含馆内参观、街区转场和花园短走；想细读展品可只逛博物馆。',
        '到达：博物馆入口地址为 1660 Park Ave，停车位置在其他街侧；先查施工图，公交到站后仍需步行。',
        '行动需求：展厅分多层，馆方有轮椅升降平台，但明确不允许婴儿推车使用；轮椅尺寸和协助需要提前确认。',
      ] },
      { type: 'heading', text: '从古代生活走到街区花园' },
      { type: 'route', title: '博物馆、园区出口与玫瑰园', text: '前两站在博物馆及其园区，第三站需另走街区道路；以开放路径和过街信号为准。', stops: [
        { title: '第一站：埃及博物馆慢看展', text: '入馆先取导览并确认各层通行方式，把注意力放在日常生活、文字或信仰中的一个主题。带孩子先解释这里也展示丧葬文化，允许他们跳过感到不舒服的部分；展品前留出观察距离，拍照遵守现场规则，不为了赶下一站匆匆扫过。', mapUrl: map('Rosicrucian Egyptian Museum 1660 Park Avenue San Jose') },
        { title: '第二站：Rosicrucian Park 出口休整', text: '离开展厅后在园区允许通行的区域缓一缓，核对下一站的街道方向、过街位置和剩余体力。施工可能改变停车区与步行通路，按现场围挡绕行；若同伴已经疲惫，这里就是结束参观的合适节点，不必为了凑路线继续走到花园。', mapUrl: map('Rosicrucian Park San Jose') },
        { title: '第三站：Municipal Rose Garden', text: '导航市立玫瑰园的 Naglee Ave 与 Dana Ave 一带入口，沿街区人行道和合法过街处到达。入园后在指定路径上比较花形与颜色，避开花坛和正在维护的区域；没有盛花也可短坐看树影，返程按停好的车或公交站位置重新规划。', mapUrl: map('Municipal Rose Garden Naglee Avenue Dana Avenue San Jose') },
      ] },
      { type: 'heading', text: '推车、天气和返程都单独考虑' },
      { type: 'paragraph', text: '带幼儿先和馆方确认推车存放与楼层安排，不能把轮椅升降平台当作推车电梯。需要平缓路线的同行者可缩短街区转场，提前联系接送。下雨时保留室内展览，炎热时把花园缩为短走并带饮水；花园与博物馆开放不同，回去取车前也要核对停车区的使用限制。' },
      { type: 'checklist', items: ['先确认博物馆当天开放与票务规则。', '查看园区施工、停车与步行绕行图。', '需要推车或轮椅时，确认各层到达方式。', '保存正确的市立玫瑰园位置和回程站点。'] },
      { type: 'link', title: '打开埃及博物馆官方参观信息', text: '查开放、票务及园区施工，再安排相邻街区散步。', url: 'https://egyptianmuseum.org/admissions-hours' }, cta,
    ],
  },
];

export const peninsulaSouthExpandedAttractions: Attraction[] = [
  { id: 'hiller-aviation', slug: 'san-carlos-hiller-aviation-half-day-guide', title: 'Hiller 航空博物馆', city: 'San Carlos', region: 'peninsula', themes: ['museum'], cost: 'paid', duration: '2–3 小时', note: '飞机与航空互动适合慢慢看，项目开放另查；车站到馆还有一段接驳。', mapQuery: 'Hiller Aviation Museum San Carlos', officialUrl: 'https://www.hiller.org/visit/general-information/' },
  { id: 'coyote-point', slug: 'san-mateo-coyote-point-bayfront-guide', title: 'Coyote Point 海滨与科学馆', city: 'San Mateo', region: 'peninsula', themes: ['waterfront', 'nature', 'museum'], cost: 'mixed', duration: '2–3 小时', note: '户外散步加选另售票的 CuriOdyssey；车辆入园另收费，先查游乐场施工封闭。', mapQuery: 'Coyote Point Recreation Area San Mateo', officialUrl: 'https://www.smcgov.org/parks/coyote-point-recreation-area' },
  { id: 'computer-history', slug: 'mountain-view-computer-history-shoreline-guide', title: '计算机历史馆与 Shoreline 加选', city: 'Mountain View', region: 'south-bay', themes: ['museum', 'waterfront'], cost: 'paid', duration: '2.5–4 小时', note: '以需票的计算机历史馆为主，机器演示另查排期，湖边需独立安排交通。', mapQuery: 'Computer History Museum Mountain View', officialUrl: 'https://computerhistory.org/plan-your-visit/' },
  { id: 'rosicrucian', slug: 'san-jose-egyptian-museum-rose-garden-guide', title: '埃及博物馆与市立玫瑰园', city: 'San Jose', region: 'south-bay', themes: ['museum', 'nature', 'culture'], cost: 'mixed', duration: '3–4 小时', note: '博物馆需票，花园散步免费；两处需街区转场，推车不能使用馆内轮椅升降平台。', mapQuery: 'Rosicrucian Egyptian Museum San Jose', officialUrl: 'https://egyptianmuseum.org/admissions-hours' },
];
