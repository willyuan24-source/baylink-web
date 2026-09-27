import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, M } from '../../builder';
import { GC, LIFT, PAT, type SiteGround, type SiteGroundPoly, type SiteLight, crosswalk, gpoly, lamp, palm, tree } from './siteKit';

/**
 * A neighbourhood shopping block as a wave-4 site (lane L: Clement St, Irving St): ONE block of a straight city street
 * between two cross streets, in a LOCAL frame whose x runs along the street (z = 0 its centreline) and whose street
 * ribbon reaches the facades at |z| = `half` (the published residential ribbons include their sidewalks). The site
 * rebuilds the block's carriageway and sidewalks as draped ground (the exclusion clips the city's ribbon there), paints
 * zebra crossings at both corners, and dresses the shopfronts: awnings in shop colours, blank signboards (never text or
 * a real shop's sign), produce stands with crates on the sidewalk, street trees and lamps.
 */

export interface ShopBlock {
  /** the block's kerb corners along the street (local x): the cross streets' ribbons begin beyond them */
  x0: number;
  x1: number;
  /** the facade line = the ribbon's half width (u) */
  half: number;
  /** the carriageway's half width (the sidewalks are half − road wide) */
  road: number;
  /** shop bays per side (awning + signboard each) */
  bays: number;
  /** produce stands: [side −1 | 1, bay index] */
  stands: [-1 | 1, number][];
  /** street trees and lamps on the kerb line: [x, side, kind] */
  kerb: [number, -1 | 1, 'tree' | 'palm' | 'lamp'][];
  /** awning colours (a bay takes colour (bay + side) mod n) */
  awnings: readonly string[];
  signs: readonly string[];
}

const CRATE = ['#7fae4f', '#e08a3a', '#c9473a', '#e0c24a', '#5f9a4c', '#b04a6a'];

/** exclusion: the block's carriageway, sidewalks and the first 0.8 u of the shops behind the facade line */
export function shopExclude(k: ShopBlock): Vec2[] {
  const z = k.half + 0.8;
  return [{ x: k.x0, z: -z }, { x: k.x1, z: -z }, { x: k.x1, z }, { x: k.x0, z }];
}

/** the ground: carriageway, the two sidewalks (continued 1.6 u into the crossings), a dashed centre line, zebra crossings */
export function shopGround(k: ShopBlock, g: SiteGround): SiteGroundPoly[] {
  const out: SiteGroundPoly[] = [];
  const a = k.x0 - 1.6, b = k.x1 + 1.6, n = Math.max(1, Math.ceil((b - a) / 5));
  for (let i = 0; i < n; i++) {
    const u0 = a + ((b - a) * i) / n, u1 = a + ((b - a) * (i + 1)) / n;
    out.push(gpoly([{ x: u0, z: -k.road }, { x: u1, z: -k.road }, { x: u1, z: k.road }, { x: u0, z: k.road }], GC.asphalt, PAT.asphalt, g, LIFT));
    for (const s of [-1, 1]) {
      // sidewalks only along the block (the crossings stay asphalt)
      const s0 = Math.max(u0, k.x0), s1 = Math.min(u1, k.x1);
      if (s1 - s0 > 0.05) out.push(gpoly([{ x: s0, z: s * k.road }, { x: s1, z: s * k.road }, { x: s1, z: s * k.half }, { x: s0, z: s * k.half }], GC.sidewalk, PAT.stone, g, LIFT + 0.02));
    }
  }
  for (let u = k.x0 + 0.6; u + 1.2 <= k.x1 - 0.4; u += 2.4) out.push(gpoly([{ x: u, z: -0.05 }, { x: u + 1.2, z: -0.05 }, { x: u + 1.2, z: 0.05 }, { x: u, z: 0.05 }], GC.stripe, PAT.none, g, LIFT + 0.02));
  for (const x of [k.x0 - 0.8, k.x1 + 0.8]) out.push(...crosswalk({ x, z: -k.road }, { x, z: k.road }, g, 1.3, undefined, 0.35, 0.35).map(q => ({ ...q, ys: q.ys!.map(y => +(y + 0.02).toFixed(3)), y: +(q.y + 0.02).toFixed(3), lift: (q.lift ?? 0) + 0.02 })));
  return out;
}

type Blocker = { poly: Vec2[] } | { x: number; z: number; r: number };
const bayW = (k: ShopBlock) => (k.x1 - k.x0 - 0.6) / k.bays;
const bayX = (k: ShopBlock, i: number) => k.x0 + 0.3 + bayW(k) * (i + 0.5);
const standW = (k: ShopBlock) => Math.min(1.8, bayW(k) - 0.5);

/** the shopfronts, produce stands, street trees and lamps (lod 2: one awning slab a side) */
export function shopFronts(b: BatchLike, k: ShopBlock, g: SiteGround, lod: 0 | 2) {
  const bay = bayW(k);
  for (const side of [-1, 1] as const) {
    const zf = side * k.half;
    for (let i = 0; i < k.bays; i++) {
      const cx = bayX(k, i), y = g.at(cx, zf);
      const col = k.awnings[(i + (side > 0 ? 2 : 0)) % k.awnings.length];
      if (lod === 2) { if (i === 0) b.add(BOX(), M((k.x0 + k.x1) / 2, y + 1.9, zf - side * 0.4, 0, k.x1 - k.x0 - 0.6, 0.2, 0.8), col); continue; }
      // the awning slopes down from the facade over the sidewalk; the blank signboard above it
      b.add(CBOX(), M(cx, y + 2.05, zf - side * 0.45, 0, bay - 0.3, 0.07, 0.95, side * 0.32), col);
      b.add(CBOX(), M(cx, y + 2.65, zf - side * 0.06, 0, bay - 0.6, 0.45, 0.12), k.signs[(i * 3 + (side > 0 ? 1 : 0)) % k.signs.length]);
    }
  }
  if (lod === 2) return;
  for (const [side, i] of k.stands) {
    const cx = bayX(k, i), zc = side * (k.half - 0.3), y = g.at(cx, zc), w = standW(k);
    // a trestle table against the shopfront, under the awning, with a row of crates heaped with produce
    b.add(BOX(), M(cx, y - 0.1, zc, 0, w, 0.62, 0.5), '#8a6a4a');
    for (let c = 0; c < 3; c++) b.add(BOX(), M(cx + (c - 1) * (w / 3), y + 0.52, zc, 0, w / 3 - 0.06, 0.2, 0.42), CRATE[(i * 2 + c + (side > 0 ? 3 : 0)) % CRATE.length]);
  }
  for (const [x, side, kind] of k.kerb) {
    const z = side * (k.road + 0.3), y = g.at(x, z);
    if (kind === 'lamp') lamp(b, x, y, z);
    else if (kind === 'palm') palm(b, x, y, z, 4.2, x);
    else tree(b, x, y, z, 0.95, x * 7 + side);
  }
}

/** walk blockers of the stands, trees and lamps */
export function shopBlockers(k: ShopBlock): Blocker[] {
  const out: Blocker[] = [];
  for (const [side, i] of k.stands) {
    const cx = bayX(k, i), zc = side * (k.half - 0.3), hw = standW(k) / 2 + 0.1;
    out.push({ poly: [{ x: cx - hw, z: zc - 0.28 }, { x: cx + hw, z: zc - 0.28 }, { x: cx + hw, z: zc + 0.28 }, { x: cx - hw, z: zc + 0.28 }] });
  }
  for (const [x, side, kind] of k.kerb) out.push({ x, z: side * (k.road + 0.3), r: kind === 'lamp' ? 0.15 : kind === 'palm' ? 0.3 : 0.25 });
  return out;
}

/** the lamps' night lights (as siteKit.lamp places them) */
export function shopLights(k: ShopBlock, g: SiteGround): SiteLight[] {
  return k.kerb.filter(([, , kind]) => kind === 'lamp').map(([x, side]) => { const z = side * (k.road + 0.3); return { x, y: g.at(x, z) + 3.8, z, size: 1, color: '#ffd9a0' }; });
}
