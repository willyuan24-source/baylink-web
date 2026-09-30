import * as THREE from 'three';
import { game } from '../core/store';
import { BOX, CBOX, CONE, ICO, M, Batch, type Info, type InfoFn } from '../world/builder';
import { TOY, TOY_DYN, U } from '../world/materials';
import { TREAT_DOORS } from './treatDoors';
import { KNOCK_OUT } from './treatStreets';
import type { HaloSpot } from './worldHalos';
import { DRESS_ZONES, STOOP_STRIDE, STOOPS } from './worldSpots';

/**
 * Wave 6 · lane H (W6-H1) · the residential city dressed for the season (halloween/season.ts): the doorsteps of
 * ≈ 2 000 Victorians and Edwardians across Alamo Square, Hayes Valley, the Haight, the Castro, Noe Valley, Pacific
 * Heights and the Mission (halloween/worldSpots.ts, placed on the published city) get pumpkins and carved
 * jack-o'-lanterns, a porch lantern on every other house, cobwebs, a hanging ghost; one stoop in ~17 has a small
 * trick-or-treater in costume on the sidewalk (a ghost sheet, a witch, a pumpkin) — only in the season and on the big
 * night. Bats circle at dusk over Alamo Square, Buena Vista Park and Twin Peaks.
 *
 *   ONE merged mesh for everything on the stoops (the shared static TOY material, the city L0 cells' own program: no
 *   new program, the carved faces and lanterns glow at night through the toy shader's glow; W7-H2: its wind sway —
 *   aInfo.z — rocks the trick-or-treaters from their feet and swings the hanging ghosts from their hooks, in the vertex
 *   shader: no new call, no per-frame work), built only near the player: 48 u cells, each built once
 *   (≤ CELL_BUILDS_PER_STEP a step) and cached as typed arrays, the mesh re-assembled from the cached cells (a copy,
 *   no Batch work) when the wanted set changes — no hitch while driving. The halos of the faces and lanterns go to
 *   the Halloween halo pool (worldHalos.ts). Bats: one small dynamic mesh (≤ 10 bats, 120 triangles) at the nearest
 *   colony, written in place each frame while it shows.
 *
 * Nothing blocks walking (decoration only).
 */

export const CELL = 48;
/** the build radius by quality (u): the stoops within it are drawn */
export const DRESS_NEAR: Readonly<Record<'low' | 'mid' | 'high', number>> = { low: 60, mid: 80, high: 100 };
/** the night glow (halos only: no geometry) reaches further — the warm dots of a whole neighbourhood */
export const HALO_NEAR: Readonly<Record<'low' | 'mid' | 'high', number>> = { low: 110, mid: 150, high: 200 };
export const CELL_BUILDS_PER_STEP = 2;
/** a hard ceiling for the merged stoop mesh (triangles): cells beyond it wait (the budget test measures the worst view) */
export const DRESS_TRIS_MAX = 24_000;
/** the ceiling by quality (a phone at 'mid' keeps the nearest ≈ 130 stoops; the budget views: sf-w6-H.md part c) */
export const DRESS_TRIS_BY_QUALITY: Readonly<Record<'low' | 'mid' | 'high', number>> = { low: 7_000, mid: 13_000, high: DRESS_TRIS_MAX };
/** the stoops' night glow by quality (halos; the nearest first — the hunt, muertos and haunt halos come before them) */
export const DRESS_HALOS_BY_QUALITY: Readonly<Record<'low' | 'mid' | 'high', number>> = { low: 160, mid: 320, high: 640 };

const ORANGE = ['#e8792b', '#d9651f', '#f0913a', '#e36f24'];
const STEM = '#5e7a3a', CARVE = '#ffcf5a', WEB = '#ece8df', GHOST = '#f4f1ea', EYE = '#26222b', LANTERN = '#3a3236', LAMP = '#ffb347';
const WITCH = '#5b3a7a', HAT = '#2b2430', SKIN = '#f0c7a0', SHOE = '#3b2e2a';
/** glow at night (the toy shader's night light) */
const GLOW: Info = [0, 0, 0, 0.95];
const NONE: Info = [0, 0, 0, 0];
const HALO_FACE = new THREE.Color(1.0, 0.62, 0.22);
/**
 * (W7-H2) The toy shader's wind sway (world/materials.ts: xz += (0.16 sin + 0.025 sin) · aInfo.z², uWind 1) as a little
 * life: a trick-or-treater rocks from the feet (0) to the head (FIGURE_SWAY → ≈ 0.09 u), a hanging ghost swings from its
 * hook (0) to its hem (GHOST_SWAY → ≈ 0.12 u). z = k·√t makes the offset grow linearly with t (a stiff lean, no bend).
 */
export const FIGURE_SWAY = 0.75;
export const GHOST_SWAY = 0.87;
/** aInfo for a part that sways: t = 0 at `y0`, 1 at `y0 + h` (h < 0: below a hook), glow `w` */
export const swayInfo = (y0: number, h: number, k: number, w = 0): InfoFn => (_x, y) => [0, 0, k * Math.sqrt(Math.min(1, Math.max(0, (y - y0) / h))), w];
const HALO_LAMP = new THREE.Color(1.0, 0.7, 0.35);

/** `fig`: the side a trick-or-treater may stand (0 none, 1 left, 2 right of the pumpkins: sidewalk there, the script checked) */
export interface Stoop { i: number; x: number; z: number; y: number; f: number; zone: number; fig: number }

export const stoopCount = (): number => STOOPS.length / STOOP_STRIDE;
export function stoopAt(i: number): Stoop {
  const o = i * STOOP_STRIDE;
  return { i, x: STOOPS[o] / 10, z: STOOPS[o + 1] / 10, y: STOOPS[o + 2] / 100, f: STOOPS[o + 3] / 100, zone: STOOPS[o + 4] & 7, fig: STOOPS[o + 4] >> 3 };
}
export const zoneName = (k: number): string => DRESS_ZONES[k] ?? '';

/** A stable hash of a stoop (its variant never changes between builds). */
export const stoopHash = (i: number): number => { let h = (i + 0x9e37) | 0; h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return (h ^ (h >>> 15)) >>> 0; };
/** one stoop in ~17 has a trick-or-treater where the sidewalk has room (costume 0 ghost, 1 witch, 2 pumpkin); −1 none */
export const stoopFigure = (i: number): number => (stoopHash(i) % 17 === 3 && STOOPS.length > i * STOOP_STRIDE + 4 && STOOPS[i * STOOP_STRIDE + 4] >> 3 ? (stoopHash(i) >>> 8) % 3 : -1);

// --- the decorations (world space, into a Batch) ------------------------------------------------------------------

type V3 = [number, number, number];
interface Local { at(side: number, up: number, fwd: number): V3; f: number }
const localFrame = (x: number, y: number, z: number, f: number): Local => {
  const fx = Math.sin(f), fz = Math.cos(f), sx = Math.cos(f), sz = -Math.sin(f);
  return { f, at: (side, up, fwd) => [x + sx * side + fx * fwd, y + up, z + sz * side + fz * fwd] };
};

// low-poly shapes of our own (flat, facing +z, single-sided: seen from the street)
const tri = (pos: number[], ...xy: number[]) => { for (let i = 0; i < xy.length; i += 2) pos.push(xy[i], xy[i + 1], 0); };
const flatGeo = (pos: number[]): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i));
  return g;
};
let faceGeo: THREE.BufferGeometry | null = null;
/** A jack-o'-lantern face in a unit square (x, y ∈ −0.5…0.5): two triangle eyes, a nose, a crescent grin (11 triangles). */
export const FACE = (): THREE.BufferGeometry => (faceGeo ??= (() => {
  const pos: number[] = [];
  tri(pos, -0.4, 0.08, -0.1, 0.08, -0.25, 0.4);
  tri(pos, 0.1, 0.08, 0.4, 0.08, 0.25, 0.4);
  tri(pos, -0.07, -0.06, 0.07, -0.06, 0, 0.06);
  const xs = [-0.44, -0.22, 0, 0.22, 0.44];
  const top = (x: number) => -0.14 - 0.1 * (1 - (x / 0.44) ** 2);
  const bot = (x: number) => top(x) - 0.04 - 0.22 * (1 - (x / 0.44) ** 2);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1], c = xs[i];
    tri(pos, a, bot(a), c, bot(c), c, top(c));
    tri(pos, a, bot(a), c, top(c), a, top(a));
  }
  return flatGeo(pos);
})());
let webGeo: THREE.BufferGeometry | null = null;
/** A cobweb in a unit quadrant: its corner at the origin, spokes toward +x … −y, two rings of thread (20 triangles). */
export const WEB_GEO = (): THREE.BufferGeometry => (webGeo ??= (() => {
  const pos: number[] = [];
  const W = 0.018;
  const strand = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * W, ny = (dx / l) * W;
    tri(pos, x0 - nx, y0 - ny, x1 - nx, y1 - ny, x1 + nx, y1 + ny);
    tri(pos, x0 - nx, y0 - ny, x1 + nx, y1 + ny, x0 + nx, y0 + ny);
  };
  const spokes = [0.06, 0.52, 0.98, 1.46];
  const pt = (a: number, r: number) => [Math.cos(a) * r, -Math.sin(a) * r] as const;
  for (const a of spokes) { const [x, y] = pt(a, 1); strand(0, 0, x, y); }
  for (const r of [0.42, 0.74]) for (let k = 1; k < spokes.length; k++) { const [x0, y0] = pt(spokes[k - 1], r); const [x1, y1] = pt(spokes[k], r * 0.93); strand(x0, y0, x1, y1); }
  // the strands above run in either direction: make every triangle face +z
  for (let i = 0; i < pos.length; i += 9) {
    const cz = (pos[i + 3] - pos[i]) * (pos[i + 7] - pos[i + 1]) - (pos[i + 4] - pos[i + 1]) * (pos[i + 6] - pos[i]);
    if (cz < 0) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
  }
  return flatGeo(pos);
})());
let eyesGeo: THREE.BufferGeometry | null = null;
/** Two dark eyes in a unit square (4 triangles). */
const EYES = (): THREE.BufferGeometry => (eyesGeo ??= (() => {
  const pos: number[] = [];
  for (const cx of [-0.3, 0.3]) { tri(pos, cx - 0.12, -0.2, cx + 0.12, -0.2, cx + 0.12, 0.2); tri(pos, cx - 0.12, -0.2, cx + 0.12, 0.2, cx - 0.12, 0.2); }
  return flatGeo(pos);
})());

/** A pumpkin standing at `p` (its bottom), `r` its radius; carved: a face toward `f` that glows at night (`glow`). */
export function addPumpkin(b: Batch, p: V3, r: number, f: number, color: string, carved: boolean, glow: Info = GLOW, halos?: HaloSpot[], smooth = false): void {
  const [x, y, z] = p;
  const h = r * 0.78;
  b.add(ICO(smooth ? 1 : 0), M(x, y + h, z, f + (smooth ? 0 : 0.3), r, h, r), color, NONE);
  b.add(CONE(4), M(x, y + h * 1.62, z, f + 0.4, r * 0.16, r * 0.5, r * 0.16), STEM, NONE);
  if (!carved) return;
  const L = localFrame(x, y + h, z, f);
  const q = L.at(0, 0, r * (smooth ? 0.99 : 0.97));
  b.add(FACE(), M(q[0], q[1], q[2], f, r * 1.2, h * 1.05, 1), CARVE, glow);
  if (halos) { const o = L.at(0, 0, r * 1.1); halos.push({ x: o[0], y: o[1], z: o[2], size: r * 3.2, color: HALO_FACE }); }
}

/** A cobweb on the wall at `p` (its upper corner), spreading down and to the side (`dir` ±1), `size` u. */
function addWeb(b: Batch, p: V3, f: number, dir: number, size: number): void {
  b.add(WEB_GEO(), M(p[0], p[1], p[2], f, size, size, 1, 0, dir > 0 ? 0 : -Math.PI / 2), WEB, NONE);
}

/** A little sheet ghost hanging from the porch (`p` = its middle). */
function addHangingGhost(b: Batch, p: V3, f: number): void {
  const [x, y, z] = p;
  // it swings from the hook (the bracket's end, y + 0.64) down to its hem (y − 0.3): the string bends with it
  const swing = swayInfo(y + 0.64, -0.94, GHOST_SWAY);
  b.add(BOX(), M(x, y + 0.14, z, f, 0.012, 0.5, 0.012), EYE, swing);
  // the little bracket it hangs from, out of the wall
  const w = localFrame(x, y + 0.64, z, f).at(0, 0, -0.14);
  b.add(CBOX(), M(w[0], w[1], w[2], f, 0.04, 0.04, 0.36), LANTERN, NONE);
  b.add(ICO(0), M(x, y + 0.08, z, f, 0.13, 0.13, 0.13), GHOST, swing);
  b.add(CONE(8), M(x, y - 0.3, z, f, 0.17, 0.36, 0.17), GHOST, swing);
  const q = localFrame(x, y, z, f).at(0, 0.1, 0.125);
  b.add(EYES(), M(q[0], q[1], q[2], f, 0.14, 0.1, 1), EYE, swing);
}

/** A porch lantern on the wall (`p` = its middle), lit at night. */
function addLantern(b: Batch, p: V3, f: number, halos: HaloSpot[]): void {
  const [x, y, z] = p;
  b.add(CBOX(), M(x, y + 0.13, z, f, 0.18, 0.05, 0.18), LANTERN, NONE);
  b.add(CBOX(), M(x, y, z, f, 0.13, 0.2, 0.13), LAMP, GLOW);
  halos.push({ x, y, z, size: 0.95, color: HALO_LAMP });
}

/** A small trick-or-treater standing at `p`, facing `f` (0 ghost sheet, 1 witch, 2 pumpkin). */
export function addFigure(b: Batch, p: V3, f: number, costume: number): void {
  const [x, y, z] = p;
  const L = localFrame(x, y, z, f);
  // W7-H2: the whole child rocks gently from the feet (the toy shader's sway), the grin keeps its glow
  const rock = swayInfo(y, 1.1, FIGURE_SWAY), rockGlow = swayInfo(y, 1.1, FIGURE_SWAY, GLOW[3]);
  const eyes = (up: number, fwd: number, c = EYE) => { for (const s of [-0.06, 0.06]) { const q = L.at(s, up, fwd); b.add(CBOX(), M(q[0], q[1], q[2], f, 0.04, 0.06, 0.02), c, rock); } };
  if (costume === 0) {
    // the sheet: a round head and a wide skirt down to the ground, two dark eyes, two little shoes peeking out
    b.add(CYL_SKIRT(), M(x, y, z, f, 0.3, 0.72, 0.3), GHOST, rock);
    b.add(ICO(1), M(x, y + 0.8, z, f, 0.2, 0.22, 0.2), GHOST, rock);
    eyes(0.84, 0.18);
    for (const s of [-0.1, 0.1]) { const q = L.at(s, 0, 0.2); b.add(CBOX(), M(q[0], q[1] + 0.03, q[2], f, 0.08, 0.06, 0.12), SHOE, rock); }
  } else if (costume === 1) {
    // the witch: a purple robe, a face, the tall black hat with its brim, a broom
    b.add(CONE(8), M(x, y, z, f, 0.26, 0.74, 0.26), WITCH, rock);
    b.add(ICO(1), M(x, y + 0.8, z, f, 0.16, 0.17, 0.16), SKIN, rock);
    eyes(0.83, 0.15);
    b.add(CYL_SKIRT(), M(x, y + 0.9, z, f, 0.28, 0.03, 0.28), HAT, rock);
    b.add(CONE(8), M(x, y + 0.92, z, f, 0.15, 0.4, 0.15, -0.15), HAT, rock);
    const q = L.at(0.24, 0.02, 0.05);
    b.add(BOX(), M(q[0], q[1], q[2], f, 0.03, 0.8, 0.03, 0, -0.2), '#8a6a45', rock);
    b.add(CONE(6), M(q[0] + 0.02, q[1], q[2], f, 0.08, 0.2, 0.08), '#c9a15a', rock);
  } else {
    // the pumpkin kid: a round orange body with a carved grin, a green cap, a face, two legs
    for (const s of [-0.08, 0.08]) { const q = L.at(s, 0, 0); b.add(BOX(), M(q[0], q[1], q[2], f, 0.08, 0.3, 0.08), '#3f5f2e', rock); }
    b.add(ICO(1), M(x, y + 0.5, z, f, 0.3, 0.26, 0.3), ORANGE[0], rock);
    const g = L.at(0, 0.46, 0.28);
    b.add(CBOX(), M(g[0], g[1], g[2], f, 0.24, 0.05, 0.04), CARVE, rockGlow);
    b.add(ICO(1), M(x, y + 0.9, z, f, 0.15, 0.16, 0.15), SKIN, rock);
    eyes(0.92, 0.14);
    b.add(CYL_SKIRT(), M(x, y + 1.02, z, f, 0.12, 0.08, 0.12), STEM, rock);
  }
  // the treat bucket: a little orange pail
  const k = L.at(-0.24, 0.3, 0.08);
  b.add(CYL_SKIRT(), M(k[0], k[1] - 0.12, k[2], f, 0.07, 0.12, 0.07), '#f08a24', rock);
}
const CYL_SKIRT = () => CONE_TRUNC();
let truncGeo: THREE.BufferGeometry | null = null;
const CONE_TRUNC = () => (truncGeo ??= new THREE.CylinderGeometry(0.72, 1, 1, 10, 1).translate(0, 0.5, 0));

/** Everything on one stoop into `b` (its halos into `halos`). */
export function addStoop(b: Batch, s: Stoop, halos: HaloSpot[], figures: boolean): void {
  const h = stoopHash(s.i);
  const L = localFrame(s.x, s.y, s.z, s.f);
  const v = h % 20;
  const col = (k: number) => ORANGE[(h >>> (4 + k)) % ORANGE.length];
  let lampSide = 0.3;
  if (v < 8) {
    addPumpkin(b, L.at(0, 0, 0), 0.34, s.f, col(0), true, GLOW, halos);
    addPumpkin(b, L.at(0.58, 0, -0.06), 0.21, s.f + 0.6, col(1), false);
  } else if (v < 12) {
    addPumpkin(b, L.at(-0.44, 0, 0), 0.29, s.f, col(0), true, GLOW, halos);
    addPumpkin(b, L.at(0.08, 0, 0.06), 0.2, s.f - 0.4, col(1), false);
    addPumpkin(b, L.at(0.48, 0, -0.02), 0.16, s.f + 0.9, col(2), (h >>> 9) % 2 === 0, GLOW);
  } else if (v < 16) {
    addPumpkin(b, L.at(0, 0, 0), 0.33, s.f, col(0), true, GLOW, halos);
    const right = (h >>> 7) % 2 === 1;
    addWeb(b, L.at(right ? -0.75 : 0.75, 2.45, -0.43), s.f, right ? 1 : -1, 0.55);
  } else {
    addPumpkin(b, L.at(0.14, 0, 0), 0.27, s.f, col(0), true, GLOW, halos);
    addHangingGhost(b, L.at(-0.5, 1.55, -0.22), s.f);
    lampSide = 0.45;
  }
  if ((h >>> 11) % 2 === 0) addLantern(b, L.at(lampSide, 1.6, -0.36), s.f, halos);
  const fig = figures ? stoopFigure(s.i) : -1;
  // on the sidewalk beside the pumpkins, turned to the door (never out on the roadway)
  if (fig >= 0) addFigure(b, L.at(s.fig === 2 ? 1.0 : -1.0, 0, 0.05), s.f + Math.PI * (s.fig === 2 ? 1.2 : 0.8), fig);
}

// --- the cells ------------------------------------------------------------------------------------------------------

/**
 * (W7-H5) No stoop dressing within DOOR_CLEAR (u) of one of lane G's trick-or-treat doors or its knock spot: G's porch
 * dresses that door. The placement script leaves them out (scripts/opus-sf/halloween-place.mts); this guard also keeps
 * clear of a door G appends later (treatDoors.ts is append-only).
 */
export const DOOR_CLEAR = 3.5;
let byDoor: Set<number> | null = null;
/** The stoops within DOOR_CLEAR of a treat door or its knock spot (none after the W7 placement, unless G adds doors). */
export function stoopsByDoors(): ReadonlySet<number> {
  if (byDoor) return byDoor;
  byDoor = new Set();
  for (const d of TREAT_DOORS) {
    if (d.gone) continue;
    for (const p of [{ x: d.x, z: d.z }, { x: d.x + Math.sin(d.f) * KNOCK_OUT, z: d.z + Math.cos(d.f) * KNOCK_OUT }]) {
      for (let i = 0, n = stoopCount(); i < n; i++) {
        const o = i * STOOP_STRIDE;
        if (Math.hypot(STOOPS[o] / 10 - p.x, STOOPS[o + 1] / 10 - p.z) < DOOR_CLEAR) byDoor.add(i);
      }
    }
  }
  return byDoor;
}

const cellKey = (cx: number, cz: number) => (cx + 1024) * 4096 + (cz + 1024);
let index: Map<number, number[]> | null = null;
/** The stoops of each 48 u cell (built once; the ones beside a treat door left out). */
export function stoopIndex(): Map<number, number[]> {
  if (index) return index;
  index = new Map();
  const skip = stoopsByDoors();
  for (let i = 0, n = stoopCount(); i < n; i++) {
    if (skip.has(i)) continue;
    const o = i * STOOP_STRIDE;
    const k = cellKey(Math.floor(STOOPS[o] / 10 / CELL), Math.floor(STOOPS[o + 1] / 10 / CELL));
    let list = index.get(k);
    if (!list) index.set(k, (list = []));
    list.push(i);
  }
  return index;
}

/** The nearest stoop within `max` of (x, z) (u), or null. */
export function nearestStoop(x: number, z: number, max: number, accept?: (i: number) => boolean): { i: number; d: number } | null {
  const ix = stoopIndex();
  let best: { i: number; d: number } | null = null;
  const r = Math.ceil(max / CELL);
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let a = -r; a <= r; a++) for (let c = -r; c <= r; c++) {
    for (const i of ix.get(cellKey(cx + a, cz + c)) ?? []) {
      const o = i * STOOP_STRIDE;
      const d = Math.hypot(STOOPS[o] / 10 - x, STOOPS[o + 1] / 10 - z);
      if (d <= max && (!best || d < best.d) && (!accept || accept(i))) best = { i, d };
    }
  }
  return best;
}

interface CellGeo { key: number; pos: Float32Array; nor: Float32Array; col: Float32Array; inf: Float32Array; idx: Uint32Array; verts: number; halos: HaloSpot[]; figures: number[]; figuresOn: boolean }

/** a Batch that keeps nothing (the halos of a cell without its geometry) */
const NO_BATCH = { add() { return NO_BATCH; } } as unknown as Batch;

/**
 * (W7-H4) The stoops' night glow, nearest first: every halo of the given cells sorted by its distance to (px, pz), the
 * first `cap` kept — so when a dense street at night has more lanterns than the cap, the ones beside the player glow
 * and the far ones go (W6 kept whole cells in cell order: a far corner of a near cell could win over the next door).
 */
export function nearestHalos(cells: readonly (readonly HaloSpot[])[], px: number, pz: number, cap: number): HaloSpot[] {
  const all: HaloSpot[] = [];
  for (const c of cells) for (const h of c) all.push(h);
  const d = new Map<HaloSpot, number>();
  for (const h of all) d.set(h, (h.x - px) ** 2 + (h.z - pz) ** 2);
  all.sort((a, b) => d.get(a)! - d.get(b)!);
  if (all.length > cap) all.length = Math.max(0, cap);
  return all;
}
/** the stoops' halos are re-sorted when the player has moved this far (u) since the last sort */
export const HALO_RESORT = 8;
/** The halos of a cell's stoops (no geometry built). */
export function cellHalos(key: number): HaloSpot[] {
  const halos: HaloSpot[] = [];
  for (const i of stoopIndex().get(key) ?? []) addStoop(NO_BATCH, stoopAt(i), halos, false);
  return halos;
}

export function buildCell(key: number, figures: boolean): CellGeo {
  const b = new Batch();
  const halos: HaloSpot[] = [];
  const figs: number[] = [];
  for (const i of stoopIndex().get(key) ?? []) {
    addStoop(b, stoopAt(i), halos, figures);
    if (figures && stoopFigure(i) >= 0) figs.push(i);
  }
  return { key, pos: new Float32Array(b.pos), nor: new Float32Array(b.nor), col: new Float32Array(b.col), inf: new Float32Array(b.inf), idx: new Uint32Array(b.idx), verts: b.vertexCount, halos, figures: figs, figuresOn: figures };
}

function assemble(cells: readonly CellGeo[]): THREE.BufferGeometry | null {
  let nv = 0, ni = 0;
  for (const c of cells) { nv += c.verts; ni += c.idx.length; }
  if (!nv) return null;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), inf = new Float32Array(nv * 4);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, k = 0;
  for (const c of cells) {
    pos.set(c.pos, v * 3); nor.set(c.nor, v * 3); col.set(c.col, v * 3); inf.set(c.inf, v * 4);
    for (let j = 0; j < c.idx.length; j++) idx[k + j] = c.idx[j] + v;
    v += c.verts; k += c.idx.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(inf, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// --- the bats -------------------------------------------------------------------------------------------------------

/**
 * Where bats circle at dusk. `y` = the crown of the published ground under the colony's whole circle (heightAt, sf/v1;
 * W6-H review: the first values sat 5–13 u below the hills, and the bats flew inside Buena Vista and Twin Peaks —
 * tests/opus-bay-w6-h-review.test.ts keeps the band clear of the ground).
 */
export const BAT_COLONIES: readonly { id: string; x: number; z: number; y: number; r: number }[] = [
  { id: 'alamo-square', x: -16, z: 592, y: 18.5, r: 11 },
  { id: 'buena-vista', x: 25, z: 728, y: 33.7, r: 9 },
  { id: 'twin-peaks', x: 128, z: 935, y: 49.8, r: 15 },
];
export const BATS_PER_COLONY = 10;
/** the bats' flight above the colony's y: its middle, the spread between bats, the bob of each (u) */
const BAT_ALT = 8, BAT_SPREAD = 3, BAT_BOB = 1.1, BAT_WING = 0.4;
/** The band the bats fly in, relative to the colony's y: [lo, hi] (the review's test checks it clears the hill). */
export const batBand = (): { lo: number; hi: number } => ({ lo: BAT_ALT - BAT_SPREAD - BAT_BOB - BAT_WING, hi: BAT_ALT + BAT_SPREAD + BAT_BOB + BAT_WING });
export const BATS_NEAR = 260;
/** bats show from dusk (the toy night ≥ this) */
export const BATS_NIGHT = 0.3;
const BAT = '#3a3046';
/**
 * (W7-H3) Bats readable at full night: the wing tips catch the moon — a pale lavender rim that glows a little at night
 * (the toy shader's night glow, aInfo.w), the body stays dark, so a bat reads as a dark shape with lit wing edges
 * against the dark-blue sky (by dusk the sky is still light and the dark body carries it). A little bigger than W6.
 */
const BAT_RIM = '#b3a6dc';
export const BAT_GLOW = { body: 0.12, shoulder: 0.2, tip: 0.55 } as const;
const BAT_SIZE = 0.3;

export interface Bats { mesh: THREE.Mesh; place(c: (typeof BAT_COLONIES)[number] | null): void; step(t: number): void; colony(): string | null }

export function createBats(): Bats {
  const n = BATS_PER_COLONY, vpb = 12;
  const pos = new Float32Array(n * vpb * 3);
  const nor = new Float32Array(n * vpb * 3), col = new Float32Array(n * vpb * 3), inf = new Float32Array(n * vpb * 4);
  const c = new THREE.Color(BAT), rim = new THREE.Color(BAT_RIM);
  for (let v = 0; v < n * vpb; v++) {
    // 0–3 body, 4 / 5 and 8 / 9 the shoulders, 6 / 7 and 10 / 11 the wing tips (the rim)
    const j = v % vpb, tip = j === 6 || j === 7 || j === 10 || j === 11, body = j < 4;
    const cc = tip ? rim : c;
    nor[v * 3 + 1] = 1; col[v * 3] = cc.r; col[v * 3 + 1] = cc.g; col[v * 3 + 2] = cc.b;
    inf[v * 4 + 3] = tip ? BAT_GLOW.tip : body ? BAT_GLOW.body : BAT_GLOW.shoulder;
  }
  const idx: number[] = [];
  for (let k = 0; k < n; k++) {
    const o = k * vpb;
    // body: nose 0, left 1, tail 2, right 3 · left wing: 4 5 (shoulder front / back) 6 7 (tip front / back) · right: 8–11
    const tri = [o, o + 1, o + 2, o, o + 2, o + 3, o + 4, o + 6, o + 7, o + 4, o + 7, o + 5, o + 8, o + 11, o + 10, o + 8, o + 9, o + 11];
    // both windings (the shared single-sided TOY_DYN: no double-sided program of its own)
    idx.push(...tri);
    for (let j = 0; j < tri.length; j += 3) idx.push(tri[j], tri[j + 2], tri[j + 1]);
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aInfo', new THREE.BufferAttribute(inf, 4));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, TOY_DYN);
  mesh.name = 'halloween-bats';
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  let at: (typeof BAT_COLONIES)[number] | null = null;
  const put = (v: number, x: number, y: number, z: number) => { pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; };
  return {
    mesh,
    colony: () => at?.id ?? null,
    place: col0 => {
      at = col0;
      mesh.visible = !!col0;
      if (col0) geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(col0.x, col0.y + 10, col0.z), col0.r + 12);
    },
    step: t => {
      if (!at) return;
      for (let k = 0; k < n; k++) {
        const ph = k * 2.39996, r = at.r * (0.55 + 0.45 * ((k * 0.618) % 1));
        const w = (0.35 + 0.25 * ((k * 0.37) % 1)) * (k % 3 === 0 ? -1 : 1);
        const a = t * w + ph;
        const x = at.x + Math.sin(a) * r + Math.sin(t * 0.7 + k) * 1.2;
        const z = at.z + Math.cos(a) * r;
        const y = at.y + BAT_ALT + BAT_SPREAD * Math.sin(ph) + Math.sin(t * 1.3 + k * 1.7) * BAT_BOB;
        // heading: the tangent of the circle (dir of motion)
        const hx = Math.cos(a) * Math.sign(w), hz = -Math.sin(a) * Math.sign(w);
        const sx = hz, sz = -hx;
        const flap = Math.sin(t * 14 + k * 1.9) * 0.75, s = BAT_SIZE;
        const o = k * vpb;
        put(o, x + hx * s * 0.8, y, z + hz * s * 0.8);
        put(o + 1, x + sx * s * 0.28, y + 0.02, z + sz * s * 0.28);
        put(o + 2, x - hx * s * 0.7, y, z - hz * s * 0.7);
        put(o + 3, x - sx * s * 0.28, y + 0.02, z - sz * s * 0.28);
        const cy = Math.cos(flap), sy = Math.sin(flap);
        // both wings (a counted loop: no array a bat a frame)
        for (let side = 1; side >= -1; side -= 2) {
          const b = o + (side > 0 ? 4 : 8);
          const bx = x + sx * s * 0.25 * side, bz = z + sz * s * 0.25 * side;
          put(b, bx + hx * s * 0.35, y, bz + hz * s * 0.35);
          put(b + 1, bx - hx * s * 0.4, y, bz - hz * s * 0.4);
          const tx = bx + sx * s * 1.5 * side * cy, ty = y + s * 1.5 * sy, tz = bz + sz * s * 1.5 * side * cy;
          put(b + 2, tx + hx * s * 0.1, ty, tz + hz * s * 0.1);
          put(b + 3, tx - hx * s * 0.7, ty - s * 0.2, tz - hz * s * 0.7);
        }
      }
      attr.needsUpdate = true;
    },
  };
}

// --- the system -----------------------------------------------------------------------------------------------------

export interface DressState { stoops: boolean; figures: boolean; bats: boolean }

export interface Dress {
  group: THREE.Group;
  /** what the phase and the hour want (world.ts decides) */
  want(s: DressState): void;
  /** per frame */
  step(dt: number, t: number, px: number, pz: number): void;
  halos(): readonly HaloSpot[];
  stats(): { cells: number; stoops: number; tris: number; figures: number; bats: string | null };
  /** the nearest drawn trick-or-treater within `max` (u) */
  nearFigure(x: number, z: number, max: number): boolean;
  dispose(): void;
}

export function createDress(): Dress {
  const group = new THREE.Group();
  group.name = 'halloween-dress';
  const cache = new Map<number, CellGeo>();
  let mesh: THREE.Mesh | null = null;
  let shown: number[] = [];
  let halos: HaloSpot[] = [];
  let state: DressState = { stoops: false, figures: false, bats: false };
  let acc = 1;
  const bats = createBats();
  group.add(bats.mesh);
  let figures: number[] = [];

  const drop = () => { if (!mesh) return; group.remove(mesh); mesh.geometry.dispose(); mesh = null; shown = []; figures = []; };

  /** the cells holding stoops whose square comes within R of (px, pz), nearest first */
  const cellsWithin = (px: number, pz: number, R: number): number[] => {
    const ix = stoopIndex();
    const cx0 = Math.floor((px - R) / CELL), cx1 = Math.floor((px + R) / CELL), cz0 = Math.floor((pz - R) / CELL), cz1 = Math.floor((pz + R) / CELL);
    const out: { k: number; d: number }[] = [];
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const k = cellKey(cx, cz);
      if (!ix.has(k)) continue;
      const mx = Math.max(cx * CELL, Math.min(px, cx * CELL + CELL)), mz = Math.max(cz * CELL, Math.min(pz, cz * CELL + CELL));
      const d = Math.hypot(mx - px, mz - pz);
      if (d <= R) out.push({ k, d: Math.hypot((cx + 0.5) * CELL - px, (cz + 0.5) * CELL - pz) });
    }
    return out.sort((a, b) => a.d - b.d).map(o => o.k);
  };
  const haloCache = new Map<number, HaloSpot[]>();
  let haloKeys = '';
  let haloAt = { x: Infinity, z: Infinity };

  const refresh = (px: number, pz: number) => {
    if (!state.stoops) { drop(); halos = []; haloKeys = ''; haloAt = { x: Infinity, z: Infinity }; return; }
    const q = game.get().settings.quality;
    // the night glow of the wider neighbourhood (positions only)
    const hk = cellsWithin(px, pz, HALO_NEAR[q] ?? HALO_NEAR.mid);
    const hkey = `${q}:${hk.join(',')}`;
    if (hkey !== haloKeys || Math.hypot(px - haloAt.x, pz - haloAt.z) > HALO_RESORT) {
      haloKeys = hkey;
      haloAt = { x: px, z: pz };
      const cells: HaloSpot[][] = [];
      for (const k of hk) {
        let h = haloCache.get(k);
        if (!h) { h = cellHalos(k); haloCache.set(k, h); }
        cells.push(h);
      }
      halos = nearestHalos(cells, px, pz, DRESS_HALOS_BY_QUALITY[q] ?? DRESS_HALOS_BY_QUALITY.mid);
      if (haloCache.size > 160) for (const k of [...haloCache.keys()]) if (!hk.includes(k)) haloCache.delete(k);
    }
    // the geometry near the player
    const want = cellsWithin(px, pz, DRESS_NEAR[q] ?? DRESS_NEAR.mid);
    let built = 0;
    const ready: CellGeo[] = [];
    let tris = 0, pending = false;
    for (const k of want) {
      let c = cache.get(k);
      if (c && c.figuresOn !== state.figures) { cache.delete(k); c = undefined; }
      if (!c) {
        if (built >= CELL_BUILDS_PER_STEP) { pending = true; continue; }
        c = buildCell(k, state.figures);
        cache.set(k, c);
        built++;
      }
      // nearest first: the triangle ceiling drops the far ones
      if (tris + c.idx.length / 3 > (DRESS_TRIS_BY_QUALITY[q] ?? DRESS_TRIS_BY_QUALITY.mid)) continue;
      tris += c.idx.length / 3;
      ready.push(c);
    }
    // forget far cells (keep a ring around the build radius)
    if (cache.size > 64) for (const k of [...cache.keys()]) if (!want.includes(k)) cache.delete(k);
    // not every wanted cell built yet: come back sooner
    if (pending) acc = 0.9;
    const keys = ready.map(c => c.key).sort((a, b) => a - b);
    const same = keys.length === shown.length && keys.every((k, n) => k === shown[n]);
    if (same && (mesh || !keys.length)) return;
    const geo = assemble(ready);
    drop();
    if (!geo) return;
    // TOY (not TOY_DYN): the static toy program with the wind sway (the figures' and ghosts' aInfo.z), the city L0
    // cells' kind (a plain Mesh, receiveShadow, no castShadow): already linked, nothing new to warm
    mesh = new THREE.Mesh(geo, TOY);
    mesh.name = 'halloween-stoops';
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    shown = keys;
    figures = ready.flatMap(c => c.figures);
  };

  return {
    group,
    want: s => {
      const changed = s.stoops !== state.stoops || s.figures !== state.figures;
      state = s;
      if (changed) acc = 1;
    },
    step: (dt, t, px, pz) => {
      if ((acc += dt) >= 1) { acc = 0; refresh(px, pz); }
      // bats: the nearest colony within reach, from dusk
      let col: (typeof BAT_COLONIES)[number] | null = null;
      if (state.bats && U.uNight.value >= BATS_NIGHT) {
        let bd = BATS_NEAR;
        for (const c of BAT_COLONIES) { const d = Math.hypot(c.x - px, c.z - pz); if (d < bd) { bd = d; col = c; } }
      }
      if (col?.id !== bats.colony()) bats.place(col);
      if (col) bats.step(t);
    },
    halos: () => halos,
    stats: () => ({ cells: shown.length, stoops: shown.reduce((s, k) => s + (stoopIndex().get(k)?.length ?? 0), 0), tris: mesh ? (mesh.geometry.index?.count ?? 0) / 3 : 0, figures: figures.length, bats: bats.colony() }),
    nearFigure: (x, z, max) => figures.some(i => { const s = stoopAt(i); return Math.hypot(s.x - x, s.z - z) <= max; }),
    dispose: () => {
      drop();
      cache.clear();
      group.remove(bats.mesh);
      bats.mesh.geometry.dispose();
    },
  };
}
