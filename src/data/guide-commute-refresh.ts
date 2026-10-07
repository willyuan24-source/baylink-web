import type { Guide } from './guides';

/** Only this article was refreshed; these reads do not renew other source records. */
export const commuteGuide: Guide = {
  slug: 'bay-area-commute-guide',
  title: '湾区通勤方式全对比：BART、Caltrain、开车、拼车怎么选',
  subtitle: '用一次真实试跑，选出往返都可行的路线',
  summary: '先查同一天的去程和回程，再核对停站、接驳与付款。附门到门试跑记录，比较公共交通、开车和拼车。',
  category: 'commute', categoryLabel: '通勤', emoji: '🚆', audience: ['上班族', '留学生'],
  tags: ['BART', 'Caltrain', 'VTA', '拼车'], priority: 'P0', featuredOnHome: true,
  recommendedForCategories: ['ride'], readMinutes: 6, updatedAt: '2026-10-07',
  sourceNote: '2026 年 10 月 7 日已读取下列 BART、Caltrain、VTA 官方使用说明，核对路线查询、停站、提醒与乘车步骤。本文没有实测你的路线，也未锁定票价、班次、停车空位或接驳等待时间；出发前请再次查询。此日期只代表本篇内容更新。',
  sources: [
    { title: 'BART：官方应用与路线查询', url: 'https://www.bart.gov/guide/apps', description: '核对往返规划、实时发车、取消班次、车站末班车和电梯提醒的查询入口。' },
    { title: 'Caltrain：首次乘车步骤', url: 'https://www.caltrain.com/rider-information/how-ride-caltrain', description: '核对平日与周末时刻表、实际停站、站台、上车前有效车票和 Clipper 下车刷卡。' },
    { title: 'VTA：Transit 实时路线工具', url: 'https://www.vta.org/go/transit-app', description: '核对公交和轻轨路线规划、车辆位置与服务提醒的使用方式。' },
  ],
  blocks: [
    { type: 'paragraph', text: '先把家庭或公司的具体地址、必须到达的时间、通常离开的时间写下来。下面的目标是做出一条主路线和一条可执行的回家备选；不要只比较地图距离或车上时间。' },
    { type: 'heading', text: '1. 先查同一天的去程和回程' },
    { type: 'checklist', items: [
      '输入实际起终点，选择准备通勤的日期；周末、节假日和晚归需要分别查询。',
      '把步行、等车、换乘、停车和最后一公里都记入门到门时间。需要无障碍通行时，另查电梯和车站设施。',
      '保存主路线的车站、线路、方向和计划发车时间，再保存错过一班车后的下一条可行路线。',
    ] },
    { type: 'heading', text: '2. 按你实际能到达的车站核对' },
    { type: 'link', title: '查 BART 去程、回程与末班车', url: 'https://www.bart.gov/guide/apps', text: 'BART 官方应用可按起终点规划含接驳的行程，查看实时发车、取消班次、服务和电梯提醒，也能查车站末班车。用它核对你那一天的往返方案；若两端还要接驳，先把接驳时间写进记录。' },
    { type: 'link', title: '查 Caltrain 停站与首次乘车步骤', url: 'https://www.caltrain.com/rider-information/how-ride-caltrain', text: '先选择平日或周末时刻表，确认所选车次真的停靠起终点，再看实时提醒和站台方向。不同服务的停站不同；不要看到一列同方向的车就上车。上车前须持有效车票；使用 Clipper 时记得下车刷卡。车站页面可查下一班车和设施。' },
    { type: 'link', title: '查 VTA 公交、轻轨和接驳', url: 'https://www.vta.org/go/transit-app', text: 'VTA 的官方说明推荐用 Transit 输入目的地、选择路线并跟踪车辆。把公交或轻轨从家到轨道车站、以及下车到公司的两段分别查清，查看沿途提醒；实时预计到达时间仍可能变化。' },
    { type: 'heading', text: '3. 用完整往返成本比较开车和拼车' },
    { type: 'paragraph', text: '公共交通记录当前路线票价、接驳和车站停车费；开车记录油电、桥费、目的地停车和实际堵车时间。需要接送孩子、搬运物品或经常加班时，把这些约束一并记录。每周进办公室天数不固定，可以分别比较单次出行与长期票种，不要先假设哪一种更便宜。' },
    { type: 'checklist', items: [
      '拼车先写清接送点、往返时间、费用分摊、迟到等待和临时取消规则。',
      '确认司机或同伴临时无法出发时，你仍有能自己使用的回家方案。',
      '比较相同日期、相同到达要求的方案；预计值和已经试跑的值分开填写。',
    ] },
    { type: 'heading', text: '4. 在真实上班时段试跑一次' },
    { type: 'template', title: '复制这张通勤试跑记录', text: '日期／星期：\n家门 → 目的地：\n必须到达／预计离开：\n方式和线路／车次：\n走到车站或停车：___ 分钟\n等车＋乘车＋换乘：___ 分钟\n最后一公里：___ 分钟\n实际去程／回程总时间：\n往返票价／油电／桥费／停车：\n错过一班或取消时：\n晚归备选和额外费用：\n仍需确认的问题：' },
    { type: 'paragraph', text: '试跑时记录实际离家和到门时间，不要只截一张导航预计时间。回来后标出最容易失误的一段，例如找站台、跨站换乘或公司接驳；下一次只调整这一段，再决定是否长期使用。' },
    { type: 'heading', text: '5. 出门前再检查一次' },
    { type: 'checklist', items: [
      '重新打开运营方路线和服务提醒，确认去程、返程及接驳仍可用。',
      '确认付款方式、有效车票或交通卡已准备好；需要停车时再核对该站的规则。',
      '把晚归或临时取消时的备选路线保存在手机中，保留必要的时间和费用余量。',
    ] },
    { type: 'cta', title: '继续找本地通勤信息', text: '带着起终点、出行时段和试跑结果，再浏览或发布拼车、接送需求，更容易说明你真正需要的安排。', primaryLabel: '浏览通勤分类', primaryAction: 'category', categorySlug: 'ride' },
  ],
};
