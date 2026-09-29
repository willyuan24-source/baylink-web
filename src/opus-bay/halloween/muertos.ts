import * as THREE from 'three';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { toast } from '../core/store';
import type { Bilingual } from '../core/types';
import { onSaveCleared } from '../data/save';
import { paidSet } from '../eggs/paid';
import { bubble } from '../game/flow';
import { BAYBAY_ID } from '../game/interactables';
import { BOX, CBOX, CYL, ICO, M, Batch, type Info } from '../world/builder';
import { spawnFx } from '../world/fx';
import { TOY_DYN } from '../world/materials';
import { MARIGOLDS, MUERTOS_SPOTS, PICADO, ROUTE_CORNERS } from './muertosSpots';
import { halloweenSource } from './rewards';
import type { HaloSpot } from './worldHalos';
import { lineText, type WorldLineKey } from './worldLines';

/**
 * Wave 6 · lane H (W6-H3) · Día de los Muertos in the Mission, 1–2 November (halloweenPhase 'muertos'): papel picado
 * over the procession's first legs (24th St from Bryant to Mission, Bryant from 22nd to 24th), marigold pots along 24th
 * St, six altars at Potrero del Sol Park (the Festival of Altars), a community altar at Acción Latina's door on 24th St,
 * and a marigold arch where the procession gathers at 22nd & Bryant (halloween/muertosSpots.ts, placed on the published
 * city by scripts/opus-sf/muertos-place.mts, which carries the sources: SFMTA's 2025 route and time, Mission Local and El
 * Tecolote on the 2025 Festival of Altars; checked 2026-09-29). BAYBAY speaks quietly there (worldLines.ts muertos*).
 *
 * Visiting one (within MUERTOS_PICK, on foot / bike / car) is a find: a soft sparkle, a toast, the reward
 * `halloween:muertos:<n>` (MUERTOS_COINS, once), and `muertos:12` when every one was seen (muertos:9…11 unused). One
 * merged mesh (TOY_DYN) within MUERTOS_NEAR of the route; the candles' halos go to the Halloween halo pool.
 */

export const MUERTOS_PICK = 2.6;
export const MUERTOS_NEAR = 260;
export const MUERTOS_COINS = 3;
export const MUERTOS_ALL = { id: 'muertos:12', coins: 10 } as const;
/** the middle of it all (the build radius is measured from here) */
export const MUERTOS_AT = { x: 470, z: 640 };
/** BAYBAY's hello within this of the route's middle, the procession line within this of 22nd & Bryant */
export const MUERTOS_HELLO_NEAR = 120;
export const PROCESSION_NEAR = 25;

const PICADO_COLORS = ['#e8488a', '#f28c28', '#8e44ad', '#f4d03f', '#27ae60', '#3498db', '#e74c3c'];
const MARIGOLD = ['#f39c12', '#f5b041', '#e67e22'];
const LEAF = '#3f7a3a', CLOTH = '#f4ead6', PURPLE = '#6c3483', PINK = '#d9468a', WAX = '#f6efe0', FLAME = '#ffcf6a', FRAME = '#5a3d2b', PHOTO = '#d8c9a8', SKULL = '#fbf7f0', POT = '#b5623a', STRING = '#3b3a40';
const GLOW: Info = [0, 0, 0, 1.3];
const NONE: Info = [0, 0, 0, 0];
const CANDLE_HALO = new THREE.Color(1.0, 0.66, 0.3);

type V3 = [number, number, number];
const frame = (x: number, y: number, z: number, f: number) => {
  const fx = Math.sin(f), fz = Math.cos(f), sx = Math.cos(f), sz = -Math.sin(f);
  return (side: number, up: number, fwd: number): V3 => [x + sx * side + fx * fwd, y + up, z + sz * side + fz * fwd];
};

let flagGeo: THREE.BufferGeometry | null = null;
/** A paper flag (a unit rectangle with a scalloped bottom), both windings: seen from either side of the street. */
const FLAG = (): THREE.BufferGeometry => (flagGeo ??= (() => {
  const v = [-0.5, 0, 0.5, 0, 0.5, -0.8, 0.25, -1, 0, -0.8, -0.25, -1, -0.5, -0.8];
  const tris = [[0, 2, 1], [0, 6, 2], [6, 4, 2], [2, 4, 3], [6, 5, 4]];
  const pos: number[] = [];
  for (const [a, b, c] of tris) for (const k of [a, b, c, a, c, b]) pos.push(v[k * 2], v[k * 2 + 1], 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nor: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) nor.push(0, 0, Math.floor(i / 3) % 2 ? -1 : 1);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i));
  return g;
})());

/** A marigold pot: a clay pot and a mound of orange and gold blooms. */
function addMarigolds(b: Batch, p: V3, k: number): void {
  const [x, y, z] = p;
  b.add(CYL(6, 1.25), M(x, y, z, k, 0.16, 0.2, 0.16), POT, NONE);
  b.add(ICO(0), M(x, y + 0.26, z, k, 0.2, 0.1, 0.2), LEAF, NONE);
  for (let i = 0; i < 4; i++) {
    const a = k + i * 1.7, r = i === 0 ? 0 : 0.11;
    b.add(ICO(0), M(x + Math.sin(a) * r, y + 0.33 + (i === 0 ? 0.05 : 0), z + Math.cos(a) * r, a, 0.09, 0.08, 0.09), MARIGOLD[(i + k) % 3], NONE);
  }
}

/** A string of papel picado from (x0, z0) to (x1, z1) at height y, sagging a little in the middle. */
function addPicado(b: Batch, s: readonly number[], k: number): void {
  const [x0, z0, x1, z1, y] = s;
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz) - Math.PI / 2;
  const sag = (t: number) => y - 0.35 * (1 - (2 * t - 1) ** 2);
  const n = Math.max(3, Math.floor(len / 0.62));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    b.add(CBOX(), M(x0 + dx * (t0 + t1) / 2, (sag(t0) + sag(t1)) / 2, z0 + dz * (t0 + t1) / 2, yaw, len / n, 0.025, 0.025, 0, Math.atan2(sag(t1) - sag(t0), len / n)), STRING, NONE);
    const t = (i + 0.5) / n;
    b.add(FLAG(), M(x0 + dx * t, sag(t) - 0.02, z0 + dz * t, yaw, 0.44, 0.5, 1), PICADO_COLORS[(i + k * 3) % PICADO_COLORS.length], NONE);
  }
}

/** An ofrenda: three cloth-covered tiers, candles, photos, a sugar skull and a marigold arch; `halos` get the flames. */
function addAltar(b: Batch, s: (typeof MUERTOS_SPOTS)[number], halos: HaloSpot[]): void {
  const at = frame(s.x, s.y, s.z, s.f);
  const tier = (w: number, d: number, h: number, up: number, back: number, c: string) => { const q = at(0, up, -back); b.add(BOX(), M(q[0], q[1], q[2], s.f, w, h, d), c, NONE); };
  tier(1.7, 0.9, 0.4, 0, 0, CLOTH);
  tier(1.3, 0.62, 0.3, 0.4, 0.12, PURPLE);
  tier(0.9, 0.36, 0.28, 0.7, 0.24, PINK);
  // candles along the front edges, their flames glow (and halo at night)
  const candle = (side: number, up: number, fwd: number, h: number) => {
    const q = at(side, up, fwd);
    b.add(CYL(5), M(q[0], q[1], q[2], 0, 0.04, h, 0.04), WAX, NONE);
    b.add(ICO(0), M(q[0], q[1] + h + 0.04, q[2], 0, 0.028, 0.05, 0.028), FLAME, GLOW);
    halos.push({ x: q[0], y: q[1] + h + 0.05, z: q[2], size: 0.55, color: CANDLE_HALO });
  };
  for (const sd of [-0.7, -0.35, 0.35, 0.7]) candle(sd, 0.4, 0.38, 0.14 + Math.abs(sd) * 0.08);
  for (const sd of [-0.5, 0.5]) candle(sd, 0.7, 0.1, 0.18);
  // photos in frames on the top tier, a sugar skull in the middle
  for (const sd of [-0.28, 0, 0.28]) {
    const q = at(sd, 0.98, -0.3);
    b.add(CBOX(), M(q[0], q[1] + 0.13, q[2], s.f, 0.2, 0.26, 0.03), FRAME, NONE);
    const r = at(sd, 0.98, -0.28);
    b.add(CBOX(), M(r[0], r[1] + 0.13, r[2], s.f, 0.15, 0.2, 0.02), PHOTO, NONE);
  }
  const sk = at(0, 0.7, 0.02);
  b.add(ICO(0), M(sk[0], sk[1] + 0.07, sk[2], s.f, 0.08, 0.07, 0.08), SKULL, NONE);
  // the marigold arch over the back, and a pot either side in front
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    const q = at(Math.cos(a) * 0.82, 0.4 + Math.sin(a) * 1.05, -0.4);
    b.add(ICO(0), M(q[0], q[1], q[2], a, 0.1, 0.1, 0.1), MARIGOLD[i % 3], NONE);
  }
  addMarigolds(b, at(-0.95, 0, 0.45), 1);
  addMarigolds(b, at(0.95, 0, 0.45), 2);
}

/** The gathering point: a marigold arch over the sidewalk and two pots of candles. */
function addArch(b: Batch, s: (typeof MUERTOS_SPOTS)[number], halos: HaloSpot[]): void {
  const at = frame(s.x, s.y, s.z, s.f);
  for (const sd of [-0.9, 0.9]) { const q = at(sd, 0, 0); b.add(BOX(), M(q[0], q[1], q[2], s.f, 0.08, 2.1, 0.08), FRAME, NONE); }
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    const q = at(Math.cos(a) * 0.9, 2.1 + Math.sin(a) * 0.45, 0);
    b.add(ICO(0), M(q[0], q[1], q[2], a, 0.13, 0.13, 0.13), MARIGOLD[i % 3], NONE);
  }
  for (const sd of [-0.9, 0.9]) {
    addMarigolds(b, at(sd, 0, 0.35), sd > 0 ? 1 : 2);
    const q = at(sd * 0.6, 0, 0.5);
    b.add(CYL(5), M(q[0], q[1], q[2], 0, 0.05, 0.22, 0.05), WAX, NONE);
    b.add(ICO(0), M(q[0], q[1] + 0.26, q[2], 0, 0.035, 0.06, 0.035), FLAME, GLOW);
    halos.push({ x: q[0], y: q[1] + 0.27, z: q[2], size: 0.6, color: CANDLE_HALO });
  }
}

/** Everything of the day into one geometry (and its candle halos). */
export function buildMuertos(halos: HaloSpot[]): THREE.BufferGeometry {
  const b = new Batch();
  PICADO.forEach((s, k) => addPicado(b, s, k));
  MARIGOLDS.forEach((m, k) => addMarigolds(b, [m[0], m[2], m[1]], k));
  for (const s of MUERTOS_SPOTS) (s.kind === 'arch' ? addArch : addAltar)(b, s, halos);
  return b.build();
}

// --- the finds ------------------------------------------------------------------------------------------------------

export const MUERTOS_PLACE: Readonly<Record<string, Bilingual>> = {
  'potrero-del-sol': { zh: '波特雷罗德尔索尔公园的祭坛', en: 'an altar at Potrero del Sol Park' },
  'accion-latina': { zh: '24 街的社区祭坛', en: 'the community altar on 24th Street' },
  'procession-start': { zh: '22 街和布莱恩特街口', en: '22nd & Bryant' },
};

const idOf = (n: number) => `muertos:${n}`;
const sessionSeen = new Set<number>();
const paid = paidSet(id => halloweenSource(id), () => MUERTOS_SPOTS.map(s => idOf(s.n)));
export const muertosSeen = (n: number): boolean => sessionSeen.has(n) || paid().has(idOf(n));
export const muertosCount = (): number => MUERTOS_SPOTS.filter(s => muertosSeen(s.n)).length;

function visit(s: (typeof MUERTOS_SPOTS)[number]): void {
  if (muertosSeen(s.n)) return;
  sessionSeen.add(s.n);
  const count = muertosCount();
  emit({ type: 'reward', source: halloweenSource(idOf(s.n)), coins: MUERTOS_COINS });
  spawnFx('sparkle', s.x, s.y + 1.1, s.z, { count: 8, color: '#f5b041' });
  const place = MUERTOS_PLACE[s.where] ?? { zh: '', en: '' };
  toast({ zh: `亡灵节 ${count} / ${MUERTOS_SPOTS.length} · ${place.zh}`, en: `Día de los Muertos ${count} / ${MUERTOS_SPOTS.length} · ${place.en}` }, 'gold', 3200);
  let line: WorldLineKey = count === 1 ? 'muertosAltar' : 'muertosMarigold';
  if (s.kind === 'arch') line = 'muertosProcession';
  if (count === MUERTOS_SPOTS.length) {
    emit({ type: 'reward', source: halloweenSource(MUERTOS_ALL.id), coins: MUERTOS_ALL.coins });
    line = 'muertosAll';
  }
  if (count <= 2 || s.kind === 'arch' || count === MUERTOS_SPOTS.length) bubble(lineText(line), 4600, BAYBAY_ID, 'bark');
}

/** QA / tests: visit spot `n` now. */
export function visitMuertos(n: number): boolean {
  const s = MUERTOS_SPOTS.find(q => q.n === n);
  if (!s || muertosSeen(n)) return false;
  visit(s);
  return true;
}

const canVisit = () => { const m = runtime.move.mode; return (m === 'foot' || m === 'sit' || m === 'bike' || m === 'car') && !runtime.glide.active; };

export interface Muertos {
  group: THREE.Group;
  step(dt: number, px: number, py: number, pz: number, on: boolean): void;
  halos(): readonly HaloSpot[];
  /** BAYBAY's offered line near the Mission today (the hello, or the procession near its start) */
  near(px: number, pz: number): WorldLineKey | null;
  stats(): { built: boolean; tris: number; seen: number };
  dispose(): void;
}

export function createMuertos(): Muertos {
  const group = new THREE.Group();
  group.name = 'halloween-muertos';
  let mesh: THREE.Mesh | null = null;
  let halos: HaloSpot[] = [];
  let acc = 0;
  const offCleared = onSaveCleared(() => { sessionSeen.clear(); paid.forget(); });
  const drop = () => { if (!mesh) return; group.remove(mesh); mesh.geometry.dispose(); mesh = null; halos = []; };
  return {
    group,
    step: (dt, px, py, pz, on) => {
      if ((acc += dt) < 0.15) return;
      acc = 0;
      const want = on && Math.hypot(px - MUERTOS_AT.x, pz - MUERTOS_AT.z) < MUERTOS_NEAR;
      if (!want) { drop(); return; }
      if (!mesh) {
        const hl: HaloSpot[] = [];
        mesh = new THREE.Mesh(buildMuertos(hl), TOY_DYN);
        mesh.name = 'halloween-muertos';
        mesh.matrixAutoUpdate = false;
        mesh.matrixWorldAutoUpdate = false;
        mesh.receiveShadow = true;
        group.add(mesh);
        halos = hl;
      }
      if (!canVisit()) return;
      for (const s of MUERTOS_SPOTS) if (Math.hypot(s.x - px, s.z - pz) <= MUERTOS_PICK && Math.abs(s.y - py) < 3) { visit(s); break; }
    },
    halos: () => halos,
    near: (px, pz) => {
      const c = ROUTE_CORNERS.bryant22;
      if (Math.hypot(px - c.x, pz - c.z) < PROCESSION_NEAR) return 'muertosProcession';
      if (Math.hypot(px - MUERTOS_AT.x, pz - MUERTOS_AT.z) < MUERTOS_HELLO_NEAR) return 'muertosHello';
      return null;
    },
    stats: () => ({ built: !!mesh, tris: mesh ? (mesh.geometry.index?.count ?? 0) / 3 : 0, seen: muertosCount() }),
    dispose: () => { drop(); offCleared(); },
  };
}

/** Tests: forget the session. */
export function __resetMuertosForTests(): void { sessionSeen.clear(); paid.forget(); }
