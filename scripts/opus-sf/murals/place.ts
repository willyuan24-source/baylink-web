/**
 * Lane H2b (H2b-10): where the Mission mural panels stand, from our own streamed city (not hand-placed):
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/murals/place.ts
 *
 * For each alley (its centreline from the chunk roads, found by name) the gap to the building walls is measured on both
 * sides every 0.25 u (rays along the normal against every footprint edge of the chunks around). A panel slot is a span
 * of PANEL.width where a wall runs the whole way (≤ 3.5 u off the centreline) and is flat enough (≤ 1.5 u between the nearest
 * and farthest wall point); four panels, alternating sides, at the slot nearest 20 / 40 / 62 / 84 % of the alley (distance + 3 × the wall spread). The panel stands
 * PANEL.clear in front of the nearest wall point, facing the alley. Prints the MURALS placements (data/murals.ts).
 */
import { NO_NAME } from '../../../src/opus-bay/world/sf/format';
import { sfDisk } from '../../../tests/opus-bay-sf-disk';

export const PANEL = { width: 2.6, thick: 0.1, clear: 0.12 } as const;
const STEP = 0.25;
/** where along the alley (fraction of its length) the four panels aim, alternating left / right */
const TARGETS = [0.2, 0.4, 0.62, 0.84];

type Seg = [number, number, number, number];

async function main() {
  const sf = sfDisk();
  const far = await sf.far();
  const out: Record<string, { s: number; side: 'left' | 'right'; x: number; z: number; yaw: number; offset: number; spread: number }[]> = {};
  for (const [alley, near] of [['Clarion Alley', [260, 606]], ['Balmy Street', [457, 653]]] as const) {
    const cx = Math.floor(near[0] / 128), cz = Math.floor(near[1] / 128);
    const segs: Seg[] = [];
    let line: number[][] | null = null;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const c = await sf.chunk(cx + dx, cz + dz);
      if (!c) continue;
      const b = c.buildings;
      for (let i = 0; i < b.count; i++) {
        const n = b.vStart[i + 1] - b.vStart[i];
        for (let v = 0; v < n; v++) {
          const a = b.vStart[i] + v, e = b.vStart[i] + ((v + 1) % n);
          segs.push([b.xz[a * 2], b.xz[a * 2 + 1], b.xz[e * 2], b.xz[e * 2 + 1]]);
        }
      }
      const r = c.roads;
      for (let i = 0; i < r.count; i++) {
        if (r.nameIdx[i] === NO_NAME || far.names[r.nameIdx[i]] !== alley) continue;
        const pts: number[][] = [];
        for (let p = r.pStart[i]; p < r.pStart[i + 1]; p++) pts.push([r.xyz[p * 3], r.xyz[p * 3 + 2]]);
        if (!line || pts.length > line.length || (pts.length === line.length && len(pts) > len(line))) line = pts;
      }
    }
    if (!line) throw new Error(`${alley} not found`);
    const ray = (ox: number, oz: number, dx: number, dz: number) => {
      let best = Infinity;
      for (const [x1, z1, x2, z2] of segs) {
        const ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((x1 - ox) * ez - (z1 - oz) * ex) / den, s = ((x1 - ox) * dz - (z1 - oz) * dx) / den;
        if (t > 0 && s >= 0 && s <= 1) best = Math.min(best, t);
      }
      return best;
    };
    // samples along the centreline: position, tangent, wall gap left / right
    const S: { s: number; x: number; z: number; tx: number; tz: number; gap: Record<'left' | 'right', number> }[] = [];
    let acc = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const [x0, z0] = line[i], [x1, z1] = line[i + 1];
      const L = Math.hypot(x1 - x0, z1 - z0), tx = (x1 - x0) / L, tz = (z1 - z0) / L;
      for (let s = 0; s < L; s += STEP) {
        const x = x0 + tx * s, z = z0 + tz * s;
        S.push({ s: acc + s, x, z, tx, tz, gap: { left: ray(x, z, -tz, tx), right: ray(x, z, tz, -tx) } });
      }
      acc += L;
    }
    const half = Math.round(PANEL.width / 2 / STEP);
    const slots: (typeof out)[string] = [];
    const flat = (side: 'left' | 'right') => {
      const cand: { k: number; dmin: number; spread: number }[] = [];
      for (let k = half; k + half < S.length; k++) {
        const g = S.slice(k - half, k + half + 1).map(p => p.gap[side]);
        const dmin = Math.min(...g), dmax = Math.max(...g);
        if (dmax <= 3.5 && dmax - dmin <= 1.5) cand.push({ k, dmin, spread: dmax - dmin });
      }
      return cand;
    };
    const cands = { left: flat('left'), right: flat('right') };
    // four panels spread along the alley, alternating sides: the flat slot nearest each target
    const total = S[S.length - 1].s;
    TARGETS.forEach((f, i) => {
      const side = i % 2 === 0 ? 'left' : 'right';
      const want = f * total;
      const cost = (c: { k: number; spread: number }) => Math.abs(S[c.k].s - want) + 3 * c.spread;
      const c = [...cands[side]].sort((a, b) => cost(a) - cost(b))
        .find(c => slots.every(o => o.side !== side || Math.abs(o.s - S[c.k].s) >= PANEL.width + 0.6));
      if (!c) throw new Error(`${alley}: no flat wall near s = ${want.toFixed(1)} (${side})`);
      const p = S[c.k], sign = side === 'left' ? 1 : -1;
      const nx = -p.tz * sign, nz = p.tx * sign;
      const offset = c.dmin - PANEL.clear - PANEL.thick / 2;
      // the painted face looks back at the centreline
      slots.push({ s: +p.s.toFixed(2), side, x: +(p.x + nx * offset).toFixed(2), z: +(p.z + nz * offset).toFixed(2), yaw: +Math.atan2(-nx, -nz).toFixed(4), offset: +offset.toFixed(2), spread: +c.spread.toFixed(2) });
    });
    out[alley] = slots.sort((a, b) => a.s - b.s);
  }
  console.log(JSON.stringify(out, null, 1));
}

function len(p: number[][]) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }

void main();
