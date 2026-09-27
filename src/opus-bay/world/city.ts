import * as THREE from 'three';
import type { PierDef } from '../core/types';
import { heightAt } from '../core/terrain';
import { DISTRICT } from '../data/district';
import { BOX, type BatchLike, Frame, TORUS, inset, shade } from './builder';
import type { LabelAtlas, LabelBatch } from './labels';
import { PAL } from './palette';
import { districtBuilding } from './recipes/district';
import { WIN, gableRoof, obb, winInfo } from './recipes/shapes';

/**
 * City blocks (239 lots merged by the toy material) and the numbered pier sheds with their
 * Beaux-Arts bulkhead facades. Window patterns are procedural (materials.ts), keyed by aInfo.x.
 * The building recipes live in recipes/ (shared with the streamed city); this file assembles the district.
 */

/** Re-exported for world/landmarks.ts (the recipes moved to recipes/shapes.ts). */
export { gableRoof, obb };

// ---------------------------------------------------------------------------
// Pier sheds + bulkhead facades
// ---------------------------------------------------------------------------

const SHED_WALL = '#e7ddca';
const FACADE = '#ece3d1';
const TRIM = PAL.shedTrim;
const CORNICE = '#f6efe1';
const DOOR = '#56655f';

function archShape(w: number, h: number): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.lineTo(-r, 0);
  return new THREE.ShapeGeometry(s, 10);
}
const archCache = new Map<string, THREE.ShapeGeometry>();
function arch(w: number, h: number) {
  const k = `${w.toFixed(2)}-${h.toFixed(2)}`;
  let g = archCache.get(k);
  if (!g) { g = archShape(w, h); archCache.set(k, g); }
  return g;
}

function facade(b: BatchLike, labels: LabelBatch, atlas: LabelAtlas, pier: PierDef) {
  const shed = pier.shed!;
  const f = shed.facade!;
  const H = shed.height;
  const w = f.width + 0.9;
  const fr = new Frame(f.x, 0, f.z, f.rotationY);
  const exploratorium = pier.id === 'pier15';
  const body = exploratorium ? '#e3e0d6' : FACADE;
  // main block (slightly taller than the shed) + parapet with a pediment
  b.add(BOX(), fr.at(0, 0, -0.25, 0, w, H + 1.4, 1.5), body, winInfo(WIN.none, 0));
  b.add(BOX(), fr.at(0, H + 1.4, -0.2, 0, w + 0.3, 0.3, 1.7), CORNICE);
  b.add(BOX(), fr.at(0, H + 1.7, -0.25, 0, w * 0.46, 1.1, 1.4), body);
  b.add(BOX(), fr.at(0, H + 2.8, -0.25, 0, w * 0.5, 0.22, 1.55), CORNICE);
  b.add(BOX(), fr.at(0, 0, 0.52, 0, w + 0.15, 0.55, 0.15), shade(body, 0.85));
  // pilasters
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25, -w * 0.22, w * 0.22]) b.add(BOX(), fr.at(x, 0.5, 0.5, 0, 0.42, H + 0.8, 0.14), TRIM);
  // central arch (door) + side windows
  const aw = Math.min(3.6, w * 0.34), ah = Math.min(H * 0.72, aw * 1.6);
  b.add(arch(aw, ah), fr.at(0, 0.02, 0.535), exploratorium ? '#5d7a86' : DOOR, [7, 0, 0, 0]);
  b.add(TORUS(1, 0.09, 4, 12, Math.PI), fr.at(0, ah - aw / 2, 0.56, 0, aw / 2 + 0.06, aw / 2 + 0.06, 1), CORNICE);
  for (const s of [-1, 1]) b.add(BOX(), fr.at(s * (aw / 2 + 0.06), 0, 0.56, 0, 0.13, ah - aw / 2, 0.1), CORNICE);
  for (const s of [-1, 1]) {
    const x = s * w * 0.36;
    b.add(arch(Math.min(1.5, w * 0.14), Math.min(2.6, H * 0.36)), fr.at(x, H * 0.42, 0.535), exploratorium ? '#6f8f99' : '#61706a');
  }
  // painted "PIER n" plaque on the pediment
  const key = `pier:${pier.label}`;
  const rect = atlas.label(key, { text: pier.label, w: 256, h: 72, bg: '#f4ecd9', fg: '#3f5750', font: 'serif', border: '#7f9c8f', size: 0.62 });
  const plaque = fr.point(0, H + 2.25, 0.46);
  labels.facing(plaque.x, plaque.y, plaque.z, f.rotationY, Math.min(w * 0.44, 3.4), 0.95, rect);
  if (exploratorium) {
    const r2 = atlas.label('exploratorium', { text: 'EXPLORATORIUM', w: 384, h: 56, bg: '#3f5963', fg: '#f3efe6', font: 'sans', size: 0.5 });
    const p = fr.point(0, H * 0.25 + ah * 0.55, 0.62);
    labels.facing(p.x, p.y + 1.3, p.z, f.rotationY, Math.min(w * 0.7, 5.6), 0.8, r2);
  }
}

function shed(b: BatchLike, pier: PierDef) {
  const s = pier.shed!;
  const poly = s.footprint;
  const H = s.height;
  const style = pier.id === 'pier15' ? WIN.glass : WIN.shed;
  b.walls(poly, -0.3, H, SHED_WALL, winInfo(style, style === WIN.shed ? 0 : 0.8), shade(SHED_WALL, 0.72));
  // clerestory trim band + base band
  b.walls(inset(poly, -0.03), H - 0.8, H - 0.45, TRIM);
  b.walls(inset(poly, -0.03), 0, 0.5, shade(TRIM, 0.85));
  const r = obb(poly);
  gableRoof(b, r, H, Math.min(1.6, r.hv * 0.3), PAL.shedRoof, SHED_WALL, winInfo(WIN.none, 0), 0.25);
  // skylight ridge
  const f = new Frame(r.cx, H + Math.min(1.6, r.hv * 0.3), r.cz, Math.atan2(r.ux, r.uz));
  b.add(BOX(), f.at(0, -0.1, 0, 0, 0.9, 0.55, r.hu * 1.7), '#dfe6e2', [WIN.none, 0, 0, 1.12]);
}

export function buildCity(b: BatchLike, labels: LabelBatch, atlas: LabelAtlas) {
  DISTRICT.blocks.forEach((lot, i) => districtBuilding(b, lot, i, heightAt));
  for (const pier of DISTRICT.piers) {
    if (!pier.shed) continue;
    shed(b, pier);
    if (pier.shed.facade) facade(b, labels, atlas, pier);
  }
}
