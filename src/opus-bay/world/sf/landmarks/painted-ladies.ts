import type { BatchLike } from '../../builder';
import { GLOW, LIT, NONE, SF, WIN, box, flowerBed, gable, pyramid, rect, shade, worldPoly } from './kit';
import type { SfLandmark, WalkBlocker } from './index';

/**
 * Painted Ladies (T2): the seven Victorian row houses at 710–722 Steiner Street, facing Alamo Square (local +z =
 * west across Steiner St, yaw −37.7° from the OSM footprints ways 261412896…261412887). 710 sits at the Hayes St
 * (south, uphill, local +x) end, 722 at the Grove St end. Real lots are 25 ft (1.04 u); the toy row keeps the real
 * row centre and widens each house to 1.6 u so the steep gables read (the city's merged lots are 3.5–6 u). Height
 * 12–13 m → H = 3.2 + 0.155·12 ≈ 5.1 u (plan §2.3). Each house stands on the DEM street grade (terrainY, base 13.4:
 * 722 +0.23 … 710 +1.71 u), which gives the stepped roofline of the postcard view.
 */

const SPACING = 1.6, W = 1.5, D = 3.4;
/** 710 … 722 (local x from +4.8 to −4.8), pastel bodies + trim accents, ground offset from the DEM */
const HOUSES: { n: number; body: string; accent: string; y: number; hip?: boolean }[] = [
  { n: 710, body: '#e8c6cf', accent: '#b0667a', y: 1.71 },
  { n: 712, body: '#c9d6e8', accent: '#5c7aa3', y: 1.48 },
  { n: 714, body: '#f4e2a8', accent: '#b98a3e', y: 1.23 },
  { n: 716, body: '#cfe0d0', accent: '#5f8f6d', y: 1.01 },
  { n: 718, body: '#f2c9b1', accent: '#c46e4c', y: 0.75 },
  { n: 720, body: '#d8cfe8', accent: '#7c6aa6', y: 0.45 },
  { n: 722, body: '#b9c7a0', accent: '#6f7f4f', y: 0.23, hip: true },
];
const houseX = (i: number) => (3 - i) * SPACING;
const TRIM = SF.white;
const X0 = 10.19, Z0 = 570.35, YAW = (-37.7 * Math.PI) / 180;

function house(b: BatchLike, i: number, lod: 0 | 2) {
  const h = HOUSES[i], x = houseX(i), y0 = h.y;
  const zf = D / 2 - 0.4; // front facade line (local z)
  const eave = y0 + 4.0, roofRise = h.hip ? 1.2 : 1.9;
  box(b, x, y0 - 1.6, -0.4, W, eave - y0 + 1.6, D, h.body, lod === 0 ? WIN(5, y0 + 0.7, 11 + i) : NONE);
  if (h.hip) pyramid(b, x, eave, -0.4, W + 0.25, D + 0.25, roofRise, SF.slate);
  else gable(b, x, eave, -0.4, D + 0.2, W, roofRise, '#7b7069', h.body, Math.PI / 2, 0.18);
  if (lod === 2) return;
  // raised basement / garage level, floor bands and the cornice
  box(b, x, y0 - 0.02, zf + 0.02, W + 0.02, 0.7, 0.05, shade(h.body, 0.82), NONE);
  box(b, x - 0.33, y0, zf + 0.04, 0.55, 0.62, 0.04, '#6c5a4e', NONE);
  for (const yy of [y0 + 0.7, y0 + 2.35, eave - 0.18]) box(b, x, yy, zf + 0.05, W + 0.06, 0.13, 0.08, TRIM, NONE);
  // three-sided bay window stack on the uphill side, with its own little roof
  box(b, x + 0.3, y0 + 0.8, zf + 0.22, 0.72, 2.95, 0.42, h.body, WIN(5, y0 + 0.8, 21 + i));
  box(b, x + 0.3, y0 + 3.75, zf + 0.24, 0.84, 0.14, 0.5, TRIM, NONE);
  // stoop (steps up to the door) and the door
  for (let s = 0; s < 3; s++) box(b, x - 0.38, y0 - 0.3 + s * 0.24, zf + 0.62 - s * 0.2, 0.5, 0.24, 0.26, '#d9cfc0', NONE);
  box(b, x - 0.38, y0 + 0.72, zf + 0.03, 0.36, 0.9, 0.05, h.accent, LIT(y0 + 0.72));
  // decorative gable: accent panel + white bargeboards and a finial (the "gingerbread")
  if (!h.hip) {
    box(b, x, eave + 0.05, zf + 0.12, W * 0.55, 0.7, 0.06, h.accent, NONE);
    box(b, x, eave + roofRise - 0.05, zf + 0.12, 0.08, 0.45, 0.08, TRIM, NONE);
  } else {
    // 722's corner turret cap
    box(b, x + 0.35, eave - 0.2, zf + 0.05, 0.7, 0.6, 0.7, h.body, NONE);
    pyramid(b, x + 0.35, eave + 0.4, zf + 0.05, 0.8, 0.8, 1.0, SF.slate);
  }
  // front garden strip with a clipped hedge
  flowerBed(b, x + 0.35, y0 - 0.05, zf + 0.75, 0.8, 0.4, 3 + i);
}

function build(b: BatchLike, lod: 0 | 2) {
  for (let i = 0; i < HOUSES.length; i++) house(b, i, lod);
  if (lod === 2) return;
  // sidewalk + low retaining curb along Steiner St, the lamp posts of the postcard shot
  for (let i = 0; i < HOUSES.length; i++) box(b, houseX(i), HOUSES[i].y - 0.4, D / 2 + 0.25, SPACING, 0.42, 1.0, '#dcd3c3', NONE);
  for (const x of [-4.6, 0.2, 4.9]) {
    const y = HOUSES[Math.max(0, Math.min(6, Math.round(3 - x / SPACING)))].y - 0.05;
    box(b, x, y, D / 2 + 0.62, 0.1, 2.5, 0.1, '#3f5a50', NONE);
    box(b, x, y + 2.5, D / 2 + 0.62, 0.28, 0.3, 0.28, '#fff1cf', GLOW(0.9));
  }
}

const blockers: WalkBlocker[] = HOUSES.map((_, i) => ({ poly: rect(houseX(i), -0.4, W, D) }));

export const paintedLadies: SfLandmark = {
  id: 'painted-ladies',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 13.4,
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, -0.1, 12, 5.2)) },
  build,
  walk: { blockers },
};

export const PAINTED_LADIES = HOUSES;
