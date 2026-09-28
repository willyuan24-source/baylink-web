/**
 * Original Mission murals (lane H2b owns this file from wave 2; plan H2b-10). Dependency-free data (data/assets.ts
 * lists the files, so the title chunk may reach it).
 *
 * Eight original paintings in the spirit of the Mission's painted alleys — none copies a real mural; no people, no
 * faces, no text (gpt_image_2_5 high, picked over nano_banana_pro + K6 in an A/B: bolder shapes that still read at
 * 512 px from the walking camera; ledger docs/opus-bay/ledger/w3-H2b.md). They stand as freestanding painted boards
 * along Clarion Alley (Valencia ↔ Mission, 17th / 18th) and Balmy Alley (24th ↔ 25th), four each, alternating sides,
 * just in front of the walls (placements measured from our own chunk data: scripts/opus-sf/murals/place.ts).
 * world/sf/murals.ts draws all of them as one mesh within MURAL_RANGE of an alley.
 *
 *   MURAL_ATLAS   2048 × 1024 WebP, 4 × 2 tiles of 512 px: TILE_ART px of art inside a MURAL_GUTTER px border that
 *                 repeats the art's own edge (no neighbour bleeds in at any mip level); `rect` covers the art only
 *   single        the whole mural at 512 px (UI cards)
 *   at            world x, z of the panel's centre on the ground, yaw (rad: the painted face looks along
 *                 (sin yaw, cos yaw)), width (u); the height comes from the terrain at run time
 */

export interface MuralDef {
  id: string;
  title: { zh: string; en: string };
  /** atlas rect in uv (0..1, v up as three.js samples a flipY texture): the art without its gutter */
  rect: { u0: number; v0: number; u1: number; v1: number };
  /** 512 px single for UI cards */
  single?: string;
  /** placement: world x, z (projectCity), yaw (rad), panel width (u) */
  at: { x: number; z: number; yaw: number; width: number };
  /** the alley it stands in (MURAL_SITES) */
  site?: MuralSiteId;
}

export type MuralSiteId = 'clarion' | 'balmy';

/** alley centres (world x, z): the murals show while the camera is within MURAL_RANGE of one */
export const MURAL_SITES: Record<MuralSiteId, { x: number; z: number; zh: string; en: string }> = {
  clarion: { x: 261.4, z: 606.0, zh: '克拉里恩小巷', en: 'Clarion Alley' },
  balmy: { x: 456.9, z: 653.4, zh: '巴尔米小巷', en: 'Balmy Alley' },
};
export const MURAL_RANGE = 300;

/** a painted board: square (the art is square), a little thicker than a garage door, sunk into the ground a bit */
export const MURAL_PANEL = { width: 2.6, height: 2.6, thick: 0.1, sink: 0.1 } as const;

export const MURAL_ATLAS_SIZE = { w: 2048, h: 1024, tile: 512 } as const;
export const MURAL_GUTTER = 16;

const DIR = '/opus-bay/murals';

/** The art rect of atlas tile k (row-major from the top left, 4 per row). */
export function muralRect(k: number): MuralDef['rect'] {
  const { w, h, tile } = MURAL_ATLAS_SIZE;
  const col = k % 4, row = Math.floor(k / 4);
  const x0 = col * tile + MURAL_GUTTER, y0 = row * tile + MURAL_GUTTER, art = tile - 2 * MURAL_GUTTER;
  return { u0: x0 / w, u1: (x0 + art) / w, v0: 1 - (y0 + art) / h, v1: 1 - y0 / h };
}

const W = MURAL_PANEL.width;
const mural = (k: number, id: string, zh: string, en: string, site: MuralSiteId, x: number, z: number, yaw: number): MuralDef => ({
  id, title: { zh, en }, rect: muralRect(k), single: `${DIR}/${id}-512.webp`, at: { x, z, yaw, width: W }, site,
});

export const MURALS: MuralDef[] = [
  // Balmy Alley (from the 25th Street end)
  mural(0, 'sun-hummingbird', '太阳与蜂鸟', 'Sun and Hummingbird', 'balmy', 461.9, 655.34, -0.6919),
  mural(1, 'poppy-hills', '花菱草与帝王蝶', 'Poppies and Monarchs', 'balmy', 456.73, 656.49, 2.4497),
  mural(2, 'fruit-stand', '水果摊', 'The Fruit Stand', 'balmy', 456.21, 649.87, -0.6918),
  mural(3, 'music-garden', '花园里的乐器', 'A Garden of Music', 'balmy', 449, 649.18, 2.4498),
  // Clarion Alley (from the Valencia Street end)
  mural(4, 'pelican-bay', '鹈鹕飞过海湾', 'Pelicans over the Bay', 'clarion', 256.64, 613.07, -2.2696),
  mural(5, 'flower-cable-car', '开满花的叮当车', 'The Flower Cable Car', 'clarion', 259.61, 606.75, 0.872),
  mural(6, 'night-bay', '海湾之夜', 'The Bay at Night', 'clarion', 263.75, 605.98, -2.2696),
  mural(7, 'kelp-forest', '海底的巨藻林', 'Under the Bay', 'clarion', 265.41, 599.86, 0.872),
];

/** the 2048×1024 atlas, or null */
export const MURAL_ATLAS: string | null = `${DIR}/atlas-v1.webp`;

/** Every mural file (data/assets.ts listAssetUrls). */
export function muralUrls(): string[] {
  const atlas: string | null = MURAL_ATLAS;
  return [...(atlas ? [atlas] : []), ...MURALS.flatMap(m => (m.single ? [m.single] : []))];
}
