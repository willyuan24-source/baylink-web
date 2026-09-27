// Shared contracts for Opus Bay. Changing a type here is an integration decision: keep it stable.

export type Vec2 = { x: number; z: number };
/** zh = Simplified Chinese (zh-Hant is derived automatically), en = English. */
export type Bilingual = { zh: string; en: string };
/** Counter-clockwise list of points in world units (x east, z south). */
export type Polygon = Vec2[];

// ---------------------------------------------------------------------------
// District layout (data/district.ts)
// ---------------------------------------------------------------------------

/** 'road' = city roadway (bikes/cars welcome, walkable); only the streamed city produces it */
export type SurfaceKind = 'pavement' | 'wood' | 'grass' | 'sand' | 'plaza' | 'stairs' | 'dirt' | 'road';

export interface Projection {
  originLat: number;
  originLng: number;
  /** world units per real meter along the waterfront (compressed map) */
  unitsPerMeter: number;
  /** clockwise rotation applied after projection, degrees */
  rotationDeg: number;
}

export interface WalkArea {
  id: string;
  polygon: Polygon;
  surface: SurfaceKind;
  /** constant deck height (piers) — omit to use terrain height */
  height?: number;
}

export interface Ramp {
  /** stairs/slopes connecting heights, e.g. Filbert Steps. Walkable corridor. */
  id: string;
  points: Vec2[];
  width: number;
  /** height at each point (same length as points) */
  heights: number[];
  surface: SurfaceKind;
}

export interface HillDef {
  id: string;
  center: Vec2;
  /** horizontal radii of the (elliptical) hill */
  radiusX: number;
  radiusZ: number;
  height: number;
}

export interface PierDef {
  id: string;
  /** painted label like "PIER 7" */
  label: string;
  deck: Polygon;
  deckHeight: number;
  /** shed building on the pier (non walkable) */
  shed?: { footprint: Polygon; height: number; facade?: { x: number; z: number; rotationY: number; width: number } };
  walkable: boolean;
}

export interface RoadDef {
  id: string;
  kind: 'roadway' | 'track' | 'path' | 'crosswalk';
  points: Vec2[];
  width: number;
}

export type BuildingStyle = 'victorian' | 'warehouse' | 'office' | 'tower' | 'shop' | 'residential' | 'deco';

export interface BuildingLot {
  id: string;
  footprint: Polygon;
  height: number;
  style: BuildingStyle;
  /** hex color override; otherwise world picks from palette by style */
  color?: string;
  roof?: 'flat' | 'gable' | 'hip';
  /** base elevation (e.g. houses on Telegraph Hill); omit = terrain height at centroid */
  baseY?: number;
}

export type LandmarkKind =
  | 'ferry-building'
  | 'pier14'
  | 'pier7'
  | 'exploratorium'
  | 'levis-plaza'
  | 'filbert-steps'
  | 'coit-tower'
  | 'pier33'
  | 'cruise-terminal'
  | 'pier39'
  | 'pier39-carousel'
  | 'sea-lion-docks'
  | 'weekly-board'
  | 'farmers-market'
  | 'transamerica'
  | 'salesforce-tower'
  | 'streetcar-stop'
  | 'telescope';

export interface LandmarkDef {
  id: string;
  kind: LandmarkKind;
  position: Vec2;
  rotationY: number;
  scale: number;
  /** base elevation; omit = terrain height */
  baseY?: number;
  /** blocking footprint for collision (omit = not blocking) */
  collider?: { polygon: Polygon } | { radius: number };
}

export type PropKind =
  | 'palm' | 'lamp' | 'bench' | 'bollard' | 'planter' | 'stall' | 'kiosk' | 'bin' | 'bike-rack'
  | 'flag' | 'buoy' | 'boat-small' | 'mailbox' | 'board' | 'telescope' | 'tree' | 'bush'
  | 'cone' | 'crate' | 'bell' | 'fishing-rod' | 'umbrella-table' | 'sign';

export interface PropDef {
  kind: PropKind;
  x: number;
  z: number;
  rotationY?: number;
  scale?: number;
  /** props flagged pushable react to bumps (cones, crates, buoys) */
  pushable?: boolean;
  /** blocking radius (palms, lamps, bins) */
  blockRadius?: number;
}

export type BackdropKind = 'bay-bridge' | 'yerba-buena' | 'alcatraz' | 'angel-island' | 'east-bay-hills' | 'marin-hills' | 'skyline';

export interface BackdropDef {
  kind: BackdropKind;
  position: Vec2;
  rotationY: number;
  scale: number;
}

export interface StreetcarDef {
  /** polyline along The Embarcadero tracks */
  path: Vec2[];
  stops: { id: string; name: Bilingual; at: number /* 0..1 along path */ }[];
}

export interface District {
  id: string;
  name: Bilingual;
  projection: Projection;
  /** diorama slab extent (everything outside is the cream "table") */
  slab: Polygon;
  /** water surface level (y) */
  waterLevel: number;
  walk: WalkArea[];
  ramps: Ramp[];
  hills: HillDef[];
  piers: PierDef[];
  roads: RoadDef[];
  blocks: BuildingLot[];
  landmarks: LandmarkDef[];
  props: PropDef[];
  backdrop: BackdropDef[];
  streetcar: StreetcarDef;
  spawn: { x: number; z: number; heading: number };
  ferryDock: Vec2;
  /** named spots used by content (tour stops, board, etc.) — see ANCHOR_NAMES in DESIGN.md §11 */
  anchors: Record<string, Vec2>;
  /** named areas for the top-left place label */
  zones: { id: string; name: Bilingual; polygon: Polygon }[];
}

// ---------------------------------------------------------------------------
// Content (data/pois.ts, data/postcards.ts, data/script.ts, data/tours.ts)
// ---------------------------------------------------------------------------

export type LinkKind = 'baylink-guide' | 'baylink-event' | 'baylink-plan' | 'baylink-page' | 'official' | 'map';

export interface RealLink {
  kind: LinkKind;
  label: Bilingual;
  href: string;
}

export interface RealInfo {
  summary: Bilingual;
  tips: Bilingual[];
  hours?: Bilingual;
  cost?: Bilingual;
  /** where the facts come from */
  sourceUrl: string;
  /** YYYY-MM-DD */
  verifiedAt: string;
  lat: number;
  lng: number;
  /** optional existing public photo path in the site (read-only reuse) with attribution */
  photo?: { src: string; credit: string; license?: string; licenseUrl?: string };
}

export type InteractionKind =
  | 'talk' | 'bell' | 'taste' | 'fish' | 'telescope' | 'photo' | 'board' | 'streetcar' | 'postcard' | 'viewpoint' | 'info';

export interface InteractionDef {
  kind: InteractionKind;
  /** verb shown on the context button, e.g. { zh: '敲钟', en: 'Ring the bell' } */
  verb: Bilingual;
  /** dialogue node to play when performed (optional) */
  nodeId?: string;
  /** for photo/telescope: subject ids */
  targets?: string[];
  /** streetcar stop id / postcard id */
  refId?: string;
}

export interface PoiDef {
  id: string;
  name: Bilingual;
  /** interaction point (must be walkable & outside colliders) */
  position: Vec2;
  radius: number;
  landmarkId?: string;
  /** BAYLINK planner place id if one exists in /planner-catalog.json places */
  plannerPlaceId?: string;
  /** BAYLINK guide slug if one exists */
  guideSlug?: string;
  realInfo?: RealInfo;
  interaction: InteractionDef;
  /** short line BAYBAY says when the player passes by in free roam */
  bark?: Bilingual;
}

export interface PostcardDef {
  id: string;
  title: Bilingual;
  fact: Bilingual;
  position: Vec2;
  /** hint shown in journal before found */
  hint: Bilingual;
  image?: string;
  sourceUrl?: string;
}

export type Speaker = 'baybay' | 'player' | 'npc' | 'narrator';
export type Mood = 'happy' | 'thinking' | 'excited' | 'wave' | 'point' | 'proud';

export type DialogueAction =
  /** `tourId` (wave 4, lane C's request): which tour to start (`'sf-grand'` from the city welcome choice); absent = the
   * district's first lesson (core/store.ts DEFAULT_TOUR_ID), so every existing node keeps its meaning */
  | { type: 'start-tour'; tourId?: string }
  | { type: 'start-week' }
  | { type: 'free-roam' }
  | { type: 'skip-intro' }
  | { type: 'set-week-pref'; key: 'companions' | 'vibe' | 'region'; value: string }
  | { type: 'show-week-results' }
  | { type: 'open-map' }
  | { type: 'open-journal' }
  | { type: 'open-poi'; poiId: string }
  | { type: 'tour-next' }
  | { type: 'tour-end' }
  | { type: 'end' };

export interface DialogueChoice {
  label: Bilingual;
  next?: string;
  action?: DialogueAction;
  /** keyboard shortcut digit shown on the button */
  hotkey?: string;
}

export interface DialogueNode {
  id: string;
  speaker: Speaker;
  npcName?: Bilingual;
  text: Bilingual;
  mood?: Mood;
  choices?: DialogueChoice[];
  next?: string;
  action?: DialogueAction;
}

export interface TourStop {
  poiId: string;
  /** dialogue played on arrival (before the micro interaction) */
  arriveNode: string;
  /** dialogue after the micro interaction (before moving on) */
  doneNode?: string;
}

export interface TourDef {
  id: string;
  name: Bilingual;
  stops: TourStop[];
  introNode: string;
  outroNode: string;
}

export interface WeekOption {
  value: string;
  label: Bilingual;
}

export interface WeekQuestions {
  companions: WeekOption[];
  vibe: WeekOption[];
  region: WeekOption[];
}

export interface FreeGoal {
  id: string;
  label: Bilingual;
  hint: Bilingual;
}

// ---------------------------------------------------------------------------
// Live BAYLINK catalog (subset of /planner-catalog.json we read)
// ---------------------------------------------------------------------------

export interface CatalogEvent {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  dateLabel?: string;
  region: string;
  city?: string;
  venue?: string;
  category?: string;
  cost?: string;
  costLabel?: string;
  summary?: string;
  plan?: string[];
  audience?: string[];
  officialUrl?: string;
  sourceLabel?: string;
  verifiedAt?: string;
  location?: { lat: number; lng: number; label?: string; precision?: string };
  relatedGuideSlug?: string;
  occurrenceDates?: string[];
}

export interface CatalogPlace {
  id: string;
  title: string;
  region: string;
  city?: string;
  summary?: string;
  guideSlug?: string;
  officialUrl?: string;
  cost?: string;
  location?: { lat: number; lng: number; label?: string };
}

export interface CatalogGuide {
  slug: string;
  title: string;
}

export interface Catalog {
  checkedAt?: string;
  events: CatalogEvent[];
  places: CatalogPlace[];
  guides: CatalogGuide[];
}

export type WishItem = { kind: 'place' | 'event' | 'poi' | 'guide'; id: string; title: string; addedAt: string };
