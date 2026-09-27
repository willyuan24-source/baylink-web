import * as THREE from 'three';
import { metroStation } from '../../data/sf/stationNames';
import { BOX, Batch, CYL, type Info, M } from '../builder';
import type { TransitLine } from './format';

/**
 * Stops and stations of the wave-4 lines (lane T, plan §3.2 / §3.3), as props for one static batched mesh
 * (world/sf/lineFleet.ts): pure placement (`stationProps`, node-tested) + one small geometry per kind.
 *
 * - `bus-pole`: the loop stop — a toy bus-stop pole with a coral roundel (the 观光 disc, no lettering), a cream
 *   timetable box and a small pennant, at the kerb right of the bus (the stop's x, z from transit.json).
 * - `kiosk`: the street headhouse of an underground Muni Metro station (plan §3.3: "a toy stair headhouse with the
 *   line-letter disc"): a glass canopy over a stairwell, a dark stair void, a pylon with the N / M discs in the line
 *   colours (no letters, no logo), at the stop's x, z (the pipeline put it on the Market St sidewalk).
 * - `rail-stop`: a surface Metro stop — a slim pole with a band in the line colour and a small sign plate, at the stop's
 *   x, z (the pipeline stood it outside the road, clear of a passing train and of buildings; the toy streets leave no
 *   room for boarding islands); a stop served by both lines gets one pole with both bands.
 * Heights come from `groundY` (the resident terrain) when known, else the track height at the stop.
 */

export type StationPropKind = 'bus-pole' | 'kiosk' | 'rail-stop' | 'rail-stop-nm';

export interface StationProp {
  kind: StationPropKind;
  /** station id (loop-* / muni-*) */
  station: string;
  lines: string[];
  x: number;
  y: number;
  z: number;
  /** yaw: +z of the prop faces this heading (poles face the road, kiosks face the street) */
  heading: number;
}

/** Surface Metro poles stand at least this far from the track centre (a passing train's outer side is at 2.4 u). */
export const RAIL_POLE_OFFSET = 2.7;

function pathHeading(l: Pick<TransitLine, 'path'>, x: number, z: number): { heading: number; px: number; pz: number; y: number } {
  let best = { d: Infinity, heading: 0, px: x, pz: z, y: 0 };
  const p = l.path;
  for (let i = 3; i < p.length; i += 3) {
    const ax = p[i - 3], az = p[i - 1], bx = p[i], bz = p[i + 2];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
    if (d < best.d) best = { d, heading: Math.atan2(dx, dz), px: qx, pz: qz, y: p[i - 2] + (p[i + 1] - p[i - 2]) * t };
  }
  return best;
}

/**
 * Every stop / station prop of the wave-4 lines (pure). `groundY` gives the resident ground height where known;
 * `placed` = the pipeline's prop positions by stop id (transit-w4.json `props`), else the stop's own x, z.
 * Shared Market St stations (N + M) get one kiosk; a surface stop shared by both lines one pole.
 */
export function stationProps(lines: Pick<TransitLine, 'id' | 'kind' | 'path' | 'stops'>[], groundY?: (x: number, z: number) => number | null, placed?: Readonly<Record<string, readonly [number, number]>>): StationProp[] {
  const out: StationProp[] = [];
  const byStation = new Map<string, StationProp>();
  for (const l of lines) {
    for (const s0 of l.stops) {
      // the pipeline's placed prop position (transit-w4.json `props`) wins over the stop point
      const pp = placed?.[s0.id];
      const s = pp ? { ...s0, x: pp[0], z: pp[1] } : s0;
      const h = pathHeading(l, s.x, s.z);
      const y = (x: number, z: number) => groundY?.(x, z) ?? h.y;
      if (l.kind === 'bus') {
        // the pole stands at the kerb right of the bus: face the road (the sign reads from the street)
        const face = Math.atan2(h.px - s.x, h.pz - s.z);
        out.push({ kind: 'bus-pole', station: s.id, lines: [l.id], x: s.x, y: y(s.x, s.z), z: s.z, heading: face });
        continue;
      }
      const prev = byStation.get(s.id);
      if (prev) { if (!prev.lines.includes(l.id)) { prev.lines.push(l.id); if (prev.kind === 'rail-stop') prev.kind = 'rail-stop-nm'; } continue; }
      let p: StationProp;
      if (metroStation(s.id)?.underground) {
        const face = Math.atan2(h.px - s.x, h.pz - s.z);
        p = { kind: 'kiosk', station: s.id, lines: [l.id], x: s.x, y: y(s.x, s.z), z: s.z, heading: face };
      } else {
        // the pole stands where the pipeline found room (scripts/opus-sf/lib/stopPlace.ts): outside the road, clear of a
        // passing train and of buildings; it faces the track
        const face = Math.atan2(h.px - s.x, h.pz - s.z);
        p = { kind: 'rail-stop', station: s.id, lines: [l.id], x: s.x, y: y(s.x, s.z), z: s.z, heading: face };
      }
      byStation.set(s.id, p);
      out.push(p);
    }
  }
  return out;
}

const NO: Info = [0, -100, 0, 0];
const LAMP: Info = [0, -100, 0, 1];
const GLOW: Info = [0, -100, 0, 1.4];
const POLE = '#6f7378', CORAL = '#e0563f', CREAM = '#f4e6c8', DARK = '#2c2e30', GLASS = '#8fb3c4', CONCRETE = '#c9c3b8';
const N_BLUE = '#2f6fb0', M_GREEN = '#2f8f5b';

const box = (b: Batch, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, info: Info = NO, ry = 0) => b.add(BOX(), M(x, y, z, ry, sx, sy, sz), color, info);

/** The loop's bus-stop pole (≈ 130 triangles): local +z faces the road. */
export function busPoleGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(CYL(6), M(0, 0, 0, 0, 0.07, 3.2, 0.07), POLE, NO);
  // the roundel: a coral ring on cream with a cream bar across (reads as a tour-bus stop, never as a STOP sign)
  b.add(CYL(16), M(0, 2.85, 0.08, 0, 0.42, 0.04, 0.42, Math.PI / 2), CORAL, NO);
  b.add(CYL(16), M(0, 2.85, 0.1, 0, 0.28, 0.04, 0.28, Math.PI / 2), CREAM, NO);
  box(b, 0, 2.77, 0.14, 0.95, 0.16, 0.03, CREAM);
  box(b, 0, 1.35, 0.08, 0.36, 0.55, 0.06, CREAM, GLOW);
  // the small pennant on a stub arm (points along the kerb)
  box(b, 0.22, 3.18, 0, 0.44, 0.03, 0.03, POLE);
  b.add(BOX(), M(0.52, 2.95, 0, 0, 0.3, 0.26, 0.02), CORAL, NO);
  const g = b.build();
  g.name = 'loop-stop-pole';
  return g;
}

/** A Market St kiosk (≈ 280 triangles, 2.2 × 3.0 u): canopy, stair void, glass side screens, the pylon with the N / M discs. */
export function kioskGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  // the stairwell surround and the dark void going down (+z = the street side, the stairs descend toward −z)
  box(b, 0, 0, 0, 2.2, 0.35, 3.0, CONCRETE);
  box(b, 0, 0.02, 0.1, 1.6, 0.34, 2.5, DARK);
  for (let k = 0; k < 4; k++) box(b, 0, 0.36 - k * 0.09, 0.95 - k * 0.45, 1.5, 0.03, 0.42, '#4a4d50');
  // glass side screens and a light canopy on four posts
  for (const s of [-1, 1]) {
    box(b, s * 0.94, 0.35, -0.15, 0.06, 1.0, 2.5, GLASS);
    for (const z of [-1.35, 1.35]) box(b, s * 1.02, 0.35, z, 0.1, 2.05, 0.1, POLE);
  }
  box(b, 0, 2.4, 0, 2.4, 0.12, 3.2, '#e9e4da');
  box(b, 0, 2.33, 0, 1.9, 0.06, 2.7, '#fff4d8', LAMP);
  // the pylon at the street end: the N and M discs, lit at night
  box(b, 0.95, 0.35, 1.72, 0.14, 3.2, 0.14, POLE);
  b.add(CYL(12), M(0.95, 3.25, 1.8, 0, 0.24, 0.04, 0.24, Math.PI / 2), N_BLUE, GLOW);
  b.add(CYL(12), M(0.95, 2.72, 1.8, 0, 0.24, 0.04, 0.24, Math.PI / 2), M_GREEN, GLOW);
  const g = b.build();
  g.name = 'metro-kiosk';
  return g;
}

/** A surface Metro stop (≈ 70 triangles): the pole with line bands (`nm`: both N and M) and a small sign plate. */
export function railStopGeometry(nm: 'n' | 'm' | 'nm'): THREE.BufferGeometry {
  const b = new Batch();
  b.add(CYL(6), M(0, 0, 0, 0, 0.06, 3.0, 0.06), POLE, NO);
  const bands = nm === 'nm' ? [N_BLUE, M_GREEN] : [nm === 'n' ? N_BLUE : M_GREEN];
  bands.forEach((c, i) => b.add(CYL(8), M(0, 2.5 - i * 0.3, 0, 0, 0.1, 0.24, 0.1), c, GLOW));
  box(b, 0, 1.4, 0.07, 0.34, 0.46, 0.04, CREAM, GLOW);
  const g = b.build();
  g.name = nm === 'nm' ? 'rail-stop-nm' : 'rail-stop';
  return g;
}

/** The geometry for a prop kind (N / M variants of the surface stop by its lines). */
export function stationGeometryKey(p: StationProp): string {
  if (p.kind === 'rail-stop') return p.lines[0] === 'n-judah' ? 'rail-stop-n' : 'rail-stop-m';
  return p.kind;
}
