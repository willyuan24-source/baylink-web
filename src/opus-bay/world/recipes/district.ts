import type { BuildingLot } from '../../core/types';
import { BOX, type BatchLike, CBOX, Frame, hash2, inset, shade } from '../builder';
import { PAL } from '../palette';
import { FACADES, RESID, ROOF_VIC, SHOP_ROOF, SHOP_TRIM, SHOP_WALL } from './palettes';
import { WIN, flatRoof, gableRoof, hipRoof, obb, winInfo } from './shapes';

/**
 * The hero district's hand-authored lots (DISTRICT.blocks), moved from world/city.ts with byte-identical output
 * (tests/opus-bay-hero-regression.test.ts). Pure over BatchLike; the ground sampler is injected (the district
 * passes core/terrain heightAt) so this file never imports the terrain grid.
 */

export type GroundFn = (x: number, z: number) => number;

const facadeColor = (i: number) => shade(FACADES[Math.floor(hash2(i * 1.31, 7.1) * FACADES.length) % FACADES.length], 0.96 + hash2(i, 2.2) * 0.08);

function lotBase(lot: BuildingLot, ground: GroundFn) {
  if (lot.baseY !== undefined) return lot.baseY;
  const c = lot.footprint.reduce((s, p) => ({ x: s.x + p.x / lot.footprint.length, z: s.z + p.z / lot.footprint.length }), { x: 0, z: 0 });
  return ground(c.x, c.z);
}

/** One district lot (index i drives its palette pick and seeds). */
export function districtBuilding(b: BatchLike, lot: BuildingLot, i: number, ground: GroundFn) {
  const base = lotBase(lot, ground);
  const poly = lot.footprint;
  const h = lot.height;
  const top = base + h;
  const r = obb(poly);
  const seed = hash2(i * 3.1, lot.height * 7.7);
  const bottom = base - 1.2; // sink into slopes
  switch (lot.style) {
    case 'victorian': {
      const wall = lot.color ?? PAL.victorian[i % 5];
      b.walls(poly, bottom, top, wall, winInfo(WIN.victorian, base), shade(wall, 0.78));
      // white trim band under the eaves + a porch band
      b.walls(inset(poly, -0.04), top - 0.28, top - 0.05, PAL.trimWhite);
      b.walls(inset(poly, -0.04), base + 2.45, base + 2.62, PAL.trimWhite);
      const roofC = ROOF_VIC[i % ROOF_VIC.length];
      gableRoof(b, r, top, Math.min(2.2, 0.9 + r.hv * 0.55), roofC, wall, winInfo(WIN.victorian, base));
      // bay window on the downhill short side
      const s = ground(r.cx + r.ux * r.hu, r.cz + r.uz * r.hu) < ground(r.cx - r.ux * r.hu, r.cz - r.uz * r.hu) ? 1 : -1;
      if (r.hv > 1.1) {
        const f = new Frame(r.cx + r.ux * (r.hu + 0.25) * s, base + 0.6, r.cz + r.uz * (r.hu + 0.25) * s, Math.atan2(r.ux * s, r.uz * s));
        b.add(BOX(), f.at(0, 0, 0, 0, Math.min(1.8, r.hv * 1.1), h - 1.2, 0.55), wall, winInfo(WIN.victorian, base));
        b.add(BOX(), f.at(0, h - 1.2, 0, 0, Math.min(2.0, r.hv * 1.2), 0.18, 0.7), PAL.trimWhite);
      }
      break;
    }
    case 'shop': {
      const wall = shade(SHOP_WALL, 0.96 + hash2(i, 5.5) * 0.08);
      b.walls(poly, bottom, top, wall, winInfo(WIN.shop, base), shade(wall, 0.75));
      b.walls(inset(poly, -0.05), base + 2.6, base + 2.8, SHOP_TRIM);
      b.walls(inset(poly, -0.04), top - 0.25, top, SHOP_TRIM);
      gableRoof(b, r, top, Math.min(1.8, 0.6 + r.hv * 0.45), SHOP_ROOF, wall.getStyle(), winInfo(WIN.shop, base));
      // striped awnings on the long sides
      for (const s of [-1, 1]) {
        const f = new Frame(r.cx + r.vx * (r.hv + 0.35) * s, base + 2.2, r.cz + r.vz * (r.hv + 0.35) * s, Math.atan2(r.vx * s, r.vz * s));
        const cols = ['#c9714f', '#3a8a84'];
        const n = Math.max(1, Math.floor(r.hu * 2 / 1.1));
        for (let k = 0; k < n; k++) {
          const x = -r.hu + (k + 0.5) * (2 * r.hu / n);
          b.add(CBOX(), f.at(x, 0, 0, 0, (2 * r.hu / n) * 0.96, 0.08, 0.8, 0.35), k % 2 ? '#f6efe1' : cols[i % 2]);
        }
      }
      break;
    }
    case 'warehouse': {
      const wall = lot.color ?? '#b56e55';
      b.walls(poly, bottom, top, wall, winInfo(WIN.brick, base), shade(wall, 0.75));
      b.walls(inset(poly, -0.06), top - 0.45, top + 0.15, '#dcc6a8');
      flatRoof(b, poly, top + 0.15, '#dcc9ad', '#bdb2a4', seed);
      break;
    }
    case 'office':
    case 'tower': {
      const glass = seed > 0.82 && h > 12;
      const style = glass ? WIN.glass : WIN.office;
      const w = glass ? shade('#bccaca', 0.97 + hash2(i, 9.1) * 0.06) : lot.color ? shade(lot.color, 1) : facadeColor(i);
      const roofC = shade(w, 0.92).getStyle(), coping = shade(w, 1.04).getStyle();
      if (h > 16 && r.hu > 2.5 && r.hv > 2.5) {
        const setback = top - Math.min(5, h * 0.22);
        b.walls(poly, bottom, setback, w, winInfo(style, base), shade(w, 0.8));
        flatRoof(b, poly, setback, coping, roofC, 0.1);
        const up = inset(poly, 1.1);
        b.walls(up, setback, top, w, winInfo(style, base));
        // one tower in ten wears a terracotta or teal crown
        if (hash2(i, 4.4) < 0.1) b.walls(inset(up, -0.06), top - 1.1, top + 0.25, hash2(i, 8.8) > 0.5 ? '#c8714f' : '#3f8a84');
        flatRoof(b, up, top, coping, roofC, seed);
      } else {
        b.walls(poly, bottom, top, w, winInfo(style, base), shade(w, 0.8));
        flatRoof(b, poly, top, coping, roofC, seed);
      }
      break;
    }
    case 'deco': {
      const wall = lot.color ?? '#efe6d6';
      b.walls(poly, bottom, top, wall, winInfo(WIN.res, base), shade(wall, 0.8));
      b.walls(inset(poly, -0.05), top - 0.35, top, '#d9cdb8');
      flatRoof(b, poly, top, '#e2d7c3', '#c9bfaf', seed);
      const up = inset(poly, 0.9);
      if (r.hu > 1.5 && r.hv > 1.5) { b.walls(up, top, top + 1.1, wall, winInfo(WIN.res, base)); b.polygon(up, top + 1.1, '#d9cdb8'); }
      break;
    }
    default: {
      const wall = lot.color ?? RESID[i % RESID.length];
      b.walls(poly, bottom, top, wall, winInfo(WIN.res, base), shade(wall, 0.8));
      if (lot.roof === 'hip') {
        b.walls(inset(poly, -0.05), top - 0.25, top, PAL.trimWhite);
        hipRoof(b, r, top, Math.min(1.8, 0.7 + r.hv * 0.35), seed > 0.5 ? PAL.roof : PAL.roofDark);
      } else if (lot.roof === 'gable') {
        gableRoof(b, r, top, Math.min(2, 0.8 + r.hv * 0.5), PAL.roofDark, wall, winInfo(WIN.res, base));
      } else {
        flatRoof(b, poly, top, shade(wall, 1.05).getStyle(), '#c9bfae', seed);
      }
    }
  }
}
