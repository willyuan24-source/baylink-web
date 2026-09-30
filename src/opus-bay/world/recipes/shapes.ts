import * as THREE from 'three';
import type { Polygon } from '../../core/types';
import { BOX, type BatchLike, Frame, type Info, inset, longestEdge, shade, v3 } from '../builder';

/**
 * Building parts shared by the district and the streamed city (moved from world/city.ts unchanged, now over
 * BatchLike): the procedural-window style ids, the oriented bounding rectangle and the three roof shapes.
 * Pure and worker-safe (three core math only).
 */

/** TOY window styles (aInfo.x, see materials.ts TOY_FRAG). */
export const WIN = { none: 0, res: 1, office: 2, shop: 3, brick: 4, victorian: 5, glass: 6, shed: 8, prewar: 9, chinatown: 10 } as const;
/** aInfo for a wall with procedural windows: style, base height (window floors start there), building seed (< 0). */
export const winInfo = (style: number, base: number, seed = 0): Info => [style, base, seed, 0];

export type Obb = ReturnType<typeof obb>;

/** Oriented bounding rectangle of a polygon along its longest edge. */
export function obb(poly: Polygon) {
  const e = longestEdge(poly);
  const ux = e.dx, uz = e.dz, vx = -uz, vz = ux;
  let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (const p of poly) {
    const u = p.x * ux + p.z * uz, w = p.x * vx + p.z * vz;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w);
  }
  const cu = (u0 + u1) / 2, cw = (w0 + w1) / 2;
  return { cx: cu * ux + cw * vx, cz: cu * uz + cw * vz, ux, uz, vx, vz, hu: (u1 - u0) / 2, hv: (w1 - w0) / 2 };
}

/** Gable roof over a rectangle: ridge along u. */
export function gableRoof(b: BatchLike, r: Obb, y: number, rise: number, roof: string, gableWall: string, info: Info, over = 0.22) {
  const { cx, cz, ux, uz, vx, vz } = r;
  const hu = r.hu + over, hv = r.hv + over;
  const P = (u: number, v: number, yy: number) => v3(cx + ux * u + vx * v, yy, cz + uz * u + vz * v);
  const ridgeA = P(-hu, 0, y + rise), ridgeB = P(hu, 0, y + rise);
  const eaveY = y - over * (rise / hv);
  for (const s of [-1, 1]) {
    const a = P(-hu, s * hv, eaveY), bb = P(hu, s * hv, eaveY);
    const n = new THREE.Vector3(vx * s * rise, hv, vz * s * rise).normalize();
    b.quad(a, bb, ridgeB, ridgeA, n, [shade(roof, 0.9), shade(roof, 0.9), roof, roof], [0, 0, 0, 0]);
    // underside of the overhang (dark)
    b.quad(a, bb, P(hu, s * (hv - over), y), P(-hu, s * (hv - over), y), n.clone().negate(), shade(roof, 0.45), [0, 0, 0, 0]);
  }
  // gable triangles (walls)
  for (const s of [-1, 1]) {
    const n = v3(ux * s, 0, uz * s);
    b.tri(P(s * r.hu, -r.hv, y), P(s * r.hu, r.hv, y), P(s * r.hu, 0, y + rise * (r.hv / hv)), gableWall, info, n);
  }
}

/** Hip roof (pyramid-ish) over a rectangle. */
export function hipRoof(b: BatchLike, r: Obb, y: number, rise: number, roof: string) {
  const { cx, cz, ux, uz, vx, vz } = r;
  const hu = r.hu + 0.2, hv = r.hv + 0.2;
  const P = (u: number, v: number, yy: number) => v3(cx + ux * u + vx * v, yy, cz + uz * u + vz * v);
  const ridge = Math.max(0, hu - hv);
  const top = y + rise;
  const A = P(-hu, -hv, y), B = P(hu, -hv, y), Cc = P(hu, hv, y), D = P(-hu, hv, y);
  const R1 = P(-ridge, 0, top), R2 = P(ridge, 0, top);
  const up = (n: THREE.Vector3) => n.normalize();
  b.quad(A, B, R2, R1, up(v3(-vx * rise, hv, -vz * rise)), roof);
  b.quad(Cc, D, R1, R2, up(v3(vx * rise, hv, vz * rise)), shade(roof, 0.93));
  b.tri(B, Cc, R2, shade(roof, 0.88), [0, 0, 0, 0], up(v3(ux * rise, hu - ridge, uz * rise)));
  b.tri(D, A, R1, shade(roof, 0.96), [0, 0, 0, 0], up(v3(-ux * rise, hu - ridge, -uz * rise)));
}

/** Flat roof: coping + inset membrane + one or two mechanical boxes on big roofs. */
export function flatRoof(b: BatchLike, poly: Polygon, y: number, coping: string, roof: string, seed: number) {
  b.polygon(poly, y, coping);
  const inner = inset(poly, 0.3);
  b.polygon(inner, y + 0.02, roof);
  // rooftop clutter: one or two mechanical boxes
  const r = obb(inner);
  if (r.hu > 1.6 && r.hv > 1.2) {
    const f = new Frame(r.cx + r.ux * r.hu * 0.3 * (seed - 0.5), y, r.cz + r.uz * r.hu * 0.3 * (seed - 0.5), Math.atan2(r.ux, r.uz));
    b.add(BOX(), f.at(0, 0, 0, 0, Math.min(1.6, r.hv), 0.7, Math.min(2.2, r.hu * 0.6)), shade(roof, 1.08));
    if (seed > 0.6) b.add(BOX(), f.at(r.hv * 0.4, 0, r.hu * 0.4, 0, 0.6, 1.1, 0.6), '#9aa3a4');
  }
}
