import type { BatchLike } from '../../builder';
import { GLOW, LIT, arch, box, disc, gable, lathe, pyramid, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Grace Cathedral (T2) on Nob Hill: the French-Gothic concrete cathedral — twin west-front towers (here facing
 * east over Huntington Park, local +z, yaw 144.8° from OSM way 32946942), rose window, buttressed nave, transept,
 * apse and the slim flèche over the crossing. Towers 53 m → H 11.4 u, flèche 75 m → 14.8 u; the rest at 0.215 u/m.
 */

const X0 = 1.33, Z0 = 232.25, YAW = (144.8 * Math.PI) / 180;
const STONE = '#dcd6ca', STONE_SHADE = '#c6bfb1', ROOF = '#7e968c', DARK = '#4b4f55';
const NAVE = { w: 3.8, z0: -0.9, z1: 6.2 }, TRANS = { w: 6.08, z0: -2.74, z1: -0.9 }, CHOIR = { w: 2.6, z0: -5.6, z1: -2.74 };
const EAVE = 5.2, RIDGE = 7.4;
const TOWER_X = 1.3, TOWER_W = 1.25, TOWER_Z = 5.75, TOWER_H = 11.0;
/** central flèche: 247 ft (75 m) per Wikipedia → H 14.8 u */
const FLECHE_TOP = 14.8;

function build(b: BatchLike, lod: 0 | 2) {
  const lit = GLOW(0.08);
  // nave, transept, choir with steep copper roofs; apse
  for (const p of lod === 0 ? [NAVE, TRANS, CHOIR] : [NAVE, TRANS]) {
    const zc = (p.z0 + p.z1) / 2, L = p.z1 - p.z0;
    const eave = p === CHOIR ? EAVE - 0.6 : EAVE;
    box(b, 0, -1.2, zc, p.w, eave + 1.2, L, STONE, lit);
    if (p === TRANS) gable(b, 0, eave, zc, p.w, L + 0.4, RIDGE - eave, ROOF, STONE, 0, 0.15);
    else gable(b, 0, eave, zc, L, p.w, (p === CHOIR ? RIDGE - 0.6 : RIDGE) - eave, ROOF, STONE, Math.PI / 2, 0.15);
  }
  if (lod === 0) lathe(b, [[1.3, -1.2], [1.3, EAVE - 0.6], [0.4, RIDGE - 0.4]], 0, 0, CHOIR.z0, STONE, lit, 8, 1, 0.9);
  // west-front towers + the gable between them
  for (const sx of [-1, 1]) {
    box(b, sx * TOWER_X, -1.2, TOWER_Z, TOWER_W, TOWER_H + 1.2, 1.4, STONE, GLOW(0.1));
    if (lod === 0) {
      for (const f of [0, 1]) arch(b, sx * TOWER_X, 7.3, TOWER_Z + 0.71 - f * 1.42, 0.55, 2.2, f * Math.PI, DARK, LIT(7.3));
      arch(b, sx * (TOWER_X + TOWER_W / 2 + 0.01), 7.3, TOWER_Z, 0.55, 2.2, sx * Math.PI / 2, DARK, LIT(7.3));
      box(b, sx * TOWER_X, TOWER_H - 0.25, TOWER_Z, TOWER_W + 0.18, 0.25, 1.58, STONE_SHADE);
      for (const [ox, oz] of [[-0.5, -0.58], [0.5, -0.58], [-0.5, 0.58], [0.5, 0.58]]) pyramid(b, sx * TOWER_X + ox, TOWER_H, TOWER_Z + oz, 0.26, 0.26, 0.75, STONE);
    }
  }
  // flèche over the crossing
  pyramid(b, 0, RIDGE + 0.9, -1.82, 0.62, 0.62, FLECHE_TOP - RIDGE - 0.9, ROOF);
  if (lod === 2) return;
  box(b, 0, RIDGE - 0.3, -1.82, 0.6, 1.2, 0.6, ROOF);
  box(b, 0, EAVE, NAVE.z1 - 0.2, 1.4, 1.6, 0.4, STONE, lit);
  pyramid(b, 0, EAVE + 1.6, NAVE.z1 - 0.2, 1.4, 0.4, 0.8, STONE);
  // portal, rose window, buttresses + lancet windows along the nave and choir
  box(b, 0, -0.1, NAVE.z1 + 0.15, 1.6, 2.8, 0.3, STONE_SHADE);
  arch(b, 0, 0, NAVE.z1 + 0.31, 1.1, 2.3, 0, '#5a4c3f', LIT(0));
  disc(b, 0, 4.1, NAVE.z1 + 0.01, 0.6, 0.05, 0, '#3f558c', GLOW(0.9), 14);
  for (const sx of [-1, 1]) {
    for (let z = NAVE.z0 + 0.6; z < TOWER_Z - 1.0; z += 1.35) {
      box(b, sx * (NAVE.w / 2 + 0.18), -0.5, z, 0.36, EAVE - 0.2, 0.36, STONE_SHADE);
      arch(b, sx * (NAVE.w / 2 + 0.01), 1.4, z + 0.67, 0.5, 2.8, sx * Math.PI / 2, '#3d4b6e', GLOW(0.55));
    }
    for (let z = CHOIR.z0 + 0.5; z < CHOIR.z1; z += 1.2) arch(b, sx * (CHOIR.w / 2 + 0.01), 1.2, z, 0.45, 2.4, sx * Math.PI / 2, '#3d4b6e', GLOW(0.55));
    arch(b, sx * (TRANS.w / 2 + 0.01), 1.4, (TRANS.z0 + TRANS.z1) / 2, 0.9, 3.2, sx * Math.PI / 2, '#3d4b6e', GLOW(0.55));
  }
  // entrance stairs down toward Taylor St / Huntington Park
  for (let s = 0; s < 3; s++) box(b, 0, -0.4 + s * 0.15, NAVE.z1 + 1.3 - s * 0.35, 5.2 - s * 0.5, 0.3, 0.4, '#d3ccbe');
}

export const graceCathedral: SfLandmark = {
  id: 'grace-cathedral',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, 7.2, 14)) },
  build,
  walk: { blockers: [{ poly: rect(0, (NAVE.z0 + NAVE.z1 + 0.3) / 2, NAVE.w + 0.8, NAVE.z1 + 0.3 - NAVE.z0) }, { poly: rect(0, (TRANS.z0 + TRANS.z1) / 2, TRANS.w, TRANS.z1 - TRANS.z0) }, { poly: rect(0, (CHOIR.z0 - 1.2 + CHOIR.z1) / 2, CHOIR.w, CHOIR.z1 - CHOIR.z0 + 1.2) }] },
};

