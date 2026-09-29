import type { GeoPoint, PlanningSchedule, TimeWindow } from '../lib/planner';

/** Individually checked official pages. These are published hours, not live availability. */
export const PLANNER_TIME_CHECKED_AT = '2026-09-29';
const ordinaryHours = '普通营业时间；节假日、包场及临时调整请出发前查看官方页面。';
const window = (open: string, close: string, lastEntry?: string, lastOrder?: string): TimeWindow[] => [{ open, close, ...(lastEntry ? { lastEntry } : {}), ...(lastOrder ? { lastOrder } : {}) }];
const weekly = (sourceUrl: string, days: PlanningSchedule['weekly'], note = ordinaryHours): PlanningSchedule => ({
  sourceUrl, verifiedAt: PLANNER_TIME_CHECKED_AT, validFrom: PLANNER_TIME_CHECKED_AT, validThrough: '2026-10-31', weekly: days, note,
});
const dated = (sourceUrl: string, date: string, open: string, close: string, note: string): PlanningSchedule => ({
  sourceUrl, verifiedAt: PLANNER_TIME_CHECKED_AT, validFrom: date, validThrough: date, dates: { [date]: window(open, close) }, note,
});
const everyDay = (open: string, close: string) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, window(open, close)]));

export const VERIFIED_PLACE_SCHEDULES: Record<string, PlanningSchedule> = {
  'venue-exploratorium-daytime': {
    ...weekly('https://www.exploratorium.edu/hours', { 0: window('12:00', '17:00'), 1: [], 2: window('10:00', '17:00'), 3: window('10:00', '17:00'), 4: window('10:00', '17:00'), 5: window('10:00', '17:00'), 6: window('10:00', '17:00') }, '普通日间门票时段；周日 10:00–12:00 仅日间会员及捐助者。周四 18 岁以上夜场另票；Tactile Dome 另需预约与购票。10/1、10/7、10/8、10/21 部分展厅有临时关闭安排，出发前查官网。'),
    dates: { '2026-10-12': window('10:00', '17:00') },
  },
  'venue-sjma': weekly('https://sjmusart.org/hours-and-admissions', { 0: window('11:00', '18:00'), 2: window('11:00', '18:00'), 3: window('11:00', '18:00'), 4: window('11:00', '18:00'), 5: window('11:00', '21:00'), 6: window('11:00', '18:00') }, '普通展馆时段；官网此表未列周一时间。10 人及以上团体须提前预约；首个周五 18:00 后免费，其他时段依本人票种与资格购票。'),
  'venue-omca': weekly('https://museumca.org/visit/', { 0: window('11:00', '17:00'), 1: [], 2: [], 3: window('11:00', '17:00'), 4: window('11:00', '17:00'), 5: window('11:00', '21:00'), 6: window('11:00', '17:00') }, '仅 OMCA 展馆，不代表 Lake Merritt 湖区开放时间。普通票含特别展；首个周日免费。10/25 社区庆典有专门票种，团体与特别活动请另查预约条件。'),
  filoli: weekly('https://filoli.org/visit/', everyDay('10:00', '17:00'), '仅普通日间入园；步道提前 30 分钟关闭，夜场另票。建议提前预约，并在所选一小时窗口内抵达。特殊日期请再查官网。'),
  hakone: weekly('https://www.hakone.com/', { 0: window('11:00', '17:00', '16:00'), 1: window('10:00', '17:00', '16:30'), 2: window('10:00', '17:00', '16:30'), 3: window('10:00', '17:00', '16:30'), 4: window('10:00', '17:00', '16:30'), 5: window('10:00', '17:00', '16:30'), 6: window('11:00', '17:00', '16:00') }),
  'opening-sergeant-ma': weekly('https://www.sergeantma.com/', { 0: [], 1: window('16:00', '21:00'), 2: window('16:00', '21:00'), 3: window('16:00', '21:00'), 4: window('16:00', '21:00'), 5: window('16:00', '21:00'), 6: window('16:00', '21:00') }),
  'opening-alameda-juxi-soft-opening-2026': weekly('https://www.juxialameda.com/', { 2: window('17:00', '21:30'), 3: window('17:00', '21:30'), 4: window('17:00', '21:30'), 5: window('17:00', '21:30'), 6: window('17:00', '21:30') }, '试营业期间官网列周二至周六晚餐；周日、周一时间未确认。建议查看订位与当日安排。'),
  'opening-sf-athanor-new-restaurant-2026': weekly('https://www.athanorsf.com/', { 0: [], 1: [], 2: window('19:00', '23:00'), 3: window('18:00', '23:00'), 4: window('18:00', '23:00'), 5: window('18:00', '23:00'), 6: window('18:00', '23:00') }),
  'opening-oakland-delage-reopening-2026': weekly('https://www.delagesushi.com/', { 1: [...window('11:00', '15:00'), ...window('17:00', '21:00')], 2: [...window('11:00', '15:00'), ...window('17:00', '21:00')], 3: [...window('11:00', '15:00'), ...window('17:00', '21:00')], 4: [...window('11:00', '15:00'), ...window('17:00', '21:00')], 5: [...window('11:00', '15:00'), ...window('17:00', '21:00')], 6: [...window('11:00', '15:00'), ...window('17:00', '21:00')] }, '官网列周一至周六午、晚餐，15:00–17:00 不营业；周日时间未确认。'),
  // The contact page conflicts on weekday opening (11:00 versus noon). Do not choose one.
  'opening-broken-dreams-oakland': weekly('https://www.brokendreamsoakland.com/contact', { 0: [], 6: [] }, '官网确认暂时周末休息；工作日开门时间同时出现 11:00 与 12:00，尚待商家确认。'),
  'opening-walnut-creek-vici-new-store-2026': weekly('https://www.vicicollection.com/pages/stores', { 0: window('11:00', '18:00'), 1: window('10:00', '18:00'), 2: window('10:00', '18:00'), 3: window('10:00', '18:00'), 4: window('10:00', '18:00'), 5: window('10:00', '19:00'), 6: window('10:00', '19:00') }),
  'opening-walnut-creek-saatva-new-store-2026': weekly('https://www.saatva.com/press-room/announcements/new-saatva-location-walnut-creek-california/', { 0: window('11:00', '18:00'), 1: window('10:00', '19:00'), 2: window('10:00', '19:00'), 3: window('10:00', '19:00'), 4: window('10:00', '19:00'), 5: window('10:00', '19:00'), 6: window('10:00', '18:00') }),
  'opening-anya-gifting-larkspur': weekly('https://marincountrymart.com/anya-hindmarch-gifting-agency', { 0: window('12:00', '17:00'), 1: window('11:00', '18:00'), 2: window('11:00', '18:00'), 3: window('11:00', '18:00'), 4: window('11:00', '18:00'), 5: window('11:00', '18:00'), 6: window('11:00', '17:00') }),
  'opening-margaux-larkspur': weekly('https://marincountrymart.com/margaux', { 0: window('11:00', '17:00'), 1: window('10:00', '18:00'), 2: window('10:00', '18:00'), 3: window('10:00', '18:00'), 4: window('10:00', '18:00'), 5: window('10:00', '18:00'), 6: window('10:00', '18:00') }),
  'opening-varley-larkspur': weekly('https://marincountrymart.com/varley', { 0: window('11:00', '17:00'), 1: window('10:00', '18:00'), 2: window('10:00', '18:00'), 3: window('10:00', '18:00'), 4: window('10:00', '18:00'), 5: window('10:00', '18:00'), 6: window('10:00', '18:00') }),
  'restaurant-gotts-ferry-building': weekly('https://www.gotts.com/location/sfferrybuilding/', { 0: window('10:00', '21:00'), 1: window('10:00', '21:00'), 2: window('10:00', '21:00'), 3: window('10:00', '21:00'), 4: window('10:00', '22:00'), 5: window('10:00', '22:00'), 6: window('10:00', '22:00') }),
  'restaurant-el-cafecito-sjma': weekly('https://sjmusart.org/visit', { 0: window('11:00', '15:00'), 2: window('11:00', '15:00'), 3: window('11:00', '15:00'), 4: window('11:00', '15:00'), 5: window('11:00', '21:00'), 6: window('11:00', '15:00') }, '美术馆咖啡餐厅营业时间，入店无需美术馆门票；特别活动营业可能调整。周一未列时间。'),
  'restaurant-town-fare-omca': weekly('https://museumca.org/visit/', { 0: window('11:00', '16:00', undefined, '15:15'), 1: [], 2: [], 3: window('11:00', '16:00', undefined, '15:15'), 4: window('11:00', '16:00', undefined, '15:15'), 5: window('11:00', '16:00', undefined, '15:15'), 6: window('11:00', '16:00', undefined, '15:15') }, '堂食最晚 15:15 点单；无需博物馆门票。周日 brunch 先到先得、不接受预约；临时及特殊活动安排另查官网。'),
  // Only the listed days are structured: the captured official page did not list Friday.
  'restaurant-eureka-cupertino': weekly('https://eurekarestaurantgroup.com/locations/cupertino', { 0: window('11:00', '23:00'), 1: window('11:00', '23:00'), 2: window('11:00', '23:00'), 3: window('11:00', '23:00'), 4: window('11:00', '23:00'), 6: window('11:00', '24:00') }, '周五营业时间尚待确认；周六营业至午夜，优惠适用时段须另看具体条件。'),
  'restaurant-pacific-catch-mountain-view': weekly('https://www.pacificcatch.com/location/mountain-view/', { 0: window('11:00', '21:00'), 1: window('11:00', '21:00'), 2: window('11:00', '21:00'), 3: window('11:00', '21:00'), 4: window('11:00', '21:00'), 5: window('11:00', '22:00'), 6: window('11:00', '22:00') }),
};

const afterDarkDates = [
  ['01', 'after-dark-echoes'], ['08', 'after-dark-unplug-play-oct2026'], ['15', 'after-dark-speak-easy'],
  ['22', 'after-dark-death-and-life'], ['29', 'after-dark-creepatorium'],
] as const;
export const VERIFIED_EVENT_SCHEDULES: Record<string, PlanningSchedule> = {
  ...Object.fromEntries(afterDarkDates.map(([day, slug]) => [`sf-exploratorium-after-dark-${day}-oct2026`, dated(`https://www.exploratorium.edu/visit/calendar/${slug}`, `2026-10-${day}`, '18:00', '22:00', '18 岁以上活动开放窗口；具体节目另有时间。Tactile Dome 需另行预约与购票。')])),
  'ferry-plaza-farmers-market-2026-autumn': weekly('https://foodwise.org/markets/ferry-plaza-farmers-market/visitor-info/', { 0: [], 1: [], 2: window('10:00', '14:00'), 3: [], 4: window('10:00', '14:00'), 5: [], 6: window('08:00', '14:00') }, '市集每周二、四、六举行，风雨照常；此时间不代表 Ferry Building 内所有商家营业时间。购物与餐饮另付费。'),
  'san-jose-first-friday-ballet-2026': dated('https://sjmusart.org/event/first-friday-new-ballet-season-preview', '2026-10-02', '18:00', '21:00', '18:00–21:00 为免费美术馆之夜；芭蕾演出所在教室 19:25 开门，座位先到先得。演出开始及结束钟点未单独公布；提前登记可加快入馆。'),
  'san-jose-sjma-dia-muertos-community-2026': dated('https://sjmusart.org/programs-at-sjma/community-days/dia-de-los-muertos', '2026-10-24', '11:00', '16:00', '社区活动 11:00–16:00，全天免费入馆；可提前登记，也欢迎直接到场。具体节目表尚未公布。'),
  'oakland-omca-friday-finale-2026': dated('https://museumca.org/event/friday-nights-at-omca-with-la-gente-sf/', '2026-10-30', '17:00', '21:00', '此为周五夜整体活动窗口；音乐与展厅活动各有安排。餐饮、馆内展览及特别展的费用与时间请另查。'),
  'oakland-omca-dia-muertos-2026': dated('https://museumca.org/press/omca-announces-public-programs-and-events-for-october-2026/', '2026-10-25', '11:00', '16:00', '社区庆典整体窗口；普通票 $10 含庆典与展厅，会员免费，餐饮另付费。'),
  'east-bay-billy-strings-2026': { sourceUrl: 'https://www.theoaklandarena.com/events/detail/billy-strings', verifiedAt: PLANNER_TIME_CHECKED_AT, validFrom: '2026-10-02', validThrough: '2026-10-02', sessions: [{ date: '2026-10-02', start: '19:30' }], note: '本页当前仅确认 10/2：18:30 开门、19:30 开演；结束时间未公布。其他场次须查对应票面与官方页面。' },
};

/** Venue pins, not map viewport centers or a geocoder estimate. Reuse only for this venue. */
export const VERIFIED_VENUE_LOCATIONS: Record<string, GeoPoint> = {
  'ferry-plaza': { lat: 37.7953186, lng: -122.3936029, label: 'Ferry Plaza Farmers Market', sourceUrl: 'https://foodwise.org/markets/ferry-plaza-farmers-market/visitor-info/', precision: 'venue' },
  // The museum's embedded Google map resolves its named pin to these coordinates.
  exploratorium: { lat: 37.8016649, lng: -122.397348, label: 'Exploratorium · Pier 15', sourceUrl: 'https://www.exploratorium.edu/visit', precision: 'venue' },
  sjma: { lat: 37.333726, lng: -121.889925, label: 'San José Museum of Art · 110 S Market Street', sourceUrl: 'https://www.sanjose.org/listings/san-jose-museum-art', precision: 'venue' },
  'gotts-ferry': { lat: 37.796048, lng: -122.394166, label: 'Gott’s Roadside · Ferry Building #6', sourceUrl: 'https://www.gotts.com/location/sfferrybuilding/', precision: 'venue' },
  ignite: { lat: 37.3365, lng: -121.8947, label: 'IGNITE · 26 N San Pedro Street', sourceUrl: 'https://www.eatatignite.com/', precision: 'venue' },
  delage: { lat: 37.8017048, lng: -122.275086, label: 'Delage · 536 Ninth Street', sourceUrl: 'https://www.delagesushi.com/', precision: 'venue' },
};
