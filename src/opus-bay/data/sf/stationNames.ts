import type { Bilingual } from '../../core/types';

/**
 * Wave 4 · lane T: the stable ids and names of the three new lines and their stations (plan sf-w4-plan.md §3.1–§3.3).
 * Pure data, dependency-free: lane P (map lines, station symbols, the place index), lane C (the Grand Tour legs
 * `transit-<station id>`, narration keyed by stop), lane G (trip legs `board` / `alight`) and lane T's own pipeline
 * (scripts/opus-sf/lib/{busLoop,metro}.ts) all read the ids from here. **Ids never change once pushed** (saves, tours).
 *
 * - Line ids: `sf-loop` (hop-on hop-off bus, clockwise), `n-judah`, `m-ocean-view` (Muni Metro, double-ended).
 * - Station ids: `loop-<name>` for the 16 loop stops, `muni-<name>` for Metro stations (the five Market Street subway
 *   stations are shared by N and M). The prefixes keep them apart from place ids (`twin-peaks`, `castro-theatre` …)
 *   and from the cable-car / F-line station ids (`powell-market` …), so a station can join the place index as is.
 * - Names: English stays primary for Muni stations, as on the real signs; `zh` is what a Chinese player reads (the
 *   station's Chinese name where one is established in our glossary — 内河码头站, 卡斯特罗站 — else "English · gloss"
 *   or the English corner name). The zh line names follow VOICE.md (观光巴士, N 线 / M 线). SFMTA's own Chinese names
 *   differ in places (卡斯楚, 雲尼斯): plan R11, lane C records them in VOICE.md.
 * - `attractions`: attraction ids (data/sf/attractionTypes.ts, lane P's `ATTRACTIONS`) served on foot from the stop,
 *   the main one first, exactly as lane P's `ATTRACTIONS` names them (`alamo-square-painted-ladies`,
 *   `chinatown-dragon-gate` …; the sf-bus test pins that every id exists there).
 *
 * Facts (checked 2026-09-27): Market Street subway Muni Metro service from 18 Feb 1980 (Embarcadero … Castro);
 * Twin Peaks Tunnel opened 3 Feb 1918, 3.65 km, West Portal Ave & Ulloa St to Castro; Sunset Tunnel opened
 * 21 Oct 1928, 1,290 m, N Judah only, east portal at Duboce & Noe (Duboce Park), west portal in Cole Valley near Carl &
 * Cole; the N and J leave the subway at the Duboce portal (Church & Duboce); the M runs Embarcadero ↔ San Jose & Geneva
 * (Balboa Park), Stonestown on Winston Dr and SF State on Holloway Ave (en.wikipedia.org: Market_Street_subway,
 * Twin_Peaks_Tunnel, Sunset_Tunnel, M_Ocean_View, N_Judah).
 */

export const LOOP_LINE_ID = 'sf-loop';
export const N_LINE_ID = 'n-judah';
export const M_LINE_ID = 'm-ocean-view';
export const W4_LINE_IDS = [LOOP_LINE_ID, N_LINE_ID, M_LINE_ID] as const;
export type W4LineId = (typeof W4_LINE_IDS)[number];

export interface W4LineMeta {
  id: W4LineId;
  kind: 'bus' | 'light-rail';
  name: Bilingual;
  /** the short line name the ride banner / subway card lead with (VOICE.md: 观光环线, N 线 / M 线) */
  shortName: Bilingual;
  /** map legend / line card: the whole route in a few words */
  route: Bilingual;
  /** disc / headsign / map letter (1–4 characters) */
  short: string;
  color: string;
  /** a second colour: the loop's cream casing on the map, the LRV belt line */
  casing: string;
  /** OSM route relation (0 for the designed loop) and the source URL published with the line */
  osmRelation: number;
  sourceUrl: string;
}

export const W4_LINES: Readonly<Record<W4LineId, W4LineMeta>> = {
  'sf-loop': {
    id: 'sf-loop', kind: 'bus', name: { zh: '旧金山观光环线', en: 'SF Sightseeing Loop' }, shortName: { zh: '观光环线', en: 'Sightseeing Loop' },
    route: { zh: '观光巴士 · 16 站一圈 · 随上随下', en: 'Hop-on hop-off bus · 16 stops round the city' },
    short: '观光', color: '#e0563f', casing: '#f4e6c8', osmRelation: 0,
    // the loop is designed for the game on the car-legal OSM street graph (no single OSM relation)
    sourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  'n-judah': {
    id: 'n-judah', kind: 'light-rail', name: { zh: 'N 线', en: 'N Judah' }, shortName: { zh: 'N 线', en: 'N Judah' },
    route: { zh: 'N 线 · 市中心 → 海特区 → 金门公园南边 → 海洋海滩', en: 'N Judah · Downtown → Cole Valley → Inner Sunset → Ocean Beach' },
    short: 'N', color: '#2f6fb0', casing: '#e7eef7', osmRelation: 3435877,
    sourceUrl: 'https://www.openstreetmap.org/relation/3435877',
  },
  'm-ocean-view': {
    id: 'm-ocean-view', kind: 'light-rail', name: { zh: 'M 线', en: 'M Ocean View' }, shortName: { zh: 'M 线', en: 'M Ocean View' },
    route: { zh: 'M 线 · 市中心 → 卡斯特罗 → 西门 → 石镇 → 州立大学', en: 'M Ocean View · Downtown → Castro → West Portal → Stonestown → SF State' },
    short: 'M', color: '#2f8f5b', casing: '#e6f2ea', osmRelation: 3433314,
    sourceUrl: 'https://www.openstreetmap.org/relation/3433314',
  },
};

// ---------------------------------------------------------------------------
// The sightseeing loop: 16 stops, clockwise from the Ferry Building (plan §3.2)
// ---------------------------------------------------------------------------

export interface LoopStopDef {
  id: string;
  name: Bilingual;
  /** the street the bus stops on (plan §3.2 measured route) */
  street: string;
  /** OSM kerb point the stop was measured at (city frame), before the hero platforms / pole offsets */
  at: { x: number; z: number };
  /** other lines within a short walk (station ids or line ids) */
  transfers?: string[];
}

export const LOOP_STOPS: readonly LoopStopDef[] = [
  { id: 'loop-ferry-building', name: { zh: '渡轮大厦', en: 'Ferry Building' }, street: 'The Embarcadero', at: { x: 128.2, z: 15.7 }, transfers: ['f-line', 'california', 'muni-embarcadero'] },
  { id: 'loop-pier-39', name: { zh: '39号码头 · 海狮', en: 'PIER 39' }, street: 'The Embarcadero', at: { x: -151.3, z: 21.0 }, transfers: ['f-line'] },
  { id: 'loop-wharf-hyde', name: { zh: '渔人码头 · 海德街', en: "Fisherman's Wharf · Hyde St" }, street: 'Hyde St', at: { x: -223.0, z: 136.3 }, transfers: ['powell-hyde', 'f-line'] },
  { id: 'loop-palace-of-fine-arts', name: { zh: '艺术宫', en: 'Palace of Fine Arts' }, street: 'Baker St', at: { x: -414.4, z: 403.7 } },
  { id: 'loop-golden-gate-bridge', name: { zh: '金门大桥 · 游客中心', en: 'Golden Gate Bridge' }, street: 'Lincoln Blvd', at: { x: -680.7, z: 613.9 } },
  { id: 'loop-legion-of-honor', name: { zh: '荣勋宫', en: 'Legion of Honor' }, street: 'Legion of Honor Dr', at: { x: -658.5, z: 1068.8 } },
  { id: 'loop-lands-end-sutro', name: { zh: '天涯海角 · 苏特罗浴场', en: 'Lands End · Sutro Baths' }, street: 'Point Lobos Ave', at: { x: -697.9, z: 1231.7 } },
  { id: 'loop-ocean-beach-windmill', name: { zh: '海洋海滩 · 荷兰风车', en: 'Ocean Beach · Windmill' }, street: 'Great Highway', at: { x: -585.6, z: 1331.2 }, transfers: ['muni-judah-la-playa'] },
  { id: 'loop-golden-gate-park', name: { zh: '金门公园 · 音乐广场', en: 'Golden Gate Park' }, street: 'Music Concourse Dr', at: { x: -228.0, z: 919.6 }, transfers: ['muni-9th-irving'] },
  { id: 'loop-haight-ashbury', name: { zh: '海特-阿什伯里', en: 'Haight-Ashbury' }, street: 'Ashbury St', at: { x: -40.7, z: 764.0 }, transfers: ['muni-carl-cole'] },
  { id: 'loop-painted-ladies', name: { zh: '彩绘女士 · 阿拉莫广场', en: 'Painted Ladies' }, street: 'Steiner St', at: { x: 5.2, z: 570.4 } },
  { id: 'loop-castro', name: { zh: '卡斯特罗', en: 'The Castro' }, street: 'Castro St', at: { x: 142.5, z: 739.7 }, transfers: ['muni-castro', 'f-line'] },
  { id: 'loop-twin-peaks', name: { zh: '双峰', en: 'Twin Peaks' }, street: 'Twin Peaks Blvd', at: { x: 145.6, z: 956.7 } },
  { id: 'loop-mission-dolores', name: { zh: '多洛雷斯传教站 · 公园', en: 'Mission Dolores' }, street: 'Dolores St', at: { x: 194.2, z: 640.4 }, transfers: ['muni-church'] },
  { id: 'loop-civic-center', name: { zh: '市政厅 · 市政中心', en: 'Civic Center' }, street: 'McAllister St', at: { x: 87.5, z: 400.6 }, transfers: ['muni-civic-center', 'f-line'] },
  { id: 'loop-chinatown', name: { zh: '唐人街龙门 · 联合广场', en: 'Chinatown · Union Square' }, street: 'Bush St', at: { x: 89.7, z: 166.7 }, transfers: ['california', 'powell-hyde', 'powell-mason', 'muni-montgomery'] },
];

// ---------------------------------------------------------------------------
// Muni Metro stations (N Judah, M Ocean View) keyed by OSM stop name
// ---------------------------------------------------------------------------

export interface MetroStationDef {
  id: string;
  name: Bilingual;
  /** OSM stop-position names (route relation members) that map onto this station */
  osm: string[];
  /** underground station, boarded at its street kiosk */
  underground?: boolean;
  /** trains always dwell here (subway stations, transfers, ★ attraction stops, termini); else a request stop */
  major?: boolean;
  /** the place gloss shown after the English name on the map and the overlay ('海特区') */
  gloss?: string;
}

const st = (id: string, en: string, zh: string, osm: string[], extra: Partial<MetroStationDef> = {}): MetroStationDef => ({ id, name: { zh, en }, osm, ...extra });

export const METRO_STATIONS: readonly MetroStationDef[] = [
  // Market Street subway (N + M), then the M through the Twin Peaks Tunnel
  st('muni-embarcadero', 'Embarcadero', '内河码头站', ['Embarcadero'], { underground: true, major: true }),
  st('muni-montgomery', 'Montgomery', '蒙哥马利站', ['Montgomery Street'], { underground: true, major: true }),
  st('muni-powell', 'Powell', '鲍威尔站', ['Powell Street'], { underground: true, major: true }),
  st('muni-civic-center', 'Civic Center', '市政中心站', ['Civic Center'], { underground: true, major: true }),
  st('muni-van-ness', 'Van Ness', 'Van Ness 站', ['Van Ness'], { underground: true, major: true }),
  st('muni-church', 'Church', '教堂街站', ['Church'], { underground: true, major: true }),
  st('muni-castro', 'Castro', '卡斯特罗站', ['Castro'], { underground: true, major: true }),
  st('muni-forest-hill', 'Forest Hill', '森林山站', ['Forest Hill'], { underground: true, major: true }),
  // M surface: West Portal → St Francis Circle → 19th Ave → Balboa Park
  st('muni-west-portal', 'West Portal', '西门站', ['West Portal'], { major: true }),
  st('muni-west-portal-14th', 'West Portal & 14th Ave', 'West Portal & 14th Ave', ['West Portal Avenue & 14th Avenue']),
  st('muni-st-francis-circle', 'St Francis Circle', '圣弗朗西斯圆环', ['Saint Francis Circle'], { major: true }),
  st('muni-ocean-ave', 'Ocean Ave', 'Ocean Ave · 斯特恩林', ['Right of Way & Ocean Avenue'], { gloss: '斯特恩林' }),
  st('muni-eucalyptus', 'Eucalyptus Dr', 'Eucalyptus Dr', ['Right of Way & Eucalyptus Drive']),
  st('muni-19th-winston', '19th Ave & Winston', '19th & Winston · 石镇', ['19th Avenue & Winston Drive'], { major: true, gloss: '石镇' }),
  st('muni-19th-holloway', '19th Ave & Holloway', '19th & Holloway · 州立大学', ['19th Avenue & Holloway Avenue'], { major: true, gloss: '州立大学' }),
  st('muni-19th-n-randolph', '19th Ave & N Randolph', '19th Ave & N Randolph', ['19th Avenue & North Randolph Street']),
  st('muni-19th-randolph', '19th Ave & Randolph', '19th Ave & Randolph', ['19th Avenue & Randolph Street']),
  st('muni-randolph-arch', 'Randolph & Arch', 'Randolph & Arch', ['Randolph Street & Arch Street']),
  st('muni-randolph-bright', 'Randolph & Bright', 'Randolph & Bright', ['Randolph Street & Bright Street']),
  st('muni-broad-orizaba', 'Broad & Orizaba', 'Broad & Orizaba', ['Orizaba Avenue & Broad Street']),
  st('muni-broad-capitol', 'Broad & Capitol', 'Broad & Capitol', ['Broad Street & Capitol Avenue']),
  st('muni-broad-plymouth', 'Broad & Plymouth', 'Broad & Plymouth', ['Broad Street & Plymouth Avenue']),
  st('muni-san-jose-farallones', 'San Jose & Farallones', 'San Jose & Farallones', ['San Jose Avenue & Farallones Street']),
  st('muni-san-jose-lakeview', 'San Jose & Lakeview', 'San Jose & Lakeview', ['San Jose Avenue & Lakeview Avenue']),
  st('muni-san-jose-mt-vernon', 'San Jose & Mt Vernon', 'San Jose & Mt Vernon', ['San Jose Avenue & Mount Vernon Avenue']),
  st('muni-san-jose-niagara', 'San Jose & Niagara', 'San Jose & Niagara', ['San Jose Avenue & Niagara Avenue']),
  st('muni-san-jose-geneva', 'San Jose & Geneva · Balboa Park', 'Balboa Park · 城市学院', ['San Jose Avenue & Geneva Avenue'], { major: true, gloss: '城市学院' }),
  // N surface: Duboce portal → Sunset Tunnel → Carl St → Irving St → 9th Ave → Judah St → Ocean Beach
  st('muni-duboce-church', 'Duboce & Church', 'Duboce & Church · 杜博斯', ['Duboce Avenue & Church Street'], { major: true, gloss: '杜博斯' }),
  st('muni-duboce-park', 'Duboce Park', 'Duboce Park · 日落隧道东口', ['Sunset Tunnel East Portal'], { gloss: '日落隧道东口' }),
  st('muni-carl-cole', 'Carl & Cole', 'Carl & Cole · 海特区', ['Carl Street & Cole Street'], { major: true, gloss: '海特区' }),
  st('muni-carl-stanyan', 'Carl & Stanyan', 'Carl & Stanyan · 金门公园东', ['Carl Street & Stanyan Street'], { gloss: '金门公园东' }),
  st('muni-carl-hillway', 'Carl & Hillway', 'Carl & Hillway · UCSF', ['Carl Street & Hillway Avenue'], { major: true, gloss: 'UCSF' }),
  st('muni-irving-2nd', 'Irving & 2nd Ave', 'Irving & 2nd · UCSF 帕纳萨斯', ['Irving Street & 2nd Avenue'], { major: true, gloss: 'UCSF 帕纳萨斯' }),
  st('muni-irving-6th', 'Irving & 6th Ave', 'Irving & 6th Ave', ['Irving Street & 6th Avenue']),
  st('muni-9th-irving', '9th Ave & Irving', '9th Ave & Irving · 金门公园', ['9th Avenue & Irving Street'], { major: true, gloss: '金门公园' }),
  st('muni-judah-9th', 'Judah & 9th Ave', 'Judah & 9th Ave', ['Judah Street & 9th Avenue']),
  st('muni-judah-12th', 'Judah & 12th Ave', 'Judah & 12th Ave', ['Judah Street & 12th Avenue']),
  st('muni-judah-funston', 'Judah & Funston', 'Judah & Funston', ['Judah Street & Funston Avenue']),
  st('muni-judah-16th', 'Judah & 16th Ave', 'Judah & 16th Ave · 阶梯花园', ['Judah Street & 16th Avenue'], { gloss: '阶梯花园' }),
  st('muni-judah-19th', 'Judah & 19th Ave', 'Judah & 19th Ave', ['Judah Street & 19th Avenue'], { major: true }),
  st('muni-judah-23rd', 'Judah & 23rd Ave', 'Judah & 23rd Ave · 尔文街', ['Judah Street & 23rd Avenue'], { gloss: '尔文街' }),
  st('muni-judah-25th', 'Judah & 25th Ave', 'Judah & 25th Ave', ['Judah Street & 25th Avenue']),
  st('muni-judah-28th', 'Judah & 28th Ave', 'Judah & 28th Ave', ['Judah Street & 28th Avenue']),
  st('muni-judah-31st', 'Judah & 31st Ave', 'Judah & 31st Ave', ['Judah Street & 31st Avenue']),
  st('muni-judah-34th', 'Judah & 34th Ave', 'Judah & 34th Ave', ['Judah Street & 34th Avenue']),
  st('muni-judah-sunset', 'Judah & Sunset Blvd', 'Judah & Sunset · 日落大道', ['Judah Street & Sunset Boulevard'], { major: true, gloss: '日落大道' }),
  st('muni-judah-40th', 'Judah & 40th Ave', 'Judah & 40th Ave', ['Judah Street & 40th Avenue']),
  st('muni-judah-43rd', 'Judah & 43rd Ave', 'Judah & 43rd Ave', ['Judah Street & 43rd Avenue']),
  st('muni-judah-46th', 'Judah & 46th Ave', 'Judah & 46th Ave', ['Judah Street & 46th Avenue']),
  st('muni-judah-la-playa', 'Judah & La Playa · Ocean Beach', '海洋海滩 · Judah & La Playa', ['Judah Street & La Playa Street'], { major: true, gloss: '海洋海滩' }),
];

const METRO_BY_OSM = new Map<string, MetroStationDef>();
for (const s of METRO_STATIONS) for (const n of s.osm) METRO_BY_OSM.set(n, s);

/** The Metro station an OSM stop-position name maps onto (null = unknown: the pipeline fails loudly). */
export function metroStationForOsm(name: string): MetroStationDef | null { return METRO_BY_OSM.get(name) ?? null; }

// ---------------------------------------------------------------------------
// Attractions served on foot (attraction ids, main first)
// ---------------------------------------------------------------------------

export const STOP_ATTRACTIONS: Readonly<Record<string, readonly string[]>> = {
  // loop (plan §3.2 "serves")
  'loop-ferry-building': ['ferry-building-marketplace', 'salesforce-park', 'salesforce-tower'],
  'loop-pier-39': ['pier-39', 'aquarium-of-the-bay'],
  'loop-wharf-hyde': ['ghirardelli-square', 'maritime-museum-bathhouse', 'musee-mecanique', 'uss-pampanito', 'lombard-crooked'],
  'loop-palace-of-fine-arts': ['palace-of-fine-arts', 'wave-organ', 'lyon-street-steps'],
  'loop-golden-gate-bridge': ['golden-gate-bridge', 'fort-point'],
  'loop-legion-of-honor': ['legion-of-honor'],
  'loop-lands-end-sutro': ['lands-end', 'sutro-baths', 'cliff-house', 'sutro-heights-park'],
  'loop-ocean-beach-windmill': ['dutch-windmill', 'beach-chalet', 'murphy-windmill', 'ocean-beach'],
  'loop-golden-gate-park': ['de-young-tower', 'cal-academy', 'japanese-tea-garden', 'sf-botanical-garden', 'blue-heron-lake'],
  'loop-haight-ashbury': ['haight-ashbury', 'buena-vista-park', 'hippie-hill'],
  'loop-painted-ladies': ['alamo-square-painted-ladies'],
  'loop-castro': ['castro-theatre', 'harvey-milk-plaza', 'corona-heights-randall-museum'],
  'loop-twin-peaks': ['twin-peaks', 'sutro-tower'],
  'loop-mission-dolores': ['mission-dolores', 'dolores-park', 'clarion-alley', 'womens-building'],
  'loop-civic-center': ['city-hall', 'asian-art-museum', 'war-memorial-opera-house', 'uc-law-sf'],
  'loop-chinatown': ['chinatown-dragon-gate', 'union-square', 'maiden-lane', 'old-st-marys-cathedral'],
  // Metro
  'muni-embarcadero': ['ferry-building-marketplace', 'salesforce-tower'],
  'muni-montgomery': ['sfmoma', 'yerba-buena-gardens', 'palace-hotel', 'moad'],
  'muni-powell': ['union-square', 'cable-car-powell-market'],
  'muni-civic-center': ['city-hall', 'asian-art-museum', 'uc-law-sf'],
  'muni-van-ness': ['sf-conservatory-of-music', 'sfjazz-center', 'war-memorial-opera-house'],
  'muni-church': ['mission-dolores', 'dolores-park'],
  'muni-castro': ['castro-theatre', 'harvey-milk-plaza', 'corona-heights-randall-museum'],
  'muni-west-portal': ['west-portal'],
  'muni-ocean-ave': ['stern-grove'],
  'muni-19th-winston': ['stonestown-galleria'],
  'muni-19th-holloway': ['sf-state-university', 'lake-merced'],
  'muni-san-jose-geneva': ['ccsf-ocean-campus'],
  'muni-duboce-church': ['alamo-square-painted-ladies'],
  'muni-carl-cole': ['haight-ashbury'],
  'muni-carl-stanyan': ['kezar-stadium', 'koret-carousel'],
  'muni-carl-hillway': ['ucsf-parnassus', 'kezar-stadium', 'koret-carousel'],
  'muni-irving-2nd': ['ucsf-parnassus'],
  'muni-9th-irving': ['sf-botanical-garden', 'cal-academy', 'japanese-tea-garden', 'irving-street'],
  'muni-judah-16th': ['hidden-garden-steps', 'tiled-steps-16th-avenue', 'grand-view-park'],
  'muni-judah-23rd': ['irving-street'],
  'muni-judah-la-playa': ['ocean-beach', 'murphy-windmill', 'sunset-dunes'],
};

// ---------------------------------------------------------------------------
// Tunnels and portals (no tunnel geometry is built: the subway overlay covers the underground spans)
// ---------------------------------------------------------------------------

export interface TunnelInfo { name: Bilingual; fact: Bilingual; sourceUrl: string }
export const TUNNELS: Readonly<Record<string, TunnelInfo>> = {
  'market-street-subway': {
    name: { zh: '市场街地铁', en: 'Market Street Subway' },
    fact: { zh: '1980 年起，Muni 地铁在市场街地下行驶', en: 'Muni Metro has run under Market Street since 1980' },
    sourceUrl: 'https://en.wikipedia.org/wiki/Market_Street_subway',
  },
  'twin-peaks-tunnel': {
    name: { zh: '双峰隧道', en: 'Twin Peaks Tunnel' },
    fact: { zh: '1918 年通车，长约 3.65 公里，从卡斯特罗一直钻到西门', en: 'Opened in 1918, 3.65 km from the Castro to West Portal' },
    sourceUrl: 'https://en.wikipedia.org/wiki/Twin_Peaks_Tunnel',
  },
  'sunset-tunnel': {
    name: { zh: '日落隧道', en: 'Sunset Tunnel' },
    fact: { zh: '1928 年通车，长 1290 米，只有 N 线从这里过', en: 'Opened in 1928, 1,290 m long, used only by the N Judah' },
    sourceUrl: 'https://en.wikipedia.org/wiki/Sunset_Tunnel',
  },
};

export const PORTAL_IDS = ['duboce', 'sunset-east', 'sunset-west', 'west-portal'] as const;
export type PortalId = (typeof PORTAL_IDS)[number];
export const PORTAL_NAMES: Readonly<Record<PortalId, Bilingual>> = {
  duboce: { zh: '杜博斯隧道口', en: 'Duboce portal' },
  'sunset-east': { zh: '日落隧道东口', en: 'Sunset Tunnel east portal' },
  'sunset-west': { zh: '日落隧道西口', en: 'Sunset Tunnel west portal' },
  'west-portal': { zh: '西门隧道口', en: 'West Portal' },
};

/** The portal id of a published TransitPortal (by its English name), or null. */
export function portalIdOf(p: { name?: Bilingual } | null | undefined): PortalId | null {
  const en = p?.name?.en;
  if (!en) return null;
  for (const id of PORTAL_IDS) if (PORTAL_NAMES[id].en === en) return id;
  return null;
}

/**
 * The visible mouth (the portal hood, world/sf/portals.ts) stands this far outward of the OSM tunnel end (u): the Duboce
 * hood sits in the Duboce Ave median, clear of Market St; the track already dives from there (scripts/opus-sf/lib/metro.ts
 * uses the same numbers). Pure data here so the pure light-rail sim knows where the hood really begins.
 */
export const PORTAL_HOOD_SHIFT: Readonly<Record<PortalId, number>> = { duboce: 8, 'sunset-east': 0, 'sunset-west': 0, 'west-portal': 0 };

// ---------------------------------------------------------------------------
// Short station names (the ride banner, the subway card): the full names carry a " · gloss" that reads badly inside
// a "开往 … · 下一站 …" line on a phone
// ---------------------------------------------------------------------------

/** Where the short form is not simply the name's first " · " part (the headsign / the attraction's own short name). */
const SHORT_NAMES: Readonly<Record<string, Bilingual>> = {
  'muni-19th-winston': { zh: '石镇', en: 'Stonestown' },
  'muni-19th-holloway': { zh: '州立大学', en: 'SF State' },
  'muni-judah-la-playa': { zh: '海洋海滩', en: 'Ocean Beach' },
  'muni-san-jose-geneva': { zh: 'Balboa Park', en: 'Balboa Park' },
};

/** A wave-4 station's short name: "渔人码头" for "渔人码头 · 海德街", "石镇" for "19th & Winston · 石镇" (null: unknown id). */
export function w4StationShort(id: string): Bilingual | null {
  const full = w4StationName(id);
  if (!full) return null;
  const first = (s: string) => s.split(' · ')[0];
  return SHORT_NAMES[id] ?? { zh: first(full.zh), en: first(full.en) };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const ALL = new Map<string, { name: Bilingual; lines: W4LineId[] }>();
for (const s of LOOP_STOPS) ALL.set(s.id, { name: s.name, lines: ['sf-loop'] });
for (const s of METRO_STATIONS) ALL.set(s.id, { name: s.name, lines: [] });

/** Every wave-4 station id (loop stops + Metro stations), stable. */
export const W4_STATION_IDS: readonly string[] = [...ALL.keys()];

/** Display name of a wave-4 station (null for an unknown id). */
export function w4StationName(id: string): Bilingual | null { return ALL.get(id)?.name ?? null; }

/** Attraction ids served on foot from a station (empty when none). */
export function stationAttractions(id: string): readonly string[] { return STOP_ATTRACTIONS[id] ?? []; }

/** The Metro station definition by id. */
export function metroStation(id: string): MetroStationDef | null { return METRO_STATIONS.find(s => s.id === id) ?? null; }
