import type { Bilingual, Vec2 } from '../core/types';
import type { MapView } from './cityMapDraw';

/**
 * Wave 5 · lane N · W5-N4: the phone map's pure parts (plan sf-w5-plan.md MF4 "Phone map": a badge tap opens a compact
 * card pinned over the map with the go button in view; a cluster tap opens a small chooser; long-press any map point →
 * 去这里, the nearest walkable arrival spot; search results carry the same button). ui/MapGoCard.tsx draws them,
 * ui/CityMap.tsx wires them; tests/opus-bay-w5-nav.test.ts pins the numbers.
 *
 *   goCardHeight / goCardBox / goButtonBox   where the pinned card and its go button sit in the map frame (CSS px)
 *   toolsMaxHeight                           how tall the right-hand tool column may grow above the card (it wraps)
 *   panForCard                               the view moved so the selected point is not under the card
 *   pressSpot                                where a long-press takes you (see PressLookups) and what it is called
 *   PRESS                                    the long-press timing and slop
 */

export interface Box { l: number; t: number; r: number; b: number }

/** The pinned card (px): its inset from the frame, padding, head (title + meta lines), gap, the go button, the more button. */
export const GO_CARD = {
  margin: 8,
  pad: 10,
  /** title (20) + meta (16) + 2: two lines */
  head: 38,
  /** a short frame (the 375 × 667 phone: ≈ 307 px): title and meta on one line */
  headShort: 20,
  gap: 8,
  btn: 48,
  /** the 其他方式 button beside the go button (and its gap) */
  more: 44,
  moreGap: 6,
  /** below this frame height the card uses the one-line head */
  shortFrame: 340,
  /** the tool column's top inset (css .ob-citymap-tools top: 8px) and the gap kept above the card */
  toolsTop: 8,
  toolsGap: 8,
} as const;

/** The card's height in a frame `frameH` px tall. */
export const goCardHeight = (frameH: number) => GO_CARD.pad * 2 + (frameH < GO_CARD.shortFrame ? GO_CARD.headShort : GO_CARD.head) + GO_CARD.gap + GO_CARD.btn;

/** The pinned card's box in a frame of w × h (px, frame coordinates). */
export function goCardBox(frame: { w: number; h: number }): Box {
  const m = GO_CARD.margin, b = frame.h - m;
  return { l: m, t: b - goCardHeight(frame.h), r: frame.w - m, b };
}

/** The go button's box inside the pinned card: the bottom row, left of the 其他方式 button. */
export function goButtonBox(frame: { w: number; h: number }): Box {
  const c = goCardBox(frame), p = GO_CARD.pad;
  return { l: c.l + p, t: c.b - p - GO_CARD.btn, r: c.r - p - GO_CARD.more - GO_CARD.moreGap, b: c.b - p };
}

/** The tool column's max height (px): above the card when one shows (the column wraps into a second one), else the frame less 30. */
export function toolsMaxHeight(frameH: number, card: boolean): number {
  if (!card) return frameH - 30;
  return Math.max(80, frameH - goCardHeight(frameH) - GO_CARD.margin - GO_CARD.toolsTop - GO_CARD.toolsGap);
}

/** The "+n" chooser's height (px) for `rows` places in a frame `frameH` tall: head 32, rows 44 + 6 gap, at most the frame less 16. */
export const chooserHeight = (rows: number, frameH: number) =>
  Math.min(frameH - 2 * GO_CARD.margin, GO_CARD.pad * 2 + 32 + GO_CARD.gap + Math.max(1, rows) * 44 + (Math.max(1, rows) - 1) * 6);

/**
 * The view moved (not zoomed) so `pt` sits in the free part of the frame above the card (`cardH`: the pinned card's by
 * default, or the chooser's): when its pixel is under the card (CARD_CLEAR: its badge, its label, the credit) or hugs the top
 * edge, it goes to the middle of the part above the card. Null: already clear.
 */
/** how far above the card a selection must sit (px): its badge, its label and the credit line lifted over the card */
export const CARD_CLEAR = 46;

export function panForCard(v: MapView, pt: Vec2, cardH: number = goCardHeight(v.h)): MapView | null {
  const y = (pt.z - v.cz) * v.scale + v.h / 2;
  const top = v.h - GO_CARD.margin - cardH;
  if (y <= top - CARD_CLEAR && y >= 36) return null;
  const want = Math.max(36, top / 2);
  return { ...v, cz: pt.z - (want - v.h / 2) / v.scale };
}

// ---------------------------------------------------------------------------------------------------------------------
// Long-press → 去这里
// ---------------------------------------------------------------------------------------------------------------------

/** A long-press: held this long (ms) without moving more than `slop` px, one finger / the mouse. */
export const PRESS = { ms: 520, slop: 8 } as const;

/** The map frame's own controls (buttons, links, the legend, the pinned card): a gesture there is not a map gesture. */
export const MAP_CONTROLS = 'button, a, .mw-legend-pop, .mw-gocard, .mw-chooser';
/** Is `target` the map itself (pan / tap / press), not one of its controls? */
export function mapGestureTarget(target: EventTarget | null): boolean {
  const el = target as { closest?: (sel: string) => unknown } | null;
  return !!el && typeof el.closest === 'function' && !el.closest(MAP_CONTROLS);
}
/**
 * CP-2: the OSM credit ignores a click this soon after a map gesture (ms): a tap that selects lifts the credit over the
 * pinned card, under the finger, and the touch's compatibility click would land on it (a new tab; the game paused).
 */
export const CREDIT_GUARD_MS = 600;
export const creditGuarded = (now: number, lastMapGesture: number): boolean => now - lastMapGesture < CREDIT_GUARD_MS;
/** Snap radii (u): the resident terrain's nearest standable spot; the walking graph's nearest node; a place's arrival. */
export const PRESS_SNAP = { walkable: 30, graph: 60, place: 60, nearName: 60 } as const;

export interface PressPlace { id: string; name: Bilingual; x: number; z: number; arrival: Vec2; walkable?: boolean }

/** What pressSpot asks of the game (the terrain, the walking graph, the place index, the land mask, the area names). */
export interface PressLookups {
  /** core/terrain standAt: 1 standable, 0 not, −1 the city chunk there is not resident */
  stand(x: number, z: number): 0 | 1 | -1;
  /** core/terrain nearestWalkable over the resident chunks (null: none within r) */
  nearestWalkable(p: Vec2, r: number): Vec2 | null;
  /** the walking graph's nearest node within r (a street or path the walk can reach), null when none or not loaded */
  graphNear?(p: Vec2, r: number): Vec2 | null;
  /** places near a point (data/sf/places PlaceIndex.near) */
  placesNear(x: number, z: number, r: number): readonly PressPlace[];
  /** on the city's land (a DataSF neighbourhood: data/cityZones farZoneIndexAt ≥ 0) */
  onLand(x: number, z: number): boolean;
  /** the area name there (data/cityZones cityAreaAt), null out of every area */
  area(x: number, z: number): Bilingual | null;
}

export interface PressSpot {
  /** where the trip ends (standable, or a graph node / place arrival where the chunk is not loaded) */
  x: number;
  z: number;
  /** the pressed point moved to reach it (u) */
  moved: number;
  /** the nearest named place within PRESS_SNAP.nearName of the spot (the card says "…附近") */
  near: Bilingual | null;
  area: Bilingual | null;
  /** the trip's name (the pill's 下一站, BAYBAY's line): "科伊特塔附近", else the area, else 这里 */
  name: Bilingual;
}

const nearest = <T extends Vec2>(list: readonly T[], p: Vec2): T | null => {
  let best: T | null = null, bd = Infinity;
  for (const q of list) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
  return best;
};

/** A zh name with Chinese in it (most OSM rows copy their English name into zh: 'Win Yen Co.', 'Filbert Steps'). */
const HAN = /[㐀-鿿豈-﫿]/;
export const hasZhName = (n: Bilingual | null | undefined): boolean => !!n && HAN.test(n.zh);

/** The words of a pressed spot: near a place → "科伊特塔附近", else the area, else 这里. */
export function pressName(near: Bilingual | null, area: Bilingual | null): Bilingual {
  if (near) return { zh: `${near.zh}附近`, en: `Near ${near.en}` };
  return area ?? { zh: '这里', en: 'This spot' };
}

/**
 * Where a long-press on the map takes you (plan MF4: "the nearest walkable arrival spot"), or null (the sea, off the
 * map): the point itself when it is standable; on a resident chunk the nearest standable spot within 30 u (a roof, a
 * wall, a lake edge); on a chunk not loaded yet the walking graph's nearest node within 60 u, else the nearest walkable
 * place's arrival within 60 u, else the point itself when it is on land (the walk and the landing snap it there).
 */
export function pressSpot(p: Vec2, lk: PressLookups): PressSpot | null {
  let spot: Vec2 | null;
  const s = lk.stand(p.x, p.z);
  if (s === 1) spot = { x: p.x, z: p.z };
  else if (s === 0) spot = lk.nearestWalkable(p, PRESS_SNAP.walkable);
  else {
    const land = lk.onLand(p.x, p.z);
    spot = lk.graphNear?.(p, PRESS_SNAP.graph) ?? null;
    if (!spot) {
      const pl = nearest(lk.placesNear(p.x, p.z, PRESS_SNAP.place).filter(q => q.walkable !== false).map(q => ({ x: q.arrival.x, z: q.arrival.z })), p);
      spot = pl ?? (land ? { x: p.x, z: p.z } : null);
    }
  }
  if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.z)) return null;
  // (W5-N review, the checkpoint's CP-13 rule: no English in the zh HUD) only a place with a real zh name names the spot —
  // 8 in 10 presses near a place were "Filbert Steps附近" / "Win Yen Co.附近" on the card, the pill and BAYBAY's line;
  // without one the area speaks (金融区 · 南滩)
  const near = nearest(lk.placesNear(spot.x, spot.z, PRESS_SNAP.nearName).filter(q => hasZhName(q.name)), spot);
  const area = lk.area(spot.x, spot.z);
  const nearName = near?.name ?? null;
  return { x: spot.x, z: spot.z, moved: Math.hypot(spot.x - p.x, spot.z - p.z), near: nearName, area, name: pressName(nearName, area) };
}

/** A pressed spot's trip place id: game/goToRun pointPlaceId's rule (`pt:<x>,<z>` rounded; tested equal), kept here so the map chunk does not load the goTo runner. */
export const pressPlaceId = (p: Vec2) => `pt:${Math.round(p.x)},${Math.round(p.z)}`;

/** Is a held pointer a long-press now (pure: the component's timer asks it)? */
export const isLongPress = (heldMs: number, movedPx: number, pointers: number) => pointers === 1 && movedPx <= PRESS.slop && heldMs >= PRESS.ms;
