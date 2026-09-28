import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { DISTRICT } from '../../data/district';
import { Batch, CBOX, CONE, CYL, Frame, ICO, type Info, hash2, mixColor, splitGeometryCells } from '../builder';
import { buildCity } from '../city';
import { LabelBatch, type LabelAtlas } from '../labels';
import { PAL } from '../palette';
import { gardenPlantings } from '../props';

/**
 * Wave 5 · the hero district's far detail (lane V, W5-V2; plan MF9 "room first", "a far stand-in for the hand-made
 * district buildings"). City mode only (the city chunk). The hand-made district's toy geometry (≈ 122k triangles) is
 * mostly street furniture, not buildings: the lots, pier sheds and facades are 16.6k of it; palms 21k, the seawall
 * curbs, bollards and chains 19k, pier pilings and railings 17k, lamps 5k, the F-line wires 5.5k, benches, bins,
 * garden bushes and the rest the remainder. Seen from beyond ≈ 150 u (the streamed city's own L0 → L1 distance) that
 * detail is a few pixels wide, so each 150 u tile of the district swaps to its far chunk there:
 *
 *   - the SAME buildings (buildCity: every lot, pier shed and bulkhead facade, triangle for triangle, so the skyline and
 *     the near / far seam never change),
 *   - palms, trees and bushes as simple stand-ins in their own colours and sway (a trunk and six fronds, one crown, one
 *     blob), at the same spots,
 *   - no benches, lamps, bollards, chains, curbs, railings, pilings, wires, bins or signs.
 *
 * ≈ 24k triangles for the whole district. The streamer (stream.ts, `hero.tiles`) switches tile by tile with the C2-10
 * dither cross-fade; district mode never builds any of this.
 */

/** The far chunks' grid (the World splits the near toy geometry on the same 150 u grid: world.ts CHUNK). */
export const HERO_TILE_CELL = 150;

const sway = (base: number, height: number, k = 1) => (_x: number, y: number): Info => [0, 0, Math.max(0, Math.min(1, (y - base) / height)) * k, 0];

/** A palm seen from afar: the near palm's height, trunk and crown colours, six one-segment fronds (≈ 100 triangles). */
export function farPalm(b: Batch, x: number, z: number, s: number, seed: number) {
  const y0 = heightAt(x, z);
  const H = 4.3 * s;
  const f = new Frame(x, y0, z, seed * 6.28);
  b.add(CYL(5, 0.78), f.at(0, 0, 0, 0, 0.36 * s, H, 0.36 * s), '#98795a', [0, 0, 0.12, 0]);
  b.add(ICO(0), f.at(0, H + 0.05, 0, 0, 0.5 * s, 0.42 * s, 0.5 * s), '#7a6a3c', sway(y0, H, 0.9));
  for (let i = 0; i < 6; i++) {
    const yaw = (i / 6) * Math.PI * 2 + seed;
    const len = (1.7 + hash2(i, seed * 9) * 0.4) * s, pitch = i % 2 ? -0.05 : -0.3;
    const dx = Math.sin(yaw) * Math.cos(pitch) * len, dy = Math.sin(pitch) * len, dz = Math.cos(yaw) * Math.cos(pitch) * len;
    b.add(CBOX(), f.at(dx / 2, H + 0.15 * s + dy / 2, dz / 2, yaw, 0.46 * s, 0.05, len, -pitch), mixColor('#5d8a42', '#86ae57', 0.35 + hash2(i, seed) * 0.3), sway(y0, H, 1));
  }
}

/** A tree seen from afar: the near tree's trunk and one crown where its three blobs are (a pine: one cone). */
export function farTree(b: Batch, x: number, z: number, s: number, seed: number) {
  const y0 = heightAt(x, z);
  const f = new Frame(x, y0, z, seed * 6.28);
  if (y0 > 4 && hash2(x, z) > 0.45) {
    const H = 3.6 * s;
    b.add(CYL(4), f.at(0, 0, 0, 0, 0.14 * s, H * 0.4, 0.14 * s), '#6b4f36');
    b.add(CONE(6), f.at(0, H * 0.25, 0, 0, 1.15 * s, 3.2 * s, 1.15 * s), mixColor(PAL.pine, '#3f6340', hash2(seed, 1)), sway(y0, H * 1.2, 0.5));
    return;
  }
  const H = 1.5 * s;
  b.add(CYL(4, 0.8), f.at(0, 0, 0, 0, 0.16 * s, H + 0.4, 0.16 * s), '#7a5a3e');
  b.add(ICO(0), f.at(0.03 * s, (H + 0.8) * s, -0.02 * s, 0, 1.3 * s, 1.15 * s, 1.3 * s), mixColor(PAL.tree, PAL.treeDark, hash2(seed * 3, 0) * 0.8 + 0.1), sway(y0, (H + 2) * s, 0.45));
}

/** A bush seen from afar: one blob in its green. */
export function farBush(b: Batch, x: number, z: number, s: number, seed: number) {
  const y0 = heightAt(x, z);
  const f = new Frame(x, y0, z, seed * 6.28);
  b.add(ICO(0), f.at(0.12 * s, 0.35 * s, 0.06 * s, 0, 0.85 * s, 0.6 * s, 0.85 * s), mixColor(PAL.grassDark, PAL.treeDark, hash2(seed, 1) * 0.6), sway(y0, 1.2, 0.25));
}

/**
 * The district's far detail as one geometry (world space, TOY attributes): the buildings exactly as the near toy
 * batch has them and the planting simplified. `atlas`: the World's label atlas (the facades ask for their plaques
 * again: the atlas answers with the cells it already has, nothing new is drawn; the plaques' quads are dropped here,
 * the World's labels mesh keeps them).
 */
export function heroFarGeometry(atlas: LabelAtlas): THREE.BufferGeometry {
  const b = new Batch();
  buildCity(b, new LabelBatch(), atlas);
  for (const p of DISTRICT.props) {
    if (p.kind !== 'palm' && p.kind !== 'tree' && p.kind !== 'bush') continue;
    const seed = hash2(p.x * 0.37, p.z * 0.91), s = p.scale ?? 1;
    if (p.kind === 'palm') farPalm(b, p.x, p.z, s, seed);
    else if (p.kind === 'tree') farTree(b, p.x, p.z, s, seed);
    else farBush(b, p.x, p.z, s, seed);
  }
  for (const p of gardenPlantings()) (p.kind === 'tree' ? farTree : farBush)(b, p.x, p.z, p.s, p.seed);
  return b.build();
}

/** The far chunks, split on the near chunks' grid (HERO_TILE_CELL). */
export function heroFarChunks(atlas: LabelAtlas): { ix: number; iz: number; geometry: THREE.BufferGeometry }[] {
  return splitGeometryCells(heroFarGeometry(atlas), HERO_TILE_CELL);
}

/** One tile of the hero district: its near chunk, its far chunk (either may be missing) and their joint xz bounds. */
export interface HeroTile { near: THREE.Mesh | null; far: THREE.Mesh | null; box: { x0: number; z0: number; x1: number; z1: number } }

/** Pair near and far chunks by grid cell. A tile with no far chunk has nothing to show from afar (only furniture). */
export function pairHeroTiles(near: readonly { ix: number; iz: number; mesh: THREE.Mesh }[], far: readonly { ix: number; iz: number; mesh: THREE.Mesh }[]): HeroTile[] {
  const tiles = new Map<string, HeroTile>();
  const box = new THREE.Box3();
  const at = (ix: number, iz: number) => {
    const k = `${ix}:${iz}`;
    let t = tiles.get(k);
    if (!t) { t = { near: null, far: null, box: { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity } }; tiles.set(k, t); }
    return t;
  };
  const grow = (t: HeroTile, m: THREE.Mesh) => {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.copy(m.geometry.boundingBox!);
    t.box.x0 = Math.min(t.box.x0, box.min.x); t.box.z0 = Math.min(t.box.z0, box.min.z);
    t.box.x1 = Math.max(t.box.x1, box.max.x); t.box.z1 = Math.max(t.box.z1, box.max.z);
  };
  for (const c of near) { const t = at(c.ix, c.iz); t.near = c.mesh; grow(t, c.mesh); }
  for (const c of far) { const t = at(c.ix, c.iz); t.far = c.mesh; grow(t, c.mesh); }
  return [...tiles.values()];
}
