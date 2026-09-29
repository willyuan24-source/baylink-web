import type { PlannerPlace } from '../lib/planner';
import { VERIFIED_PLACE_SCHEDULES, VERIFIED_VENUE_LOCATIONS } from './planner-verified-hours';

/** Nearby choices with separately checked operating hours and venue pins.
 * Ordinary opening hours are planning evidence, never a real-time availability claim.
 */
export const PLANNER_NEIGHBORHOOD_STOPS: PlannerPlace[] = [
  {
    id: 'shop-book-passage-ferry-building', title: 'Book Passage · Ferry Building 书店', region: 'sf', city: 'San Francisco', category: 'shop',
    summary: 'Ferry Building #37A 的独立书店，可搭配市集、海滨用餐与科学馆。购书和作家活动另查费用与场次；地图标记所在建筑，入内按 #37A 找店。',
    address: '1 Ferry Building #37A, San Francisco, CA 94111', officialUrl: 'https://www.ferrybuildingmarketplace.com/shops/book-passage/',
    location: { ...VERIFIED_VENUE_LOCATIONS['ferry-building'], label: 'Book Passage · 所在 Ferry Building，店铺 #37A' }, guideSlug: '', cost: 'unknown',
    planning: { setting: 'indoor', admissionUsd: null },
  },
  {
    id: 'venue-oakland-main-library', title: 'Oakland Main Library · 奥克兰主图书馆', region: 'east-bay', city: 'Oakland', category: 'attraction',
    summary: '在 Downtown 与 Lake Merritt 之间的公共阅览站，可接在 OMCA 前后安静阅读或休息。普通入馆免费；历史中心、活动、打印和停车采用各自规则。',
    address: '125 14th Street, Oakland, CA 94612', officialUrl: 'https://oaklandlibrary.org/locations/XXA/',
    location: VERIFIED_VENUE_LOCATIONS['oakland-main-library'], guideSlug: '', cost: 'free', planning: { setting: 'indoor', admissionUsd: 0 },
  },
  {
    id: 'venue-sj-king-library', title: 'Dr. Martin Luther King, Jr. Library · 圣何塞公共图书馆', region: 'south-bay', city: 'San Jose', category: 'attraction',
    summary: 'San José 市中心的公共图书馆，可安排阅读、公共艺术与短暂停留，普通入馆免费。周日 13:00 开门；儿童区、特藏和 AI Center 的开放及活动安排需另查。',
    address: '150 E San Fernando Street, San Jose, CA 95112', officialUrl: 'https://www.sjpl.org/locations/king/',
    location: VERIFIED_VENUE_LOCATIONS['sj-king-library'], guideSlug: '', cost: 'free', planning: { setting: 'indoor', admissionUsd: 0 },
  },
  {
    id: 'restaurant-farmshop-marin', title: 'Farmshop · Marin Country Mart', region: 'north-bay', city: 'Larkspur', category: 'restaurant',
    summary: 'Larkspur 的 Farmshop Marin 餐厅，可与同一商场的书店、烘焙店及新店组合。可由官网查看菜单与订位入口；餐费、供餐阶段及座位仍需确认。商场有停车时限。',
    address: '2233 Larkspur Landing Circle, Larkspur, CA 94939', officialUrl: 'https://marincountrymart.com/farmshop',
    location: VERIFIED_VENUE_LOCATIONS['farmshop-marin'], guideSlug: '', cost: 'unknown', planning: { setting: 'mixed', admissionUsd: null, reservation: 'unknown' },
  },
  {
    id: 'cafe-rustic-bakery-larkspur', title: 'Rustic Bakery · Marin Country Mart', region: 'north-bay', city: 'Larkspur', category: 'cafe',
    summary: 'Marin Country Mart 的烘焙咖啡站，提供面包、糕点和简餐，可搭配附近书店及新店。咖啡、餐点另付，座位与排队未确认；这是 Larkspur Landing 门店。',
    address: '2017 Larkspur Landing Circle, Larkspur, CA 94939', officialUrl: 'https://marincountrymart.com/rustic-bakery',
    location: VERIFIED_VENUE_LOCATIONS['rustic-bakery-larkspur'], guideSlug: '', cost: 'unknown', planning: { setting: 'mixed', admissionUsd: null },
  },
  {
    id: 'shop-copperfields-larkspur', title: 'Copperfield’s Books · Larkspur 书店', region: 'north-bay', city: 'Larkspur', category: 'shop',
    summary: 'Marin Country Mart 的独立书店，可与同一商场的餐厅、烘焙店及新店一起安排。按普通逛店计划，购书、作家活动和座位以店方安排为准。',
    address: '2419 Larkspur Landing Circle, Larkspur, CA 94939', officialUrl: 'https://marincountrymart.com/copperfields-books',
    location: VERIFIED_VENUE_LOCATIONS['copperfields-larkspur'], guideSlug: '', cost: 'unknown', planning: { setting: 'indoor', admissionUsd: null },
  },
  {
    id: 'venue-san-mateo-history-museum', title: 'San Mateo County History Museum · 半岛历史博物馆', region: 'peninsula', city: 'Redwood City', category: 'attraction',
    summary: '位于 Redwood City 老法院的半岛历史博物馆。普通成人票 $6，长者及学生 $4，5 岁及以下免费；须按同行者资格核算。周一闭馆，15:45 最后入馆；档案室须预约。',
    address: '2200 Broadway, Redwood City, CA 94063', officialUrl: 'https://historysmc.org/plan-your-visit/',
    location: VERIFIED_VENUE_LOCATIONS['san-mateo-history-museum'], guideSlug: '', cost: 'paid', planning: { setting: 'indoor', admissionUsd: null },
  },
  {
    id: 'cafe-coupa-marston', title: 'Coupa Cafe · Redwood City Marston', region: 'peninsula', city: 'Redwood City', category: 'cafe',
    summary: 'Main Street 的 Marston 门店，适合在市中心博物馆或图书馆前后喝咖啡、吃简餐。普通营业到 17:00，餐费按点单另计，座位与排队仍需确认。',
    address: '695 Main Street, Redwood City, CA 94063', officialUrl: 'https://www.coupacafe.com/Locations/redwood-city-marston',
    location: VERIFIED_VENUE_LOCATIONS['coupa-marston'], guideSlug: '', cost: 'unknown', planning: { setting: 'mixed', admissionUsd: null },
  },
  {
    id: 'venue-redwood-city-library', title: 'Redwood City Downtown Library · 市中心图书馆', region: 'peninsula', city: 'Redwood City', category: 'attraction',
    summary: '市中心公共图书馆，可搭配附近历史博物馆和咖啡店安排阅读停留，普通入馆免费。周日中午开门，10/19 员工培训闭馆；Local History Room 须预约，停车另计。',
    address: '1044 Middlefield Road, Redwood City, CA 94063', officialUrl: 'https://www.redwoodcity.org/departments/library/locations-and-hours',
    location: VERIFIED_VENUE_LOCATIONS['redwood-city-library'], guideSlug: '', cost: 'free', planning: { setting: 'indoor', admissionUsd: 0 },
  },
].map(place => ({ ...place, path: place.officialUrl, planning: { ...place.planning, schedule: VERIFIED_PLACE_SCHEDULES[place.id] } } as PlannerPlace));
