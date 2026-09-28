import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { canStand, heightAt, isWater } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bayNow, bayParts } from '../game/bayNow';
import { registerFrameSystem } from '../game/systemsRegistry';
import { cityStreamerLazy } from '../world/cityLoader';
import { BOX, CYL, ICO, M, Batch, freezeStatic, type Info } from '../world/builder';
import { meshWarmup, registerWarmup } from '../world/warmup';
import { getWorld, type WorldSystem } from '../world/world';
import { dressingOn, EMBARCADERO_SEAWALL, type CalendarRow } from './calendar';
import { makeKitMaterial } from './eventKit';
import { makeSmokeMaterial } from './jets';
import type { OfferedLine } from './lines';
import { tideAt, tidesOnDay, WRECK_LOW_FT, type TideExtreme } from './tides';

/**
 * Wave 5 · lane R (W5-R7) · the verified calendar's dressings in the world (realsf/calendar.ts `dress`):
 *
 *   pumpkins   Halloween (31 October): pumpkins on the Painted Ladies' stoops and along Waller Street between Scott and
 *              Steiner (the stretch Local News Matters names), their carved faces glowing at night. One merged mesh
 *              (≤ 1.6k triangles, one draw call) on its own kit material (TOY_DYN's program: no new program), warmed as
 *              `r-pumpkins`; built within 420 u of the street, dropped after the day.
 *   king-tide  the king-tide days (coastal.ca.gov): spray over the Embarcadero seawall behind the Ferry Building within
 *              100 minutes of the day's highest tide (tides.json), one small camera-free mesh of crossed fans (≤ 170
 *              triangles, one draw call; the Ferry gate's published headroom is 1 call and 2k) on its own instance of
 *              the jets' smoke material (the same program), warmed as `r-tide-spray`.
 *
 *   wrecks     not a calendar row but the baked tide (realsf/tides.ts): at a low tide of +1 ft or less the rusty engine of
 *              the Lyman Stewart (1922) and the stern post and engine of the Frank Buck (1937) rise out of the surf off
 *              Mile Rock Beach at Lands End ("Their engines are still visible at low tide", NOAA; seen from the Coastal
 *              Trail between the vista point and the Legion of Honor, Golden Gate National Parks Conservancy). One mesh
 *              (≤ 800 triangles, one draw call, own kit material, warmed `r-wrecks`) within 400 u; lower tide, more shows.
 *
 * BAYBAY says a calendar row's line once on its day within 220 u of the place (and the wrecks' line at a low tide
 * there). Nothing blocks walking.
 */

export interface Pumpkin { x: number; z: number; y?: number; r: number; f: number; face: boolean }

/**
 * scripts/opus-sf/realsf-place.mts (the published city, 2026-09-28): the Painted Ladies' seven stoops (the middle step,
 * and a jack-o'-lantern on the sidewalk at the foot; y = the landmark's base + the house's grade) and Waller Street's
 * street faces between Scott and Steiner (0.45 u out from the wall, standable, never the roadway). `f` = the facing
 * (the face looks toward (sin f, cos f)).
 */
export const HALLOWEEN_SPOTS: readonly Pumpkin[] = [
  // the Painted Ladies' stoops
  { x: 12.53, z: 574.33, y: 15.29, r: 0.15, f: -0.658, face: false },
  { x: 12.36, z: 574.96, y: 15.13, r: 0.26, f: -0.658, face: true },
  { x: 11.27, z: 573.36, y: 15.06, r: 0.15, f: -0.658, face: false },
  { x: 11.1, z: 573.98, y: 14.9, r: 0.26, f: -0.658, face: true },
  { x: 10, z: 572.38, y: 14.81, r: 0.15, f: -0.658, face: false },
  { x: 9.83, z: 573.01, y: 14.65, r: 0.26, f: -0.658, face: true },
  { x: 8.73, z: 571.4, y: 14.59, r: 0.15, f: -0.658, face: false },
  { x: 8.57, z: 572.03, y: 14.43, r: 0.26, f: -0.658, face: true },
  { x: 7.47, z: 570.42, y: 14.33, r: 0.15, f: -0.658, face: false },
  { x: 7.3, z: 571.05, y: 14.17, r: 0.26, f: -0.658, face: true },
  { x: 6.2, z: 569.44, y: 14.03, r: 0.15, f: -0.658, face: false },
  { x: 6.03, z: 570.07, y: 13.87, r: 0.26, f: -0.658, face: true },
  { x: 4.94, z: 568.46, y: 13.81, r: 0.15, f: -0.658, face: false },
  { x: 4.77, z: 569.09, y: 13.65, r: 0.26, f: -0.658, face: true },
  // Waller Street, Scott → Steiner
  { x: 48.38, z: 646.79, r: 0.22, f: 0.94, face: false },
  { x: 54.2, z: 649.07, r: 0.28, f: 0.962, face: true },
  { x: 49.3, z: 643.87, r: 0.22, f: 0.952, face: false },
  { x: 57.78, z: 648.89, r: 0.22, f: -2.142, face: false },
  { x: 56.15, z: 646.28, r: 0.28, f: 0.962, face: true },
  { x: 53.21, z: 639.39, r: 0.22, f: 0.742, face: false },
  { x: 64.26, z: 645.84, r: 0.22, f: -2.267, face: false },
  { x: 59.24, z: 641.85, r: 0.28, f: 0.962, face: true },
  { x: 63.15, z: 641.34, r: 0.22, f: -2.2, face: false },
  { x: 70.16, z: 636.95, r: 0.22, f: -2.171, face: false },
  { x: 65.15, z: 633.37, r: 0.28, f: 0.963, face: true },
  { x: 69.32, z: 632.11, r: 0.22, f: -2.18, face: false },
  { x: 72.49, z: 633.59, r: 0.22, f: -2.178, face: false },
  { x: 67.53, z: 629.96, r: 0.28, f: 0.962, face: true },
  { x: 63.94, z: 623.13, r: 0.22, f: 0.958, face: false },
  { x: 69.94, z: 626.43, r: 0.22, f: 0.999, face: false },
  { x: 76.12, z: 628.57, r: 0.28, f: -2.211, face: true },
  { x: 72.41, z: 622.97, r: 0.22, f: 0.961, face: false },
  { x: 75.23, z: 623.66, r: 0.22, f: -2.18, face: false },
];

/** the pumpkins' middle (the build radius is measured from here) */
export const PUMPKINS_AT = { x: 40, z: 605 };
export const PUMPKINS_NEAR = 420;
export const PUMPKIN_TRIS_MAX = 1600;

const ORANGE = ['#e8792b', '#d9651f', '#f0913a'];
const STEM = '#5e7a3a', CARVE = '#ffcf5a';
/** glow at night (the toy shader's night light): the carved faces */
const GLOW: Info = [0, 0, 0, 0.95];
const NONE: Info = [0, 0, 0, 0];

/** One merged geometry of pumpkins in world space; `ground` gives y where a spot has none. */
export function buildPumpkinGeometry(spots: readonly Pumpkin[], ground: (x: number, z: number) => number): THREE.BufferGeometry {
  const b = new Batch();
  spots.forEach((p, i) => {
    const y = p.y ?? ground(p.x, p.z);
    const r = p.r, h = r * 0.78;
    const color = ORANGE[i % ORANGE.length];
    // a squat faceted body, its stem, and (on the big ones) a carved face toward the street
    b.add(ICO(0), M(p.x, y + h, p.z, p.f + i * 0.7, r, h, r), color, NONE);
    b.add(BOX(), M(p.x, y + h * 1.85, p.z, p.f + i, r * 0.2, r * 0.42, r * 0.2), STEM, NONE);
    if (!p.face) return;
    const fx = Math.sin(p.f), fz = Math.cos(p.f), sx = Math.cos(p.f), sz = -Math.sin(p.f);
    const at = (side: number, up: number, out: number, w: number, hh: number) =>
      b.add(BOX(), M(p.x + sx * side + fx * out, y + h + up, p.z + sz * side + fz * out, p.f, w, hh, r * 0.08), CARVE, GLOW);
    at(-r * 0.3, r * 0.12, r * 0.86, r * 0.22, r * 0.2);
    at(r * 0.3, r * 0.12, r * 0.86, r * 0.22, r * 0.2);
    at(0, -r * 0.3, r * 0.84, r * 0.62, r * 0.16);
  });
  return b.build();
}

// --- the king-tide spray -------------------------------------------------------------------------------------------

/** the seawall's water edge behind the Ferry Building (the land side; the build finds the water within 4 u) */
export const SPRAY_BASES: readonly { x: number; z: number }[] = [
  { x: 118, z: -26 }, { x: 124, z: -25 }, { x: 130, z: -24 }, { x: 136, z: -23 }, { x: 141, z: -23 }, { x: 146, z: -21 },
];
export const SPRAY_WINDOW_MIN = 100;
export const SPRAY_NEAR = 400;
const FANS = 3, SPRAY_H = 1.7, SPRAY_W = 1.3, SPRAY_PERIOD = 2.6;

/** The day's highest high tide on a Bay date (null without the table). */
export function highestTide(dateKey: string, tides?: TideExtreme[]): TideExtreme | null {
  const list = (tides ?? tidesOnDay(dateKey)).filter(e => e.kind === 'H');
  return list.length ? list.reduce((a, b) => (b.ft > a.ft ? b : a)) : null;
}

/** Spray now: a king-tide day, within SPRAY_WINDOW_MIN of the day's highest tide. */
export function sprayUp(now: Date, rows: CalendarRow[] = dressingOn(bayParts(now).dateKey), tides?: TideExtreme[]): boolean {
  if (!rows.some(r => r.dress === 'king-tide')) return false;
  const top = highestTide(bayParts(now).dateKey, tides);
  return !!top && Math.abs(now.getTime() - top.ms) <= SPRAY_WINDOW_MIN * 60_000;
}

/** Where the water starts from a land point (the first water within 4 u, in the direction with the most water). */
function edgeOf(p: { x: number; z: number }): { x: number; z: number; dx: number; dz: number } | null {
  let best: { dx: number; dz: number; d: number } | null = null;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    for (let d = 0.25; d <= 4; d += 0.25) if (isWater(p.x + dx * d, p.z + dz * d)) { if (!best || d < best.d) best = { dx, dz, d }; break; }
  }
  return best ? { x: p.x + best.dx * best.d, z: p.z + best.dz * best.d, dx: best.dx, dz: best.dz } : null;
}

interface SprayMesh { mesh: THREE.Mesh; step(t: number): void }

function buildSpray(material: THREE.Material): SprayMesh | null {
  const edges = SPRAY_BASES.map(edgeOf).filter((e): e is NonNullable<typeof e> => !!e);
  if (!edges.length) return null;
  const quads = edges.length * FANS;
  const pos = new Float32Array(quads * 4 * 3);
  const idx: number[] = [];
  for (let q = 0; q < quads; q++) idx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const y0 = edges.map(e => heightAt(e.x - e.dx * 0.5, e.z - e.dz * 0.5));
  // fixed bounds (the fans never leave them): no per-frame recompute
  const cx = edges.reduce((s, e) => s + e.x, 0) / edges.length, cz = edges.reduce((s, e) => s + e.z, 0) / edges.length;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, Math.max(...y0) + 1, cz), Math.max(...edges.map(e => Math.hypot(e.x - cx, e.z - cz))) + SPRAY_W + SPRAY_H);
  const mesh = freezeStatic(new THREE.Mesh(geo, material));
  mesh.name = 'realsf-king-tide-spray';
  mesh.frustumCulled = true;
  const step = (t: number) => {
    let o = 0;
    edges.forEach((e, i) => {
      // each point bursts on its own beat: rises, hangs, falls back (0 … 1 … 0)
      const ph = ((t / SPRAY_PERIOD + i * 0.37) % 1 + 1) % 1;
      const h = SPRAY_H * Math.sin(Math.PI * Math.min(1, ph * 1.4)) * (0.8 + 0.2 * Math.sin(i * 2.1));
      for (let f = 0; f < FANS; f++) {
        const a = (f / FANS) * Math.PI + i;
        const ux = Math.cos(a) * SPRAY_W * 0.5, uz = Math.sin(a) * SPRAY_W * 0.5;
        const bx = e.x + e.dx * 0.2, bz = e.z + e.dz * 0.2, by = y0[i] - 0.1;
        const lean = 0.35 * h;
        const top = [bx - e.dx * lean, by + Math.max(0.01, h), bz - e.dz * lean];
        const verts = [[bx - ux, by, bz - uz], [bx + ux, by, bz + uz], [top[0] + ux * 1.4, top[1], top[2] + uz * 1.4], [top[0] - ux * 1.4, top[1], top[2] - uz * 1.4]];
        for (const v of verts) { pos[o++] = v[0]; pos[o++] = v[1]; pos[o++] = v[2]; }
      }
    });
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  };
  step(0);
  return { mesh, step };
}

// --- the Lands End wrecks at low tide --------------------------------------------------------------------------

/** the city sea surface (world/sf/water.ts WATER_Y; the test keeps them equal) */
export const SEA_SURFACE_Y = -0.6;
/**
 * Off Mile Rock Beach (OSM way 195638010, 37.7874, −122.5062), in the surf west of it: the Lyman Stewart's engine and
 * the Frank Buck's stern post and engine (toy shapes, no names on them).
 */
export const WRECKS: readonly { id: 'lyman-stewart' | 'frank-buck'; x: number; z: number; yaw: number }[] = [
  { id: 'lyman-stewart', x: -751.5, z: 1096.5, yaw: 0.6 },
  { id: 'frank-buck', x: -756, z: 1107, yaw: -0.5 },
];
export const WRECKS_NEAR = 400;
export const WRECK_TRIS_MAX = 800;
export const WRECKS_LINE: Bilingual = { zh: '低潮啦！看，老沉船的发动机露出水面了。', en: 'Low tide! Look — the old wrecks’ engines are out of the water.' };

/** How much of the wrecks shows (0 hidden … 1 the most) at a tide of `ft` (ft MLLW; null: no table → hidden). */
export function wreckExposure(ft: number | null): number {
  if (ft === null || ft > WRECK_LOW_FT) return 0;
  return Math.min(1, Math.max(0.15, (WRECK_LOW_FT - ft) / 2));
}

const RUST = '#8a4b2d', RUST_D = '#5f3322', IRON = '#4a4b50', WEED = '#4f6b3a';

/** The wrecks in world space around y = 0 (the mesh is lifted by the tide). */
export function buildWreckGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  for (const w of WRECKS) {
    const c = Math.cos(w.yaw), sn = Math.sin(w.yaw);
    const at = (lx: number, lz: number) => ({ x: w.x + lx * c + lz * sn, z: w.z - lx * sn + lz * c });
    // the engine block: a squat rusty boiler on its side, a cylinder head and two rods
    const p = at(0, 0);
    b.add(CYL(8), M(p.x, 0, p.z, w.yaw, 0.75, 1.1, 0.75), RUST, NONE);
    b.add(BOX(), M(p.x, 1.1, p.z, w.yaw, 1.1, 0.35, 0.9), RUST_D, NONE);
    for (const lx of [-0.35, 0.35]) { const q = at(lx, 0.55); b.add(BOX(), M(q.x, 0.9, q.z, w.yaw + 0.3, 0.12, 0.9, 0.12), IRON, NONE); }
    const weed = at(0.5, -0.4);
    b.add(ICO(0), M(weed.x, 0.2, weed.z, 0, 0.35, 0.25, 0.35), WEED, NONE);
    if (w.id === 'frank-buck') {
      // the stern post: a tall leaning rib of the hull and two short ribs
      const s0 = at(-1.6, 0.4);
      b.add(BOX(), M(s0.x, 0, s0.z, w.yaw, 0.28, 2.6, 0.28), RUST_D, NONE);
      for (const lx of [-2.3, -0.9]) { const r = at(lx, -0.6); b.add(BOX(), M(r.x, 0, r.z, w.yaw + 0.2, 0.18, 1.3, 0.18), RUST, NONE); }
    }
  }
  return b.build();
}

// --- the system --------------------------------------------------------------------------------------------------

export interface Dressing {
  offered(): OfferedLine[];
  stats(): { rows: string[]; pumpkins: number; pumpkinTris: number; spray: boolean; sprayTris: number; wrecks: number; wreckTris: number };
  off(): void;
}

const LINE_NEAR = 220;

export function initDressing(): Dressing {
  const pumpkinMat = makeKitMaterial();
  pumpkinMat.name = 'ob-realsf-pumpkins';
  const sprayMat = makeSmokeMaterial();
  sprayMat.name = 'ob-realsf-tide-spray';
  sprayMat.opacity = 0.6;
  const offWarmP = registerWarmup('r-pumpkins', () => meshWarmup(pumpkinMat, { receiveShadow: true }));
  const offWarmS = registerWarmup('r-tide-spray', () => meshWarmup(sprayMat));
  const wreckMat = makeKitMaterial();
  wreckMat.name = 'ob-realsf-wrecks';
  const offWarmW = registerWarmup('r-wrecks', () => meshWarmup(wreckMat, { receiveShadow: true }));

  const group = new THREE.Group();
  group.name = 'realsf-dressing';
  let offSystem: (() => void) | null = null;
  const attach = () => {
    if (offSystem || !cityStreamerLazy()) return;
    const sys: WorldSystem = { name: 'realsf-dressing', group };
    offSystem = getWorld().addSystem(sys);
  };

  let pumpkins: THREE.Mesh | null = null;
  let spray: SprayMesh | null = null;
  let wrecks: THREE.Mesh | null = null;
  let wreckShow = 0;
  let rows: CalendarRow[] = [];
  let lines: OfferedLine[] = [];
  let clock = 0;

  const dropPumpkins = () => { if (!pumpkins) return; group.remove(pumpkins); pumpkins.geometry.dispose(); pumpkins = null; };
  const dropSpray = () => { if (!spray) return; group.remove(spray.mesh); spray.mesh.geometry.dispose(); spray = null; };
  const dropWrecks = () => { if (!wrecks) return; group.remove(wrecks); wrecks.geometry.dispose(); wrecks = null; };

  let acc = 1;
  const offFrame = registerFrameSystem('w5-realsf-dressing', dt => {
    clock += dt;
    spray?.step(clock);
    if ((acc += dt) < 0.5) return;
    acc = 0;
    attach();
    const now = bayNow();
    rows = dressingOn(bayParts(now).dateKey);
    const p = { x: runtime.player.x, z: runtime.player.z };
    const d = (q: { x: number; z: number }) => Math.hypot(p.x - q.x, p.z - q.z);
    // Halloween
    const wantP = !!offSystem && rows.some(r => r.dress === 'pumpkins') && d(PUMPKINS_AT) < PUMPKINS_NEAR;
    if (!wantP) dropPumpkins();
    else if (!pumpkins && HALLOWEEN_SPOTS.every(s => s.y !== undefined || canStand(s.x, s.z, 0.1))) {
      pumpkins = freezeStatic(new THREE.Mesh(buildPumpkinGeometry(HALLOWEEN_SPOTS, heightAt), pumpkinMat));
      pumpkins.name = 'realsf-halloween-pumpkins';
      pumpkins.receiveShadow = true;
      group.add(pumpkins);
    }
    // the king tide's spray
    const wantS = !!offSystem && sprayUp(now, rows) && d(EMBARCADERO_SEAWALL) < SPRAY_NEAR;
    if (!wantS) dropSpray();
    else if (!spray && canStand(SPRAY_BASES[0].x, SPRAY_BASES[0].z, 0.2)) {
      spray = buildSpray(sprayMat);
      if (spray) group.add(spray.mesh);
    }
    // the Lands End wrecks: out of the water at a low tide (+1 ft or less), lower tide, more shows
    const ft = tideAt(now.getTime());
    wreckShow = wreckExposure(ft);
    if (!offSystem || wreckShow <= 0 || d(WRECKS[0]) > WRECKS_NEAR) dropWrecks();
    else {
      if (!wrecks) {
        wrecks = new THREE.Mesh(buildWreckGeometry(), wreckMat);
        wrecks.name = 'realsf-lands-end-wrecks';
        wrecks.matrixAutoUpdate = false;
        wrecks.receiveShadow = true;
        group.add(wrecks);
      }
      const y = SEA_SURFACE_Y - 1.0 + 1.25 * wreckShow;
      if (Math.abs(wrecks.position.y - y) > 0.005) { wrecks.position.y = y; wrecks.updateMatrix(); }
    }
    lines = rows.filter(r => r.line && r.xz && (r.dress !== 'king-tide' || sprayUp(now, rows) || (ft ?? 0) > 5.5) && d(r.xz) < LINE_NEAR)
      .map(r => ({ key: `calendar-${r.id}`, text: r.line as Bilingual }));
    if (wrecks && wreckShow >= 0.3 && d(WRECKS[0]) < 150) lines.push({ key: 'wrecks-low-tide', text: WRECKS_LINE });
  }, 5);

  const tris = (m: THREE.Mesh | null | undefined) => (m ? (m.geometry.index?.count ?? 0) / 3 : 0);
  return {
    offered: () => lines,
    stats: () => ({ rows: rows.map(r => r.id), pumpkins: pumpkins ? HALLOWEEN_SPOTS.length : 0, pumpkinTris: tris(pumpkins), spray: !!spray, sprayTris: tris(spray?.mesh), wrecks: wrecks ? +wreckShow.toFixed(2) : 0, wreckTris: tris(wrecks) }),
    off: () => {
      offFrame(); dropPumpkins(); dropSpray(); dropWrecks();
      offSystem?.(); offSystem = null;
      offWarmP(); offWarmS(); offWarmW();
      pumpkinMat.dispose(); sprayMat.dispose(); wreckMat.dispose();
    },
  };
}
