import type { BayRegionId } from './bay-journey';
import {
  UNIFIED_BAY_PLACES, bayBridgeAt, bayCanMove, bayRegionAt, getUnifiedPlace, projectBay,
  type BayPoint, type UnifiedPlace,
} from './unified-bay-world';

export type BayCity = {
  id: string; name: string; nameEn: string; region: BayRegionId;
  coordinate: [longitude: number, latitude: number]; position: BayPoint;
  /** A nearby existing attraction, not the camera target or the city's centre. */
  focusKey: string;
  subtitle: { zh: string; en: string };
  kind: 'city' | 'town' | 'community' | 'area';
};

const city = (
  id: string, name: string, nameEn: string, region: BayRegionId,
  coordinate: BayCity['coordinate'], focusKey: string, zh: string, en: string,
  kind: BayCity['kind'] = 'city',
): BayCity => ({ id, name, nameEn, region, coordinate, position: projectBay(coordinate), focusKey, subtitle: { zh, en }, kind });

/** Authored game districts around reference centres; these are not municipal boundaries. */
export const BAY_CITIES: BayCity[] = [
  city('san-francisco', '旧金山', 'San Francisco', 'sf', [-122.447, 37.768], 'sf:park', '海风、山丘与下一条街的惊喜', 'Sea breezes, city hills and another street to explore.'),
  city('daly-city', '戴利城', 'Daly City', 'peninsula', [-122.4688, 37.6879], 'sf:sf-state', '雾气里的半岛门户', 'A fog-kissed gateway to the Peninsula.'),
  city('south-san-francisco', '南旧金山', 'South San Francisco', 'peninsula', [-122.4077, 37.6547], 'peninsula:burlingame', '沿着半岛，向南出发', 'Continue south along the Peninsula.'),
  city('san-bruno', '圣布鲁诺', 'San Bruno', 'peninsula', [-122.4111, 37.6305], 'peninsula:burlingame', '山脚小城与机场旁的日常', 'A foothill city beside the airport corridor.'),
  city('millbrae', '密尔布瑞', 'Millbrae', 'peninsula', [-122.3872, 37.6009], 'peninsula:burlingame', '半岛旅途中的一站', 'A Peninsula stop along the way.'),
  city('burlingame', '伯灵格姆', 'Burlingame', 'peninsula', [-122.3465, 37.5795], 'peninsula:burlingame', '林荫街道与慢逛时光', 'Tree-lined streets and an unhurried stroll.'),
  city('san-mateo', '圣马特奥', 'San Mateo', 'peninsula', [-122.3238, 37.563], 'peninsula:san-mateo-garden', '庭园、水岸与小城生活', 'Gardens, bayfront paths and everyday discoveries.'),
  city('foster-city', '福斯特城', 'Foster City', 'peninsula', [-122.272, 37.551], 'peninsula:foster-city', '沿着潟湖，放慢脚步', 'Take the slow way around the lagoon.'),
  city('belmont', '贝尔蒙特', 'Belmont', 'peninsula', [-122.2758, 37.5202], 'peninsula:hiller', '半岛山丘之间的小城', 'A small city among the Peninsula hills.'),
  city('san-carlos', '圣卡洛斯', 'San Carlos', 'peninsula', [-122.2605, 37.5072], 'peninsula:hiller', '街边散步，也向天空好奇', 'A downtown stroll and a little aviation curiosity.'),
  city('redwood-city', '红木城', 'Redwood City', 'peninsula', [-122.2297, 37.4863], 'peninsula:redwood-square', '从法院广场开始的一段散步', 'Begin a walk at the courthouse square.'),
  city('woodside', '伍德赛德', 'Woodside', 'peninsula', [-122.264, 37.4299], 'peninsula:filoli', '花园、山路与庄园的故事', 'Gardens, country roads and estate stories.', 'town'),
  city('menlo-park', '门洛帕克', 'Menlo Park', 'peninsula', [-122.1817, 37.453], 'peninsula:stanford', '树荫下的半岛邻里', 'Peninsula neighbourhoods beneath the trees.'),
  city('palo-alto', '帕洛阿尔托', 'Palo Alto', 'peninsula', [-122.163, 37.444], 'peninsula:baylands', '从林荫街道走向海湾湿地', 'From leafy streets to the baylands.'),
  city('stanford', '斯坦福社区', 'Stanford', 'peninsula', [-122.1697, 37.4275], 'peninsula:stanford', '红瓦校园与艺术漫步', 'Red-tile arcades and a campus art walk.', 'community'),
  city('pacifica', '帕西菲卡', 'Pacifica', 'peninsula', [-122.4869, 37.6138], 'peninsula:half-moon-bay', '太平洋岸边的海风', 'A little Pacific air along the coast.'),
  city('half-moon-bay', '半月湾', 'Half Moon Bay', 'peninsula', [-122.4286, 37.4636], 'peninsula:half-moon-bay', '沙岸与海边的慢时光', 'Sandy beaches and a slower coastal day.'),
  city('mountain-view', '山景城', 'Mountain View', 'south-bay', [-122.0838, 37.3861], 'south-bay:computer-history', '计算机故事与湖边步道', 'Computing stories and lakeside paths.'),
  city('sunnyvale', '桑尼维尔', 'Sunnyvale', 'south-bay', [-122.0363, 37.3688], 'south-bay:computer-history', '南湾街道上的悠闲一站', 'A relaxed stop among the South Bay streets.'),
  city('cupertino', '库比蒂诺', 'Cupertino', 'south-bay', [-122.0322, 37.323], 'south-bay:apple-visitor', '科技灵感与山脚绿意', 'Technology inspiration and foothill greenery.'),
  city('santa-clara', '圣克拉拉', 'Santa Clara', 'south-bay', [-121.9552, 37.3541], 'south-bay:tech', '南湾小城，继续发现', 'Another South Bay city to discover.'),
  city('san-jose', '圣何塞', 'San Jose', 'south-bay', [-121.8863, 37.3382], 'south-bay:tech', '动手探索、文化街区与南湾故事', 'Hands-on discoveries, cultural streets and South Bay stories.'),
  city('saratoga', '萨拉托加', 'Saratoga', 'south-bay', [-122.023, 37.2638], 'south-bay:hakone', '在山脚庭园里，慢下来', 'Slow down in a foothill garden.'),
  city('milpitas', '苗必达', 'Milpitas', 'south-bay', [-121.9, 37.4323], 'south-bay:alviso', '连接南湾与东湾的旅途', 'A stop between the South Bay and East Bay.'),
  city('mount-hamilton', '汉密尔顿山', 'Mount Hamilton', 'south-bay', [-121.6429, 37.3414], 'south-bay:lick', '山路尽头，抬头看星空', 'At the end of the mountain road, look to the stars.', 'area'),
  city('oakland', '奥克兰', 'Oakland', 'east-bay', [-122.2576, 37.8058], 'east-bay:lake-merritt', '湖边、艺术与红杉山林', 'Lakeside paths, art and redwood hills.'),
  city('berkeley', '伯克利', 'Berkeley', 'east-bay', [-122.273, 37.8715], 'east-bay:berkeley', '校园、花园与东湾山丘', 'Campus walks, gardens and East Bay hills.'),
  city('alameda', '阿拉米达', 'Alameda', 'east-bay', [-122.2416, 37.7652], 'east-bay:alameda-beach', '沙滩海风与水岸故事', 'Beach breezes and waterfront stories.'),
  city('hayward', '海沃德', 'Hayward', 'east-bay', [-122.0808, 37.6688], 'east-bay:ardenwood', '沿东湾一路向南', 'Follow the East Bay south.'),
  city('fremont', '弗里蒙特', 'Fremont', 'east-bay', [-121.9886, 37.5483], 'east-bay:ardenwood', '历史农场与山脊远景', 'Historic farmland and wide ridgeline views.'),
];

const byId = new Map(BAY_CITIES.map(item => [item.id, item]));
const byName = new Map(BAY_CITIES.map(item => [item.nameEn, item]));

/** Venue affiliation is explicit so shoreline venues do not inherit a neighbour. */
export function bayCityForPlace(placeOrKey: UnifiedPlace | string): BayCity | null {
  const place = typeof placeOrKey === 'string' ? getUnifiedPlace(placeOrKey) : placeOrKey;
  if (!place) return null;
  return (place.region === 'sf' ? byId.get('san-francisco') : byName.get(place.regional?.city ?? '')) ?? null;
}

export function bayCityAt(x: number, z: number): BayCity | null {
  if (!bayCanMove(x, z) || bayBridgeAt(x, z)) return null;
  const region = bayRegionAt(x, z);
  if (!region) return null;
  // Landmark-sized zones preserve known affiliation at garden, park and shore edges.
  let nearby: UnifiedPlace | undefined;
  let closest = Infinity;
  for (const place of UNIFIED_BAY_PLACES) {
    const distance = Math.hypot(x - place.position[0], z - place.position[1]);
    if (distance < Math.max(9, place.arrivalRadius + 2) && distance < closest) { nearby = place; closest = distance; }
  }
  if (nearby) return bayCityForPlace(nearby);
  if (region === 'sf') return byId.get('san-francisco')!;
  let found: BayCity | null = null;
  closest = Infinity;
  for (const candidate of BAY_CITIES) {
    if (candidate.region !== region) continue;
    const distance = Math.hypot(x - candidate.position[0], z - candidate.position[1]);
    // Do not extend a city indefinitely into the surrounding authored countryside.
    if (distance < (candidate.kind === 'area' ? 40 : 62) && distance < closest) { found = candidate; closest = distance; }
  }
  return found;
}

export type BayCityPresence = {
  cityId: string | null;
  candidateId: string | null;
  candidateSince: number | null;
  leftSince: number | null;
  lastNow: number | null;
};
export const createBayCityPresence = (): BayCityPresence => ({ cityId: null, candidateId: null, candidateSince: null, leftSince: null, lastNow: null });

/** Pure, millisecond-clock presence tracking. Overview and teleport never count as entry. */
export function stepBayCityPresence(
  previous: BayCityPresence,
  input: { x: number; z: number; now: number; active?: boolean; teleported?: boolean },
): { state: BayCityPresence; entered: BayCity | null } {
  const { x, z, now } = input;
  if (!Number.isFinite(now) || !Number.isFinite(x) || !Number.isFinite(z) || input.active === false || input.teleported
    || (previous.lastNow !== null && now < previous.lastNow)) {
    return { state: createBayCityPresence(), entered: null };
  }
  const state: BayCityPresence = { ...previous, lastNow: now };
  const current = bayCityAt(x, z);
  if (current?.id === state.cityId) {
    state.candidateId = null; state.candidateSince = null; state.leftSince = null;
    return { state, entered: null };
  }
  if (state.cityId && state.leftSince === null) state.leftSince = now;
  if (state.leftSince !== null && now - state.leftSince >= 1500) state.cityId = null;
  if (!current) {
    state.candidateId = null; state.candidateSince = null;
    return { state, entered: null };
  }
  if (state.candidateId !== current.id) {
    state.candidateId = current.id; state.candidateSince = now;
    return { state, entered: null };
  }
  if (state.candidateSince !== null && now - state.candidateSince >= 1000) {
    state.cityId = current.id; state.candidateId = null; state.candidateSince = null; state.leftSince = null;
    return { state, entered: current };
  }
  return { state, entered: null };
}
