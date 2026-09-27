import { type BatchLike, ICO, M } from '../../builder';
import { GLOW, LIT, NONE, SF, SWAY, arch, box, cbox, cyl, disc, gable, lathe, pyramid, rect, worldPoly } from './kit';
import type { LandmarkSwap, SfLandmark, WalkBlocker } from './index';

/**
 * Mission Dolores (T2): the 1791 adobe Mission San Francisco de Asís — whitewashed, tile-roofed, its facade of
 * four columns and three bells — next to the ornate Basilica with its two towers, and the walled cemetery garden.
 * Local +z faces Dolores St (east, yaw 144° from OSM ways 256442765 / 256442760 / 1421390128). Old mission 8 m
 * → H 4.4 u; basilica roof 14 m → 5.4 u, towers ~7.4 u.
 */

const X0 = 194.1, Z0 = 647.4, YAW = (144 * Math.PI) / 180;
const ADOBE = '#f2ecdf', TILE = SF.tileRed, CREAM = '#efe4cf', ORNATE = '#d8c39a';
/** old mission: x −2.72…−0.33, z −2.53…3.86 (OSM, local) */
const OM = { x: -1.53, w: 2.4, z0: -2.53, z1: 3.86 };
/** basilica nave + front towers */
const BA = { x: 2.0, w: 3.6, z0: -4.5, z1: 2.5 };

function build(b: BatchLike, lod: 0 | 2) {
  // ---- old mission: long adobe nave, tile roof, stepped white facade
  const omc = (OM.z0 + OM.z1) / 2, oml = OM.z1 - OM.z0;
  box(b, OM.x, -1.2, omc, OM.w, 4.3, oml, ADOBE, NONE);
  gable(b, OM.x, 3.1, omc - 0.2, oml - 0.3, OM.w, 0.9, TILE, ADOBE, Math.PI / 2, 0.22);
  box(b, OM.x, 3.1, OM.z1 - 0.2, OM.w + 0.2, 1.35, 0.4, ADOBE, GLOW(0.1));
  // ---- basilica: nave + roof + two towers with cupolas
  const bac = (BA.z0 + BA.z1) / 2, bal = BA.z1 - BA.z0;
  box(b, BA.x, -1.2, bac, BA.w, 5.1, bal, CREAM, lod === 0 ? [4, 0.3, -2.7, 0] : NONE);
  gable(b, BA.x, 3.9, bac, bal, BA.w, 1.3, TILE, CREAM, Math.PI / 2, 0.2);
  for (const tx of [0.3, 3.2]) {
    box(b, tx, -1.2, 2.95, 1.05, 7.3, 1.05, CREAM, GLOW(0.12));
    if (lod === 0) lathe(b, [[0.52, 0], [0.5, 0.35], [0.36, 0.75], [0.12, 1.05], [0.02, 1.4]], tx, 6.1, 2.95, '#c98a5c', NONE, 8);
    else pyramid(b, tx, 6.1, 2.95, 1.05, 1.05, 1.3, TILE);
  }
  box(b, BA.x, -1.2, 3.1, 1.9, 6.0, 0.7, CREAM, GLOW(0.12));
  if (lod === 2) return;
  // old mission facade: balcony, four columns, three bell niches, door
  box(b, OM.x, 1.7, OM.z1 + 0.05, OM.w + 0.1, 0.12, 0.45, '#7e5a44');
  for (let k = 0; k < 4; k++) cyl(b, OM.x - 0.9 + k * 0.6, 1.82, OM.z1 + 0.18, 0.09, 1.9, '#f8f3e9', NONE, 6);
  box(b, OM.x, 3.7, OM.z1 + 0.05, OM.w + 0.3, 0.14, 0.5, '#e8dfcd');
  for (let k = -1; k <= 1; k++) {
    arch(b, OM.x + k * 0.62, 2.35, OM.z1 + 0.06, 0.34, 0.6, 0, '#4d4640');
    cbox(b, OM.x + k * 0.62, 2.55, OM.z1 + 0.1, 0.18, 0.22, 0.18, '#a88a4c');
  }
  box(b, OM.x, -0.1, OM.z1 + 0.02, 0.8, 1.55, 0.06, '#6e4f3c', LIT(0));
  // basilica front: ornate portal, rose window, tower belfries, statues niches
  arch(b, BA.x, 0, 3.47, 1.0, 1.9, 0, '#5b4a3e', LIT(0));
  disc(b, BA.x, 3.2, 3.47, 0.45, 0.06, 0, '#4c6a9a', GLOW(0.9), 10);
  box(b, BA.x, 4.6, 3.3, 2.1, 0.25, 0.9, ORNATE);
  pyramid(b, BA.x, 4.85, 3.3, 1.6, 0.8, 0.8, ORNATE);
  for (const tx of [0.3, 3.2]) {
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      arch(b, tx + Math.sin(a) * 0.54, 4.7, 2.95 + Math.cos(a) * 0.54, 0.38, 0.9, a, '#4d4640', LIT(4.7));
    }
    box(b, tx, 5.75, 2.95, 1.25, 0.35, 1.25, ORNATE);
    for (const [ox, oz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) cbox(b, tx + ox, 6.25, 2.95 + oz, 0.14, 0.4, 0.14, ORNATE);
  }
  cemetery(b);
}

/** the walled cemetery garden: lawn, headstones, two old trees, the adobe wall */
function cemetery(b: BatchLike) {
  box(b, -4.1, -0.05, -1.2, 3.0, 0.1, 6.4, SF.lawn);
  for (let i = 0; i < 9; i++) box(b, -4.9 + (i % 3) * 0.8, 0, -3.6 + Math.floor(i / 3) * 1.6, 0.35, 0.45, 0.12, '#e3ded4');
  for (const [tx, tz] of [[-4.6, 0.8], [-3.4, -2.6]]) {
    cyl(b, tx, 0, tz, 0.14, 1.4, '#6d5340', NONE, 5);
    b.add(ICO(), M(tx, 2.2, tz, 0, 1.1, 1.3, 1.1), SF.hedge, SWAY(0.4));
  }
  box(b, -4.1, -0.2, 2.1, 3.1, 0.9, 0.2, ADOBE);
  box(b, -5.62, -0.2, -1.2, 0.2, 0.9, 6.4, ADOBE);
}

/**
 * AI mission (lane D2, D2-15): lane H's SAM mesh (LM4-3D, the adobe chapel and the basilica as one group) at
 * 6.5 × 4.55 × 4.36 u, shown at [1, 1.4, 1.45] (towers 6.4 u, 6.3 u deep) over the two procedural buildings: x −2.72…3.78,
 * z −2.56…3.76 (measured on the decoded mesh: a solid box, the basilica towers flush with the chapel's facade).
 * The cemetery garden stays procedural beside it.
 */
const AI_X = 0.53, AI_Z = 0.6, AI_S = [1, 1.4, 1.45] as const;

function aiRemainder(b: BatchLike) {
  box(b, AI_X, -1.2, AI_Z, 6.4, 1.24, 6.2, ADOBE);
  cemetery(b);
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-mission-dolores', x: AI_X, y: 0, z: AI_Z, scale: AI_S, glow: 0.1 }],
  build: aiRemainder,
  ship: true,
  note: '[1, 1.4, 1.45]; cemetery garden procedural',
};

const CEMETERY: WalkBlocker = { poly: rect(-4.1, -1.2, 3.1, 6.6) };
const blockers = (ai: boolean): WalkBlocker[] => (ai
  ? [{ poly: rect(AI_X, AI_Z, 6.5, 6.32) }, CEMETERY]
  : [{ poly: rect(OM.x, (OM.z0 + OM.z1) / 2, OM.w, OM.z1 - OM.z0) }, { poly: rect(BA.x, (BA.z0 + BA.z1) / 2 + 0.5, BA.w, BA.z1 - BA.z0 + 1.2) }, CEMETERY]);

export const missionDolores: SfLandmark = {
  id: 'mission-dolores',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(-0.9, -0.6, 10.2, 9.4)) },
  build,
  walk: { blockers: blockers(SWAP.ship) },
  swap: SWAP,
  fade: { r: 5, y1: 6.6, box: [3.8, 3.8], procedural: false },
};
