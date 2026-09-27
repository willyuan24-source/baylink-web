import * as THREE from 'three';
import { WALL_SINK } from '../../core/geo';
import type { Polygon, Vec2 } from '../../core/types';
import { BOX, type BatchLike, CBOX, Frame, type Info, inset, mixColor, rng, shade, signedArea, v3 } from '../builder';
import { CHINATOWN_ACCENT, CITY_WALLS, GLASS_WALL, IRON, RELIEF, ROOF_VIC, SLATE, STONE, TILE, VIC_ACCENT } from './palettes';
import { WIN, type Obb, flatRoof, gableRoof, hipRoof, obb, winInfo } from './shapes';

/**
 * Toy buildings for the streamed city (plan §2.3, §5.3), built from OSM footprints inside a Web Worker:
 *
 *   toyBuildingL0(b, spec)  near tier (≤ 150 u): the district's toy grammar — bay windows on Victorians,
 *                           cornices, storefront bands with awnings, balconies in Chinatown, setbacks and roof
 *                           boxes on towers; windows come from the TOY shader (aInfo), never from geometry.
 *                           ≤ 250 triangles for a house (≤ 12-vertex footprint), ≤ 600 for a tower.
 *   toyBuildingL1(b, spec)  massing tier (≤ 520 u): one oriented box + flat / gable / hip cap (10–14 triangles),
 *                           the same wall / roof colours and window style as L0, so the swap does not pop.
 *
 * Pure over BatchLike (TypedBatch in the worker), deterministic per spec.seed, no DOM and no terrain lookups.
 * All colours are resolved by `cityLook(spec)`, shared by both tiers.
 *
 * Data contract (lane A, world/sf/format.ts): `style` / `roof` codes index CITY_STYLES / CITY_ROOFS (the same
 * tables as format.ts STYLES / ROOFS — a test keeps them equal); `palette` is the manifest entry
 * (SfManifest.palettes[code] → { wall, trim, roof }) or a pool index; `flags` is BuildingSet.flags as-is
 * (BUILDING_FLAG bits 0–8) plus the recipe hints CITY_FLAG in bits 10–14; `seed` = osmId.
 */

/** = format.ts STYLES (code = index). 'sunset' is the Sunset / Parkside / Richmond "Doelger" stucco family. */
export const CITY_STYLES = ['victorian', 'edwardian', 'sunset', 'marina', 'chinatown', 'brick', 'deco', 'office', 'tower', 'industrial', 'civic', 'pier', 'residential'] as const;
export type CityStyle = (typeof CITY_STYLES)[number];
/** = format.ts ROOFS */
export const CITY_ROOFS = ['flat', 'gable', 'hip'] as const;
export type CityRoof = (typeof CITY_ROOFS)[number];

/**
 * Recipe hints in the building flags' free high bits (format.ts BUILDING_FLAG uses bits 0–8). Lane A may set them
 * offline; without them the recipes still work (no storefronts, the street side picked by seed).
 */
export const CITY_FLAG = {
  /** commercial ground floor (OSM shop / amenity / building=retail): shop-glass band, trim, striped awning */
  shop: 1 << 10,
  /** corner lot: the awning wraps onto the next side as well */
  corner: 1 << 11,
  /** glass curtain wall (office / tower) */
  glass: 1 << 12,
  /** no rooftop boxes (tiny or hero-adjacent roofs) */
  noClutter: 1 << 13,
  /** poly[0] → poly[1] is the street side (lane A rotates the ring so; costs no bytes) */
  front0: 1 << 14,
} as const;
/** format.ts BUILDING_FLAG bits the recipes read */
const SF_FLAG = { onPier: 16, tall: 64 } as const;

/** Explicit colours (sRGB hex), e.g. a manifest palette entry. */
export interface CityPalette { wall: string; roof?: string; trim?: string; accent?: string }

export interface CityBuildingSpec {
  /** footprint, world x/z, 3–12 vertices, simple polygon (CCW preferred; either winding renders) */
  poly: Vec2[];
  /** lowest ground under the footprint (walls start WALL_SINK = 1.2 u below it to sink into slopes) */
  baseY: number;
  /** wall height above baseY (core/geo buildingH) */
  H: number;
  style: CityStyle;
  roof: CityRoof;
  /** explicit colours (the manifest palette entry), or an index into CITY_WALLS[style] (mod length) */
  palette: number | CityPalette;
  /** integer seed (the osmId): colour jitter, accents, window occupancy */
  seed: number;
  /** BuildingSet.flags (format.ts BUILDING_FLAG) | CITY_FLAG hints */
  flags: number;
  /** edge index i (poly[i] → poly[i + 1]) that faces the street; else CITY_FLAG.front0, else a short end by seed */
  front?: number;
}

/** Everything both tiers must agree on (colours, window style and seed). */
export interface CityLook {
  wall: THREE.Color;
  wallHex: string;
  roof: string;
  coping: string;
  /** the flat roof's rim as L0 draws it (coping / cornice / parapet colour); L1 blends it into its flat cap */
  rim: string;
  trim: string;
  accent: string;
  /** TOY window style (WIN.*) */
  win: number;
  /** negative per-building window seed for aInfo.z */
  winSeed: number;
  /** 0..1 draws for details, after the colour draws (same sequence for L0 and L1) */
  rand: () => number;
}

const BRICK_RIM = '#dcc9ad', CIVIC_RIM = '#e2d7c3';
const pick = <T>(pool: readonly T[], i: number) => pool[((Math.floor(i) % pool.length) + pool.length) % pool.length];
const hex = (c: THREE.Color) => `#${c.getHexString()}`;
const TALL = (s: CityStyle) => s === 'office' || s === 'tower';

/** Resolve colours / window style for a spec (deterministic per seed). */
export function cityLook(spec: CityBuildingSpec): CityLook {
  const R = rng(Math.imul(spec.seed | 0, 0x9e3779b1) ^ ((spec.seed / 4294967296) | 0));
  const jitter = 0.94 + R() * 0.12;
  const explicit = typeof spec.palette === 'object' ? spec.palette : null;
  const glass = (spec.flags & CITY_FLAG.glass) !== 0 && TALL(spec.style);
  const base = glass ? GLASS_WALL : explicit?.wall ?? pick(CITY_WALLS[spec.style], spec.palette as number);
  const wall = shade(base, glass ? 0.97 + (jitter - 0.94) * 0.5 : jitter);
  const wallHex = hex(wall);
  const r1 = R(), r2 = R();
  let roof: string, trim = explicit?.trim ?? '#fbf6ec', accent: string, win: number;
  switch (spec.style) {
    case 'victorian':
      roof = pick(ROOF_VIC, r1 * 4); accent = pick(VIC_ACCENT, r2 * 4); win = WIN.victorian; break;
    case 'edwardian':
      roof = pick(SLATE, r1 * 3); accent = '#56655f'; win = WIN.victorian; break;
    case 'sunset':
      roof = spec.roof === 'flat' ? '#d9d0c0' : TILE; trim = explicit?.trim ?? RELIEF; accent = TILE; win = WIN.res; break;
    case 'marina':
      roof = TILE; trim = explicit?.trim ?? RELIEF; accent = IRON; win = WIN.res; break;
    case 'chinatown':
      roof = '#c9bfae'; accent = pick(CHINATOWN_ACCENT, r1 * 3); trim = explicit?.trim ?? '#efe6d6'; win = WIN.res; break;
    case 'brick':
      roof = '#bdb2a4'; trim = explicit?.trim ?? STONE; accent = '#56655f'; win = WIN.brick; break;
    case 'industrial':
      roof = '#b4b0a6'; trim = explicit?.trim ?? '#d6cfc2'; accent = '#56655f'; win = WIN.shed; break;
    case 'pier':
      roof = '#a7b3aa'; trim = explicit?.trim ?? '#7f9c8f'; accent = '#56655f'; win = WIN.shed; break;
    case 'deco':
    case 'civic':
      roof = '#c9bfaf'; trim = explicit?.trim ?? '#d9cdb8'; accent = '#c8714f'; win = WIN.res; break;
    case 'residential':
      roof = r1 > 0.5 ? '#d07a55' : '#b8674a'; accent = '#56655f'; win = WIN.res; break;
    default: // office, tower
      roof = hex(shade(wall, 0.92)); trim = explicit?.trim ?? hex(shade(wall, 1.04)); accent = r2 > 0.5 ? '#c8714f' : '#3f8a84'; win = glass ? WIN.glass : WIN.office;
  }
  if (explicit?.roof) roof = explicit.roof;
  if (explicit?.accent) accent = explicit.accent;
  const coping = TALL(spec.style) ? trim : hex(shade(wall, 1.05));
  const s = spec.style;
  const rim = s === 'victorian' || s === 'edwardian' || s === 'sunset' || s === 'chinatown' ? trim : s === 'brick' ? BRICK_RIM : s === 'deco' || s === 'civic' ? CIVIC_RIM : coping;
  return { wall, wallHex, roof, coping, rim, trim, accent, win, winSeed: -(0.05 + 0.9 * R()), rand: R };
}

// ---------------------------------------------------------------------------
// street side
// ---------------------------------------------------------------------------

/** One side of the oriented rectangle: its mid point, outward direction, tangent and length. */
interface Side { x: number; z: number; dx: number; dz: number; tx: number; tz: number; len: number; yaw: number }

function side(r: Obb, axis: 'u' | 'v', s: number): Side {
  const [dx, dz, off, len] = axis === 'u' ? [r.ux * s, r.uz * s, r.hu, r.hv * 2] : [r.vx * s, r.vz * s, r.hv, r.hu * 2];
  return { x: r.cx + dx * off, z: r.cz + dz * off, dx, dz, tx: -dz, tz: dx, len, yaw: Math.atan2(dx, dz) };
}

/** The obb side facing the street (spec.front / CITY_FLAG.front0), else one of the short ends by seed. */
function frontSide(spec: CityBuildingSpec, r: Obb, rand: () => number): Side {
  const n = spec.poly.length;
  const fi = spec.front ?? (spec.flags & CITY_FLAG.front0 ? 0 : -1);
  if (fi >= 0 && fi < n) {
    const a = spec.poly[fi], b = spec.poly[(fi + 1) % n];
    const s = signedArea(spec.poly) >= 0 ? 1 : -1;
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = (s * (b.z - a.z)) / L, nz = (-s * (b.x - a.x)) / L;
    const du = nx * r.ux + nz * r.uz, dv = nx * r.vx + nz * r.vz;
    return Math.abs(du) >= Math.abs(dv) ? side(r, 'u', du >= 0 ? 1 : -1) : side(r, 'v', dv >= 0 ? 1 : -1);
  }
  return side(r, 'u', rand() < 0.5 ? 1 : -1);
}

/** The side after `f` going around the rectangle (for corner awnings). */
function nextSide(r: Obb, f: Side): Side {
  const onU = Math.abs(f.dx * r.ux + f.dz * r.uz) > 0.5;
  const s = onU ? (f.dx * r.ux + f.dz * r.uz > 0 ? 1 : -1) : (f.dx * r.vx + f.dz * r.vz > 0 ? 1 : -1);
  return onU ? side(r, 'v', s) : side(r, 'u', -s);
}

// ---------------------------------------------------------------------------
// parts
// ---------------------------------------------------------------------------

/** Box on a side, local x along the side, +z outward (origin at the side mid point, y absolute). */
const onSide = (f: Side, y: number, out = 0) => new Frame(f.x + f.dx * out, y, f.z + f.dz * out, f.yaw);

/** Victorian / Edwardian bay window: a protruding box with windows and a trim cap. */
function bay(b: BatchLike, f: Side, along: number, base: number, h: number, w: number, look: CityLook, info: Info, flatTop: boolean) {
  const fr = onSide(f, base + 0.6, 0.25);
  b.add(BOX(), fr.at(along, 0, 0, 0, w, h, 0.55), look.wall, info);
  b.add(BOX(), fr.at(along, h, 0, 0, w + (flatTop ? 0.3 : 0.2), 0.18, flatTop ? 0.85 : 0.7), look.trim);
}

/** Commercial ground floor: shop-glass band walls, trim ledge and a striped awning on the street side(s). */
function storefront(b: BatchLike, poly: Polygon, bottom: number, base: number, look: CityLook, sides: Side[]) {
  const shopWall = shade(look.wall, 0.94);
  b.walls(poly, bottom, base + 2.6, shopWall, winInfo(WIN.shop, base, look.winSeed), shade(shopWall, 0.75));
  b.walls(inset(poly, -0.05), base + 2.6, base + 2.8, look.trim);
  const stripe = look.rand() < 0.5 ? '#c9714f' : '#3a8a84';
  for (const f of sides) awning(b, f, base + 2.2, stripe);
}

/**
 * Striped awning along a side, same silhouette as the district's shop awnings (0.8 deep, sloping 20° down and
 * out) but as two quads per stripe (sloped top + front lip: 4 triangles instead of a 12-triangle box; the
 * follow camera is always above 2.2 u, so the underside never shows).
 */
function awning(b: BatchLike, f: Side, y: number, stripe: string) {
  const n = Math.max(1, Math.min(5, Math.floor(f.len / 1.1)));
  const o0 = -0.03, o1 = 0.73, yIn = y + 0.14, yOut = y - 0.14, lip = 0.12;
  const P = (a: number, o: number, yy: number) => v3(f.x + f.tx * a + f.dx * o, yy, f.z + f.tz * a + f.dz * o);
  const nTop = v3(f.dx * 0.34, 0.94, f.dz * 0.34).normalize(), nFront = v3(f.dx, 0, f.dz);
  const step = f.len / n;
  for (let k = 0; k < n; k++) {
    const a0 = -f.len / 2 + k * step + step * 0.02, a1 = a0 + step * 0.96;
    const c = k % 2 ? '#f6efe1' : stripe;
    b.quad(P(a0, o0, yIn), P(a1, o0, yIn), P(a1, o1, yOut), P(a0, o1, yOut), nTop, c);
    b.quad(P(a0, o1, yOut), P(a1, o1, yOut), P(a1, o1, yOut - lip), P(a0, o1, yOut - lip), nFront, shade(c, 0.9));
  }
}

/** Rooftop boxes only on roofs of at least this area (u²): the SF flat-roof city stays within the L0 budget. */
export const ROOF_CLUTTER_AREA = 20;

/**
 * SF flat top (lane C2-2's cheap flat-roof variant): a coping rim in the parapet colour and the inset membrane; the
 * mechanical boxes of shapes.ts flatRoof only on big roofs (`big`).
 */
function flatTop(b: BatchLike, poly: Polygon, y: number, coping: string, roof: string, clutter: number, big: boolean) {
  if (big) { flatRoof(b, poly, y, coping, roof, clutter); return; }
  b.polygon(poly, y, coping);
  b.polygon(inset(poly, 0.3), y + 0.02, roof);
}

function roofCap(b: BatchLike, spec: CityBuildingSpec, r: Obb, poly: Polygon, top: number, look: CityLook, info: Info, clutter: number, big: boolean) {
  if (spec.roof === 'gable') gableRoof(b, r, top, Math.min(2.2, 0.9 + r.hv * 0.55), look.roof, look.wallHex, info);
  else if (spec.roof === 'hip') hipRoof(b, r, top, Math.min(1.8, 0.7 + r.hv * 0.35), look.roof);
  else flatTop(b, poly, top, look.coping, look.roof, clutter, big);
}

// ---------------------------------------------------------------------------
// L0
// ---------------------------------------------------------------------------

/** Near-tier toy building (see file header). */
export function toyBuildingL0(b: BatchLike, spec: CityBuildingSpec) {
  const look = cityLook(spec);
  const R = look.rand;
  const poly = spec.poly;
  const base = spec.baseY, h = spec.H, top = base + h, bottom = base - WALL_SINK;
  const r = obb(poly);
  const front = frontSide(spec, r, R);
  const shop = (spec.flags & CITY_FLAG.shop) !== 0;
  const clutter = spec.flags & CITY_FLAG.noClutter ? 0 : R();
  const big = Math.abs(signedArea(poly)) >= ROOF_CLUTTER_AREA;
  const info = winInfo(look.win, base, look.winSeed);
  // offices / towers step back near the top (the outer walls stop at the setback)
  const tiered = (spec.style === 'tower' || (spec.style === 'office' && (h > 16 || (spec.flags & SF_FLAG.tall) !== 0))) && r.hu > 2.5 && r.hv > 2.5;
  const setback = tiered ? top - Math.min(spec.style === 'tower' ? 8 : 5, h * 0.22) : top;
  // walls: a storefront band under the upper floors, or full height
  const shopOn = shop && h > 3.4;
  if (shopOn) storefront(b, poly, bottom, base, look, spec.flags & CITY_FLAG.corner ? [front, nextSide(r, front)] : [front]);
  const upper = winInfo(look.win, shopOn ? base + 2.8 : base, look.winSeed);
  b.walls(poly, shopOn ? base + 2.6 : bottom, setback, look.wall, upper, shopOn ? undefined : shade(look.wall, 0.78));

  switch (spec.style) {
    case 'victorian':
    case 'edwardian': {
      const vic = spec.style === 'victorian';
      // eave trim (under a pitched roof; a flat roof's cornice covers it) + porch band (accent paint on some
      // Victorians, "painted ladies")
      if (spec.roof !== 'flat') b.walls(inset(poly, -0.04), top - 0.28, top - 0.05, look.trim);
      if (!shop) b.walls(inset(poly, -0.04), base + 2.45, base + 2.62, vic && R() < 0.35 ? look.accent : look.trim);
      // bay windows on the street side: one, or two on a wide front
      if (front.len > 2.2 && h > 3.2) {
        const two = front.len > 4.6;
        const w = two ? Math.min(1.8, front.len * 0.3) : Math.min(vic ? 1.8 : 2.4, front.len * (vic ? 0.55 : 0.6));
        const y0 = shop ? base + 2.2 : base;
        const bh = top - y0 - (spec.roof === 'flat' ? 1.0 : 1.2);
        for (const a of two ? [-front.len / 4, front.len / 4] : [0]) bay(b, front, a, y0, bh, w, look, upper, !vic);
      }
      if (spec.roof === 'flat') {
        // Italianate / Edwardian false front: a projecting cornice ring, then the roof
        b.walls(inset(poly, -0.14), top - 0.4, top, look.trim);
        flatTop(b, inset(poly, -0.14), top, look.trim, look.roof, clutter, big);
      } else roofCap(b, spec, r, poly, top, look, info, clutter, big);
      break;
    }
    case 'sunset': {
      // Sunset "Doelger": garage door, tile eyebrow over the big window, cream parapet
      if (!shop && front.len > 1.8) {
        const fr = onSide(front, base, 0.02);
        const along = (R() < 0.5 ? -1 : 1) * front.len * 0.18;
        b.add(BOX(), fr.at(along, 0, 0, 0, Math.min(1.7, front.len * 0.45), Math.min(1.9, h * 0.4), 0.06), shade(look.wall, 0.86), [WIN.none, base, 0, 0]);
        if (h > 3.6) b.add(CBOX(), onSide(front, base + Math.min(h - 0.8, 4.3), 0.2).at(0, 0, 0, 0, front.len * 0.8, 0.22, 0.4, 0.3), look.accent);
      }
      if (spec.roof === 'flat') {
        b.walls(inset(poly, -0.04), top - 0.3, top + 0.3, look.trim);
        flatTop(b, poly, top + 0.3, look.trim, look.roof, clutter, big);
      } else {
        b.walls(inset(poly, -0.04), top - 0.25, top, look.trim);
        roofCap(b, spec, r, poly, top, look, info, clutter, big);
      }
      break;
    }
    case 'marina': {
      // Mediterranean stucco: iron balcony on the street side, relief band, tile roof
      if (h > 4.5 && front.len > 1.6) b.add(BOX(), onSide(front, base + 3.1, 0.3).at(0, 0, 0, 0, front.len * 0.7, 0.14, 0.6), IRON);
      b.walls(inset(poly, -0.04), top - 0.25, top, look.trim);
      roofCap(b, spec, r, poly, top, look, info, clutter, big);
      break;
    }
    case 'chinatown': {
      // painted balcony bands at each floor, accent parapet, sometimes a green pagoda-roof pavilion
      for (let y = base + 5.3; y < top - 1.2; y += 2.5) b.walls(inset(poly, -0.1), y, y + 0.16, look.accent);
      b.walls(inset(poly, -0.05), top - 0.35, top + 0.25, look.accent);
      flatTop(b, poly, top + 0.25, look.trim, look.roof, spec.flags & CITY_FLAG.noClutter ? 0 : 0.2, big);
      const pr = obb(inset(poly, 0.9));
      if (R() < 0.35 && pr.hu > 1.2 && pr.hv > 1.0) {
        b.add(BOX(), new Frame(pr.cx, top + 0.25, pr.cz, Math.atan2(pr.ux, pr.uz)).at(0, 0, 0, 0, pr.hv * 1.4, 0.9, pr.hu * 1.4), look.wallHex, [WIN.none, top, 0, 0]);
        hipRoof(b, { ...pr, hu: pr.hu * 0.85, hv: pr.hv * 0.85 }, top + 1.15, Math.min(1.2, 0.5 + pr.hv * 0.3), '#2f7d5a');
      }
      break;
    }
    case 'brick': {
      // SoMa warehouse: stone cornice band, flat roof with clutter
      b.walls(inset(poly, -0.06), top - 0.45, top + 0.15, look.trim);
      flatTop(b, poly, top + 0.15, look.rim, look.roof, clutter, big);
      break;
    }
    case 'industrial':
    case 'pier': {
      // sheds and warehouses (cargo doors + clerestory from TOY style 8): trim band, gable with a skylight
      // ridge like the district's pier sheds, or a flat roof with clutter
      b.walls(inset(poly, -0.03), Math.max(base + 1, top - 0.8), Math.max(base + 1.2, top - 0.45), look.trim);
      if (spec.roof === 'flat') { flatTop(b, poly, top, look.coping, look.roof, clutter, big); break; }
      const rise = Math.min(1.6, r.hv * 0.3);
      gableRoof(b, r, top, rise, look.roof, look.wallHex, [WIN.none, 0, 0, 0], 0.25);
      if (r.hu > 3) b.add(BOX(), new Frame(r.cx, top + rise, r.cz, Math.atan2(r.ux, r.uz)).at(0, -0.1, 0, 0, 0.9, 0.55, r.hu * 1.7), '#dfe6e2', [WIN.none, 0, 0, 1.12]);
      break;
    }
    case 'deco':
    case 'civic': {
      // stepped crown; civic buildings get a heavier cornice and a second, narrower step. A pitched civic building
      // (church, hall, school: the look keeps lane A's roof) gets its roof, as on L1
      const civic = spec.style === 'civic';
      if (spec.roof !== 'flat') {
        b.walls(inset(poly, -0.05), top - 0.3, top, look.trim);
        roofCap(b, spec, r, poly, top, look, info, clutter, big);
        break;
      }
      b.walls(inset(poly, civic ? -0.12 : -0.05), top - (civic ? 0.6 : 0.35), top, look.trim);
      flatTop(b, civic ? inset(poly, -0.12) : poly, top, look.rim, look.roof, clutter, big);
      const up = inset(poly, 0.9);
      if (r.hu > 1.5 && r.hv > 1.5) {
        b.walls(up, top, top + 1.1, look.wall, upper); b.polygon(up, top + 1.1, look.trim);
        const up2 = inset(up, 1.2);
        if (civic && r.hu > 3 && r.hv > 3) { b.walls(up2, top + 1.1, top + 2.3, look.wall, upper); b.polygon(up2, top + 2.3, look.trim); }
      }
      break;
    }
    case 'residential': {
      // the district's plain residential lot: trim + hip / gable, or a flat roof
      if (spec.roof === 'hip') b.walls(inset(poly, -0.05), top - 0.25, top, look.trim);
      if (spec.roof === 'gable') gableRoof(b, r, top, Math.min(2, 0.8 + r.hv * 0.5), look.roof, look.wallHex, info);
      else roofCap(b, spec, r, poly, top, look, info, clutter, big);
      break;
    }
    default: { // office, tower: setback tier, a crown on some, roof boxes; towers add a penthouse (+ a mast when tall)
      if (!tiered) { flatTop(b, poly, top, look.coping, look.roof, clutter, big); break; }
      flatRoof(b, poly, setback, look.coping, look.roof, 0.1);
      const up = inset(poly, 1.1);
      b.walls(up, setback, top, look.wall, upper);
      if (R() < (spec.style === 'tower' ? 0.25 : 0.1)) b.walls(inset(up, -0.06), top - 1.1, top + 0.25, look.accent);
      flatRoof(b, up, top, look.coping, look.roof, clutter);
      if (spec.style === 'tower') {
        const pr = obb(inset(up, 1.2));
        const fr = new Frame(pr.cx, top, pr.cz, Math.atan2(pr.ux, pr.uz));
        b.add(BOX(), fr.at(0, 0, 0, 0, Math.max(1, pr.hv * 1.2), 1.8, Math.max(1, pr.hu * 1.2)), shade(look.wall, 0.95), [WIN.none, top, 0, 0]);
        if (h > 35) b.beam(v3(pr.cx, top + 1.8, pr.cz), v3(pr.cx, top + 1.8 + Math.min(8, h * 0.15), pr.cz), 0.18, 0.18, '#9aa3a4', [0, 0, 0, 0.6]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// L1
// ---------------------------------------------------------------------------

/** Massing-tier toy building: oriented box + cap (8–14 triangles), same look as L0. */
export function toyBuildingL1(b: BatchLike, spec: CityBuildingSpec) {
  const look = cityLook(spec);
  const r = obb(spec.poly);
  const base = spec.baseY, top = base + spec.H, bottom = base - WALL_SINK;
  const P = (u: number, v: number) => ({ x: r.cx + r.ux * u + r.vx * v, z: r.cz + r.uz * u + r.vz * v });
  const box = [P(-r.hu, -r.hv), P(r.hu, -r.hv), P(r.hu, r.hv), P(-r.hu, r.hv)];
  const info = winInfo(look.win, base, look.winSeed);
  b.walls(box, bottom, top, look.wall, info, shade(look.wall, 0.8));
  if (spec.roof === 'gable' && !TALL(spec.style)) {
    const rise = Math.min(2.2, 0.9 + r.hv * 0.55);
    const A = v3(P(-r.hu, 0).x, top + rise, P(-r.hu, 0).z), B = v3(P(r.hu, 0).x, top + rise, P(r.hu, 0).z);
    for (const s of [-1, 1]) {
      const a = P(-r.hu, s * r.hv), c = P(r.hu, s * r.hv);
      b.quad(v3(a.x, top, a.z), v3(c.x, top, c.z), B, A, new THREE.Vector3(r.vx * s * rise, r.hv, r.vz * s * rise).normalize(), look.roof);
      const g = P(s * r.hu, -r.hv), g2 = P(s * r.hu, r.hv);
      b.tri(v3(g.x, top, g.z), v3(g2.x, top, g2.z), s > 0 ? B : A, look.wallHex, info, v3(r.ux * s, 0, r.uz * s));
    }
  } else if (spec.roof === 'hip' && !TALL(spec.style)) {
    hipRoof(b, r, top, Math.min(1.8, 0.7 + r.hv * 0.35), look.roof);
  } else {
    // seen from the hills L0's flat top is the rim (0.3 u) around the membrane: blend both by area so the tier swap
    // keeps the same roof tone
    const inner = (d: number) => (Math.max(0, 2 * r.hu - 2 * d) * Math.max(0, 2 * r.hv - 2 * d)) / Math.max(1e-6, 4 * r.hu * r.hv);
    let cap = mixColor(look.roof, look.rim, 1 - inner(0.3));
    // deco / civic: L0's stepped crown (trim-capped, 0.9 u in) covers the middle of the roof
    if ((spec.style === 'deco' || spec.style === 'civic') && r.hu > 1.5 && r.hv > 1.5) cap = mixColor(cap, look.trim, inner(0.9));
    b.polygon(box, top, TALL(spec.style) ? look.roof : cap);
  }
}
