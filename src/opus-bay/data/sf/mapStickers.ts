/**
 * Tier-1 map stickers (lane V, W4-V5): 16 round die-cut gouache stickers in the painted-map style of H2b's paper, one
 * per T1 attraction of plan §4.1, in a 512 × 512 WebP atlas (4 × 4 cells of 128 px, 2 px transparent padding, alpha
 * outside each circle, the cream rim included). Cut from one nano_banana_pro 4k sheet by
 * scripts/opus-sf/assets/w4/stickers.py, which also writes public/opus-bay/map/stickers-t1.json (the same rects; a test
 * keeps the two equal).
 *
 * Use (lane P, plan §4.1 "Badges"): at map scale s ≥ 0.45 a T1 badge draws its sticker instead of the lucide glyph,
 * centred on the badge, diameter = badge diameter + 4 px (the sticker brings its own cream rim, so no extra ring); the
 * glyph badge stays the fallback until the image is decoded (and under `?stickers=0`). Ids are the attraction ids of
 * data/sf/attractions.ts (lane P). Dependency-free.
 */

export const MAP_STICKER_IDS = [
  'golden-gate-bridge', 'alcatraz', 'fishermans-wharf', 'ferry-building',
  'coit-tower', 'chinatown-dragon-gate', 'lombard-crooked', 'palace-of-fine-arts',
  'golden-gate-park', 'alamo-square-painted-ladies', 'twin-peaks', 'city-hall',
  'union-square', 'sutro-baths', 'sf-state-university', 'stonestown-galleria',
] as const;
export type MapStickerId = (typeof MAP_STICKER_IDS)[number];

export interface MapStickerRect { x: number; y: number; w: number; h: number }

const CELL = 128;
const PAD = 2;

export const MAP_STICKERS_T1 = {
  url: '/opus-bay/map/stickers-t1.webp',
  meta: '/opus-bay/map/stickers-t1.json',
  size: [512, 512] as const,
  cell: CELL,
  pad: PAD,
  bytes: 74_150,
  /** Atlas rect of each sticker (the circle fills it edge to edge; outside the circle alpha is 0). */
  rects: Object.fromEntries(MAP_STICKER_IDS.map((id, k) => [id, {
    x: (k % 4) * CELL + PAD, y: Math.floor(k / 4) * CELL + PAD, w: CELL - 2 * PAD, h: CELL - 2 * PAD,
  }])) as Readonly<Record<MapStickerId, MapStickerRect>>,
  /** Scale (CSS px per world unit) from which the stickers replace the glyphs (plan §4.1). */
  minScale: 0.45,
} as const;

export const isMapStickerId = (id: string): id is MapStickerId => (MAP_STICKER_IDS as readonly string[]).includes(id);

/** The sticker's source rect for canvas `drawImage(img, x, y, w, h, …)`, or null when the attraction has none. */
export function mapStickerRect(id: string): MapStickerRect | null {
  return isMapStickerId(id) ? MAP_STICKERS_T1.rects[id] : null;
}

/** Files to list in `listAssetUrls()` at integration. */
export function mapStickerUrls(): string[] {
  return [MAP_STICKERS_T1.url, MAP_STICKERS_T1.meta];
}
