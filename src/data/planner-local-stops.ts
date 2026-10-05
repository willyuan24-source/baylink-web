import { currentOpenings } from './local-discoveries';
import placeLocationData from './place-locations.json';
import { VERIFIED_PLACE_SCHEDULES, VERIFIED_VENUE_LOCATIONS } from './planner-verified-hours';
import { PLANNER_NEIGHBORHOOD_STOPS } from './planner-neighborhood-stops';
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
  'anya-gifting-larkspur': VERIFIED_VENUE_LOCATIONS['anya-larkspur'],
  'varley-larkspur': VERIFIED_VENUE_LOCATIONS['varley-larkspur'],
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
    id: 'venue-sfmoma', title: 'SFMOMA · San Francisco Museum of Modern Art', aliases: ['San Francisco Museum of Modern Art'], region: 'sf', city: 'San Francisco', category: 'attraction',
    summary: '旧金山市中心的现代与当代艺术博物馆，主要访客入口在 151 Third Street。普通展厅、免费公共空间与馆内商店的入场规则和时间需分别核对；门票按年龄及本人优惠资格计算，特展、余票与所选日期的临时调整以官网为准。',
    address: '151 Third Street, San Francisco, CA 94103', officialUrl: 'https://www.sfmoma.org/visit/',
    // Official visitor guide confirms both names and the entrance address.
    // Its My Maps link exposes a viewport, not an individually verified venue pin.
    guideSlug: '', cost: 'unknown', offerIds: [],
  },
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

// Identity and official directions checked 2026-10-04. This is the building,
// not a merchant or a farmers-market session; their schedules remain separate.
const publicVenueStops: PlannerPlace[] = [{
  id: 'venue-ferry-building', title: 'Ferry Building · 公共大厅与外部会合点', region: 'sf', city: 'San Francisco', category: 'attraction',
  summary: '位于 Embarcadero 与 Market Street 尽头的 Ferry Building，可作为公共会合与出发地点。大厅、各商家、农夫市集和轮渡采用不同开放或发班安排；在建筑外会合时请约定具体入口。餐饮、购物、停车及乘车费用另计，路线到站后仍需留出馆外步行与找入口时间。',
  address: 'One Ferry Building, San Francisco, CA 94111', officialUrl: 'https://www.ferrybuildingmarketplace.com/visit/',
  // The official page's named Ferry Building directions pin contains
  // !1d-122.3936136!2d37.7954425; no shop or map viewport is substituted.
  location: VERIFIED_VENUE_LOCATIONS['ferry-building'],
  guideSlug: '', path: 'https://www.ferrybuildingmarketplace.com/visit/', cost: 'unknown',
  planning: { setting: 'mixed', admissionUsd: null }, offerIds: [],
}];

// Official identity checked 2026-10-04. The brand's city name is not its location.
const shoppingStops: PlannerPlace[] = [{
  id: 'shop-san-francisco-premium-outlets', title: 'San Francisco Premium Outlets', city: 'Livermore', region: 'east-bay', category: 'shop',
  address: '2774 Livermore Outlets Drive, Livermore, CA 94551',
  officialUrl: 'https://www.premiumoutlets.com/outlet/san-francisco/about',
  guideSlug: 'bay-area-outlets-malls-shopping-guide', path: 'https://www.premiumoutlets.com/outlet/san-francisco/about',
  summary: '位于东湾 Livermore 的户外奥特莱斯，不在旧金山市区。商场官网列出 BART 接 Wheels 14 路的公共交通方式；出发前需核对当天班次、营业时间和回程，购物与交通费用另计。',
  cost: 'unknown', planning: { setting: 'outdoor', admissionUsd: null }, offerIds: [],
}];

export const PLANNER_LOCAL_STOPS: PlannerPlace[] = [...openingStops, ...diningStops, ...venueStops, ...publicVenueStops, ...shoppingStops, ...PLANNER_NEIGHBORHOOD_STOPS];
