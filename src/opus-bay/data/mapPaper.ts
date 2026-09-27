/**
 * The painted whole-city map (lane H2b owns this file from wave 2; plan H2b-0/4). Dependency-free data.
 *
 *   MAP_FRAME    the square world frame the paper covers (x −1575..1505, z −972..2108: 3,080 u around the board).
 *                G1's city map draws the paper into exactly this rectangle, under the vector layers.
 *   MAP_PAPER    the registered paper, or null (day 0): consumers then show the vector map only.
 */

export interface MapFrame { minX: number; maxX: number; minZ: number; maxZ: number }
export const MAP_FRAME: MapFrame = { minX: -1575, maxX: 1505, minZ: -972, maxZ: 2108 };

export interface MapPaper {
  /** WebP per width (px); 4096 is optional (desktop zoom, loaded lazily) */
  sizes: { 1024: string; 2048: string; 4096?: string };
  /** world bounds of the image (normally MAP_FRAME) */
  bounds: MapFrame;
  version: string;
  sha256?: string;
}

export const MAP_PAPER: MapPaper | null = null;

/** Every paper file (data/assets.ts listAssetUrls). */
export function mapPaperUrls(): string[] {
  const p: MapPaper | null = MAP_PAPER;
  return p ? [p.sizes[1024], p.sizes[2048], ...(p.sizes[4096] ? [p.sizes[4096]] : [])] : [];
}
