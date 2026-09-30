import type { PlanningFacts, PlanningSchedule } from '../lib/planner';
import regionalEvents from './september-refresh-regional-events.json';
import sfEastEvents from './september-refresh-sf-east-events.json';

/** Published event facts checked on this date, not live booking or weather guarantees. */
const checkedAt = '2026-09-29';
const events = new Map([...regionalEvents, ...sfEastEvents].map(event => [event.id, event]));
const source = (id: string) => {
  const event = events.get(id);
  if (!event) throw new Error(`Missing September refresh event: ${id}`);
  return { sourceUrl: event.officialUrl, verifiedAt: checkedAt, validFrom: event.startDate, validThrough: event.endDate };
};
type DatedWindow = readonly [date: string, open: string, close: string, lastEntry?: string];
const dated = (id: string, windows: DatedWindow[], note: string): PlanningSchedule => ({
  ...source(id), dates: Object.fromEntries(windows.map(([date, open, close, lastEntry]) => [date, [{ open, close, ...(lastEntry ? { lastEntry } : {}) }]])), note,
});
const sessions = (id: string, times: NonNullable<PlanningSchedule['sessions']>, note: string): PlanningSchedule => ({
  ...source(id), sessions: times, note,
});

/** Admission prices are separate from meals, merchandise, parking, and eligibility-only offers. */
export const SEPTEMBER_REFRESH_PLANNING: Record<string, PlanningFacts> = {
  'sf-foodwise-latine-makers-oct3-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'unknown' },
  'foster-city-water-lantern-festival-2026': { setting: 'outdoor', admissionUsd: null, reservation: 'unknown' },
  'berkeley-crowden-community-music-day-oct4-2026': { setting: 'mixed', admissionUsd: 0, reservation: 'optional' },
  'berkeley-cal-sailing-open-house-oct4-2026': { setting: 'outdoor', admissionUsd: 0, minAge: 5, reservation: 'unknown' },
  'berkeley-borp-adaptive-sports-expo-oct17-2026': { setting: 'mixed', admissionUsd: 0, reservation: 'optional' },
  'sf-bay-beats-bandshell-oct24-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'unknown' },
  'sf-financial-planning-day-oct24-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'optional' },
  'sf-marina-library-open-house-oct17-2026': { setting: 'mixed', admissionUsd: null, reservation: 'optional' },
  'sf-halloween-broadside-printing-oct17-2026': { setting: 'indoor', admissionUsd: null, reservation: 'optional' },
  'sf-main-halloween-costume-swap-oct15-2026': { setting: 'indoor', admissionUsd: null, reservation: 'optional' },
  'san-lorenzo-banned-books-storytime-oct7-2026': { setting: 'indoor', admissionUsd: null, reservation: 'unknown' },
  'san-lorenzo-metal-milagros-oct10-2026': { setting: 'indoor', admissionUsd: null, minAge: 8, reservation: 'unknown' },
  'redwood-city-fixit-clinic-oct-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'optional' },
  'stanford-noon-guitar-oct-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'unknown' },
  'mountain-view-oktoberfest-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'unknown' },
  'stanford-art-for-all-oct-2026': { setting: 'mixed', admissionUsd: 0, reservation: 'required' },
  'springline-barks-boos-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'required' },
  'mountain-view-monster-bash-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'unknown' },
  'ameswell-barks-boos-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'optional' },
  'stanford-halloween-concert-2026': { setting: 'indoor', admissionUsd: 32, reservation: 'required' },
  'sonoma-valley-book-sale-free-child-book-2026': { setting: 'indoor', admissionUsd: null, reservation: 'unknown' },
  'santa-rosa-big-book-sale-discount-days-2026': { setting: 'indoor', admissionUsd: null, reservation: 'unknown' },
  'san-rafael-civic-center-puzzle-swap-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'optional' },
  'corte-madera-wooden-sugar-skull-painting-2026': { setting: 'indoor', admissionUsd: 0, minAge: 5, maxAge: 14, reservation: 'optional' },
  'san-rafael-norcal-bats-library-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'optional' },
  'novato-teen-ai-literacy-escape-room-2026': { setting: 'indoor', admissionUsd: 0, minAge: 11, maxAge: 18, reservation: 'unknown' },
  'point-reyes-halloween-clothing-swap-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'optional' },
  'fairfax-kids-halloween-costume-swap-2026': { setting: 'indoor', admissionUsd: 0, reservation: 'optional' },
};

export const SEPTEMBER_REFRESH_SCHEDULES: Record<string, PlanningSchedule> = {
  'sf-foodwise-latine-makers-oct3-2026': dated('sf-foodwise-latine-makers-oct3-2026', [["2026-10-03","09:00","14:00"]], "09:00–14:00 为免费开放市集窗口，餐饮与商品另购。11:00 为 Amalia Avedano（Tonantzin）演示，12:00 为 Raquel Goldman（Norte54）演示，均在渡轮大厦正前方 Foodwise Classroom，结束时刻未公布；不是必须参加的整场固定场次。市集还覆盖大厦南侧 Embarcadero Ferry Terminal Plaza，跨区域需留步行时间。官网未列强制预约要求。"),
  'foster-city-water-lantern-festival-2026': {
    ...dated('foster-city-water-lantern-festival-2026', [["2026-10-03","17:00","21:00"],["2026-10-04","17:00","21:00"]], "两天均自 17:00 开放入场；规划按 19:30–21:00 的核心体验安排，19:30 制作水灯，20:00–21:00 放灯。购票须选定其中一天，不默认通用两日。市府列明免费入场，制作与放灯体验须购票，不能视作免费完整体验；所选日期的票价和附加费待确认，餐饮另购。主办方 FAQ 另写 8 岁以下免票、8 岁及以上需票，免费儿童入场不保证每人获赠水灯，具体资格与套装内容须查看售票页。严重天气可能延期或改期，出发前核对通知。"),
    sessions: [
      { date: '2026-10-03', start: '19:30', end: '21:00' },
      { date: '2026-10-04', start: '19:30', end: '21:00' },
    ],
  },
  'berkeley-crowden-community-music-day-oct4-2026': dated('berkeley-crowden-community-music-day-oct4-2026', [["2026-10-04","10:00","14:00"]], "这是整个校园音乐日的开放窗口。短音乐会另在 10:15、11:00、11:45 开演，每场约 20 分钟，适合婴儿至 7 岁及家长；3 岁以上弦乐示范需另选 15 分钟时段预约，不代表整场活动限制年龄。"),
  'berkeley-cal-sailing-open-house-oct4-2026': dated('berkeley-cal-sailing-open-house-oct4-2026', [["2026-10-04","13:00","15:00","14:30"]], "官网通常开放时段为 13:00–15:00；现场登记仅 13:00–14:30，先到先得，建议 13:00 抵达。单次航行约 30 分钟，排队时长未知。5 岁以上儿童须成人陪同，需签免责文件并穿救生衣；强风、大雨或潮汐可能取消或提前结束，不保证船位与结束时间。"),
  'berkeley-borp-adaptive-sports-expo-oct17-2026': dated('berkeley-borp-adaptive-sports-expo-oct17-2026', [["2026-10-17","10:00","15:00"]], "这里只核对 1720 8th Street 主场 10:00–15:00。80 Bolivar Drive 骑行／皮划艇为 10:00–13:00，800 Potter Street 攀岩为 12:00–15:00，须另安排转场。交通及攀岩必须登记；其他项目建议报名，可现场填表。主场 15:30–17:30 免费社区庆祝另计时段；白天餐车午餐另购。"),
  'sf-bay-beats-bandshell-oct24-2026': dated('sf-bay-beats-bandshell-oct24-2026', [["2026-10-24","14:00","18:00"]], "免费音乐会的整体窗口为 14:00–18:00；地点为 Golden Gate Bandshell。各艺人的具体开演时刻尚未列明，座位和现场安排未确认。"),
  'sf-financial-planning-day-oct24-2026': dated('sf-financial-planning-day-oct24-2026', [["2026-10-24","10:00","17:00"]], "10:00–17:00 为整日活动窗口，不代表已预约咨询。线下讲座先到先得，Zoom 须报名；一对一咨询预约于 10/22 午夜截止，现场候补不保证接待。各讲座另有场次，请先选具体节目；主办方报名票价为 $0。"),
  'sf-marina-library-open-house-oct17-2026': dated('sf-marina-library-open-house-oct17-2026', [["2026-10-17","11:00","15:00"]], "分馆及院落活动整体为 11:00–15:00，面向所有年龄，可直接到场。各项目时刻与赠书余量未公布；官方未列明活动入场费，费用待核。"),
  'sf-halloween-broadside-printing-oct17-2026': dated('sf-halloween-broadside-printing-oct17-2026', [["2026-10-17","14:00","16:00"]], "14:00–16:00 可到场体验；印张限前 100 位，无须预约。活动适合成人，正文也欢迎其他年龄，儿童操作须按工作人员指导；官网未列活动费用。"),
  'sf-main-halloween-costume-swap-oct15-2026': dated('sf-main-halloween-costume-swap-oct15-2026', [["2026-10-15","16:00","17:30"]], "Main Library 二楼儿童创意中心 16:00–17:30，儿童及照顾者可直接到场。可带洁净、轻度使用的服装或配件；没有公布必须捐赠、一换一或领取数量规则。官方未列明收费。"),
  'san-lorenzo-banned-books-storytime-oct7-2026': sessions('san-lorenzo-banned-books-storytime-oct7-2026', [{"date":"2026-10-07","start":"11:00","end":"11:30"}], "故事会固定为 11:00–11:30，活动室 10:50 开放；须在前台领取限额入场票，满场可能无法进入，不是网上预约。主要面向幼儿与学龄前儿童，照顾者须在场参与。赠书免费、送完为止；故事会票价未列明。"),
  'san-lorenzo-metal-milagros-oct10-2026': sessions('san-lorenzo-metal-milagros-oct10-2026', [{"date":"2026-10-10","start":"15:00","end":"16:00"}], "15:00–16:00 固定手作场，面向 8 岁以上儿童及家人；14:30 开始现场发票，材料与名额有限。不是提前网上购票，官方未列明活动费用。"),
  'redwood-city-fixit-clinic-oct-2026': dated('redwood-city-fixit-clinic-oct-2026', [["2026-10-03","10:30","12:30"]], "Makerspace 10:30–12:30 免费维修诊断与指导；建议预登记，也接待直接到场。只接收可自行携带的物品；维修成功、全部零件免费及上门搬运均不保证。"),
  'stanford-noon-guitar-oct-2026': sessions('stanford-noon-guitar-oct-2026', [{"date":"2026-10-07","start":"12:30","end":"14:00"}], "免费音乐会固定为 12:30–14:00，位于 Campbell Recital Hall。官网未列必须预约，座位以现场为准；工作日校园停车须另查许可，不包含免费停车。"),
  'mountain-view-oktoberfest-2026': dated('mountain-view-oktoberfest-2026', [["2026-10-10","11:00","19:00"],["2026-10-11","11:00","19:00"]], "10/10、10/11 均为 11:00–19:00，免费入场、各年龄均可参加。21 岁仅为饮酒资格，不是入场年龄下限；杯具、酒票与餐饮另购。"),
  'stanford-art-for-all-oct-2026': sessions('stanford-art-for-all-oct-2026', [{"date":"2026-10-11","start":"10:00","end":"12:00"},{"date":"2026-10-11","start":"13:00","end":"15:00"}], "只登记 10:00–12:00 或 13:00–15:00 其中一场，不能将 12:00–13:00 当作连续活动。名额有限，已报名者优先；携确认到 Lomita Drive 旁帐篷签到。活动涉及室外区域及展厅，不接受宠物。"),
  'springline-barks-boos-2026': dated('springline-barks-boos-2026', [["2026-10-23","17:00","19:30"]], "17:00–19:30 在 The Glade Dog Park 举行，主办方要求 RSVP。免费食物数量未公布，饮料与商品另购；仅狗公园内可脱绳。停车仅前 2 小时免费，不包含整场 2.5 小时。"),
  'mountain-view-monster-bash-2026': dated('mountain-view-monster-bash-2026', [["2026-10-24","10:00","14:00"]], "公园活动窗口为 10:00–14:00，公众免费、适合各年龄，具体演出与游戏另有安排。Food Zone 食品饮料另购；场地停车有限。"),
  'ameswell-barks-boos-2026': dated('ameswell-barks-boos-2026', [["2026-10-25","11:00","14:00"]], "11:00–14:00 为户外活动窗口；观看无须票，免费到场票为建议，服装比赛须在 10/16 前另行登记。巡游 12:00–12:30，颁奖 12:30–13:00；宠物须牵绳。停车前 3 小时免费，之后 $10/天，餐饮与购物另付。"),
  'stanford-halloween-concert-2026': sessions('stanford-halloween-concert-2026', [{"date":"2026-10-30","start":"19:30","end":"21:00"}], "19:30–21:00 固定音乐会。规划采用公众票 $32；65 岁以上或非 Stanford 学生 $27，均含网上／电话每票 $4 手续费。Stanford 学生一证一张免费票，开演前一小时到场领取；不能自动套用学生资格。核查时门票尚待开放，须再确认。"),
  'sonoma-valley-book-sale-free-child-book-2026': dated('sonoma-valley-book-sale-free-child-book-2026', [["2026-10-03","11:00","16:00"],["2026-10-04","13:00","16:00"]], "10/3 为 11:00–16:00，10/4 为 13:00–16:00。每位到场儿童可领一本免费书、教育工作者购书半价；其他购书付费，数量与资格证明另核。这些是购书福利，活动入场费未单独确认。"),
  'santa-rosa-big-book-sale-discount-days-2026': dated('santa-rosa-big-book-sale-discount-days-2026', [["2026-10-04","10:00","16:00"],["2026-10-05","14:00","18:00"]], "10/4 半价日为 10:00–16:00；10/5 为 14:00–18:00，购书 $5/袋。地点是 Veterans Memorial Hall。袋价是商品价格，不是门票；袋规格、书目和库存现场确认，活动入场费未单独确认。"),
  'san-rafael-civic-center-puzzle-swap-2026': dated('san-rafael-civic-center-puzzle-swap-2026', [["2026-10-08","13:00","16:00"]], "13:00–16:00 免费交换；可直接来选，无须先捐赠。带来交换的拼图须完整无缺件，款式与数量随现场余量变化。"),
  'corte-madera-wooden-sugar-skull-painting-2026': sessions('corte-madera-wooden-sugar-skull-painting-2026', [{"date":"2026-10-08","start":"15:30","end":"16:30"}], "15:30–16:30 固定手作场，仅面向 5–14 岁；无需报名，材料提供。项目为木制造型彩绘，不是食物领取。"),
  'san-rafael-norcal-bats-library-2026': sessions('san-rafael-norcal-bats-library-2026', [{"date":"2026-10-14","start":"14:30","end":"15:30"}], "14:30–15:30 固定科普场，适合家庭、学龄前及儿童，无需报名。动物观察与互动按讲师指引，不包含自行触摸或喂食。"),
  'novato-teen-ai-literacy-escape-room-2026': sessions('novato-teen-ai-literacy-escape-room-2026', [{"date":"2026-10-15","start":"17:00","end":"18:30"}], "17:00–18:30 固定活动，仅面向 11–18 岁；官网未列必须报名。现场有零食但种类未公布，有饮食限制请向馆方确认。"),
  'point-reyes-halloween-clothing-swap-2026': dated('point-reyes-halloween-clothing-swap-2026', [["2026-10-17","10:00","12:00"]], "10:00–12:00 免费交换，成人、儿童与宠物服装均可；接受洁净、轻度使用服装，无须捐赠也可挑选。尺寸、款式和余量不保证。"),
  'fairfax-kids-halloween-costume-swap-2026': dated('fairfax-kids-halloween-costume-swap-2026', [["2026-10-17","14:00","16:00"]], "14:00–16:00 儿童服装交换，没有服装可带也欢迎；不接收恐怖装扮或成人服装。限制的是服装种类，不是陪同成人入场；尺寸和库存不保证。"),
};
