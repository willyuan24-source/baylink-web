import type { Bilingual, PoiDef, RealInfo } from '../../core/types';
import type { SfPlaceKind } from '../../world/sf/format';
import { LANDMARK_ARRIVALS } from './arrivals';
import { CITY_PHOTOS } from './cityPhotos';
import { SF_LANDMARK_INFO, type SfLandmarkInfo } from './landmarks';

/**
 * W8-P2 (lane P; sf-w8-lead.md §3 row P: GameRoot ≤ 255 KB gzip) · the city landmark cards' tables, moved verbatim out of
 * `data/sf/cityPois.ts` into the city's data chunk (`data/sf/cityDataChunk.ts` re-exports this module as
 * `CITY_POI_TABLES`): the 24 landmark PoiDefs, the zh glossaries, the zones / official sites / sources / photo pages /
 * subject facts and the place-kind names. District mode never reads any of them (data/pois.ts `byMode`; place cards are
 * city places), so it never downloads them. `data/sf/cityPois.ts` keeps every export name and hands these out from
 * `CITY_DATA` (city mode and node: the same values as before; district: empty tables, identity glossaries).
 *
 * **The data chunk's rule** (tests/opus-bay-sf-budget.test.ts "W5-V3"): nothing here may import a module of GameRoot's
 * static graph — so the small helpers the tables need (`cityPoiId`, the prefix, the guide fallback) are copies of
 * `data/sf/cityPois.ts`'s (tests/opus-bay-sf-budget.test.ts "W8-P2" checks they agree).
 */

const CITY_POI_PREFIX = 'sf:';
export const cityPoiId = (landmarkId: string) => `${CITY_POI_PREFIX}${landmarkId}`;
export const SF_GUIDE_SLUG = 'san-francisco-guide';
const MONTHS = /(january|february|march|april|may|june|july|august|september|october|november|december)/i;
export const isMonthTagged = (slug: string) => MONTHS.test(slug) || /-20\d\d(-|$)/.test(slug);

/** zh glossary: the words the city's HUD labels (far.zones) and dialogue use, applied to every city card string. */
export const ZH_GLOSSARY: readonly (readonly [from: string, to: string])[] = [
  ['双子峰', '双峰'],
  ['码头区 Marina', '马里纳区'],
  ['码头区', '马里纳区'],
  ['缆车', '叮当车'],
  ['卡斯楚区', '卡斯特罗'],
  ['卡斯楚', '卡斯特罗'],
  ['Presidio', '要塞公园'],
  // wave-4 verify C2: OSM zh names on place cards (the map's own names are lane P's PLACE_NAME_FIXES)
  ['中国城', '唐人街'],
  ['西索玛', '西南市场'],
  ['索玛区', '南市场'],
  ['普雷西迪奥高地', '要塞高地'],
];
export function glossZh(text: string): string {
  let out = text;
  for (const [from, to] of ZH_GLOSSARY) out = out.split(from).join(to);
  return out;
}
const gloss = (b: Bilingual): Bilingual => ({ zh: glossZh(b.zh), en: b.en });

/**
 * English place names inside the landmark cards' zh sentences where the game already has a zh name (wave-4 verify C7:
 * "沿 Grant Avenue 一路走到 North Beach 的 Washington Square"; C6: the zone labels say 天涯海角 like the attractions,
 * the stations and the recorded tour lines). Card text only (summary, tips, bark, hours, cost, zone), never a name;
 * the space an English word kept from its Chinese neighbours goes with it. Longer phrases first.
 */
export const ZH_TEXT_NAMES: readonly (readonly [from: string, to: string])[] = [
  ['天涯海角 Lands End', '天涯海角'],
  ['海角 Lands End', '天涯海角'],
  ['林肯公园 · 海角', '林肯公园 · 天涯海角'],
  ['Lands End', '天涯海角'],
  ['Twin Peaks Boulevard', '双峰大道'],
  ['Twin Peaks', '双峰'],
  ['Grant Avenue', '都板街'],
  ['North Beach', '北滩'],
  ['Washington Square', '华盛顿广场'],
  ['Ocean Beach', '海洋海滩'],
  ['Dolores Park', '多洛雷斯公园'],
  ['Sutro Baths', '苏特罗浴场'],
  ['Marina Green', '码头绿地'],
  ['Crissy Field', '克里西场'],
  ['Alamo Square', '阿拉莫广场'],
  ['Queen Wilhelmina 郁金香花园', '威廉明娜女王郁金香花园'],
  ['Ferry Building', '渡轮大厦'],
  ['Aquatic Park', '水上公园'],
  ['Music Concourse', '音乐广场'],
];
const CJK = '[⺀-鿿　-〿＀-￯]';
const CJK_GAP = new RegExp(`(${CJK}) +(?=${CJK})`, 'g');
/** A zh card sentence with the game's zh names for the places it mentions (ZH_TEXT_NAMES), after the glossary. */
export function glossZhText(text: string): string {
  let out = glossZh(text);
  let hit = false;
  for (const [from, to] of ZH_TEXT_NAMES) {
    if (!out.includes(from)) continue;
    hit = true;
    out = out.split(from).join(to).split(`${to} ${to}`).join(to).split(`${to}${to}`).join(to);
  }
  return hit ? out.replace(CJK_GAP, '$1') : out;
}
const glossText = (b: Bilingual): Bilingual => ({ zh: glossZhText(b.zh), en: b.en });

/** Planner places D2 attached that name a neighbouring spot rather than the landmark itself. */
const PLANNER_DROP = new Set(['ghirardelli-square']);

type Photo = NonNullable<RealInfo['photo']>;

function cityPoi(info: SfLandmarkInfo): PoiDef {
  const at = LANDMARK_ARRIVALS[info.id] ?? { x: 0, z: 0 }; // (W6-P3: with the city data chunk)
  const photo: Photo | undefined = CITY_PHOTOS[info.id];
  const guideSlug = info.guideSlug && isMonthTagged(info.guideSlug) ? SF_GUIDE_SLUG : info.guideSlug;
  const real = info.realInfo;
  return {
    id: cityPoiId(info.id),
    name: gloss(info.name),
    position: { x: at.x, z: at.z },
    radius: 4,
    ...(info.plannerPlaceId && !PLANNER_DROP.has(info.id) ? { plannerPlaceId: info.plannerPlaceId } : {}),
    ...(guideSlug ? { guideSlug } : {}),
    interaction: { kind: 'info', verb: { zh: '看看这里的介绍卡', en: 'Read about this place' } },
    bark: glossText(info.bark),
    realInfo: {
      ...real,
      summary: glossText(real.summary),
      tips: real.tips.map(glossText),
      ...(real.hours ? { hours: glossText(real.hours) } : {}),
      ...(real.cost ? { cost: glossText(real.cost) } : {}),
      ...(photo ? { photo: { src: photo.src, credit: photo.credit, license: photo.license, licenseUrl: photo.licenseUrl } } : {}),
    },
  };
}

/** The 24 landmark cards, in the registry's order. */
export const CITY_POIS: PoiDef[] = SF_LANDMARK_INFO.map(cityPoi);

/** The landmark's zone label, glossed (for the card eyebrow and "附近有什么"). */
export const CITY_POI_ZONES: Record<string, Bilingual> = Object.fromEntries(SF_LANDMARK_INFO.map(info => [cityPoiId(info.id), glossText(info.zone)]));
/** Official sites (PoiCard's 官网 button), only where D2 recorded a real official site. */
export const CITY_POI_OFFICIAL_URLS: Record<string, string> = Object.fromEntries(SF_LANDMARK_INFO.flatMap(info => (info.officialUrl ? [[cityPoiId(info.id), info.officialUrl]] : [])));
/** Secondary fact sources (PoiCard's 更多来源). */
export const CITY_POI_EXTRA_SOURCES: Record<string, string[]> = Object.fromEntries(SF_LANDMARK_INFO.filter(info => info.sources.length).map(info => [cityPoiId(info.id), [...info.sources]]));
/** Photo file pages keyed by photo src (PoiCard's credit link). */
export const CITY_PHOTO_SOURCE_PAGES: Record<string, string> = Object.fromEntries(Object.values(CITY_PHOTOS).map(photo => [photo.src, photo.page]));
/** Telescope / photo captions for the landmarks (content.subjectFact), keyed by landmark id. */
export const CITY_SUBJECT_FACTS: Record<string, { name: Bilingual; fact: Bilingual; sourceUrl: string; verifiedAt: string }> = Object.fromEntries(
  SF_LANDMARK_INFO.map(info => [info.id, { name: gloss(info.name), fact: glossText(info.bark), sourceUrl: info.realInfo.sourceUrl, verifiedAt: info.realInfo.verifiedAt }]),
);

/** What a place is, for its card (world/sf/format SfPlaceKind). */
export const PLACE_KIND_NAMES: Record<SfPlaceKind, Bilingual> = {
  landmark: { zh: '地标', en: 'Landmark' }, bridge: { zh: '桥', en: 'Bridge' }, island: { zh: '岛', en: 'Island' },
  skyscraper: { zh: '高楼', en: 'Skyscraper' }, park: { zh: '公园', en: 'Park' }, museum: { zh: '博物馆', en: 'Museum' },
  waterfront: { zh: '海滨', en: 'Waterfront' }, transit: { zh: '交通站点', en: 'Transit stop' }, street: { zh: '街道', en: 'Street' },
  plaza: { zh: '广场', en: 'Plaza' }, civic: { zh: '公共建筑', en: 'Civic building' }, stadium: { zh: '球场', en: 'Stadium' },
  historic: { zh: '历史古迹', en: 'Historic site' }, neighbourhood: { zh: '街区', en: 'Neighbourhood' }, garden: { zh: '花园', en: 'Garden' },
  beach: { zh: '海滩', en: 'Beach' }, trail: { zh: '步道', en: 'Trail' }, hill: { zh: '山丘', en: 'Hill' }, tower: { zh: '塔', en: 'Tower' },
  water: { zh: '水域', en: 'Water' }, attraction: { zh: '景点', en: 'Attraction' }, viewpoint: { zh: '观景点', en: 'Viewpoint' },
  peak: { zh: '山顶', en: 'Peak' },
  // wave 4 (lead note §6 item 2: SfPlaceKind absorbed SF_PLACE_KINDS_W4 in the same commit)
  campus: { zh: '校园', en: 'Campus' }, shopping: { zh: '购物中心', en: 'Shopping centre' }, zoo: { zh: '动物园', en: 'Zoo' },
  religious: { zh: '宗教场所', en: 'Place of worship' },
};

/** A place's name for the card title: the glossary on zh (OSM zh names are sometimes the English name). */
export const placeCardName = (name: Bilingual): Bilingual => gloss(name);

// W8-P7: the district POIs in the city's words (moved verbatim from data/sf/cityPois.ts)

/**
 * Wave 5 (lane C, mid-wave checkpoint CP-14): the district's waterfront POIs join the city (data/pois.ts), where their
 * zh names used to show as the district wrote them — the E prompt read 看看壁画 · Coit Tower 壁画, the clue
 * 明信片线索 · Coit Tower 壁画附近. In the city they say what the city says (data/VOICE.md: 科伊特塔 · 菲尔伯特台阶 ·
 * 探索馆 · 39 号码头 · 恶魔岛渡轮码头 · 14 号码头); en and the district itself are unchanged. Only the zh.
 */
export const CITY_DISTRICT_POI_NAMES: Readonly<Record<string, string>> = {
  'farmers-market': '渡轮大厦农夫市集',
  pier14: '14 号码头',
  pier7: '7 号钓鱼码头',
  exploratorium: '探索馆',
  'levis-plaza': '李维斯广场',
  'filbert-steps': '菲尔伯特台阶',
  'coit-tower': '科伊特塔观景点',
  'coit-murals': '科伊特塔壁画',
  pier33: '恶魔岛渡轮码头',
  'pier39-carousel': '39 号码头旋转木马',
  'sea-lions': '39 号码头海狮观景处',
  'streetcar-pier39': 'F 线 · 39 号码头站',
};
/** English place names inside the district POIs' zh card text, as the city says them. */
export const CITY_DISTRICT_TEXT_NAMES: readonly (readonly [from: string, to: string])[] = [
  ['Coit Tower', '科伊特塔'],
  ['Filbert Steps', '菲尔伯特台阶'],
  ['Exploratorium', '探索馆'],
  ['Pier 33', '33 号码头'],
  ['PIER 39', '39 号码头'],
  ['Embarcadero', '内河码头'],
];
/** A district POI's zh sentence with the city's names (CITY_DISTRICT_TEXT_NAMES); the space an English word kept goes. */
export function cityDistrictZh(text: string): string {
  let out = text, hit = false;
  for (const [from, to] of CITY_DISTRICT_TEXT_NAMES) if (out.includes(from)) { hit = true; out = out.split(from).join(to); }
  return hit ? out.replace(CJK_GAP, '$1') : out;
}
const cityDistrictText = (b: Bilingual): Bilingual => ({ zh: cityDistrictZh(b.zh), en: b.en });

/** A district POI as the city shows it (its zh name and card text in the city's words); district mode never calls it. */
export function cityDistrictPoi(poi: PoiDef): PoiDef {
  const name = CITY_DISTRICT_POI_NAMES[poi.id];
  const real = poi.realInfo;
  return {
    ...poi,
    name: name ? { zh: name, en: poi.name.en } : poi.name,
    interaction: { ...poi.interaction, verb: cityDistrictText(poi.interaction.verb) },
    ...(poi.bark ? { bark: cityDistrictText(poi.bark) } : {}),
    ...(real ? {
      realInfo: {
        ...real,
        summary: cityDistrictText(real.summary),
        tips: real.tips.map(cityDistrictText),
        ...(real.hours ? { hours: cityDistrictText(real.hours) } : {}),
        ...(real.cost ? { cost: cityDistrictText(real.cost) } : {}),
      },
    } : {}),
  };
}
