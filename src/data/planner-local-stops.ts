import { currentOpenings } from './local-discoveries';
import placeLocationData from './place-locations.json';
import { VERIFIED_PLACE_SCHEDULES, VERIFIED_VENUE_LOCATIONS } from './planner-verified-hours';
import type { GeoPoint, PlannerPlace } from '../lib/planner';

const cafes = new Set([
  'san-jose-bitterbuck-soft-opening-2026', 'hijau-san-jose-storefront', 'oakland-55-coffee-pop-up-2026',
  'berkeley-cere-tea-opening-2026', 'pittsburg-nekter-opening-2026', 'game-parlour-oakland',
  'chicha-san-chen-pleasanton', 'hey-yogurt-san-mateo', 'boulangerie-eria-celebration',
]);
const shops = new Set([
  'walnut-creek-vici-new-store-2026', 'santa-clara-cider-valley-fair-opening-2026',
  'santa-clara-rhone-valley-fair-new-store-2026', 'walnut-creek-saatva-new-store-2026',
  'anya-gifting-larkspur', 'margaux-larkspur', 'varley-larkspur',
]);
const openingLocations: Record<string, GeoPoint> = {
  'ignite-san-pedro-square': VERIFIED_VENUE_LOCATIONS.ignite,
  'oakland-delage-reopening-2026': VERIFIED_VENUE_LOCATIONS.delage,
};

/** Opening status stays explicit; announcement dates never turn a store into an open place. */
const openingStops: PlannerPlace[] = currentOpenings.filter(shop => shop.status === 'open' || shop.status === 'soft_open').map(shop => ({
  id: `opening-${shop.id}`, title: shop.name, region: shop.region, city: shop.city,
  summary: shop.summary, guideSlug: '', path: `/openings/${encodeURIComponent(shop.id)}`,
  officialUrl: shop.officialUrl, cost: 'unknown',
  category: shops.has(shop.id) ? 'shop' : cafes.has(shop.id) ? 'cafe' : 'restaurant',
  ...(shop.address && !/待.*确认|尚未|未公布/.test(shop.address) ? { address: shop.address } : {}),
  imageKey: shop.imageKey, openingStatus: shop.status, ...(shop.openedOn ? { openedOn: shop.openedOn } : {}),
  ...(openingLocations[shop.id] ? { location: openingLocations[shop.id] } : {}),
  // A meal or purchase has no verified per-person total; do not call it free admission.
  planning: { admissionUsd: null, ...(VERIFIED_PLACE_SCHEDULES[`opening-${shop.id}`] ? { schedule: VERIFIED_PLACE_SCHEDULES[`opening-${shop.id}`] } : {}) },
  offerIds: [],
}));

const omcaLocation = (placeLocationData as Record<string, GeoPoint>)['lake-merritt'];
const diningStops: PlannerPlace[] = [
  {
    id: 'restaurant-gotts-ferry-building', title: 'Gott’s Roadside · Ferry Building', region: 'sf', city: 'San Francisco', category: 'restaurant',
    summary: 'Ferry Building 的汉堡、沙拉与奶昔餐厅，可接在市集前后用餐。座位先到先得，餐费按点单另计。',
    address: '1 Ferry Building #6, San Francisco, CA 94111', officialUrl: 'https://www.gotts.com/location/sfferrybuilding/',
    location: VERIFIED_VENUE_LOCATIONS['gotts-ferry'], guideSlug: '', cost: 'unknown', offerIds: [],
  },
  {
    id: 'restaurant-el-cafecito-sjma', title: 'El Cafecito · San José Museum of Art', region: 'south-bay', city: 'San Jose', category: 'restaurant',
    summary: '美术馆内面向公众的咖啡餐厅，提供简餐；无需购买美术馆门票，餐饮另付费。位置标记为所在美术馆，馆内请按指示找店。',
    address: '110 S Market Street, San Jose, CA 95113', officialUrl: 'https://sjmusart.org/visit',
    location: { ...VERIFIED_VENUE_LOCATIONS.sjma, label: 'El Cafecito · 所在 San José Museum of Art' }, guideSlug: '', cost: 'unknown', offerIds: [],
  },
  {
    id: 'restaurant-town-fare-omca', title: 'Town Fare · Oakland Museum of California', region: 'east-bay', city: 'Oakland', category: 'restaurant',
    summary: 'OMCA 中层餐厅，供应午餐及周日 brunch；无需博物馆门票，餐费另计。堂食须在 15:15 前点单，周日排队时间需自行预留。位置标记为所在博物馆。',
    address: '1000 Oak Street, Oakland, CA 94607', officialUrl: 'https://museumca.org/visit/',
    location: { ...omcaLocation, label: 'Town Fare · 所在 Oakland Museum of California' }, guideSlug: '', cost: 'unknown', offerIds: [],
  },
  {
    id: 'restaurant-eureka-cupertino', title: 'Eureka! · Cupertino', region: 'south-bay', city: 'Cupertino', category: 'restaurant',
    summary: 'Main Street Cupertino 的美式餐厅，有汉堡及露台座位；周三指定汉堡薯条优惠需按门店条款使用，餐费不会自动计为半价。',
    address: '19369 Stevens Creek Boulevard, Suite 130, Cupertino, CA 95014', officialUrl: 'https://eurekarestaurantgroup.com/locations/cupertino',
    guideSlug: '', cost: 'unknown', offerIds: ['cupertino-eureka-wednesday-burger-ongoing'],
  },
  {
    id: 'restaurant-pacific-catch-mountain-view', title: 'Pacific Catch · Mountain View', region: 'peninsula', city: 'Mountain View', category: 'restaurant',
    summary: 'San Antonio 商圈的海鲜餐厅，提供室内与带顶露台座位；Aloha Hour 有特定时段，实际消费按菜单与适用条件计算。',
    address: '545 San Antonio Road, Suite 34, Mountain View, CA 94040', officialUrl: 'https://www.pacificcatch.com/location/mountain-view/',
    guideSlug: '', cost: 'unknown', offerIds: ['mountain-view-pacific-catch-aloha-hour-ongoing'],
  },
].map(place => ({ ...place, path: place.officialUrl, planning: { admissionUsd: null, schedule: VERIFIED_PLACE_SCHEDULES[place.id] } } as PlannerPlace));

/** Separate museum entries keep their hours and ticket conditions off broad neighborhood guides. */
const venueStops: PlannerPlace[] = [
  {
    id: 'venue-exploratorium-daytime', title: 'Exploratorium · 日间科学探索馆', region: 'sf', city: 'San Francisco', category: 'attraction',
    summary: 'Pier 15 的互动科学馆，可搭配 Ferry Plaza 市集与附近用餐。这里是日间参观；周四成人夜场、Tactile Dome 的门票与预约另计。实际票价取决于年龄和优惠资格。',
    address: 'Pier 15, Embarcadero at Green Street, San Francisco, CA 94111', officialUrl: 'https://www.exploratorium.edu/visit',
    location: VERIFIED_VENUE_LOCATIONS.exploratorium, guideSlug: '', cost: 'unknown', offerIds: ['exploratorium-for-all-five'],
  },
  {
    id: 'venue-sjma', title: 'San José Museum of Art · 美术馆', region: 'south-bay', city: 'San Jose', category: 'attraction',
    summary: 'San José 市中心的现代与当代艺术馆。普通参观与社区活动采用不同票务安排；馆内咖啡餐厅可单独消费，10 人及以上团体须预约。',
    address: '110 S Market Street, San Jose, CA 95113', officialUrl: 'https://sjmusart.org/visit',
    location: VERIFIED_VENUE_LOCATIONS.sjma, guideSlug: '', cost: 'unknown', offerIds: ['sjma-free-oct2'],
  },
  {
    id: 'venue-omca', title: 'Oakland Museum of California · OMCA 展馆', region: 'east-bay', city: 'Oakland', category: 'attraction',
    summary: '在 OMCA 看加州艺术、历史与自然展览，普通门票包括特别展。首个周日免费；周五夜与社区庆典的节目、费用及预约另查，不等同于整片 Lake Merritt 湖区。',
    address: '1000 Oak Street, Oakland, CA 94607', officialUrl: 'https://museumca.org/visit/',
    location: { ...omcaLocation, label: 'Oakland Museum of California · OMCA 展馆' }, guideSlug: '', cost: 'unknown', offerIds: ['omca-free-oct4'],
  },
].map(place => ({ ...place, path: place.officialUrl, planning: { setting: 'indoor', admissionUsd: null, schedule: VERIFIED_PLACE_SCHEDULES[place.id] } } as PlannerPlace));

export const PLANNER_LOCAL_STOPS: PlannerPlace[] = [...openingStops, ...diningStops, ...venueStops];
