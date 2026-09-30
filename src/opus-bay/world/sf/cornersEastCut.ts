import * as THREE from 'three';
import type { Obstacle } from '../../actors/controller';
import { registerObstacleSource } from '../../actors/view';
import { project } from '../../core/geo';
import { runtime } from '../../core/runtime';
import { heightAt } from '../../core/terrain';
import type { Vec2 } from '../../core/types';
import { CONE, type BatchLike, ICO, M } from '../builder';
import { TOY } from '../materials';
import { TypedBatch } from '../typedBatch';
import type { WorldSystem } from '../world';
import { GLOW, NONE, cyl } from './landmarks/kit';
import { SENTINEL_H, SENTINEL_RING, SENTINEL_TIP } from './cornersNB';

/**
 * Wave 7 · lane W1 · the East Cut / Embarcadero corner (W7-W12; sf-w7-lead §3 row W1 (2)), city mode only, on the
 * W6 North Beach pattern (world/sf/cornersNorthBeach.ts): what the start view and the first walk from the Ferry Building
 * lacked inside the hero slab, which district mode freezes.
 *
 *   Salesforce Park   the Transit Center's roof park, 70 ft up (toy 6.5 u: buildingH(21 m)): the long deck on its
 *                     OSM footprint (way 542375290, Beale St → Second St), the glass base, the undulating white
 *                     perforated skin (drawn as billowing white panels), the lawn, a winding path and trees on the roof
 *   Cupid's Span      the giant bow and arrow in Rincon Park (64 ft → toy 6.2 u): the golden bow half in the ground,
 *                     its white string, the silver arrow with red feathers pointing into the lawn, the Bay Bridge behind
 *   Redwood Park      coast redwoods at the Transamerica Pyramid's foot (the district's empty r 4 circle) and the
 *                     fountain with its jumping frogs on lily pads
 *   the Sentinel      the copper-green flatiron of Columbus Ave & Kearny St with white tile bands and its copper dome
 *                     over the rounded corner, the Pyramid behind it; its collision is the seam fill's row
 *                     (cornersNB.ts SENTINEL_RING: the district's own corner)
 *
 * Cost: TWO meshes of TOY (no new program) in one THREE.LOD drawn within EC_CULL u, built the first time the camera
 * comes within EC_BUILD u; no shadows cast. The deck is its own mesh: it hides while the player or the camera is on or
 * under its footprint (the city's ground-level park and the streets under the Transit Center stay walkable; the follow
 * camera never looks at the player through a deck the collision does not know). Soft obstacles for the trunks, the
 * fountain, the sculpture's feet.
 *
 * Facts (checked on the web 2026-09-29):
 *   - Salesforce Park: 5.4 acres, 70 ft above the street, 600 trees, Beale St to Second St on the Transit Center's roof
 *     — https://www.tjpa.org/salesforce-transit-center/salesforce-park , https://en.wikipedia.org/wiki/Salesforce_Transit_Center ;
 *     the skin: 3,992 perforated white aluminium panels in a Penrose pattern, an undulating "cloud" —
 *     https://www.architecturalrecord.com/articles/13595-salesforce-transit-center-by-pelli-clarke-pelli-architects-opens-in-san-francisco ,
 *     https://archello.com/project/salesforce-transit-center
 *   - Cupid's Span: Claes Oldenburg and Coosje van Bruggen, Rincon Park, 2002, fiberglass and steel, a bow and arrow
 *     partly set in the ground; 64 ft by the artists' figure (60–70 ft elsewhere); a stainless-steel shaft, red
 *     feathers — https://en.wikipedia.org/wiki/Cupid's_Span , https://www.kreysler.com/projects/all/sculpture/cupid-span
 *   - Transamerica Redwood Park: half an acre, 80 redwoods from the Santa Cruz Mountains (1972), the fountain with Richard
 *     Clopton's jumping frogs (Mark Twain's Calaveras County story) — https://www.tclf.org/landscapes/transamerica-redwood-park
 *   - Sentinel Building (Columbus Tower): 916 Kearny St, completed 1907, a flatiron clad in white tile and copper,
 *     "surmounted by a copper dome" — https://noehill.com/sf/landmarks/sf033.asp ,
 *     https://en.wikipedia.org/wiki/Columbus_Tower_(San_Francisco) ; OSM way 288485994 (height 29 m → toy 7.7 u)
 */

/** the corner's middle (the LOD's centre) */
export const EC_CENTER: Vec2 = { x: 118, z: 72 };
/** drawn within this many u of the camera (from EC_CENTER: every piece is ≤ 100 u from it) */
export const EC_CULL = 215;
/** built the first time the camera comes this close */
export const EC_BUILD = 290;
/** the corner's budget: two meshes (the deck hides on its own) */
export const EC_BUDGET = { calls: 2, triangles: 7000 } as const;

/** The Transit Center's footprint, OSM way 542375290 simplified (world x, z; the city frame) */
export const TC_RING: readonly Vec2[] = [
  { x: 170.2, z: 86.0 }, { x: 171.3, z: 84.1 }, { x: 176.4, z: 84.0 }, { x: 177.1, z: 85.0 }, { x: 177.4, z: 100 },
  { x: 177.6, z: 116 }, { x: 177.9, z: 137.7 }, { x: 177.6, z: 144.4 }, { x: 171.5, z: 144.6 }, { x: 170.6, z: 137 },
  { x: 170.4, z: 126 }, { x: 170.7, z: 117 }, { x: 170.2, z: 104 }, { x: 170.1, z: 93 },
];
/** the roof's height over the street: 70 ft ≈ 21 m → core/geo buildingH(21) = 3.2 + 0.155 · 21 */
export const TC_ROOF = 6.46;
const TC_GLASS = 2.3;

/**
 * Cupid's Span: where the bow's lower tip meets the lawn, the bow's plane (yaw: along the lawn's seaward edge, so it
 * faces the promenade), the sculpture's height. The district's Rincon Park lawn (data/district.ts walk 'rincon-park',
 * x 184–204) between its benches (z ≈ 8) and its trees (z ≈ 15); the ground east of it is not walkable.
 */
export const CUPID = { x: 188.6, z: 11.3, ry: -0.112, top: 6.2 } as const;
/** Redwood Park's grove (the district's exclusion circle, data/district.ts: project(37.79524, -122.40224), r 4) */
export const REDWOOD_C: Vec2 = project(37.79524, -122.40224);

const LAWN = '#8cbd66', LAWN2 = '#7fb05d', PATH = '#e4d8bf', SKIN = '#f3f1ea', GLASS = '#6f8a99', RIM = '#e3e0d8';
const TRUNK = '#6b5140', LEAF = ['#5f8f4e', '#6e9f55', '#4f7f45'] as const, CONIFER = '#3f6e45';
const BOW = '#d9a13f', STRING = '#f4f1ea', SHAFT = '#c9cdd2', FEATHER = '#c8412f';
const REDWOOD = ['#2f5b3d', '#35643f'] as const, REDBARK = '#7a4631', STONE = '#cfc8ba', WATER = '#5f94a8', PAD = '#5e9a4e', FROG = '#6b6a3a';
const COPPER = '#5f9c86', COPPER_D = '#3f6f61', TILE = '#eee7d6', DOME = '#4f8f79';

function inRing(x: number, z: number, p: readonly Vec2[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}
function segD(x: number, z: number, a: Vec2, b: Vec2) {
  const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l)) : 0;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
function ringDist(x: number, z: number, p: readonly Vec2[]) {
  let d = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, segD(x, z, p[j], p[i]));
  return d;
}
const signedArea = (p: readonly Vec2[]) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j].x * p[i].z - p[i].x * p[j].z; return a / 2; };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** on (or within `pad` u of) the Transit Center's footprint */
export function onDeck(x: number, z: number, pad = 0): boolean {
  return inRing(x, z, TC_RING) || (pad > 0 && ringDist(x, z, TC_RING) < pad);
}

/** the roof's trees (world): two staggered rows down the deck, a clump every few; deterministic */
export function deckTrees(): { x: number; z: number; k: number }[] {
  const out: { x: number; z: number; k: number }[] = [];
  let i = 0;
  for (let z = 86.2; z < 143.6; z += 2.1, i++) {
    const west = 171.4 + ((i * 37) % 5) * 0.12, east = 176.4 - ((i * 53) % 5) * 0.12;
    for (const x of i % 2 === 0 ? [west, east] : [(west + east) / 2 + (i % 4 === 1 ? -0.9 : 0.9)]) {
      if (inRing(x, z, TC_RING) && ringDist(x, z, TC_RING) > 0.7) out.push({ x, z, k: (i + Math.round(x)) % 5 });
    }
  }
  return out;
}

function deck(b: BatchLike) {
  let y0 = Infinity;
  for (const p of TC_RING) y0 = Math.min(y0, heightAt(p.x, p.z));
  const top = y0 + TC_ROOF, glassTop = y0 + TC_GLASS;
  b.walls(TC_RING as Vec2[], y0, glassTop, GLASS, GLOW(0.45));
  // the white skin: billowing panels round the building, bulging most at mid-height (the "cloud" of perforated panels)
  const s = signedArea(TC_RING) >= 0 ? 1 : -1;
  const rows = [glassTop, glassTop + 1.35, top - 0.3];
  const bulge = [0.05, 0.42, 0.12];
  let phase = 0;
  for (let i = 0; i < TC_RING.length; i++) {
    const a = TC_RING[i], c = TC_RING[(i + 1) % TC_RING.length];
    const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz), nx = (s * dz) / L, nz = (-s * dx) / L;
    const n = Math.max(1, Math.round(L / 1.25)), nrm = V(nx, 0, nz);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const w0 = 0.6 + 0.4 * Math.sin(phase + t0 * L * 0.9), w1 = 0.6 + 0.4 * Math.sin(phase + t1 * L * 0.9);
      const P = (t: number, r: number, w: number) => V(a.x + dx * t + nx * bulge[r] * w, rows[r], a.z + dz * t + nz * bulge[r] * w);
      for (let r = 0; r < 2; r++) b.quad(P(t0, r, w0), P(t1, r, w1), P(t1, r + 1, w1), P(t0, r + 1, w0), nrm, SKIN);
    }
    phase += L * 0.9;
  }
  // the rim and the roof: a lawn with a winding path, the trees
  b.walls(TC_RING as Vec2[], top - 0.3, top + 0.12, RIM);
  b.polygon(TC_RING as Vec2[], top + 0.12, LAWN);
  const path: Vec2[] = [];
  for (let z = 85.4; z <= 143.6; z += 1.2) path.push({ x: 173.9 + Math.sin(z * 0.23) * 1.25, z });
  b.ribbon(path, 0.75, () => top + 0.15, PATH);
  for (const t of deckTrees()) {
    const y = top + 0.12;
    if (t.k === 4) { cyl(b, t.x, y, t.z, 0.07, 0.4, TRUNK, NONE, 4); b.add(CONE(6), M(t.x, y + 0.3, t.z, t.x, 0.55, 1.9, 0.55), CONIFER); continue; }
    cyl(b, t.x, y, t.z, 0.08, 0.9, TRUNK, NONE, 4);
    b.add(ICO(0), M(t.x, y + 1.35, t.z, t.z, 0.8, 0.7, 0.8), LEAF[t.k % 3], [0, 0, 0.1, 0]);
  }
  // a second lawn tone in patches round the path
  for (let z = 88; z < 142; z += 9) b.polygon([{ x: 171.2, z }, { x: 172.6, z }, { x: 172.6, z: z + 3.2 }, { x: 171.2, z: z + 3.2 }], top + 0.13, LAWN2);
}

/** Cupid's Span in its plane: the bow's lower tip at CUPID, u along the plane (local x), y up. */
function cupid(b: BatchLike) {
  const y0 = heightAt(CUPID.x, CUPID.z), ca = Math.cos(CUPID.ry), sa = Math.sin(CUPID.ry);
  const W = (u: number, y: number, w = 0) => V(CUPID.x + u * ca + w * sa, y0 + y, CUPID.z - u * sa + w * ca);
  // the string: from the bow's lower tip (in the lawn) up to its upper tip; the arrow nocked at its middle, at right
  // angles, pointing down into the lawn; the bow bulges toward the arrow's point
  const S0 = { u: -0.2, y: -0.25 }, S1 = { u: 3.4, y: CUPID.top - 0.15 };
  const su = S1.u - S0.u, sy = S1.y - S0.y, sl = Math.hypot(su, sy);
  const mid = { u: (S0.u + S1.u) / 2, y: (S0.y + S1.y) / 2 }, d = { u: sy / sl, y: -su / sl };
  const grip = { u: mid.u + d.u * 1.5, y: mid.y + d.y * 1.5 };
  // the bow: a quadratic through S0 → grip → S1, 12 thick beams, thicker at the grip
  const Q = (t: number) => {
    const cu = 2 * grip.u - (S0.u + S1.u) / 2, cy = 2 * grip.y - (S0.y + S1.y) / 2;
    return { u: (1 - t) * (1 - t) * S0.u + 2 * (1 - t) * t * cu + t * t * S1.u, y: (1 - t) * (1 - t) * S0.y + 2 * (1 - t) * t * cy + t * t * S1.y };
  };
  for (let k = 0; k < 12; k++) {
    const a = Q(k / 12), c = Q((k + 1) / 12), w = 0.26 + 0.14 * Math.sin((Math.PI * (k + 0.5)) / 12);
    b.beam(W(a.u, a.y), W(c.u, c.y), w, w, BOW);
  }
  b.beam(W(S0.u, S0.y), W(S1.u, S1.y), 0.06, 0.06, STRING);
  // the arrow: from just behind the string (the nock) through the grip into the lawn
  const tGround = (mid.y + 0.2) / -d.y, tip = { u: mid.u + d.u * tGround, y: -0.2 }, nock = { u: mid.u - d.u * 0.5, y: mid.y - d.y * 0.5 };
  b.beam(W(nock.u, nock.y), W(tip.u, tip.y), 0.11, 0.11, SHAFT);
  // three red feathers round the shaft at the nock end
  for (let f = 0; f < 3; f++) {
    const ang = (f * Math.PI * 2) / 3, ow = Math.cos(ang) * 0.3, oy = Math.sin(ang) * 0.3;
    const a = W(nock.u + d.u * 0.15, nock.y + d.y * 0.15, 0), c = W(nock.u + d.u * 1.25, nock.y + d.y * 1.25, 0);
    const e = W(nock.u + d.u * 0.35 - d.y * oy, nock.y + d.y * 0.35 + d.u * oy, ow);
    b.tri(a, c, e, FEATHER, NONE);
    b.tri(c, a, e, FEATHER, NONE);
  }
  // W7-W1-review: the bow's lower limb and the arrow's lower shaft stand at a walker's height on the lawn: soft
  // obstacles every ≈ 0.45 u along them (the feet alone let a walker pass through the sculpture)
  const low: THREE.Vector3[] = [];
  const keep = (u: number, y: number) => { const p = W(u, 0); if (y < 2.0 && low.every(q => q.distanceTo(p) > 0.45)) low.push(p); };
  for (let k = 0; k <= 40; k++) { const q = Q(k / 40); keep(q.u, q.y); }
  for (let k = 0; k <= 40; k++) { const t = -0.5 + (k / 40) * (tGround + 0.5); keep(mid.u + d.u * t, mid.y + d.y * t); }
  return { foot: W(S0.u, 0), tip: W(tip.u, 0), low };
}

/** the redwood grove's trunks (world), inside the district's r 4 circle; deterministic */
export function redwoods(): Vec2[] {
  const out: Vec2[] = [];
  const ring = [[0, 0], [1.9, 0.6], [-1.6, 1.2], [0.7, -1.9], [-1.1, -1.5], [2.4, -1.2], [-2.5, -0.2], [0.4, 2.4], [1.9, 2.0]];
  for (const [dx, dz] of ring) out.push({ x: REDWOOD_C.x + dx, z: REDWOOD_C.z + dz });
  return out;
}
/** the frog fountain (world): the grove's open side toward the Pyramid's plaza */
export const FROG_FOUNTAIN: Vec2 = { x: REDWOOD_C.x - 1.0, z: REDWOOD_C.z + 3.2 };

function redwoodPark(b: BatchLike) {
  redwoods().forEach((t, i) => {
    const y = heightAt(t.x, t.z), h = 4.6 + ((i * 7) % 5) * 0.28;
    cyl(b, t.x, y, t.z, 0.17, 1.3, REDBARK, NONE, 5, 0.8);
    b.add(CONE(7), M(t.x, y + 1.0, t.z, i, 0.95, h * 0.62, 0.95), REDWOOD[i % 2]);
    b.add(CONE(7), M(t.x, y + 1.0 + h * 0.38, t.z, i + 0.4, 0.7, h * 0.62, 0.7), REDWOOD[(i + 1) % 2]);
  });
  const f = FROG_FOUNTAIN, y = heightAt(f.x, f.z);
  cyl(b, f.x, y, f.z, 0.95, 0.22, STONE, NONE, 12);
  cyl(b, f.x, y + 0.2, f.z, 0.82, 0.04, WATER, NONE, 12);
  for (const [dx, dz, r] of [[0.35, 0.2, 0.2], [-0.3, 0.3, 0.17], [0.05, -0.4, 0.19]] as const) {
    cyl(b, f.x + dx, y + 0.24, f.z + dz, r, 0.02, PAD, NONE, 7);
    b.add(ICO(0), M(f.x + dx, y + 0.31, f.z + dz, dx, 0.08, 0.06, 0.1), FROG);
  }
}

/** the Sentinel's shell over the seam fill's prism: copper-green walls, white tile bands, the cornice, the dome */
function sentinel(b: BatchLike) {
  const H = SENTINEL_H;
  let y0 = Infinity;
  for (const p of SENTINEL_RING) y0 = Math.min(y0, heightAt(p.x, p.z));
  const c = SENTINEL_RING.reduce((s, p) => ({ x: s.x + p.x / SENTINEL_RING.length, z: s.z + p.z / SENTINEL_RING.length }), { x: 0, z: 0 });
  const grow = (d: number): Vec2[] => SENTINEL_RING.map(p => { const dx = p.x - c.x, dz = p.z - c.z, l = Math.hypot(dx, dz); return { x: p.x + (dx / l) * d, z: p.z + (dz / l) * d }; });
  const shell = grow(0.09);
  b.walls(shell, y0, y0 + H + 0.1, COPPER);
  b.walls(grow(0.12), y0, y0 + 0.9, TILE);
  // seven floors: a dark window band and a white tile band each
  for (let k = 0; k < 7; k++) {
    const yb = y0 + 1.05 + k * 0.93;
    b.walls(grow(0.12), yb, yb + 0.5, COPPER_D, GLOW(0.35));
    b.walls(grow(0.13), yb + 0.72, yb + 0.86, TILE);
  }
  b.walls(grow(0.2), y0 + H - 0.05, y0 + H + 0.3, TILE);
  b.polygon(grow(0.2), y0 + H + 0.3, TILE);
  // the copper dome over the rounded corner: a drum, the dome, a finial
  const t = SENTINEL_TIP;
  cyl(b, t.x, y0 + H + 0.3, t.z, 0.62, 0.55, COPPER, NONE, 10);
  b.add(ICO(1), M(t.x, y0 + H + 0.85, t.z, 0, 0.62, 0.72, 0.62), DOME);
  cyl(b, t.x, y0 + H + 1.5, t.z, 0.04, 0.35, DOME, NONE, 4);
}

/** The corner's two meshes (world coordinates); triangles for the budget test. */
export function buildEastCut(): { deck: THREE.Mesh; toy: THREE.Mesh; triangles: number; cupidFeet: THREE.Vector3[] } {
  const bd = new TypedBatch(8192), b = new TypedBatch(8192);
  deck(bd);
  const feet = cupid(b);
  redwoodPark(b);
  sentinel(b);
  const ad = bd.toArrays(), a = b.toArrays();
  const deckMesh = new THREE.Mesh(TypedBatch.toGeometry(ad), TOY);
  deckMesh.name = 'sf:east-cut:deck';
  const toy = new THREE.Mesh(TypedBatch.toGeometry(a), TOY);
  toy.name = 'sf:east-cut:toy';
  for (const m of [deckMesh, toy]) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; }
  return { deck: deckMesh, toy, triangles: ad.indexCount / 3 + a.indexCount / 3, cupidFeet: [feet.foot, feet.tip, ...feet.low] };
}

/** the corner's soft obstacles (world): the redwood trunks, the fountain, the sculpture's feet and its low bow limb / shaft */
export function ecObstacles(cupidFeet: readonly { x: number; z: number }[]): Obstacle[] {
  return [
    ...redwoods().map(p => ({ x: p.x, z: p.z, r: 0.28, kind: 'static' as const })),
    { x: FROG_FOUNTAIN.x, z: FROG_FOUNTAIN.z, r: 1.0, kind: 'static' },
    ...cupidFeet.map(p => ({ x: p.x, z: p.z, r: 0.35, kind: 'static' as const })),
  ];
}

/** the deck hides while the player stands within 2.5 u of the footprint or the camera within 1.5 u (or on it) */
export function deckHidden(player: { x: number; z: number }, cam: { x: number; y: number; z: number }): boolean {
  return onDeck(player.x, player.z, 2.5) || (cam.y < TC_ROOF + 4 && onDeck(cam.x, cam.z, 1.5));
}

/** City mode: the East Cut corner as a world system (world/sf/cityWorld.ts adds it). */
export function attachEastCut(): WorldSystem {
  const group = new THREE.Group();
  group.name = 'sf:east-cut';
  const lod = new THREE.LOD();
  lod.position.set(EC_CENTER.x, 0, EC_CENTER.z);
  const near = new THREE.Group();
  near.position.set(-EC_CENTER.x, 0, -EC_CENTER.z);
  lod.addLevel(near, 0);
  lod.addLevel(new THREE.Object3D(), EC_CULL);
  group.add(lod);
  let built: ReturnType<typeof buildEastCut> | null = null;
  let soft: Obstacle[] = [];
  const offSoft = registerObstacleSource((out, x, z, r) => {
    for (const o of soft) { const d = r + o.r; if ((o.x - x) ** 2 + (o.z - z) ** 2 <= d * d) out.push(o); }
  });
  return {
    name: 'east-cut-corner',
    group,
    update(_dt, _t, camera) {
      const c = camera.position;
      if (!built) {
        if ((c.x - EC_CENTER.x) ** 2 + (c.z - EC_CENTER.z) ** 2 > EC_BUILD * EC_BUILD) return;
        built = buildEastCut();
        for (const m of [built.deck, built.toy]) { m.updateMatrix(); near.add(m); }
        soft = ecObstacles(built.cupidFeet);
        group.updateMatrixWorld(true);
      }
      built.deck.visible = !deckHidden(runtime.player, c);
    },
    dispose() {
      offSoft();
      built?.deck.geometry.dispose();
      built?.toy.geometry.dispose();
    },
  };
}
