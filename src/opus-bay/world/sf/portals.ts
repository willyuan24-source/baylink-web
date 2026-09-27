import * as THREE from 'three';
import type { Polygon } from '../../core/types';
import { PORTAL_NAMES, type PortalId } from '../../data/sf/stationNames';
import { BOX, Batch, CYL, type Info, M } from '../builder';
import type { TransitLine, TransitPortal } from './format';

/**
 * The four tunnel mouths of the Muni Metro (wave 4 · lane T, plan §3.3): Duboce (the N surfaces in the Duboce Ave
 * median), the Sunset Tunnel east (Duboce Park) and west (Carl & Cole, the classic N Judah photo: landmark quality) and
 * West Portal (the M comes out of the 1918 Twin Peaks Tunnel onto West Portal Ave). No tunnel geometry is built: each
 * mouth is a toy concrete hood over the first 6.5–12.5 u of the ramp (dark inside); the track dives 0.25 u/u behind the
 * mouth (scripts/opus-sf/lib/metro.ts), so past the hood a train is under the ground, and the subway overlay takes over.
 *
 * Pure placement (`portalPlacements`, node-tested): position = the mouth (TransitPortal x, y, z), heading = INTO the
 * tunnel along the track. `portalGeometry(id)` ≤ 800 triangles each; `portalBlockers(p)` = the walk blockers (the hood
 * footprint and its wing walls, world frame) for lane G's walk data.
 */

export interface PortalPlacement {
  id: PortalId;
  name: { zh: string; en: string };
  line: string;
  x: number;
  y: number;
  z: number;
  /** yaw: local +z points into the tunnel */
  heading: number;
}

/** hood: outer width and height over the mouth (u) */
export const HOOD = { width: 4.9, height: 3.7 } as const;
/**
 * Hood length per mouth (u): long enough that beyond it a diving train's roof (the track drops 0.25 u/u behind the
 * mouth) is under the terrain there (measured on the terrain lattice: Duboce is flat, the Sunset mouths and West Portal
 * rise ≈ 0.2 u/u), short enough to stay clear of the houses on the hill.
 */
export const HOOD_LENGTH: Readonly<Record<PortalId, number>> = { duboce: 12.5, 'sunset-east': 6.5, 'sunset-west': 6.5, 'west-portal': 6.5 };
/** Wing walls along the approach (u): none at West Portal, where the trains come straight out onto the avenue. */
export const WING_LENGTH: Readonly<Record<PortalId, number>> = { duboce: 4, 'sunset-east': 4.5, 'sunset-west': 4.5, 'west-portal': 0 };

const PORTAL_OF: Record<string, PortalId> = {
  'Duboce portal': 'duboce', 'Sunset Tunnel east portal': 'sunset-east', 'Sunset Tunnel west portal': 'sunset-west', 'West Portal': 'west-portal',
};

function headingAt(l: Pick<TransitLine, 'path'>, x: number, z: number): number {
  let best = { d: Infinity, h: 0 };
  const p = l.path;
  for (let i = 3; i < p.length; i += 3) {
    const ax = p[i - 3], az = p[i - 1], bx = p[i], bz = p[i + 2];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best.d) best = { d, h: Math.atan2(dx, dz) };
  }
  return best.h;
}

/** The named mouths of the Metro lines (one per portal id; a mouth shared by two lines appears once). */
export function portalPlacements(lines: Pick<TransitLine, 'id' | 'path' | 'tunnels'>[]): PortalPlacement[] {
  const out: PortalPlacement[] = [];
  for (const l of lines) {
    for (const t of l.tunnels ?? []) {
      for (const [p, into] of [[t.portalA, 1], [t.portalB, -1]] as [TransitPortal | null, 1 | -1][]) {
        if (!p?.name) continue;
        const id = PORTAL_OF[p.name.en];
        if (!id || out.some(o => o.id === id)) continue;
        const h = headingAt(l, p.x, p.z) + (into > 0 ? 0 : Math.PI);
        out.push({ id, name: PORTAL_NAMES[id], line: l.id, x: p.x, y: p.y, z: p.z, heading: Math.atan2(Math.sin(h), Math.cos(h)) });
      }
    }
  }
  return out;
}

const NO: Info = [0, -100, 0, 0];
const LAMP: Info = [0, -100, 0, 1];
const CONCRETE = '#cfc8bb', CONCRETE_DARK = '#a8a194', STONE = '#d9ceb6', VOID = '#121416', GREEN = '#6f8f5a', TRIM = '#8a8174';

const box = (b: Batch, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, info: Info = NO) => b.add(BOX(), M(x, y, z, 0, sx, sy, sz), color, info);

/**
 * One mouth. Local frame: origin = the mouth on the track, +z into the tunnel, y up from the track at the mouth.
 * - every portal: the hood (two walls + roof over 14 u), a dark interior from 1.2 u in, the headwall frame, wing walls
 *   along the approach and a pair of lamps;
 * - `sunset-west` (landmark quality): a stepped parapet, fluted pilasters, a keystone, the 1928 plaque (blank) and
 *   planters on the wing walls; `west-portal`: a taller classical headwall with a cornice; `sunset-east`: a hillside
 *   mouth with a grassy top; `duboce`: a plain concrete hood in the street median.
 */
export function portalGeometry(id: PortalId): THREE.BufferGeometry {
  const b = new Batch();
  const W = HOOD.width, H = HOOD.height, L = HOOD_LENGTH[id], T = 0.4;
  const inner = W - 2 * T;
  // hood: side walls, roof, the dark void
  for (const s of [-1, 1]) box(b, s * (W / 2 - T / 2), -1.2, L / 2, T, H + 1.2, L, CONCRETE);
  box(b, 0, H - 0.4, L / 2, W, 0.4, L, CONCRETE_DARK);
  box(b, 0, -2.2, L / 2 + 0.6, inner - 0.02, H + 1.8, L - 1.2, VOID);
  // headwall frame at the mouth: two pilasters and a lintel
  for (const s of [-1, 1]) box(b, s * (inner / 2 + 0.35), -0.6, -0.15, 0.7, H + 0.6, 0.5, STONE);
  box(b, 0, H - 0.6, -0.15, W + 0.4, 0.8, 0.5, STONE);
  // wing walls along the approach (the ramp cut), stepping down away from the mouth; lamps on the headwall
  const wing = WING_LENGTH[id];
  for (const s of [-1, 1]) {
    if (wing > 0) {
      box(b, s * (W / 2 + 0.1), -0.8, -0.2 - wing * 0.3, 0.35, 2.2, wing * 0.6, CONCRETE);
      box(b, s * (W / 2 + 0.1), -0.8, -0.2 - wing * 0.8, 0.35, 1.2, wing * 0.4, CONCRETE);
    }
    box(b, s * (inner / 2 + 0.35), H - 1.4, -0.45, 0.22, 0.22, 0.12, '#fff1c8', LAMP);
  }
  if (id === 'sunset-west') {
    // the landmark mouth: stepped parapet, fluted pilasters, keystone, a blank 1928 plaque, planters, the hill cap
    box(b, 0, H + 0.2, -0.1, W + 0.8, 0.35, 0.6, STONE);
    box(b, 0, H + 0.55, -0.05, W - 0.6, 0.35, 0.5, STONE);
    box(b, 0, H + 0.9, 0, 2.2, 0.3, 0.45, STONE);
    for (const s of [-1, 1]) for (const k of [-0.18, 0.18]) box(b, s * (inner / 2 + 0.35) + k, -0.6, -0.42, 0.1, H + 0.4, 0.06, TRIM);
    box(b, 0, H - 0.95, -0.42, 0.6, 0.55, 0.12, '#e9dfc8');
    box(b, 0, H + 0.1, -0.4, 1.4, 0.4, 0.08, '#b9ad95');
    for (const s of [-1, 1]) {
      box(b, s * (W / 2 + 0.55), 1.4, -1.6, 0.9, 0.5, 2.4, CONCRETE_DARK);
      box(b, s * (W / 2 + 0.55), 1.9, -1.6, 0.8, 0.35, 2.2, GREEN);
    }
    box(b, 0, H, L / 2 + 1, W + 2, 1.2, L - 1, GREEN);
  } else if (id === 'west-portal') {
    // a taller classical headwall with a cornice and a round lamp each side
    box(b, 0, H + 0.2, -0.12, W + 1.4, 1.1, 0.55, STONE);
    box(b, 0, H + 1.3, -0.2, W + 1.8, 0.22, 0.7, TRIM);
    for (const s of [-1, 1]) b.add(CYL(8), M(s * (W / 2 + 0.5), H + 1.52, -0.2, 0, 0.18, 0.4, 0.18), '#fff1c8', LAMP);
  } else if (id === 'sunset-east') {
    // a hillside mouth: a grassy cap over the hood, a plain parapet
    box(b, 0, H + 0.2, -0.1, W + 0.4, 0.3, 0.5, STONE);
    box(b, 0, H, L / 2 + 1, W + 3, 1.6, L - 1, GREEN);
  } else {
    // Duboce: a plain hood in the median, a low safety rail on the roof edge
    box(b, 0, H, 0.2, W, 0.25, 0.1, TRIM);
  }
  const g = b.build();
  g.name = `portal-${id}`;
  return g;
}

/** Walk blockers of a placed mouth (world frame, CCW-agnostic rectangles): the hood and the wing walls. */
export function portalBlockers(p: Pick<PortalPlacement, 'id' | 'x' | 'z' | 'heading'>): Polygon[] {
  const s = Math.sin(p.heading), c = Math.cos(p.heading);
  // local (lx = left, lz = into the tunnel) → world
  const w = (lx: number, lz: number) => ({ x: p.x + s * lz + c * lx, z: p.z + c * lz - s * lx });
  const rect = (x0: number, x1: number, z0: number, z1: number) => [w(x0, z0), w(x1, z0), w(x1, z1), w(x0, z1)];
  const hw = HOOD.width / 2 + 0.3;
  const wing = WING_LENGTH[p.id];
  const out = [rect(-hw, hw, -0.4, HOOD_LENGTH[p.id])];
  if (wing > 0) out.push(rect(hw - 0.4, hw + 0.4, -0.4 - wing, -0.4), rect(-hw - 0.4, -hw + 0.4, -0.4 - wing, -0.4));
  return out;
}
