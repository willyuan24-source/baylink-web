import * as THREE from 'three';
import { heightAt } from '../core/terrain';
import { bayParts } from '../game/bayNow';
import { BOX, CBOX, ICO, M, Batch, type Info } from '../world/builder';
import { TOY } from '../world/materials';
import { closeRoad } from '../world/sf/roadClosures';
import { addFigure, addPumpkin } from './worldDress';

/**
 * Wave 8 · lane H · the Chinatown Halloween Festival on Waverly Place — Saturday 31 October 2026, 11:00–15:00 (Bay time).
 *
 * Facts (checked 2026-09-30): https://www.cycsf.org/chinatown-halloween-festival/ — "Saturday, October 31, 2026, from
 * 11am-3pm", Waverly Place, the Community Youth Center; "arts & crafts, games, a pumpkin patch", a costume contest (four
 * categories); https://www.cycsf.org/ — "cultural performances". lane S's calendar row (realsf/calendar.ts
 * `chinatown-halloween-festival-2026`) has the same window. Not in the BAYLINK catalog (a request to the site's editors).
 *
 * The kit, along the alley's own centreline (OSM "Waverly Place" in the published city, Washington St → Sacramento St):
 * red paper lanterns strung across the alley, two craft tables, a little pumpkin patch, a low stage with a painted
 * backdrop at the Sacramento end, and the costume contest's line-up — toy kids in costumes (the trick-or-treaters' ghost,
 * witch and pumpkin: worldDress addFigure, rocking on the toy shader's sway) queueing up to the stage, one on it.
 * ONE merged mesh on TOY (the city's static program): +1 call, only that day 11:00–15:00 and only within FEST_NEAR —
 * nothing else of the season is drawn in Chinatown. The pieces are not colliders (the alley stays walkable).
 */

export const FESTIVAL = { id: 'chinatown-halloween-festival-2026', date: '2026-10-31', from: 11 * 60, to: 15 * 60 } as const;
/** Waverly Place's centreline in the published city (OSM way, Washington St end first), x / z */
export const WAVERLY: readonly { x: number; z: number }[] = [
  { x: 20.8, z: 140.1 }, { x: 23.1, z: 141.7 }, { x: 24.7, z: 142.8 }, { x: 29.5, z: 146.2 }, { x: 32.2, z: 148.0 }, { x: 37.8, z: 151.9 }, { x: 43.5, z: 155.9 },
];
/** the kit is built within this of the alley's middle (u) */
export const FEST_NEAR = 160;
/** BAYBAY's lines: the contest line within CONTEST_NEAR of the stage, the lantern line within LANTERN_NEAR of the alley */
export const CONTEST_NEAR = 7, LANTERN_NEAR = 30;
/** a phone's toy budget for the whole kit (triangles) */
export const FESTIVAL_TRIS_MAX = 9000;

/** Whether the festival is on at `now` (the Bay clock): 31 October 2026, 11:00 ≤ t < 15:00. */
export function festivalOn(now: Date): boolean {
  const p = bayParts(now);
  const m = p.hour * 60 + p.minute;
  return p.dateKey === FESTIVAL.date && m >= FESTIVAL.from && m < FESTIVAL.to;
}

const ALLEY_LEN = (() => { let s = 0; for (let i = 1; i < WAVERLY.length; i++) s += Math.hypot(WAVERLY[i].x - WAVERLY[i - 1].x, WAVERLY[i].z - WAVERLY[i - 1].z); return s; })();
/** A point `s` u along the alley from its Washington St end and `side` u to its left (+) / right (−), with the alley's heading. */
export function alleyAt(s: number, side = 0): { x: number; z: number; hx: number; hz: number } {
  let t = Math.max(0, Math.min(ALLEY_LEN, s));
  for (let i = 1; i < WAVERLY.length; i++) {
    const a = WAVERLY[i - 1], b = WAVERLY[i], L = Math.hypot(b.x - a.x, b.z - a.z);
    if (t <= L || i === WAVERLY.length - 1) {
      const hx = (b.x - a.x) / L, hz = (b.z - a.z) / L, k = Math.min(1, t / L);
      return { x: a.x + (b.x - a.x) * k - hz * side, z: a.z + (b.z - a.z) * k + hx * side, hx, hz };
    }
    t -= L;
  }
  return { x: WAVERLY[0].x, z: WAVERLY[0].z, hx: 1, hz: 0 };
}
export const alleyLength = (): number => ALLEY_LEN;
/** where the stage stands (its front middle) and the line-up's spots (kid 0 on the stage, the rest queueing toward it) */
export const STAGE = { s: 23.2, side: -0.95, along: 2.2, across: 1.1, high: 0.32 } as const;
const QUEUE_SIDE = 0.75, QUEUE_FROM = 13.2, QUEUE_STEP = 1.05, KIDS = 8;

const NONE: Info = [0, 0, 0, 0];
const LANTERN_GLOW: Info = [0, 0, 0, 0.9];
const RED = '#d23b2f', RED_DARK = '#a8291f', GOLD = '#e6b04a', WIRE = '#2d2a2c', WOOD = '#8a5a3a', CLOTH = '#c8462f', HAY = '#d8b65a';
const BACKDROP = '#27222c', PUMPKIN = ['#e8792b', '#d9651f', '#f0913a'];
const CRAFTS = ['#f2c14e', '#5aa36a', '#4e7fc4', '#e46a8a', '#f08a3c'];

/** The festival kit's geometry (world space): `ground(x, z)` the terrain height. */
export function buildFestival(ground: (x: number, z: number) => number = heightAt): { geo: THREE.BufferGeometry; kids: number; lanterns: number } {
  const b = new Batch();
  const yAt = (x: number, z: number) => { const y = ground(x, z); return Number.isFinite(y) ? y : 0; };
  const yaw = (hx: number, hz: number) => Math.atan2(hx, hz);
  // the lanterns: a wire across the alley every 3 u, three red paper lanterns on it (gold caps), lit at dusk
  let lanterns = 0;
  for (let s = 2; s <= ALLEY_LEN - 1.5; s += 3) {
    const c = alleyAt(s), y = yAt(c.x, c.z) + 3.4, f = yaw(c.hx, c.hz);
    b.add(CBOX(), M(c.x, y, c.z, f + Math.PI / 2, 0.025, 0.025, 4.0), WIRE, NONE);
    for (const side of [-1.2, 0, 1.2]) {
      const p = alleyAt(s, side), dip = 0.28 - Math.abs(side) * 0.1;
      b.add(ICO(1), M(p.x, y - dip - 0.26, p.z, f, 0.2, 0.25, 0.2), lanterns % 4 === 3 ? RED_DARK : RED, LANTERN_GLOW);
      b.add(CBOX(), M(p.x, y - dip - 0.02, p.z, f, 0.09, 0.05, 0.09), GOLD, NONE);
      b.add(CBOX(), M(p.x, y - dip - 0.52, p.z, f, 0.07, 0.04, 0.07), GOLD, NONE);
      lanterns++;
    }
  }
  // two craft tables near the Washington St end (arts & crafts): a cloth-covered top, paper crafts on it
  for (const [s, k] of [[4.5, 0], [7.5, 1]] as const) {
    const c = alleyAt(s, -1.15), y = yAt(c.x, c.z), f = yaw(c.hx, c.hz);
    b.add(BOX(), M(c.x, y, c.z, f, 0.55, 0.5, 1.1), WOOD, NONE);
    b.add(BOX(), M(c.x, y + 0.5, c.z, f, 0.62, 0.05, 1.2), CLOTH, NONE);
    for (let i = 0; i < 4; i++) {
      const q = alleyAt(s - 0.4 + i * 0.27, -1.15 + ((i + k) % 2 ? 0.12 : -0.1));
      b.add(CBOX(), M(q.x, y + 0.6, q.z, f + i * 0.4, 0.13, 0.08, 0.1), CRAFTS[(i + k * 2) % CRAFTS.length], NONE);
    }
  }
  // the pumpkin patch: a hay bale and pumpkins
  {
    const c = alleyAt(10.5, -1.2), y = yAt(c.x, c.z), f = yaw(c.hx, c.hz);
    b.add(BOX(), M(c.x, y, c.z, f + 0.1, 0.5, 0.42, 0.9), HAY, NONE);
    addPumpkin(b, [c.x, y + 0.42, c.z], 0.2, f, PUMPKIN[0], false);
    for (let i = 0; i < 4; i++) {
      const q = alleyAt(9.2 + i * 0.85, -1.25 + (i % 2) * 0.35);
      addPumpkin(b, [q.x, yAt(q.x, q.z), q.z], 0.17 + (i % 3) * 0.05, f + i, PUMPKIN[i % 3], i === 3);
    }
  }
  // the stage: a low platform with a red skirt, a dark backdrop with a painted pumpkin, two lanterns on poles
  {
    const c = alleyAt(STAGE.s, STAGE.side), y = yAt(c.x, c.z), f = yaw(c.hx, c.hz);
    const facing = f + Math.PI / 2; // the stage faces across the alley (+left)
    // (local z runs along the alley, local x across it)
    b.add(BOX(), M(c.x, y, c.z, f, STAGE.across, STAGE.high, STAGE.along), WOOD, NONE);
    b.add(BOX(), M(c.x, y + STAGE.high, c.z, f, STAGE.across + 0.04, 0.03, STAGE.along + 0.04), RED, NONE);
    const back = alleyAt(STAGE.s, STAGE.side - STAGE.across / 2 + 0.05);
    b.add(BOX(), M(back.x, y + STAGE.high, back.z, f, 0.06, 1.5, STAGE.along), BACKDROP, NONE);
    const face = alleyAt(STAGE.s, STAGE.side - STAGE.across / 2 + 0.12);
    addPumpkin(b, [face.x, y + STAGE.high + 0.55, face.z], 0.3, facing, PUMPKIN[0], true, LANTERN_GLOW);
    for (const ds of [-1, 1]) {
      const pole = alleyAt(STAGE.s + ds * (STAGE.along / 2 + 0.15), STAGE.side - 0.3);
      b.add(BOX(), M(pole.x, y, pole.z, f, 0.06, 1.9, 0.06), WIRE, NONE);
      b.add(ICO(1), M(pole.x, y + 1.95, pole.z, f, 0.17, 0.21, 0.17), RED, LANTERN_GLOW);
    }
    // the contestant on the stage, facing the alley
    addFigure(b, [c.x, y + STAGE.high, c.z], facing, 1);
  }
  // the line-up: kids in costumes queueing along the alley toward the stage
  for (let i = 1; i < KIDS; i++) {
    const s = STAGE.s - 2.0 - (i - 1) * QUEUE_STEP;
    if (s < QUEUE_FROM - 6) break;
    const q = alleyAt(s, QUEUE_SIDE * (i % 2 ? 1 : 0.6));
    addFigure(b, [q.x, yAt(q.x, q.z), q.z], yaw(q.hx, q.hz) + (i % 3 === 0 ? 0.6 : 0), (i + 2) % 3);
  }
  const geo = b.build();
  geo.computeBoundingSphere();
  return { geo, kids: KIDS, lanterns };
}

export interface Festival {
  group: THREE.Group;
  /** ≈ 2 Hz: build the kit while the festival is on (`on`: the season runs) and the player is within FEST_NEAR */
  step(px: number, pz: number, on: boolean, now: Date): void;
  /** BAYBAY's line on offer at (x, z): 'contest' by the stage, 'lanterns' in the alley, else null */
  near(x: number, z: number): 'contest' | 'lanterns' | null;
  stats(): { shown: boolean; tris: number };
  dispose(): void;
}

/**
 * (W9-C2, lane C surgical — w8 H-RP-5) While the kit is up the alley is closed to the toy traffic (world/sf/roadClosures.ts):
 * a point within ALLEY_CLOSED u of the centreline, between its two ends (the cross streets' own junctions stay open).
 */
export const ALLEY_CLOSED = 2.6;
export function inAlley(x: number, z: number): boolean {
  let s0 = 0;
  for (let i = 1; i < WAVERLY.length; i++) {
    const a = WAVERLY[i - 1], b = WAVERLY[i], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(L, ((x - a.x) * dx + (z - a.z) * dz) / L)), s = s0 + t;
    if (s > 1.5 && s < ALLEY_LEN - 1.5 && Math.hypot(a.x + (dx * t) / L - x, a.z + (dz * t) / L - z) < ALLEY_CLOSED) return true;
    s0 += L;
  }
  return false;
}

/** the alley's ground is re-checked here (its two ends and middle) while the kit is up: a change rebuilds it */
const GROUND_PROBES = [0, 0.5, 1] as const;

export function createFestival(ground: (x: number, z: number) => number = heightAt): Festival {
  const group = new THREE.Group();
  group.name = 'halloween-festival';
  let mesh: THREE.Mesh | null = null;
  const mid = alleyAt(ALLEY_LEN / 2), stage = alleyAt(STAGE.s, STAGE.side);
  const probes = GROUND_PROBES.map(k => alleyAt(ALLEY_LEN * k));
  // the ground the kit was built on: the city streams its chunks in as the player comes (the far heights first), so a
  // kit built from 160 u away is rebuilt once the alley's own ground arrives (2 Hz, three samples)
  const built = new Float32Array(probes.length);
  const groundMoved = () => probes.some((p, k) => { const y = ground(p.x, p.z); return Number.isFinite(y) && (!Number.isFinite(built[k]) || Math.abs(y - built[k]) > 0.05); });
  let reopen: (() => void) | null = null;
  const drop = () => { reopen?.(); reopen = null; if (mesh) { group.remove(mesh); mesh.geometry.dispose(); mesh = null; } };
  return {
    group,
    step: (px, pz, on, now) => {
      const want = on && festivalOn(now) && Math.hypot(px - mid.x, pz - mid.z) < FEST_NEAR;
      if (!want) { drop(); return; }
      if (mesh && !groundMoved()) return;
      drop();
      probes.forEach((p, k) => { built[k] = ground(p.x, p.z); });
      mesh = new THREE.Mesh(buildFestival(ground).geo, TOY);
      mesh.name = 'halloween-festival';
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorldAutoUpdate = false;
      mesh.receiveShadow = true;
      group.add(mesh);
      reopen = closeRoad(inAlley);
    },
    near: (x, z) => {
      if (!mesh) return null;
      if (Math.hypot(x - stage.x, z - stage.z) < CONTEST_NEAR) return 'contest';
      if (Math.hypot(x - mid.x, z - mid.z) < LANTERN_NEAR) return 'lanterns';
      return null;
    },
    stats: () => ({ shown: !!mesh, tris: mesh ? (mesh.geometry.index?.count ?? 0) / 3 : 0 }),
    dispose: drop,
  };
}
