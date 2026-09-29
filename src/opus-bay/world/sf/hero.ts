import { KIND, heightAt, terrainGrid } from '../../core/terrain';
import type { BuildingLot, BuildingStyle } from '../../core/types';
import { DISTRICT } from '../../data/district';
import { hash2, shade } from '../builder';
import { PAL } from '../palette';
import { type CityPalette, type CityStyle, toyBuildingL1 } from '../recipes/city';
import { FACADES, RESID, ROOF_VIC, SHOP_ROOF, SHOP_WALL } from '../recipes/palettes';
import { nbDropLots } from './cornersNB';
import { CityBatch, type PoolArrays } from './mesh';

/**
 * The hero district seen from afar (plan §5.1): when the player is more than 300 u from the hero, its hand-made
 * buildings and props (~120k triangles) make way for one L1 box per lot and pier shed (~3k triangles, one item of
 * the city pool) in the district's own colours, so the swap reads as the same skyline. The hero landmarks (Ferry
 * Building, Coit, Transamerica, Salesforce …), the ground and the labels stay as they are.
 */

const STYLE: Record<BuildingStyle, CityStyle> = { victorian: 'victorian', shop: 'chinatown', warehouse: 'brick', office: 'office', tower: 'tower', residential: 'residential', deco: 'deco' };

/** The district recipe's colour choice per lot (world/recipes/district.ts), reduced to wall + roof. */
function lotPalette(lot: BuildingLot, i: number): CityPalette {
  switch (lot.style) {
    case 'victorian': { const wall = lot.color ?? PAL.victorian[i % 5]; return { wall, roof: ROOF_VIC[i % ROOF_VIC.length] }; }
    case 'shop': return { wall: SHOP_WALL, roof: SHOP_ROOF };
    case 'warehouse': return { wall: lot.color ?? '#b56e55', roof: '#dcc9ad' };
    case 'office':
    case 'tower': {
      const wall = lot.color ?? `#${shade(FACADES[Math.floor(hash2(i * 1.31, 7.1) * FACADES.length) % FACADES.length], 0.96 + hash2(i, 2.2) * 0.08).getHexString()}`;
      return { wall, roof: `#${shade(wall, 0.92).getHexString()}` };
    }
    case 'deco': return { wall: lot.color ?? '#efe6d6', roof: '#c9bfaf' };
    default: {
      const wall = lot.color ?? RESID[i % RESID.length];
      return { wall, roof: lot.roof === 'flat' || !lot.roof ? '#c9bfae' : PAL.roofDark };
    }
  }
}

/**
 * The hero's own land and decks as a 2 u raster (1 = land / deck in any of its 0.5 u cells): the city shore texture
 * (foam along the seawall and the piers) and the seam rule for city buildings reaching into the slab (build.ts).
 */
export function heroLandRaster(step = 2): { x0: number; z0: number; step: number; cols: number; rows: number; data: Uint8Array } {
  const g = terrainGrid(), k = Math.round(step / g.cell);
  const cols = Math.ceil(g.cols / k), rows = Math.ceil(g.rows / k), data = new Uint8Array(cols * rows);
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
    const v = g.kind[j * g.cols + i];
    if (v === KIND.land || v === KIND.deck) data[Math.floor(j / k) * cols + Math.floor(i / k)] = 1;
  }
  return { x0: g.minX, z0: g.minZ, step, cols, rows, data };
}

/**
 * The district lots city mode hides: the offline build's manifest.heroDropLots (the city's seam buildings stand there)
 * plus W6-W1's North Beach lots (world/sf/cornersNB.ts nbDropLots: the plain box on Saints Peter and Paul's site).
 */
export function cityDropLots(manifestDrop: readonly number[]): number[] {
  return [...new Set([...manifestDrop, ...nbDropLots(DISTRICT.blocks)])];
}

/** L1 boxes of every district lot and pier shed (world space, pool arrays), or null when there is none. */
export function heroProxy(): PoolArrays | null {
  const b = new CityBatch(8192);
  const hide = new Set(nbDropLots(DISTRICT.blocks));
  DISTRICT.blocks.forEach((lot, i) => {
    if (hide.has(i)) return;
    const c = lot.footprint.reduce((s, p) => ({ x: s.x + p.x / lot.footprint.length, z: s.z + p.z / lot.footprint.length }), { x: 0, z: 0 });
    toyBuildingL1(b, {
      poly: lot.footprint, baseY: lot.baseY ?? heightAt(c.x, c.z), H: lot.height, style: STYLE[lot.style],
      roof: lot.roof ?? 'flat', palette: lotPalette(lot, i), seed: 1_000_003 + i * 7919, flags: 0,
    });
  });
  for (const pier of DISTRICT.piers) {
    if (!pier.shed) continue;
    toyBuildingL1(b, { poly: pier.shed.footprint, baseY: 0, H: pier.shed.height, style: 'pier', roof: 'flat', palette: { wall: '#e7ddca', roof: '#c9c1b2' }, seed: 2_000_003, flags: 0 });
  }
  return b.toPool();
}
