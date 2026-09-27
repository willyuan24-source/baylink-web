/**
 * The painted whole-city map (lane H2b owns this file from wave 2; plan H2b-0/4). Dependency-free data.
 *
 *   MAP_FRAME    the square world frame the paper covers (x −1575..1505, z −972..2108: 3,080 u around the board).
 *                G1's city map draws the paper into exactly this rectangle, under the vector layers.
 *   MAP_PAPER    the registered paper, or null (`?paper=0`): consumers then show the vector map only.
 *
 * v1 (wave 3, H2b-3/4): nano_banana_pro 4k over our own base render (scripts/opus-sf/map/render-base.ts) with the K6
 * key art as the style reference — a gouache / watercolour city on its board. Similarity-fitted to the land mask (coast
 * p95 12.0 px at 2048 against a 30.7 px gate), graded toward the palette, pseudo-letters wiped on the hero lots
 * (scripts/opus-sf/map/paper_post.py). No text anywhere. Ledger: docs/opus-bay/ledger/w3-H2b.md.
 */

export interface MapFrame { minX: number; maxX: number; minZ: number; maxZ: number }
export const MAP_FRAME: MapFrame = { minX: -1575, maxX: 1505, minZ: -972, maxZ: 2108 };

export type PaperWidth = 1024 | 2048 | 4096;

export interface MapPaper {
  /** WebP per width (px); 4096 is optional (desktop zoom, loaded lazily, never on phones) */
  sizes: { 1024: string; 2048: string; 4096?: string };
  /** world bounds of the image (normally MAP_FRAME) */
  bounds: MapFrame;
  version: string;
  /** sha256 of the 2048 file (the one most players load) */
  sha256?: string;
  /** bytes on disk per width (the asset test keeps the files and these in step) */
  bytes?: Partial<Record<PaperWidth, number>>;
}

const DIR = '/opus-bay/map';

/** `?paper=0` turns the painted map off (the vector map alone: A/B and QA). */
function paperOff(): boolean {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).get('paper') === '0';
  } catch {
    return false;
  }
}

export const MAP_PAPER_V1: MapPaper = {
  sizes: { 1024: `${DIR}/paper-v1-1024.webp`, 2048: `${DIR}/paper-v1-2048.webp`, 4096: `${DIR}/paper-v1-4096.webp` },
  bounds: MAP_FRAME,
  version: 'v1',
  sha256: 'e00cdc7ffe85a6feca5dd4fa9c3b979b421d012b44114f663f1e1f13a9ec64ea',
  bytes: { 1024: 110_694, 2048: 344_736, 4096: 668_100 },
};

export const MAP_PAPER: MapPaper | null = paperOff() ? null : MAP_PAPER_V1;

/** Every paper file (data/assets.ts listAssetUrls; listed even under `?paper=0`). */
export function mapPaperUrls(): string[] {
  const p = MAP_PAPER_V1;
  return [p.sizes[1024], p.sizes[2048], ...(p.sizes[4096] ? [p.sizes[4096]] : [])];
}
