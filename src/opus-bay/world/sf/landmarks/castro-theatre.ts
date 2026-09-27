import type { BatchLike } from '../../builder';
import { GLOW, LIT, NONE, SELF, arch, box, cbox, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Castro Theatre (T2), 1922: the Spanish-Colonial movie palace on Castro St — the ornate stepped facade with its
 * tall arched window, the vertical blade sign and the V-shaped marquee. Signs are generic (bulbs and colour
 * bands, no lettering). Local +z = the Castro St facade (east, yaw 140.3° from OSM way 1206216224); 21.7 m
 * (LiDAR max, the blade sign) → H 6.6 u, facade 5.3 u.
 */

const X0 = 151.78, Z0 = 741.3, YAW = (140.3 * Math.PI) / 180;
const STUCCO = '#f0dfc2', ORNATE = '#e2c79c', RED = '#b8402f', BULB = '#ffe7a8';
const ZF = 3.54;

function build(b: BatchLike, lod: 0 | 2) {
  // auditorium box + raised facade block with a stepped baroque parapet
  box(b, 0, -1.2, -0.2, 4.2, 5.4, 7.0, '#e3d3b8', NONE);
  box(b, 0, -1.2, ZF - 0.35, 4.3, 6.2, 0.7, STUCCO, GLOW(0.1));
  box(b, 0, 5.0, ZF - 0.35, 2.6, 0.55, 0.7, STUCCO, GLOW(0.1));
  box(b, 0, 5.55, ZF - 0.35, 1.3, 0.45, 0.7, STUCCO, GLOW(0.1));
  // blade sign (perpendicular to the facade, over the marquee) — the far silhouette
  box(b, 0, 2.4, ZF + 0.45, 0.24, 4.3, 0.9, RED, GLOW(0.5));
  if (lod === 2) return;
  box(b, 0, 6.7, ZF + 0.45, 0.3, 0.3, 0.3, BULB, SELF(1.3));
  for (let y = 2.6; y < 6.6; y += 0.36) for (const sz of [-0.46, 0.46]) cbox(b, 0, y, ZF + 0.45 + sz, 0.28, 0.08, 0.04, BULB, SELF(1.4));
  for (const sx of [-0.14, 0.14]) box(b, sx, 2.7, ZF + 0.45, 0.02, 3.7, 0.55, '#f3e3c2', GLOW(0.8));
  // ornate facade: tall central arched window, flanking pilasters, cornice, finial urns
  arch(b, 0, 2.95, ZF + 0.02, 1.2, 1.85, 0, '#4a5a66', LIT(2.95));
  for (const sx of [-1, 1]) {
    box(b, sx * 1.45, 0.2, ZF + 0.04, 0.32, 4.7, 0.12, ORNATE, NONE);
    box(b, sx * 1.9, 4.9, ZF - 0.35, 0.3, 0.6, 0.3, ORNATE, NONE);
    arch(b, sx * 1.45, 3.4, ZF + 0.11, 0.45, 0.9, 0, '#4a5a66', LIT(3.4));
  }
  box(b, 0, 4.85, ZF + 0.04, 4.3, 0.18, 0.2, ORNATE, NONE);
  cbox(b, 0, 6.1, ZF - 0.02, 0.5, 0.25, 0.25, ORNATE, NONE);
  // V-shaped marquee (two angled panels) with bulb rows, and the lit entrance doors
  for (const sx of [-1, 1]) {
    cbox(b, sx * 0.95, 2.05, ZF + 0.8, 2.1, 0.62, 0.14, '#f5ecd8', GLOW(0.9), sx * 0.42);
    cbox(b, sx * 0.95, 2.42, ZF + 0.83, 2.14, 0.1, 0.18, RED, NONE, sx * 0.42);
    cbox(b, sx * 0.95, 1.7, ZF + 0.83, 2.14, 0.1, 0.18, RED, NONE, sx * 0.42);
  }
  box(b, 0, 1.72, ZF + 0.6, 3.4, 0.08, 1.2, '#d8c9ad', NONE);
  box(b, 0, 0, ZF + 0.02, 2.4, 1.6, 0.05, '#6b3d2f', LIT(0));
  box(b, 0, 0, ZF + 0.3, 0.8, 1.0, 0.5, '#e7d6b8', NONE);
}

export const castroTheatre: SfLandmark = {
  id: 'castro-theatre',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, 4.6, 7.4)) },
  build,
  walk: { blockers: [{ poly: rect(0, -0.2, 4.2, 7.0) }, { poly: rect(0, ZF + 0.3, 0.8, 0.5) }] },
};
