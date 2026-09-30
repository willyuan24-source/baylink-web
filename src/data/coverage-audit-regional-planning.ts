import type { PlanningFacts, PlanningSchedule } from '../lib/planner';
import events from './coverage-audit-regional-events.json';

const source = (id: string) => {
  const event = events.find(row => row.id === id);
  if (!event) throw new Error(`Missing coverage audit event: ${id}`);
  return { sourceUrl: event.officialUrl, verifiedAt: event.verifiedAt, validFrom: event.startDate, validThrough: event.endDate };
};

/** Source-confirmed admission only; purchases and unconfirmed ticket tiers stay separate. */
export const COVERAGE_AUDIT_REGIONAL_PLANNING: Record<string, PlanningFacts> = {
  'daly-city-top-of-the-hill-festival-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'unknown' },
  'fremont-fog-diwali-mela-2026': { setting: 'mixed', admissionUsd: null, reservation: 'unknown' },
  'san-jose-hellflowers-free-concert-oct2-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'unknown' },
  'woodside-djerassi-free-art-hike-oct5-2026': { setting: 'outdoor', admissionUsd: 0, reservation: 'required' },
};

export const COVERAGE_AUDIT_REGIONAL_SCHEDULES: Record<string, PlanningSchedule> = {
  'daly-city-top-of-the-hill-festival-2026': {
    ...source('daly-city-top-of-the-hill-festival-2026'),
    dates: { '2026-10-17': [{ open: '12:00', close: '18:00' }] },
    note: "12:00–18:00 是街庆整体开放窗口，免费入场；各舞台表演时间未公布，餐饮与购物另付。活动位于 Mission Street 与 John Daly Boulevard，不在市府大楼。",
  },
  'fremont-fog-diwali-mela-2026': {
    ...source('fremont-fog-diwali-mela-2026'),
    dates: { '2026-10-24': [{ open: '10:00', close: '19:00' }] },
    note: "10:00–19:00 为整体活动窗口，各表演时刻未公布。主办方官网免费登记与售票页收费存在差异；按付费活动处理，9/29 票务显示早鸟 $4 加 $0.22 手续费、正文列 $5，最终票档与附加费待购票时确认。免费停车不代表免费入场，餐饮购物另付。",
  },
  'san-jose-hellflowers-free-concert-oct2-2026': {
    ...source('san-jose-hellflowers-free-concert-oct2-2026'),
    dates: { '2026-10-02': [{ open: '18:00', close: '22:00' }] },
    sessions: [{ date: '2026-10-02', start: '18:30' }],
    note: "活动窗口18:00–22:00，18:00 开门、18:30 开始演出；单独乐队场次及演出结束时间未公布，不把22:00写成已确认的演出结束时刻。音乐会、停车与滑板免费，餐车食品另付；器材借用与教学未确认包含。",
  },
  'woodside-djerassi-free-art-hike-oct5-2026': {
    ...source('woodside-djerassi-free-art-hike-oct5-2026'),
    sessions: [{ date: '2026-10-05', start: '10:00', end: '12:00' }],
    note: "10/5 免费导览固定为10:00–12:00，须预约；官网一般介绍的3小时、3.5英里不自动适用于此场。剩余名额、年龄和无障碍条件未确认。所有徒步在2325 Bear Gulch Road入口闸门集合，场地非公众随到随进，不使用Woodside城市参考点代替入口。",
  },
};
